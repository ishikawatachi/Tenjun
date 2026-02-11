#!/usr/bin/env python3
"""
Threat Model Analysis Service
Flask application for AI-powered threat analysis
"""

import os
import sys
import logging
from datetime import datetime
from flask import Flask, jsonify, request
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Configuration from environment
LLM_PROVIDER = os.getenv('LLM_PROVIDER', 'openai')
LLM_MODEL = os.getenv('LLM_MODEL', 'gpt-4')
MAX_TOKENS = int(os.getenv('MAX_TOKENS', 4096))
TEMPERATURE = float(os.getenv('TEMPERATURE', 0.7))


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'threat-model-analysis',
        'timestamp': datetime.utcnow().isoformat(),
        'llm_provider': LLM_PROVIDER,
        'llm_model': LLM_MODEL,
        'environment': os.getenv('FLASK_ENV', 'production')
    }), 200


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'name': 'Threat Model Analysis Service',
        'version': '1.0.0',
        'status': 'running',
        'provider': LLM_PROVIDER
    }), 200


@app.route('/analyze', methods=['POST'])
def analyze_threat():
    """
    Analyze threat model using LLM
    
    Expected JSON body:
    {
        "system_description": "...",
        "analysis_type": "stride|dread|attack_tree",
        "context": {...}
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'system_description' not in data:
            return jsonify({'error': 'Missing system_description'}), 400
        
        # Placeholder for actual LLM integration
        result = {
            'analysis_id': f"analysis_{datetime.utcnow().timestamp()}",
            'status': 'completed',
            'provider': LLM_PROVIDER,
            'model': LLM_MODEL,
            'timestamp': datetime.utcnow().isoformat(),
            'threats': [],
            'recommendations': [],
            'message': 'Analysis service ready - integrate LLM provider'
        }
        
        logger.info(f"Analysis request processed: {result['analysis_id']}")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/terraform/parse-file', methods=['POST'])
def terraform_parse_file():
    """
    Parse a single Terraform file
    
    Expected JSON body:
    {
        "file_path": "/absolute/path/to/file.tf"
    }
    """
    try:
        from parsers.terraform_parser import TerraformParser, TerraformParserError
        
        data = request.get_json()
        
        if not data or 'file_path' not in data:
            return jsonify({'error': 'Missing file_path parameter'}), 400
        
        file_path = data['file_path']
        
        # Validate file path
        if not os.path.isabs(file_path):
            return jsonify({'error': 'file_path must be an absolute path'}), 400
        
        parser = TerraformParser()
        result = parser.parse_file(file_path)
        
        logger.info(f"Parsed Terraform file: {file_path}")
        return jsonify(result), 200
        
    except TerraformParserError as e:
        logger.error(f"Terraform parsing error: {str(e)}")
        return jsonify({'error': f'Terraform parsing error: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error parsing Terraform file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/terraform/parse-directory', methods=['POST'])
def terraform_parse_directory():
    """
    Parse all Terraform files in a directory
    
    Expected JSON body:
    {
        "directory_path": "/absolute/path/to/terraform/project"
    }
    """
    try:
        from parsers.terraform_parser import TerraformParser, TerraformParserError
        
        data = request.get_json()
        
        if not data or 'directory_path' not in data:
            return jsonify({'error': 'Missing directory_path parameter'}), 400
        
        directory_path = data['directory_path']
        
        # Validate directory path
        if not os.path.isabs(directory_path):
            return jsonify({'error': 'directory_path must be an absolute path'}), 400
        
        parser = TerraformParser()
        result = parser.parse_directory(directory_path)
        
        logger.info(f"Parsed Terraform directory: {directory_path}")
        return jsonify(result), 200
        
    except TerraformParserError as e:
        logger.error(f"Terraform parsing error: {str(e)}")
        return jsonify({'error': f'Terraform parsing error: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error parsing Terraform directory: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/terraform/analyze-security', methods=['POST'])
def terraform_analyze_security():
    """
    Analyze Terraform configuration for security issues
    
    Expected JSON body:
    {
        "config": {
            "resources": [...],
            "variables": [...],
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'config' not in data:
            return jsonify({'error': 'Missing config parameter'}), 400
        
        config = data['config']
        
        # Analyze security issues
        issues = []
        
        # Check for public resources
        for resource in config.get('resources', []):
            resource_type = resource['resource_type']
            props = resource['properties']
            
            # Public S3 buckets
            if 'bucket' in resource_type and 'aws' in resource_type:
                if props.get('acl') in ['public-read', 'public-read-write']:
                    issues.append({
                        'severity': 'high',
                        'resource': resource['full_name'],
                        'issue': 'Public S3 bucket',
                        'description': f"Bucket has public ACL: {props['acl']}",
                        'recommendation': 'Set ACL to private and use bucket policies for access control'
                    })
            
            # Open security groups
            if 'security_group' in resource_type or 'firewall' in resource_type:
                ingress_rules = props.get('ingress', [])
                if not isinstance(ingress_rules, list):
                    ingress_rules = [ingress_rules]
                
                for rule in ingress_rules:
                    cidr_blocks = rule.get('cidr_blocks', [])
                    if '0.0.0.0/0' in cidr_blocks or '::/0' in cidr_blocks:
                        issues.append({
                            'severity': 'high',
                            'resource': resource['full_name'],
                            'issue': 'Security group allows access from internet',
                            'description': f"Port {rule.get('from_port')} is open to 0.0.0.0/0",
                            'recommendation': 'Restrict access to specific IP ranges'
                        })
            
            # Unencrypted databases
            if 'database' in resource_type or 'sql' in resource_type:
                if not props.get('storage_encrypted', False) and not props.get('encrypted', False):
                    issues.append({
                        'severity': 'high',
                        'resource': resource['full_name'],
                        'issue': 'Database encryption not enabled',
                        'description': 'Database does not have encryption at rest enabled',
                        'recommendation': 'Enable storage encryption for the database'
                    })
                
                if props.get('publicly_accessible', False):
                    issues.append({
                        'severity': 'critical',
                        'resource': resource['full_name'],
                        'issue': 'Database is publicly accessible',
                        'description': 'Database can be accessed from the internet',
                        'recommendation': 'Disable public accessibility and use VPN or private networking'
                    })
            
            # Public compute instances
            if 'instance' in resource_type or 'compute' in resource_type:
                if props.get('associate_public_ip_address', False):
                    issues.append({
                        'severity': 'medium',
                        'resource': resource['full_name'],
                        'issue': 'Instance has public IP',
                        'description': 'Compute instance is assigned a public IP address',
                        'recommendation': 'Use private IPs and access via VPN or bastion host'
                    })
        
        # Check for sensitive variables
        for var in config.get('variables', []):
            sensitive_keywords = ['password', 'secret', 'token', 'key', 'credential', 'api_key']
            if any(keyword in var['name'].lower() for keyword in sensitive_keywords):
                if not var.get('sensitive', False):
                    issues.append({
                        'severity': 'medium',
                        'resource': f"variable.{var['name']}",
                        'issue': 'Potentially sensitive variable not marked as sensitive',
                        'description': f"Variable '{var['name']}' may contain sensitive data",
                        'recommendation': 'Set sensitive = true for this variable'
                    })
        
        # Group by severity
        severity_counts = {
            'critical': len([i for i in issues if i['severity'] == 'critical']),
            'high': len([i for i in issues if i['severity'] == 'high']),
            'medium': len([i for i in issues if i['severity'] == 'medium']),
            'low': len([i for i in issues if i['severity'] == 'low'])
        }
        
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'total_issues': len(issues),
            'severity_counts': severity_counts,
            'issues': issues,
            'statistics': config.get('statistics', {})
        }
        
        logger.info(f"Security analysis completed: {len(issues)} issues found")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error analyzing Terraform security: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/threats/match', methods=['POST'])
def match_threats():
    """
    Match infrastructure configuration against threat database
    
    Expected JSON body:
    {
        "config": {
            "resources": [...],
            "cloud_provider": "aws|gcp|azure"
        },
        "options": {
            "filter_by_resource_type": true,
            "min_severity": "high"
        }
    }
    """
    try:
        from threatdb.threat_loader import load_threat_database
        from threatdb.threat_matcher import match_infrastructure_threats
        from models.threat import Severity
        
        data = request.get_json()
        
        if not data or 'config' not in data:
            return jsonify({'error': 'Missing config parameter'}), 400
        
        config = data['config']
        options = data.get('options', {})
        
        # Load threat database
        loader = load_threat_database()
        all_threats = loader.get_all_threats()
        
        # Match threats
        result = match_infrastructure_threats(
            config=config,
            threats=all_threats,
            filter_by_resource_type=options.get('filter_by_resource_type', True)
        )
        
        # Filter by minimum severity if specified
        min_severity = options.get('min_severity')
        if min_severity:
            try:
                min_sev_enum = Severity[min_severity.upper()]
                filtered_threats = [
                    t for t in result.matched_threats
                    if Severity[t.severity.upper()].score >= min_sev_enum.score
                ]
                result.matched_threats = filtered_threats
                result.total_matched = len(filtered_threats)
            except KeyError:
                return jsonify({'error': f'Invalid severity: {min_severity}'}), 400
        
        # Convert to JSON-serializable format
        response = {
            'timestamp': datetime.utcnow().isoformat(),
            'total_matched': result.total_matched,
            'total_resources': result.total_resources,
            'matched_threats': [
                {
                    'threat_id': t.threat_id,
                    'threat_name': t.threat.name,
                    'description': t.threat.description,
                    'severity': t.severity,
                    'likelihood': t.threat.likelihood.name.lower(),
                    'risk_score': t.risk_score,
                    'category': t.threat.category,
                    'resource_id': t.resource_id,
                    'resource_type': t.resource_type,
                    'cloud_provider': t.cloud_provider,
                    'matched_conditions': [
                        {
                            'field': c.field,
                            'operator': c.operator,
                            'value': c.value
                        }
                        for c in t.matched_conditions
                    ],
                    'mitigations': [
                        {
                            'description': m.description,
                            'effort': m.effort,
                            'impact': m.impact,
                            'steps': m.steps
                        }
                        for m in t.threat.mitigations
                    ],
                    'compliance_mappings': [
                        {
                            'framework': c.framework,
                            'control_id': c.control_id,
                            'description': c.description
                        }
                        for c in t.threat.compliance_mappings
                    ],
                    'references': t.threat.references
                }
                for t in result.matched_threats
            ],
            'statistics': {
                'by_severity': result.statistics.by_severity,
                'by_category': result.statistics.by_category,
                'by_resource_type': result.statistics.by_resource_type,
                'by_cloud_provider': result.statistics.by_cloud_provider,
                'average_risk_score': result.statistics.average_risk_score
            }
        }
        
        logger.info(f"Threat matching completed: {result.total_matched} threats found")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error matching threats: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/threats/database/stats', methods=['GET'])
def get_threat_database_stats():
    """
    Get threat database statistics
    """
    try:
        from threatdb.threat_loader import load_threat_database
        
        loader = load_threat_database()
        stats = loader.get_statistics()
        
        response = {
            'timestamp': datetime.utcnow().isoformat(),
            'total_threats': stats['total_threats'],
            'by_severity': stats['by_severity'],
            'by_category': stats['by_category'],
            'by_resource_type': stats['by_resource_type'],
            'by_cloud_provider': stats['by_cloud_provider'],
            'supported_resource_types': sorted(stats['by_resource_type'].keys()),
            'supported_cloud_providers': sorted(stats['by_cloud_provider'].keys()),
            'database_path': str(loader.db_path)
        }
        
        logger.info(f"Threat database stats retrieved: {stats['total_threats']} threats")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error getting threat database stats: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/threats/<threat_id>', methods=['GET'])
def get_threat_by_id(threat_id):
    """
    Get specific threat by ID
    """
    try:
        from threatdb.threat_loader import load_threat_database
        
        loader = load_threat_database()
        threat = loader.get_threat_by_id(threat_id)
        
        if not threat:
            return jsonify({'error': f'Threat not found: {threat_id}'}), 404
        
        response = {
            'id': threat.id,
            'name': threat.name,
            'description': threat.description,
            'severity': threat.severity.name.lower(),
            'severity_score': threat.severity.score,
            'likelihood': threat.likelihood.name.lower(),
            'likelihood_score': threat.likelihood.score,
            'category': threat.category,
            'resource_types': threat.resource_types,
            'cloud_providers': threat.cloud_providers,
            'conditions': {
                'logic': threat.conditions.logic,
                'conditions': [
                    {
                        'field': c.field,
                        'operator': c.operator,
                        'value': c.value
                    }
                    for c in threat.conditions.conditions
                ]
            } if threat.conditions else None,
            'mitigations': [
                {
                    'description': m.description,
                    'effort': m.effort,
                    'impact': m.impact,
                    'steps': m.steps
                }
                for m in threat.mitigations
            ],
            'compliance_mappings': [
                {
                    'framework': c.framework,
                    'control_id': c.control_id,
                    'description': c.description
                }
                for c in threat.compliance_mappings
            ],
            'attack_vectors': threat.attack_vectors,
            'exploitability': threat.exploitability,
            'business_impact': threat.business_impact,
            'references': threat.references,
            'tags': threat.tags
        }
        
        logger.info(f"Retrieved threat: {threat_id}")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error getting threat by ID: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/threats/resource-types/<resource_type>', methods=['GET'])
def get_threats_for_resource_type(resource_type):
    """
    Get all threats applicable to a specific resource type
    """
    try:
        from threatdb.threat_loader import load_threat_database
        
        loader = load_threat_database()
        threats = loader.get_threats_by_resource_type(resource_type)
        
        response = {
            'resource_type': resource_type,
            'threat_count': len(threats),
            'threats': [
                {
                    'id': t.id,
                    'name': t.name,
                    'description': t.description,
                    'severity': t.severity.name.lower(),
                    'likelihood': t.likelihood.name.lower(),
                    'category': t.category,
                    'cloud_providers': t.cloud_providers
                }
                for t in threats
            ]
        }
        
        logger.info(f"Retrieved {len(threats)} threats for resource type: {resource_type}")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error getting threats for resource type: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return jsonify({'error': 'Not Found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal Server Error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3002))
    logger.info(f"🚀 Analysis Service starting on port {port}")
    logger.info(f"📊 Environment: {os.getenv('FLASK_ENV', 'production')}")
    logger.info(f"🤖 LLM Provider: {LLM_PROVIDER}")
    logger.info(f"🧠 Model: {LLM_MODEL}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_ENV') == 'development'
    )
