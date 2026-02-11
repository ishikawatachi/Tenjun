/**
 * Jira Integration Service
 * 
 * Service for creating and managing Jira issues for threat tracking
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

interface JiraConfig {
  host: string;
  username: string;
  apiToken: string;
  projectKey: string;
  defaultAssignee?: string;
}

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    priority: {
      name: string;
    };
    labels: string[];
    assignee?: {
      accountId: string;
      displayName: string;
    };
  };
}

interface Threat {
  threat_id: string;
  threat_name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  likelihood: string;
  risk_score: number;
  category: string;
  resource_id: string;
  resource_type: string;
  cloud_provider: string;
  mitigations?: Array<{
    description: string;
    effort: string;
    impact: string;
    steps: string[];
  }>;
  compliance_mappings?: Array<{
    framework: string;
    control_id: string;
    description: string;
  }>;
  references?: string[];
  status?: 'identified' | 'mitigated' | 'accepted' | 'false_positive';
  owner?: string;
}

interface ThreatStatusUpdate {
  threat_id: string;
  status: string;
  jira_issue_key?: string;
  updated_at: string;
}

interface JiraIssueUpdate {
  summary?: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  assignee?: string;
}

export class JiraClient {
  private client: AxiosInstance;
  private config: JiraConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private threatIssueMapping: Map<string, string> = new Map();

  constructor(config: JiraConfig) {
    this.config = config;
    
    // Create axios instance with authentication
    this.client = axios.create({
      baseURL: `https://${config.host}/rest/api/3`,
      auth: {
        username: config.username,
        password: config.apiToken,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  /**
   * Create a Jira issue for a threat
   */
  async createIssue(threat: Threat): Promise<string> {
    const priority = this.mapSeverityToPriority(threat.severity);
    const labels = this.generateLabels(threat);
    const description = this.generateDescription(threat);
    const summary = this.generateSummary(threat);

    const issueData = {
      fields: {
        project: {
          key: this.config.projectKey,
        },
        summary: summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description,
                },
              ],
            },
          ],
        },
        issuetype: {
          name: 'Task', // or 'Security Task' if custom type exists
        },
        priority: {
          name: priority,
        },
        labels: labels,
        ...(threat.owner && this.config.defaultAssignee && {
          assignee: {
            id: threat.owner || this.config.defaultAssignee,
          },
        }),
      },
    };

    try {
      const response = await this.retryRequest(async () => {
        return await this.client.post('/issue', issueData);
      });

      const issueKey = response.data.key;
      const issueId = response.data.id;

      // Store mapping
      this.threatIssueMapping.set(threat.threat_id, issueKey);

      console.log(`✅ Created Jira issue ${issueKey} for threat ${threat.threat_id}`);

      return issueKey;
    } catch (error) {
      console.error(`❌ Failed to create Jira issue for threat ${threat.threat_id}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing Jira issue
   */
  async updateIssue(issueKey: string, updates: JiraIssueUpdate): Promise<void> {
    const updateData: any = {
      fields: {},
    };

    if (updates.summary) {
      updateData.fields.summary = updates.summary;
    }

    if (updates.description) {
      updateData.fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: updates.description,
              },
            ],
          },
        ],
      };
    }

    if (updates.priority) {
      updateData.fields.priority = { name: updates.priority };
    }

    if (updates.labels) {
      updateData.fields.labels = updates.labels;
    }

    if (updates.assignee) {
      updateData.fields.assignee = { id: updates.assignee };
    }

    try {
      await this.retryRequest(async () => {
        return await this.client.put(`/issue/${issueKey}`, updateData);
      });

      // Update status if provided (requires transition)
      if (updates.status) {
        await this.transitionIssue(issueKey, updates.status);
      }

      console.log(`✅ Updated Jira issue ${issueKey}`);
    } catch (error) {
      console.error(`❌ Failed to update Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Transition issue to a new status
   */
  async transitionIssue(issueKey: string, targetStatus: string): Promise<void> {
    try {
      // Get available transitions
      const transitionsResponse = await this.client.get(`/issue/${issueKey}/transitions`);
      const transitions = transitionsResponse.data.transitions;

      // Find transition that matches target status
      const transition = transitions.find(
        (t: any) => t.to.name.toLowerCase() === targetStatus.toLowerCase()
      );

      if (!transition) {
        console.warn(`⚠️  No transition found to status '${targetStatus}' for issue ${issueKey}`);
        return;
      }

      // Execute transition
      await this.client.post(`/issue/${issueKey}/transitions`, {
        transition: {
          id: transition.id,
        },
      });

      console.log(`✅ Transitioned issue ${issueKey} to ${targetStatus}`);
    } catch (error) {
      console.error(`❌ Failed to transition issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Link Jira issue to threat in external system
   */
  async linkIssueToThreat(issueKey: string, threatId: string, threatUrl?: string): Promise<void> {
    this.threatIssueMapping.set(threatId, issueKey);

    // Add comment with threat link
    const comment = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `Linked to Threat ID: ${threatId}`,
              },
              ...(threatUrl
                ? [
                    {
                      type: 'text',
                      text: '\n',
                    },
                    {
                      type: 'text',
                      text: threatUrl,
                      marks: [{ type: 'link', attrs: { href: threatUrl } }],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    };

    try {
      await this.client.post(`/issue/${issueKey}/comment`, comment);
      console.log(`✅ Linked issue ${issueKey} to threat ${threatId}`);
    } catch (error) {
      console.error(`❌ Failed to link issue ${issueKey} to threat ${threatId}:`, error);
      throw error;
    }
  }

  /**
   * Get Jira issue details
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Search Jira issues by threat label
   */
  async searchIssuesByLabel(label: string): Promise<JiraIssue[]> {
    try {
      const jql = `project = ${this.config.projectKey} AND labels = "${label}" ORDER BY created DESC`;
      const response = await this.client.get('/search', {
        params: {
          jql,
          maxResults: 100,
        },
      });

      return response.data.issues;
    } catch (error) {
      console.error(`❌ Failed to search issues by label ${label}:`, error);
      throw error;
    }
  }

  /**
   * Get threat status from Jira issue
   */
  async getThreatStatusFromJira(issueKey: string): Promise<string> {
    try {
      const issue = await this.getIssue(issueKey);
      const jiraStatus = issue.fields.status.name.toLowerCase();

      // Map Jira status to threat status
      return this.mapJiraStatusToThreatStatus(jiraStatus);
    } catch (error) {
      console.error(`❌ Failed to get threat status from Jira ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Sync threat status from Jira
   */
  async syncThreatStatusFromJira(threatId: string): Promise<ThreatStatusUpdate | null> {
    const issueKey = this.threatIssueMapping.get(threatId);
    
    if (!issueKey) {
      console.warn(`⚠️  No Jira issue found for threat ${threatId}`);
      return null;
    }

    try {
      const issue = await this.getIssue(issueKey);
      const jiraStatus = issue.fields.status.name.toLowerCase();
      const threatStatus = this.mapJiraStatusToThreatStatus(jiraStatus);

      return {
        threat_id: threatId,
        status: threatStatus,
        jira_issue_key: issueKey,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Failed to sync threat status from Jira for ${threatId}:`, error);
      return null;
    }
  }

  /**
   * Bulk create issues for multiple threats
   */
  async bulkCreateIssues(threats: Threat[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const threat of threats) {
      try {
        const issueKey = await this.createIssue(threat);
        results.set(threat.threat_id, issueKey);
        
        // Rate limiting: wait 500ms between requests
        await this.sleep(500);
      } catch (error) {
        console.error(`Failed to create issue for threat ${threat.threat_id}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate Jira report with threat trends
   */
  async generateThreatReport(): Promise<any> {
    try {
      const jql = `project = ${this.config.projectKey} AND labels = "threat" ORDER BY created DESC`;
      const response = await this.client.get('/search', {
        params: {
          jql,
          maxResults: 1000,
        },
      });

      const issues = response.data.issues;

      // Analyze issues
      const report = {
        total_issues: issues.length,
        by_status: {} as Record<string, number>,
        by_priority: {} as Record<string, number>,
        by_label: {} as Record<string, number>,
        open_issues: 0,
        resolved_issues: 0,
        average_resolution_time_days: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        trends: {
          created_last_30_days: 0,
          resolved_last_30_days: 0,
        },
      };

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let totalResolutionTime = 0;
      let resolvedCount = 0;

      issues.forEach((issue: JiraIssue) => {
        const status = issue.fields.status.name;
        const priority = issue.fields.priority.name;

        // Count by status
        report.by_status[status] = (report.by_status[status] || 0) + 1;

        // Count by priority
        report.by_priority[priority] = (report.by_priority[priority] || 0) + 1;

        // Count severity from labels
        issue.fields.labels.forEach((label: string) => {
          report.by_label[label] = (report.by_label[label] || 0) + 1;
          
          if (label === 'critical') report.critical_count++;
          if (label === 'high') report.high_count++;
          if (label === 'medium') report.medium_count++;
          if (label === 'low') report.low_count++;
        });

        // Open vs resolved
        if (status.toLowerCase() === 'done' || status.toLowerCase() === 'closed') {
          report.resolved_issues++;
        } else {
          report.open_issues++;
        }

        // Trends (simplified - would need created/resolved dates)
        // This is a placeholder for actual trend analysis
      });

      return report;
    } catch (error) {
      console.error('❌ Failed to generate threat report:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map threat severity to Jira priority
   */
  private mapSeverityToPriority(severity: string): string {
    const mapping: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      info: 'Lowest',
    };

    return mapping[severity.toLowerCase()] || 'Medium';
  }

  /**
   * Map threat status to Jira status
   */
  private mapThreatStatusToJiraStatus(status: string): string {
    const mapping: Record<string, string> = {
      identified: 'To Do',
      mitigated: 'Done',
      accepted: 'Done',
      false_positive: 'Done',
    };

    return mapping[status.toLowerCase()] || 'To Do';
  }

  /**
   * Map Jira status to threat status
   */
  private mapJiraStatusToThreatStatus(jiraStatus: string): string {
    const lowerStatus = jiraStatus.toLowerCase();

    if (lowerStatus === 'done' || lowerStatus === 'closed' || lowerStatus === 'resolved') {
      return 'mitigated';
    }

    if (lowerStatus === 'in progress' || lowerStatus === 'in review') {
      return 'identified';
    }

    return 'identified';
  }

  /**
   * Generate labels for threat
   */
  private generateLabels(threat: Threat): string[] {
    const labels = ['threat', threat.severity.toLowerCase()];

    if (threat.cloud_provider) {
      labels.push(threat.cloud_provider.toLowerCase());
    }

    if (threat.resource_type) {
      // Extract cloud resource type (e.g., "aws_s3_bucket" -> "s3")
      const resourceType = threat.resource_type.split('_')[1] || threat.resource_type;
      labels.push(resourceType.toLowerCase());
    }

    if (threat.category) {
      labels.push(threat.category.toLowerCase().replace(/\s+/g, '-'));
    }

    return labels;
  }

  /**
   * Generate issue summary
   */
  private generateSummary(threat: Threat): string {
    const severityBadge = threat.severity === 'critical' ? '[CRITICAL]' : `[${threat.severity.toUpperCase()}]`;
    return `${severityBadge} ${threat.threat_name}`;
  }

  /**
   * Generate issue description
   */
  private generateDescription(threat: Threat): string {
    let description = `# Security Threat: ${threat.threat_name}\n\n`;

    description += `## Threat Details\n\n`;
    description += `- **Severity**: ${threat.severity.toUpperCase()}\n`;
    description += `- **Risk Score**: ${threat.risk_score}\n`;
    description += `- **Likelihood**: ${threat.likelihood}\n`;
    description += `- **Category**: ${threat.category}\n`;
    description += `- **Threat ID**: ${threat.threat_id}\n\n`;

    description += `## Affected Resources\n\n`;
    description += `- **Resource Type**: ${threat.resource_type}\n`;
    description += `- **Resource ID**: ${threat.resource_id}\n`;
    description += `- **Cloud Provider**: ${threat.cloud_provider}\n\n`;

    description += `## Description\n\n${threat.description}\n\n`;

    if (threat.mitigations && threat.mitigations.length > 0) {
      description += `## Recommended Mitigations\n\n`;
      threat.mitigations.forEach((mitigation, index) => {
        description += `### ${index + 1}. ${mitigation.description}\n\n`;
        description += `**Effort**: ${mitigation.effort} | **Impact**: ${mitigation.impact}\n\n`;
        
        if (mitigation.steps && mitigation.steps.length > 0) {
          description += `**Steps**:\n`;
          mitigation.steps.forEach((step, i) => {
            description += `${i + 1}. ${step}\n`;
          });
          description += `\n`;
        }
      });
    }

    if (threat.compliance_mappings && threat.compliance_mappings.length > 0) {
      description += `## Compliance Impact\n\n`;
      threat.compliance_mappings.forEach((mapping) => {
        description += `- **${mapping.framework}**: ${mapping.control_id} - ${mapping.description}\n`;
      });
      description += `\n`;
    }

    if (threat.references && threat.references.length > 0) {
      description += `## References\n\n`;
      threat.references.forEach((ref) => {
        description += `- ${ref}\n`;
      });
    }

    return description;
  }

  /**
   * Retry logic for API requests
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.log(`⚠️  Retrying request... (${this.maxRetries - retries + 1}/${this.maxRetries})`);
        await this.sleep(this.retryDelay);
        return this.retryRequest(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on 5xx errors and specific 4xx errors
      return (
        !status ||
        status >= 500 ||
        status === 429 || // Rate limit
        status === 408    // Request timeout
      );
    }
    return false;
  }

  /**
   * Handle axios errors
   */
  private handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;

      console.error(`Jira API Error (${status}):`, data);

      if (status === 401) {
        throw new Error('Jira authentication failed. Check credentials.');
      } else if (status === 403) {
        throw new Error('Jira access forbidden. Check permissions.');
      } else if (status === 404) {
        throw new Error('Jira resource not found.');
      } else if (status === 429) {
        throw new Error('Jira rate limit exceeded. Please try again later.');
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Jira API No Response:', error.message);
      throw new Error('Jira API did not respond. Check network connection.');
    } else {
      // Error setting up request
      console.error('Jira API Request Error:', error.message);
    }

    return Promise.reject(error);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get issue key for threat
   */
  getIssueKeyForThreat(threatId: string): string | undefined {
    return this.threatIssueMapping.get(threatId);
  }

  /**
   * Set issue key for threat (for persistence)
   */
  setIssueKeyForThreat(threatId: string, issueKey: string): void {
    this.threatIssueMapping.set(threatId, issueKey);
  }
}

export default JiraClient;
