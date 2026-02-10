# GitHub Integration Module

Complete GitHub integration for the Threat Modeling Platform with webhook support, repository analysis, and automated threat detection.

## Features

### 1. GitHub API Client
- **Multi-Platform Support**: Works with github.com and GitHub Enterprise
- **Authentication**: OAuth 2.0 and Personal Access Tokens
- **Rate Limit Handling**: Automatic retry with exponential backoff
- **Concurrent Operations**: Clone multiple repositories in parallel

### 2. Repository Analyzer
- **Smart Cloning**: Shallow clones with configurable depth
- **File Categorization**: Infrastructure, code, and config files
- **Dependency Extraction**: npm, Python, Go, Maven packages
- **Checksums**: SHA256 for all files

### 3. Webhook Handler
- **HMAC-SHA256 Verification**: Secure webhook signature validation
- **Event Processing**: Push, Pull Request, Issues
- **Automated Analysis**: Trigger threat analysis on code changes
- **PR Comments**: Post findings directly on pull requests
- **Issue Creation**: Automatically create GitHub issues for threats

## File Structure

```
src/
├── services/
│   ├── github.service.ts       # GitHub API client
│   └── webhookService.ts       # Webhook event processing
├── controllers/
│   └── webhookController.ts    # Webhook HTTP handlers
├── routes/
│   └── webhook.routes.ts       # Webhook API routes
└── utils/
    └── gitOperations.ts        # Git operations and repo analysis
```

## Configuration

### Environment Variables

```bash
# GitHub Integration
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_ENTERPRISE_URL=https://github.company.com  # Optional, for Enterprise
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### Generate Webhook Secret

```bash
# Generate a secure webhook secret
openssl rand -hex 32
```

## API Endpoints

### Webhook Endpoints

#### POST /api/webhooks/github
Receives GitHub webhook events (push, pull_request, etc.)

**Headers:**
- `X-Hub-Signature-256`: HMAC-SHA256 signature
- `X-GitHub-Event`: Event type (push, pull_request, etc.)
- `X-GitHub-Delivery`: Unique delivery ID

**Response:**
```json
{
  "status": "accepted",
  "message": "Webhook received and queued for processing",
  "deliveryId": "12345"
}
```

#### GET /api/webhooks/stats
Get webhook statistics and recent events (authenticated)

**Response:**
```json
{
  "status": "success",
  "data": {
    "statistics": [
      { "action": "WEBHOOK_RECEIVED", "count": 45 },
      { "action": "WEBHOOK_PROCESSED", "count": 43 }
    ],
    "recent": [
      {
        "resource_id": "uuid",
        "action": "WEBHOOK_PROCESSED",
        "details": "Event: push",
        "timestamp": "2026-02-10T12:00:00Z"
      }
    ]
  }
}
```

#### POST /api/webhooks/trigger-analysis
Manually trigger repository analysis (authenticated)

**Request:**
```json
{
  "repository_url": "https://github.com/owner/repo",
  "branch": "main"
}
```

#### POST /api/webhooks/create-issue
Create GitHub issue for a threat (authenticated)

**Request:**
```json
{
  "threat_id": "uuid-of-threat",
  "repository": "owner/repo"
}
```

## GitHub Webhook Setup

### 1. Configure Webhook in GitHub

Go to your repository → Settings → Webhooks → Add webhook

**Payload URL:** `https://your-domain.com/api/webhooks/github`  
**Content type:** `application/json`  
**Secret:** Your generated webhook secret  
**Events:** Select:
- Push events
- Pull requests
- Issues (optional)

### 2. Test Webhook

```bash
# Send test webhook
curl -X POST http://localhost:3000/api/webhooks/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "ping",
    "payload": {
      "repository": {
        "full_name": "test/repo",
        "clone_url": "https://github.com/test/repo.git",
        "default_branch": "main"
      },
      "sender": {
        "login": "testuser",
        "id": 123
      }
    }
  }'
```

## Usage Examples

### JavaScript/TypeScript

#### Initialize GitHub Client

```typescript
import { createGitHubClient } from './services/github.service';

const client = createGitHubClient(
  process.env.GITHUB_TOKEN,
  process.env.GITHUB_ENTERPRISE_URL
);
```

