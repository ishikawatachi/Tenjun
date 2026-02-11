#!/usr/bin/env python3

"""
Generate HTML Threat Report

This script generates an HTML report from the threat analysis JSON results.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Threat Analysis Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }}
        
        header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        
        header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
        }}
        
        header p {{
            opacity: 0.9;
            font-size: 1.1rem;
        }}
        
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 40px;
            background: #f9fafb;
        }}
        
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }}
        
        .stat-card .number {{
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 8px;
        }}
        
        .stat-card .label {{
            color: #6b7280;
            text-transform: uppercase;
            font-size: 0.875rem;
            letter-spacing: 0.05em;
        }}
        
        .stat-card.critical .number {{ color: #dc2626; }}
        .stat-card.high .number {{ color: #ea580c; }}
        .stat-card.medium .number {{ color: #f59e0b; }}
        .stat-card.low .number {{ color: #10b981; }}
        
        .content {{
            padding: 40px;
        }}
        
        .threat {{
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 20px;
        }}
        
        .threat-header {{
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 16px;
        }}
        
        .threat-title {{
            font-size: 1.5rem;
            font-weight: 600;
            color: #111827;
        }}
        
        .severity-badge {{
            display: inline-block;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
        }}
        
        .severity-critical {{
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }}
        
        .severity-high {{
            background: #fff7ed;
            color: #ea580c;
            border: 1px solid #fed7aa;
        }}
        
        .severity-medium {{
            background: #fffbeb;
            color: #f59e0b;
            border: 1px solid #fde68a;
        }}
        
        .severity-low {{
            background: #f0fdf4;
            color: #10b981;
            border: 1px solid #bbf7d0;
        }}
        
        .threat-meta {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 16px 0;
            padding: 16px;
            background: #f9fafb;
            border-radius: 6px;
        }}
        
        .meta-item {{
            display: flex;
            flex-direction: column;
        }}
        
        .meta-label {{
            font-size: 0.75rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }}
        
        .meta-value {{
            font-weight: 600;
            color: #111827;
        }}
        
        .threat-description {{
            margin: 16px 0;
            color: #4b5563;
            line-height: 1.7;
        }}
        
        .mitigations {{
            margin-top: 20px;
        }}
        
        .mitigations h3 {{
            font-size: 1.125rem;
            color: #111827;
            margin-bottom: 12px;
        }}
        
        .mitigation {{
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 4px;
        }}
        
        .mitigation-title {{
            font-weight: 600;
            color: #047857;
            margin-bottom: 8px;
        }}
        
        .mitigation-steps {{
            list-style: decimal;
            margin-left: 20px;
            color: #374151;
        }}
        
        .compliance {{
            margin-top: 20px;
            padding: 16px;
            background: #eff6ff;
            border-radius: 6px;
        }}
        
        .compliance h3 {{
            font-size: 1.125rem;
            color: #1e40af;
            margin-bottom: 12px;
        }}
        
        .compliance-item {{
            margin-bottom: 8px;
            color: #1e3a8a;
        }}
        
        .footer {{
            background: #f9fafb;
            padding: 20px 40px;
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
        }}
        
        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            
            .container {{
                box-shadow: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔒 Threat Analysis Report</h1>
            <p>Generated on {timestamp}</p>
        </header>
        
        <div class="summary">
            <div class="stat-card">
                <div class="number">{total_threats}</div>
                <div class="label">Total Threats</div>
            </div>
            <div class="stat-card critical">
                <div class="number">{critical_count}</div>
                <div class="label">Critical</div>
            </div>
            <div class="stat-card high">
                <div class="number">{high_count}</div>
                <div class="label">High</div>
            </div>
            <div class="stat-card medium">
                <div class="number">{medium_count}</div>
                <div class="label">Medium</div>
            </div>
            <div class="stat-card low">
                <div class="number">{low_count}</div>
                <div class="label">Low</div>
            </div>
            <div class="stat-card">
                <div class="number">{avg_risk_score}</div>
                <div class="label">Avg Risk Score</div>
            </div>
        </div>
        
        <div class="content">
            {threats_html}
        </div>
        
        <footer class="footer">
            <p>Generated by Threat Modeling Platform</p>
            <p>© 2026 Automated Threat Analysis System</p>
        </footer>
    </div>
</body>
</html>
"""

