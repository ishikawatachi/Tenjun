import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import threatModelService, {
  CreateThreatModelDto,
  UpdateThreatModelDto,
  CreateThreatDto,
} from '../services/threatModelService';
import { ValidationError } from '../utils/errors';

// Validation schemas
const createThreatModelSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(255),
  description: z.string().max(1000).optional(),
  system_description: z.string().max(5000).optional(),
  data_flow_diagram: z.string().max(10000).optional(),
});

const updateThreatModelSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(1000).optional(),
  system_description: z.string().max(5000).optional(),
  data_flow_diagram: z.string().max(10000).optional(),
});

const createThreatSchema = z.object({
  category: z.enum(['spoofing', 'tampering', 'repudiation', 'information_disclosure', 'denial_of_service', 'elevation_of_privilege', 'other']),
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().max(2000).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  likelihood: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']),
  impact: z.enum(['critical', 'high', 'medium', 'low']),
  mitigation: z.string().max(2000).optional(),
});

/**
 * Get all threat models for the authenticated user
 */
export const getAllThreatModels = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const models = await threatModelService.getAllThreatModels(req.user.userId);

    res.json({
      status: 'success',
      data: {
        threat_models: models,
        count: models.length,
      },
    });
  }
);

/**
 * Get a single threat model by ID
 */
export const getThreatModelById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const model = await threatModelService.getThreatModelById(id, req.user.userId);

    res.json({
      status: 'success',
      data: { threat_model: model },
    });
  }
);

/**
 * Create a new threat model
 */
export const createThreatModel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = createThreatModelSchema.parse(req.body) as CreateThreatModelDto;

    const model = await threatModelService.createThreatModel(
      validatedData,
      req.user.userId,
      req.ip
    );

    res.status(201).json({
      status: 'success',
      data: { threat_model: model },
    });
  }
);

/**
 * Update a threat model
 */
export const updateThreatModel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const validatedData = updateThreatModelSchema.parse(req.body) as UpdateThreatModelDto;

    const model = await threatModelService.updateThreatModel(
      id,
      validatedData,
      req.user.userId,
      req.ip
    );

    res.json({
      status: 'success',
      data: { threat_model: model },
    });
  }
);

/**
 * Delete a threat model
 */
export const deleteThreatModel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    await threatModelService.deleteThreatModel(id, req.user.userId, req.ip);

    res.status(204).send();
  }
);

/**
 * Get all threats for a threat model
 */
export const getThreats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const threats = await threatModelService.getThreats(id, req.user.userId);

    res.json({
      status: 'success',
      data: {
        threats,
        count: threats.length,
      },
    });
  }
);

/**
 * Create a new threat for a threat model
 */
export const createThreat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const validatedData = createThreatSchema.parse(req.body) as CreateThreatDto;

    const threat = await threatModelService.createThreat(
      id,
      validatedData,
      req.user.userId,
      req.ip
    );

    res.status(201).json({
      status: 'success',
      data: { threat },
    });
  }
);
