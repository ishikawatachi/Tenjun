/**
 * DFD Generator Client
 * 
 * TypeScript client for generating Data Flow Diagrams from infrastructure resources.
 * Supports service-level, component-level, and code-level DFD generation with
 * Mermaid diagram export.
 */

import { spawn } from 'child_process';
import * as path from 'path';

// Type definitions
export enum NodeType {
  SERVICE = 'service',
  DATABASE = 'database',
  STORAGE = 'storage',
  COMPUTE = 'compute',
  NETWORK = 'network',
  API = 'api',
  CACHE = 'cache',
  QUEUE = 'queue',
  FUNCTION = 'function',
  EXTERNAL = 'external',
  USER = 'user',
  ADMIN = 'admin',
  LOAD_BALANCER = 'load_balancer',
  FIREWALL = 'firewall',
  VPC = 'vpc',
  SUBNET = 'subnet'
}

export enum TrustBoundary {
  INTERNET = 'internet',
  DMZ = 'dmz',
  INTERNAL = 'internal',
  PRIVATE = 'private',
  RESTRICTED = 'restricted'
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii',
  PHI = 'phi'
}

export interface DFDNode {
  id: string;
  label: string;
  type: NodeType;
  cloud_provider?: string;
  trust_boundary?: TrustBoundary;
  resource_type?: string;
  properties?: Record<string, any>;
  tags?: string[];
}

export interface DFDEdge {
  source: string;
  target: string;
  label: string;
  data_classification?: DataClassification;
  protocol?: string;
  port?: number;
  encrypted?: boolean;
  bidirectional?: boolean;
  properties?: Record<string, any>;
}

export interface TrustBoundaryGroup {
  boundary: TrustBoundary;
  name: string;
  node_ids: string[];
  description?: string;
}

export interface DFDStatistics {
  level: string;
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
  trust_boundaries: Record<string, number>;
  data_classifications: Record<string, number>;
  cross_boundary_flows: number;
  external_connections: number;
  encrypted_flows: number;
}

export interface DFD {
  level: string;
  nodes: DFDNode[];
  edges: DFDEdge[];
  trust_boundaries: TrustBoundaryGroup[];
  metadata: Record<string, any>;
  statistics: DFDStatistics;
}

export interface DFDGenerationResult {
  service_level?: DFD;
  component_level?: DFD;
  code_level?: DFD;
  metadata: Record<string, any>;
}

export interface CodeFlow {
  function: string;
  calls?: string[];
  external_apis?: string[];
  data_access?: string[];
}

export interface DFDGenerationOptions {
  include_service_level?: boolean;
  include_component_level?: boolean;
  include_code_level?: boolean;
  include_trust_boundaries?: boolean;
}

/**
 * DFD Generator Client
 */
export class DFDGeneratorClient {
  private pythonPath: string;
  private analysisPath: string;

  constructor(analysisPath?: string) {
    this.analysisPath = analysisPath || path.join(__dirname, '../../../analysis');
    this.pythonPath = 'python3';
  }

  /**
   * Generate service-level DFD
   */
  async generateServiceLevelDFD(resources: any[]): Promise<DFD> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.dfd_generator import DFDGenerator

resources = json.loads('''${JSON.stringify(resources)}''')

generator = DFDGenerator()
dfd = generator.generate_service_level_dfd(resources)

print(json.dumps(dfd.to_dict(), indent=2))
`;

    return this.executePython(pythonCode);
  }

  /**
   * Generate component-level DFD
   */
  async generateComponentLevelDFD(resources: any[]): Promise<DFD> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.dfd_generator import DFDGenerator

resources = json.loads('''${JSON.stringify(resources)}''')

generator = DFDGenerator()
dfd = generator.generate_component_level_dfd(resources)

print(json.dumps(dfd.to_dict(), indent=2))
`;

    return this.executePython(pythonCode);
  }

  /**
   * Generate code-level DFD
   */
  async generateCodeLevelDFD(codeFlows: CodeFlow[]): Promise<DFD> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.dfd_generator import DFDGenerator

code_flows = json.loads('''${JSON.stringify(codeFlows)}''')

generator = DFDGenerator()
dfd = generator.generate_code_level_dfd(code_flows)

print(json.dumps(dfd.to_dict(), indent=2))
`;

    return this.executePython(pythonCode);
  }

  /**
   * Generate all three levels of DFDs
   */
  async generateAllLevels(
    resources: any[],
    codeFlows?: CodeFlow[]
  ): Promise<DFDGenerationResult> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.dfd_generator import DFDGenerator

resources = json.loads('''${JSON.stringify(resources)}''')
code_flows = ${codeFlows ? `json.loads('''${JSON.stringify(codeFlows)}''')` : 'None'}

generator = DFDGenerator()
result = generator.generate_all_levels(resources, code_flows)

print(json.dumps(result.to_dict(), indent=2))
`;

    return this.executePython(pythonCode);
  }

  /**
   * Export DFD to Mermaid diagram syntax
   */
  async exportToMermaid(
    dfd: DFD,
    includeTrustBoundaries: boolean = true
  ): Promise<string> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.mermaid_exporter import MermaidExporter
