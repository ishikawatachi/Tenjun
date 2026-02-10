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
