/**
 * ComplianceMapper Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ComplianceMapper } from '../ComplianceMapper';
import type { MatchedThreat } from '../../../types';
import { Severity, Likelihood } from '../../../types';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    <Notifications />
    {children}
  </MantineProvider>
);

describe('ComplianceMapper', () => {
  const mockThreats: MatchedThreat[] = [
    {
      threat_id: 'threat-1',
      threat_name: 'Public S3 Bucket',
      description: 'Bucket allows public access',
      severity: Severity.CRITICAL,
      likelihood: Likelihood.HIGH,
      risk_score: 9.5,
      category: 'Data Exposure',
      resource_id: 'res-1',
      resource_type: 'aws_s3_bucket',
      cloud_provider: 'AWS',
      matched_conditions: [],
      mitigations: [
        {
          description: 'Enable S3 bucket encryption',
          effort: 'low' as const,
          impact: 'high' as const,
          steps: ['aws s3api put-bucket-encryption'],
        },
      ],
      compliance_mappings: [
        {
          framework: 'DORA',
          control_id: 'ORT-07',
          description: 'Security and Resilience - Ensure security and resilience of IT systems',
        },
        {
          framework: 'ISO27001',
          control_id: 'A.8.2.3',
          description: 'Handling of Assets',
        },
      ],
      references: [],
    },
    {
      threat_id: 'threat-2',
      threat_name: 'Weak Lambda Permissions',
      description: 'Lambda has overly permissive IAM role',
      severity: Severity.HIGH,
      likelihood: Likelihood.MEDIUM,
      risk_score: 7.5,
      category: 'Access Control',
      resource_id: 'res-2',
      resource_type: 'aws_lambda_function',
      cloud_provider: 'AWS',
      matched_conditions: [],
      mitigations: [],
      compliance_mappings: [
        {
          framework: 'DORA',
          control_id: 'ORT-07',
          description: 'Security and Resilience',
        },
      ],
      references: [],
    },
  ];
  
  it('renders framework selector', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByLabelText('Compliance Framework')).toBeInTheDocument();
  });
  
  it('displays gap analysis summary', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Gap Analysis Summary')).toBeInTheDocument();
    expect(screen.getByText('Overall Coverage')).toBeInTheDocument();
    expect(screen.getByText('Fully Covered')).toBeInTheDocument();
    expect(screen.getByText('Partial Coverage')).toBeInTheDocument();
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument();
  });
  
  it('displays controls table', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Control ID')).toBeInTheDocument();
    expect(screen.getByText('Control Name')).toBeInTheDocument();
    expect(screen.getByText('ORT-07')).toBeInTheDocument();
    expect(screen.getByText('Security and Resilience')).toBeInTheDocument();
  });
  
  it('shows mapped threat count', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    // ORT-07 has 2 threats mapped
    const rows = screen.getAllByText('2');
    expect(rows.length).toBeGreaterThan(0);
  });
  
  it('changes framework', async () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    const select = screen.getByLabelText('Compliance Framework');
    fireEvent.click(select);
    
    await waitFor(() => {
      const iso27001Option = screen.getByText('ISO/IEC 27001');
      fireEvent.click(iso27001Option);
    });
    
    // Should show ISO27001 control
    await waitFor(() => {
      expect(screen.getByText('A.8.2.3')).toBeInTheDocument();
    });
  });
  
  it('opens control detail modal', async () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    // Click on control row
    const controlRow = screen.getByText('ORT-07').closest('tr');
    if (controlRow) {
      fireEvent.click(controlRow);
    }
    
    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Remediation Guidance')).toBeInTheDocument();
    });
  });
  
  it('exports CSV', async () => {
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    const mockClick = jest.fn();
    const mockLink = {
      click: mockClick,
      href: '',
      download: '',
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);
    
    const csvOption = await screen.findByText('Export as CSV');
    fireEvent.click(csvOption);
    
    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
    });
    
    jest.restoreAllMocks();
  });
  
  it('displays coverage percentage', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    // Should show 100% for controls with threats
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });
  
  it('displays status badges', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    // Should show Covered badge (green)
    expect(screen.getByText('Covered')).toBeInTheDocument();
  });
  
  it('shows framework description', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByText(/EU regulation on digital operational resilience/)).toBeInTheDocument();
  });
  
  it('renders empty state', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={[]} />
      </TestWrapper>
    );
    
    expect(screen.getByText(/No controls found/)).toBeInTheDocument();
  });
  
  it('shows external documentation link', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    const docLink = screen.getByLabelText('View framework documentation');
    expect(docLink).toHaveAttribute('href');
    expect(docLink).toHaveAttribute('target', '_blank');
  });
  
  it('displays category badges', () => {
    render(
      <TestWrapper>
        <ComplianceMapper threats={mockThreats} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Security')).toBeInTheDocument();
  });
});