from models.dfd import DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, DataClassification, TrustBoundaryGroup

# Reconstruct DFD from JSON
def reconstruct_dfd(data):
    from enum import Enum
    
    # Helper to convert string to enum
    def to_enum(enum_class, value):
        if value is None:
            return None
        try:
            return enum_class[value.upper()]
        except:
            return None
    
    nodes = []
    for node_data in data['nodes']:
        node = DFDNode(
            id=node_data['id'],
            label=node_data['label'],
            type=to_enum(NodeType, node_data['type']),
            cloud_provider=node_data.get('cloud_provider'),
            trust_boundary=to_enum(TrustBoundary, node_data.get('trust_boundary')),
            resource_type=node_data.get('resource_type'),
            properties=node_data.get('properties', {}),
            tags=node_data.get('tags', [])
        )
        nodes.append(node)
    
    edges = []
    for edge_data in data['edges']:
        edge = DFDEdge(
            source=edge_data['source'],
            target=edge_data['target'],
            label=edge_data['label'],
            data_classification=to_enum(DataClassification, edge_data.get('data_classification')),
            protocol=edge_data.get('protocol'),
            port=edge_data.get('port'),
            encrypted=edge_data.get('encrypted', False),
            bidirectional=edge_data.get('bidirectional', False),
            properties=edge_data.get('properties', {})
        )
        edges.append(edge)
    
    trust_boundaries = []
    for tb_data in data['trust_boundaries']:
        tb = TrustBoundaryGroup(
            boundary=to_enum(TrustBoundary, tb_data['boundary']),
            name=tb_data['name'],
            node_ids=tb_data['node_ids'],
            description=tb_data.get('description')
        )
        trust_boundaries.append(tb)
    
    dfd = DFD(
        level=data['level'],
        nodes=nodes,
        edges=edges,
        trust_boundaries=trust_boundaries,
        metadata=data.get('metadata', {})
    )
    
    return dfd

dfd_data = json.loads('''${JSON.stringify(dfd)}''')
dfd = reconstruct_dfd(dfd_data)

exporter = MermaidExporter()
mermaid_syntax = exporter.export_to_mermaid(dfd, include_trust_boundaries=${includeTrustBoundaries})

print(mermaid_syntax)
`;

    const result = await this.executePython(pythonCode);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }

  /**
   * Export DFD to SVG HTML template
   */
  async exportToSVG(dfd: DFD): Promise<string> {
    // Similar to exportToMermaid but calls export_to_svg
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.mermaid_exporter import MermaidExporter
from models.dfd import DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, DataClassification, TrustBoundaryGroup

# Reconstruct DFD from JSON (same function as above)
def reconstruct_dfd(data):
    from enum import Enum
    
    def to_enum(enum_class, value):
        if value is None:
            return None
        try:
            return enum_class[value.upper()]
        except:
            return None
    
    nodes = [
        DFDNode(
            id=n['id'], label=n['label'], type=to_enum(NodeType, n['type']),
            cloud_provider=n.get('cloud_provider'),
            trust_boundary=to_enum(TrustBoundary, n.get('trust_boundary')),
            resource_type=n.get('resource_type'),
            properties=n.get('properties', {}), tags=n.get('tags', [])
        )
        for n in data['nodes']
    ]
    
    edges = [
        DFDEdge(
            source=e['source'], target=e['target'], label=e['label'],
            data_classification=to_enum(DataClassification, e.get('data_classification')),
            protocol=e.get('protocol'), port=e.get('port'),
            encrypted=e.get('encrypted', False), bidirectional=e.get('bidirectional', False),
            properties=e.get('properties', {})
        )
        for e in data['edges']
    ]
    
    trust_boundaries = [
        TrustBoundaryGroup(
            boundary=to_enum(TrustBoundary, tb['boundary']), name=tb['name'],
            node_ids=tb['node_ids'], description=tb.get('description')
        )
        for tb in data['trust_boundaries']
    ]
    
    return DFD(level=data['level'], nodes=nodes, edges=edges,
               trust_boundaries=trust_boundaries, metadata=data.get('metadata', {}))

dfd_data = json.loads('''${JSON.stringify(dfd)}''')
dfd = reconstruct_dfd(dfd_data)

exporter = MermaidExporter()
svg_html = exporter.export_to_svg(dfd)

print(svg_html)
`;

    const result = await this.executePython(pythonCode);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }

  /**
   * Get DFD summary statistics
   */
  async getDFDSummary(dfd: DFD): Promise<any> {
    const pythonCode = `
import sys
import json
sys.path.insert(0, '${this.analysisPath}')

from dfd.mermaid_exporter import MermaidExporter
from models.dfd import DFD, DFDNode, DFDEdge, NodeType, TrustBoundary, DataClassification, TrustBoundaryGroup

def reconstruct_dfd(data):
    from enum import Enum
    
    def to_enum(enum_class, value):
        if value is None:
            return None
        try:
            return enum_class[value.upper()]
        except:
            return None
    
    nodes = [
        DFDNode(
            id=n['id'], label=n['label'], type=to_enum(NodeType, n['type']),
            cloud_provider=n.get('cloud_provider'),
            trust_boundary=to_enum(TrustBoundary, n.get('trust_boundary')),
            resource_type=n.get('resource_type'),
            properties=n.get('properties', {}), tags=n.get('tags', [])
        )
        for n in data['nodes']
    ]
    
    edges = [
        DFDEdge(
            source=e['source'], target=e['target'], label=e['label'],
            data_classification=to_enum(DataClassification, e.get('data_classification')),
            protocol=e.get('protocol'), port=e.get('port'),
            encrypted=e.get('encrypted', False), bidirectional=e.get('bidirectional', False),
            properties=e.get('properties', {})
        )
        for e in data['edges']
    ]
    
    trust_boundaries = [
        TrustBoundaryGroup(
            boundary=to_enum(TrustBoundary, tb['boundary']), name=tb['name'],
            node_ids=tb['node_ids'], description=tb.get('description')
        )
        for tb in data['trust_boundaries']
    ]
    
    return DFD(level=data['level'], nodes=nodes, edges=edges,
               trust_boundaries=trust_boundaries, metadata=data.get('metadata', {}))

dfd_data = json.loads('''${JSON.stringify(dfd)}''')
dfd = reconstruct_dfd(dfd_data)

exporter = MermaidExporter()
summary = exporter.export_summary(dfd)

print(json.dumps(summary, indent=2))
`;

    return this.executePython(pythonCode);
  }

  /**
   * Execute Python code and return parsed result
   */
  private executePython(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, ['-c', code]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Try to parse as JSON
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          // If not JSON, return as string
          resolve(stdout.trim());
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }
}

