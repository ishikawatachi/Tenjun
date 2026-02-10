import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as threatModelController from '../controllers/threatModelController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/threat-models:
 *   get:
 *     summary: Get all threat models for authenticated user
 *     tags: [Threat Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of threat models
 *       401:
 *         description: Unauthorized
 */
router.get('/', threatModelController.getAllThreatModels);

/**
 * @swagger
 * /api/threat-models/{id}:
 *   get:
 *     summary: Get a specific threat model
 *     tags: [Threat Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Threat model details
 *       404:
 *         description: Threat model not found
 */
router.get('/:id', threatModelController.getThreatModelById);

/**
 * @swagger
 * /api/threat-models:
 *   post:
 *     summary: Create a new threat model
 *     tags: [Threat Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               system_description:
 *                 type: string
 *               data_flow_diagram:
 *                 type: string
 *     responses:
 *       201:
 *         description: Threat model created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', threatModelController.createThreatModel);

/**
 * @swagger
 * /api/threat-models/{id}:
 *   put:
 *     summary: Update a threat model
 *     tags: [Threat Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               system_description:
 *                 type: string
 *               data_flow_diagram:
 *                 type: string
 *     responses:
 *       200:
 *         description: Threat model updated successfully
 *       404:
 *         description: Threat model not found
 */
router.put('/:id', threatModelController.updateThreatModel);

/**
 * @swagger
 * /api/threat-models/{id}:
 *   delete:
 *     summary: Delete a threat model
 *     tags: [Threat Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Threat model deleted successfully
 *       404:
 *         description: Threat model not found
 */
router.delete('/:id', threatModelController.deleteThreatModel);

/**
 * @swagger
 * /api/threat-models/{id}/threats:
 *   get:
 *     summary: Get all threats for a threat model
 *     tags: [Threats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of threats
 *       404:
 *         description: Threat model not found
 */
router.get('/:id/threats', threatModelController.getThreats);

/**
 * @swagger
 * /api/threat-models/{id}/threats:
 *   post:
 *     summary: Create a new threat for a threat model
 *     tags: [Threats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - title
 *               - severity
 *               - likelihood
 *               - impact
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [spoofing, tampering, repudiation, information_disclosure, denial_of_service, elevation_of_privilege, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [critical, high, medium, low]
 *               likelihood:
 *                 type: string
 *                 enum: [very_high, high, medium, low, very_low]
 *               impact:
 *                 type: string
 *                 enum: [critical, high, medium, low]
 *               mitigation:
 *                 type: string
 *     responses:
 *       201:
 *         description: Threat created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Threat model not found
 */
router.post('/:id/threats', threatModelController.createThreat);

export default router;
