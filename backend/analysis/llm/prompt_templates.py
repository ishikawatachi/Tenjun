"""
Prompt Templates

Pre-defined prompt templates for threat description, remediation, and
compliance explanation generation.
"""

from typing import Dict, Any, Optional


class PromptTemplates:
    """Collection of prompt templates for LLM generation"""
    
    @staticmethod
    def threat_description(
        service_type: str,
        service_name: str,
        properties: Dict[str, Any],
        threat_name: str,
        threat_category: str
    ) -> str:
        """
        Generate threat description prompt
        
        Args:
            service_type: Type of service (e.g., "Cloud SQL", "S3 Bucket")
            service_name: Name of the service instance
            properties: Relevant configuration properties
            threat_name: Name of the threat
            threat_category: Category (e.g., "Data Exposure", "Access Control")
        
        Returns:
            Formatted prompt string
        """
        properties_str = "\n".join([f"  - {k}: {v}" for k, v in properties.items()])
        
        prompt = f"""Given this {service_type} configuration:

Service: {service_name}
Configuration:
{properties_str}

Threat: {threat_name}
Category: {threat_category}

Explain the security threat in 2-3 sentences for a security architect. Focus on:
1. What is the vulnerability?
2. What could an attacker exploit?
3. What is the potential impact?

Be specific and technical, but concise."""

        return prompt
    
    @staticmethod
    def remediation(
        threat_name: str,
        threat_description: str,
        cloud_provider: str,
        service_type: str,
        resource_name: str,
        current_config: Dict[str, Any]
    ) -> str:
        """
        Generate remediation prompt
        
        Args:
            threat_name: Name of the threat
            threat_description: Description of the threat
            cloud_provider: Cloud provider (GCP, AWS, Azure)
            service_type: Type of service
            resource_name: Resource name
            current_config: Current vulnerable configuration
        
        Returns:
            Formatted prompt string
        """
        config_str = "\n".join([f"  {k}: {v}" for k, v in current_config.items()])
        
        prompt = f"""How to fix this security threat in {cloud_provider}?

Threat: {threat_name}
Description: {threat_description}

Service Type: {service_type}
Resource: {resource_name}

Current Configuration:
{config_str}

Provide:
1. Step-by-step remediation instructions
2. Specific {cloud_provider} console steps or CLI commands
3. Terraform code example (if applicable)
4. Verification steps to confirm the fix

Be specific to {cloud_provider} and provide actionable, copy-paste ready code."""

        return prompt
    
    @staticmethod
    def compliance_explanation(
        threat_name: str,
        threat_description: str,
        compliance_framework: str,
        control_id: str,
        control_description: Optional[str] = None
    ) -> str:
        """
        Generate compliance explanation prompt
        
        Args:
            threat_name: Name of the threat
            threat_description: Description of the threat
            compliance_framework: Framework (DORA, BAFIN, ISO27001, etc.)
            control_id: Control ID from framework
            control_description: Description of the control (optional)
        
        Returns:
            Formatted prompt string
        """
        control_info = f"\nControl Description: {control_description}" if control_description else ""
        
        prompt = f"""How does this security threat map to {compliance_framework}?

Threat: {threat_name}
Description: {threat_description}

Framework: {compliance_framework}
Control ID: {control_id}{control_info}

Explain:
1. What does the {compliance_framework} {control_id} control require?
2. How does this threat violate the control?
3. What remediation is needed to achieve compliance?
4. What evidence/documentation would an auditor need?

Be specific to {compliance_framework} requirements and provide practical guidance for compliance teams."""

        return prompt
    
    @staticmethod
    def attack_scenario(
        threat_name: str,
        service_type: str,
        vulnerability_details: Dict[str, Any]
    ) -> str:
        """
        Generate attack scenario prompt
        
        Args:
            threat_name: Name of the threat
            service_type: Type of service
            vulnerability_details: Details about the vulnerability
        
        Returns:
            Formatted prompt string
        """
        details_str = "\n".join([f"  - {k}: {v}" for k, v in vulnerability_details.items()])
        
        prompt = f"""Describe a realistic attack scenario for this threat:

Threat: {threat_name}
Service: {service_type}

Vulnerability Details:
{details_str}

Provide:
1. Attacker profile (skill level, access required)
2. Step-by-step attack sequence
3. Tools/techniques used
4. Timeline (how quickly could this be exploited?)
5. Detection opportunities

Write from the perspective of a red team assessment, being specific about how the attack would unfold."""

        return prompt
    
    @staticmethod
    def risk_assessment(
        threat_name: str,
        severity: str,
        likelihood: str,
        business_context: Dict[str, Any]
    ) -> str:
        """
        Generate risk assessment prompt
        
        Args:
            threat_name: Name of the threat
            severity: Severity level
            likelihood: Likelihood level
            business_context: Business context information
        
        Returns:
            Formatted prompt string
        """
        context_str = "\n".join([f"  - {k}: {v}" for k, v in business_context.items()])
        
        prompt = f"""Assess the business risk for this threat:

Threat: {threat_name}
Technical Severity: {severity}
Likelihood: {likelihood}

Business Context:
{context_str}

Provide:
1. Business impact analysis (financial, reputational, operational)
2. Regulatory/legal implications
3. Customer/user impact
4. Priority level for remediation (Critical/High/Medium/Low)
5. Recommended timeline for remediation

Focus on business risk, not just technical severity."""

        return prompt
    
    @staticmethod
    def mitigation_alternatives(
        threat_name: str,
        primary_mitigation: str,
        constraints: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate alternative mitigations prompt
        
        Args:
            threat_name: Name of the threat
            primary_mitigation: Primary recommended mitigation
            constraints: Any constraints (budget, timeline, etc.)
        
        Returns:
            Formatted prompt string
        """
        constraints_str = ""
        if constraints:
            constraints_str = "\nConstraints:\n" + "\n".join([f"  - {k}: {v}" for k, v in constraints.items()])
        
        prompt = f"""Suggest alternative mitigations for this threat:

Threat: {threat_name}
Primary Recommended Mitigation: {primary_mitigation}{constraints_str}

Provide 3-5 alternative approaches, each with:
1. Description of the approach
2. Pros and cons
3. Cost/complexity (Low/Medium/High)
4. Implementation timeline estimate
5. Effectiveness compared to primary mitigation

Consider compensating controls, architectural changes, and procedural solutions."""

        return prompt


# System prompts for different generation types
SYSTEM_PROMPTS = {
    'threat_description': """You are a security architect explaining cloud infrastructure threats. 
Be precise, technical, and focus on the actual security implications. 
Avoid generic statements - be specific to the configuration provided.""",
    
    'remediation': """You are a DevSecOps engineer providing actionable remediation guidance. 
Your instructions must be specific, tested, and ready to implement. 
Provide code examples that can be used directly in production.""",
    
    'compliance': """You are a compliance analyst mapping security controls to framework requirements. 
You understand regulatory requirements deeply and can translate technical controls into compliance language. 
Provide guidance that will satisfy auditors.""",
    
    'attack_scenario': """You are a red team security researcher describing realistic attack scenarios. 
Your scenarios should be technically accurate and based on real-world attack patterns. 
Be specific about tools, techniques, and procedures.""",
    
    'risk_assessment': """You are a risk analyst assessing business impact of security threats. 
Consider financial, operational, reputational, and regulatory impacts. 
Provide actionable risk ratings and remediation timelines."""
}


def get_system_prompt(prompt_type: str) -> str:
    """
    Get system prompt for a specific prompt type
    
    Args:
        prompt_type: Type of prompt (threat_description, remediation, compliance, etc.)
    
    Returns:
        System prompt string
    """
    return SYSTEM_PROMPTS.get(prompt_type, SYSTEM_PROMPTS['threat_description'])
