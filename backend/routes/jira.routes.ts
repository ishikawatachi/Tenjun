/**
 * Jira Integration Routes
 */

import express from 'express';
import JiraIntegrationController from '../controllers/jiraIntegration.controller';

const router = express.Router();
const jiraController = new JiraIntegrationController();

/**
 * POST /api/jira/sync
 * Sync threats to Jira
 * 
 * Body:
 * {
 *   "threats": [...],
 *   "create_new": true,
 *   "update_existing": false
 * }
 */
router.post('/sync', jiraController.syncThreats);

/**
 * GET /api/jira/issues
 * Get Jira issues for threats
 * 
 * Query params:
 * - label: Filter by label (optional)
 * - threat_id: Get issue for specific threat (optional)
 */
router.get('/issues', jiraController.getIssues);

/**
 * POST /api/jira/webhook
 * Handle Jira webhook events
 */
router.post('/webhook', jiraController.handleWebhook);

/**
 * POST /api/jira/update-status
 * Update threat status in Jira
 * 
 * Body:
 * {
 *   "threat_id": "threat-001",
 *   "status": "mitigated"
 * }
 */
router.post('/update-status', jiraController.updateThreatStatus);

/**
 * GET /api/jira/report
 * Generate threat report from Jira
 */
router.get('/report', jiraController.generateReport);

/**
 * POST /api/jira/sync-status
 * Sync threat statuses from Jira
 * 
 * Body:
 * {
 *   "threat_ids": ["threat-001", "threat-002"]
 * }
 */
router.post('/sync-status', jiraController.syncStatusesFromJira);

/**
 * GET /api/jira/status
 * Get Jira integration status
 */
router.get('/status', jiraController.getStatus);

export default router;
