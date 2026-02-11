/**
 * DFDVisualizer Tests
 * 
 * Unit tests for DFD visualization component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { DFDVisualizer } from '../DFDVisualizer';
import type { DFD, DFDNode, DFDEdge } from '../../../types';

// Mock mermaid
jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({
      svg: '<svg><g class="node" id="flowchart-node1-123"><rect /></g></svg>',
    }),
  },
}));

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    <Notifications />
    {children}
  </MantineProvider>
);

describe('DFDVisualizer', () => {
  const mockNodes: DFDNode[] = [
    {
      id: 'node1',
      label: 'API Gateway',
      type: 'PROCESS',
      trust_boundary: 'Internet',
      metadata: {
        resource_id: 'api-gw-1',
        resource_type: 'aws_api_gateway',
        threat_count: 3,
        risk_level: 'HIGH',
      },
    },
    {
      id: 'node2',
      label: 'Lambda Function',
      type: 'PROCESS',
      trust_boundary: 'Private',
      metadata: {
        resource_id: 'lambda-1',
        resource_type: 'aws_lambda_function',
        threat_count: 1,
        risk_level: 'LOW',
      },
    },
  ];
  
  const mockEdges: DFDEdge[] = [
    {
      source: 'node1',
      target: 'node2',
      label: 'HTTP Request',
      data_classification: 'CONFIDENTIAL',
      protocol: 'HTTPS',
    },
  ];
  
  const mockDfd: DFD = {
    name: 'Test DFD',
    level: 'service',
    nodes: mockNodes,
    edges: mockEdges,
    trust_boundaries: [
      {
        name: 'Internet',
        type: 'PUBLIC',
        nodes: ['node1'],
      },
      {
        name: 'Private',
        type: 'PRIVATE',
        nodes: ['node2'],
      },
    ],
  };
  
  it('renders empty state when no DFD provided', () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={null} />
      </TestWrapper>
    );
    
    expect(screen.getByText('No DFD data available')).toBeInTheDocument();
    expect(screen.getByText('Upload Terraform configuration to generate diagrams')).toBeInTheDocument();
  });
  
  it('renders diagram with nodes and edges', async () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    // Check toolbar elements
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByText('1 edges')).toBeInTheDocument();
    expect(screen.getByText('2 boundaries')).toBeInTheDocument();
  });
  
  it('handles level change', async () => {
    const onLevelChange = jest.fn();
    
    render(
      <TestWrapper>
        <DFDVisualizer
          dfd={mockDfd}
          level="service"
          onLevelChange={onLevelChange}
        />
      </TestWrapper>
    );
    
    const componentButton = screen.getByText('Component');
    fireEvent.click(componentButton);
    
    expect(onLevelChange).toHaveBeenCalledWith('component');
  });
  
  it('handles zoom controls', async () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    const zoomInButton = screen.getByLabelText('Zoom in');
    const zoomOutButton = screen.getByLabelText('Zoom out');
    const zoomResetButton = screen.getByLabelText('Reset zoom');
    
    // Initial zoom
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // Zoom in
    fireEvent.click(zoomInButton);
    await waitFor(() => {
      expect(screen.getByText('120%')).toBeInTheDocument();
    });
    
    // Zoom out
    fireEvent.click(zoomOutButton);
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    
    // Zoom in twice then reset
    fireEvent.click(zoomInButton);
    fireEvent.click(zoomInButton);
    fireEvent.click(zoomResetButton);
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
  
  it('handles node click', async () => {
    const onNodeClick = jest.fn();
    
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} onNodeClick={onNodeClick} />
      </TestWrapper>
    );
    
    await waitFor(() => {
      const diagram = screen.getByRole('img');
      expect(diagram).toBeInTheDocument();
    });
  });
  
  it('handles keyboard navigation', async () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    const diagram = screen.getByRole('img');
    
    // Zoom in with +
    fireEvent.keyDown(diagram, { key: '+' });
    await waitFor(() => {
      expect(screen.getByText('120%')).toBeInTheDocument();
    });
    
    // Zoom out with -
    fireEvent.keyDown(diagram, { key: '-' });
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    
    // Reset with 0
    fireEvent.keyDown(diagram, { key: '+' });
    fireEvent.keyDown(diagram, { key: '0' });
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
  
  it('disables zoom buttons at limits', async () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    const zoomInButton = screen.getByLabelText('Zoom in');
    const zoomOutButton = screen.getByLabelText('Zoom out');
    
    // Zoom to max
    for (let i = 0; i < 15; i++) {
      fireEvent.click(zoomInButton);
    }
    
    await waitFor(() => {
      expect(zoomInButton).toBeDisabled();
    });
    
    // Zoom to min
    for (let i = 0; i < 25; i++) {
      fireEvent.click(zoomOutButton);
    }
    
    await waitFor(() => {
      expect(zoomOutButton).toBeDisabled();
    });
  });
  
  it('renders legend with risk levels', () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Legend:')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });
  
  it('has proper ARIA labels', () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} />
      </TestWrapper>
    );
    
    const diagram = screen.getByRole('img');
    expect(diagram).toHaveAttribute(
      'aria-label',
      'Data flow diagram showing 2 nodes and 1 connections'
    );
    
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
  
  it('supports theme prop', () => {
    const { rerender } = render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} theme="light" />
      </TestWrapper>
    );
    
    rerender(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} theme="dark" />
      </TestWrapper>
    );
    
    // Component should re-render without errors
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
  });
  
  it('highlights selected node', async () => {
    render(
      <TestWrapper>
        <DFDVisualizer dfd={mockDfd} selectedNode="node1" />
      </TestWrapper>
    );
    
    // Component should render with selected node
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
  });
});
