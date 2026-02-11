# CI/CD Integration Guide

Complete guide for integrating the Threat Modeling Platform into your CI/CD pipelines.

## Overview

The Threat Modeling Platform can be integrated into your continuous integration and deployment pipelines to automatically analyze infrastructure changes for security threats before they reach production.

## Supported CI/CD Platforms

- ✅ **GitHub Actions** (Native support)
- ✅ **GitLab CI** (Coming soon)
- ✅ **Jenkins** (Pipeline script available)
- ✅ **Azure DevOps** (YAML pipeline)
- ✅ **CircleCI** (Config available)
- ✅ **Travis CI** (Compatible)

## GitHub Actions

### Quick Start

1. **Copy Workflow File**

```bash
# Copy the threat analysis workflow
cp .github/workflows/threat-analysis.yml .github/workflows/
```

2. **Configure Secrets**

Go to **Settings → Secrets and variables → Actions** and add:

- `THREAT_MODEL_API_URL` (optional): URL of your threat model API
- `THREAT_DB_URL` (optional): URL to download threat database

3. **Configure Variables**

Add repository variables:

- `FAIL_ON_CRITICAL_THREATS`: Set to `true` to fail builds on critical threats

4. **Commit and Push**

```bash
git add .github/workflows/threat-analysis.yml
git commit -m "Add automated threat analysis"
git push
```

### Workflow Features

#### Automatic Triggers

```yaml
on:
  push:
    branches: [main, develop]
    paths: ['**/*.tf', '**/*.tfvars', 'infra/**']
  pull_request:
    types: [opened, synchronize, reopened]
```

#### Smart File Detection

Only analyzes changed files for efficiency:

```yaml
- name: Detect Changed Files
  run: |
    git diff --name-only $BASE_REF $HEAD_REF > changed-files.txt
    grep -E '\.(tf|tfvars)$' changed-files.txt > relevant-changes.txt
```

#### PR Comments

Automatically posts threat summary to pull requests:

```markdown
## 🔒 Automated Threat Analysis Report

### Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 5 |
| 🟡 Medium | 8 |
| 🟢 Low | 3 |

### 🔴 Critical Threats
- **Public S3 Bucket** (aws_s3_bucket)...
```

#### GitHub Issues

Creates issues for critical threats:

```markdown
## Critical Security Threat Detected

- **Threat**: Public S3 Bucket
- **Severity**: CRITICAL
- **Risk Score**: 9.5
- **Resource**: aws_s3_bucket.data_bucket
```

#### Artifacts

Generates downloadable reports:
- JSON report
- HTML report
- Markdown summary

#### Threat History

Commits threat models to repository:

```
docs/threat-model/
├── latest.json
├── threat-model-20260211.json
└── threat-model-20260210.json
```

## GitLab CI

### .gitlab-ci.yml

```yaml
stages:
  - security
  - deploy

threat-analysis:
  stage: security
  image: python:3.12
  services:
    - docker:dind
  before_script:
    - apt-get update && apt-get install -y curl jq
    - pip install requests pyyaml
  script:
    - docker-compose up -d
    - sleep 10
    - ./scripts/run-threat-analysis.sh
    - |
      if [ $(jq '.statistics.by_severity.critical // 0' threat-report.json) -gt 0 ]; then
        echo "Critical threats detected!"
        exit 1
      fi
  artifacts:
    reports:
      sast: threat-report.json
    paths:
      - threat-report.json
      - threat-report.html
    expire_in: 90 days
  only:
    changes:
      - "**/*.tf"
      - "**/*.tfvars"
      - "infra/**"
```

## Jenkins

### Jenkinsfile

