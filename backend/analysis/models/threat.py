"""
Threat Models for Security Analysis
Data classes for threat definitions, conditions, and matched threats
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from datetime import datetime


class Severity(Enum):
    """Threat severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"
    
    @property
    def score(self) -> int:
        """Return numeric score for severity"""
        return {
            "critical": 10,
            "high": 7,
            "medium": 5,
            "low": 3,
            "info": 1
        }[self.value]


class Likelihood(Enum):
    """Threat likelihood levels"""
    CERTAIN = "certain"
    LIKELY = "likely"
    POSSIBLE = "possible"
    UNLIKELY = "unlikely"
    RARE = "rare"
    
    @property
    def score(self) -> float:
        """Return numeric score for likelihood"""
        return {
            "certain": 1.0,
            "likely": 0.8,
            "possible": 0.5,
            "unlikely": 0.3,
            "rare": 0.1
        }[self.value]


class ConditionOperator(Enum):
    """Operators for condition evaluation"""
    EQUALS = "=="
    NOT_EQUALS = "!="
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    REGEX = "regex"
    EXISTS = "exists"
    NOT_EXISTS = "not_exists"
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="


@dataclass
class Condition:
    """
    Condition for threat matching
    
    Examples:
        Simple: {"field": "ipv4_enabled", "operator": "==", "value": true}
        Nested: {"field": "settings.ip_configuration.ipv4_enabled", "operator": "==", "value": true}
        Regex: {"field": "bucket_name", "operator": "regex", "value": ".*-public$"}
        In: {"field": "region", "operator": "in", "value": ["us-east-1", "us-west-2"]}
    """
    field: str  # Property path (supports dot notation)
    operator: str  # Comparison operator
    value: Any  # Expected value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'field': self.field,
            'operator': self.operator,
            'value': self.value
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Condition':
        """Create from dictionary"""
        return Condition(
            field=data['field'],
            operator=data['operator'],
            value=data['value']
        )


@dataclass
class LogicGroup:
    """
    Logical group of conditions (AND/OR)
    
    Examples:
        AND: {"logic": "and", "conditions": [cond1, cond2]}
        OR: {"logic": "or", "conditions": [cond1, cond2]}
        Nested: {"logic": "and", "conditions": [cond1], "groups": [or_group]}
    """
    logic: str  # 'and' or 'or'
    conditions: List[Condition] = field(default_factory=list)
    groups: List['LogicGroup'] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'logic': self.logic,
            'conditions': [c.to_dict() for c in self.conditions],
            'groups': [g.to_dict() for g in self.groups]
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'LogicGroup':
        """Create from dictionary"""
        return LogicGroup(
            logic=data['logic'],
            conditions=[Condition.from_dict(c) for c in data.get('conditions', [])],
            groups=[LogicGroup.from_dict(g) for g in data.get('groups', [])]
        )


@dataclass
class Mitigation:
    """Mitigation recommendation for a threat"""
    description: str
    effort: str  # 'low', 'medium', 'high'
    impact: str  # 'low', 'medium', 'high'
    steps: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'description': self.description,
            'effort': self.effort,
            'impact': self.impact,
            'steps': self.steps
        }


@dataclass
class ComplianceMapping:
    """Compliance framework mapping"""
    framework: str  # e.g., "NIST", "CIS", "GDPR"
    control_id: str  # e.g., "AC-3", "5.1"
    description: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'framework': self.framework,
            'control_id': self.control_id,
            'description': self.description
        }


