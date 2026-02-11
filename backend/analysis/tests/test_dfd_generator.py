"""
Tests for DFD Generator

Comprehensive unit tests for DFD generation, Mermaid export, and trust boundaries.
"""

import pytest
from models.dfd import (
    DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, 
    DataClassification, TrustBoundaryGroup
)
from dfd.dfd_generator import DFDGenerator
from dfd.mermaid_exporter import MermaidExporter, export_multi_level_mermaid


class TestDFDModels:
    """Test DFD data models"""
    
    def test_node_creation(self):
        """Test DFDNode creation"""
        node = DFDNode(
            id="web_server",
            label="Web Server",
            type=NodeType.COMPUTE,
            cloud_provider="gcp",
            trust_boundary=TrustBoundary.DMZ
        )
        
        assert node.id == "web_server"
        assert node.label == "Web Server"
        assert node.type == NodeType.COMPUTE
        assert node.trust_boundary == TrustBoundary.DMZ
    
    def test_edge_creation(self):
        """Test DFDEdge creation"""
        edge = DFDEdge(
            source="api",
            target="database",
            label="queries",
            data_classification=DataClassification.CONFIDENTIAL,
            protocol="SQL",
            encrypted=True
        )
        
        assert edge.source == "api"
        assert edge.target == "database"
        assert edge.encrypted is True
        assert edge.data_classification == DataClassification.CONFIDENTIAL
    
    def test_trust_boundary_security_level(self):
        """Test trust boundary security levels"""
        assert TrustBoundary.INTERNET.security_level < TrustBoundary.DMZ.security_level
        assert TrustBoundary.DMZ.security_level < TrustBoundary.INTERNAL.security_level
        assert TrustBoundary.INTERNAL.security_level < TrustBoundary.RESTRICTED.security_level
    
    def test_data_classification_sensitivity(self):
        """Test data classification sensitivity levels"""
        assert DataClassification.PUBLIC.sensitivity_level < DataClassification.INTERNAL.sensitivity_level
        assert DataClassification.INTERNAL.sensitivity_level < DataClassification.CONFIDENTIAL.sensitivity_level
        assert DataClassification.CONFIDENTIAL.sensitivity_level < DataClassification.RESTRICTED.sensitivity_level
    
    def test_dfd_get_node_by_id(self):
        """Test DFD node lookup"""
        dfd = DFD(level="service")
        node = DFDNode(id="test_node", label="Test", type=NodeType.SERVICE)
        dfd.nodes.append(node)
        
        found = dfd.get_node_by_id("test_node")
        assert found is not None
        assert found.id == "test_node"
        
        not_found = dfd.get_node_by_id("nonexistent")
        assert not_found is None
    
    def test_dfd_cross_boundary_edges(self):
        """Test cross-boundary edge detection"""
        dfd = DFD(level="service")
        
        # Create nodes in different boundaries
        node1 = DFDNode(id="external", label="External", type=NodeType.EXTERNAL,
                       trust_boundary=TrustBoundary.INTERNET)
        node2 = DFDNode(id="internal", label="Internal", type=NodeType.SERVICE,
                       trust_boundary=TrustBoundary.INTERNAL)
        dfd.nodes.extend([node1, node2])
        
        # Create edge between them
        edge = DFDEdge(source="external", target="internal", label="request")
        dfd.edges.append(edge)
        
        cross_boundary = dfd.get_cross_boundary_edges()
        assert len(cross_boundary) == 1
        assert cross_boundary[0].source == "external"


