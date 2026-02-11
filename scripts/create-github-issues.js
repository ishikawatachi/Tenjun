#!/usr/bin/env node

/**
 * Create GitHub Issues for Critical Threats
 * 
 * This script creates GitHub Issues for each critical threat found
 * during automated threat analysis.
 */

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

// Configuration from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = process.env.PR_NUMBER;
const GITHUB_API_URL = process.env.GITHUB_API_URL || 'https://api.github.com';
const GITHUB_SHA = process.env.GITHUB_SHA || 'unknown';
const REPORT_FILE = process.env.THREAT_REPORT_FILE || 'threat-report.json';

// Labels for issues
const ISSUE_LABELS = ['security', 'threat-model', 'critical'];

/**
 * Make HTTPS request
 */
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Threat-Model-Bot',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    const req = https.request(requestOptions, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Create a GitHub Issue
 */
async function createIssue(owner, repo, threat) {
  const title = `🔴 [CRITICAL] ${threat.threat_name} in ${threat.resource_type}`;
  
  let body = `## Critical Security Threat Detected\n\n`;
  body += `A critical security threat was identified during automated threat analysis.\n\n`;
  
  body += `### Threat Details\n\n`;
  body += `- **Threat**: ${threat.threat_name}\n`;
  body += `- **Severity**: ${threat.severity.toUpperCase()}\n`;
  body += `- **Risk Score**: ${threat.risk_score}\n`;
  body += `- **Category**: ${threat.category}\n`;
  body += `- **Likelihood**: ${threat.likelihood}\n`;
  body += `- **Resource Type**: ${threat.resource_type}\n`;
  body += `- **Resource ID**: \`${threat.resource_id}\`\n`;
  body += `- **Cloud Provider**: ${threat.cloud_provider}\n\n`;
  
  body += `### Description\n\n`;
  body += `${threat.description}\n\n`;
  
  // Add mitigations
  if (threat.mitigations && threat.mitigations.length > 0) {
    body += `### Recommended Mitigations\n\n`;
    threat.mitigations.forEach((mitigation, index) => {
      body += `#### ${index + 1}. ${mitigation.description}\n\n`;
      body += `**Effort**: ${mitigation.effort} | **Impact**: ${mitigation.impact}\n\n`;
      
      if (mitigation.steps && mitigation.steps.length > 0) {
        body += `**Steps**:\n`;
        mitigation.steps.forEach((step, i) => {
          body += `${i + 1}. ${step}\n`;
        });
        body += `\n`;
      }
    });
  }
  
  // Add compliance mappings
  if (threat.compliance_mappings && threat.compliance_mappings.length > 0) {
    body += `### Compliance Impact\n\n`;
    body += `This threat affects the following compliance frameworks:\n\n`;
    threat.compliance_mappings.forEach((mapping) => {
      body += `- **${mapping.framework}**: ${mapping.control_id} - ${mapping.description}\n`;
    });
    body += `\n`;
  }
  
  // Add references
  if (threat.references && threat.references.length > 0) {
    body += `### References\n\n`;
    threat.references.forEach((ref) => {
      body += `- ${ref}\n`;
    });
    body += `\n`;
  }
  
  // Add metadata
  body += `---\n\n`;
  body += `**Detected in commit**: ${GITHUB_SHA}\n`;
  if (PR_NUMBER) {
    body += `**Related PR**: #${PR_NUMBER}\n`;
  }
  body += `**Analysis Date**: ${new Date().toISOString()}\n\n`;
  body += `*This issue was automatically created by the Threat Modeling Platform.*\n`;
  
  const issueData = {
    title,
    body,
    labels: ISSUE_LABELS,
  };
  
  try {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/issues`;
    const issue = await makeRequest(url, { method: 'POST' }, issueData);
    console.log(`✅ Created issue #${issue.number}: ${title}`);
    return issue;
  } catch (error) {
    console.error(`❌ Failed to create issue: ${error.message}`);
    throw error;
  }
}

/**
 * Check if issue already exists
 */
