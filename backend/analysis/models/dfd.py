"""
Data Flow Diagram (DFD) Models

Data structures for representing multi-layer data flow diagrams
with trust boundaries and data classification.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Any
from enum import Enum


class NodeType(Enum):
    """Types of nodes in a DFD"""
    SERVICE = "service"
    DATABASE = "database"
    STORAGE = "storage"
    COMPUTE = "compute"
    NETWORK = "network"
    API = "api"
    CACHE = "cache"
    QUEUE = "queue"
    FUNCTION = "function"
    EXTERNAL = "external"
    LOAD_BALANCER = "load_balancer"
    FIREWALL = "firewall"
    VPC = "vpc"
    SUBNET = "subnet"
    USER = "user"
    ADMIN = "admin"


class TrustBoundary(Enum):
    """Trust boundaries in the system"""
    INTERNET = "internet"
    DMZ = "dmz"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    PRIVATE = "private"
    
    @property
    def security_level(self) -> int:
        """Return numeric security level for comparison"""
        levels = {
            'internet': 0,
            'dmz': 1,
            'internal': 2,
            'private': 3,
            'restricted': 4
        }
        return levels.get(self.value, 0)


class DataClassification(Enum):
    """Data sensitivity classification"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    PII = "pii"
    PHI = "phi"
    
    @property
    def sensitivity_level(self) -> int:
        """Return numeric sensitivity level"""
        levels = {
            'public': 0,
            'internal': 1,
            'confidential': 2,
            'pii': 3,
            'phi': 3,
            'restricted': 4
        }
        return levels.get(self.value, 0)


@dataclass
class DFDNode:
    """A node in a Data Flow Diagram"""
    id: str
    label: str
    type: NodeType
    cloud_provider: Optional[str] = None
    trust_boundary: Optional[TrustBoundary] = None
    resource_type: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'label': self.label,
            'type': self.type.value,
            'cloud_provider': self.cloud_provider,
            'trust_boundary': self.trust_boundary.value if self.trust_boundary else None,
            'resource_type': self.resource_type,
            'properties': self.properties,
            'tags': self.tags
        }


@dataclass
class DFDEdge:
    """An edge (data flow) in a Data Flow Diagram"""
    source: str
    target: str
    label: str
    data_classification: Optional[DataClassification] = None
    protocol: Optional[str] = None
    port: Optional[int] = None
    encrypted: bool = False
    bidirectional: bool = False
    properties: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'source': self.source,
            'target': self.target,
            'label': self.label,
            'data_classification': self.data_classification.value if self.data_classification else None,
            'protocol': self.protocol,
            'port': self.port,
            'encrypted': self.encrypted,
            'bidirectional': self.bidirectional,
            'properties': self.properties
        }
    
    @property
    def is_cross_boundary(self) -> bool:
        """Check if this edge crosses trust boundaries"""
        return self.properties.get('crosses_boundary', False)


@dataclass
class TrustBoundaryGroup:
    """A group of nodes within the same trust boundary"""
    boundary: TrustBoundary
    name: str
    node_ids: List[str] = field(default_factory=list)
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'boundary': self.boundary.value,
            'name': self.name,
            'node_ids': self.node_ids,
            'description': self.description
        }


