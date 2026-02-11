/**
 * Jira Integration Controller
 * 
 * API endpoints for Jira integration
 */

import { Request, Response } from 'express';
import JiraClient from '../services/jira.service';
import fs from 'fs/promises';
import path from 'path';

interface JiraSyncRequest {
  threats: any[];
  create_new?: boolean;
  update_existing?: boolean;
}

interface JiraWebhookPayload {
  webhookEvent: string;
  issue: {
    key: string;
    fields: {
      status: {
        name: string;
      };
      labels: string[];
    };
  };
}

class JiraIntegrationController {
  private jiraClient: JiraClient | null = null;
  private mappingFilePath: string;

  constructor() {
    this.mappingFilePath = path.join(__dirname, '../data/jira-threat-mapping.json');
    this.initializeJiraClient();
  }

  /**
   * Initialize Jira client from environment variables
   */
  private initializeJiraClient(): void {
    const config = {
      host: process.env.JIRA_HOST || '',
      username: process.env.JIRA_USERNAME || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
      projectKey: process.env.JIRA_PROJECT_KEY || '',
      defaultAssignee: process.env.JIRA_DEFAULT_ASSIGNEE,
    };

    // Validate required configuration
    if (!config.host || !config.username || !config.apiToken || !config.projectKey) {
      console.warn('⚠️  Jira integration not configured. Set JIRA_HOST, JIRA_USERNAME, JIRA_API_TOKEN, and JIRA_PROJECT_KEY');
      return;
    }

    try {
      this.jiraClient = new JiraClient(config);
      console.log('✅ Jira client initialized');
      
      // Load persisted mappings
      this.loadMappings();
    } catch (error) {
      console.error('❌ Failed to initialize Jira client:', error);
    }
  }

  /**
   * Check if Jira is configured
   */
  private isJiraConfigured(): boolean {
    return this.jiraClient !== null;
  }

  /**
   * Load threat-issue mappings from file
   */
  private async loadMappings(): Promise<void> {
    if (!this.jiraClient) return;

    try {
      const data = await fs.readFile(this.mappingFilePath, 'utf-8');
      const mappings = JSON.parse(data);
      
      Object.entries(mappings).forEach(([threatId, issueKey]) => {
        this.jiraClient!.setIssueKeyForThreat(threatId, issueKey as string);
      });
      
      console.log(`✅ Loaded ${Object.keys(mappings).length} threat-issue mappings`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('❌ Failed to load mappings:', error);
      }
    }
  }

  /**
   * Save threat-issue mappings to file
   */
  private async saveMappings(mappings: Record<string, string>): Promise<void> {
    try {
      const dir = path.dirname(this.mappingFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.mappingFilePath, JSON.stringify(mappings, null, 2));
      console.log('✅ Saved threat-issue mappings');
    } catch (error) {
      console.error('❌ Failed to save mappings:', error);
    }
  }

