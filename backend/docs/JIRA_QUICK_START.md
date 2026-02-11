# Jira Integration - Quick Start Guide

Get started with Jira integration in 5 minutes.

## 1. Generate Jira API Token

1. Visit: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Name: "Threat Platform Integration"
4. Click **Create**
5. **Copy the token** (you won't see it again!)

## 2. Configure Environment

```bash
cd backend
cp .env.jira.example .env
```

Edit `.env`:
```env
JIRA_HOST=your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token-from-step-1
JIRA_PROJECT_KEY=SEC
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Test Connection

```bash
# Start your API server
npm start

# In another terminal, test Jira status
curl http://localhost:5000/api/jira/status
```

Expected output:
```json
{
  "configured": true,
  "host": "your-company.atlassian.net",
  "project_key": "SEC",
  "username": "***"
}
```

## 5. Sync Your First Threat

```bash
curl -X POST http://localhost:5000/api/jira/sync \
  -H "Content-Type: application/json" \
  -d '{
    "threats": [{
      "threat_id": "test-001",
      "threat_name": "Public S3 Bucket",
      "description": "S3 bucket allows public access",
      "severity": "critical",
      "risk_score": 9.5,
      "likelihood": "high",
      "category": "Data Exposure",
      "resource_id": "aws_s3_bucket.data",
      "resource_type": "aws_s3_bucket",
      "cloud_provider": "AWS"
    }],
    "create_new": true
  }'
```

## 6. Check Jira

Visit your Jira project: `https://your-company.atlassian.net/projects/SEC`

You should see a new issue: **[CRITICAL] Public S3 Bucket**

## 7. Run Full Test Suite

```bash
./scripts/test-jira-integration.sh
```

## What's Next?

### Set Up Webhooks
Configure Jira to sync status updates back to your platform:

1. Go to **Settings** → **System** → **WebHooks**
2. Click **Create a WebHook**
3. Configure:
   - URL: `https://your-platform.com/api/jira/webhook`
   - Events: Issue → updated
   - JQL: `project = SEC AND labels = threat`

### Integrate with CI/CD
Add to your GitHub Actions workflow:

```yaml
- name: Sync Critical Threats to Jira
  run: |
    curl -X POST http://localhost:5000/api/jira/sync \
      -H "Content-Type: application/json" \
      -d @threat-results.json
```

### Customize Issue Fields
Edit [jira.service.ts](../services/jira.service.ts) to add custom fields:

```typescript
fields: {
  // Add custom fields
  customfield_10050: threat.risk_score,
  customfield_10051: threat.cloud_provider
}
```

## Troubleshooting

**❌ "Jira integration not configured"**
- Check environment variables: `env | grep JIRA`
- Verify API token is correct

**❌ "Authentication failed (401)"**
- Verify username is your email address
- Regenerate API token if expired

**❌ "Project not found (404)"**
- Verify project key exists
- Ensure you have access to the project

**❌ "Cannot create issues"**
- Check your Jira permissions
- Verify you have "Create Issues" permission

## Full Documentation

See [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md) for complete documentation.

## API Endpoints

All endpoints available at: `http://localhost:5000/api/jira`

- `GET /status` - Check configuration
- `POST /sync` - Create/update issues
- `GET /issues` - Get threat issues
- `POST /update-status` - Update issue status
- `GET /report` - Generate threat report
- `POST /sync-status` - Sync from Jira
- `POST /webhook` - Webhook handler

## Support

Need help? Check:
- Full docs: [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md)
- Logs: `tail -f backend/logs/jira-integration.log`
- Test script: `./scripts/test-jira-integration.sh`
