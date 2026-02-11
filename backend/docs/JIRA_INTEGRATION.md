# Jira Integration for Threat Tracking

Complete integration with Jira for automated threat issue management.

## Features

### 1. Auto-create Jira Issues
- **Issue Type**: Task (customizable to Security Task)
- **Summary**: `[CRITICAL] Cloud SQL Public Exposure`
- **Description**: Full threat details including:
  - Threat metadata (severity, risk score, likelihood, category)
  - Affected resources (type, ID, cloud provider)
  - Detailed description
  - Recommended mitigations with steps
  - Compliance impact mappings
  - References
- **Labels**: `threat`, severity level, cloud provider, resource type, category
- **Priority**: 
  - Critical → Highest
  - High → High
  - Medium → Medium
  - Low → Low
- **Assignee**: Configurable default assignee

### 2. Bidirectional Status Sync
- **Threat → Jira**: Update Jira issue when threat status changes
  - `identified` → "To Do"
  - `mitigated` → "Done"
  - `accepted` → "Done"
  - `false_positive` → "Done"
- **Jira → Threat**: Sync threat status from Jira webhooks
  - "Done"/"Closed"/"Resolved" → `mitigated`
  - "In Progress"/"In Review" → `identified`

### 3. Jira Webhooks
- Receive real-time updates when Jira issues change
- Automatically sync threat status from Jira
- Supports issue updates, transitions, and comments

### 4. Threat Trend Reports
- Total issues by status, priority, and labels
- Open vs resolved issue counts
- Critical/high/medium/low severity breakdown
- 30-day trends

## Setup

### Prerequisites

1. **Jira Cloud Account** with admin access
2. **API Token**: Generate at [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
3. **Project**: Create or use existing Jira project for security issues

### Configuration

1. Copy environment template:
```bash
cp .env.jira.example .env
```

2. Configure Jira credentials in `.env`:
```env
JIRA_HOST=your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token-here
JIRA_PROJECT_KEY=SEC
JIRA_DEFAULT_ASSIGNEE=557058:a1234567-89ab-cdef-0123-456789abcdef
APP_URL=https://your-threat-platform.com
```

3. Find your Jira Account ID:
   - Go to your Jira profile
   - Account ID is in the URL: `https://id.atlassian.com/manage-profile/profile?account_id=<ACCOUNT_ID>`

### Install Dependencies

```bash
cd backend
npm install axios express
npm install --save-dev @types/express @jest/globals
```

### Add Routes to Server

Update `backend/api/server.js`:

```javascript
import jiraRoutes from '../routes/jira.routes';

// ... other code

app.use('/api/jira', jiraRoutes);
```

## API Endpoints

### POST /api/jira/sync
Sync threats to Jira (create or update issues)

**Request:**
```json
{
  "threats": [
    {
      "threat_id": "threat-001",
      "threat_name": "Public S3 Bucket",
      "description": "S3 bucket allows public access",
      "severity": "critical",
      "risk_score": 9.5,
      ...
    }
  ],
  "create_new": true,
  "update_existing": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Threats synced to Jira",
  "results": {
    "total": 1,
    "created": 1,
    "updated": 0,
    "failed": 0,
    "issues": [
      {
        "threat_id": "threat-001",
        "issue_key": "SEC-101",
        "action": "created"
      }
    ],
    "errors": []
  }
}
```

### GET /api/jira/issues
Get Jira issues for threats

**Query Parameters:**
- `label`: Filter by label (e.g., `threat`, `critical`, `aws`)
- `threat_id`: Get issue for specific threat

**Response:**
```json
{
  "count": 50,
  "issues": [
    {
      "id": "10001",
      "key": "SEC-101",
      "self": "https://company.atlassian.net/rest/api/3/issue/10001",
      "fields": {
        "summary": "[CRITICAL] Public S3 Bucket",
        "status": { "name": "To Do" },
        "priority": { "name": "Highest" },
        "labels": ["threat", "critical", "aws", "s3"]
      }
    }
  ]
}
```

### POST /api/jira/webhook
Handle Jira webhook events (called by Jira)

**Request:** (From Jira)
```json
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "key": "SEC-101",
    "fields": {
      "status": { "name": "Done" },
      "labels": ["threat", "critical"]
    }
  }
}
```

### POST /api/jira/update-status
Update threat status in Jira

**Request:**
```json
{
  "threat_id": "threat-001",
  "status": "Done"
}
```

### GET /api/jira/report
Generate threat report from Jira

**Response:**
```json
{
  "success": true,
  "generated_at": "2026-02-11T10:30:00Z",
  "report": {
    "total_issues": 125,
    "by_status": {
      "To Do": 45,
      "In Progress": 30,
      "Done": 50
    },
    "by_priority": {
      "Highest": 20,
      "High": 40,
      "Medium": 50,
      "Low": 15
    },
    "open_issues": 75,
    "resolved_issues": 50,
    "critical_count": 20,
    "high_count": 40,
    "medium_count": 50,
    "low_count": 15
  }
}
```

### POST /api/jira/sync-status
Sync threat statuses from Jira

**Request:**
```json
{
  "threat_ids": ["threat-001", "threat-002", "threat-003"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Threat statuses synced from Jira",
  "results": {
    "total": 3,
    "synced": 3,
    "failed": 0,
    "updates": [
      {
        "threat_id": "threat-001",
        "status": "mitigated",
        "jira_issue_key": "SEC-101",
        "updated_at": "2026-02-11T10:30:00Z"
      }
    ]
  }
}
```

### GET /api/jira/status
Get Jira integration status

**Response:**
```json
{
  "configured": true,
  "host": "company.atlassian.net",
  "project_key": "SEC",
  "username": "***"
}
```

## Webhook Setup

### 1. Create Webhook in Jira

1. Go to **Settings** → **System** → **WebHooks**
2. Click **Create a WebHook**
3. Configure:
   - **Name**: Threat Platform Integration
   - **Status**: Enabled
   - **URL**: `https://your-threat-platform.com/api/jira/webhook`
   - **Events**:
     - ☑ Issue → updated
   - **JQL Filter**: `project = SEC AND labels = threat`

### 2. Secure Webhook (Optional)

Add webhook secret validation in controller:

```typescript
const webhookSecret = process.env.JIRA_WEBHOOK_SECRET;
const signature = req.headers['x-hub-signature'];

if (webhookSecret && signature !== webhookSecret) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

## Usage Examples

### Example 1: Sync Critical Threats to Jira

```bash
curl -X POST http://localhost:5000/api/jira/sync \
  -H "Content-Type: application/json" \
  -d '{
    "threats": [
      {
        "threat_id": "threat-001",
        "threat_name": "Public RDS Instance",
        "description": "RDS instance is publicly accessible",
        "severity": "critical",
        "risk_score": 9.2,
        "likelihood": "high",
        "category": "Network Exposure",
        "resource_id": "aws_db_instance.main",
        "resource_type": "aws_db_instance",
        "cloud_provider": "AWS",
        "mitigations": [
          {
            "description": "Disable public accessibility",
            "effort": "low",
            "impact": "high",
            "steps": [
              "aws rds modify-db-instance --db-instance-identifier mydb --no-publicly-accessible"
            ]
          }
        ]
      }
    ],
    "create_new": true
  }'
