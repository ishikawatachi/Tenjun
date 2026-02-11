/**
 * TypeScript Type Definitions
 * 
 * Central type definitions for the Threat Modeling Platform
 */

// ============================================================================
// Enums
// ============================================================================

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum Likelihood {
  CERTAIN = 'certain',
  LIKELY = 'likely',
  POSSIBLE = 'possible',
  UNLIKELY = 'unlikely',
  RARE = 'rare',
}

export enum TrustBoundary {
  INTERNET = 'internet',
  DMZ = 'dmz',
  INTERNAL = 'internal',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii',
  PHI = 'phi',
}

export enum NodeType {
  SERVICE = 'service',
  DATABASE = 'database',
  STORAGE = 'storage',
  COMPUTE = 'compute',
  API = 'api',
  CACHE = 'cache',
  QUEUE = 'queue',
  FUNCTION = 'function',
  EXTERNAL = 'external',
  USER = 'user',
}

export enum CloudProvider {
  GCP = 'gcp',
  AWS = 'aws',
  AZURE = 'azure',
}

// ============================================================================
// Core Domain Types
// ============================================================================

export interface Resource {
  id: string;
  resource_type: string;
  name: string;
  full_name?: string;
  properties: Record<string, any>;
  cloud_provider?: CloudProvider;
}

export interface Condition {
  field: string;
  operator: string;
  value: any;
}

export interface LogicGroup {
  logic: 'and' | 'or';
  conditions: Condition[];
}

export interface Mitigation {
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  steps: string[];
}

export interface ComplianceMapping {
  framework: string;
  control_id: string;
  description: string;
}

export interface Threat {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  likelihood: Likelihood;
  category: string;
  resource_types: string[];
  cloud_providers: string[];
  conditions?: LogicGroup;
  mitigations: Mitigation[];
  compliance_mappings: ComplianceMapping[];
  attack_vectors?: string[];
  exploitability?: string;
  business_impact?: string;
  references?: string[];
  tags?: string[];
}

export interface MatchedThreat {
  threat_id: string;
  threat_name: string;
  description: string;
  severity: Severity;
  likelihood: Likelihood;
  risk_score: number;
  category: string;
  resource_id: string;
  resource_type: string;
  cloud_provider: string;
  matched_conditions: Condition[];
  mitigations: Mitigation[];
  compliance_mappings: ComplianceMapping[];
  references: string[];
}

export interface ThreatMatchResult {
  timestamp: string;
  total_matched: number;
  total_resources: number;
  matched_threats: MatchedThreat[];
  statistics: {
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
    by_resource_type: Record<string, number>;
    by_cloud_provider: Record<string, number>;
    average_risk_score: number;
  };
}

// ============================================================================
// DFD Types
// ============================================================================

export interface DFDNode {
  id: string;
  label: string;
  type: NodeType;
  cloud_provider?: string;
  trust_boundary?: TrustBoundary;
  resource_type?: string;
  properties?: Record<string, any>;
  tags?: string[];
}

export interface DFDEdge {
  source: string;
  target: string;
  label: string;
  data_classification?: DataClassification;
  protocol?: string;
  port?: number;
  encrypted?: boolean;
  bidirectional?: boolean;
  properties?: Record<string, any>;
}

export interface TrustBoundaryGroup {
  boundary: TrustBoundary;
  name: string;
  node_ids: string[];
  description?: string;
}

export interface DFD {
  level: 'service' | 'component' | 'code';
  nodes: DFDNode[];
  edges: DFDEdge[];
  trust_boundaries: TrustBoundaryGroup[];
  metadata: Record<string, any>;
  statistics: {
    level: string;
    total_nodes: number;
    total_edges: number;
    node_types: Record<string, number>;
    trust_boundaries: Record<string, number>;
    data_classifications: Record<string, number>;
    cross_boundary_flows: number;
    external_connections: number;
    encrypted_flows: number;
  };
}