```groovy
pipeline {
    agent any
    
    environment {
        THREAT_MODEL_API_URL = 'http://localhost:5000'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Start API') {
            steps {
                sh 'docker-compose up -d'
                sh 'sleep 10'
            }
        }
        
        stage('Threat Analysis') {
            steps {
                sh './scripts/run-threat-analysis.sh'
                
                script {
                    def report = readJSON file: 'threat-report.json'
                    def criticalCount = report.statistics.by_severity.critical ?: 0
                    
                    if (criticalCount > 0) {
                        currentBuild.result = 'UNSTABLE'
                        error "Critical threats detected: ${criticalCount}"
                    }
                }
            }
        }
        
        stage('Archive Reports') {
            steps {
                archiveArtifacts artifacts: 'threat-report.*', fingerprint: true
                publishHTML([
                    reportDir: '.',
                    reportFiles: 'threat-report.html',
                    reportName: 'Threat Analysis Report'
                ])
            }
        }
    }
    
    post {
        always {
            sh 'docker-compose down'
        }
    }
}
```

## Azure DevOps

### azure-pipelines.yml

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - '**/*.tf'
      - '**/*.tfvars'
      - 'infra/**'

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: Docker@2
    displayName: 'Start Threat Model API'
    inputs:
      command: 'up'
      dockerComposeFile: 'docker-compose.yml'
      detached: true

  - task: Bash@3
    displayName: 'Run Threat Analysis'
    inputs:
      filePath: './scripts/run-threat-analysis.sh'
      failOnStderr: true

  - task: PublishBuildArtifacts@1
    displayName: 'Publish Threat Reports'
    inputs:
      PathtoPublish: 'threat-report.json'
      ArtifactName: 'threat-analysis'

  - task: PublishTestResults@2
    displayName: 'Publish Threat Metrics'
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: '**/threat-report.xml'
      failTaskOnFailedTests: true

  - task: CreateWorkItem@1
    condition: gt(variables['critical_threats'], 0)
    displayName: 'Create Work Items for Critical Threats'
    inputs:
      workItemType: 'Bug'
      title: 'Critical Security Threat Detected'
      areaPath: 'Security'
```

## CircleCI

### .circleci/config.yml

```yaml
version: 2.1

executors:
  threat-analyzer:
    docker:
      - image: cimg/python:3.12
    working_directory: ~/project

jobs:
  threat-analysis:
    executor: threat-analyzer
    steps:
      - checkout
      - setup_remote_docker
      
      - run:
          name: Install Dependencies
          command: |
            pip install requests pyyaml
            sudo apt-get update && sudo apt-get install -y jq
      
      - run:
          name: Start API
          command: |
            docker-compose up -d
            sleep 10
      
      - run:
          name: Run Threat Analysis
          command: ./scripts/run-threat-analysis.sh
      
      - run:
          name: Check Results
          command: |
            CRITICAL=$(jq '.statistics.by_severity.critical // 0' threat-report.json)
            if [ $CRITICAL -gt 0 ]; then
              echo "Critical threats: $CRITICAL"
              exit 1
            fi
      
      - store_artifacts:
          path: threat-report.json
          destination: reports
      
      - store_artifacts:
          path: threat-report.html
          destination: reports

workflows:
  version: 2
  security-check:
    jobs:
      - threat-analysis:
          filters:
            branches:
              only:
                - main
                - develop
```

## Docker Integration

### Local Docker Mode

The workflow automatically starts the API using Docker Compose:

```yaml
- name: Start Threat Model API (Docker)
  if: env.THREAT_MODEL_API_URL == 'http://localhost:5000'
  run: |
    docker-compose -f docker-compose.yml up -d
    timeout 120 bash -c 'until curl -f http://localhost:5000/health; do sleep 2; done'
```

### Remote API Mode

Use a hosted threat model API:

```yaml
env:
  THREAT_MODEL_API_URL: 'https://threat-model.example.com'
```

## Best Practices

### 1. Fail Fast

Detect threats early in the pipeline:

```yaml
- name: Check Threat Thresholds
  run: |
    if [ "$CRITICAL_THREATS" -gt 0 ]; then
      exit 1
    fi
```

### 2. Analyze Only Changes

For faster builds, analyze only changed files:

```bash
git diff --name-only HEAD^ HEAD | grep '\.tf$'
```

### 3. Cache Results

Cache threat database for faster runs:

```yaml
- uses: actions/cache@v3
  with:
    path: .threat-model-cache
    key: threat-db-${{ hashFiles('**/threat-db-version.txt') }}
