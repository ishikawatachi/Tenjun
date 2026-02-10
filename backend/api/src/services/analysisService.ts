import axios from 'axios';
import { logger } from '../middleware/logging.middleware';
import { ExternalServiceError } from '../utils/errors';

export interface AnalysisRequest {
  system_description: string;
  data_flow_diagram?: string;
  analysis_type: 'basic' | 'comprehensive' | 'stride';
}

export interface AnalysisResult {
  threats: Array<{
    category: string;
    title: string;
    description: string;
    severity: string;
    likelihood: string;
    impact: string;
    mitigation: string;
  }>;
  summary: {
    total_threats: number;
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
  };
  recommendations: string[];
}

/**
 * Service for AI-powered threat analysis
 * Communicates with the Python analysis service
 */
export class AnalysisService {
  private readonly analysisServiceUrl: string;

  constructor() {
    // Assuming the Python analysis service runs on a different port or container
    this.analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:5000';
  }

  /**
   * Analyze a system for potential threats
   */
  async analyzeSystem(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      logger.info('Starting threat analysis', {
        analysisType: request.analysis_type,
      });

      const response = await axios.post<AnalysisResult>(
        `${this.analysisServiceUrl}/api/analyze`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds for AI analysis
        }
      );

      logger.info('Threat analysis completed', {
        threatsFound: response.data.threats.length,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Analysis service error', {
          status: error.response?.status,
          message: error.message,
        });

        if (error.code === 'ECONNREFUSED') {
          throw new ExternalServiceError(
            'Analysis Service',
            'Analysis service is not available'
          );
        }

        throw new ExternalServiceError(
          'Analysis Service',
          error.response?.data?.error || error.message
        );
      }

      logger.error('Unexpected error during analysis', { error });
      throw new ExternalServiceError('Analysis Service', 'Unknown error occurred');
    }
  }

  /**
   * Validate data flow diagram format
   */
  async validateDataFlowDiagram(diagram: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await axios.post(
        `${this.analysisServiceUrl}/api/validate-diagram`,
        { diagram },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Diagram validation error', {
          status: error.response?.status,
        });

        if (error.code === 'ECONNREFUSED') {
          // If analysis service is down, skip validation
          return { valid: true, errors: [] };
        }

        return {
          valid: false,
          errors: [error.response?.data?.error || 'Validation failed'],
        };
      }

      return { valid: false, errors: ['Unknown error occurred'] };
    }
  }

  /**
   * Get threat statistics for a user's models
   */
  async getThreatStatistics(threatModelIds: string[]): Promise<{
    total_threats: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    trend: Array<{ date: string; count: number }>;
  }> {
    try {
      const response = await axios.post(
        `${this.analysisServiceUrl}/api/statistics`,
        { threat_model_ids: threatModelIds },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get threat statistics', { error });
      // Return empty statistics rather than failing
      return {
        total_threats: 0,
        by_severity: {},
        by_status: {},
        trend: [],
      };
    }
  }

  /**
   * Health check for analysis service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.analysisServiceUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Analysis service health check failed');
      return false;
    }
  }
}

export default new AnalysisService();
