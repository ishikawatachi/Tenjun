/**
 * ComplianceMapper Component
 * 
 * Maps threats to compliance framework controls with gap analysis
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Container,
  Stack,
  Paper,
  Group,
  Text,
  Select,
  Table,
  Badge,
  Progress,
  Button,
  Menu,
  ActionIcon,
  Grid,
  Card,
  Title,
  Tooltip,
  ScrollArea,
} from '@mantine/core';
import {
  IconDownload,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconInfoCircle,
  IconExternalLink,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ControlDetailModal, ComplianceControl } from './ControlDetailModal';
import type { MatchedThreat } from '../../types';
import styles from './ComplianceMapper.module.css';

interface ComplianceMapperProps {
  threats: MatchedThreat[];
}

type FrameworkType = 'DORA' | 'BAFIN' | 'ISO27001' | 'SOC2' | 'NIST-800-53' | 'PCI-DSS' | 'HIPAA' | 'GDPR';

interface FrameworkInfo {
  name: string;
  description: string;
  documentationUrl: string;
}

const FRAMEWORKS: Record<FrameworkType, FrameworkInfo> = {
  'DORA': {
    name: 'Digital Operational Resilience Act',
    description: 'EU regulation on digital operational resilience for financial entities',
    documentationUrl: 'https://www.digital-operational-resilience-act.com/',
  },
  'BAFIN': {
    name: 'BaFin IT Requirements',
    description: 'German Federal Financial Supervisory Authority IT security requirements',
    documentationUrl: 'https://www.bafin.de/',
  },
  'ISO27001': {
    name: 'ISO/IEC 27001',
    description: 'International standard for information security management systems',
    documentationUrl: 'https://www.iso.org/isoiec-27001-information-security.html',
  },
  'SOC2': {
    name: 'SOC 2 Type II',
    description: 'Service Organization Control 2 audit for security, availability, and confidentiality',
    documentationUrl: 'https://www.aicpa.org/soc4so',
  },
  'NIST-800-53': {
    name: 'NIST SP 800-53',
    description: 'Security and Privacy Controls for Information Systems and Organizations',
    documentationUrl: 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final',
  },
  'PCI-DSS': {
    name: 'PCI DSS',
    description: 'Payment Card Industry Data Security Standard',
    documentationUrl: 'https://www.pcisecuritystandards.org/',
  },
  'HIPAA': {
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act',
    documentationUrl: 'https://www.hhs.gov/hipaa/',
  },
  'GDPR': {
    name: 'GDPR',
    description: 'General Data Protection Regulation',
    documentationUrl: 'https://gdpr.eu/',
  },
};

export const ComplianceMapper: React.FC<ComplianceMapperProps> = ({ threats }) => {
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType>('DORA');
  const [selectedControl, setSelectedControl] = useState<ComplianceControl | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  
  /**
   * Get available frameworks from threats
   */
  const availableFrameworks = useMemo(() => {
    const frameworks = new Set<string>();
    
    threats.forEach((threat) => {
      if (threat.compliance_mappings && threat.compliance_mappings.length > 0) {
        threat.compliance_mappings.forEach((mapping) => {
          frameworks.add(mapping.framework);
        });
      }
    });
    
    return Array.from(frameworks) as FrameworkType[];
  }, [threats]);
  
  /**
   * Build compliance controls for selected framework
   */
  const controls = useMemo(() => {
    const controlMap = new Map<string, ComplianceControl>();
    
    threats.forEach((threat) => {
      if (!threat.compliance_mappings || threat.compliance_mappings.length === 0) {
        return;
      }
      
      threat.compliance_mappings.forEach((mapping: any) => {
        if (mapping.framework !== selectedFramework) {
          return;
        }
        const controlId = mapping.control_id;
        
        if (!controlMap.has(controlId)) {
          controlMap.set(controlId, {
            id: controlId,
            name: mapping.control_id,
            description: mapping.description,
            category: undefined,
            mapped_threats: [],
            total_threats: 0,
            coverage_percentage: 0,
            status: 'gap',
            documentation_url: undefined,
          });
        }
        
        const control = controlMap.get(controlId)!;
        control.mapped_threats.push(threat);
      });
    });
    
    // Calculate coverage and status
    const allControls = Array.from(controlMap.values());
    
    allControls.forEach((control) => {
      control.total_threats = control.mapped_threats.length;
      control.coverage_percentage = control.total_threats > 0 ? 100 : 0;
      
      if (control.coverage_percentage === 100) {
        control.status = 'covered';
      } else if (control.coverage_percentage > 0) {
        control.status = 'partial';
      } else {
        control.status = 'gap';
      }
    });
    
    // Sort by status (gaps first, then partial, then covered)
    return allControls.sort((a, b) => {
      const statusOrder = { gap: 0, partial: 1, covered: 2, accepted: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [threats, selectedFramework]);
  
  /**
   * Calculate gap analysis summary
   */
  const gapAnalysis = useMemo(() => {
    const total = controls.length;
    const covered = controls.filter((c) => c.status === 'covered').length;
    const partial = controls.filter((c) => c.status === 'partial').length;
    const gaps = controls.filter((c) => c.status === 'gap').length;
    const accepted = controls.filter((c) => c.status === 'accepted').length;
    
    const overallCoverage = total > 0
      ? Math.round((covered / total) * 100)
      : 0;
    
    return {
      total,
      covered,
      partial,
      gaps,
      accepted,
      overallCoverage,
    };
  }, [controls]);
  
  /**
   * Handle control click
   */
  const handleControlClick = useCallback((control: ComplianceControl) => {
    setSelectedControl(control);
    setModalOpened(true);
  }, []);
  
  /**
   * Export as CSV
   */
  const handleExportCsv = useCallback(() => {
    const csvData = [
      ['Control ID', 'Control Name', 'Category', 'Mapped Threats', 'Coverage %', 'Status'],
      ...controls.map((control) => [
        control.id,
        control.name,
        control.category || '',
        control.mapped_threats.length.toString(),
        control.coverage_percentage.toString(),
        control.status,
      ]),
    ];
    
    const csvContent = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-${selectedFramework}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Export successful',
      message: `${selectedFramework} compliance report exported as CSV`,
      color: 'green',
    });
  }, [controls, selectedFramework]);
  
  /**
   * Export as PDF (placeholder)
   */
  const handleExportPdf = useCallback(() => {
    notifications.show({
      title: 'PDF Export',
      message: 'PDF export feature coming soon',
      color: 'blue',
    });
  }, []);
  
  /**
   * Get status badge
   */
  const getStatusBadge = (status: ComplianceControl['status']) => {
    const config = {
      covered: { color: 'green', label: 'Covered' },
      partial: { color: 'yellow', label: 'Partial' },
      gap: { color: 'red', label: 'Gap' },
      accepted: { color: 'blue', label: 'Accepted' },
    };
    
    const { color, label } = config[status];
    return <Badge color={color} variant="filled">{label}</Badge>;
  };
  
  /**
   * Get coverage color
   */
  const getCoverageColor = (percentage: number): string => {
    if (percentage === 100) return 'green';
    if (percentage >= 70) return 'yellow';
    if (percentage >= 40) return 'orange';
    return 'red';
  };
  
  const frameworkInfo = FRAMEWORKS[selectedFramework];
  
  return (
    <Container fluid className={styles.container}>
      <Stack gap="md">
        {/* Header */}
        <Paper p="md" withBorder className={styles.header}>
          <Group justify="space-between">
            <div style={{ flex: 1 }}>
              <Group gap="md">
                <Select
                  label="Compliance Framework"
                  value={selectedFramework}
                  onChange={(value: string | null) => value && setSelectedFramework(value as FrameworkType)}
                  data={availableFrameworks.map((fw) => ({
                    value: fw,
                    label: FRAMEWORKS[fw]?.name || fw,
                  }))}
                  style={{ width: 300 }}
                />
                
                {frameworkInfo && (
                  <Tooltip label={frameworkInfo.description} multiline width={300}>
                    <ActionIcon
                      component="a"
                      href={frameworkInfo.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="subtle"
                      size="lg"
                      aria-label="View framework documentation"
                    >
                      <IconExternalLink size={20} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              
              {frameworkInfo && (
                <Text size="sm" c="dimmed" mt="xs">
                  {frameworkInfo.description}
                </Text>
              )}
            </div>
            
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button leftSection={<IconDownload size={16} />} variant="light">
                  Export Report
                </Button>
              </Menu.Target>
              
              <Menu.Dropdown>
                <Menu.Label>Export Format</Menu.Label>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={16} />}
                  onClick={handleExportPdf}
                >
                  Export as PDF
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypeCsv size={16} />}
                  onClick={handleExportCsv}
                >
                  Export as CSV
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Paper>
        
        {/* Gap Analysis Summary */}
        <Paper p="md" withBorder className={styles.summary}>
          <Stack gap="md">
            <Title order={3}>Gap Analysis Summary</Title>
            
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card padding="md" withBorder>
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Overall Coverage</Text>
                    <Text size="2rem" fw={700} c={getCoverageColor(gapAnalysis.overallCoverage)}>
                      {gapAnalysis.overallCoverage}%
                    </Text>
                    <Progress
                      value={gapAnalysis.overallCoverage}
                      color={getCoverageColor(gapAnalysis.overallCoverage)}
                      size="sm"
                      style={{ width: '100%' }}
                    />
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card padding="md" withBorder>
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Fully Covered</Text>
                    <Text size="2rem" fw={700} c="green">{gapAnalysis.covered}</Text>
                    <Text size="xs" c="dimmed">of {gapAnalysis.total} controls</Text>
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card padding="md" withBorder>
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Partial Coverage</Text>
                    <Text size="2rem" fw={700} c="yellow">{gapAnalysis.partial}</Text>
                    <Text size="xs" c="dimmed">needs attention</Text>
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card padding="md" withBorder>
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Coverage Gaps</Text>
                    <Text size="2rem" fw={700} c="red">{gapAnalysis.gaps}</Text>
                    <Text size="xs" c="dimmed">requires action</Text>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        </Paper>
        
        {/* Controls Table */}
        <Paper withBorder className={styles.tableContainer}>
          <ScrollArea>
            <Table striped highlightOnHover className={styles.table}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Control ID</Table.Th>
                  <Table.Th>Control Name</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Mapped Threats</Table.Th>
                  <Table.Th>Coverage</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {controls.length > 0 ? (
                  controls.map((control) => (
                    <Table.Tr
                      key={control.id}
                      onClick={() => handleControlClick(control)}
                      className={styles.clickableRow}
                    >
                      <Table.Td>
                        <Text fw={600} size="sm">{control.id}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{control.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        {control.category && (
                          <Badge variant="light" size="sm">{control.category}</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{control.mapped_threats.length}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress
                            value={control.coverage_percentage}
                            color={getCoverageColor(control.coverage_percentage)}
                            size="md"
                            style={{ width: 100 }}
                          />
                          <Text size="sm" fw={500}>
                            {control.coverage_percentage}%
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {getStatusBadge(control.status)}
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon variant="subtle" size="sm">
                          <IconInfoCircle size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" py="xl">
                        No controls found for {selectedFramework}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </Stack>
      
      {/* Control Detail Modal */}
      <ControlDetailModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        control={selectedControl}
        framework={selectedFramework}
      />
    </Container>
  );
};