@dataclass
class Threat:
    """
    Threat definition loaded from threat database
    """
    id: str  # Unique threat identifier (e.g., "GCP-SQL-001")
    name: str  # Threat name
    description: str  # Detailed description
    severity: Severity
    likelihood: Likelihood
    category: str  # e.g., "Data Exposure", "Access Control"
    
    # Resource matching
    resource_types: List[str] = field(default_factory=list)  # e.g., ["google_sql_database_instance"]
    cloud_providers: List[str] = field(default_factory=list)  # e.g., ["gcp", "aws"]
    
    # Conditions for matching
    condition_logic: Optional[LogicGroup] = None
    
    # Threat details
    attack_vectors: List[str] = field(default_factory=list)
    exploitability: str = "medium"  # 'low', 'medium', 'high'
    business_impact: str = "medium"
    
    # Remediation
    mitigations: List[Mitigation] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    compliance_mappings: List[ComplianceMapping] = field(default_factory=list)
    
    # Metadata
    tags: List[str] = field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    @property
    def risk_score(self) -> float:
        """Calculate risk score (severity * likelihood)"""
        return self.severity.score * self.likelihood.score
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'severity': self.severity.value,
            'likelihood': self.likelihood.value,
            'category': self.category,
            'resource_types': self.resource_types,
            'cloud_providers': self.cloud_providers,
            'condition_logic': self.condition_logic.to_dict() if self.condition_logic else None,
            'attack_vectors': self.attack_vectors,
            'exploitability': self.exploitability,
            'business_impact': self.business_impact,
            'mitigations': [m.to_dict() for m in self.mitigations],
            'references': self.references,
            'compliance_mappings': [c.to_dict() for c in self.compliance_mappings],
            'tags': self.tags,
            'risk_score': self.risk_score,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }


@dataclass
class MatchedThreat:
    """
    A threat that has been matched to a specific resource
    """
    threat: Threat
    resource_id: str  # Full resource name (e.g., "google_sql_database_instance.master")
    resource_type: str
    resource_properties: Dict[str, Any]
    
    # Matching details
    matched_conditions: List[str] = field(default_factory=list)  # Which conditions matched
    confidence: float = 1.0  # 0.0 to 1.0
    
    # Context
    matched_at: datetime = field(default_factory=datetime.utcnow)
    location: Optional[str] = None  # File path where resource is defined
    
    @property
    def risk_score(self) -> float:
        """Calculate final risk score with confidence"""
        return self.threat.risk_score * self.confidence
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'threat': self.threat.to_dict(),
            'resource_id': self.resource_id,
            'resource_type': self.resource_type,
            'resource_properties': self.resource_properties,
            'matched_conditions': self.matched_conditions,
            'confidence': self.confidence,
            'risk_score': self.risk_score,
            'matched_at': self.matched_at.isoformat(),
            'location': self.location,
            'severity': self.threat.severity.value,
            'category': self.threat.category
        }


@dataclass
class ThreatMatchResult:
    """
    Result of threat matching operation
    """
    matched_threats: List[MatchedThreat] = field(default_factory=list)
    total_resources_scanned: int = 0
    total_threats_checked: int = 0
    execution_time_ms: float = 0.0
    
    # Statistics
    by_severity: Dict[str, int] = field(default_factory=dict)
    by_category: Dict[str, int] = field(default_factory=dict)
    by_resource_type: Dict[str, int] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'matched_threats': [mt.to_dict() for mt in self.matched_threats],
            'total_matched': len(self.matched_threats),
            'total_resources_scanned': self.total_resources_scanned,
            'total_threats_checked': self.total_threats_checked,
            'execution_time_ms': self.execution_time_ms,
            'statistics': {
                'by_severity': self.by_severity,
                'by_category': self.by_category,
                'by_resource_type': self.by_resource_type
            }
        }
    
    def get_critical_threats(self) -> List[MatchedThreat]:
        """Get only critical severity threats"""
        return [mt for mt in self.matched_threats if mt.threat.severity == Severity.CRITICAL]
    
    def get_high_risk_threats(self, threshold: float = 5.0) -> List[MatchedThreat]:
        """Get threats with risk score above threshold"""
        return [mt for mt in self.matched_threats if mt.risk_score >= threshold]
    
    def sort_by_risk(self) -> None:
        """Sort matched threats by risk score (descending)"""
        self.matched_threats.sort(key=lambda mt: mt.risk_score, reverse=True)
