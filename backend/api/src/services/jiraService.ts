import axios from 'axios';
import config from '../config/config';
import { ExternalServiceError } from '../utils/errors';
import { logger } from '../middleware/logging.middleware';

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description: string;
    issuetype: { name: string };
    priority: { name: string };
    status: { name: string };
  };
}

export interface CreateJiraIssueDto {
  projectKey: string;
  summary: string;
  description: string;
  issueType?: string;
  priority?: string;
}

/**
 * Service for integrating with Jira
 */
export class JiraService {
  private readonly baseUrl: string;
  private readonly auth: { username: string; password: string };

  constructor() {
    this.baseUrl = `${config.jira.host}/rest/api/3`;
    this.auth = {
      username: config.jira.email,
      password: config.jira.apiToken,
    };
  }

  /**
   * Check if Jira is configured
   */
  isConfigured(): boolean {
    return !!(config.jira.host && config.jira.email && config.jira.apiToken);
  }

  /**
   * Create a Jira issue for a threat
   */
  async createIssue(data: CreateJiraIssueDto): Promise<JiraIssue> {
    if (!this.isConfigured()) {
      throw new ExternalServiceError('Jira', 'Jira integration not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/issue`,
        {
          fields: {
            project: {
              key: data.projectKey,
            },
            summary: data.summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: data.description,
                    },
                  ],
                },
              ],
            },
            issuetype: {
              name: data.issueType || 'Task',
            },
            priority: {
              name: data.priority || 'Medium',
            },
          },
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      logger.info('Jira issue created', { issueKey: response.data.key });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Jira API error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new ExternalServiceError(
          'Jira',
          error.response?.data?.errorMessages?.[0] || error.message
        );
      }
      throw new ExternalServiceError('Jira', 'Unknown error occurred');
    }
  }

  /**
   * Get a Jira issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    if (!this.isConfigured()) {
      throw new ExternalServiceError('Jira', 'Jira integration not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/issue/${issueKey}`, {
        auth: this.auth,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Jira API error', {
          status: error.response?.status,
          issueKey,
        });
        throw new ExternalServiceError('Jira', 'Failed to fetch issue');
      }
      throw new ExternalServiceError('Jira', 'Unknown error occurred');
    }
  }

  /**
   * Update Jira issue status
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new ExternalServiceError('Jira', 'Jira integration not configured');
    }

    try {
      await axios.post(
        `${this.baseUrl}/issue/${issueKey}/transitions`,
        {
          transition: {
            id: transitionId,
          },
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      logger.info('Jira issue transitioned', { issueKey, transitionId });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Jira API error', {
          status: error.response?.status,
          issueKey,
        });
        throw new ExternalServiceError('Jira', 'Failed to transition issue');
      }
      throw new ExternalServiceError('Jira', 'Unknown error occurred');
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    if (!this.isConfigured()) {
      throw new ExternalServiceError('Jira', 'Jira integration not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/issue/${issueKey}/transitions`, {
        auth: this.auth,
        timeout: 10000,
      });

      return response.data.transitions.map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Jira API error', {
          status: error.response?.status,
          issueKey,
        });
        throw new ExternalServiceError('Jira', 'Failed to get transitions');
      }
      throw new ExternalServiceError('Jira', 'Unknown error occurred');
    }
  }
}

export default new JiraService();