export interface DFDGenerationResult {
  timestamp: string;
  service_level?: DFD;
  component_level?: DFD;
  code_level?: DFD;
  metadata: Record<string, any>;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMThreatDescription {
  description: string;
  timestamp: string;
  cached: boolean;
}

export interface RemediationStep {
  description: string;
  cli_commands?: string[];
  terraform_code?: string;
  azure_cli?: string[];
  gcloud_commands?: string[];
}

export interface LLMRemediation {
  remediation: RemediationStep[];
  timestamp: string;
  cached: boolean;
}

export interface LLMComplianceExplanation {
  framework: string;
  control_id: string;
  requirement: string;
  how_threat_violates: string;
  remediation_guidance: string;
  timestamp: string;
  cached: boolean;
}

export interface LLMAttackScenario {
  scenario: string;
  attack_steps: string[];
  mitre_techniques: string[];
  timestamp: string;
  cached: boolean;
}

export interface LLMRiskAssessment {
  business_impact: string;
  technical_severity: string;
  regulatory_impact: string;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  cached: boolean;
}

// ============================================================================
// Terraform Types
// ============================================================================

export interface TerraformResource {
  resource_type: string;
  name: string;
  full_name: string;
  attributes: Record<string, any>;
}

export interface TerraformParseResult {
  resources: Resource[];
  variables: Array<{
    name: string;
    type?: string;
    default?: any;
    description?: string;
  }>;
  outputs: Array<{
    name: string;
    value: any;
    description?: string;
  }>;
  statistics: {
    total_resources: number;
    by_type: Record<string, number>;
    by_provider: Record<string, number>;
  };
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ViewMode {
  current: 'business' | 'architect' | 'developer';
}

export interface AnalysisState {
  loading: boolean;
  error?: string;
  resources: Resource[];
  threats: MatchedThreat[];
  dfds: {
    service?: DFD;
    component?: DFD;
    code?: DFD;
  };
  selectedThreat?: MatchedThreat;
  selectedResource?: Resource;
}

export interface ComplianceState {
  frameworks: string[];
  selectedFramework?: string;
  mappings: ComplianceMapping[];
  explanations: Record<string, LLMComplianceExplanation>;
}

export interface FilterState {
  severity: Severity[];
  category: string[];
  cloudProvider: CloudProvider[];
  trustBoundary: TrustBoundary[];
  searchQuery: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ThreatMatchRequest {
  config: {
    resources: Resource[];
    cloud_provider?: string;
  };
  options?: {
    filter_by_resource_type?: boolean;
    min_severity?: Severity;
  };
}

export interface DFDGenerationRequest {
  resources: Resource[];
  code_flows?: Array<{
    function: string;
    calls?: string[];
    external_apis?: string[];
    data_access?: string[];
  }>;
}

export interface LLMDescriptionRequest {
  config: Resource;
  threat_rule: Threat;
  use_cache?: boolean;
}

export interface LLMRemediationRequest {
  threat: MatchedThreat;
  context: {
    cloud_provider: string;
    service_type: string;
    configuration: Record<string, any>;
  };
  use_cache?: boolean;
}

export interface LLMComplianceRequest {
  threat: MatchedThreat;
  framework: string;
  control_id: string;
  use_cache?: boolean;
}

// ============================================================================
// Form Types
// ============================================================================

export interface TerraformUploadForm {
  files: FileList;
  cloud_provider?: CloudProvider;
}

export interface ThreatFilterForm {
  severity: Severity[];
  categories: string[];
  search: string;
}

export interface ReportConfigForm {
  title: string;
  include_dfd: boolean;
  include_threats: boolean;
  include_compliance: boolean;
  include_remediation: boolean;
  frameworks: string[];
  format: 'pdf' | 'html' | 'markdown';
}

// ============================================================================
// Chart/Visualization Types
// ============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ThreatDistribution {
  by_severity: ChartDataPoint[];
  by_category: ChartDataPoint[];
  by_cloud_provider: ChartDataPoint[];
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'html';
  include_threats: boolean;
  include_dfd: boolean;
  include_compliance: boolean;
  include_remediation: boolean;
}

export interface ReportMetadata {
  generated_at: string;
  version: string;
  total_resources: number;
  total_threats: number;
  risk_score: number;
}