```

### 4. Parallel Analysis

Run threat analysis in parallel with other tests:

```yaml
jobs:
  threat-analysis:
    needs: []  # No dependencies
  unit-tests:
    needs: []
  integration-tests:
    needs: [threat-analysis, unit-tests]
```

### 5. Store History

Track threat trends over time:

```bash
mkdir -p docs/threat-model
cp threat-report.json "docs/threat-model/$(date +%Y%m%d).json"
git add docs/threat-model/
git commit -m "chore: update threat model"
```

## Integration Patterns

### Pattern 1: Gate Deployment

Block deployments if critical threats exist:

```yaml
deploy:
  needs: threat-analysis
  if: success()
  steps:
    - name: Deploy to Production
      run: terraform apply
```

### Pattern 2: Warn and Continue

Allow deployment but warn about threats:

```yaml
- name: Check Threats
  continue-on-error: true
  run: |
    if [ "$CRITICAL_THREATS" -gt 0 ]; then
      echo "::warning::Critical threats detected"
    fi
```

### Pattern 3: Manual Approval

Require manual approval for critical threats:

```yaml
- name: Request Approval
  if: steps.parse-results.outputs.critical_threats > 0
  uses: trstringer/manual-approval@v1
  with:
    approvers: security-team
    minimum-approvals: 1
```

## Notifications

### Slack

```yaml
- name: Notify Slack
  if: steps.parse-results.outputs.critical_threats > 0
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🔴 Critical threats detected in ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Critical Threats*: ${{ steps.parse-results.outputs.critical_threats }}"
            }
          }
        ]
      }
```

### Email

```yaml
- name: Send Email
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    subject: Critical Threats Detected
    to: security@example.com
    from: github-actions@example.com
    body: Check workflow for details
```

### Microsoft Teams

```yaml
- name: Notify Teams
  if: steps.parse-results.outputs.critical_threats > 0
  uses: aliencube/microsoft-teams-actions@v0.8.0
  with:
    webhook_uri: ${{ secrets.TEAMS_WEBHOOK }}
    title: Threat Alert
    summary: Critical threats detected
```

## Troubleshooting

### Issue: API Not Starting

**Solution**: Increase wait time or check Docker logs

```yaml
- name: Wait for API
  run: |
    timeout 300 bash -c 'until curl -f http://localhost:5000/health; do sleep 5; done'
    docker-compose logs api
```

### Issue: No Threats Detected

**Solution**: Verify Terraform files are being analyzed

```bash
find . -name "*.tf" -type f
cat changed-files.txt
```

### Issue: Permission Denied

**Solution**: Ensure scripts are executable

```yaml
- name: Make Scripts Executable
  run: chmod +x scripts/*.sh scripts/*.js
```

## Security Considerations

### Secrets Management

Use repository secrets for sensitive values:

```yaml
env:
  API_KEY: ${{ secrets.THREAT_MODEL_API_KEY }}
```

### Network Security

Use HTTPS for remote APIs:

```yaml
env:
  THREAT_MODEL_API_URL: 'https://threat-model.example.com'
```

### Artifact Retention

Limit artifact retention:

```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 30
```

## Advanced Configuration

### Custom Threat Rules

Load custom threat rules:

```yaml
- name: Load Custom Rules
  run: |
    cp custom-threats/*.yaml backend/threatdb/threats/
```

### Multi-Cloud Analysis

Analyze multiple cloud providers:

```yaml
matrix:
  provider: [aws, gcp, azure]
steps:
  - name: Analyze ${{ matrix.provider }}
    run: ./scripts/run-threat-analysis.sh --provider ${{ matrix.provider }}
```

### Scheduled Scans

Run periodic full scans:

```yaml
on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2 AM
```

## Support

For help with CI/CD integration:
- Check workflow logs
- Review [GitHub Actions README](.github/workflows/README.md)
- Open issue with `ci-cd` label
- Contact DevOps team