```

### Example 2: Update Threat Status in Jira

```bash
curl -X POST http://localhost:5000/api/jira/update-status \
  -H "Content-Type: application/json" \
  -d '{
    "threat_id": "threat-001",
    "status": "Done"
  }'
```

### Example 3: Get Jira Report

```bash
curl http://localhost:5000/api/jira/report
```

### Example 4: Sync Statuses from Jira

```bash
curl -X POST http://localhost:5000/api/jira/sync-status \
  -H "Content-Type: application/json" \
  -d '{
    "threat_ids": ["threat-001", "threat-002", "threat-003"]
  }'
```

## Integration with CI/CD

### GitHub Actions

Add to `.github/workflows/threat-analysis.yml`:

```yaml
- name: Sync Critical Threats to Jira
  if: steps.parse.outputs.critical_count > 0
  env:
    JIRA_HOST: ${{ secrets.JIRA_HOST }}
    JIRA_USERNAME: ${{ secrets.JIRA_USERNAME }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_PROJECT_KEY: ${{ secrets.JIRA_PROJECT_KEY }}
  run: |
    # Filter critical threats
    jq '[.threats[] | select(.severity == "critical")]' threat-analysis-results.json > critical-threats.json
    
    # Sync to Jira
    curl -X POST http://localhost:5000/api/jira/sync \
      -H "Content-Type: application/json" \
      -d @critical-threats.json
```

### Automated Workflow

```bash
#!/bin/bash
# Auto-sync threats to Jira after analysis

# Run threat analysis
python backend/analysis/app.py analyze

# Extract critical and high severity threats
jq '[.threats[] | select(.severity == "critical" or .severity == "high")]' \
  results.json > high-priority-threats.json

# Sync to Jira
curl -X POST http://localhost:5000/api/jira/sync \
  -H "Content-Type: application/json" \
  -d @high-priority-threats.json

echo "✅ Synced high-priority threats to Jira"
```

## Error Handling

### Common Errors

**Authentication Failed (401)**
```json
{
  "error": "Jira authentication failed",
  "message": "Check credentials."
}
```
- Verify `JIRA_USERNAME` and `JIRA_API_TOKEN`
- Ensure API token is not expired

**Rate Limit (429)**
```json
{
  "error": "Jira rate limit exceeded",
  "message": "Please try again later."
}
```
- Jira has rate limits: ~100 requests/minute
- Service includes retry logic with exponential backoff

**Project Not Found (404)**
```json
{
  "error": "Jira resource not found"
}
```
- Verify `JIRA_PROJECT_KEY` exists
- Ensure user has access to project

### Retry Logic

Service automatically retries on:
- 5xx server errors (3 attempts)
- 429 rate limit errors (3 attempts)
- Network timeouts (3 attempts)

## Best Practices

### 1. Prioritize Critical Threats
Only sync critical and high severity threats automatically:
```javascript
const criticalThreats = threats.filter(t => 
  t.severity === 'critical' || t.severity === 'high'
);
await jiraClient.bulkCreateIssues(criticalThreats);
```

### 2. Avoid Duplicates
Service tracks threat-issue mappings in `backend/data/jira-threat-mapping.json`

### 3. Rate Limiting
Service includes 500ms delay between bulk operations

### 4. Webhook Security
Use webhook secret to validate requests from Jira

### 5. Monitoring
Monitor Jira integration status:
```bash
curl http://localhost:5000/api/jira/status
```

## Troubleshooting

### Issue: Jira integration not configured

**Solution:**
```bash
# Check environment variables
env | grep JIRA

# Test Jira connection
curl -u "your-email:your-api-token" \
  https://your-company.atlassian.net/rest/api/3/myself
```

### Issue: Cannot create issues in project

**Solution:**
- Verify user has "Create Issues" permission in project
- Check project exists and is accessible
- Ensure `JIRA_PROJECT_KEY` is correct

### Issue: Webhook not receiving events

**Solution:**
- Verify webhook URL is publicly accessible
- Check webhook logs in Jira: Settings → System → WebHooks
- Test webhook manually:
```bash
curl -X POST http://your-app/api/jira/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhookEvent": "jira:issue_updated",
    "issue": {
      "key": "SEC-101",
      "fields": {
        "status": {"name": "Done"},
        "labels": ["threat"]
      }
    }
  }'
