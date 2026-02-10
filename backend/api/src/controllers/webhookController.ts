import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { ValidationError, AuthenticationError } from '../utils/errors';
import webhookService from '../services/webhookService';
import { logger } from '../middleware/logging.middleware';
import config from '../config/config';

// GitHub webhook event types
type GitHubEvent =
  | 'push'
  | 'pull_request'
  | 'pull_request_review'
  | 'issues'
  | 'issue_comment'
  | 'ping'
  | 'repository';

/**
 * Handle GitHub webhook events
 */
export const handleGitHubWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Get headers
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as GitHubEvent;
    const deliveryId = req.headers['x-github-delivery'] as string;

    // Validate headers
    if (!signature || !event || !deliveryId) {
      throw new ValidationError('Missing required webhook headers');
    }

    // Get webhook secret from config
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('GitHub webhook secret not configured');
      throw new ValidationError('Webhook not configured');
    }

    // Get raw body for signature verification
    const rawBody = req.body;
    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    // Verify signature
    const isValid = webhookService.verifySignature(
      bodyString,
      signature,
      webhookSecret
    );

    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        event,
        deliveryId,
        ip: req.ip,
      });
      throw new AuthenticationError('Invalid webhook signature');
    }

    // Parse payload
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

    logger.info('GitHub webhook received', {
      event,
      deliveryId,
      repository: payload.repository?.full_name,
      action: payload.action,
    });

    // Process webhook asynchronously (don't wait for completion)
    webhookService.processWebhook(event, payload, deliveryId).catch((error) => {
      logger.error('Async webhook processing failed', {
        event,
        deliveryId,
        error,
      });
    });

    // Respond immediately to GitHub
    res.status(202).json({
      status: 'accepted',
      message: 'Webhook received and queued for processing',
      deliveryId,
    });
  }
);

/**
 * Test webhook endpoint (for development)
 */
export const testWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (config.nodeEnv === 'production') {
      throw new ValidationError('Test endpoint not available in production');
    }

    const { event = 'ping', payload = {} } = req.body;

    logger.info('Test webhook triggered', { event });

    await webhookService.processWebhook(event, payload, 'test-delivery-' + Date.now());

    res.json({
      status: 'success',
      message: 'Test webhook processed',
    });
  }
);

/**
 * Get webhook status and statistics
 */
export const getWebhookStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { executeQuery } = await import('../database/db');

    // Get webhook statistics from audit logs
    const stats = executeQuery<{
      action: string;
      count: number;
    }>(
      `SELECT action, COUNT(*) as count 
       FROM audit_logs 
       WHERE resource_type = 'github_webhook' 
       AND timestamp > datetime('now', '-7 days')
       GROUP BY action
       ORDER BY count DESC`
    );

    // Get recent webhooks
    const recentWebhooks = executeQuery<{
      resource_id: string;
      action: string;
      details: string;
      timestamp: string;
    }>(
      `SELECT resource_id, action, details, timestamp
       FROM audit_logs 
       WHERE resource_type = 'github_webhook'
       ORDER BY timestamp DESC
       LIMIT 50`
    );

    res.json({
      status: 'success',
      data: {
        statistics: stats,
        recent: recentWebhooks,
      },
    });
  }
);

/**
 * Manually trigger repository analysis
 */
export const triggerRepositoryAnalysis = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      repository_url: z.string().url(),
      branch: z.string().optional().default('main'),
    });

    const { repository_url, branch } = schema.parse(req.body);

    logger.info('Manual repository analysis triggered', {
      repository_url,
      branch,
    });

    const { GitHubClient } = await import('../services/github.service');
    const { owner, repo, isValid } = GitHubClient.parseRepoUrl(repository_url);

    if (!isValid) {
      throw new ValidationError('Invalid repository URL');
    }

    // Create mock webhook payload for push event
    const mockPayload = {
      repository: {
        full_name: `${owner}/${repo}`,
        clone_url: repository_url,
        default_branch: branch,
      },
      sender: {
        login: 'manual-trigger',
        id: 0,
      },
      ref: `refs/heads/${branch}`,
    };

    // Process as webhook
    await webhookService.processWebhook(
      'push',
      mockPayload,
      'manual-' + Date.now()
    );

    res.json({
      status: 'success',
      message: 'Repository analysis triggered',
      repository: `${owner}/${repo}`,
      branch,
    });
  }
);

/**
 * Create GitHub issue for a threat
 */
export const createGitHubIssueForThreat = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      threat_id: z.string().uuid(),
      repository: z.string(),
    });

    const { threat_id, repository } = schema.parse(req.body);

    // Get threat details from database
    const { executeQuerySingle } = await import('../database/db');
    const threat = executeQuerySingle<{
      id: string;
      name: string;
      description: string;
      severity: string;
      mitigation: string;
    }>('SELECT id, name, description, severity, mitigation FROM threats WHERE id = ?', [
      threat_id,
    ]);

    if (!threat) {
      throw new ValidationError('Threat not found');
    }

    // Create GitHub issue
    const issueUrl = await webhookService.createThreatIssue(repository, {
      name: threat.name,
      description: threat.description || 'No description provided',
      severity: threat.severity,
      mitigation: threat.mitigation || 'No mitigation provided',
    });

    if (issueUrl) {
      // Update threat with GitHub issue URL
      const { executeWrite } = await import('../database/db');
      executeWrite(
        'UPDATE threats SET jira_ticket = ?, updated_at = ? WHERE id = ?',
        [issueUrl, new Date().toISOString(), threat_id]
      );
    }

    res.json({
      status: 'success',
      message: 'GitHub issue created',
      issueUrl,
    });
  }
);
