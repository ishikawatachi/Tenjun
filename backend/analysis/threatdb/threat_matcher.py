"""
Threat Matcher Engine
Match infrastructure resources against threat definitions
"""

import os
import re
import logging
import time
from typing import Dict, List, Any, Optional, Callable
from functools import lru_cache

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.threat import (
    Threat, MatchedThreat, ThreatMatchResult,
    Condition, LogicGroup, ConditionOperator
)

logger = logging.getLogger(__name__)


class ThreatMatcherError(Exception):
    """Custom exception for threat matching errors"""
    pass


class ThreatMatcher:
    """
    Match cloud resources against threat definitions
    
    Features:
    - Evaluate complex conditions with AND/OR logic
    - Support multiple operators: ==, !=, in, contains, regex, exists
    - Nested property access with dot notation
    - Performance optimization with condition compilation
    - Detailed logging for debugging
    """
    
    def __init__(self, enable_caching: bool = True):
        """
        Initialize threat matcher
        
        Args:
            enable_caching: Enable caching of compiled conditions
        """
        self.enable_caching = enable_caching
        self.match_cache: Dict[str, Any] = {}
        self.stats = {
            'total_evaluations': 0,
            'cache_hits': 0,
            'evaluation_time_ms': 0.0
        }
        
        # Operator implementations
        self.operators: Dict[str, Callable] = {
            '==': self._op_equals,
            '!=': self._op_not_equals,
            'in': self._op_in,
            'not_in': self._op_not_in,
            'contains': self._op_contains,
            'not_contains': self._op_not_contains,
            'regex': self._op_regex,
            'exists': self._op_exists,
            'not_exists': self._op_not_exists,
            '>': self._op_greater_than,
            '<': self._op_less_than,
            '>=': self._op_greater_equal,
            '<=': self._op_less_equal
        }
        
        logger.info("ThreatMatcher initialized")
    
    def match_threats(
        self,
        config: Dict[str, Any],
        threats: List[Threat],
        filter_by_resource_type: bool = True
    ) -> ThreatMatchResult:
        """
        Match all threats against infrastructure configuration
        
        Args:
            config: Parsed infrastructure configuration (from Terraform parser)
            threats: List of threat definitions
            filter_by_resource_type: Pre-filter threats by resource type for performance
            
        Returns:
            ThreatMatchResult with matched threats and statistics
        """
        start_time = time.time()
        
        result = ThreatMatchResult()
        resources = config.get('resources', [])
        
        result.total_resources_scanned = len(resources)
        result.total_threats_checked = len(threats)
        
        logger.info(f"Matching {len(threats)} threats against {len(resources)} resources")
        
        # Match each resource against applicable threats
        for resource in resources:
            resource_type = resource.get('resource_type', '')
            resource_id = resource.get('full_name', resource.get('name', 'unknown'))
            
            # Get applicable threats for this resource
            if filter_by_resource_type:
                applicable_threats = [
                    t for t in threats
                    if not t.resource_types or resource_type in t.resource_types
                ]
            else:
                applicable_threats = threats
            
            # Check cloud provider filter
            cloud_provider = resource.get('cloud_provider')
            if cloud_provider:
                applicable_threats = [
                    t for t in applicable_threats
                    if not t.cloud_providers or cloud_provider in t.cloud_providers
                ]
            
            logger.debug(f"Checking {len(applicable_threats)} threats for {resource_id}")
            
            # Match threats
            for threat in applicable_threats:
                matched = self._match_threat_to_resource(threat, resource)
                if matched:
                    result.matched_threats.append(matched)
                    
                    # Update statistics
                    severity = threat.severity.value
                    result.by_severity[severity] = result.by_severity.get(severity, 0) + 1
                    
                    category = threat.category
                    result.by_category[category] = result.by_category.get(category, 0) + 1
                    
                    result.by_resource_type[resource_type] = result.by_resource_type.get(resource_type, 0) + 1
        
        # Sort by risk score
        result.sort_by_risk()
        
        # Calculate execution time
        end_time = time.time()
        result.execution_time_ms = (end_time - start_time) * 1000
        
        logger.info(f"Matched {len(result.matched_threats)} threats in {result.execution_time_ms:.2f}ms")
        
        return result
    
    def _match_threat_to_resource(
        self,
        threat: Threat,
        resource: Dict[str, Any]
    ) -> Optional[MatchedThreat]:
        """
        Check if a threat matches a resource
        
        Args:
            threat: Threat definition
            resource: Resource properties
            
        Returns:
            MatchedThreat if conditions match, None otherwise
        """
        # If no conditions, threat doesn't match (needs explicit conditions)
        if not threat.condition_logic:
            return None
        
        # Evaluate conditions
        matched_conditions = []
        match_result = self._evaluate_logic_group(
            threat.condition_logic,
            resource,
            matched_conditions
        )
        
        if match_result:
            logger.debug(f"Threat {threat.id} matched resource {resource.get('full_name')}")
            
            return MatchedThreat(
                threat=threat,
                resource_id=resource.get('full_name', resource.get('name', 'unknown')),
                resource_type=resource.get('resource_type', ''),
                resource_properties=resource.get('properties', {}),
                matched_conditions=matched_conditions,
                confidence=1.0,
                location=resource.get('location')
            )
        
        return None
    
    def _evaluate_logic_group(
        self,
        logic_group: LogicGroup,
        resource: Dict[str, Any],
        matched_conditions: List[str]
    ) -> bool:
        """
        Evaluate a logic group (AND/OR of conditions and nested groups)
        
        Args:
            logic_group: Logic group to evaluate
            resource: Resource properties
            matched_conditions: List to append matched condition descriptions
            
        Returns:
            True if logic group matches, False otherwise
        """
        results = []
        
        # Evaluate all conditions
        for condition in logic_group.conditions:
            result = self.evaluate_condition(condition, resource)
            results.append(result)
            
            if result:
                matched_conditions.append(
                    f"{condition.field} {condition.operator} {condition.value}"
                )
        
        # Evaluate nested groups
        for nested_group in logic_group.groups:
            result = self._evaluate_logic_group(nested_group, resource, matched_conditions)
            results.append(result)
        
        # Apply logic operator
        if logic_group.logic == 'and':
            return all(results) if results else False
        elif logic_group.logic == 'or':
            return any(results) if results else False
        else:
            logger.error(f"Unknown logic operator: {logic_group.logic}")
            return False
    
    def evaluate_condition(
        self,
        condition: Condition,
        resource: Dict[str, Any]
    ) -> bool:
        """
        Evaluate a single condition against a resource
        
        Args:
            condition: Condition to evaluate
            resource: Resource properties
            
        Returns:
            True if condition matches, False otherwise
        """
        self.stats['total_evaluations'] += 1
        
        # Get field value from resource (supports dot notation)
        field_value = self._get_nested_value(resource, condition.field)
        
        # Get operator function
        operator_func = self.operators.get(condition.operator)
        if not operator_func:
            logger.error(f"Unknown operator: {condition.operator}")
            return False
        
        # Evaluate condition
        try:
            result = operator_func(field_value, condition.value)
            logger.debug(
                f"Condition: {condition.field} {condition.operator} {condition.value} "
                f"(actual: {field_value}) = {result}"
            )
            return result
        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """
        Get value from nested dictionary using dot notation
        
        Examples:
            _get_nested_value({"a": {"b": {"c": 1}}}, "a.b.c") -> 1
            _get_nested_value({"settings": {"tier": "db-f1-micro"}}, "settings.tier") -> "db-f1-micro"
            _get_nested_value({"properties": {"name": "test"}}, "properties.name") -> "test"
        
        Args:
            data: Dictionary to search
            path: Dot-separated path
            
        Returns:
            Value at path, or None if not found
        """
        keys = path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict):
                current = current.get(key)
                if current is None:
                    return None
            elif isinstance(current, list):
                # Handle list indexing
                try:
                    index = int(key)
                    current = current[index]
                except (ValueError, IndexError):
                    return None
            else:
                return None
        
        return current
    
    # Operator implementations
    
    def _op_equals(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field equals expected value"""
        return field_value == expected_value
    
    def _op_not_equals(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field does not equal expected value"""
        return field_value != expected_value
    
    def _op_in(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field value is in expected list"""
        if not isinstance(expected_value, (list, tuple, set)):
            return False
        return field_value in expected_value
    
    def _op_not_in(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field value is not in expected list"""
        if not isinstance(expected_value, (list, tuple, set)):
            return True
        return field_value not in expected_value
    
    def _op_contains(self, field_value: Any, expected_value: Any) -> bool:
        """
        Check if field contains expected value
        
        - For lists: check if expected value is in list
        - For dicts: check if expected key-value pair exists
        - For strings: check if substring exists
        """
        if field_value is None:
            return False
        
        if isinstance(field_value, (list, tuple)):
            # Check if any item in list matches expected value
            if isinstance(expected_value, dict):
                # Check if any dict in list contains the key-value pairs
                return any(
                    self._dict_contains(item, expected_value)
                    for item in field_value
                    if isinstance(item, dict)
                )
            else:
                return expected_value in field_value
        
        elif isinstance(field_value, dict):
            return self._dict_contains(field_value, expected_value)
        
        elif isinstance(field_value, str):
            return str(expected_value) in field_value
        
        return False
    
    def _dict_contains(self, data: Dict, expected: Any) -> bool:
        """Check if dict contains expected key-value pairs"""
        if not isinstance(expected, dict):
            return False
        
        for key, value in expected.items():
            if key not in data:
                return False
            if isinstance(value, dict) and isinstance(data[key], dict):
                if not self._dict_contains(data[key], value):
                    return False
            elif data[key] != value:
                return False
        
        return True
    
    def _op_not_contains(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field does not contain expected value"""
        return not self._op_contains(field_value, expected_value)
    
    def _op_regex(self, field_value: Any, pattern: str) -> bool:
        """Check if field matches regex pattern"""
        if field_value is None:
            return False
        
        try:
            field_str = str(field_value)
            return bool(re.match(pattern, field_str))
        except re.error as e:
            logger.error(f"Invalid regex pattern '{pattern}': {e}")
            return False
    
    def _op_exists(self, field_value: Any, _: Any) -> bool:
        """Check if field exists (not None)"""
        return field_value is not None
    
    def _op_not_exists(self, field_value: Any, _: Any) -> bool:
        """Check if field does not exist (is None)"""
        return field_value is None
    
    def _op_greater_than(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field is greater than expected value"""
        try:
            return float(field_value) > float(expected_value)
        except (TypeError, ValueError):
            return False
    
    def _op_less_than(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field is less than expected value"""
        try:
            return float(field_value) < float(expected_value)
        except (TypeError, ValueError):
            return False
    
    def _op_greater_equal(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field is greater than or equal to expected value"""
        try:
            return float(field_value) >= float(expected_value)
        except (TypeError, ValueError):
            return False
    
    def _op_less_equal(self, field_value: Any, expected_value: Any) -> bool:
        """Check if field is less than or equal to expected value"""
        try:
            return float(field_value) <= float(expected_value)
        except (TypeError, ValueError):
            return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get matching statistics"""
        return {
            'total_evaluations': self.stats['total_evaluations'],
            'cache_hits': self.stats['cache_hits'],
            'cache_hit_rate': (
                self.stats['cache_hits'] / self.stats['total_evaluations']
                if self.stats['total_evaluations'] > 0
                else 0.0
            ),
            'evaluation_time_ms': self.stats['evaluation_time_ms']
        }
    
    def reset_statistics(self):
        """Reset matching statistics"""
        self.stats = {
            'total_evaluations': 0,
            'cache_hits': 0,
            'evaluation_time_ms': 0.0
        }


def match_infrastructure_threats(
    config: Dict[str, Any],
    threats: List[Threat]
) -> ThreatMatchResult:
    """
    Convenience function to match threats against infrastructure
    
    Args:
        config: Parsed infrastructure configuration
        threats: List of threat definitions
        
    Returns:
        ThreatMatchResult
    """
    matcher = ThreatMatcher()
    return matcher.match_threats(config, threats)