/**
 * Helper functions for common DFD operations
 */

export function filterNodesByType(dfd: DFD, type: NodeType): DFDNode[] {
  return dfd.nodes.filter(node => node.type === type);
}

export function filterNodesByBoundary(dfd: DFD, boundary: TrustBoundary): DFDNode[] {
  return dfd.nodes.filter(node => node.trust_boundary === boundary);
}

export function getCrossBoundaryEdges(dfd: DFD): DFDEdge[] {
  return dfd.edges.filter(edge => {
    const sourceNode = dfd.nodes.find(n => n.id === edge.source);
    const targetNode = dfd.nodes.find(n => n.id === edge.target);
    return sourceNode && targetNode && 
           sourceNode.trust_boundary !== targetNode.trust_boundary;
  });
}

export function getHighRiskFlows(dfd: DFD): DFDEdge[] {
  const highRiskClassifications = [
    DataClassification.CONFIDENTIAL,
    DataClassification.RESTRICTED,
    DataClassification.PII,
    DataClassification.PHI
  ];
  
  return dfd.edges.filter(edge => 
    edge.data_classification && 
    highRiskClassifications.includes(edge.data_classification)
  );
}

export function getUnencryptedFlows(dfd: DFD): DFDEdge[] {
  return dfd.edges.filter(edge => !edge.encrypted);
}

export function generateDFDReport(dfd: DFD): string {
  const stats = dfd.statistics;
  
  let report = `# DFD Report: ${dfd.level.toUpperCase()} Level\n\n`;
  report += `## Overview\n`;
  report += `- Total Nodes: ${stats.total_nodes}\n`;
  report += `- Total Edges: ${stats.total_edges}\n`;
  report += `- Cross-Boundary Flows: ${stats.cross_boundary_flows}\n`;
  report += `- External Connections: ${stats.external_connections}\n`;
  report += `- Encrypted Flows: ${stats.encrypted_flows}/${stats.total_edges}\n\n`;
  
  report += `## Node Types\n`;
  for (const [type, count] of Object.entries(stats.node_types)) {
    report += `- ${type}: ${count}\n`;
  }
  report += `\n`;
  
  report += `## Trust Boundaries\n`;
  for (const [boundary, count] of Object.entries(stats.trust_boundaries)) {
    report += `- ${boundary}: ${count} nodes\n`;
  }
  report += `\n`;
  
  if (Object.keys(stats.data_classifications).length > 0) {
    report += `## Data Classifications\n`;
    for (const [classification, count] of Object.entries(stats.data_classifications)) {
      report += `- ${classification}: ${count} flows\n`;
    }
  }
  
  return report;
}

export default DFDGeneratorClient;
