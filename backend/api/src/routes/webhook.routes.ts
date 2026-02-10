import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as webhookController from '../controllers/webhookController';
import express from 'express';

const router = Router();

/**
 * @swagger
 * /api/webhooks/github:
 *   post:
 *     summary: GitHub webhook endpoint
 *     tags: [Webhooks]
 *     description: Receives webhook events from GitHub for push, pull request, and other events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       202:
 *         description: Webhook accepted and queued for processing
 *       401:
 *         description: Invalid webhook signature
 *       400:
 *         description: Invalid webhook payload
 */
router.post(
  '/github',
  express.raw({ type: 'application/json' }),
  webhookController.handleGitHubWebhook
);

/**
 * @swagger
 * /api/webhooks/test:
 *   post:
 *     summary: Test webhook endpoint (development only)
 *     tags: [Webhooks]
 *     description: Manually trigger webhook processing for testing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test webhook processed
 */
router.post('/test', authenticate, webhookController.testWebhook);

/**
 * @swagger
 * /api/webhooks/stats:
 *   get:
 *     summary: Get webhook statistics
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Webhook statistics and recent events
 */
router.get('/stats', authenticate, webhookController.getWebhookStats);

/**
 * @swagger
 * /api/webhooks/trigger-analysis:
 *   post:
 *     summary: Manually trigger repository analysis
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repository_url
 *             properties:
 *               repository_url:
 *                 type: string
 *                 format: uri
 *               branch:
 *                 type: string
 *                 default: main
 *     responses:
 *       200:
 *         description: Analysis triggered successfully
 *       400:
 *         description: Invalid repository URL
 */
router.post(
  '/trigger-analysis',
  authenticate,
  webhookController.triggerRepositoryAnalysis
);

/**
 * @swagger
 * /api/webhooks/create-issue:
 *   post:
 *     summary: Create GitHub issue for a threat
 *     tags: [Webhooks]
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
 *               - repository
 *             properties:
 *               threat_id:
 *                 type: string
 *                 format: uuid
 *               repository:
 *                 type: string
 *     responses:
 *       200:
 *         description: GitHub issue created successfully
 *       404:
 *         description: Threat not found
 */
router.post(
  '/create-issue',
  authenticate,
  webhookController.createGitHubIssueForThreat
);

export default router;