#### Clone and Analyze Repository

```typescript
const { analysis, localPath } = await client.cloneAndAnalyzeRepository(
  'https://github.com/owner/repo.git',
  { branch: 'main', depth: 1 }
);

console.log('Total files:', analysis.statistics.totalFiles);
console.log('Infrastructure files:', analysis.files.infrastructure.length);
console.log('Dependencies:', analysis.dependencies);

// Clean up
await cleanupRepository(localPath);
```

#### Analyze Multiple Repositories

```typescript
const repos = [
  'https://github.com/org/repo1.git',
  'https://github.com/org/repo2.git',
  'https://github.com/org/repo3.git',
];

const results = await client.cloneAndAnalyzeMultiple(repos, 3);

for (const [url, analysis] of results) {
  console.log(`${url}: ${analysis.statistics.totalFiles} files`);
}
```

#### Create GitHub Issue

```typescript
const issue = await client.createIssue('owner', 'repo', {
  title: '[Security] SQL Injection Vulnerability',
  body: 'Found potential SQL injection in login endpoint...',
  labels: ['security', 'severity:high'],
});

console.log('Issue created:', issue.html_url);
```

#### Comment on Pull Request

```typescript
await client.createComment('owner', 'repo', 42, {
  body: '## Security Analysis\n\nFound 3 potential threats...',
});
```

### Git Operations

#### Clone Repository

```typescript
import { gitClone, analyzeRepository } from './utils/gitOperations';

await gitClone(
  'https://github.com/owner/repo.git',
  '/tmp/repos/my-repo',
  {
    branch: 'develop',
    depth: 1,
    singleBranch: true,
    timeout: 300000,
  }
);
```

#### Analyze Repository

```typescript
const analysis = await analyzeRepository(
  'https://github.com/owner/repo.git',
  '/tmp/repos/my-repo'
);

// Infrastructure files (Terraform, YAML, JSON)
console.log('Terraform files:', analysis.files.infrastructure.filter(f => f.extension === '.tf'));

// Code files
console.log('Python files:', analysis.files.code.filter(f => f.extension === '.py'));

// Dependencies
console.log('NPM packages:', analysis.dependencies.npm);
console.log('Python packages:', analysis.dependencies.python);
```

#### Get File List

```typescript
import { getFileList } from './utils/gitOperations';

// Get only Terraform files
const tfFiles = await getFileList('/tmp/repos/my-repo', ['.tf', '.tfvars']);

// Get all files
const allFiles = await getFileList('/tmp/repos/my-repo');

for (const file of tfFiles) {
  console.log(`${file.relativePath}: ${file.size} bytes, checksum: ${file.checksum}`);
}
```

## Webhook Event Processing

### Supported Events

#### Push Event
Triggers when code is pushed to a branch.

**Actions:**
- Creates threat model if not exists
- Analyzes main/master branch only
- Updates existing threat model

#### Pull Request Event
Triggers on PR open or update.

**Actions:**
- Creates threat model if not exists
- Analyzes PR branch
- Posts comment with findings on PR

#### Ping Event
GitHub webhook test event.

**Actions:**
- Logs receipt
- No processing

### Webhook Flow

```
GitHub Event → Webhook Endpoint → Signature Verification
                                         ↓
                                  Store Event in DB
                                         ↓
                                  Process Event (Async)
                                         ↓
                          ┌──────────────┴──────────────┐
                          ↓                             ↓
                    Push Event                    PR Event
                          ↓                             ↓
              Clone & Analyze Repo          Clone & Analyze Branch
                          ↓                             ↓
                  Create/Update Model            Post PR Comment
                          ↓                             ↓
                   Trigger Analysis              Create Issues
```

## Error Handling

### Network Errors
- Automatic retry with exponential backoff (3 attempts)
- Configurable timeouts
- Rate limit detection and waiting

### Git Errors
- Detailed error logging
- Cleanup on failure
- Timeout handling (default 5 minutes)

### Webhook Errors
- Invalid signature → 401 Unauthorized
- Missing headers → 400 Bad Request
- Processing errors → Logged, webhook marked as failed