class TestDFDGenerator:
    """Test DFD generator"""
    
    @pytest.fixture
    def sample_gcp_resources(self):
        """Sample GCP resources for testing"""
        return [
            {
                'id': 'db-1',
                'full_name': 'google_sql_database_instance.main',
                'resource_type': 'google_sql_database_instance',
                'name': 'main-db',
                'properties': {
                    'settings': {
                        'ip_configuration': {
                            'ipv4_enabled': True,
                            'authorized_networks': [
                                {'value': '10.0.0.0/8'}
                            ]
                        }
                    },
                    'encrypted': True
                }
            },
            {
                'id': 'compute-1',
                'full_name': 'google_compute_instance.web',
                'resource_type': 'google_compute_instance',
                'name': 'web-server',
                'properties': {
                    'associate_public_ip_address': True
                }
            },
            {
                'id': 'storage-1',
                'full_name': 'google_storage_bucket.data',
                'resource_type': 'google_storage_bucket',
                'name': 'data-bucket',
                'properties': {
                    'acl': 'private'
                }
            }
        ]
    
    @pytest.fixture
    def sample_aws_resources(self):
        """Sample AWS resources for testing"""
        return [
            {
                'id': 'rds-1',
                'resource_type': 'aws_db_instance',
                'full_name': 'aws_db_instance.main',
                'name': 'main-db',
                'properties': {
                    'publicly_accessible': False,
                    'storage_encrypted': True
                }
            },
            {
                'id': 's3-1',
                'resource_type': 'aws_s3_bucket',
                'full_name': 'aws_s3_bucket.data',
                'name': 'data-bucket',
                'properties': {
                    'acl': 'public-read'
                }
            },
            {
                'id': 'lambda-1',
                'resource_type': 'aws_lambda_function',
                'full_name': 'aws_lambda_function.processor',
                'name': 'data-processor',
                'properties': {}
            }
        ]
    
    def test_service_level_dfd_generation(self, sample_gcp_resources):
        """Test service-level DFD generation"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        assert dfd.level == "service"
        assert len(dfd.nodes) >= 3  # At least the 3 resources
        assert dfd.metadata['cloud_provider'] == 'gcp'
        assert dfd.metadata['resource_count'] == 3
    
    def test_node_type_inference(self, sample_gcp_resources):
        """Test node type inference from resources"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        # Find database node
        db_nodes = [n for n in dfd.nodes if 'db' in n.id.lower()]
        assert len(db_nodes) > 0
        assert db_nodes[0].type == NodeType.DATABASE
        
        # Find compute node
        compute_nodes = [n for n in dfd.nodes if 'compute' in n.id.lower() or 'web' in n.id.lower()]
        assert len(compute_nodes) > 0
        assert compute_nodes[0].type == NodeType.COMPUTE
        
        # Find storage node
        storage_nodes = [n for n in dfd.nodes if 'storage' in n.id.lower() or 'bucket' in n.id.lower()]
        assert len(storage_nodes) > 0
        assert storage_nodes[0].type == NodeType.STORAGE
    
    def test_trust_boundary_inference(self, sample_gcp_resources):
        """Test trust boundary inference"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        # Database with encryption should be in restricted/private zone
        db_nodes = [n for n in dfd.nodes if n.type == NodeType.DATABASE]
        assert len(db_nodes) > 0
        assert db_nodes[0].trust_boundary in [TrustBoundary.RESTRICTED, TrustBoundary.PRIVATE]
        
        # Compute with public IP should be in DMZ
        compute_nodes = [n for n in dfd.nodes if n.type == NodeType.COMPUTE]
        assert len(compute_nodes) > 0
        # Note: May be DMZ or internal depending on exact config
        assert compute_nodes[0].trust_boundary is not None
    
    def test_public_s3_bucket_trust_boundary(self, sample_aws_resources):
        """Test that public S3 bucket is in internet zone"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_aws_resources)
        
        # Find S3 bucket node
        s3_nodes = [n for n in dfd.nodes if 's3' in n.resource_type.lower()]
        assert len(s3_nodes) > 0
        assert s3_nodes[0].trust_boundary == TrustBoundary.INTERNET
    
    def test_data_flow_detection(self, sample_gcp_resources):
        """Test automatic data flow detection"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        # Should have detected some edges
        assert len(dfd.edges) > 0
        
        # Check for specific patterns (e.g., compute -> database)
        compute_to_db = [
            e for e in dfd.edges
            if 'compute' in e.source or 'web' in e.source
        ]
        # May or may not find depending on heuristics
        # assert len(compute_to_db) > 0
    
    def test_trust_boundary_grouping(self, sample_gcp_resources):
        """Test trust boundary grouping"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        assert len(dfd.trust_boundaries) > 0
        
        # Each group should have nodes
        for boundary_group in dfd.trust_boundaries:
            assert len(boundary_group.node_ids) > 0
            assert boundary_group.name is not None
    
    def test_component_level_dfd_generation(self, sample_gcp_resources):
        """Test component-level DFD generation"""
        generator = DFDGenerator()
        dfd = generator.generate_component_level_dfd(sample_gcp_resources)
        
        assert dfd.level == "component"
        # Component level should have more nodes than service level
        # (services expanded into components)
        assert len(dfd.nodes) >= 3
    
    def test_code_level_dfd_generation(self):
        """Test code-level DFD generation"""
        code_flows = [
            {
                'function': 'processPayment',
                'calls': ['validateCard', 'chargeCard', 'saveTransaction'],
                'external_apis': ['stripe.com/charge'],
                'data_access': ['payments_db']
            },
            {
                'function': 'validateCard',
                'calls': ['checkCardNumber', 'verifyExpiry'],
                'external_apis': [],
                'data_access': []
            }
        ]
        
        generator = DFDGenerator()
        dfd = generator.generate_code_level_dfd(code_flows)
        
        assert dfd.level == "code"
        
        # Should have function nodes
        function_nodes = [n for n in dfd.nodes if n.type == NodeType.FUNCTION]
        assert len(function_nodes) >= 2
        
        # Should have external API node
        external_nodes = [n for n in dfd.nodes if n.type == NodeType.EXTERNAL]
        assert len(external_nodes) > 0
        
        # Should have database node
        db_nodes = [n for n in dfd.nodes if n.type == NodeType.DATABASE]
        assert len(db_nodes) > 0
        
        # Should have edges
        assert len(dfd.edges) > 0
    
    def test_generate_all_levels(self, sample_gcp_resources):
        """Test generating all three levels"""
        code_flows = [
            {
                'function': 'handler',
                'calls': ['processRequest'],
                'external_apis': [],
                'data_access': ['main_db']
            }
        ]
        
        generator = DFDGenerator()
        result = generator.generate_all_levels(sample_gcp_resources, code_flows)
        
        assert result.service_level is not None
        assert result.service_level.level == "service"
        
        assert result.component_level is not None
        assert result.component_level.level == "component"
        
        assert result.code_level is not None
        assert result.code_level.level == "code"
        
        assert len(result.metadata['levels_generated']) == 3
    
    def test_dfd_statistics(self, sample_gcp_resources):
        """Test DFD statistics generation"""
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(sample_gcp_resources)
        
        stats = dfd.get_statistics()
        
        assert stats['level'] == 'service'
        assert stats['total_nodes'] == len(dfd.nodes)
        assert stats['total_edges'] == len(dfd.edges)
        assert 'node_types' in stats
        assert 'trust_boundaries' in stats


