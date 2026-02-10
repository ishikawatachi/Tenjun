"""
Terraform Configuration Models
Data classes for Terraform resources, variables, and providers
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime


@dataclass
class Resource:
    """Terraform resource definition"""
    resource_type: str  # e.g., "google_sql_database_instance", "aws_s3_bucket"
    name: str  # Resource name in Terraform
    properties: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None  # File path where defined
    line_number: Optional[int] = None
    depends_on: List[str] = field(default_factory=list)
    provider: Optional[str] = None  # Provider name (aws, google, azurerm)
    
    @property
    def full_name(self) -> str:
        """Return fully qualified resource name"""
        return f"{self.resource_type}.{self.name}"
    
    @property
    def cloud_provider(self) -> Optional[str]:
        """Extract cloud provider from resource type"""
        if self.resource_type.startswith('google_'):
            return 'gcp'
        elif self.resource_type.startswith('aws_'):
            return 'aws'
        elif self.resource_type.startswith('azurerm_'):
            return 'azure'
        elif self.resource_type.startswith('alicloud_'):
            return 'alibaba'
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'resource_type': self.resource_type,
            'name': self.name,
            'full_name': self.full_name,
            'properties': self.properties,
            'location': self.location,
            'line_number': self.line_number,
            'depends_on': self.depends_on,
            'provider': self.provider,
            'cloud_provider': self.cloud_provider
        }


@dataclass
class Variable:
    """Terraform variable definition"""
    name: str
    type: Optional[str] = None  # string, number, bool, list, map, object
    default: Any = None
    description: Optional[str] = None
    sensitive: bool = False
    validation_rules: List[Dict[str, Any]] = field(default_factory=list)
    location: Optional[str] = None
    line_number: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'name': self.name,
            'type': self.type,
            'default': self.default,
            'description': self.description,
            'sensitive': self.sensitive,
            'validation_rules': self.validation_rules,
            'location': self.location,
            'line_number': self.line_number
        }


@dataclass
class Output:
    """Terraform output definition"""
    name: str
    value: Any
    description: Optional[str] = None
    sensitive: bool = False
    location: Optional[str] = None
    line_number: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'name': self.name,
            'value': str(self.value),  # Convert to string for serialization
            'description': self.description,
            'sensitive': self.sensitive,
            'location': self.location,
            'line_number': self.line_number
        }


@dataclass
class Provider:
    """Terraform provider configuration"""
    name: str  # aws, google, azurerm, etc.
    alias: Optional[str] = None
    version: Optional[str] = None
    region: Optional[str] = None
    configuration: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None
    line_number: Optional[int] = None
    
    @property
    def full_name(self) -> str:
        """Return provider name with alias if present"""
        if self.alias:
            return f"{self.name}.{self.alias}"
        return self.name
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'name': self.name,
            'full_name': self.full_name,
            'alias': self.alias,
            'version': self.version,
            'region': self.region,
            'configuration': self.configuration,
            'location': self.location,
            'line_number': self.line_number
        }


@dataclass
class DataSource:
    """Terraform data source definition"""
    data_type: str  # e.g., "aws_ami", "google_compute_image"
    name: str
    properties: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None
    line_number: Optional[int] = None
    provider: Optional[str] = None
    
    @property
    def full_name(self) -> str:
        """Return fully qualified data source name"""
        return f"data.{self.data_type}.{self.name}"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'data_type': self.data_type,
            'name': self.name,
            'full_name': self.full_name,
            'properties': self.properties,
            'location': self.location,
            'line_number': self.line_number,
            'provider': self.provider
        }


@dataclass
class Module:
    """Terraform module reference"""
    name: str
    source: str  # Local path or registry URL
    version: Optional[str] = None
    inputs: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None
    line_number: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'name': self.name,
            'source': self.source,
            'version': self.version,
            'inputs': self.inputs,
            'location': self.location,
            'line_number': self.line_number
        }


@dataclass
class TerraformConfiguration:
    """Complete Terraform configuration"""
    resources: List[Resource] = field(default_factory=list)
    data_sources: List[DataSource] = field(default_factory=list)
    variables: List[Variable] = field(default_factory=list)
    outputs: List[Output] = field(default_factory=list)
    providers: List[Provider] = field(default_factory=list)
    modules: List[Module] = field(default_factory=list)
    terraform_version: Optional[str] = None
    backend_config: Optional[Dict[str, Any]] = None
    parsed_at: datetime = field(default_factory=datetime.utcnow)
    source_files: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'resources': [r.to_dict() for r in self.resources],
            'data_sources': [d.to_dict() for d in self.data_sources],
            'variables': [v.to_dict() for v in self.variables],
            'outputs': [o.to_dict() for o in self.outputs],
            'providers': [p.to_dict() for p in self.providers],
            'modules': [m.to_dict() for m in self.modules],
            'terraform_version': self.terraform_version,
            'backend_config': self.backend_config,
            'parsed_at': self.parsed_at.isoformat(),
            'source_files': self.source_files,
            'statistics': {
                'total_resources': len(self.resources),
                'total_data_sources': len(self.data_sources),
                'total_variables': len(self.variables),
                'total_outputs': len(self.outputs),
                'total_providers': len(self.providers),
                'total_modules': len(self.modules),
                'providers_by_type': self._count_by_provider()
            }
        }
    
    def _count_by_provider(self) -> Dict[str, int]:
        """Count resources by cloud provider"""
        counts = {}
        for resource in self.resources:
            provider = resource.cloud_provider or 'other'
            counts[provider] = counts.get(provider, 0) + 1
        return counts
