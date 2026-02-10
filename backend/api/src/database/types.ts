/**
 * TypeScript types for database tables
 * Generated from schema.sql
 */

// ============================================
// Enums
// ============================================

export type UserRole = 'user' | 'admin' | 'analyst';

export type ThreatModelStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export type Methodology = 'STRIDE' | 'PASTA' | 'VAST' | 'OCTAVE' | 'DREAD';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ThreatCategory =
  | 'spoofing'
  | 'tampering'
  | 'repudiation'
  | 'information_disclosure'
  | 'denial_of_service'
  | 'elevation_of_privilege'
  | 'other';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Likelihood = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

export type ThreatStatus = 'open' | 'in_progress' | 'mitigated' | 'accepted' | 'closed';

export type ComplianceFramework =
  | 'NIST'
  | 'ISO27001'
  | 'SOC2'
  | 'PCI-DSS'
  | 'HIPAA'
  | 'GDPR'
  | 'CIS'
  | 'OWASP';

export type ComplianceStatus =
  | 'not_implemented'
  | 'partially_implemented'
  | 'implemented'
  | 'not_applicable';

// ============================================
// Table Types
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ThreatModel {
  id: string;
  name: string;
  description: string | null;
  status: ThreatModelStatus;
  methodology: Methodology;
  cloud_providers: string | null; // JSON array
  system_description: string | null;
  data_flow_diagram: string | null; // JSON
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  threat_model_id: string;
  status: AnalysisStatus;
  dfd_json: string | null; // JSON
  threats_json: string | null; // JSON array
  analysis_type: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Threat {
  id: string;
  threat_model_id: string;
  threat_rule_id: string | null;
  category: ThreatCategory;
  name: string;
  description: string | null;
  severity: Severity;
  likelihood: Likelihood;
  impact: Severity;
  status: ThreatStatus;
  mitigation: string | null;
  assigned_to: string | null;
  jira_ticket: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes_json: string | null; // JSON
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface ComplianceMapping {
  id: string;
  threat_id: string;
  framework: ComplianceFramework;
  control_id: string;
  control_name: string | null;
  status: ComplianceStatus;
  evidence: string | null;
  created_at: string;
  updated_at: string;
}

export interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

// ============================================
// View Types
// ============================================

export interface ThreatSummary {
  threat_model_id: string;
  threat_model_name: string;
  total_threats: number;
  critical_threats: number;
  high_threats: number;
  medium_threats: number;
  low_threats: number;
  open_threats: number;
  mitigated_threats: number;
}

export interface UserActivity {
  user_id: string;
  email: string;
  role: UserRole;
  threat_models_created: number;
  threats_assigned: number;
  last_activity: string | null;
}

export interface ComplianceCoverage {
  framework: ComplianceFramework;
  threats_mapped: number;
  implemented: number;
  partially_implemented: number;
  not_implemented: number;
}

// ============================================
// Insert/Update DTOs (without auto-generated fields)
// ============================================

export interface CreateUserDto {
  id: string;
  email: string;
  password_hash: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  email?: string;
  password_hash?: string;
  role?: UserRole;
}

export interface CreateThreatModelDto {
  id: string;
  name: string;
  description?: string;
  status?: ThreatModelStatus;
  methodology?: Methodology;
  cloud_providers?: string[];
  system_description?: string;
  data_flow_diagram?: object;
  created_by: string;
}

export interface UpdateThreatModelDto {
  name?: string;
  description?: string;
  status?: ThreatModelStatus;
  methodology?: Methodology;
  cloud_providers?: string[];
  system_description?: string;
  data_flow_diagram?: object;
}

export interface CreateAnalysisDto {
  id: string;
  threat_model_id: string;
  status?: AnalysisStatus;
  dfd_json?: object;
  threats_json?: object[];
  analysis_type?: string;
}

export interface UpdateAnalysisDto {
  status?: AnalysisStatus;
  dfd_json?: object;
  threats_json?: object[];
  error_message?: string;
  completed_at?: string;
}

export interface CreateThreatDto {
  id: string;
  threat_model_id: string;
  threat_rule_id?: string;
  category: ThreatCategory;
  name: string;
  description?: string;
  severity: Severity;
  likelihood: Likelihood;
  impact: Severity;
  status?: ThreatStatus;
  mitigation?: string;
  assigned_to?: string;
  jira_ticket?: string;
}

export interface UpdateThreatDto {
  category?: ThreatCategory;
  name?: string;
  description?: string;
  severity?: Severity;
  likelihood?: Likelihood;
  impact?: Severity;
  status?: ThreatStatus;
  mitigation?: string;
  assigned_to?: string;
  jira_ticket?: string;
}

export interface CreateAuditLogDto {
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes_json?: object;
  details?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface CreateComplianceMappingDto {
  id: string;
  threat_id: string;
  framework: ComplianceFramework;
  control_id: string;
  control_name?: string;
  status?: ComplianceStatus;
  evidence?: string;
}

export interface UpdateComplianceMappingDto {
  control_name?: string;
  status?: ComplianceStatus;
  evidence?: string;
}

// ============================================
// Query Result Types
// ============================================

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface SingleResult<T> {
  row: T | null;
}

// ============================================
// Helper Types
// ============================================

export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'Oracle' | 'IBM' | 'Other';

export interface DataFlowDiagram {
  nodes: DFDNode[];
  edges: DFDEdge[];
  metadata?: {
    version: string;
    created_at: string;
    updated_at: string;
  };
}

export interface DFDNode {
  id: string;
  type: 'process' | 'datastore' | 'external_entity' | 'trust_boundary';
  label: string;
  properties?: Record<string, unknown>;
}

export interface DFDEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol?: string;
  authentication?: string;
  encryption?: boolean;
}

export interface DiscoveredThreat {
  category: ThreatCategory;
  name: string;
  description: string;
  severity: Severity;
  likelihood: Likelihood;
  impact: Severity;
  mitigation: string;
  affected_assets: string[];
  cwe_ids?: string[];
  owasp_refs?: string[];
}

export interface AuditLogChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fields_changed?: string[];
}
