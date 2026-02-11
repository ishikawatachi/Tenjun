/**
 * useMermaidRender Hook
 * 
 * Custom hook for rendering Mermaid diagrams with error handling and lifecycle management
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import type { DFD, Severity } from '../../types';

interface MermaidRenderOptions {
  dfd: DFD | null;
  selectedNode?: string;
  colorByRisk?: boolean;
  showTrustBoundaries?: boolean;
  theme?: 'light' | 'dark';
}

interface MermaidRenderResult {
  containerRef: React.RefObject<HTMLDivElement>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  isLoading: boolean;
  error: string | null;
  renderDiagram: () => Promise<void>;
  exportSvg: () => string | null;
  exportPng: () => Promise<string | null>;
}

const severityColors: Record<Severity, string> = {
  CRITICAL: '#fa5252',
  HIGH: '#fd7e14',
  MEDIUM: '#fab005',
  LOW: '#51cf66',
  INFO: '#94d82d',
};

const severityFillColors: Record<Severity, string> = {
  CRITICAL: '#ffe3e3',
  HIGH: '#fff3e0',
  MEDIUM: '#fff9db',
  LOW: '#ebfbee',
  INFO: '#f4fce3',
};

/**
 * Generate Mermaid markup from DFD data
 */
function generateMermaidMarkup(
  dfd: DFD,
  selectedNode?: string,
  colorByRisk: boolean = true,
  showTrustBoundaries: boolean = true,
  theme: 'light' | 'dark' = 'light'
): string {
  let markup = 'graph TB\n';
  
  // Add styling
  markup += '  classDef criticalNode fill:#ffe3e3,stroke:#fa5252,stroke-width:3px\n';
  markup += '  classDef highNode fill:#fff3e0,stroke:#fd7e14,stroke-width:3px\n';
  markup += '  classDef mediumNode fill:#fff9db,stroke:#fab005,stroke-width:2px\n';
  markup += '  classDef lowNode fill:#ebfbee,stroke:#51cf66,stroke-width:2px\n';
  markup += '  classDef infoNode fill:#f4fce3,stroke:#94d82d,stroke-width:2px\n';
  markup += '  classDef selectedNode stroke:#228be6,stroke-width:4px\n';
  
  // Track nodes for each trust boundary
  const trustBoundaryNodes: Record<string, string[]> = {};
  
  // Add nodes
  dfd.nodes.forEach((node) => {
    const nodeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
    const label = node.label || node.id;
    
    // Determine node shape based on type
    let nodeMarkup = '';
    switch (node.type) {
      case 'EXTERNAL_ENTITY':
        nodeMarkup = `${nodeId}[["${label}"]]`;
        break;
      case 'PROCESS':
        nodeMarkup = `${nodeId}["${label}"]`;
        break;
      case 'DATA_STORE':
        nodeMarkup = `${nodeId}[("${label}")]`;
        break;
      case 'DATA_FLOW':
        nodeMarkup = `${nodeId}>"${label}"]`;
        break;
      default:
        nodeMarkup = `${nodeId}["${label}"]`;
    }
    
    markup += `  ${nodeMarkup}\n`;
    
    // Track trust boundary membership
    if (node.trust_boundary && showTrustBoundaries) {
      if (!trustBoundaryNodes[node.trust_boundary]) {
        trustBoundaryNodes[node.trust_boundary] = [];
      }
      trustBoundaryNodes[node.trust_boundary].push(nodeId);
    }
    
    // Apply risk-based coloring
    if (colorByRisk && node.metadata?.risk_level) {
      const riskLevel = node.metadata.risk_level.toUpperCase() as Severity;
      const className = `${riskLevel.toLowerCase()}Node`;
      markup += `  class ${nodeId} ${className}\n`;
    }
    
    // Highlight selected node
    if (selectedNode === node.id) {
      markup += `  class ${nodeId} selectedNode\n`;
    }
  });
  
  // Add edges
  dfd.edges.forEach((edge) => {
    const sourceId = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
    const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
    const label = edge.label || '';
    
    if (label) {
      markup += `  ${sourceId} -->|"${label}"| ${targetId}\n`;
    } else {
      markup += `  ${sourceId} --> ${targetId}\n`;
    }
  });
  
  // Add trust boundaries as subgraphs
  if (showTrustBoundaries) {
    Object.entries(trustBoundaryNodes).forEach(([boundary, nodes], index) => {
      markup += `  subgraph TB${index}["${boundary}"]\n`;
      nodes.forEach(nodeId => {
        markup += `    ${nodeId}\n`;
      });
      markup += '  end\n';
    });
  }
  
  return markup;
}

/**
 * Custom hook for Mermaid diagram rendering
 */
export function useMermaidRender({
  dfd,
  selectedNode,
  colorByRisk = true,
  showTrustBoundaries = true,
  theme = 'light',
}: MermaidRenderOptions): MermaidRenderResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
    });
  }, [theme]);
  
  /**
   * Render the diagram
   */
  const renderDiagram = useCallback(async () => {
    if (!dfd || !containerRef.current) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate Mermaid markup
      const markup = generateMermaidMarkup(
        dfd,
        selectedNode,
        colorByRisk,
        showTrustBoundaries,
        theme
      );
      
      // Clear previous diagram
      containerRef.current.innerHTML = '';
      
      // Render new diagram
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, markup);
      
      // Insert SVG
      containerRef.current.innerHTML = svg;
      
      // Get reference to SVG element
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgRef.current = svgElement;
        
        // Make SVG responsive
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.style.maxWidth = '100%';
        
        // Add click handlers to nodes
        const nodes = svgElement.querySelectorAll('.node');
        nodes.forEach((node) => {
          node.setAttribute('role', 'button');
          node.setAttribute('tabindex', '0');
          node.style.cursor = 'pointer';
          
          // Add hover effect
          node.addEventListener('mouseenter', () => {
            const rect = node.querySelector('rect, circle, polygon');
            if (rect) {
              rect.setAttribute('stroke-width', '4');
            }
          });
          
          node.addEventListener('mouseleave', () => {
            const rect = node.querySelector('rect, circle, polygon');
            if (rect) {
              const originalWidth = node.classList.contains('selectedNode') ? '4' : '2';
              rect.setAttribute('stroke-width', originalWidth);
            }
          });
        });
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Mermaid render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setIsLoading(false);
    }
  }, [dfd, selectedNode, colorByRisk, showTrustBoundaries, theme]);
  
  /**
   * Export diagram as SVG string
   */
  const exportSvg = useCallback((): string | null => {
    if (!svgRef.current) {
      return null;
    }
    
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgClone);
  }, []);
  
  /**
   * Export diagram as PNG data URL
   */
  const exportPng = useCallback(async (): Promise<string | null> => {
    const svgString = exportSvg();
    if (!svgString) {
      return null;
    }
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = theme === 'dark' ? '#1a1b1e' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(pngUrl);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  }, [exportSvg, theme]);
  
  // Re-render when dependencies change
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);
  
  return {
    containerRef,
    svgRef,
    isLoading,
    error,
    renderDiagram,
    exportSvg,
    exportPng,
  };
}
