/**
 * Jira Integration Tests
 * 
 * Integration tests for Jira service and controller
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import JiraClient from '../../services/jira.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JiraClient', () => {
  let jiraClient: JiraClient;
  const mockConfig = {
    host: 'company.atlassian.net',
    username: 'test@example.com',
    apiToken: 'test-api-token',
    projectKey: 'SEC',
    defaultAssignee: 'user-123',
  };

  const mockThreat = {
    threat_id: 'threat-001',
    threat_name: 'Public S3 Bucket',
    description: 'S3 bucket allows public access',
    severity: 'critical' as const,
    likelihood: 'high',
    risk_score: 9.5,
    category: 'Data Exposure',
    resource_id: 'aws_s3_bucket.data_bucket',
    resource_type: 'aws_s3_bucket',
    cloud_provider: 'AWS',
    mitigations: [
      {
        description: 'Enable bucket encryption',
        effort: 'low',
        impact: 'high',
        steps: ['aws s3api put-bucket-encryption --bucket mybucket'],
      },
    ],
    compliance_mappings: [
      {
        framework: 'DORA',
        control_id: 'ORT-07',
        description: 'Security and Resilience',
      },
    ],
    references: ['https://aws.amazon.com/s3/security/'],
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock axios.create to return a mocked instance
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    jiraClient = new JiraClient(mockConfig);
  });

  describe('createIssue', () => {
    it('should create a Jira issue for a critical threat', async () => {
      const mockResponse = {
        data: {
          id: '10001',
          key: 'SEC-101',
          self: 'https://company.atlassian.net/rest/api/3/issue/10001',
        },
      };

      // Mock the axios post method
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      const issueKey = await jiraClient.createIssue(mockThreat);

      expect(issueKey).toBe('SEC-101');
      expect(axiosInstance.post).toHaveBeenCalledWith(
        '/issue',
        expect.objectContaining({
          fields: expect.objectContaining({
            project: { key: 'SEC' },
            summary: '[CRITICAL] Public S3 Bucket',
            priority: { name: 'Highest' },
            labels: expect.arrayContaining(['threat', 'critical', 'aws', 's3']),
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockRejectedValue(
        new Error('API Error: Unauthorized')
      );

      await expect(jiraClient.createIssue(mockThreat)).rejects.toThrow();
    });

    it('should include mitigations in description', async () => {
      const mockResponse = {
        data: { id: '10001', key: 'SEC-101' },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      await jiraClient.createIssue(mockThreat);

      const callArgs = (axiosInstance.post as jest.Mock).mock.calls[0][1];
      const description = callArgs.fields.description.content[0].content[0].text;

      expect(description).toContain('Recommended Mitigations');
      expect(description).toContain('Enable bucket encryption');
    });

    it('should include compliance mappings in description', async () => {
      const mockResponse = {
        data: { id: '10001', key: 'SEC-101' },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      await jiraClient.createIssue(mockThreat);

      const callArgs = (axiosInstance.post as jest.Mock).mock.calls[0][1];
      const description = callArgs.fields.description.content[0].content[0].text;

      expect(description).toContain('Compliance Impact');
      expect(description).toContain('DORA');
      expect(description).toContain('ORT-07');
    });
  });

  describe('updateIssue', () => {
    it('should update an existing issue', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.put as jest.Mock).mockResolvedValue({ data: {} });
      (axiosInstance.get as jest.Mock).mockResolvedValue({
        data: {
          transitions: [
            {
              id: '21',
              to: { name: 'Done' },
            },
          ],
        },
      });
      (axiosInstance.post as jest.Mock).mockResolvedValue({ data: {} });

      await jiraClient.updateIssue('SEC-101', {
        summary: 'Updated summary',
        status: 'Done',
      });

      expect(axiosInstance.put).toHaveBeenCalledWith(
        '/issue/SEC-101',
        expect.objectContaining({
          fields: expect.objectContaining({
            summary: 'Updated summary',
          }),
        })
      );

      expect(axiosInstance.post).toHaveBeenCalledWith(
        '/issue/SEC-101/transitions',
        expect.objectContaining({
          transition: { id: '21' },
        })
      );
    });
  });

  describe('linkIssueToThreat', () => {
    it('should link issue to threat with comment', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue({ data: {} });

      await jiraClient.linkIssueToThreat(
        'SEC-101',
        'threat-001',
        'https://example.com/threats/threat-001'
      );

      expect(axiosInstance.post).toHaveBeenCalledWith(
        '/issue/SEC-101/comment',
        expect.objectContaining({
          body: expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                content: expect.arrayContaining([
                  expect.objectContaining({
                    text: 'Linked to Threat ID: threat-001',
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('getIssue', () => {
    it('should retrieve issue details', async () => {
      const mockIssue = {
        id: '10001',
        key: 'SEC-101',
        self: 'https://company.atlassian.net/rest/api/3/issue/10001',
        fields: {
          summary: '[CRITICAL] Public S3 Bucket',
          description: 'Threat description',
          status: { name: 'To Do' },
          priority: { name: 'Highest' },
          labels: ['threat', 'critical', 'aws'],
        },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({ data: mockIssue });

      const issue = await jiraClient.getIssue('SEC-101');

      expect(issue).toEqual(mockIssue);
      expect(axiosInstance.get).toHaveBeenCalledWith('/issue/SEC-101');
    });
  });

  describe('searchIssuesByLabel', () => {
    it('should search issues by label', async () => {
      const mockIssues = [
        {
          id: '10001',
          key: 'SEC-101',
          fields: { labels: ['threat', 'critical'] },
        },
        {
          id: '10002',
          key: 'SEC-102',
          fields: { labels: ['threat', 'high'] },
        },
      ];

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({
        data: { issues: mockIssues },
      });

      const issues = await jiraClient.searchIssuesByLabel('threat');

      expect(issues).toHaveLength(2);
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({
          params: expect.objectContaining({
            jql: expect.stringContaining('labels = "threat"'),
          }),
        })
      );
    });
  });

  describe('getThreatStatusFromJira', () => {
    it('should map Done status to mitigated', async () => {
      const mockIssue = {
        fields: {
          status: { name: 'Done' },
        },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({ data: mockIssue });

      const status = await jiraClient.getThreatStatusFromJira('SEC-101');

      expect(status).toBe('mitigated');
    });

    it('should map In Progress status to identified', async () => {
      const mockIssue = {
        fields: {
          status: { name: 'In Progress' },
        },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({ data: mockIssue });

      const status = await jiraClient.getThreatStatusFromJira('SEC-101');

      expect(status).toBe('identified');
    });
  });

  describe('syncThreatStatusFromJira', () => {
    it('should sync threat status from Jira', async () => {
      // First link the threat to an issue
      jiraClient.setIssueKeyForThreat('threat-001', 'SEC-101');

      const mockIssue = {
        fields: {
          status: { name: 'Done' },
        },
      };

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({ data: mockIssue });

      const update = await jiraClient.syncThreatStatusFromJira('threat-001');

      expect(update).not.toBeNull();
      expect(update?.threat_id).toBe('threat-001');
      expect(update?.status).toBe('mitigated');
      expect(update?.jira_issue_key).toBe('SEC-101');
    });

    it('should return null if no Jira issue found', async () => {
      const update = await jiraClient.syncThreatStatusFromJira('threat-999');

      expect(update).toBeNull();
    });
  });

  describe('bulkCreateIssues', () => {
    it('should create multiple issues with rate limiting', async () => {
      const threats = [mockThreat, { ...mockThreat, threat_id: 'threat-002' }];

      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock)
        .mockResolvedValueOnce({ data: { id: '10001', key: 'SEC-101' } })
        .mockResolvedValueOnce({ data: { id: '10002', key: 'SEC-102' } });

      const results = await jiraClient.bulkCreateIssues(threats);

      expect(results.size).toBe(2);
      expect(results.get('threat-001')).toBe('SEC-101');
      expect(results.get('threat-002')).toBe('SEC-102');
    });
  });

  describe('generateThreatReport', () => {
    it('should generate threat report with statistics', async () => {
      const mockIssues = [
        {
          fields: {
            status: { name: 'Done' },
            priority: { name: 'Highest' },
            labels: ['threat', 'critical', 'aws'],
          },
        },
        {
          fields: {
            status: { name: 'To Do' },
            priority: { name: 'High' },
            labels: ['threat', 'high', 'gcp'],
          },
        },
      ];

      const axiosInstance = jiraClient['client'];
      (axiosInstance.get as jest.Mock).mockResolvedValue({
        data: { issues: mockIssues },
      });

      const report = await jiraClient.generateThreatReport();

      expect(report.total_issues).toBe(2);
      expect(report.by_status['Done']).toBe(1);
      expect(report.by_status['To Do']).toBe(1);
      expect(report.critical_count).toBe(1);
      expect(report.high_count).toBe(1);
      expect(report.resolved_issues).toBe(1);
      expect(report.open_issues).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should retry on server errors', async () => {
      const axiosInstance = jiraClient['client'];
      
      // First call fails with 500, second succeeds
      (axiosInstance.post as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Internal Server Error' },
          isAxiosError: true,
        })
        .mockResolvedValueOnce({ data: { id: '10001', key: 'SEC-101' } });

      const issueKey = await jiraClient.createIssue(mockThreat);

      expect(issueKey).toBe('SEC-101');
      expect(axiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 404 errors', async () => {
      const axiosInstance = jiraClient['client'];
      
      (axiosInstance.post as jest.Mock).mockRejectedValue({
        response: { status: 404, data: 'Not Found' },
        isAxiosError: true,
      });

      await expect(jiraClient.createIssue(mockThreat)).rejects.toThrow();
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Priority mapping', () => {
    it('should map critical to Highest', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue({
        data: { id: '10001', key: 'SEC-101' },
      });

      await jiraClient.createIssue({ ...mockThreat, severity: 'critical' });

      const callArgs = (axiosInstance.post as jest.Mock).mock.calls[0][1];
      expect(callArgs.fields.priority.name).toBe('Highest');
    });

    it('should map high to High', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue({
        data: { id: '10001', key: 'SEC-101' },
      });

      await jiraClient.createIssue({ ...mockThreat, severity: 'high' });

      const callArgs = (axiosInstance.post as jest.Mock).mock.calls[0][1];
      expect(callArgs.fields.priority.name).toBe('High');
    });

    it('should map medium to Medium', async () => {
      const axiosInstance = jiraClient['client'];
      (axiosInstance.post as jest.Mock).mockResolvedValue({
        data: { id: '10001', key: 'SEC-101' },
      });

      await jiraClient.createIssue({ ...mockThreat, severity: 'medium' });

      const callArgs = (axiosInstance.post as jest.Mock).mock.calls[0][1];
      expect(callArgs.fields.priority.name).toBe('Medium');
    });
  });
});
