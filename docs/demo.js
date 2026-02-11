// Threat Modeling Platform - Demo JavaScript
// Client-side threat analysis simulation

// Threat database with patterns
const THREAT_PATTERNS = {
    'web-server': [
        {
            category: 'tampering',
            name: 'Code Injection via User Input',
            severity: 'critical',
            description: 'Web server may be vulnerable to code injection if user input is not properly sanitized.',
            mitigation: 'Implement input validation, use parameterized queries, apply WAF rules.',
            compliance: ['OWASP A03:2021', 'NIST SI-10', 'PCI-DSS 6.5.1']
        },
        {
            category: 'dos',
            name: 'DDoS Attack on Web Server',
            severity: 'high',
            description: 'Web server exposed to internet could be targeted by DDoS attacks.',
            mitigation: 'Implement rate limiting, use CDN, configure auto-scaling.',
            compliance: ['NIST SC-5', 'ISO 27001 A.13.1.1']
        }
    ],
    'api-gateway': [
        {
            category: 'spoofing',
            name: 'Insufficient Authentication',
            severity: 'critical',
            description: 'API Gateway may allow unauthorized access without proper authentication.',
            mitigation: 'Implement OAuth 2.0, API keys, JWT tokens with short expiry.',
            compliance: ['OWASP A07:2021', 'NIST IA-2', 'SOC 2 CC6.1']
        },
        {
            category: 'dos',
            name: 'Missing Rate Limiting',
            severity: 'medium',
            description: 'API endpoints without rate limiting are vulnerable to abuse and DoS.',
            mitigation: 'Configure rate limiting policies, implement throttling, monitor API usage.',
            compliance: ['NIST SC-7', 'CIS 4.1']
        }
    ],
    'database': [
        {
            category: 'tampering',
            name: 'SQL Injection',
            severity: 'critical',
            description: 'Database queries constructed from user input may be vulnerable to SQL injection.',
            mitigation: 'Use parameterized queries, ORM frameworks, input validation.',
            compliance: ['OWASP A03:2021', 'PCI-DSS 6.5.1', 'HIPAA 164.312']
        },
        {
            category: 'information',
            name: 'Unencrypted Data at Rest',
            severity: 'high',
            description: 'Database storing sensitive data without encryption exposes information.',
            mitigation: 'Enable database encryption (TDE), encrypt sensitive columns, manage keys properly.',
            compliance: ['GDPR Art. 32', 'PCI-DSS 3.4', 'HIPAA 164.312(a)(2)(iv)']
        },
        {
            category: 'elevation',
            name: 'Excessive Database Privileges',
            severity: 'high',
            description: 'Application using admin-level database credentials violates least privilege.',
            mitigation: 'Create role-based DB users, restrict permissions, use read-only replicas.',
            compliance: ['NIST AC-6', 'ISO 27001 A.9.2.3', 'SOC 2 CC6.3']
        }
    ],
    'storage': [
        {
            category: 'information',
            name: 'Public Object Storage Access',
            severity: 'critical',
            description: 'Cloud storage bucket configured with public read access exposes sensitive data.',
            mitigation: 'Review bucket policies, enable private access only, use pre-signed URLs.',
            compliance: ['CIS AWS 2.1.5', 'NIST AC-3', 'GDPR Art. 32']
        },
        {
            category: 'tampering',
            name: 'Missing Object Versioning',
            severity: 'medium',
            description: 'Storage without versioning cannot recover from accidental deletions or tampering.',
            mitigation: 'Enable versioning, configure lifecycle policies, implement MFA delete.',
            compliance: ['NIST CP-9', 'ISO 27001 A.12.3.1']
        }
    ],
    'auth': [
        {
            category: 'spoofing',
            name: 'Weak Password Policy',
            severity: 'high',
            description: 'Authentication service allowing weak passwords enables brute force attacks.',
            mitigation: 'Enforce strong password requirements, implement MFA, monitor failed attempts.',
            compliance: ['NIST IA-5', 'PCI-DSS 8.2.3', 'SOC 2 CC6.1']
        },
        {
            category: 'elevation',
            name: 'Insecure Session Management',
            severity: 'high',
            description: 'Session tokens without proper security attributes can be hijacked.',
            mitigation: 'Use secure cookies, implement session timeout, regenerate session IDs.',
            compliance: ['OWASP A07:2021', 'NIST SC-23', 'PCI-DSS 6.5.10']
        }
    ],
    'cache': [
        {
            category: 'information',
            name: 'Sensitive Data in Cache',
            severity: 'medium',
            description: 'Caching sensitive information without encryption exposes data.',
            mitigation: 'Encrypt cached data, set appropriate TTLs, avoid caching PII.',
            compliance: ['GDPR Art. 32', 'PCI-DSS 3.4']
        }
    ],
    'messaging': [
        {
            category: 'information',
            name: 'Unencrypted Message Queue',
            severity: 'high',
            description: 'Messages in transit or at rest without encryption expose sensitive data.',
            mitigation: 'Enable queue encryption, use TLS for connections, implement message signing.',
            compliance: ['NIST SC-8', 'HIPAA 164.312(e)(1)']
        }
    ],
    'cdn': [
        {
            category: 'tampering',
            name: 'CDN Cache Poisoning',
            severity: 'medium',
            description: 'Improperly configured CDN cache can be poisoned to serve malicious content.',
            mitigation: 'Configure cache-control headers, validate origin responses, use signed URLs.',
            compliance: ['NIST SI-7', 'OWASP A08:2021']
        }
    ]
};

