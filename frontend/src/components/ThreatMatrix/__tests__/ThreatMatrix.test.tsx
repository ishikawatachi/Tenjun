/**
 * ThreatMatrix Tests
 * 
 * Unit tests for threat matrix component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ThreatMatrix } from '../ThreatMatrix';
import type { MatchedThreat } from '../../../types';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    <Notifications />
    {children}
  </MantineProvider>
);

describe('ThreatMatrix', () => {
  const mockThreats: MatchedThreat[] = [
    {
      resource: {
        id: 'res-1',
        type: 'aws_s3_bucket',
        name: 'data-bucket',
        cloud_provider: 'AWS',
        properties: {},
      },
      matched_threat: {
        id: 'threat-1',
        name: 'Public S3 Bucket',
        description: 'Bucket allows public access',
        severity: 'CRITICAL',
        likelihood: 'HIGH',
        category: 'Data Exposure',
        stride: ['INFORMATION_DISCLOSURE'],
        references: [],
      },
      match_details: {
        matched_conditions: [],
        all_conditions: [],
      },
      mitigations: [],
    },
    {
      resource: {
        id: 'res-2',
        type: 'aws_lambda_function',
        name: 'api-handler',
        cloud_provider: 'AWS',
        properties: {},
      },
      matched_threat: {
        id: 'threat-2',
        name: 'Weak Lambda Permissions',
        description: 'Lambda has overly permissive IAM role',
        severity: 'HIGH',
        likelihood: 'MEDIUM',
        category: 'Access Control',
        stride: ['ELEVATION_OF_PRIVILEGE'],
        references: [],
      },
      match_details: {
        matched_conditions: [],
        all_conditions: [],
      },
      mitigations: [],
    },
    {
      resource: {
        id: 'res-3',
        type: 'gcp_compute_instance',
        name: 'web-server',
        cloud_provider: 'GCP',
        properties: {},
      },
      matched_threat: {
        id: 'threat-3',
        name: 'Unencrypted Disk',
        description: 'Disk encryption not enabled',
        severity: 'MEDIUM',
        likelihood: 'LOW',
        category: 'Data Protection',
        stride: ['INFORMATION_DISCLOSURE'],
        references: [],
      },
      match_details: {
        matched_conditions: [],
        all_conditions: [],
      },
      mitigations: [],
      compliance_mappings: {
        'DORA': [
          {
            framework: 'DORA',
            control_id: 'DORA-001',
            control_name: 'Data Encryption',
            control_category: 'Security',
          },
        ],
      },
    },
  ];
  
  it('renders matrix with statistics', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Check statistics
    expect(screen.getByText('3')).toBeInTheDocument(); // Total
    expect(screen.getByText('1 Critical')).toBeInTheDocument();
    expect(screen.getByText('1 High')).toBeInTheDocument();
    expect(screen.getByText('1 Medium')).toBeInTheDocument();
  });
  
  it('renders 5x5 grid', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Check axis labels
    expect(screen.getByText('Very High')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Very Low')).toBeInTheDocument();
    
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });
  
  it('displays bubbles with threat counts', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Check for threat count bubbles
    const bubbles = screen.getAllByRole('button');
    expect(bubbles.length).toBeGreaterThan(0);
  });
  
  it('handles cell click', async () => {
    const onThreatClick = jest.fn();
    
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} onThreatClick={onThreatClick} />
      </TestWrapper>
    );
    
    // Find and click a cell with threats
    const cells = screen.getAllByRole('button');
    const cellWithThreats = cells.find((cell) => {
      const ariaLabel = cell.getAttribute('aria-label');
      return ariaLabel && ariaLabel.includes('1 threats');
    });
    
    if (cellWithThreats) {
      fireEvent.click(cellWithThreats);
      
      await waitFor(() => {
        expect(onThreatClick).toHaveBeenCalled();
      });
    }
  });
  
  it('filters by severity', async () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Open severity filter
    const severityInput = screen.getByLabelText('Severity');
    fireEvent.click(severityInput);
    
    // Select CRITICAL
    await waitFor(() => {
      const criticalOption = screen.getByText('Critical');
      fireEvent.click(criticalOption);
    });
    
    // Check that filter is active
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });
  
  it('filters by cloud provider', async () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Open cloud provider filter
    const providerInput = screen.getByLabelText('Cloud Provider');
    fireEvent.click(providerInput);
    
    // AWS option should be available
    await waitFor(() => {
      expect(screen.getByText('AWS')).toBeInTheDocument();
    });
  });
  
  it('filters by compliance framework', async () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Open compliance filter
    const complianceInput = screen.getByLabelText('Compliance Framework');
    fireEvent.click(complianceInput);
    
    // DORA option should be available (from threat-3)
    await waitFor(() => {
      expect(screen.getByText('DORA')).toBeInTheDocument();
    });
  });
  
  it('clears all filters', async () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Add a filter
    const severityInput = screen.getByLabelText('Severity');
    fireEvent.click(severityInput);
    
    await waitFor(() => {
      const criticalOption = screen.getByText('Critical');
      fireEvent.click(criticalOption);
    });
    
    // Clear filters
    const clearButton = await screen.findByText('Clear All');
    fireEvent.click(clearButton);
    
    // Active badge should be gone
    await waitFor(() => {
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });
  
  it('exports CSV', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock link click
    const mockClick = jest.fn();
    const mockLink = {
      click: mockClick,
      href: '',
      download: '',
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Open export menu
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);
    
    // Click CSV export
    const csvOption = await screen.findByText('Export as CSV');
    fireEvent.click(csvOption);
    
    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
    });
    
    // Cleanup
    jest.restoreAllMocks();
  });
  
  it('shows threat details modal', async () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Find and click a cell with threats
    const cells = screen.getAllByRole('button');
    const cellWithThreats = cells.find((cell) => {
      const ariaLabel = cell.getAttribute('aria-label');
      return ariaLabel && ariaLabel.includes('High likelihood') && ariaLabel.includes('Critical impact');
    });
    
    if (cellWithThreats) {
      fireEvent.click(cellWithThreats);
      
      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('Public S3 Bucket')).toBeInTheDocument();
      });
    }
  });
  
  it('handles keyboard navigation', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    // Find a cell
    const cells = screen.getAllByRole('button');
    const firstCell = cells[0];
    
    // Focus and press Enter
    firstCell.focus();
    fireEvent.keyPress(firstCell, { key: 'Enter' });
    
    // Modal or callback should be triggered
    expect(firstCell).toHaveAttribute('tabindex', '0');
  });
  
  it('displays legend', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Bubble Color (Severity)')).toBeInTheDocument();
    expect(screen.getByText('Bubble Size')).toBeInTheDocument();
    expect(screen.getByText('Few threats')).toBeInTheDocument();
    expect(screen.getByText('Many threats')).toBeInTheDocument();
  });
  
  it('has proper ARIA labels', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={mockThreats} />
      </TestWrapper>
    );
    
    const cells = screen.getAllByRole('button');
    cells.forEach((cell) => {
      expect(cell).toHaveAttribute('aria-label');
      const label = cell.getAttribute('aria-label');
      expect(label).toMatch(/likelihood.*impact.*threats/);
    });
  });
  
  it('renders empty state for no threats', () => {
    render(
      <TestWrapper>
        <ThreatMatrix threats={[]} />
      </TestWrapper>
    );
    
    expect(screen.getByText('0')).toBeInTheDocument(); // Total
  });
});