@dataclass
class DFD:
    """Complete Data Flow Diagram"""
    level: str  # "service", "component", "code"
    nodes: List[DFDNode] = field(default_factory=list)
    edges: List[DFDEdge] = field(default_factory=list)
    trust_boundaries: List[TrustBoundaryGroup] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_node_by_id(self, node_id: str) -> Optional[DFDNode]:
        """Get node by ID"""
        for node in self.nodes:
            if node.id == node_id:
                return node
        return None
    
    def get_edges_for_node(self, node_id: str) -> List[DFDEdge]:
        """Get all edges connected to a node"""
        return [
            edge for edge in self.edges
            if edge.source == node_id or edge.target == node_id
        ]
    
    def get_nodes_by_type(self, node_type: NodeType) -> List[DFDNode]:
        """Get all nodes of a specific type"""
        return [node for node in self.nodes if node.type == node_type]
    
    def get_nodes_in_boundary(self, boundary: TrustBoundary) -> List[DFDNode]:
        """Get all nodes in a trust boundary"""
        return [node for node in self.nodes if node.trust_boundary == boundary]
    
    def get_cross_boundary_edges(self) -> List[DFDEdge]:
        """Get all edges that cross trust boundaries"""
        cross_boundary = []
        for edge in self.edges:
            source_node = self.get_node_by_id(edge.source)
            target_node = self.get_node_by_id(edge.target)
            
            if (source_node and target_node and 
                source_node.trust_boundary != target_node.trust_boundary):
                edge.properties['crosses_boundary'] = True
                cross_boundary.append(edge)
        
        return cross_boundary
    
    def get_external_connections(self) -> List[DFDEdge]:
        """Get all edges connecting to external systems"""
        external = []
        for edge in self.edges:
            source_node = self.get_node_by_id(edge.source)
            target_node = self.get_node_by_id(edge.target)
            
            if (source_node and source_node.type == NodeType.EXTERNAL) or \
               (target_node and target_node.type == NodeType.EXTERNAL):
                external.append(edge)
        
        return external
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get DFD statistics"""
        node_types = {}
        for node in self.nodes:
            node_type = node.type.value
            node_types[node_type] = node_types.get(node_type, 0) + 1
        
        trust_boundary_counts = {}
        for node in self.nodes:
            if node.trust_boundary:
                boundary = node.trust_boundary.value
                trust_boundary_counts[boundary] = trust_boundary_counts.get(boundary, 0) + 1
        
        data_classifications = {}
        for edge in self.edges:
            if edge.data_classification:
                classification = edge.data_classification.value
                data_classifications[classification] = data_classifications.get(classification, 0) + 1
        
        return {
            'level': self.level,
            'total_nodes': len(self.nodes),
            'total_edges': len(self.edges),
            'node_types': node_types,
            'trust_boundaries': trust_boundary_counts,
            'data_classifications': data_classifications,
            'cross_boundary_flows': len(self.get_cross_boundary_edges()),
            'external_connections': len(self.get_external_connections()),
            'encrypted_flows': len([e for e in self.edges if e.encrypted])
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'level': self.level,
            'nodes': [node.to_dict() for node in self.nodes],
            'edges': [edge.to_dict() for edge in self.edges],
            'trust_boundaries': [tb.to_dict() for tb in self.trust_boundaries],
            'metadata': self.metadata,
            'statistics': self.get_statistics()
        }


@dataclass
class DFDGenerationResult:
    """Result of DFD generation including all layers"""
    service_level: Optional[DFD] = None
    component_level: Optional[DFD] = None
    code_level: Optional[DFD] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'service_level': self.service_level.to_dict() if self.service_level else None,
            'component_level': self.component_level.to_dict() if self.component_level else None,
            'code_level': self.code_level.to_dict() if self.code_level else None,
            'metadata': self.metadata
        }
    
    def get_all_nodes(self) -> List[DFDNode]:
        """Get all nodes from all layers"""
        all_nodes = []
        if self.service_level:
            all_nodes.extend(self.service_level.nodes)
        if self.component_level:
            all_nodes.extend(self.component_level.nodes)
        if self.code_level:
            all_nodes.extend(self.code_level.nodes)
        return all_nodes
    
    def get_all_edges(self) -> List[DFDEdge]:
        """Get all edges from all layers"""
        all_edges = []
        if self.service_level:
            all_edges.extend(self.service_level.edges)
        if self.component_level:
            all_edges.extend(self.component_level.edges)
        if self.code_level:
            all_edges.extend(self.code_level.edges)
        return all_edges
