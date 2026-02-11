#!/bin/bash
# Test Jira Integration
#
# This script tests the Jira integration by creating sample threats
# and syncing them to Jira.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
JIRA_API="${API_URL}/api/jira"

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

check_jira_status() {
  log_info "Checking Jira integration status..."
  
  response=$(curl -s "${JIRA_API}/status")
  configured=$(echo "$response" | jq -r '.configured')
  
  if [ "$configured" = "true" ]; then
    log_success "Jira integration is configured"
    echo "$response" | jq '.'
  else
    log_error "Jira integration is NOT configured"
    log_warning "Please set JIRA_HOST, JIRA_USERNAME, JIRA_API_TOKEN, and JIRA_PROJECT_KEY"
    exit 1
  fi
}

create_sample_threats() {
  log_info "Creating sample threats..."
  
  cat > /tmp/sample-threats.json <<EOF
{
  "threats": [
    {
      "threat_id": "test-threat-001",
      "threat_name": "Public S3 Bucket",
      "description": "S3 bucket is publicly accessible, exposing sensitive data.",
      "severity": "critical",
      "likelihood": "high",
      "risk_score": 9.5,
      "category": "Data Exposure",
      "resource_id": "aws_s3_bucket.data_bucket",
      "resource_type": "aws_s3_bucket",
      "cloud_provider": "AWS",
      "mitigations": [
        {
          "description": "Enable bucket encryption and block public access",
          "effort": "low",
          "impact": "high",
          "steps": [
            "aws s3api put-public-access-block --bucket mybucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
            "aws s3api put-bucket-encryption --bucket mybucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'"
          ]
        }
      ],
      "compliance_mappings": [
        {
          "framework": "DORA",
          "control_id": "ICT-07",
          "description": "Data and System Security"
        },
        {
          "framework": "GDPR",
          "control_id": "Art.32",
          "description": "Security of Processing"
        }
      ],
      "references": [
        "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html"
      ]
    },
    {
      "threat_id": "test-threat-002",
      "threat_name": "Unencrypted RDS Instance",
      "description": "RDS database instance does not have encryption enabled.",
      "severity": "high",
      "likelihood": "medium",
      "risk_score": 7.8,
      "category": "Data Protection",
      "resource_id": "aws_db_instance.main",
      "resource_type": "aws_db_instance",
      "cloud_provider": "AWS",
      "mitigations": [
        {
          "description": "Enable encryption at rest for RDS instance",
          "effort": "medium",
          "impact": "high",
          "steps": [
            "Create encrypted snapshot of existing database",
            "Restore from encrypted snapshot",
            "Update application connection strings"
          ]
        }
      ],
      "compliance_mappings": [
        {
          "framework": "PCI-DSS",
          "control_id": "3.4",
          "description": "Render PAN unreadable"
        }
      ]
    }
  ],
  "create_new": true,
  "update_existing": false
}
EOF

  log_success "Created sample threats file: /tmp/sample-threats.json"
}

sync_threats_to_jira() {
  log_info "Syncing threats to Jira..."
  
  response=$(curl -s -X POST "${JIRA_API}/sync" \
    -H "Content-Type: application/json" \
    -d @/tmp/sample-threats.json)
  
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    log_success "Threats synced successfully"
    echo "$response" | jq '.results'
    
    # Save issue keys for later
    echo "$response" | jq -r '.results.issues[].issue_key' > /tmp/jira-issues.txt
  else
    log_error "Failed to sync threats"
    echo "$response" | jq '.'
    exit 1
  fi
}

get_jira_issues() {
  log_info "Retrieving Jira issues..."
  
  response=$(curl -s "${JIRA_API}/issues?label=threat")
  count=$(echo "$response" | jq -r '.count')
  
  log_success "Found ${count} threat issues in Jira"
  echo "$response" | jq '.issues[] | {key: .key, summary: .fields.summary, status: .fields.status.name, priority: .fields.priority.name}'
}

update_threat_status() {
  log_info "Updating threat status in Jira..."
  
  # Get first issue key
  issue_key=$(head -n 1 /tmp/jira-issues.txt 2>/dev/null || echo "")
  
  if [ -z "$issue_key" ]; then
    log_warning "No issue keys found, skipping status update"
    return
  fi
  
  response=$(curl -s -X POST "${JIRA_API}/update-status" \
    -H "Content-Type: application/json" \
    -d "{\"threat_id\": \"test-threat-001\", \"status\": \"Done\"}")
  
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    log_success "Updated threat status to Done"
    echo "$response" | jq '.'
  else
    log_error "Failed to update threat status"
    echo "$response" | jq '.'
  fi
}

generate_report() {
  log_info "Generating threat report..."
  
  response=$(curl -s "${JIRA_API}/report")
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    log_success "Generated threat report"
    echo "$response" | jq '.report'
  else
    log_error "Failed to generate report"
    echo "$response" | jq '.'
  fi
}

sync_status_from_jira() {
  log_info "Syncing threat statuses from Jira..."
  
  response=$(curl -s -X POST "${JIRA_API}/sync-status" \
    -H "Content-Type: application/json" \
    -d '{"threat_ids": ["test-threat-001", "test-threat-002"]}')
  
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    log_success "Synced threat statuses from Jira"
    echo "$response" | jq '.results'
  else
    log_error "Failed to sync statuses"
    echo "$response" | jq '.'
  fi
}

cleanup() {
  log_info "Cleaning up temporary files..."
  rm -f /tmp/sample-threats.json /tmp/jira-issues.txt
  log_success "Cleanup complete"
}

main() {
  echo ""
  echo "================================================"
  echo "  Jira Integration Test"
  echo "================================================"
  echo ""
  
  # Run tests
  check_jira_status
  echo ""
  
  create_sample_threats
  echo ""
  
  sync_threats_to_jira
  echo ""
  
  sleep 2
  
  get_jira_issues
  echo ""
  
  update_threat_status
  echo ""
  
  generate_report
  echo ""
  
  sync_status_from_jira
  echo ""
  
  cleanup
  
  echo ""
  log_success "All tests completed successfully!"
  echo ""
  echo "================================================"
  echo "  Next Steps:"
  echo "================================================"
  echo "1. Check Jira for created issues:"
  echo "   https://$(echo $JIRA_HOST | tr -d '"')/projects/$(echo $JIRA_PROJECT_KEY | tr -d '"')"
  echo ""
  echo "2. Verify issue details and formatting"
  echo ""
  echo "3. Test webhook by manually updating issue in Jira"
  echo ""
  echo "4. Integrate with CI/CD pipeline"
  echo ""
}

# Trap errors
trap 'log_error "Test failed at line $LINENO"' ERR

# Run main
main
