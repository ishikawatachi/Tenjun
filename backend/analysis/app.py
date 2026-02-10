#!/usr/bin/env python3
"""
Threat Model Analysis Service
Flask application for AI-powered threat analysis
"""

import os
import logging
from datetime import datetime
from flask import Flask, jsonify, request
from dotenv import load_dotenv

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