THREAT_TEMPLATE = """
<div class="threat">
    <div class="threat-header">
        <div class="threat-title">{threat_name}</div>
        <span class="severity-badge severity-{severity}">{severity}</span>
    </div>
    
    <div class="threat-meta">
        <div class="meta-item">
            <span class="meta-label">Resource Type</span>
            <span class="meta-value">{resource_type}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Resource ID</span>
            <span class="meta-value">{resource_id}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Cloud Provider</span>
            <span class="meta-value">{cloud_provider}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Risk Score</span>
            <span class="meta-value">{risk_score}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Likelihood</span>
            <span class="meta-value">{likelihood}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Category</span>
            <span class="meta-value">{category}</span>
        </div>
    </div>
    
    <div class="threat-description">
        {description}
    </div>
    
    {mitigations_html}
    
    {compliance_html}
</div>
"""


def generate_threat_html(threat):
    """Generate HTML for a single threat."""
    
    # Mitigations
    mitigations_html = ""
    if threat.get('mitigations') and len(threat['mitigations']) > 0:
        mitigations_html = '<div class="mitigations"><h3>🛡️ Recommended Mitigations</h3>'
        
        for mitigation in threat['mitigations']:
            steps_html = ""
            if mitigation.get('steps'):
                steps_html = '<ol class="mitigation-steps">'
                for step in mitigation['steps']:
                    steps_html += f'<li>{step}</li>'
                steps_html += '</ol>'
            
            mitigations_html += f'''
            <div class="mitigation">
                <div class="mitigation-title">{mitigation.get('description', 'Mitigation')}</div>
                {steps_html}
            </div>
            '''
        
        mitigations_html += '</div>'
    
    # Compliance mappings
    compliance_html = ""
    if threat.get('compliance_mappings') and len(threat['compliance_mappings']) > 0:
        compliance_html = '<div class="compliance"><h3>📋 Compliance Impact</h3>'
        
        for mapping in threat['compliance_mappings']:
            compliance_html += f'''
            <div class="compliance-item">
                <strong>{mapping.get('framework', 'Unknown')}</strong>: 
                {mapping.get('control_id', '')} - {mapping.get('description', '')}
            </div>
            '''
        
        compliance_html += '</div>'
    
    return THREAT_TEMPLATE.format(
        threat_name=threat.get('threat_name', 'Unknown Threat'),
        severity=threat.get('severity', 'unknown').lower(),
        resource_type=threat.get('resource_type', 'Unknown'),
        resource_id=threat.get('resource_id', 'Unknown'),
        cloud_provider=threat.get('cloud_provider', 'Unknown'),
        risk_score=threat.get('risk_score', 0),
        likelihood=threat.get('likelihood', 'Unknown'),
        category=threat.get('category', 'Unknown'),
        description=threat.get('description', 'No description available'),
        mitigations_html=mitigations_html,
        compliance_html=compliance_html,
    )


def generate_html_report(report_data):
    """Generate complete HTML report."""
    
    # Statistics
    stats = report_data.get('statistics', {})
    by_severity = stats.get('by_severity', {})
    
    total_threats = report_data.get('total_matched', 0)
    critical_count = by_severity.get('critical', 0)
    high_count = by_severity.get('high', 0)
    medium_count = by_severity.get('medium', 0)
    low_count = by_severity.get('low', 0)
    avg_risk_score = round(stats.get('average_risk_score', 0), 2)
    
    # Generate threats HTML
    threats_html = ""
    matched_threats = report_data.get('matched_threats', [])
    
    if matched_threats:
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        sorted_threats = sorted(
            matched_threats,
            key=lambda t: severity_order.get(t.get('severity', 'info'), 99)
        )
        
        for threat in sorted_threats:
            threats_html += generate_threat_html(threat)
    else:
        threats_html = '<div class="threat"><p>No threats detected</p></div>'
    
    # Generate final HTML
    html = HTML_TEMPLATE.format(
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'),
        total_threats=total_threats,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        avg_risk_score=avg_risk_score,
        threats_html=threats_html,
    )
    
    return html


def main():
    """Main execution."""
    if len(sys.argv) < 3:
        print("Usage: generate-html-report.py <input.json> <output.html>")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    
    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)
    
    try:
        with open(input_file, 'r') as f:
            report_data = json.load(f)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)
    
    try:
        html = generate_html_report(report_data)
        
        with open(output_file, 'w') as f:
            f.write(html)
        
        print(f"✅ HTML report generated: {output_file}")
    except Exception as e:
        print(f"Error generating HTML report: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
