# Jira Integration Setup

This README provides step-by-step instructions for integrating Jira with the Threat Model Platform.

## Overview

The Jira integration automatically creates and manages Jira issues for identified threats, enabling seamless tracking and remediation workflows.

## Features

✅ **Auto-create Jira issues** for critical and high severity threats  
✅ **Bidirectional sync** - update Jira from threats, sync status from Jira  
✅ **Rich issue details** - mitigations, compliance mappings, references  
✅ **Smart labeling** - automatic labels based on severity, cloud provider, resource type  
✅ **Status mapping** - threat status ↔ Jira workflow transitions  
✅ **Webhook support** - real-time updates when Jira issues change  
✅ **Threat reports** - analytics and trends from Jira data  
✅ **Rate limiting** - built-in retry logic and error handling  

## Quick Start

### 1. Prerequisites

- Jira Cloud account
- Admin access to create API tokens
- Project with appropriate permissions

### 2. Get API Token

Visit: https://id.atlassian.com/manage-profile/security/api-tokens

Click "Create API token" and save it securely.

### 3. Configure

```bash
# Copy environment template
cp .env.jira.example .env

# Edit with your credentials
nano .env
```

Required environment variables:
```env
JIRA_HOST=company.atlassian.net
JIRA_USERNAME=you@company.com
JIRA_API_TOKEN=your-token-here
JIRA_PROJECT_KEY=SEC
```

### 4. Install Dependencies

```bash
npm install
```

This installs:
- `axios` - HTTP client for Jira API
- TypeScript types and testing tools

### 5. Add Routes to Server

If using Express, add to your `api/server.js`:

```javascript
import jiraRoutes from '../routes/jira.routes.js';

// Add Jira routes
app.use('/api/jira', jiraRoutes);
```

### 6. Test

```bash
# Start server
npm start

# Test configuration
curl http://localhost:5000/api/jira/status

# Run integration tests
./scripts/test-jira-integration.sh
```

## Architecture

```
┌─────────────────┐
│  Threat Model   │
│   Platform      │
└────────┬────────┘
         │
         │ API calls
         ▼
┌─────────────────────┐
│  JiraClient Service │
│  - createIssue()    │
│  - updateIssue()    │
│  - syncStatus()     │
└────────┬────────────┘
         │
         │ REST API (v3)
         ▼
┌─────────────────────┐
│   Jira Cloud API    │
│  - Issues           │
│  - Transitions      │
│  - Search           │
└─────────────────────┘
         ▲
         │ Webhooks
         │
┌─────────────────────┐
│  Jira Webhook       │
│  Handler            │
└─────────────────────┘
```

## Usage

### Create Issue from Threat

```bash
curl -X POST http://localhost:5000/api/jira/sync \
  -H "Content-Type: application/json" \
  -d '{
    "threats": [{
      "threat_id": "threat-001",
      "threat_name": "Public RDS Instance",
      "severity": "critical",
      "description": "Database is publicly accessible",
      "risk_score": 9.2,
      "resource_type": "aws_db_instance",
      "cloud_provider": "AWS"
    }],
    "create_new": true
  }'
```

### Update Issue Status

```bash
curl -X POST http://localhost:5000/api/jira/update-status \
  -H "Content-Type: application/json" \
  -d '{
    "threat_id": "threat-001",
    "status": "Done"
  }'
```

### Get Threat Report

```bash
curl http://localhost:5000/api/jira/report | jq
```

### Sync Status from Jira

```bash
curl -X POST http://localhost:5000/api/jira/sync-status \
  -H "Content-Type: application/json" \
  -d '{
    "threat_ids": ["threat-001", "threat-002"]
  }'
```

## Files Created

```
backend/
├── services/
│   └── jira.service.ts              (716 lines) - Core Jira client
├── controllers/
│   └── jiraIntegration.controller.ts (478 lines) - API endpoints
├── routes/
│   └── jira.routes.ts                (75 lines) - Route definitions
├── tests/
│   └── integration/
│       └── jira.test.ts              (460 lines) - Integration tests
├── docs/
│   ├── JIRA_INTEGRATION.md           (616 lines) - Full documentation
│   └── JIRA_QUICK_START.md           (150 lines) - Quick start guide
├── .env.jira.example                 - Environment template
├── tsconfig.json                     - TypeScript config
└── package.json                      - Updated dependencies

scripts/
└── test-jira-integration.sh          (250 lines) - Test script

Total: ~2,745 lines of code and documentation
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jira/status` | Check Jira configuration |
| POST | `/api/jira/sync` | Create/update Jira issues |
| GET | `/api/jira/issues` | Get threat issues |
| POST | `/api/jira/webhook` | Handle Jira webhooks |
| POST | `/api/jira/update-status` | Update issue status |
| GET | `/api/jira/report` | Generate threat report |
| POST | `/api/jira/sync-status` | Sync statuses from Jira |

