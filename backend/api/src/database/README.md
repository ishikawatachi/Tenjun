# Database Schema Documentation

## Overview
SQLite database schema for the Threat Modeling Platform with UUID primary keys, encryption support, and comprehensive auditing.

## Tables

### 1. users
Stores user authentication and profile information.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - UUID
- `email` (TEXT, UNIQUE, NOT NULL) - User email address
- `password_hash` (TEXT, NOT NULL) - Bcrypt hashed password
- `role` (TEXT, NOT NULL) - User role: 'user', 'admin', 'analyst'
- `created_at` (DATETIME) - Timestamp
- `updated_at` (DATETIME) - Timestamp

**Indexes:**
- `idx_users_email` on email
- `idx_users_role` on role

### 2. threat_models
Stores threat model documents and metadata.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - UUID
- `name` (TEXT, NOT NULL) - Model name
- `description` (TEXT) - Model description
- `status` (TEXT, NOT NULL) - 'draft', 'in_progress', 'completed', 'archived'
- `methodology` (TEXT, NOT NULL) - 'STRIDE', 'PASTA', 'VAST', 'OCTAVE', 'DREAD'
- `cloud_providers` (TEXT) - JSON array of providers
- `system_description` (TEXT) - System description
- `data_flow_diagram` (TEXT) - JSON DFD representation
- `created_by` (TEXT, NOT NULL, FK → users.id)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes:**
- `idx_threat_models_created_by` on created_by
- `idx_threat_models_status` on status
- `idx_threat_models_created_at` on created_at DESC

### 3. analyses
Stores AI analysis results and status.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - UUID
-`threat_model_id` (TEXT, NOT NULL, FK → threat_models.id)
- `status` (TEXT, NOT NULL) - 'pending', 'running', 'completed', 'failed'
- `dfd_json` (TEXT) - JSON Data Flow Diagram
- `threats_json` (TEXT) - JSON array of discovered threats
- `analysis_type` (TEXT) - Analysis type identifier
- `error_message` (TEXT) - Error details if failed
- `started_at` (DATETIME)
- `completed_at` (DATETIME)

**Indexes:**
- `idx_analyses_threat_model` on threat_model_id
- `idx_analyses_status` on status
- `idx_analyses_started_at` on started_at DESC

### 4. threats
Stores identified threats and their details.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - UUID
- `threat_model_id` (TEXT, NOT NULL, FK → threat_models.id)
- `threat_rule_id` (TEXT) - Reference to rule pattern
- `category` (TEXT, NOT NULL) - STRIDE category
- `name` (TEXT, NOT NULL) - Threat name
- `description` (TEXT) - Detailed description
- `severity` (TEXT, NOT NULL) - 'critical', 'high', 'medium', 'low'
- `likelihood` (TEXT, NOT NULL) - 'very_high' to 'very_low'
- `impact` (TEXT, NOT NULL) - 'critical', 'high', 'medium', 'low'
- `status` (TEXT, NOT NULL) - 'open', 'in_progress', 'mitigated', 'accepted', 'closed'
- `mitigation` (TEXT) - Mitigation recommendations
- `assigned_to` (TEXT, FK → users.id)
- `jira_ticket` (TEXT) - Associated Jira ticket key
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes:**
- `idx_threats_threat_model` on threat_model_id
- `idx_threats_severity` on severity
- `idx_threats_status` on status
- `idx_threats_assigned_to` on assigned_to
- `idx_threats_category` on category

### 5. audit_logs
Comprehensive audit trail of all operations.

**Columns:**
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `user_id` (TEXT, FK → users.id)
- `action` (TEXT, NOT NULL) - Action performed
- `resource_type` (TEXT, NOT NULL) - Type of resource
- `resource_id` (TEXT) - Resource identifier
- `changes_json` (TEXT) - JSON before/after values
- `details` (TEXT) - Additional details
- `ip_address` (TEXT) - Request IP
- `user_agent` (TEXT) - Client user agent
- `timestamp` (DATETIME)

**Indexes:**
- `idx_audit_logs_user_id` on user_id
- `idx_audit_logs_resource` on (resource_type, resource_id)
- `idx_audit_logs_timestamp` on timestamp DESC
- `idx_audit_logs_action` on action

### 6. compliance_mappings
Maps threats to compliance framework controls.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - UUID
- `threat_id` (TEXT, NOT NULL, FK → threats.id)
- `framework` (TEXT, NOT NULL) - Compliance framework
- `control_id` (TEXT, NOT NULL) - Control identifier
- `control_name` (TEXT) - Control name
- `status` (TEXT, NOT NULL) - Implementation status
- `evidence` (TEXT) - Supporting evidence
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes:**
- `idx_compliance_threat_id` on threat_id
- `idx_compliance_framework` on framework
- `idx_compliance_status` on status

## Views

### v_threat_summary
Aggregated threat statistics by threat model.

### v_user_activity
User activity metrics and statistics.

### v_compliance_coverage
Compliance framework coverage statistics.

## Migrations

Migrations are stored in `migrations/` directory and tracked in the `migrations` table.

**Current migrations:**
- `001_init.sql` - Initial schema setup

## Database Features

### Encryption
- Database file encryption using PRAGMA key
- SQLCipher compatible
- Secure file permissions (0600)

### Performance Optimizations
- WAL (Write-Ahead Logging) mode enabled
- 64MB cache size
- 256MB memory-mapped I/O
- Optimized page size (4KB)

### Backup & Maintenance
- `backupDatabase()` - Create consistent backups
- `restoreDatabase()` - Restore from backup
- `cleanupOldBackups()` - Automatic backup rotation
- `vacuumDatabase()` - Reclaim space
- `analyzeDatabase()` - Update query optimizer stats

## Usage Examples

### TypeScript Usage

```typescript
import { executeQuery, executeWrite, createAuditLog } from './database/db';
import { User, Threat } from './database/types';

// Query with type safety
const users = executeQuery<User>('SELECT * FROM users WHERE role = ?', ['admin']);

// Insert with audit logging
executeWrite(
  'INSERT INTO threats (id, threat_model_id, name, severity) VALUES (?, ?, ?, ?)',
  [uuid(), modelId, 'XSS Vulnerability', 'high']
);

createAuditLog(userId, 'CREATE', 'threat', threatId, { name: 'XSS' }, req.ip);

// Backup database
await backupDatabase();
```

### SQL Queries

```sql
-- Get threat summary for a model
SELECT * FROM v_threat_summary WHERE threat_model_id = ?;

-- Find high-severity open threats
SELECT * FROM threats 
WHERE severity IN ('critical', 'high') 
AND status = 'open'
ORDER BY severity DESC, created_at DESC;

-- Compliance coverage by framework
SELECT * FROM v_compliance_coverage;
```

## Security Considerations

1. **SQL Injection Prevention**: Always use parameterized queries
2. **Encryption**: Enable database encryption in production
3. **File Permissions**: Restrict database file access (0600)
4. **Audit Logging**: All operations are logged with user context
5. **Backups**: Regular automated backups with rotation
6. **Password Hashing**: Bcrypt with 12 rounds minimum

## Maintenance Schedule

- **Daily**: Automated backups
- **Weekly**: ANALYZE for query optimization
- **Monthly**: VACUUM to reclaim space
- **Quarterly**: Backup rotation and cleanup
