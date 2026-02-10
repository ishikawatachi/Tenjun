/**
 * Terraform Parser Client
 * Node.js wrapper to call Python Terraform parser service
 * 
 * This service bridges the Node.js API with the Python parsing service
 * to extract infrastructure configurations for threat modeling.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

/**
 * Terraform resource definition
 */
export interface TerraformResource {
  resource_type: string;
  name: string;
  full_name: string;
  properties: Record<string, any>;
  location?: string;
  line_number?: number;
  depends_on: string[];
  provider?: string;
  cloud_provider?: string;
}

/**
 * Terraform variable definition
 */
export interface TerraformVariable {
  name: string;
  type?: string;
  default?: any;
  description?: string;
  sensitive: boolean;
  validation_rules: any[];
  location?: string;
  line_number?: number;
}

/**
 * Terraform provider configuration
 */
export interface TerraformProvider {
  name: string;
  full_name: string;
  alias?: string;
  version?: string;
  region?: string;
  configuration: Record<string, any>;
  location?: string;
  line_number?: number;
}

/**
 * Terraform data source definition
 */
export interface TerraformDataSource {
  data_type: string;
  name: string;
  full_name: string;
  properties: Record<string, any>;
  location?: string;
  line_number?: number;
  provider?: string;
}

/**
 * Terraform module reference
 */
export interface TerraformModule {
  name: string;
  source: string;
  version?: string;
  inputs: Record<string, any>;
  location?: string;
  line_number?: number;
}

/**
 * Complete Terraform configuration
 */
export interface TerraformConfiguration {
  resources: TerraformResource[];
  data_sources: TerraformDataSource[];
  variables: TerraformVariable[];
  outputs: any[];
  providers: TerraformProvider[];
  modules: TerraformModule[];
  terraform_version?: string;
  backend_config?: Record<string, any>;
  parsed_at: string;
  source_files: string[];
  statistics: {
    total_resources: number;
    total_data_sources: number;
    total_variables: number;
    total_outputs: number;
    total_providers: number;
    total_modules: number;
    providers_by_type: Record<string, number>;
  };
  parsing_errors?: string[];
}

/**
 * Options for Terraform parsing
 */
export interface TerraformParseOptions {
  /** Timeout in milliseconds for parsing operation */
  timeout?: number;
  /** Python executable path (defaults to 'python3') */
  pythonPath?: string;
  /** Additional environment variables for Python process */
  env?: Record<string, string>;
  /** Maximum file size to parse (in bytes) */
  maxFileSize?: number;
}

/**
 * Terraform Parser Client
 * 
 * Provides methods to parse Terraform configurations using Python backend
 */
export class TerraformParserClient {
  private pythonPath: string;
  private parserScriptPath: string;
  private defaultTimeout: number;
  private maxFileSize: number;

  constructor(options: TerraformParseOptions = {}) {
    this.pythonPath = options.pythonPath || process.env.PYTHON_PATH || 'python3';
    this.defaultTimeout = options.timeout || 30000; // 30 seconds
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    
    // Path to Python parser script
    const backendPath = path.resolve(__dirname, '../../../analysis');
    this.parserScriptPath = path.join(backendPath, 'parsers', 'terraform_parser.py');
    
    logger.info('TerraformParserClient initialized', {
      pythonPath: this.pythonPath,
      parserScriptPath: this.parserScriptPath,
      timeout: this.defaultTimeout
    });
  }

