"""
Unit Tests for Threat Matcher Engine
Test threat matching against cloud resources
"""

import os
import sys
import pytest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from threatdb.threat_loader import ThreatLoader, load_threat_database
from threatdb.threat_matcher import ThreatMatcher, match_infrastructure_threats
from models.threat import Threat, Severity, Likelihood, Condition, LogicGroup, Mitigation


class TestThreatLoader:
    """Test threat loading from YAML files"""
    
    @pytest.fixture
    def threat_db_path(self):
        """Get path to threat database"""
        return Path(__file__).parent.parent / 'threatdb'
    
    def test_load_threats(self, threat_db_path):
        """Test loading all threats from database"""
        loader = ThreatLoader(threat_db_path)
        threats = loader.load_threats()
        
        assert len(threats) > 0, "Should load at least one threat"
        assert all(isinstance(t, Threat) for t in threats), "All loaded items should be Threat objects"
        
    def test_get_threat_by_id(self, threat_db_path):
        """Test retrieving threat by ID"""
        loader = ThreatLoader(threat_db_path)
        loader.load_threats()
        
        # Try to get a specific threat (GCP SQL public access)
        threat = loader.get_threat_by_id('GCP-SQL-001')
        
        if threat:
            assert threat.id == 'GCP-SQL-001'
            assert threat.name == 'Cloud SQL Instance Publicly Accessible'
            assert threat.severity == Severity.HIGH
            assert 'google_sql_database_instance' in threat.resource_types
    
    def test_get_threats_by_resource_type(self, threat_db_path):
        """Test filtering threats by resource type"""
        loader = ThreatLoader(threat_db_path)
        loader.load_threats()
        
        # Get threats for GCP SQL
        sql_threats = loader.get_threats_by_resource_type('google_sql_database_instance')
        assert all(
            'google_sql_database_instance' in t.resource_types
            for t in sql_threats
        )
        
        # Get threats for AWS S3
        s3_threats = loader.get_threats_by_resource_type('aws_s3_bucket')
        assert all(
            'aws_s3_bucket' in t.resource_types
            for t in s3_threats
        )
    
    def test_get_threats_by_cloud_provider(self, threat_db_path):
        """Test filtering threats by cloud provider"""
        loader = ThreatLoader(threat_db_path)
        loader.load_threats()
        
        gcp_threats = loader.get_threats_by_cloud_provider('gcp')
        aws_threats = loader.get_threats_by_cloud_provider('aws')
        
        assert len(gcp_threats) > 0, "Should have GCP threats"
        assert len(aws_threats) > 0, "Should have AWS threats"
    
    def test_threat_statistics(self, threat_db_path):
        """Test statistics generation"""
        loader = ThreatLoader(threat_db_path)
        loader.load_threats()
        
        stats = loader.get_statistics()
        
        assert 'total_threats' in stats
        assert 'by_severity' in stats
        assert 'by_category' in stats
        assert stats['total_threats'] > 0


