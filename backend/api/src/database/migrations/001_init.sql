-- ============================================
-- Migration: 001_init.sql
-- Description: Initial database schema setup
-- Date: 2026-02-10
-- ============================================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- ============================================
-- Create Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'analyst')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- Create Threat Models Table
-- ============================================
CREATE TABLE IF NOT EXISTS threat_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed', 'archived')),
    methodology TEXT NOT NULL DEFAULT 'STRIDE' CHECK(methodology IN ('STRIDE', 'PASTA', 'VAST', 'OCTAVE', 'DREAD')),
    cloud_providers TEXT,
    system_description TEXT,
    data_flow_diagram TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_threat_models_created_by ON threat_models(created_by);
CREATE INDEX idx_threat_models_status ON threat_models(status);
CREATE INDEX idx_threat_models_created_at ON threat_models(created_at DESC);

-- ============================================
-- Create Analyses Table
-- ============================================
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    threat_model_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    dfd_json TEXT,
    threats_json TEXT,
    analysis_type TEXT DEFAULT 'comprehensive',
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (threat_model_id) REFERENCES threat_models(id) ON DELETE CASCADE
);

CREATE INDEX idx_analyses_threat_model ON analyses(threat_model_id);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_started_at ON analyses(started_at DESC);

-- ============================================
-- Create Threats Table
-- ============================================
CREATE TABLE IF NOT EXISTS threats (
    id TEXT PRIMARY KEY,
    threat_model_id TEXT NOT NULL,
    threat_rule_id TEXT,
    category TEXT NOT NULL CHECK(category IN ('spoofing', 'tampering', 'repudiation', 'information_disclosure', 'denial_of_service', 'elevation_of_privilege', 'other')),
    name TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    likelihood TEXT NOT NULL CHECK(likelihood IN ('very_high', 'high', 'medium', 'low', 'very_low')),
    impact TEXT NOT NULL CHECK(impact IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'mitigated', 'accepted', 'closed')),
    mitigation TEXT,
    assigned_to TEXT,
    jira_ticket TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threat_model_id) REFERENCES threat_models(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_threats_threat_model ON threats(threat_model_id);
CREATE INDEX idx_threats_severity ON threats(severity);
CREATE INDEX idx_threats_status ON threats(status);
CREATE INDEX idx_threats_assigned_to ON threats(assigned_to);
CREATE INDEX idx_threats_category ON threats(category);

-- ============================================
-- Create Audit Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    changes_json TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- Create Compliance Mappings Table
-- ============================================
CREATE TABLE IF NOT EXISTS compliance_mappings (
    id TEXT PRIMARY KEY,
    threat_id TEXT NOT NULL,
    framework TEXT NOT NULL CHECK(framework IN ('NIST', 'ISO27001', 'SOC2', 'PCI-DSS', 'HIPAA', 'GDPR', 'CIS', 'OWASP')),
    control_id TEXT NOT NULL,
    control_name TEXT,
    status TEXT NOT NULL DEFAULT 'not_implemented' CHECK(status IN ('not_implemented', 'partially_implemented', 'implemented', 'not_applicable')),
    evidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE
);

CREATE INDEX idx_compliance_threat_id ON compliance_mappings(threat_id);
CREATE INDEX idx_compliance_framework ON compliance_mappings(framework);
CREATE INDEX idx_compliance_status ON compliance_mappings(status);

-- ============================================
-- Create Views
-- ============================================

-- View: Threat Summary by Model
CREATE VIEW IF NOT EXISTS v_threat_summary AS
SELECT 
    tm.id AS threat_model_id,
    tm.name AS threat_model_name,
    COUNT(t.id) AS total_threats,
    SUM(CASE WHEN t.severity = 'critical' THEN 1 ELSE 0 END) AS critical_threats,
    SUM(CASE WHEN t.severity = 'high' THEN 1 ELSE 0 END) AS high_threats,
    SUM(CASE WHEN t.severity = 'medium' THEN 1 ELSE 0 END) AS medium_threats,
    SUM(CASE WHEN t.severity = 'low' THEN 1 ELSE 0 END) AS low_threats,
    SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_threats,
    SUM(CASE WHEN t.status = 'mitigated' THEN 1 ELSE 0 END) AS mitigated_threats
FROM threat_models tm
LEFT JOIN threats t ON tm.id = t.threat_model_id
GROUP BY tm.id, tm.name;

-- View: User Activity Summary
CREATE VIEW IF NOT EXISTS v_user_activity AS
SELECT 
    u.id AS user_id,
    u.email,
    u.role,
    COUNT(DISTINCT tm.id) AS threat_models_created,
    COUNT(DISTINCT t.id) AS threats_assigned,
    MAX(al.timestamp) AS last_activity
FROM users u
LEFT JOIN threat_models tm ON u.id = tm.created_by
LEFT JOIN threats t ON u.id = t.assigned_to
LEFT JOIN audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.email, u.role;

-- View: Compliance Coverage
CREATE VIEW IF NOT EXISTS v_compliance_coverage AS
SELECT 
    cm.framework,
    COUNT(DISTINCT cm.threat_id) AS threats_mapped,
    SUM(CASE WHEN cm.status = 'implemented' THEN 1 ELSE 0 END) AS implemented,
    SUM(CASE WHEN cm.status = 'partially_implemented' THEN 1 ELSE 0 END) AS partially_implemented,
    SUM(CASE WHEN cm.status = 'not_implemented' THEN 1 ELSE 0 END) AS not_implemented
FROM compliance_mappings cm
GROUP BY cm.framework;

-- ============================================
-- Insert Migration Record
-- ============================================
INSERT INTO migrations (name) VALUES ('001_init');
