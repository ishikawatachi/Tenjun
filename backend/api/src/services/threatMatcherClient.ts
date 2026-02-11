/**
 * Threat Matcher Client
 * Node.js/TypeScript wrapper for Python threat matching service
 * 
 * Integrates with the threat matching engine to identify security threats
 * in parsed infrastructure configurations.
 */

import { spawn } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Threat severity levels
 */
export enum ThreatSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Threat likelihood levels
 */
export enum ThreatLikelihood {
  CERTAIN = 'certain',
  LIKELY = 'likely',
  POSSIBLE = 'possible',
  UNLIKELY = 'unlikely',
  RARE = 'rare'
}

/**
 * Mitigation recommendation
 */
export interface Mitigation {
  description: string;
  effort: string;
  impact: string;
  steps: string[];
}

/**
 * Compliance mapping
 */
export interface ComplianceMapping {
  framework: string;
  control_id: string;
  description: string;
}

/**
 * Threat definition
 */
export interface Threat {
  id: string;
  name: string;
  description: string;
  severity: string;
  likelihood: string;
  category: string;
  resource_types: string[];
  cloud_providers: string[];
  attack_vectors: string[];
  exploitability: string;
  business_impact: string;
  mitigations: Mitigation[];
  references: string[];
  compliance_mappings: ComplianceMapping[];
  tags: string[];
  risk_score: number;
}

/**
 * Matched threat instance
 */
export interface MatchedThreat {
  threat: Threat;
  resource_id: string;
  resource_type: string;
  resource_properties: Record<string, any>;
  matched_conditions: string[];
  confidence: number;
  risk_score: number;
  matched_at: string;
  location?: string;
  severity: string;
  category: string;
}

/**
 * Threat match result
 */
export interface ThreatMatchResult {
  matched_threats: MatchedThreat[];
  total_matched: number;
  total_resources_scanned: number;
  total_threats_checked: number;
  execution_time_ms: number;
  statistics: {
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
    by_resource_type: Record<string, number>;
  };
}

/**
 * Threat database statistics
 */
export interface ThreatDatabaseStats {
  total_threats: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_cloud_provider: Record<string, number>;
  unique_resource_types: number;
  unique_categories: number;
}

/**
 * Options for threat matching
 */
export interface ThreatMatchOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Python executable path */
  pythonPath?: string;
  /** Filter threats by resource type */
  filterByResourceType?: boolean;
  /** Minimum severity to report */
  minSeverity?: ThreatSeverity;
  /** Specific cloud providers to check */
  cloudProviders?: string[];
}

/**
 * Threat Matcher Client
 * 
 * Provides methods to match infrastructure against threat database
 */
export class ThreatMatcherClient {
  private pythonPath: string;
  private defaultTimeout: number;
  private backendPath: string;

  constructor(options: ThreatMatchOptions = {}) {
    this.pythonPath = options.pythonPath || process.env.PYTHON_PATH || 'python3';
    this.defaultTimeout = options.timeout || 60000; // 60 seconds for complex matching
    
    // Path to Python backend
    this.backendPath = path.resolve(__dirname, '../../../analysis');
    
    logger.info('ThreatMatcherClient initialized', {
      pythonPath: this.pythonPath,
      backendPath: this.backendPath
    });
  }

