"""
Threat Database Loader
Load and parse threat definitions from YAML files
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.threat import (
    Threat, Severity, Likelihood, Condition, LogicGroup,
    Mitigation, ComplianceMapping
)

logger = logging.getLogger(__name__)


class ThreatLoaderError(Exception):
    """Custom exception for threat loading errors"""
    pass


class ThreatLoader:
    """
    Load threat definitions from YAML files in threat database
    
    YAML Structure:
    ```yaml
    threats:
      - id: GCP-SQL-001
        name: Cloud SQL Public Access
        description: Database instance is accessible from internet
        severity: high
        likelihood: likely
        category: Data Exposure
        resource_types:
          - google_sql_database_instance
        cloud_providers:
          - gcp
        conditions:
          logic: and
          conditions:
            - field: settings.ip_configuration.ipv4_enabled
              operator: "=="
              value: true
            - field: settings.ip_configuration.authorized_networks
              operator: contains
              value:
                value: "0.0.0.0/0"
        mitigations:
          - description: Disable public IP
            effort: low
            impact: high
            steps:
              - Set ipv4_enabled to false
              - Use Private IP for connections
    ```
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize threat loader
        
        Args:
            db_path: Path to threat database directory. 
                     Defaults to ./threatdb relative to this file.
        """
        if db_path is None:
            # Default to current directory (threatdb module directory)
            current_dir = Path(__file__).parent
            db_path = current_dir
        
        self.db_path = Path(db_path)
        self.threats: Dict[str, Threat] = {}
        self.threat_index: Dict[str, List[Threat]] = {
            'resource_type': {},
            'cloud_provider': {},
            'category': {},
            'severity': {}
        }
        
        logger.info(f"ThreatLoader initialized with db_path: {self.db_path}")
    
    def load_threats(self, reload: bool = False) -> List[Threat]:
        """
        Load all threat definitions from YAML files
        
        Args:
            reload: If True, reload even if already loaded
            
        Returns:
            List of loaded threats
            
        Raises:
            ThreatLoaderError: If loading fails
        """
        if self.threats and not reload:
            logger.debug("Threats already loaded, skipping")
            return list(self.threats.values())
        
        if not self.db_path.exists():
            raise ThreatLoaderError(f"Threat database path not found: {self.db_path}")
        
        if not self.db_path.is_dir():
            raise ThreatLoaderError(f"Threat database path is not a directory: {self.db_path}")
        
        logger.info(f"Loading threats from {self.db_path}")
        
        # Find all YAML files
        yaml_files = list(self.db_path.glob("*.yaml")) + list(self.db_path.glob("*.yml"))
        
        if not yaml_files:
            logger.warning(f"No YAML files found in {self.db_path}")
            return []
        
        logger.info(f"Found {len(yaml_files)} threat definition files")
        
        loaded_count = 0
        errors = []
        
        for yaml_file in yaml_files:
            try:
                threats_from_file = self._load_file(yaml_file)
                loaded_count += len(threats_from_file)
                
                for threat in threats_from_file:
                    self.threats[threat.id] = threat
                    self._index_threat(threat)
                    
            except Exception as e:
                error_msg = f"Error loading {yaml_file.name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        logger.info(f"Loaded {loaded_count} threats from {len(yaml_files)} files")
        
        if errors:
            logger.warning(f"Encountered {len(errors)} errors during loading")
        
        return list(self.threats.values())
    
    def _load_file(self, file_path: Path) -> List[Threat]:
        """Load threats from a single YAML file"""
        logger.debug(f"Loading threats from {file_path.name}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            if not data:
                logger.warning(f"Empty YAML file: {file_path.name}")
                return []
            
            if 'threats' not in data:
                logger.warning(f"No 'threats' key in {file_path.name}")
                return []
            
            threats = []
            for threat_data in data['threats']:
                try:
                    threat = self._parse_threat(threat_data)
                    threats.append(threat)
                except Exception as e:
                    logger.error(f"Error parsing threat {threat_data.get('id', 'unknown')}: {e}")
            
            return threats
            
        except yaml.YAMLError as e:
            raise ThreatLoaderError(f"YAML parsing error in {file_path.name}: {e}")
        except Exception as e:
            raise ThreatLoaderError(f"Error reading {file_path.name}: {e}")
    
    def _parse_threat(self, data: Dict) -> Threat:
        """Parse a single threat definition from dictionary"""
        # Required fields
        required = ['id', 'name', 'description', 'severity', 'likelihood', 'category']
        for field in required:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        
        # Parse severity and likelihood
        try:
            severity = Severity(data['severity'].lower())
        except ValueError:
            raise ValueError(f"Invalid severity: {data['severity']}")
        
        try:
            likelihood = Likelihood(data['likelihood'].lower())
        except ValueError:
            raise ValueError(f"Invalid likelihood: {data['likelihood']}")
        
        # Parse conditions
        condition_logic = None
        if 'conditions' in data:
            condition_logic = self._parse_logic_group(data['conditions'])
        
        # Parse mitigations
        mitigations = []
        for mitigation_data in data.get('mitigations', []):
            mitigation = Mitigation(
                description=mitigation_data['description'],
                effort=mitigation_data.get('effort', 'medium'),
                impact=mitigation_data.get('impact', 'medium'),
                steps=mitigation_data.get('steps', [])
            )
            mitigations.append(mitigation)
        
        # Parse compliance mappings
        compliance_mappings = []
        for mapping_data in data.get('compliance_mappings', []):
            mapping = ComplianceMapping(
                framework=mapping_data['framework'],
                control_id=mapping_data['control_id'],
                description=mapping_data.get('description', '')
            )
            compliance_mappings.append(mapping)
        
        # Create threat object
        threat = Threat(
            id=data['id'],
            name=data['name'],
            description=data['description'],
            severity=severity,
            likelihood=likelihood,
            category=data['category'],
            resource_types=data.get('resource_types', []),
            cloud_providers=data.get('cloud_providers', []),
            condition_logic=condition_logic,
            attack_vectors=data.get('attack_vectors', []),
            exploitability=data.get('exploitability', 'medium'),
            business_impact=data.get('business_impact', 'medium'),
            mitigations=mitigations,
            references=data.get('references', []),
            compliance_mappings=compliance_mappings,
            tags=data.get('tags', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at')
        )
        
        return threat
    
    def _parse_logic_group(self, data: Dict) -> LogicGroup:
        """Parse condition logic group"""
        logic = data.get('logic', 'and').lower()
        
        if logic not in ['and', 'or']:
            raise ValueError(f"Invalid logic operator: {logic}")
        
        # Parse conditions
        conditions = []
        for cond_data in data.get('conditions', []):
            condition = Condition(
                field=cond_data['field'],
                operator=cond_data['operator'],
                value=cond_data['value']
            )
            conditions.append(condition)
        
        # Parse nested groups
        groups = []
        for group_data in data.get('groups', []):
            group = self._parse_logic_group(group_data)
            groups.append(group)
        
        return LogicGroup(
            logic=logic,
            conditions=conditions,
            groups=groups
        )
    
    def _index_threat(self, threat: Threat):
        """Add threat to indexes for fast lookup"""
        # Index by resource type
        for resource_type in threat.resource_types:
            if resource_type not in self.threat_index['resource_type']:
                self.threat_index['resource_type'][resource_type] = []
            self.threat_index['resource_type'][resource_type].append(threat)
        
        # Index by cloud provider
        for provider in threat.cloud_providers:
            if provider not in self.threat_index['cloud_provider']:
                self.threat_index['cloud_provider'][provider] = []
            self.threat_index['cloud_provider'][provider].append(threat)
        
        # Index by category
        if threat.category not in self.threat_index['category']:
            self.threat_index['category'][threat.category] = []
        self.threat_index['category'][threat.category].append(threat)
        
        # Index by severity
        severity_key = threat.severity.value
        if severity_key not in self.threat_index['severity']:
            self.threat_index['severity'][severity_key] = []
        self.threat_index['severity'][severity_key].append(threat)
    
    def get_threat_by_id(self, threat_id: str) -> Optional[Threat]:
        """
        Get a specific threat by ID
        
        Args:
            threat_id: Threat identifier
            
        Returns:
            Threat object or None if not found
        """
        return self.threats.get(threat_id)
    
    def get_threats_by_resource_type(self, resource_type: str) -> List[Threat]:
        """Get all threats applicable to a resource type"""
        return self.threat_index['resource_type'].get(resource_type, [])
    
    def get_threats_by_cloud_provider(self, provider: str) -> List[Threat]:
        """Get all threats applicable to a cloud provider"""
        return self.threat_index['cloud_provider'].get(provider, [])
    
    def get_threats_by_category(self, category: str) -> List[Threat]:
        """Get all threats in a category"""
        return self.threat_index['category'].get(category, [])
    
    def get_threats_by_severity(self, severity: str) -> List[Threat]:
        """Get all threats with specific severity"""
        return self.threat_index['severity'].get(severity.lower(), [])
    
    def get_all_threats(self) -> List[Threat]:
        """Get all loaded threats"""
        return list(self.threats.values())
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about loaded threats"""
        return {
            'total_threats': len(self.threats),
            'by_severity': {
                severity: len(threats)
                for severity, threats in self.threat_index['severity'].items()
            },
            'by_category': {
                category: len(threats)
                for category, threats in self.threat_index['category'].items()
            },
            'by_cloud_provider': {
                provider: len(threats)
                for provider, threats in self.threat_index['cloud_provider'].items()
            },
            'unique_resource_types': len(self.threat_index['resource_type']),
            'unique_categories': len(self.threat_index['category'])
        }


def load_threat_database(db_path: Optional[str] = None) -> ThreatLoader:
    """
    Convenience function to create and load threat database
    
    Args:
        db_path: Path to threat database directory
        
    Returns:
        Loaded ThreatLoader instance
    """
    loader = ThreatLoader(db_path)
    loader.load_threats()
    return loader
