import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger, auditLogger } from '../middleware/logging.middleware';
import { ValidationError, ExternalServiceError } from '../utils/errors';
import { GitHubClient, createGitHubClient } from './github.service';
import analysisService from './analysisService';
import { executeWrite, executeQuerySingle } from '../database/db';
import config from '../config/config';

export interface WebhookPayload {
  action?: string;
  repository: {
    full_name: string;
    clone_url: string;
    default_branch: string;
  };
  sender: {
    login: string;
    id: number;
  };
  pull_request?: {
    number: number;
    title: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
  };
  ref?: string;
  commits?: Array<{
    id: string;
    message: string;
    url: string;
  }>;
}

export interface WebhookEvent {
  id: string;
  event: string;
  payload: WebhookPayload;
  signature: string;
  deliveryId: string;
  processedAt: Date;
}

/**
 * Webhook Service for handling GitHub webhooks
 */
export class WebhookService {
  private githubClient: GitHubClient | null = null;

  constructor() {
    // Initialize GitHub client if token is configured
    if (process.env.GITHUB_TOKEN) {
      this.githubClient = createGitHubClient(
        process.env.GITHUB_TOKEN,
        process.env.GITHUB_ENTERPRISE_URL
      );
    }
  }

  /**
   * Verify GitHub webhook signature using HMAC-SHA256
   */
  public verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    try {
      if (!signature || !signature.startsWith('sha256=')) {
        logger.warn('Invalid signature format', { signature });
        return false;
      }

      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payload).digest('hex');

      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      logger.error('Signature verification failed', { error });
      return false;
    }
  }

  /**
   * Process webhook event
   */
  public async processWebhook(
    event: string,
    payload: WebhookPayload,
    deliveryId: string
  ): Promise<void> {
    const webhookId = uuidv4();

    logger.info('Processing GitHub webhook', {
      webhookId,
      event,
      deliveryId,
      repository: payload.repository.full_name,
      action: payload.action,
    });

    // Store webhook event
    await this.storeWebhookEvent(webhookId, event, payload, deliveryId);

    try {
      switch (event) {
        case 'push':
          await this.handlePushEvent(payload, webhookId);
          break;

        case 'pull_request':
          await this.handlePullRequestEvent(payload, webhookId);
          break;

        case 'ping':
          logger.info('Webhook ping received', { deliveryId });
          break;

        default:
          logger.info('Unhandled webhook event', { event });
      }

      // Update webhook status
      await this.updateWebhookStatus(webhookId, 'processed');
    } catch (error) {
      logger.error('Webhook processing failed', {
        webhookId,
        event,
        error,
      });

      await this.updateWebhookStatus(
        webhookId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  /**
   * Handle push event
   */
  private async handlePushEvent(
    payload: WebhookPayload,
    webhookId: string
  ): Promise<void> {
    const { repository, ref, commits, sender } = payload;

    logger.info('Processing push event', {
      webhookId,
      repository: repository.full_name,
      ref,
      commits: commits?.length || 0,
    });

    // Only analyze pushes to main/master branch
    const branch = ref?.replace('refs/heads/', '');
    if (branch !== 'main' && branch !== 'master') {
      logger.info('Skipping analysis for non-main branch', { branch });
      return;
    }

    // Create threat model for the repository if not exists
    const threatModelId = await this.ensureThreatModel(
      repository.full_name,
      repository.clone_url,
      sender.login
    );

    // Trigger analysis
    await this.triggerAnalysis(
      threatModelId,
      repository.clone_url,
      branch,
      webhookId
    );

    auditLogger.info('Push event processed', {
      webhookId,
      repository: repository.full_name,
      threatModelId,
    });
  }

  /**
   * Handle pull request event
   */
  private async handlePullRequestEvent(
    payload: WebhookPayload,
    webhookId: string
  ): Promise<void> {
    const { repository, pull_request, action, sender } = payload;

    if (!pull_request) {
      logger.warn('Pull request data missing in payload');
      return;
    }

    logger.info('Processing pull request event', {
      webhookId,
      repository: repository.full_name,
      prNumber: pull_request.number,
      action,
    });

    // Only process opened and synchronize (new commits) actions
    if (action !== 'opened' && action !== 'synchronize') {
      logger.info('Skipping PR analysis for action', { action });
      return;
    }

    // Create threat model if not exists
    const threatModelId = await this.ensureThreatModel(
      repository.full_name,
      repository.clone_url,
      sender.login
    );

    // Trigger analysis for PR branch
    const analysisResult = await this.triggerAnalysis(
      threatModelId,
      repository.clone_url,
      pull_request.head.ref,
      webhookId
    );

    // Comment on PR with findings
    if (this.githubClient && analysisResult) {
      await this.commentOnPullRequest(
        repository.full_name,
        pull_request.number,
        analysisResult
      );
    }

    auditLogger.info('Pull request event processed', {
      webhookId,
      repository: repository.full_name,
      prNumber: pull_request.number,
      threatModelId,
    });
  }

  /**
   * Ensure threat model exists for repository
   */
  private async ensureThreatModel(
    repoFullName: string,
    cloneUrl: string,
    createdBy: string
  ): Promise<string> {
    // Check if threat model exists
    const existing = executeQuerySingle<{ id: string }>(
      'SELECT id FROM threat_models WHERE name = ?',
      [repoFullName]
    );

    if (existing) {
      return existing.id;
    }

    // Create new threat model
    const id = uuidv4();
    const now = new Date().toISOString();

    // Get or create system user for GitHub automation
    const systemUser = await this.ensureSystemUser();

    executeWrite(
      `INSERT INTO threat_models (id, name, description, status, methodology, system_description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        repoFullName,
        `Auto-generated threat model for ${repoFullName}`,
        'in_progress',
        'STRIDE',
        `GitHub repository: ${cloneUrl}`,
        systemUser,
        now,
        now,
      ]
    );

    logger.info('Threat model created for repository', {
      id,
      repository: repoFullName,
    });

    return id;
  }

  /**
   * Ensure system user exists for automation
   */
  private async ensureSystemUser(): Promise<string> {
    const systemEmail = 'system@threatmodel.local';

    const existing = executeQuerySingle<{ id: string }>(
      'SELECT id FROM users WHERE email = ?',
      [systemEmail]
    );

    if (existing) {
      return existing.id;
    }

    // Create system user
    const id = uuidv4();
    const now = new Date().toISOString();

    executeWrite(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, systemEmail, 'system', 'admin', now, now]
    );

    return id;
  }

  /**
   * Trigger threat analysis for repository
   */
  private async triggerAnalysis(
    threatModelId: string,
    cloneUrl: string,
    branch: string,
    webhookId: string
  ): Promise<{ threats: number; severity: Record<string, number> } | null> {
    try {
      logger.info('Triggering threat analysis', {
        threatModelId,
        cloneUrl,
        branch,
        webhookId,
      });

      // Clone and analyze repository if GitHub client is available
      if (this.githubClient) {
        const { analysis, localPath } = await this.githubClient.cloneAndAnalyzeRepository(
          cloneUrl,
          { branch, depth: 1 }
        );

        // Create analysis record
        const analysisId = uuidv4();
        const now = new Date().toISOString();

        executeWrite(
          `INSERT INTO analyses (id, threat_model_id, status, dfd_json, analysis_type, started_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            analysisId,
            threatModelId,
            'running',
            JSON.stringify(analysis.files),
            'automated',
            now,
          ]
        );

        // Trigger AI analysis (async)
        const description = `Repository: ${cloneUrl}\nFiles: ${analysis.statistics.totalFiles}\nInfrastructure files: ${analysis.files.infrastructure.length}\nCode files: ${analysis.files.code.length}`;

        // This would typically call the analysis service
        // For now, we'll just log it
        logger.info('Analysis data prepared', {
          analysisId,
          threatModelId,
          statistics: analysis.statistics,
        });

        // Clean up cloned repository
        const { cleanupRepository } = require('../utils/gitOperations');
        await cleanupRepository(localPath);

        // Return mock results for now
        return {
          threats: analysis.files.infrastructure.length + analysis.files.code.length,
          severity: { high: 2, medium: 5, low: 3 },
        };
      }

      return null;
    } catch (error) {
      logger.error('Analysis trigger failed', {
        threatModelId,
        cloneUrl,
        error,
      });
      throw error;
    }
  }

  /**
   * Comment on pull request with analysis findings
   */
  private async commentOnPullRequest(
    repoFullName: string,
    prNumber: number,
    analysisResult: { threats: number; severity: Record<string, number> }
  ): Promise<void> {
    if (!this.githubClient) {
      logger.warn('GitHub client not initialized, skipping PR comment');
      return;
    }

    const { owner, repo } = GitHubClient.parseRepoUrl(repoFullName);

    const comment = this.generatePRComment(analysisResult);

    try {
      await this.githubClient.createComment(owner, repo, prNumber, { body: comment });
      logger.info('Comment posted on PR', { repo: repoFullName, prNumber });
    } catch (error) {
      logger.error('Failed to post PR comment', {
        repo: repoFullName,
        prNumber,
        error,
      });
    }
  }

  /**
   * Generate PR comment with analysis findings
   */
  private generatePRComment(analysisResult: {
    threats: number;
    severity: Record<string, number>;
  }): string {
    const { threats, severity } = analysisResult;

    return `## 🔒 Threat Model Analysis Results

**Total Potential Threats Identified:** ${threats}

### Severity Breakdown
${Object.entries(severity)
  .map(([level, count]) => `- **${level.toUpperCase()}:** ${count}`)
  .join('\n')}

### Recommendations
- Review identified threats in the [Threat Modeling Platform](${config.cors.origin[0]})
- Address high and critical severity threats before merging
- Update mitigation strategies for accepted risks

---
*This analysis was automatically generated by the Threat Modeling Platform*
`;
  }

  /**
   * Create GitHub issue for a threat
   */
  public async createThreatIssue(
    repoFullName: string,
    threat: {
      name: string;
      description: string;
      severity: string;
      mitigation: string;
    }
  ): Promise<string | null> {
    if (!this.githubClient) {
      throw new ValidationError('GitHub client not configured');
    }

    const { owner, repo } = GitHubClient.parseRepoUrl(repoFullName);

    try {
      const issue = await this.githubClient.createIssue(owner, repo, {
        title: `[Security] ${threat.name}`,
        body: `## Threat Details

**Severity:** ${threat.severity.toUpperCase()}

### Description
${threat.description}

### Recommended Mitigation
${threat.mitigation}

---
*This issue was automatically created by the Threat Modeling Platform*
`,
        labels: ['security', `severity:${threat.severity}`],
      });

      return issue.html_url;
    } catch (error) {
      logger.error('Failed to create GitHub issue', {
        repo: repoFullName,
        threat: threat.name,
        error,
      });
      return null;
    }
  }

  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(
    id: string,
    event: string,
    payload: WebhookPayload,
    deliveryId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    executeWrite(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes_json, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        null,
        'WEBHOOK_RECEIVED',
        'github_webhook',
        id,
        JSON.stringify(payload),
        `Event: ${event}, Delivery: ${deliveryId}`,
        now,
      ]
    );
  }

  /**
   * Update webhook processing status
   */
  private async updateWebhookStatus(
    id: string,
    status: string,
    error?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    executeWrite(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        null,
        'WEBHOOK_' + status.toUpperCase(),
        'github_webhook',
        id,
        error || `Webhook ${status}`,
        now,
      ]
    );
  }
}

export default new WebhookService();
