"""
DFD Generator

Generates multi-layer Data Flow Diagrams from parsed infrastructure resources.
Supports service-level, component-level, and code-level DFDs with trust boundaries.
"""

import re
from typing import List, Dict, Optional, Set, Any
from models.dfd import (
    DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, 
    DataClassification, TrustBoundaryGroup, DFDGenerationResult
)


class DFDGenerator:
    """Generate Data Flow Diagrams from infrastructure resources"""
    
    # Resource type to node type mapping
    RESOURCE_TYPE_MAPPING = {
        # GCP
        'google_sql_database_instance': NodeType.DATABASE,
        'google_compute_instance': NodeType.COMPUTE,
        'google_storage_bucket': NodeType.STORAGE,
        'google_cloud_run_service': NodeType.SERVICE,
        'google_compute_backend_service': NodeType.API,
        'google_redis_instance': NodeType.CACHE,
        'google_pubsub_topic': NodeType.QUEUE,
        'google_cloudfunctions_function': NodeType.FUNCTION,
        'google_compute_network': NodeType.NETWORK,
        'google_compute_firewall': NodeType.FIREWALL,
        'google_compute_subnetwork': NodeType.SUBNET,
        
        # AWS
        'aws_db_instance': NodeType.DATABASE,
        'aws_rds_cluster': NodeType.DATABASE,
        'aws_dynamodb_table': NodeType.DATABASE,
        'aws_instance': NodeType.COMPUTE,
        'aws_ec2_instance': NodeType.COMPUTE,
        'aws_s3_bucket': NodeType.STORAGE,
        'aws_ecs_service': NodeType.SERVICE,
        'aws_lambda_function': NodeType.FUNCTION,
        'aws_api_gateway_rest_api': NodeType.API,
        'aws_elasticache_cluster': NodeType.CACHE,
        'aws_sqs_queue': NodeType.QUEUE,
        'aws_vpc': NodeType.VPC,
        'aws_subnet': NodeType.SUBNET,
        'aws_security_group': NodeType.FIREWALL,
        'aws_lb': NodeType.LOAD_BALANCER,
        'aws_elb': NodeType.LOAD_BALANCER,
        
        # Azure
        'azurerm_sql_database': NodeType.DATABASE,
        'azurerm_virtual_machine': NodeType.COMPUTE,
        'azurerm_storage_account': NodeType.STORAGE,
        'azurerm_app_service': NodeType.SERVICE,
        'azurerm_function_app': NodeType.FUNCTION,
        'azurerm_api_management': NodeType.API,
        'azurerm_redis_cache': NodeType.CACHE,
        'azurerm_servicebus_queue': NodeType.QUEUE,
        'azurerm_virtual_network': NodeType.NETWORK,
        'azurerm_network_security_group': NodeType.FIREWALL,
    }
    
    def __init__(self):
        self.node_counter = 0
        self.edge_counter = 0
    
    def _generate_node_id(self, resource: Dict[str, Any]) -> str:
        """Generate unique node ID from resource"""
        if 'id' in resource:
            return resource['id']
        if 'full_name' in resource:
            # Clean the full name to make it a valid ID
            return re.sub(r'[^a-zA-Z0-9_-]', '_', resource['full_name'])
        self.node_counter += 1
        return f"node_{self.node_counter}"
    
    def _infer_node_type(self, resource: Dict[str, Any]) -> NodeType:
        """Infer node type from resource type"""
        resource_type = resource.get('resource_type', '').lower()
        
        # Try exact match first
        if resource_type in self.RESOURCE_TYPE_MAPPING:
            return self.RESOURCE_TYPE_MAPPING[resource_type]
        
        # Fuzzy match based on keywords
        if 'database' in resource_type or 'sql' in resource_type or 'db' in resource_type:
            return NodeType.DATABASE
        if 'storage' in resource_type or 'bucket' in resource_type:
            return NodeType.STORAGE
        if 'compute' in resource_type or 'instance' in resource_type or 'vm' in resource_type:
            return NodeType.COMPUTE
        if 'function' in resource_type or 'lambda' in resource_type:
            return NodeType.FUNCTION
        if 'cache' in resource_type or 'redis' in resource_type:
            return NodeType.CACHE
        if 'queue' in resource_type or 'pubsub' in resource_type or 'sqs' in resource_type:
            return NodeType.QUEUE
        if 'api' in resource_type or 'gateway' in resource_type:
            return NodeType.API
        if 'network' in resource_type or 'vpc' in resource_type:
            return NodeType.NETWORK
        if 'firewall' in resource_type or 'security_group' in resource_type:
            return NodeType.FIREWALL
        if 'load_balancer' in resource_type or 'lb' in resource_type or 'elb' in resource_type:
            return NodeType.LOAD_BALANCER
        
        return NodeType.SERVICE  # Default
    
    def _infer_trust_boundary(self, resource: Dict[str, Any]) -> TrustBoundary:
        """Infer trust boundary from resource properties"""
        props = resource.get('properties', {})
        resource_type = resource.get('resource_type', '').lower()
        
        # Check for public accessibility
        publicly_accessible = props.get('publicly_accessible', False)
        associate_public_ip = props.get('associate_public_ip_address', False)
        
        # Check for public network access
        if 'sql' in resource_type or 'database' in resource_type:
            settings = props.get('settings', {})
            ip_config = settings.get('ip_configuration', {})
            ipv4_enabled = ip_config.get('ipv4_enabled', False)
            authorized_networks = ip_config.get('authorized_networks', [])
            
            # Check if allows internet access
            if ipv4_enabled:
                for network in authorized_networks:
                    if isinstance(network, dict) and network.get('value') == '0.0.0.0/0':
                        return TrustBoundary.INTERNET
                # IPv4 enabled but restricted networks - if encrypted, still private
                if props.get('encrypted', False):
                    return TrustBoundary.PRIVATE
                return TrustBoundary.DMZ
        
        # Check S3 buckets
        if 'bucket' in resource_type or 'storage' in resource_type:
            acl = props.get('acl', '')
            if 'public' in acl:
                return TrustBoundary.INTERNET
        
        # Check compute instances
        if publicly_accessible or associate_public_ip:
            return TrustBoundary.DMZ
        
        # Check security groups / firewall rules
        if 'security_group' in resource_type or 'firewall' in resource_type:
            ingress = props.get('ingress', [])
            if not isinstance(ingress, list):
                ingress = [ingress]
            
            for rule in ingress:
                cidr_blocks = rule.get('cidr_blocks', [])
                if '0.0.0.0/0' in cidr_blocks or '::/0' in cidr_blocks:
                    return TrustBoundary.DMZ
        
        # Check for database-specific properties
        if 'database' in resource_type or 'sql' in resource_type:
            if props.get('storage_encrypted', False) or props.get('encrypted', False):
                return TrustBoundary.RESTRICTED
            return TrustBoundary.PRIVATE
        
        # Default to internal
        return TrustBoundary.INTERNAL
    
    def _infer_data_classification(self, edge_label: str, source: DFDNode, target: DFDNode) -> DataClassification:
        """Infer data classification from edge and nodes"""
        label_lower = edge_label.lower()
        
        # Check for PII/PHI keywords
        pii_keywords = ['user', 'customer', 'profile', 'personal', 'email', 'phone', 'address']
        phi_keywords = ['health', 'medical', 'patient', 'diagnosis']
        
        if any(keyword in label_lower for keyword in phi_keywords):
            return DataClassification.PHI
        if any(keyword in label_lower for keyword in pii_keywords):
            return DataClassification.PII
        
        # Database to database = confidential
        if source.type == NodeType.DATABASE or target.type == NodeType.DATABASE:
            return DataClassification.CONFIDENTIAL
        
        # External connections = public
        if source.type == NodeType.EXTERNAL or target.type == NodeType.EXTERNAL:
            return DataClassification.PUBLIC
        
        # Storage = internal
        if source.type == NodeType.STORAGE or target.type == NodeType.STORAGE:
            return DataClassification.INTERNAL
        
        return DataClassification.INTERNAL
    
    def _detect_data_flows(self, resources: List[Dict[str, Any]], nodes: Dict[str, DFDNode]) -> List[DFDEdge]:
        """Detect data flows between resources"""
        edges = []
        
        for resource in resources:
            node_id = self._generate_node_id(resource)
            if node_id not in nodes:
                continue
            
            source_node = nodes[node_id]
            props = resource.get('properties', {})
            
            # Detect API to Database connections
            if source_node.type in [NodeType.SERVICE, NodeType.API, NodeType.COMPUTE]:
                for other_id, other_node in nodes.items():
                    if other_node.type == NodeType.DATABASE:
                        # Check if database is referenced
                        db_ref = props.get('database_url') or props.get('db_instance')
                        if db_ref or self._could_connect(source_node, other_node):
                            edge = DFDEdge(
                                source=node_id,
                                target=other_id,
                                label="queries",
                                protocol="SQL",
                                encrypted=other_node.properties.get('encrypted', False)
                            )
                            edge.data_classification = self._infer_data_classification(
                                "queries", source_node, other_node
                            )
                            edges.append(edge)
            
            # Detect storage connections
            if source_node.type in [NodeType.SERVICE, NodeType.API, NodeType.COMPUTE]:
                for other_id, other_node in nodes.items():
                    if other_node.type == NodeType.STORAGE:
                        # Check for storage references
                        bucket_ref = props.get('bucket') or props.get('storage_account')
                        if bucket_ref or self._could_connect(source_node, other_node):
                            edge = DFDEdge(
                                source=node_id,
                                target=other_id,
                                label="read/write",
                                protocol="HTTPS",
                                encrypted=True
                            )
                            edge.data_classification = self._infer_data_classification(
                                "read/write", source_node, other_node
                            )
                            edges.append(edge)
            
            # Detect cache connections
            if source_node.type in [NodeType.SERVICE, NodeType.API]:
                for other_id, other_node in nodes.items():
                    if other_node.type == NodeType.CACHE:
                        edge = DFDEdge(
                            source=node_id,
                            target=other_id,
                            label="cache operations",
                            protocol="Redis",
                            encrypted=False
                        )
                        edge.data_classification = DataClassification.INTERNAL
                        edges.append(edge)
            
            # Detect load balancer to service
            if source_node.type == NodeType.LOAD_BALANCER:
                for other_id, other_node in nodes.items():
                    if other_node.type in [NodeType.SERVICE, NodeType.API, NodeType.COMPUTE]:
                        edge = DFDEdge(
                            source=node_id,
                            target=other_id,
                            label="HTTP requests",
                            protocol="HTTPS",
                            port=443,
                            encrypted=True
                        )
                        edge.data_classification = DataClassification.PUBLIC
                        edges.append(edge)
        
        # Add external user/admin nodes
        public_nodes = [n for n in nodes.values() if n.trust_boundary in [TrustBoundary.INTERNET, TrustBoundary.DMZ]]
        if public_nodes:
            # Add user node
            user_node_id = "external_user"
            if user_node_id not in nodes:
                user_node = DFDNode(
                    id=user_node_id,
                    label="External Users",
                    type=NodeType.USER,
                    trust_boundary=TrustBoundary.INTERNET,
                    properties={"external": True}
                )
                nodes[user_node_id] = user_node
                
                # Connect user to public services
                for public_node in public_nodes:
                    if public_node.type in [NodeType.SERVICE, NodeType.API, NodeType.LOAD_BALANCER]:
                        edge = DFDEdge(
                            source=user_node_id,
                            target=public_node.id,
                            label="HTTP requests",
                            protocol="HTTPS",
                            port=443,
                            encrypted=True
                        )
                        edge.data_classification = DataClassification.PUBLIC
                        edges.append(edge)
        
        return edges
    
    def _could_connect(self, source: DFDNode, target: DFDNode) -> bool:
        """Heuristic to determine if two nodes could be connected"""
        # Services/APIs typically connect to databases and storage
        if source.type in [NodeType.SERVICE, NodeType.API, NodeType.COMPUTE]:
            if target.type in [NodeType.DATABASE, NodeType.STORAGE, NodeType.CACHE]:
                return True
        
        # Load balancers connect to services
        if source.type == NodeType.LOAD_BALANCER:
            if target.type in [NodeType.SERVICE, NodeType.API]:
                return True
        
        return False
    
    def _group_by_trust_boundaries(self, nodes: List[DFDNode]) -> List[TrustBoundaryGroup]:
        """Group nodes by trust boundary"""
        boundaries = {}
        
        for node in nodes:
            if not node.trust_boundary:
                continue
            
            boundary = node.trust_boundary
            if boundary not in boundaries:
                boundaries[boundary] = TrustBoundaryGroup(
                    boundary=boundary,
                    name=f"{boundary.value.title()} Zone",
                    node_ids=[],
                    description=self._get_boundary_description(boundary)
                )
            
            boundaries[boundary].node_ids.append(node.id)
        
        return list(boundaries.values())
    
    def _get_boundary_description(self, boundary: TrustBoundary) -> str:
        """Get description for trust boundary"""
        descriptions = {
            TrustBoundary.INTERNET: "Publicly accessible from the internet",
            TrustBoundary.DMZ: "Demilitarized zone with limited external access",
            TrustBoundary.INTERNAL: "Internal network, not directly accessible",
            TrustBoundary.PRIVATE: "Private network with restricted access",
            TrustBoundary.RESTRICTED: "Highly restricted, sensitive data zone"
        }
        return descriptions.get(boundary, "")
    
    def generate_service_level_dfd(self, resources: List[Dict[str, Any]]) -> DFD:
        """
        Generate service-level DFD
        
        Focus: High-level services and data flows between them
        """
        dfd = DFD(level="service")
        nodes_dict = {}
        
        # Extract cloud provider
        cloud_provider = None
        if resources:
            first_resource_type = resources[0].get('resource_type', '')
            if first_resource_type.startswith('google_'):
                cloud_provider = 'gcp'
            elif first_resource_type.startswith('aws_'):
                cloud_provider = 'aws'
            elif first_resource_type.startswith('azurerm_'):
                cloud_provider = 'azure'
        
        # Create nodes for each resource
        for resource in resources:
            node_id = self._generate_node_id(resource)
            node_type = self._infer_node_type(resource)
            trust_boundary = self._infer_trust_boundary(resource)
            
            # Generate label
            label = resource.get('name', resource.get('full_name', node_id))
            
            node = DFDNode(
                id=node_id,
                label=label,
                type=node_type,
                cloud_provider=cloud_provider,
                trust_boundary=trust_boundary,
                resource_type=resource.get('resource_type'),
                properties=resource.get('properties', {})
            )
            
            nodes_dict[node_id] = node
            dfd.nodes.append(node)
        
        # Detect data flows
        edges = self._detect_data_flows(resources, nodes_dict)
        dfd.edges = edges
        
        # Group by trust boundaries
        dfd.trust_boundaries = self._group_by_trust_boundaries(dfd.nodes)
        
        # Add metadata
        dfd.metadata = {
            'cloud_provider': cloud_provider,
            'resource_count': len(resources),
            'description': 'Service-level architecture showing major services and data flows'
        }
        
        return dfd
    
    def generate_component_level_dfd(self, resources: List[Dict[str, Any]]) -> DFD:
        """
        Generate component-level DFD
        
        Focus: Components within services, APIs, databases, caches
        """
        # Start with service-level DFD
        dfd = self.generate_service_level_dfd(resources)
        dfd.level = "component"
        dfd.metadata['description'] = 'Component-level architecture showing internal components'
        
        # Expand services into components
        new_nodes = []
        new_edges = []
        
        for node in dfd.nodes:
            # Expand API/Service nodes into components
            if node.type in [NodeType.SERVICE, NodeType.API]:
                # Create API endpoint component
                api_node = DFDNode(
                    id=f"{node.id}_api",
                    label=f"{node.label} API",
                    type=NodeType.API,
                    cloud_provider=node.cloud_provider,
                    trust_boundary=node.trust_boundary,
                    resource_type=node.resource_type,
                    properties=node.properties
                )
                new_nodes.append(api_node)
                
                # Create business logic component
                logic_node = DFDNode(
                    id=f"{node.id}_logic",
                    label=f"{node.label} Logic",
                    type=NodeType.FUNCTION,
                    cloud_provider=node.cloud_provider,
                    trust_boundary=TrustBoundary.INTERNAL,
                    resource_type=node.resource_type,
                    properties=node.properties
                )
                new_nodes.append(logic_node)
                
                # Connect API to logic
                new_edges.append(DFDEdge(
                    source=api_node.id,
                    target=logic_node.id,
                    label="process request",
                    protocol="Internal",
                    data_classification=DataClassification.INTERNAL
                ))
                
                # Redirect existing edges
                for edge in dfd.edges:
                    if edge.target == node.id:
                        edge.target = api_node.id
                    if edge.source == node.id:
                        edge.source = logic_node.id
        
        # Add new nodes and edges
        dfd.nodes.extend(new_nodes)
        dfd.edges.extend(new_edges)
        
        # Update trust boundaries
        dfd.trust_boundaries = self._group_by_trust_boundaries(dfd.nodes)
        
        return dfd
    
    def generate_code_level_dfd(self, code_flows: List[Dict[str, Any]]) -> DFD:
        """
        Generate code-level DFD
        
        Focus: Function calls, library usage, external API calls
        Input format:
        [
          {
            "function": "processPayment",
            "calls": ["validateCard", "chargeCard", "saveTransaction"],
            "external_apis": ["stripe.com/charge"],
            "data_access": ["payments_db"]
          }
        ]
        """
        dfd = DFD(level="code")
        nodes_dict = {}
        
        # Create nodes for functions
        for flow in code_flows:
            function_name = flow.get('function', '')
            node_id = re.sub(r'[^a-zA-Z0-9_]', '_', function_name)
            
            if node_id not in nodes_dict:
                node = DFDNode(
                    id=node_id,
                    label=function_name,
                    type=NodeType.FUNCTION,
                    trust_boundary=TrustBoundary.INTERNAL,
                    properties=flow
                )
                nodes_dict[node_id] = node
                dfd.nodes.append(node)
            
            source_node = nodes_dict[node_id]
            
            # Create nodes for called functions
            for called_func in flow.get('calls', []):
                called_id = re.sub(r'[^a-zA-Z0-9_]', '_', called_func)
                if called_id not in nodes_dict:
                    called_node = DFDNode(
                        id=called_id,
                        label=called_func,
                        type=NodeType.FUNCTION,
                        trust_boundary=TrustBoundary.INTERNAL
                    )
                    nodes_dict[called_id] = called_node
                    dfd.nodes.append(called_node)
                
                # Create edge
                edge = DFDEdge(
                    source=node_id,
                    target=called_id,
                    label="calls",
                    protocol="Internal",
                    data_classification=DataClassification.INTERNAL
                )
                dfd.edges.append(edge)
            
            # Create nodes for external APIs
            for ext_api in flow.get('external_apis', []):
                ext_id = re.sub(r'[^a-zA-Z0-9_]', '_', ext_api)
                if ext_id not in nodes_dict:
                    ext_node = DFDNode(
                        id=ext_id,
                        label=ext_api,
                        type=NodeType.EXTERNAL,
                        trust_boundary=TrustBoundary.INTERNET
                    )
                    nodes_dict[ext_id] = ext_node
                    dfd.nodes.append(ext_node)
                
                # Create edge
                edge = DFDEdge(
                    source=node_id,
                    target=ext_id,
                    label="API call",
                    protocol="HTTPS",
                    encrypted=True,
                    data_classification=DataClassification.PUBLIC
                )
                dfd.edges.append(edge)
            
            # Create nodes for data access
            for db in flow.get('data_access', []):
                db_id = re.sub(r'[^a-zA-Z0-9_]', '_', db)
                if db_id not in nodes_dict:
                    db_node = DFDNode(
                        id=db_id,
                        label=db,
                        type=NodeType.DATABASE,
                        trust_boundary=TrustBoundary.RESTRICTED
                    )
                    nodes_dict[db_id] = db_node
                    dfd.nodes.append(db_node)
                
                # Create edge
                edge = DFDEdge(
                    source=node_id,
                    target=db_id,
                    label="query",
                    protocol="SQL",
                    data_classification=DataClassification.CONFIDENTIAL
                )
                dfd.edges.append(edge)
        
        # Group by trust boundaries
        dfd.trust_boundaries = self._group_by_trust_boundaries(dfd.nodes)
        
        # Add metadata
        dfd.metadata = {
            'function_count': len([n for n in dfd.nodes if n.type == NodeType.FUNCTION]),
            'external_dependencies': len([n for n in dfd.nodes if n.type == NodeType.EXTERNAL]),
            'description': 'Code-level architecture showing function calls and dependencies'
        }
        
        return dfd
    
    def generate_all_levels(self, resources: List[Dict[str, Any]], 
                           code_flows: Optional[List[Dict[str, Any]]] = None) -> DFDGenerationResult:
        """
        Generate all three levels of DFDs
        """
        result = DFDGenerationResult()
        
        # Generate service-level DFD
        result.service_level = self.generate_service_level_dfd(resources)
        
        # Generate component-level DFD
        result.component_level = self.generate_component_level_dfd(resources)
        
        # Generate code-level DFD if code flows provided
        if code_flows:
            result.code_level = self.generate_code_level_dfd(code_flows)
        
        # Add metadata
        result.metadata = {
            'levels_generated': ['service', 'component'] + (['code'] if code_flows else []),
            'total_nodes': len(result.get_all_nodes()),
            'total_edges': len(result.get_all_edges())
        }
        
        return result
    
    def export_to_json(self, dfd: DFD) -> Dict[str, Any]:
        """Export DFD to JSON format"""
        return dfd.to_dict()