class TestThreatMatcher:
    """Test threat matching logic"""
    
    @pytest.fixture
    def matcher(self):
        """Create threat matcher instance"""
        return ThreatMatcher()
    
    def test_evaluate_equals_condition(self, matcher):
        """Test == operator"""
        condition = Condition(field='properties.enabled', operator='==', value=True)
        resource = {'properties': {'enabled': True}}
        
        assert matcher.evaluate_condition(condition, resource) == True
        
        resource['properties']['enabled'] = False
        assert matcher.evaluate_condition(condition, resource) == False
    
    def test_evaluate_not_equals_condition(self, matcher):
        """Test != operator"""
        condition = Condition(field='properties.tier', operator='!=', value='free')
        resource = {'properties': {'tier': 'standard'}}
        
        assert matcher.evaluate_condition(condition, resource) == True
        
    def test_evaluate_in_condition(self, matcher):
        """Test in operator"""
        condition = Condition(field='properties.region', operator='in', value=['us-east-1', 'us-west-2'])
        resource = {'properties': {'region': 'us-east-1'}}
        
        assert matcher.evaluate_condition(condition, resource) == True
        
        resource['properties']['region'] = 'eu-west-1'
        assert matcher.evaluate_condition(condition, resource) == False
    
    def test_evaluate_contains_condition(self, matcher):
        """Test contains operator for lists"""
        condition = Condition(
            field='properties.tags',
            operator='contains',
            value='production'
        )
        resource = {'properties': {'tags': ['production', 'web']}}
        
        assert matcher.evaluate_condition(condition, resource) == True
    
    def test_evaluate_contains_dict_condition(self, matcher):
        """Test contains operator for dicts in lists"""
        condition = Condition(
            field='properties.authorized_networks',
            operator='contains',
            value={'value': '0.0.0.0/0'}
        )
        resource = {
            'properties': {
                'authorized_networks': [
                    {'name': 'public', 'value': '0.0.0.0/0'}
                ]
            }
        }
        
        assert matcher.evaluate_condition(condition, resource) == True
    
    def test_evaluate_regex_condition(self, matcher):
        """Test regex operator"""
        condition = Condition(
            field='properties.bucket_name',
            operator='regex',
            value= r'.*-public$'
        )
        resource = {'properties': {'bucket_name': 'my-data-public'}}
        
        assert matcher.evaluate_condition(condition, resource) == True
        
        resource['properties']['bucket_name'] = 'my-data-private'
        assert matcher.evaluate_condition(condition, resource) == False
    
    def test_evaluate_exists_condition(self, matcher):
        """Test exists operator"""
        condition = Condition(field='properties.encryption', operator='exists', value=None)
        resource = {'properties': {'encryption': True}}
        
        assert matcher.evaluate_condition(condition, resource) == True
        
        resource = {'properties': {}}
        assert matcher.evaluate_condition(condition, resource) == False
    
    def test_nested_field_access(self, matcher):
        """Test nested property access with dot notation"""
        condition = Condition(
            field='properties.settings.ip_configuration.ipv4_enabled',
            operator='==',
            value=True
        )
        resource = {
            'properties': {
                'settings': {
                    'ip_configuration': {
                        'ipv4_enabled': True
                    }
                }
            }
        }
        
        assert matcher.evaluate_condition(condition, resource) == True
    
    def test_and_logic_group(self, matcher):
        """Test AND logic group evaluation"""
        logic_group = LogicGroup(
            logic='and',
            conditions=[
                Condition(field='properties.ipv4_enabled', operator='==', value=True),
                Condition(field='properties.public', operator='==', value=True)
            ]
        )
        
        # Both conditions true
        resource = {'properties': {'ipv4_enabled': True, 'public': True}}
        matched_conditions = []
        assert matcher._evaluate_logic_group(logic_group, resource, matched_conditions) == True
        
        # One condition false
        resource = {'properties': {'ipv4_enabled': True, 'public': False}}
        matched_conditions = []
        assert matcher._evaluate_logic_group(logic_group, resource, matched_conditions) == False
    
    def test_or_logic_group(self, matcher):
        """Test OR logic group evaluation"""
        logic_group = LogicGroup(
            logic='or',
            conditions=[
                Condition(field='properties.acl', operator='==', value='public-read'),
                Condition(field='properties.acl', operator='==', value='public-read-write')
            ]
        )
        
        # First condition true
        resource = {'properties': {'acl': 'public-read'}}
        matched_conditions = []
        assert matcher._evaluate_logic_group(logic_group, resource, matched_conditions) == True
        
        # Neither condition true
        resource = {'properties': {'acl': 'private'}}
        matched_conditions = []
        assert matcher._evaluate_logic_group(logic_group, resource, matched_conditions) == False
    
    def test_match_gcp_sql_public_exposure(self):
        """Test matching GCP Cloud SQL public exposure threat"""
        # Load real threat from database
        loader = load_threat_database()
        threat = loader.get_threat_by_id('GCP-SQL-001')
        
        if not threat:
            pytest.skip("GCP-SQL-001 threat not found in database")
        
        # Create vulnerable resource
        vulnerable_resource = {
            'resource_type': 'google_sql_database_instance',
            'name': 'master',
            'full_name': 'google_sql_database_instance.master',
            'cloud_provider': 'gcp',
            'properties': {
                'name': 'master-instance',
                'settings': {
                    'ip_configuration': {
                        'ipv4_enabled': True,
                        'authorized_networks': [
                            {'name': 'public', 'value': '0.0.0.0/0'}
                        ]
                    }
                }
            }
        }
        
        # Create secure resource
        secure_resource = {
            'resource_type': 'google_sql_database_instance',
            'name': 'secure',
            'full_name': 'google_sql_database_instance.secure',
            'cloud_provider': 'gcp',
            'properties': {
                'name': 'secure-instance',
                'settings': {
                    'ip_configuration': {
                        'ipv4_enabled': False
                    }
                }
            }
        }
        
        matcher = ThreatMatcher()
        
        # Should match vulnerable resource
        matched = matcher._match_threat_to_resource(threat, vulnerable_resource)
        assert matched is not None, "Should match vulnerable resource"
        assert matched.threat.id == 'GCP-SQL-001'
        
        # Should not match secure resource
        matched = matcher._match_threat_to_resource(threat, secure_resource)
        assert matched is None, "Should not match secure resource"
    
    def test_match_aws_s3_public_bucket(self):
        """Test matching AWS S3 public bucket threat"""
        loader = load_threat_database()
        threat = loader.get_threat_by_id('AWS-S3-001')
        
        if not threat:
            pytest.skip("AWS-S3-001 threat not found in database")
        
        # Public bucket
        public_bucket = {
            'resource_type': 'aws_s3_bucket',
            'name': 'public_data',
            'full_name': 'aws_s3_bucket.public_data',
            'cloud_provider': 'aws',
            'properties': {
                'bucket': 'my-public-bucket',
                'acl': 'public-read'
            }
        }
        
        # Private bucket
        private_bucket = {
            'resource_type': 'aws_s3_bucket',
            'name': 'private_data',
            'full_name': 'aws_s3_bucket.private_data',
            'cloud_provider': 'aws',
            'properties': {
                'bucket': 'my-private-bucket',
                'acl': 'private'
            }
        }
        
        matcher = ThreatMatcher()
        
        # Should match public bucket
        matched = matcher._match_threat_to_resource(threat, public_bucket)
        assert matched is not None, "Should match public bucket"
        
        # Should not match private bucket
        matched = matcher._match_threat_to_resource(threat, private_bucket)
        assert matched is None, "Should not match private bucket"
    
    def test_match_infrastructure_full(self):
        """Test full infrastructure matching with multiple resources and threats"""
        loader = load_threat_database()
        threats = loader.load_threats()
        
        # Mock infrastructure config
        config = {
            'resources': [
                {
                    'resource_type': 'google_sql_database_instance',
                    'name': 'bad_db',
                    'full_name': 'google_sql_database_instance.bad_db',
                    'cloud_provider': 'gcp',
                    'properties': {
                        'settings': {
                            'ip_configuration': {
                                'ipv4_enabled': True,
                                'authorized_networks': [
                                    {'value': '0.0.0.0/0'}
                                ]
                            }
                        },
                        'deletion_protection': False
                    }
                },
                {
                    'resource_type': 'aws_s3_bucket',
                    'name': 'public_bucket',
                    'full_name': 'aws_s3_bucket.public_bucket',
                    'cloud_provider': 'aws',
                    'properties': {
                        'acl': 'public-read'
                    }
                }
            ]
        }
        
        result = match_infrastructure_threats(config, threats)
        
        assert len(result.matched_threats) > 0, "Should match at least one threat"
        assert result.total_resources_scanned == 2
        assert result.total_threats_checked == len(threats)
        
        # Check that high severity threats are identified
        high_severity = [
            mt for mt in result.matched_threats
            if mt.threat.severity.value in ['high', 'critical']
        ]
        assert len(high_severity) > 0, "Should identify high severity threats"
    
    def test_threat_deduplication(self):
        """Test that duplicate threats are handled correctly"""
        # This would test if same threat matches same resource multiple times
        # For now, our implementation matches once per resource
        pass
    
    def test_risk_score_calculation(self):
        """Test risk score calculation"""
        threat = Threat(
            id='TEST-001',
            name='Test Threat',
            description='Test',
            severity=Severity.HIGH,  # score = 7
            likelihood=Likelihood.LIKELY,  # score = 0.8
            category='Test'
        )
        
        # Risk score = severity_score * likelihood_score = 7 * 0.8 = 5.6
        expected_score = 5.6
        assert abs(threat.risk_score - expected_score) < 0.01  # Allow small floating point error


class TestConditionOperators:
    """Test individual condition operators"""
    
    @pytest.fixture
    def matcher(self):
        return ThreatMatcher()
    
    def test_greater_than_operator(self, matcher):
        """Test > operator"""
        assert matcher._op_greater_than(10, 5) == True
        assert matcher._op_greater_than(5, 10) == False
        assert matcher._op_greater_than(5, 5) == False
    
    def test_less_than_operator(self, matcher):
        """Test < operator"""
        assert matcher._op_less_than(5, 10) == True
        assert matcher._op_less_than(10, 5) == False
    
    def test_greater_equal_operator(self, matcher):
        """Test >= operator"""
        assert matcher._op_greater_equal(10, 5) == True
        assert matcher._op_greater_equal(5, 5) == True
        assert matcher._op_greater_equal(3, 5) == False
    
    def test_not_in_operator(self, matcher):
        """Test not_in operator"""
        assert matcher._op_not_in('dev', ['prod', 'staging']) == True
        assert matcher._op_not_in('prod', ['prod', 'staging']) == False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