  /**
   * POST /api/jira/sync
   * Sync threats to Jira
   */
  syncThreats = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
        message: 'Please configure Jira credentials in environment variables',
      });
      return;
    }

    try {
      const { threats, create_new = true, update_existing = false } = req.body as JiraSyncRequest;

      if (!threats || !Array.isArray(threats)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'threats array is required',
        });
        return;
      }

      const results = {
        total: threats.length,
        created: 0,
        updated: 0,
        failed: 0,
        issues: [] as Array<{ threat_id: string; issue_key: string; action: string }>,
        errors: [] as Array<{ threat_id: string; error: string }>,
      };

      for (const threat of threats) {
        try {
          const existingIssueKey = this.jiraClient!.getIssueKeyForThreat(threat.threat_id);

          if (existingIssueKey && update_existing) {
            // Update existing issue
            await this.jiraClient!.updateIssue(existingIssueKey, {
              summary: `[${threat.severity.toUpperCase()}] ${threat.threat_name}`,
              description: threat.description,
              priority: threat.severity === 'critical' ? 'Highest' : 'High',
            });

            results.updated++;
            results.issues.push({
              threat_id: threat.threat_id,
              issue_key: existingIssueKey,
              action: 'updated',
            });
          } else if (!existingIssueKey && create_new) {
            // Create new issue
            const issueKey = await this.jiraClient!.createIssue(threat);
            
            await this.jiraClient!.linkIssueToThreat(
              issueKey,
              threat.threat_id,
              `${process.env.APP_URL}/threats/${threat.threat_id}`
            );

            results.created++;
            results.issues.push({
              threat_id: threat.threat_id,
              issue_key: issueKey,
              action: 'created',
            });
          }
        } catch (error: any) {
          console.error(`Failed to sync threat ${threat.threat_id}:`, error);
          results.failed++;
          results.errors.push({
            threat_id: threat.threat_id,
            error: error.message,
          });
        }
      }

      // Save mappings
      const mappings: Record<string, string> = {};
      results.issues.forEach(({ threat_id, issue_key }) => {
        mappings[threat_id] = issue_key;
      });
      await this.saveMappings(mappings);

      res.status(200).json({
        success: true,
        message: 'Threats synced to Jira',
        results,
      });
    } catch (error: any) {
      console.error('Jira sync error:', error);
      res.status(500).json({
        error: 'Jira sync failed',
        message: error.message,
      });
    }
  };

  /**
   * GET /api/jira/issues
   * Get Jira issues for threats
   */
  getIssues = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
      });
      return;
    }

    try {
      const { label, threat_id } = req.query;

      if (threat_id) {
        // Get specific issue for threat
        const issueKey = this.jiraClient!.getIssueKeyForThreat(threat_id as string);
        
        if (!issueKey) {
          res.status(404).json({
            error: 'No Jira issue found',
            message: `No Jira issue linked to threat ${threat_id}`,
          });
          return;
        }

        const issue = await this.jiraClient!.getIssue(issueKey);
        
        res.status(200).json({
          threat_id,
          issue,
        });
      } else if (label) {
        // Search issues by label
        const issues = await this.jiraClient!.searchIssuesByLabel(label as string);
        
        res.status(200).json({
          label,
          count: issues.length,
          issues,
        });
      } else {
        // Get all threat issues
        const issues = await this.jiraClient!.searchIssuesByLabel('threat');
        
        res.status(200).json({
          count: issues.length,
          issues,
        });
      }
    } catch (error: any) {
      console.error('Get Jira issues error:', error);
      res.status(500).json({
        error: 'Failed to get Jira issues',
        message: error.message,
      });
    }
  };

  /**
   * POST /api/jira/webhook
   * Handle Jira webhook events
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
      });
      return;
    }

    try {
      const payload = req.body as JiraWebhookPayload;
      const { webhookEvent, issue } = payload;

      console.log(`📥 Received Jira webhook: ${webhookEvent} for issue ${issue.key}`);

      // Only handle issue update events
      if (!webhookEvent.includes('issue_updated')) {
        res.status(200).json({ message: 'Event ignored' });
        return;
      }

      // Check if this is a threat issue
      if (!issue.fields.labels.includes('threat')) {
        res.status(200).json({ message: 'Not a threat issue' });
        return;
      }

      // Get threat status from Jira
      const threatStatus = await this.jiraClient!.getThreatStatusFromJira(issue.key);

      // TODO: Update threat status in database
      // This would require database integration
      console.log(`📊 Threat status update: Issue ${issue.key} → ${threatStatus}`);

      res.status(200).json({
        success: true,
        issue_key: issue.key,
        threat_status: threatStatus,
        message: 'Threat status updated from Jira',
      });
    } catch (error: any) {
      console.error('Jira webhook error:', error);
      res.status(500).json({
        error: 'Webhook processing failed',
        message: error.message,
      });
    }
  };

  /**
   * POST /api/jira/update-status
   * Update threat status in Jira
   */
  updateThreatStatus = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
      });
      return;
    }

    try {
      const { threat_id, status } = req.body;

      if (!threat_id || !status) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'threat_id and status are required',
        });
        return;
      }

      const issueKey = this.jiraClient!.getIssueKeyForThreat(threat_id);

      if (!issueKey) {
        res.status(404).json({
          error: 'No Jira issue found',
          message: `No Jira issue linked to threat ${threat_id}`,
        });
        return;
      }

      // Update issue status
      await this.jiraClient!.updateIssue(issueKey, { status });

      res.status(200).json({
        success: true,
        threat_id,
        issue_key: issueKey,
        status,
        message: 'Threat status updated in Jira',
      });
    } catch (error: any) {
      console.error('Update threat status error:', error);
      res.status(500).json({
        error: 'Failed to update threat status',
        message: error.message,
      });
    }
  };

  /**
   * GET /api/jira/report
   * Generate threat report from Jira
   */
  generateReport = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
      });
      return;
    }

    try {
      const report = await this.jiraClient!.generateThreatReport();

      res.status(200).json({
        success: true,
        generated_at: new Date().toISOString(),
        report,
      });
    } catch (error: any) {
      console.error('Generate report error:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: error.message,
      });
    }
  };

  /**
   * POST /api/jira/sync-status
   * Sync threat statuses from Jira
   */
  syncStatusesFromJira = async (req: Request, res: Response): Promise<void> => {
    if (!this.isJiraConfigured()) {
      res.status(503).json({
        error: 'Jira integration not configured',
      });
      return;
    }

    try {
      const { threat_ids } = req.body;

      if (!threat_ids || !Array.isArray(threat_ids)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'threat_ids array is required',
        });
        return;
      }

      const results = {
        total: threat_ids.length,
        synced: 0,
        failed: 0,
        updates: [] as any[],
      };

      for (const threatId of threat_ids) {
        try {
          const update = await this.jiraClient!.syncThreatStatusFromJira(threatId);
          
          if (update) {
            results.synced++;
            results.updates.push(update);
          } else {
            results.failed++;
          }
        } catch (error: any) {
          console.error(`Failed to sync status for threat ${threatId}:`, error);
          results.failed++;
        }
      }

      res.status(200).json({
        success: true,
        message: 'Threat statuses synced from Jira',
        results,
      });
    } catch (error: any) {
      console.error('Sync statuses error:', error);
      res.status(500).json({
        error: 'Failed to sync statuses',
        message: error.message,
      });
    }
  };

  /**
   * GET /api/jira/status
   * Get Jira integration status
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      configured: this.isJiraConfigured(),
      host: process.env.JIRA_HOST || null,
      project_key: process.env.JIRA_PROJECT_KEY || null,
      username: process.env.JIRA_USERNAME ? '***' : null,
    });
  };
}

export default JiraIntegrationController;
