/**
 * ThreatMatrix Component
 * 
 * Risk matrix visualization with likelihood vs. impact
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Select,
  MultiSelect,
  Button,
  Menu,
  ActionIcon,
  Tooltip,
  Modal,
  Card,
  Grid,
  Container,
} from '@mantine/core';
import {
  IconDownload,
  IconFilter,
  IconX,
  IconPhoto,
  IconFileTypeCsv,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { MatchedThreat, Severity, Likelihood, CloudProvider } from '../../types';
import styles from './ThreatMatrix.module.css';

interface ThreatMatrixProps {
  threats: MatchedThreat[];
  onThreatClick?: (threats: MatchedThreat[]) => void;
}

interface MatrixCell {
  likelihood: Likelihood;
  impact: Severity;
  threats: MatchedThreat[];
  count: number;
}

interface FilterState {
  severities: Severity[];
  cloudProviders: CloudProvider[];
  complianceFrameworks: string[];
  categories: string[];
}

const LIKELIHOOD_LEVELS: Likelihood[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];
const IMPACT_LEVELS: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  VERY_LOW: 'Very Low',
};

const IMPACT_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#fa5252',
  HIGH: '#fd7e14',
  MEDIUM: '#fab005',
  LOW: '#51cf66',
  INFO: '#94d82d',
};

const CELL_RISK_COLORS: Record<string, string> = {
  'VERY_HIGH-CRITICAL': '#c92a2a',
  'VERY_HIGH-HIGH': '#e03131',
  'VERY_HIGH-MEDIUM': '#f03e3e',
  'VERY_HIGH-LOW': '#fa5252',
  'VERY_HIGH-INFO': '#ff6b6b',
  'HIGH-CRITICAL': '#d9480f',
  'HIGH-HIGH': '#e8590c',
  'HIGH-MEDIUM': '#f76707',
  'HIGH-LOW': '#fd7e14',
  'HIGH-INFO': '#ff922b',
  'MEDIUM-CRITICAL': '#e67700',
  'MEDIUM-HIGH': '#f08c00',
  'MEDIUM-MEDIUM': '#f59f00',
  'MEDIUM-LOW': '#fab005',
  'MEDIUM-INFO': '#fcc419',
  'LOW-CRITICAL': '#2f9e44',
  'LOW-HIGH': '#37b24d',
  'LOW-MEDIUM': '#40c057',
  'LOW-LOW': '#51cf66',
  'LOW-INFO': '#69db7c',
  'VERY_LOW-CRITICAL': '#5c940d',
  'VERY_LOW-HIGH': '#66a80f',
  'VERY_LOW-MEDIUM': '#74b816',
  'VERY_LOW-LOW': '#82c91e',
  'VERY_LOW-INFO': '#94d82d',
};

export const ThreatMatrix: React.FC<ThreatMatrixProps> = ({
  threats,
  onThreatClick,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    severities: [],
    cloudProviders: [],
    complianceFrameworks: [],
    categories: [],
  });
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  
  /**
   * Filter threats based on current filter state
   */
  const filteredThreats = useMemo(() => {
    return threats.filter((threat) => {
      // Severity filter
      if (filters.severities.length > 0 &&
          !filters.severities.includes(threat.matched_threat.severity)) {
        return false;
      }
      
      // Cloud provider filter
      if (filters.cloudProviders.length > 0 &&
          !filters.cloudProviders.includes(threat.resource.cloud_provider as CloudProvider)) {
        return false;
      }
      
      // Compliance framework filter
      if (filters.complianceFrameworks.length > 0) {
        const hasFramework = filters.complianceFrameworks.some(
          (framework) => threat.compliance_mappings?.[framework]
        );
        if (!hasFramework) return false;
      }
      
      // Category filter
      if (filters.categories.length > 0 &&
          !filters.categories.includes(threat.matched_threat.category || '')) {
        return false;
      }
      
      return true;
    });
  }, [threats, filters]);
  
  /**
   * Build matrix cells
   */
  const matrixCells = useMemo(() => {
    const cells: MatrixCell[][] = [];
    
    LIKELIHOOD_LEVELS.forEach((likelihood) => {
      const row: MatrixCell[] = [];
      
      IMPACT_LEVELS.forEach((impact) => {
        const cellThreats = filteredThreats.filter(
          (threat) =>
            threat.matched_threat.likelihood === likelihood &&
            threat.matched_threat.severity === impact
        );
        
        row.push({
          likelihood,
          impact,
          threats: cellThreats,
          count: cellThreats.length,
        });
      });
      
      cells.push(row);
    });
    
    return cells;
  }, [filteredThreats]);
  
  /**
   * Calculate statistics
   */
  const statistics = useMemo(() => {
    const stats = {
      total: filteredThreats.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    filteredThreats.forEach((threat) => {
      const severity = threat.matched_threat.severity;
      switch (severity) {
        case 'CRITICAL':
          stats.critical++;
          break;
        case 'HIGH':
          stats.high++;
          break;
        case 'MEDIUM':
          stats.medium++;
          break;
        case 'LOW':
          stats.low++;
          break;
        case 'INFO':
          stats.info++;
          break;
      }
    });
    
    return stats;
  }, [filteredThreats]);
  
  /**
   * Get unique values for filters
   */
  const filterOptions = useMemo(() => {
    const cloudProviders = new Set<string>();
    const frameworks = new Set<string>();
    const categories = new Set<string>();
    
    threats.forEach((threat) => {
      if (threat.resource.cloud_provider) {
        cloudProviders.add(threat.resource.cloud_provider);
      }
      
      if (threat.compliance_mappings) {
        Object.keys(threat.compliance_mappings).forEach((fw) => frameworks.add(fw));
      }
      
      if (threat.matched_threat.category) {
        categories.add(threat.matched_threat.category);
      }
    });
    
    return {
      cloudProviders: Array.from(cloudProviders),
      frameworks: Array.from(frameworks),
      categories: Array.from(categories),
    };
  }, [threats]);
  
  /**
   * Handle cell click
   */
  const handleCellClick = useCallback((cell: MatrixCell) => {
    if (cell.count === 0) return;
    
    setSelectedCell(cell);
    setModalOpened(true);
    
    if (onThreatClick) {
      onThreatClick(cell.threats);
    }
  }, [onThreatClick]);
  
  /**
   * Calculate bubble size based on threat count
   */
  const getBubbleSize = useCallback((count: number): number => {
    if (count === 0) return 0;
    const maxCount = Math.max(...matrixCells.flat().map((c) => c.count));
    const minSize = 20;
    const maxSize = 60;
    return minSize + (count / maxCount) * (maxSize - minSize);
  }, [matrixCells]);
  
  /**
   * Export matrix as PNG
   */
  const handleExportPng = useCallback(() => {
    // TODO: Implement canvas-based export
    notifications.show({
      title: 'Export PNG',
      message: 'PNG export feature coming soon',
      color: 'blue',
    });
  }, []);
  
  /**
   * Export matrix as CSV
   */
  const handleExportCsv = useCallback(() => {
    const csvData = [
      ['Likelihood', 'Impact', 'Count', 'Threat IDs'],
      ...matrixCells.flat().map((cell) => [
        cell.likelihood,
        cell.impact,
        cell.count.toString(),
        cell.threats.map((t) => t.matched_threat.id).join(';'),
      ]),
    ];
    
    const csvContent = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `threat-matrix-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Export successful',
      message: 'Threat matrix exported as CSV',
      color: 'green',
    });
  }, [matrixCells]);
  
  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters({
      severities: [],
      cloudProviders: [],
      complianceFrameworks: [],
      categories: [],
    });
  }, []);
  
  const hasActiveFilters = useMemo(() => {
    return (
      filters.severities.length > 0 ||
      filters.cloudProviders.length > 0 ||
      filters.complianceFrameworks.length > 0 ||
      filters.categories.length > 0
    );
  }, [filters]);
  
  return (
    <Container fluid className={styles.container}>
      <Stack gap="md">
        {/* Header with statistics */}
        <Paper p="md" withBorder className={styles.header}>
          <Group justify="space-between">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Total Threats</Text>
                <Text size="xl" fw={700}>{statistics.total}</Text>
              </div>
              
              <Group gap="sm">
                {statistics.critical > 0 && (
                  <Badge color="red" size="lg" variant="filled">
                    {statistics.critical} Critical
                  </Badge>
                )}
                {statistics.high > 0 && (
                  <Badge color="orange" size="lg" variant="filled">
                    {statistics.high} High
                  </Badge>
                )}
                {statistics.medium > 0 && (
                  <Badge color="yellow" size="lg" variant="light">
                    {statistics.medium} Medium
                  </Badge>
                )}
                {statistics.low > 0 && (
                  <Badge color="green" size="lg" variant="light">
                    {statistics.low} Low
                  </Badge>
                )}
              </Group>
            </Group>
            
            <Group gap="xs">
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    size="sm"
                  >
                    Export
                  </Button>
                </Menu.Target>
                
                <Menu.Dropdown>
                  <Menu.Label>Export Format</Menu.Label>
                  <Menu.Item
                    leftSection={<IconPhoto size={16} />}
                    onClick={handleExportPng}
                  >
                    Export as PNG
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
          </Group>
        </Paper>
        
        {/* Filters */}
        <Paper p="md" withBorder className={styles.filters}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <IconFilter size={16} />
                <Text size="sm" fw={600}>Filters</Text>
                {hasActiveFilters && (
                  <Badge size="sm" variant="light" color="blue">
                    Active
                  </Badge>
                )}
              </Group>
              
              {hasActiveFilters && (
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconX size={14} />}
                  onClick={handleClearFilters}
                >
                  Clear All
                </Button>
              )}
            </Group>
            
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  label="Severity"
                  placeholder="All severities"
                  data={IMPACT_LEVELS.map((s) => ({ value: s, label: IMPACT_LABELS[s] }))}
                  value={filters.severities}
                  onChange={(value) => setFilters({ ...filters, severities: value as Severity[] })}
                  clearable
                  searchable
                />
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  label="Cloud Provider"
                  placeholder="All providers"
                  data={filterOptions.cloudProviders}
                  value={filters.cloudProviders}
                  onChange={(value) => setFilters({ ...filters, cloudProviders: value as CloudProvider[] })}
                  clearable
                  searchable
                />
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  label="Compliance Framework"
                  placeholder="All frameworks"
                  data={filterOptions.frameworks}
                  value={filters.complianceFrameworks}
                  onChange={(value) => setFilters({ ...filters, complianceFrameworks: value })}
                  clearable
                  searchable
                />
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  label="Category"
                  placeholder="All categories"
                  data={filterOptions.categories}
                  value={filters.categories}
                  onChange={(value) => setFilters({ ...filters, categories: value })}
                  clearable
                  searchable
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Paper>
        
        {/* Risk Matrix */}
        <Paper p="md" withBorder className={styles.matrixContainer}>
          <Stack gap="sm">
            <Text size="sm" fw={600}>Risk Matrix</Text>
            
            <div className={styles.matrix}>
              {/* Y-axis label */}
              <div className={styles.yAxisLabel}>
                <Text size="sm" fw={600} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  Likelihood
                </Text>
              </div>
              
              {/* Matrix grid */}
              <div className={styles.grid}>
                {/* Y-axis labels */}
                <div className={styles.yAxisLabels}>
                  {LIKELIHOOD_LEVELS.map((likelihood) => (
                    <div key={likelihood} className={styles.yAxisLabelItem}>
                      <Text size="xs" fw={500}>{LIKELIHOOD_LABELS[likelihood]}</Text>
                    </div>
                  ))}
                </div>
                
                {/* Cells */}
                <div className={styles.cells}>
                  {matrixCells.map((row, rowIndex) => (
                    <div key={rowIndex} className={styles.row}>
                      {row.map((cell, colIndex) => {
                        const cellKey = `${cell.likelihood}-${cell.impact}`;
                        const bgColor = CELL_RISK_COLORS[cellKey] || '#e9ecef';
                        const bubbleSize = getBubbleSize(cell.count);
                        
                        return (
                          <Tooltip
                            key={colIndex}
                            label={
                              cell.count > 0
                                ? `${cell.count} threat(s)\n${LIKELIHOOD_LABELS[cell.likelihood]} likelihood\n${IMPACT_LABELS[cell.impact]} impact`
                                : 'No threats'
                            }
                            multiline
                            withArrow
                          >
                            <div
                              className={styles.cell}
                              style={{ backgroundColor: bgColor }}
                              onClick={() => handleCellClick(cell)}
                              role="button"
                              tabIndex={0}
                              aria-label={`${LIKELIHOOD_LABELS[cell.likelihood]} likelihood, ${IMPACT_LABELS[cell.impact]} impact: ${cell.count} threats`}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleCellClick(cell);
                                }
                              }}
                            >
                              {cell.count > 0 && (
                                <div
                                  className={styles.bubble}
                                  style={{
                                    width: bubbleSize,
                                    height: bubbleSize,
                                    backgroundColor: SEVERITY_COLORS[cell.impact],
                                  }}
                                >
                                  <Text size="xs" fw={700} c="white">
                                    {cell.count}
                                  </Text>
                                </div>
                              )}
                            </div>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                  
                  {/* X-axis labels */}
                  <div className={styles.xAxisLabels}>
                    {IMPACT_LEVELS.map((impact) => (
                      <div key={impact} className={styles.xAxisLabelItem}>
                        <Text size="xs" fw={500}>{IMPACT_LABELS[impact]}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* X-axis label */}
              <div className={styles.xAxisLabel}>
                <Text size="sm" fw={600}>Impact</Text>
              </div>
            </div>
          </Stack>
        </Paper>
        
        {/* Legend */}
        <Paper p="md" withBorder className={styles.legend}>
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed" mb="xs">Bubble Color (Severity)</Text>
              <Group gap="md">
                {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (
                  <Group key={severity} gap="xs">
                    <div
                      className={styles.legendColor}
                      style={{ backgroundColor: color }}
                    />
                    <Text size="xs">{IMPACT_LABELS[severity as Severity]}</Text>
                  </Group>
                ))}
              </Group>
            </div>
            
            <div>
              <Text size="xs" c="dimmed" mb="xs">Bubble Size</Text>
              <Group gap="md">
                <Group gap="xs">
                  <div className={styles.legendBubble} style={{ width: 20, height: 20 }} />
                  <Text size="xs">Few threats</Text>
                </Group>
                <Group gap="xs">
                  <div className={styles.legendBubble} style={{ width: 40, height: 40 }} />
                  <Text size="xs">Many threats</Text>
                </Group>
              </Group>
            </div>
          </Group>
        </Paper>
      </Stack>
      
      {/* Threat Details Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          selectedCell && (
            <Group gap="xs">
              <IconAlertTriangle size={20} />
              <Text fw={600}>
                {selectedCell.count} Threat(s) - {LIKELIHOOD_LABELS[selectedCell.likelihood]} / {IMPACT_LABELS[selectedCell.impact]}
              </Text>
            </Group>
          )
        }
        size="lg"
      >
        {selectedCell && (
          <Stack gap="md">
            {selectedCell.threats.map((threat) => (
              <Card key={threat.matched_threat.id} shadow="sm" padding="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600} size="sm">{threat.matched_threat.name}</Text>
                    <Badge color={SEVERITY_COLORS[threat.matched_threat.severity]}>
                      {threat.matched_threat.severity}
                    </Badge>
                  </Group>
                  
                  <Text size="xs" c="dimmed">{threat.matched_threat.description}</Text>
                  
                  {threat.matched_threat.category && (
                    <Badge size="sm" variant="light">
                      {threat.matched_threat.category}
                    </Badge>
                  )}
                  
                  <Text size="xs" c="dimmed">
                    Resource: {threat.resource.type} ({threat.resource.name})
                  </Text>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Modal>
    </Container>
  );
};
