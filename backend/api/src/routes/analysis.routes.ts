import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as analysisController from '../controllers/analysisController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/analysis/analyze:
 *   post:
 *     summary: Analyze a system for potential threats
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - system_description
 *             properties:
 *               system_description:
 *                 type: string
 *                 minLength: 10
 *               data_flow_diagram:
 *                 type: string
 *               analysis_type:
 *                 type: string
 *                 enum: [basic, comprehensive, stride]
 *                 default: comprehensive
 *     responses:
 *       200:
 *         description: Analysis results
 *       400:
 *         description: Validation error
 *       502:
 *         description: Analysis service error
 */
router.post('/analyze', analysisController.analyzeSystem);

/**
 * @swagger
 * /api/analysis/validate-diagram:
 *   post:
 *     summary: Validate data flow diagram format
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - diagram
 *             properties:
 *               diagram:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 *       400:
 *         description: Validation error
 */
router.post('/validate-diagram', analysisController.validateDiagram);

/**
 * @swagger
 * /api/analysis/statistics:
 *   post:
 *     summary: Get threat statistics for threat models
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - threat_model_ids
 *             properties:
 *               threat_model_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Threat statistics
 *       400:
 *         description: Validation error
 */
router.post('/statistics', analysisController.getThreatStatistics);

/**
 * @swagger
 * /api/analysis/jira/create:
 *   post:
 *     summary: Create a Jira issue for a threat
 *     tags: [Jira Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - threat_id
 *               - project_key
 *             properties:
 *               threat_id:
 *                 type: string
 *                 format: uuid
 *               project_key:
 *                 type: string
 *               issue_type:
 *                 type: string
 *               priority:
 *                 type: string
 *     responses:
 *       201:
 *         description: Jira issue created successfully
 *       400:
 *         description: Validation error
 *       502:
 *         description: Jira service error
 */
router.post('/jira/create', analysisController.createJiraIssue);

/**
 * @swagger
 * /api/analysis/jira/{issueKey}:
 *   get:
 *     summary: Get Jira issue status
 *     tags: [Jira Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: issueKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Jira issue details
 *       502:
 *         description: Jira service error
 */
router.get('/jira/:issueKey', analysisController.getJiraIssueStatus);

/**
 * @swagger
 * /api/analysis/health:
 *   get:
 *     summary: Check analysis service health
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status
 */
router.get('/health', analysisController.checkAnalysisHealth);

export default router;