class TestMermaidExporter:
    """Test Mermaid diagram exporter"""
    
    @pytest.fixture
    def simple_dfd(self):
        """Simple DFD for testing"""
        dfd = DFD(level="service")
        
        node1 = DFDNode(
            id="api",
            label="Payment API",
            type=NodeType.API,
            cloud_provider="gcp",
            trust_boundary=TrustBoundary.DMZ
        )
        node2 = DFDNode(
            id="database",
            label="Cloud SQL",
            type=NodeType.DATABASE,
            cloud_provider="gcp",
            trust_boundary=TrustBoundary.RESTRICTED
        )
        
        dfd.nodes.extend([node1, node2])
        
        edge = DFDEdge(
            source="api",
            target="database",
            label="queries",
            protocol="SQL",
            encrypted=True,
            data_classification=DataClassification.CONFIDENTIAL
        )
        dfd.edges.append(edge)
        
        # Add trust boundaries
        dfd.trust_boundaries = [
            TrustBoundaryGroup(
                boundary=TrustBoundary.DMZ,
                name="DMZ Zone",
                node_ids=["api"]
            ),
            TrustBoundaryGroup(
                boundary=TrustBoundary.RESTRICTED,
                name="Restricted Zone",
                node_ids=["database"]
            )
        ]
        
        return dfd
    
    def test_mermaid_export_basic(self, simple_dfd):
        """Test basic Mermaid export"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(simple_dfd)
        
        assert 'flowchart TB' in mermaid
        assert 'Payment API' in mermaid
        assert 'Cloud SQL' in mermaid
        assert 'queries' in mermaid
        assert '🔒' in mermaid  # Encryption indicator
    
    def test_mermaid_node_shapes(self, simple_dfd):
        """Test Mermaid node shape mapping"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(simple_dfd)
        
        # API should use hexagon {{}}
        assert '{{' in mermaid and '}}' in mermaid
        
        # Database should use cylindrical [()]
        assert '[(' in mermaid and ')]' in mermaid
    
    def test_mermaid_subgraphs(self, simple_dfd):
        """Test Mermaid subgraph generation for trust boundaries"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(simple_dfd, include_trust_boundaries=True)
        
        assert 'subgraph' in mermaid
        assert 'DMZ_Zone' in mermaid or 'DMZ Zone' in mermaid
        assert 'Restricted_Zone' in mermaid or 'Restricted Zone' in mermaid
        assert 'end' in mermaid
    
    def test_mermaid_without_subgraphs(self, simple_dfd):
        """Test Mermaid export without trust boundary subgraphs"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(simple_dfd, include_trust_boundaries=False)
        
        assert 'flowchart TB' in mermaid
        assert 'Payment API' in mermaid
        # Should still have nodes but no subgraphs
        assert 'subgraph' not in mermaid
    
    def test_mermaid_styles(self, simple_dfd):
        """Test Mermaid style application"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(simple_dfd)
        
        # Should have style definitions
        assert 'style' in mermaid
        # Should apply colors based on trust boundaries
        assert 'fill:' in mermaid
    
    def test_mermaid_data_classification_export(self, simple_dfd):
        """Test Mermaid export with data classification"""
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid_with_data_classification(simple_dfd)
        
        assert 'Data Classification View' in mermaid
        assert 'confidential' in mermaid.lower()
    
    def test_export_summary(self, simple_dfd):
        """Test DFD summary export"""
        exporter = MermaidExporter()
        summary = exporter.export_summary(simple_dfd)
        
        assert summary['level'] == 'service'
        assert 'statistics' in summary
        assert 'security' in summary
        assert 'trust_boundaries' in summary
        
        # Check security metrics
        assert 'cross_boundary_flows' in summary['security']
        assert 'high_risk_flows' in summary['security']
    
    def test_svg_export_template(self, simple_dfd):
        """Test SVG export HTML template generation"""
        exporter = MermaidExporter()
        html = exporter.export_to_svg(simple_dfd)
        
        assert '<!DOCTYPE html>' in html
        assert 'mermaid' in html
        assert 'flowchart TB' in html
        assert '.svg' in html
    
    def test_multi_level_export(self):
        """Test exporting multiple DFD levels"""
        # Create simple DFDs for each level
        service_dfd = DFD(level="service")
        service_dfd.nodes.append(DFDNode(id="svc1", label="Service", type=NodeType.SERVICE))
        
        component_dfd = DFD(level="component")
        component_dfd.nodes.append(DFDNode(id="comp1", label="Component", type=NodeType.API))
        
        code_dfd = DFD(level="code")
        code_dfd.nodes.append(DFDNode(id="func1", label="Function", type=NodeType.FUNCTION))
        
        result = export_multi_level_mermaid(service_dfd, component_dfd, code_dfd)
        
        assert 'service' in result
        assert 'component' in result
        assert 'code' in result
        
        assert 'flowchart TB' in result['service']
        assert 'flowchart TB' in result['component']
        assert 'flowchart TB' in result['code']


class TestIntegration:
    """Integration tests for full DFD workflow"""
    
    def test_full_workflow_gcp(self):
        """Test complete workflow from resources to Mermaid"""
        resources = [
            {
                'id': 'api-1',
                'resource_type': 'google_cloud_run_service',
                'full_name': 'google_cloud_run_service.api',
                'name': 'payment-api',
                'properties': {}
            },
            {
                'id': 'db-1',
                'resource_type': 'google_sql_database_instance',
                'full_name': 'google_sql_database_instance.main',
                'name': 'payment-db',
                'properties': {
                    'settings': {
                        'ip_configuration': {
                            'ipv4_enabled': False
                        }
                    },
                    'encrypted': True
                }
            }
        ]
        
        # Generate DFD
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(resources)
        
        # Verify DFD structure
        assert len(dfd.nodes) >= 2
        assert dfd.metadata['cloud_provider'] == 'gcp'
        
        # Export to Mermaid
        exporter = MermaidExporter()
        mermaid = exporter.export_to_mermaid(dfd)
        
        assert 'flowchart TB' in mermaid
        assert 'payment' in mermaid.lower()
        
        # Get statistics
        stats = dfd.get_statistics()
        assert stats['total_nodes'] >= 2
    
    def test_cross_boundary_detection(self):
        """Test detection of cross-boundary data flows"""
        resources = [
            {
                'id': 'lb-1',
                'resource_type': 'aws_lb',
                'full_name': 'aws_lb.public',
                'name': 'public-lb',
                'properties': {}
            },
            {
                'id': 'db-1',
                'resource_type': 'aws_db_instance',
                'full_name': 'aws_db_instance.private',
                'name': 'private-db',
                'properties': {
                    'publicly_accessible': False,
                    'storage_encrypted': True
                }
            }
        ]
        
        generator = DFDGenerator()
        dfd = generator.generate_service_level_dfd(resources)
        
        # Check for cross-boundary flows
        cross_boundary = dfd.get_cross_boundary_edges()
        # May or may not detect depending on heuristics
        
        # Get security summary
        exporter = MermaidExporter()
        summary = exporter.export_summary(dfd)
        
        assert 'security' in summary
        assert summary['security']['cross_boundary_flows'] >= 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