async function findExistingIssue(owner, repo, threatId) {
  try {
    const query = `repo:${owner}/${repo} is:issue is:open label:threat-model "${threatId}"`;
    const url = `${GITHUB_API_URL}/search/issues?q=${encodeURIComponent(query)}`;
    
    const result = await makeRequest(url, { method: 'GET' });
    
    if (result.total_count > 0) {
      return result.items[0];
    }
    return null;
  } catch (error) {
    console.error(`⚠️  Failed to search for existing issue: ${error.message}`);
    return null;
  }
}

/**
 * Add comment to existing issue
 */
async function addCommentToIssue(owner, repo, issueNumber, threat) {
  let comment = `## 🔄 Threat Still Present\n\n`;
  comment += `This threat was detected again in commit ${GITHUB_SHA}.\n\n`;
  
  if (PR_NUMBER) {
    comment += `**Related PR**: #${PR_NUMBER}\n`;
  }
  
  comment += `**Resource**: \`${threat.resource_id}\`\n`;
  comment += `**Risk Score**: ${threat.risk_score}\n`;
  comment += `**Detection Date**: ${new Date().toISOString()}\n\n`;
  comment += `Please review and remediate this threat.\n`;
  
  try {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    await makeRequest(url, { method: 'POST' }, { body: comment });
    console.log(`💬 Added comment to existing issue #${issueNumber}`);
  } catch (error) {
    console.error(`⚠️  Failed to add comment: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Creating GitHub Issues for Critical Threats...\n');
  
  // Validate environment variables
  if (!GITHUB_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }
  
  if (!GITHUB_REPOSITORY) {
    console.error('❌ Error: GITHUB_REPOSITORY environment variable is required');
    process.exit(1);
  }
  
  const [owner, repo] = GITHUB_REPOSITORY.split('/');
  
  if (!owner || !repo) {
    console.error('❌ Error: Invalid GITHUB_REPOSITORY format. Expected: owner/repo');
    process.exit(1);
  }
  
  // Read threat report
  if (!fs.existsSync(REPORT_FILE)) {
    console.error(`❌ Error: Threat report file not found: ${REPORT_FILE}`);
    process.exit(1);
  }
  
  let report;
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    report = JSON.parse(reportContent);
  } catch (error) {
    console.error(`❌ Error parsing threat report: ${error.message}`);
    process.exit(1);
  }
  
  // Filter critical threats
  const criticalThreats = (report.matched_threats || []).filter(
    (threat) => threat.severity === 'critical'
  );
  
  if (criticalThreats.length === 0) {
    console.log('✅ No critical threats found. No issues to create.');
    return;
  }
  
  console.log(`Found ${criticalThreats.length} critical threat(s)\n`);
  
  // Create issues for each critical threat
  const createdIssues = [];
  const updatedIssues = [];
  
  for (const threat of criticalThreats) {
    console.log(`Processing: ${threat.threat_name}...`);
    
    try {
      // Check if issue already exists
      const existingIssue = await findExistingIssue(owner, repo, threat.threat_id);
      
      if (existingIssue) {
        console.log(`  ℹ️  Issue already exists: #${existingIssue.number}`);
        await addCommentToIssue(owner, repo, existingIssue.number, threat);
        updatedIssues.push(existingIssue.number);
      } else {
        // Create new issue
        const issue = await createIssue(owner, repo, threat);
        createdIssues.push(issue.number);
      }
      
      // Rate limiting: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error processing threat: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Issues created: ${createdIssues.length}`);
  console.log(`🔄 Issues updated: ${updatedIssues.length}`);
  
  if (createdIssues.length > 0) {
    console.log('\nCreated Issues:');
    createdIssues.forEach((num) => {
      console.log(`  - #${num}`);
    });
  }
  
  if (updatedIssues.length > 0) {
    console.log('\nUpdated Issues:');
    updatedIssues.forEach((num) => {
      console.log(`  - #${num}`);
    });
  }
  
  console.log('\n✅ Done!');
}

// Run main function
main().catch((error) => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
