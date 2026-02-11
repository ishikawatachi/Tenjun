"""
Threat Generator

Generate threat descriptions, remediations, and compliance explanations
using LLM integration.
"""

import logging
from typing import Dict, Any, Optional
from llm.llm_client import LLMClient
from llm.prompt_templates import PromptTemplates, get_system_prompt
from utils.cache import get_cache, ResponseCache

logger = logging.getLogger(__name__)


class ThreatGenerator:
    """
    Generate threat-related content using LLMs
    
    Features:
    - Threat descriptions
    - Remediation instructions
    - Compliance explanations
    - Attack scenarios
    - Risk assessments
    """
    
    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        cache: Optional[ResponseCache] = None,
        enable_cache: bool = True
    ):
        """
        Initialize threat generator
        
        Args:
            llm_client: LLM client instance (creates default if None)
            cache: Response cache instance (creates default if None)
            enable_cache: Enable response caching
        """
        self.llm_client = llm_client or LLMClient()
        self.cache = cache or get_cache() if enable_cache else None
        self.enable_cache = enable_cache
    
    def generate_threat_description(
        self,
        config: Dict[str, Any],
        threat_rule: Dict[str, Any],
        use_cache: bool = True
    ) -> str:
        """
        Generate human-readable threat description
        
        Args:
            config: Infrastructure configuration
                {
                    'resource_type': 'google_sql_database_instance',
                    'name': 'main-db',
                    'properties': {...}
                }
            threat_rule: Threat rule
                {
                    'id': 'GCP-SQL-001',
                    'name': 'Cloud SQL Instance Publicly Accessible',
                    'category': 'Data Exposure',
                    ...
                }
            use_cache: Use cached response if available
        
        Returns:
            Generated threat description
        """
        # Extract relevant information
        service_type = config.get('resource_type', 'Unknown Service')
        service_name = config.get('name', config.get('id', 'Unknown'))
        properties = config.get('properties', {})
        threat_name = threat_rule.get('name', 'Unknown Threat')
        threat_category = threat_rule.get('category', 'Security Risk')
        
        # Generate prompt
        prompt = PromptTemplates.threat_description(
            service_type=service_type,
            service_name=service_name,
            properties=properties,
            threat_name=threat_name,
            threat_category=threat_category
        )
        
        system_prompt = get_system_prompt('threat_description')
        
        # Check cache
        if use_cache and self.enable_cache and self.cache:
            cached = self.cache.get(prompt, system_prompt)
            if cached:
                logger.info(f"Using cached threat description for {threat_name}")
                return cached
        
        # Generate with LLM
        logger.info(f"Generating threat description for {threat_name}")
        
        try:
            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=500,
                temperature=0.7
            )
            
            # Cache response
            if use_cache and self.enable_cache and self.cache:
                self.cache.set(prompt, response, system_prompt)
            
            return response
        
        except Exception as e:
            logger.error(f"Failed to generate threat description: {e}")
            return f"Error generating description: {str(e)}"
    
    def generate_remediation(
        self,
        threat: Dict[str, Any],
        context: Dict[str, Any],
        use_cache: bool = True
    ) -> str:
        """
        Generate step-by-step remediation instructions
        
        Args:
            threat: Threat information
                {
                    'name': 'Cloud SQL Instance Publicly Accessible',
                    'description': '...',
                    'severity': 'high',
                    ...
                }
            context: Cloud and resource context
                {
                    'cloud_provider': 'gcp',
                    'service_type': 'google_sql_database_instance',
                    'resource_name': 'main-db',
                    'current_config': {...}
                }
            use_cache: Use cached response if available
        
        Returns:
            Generated remediation instructions
        """
        threat_name = threat.get('name', 'Unknown Threat')
        threat_description = threat.get('description', '')
        
        cloud_provider = context.get('cloud_provider', 'Unknown').upper()
        service_type = context.get('service_type', 'Unknown Service')
        resource_name = context.get('resource_name', 'Unknown Resource')
        current_config = context.get('current_config', {})
        
        # Generate prompt
        prompt = PromptTemplates.remediation(
            threat_name=threat_name,
            threat_description=threat_description,
            cloud_provider=cloud_provider,
            service_type=service_type,
            resource_name=resource_name,
            current_config=current_config
        )
        
        system_prompt = get_system_prompt('remediation')
        
        # Check cache
        if use_cache and self.enable_cache and self.cache:
            cached = self.cache.get(prompt, system_prompt)
            if cached:
                logger.info(f"Using cached remediation for {threat_name}")
                return cached
        
        # Generate with LLM
        logger.info(f"Generating remediation for {threat_name} on {cloud_provider}")
        
        try:
            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=1500,
                temperature=0.5
            )
            
            # Cache response
            if use_cache and self.enable_cache and self.cache:
                self.cache.set(prompt, response, system_prompt)
            
            return response
        
        except Exception as e:
            logger.error(f"Failed to generate remediation: {e}")
            return f"Error generating remediation: {str(e)}"
    
    def generate_compliance_explanation(
        self,
        threat: Dict[str, Any],
        framework: str,
        control_id: Optional[str] = None,
        control_description: Optional[str] = None,
        use_cache: bool = True
    ) -> str:
        """
        Generate compliance framework explanation
        
        Args:
            threat: Threat information
                {
                    'name': 'Cloud SQL Instance Publicly Accessible',
                    'description': '...',
                    ...
                }
            framework: Compliance framework (DORA, BAFIN, ISO27001, CIS, NIST, etc.)
            control_id: Framework control ID (optional)
            control_description: Control description (optional)
            use_cache: Use cached response if available
        
        Returns:
            Generated compliance explanation
        """
        threat_name = threat.get('name', 'Unknown Threat')
        threat_description = threat.get('description', '')
        
        # If control_id not provided, try to extract from threat compliance mappings
        if not control_id:
            compliance_mappings = threat.get('compliance_mappings', [])
            for mapping in compliance_mappings:
                if mapping.get('framework', '').upper() == framework.upper():
                    control_id = mapping.get('control_id')
                    control_description = mapping.get('description')
                    break
        
        if not control_id:
            control_id = "General Security Controls"
        
        # Generate prompt
        prompt = PromptTemplates.compliance_explanation(
            threat_name=threat_name,
            threat_description=threat_description,
            compliance_framework=framework,
            control_id=control_id,
            control_description=control_description
        )
        
        system_prompt = get_system_prompt('compliance')
        
        # Check cache
        if use_cache and self.enable_cache and self.cache:
            cached = self.cache.get(prompt, system_prompt)
            if cached:
                logger.info(f"Using cached compliance explanation for {framework} {control_id}")
                return cached
        
        # Generate with LLM
        logger.info(f"Generating compliance explanation for {framework} {control_id}")
        
        try:
            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=1000,
                temperature=0.6
            )
            
            # Cache response
            if use_cache and self.enable_cache and self.cache:
                self.cache.set(prompt, response, system_prompt)
            
            return response
        
        except Exception as e:
            logger.error(f"Failed to generate compliance explanation: {e}")
            return f"Error generating compliance explanation: {str(e)}"
    
    def generate_attack_scenario(
        self,
        threat: Dict[str, Any],
        service_info: Dict[str, Any],
        use_cache: bool = True
    ) -> str:
        """
        Generate realistic attack scenario
        
        Args:
            threat: Threat information
            service_info: Service and vulnerability information
            use_cache: Use cached response if available
        
        Returns:
            Generated attack scenario
        """
        threat_name = threat.get('name', 'Unknown Threat')
        service_type = service_info.get('service_type', 'Unknown Service')
        vulnerability_details = service_info.get('vulnerability_details', {})
        
        # Generate prompt
        prompt = PromptTemplates.attack_scenario(
            threat_name=threat_name,
            service_type=service_type,
            vulnerability_details=vulnerability_details
        )
        
        system_prompt = get_system_prompt('attack_scenario')
        
        # Check cache
        if use_cache and self.enable_cache and self.cache:
            cached = self.cache.get(prompt, system_prompt)
            if cached:
                logger.info(f"Using cached attack scenario for {threat_name}")
                return cached
        
        # Generate with LLM
        logger.info(f"Generating attack scenario for {threat_name}")
        
        try:
            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=1200,
                temperature=0.7
            )
            
            # Cache response
            if use_cache and self.enable_cache and self.cache:
                self.cache.set(prompt, response, system_prompt)
            
            return response
        
        except Exception as e:
            logger.error(f"Failed to generate attack scenario: {e}")
            return f"Error generating attack scenario: {str(e)}"
    
    def generate_risk_assessment(
        self,
        threat: Dict[str, Any],
        business_context: Dict[str, Any],
        use_cache: bool = True
    ) -> str:
        """
        Generate business risk assessment
        
        Args:
            threat: Threat information
            business_context: Business context information
            use_cache: Use cached response if available
        
        Returns:
            Generated risk assessment
        """
        threat_name = threat.get('name', 'Unknown Threat')
        severity = threat.get('severity', 'Unknown')
        likelihood = threat.get('likelihood', 'Unknown')
        
        # Generate prompt
        prompt = PromptTemplates.risk_assessment(
            threat_name=threat_name,
            severity=severity,
            likelihood=likelihood,
            business_context=business_context
        )
        
        system_prompt = get_system_prompt('risk_assessment')
        
        # Check cache
        if use_cache and self.enable_cache and self.cache:
            cached = self.cache.get(prompt, system_prompt)
            if cached:
                logger.info(f"Using cached risk assessment for {threat_name}")
                return cached
        
        # Generate with LLM
        logger.info(f"Generating risk assessment for {threat_name}")
        
        try:
            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=1000,
                temperature=0.6
            )
            
            # Cache response
            if use_cache and self.enable_cache and self.cache:
                self.cache.set(prompt, response, system_prompt)
            
            return response
        
        except Exception as e:
            logger.error(f"Failed to generate risk assessment: {e}")
            return f"Error generating risk assessment: {str(e)}"
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get generator statistics
        
        Returns:
            Combined statistics from LLM client and cache
        """
        stats = {
            'llm': self.llm_client.get_statistics() if self.llm_client else {}
        }
        
        if self.cache:
            stats['cache'] = self.cache.get_statistics()
        
        return stats