const CLOUD_SPECIFIC_THREATS = {
    'aws': [
        {
            category: 'elevation',
            name: 'Overly Permissive IAM Policies',
            severity: 'high',
            description: 'AWS IAM policies with wildcard (*) permissions violate least privilege principle.',
            mitigation: 'Review and restrict IAM policies, use policy conditions, implement SCPs.',
            compliance: ['CIS AWS 1.16', 'NIST AC-6', 'SOC 2 CC6.3']
        },
        {
            category: 'information',
            name: 'CloudTrail Logging Disabled',
            severity: 'high',
            description: 'Disabled CloudTrail prevents audit trail and security monitoring.',
            mitigation: 'Enable CloudTrail in all regions, configure log file validation, centralize logs.',
            compliance: ['CIS AWS 3.1', 'NIST AU-2', 'PCI-DSS 10.1']
        }
    ],
    'azure': [
        {
            category: 'elevation',
            name: 'Excessive RBAC Permissions',
            severity: 'high',
            description: 'Azure role assignments with Owner or Contributor at subscription level are overly broad.',
            mitigation: 'Use built-in roles, create custom roles with minimal permissions, review assignments.',
            compliance: ['CIS Azure 1.23', 'NIST AC-6']
        }
    ],
    'gcp': [
        {
            category: 'elevation',
            name: 'Primitive IAM Roles in Use',
            severity: 'high',
            description: 'GCP primitive roles (Owner, Editor, Viewer) grant excessive permissions.',
            mitigation: 'Use predefined or custom roles, follow least privilege, audit role bindings.',
            compliance: ['CIS GCP 1.5', 'NIST AC-6']
        }
    ],
    'kubernetes': [
        {
            category: 'elevation',
            name: 'Privileged Container Deployment',
            severity: 'critical',
            description: 'Containers running with privileged mode can escape to host.',
            mitigation: 'Disable privileged mode, use Pod Security Policies, implement admission controllers.',
            compliance: ['CIS Kubernetes 5.2.1', 'NIST CM-7']
        },
        {
            category: 'information',
            name: 'Secrets Stored in ConfigMaps',
            severity: 'high',
            description: 'Storing secrets in ConfigMaps instead of Secrets exposes sensitive data.',
            mitigation: 'Use Kubernetes Secrets, enable encryption at rest, consider external secret managers.',
            compliance: ['CIS Kubernetes 5.4.1', 'NIST SC-28']
        }
    ]
};

