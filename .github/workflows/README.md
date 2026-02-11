# GitHub Actions Workflows

This directory contains automated workflows for the Threat Modeling Platform.

## Workflows

### release.yml

Automatic release creation and package distribution.

**Triggers:**
- Push to `main` branch (excluding docs/** and *.md files)
- Manual dispatch via GitHub Actions UI (allows custom version)

**What it does:**
1. Auto-increments semantic version (v1.0.0 → v1.0.1)
2. Creates release archives (.tar.gz for Linux/macOS, .zip for Windows)
3. Packages installer scripts, Docker configs, and documentation
4. Generates comprehensive release notes with changelog
5. Creates SHA256 checksums for verification
6. Creates Git tag and pushes to repository
7. Publishes GitHub Release with downloadable assets

**Packaged Files:**
- Installation: `install.sh`, `install.ps1`, `install.bat`, `setup.sh`
- Docker: `docker-compose.yml`, `docker-compose.dev.yml`
- Configuration: `.env.example`
- Documentation: `README.md`, `QUICKSTART.md`, `IMPLEMENTATION_COMPLETE.md`
- Validation: `validate-config.sh`, `verify-installation.sh`
- Infrastructure: `infra/` directory

**Manual Release:**
1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Enter version (e.g., `v2.0.0`)
4. Choose if pre-release
5. Click "Run workflow"

**Download URL:**
- Latest: `https://github.com/ishikawatachi/Tenjun/releases/latest`
- Specific: `https://github.com/ishikawatachi/Tenjun/releases/tag/v1.0.0`

### threat-analysis.yml

Automatic threat analysis on infrastructure changes.

**Triggers:**
- Push to `main` or `develop` branches
- Pull request creation, synchronization, or reopening
- Only runs when relevant files change (Terraform, dependencies)

**What it does:**
1. Checks out repository code
2. Sets up Node.js and Python environments
3. Starts threat model API (local Docker or remote)
4. Downloads threat database
5. Detects changed files
6. Runs threat analysis on infrastructure changes
7. Parses results and extracts metrics
8. Comments on PR with threat summary
9. Creates GitHub Issues for critical threats
10. Generates HTML and JSON reports
11. Uploads reports as artifacts
12. Commits threat model to repository (on main branch)
13. Optionally fails build if critical threats found

## Configuration

### Environment Variables

Set these in your repository settings under **Settings → Secrets and variables → Actions**.

#### Required Secrets

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

#### Optional Secrets

- `THREAT_MODEL_API_URL` - URL of remote threat model API
  - Default: `http://localhost:5000` (uses Docker Compose)
  - Example: `https://threat-model.example.com`

- `THREAT_DB_URL` - URL to download threat database
  - If not set, uses bundled database

#### Optional Variables

- `FAIL_ON_CRITICAL_THREATS` - Fail CI if critical threats found
  - Values: `true` or `false`
  - Default: `false`

### GitHub Enterprise

For GitHub Enterprise deployments, update the `GITHUB_API_URL` in `create-github-issues.js`:

```javascript
const GITHUB_API_URL = process.env.GITHUB_API_URL || 'https://github.yourcompany.com/api/v3';
```

## Usage

### Local Development

Test the threat analysis locally:

```bash
# Run threat analysis script
./scripts/run-threat-analysis.sh

# Create GitHub issues (requires GITHUB_TOKEN)
export GITHUB_TOKEN="your_token"
export GITHUB_REPOSITORY="owner/repo"
node ./scripts/create-github-issues.js

# Generate HTML report
python3 ./scripts/generate-html-report.py threat-report.json threat-report.html
```

### Docker Compose

The workflow can start the threat model API locally using Docker Compose:

```bash
docker-compose -f docker-compose.yml up -d
```

To use a remote API instead:

```bash
# Set repository secret
gh secret set THREAT_MODEL_API_URL --body "https://threat-model.example.com"
```

### Pull Request Workflow

1. Developer pushes changes to a feature branch
2. Creates pull request
3. Workflow runs automatically
4. Comments appear on PR with threat summary
5. GitHub Issues created for critical threats
6. Developer reviews threats and implements mitigations
7. Pushes fixes
8. Workflow runs again, validates fixes
9. PR can be merged when threats are addressed

### Artifacts

Each workflow run produces artifacts:

- `threat-analysis-report-{sha}/`
  - `threat-report-{sha}.json` - JSON report
  - `threat-report-{sha}.html` - HTML report
  - `THREAT_SUMMARY.md` - Markdown summary

Download artifacts from the Actions tab.

### Threat Model History

On pushes to `main`, the workflow commits threat models to:

```
docs/threat-model/
├── latest.json              # Latest analysis
├── threat-model-20260211-143022.json
└── threat-model-20260210-091505.json
```

This provides historical tracking of security posture.

## Customization

### Change Detection

Modify the `paths` filter in `threat-analysis.yml` to analyze different file types:

```yaml
paths:
  - '**/*.tf'           # Terraform
  - '**/*.tfvars'       # Terraform variables
  - 'infra/**'          # Infrastructure directory
  - 'package*.json'     # Node.js dependencies
  - 'requirements*.txt' # Python dependencies
  - 'Dockerfile'        # Docker files
  - '.github/**'        # GitHub Actions
```

### Fail on Critical Threats

To enforce security standards, fail the build if critical threats are found:

```bash
gh variable set FAIL_ON_CRITICAL_THREATS --body "true"
```

Or set in workflow file:

```yaml
env:
  FAIL_ON_CRITICAL: 'true'
```

### Issue Labels

Customize issue labels in `create-github-issues.js`:

```javascript
const ISSUE_LABELS = ['security', 'threat-model', 'critical', 'compliance'];
```

### Notification Channels

Extend the workflow to send notifications:

```yaml
- name: Send Slack Notification
  if: steps.parse-results.outputs.critical_threats > 0
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Critical threats detected in ${{ github.repository }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Troubleshooting

### Workflow Not Triggering

Check:
- Branch name matches trigger configuration
- File changes match `paths` filter
- Workflow file is in `.github/workflows/`
- Workflow is enabled in repository settings

### API Connection Failed

Check:
- Docker Compose started successfully
- API health endpoint returns 200
- `THREAT_MODEL_API_URL` is correct
- Network connectivity

### Permission Denied

Check:
- `GITHUB_TOKEN` has required permissions
- Repository settings allow Actions
- Scripts are executable (`chmod +x`)

### No Threats Detected

Check:
- Terraform files exist in changed files
- Threat database is loaded
- API is analyzing files correctly
- Review API logs

## Security Considerations

### Token Scopes

The `GITHUB_TOKEN` requires these permissions:
- `contents: write` - Commit threat models
- `pull-requests: write` - Comment on PRs
- `issues: write` - Create issues

### Private Repositories

The workflow works in private repositories. The threat analysis data never leaves your infrastructure when using local Docker mode.

### Sensitive Data

Be cautious about:
- Terraform state files (excluded by default)
- Secrets in code (use GitHub Secrets)
- API URLs (use secrets)

## Performance

### Optimization Tips

1. **Use Remote API**: Faster than starting Docker containers
2. **Cache Dependencies**: Node.js and Python caches enabled
3. **Analyze Changed Files Only**: Default behavior
4. **Parallel Analysis**: Future enhancement

### Timeout

Default timeout is 15 minutes. Adjust in workflow:

```yaml
jobs:
  threat-analysis:
    timeout-minutes: 30
```

## Maintenance

### Update Dependencies

```bash
# Update actions
# Check for new versions at https://github.com/actions

# Update Node.js packages
npm update

# Update Python packages
pip install --upgrade -r requirements.txt
```

### Threat Database Updates

Update the threat database regularly:

```bash
# Pull latest threat rules
git pull origin main

# Or download from URL
curl -L https://threat-db.example.com/latest.tar.gz -o threat-db.tar.gz
```

## Support

For issues or questions:
1. Check workflow logs in Actions tab
2. Review troubleshooting section
3. Open issue in repository
4. Contact platform maintainers