```

### Issue: Description formatting incorrect

**Solution:**
- Jira uses Atlassian Document Format (ADF)
- Service converts Markdown-like text to ADF
- For complex formatting, customize `generateDescription()` method

## Security Considerations

### API Token Security
- Store API token in environment variables, never in code
- Use secret management (AWS Secrets Manager, Vault)
- Rotate API tokens regularly

### Webhook Security
- Use HTTPS only
- Implement webhook signature validation
- Whitelist Jira IP addresses

### Data Privacy
- Threat descriptions may contain sensitive data
- Use Jira's security levels if needed
- Restrict project access appropriately

## Advanced Configuration

### Custom Issue Type

To use "Security Task" instead of "Task":

```typescript
issuetype: {
  name: 'Security Task', // Custom issue type
}
```

Ensure "Security Task" exists in your Jira project settings.

### Custom Fields

Add custom fields to issues:

```typescript
fields: {
  // ... standard fields
  customfield_10050: threat.risk_score, // Risk Score custom field
  customfield_10051: threat.cloud_provider, // Cloud Provider
}
```

Find custom field IDs:
```bash
curl -u "email:token" \
  https://your-company.atlassian.net/rest/api/3/field | jq
```

### SLA Tracking

Track threat resolution SLAs:

```typescript
// Add SLA custom field
fields: {
  customfield_10060: {
    ongoingCycle: {
      goalDuration: threat.severity === 'critical' ? 86400000 : 604800000, // 1 day or 7 days
    }
  }
}
```

## Performance

- **Issue Creation**: ~500ms per issue
- **Bulk Creation**: ~1 second per issue (with rate limiting)
- **Status Sync**: ~200ms per threat
- **Report Generation**: ~2-5 seconds for 1000 issues

## Future Enhancements

- [ ] JIRA Data Center support
- [ ] Custom transition workflows
- [ ] Attachment upload (threat reports, diagrams)
- [ ] Comment synchronization
- [ ] Epic/Parent issue linking
- [ ] Custom field mapping configuration
- [ ] JIRA Service Management integration
- [ ] Automated remediation tracking
- [ ] SLA violation alerts
- [ ] Board/Sprint integration

## Support

For issues or questions:
- Check logs: `tail -f backend/logs/jira-integration.log`
- Test connectivity: `GET /api/jira/status`
- Review Jira API docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/

## References

- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
- [Jira Webhooks](https://developer.atlassian.com/server/jira/platform/webhooks/)
- [API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