## Rate Limiting

### GitHub API Limits
- **github.com**: 5,000 requests/hour (authenticated)
- **Enterprise**: Varies by installation

### Handling
```typescript
const rateLimit = client.getRateLimit();
console.log('Remaining:', rateLimit.remaining);
console.log('Resets at:', rateLimit.reset);

// Client automatically waits when rate limit exceeded
```

## Security Considerations

### 1. Webhook Signature Verification
Always verify HMAC-SHA256 signature:
```typescript
const isValid = webhookService.verifySignature(payload, signature, secret);
```

### 2. Token Storage
- Store tokens in environment variables
- Never commit tokens to git
- Rotate tokens regularly
- Use read-only tokens when possible

### 3. Repository Access
- Limit token permissions
- Clone to temporary directories
- Clean up after analysis
- Restrict file access (0600)

### 4. Input Validation
- Validate repository URLs
- Sanitize file paths
- Check file sizes before reading

## Monitoring & Logging

### Log Events
- Webhook received
- Webhook processed/failed
- Repository cloned
- Analysis completed
- Issue created
- Comment posted

### Audit Trail
All webhook events stored in `audit_logs` table:
```sql
SELECT * FROM audit_logs 
WHERE resource_type = 'github_webhook' 
ORDER BY timestamp DESC;
```

### Metrics to Monitor
- Webhook processing time
- Clone success rate
- Analysis completion rate
- GitHub API rate limit usage
- Disk space usage (/tmp/github-repos)

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook configuration in GitHub**
   - Verify payload URL is correct
   - Check "Recent Deliveries" for errors
   - Ensure secret matches

2. **Check server logs**
   ```bash
   grep "GitHub webhook" logs/app.log
   ```

3. **Test webhook endpoint**
   ```bash
   curl -X POST https://your-domain/api/webhooks/github \
     -H "X-GitHub-Event: ping" \
     -H "X-GitHub-Delivery: test-123" \
     -H "X-Hub-Signature-256: sha256=..." \
     -d '{"zen":"Keep it simple"}'
   ```

### Failed Repository Clone

1. **Check token permissions**
2. **Verify repository exists and is accessible**
3. **Check disk space in /tmp**
4. **Review git clone timeout settings**

### Rate Limit Issues

1. **Check rate limit status**
   ```typescript
   const limit = client.getRateLimit();
   ```

2. **Increase spacing between requests**
3. **Consider using multiple tokens**
4. **Use GitHub Enterprise if available**

## Best Practices

1. **Use shallow clones** (`depth: 1`) for faster analysis
2. **Clean up** cloned repositories immediately after analysis
3. **Batch process** multiple repositories with concurrency limits
4. **Monitor disk space** in temporary directories
5. **Set appropriate timeouts** for clone operations
6. **Validate inputs** before processing
7. **Log all operations** for audit trail
8. **Handle rate limits** gracefully
9. **Test webhooks** in development before production
10. **Rotate tokens** regularly

## Performance Optimization

### Concurrent Operations
```typescript
// Clone 3 repos at once
const results = await client.cloneAndAnalyzeMultiple(repoUrls, 3);
```

### Shallow Clones
```typescript
// Only clone latest commit
await gitClone(url, path, { depth: 1, singleBranch: true });
```

### File Filtering
```typescript
// Only get specific file types
const infraFiles = await getFileList(path, ['.tf', '.yaml', '.json']);
```

### Cleanup Strategy
```typescript
// Clean up old repos periodically
cron.schedule('0 * * * *', async () => {
  await cleanupOldRepos('/tmp/github-repos', maxAge);
});
```

## Future Enhancements

- [ ] Support for GitLab and Bitbucket webhooks
- [ ] Incremental analysis (only changed files)
- [ ] Repository caching
- [ ] Parallel file processing
- [ ] Custom analysis rules per repository
- [ ] Integration with CI/CD pipelines
- [ ] GitHub Actions integration
- [ ] Advanced dependency vulnerability scanning
- [ ] SBOM (Software Bill of Materials) generation

## License

MIT
