import { v4 as uuidv4 } from 'uuid';
import {
  executeQuery,
  executeQuerySingle,
  executeWrite,
  createAuditLog,
} from '../database/db';
import { NotFoundError, DatabaseError } from '../utils/errors';
import { logger } from '../middleware/logging.middleware';

export interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  system_description?: string;
  data_flow_diagram?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Threat {
  id: string;
  threat_model_id: string;
  category: string;
  title: string;
  description?: string;
  severity: string;
  likelihood: string;
  impact: string;
  mitigation?: string;
  status: string;
  jira_ticket?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateThreatModelDto {
  name: string;
  description?: string;
  system_description?: string;
  data_flow_diagram?: string;
}

export interface UpdateThreatModelDto {
  name?: string;
  description?: string;
  system_description?: string;
  data_flow_diagram?: string;
}

export interface CreateThreatDto {
  category: string;
  title: string;
  description?: string;
  severity: string;
  likelihood: string;
  impact: string;
  mitigation?: string;
}

/**
 * Service for managing threat models
 */
export class ThreatModelService {
  /**
   * Get all threat models for a user
   */
  async getAllThreatModels(userId: string): Promise<ThreatModel[]> {
    try {
      return executeQuery<ThreatModel>(
        'SELECT * FROM threat_models WHERE created_by = ? ORDER BY created_at DESC',
        [userId]
      );
    } catch (error) {
      logger.error('Failed to get threat models', { userId, error });
      throw new DatabaseError('Failed to retrieve threat models');
    }
  }

  /**
   * Get a single threat model by ID
   */
  async getThreatModelById(id: string, userId: string): Promise<ThreatModel> {
    try {
      const model = executeQuerySingle<ThreatModel>(
        'SELECT * FROM threat_models WHERE id = ? AND created_by = ?',
        [id, userId]
      );

      if (!model) {
        throw new NotFoundError('Threat model');
      }

      return model;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get threat model', { id, userId, error });
      throw new DatabaseError('Failed to retrieve threat model');
    }
  }

  /**
   * Create a new threat model
   */
  async createThreatModel(
    data: CreateThreatModelDto,
    userId: string,
    ipAddress?: string
  ): Promise<ThreatModel> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      executeWrite(
        `INSERT INTO threat_models (id, name, description, system_description, data_flow_diagram, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.name,
          data.description || null,
          data.system_description || null,
          data.data_flow_diagram || null,
          userId,
          now,
          now,
        ]
      );

      // Audit log
      createAuditLog(userId, 'CREATE', 'threat_model', id, data, ipAddress);

      const model = await this.getThreatModelById(id, userId);
      logger.info('Threat model created', { id, userId });
      return model;
    } catch (error) {
      logger.error('Failed to create threat model', { data, userId, error });
      throw new DatabaseError('Failed to create threat model');
    }
  }

  /**
   * Update a threat model
   */
  async updateThreatModel(
    id: string,
    data: UpdateThreatModelDto,
    userId: string,
    ipAddress?: string
  ): Promise<ThreatModel> {
    try {
      // Verify ownership
      await this.getThreatModelById(id, userId);

      const updates: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }
      if (data.system_description !== undefined) {
        updates.push('system_description = ?');
        params.push(data.system_description);
      }
      if (data.data_flow_diagram !== undefined) {
        updates.push('data_flow_diagram = ?');
        params.push(data.data_flow_diagram);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id, userId);

      executeWrite(
        `UPDATE threat_models SET ${updates.join(', ')} WHERE id = ? AND created_by = ?`,
        params
      );

      // Audit log
      createAuditLog(userId, 'UPDATE', 'threat_model', id, data, ipAddress);

      const model = await this.getThreatModelById(id, userId);
      logger.info('Threat model updated', { id, userId });
      return model;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to update threat model', { id, data, userId, error });
      throw new DatabaseError('Failed to update threat model');
    }
  }

  /**
   * Delete a threat model
   */
  async deleteThreatModel(id: string, userId: string, ipAddress?: string): Promise<void> {
    try {
      // Verify ownership
      await this.getThreatModelById(id, userId);

      const result = executeWrite(
        'DELETE FROM threat_models WHERE id = ? AND created_by = ?',
        [id, userId]
      );

      if (result.changes === 0) {
        throw new NotFoundError('Threat model');
      }

      // Audit log
      createAuditLog(userId, 'DELETE', 'threat_model', id, {}, ipAddress);

      logger.info('Threat model deleted', { id, userId });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to delete threat model', { id, userId, error });
      throw new DatabaseError('Failed to delete threat model');
    }
  }

  /**
   * Get all threats for a threat model
   */
  async getThreats(threatModelId: string, userId: string): Promise<Threat[]> {
    try {
      // Verify ownership of threat model
      await this.getThreatModelById(threatModelId, userId);

      return executeQuery<Threat>(
        'SELECT * FROM threats WHERE threat_model_id = ? ORDER BY severity DESC, created_at DESC',
        [threatModelId]
      );
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get threats', { threatModelId, userId, error });
      throw new DatabaseError('Failed to retrieve threats');
    }
  }

  /**
   * Create a new threat
   */
  async createThreat(
    threatModelId: string,
    data: CreateThreatDto,
    userId: string,
    ipAddress?: string
  ): Promise<Threat> {
    try {
      // Verify ownership of threat model
      await this.getThreatModelById(threatModelId, userId);

      const id = uuidv4();
      const now = new Date().toISOString();

      executeWrite(
        `INSERT INTO threats (id, threat_model_id, category, title, description, severity, likelihood, impact, mitigation, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          id,
          threatModelId,
          data.category,
          data.title,
          data.description || null,
          data.severity,
          data.likelihood,
          data.impact,
          data.mitigation || null,
          now,
          now,
        ]
      );

      // Audit log
      createAuditLog(userId, 'CREATE', 'threat', id, data, ipAddress);

      const threat = executeQuerySingle<Threat>('SELECT * FROM threats WHERE id = ?', [id]);
      logger.info('Threat created', { id, threatModelId, userId });
      return threat!;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to create threat', { threatModelId, data, userId, error });
      throw new DatabaseError('Failed to create threat');
    }
  }
}

export default new ThreatModelService();