## Testing

### Run Integration Tests

```bash
npm test tests/integration/jira.test.ts
```

Tests cover:
- Issue creation
- Issue updates
- Status transitions
- Bulk operations
- Error handling
- Retry logic
- Priority mapping

### Run Full Test Script

```bash
./scripts/test-jira-integration.sh
```

This tests:
1. Configuration check
2. Issue creation
3. Issue retrieval
4. Status updates
5. Report generation
6. Status sync

## Webhook Setup

### 1. Create Webhook in Jira

Go to: **Settings** → **System** → **WebHooks** → **Create a WebHook**

Configure:
- **Name**: Threat Platform Integration
- **Status**: Enabled
- **URL**: `https://your-platform.com/api/jira/webhook`
- **Events**: ☑ Issue → updated
- **JQL Filter**: `project = SEC AND labels = threat`

### 2. Test Webhook

```bash
# Simulate webhook event
curl -X POST http://localhost:5000/api/jira/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhookEvent": "jira:issue_updated",
    "issue": {
      "key": "SEC-101",
      "fields": {
        "status": {"name": "Done"},
        "labels": ["threat", "critical"]
      }
    }
  }'
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Sync Critical Threats to Jira
  if: steps.analyze.outputs.critical_count > 0
  env:
    JIRA_HOST: ${{ secrets.JIRA_HOST }}
    JIRA_USERNAME: ${{ secrets.JIRA_USERNAME }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_PROJECT_KEY: SEC
  run: |
    # Filter critical threats
    jq '[.threats[] | select(.severity == "critical")]' \
      threat-results.json > critical-threats.json
    
    # Sync to Jira
    curl -X POST http://localhost:5000/api/jira/sync \
      -H "Content-Type: application/json" \
      -d @critical-threats.json
```

## Best Practices

1. **Only sync critical/high threats** to avoid noise
2. **Use labels effectively** for filtering and reporting
3. **Set up webhooks** for real-time status sync
4. **Monitor rate limits** - Jira allows ~100 requests/minute
5. **Secure API tokens** - use secret management
6. **Test in staging** before production rollout

## Troubleshooting

### Issue: "Jira integration not configured"

**Solution:**
```bash
# Check environment variables
env | grep JIRA

# Test credentials
curl -u "email:token" \
  https://company.atlassian.net/rest/api/3/myself
```

### Issue: "Cannot create issues"

**Solution:**
- Verify project exists: Check `JIRA_PROJECT_KEY`
- Check permissions: Ensure "Create Issues" permission
- Test API access: Use curl with credentials

### Issue: "Rate limit exceeded"

**Solution:**
- Service includes retry logic (3 attempts)
- Add delays between bulk operations
- Consider caching Jira responses

## Security

- **API Tokens**: Store in environment variables, never commit
- **Webhook Secret**: Validate webhook signatures
- **HTTPS Only**: All API calls use HTTPS
- **Private Repos**: Jira issues may contain sensitive data
- **Token Rotation**: Rotate API tokens regularly

## Performance

- **Issue Creation**: ~500ms per issue
- **Bulk Creation**: ~1s per issue (with rate limiting)
- **Status Sync**: ~200ms per threat
- **Report Generation**: 2-5s for 1000 issues

## Documentation

- **Quick Start**: [JIRA_QUICK_START.md](docs/JIRA_QUICK_START.md)
- **Full Documentation**: [JIRA_INTEGRATION.md](docs/JIRA_INTEGRATION.md)
- **API Reference**: [routes/jira.routes.ts](routes/jira.routes.ts)

## Support

For issues:
1. Check logs: `tail -f logs/jira-integration.log`
2. Test connection: `GET /api/jira/status`
3. Review docs: [JIRA_INTEGRATION.md](docs/JIRA_INTEGRATION.md)
4. Run tests: `npm test`

## Next Steps

1. ✅ Configure Jira credentials
2. ✅ Test API endpoints
3. ✅ Set up webhooks
4. ✅ Integrate with CI/CD
5. ✅ Monitor and refine

## References

- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- [Jira Webhooks](https://developer.atlassian.com/server/jira/platform/webhooks/)