function generateThreats(formData) {
    const threats = [];
    let threatId = 1;

    // Generate component-based threats
    formData.components.forEach(component => {
        if (THREAT_PATTERNS[component]) {
            THREAT_PATTERNS[component].forEach(pattern => {
                // Only include if STRIDE category is selected
                if (formData.strideCategories.includes(pattern.category)) {
                    threats.push({
                        id: `T-${String(threatId++).padStart(3, '0')}`,
                        ...pattern,
                        component: component,
                        systemName: formData.systemName
                    });
                }
            });
        }
    });

    // Add cloud-specific threats
    if (CLOUD_SPECIFIC_THREATS[formData.cloudProvider]) {
        CLOUD_SPECIFIC_THREATS[formData.cloudProvider].forEach(pattern => {
            if (formData.strideCategories.includes(pattern.category)) {
                threats.push({
                    id: `T-${String(threatId++).padStart(3, '0')}`,
                    ...pattern,
                    component: formData.cloudProvider,
                    systemName: formData.systemName
                });
            }
        });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return threats;
}

function displayResults(threats, systemName) {
    const container = document.getElementById('resultsContainer');
    
    if (threats.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>No Threats Found</h3>
                <p>Based on your analysis scope, no threats were identified. Try selecting more components or STRIDE categories.</p>
            </div>
        `;
        return;
    }

    // Calculate statistics
    const stats = {
        total: threats.length,
        critical: threats.filter(t => t.severity === 'critical').length,
        high: threats.filter(t => t.severity === 'high').length,
        medium: threats.filter(t => t.severity === 'medium').length,
        low: threats.filter(t => t.severity === 'low').length
    };

    let html = `
        <div class="results-header">
            <h2>🛡️ Threat Analysis: ${systemName}</h2>
            <div class="threat-stats">
                <div class="stat-card critical">
                    <div class="stat-number">${stats.critical}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat-card high">
                    <div class="stat-number">${stats.high}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card medium">
                    <div class="stat-number">${stats.medium}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="stat-card low">
                    <div class="stat-number">${stats.low}</div>
                    <div class="stat-label">Low</div>
                </div>
            </div>
        </div>

        <div class="results-actions">
            <button class="btn btn-secondary btn-sm" onclick="exportThreats()">📥 Export as JSON</button>
            <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Report</button>
        </div>

        <div class="threats-list">
    `;

    threats.forEach(threat => {
        html += `
            <div class="threat-card-detailed ${threat.severity}">
                <div class="threat-header">
                    <div class="threat-id">${threat.id}</div>
                    <span class="severity-badge ${threat.severity}">${threat.severity.toUpperCase()}</span>
                    <span class="component-badge">${threat.component}</span>
                </div>
                <h3 class="threat-title">${threat.name}</h3>
                <div class="threat-category">
                    🎯 STRIDE Category: <strong>${formatCategory(threat.category)}</strong>
                </div>
                <div class="threat-description">
                    <strong>Description:</strong> ${threat.description}
                </div>
                <div class="threat-mitigation">
                    <strong>Mitigation:</strong> ${threat.mitigation}
                </div>
                <div class="threat-compliance">
                    <strong>Compliance:</strong>
                    ${threat.compliance.map(c => `<span class="compliance-tag">${c}</span>`).join(' ')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Scroll to results
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatCategory(category) {
    const categories = {
        'spoofing': 'Spoofing',
        'tampering': 'Tampering',
        'repudiation': 'Repudiation',
        'information': 'Information Disclosure',
        'dos': 'Denial of Service',
        'elevation': 'Elevation of Privilege'
    };
    return categories[category] || category;
}

function exportThreats() {
    const threats = window.currentThreats || [];
    const data = {
        systemName: document.getElementById('systemName').value,
        generatedAt: new Date().toISOString(),
        threatCount: threats.length,
        threats: threats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threats-${data.systemName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadExample() {
    document.getElementById('systemName').value = 'E-Commerce Platform';
    document.getElementById('systemDesc').value = 'A cloud-based e-commerce platform with microservices architecture. Handles user authentication, product catalog, shopping cart, payment processing, and order management. Uses API Gateway for routing, Lambda for serverless functions, RDS for transactional data, and S3 for static assets.';
    document.getElementById('cloudProvider').value = 'aws';
    
    // Check all components
    const components = ['web-server', 'api-gateway', 'database', 'cache', 'storage', 'auth'];
    components.forEach(comp => {
        const checkbox = document.querySelector(`input[name="components"][value="${comp}"]`);
        if (checkbox) checkbox.checked = true;
    });

    // Keep all STRIDE categories checked (default)
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('threatForm');
    const loadExampleBtn = document.getElementById('loadExampleBtn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const systemName = document.getElementById('systemName').value;
        const systemDesc = document.getElementById('systemDesc').value;
        const cloudProvider = document.getElementById('cloudProvider').value;
        
        const components = Array.from(document.querySelectorAll('input[name="components"]:checked'))
            .map(cb => cb.value);
        
        const strideCategories = Array.from(document.querySelectorAll('input[name="stride"]:checked'))
            .map(cb => cb.value);

        if (!systemName || !systemDesc) {
            alert('Please fill in system name and description');
            return;
        }

        if (components.length === 0) {
            alert('Please select at least one system component');
            return;
        }

        const formData = {
            systemName,
            systemDesc,
            cloudProvider,
            components,
            strideCategories
        };

        // Generate threats
        const threats = generateThreats(formData);
        window.currentThreats = threats; // Store for export

        // Display results
        displayResults(threats, systemName);
    });

    loadExampleBtn.addEventListener('click', loadExample);
});