  /**
   * Match threats against infrastructure configuration
   * 
   * @param config - Parsed infrastructure configuration (from Terraform parser)
   * @param options - Matching options
   * @returns Threat match result with matched threats
   */
  async matchThreats(
    config: Record<string, any>,
    options: ThreatMatchOptions = {}
  ): Promise<ThreatMatchResult> {
    logger.info('Matching threats against infrastructure', {
      resourceCount: config.resources?.length || 0
    });

    try {
      const result = await this.executePythonMatcher('match', config, options);
      
      // Apply post-processing filters
      if (options.minSeverity) {
        result.matched_threats = this.filterBySeverity(
          result.matched_threats,
          options.minSeverity
        );
        result.total_matched = result.matched_threats.length;
      }
      
      logger.info('Threat matching completed', {
        matchedCount: result.total_matched,
        executionTimeMs: result.execution_time_ms
      });
      
      return result;
    } catch (error: any) {
      logger.error('Threat matching failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Load and get statistics about threat database
   * 
   * @returns Threat database statistics
   */
  async getThreatDatabaseStats(): Promise<ThreatDatabaseStats> {
    logger.info('Loading threat database statistics');

    const result = await this.executePythonMatcher('stats', {}, {});
    return result as ThreatDatabaseStats;
  }

  /**
   * Get specific threat by ID
   * 
   * @param threatId - Threat identifier (e.g., "GCP-SQL-001")
   * @returns Threat definition or null if not found
   */
  async getThreatById(threatId: string): Promise<Threat | null> {
    logger.info('Getting threat by ID', { threatId });

    try {
      const result = await this.executePythonMatcher('get_threat', { threat_id: threatId }, {});
      return result.threat || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get threats for specific resource type
   * 
   * @param resourceType - Resource type (e.g., "google_sql_database_instance")
   * @returns List of applicable threats
   */
  async getThreatsForResourceType(resourceType: string): Promise<Threat[]> {
    logger.info('Getting threats for resource type', { resourceType });

    const result = await this.executePythonMatcher(
      'get_threats_by_type',
      { resource_type: resourceType },
      {}
    );
    
    return result.threats || [];
  }

  /**
   * Execute Python threat matching script
   */
  private async executePythonMatcher(
    action: string,
    data: Record<string, any>,
    options: ThreatMatchOptions
  ): Promise<any> {
    const timeout = options.timeout || this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const pythonCode = `
import sys
import json
import os

# Add backend to path
sys.path.insert(0, '${this.backendPath}')
sys.path.insert(0, '${this.backendPath}/threatdb')

from threatdb.threat_loader import load_threat_database
from threatdb.threat_matcher import match_infrastructure_threats

# Load threat database
loader = load_threat_database()

action = '${action}'
data = json.loads('''${JSON.stringify(data).replace(/'/g, "\\'")}''')

if action == 'match':
    threats = loader.get_all_threats()
    result = match_infrastructure_threats(data, threats)
    print(json.dumps(result.to_dict(), indent=2))

elif action == 'stats':
    stats = loader.get_statistics()
    print(json.dumps(stats, indent=2))

elif action == 'get_threat':
    threat = loader.get_threat_by_id(data['threat_id'])
    if threat:
        print(json.dumps({'threat': threat.to_dict()}, indent=2))
    else:
        print(json.dumps({'threat': None}, indent=2))

elif action == 'get_threats_by_type':
    threats = loader.get_threats_by_resource_type(data['resource_type'])
    print(json.dumps({'threats': [t.to_dict() for t in threats]}, indent=2))

else:
    print(json.dumps({'error': f'Unknown action: {action}'}, indent=2))
    sys.exit(1)
`;

      const pythonProcess = spawn(this.pythonPath, ['-c', pythonCode], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Threat matching timed out after ${timeout}ms`));
      }, timeout);

      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          return;
        }

        if (code !== 0) {
          logger.error('Python threat matcher failed', { code, stderr });
          reject(new Error(`Threat matcher failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error: any) {
          logger.error('Failed to parse threat matcher output', { error: error.message });
          reject(new Error(`Failed to parse output: ${error.message}`));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timer);
        logger.error('Python process error', { error: error.message });
        reject(new Error(`Failed to spawn Python: ${error.message}`));
      });
    });
  }

  /**
   * Filter matched threats by minimum severity
   */
  private filterBySeverity(
    threats: MatchedThreat[],
    minSeverity: ThreatSeverity
  ): MatchedThreat[] {
    const severityOrder = {
      [ThreatSeverity.CRITICAL]: 5,
      [ThreatSeverity.HIGH]: 4,
      [ThreatSeverity.MEDIUM]: 3,
      [ThreatSeverity.LOW]: 2,
      [ThreatSeverity.INFO]: 1
    };

    const minLevel = severityOrder[minSeverity];

    return threats.filter(mt => {
      const level = severityOrder[mt.severity as ThreatSeverity] || 0;
      return level >= minLevel;
    });
  }

  /**
   * Group matched threats by severity
   */
  groupBySeverity(threats: MatchedThreat[]): Record<string, MatchedThreat[]> {
    const groups: Record<string, MatchedThreat[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };

    for (const threat of threats) {
      const severity = threat.severity.toLowerCase();
      if (groups[severity]) {
        groups[severity].push(threat);
      }
    }

    return groups;
  }

  /**
   * Group matched threats by category
   */
  groupByCategory(threats: MatchedThreat[]): Record<string, MatchedThreat[]> {
    const groups: Record<string, MatchedThreat[]> = {};

    for (const threat of threats) {
      const category = threat.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(threat);
    }

    return groups;
  }

  /**
   * Get critical threats (highest priority)
   */
  getCriticalThreats(result: ThreatMatchResult): MatchedThreat[] {
    return result.matched_threats.filter(mt => 
      mt.severity === ThreatSeverity.CRITICAL
    );
  }

  /**
   * Get high risk threats (high risk score)
   */
  getHighRiskThreats(
    result: ThreatMatchResult,
    threshold: number = 5.0
  ): MatchedThreat[] {
    return result.matched_threats.filter(mt => mt.risk_score >= threshold);
  }

  /**
   * Generate summary report
   */
  generateSummary(result: ThreatMatchResult): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    topCategories: Array<{ category: string; count: number }>;
    executionTimeMs: number;
  } {
    const bySeverity = result.statistics.by_severity;
    const byCategory = result.statistics.by_category;

    // Sort categories by count
    const topCategories = Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: result.total_matched,
      critical: bySeverity.critical || 0,
      high: bySeverity.high || 0,
      medium: bySeverity.medium || 0,
      low: bySeverity.low || 0,
      topCategories,
      executionTimeMs: result.execution_time_ms
    };
  }
}

/**
 * Convenience function to match threats
 */
export async function matchInfrastructureThreats(
  config: Record<string, any>,
  options?: ThreatMatchOptions
): Promise<ThreatMatchResult> {
  const client = new ThreatMatcherClient(options);
  return client.matchThreats(config, options);
}