  /**
   * Parse a single Terraform file
   * 
   * @param filePath - Absolute path to .tf file
   * @param options - Parsing options
   * @returns Parsed Terraform configuration
   */
  async parseFile(filePath: string, options: TerraformParseOptions = {}): Promise<TerraformConfiguration> {
    logger.info('Parsing Terraform file', { filePath });

    // Validate file exists
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }
      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
      }
    } catch (error: any) {
      logger.error('File validation failed', { filePath, error: error.message });
      throw error;
    }

    // Validate file extension
    const ext = path.extname(filePath);
    if (!['.tf', '.hcl'].includes(ext)) {
      throw new Error(`Unsupported file extension: ${ext}. Supported: .tf, .hcl`);
    }

    try {
      const result = await this.executePythonParser('file', filePath, options);
      logger.info('Successfully parsed Terraform file', {
        filePath,
        resourceCount: result.resources.length,
        variableCount: result.variables.length
      });
      return result;
    } catch (error: any) {
      logger.error('Failed to parse Terraform file', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Parse all Terraform files in a directory
   * 
   * @param dirPath - Absolute path to directory containing .tf files
   * @param options - Parsing options
   * @returns Merged Terraform configuration from all files
   */
  async parseDirectory(dirPath: string, options: TerraformParseOptions = {}): Promise<TerraformConfiguration> {
    logger.info('Parsing Terraform directory', { dirPath });

    // Validate directory exists
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }
    } catch (error: any) {
      logger.error('Directory validation failed', { dirPath, error: error.message });
      throw error;
    }

    try {
      const result = await this.executePythonParser('directory', dirPath, options);
      logger.info('Successfully parsed Terraform directory', {
        dirPath,
        fileCount: result.source_files.length,
        resourceCount: result.resources.length,
        variableCount: result.variables.length
      });
      return result;
    } catch (error: any) {
      logger.error('Failed to parse Terraform directory', { dirPath, error: error.message });
      throw error;
    }
  }

  /**
   * Extract security-relevant resources from configuration
   * 
   * Filters resources that are commonly associated with security risks
   */
  extractSecurityResources(config: TerraformConfiguration): TerraformResource[] {
    const securityKeywords = [
      'security_group', 'firewall', 'iam', 'policy', 'role',
      'bucket', 'storage', 'database', 'sql', 'kms', 'key',
      'secret', 'password', 'certificate', 'ssl', 'tls',
      'network', 'vpc', 'subnet', 'gateway', 'load_balancer'
    ];

    return config.resources.filter(resource => {
      const resourceTypeLC = resource.resource_type.toLowerCase();
      return securityKeywords.some(keyword => resourceTypeLC.includes(keyword));
    });
  }

  /**
   * Find sensitive variables (potential credential leaks)
   */
  findSensitiveVariables(config: TerraformConfiguration): TerraformVariable[] {
    const sensitivePatterns = [
      /password/i, /secret/i, /token/i, /key/i, /credential/i,
      /api_key/i, /access_key/i, /private/i
    ];

    return config.variables.filter(variable => {
      // Already marked as sensitive
      if (variable.sensitive) {
        return true;
      }

      // Check variable name against patterns
      return sensitivePatterns.some(pattern => pattern.test(variable.name));
    });
  }

  /**
   * Analyze public exposure risks
   */
  analyzePublicExposure(config: TerraformConfiguration): Array<{
    resource: TerraformResource;
    risk: string;
    severity: 'high' | 'medium' | 'low';
  }> {
    const risks: Array<{ resource: TerraformResource; risk: string; severity: 'high' | 'medium' | 'low' }> = [];

    for (const resource of config.resources) {
      const props = resource.properties;

      // Check for public IP assignments
      if (resource.resource_type.includes('instance') || resource.resource_type.includes('compute')) {
        if (this.hasPublicIP(props)) {
          risks.push({
            resource,
            risk: 'Instance has public IP address assigned',
            severity: 'medium'
          });
        }
      }

      // Check for open security groups (0.0.0.0/0)
      if (resource.resource_type.includes('security_group') || resource.resource_type.includes('firewall')) {
        if (this.hasOpenToInternet(props)) {
          risks.push({
            resource,
            risk: 'Security group allows access from 0.0.0.0/0',
            severity: 'high'
          });
        }
      }

      // Check for public storage buckets
      if (resource.resource_type.includes('bucket') || resource.resource_type.includes('storage')) {
        if (this.isPublicBucket(props) || this.hasPublicAccessBlock(resource, config)) {
          risks.push({
            resource,
            risk: 'Storage bucket may be publicly accessible',
            severity: 'high'
          });
        }
      }

      // Check for unencrypted databases
      if (resource.resource_type.includes('database') || resource.resource_type.includes('sql')) {
        if (!this.hasEncryptionEnabled(props)) {
          risks.push({
            resource,
            risk: 'Database does not have encryption enabled',
            severity: 'high'
          });
        }
      }
    }

    return risks;
  }

  /**
   * Execute Python parser script
   */
  private async executePythonParser(
    parseType: 'file' | 'directory',
    targetPath: string,
    options: TerraformParseOptions
  ): Promise<TerraformConfiguration> {
    const timeout = options.timeout || this.defaultTimeout;

    return new Promise((resolve, reject) => {
      // Create Python script to invoke parser
      const pythonCode = `
import sys
import json
sys.path.insert(0, '${path.dirname(this.parserScriptPath)}')
sys.path.insert(0, '${path.resolve(path.dirname(this.parserScriptPath), '..')}')

from terraform_parser import TerraformParser

parser = TerraformParser()
result = parser.parse_${parseType}('${targetPath.replace(/\\/g, '\\\\')}')
print(json.dumps(result, indent=2))
`;

      const pythonProcess = spawn(this.pythonPath, ['-c', pythonCode], {
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Terraform parsing timed out after ${timeout}ms`));
      }, timeout);

      // Collect stdout
      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          return;
        }

        if (code !== 0) {
          logger.error('Python parser failed', { code, stderr, stdout });
          reject(new Error(`Python parser failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout) as TerraformConfiguration;
          resolve(result);
        } catch (error: any) {
          logger.error('Failed to parse Python output', { error: error.message, stdout });
          reject(new Error(`Failed to parse Python output: ${error.message}`));
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        clearTimeout(timer);
        logger.error('Python process error', { error: error.message });
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  // Helper methods for security analysis

  private hasPublicIP(props: any): boolean {
    if (Array.isArray(props.network_interface)) {
      return props.network_interface.some((ni: any) => ni.access_config || ni.assign_public_ip);
    }
    return props.associate_public_ip_address === true || props.public_ip === true;
  }

  private hasOpenToInternet(props: any): boolean {
    const checkCIDR = (cidr: string) => cidr === '0.0.0.0/0' || cidr === '::/0';
    
    // Check ingress rules
    if (props.ingress) {
      const ingress = Array.isArray(props.ingress) ? props.ingress : [props.ingress];
      return ingress.some((rule: any) => {
        if (rule.cidr_blocks) {
          return rule.cidr_blocks.some(checkCIDR);
        }
        if (rule.source_ranges) {
          return rule.source_ranges.some(checkCIDR);
        }
        return false;
      });
    }

    // Check IP configuration for GCP
    if (props.settings?.ip_configuration?.authorized_networks) {
      return props.settings.ip_configuration.authorized_networks.some((net: any) =>
        checkCIDR(net.value)
      );
    }

    return false;
  }

  private isPublicBucket(props: any): boolean {
    return props.acl === 'public-read' || 
           props.acl === 'public-read-write' ||
           props.uniform_bucket_level_access === false;
  }

  private hasPublicAccessBlock(resource: TerraformResource, config: TerraformConfiguration): boolean {
    // Find associated public access block resource
    const pabResources = config.resources.filter(r =>
      r.resource_type.includes('public_access_block') &&
      r.properties.bucket === `\${${resource.full_name}.id}` ||
      r.properties.bucket === resource.full_name
    );

    return pabResources.some(pab => {
      const props = pab.properties;
      return props.block_public_acls === false ||
             props.block_public_policy === false ||
             props.ignore_public_acls === false ||
             props.restrict_public_buckets === false;
    });
  }

  private hasEncryptionEnabled(props: any): boolean {
    // Check for various encryption flags across cloud providers
    return props.encrypted === true ||
           props.encryption === true ||
           props.settings?.backup_configuration?.enabled === true ||
           props.root_block_device?.encrypted === true ||
           props.disk_encryption_set_id !== undefined;
  }

  /**
   * Verify Python dependencies are installed
   */
  async verifyDependencies(): Promise<boolean> {
    try {
      const result = await this.executePythonCheck(`
import sys
try:
    import hcl2
    print("OK")
except ImportError:
    print("MISSING: hcl2")
    sys.exit(1)
`);
      return result.trim() === 'OK';
    } catch (error: any) {
      logger.error('Python dependency check failed', { error: error.message });
      return false;
    }
  }

  private async executePythonCheck(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, ['-c', code]);
      
      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Python check failed'));
        } else {
          resolve(output);
        }
      });

      pythonProcess.on('error', reject);
    });
  }
}

// Export convenience function
export async function parseTerraformFile(
  filePath: string,
  options?: TerraformParseOptions
): Promise<TerraformConfiguration> {
  const client = new TerraformParserClient(options);
  return client.parseFile(filePath, options);
}

export async function parseTerraformDirectory(
  dirPath: string,
  options?: TerraformParseOptions
): Promise<TerraformConfiguration> {
  const client = new TerraformParserClient(options);
  return client.parseDirectory(dirPath, options);
}
