import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import analysisService, { AnalysisRequest } from '../services/analysisService';
import jiraService, { CreateJiraIssueDto } from '../services/jiraService';
import { ValidationError } from '../utils/errors';
import { executeWrite } from '../database/db';

// Validation schemas
const analyzeSystemSchema = z.object({
  system_description: z
    .string()
    .min(10, 'System description must be at least 10 characters')
    .max(5000),
  data_flow_diagram: z.string().max(10000).optional(),
  analysis_type: z.enum(['basic', 'comprehensive', 'stride']).default('comprehensive'),
});

const validateDiagramSchema = z.object({
  diagram: z.string().min(1, 'Diagram is required').max(10000),
});

const createJiraIssueSchema = z.object({
  threat_id: z.string().uuid('Invalid threat ID'),
  project_key: z.string().min(1, 'Project key is required'),
  issue_type: z.string().optional(),
  priority: z.string().optional(),
});

/**
 * Analyze a system for potential threats
 */
export const analyzeSystem = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = analyzeSystemSchema.parse(req.body) as AnalysisRequest;

    const result = await analysisService.analyzeSystem(validatedData);

    res.json({
      status: 'success',
      data: result,
    });
  }
);

/**
 * Validate data flow diagram format
 */
export const validateDiagram = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = validateDiagramSchema.parse(req.body);

    const result = await analysisService.validateDataFlowDiagram(validatedData.diagram);

    res.json({
      status: 'success',
      data: result,
    });
  }
);

/**
 * Get threat statistics
 */
export const getThreatStatistics = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { threat_model_ids } = req.body;

    if (!Array.isArray(threat_model_ids)) {
      throw new ValidationError('threat_model_ids must be an array');
    }

    const statistics = await analysisService.getThreatStatistics(threat_model_ids);

    res.json({
      status: 'success',
      data: statistics,
    });
  }
);

/**
 * Create a Jira issue for a threat
 */
export const createJiraIssue = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = createJiraIssueSchema.parse(req.body);

    // Get threat details from database
    const { executeQuerySingle } = await import('../database/db');
    const threat = executeQuerySingle<{
      id: string;
      threat_model_id: string;
      title: string;
      description: string;
      severity: string;
      mitigation: string;
    }>('SELECT * FROM threats WHERE id = ?', [validatedData.threat_id]);

    if (!threat) {
      throw new ValidationError('Threat not found');
    }

    // Create Jira issue
    const issueData: CreateJiraIssueDto = {
      projectKey: validatedData.project_key,
      summary: `[Security Threat] ${threat.title}`,
      description: `
**Threat ID:** ${threat.id}
**Severity:** ${threat.severity}

**Description:**
${threat.description || 'N/A'}

**Mitigation:**
${threat.mitigation || 'N/A'}
      `.trim(),
      issueType: validatedData.issue_type || 'Task',
      priority: validatedData.priority || threat.severity,
    };

    const jiraIssue = await jiraService.createIssue(issueData);

    // Update threat with Jira ticket key
    executeWrite('UPDATE threats SET jira_ticket = ?, updated_at = ? WHERE id = ?', [
      jiraIssue.key,
      new Date().toISOString(),
      validatedData.threat_id,
    ]);

    res.status(201).json({
      status: 'success',
      data: {
        jira_issue: {
          key: jiraIssue.key,
          url: `${process.env.JIRA_HOST}/browse/${jiraIssue.key}`,
        },
      },
    });
  }
);

/**
 * Get Jira issue status
 */
export const getJiraIssueStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { issueKey } = req.params;

    const issue = await jiraService.getIssue(issueKey);

    res.json({
      status: 'success',
      data: {
        issue: {
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          priority: issue.fields.priority.name,
        },
      },
    });
  }
);

/**
 * Check analysis service health
 */
export const checkAnalysisHealth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const isHealthy = await analysisService.healthCheck();

    res.json({
      status: 'success',
      data: {
        analysis_service: {
          status: isHealthy ? 'healthy' : 'unhealthy',
        },
      },
    });
  }
);
