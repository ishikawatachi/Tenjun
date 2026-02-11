"""
Mermaid Diagram Exporter

Exports DFD structures to Mermaid diagram syntax for visualization.
Supports flowcharts with trust boundaries and data classification colors.
"""

from typing import Dict, List, Any
from models.dfd import DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, DataClassification


class MermaidExporter:
    """Export DFD to Mermaid diagram syntax"""
    
    # Node shape mapping
    NODE_SHAPES = {
        NodeType.SERVICE: ('(', ')'),        # Stadium shape
        NodeType.DATABASE: ('[(', ')]'),     # Cylindrical shape
        NodeType.STORAGE: ('[/', '\\]'),     # Trapezoid
        NodeType.COMPUTE: ('[', ']'),        # Rectangle
        NodeType.API: ('{{', '}}'),          # Hexagon
        NodeType.FUNCTION: ('[[', ']]'),     # Subroutine
        NodeType.CACHE: ('[/', '\\]'),       # Trapezoid
        NodeType.QUEUE: ('[/', '\\]'),       # Trapezoid
        NodeType.EXTERNAL: (['(((', ')))'])[0:2],  # Circle
        NodeType.USER: (['(((', ')))'])[0:2],      # Circle
        NodeType.ADMIN: (['(((', ')))'])[0:2],     # Circle
        NodeType.NETWORK: ('[', ']'),        # Rectangle
        NodeType.FIREWALL: ('[', ']'),       # Rectangle
        NodeType.VPC: ('[', ']'),            # Rectangle
        NodeType.SUBNET: ('[', ']'),         # Rectangle
        NodeType.LOAD_BALANCER: ('{{', '}}') # Hexagon
    }
    
    # Trust boundary colors
    BOUNDARY_COLORS = {
        TrustBoundary.INTERNET: '#ff6b6b',      # Red
        TrustBoundary.DMZ: '#ffd93d',           # Yellow
        TrustBoundary.INTERNAL: '#6bcf7f',       # Green
        TrustBoundary.PRIVATE: '#4dabf7',        # Blue
        TrustBoundary.RESTRICTED: '#845ef7'      # Purple
    }
    
    # Data classification edge styles
    CLASSIFICATION_STYLES = {
        DataClassification.PUBLIC: 'stroke:#666,stroke-width:2px',
        DataClassification.INTERNAL: 'stroke:#4dabf7,stroke-width:2px',
        DataClassification.CONFIDENTIAL: 'stroke:#ff8c00,stroke-width:3px',
        DataClassification.RESTRICTED: 'stroke:#ff0000,stroke-width:3px',
        DataClassification.PII: 'stroke:#ff1493,stroke-width:3px,stroke-dasharray: 5 5',
        DataClassification.PHI: 'stroke:#8b0000,stroke-width:4px,stroke-dasharray: 5 5'
    }
    
    def __init__(self):
        self.node_id_map = {}
    
    def _sanitize_id(self, node_id: str) -> str:
        """Sanitize node ID for Mermaid"""
        # Replace invalid characters
        sanitized = node_id.replace('.', '_').replace(':', '_').replace('-', '_')
        # Ensure starts with letter
        if not sanitized[0].isalpha():
            sanitized = 'n_' + sanitized
        return sanitized
    
    def _format_node(self, node: DFDNode) -> str:
        """Format node in Mermaid syntax"""
        node_id = self._sanitize_id(node.id)
        label = node.label.replace('"', '\\"')
        
        # Get shape for node type
        shape_start, shape_end = self.NODE_SHAPES.get(node.type, ('[', ']'))
        
        return f'{node_id}{shape_start}"{label}"{shape_end}'
    
    def _format_edge(self, edge: DFDEdge, edge_index: int) -> str:
        """Format edge in Mermaid syntax"""
        source = self._sanitize_id(edge.source)
        target = self._sanitize_id(edge.target)
        label = edge.label.replace('"', '\\"')
        
        # Add protocol and port info to label if available
        if edge.protocol:
            label += f' ({edge.protocol}'
            if edge.port:
                label += f':{edge.port}'
            label += ')'
        
        # Encryption indicator
        if edge.encrypted:
            label += ' 🔒'
        
        # Edge style based on bidirectionality
        if edge.bidirectional:
            arrow = '<-->'
        else:
            arrow = '-->'
        
        # Format edge with label
        return f'{source} {arrow}|"{label}"| {target}'
    
    def _apply_styles(self, dfd: DFD) -> List[str]:
        """Generate style definitions"""
        styles = []
        
        # Style nodes by trust boundary
        for node in dfd.nodes:
            if node.trust_boundary:
                node_id = self._sanitize_id(node.id)
                color = self.BOUNDARY_COLORS.get(node.trust_boundary)
                if color:
                    styles.append(f'style {node_id} fill:{color},stroke:#333,stroke-width:2px')
        
        return styles
    
    def _generate_subgraphs(self, dfd: DFD) -> List[str]:
        """Generate subgraphs for trust boundaries"""
        subgraphs = []
        
        for boundary_group in dfd.trust_boundaries:
            boundary = boundary_group.boundary
            subgraph_name = boundary_group.name.replace(' ', '_')
            
            # Start subgraph
            subgraphs.append(f'subgraph {subgraph_name}["{boundary_group.name}"]')
            
            # Add nodes in this boundary
            for node_id in boundary_group.node_ids:
                node = dfd.get_node_by_id(node_id)
                if node:
                    subgraphs.append('  ' + self._format_node(node))
            
            # End subgraph
            subgraphs.append('end')
            subgraphs.append('')  # Empty line for readability
        
        return subgraphs
    
    def export_to_mermaid(self, dfd: DFD, include_trust_boundaries: bool = True) -> str:
        """
        Export DFD to Mermaid flowchart syntax
        
        Args:
            dfd: The DFD to export
            include_trust_boundaries: Whether to render trust boundaries as subgraphs
        
        Returns:
            Mermaid diagram syntax as string
        """
        lines = []
        
        # Diagram type and direction
        lines.append('flowchart TB')
        lines.append('')
        
        # Add title as comment
        lines.append(f'%% {dfd.level.title()} Level DFD')
        lines.append(f'%% Total Nodes: {len(dfd.nodes)}, Total Edges: {len(dfd.edges)}')
        lines.append('')
        
        # Generate subgraphs for trust boundaries
        if include_trust_boundaries and dfd.trust_boundaries:
            lines.extend(self._generate_subgraphs(dfd))
        else:
            # Add nodes without subgraphs
            for node in dfd.nodes:
                lines.append(self._format_node(node))
            lines.append('')
        
        # Add edges
        for i, edge in enumerate(dfd.edges):
            lines.append(self._format_edge(edge, i))
        lines.append('')
        
        # Apply styles
        styles = self._apply_styles(dfd)
        if styles:
            lines.append('%% Styles')
            lines.extend(styles)
            lines.append('')
        
        # Add legend as comments
        lines.append('%% Legend:')
        lines.append('%% 🔒 = Encrypted connection')
        lines.append(f'%% Trust Boundaries: {", ".join([b.boundary.value for b in dfd.trust_boundaries])}')
        
        return '\n'.join(lines)
    
    def export_to_mermaid_with_data_classification(self, dfd: DFD) -> str:
        """
        Export DFD with data classification color coding
        """
        lines = []
        
        # Diagram type
        lines.append('flowchart TB')
        lines.append('')
        
        # Add title
        lines.append(f'%% {dfd.level.title()} Level DFD - Data Classification View')
        lines.append('')
        
        # Add nodes
        for node in dfd.nodes:
            lines.append(self._format_node(node))
        lines.append('')
        
        # Add edges
        for i, edge in enumerate(dfd.edges):
            lines.append(self._format_edge(edge, i))
        lines.append('')
        
        # Apply node styles
        node_styles = self._apply_styles(dfd)
        lines.extend(node_styles)
        lines.append('')
        
        # Apply edge styles based on data classification
        lines.append('%% Data Classification Styles')
        for i, edge in enumerate(dfd.edges):
            if edge.data_classification:
                source = self._sanitize_id(edge.source)
                target = self._sanitize_id(edge.target)
                style = self.CLASSIFICATION_STYLES.get(edge.data_classification)
                if style:
                    # Note: Mermaid doesn't support direct edge styling in flowcharts
                    # This is a placeholder for future enhancement
                    lines.append(f'%% Edge {source}-->{target}: {edge.data_classification.value}')
        
        return '\n'.join(lines)
    
    def export_to_svg(self, dfd: DFD) -> str:
        """
        Export DFD to SVG (requires Mermaid CLI or browser rendering)
        
        Returns Mermaid syntax that can be rendered to SVG by external tools.
        """
        # For SVG export, we need an external renderer like:
        # - Mermaid CLI: mmdc -i input.mmd -o output.svg
        # - Browser-based: mermaid.render()
        # - Python: using playwright or selenium
        
        mermaid_syntax = self.export_to_mermaid(dfd)
        
        # Return HTML template that can be opened in browser for SVG export
        html_template = f"""<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
    </script>
</head>
<body>
    <div class="mermaid">
{mermaid_syntax}
    </div>
    <script>
        // Auto-download SVG after rendering
        setTimeout(() => {{
            const svg = document.querySelector('svg');
            if (svg) {{
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], {{ type: 'image/svg+xml' }});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'dfd-{dfd.level}.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }}
        }}, 2000);
    </script>
</body>
</html>"""
        
        return html_template
    
    def export_summary(self, dfd: DFD) -> Dict[str, Any]:
        """
        Export DFD summary statistics
        """
        stats = dfd.get_statistics()
        
        # Add security analysis
        cross_boundary = dfd.get_cross_boundary_edges()
        external_conns = dfd.get_external_connections()
        
        security_summary = {
            'cross_boundary_flows': len(cross_boundary),
            'external_connections': len(external_conns),
            'unencrypted_flows': len([e for e in dfd.edges if not e.encrypted]),
            'high_risk_flows': len([
                e for e in cross_boundary
                if e.data_classification in [DataClassification.CONFIDENTIAL, 
                                            DataClassification.RESTRICTED,
                                            DataClassification.PII, 
                                            DataClassification.PHI]
            ])
        }
        
        return {
            'level': dfd.level,
            'statistics': stats,
            'security': security_summary,
            'trust_boundaries': [
                {
                    'name': tb.name,
                    'boundary': tb.boundary.value,
                    'node_count': len(tb.node_ids)
                }
                for tb in dfd.trust_boundaries
            ]
        }


def export_multi_level_mermaid(service_dfd: DFD, component_dfd: DFD, 
                               code_dfd: DFD = None) -> Dict[str, str]:
    """
    Export all three levels to separate Mermaid diagrams
    
    Returns:
        Dictionary with keys 'service', 'component', 'code' mapping to Mermaid syntax
    """
    exporter = MermaidExporter()
    
    result = {
        'service': exporter.export_to_mermaid(service_dfd),
        'component': exporter.export_to_mermaid(component_dfd)
    }
    
    if code_dfd:
        result['code'] = exporter.export_to_mermaid(code_dfd, include_trust_boundaries=False)
    
    return result
