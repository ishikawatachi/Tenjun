/**
 * DFDVisualizer Component
 * 
 * Interactive Data Flow Diagram visualization with Mermaid
 */

import React, { useCallback, useState } from 'react';
import {
  Container,
  Paper,
  Group,
  Button,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Alert,
  Loader,
  Stack,
  Text,
  Badge,
  Switch,
  Menu,
} from '@mantine/core';
import {
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconDownload,
  IconAlertCircle,
  IconPhoto,
  IconFileTypeSvg,
  IconSettings,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMermaidRender } from './useMermaidRender';
import type { DFD } from '../../types';
import styles from './DFDVisualizer.module.css';

interface DFDVisualizerProps {
  dfd: DFD | null;
  onNodeClick?: (nodeId: string) => void;
  selectedNode?: string;
  level?: 'service' | 'component' | 'code';
  onLevelChange?: (level: 'service' | 'component' | 'code') => void;
  theme?: 'light' | 'dark';
}

export const DFDVisualizer: React.FC<DFDVisualizerProps> = ({
  dfd,
  onNodeClick,
  selectedNode,
  level = 'service',
  onLevelChange,
  theme = 'light',
}) => {
  const [zoom, setZoom] = useState(1);
  const [colorByRisk, setColorByRisk] = useState(true);
  const [showTrustBoundaries, setShowTrustBoundaries] = useState(true);
  
  const {
    containerRef,
    isLoading,
    error,
    renderDiagram,
    exportSvg,
    exportPng,
  } = useMermaidRender({
    dfd,
    selectedNode,
    colorByRisk,
    showTrustBoundaries,
    theme,
  });
  
  /**
   * Handle zoom in
   */
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  }, []);
  
  /**
   * Handle zoom out
   */
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  }, []);
  
  /**
   * Handle zoom reset
   */
  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);
  
  /**
   * Handle SVG export
   */
  const handleExportSvg = useCallback(() => {
    const svgString = exportSvg();
    if (!svgString) {
      notifications.show({
        title: 'Export failed',
        message: 'No diagram to export',
        color: 'red',
      });
      return;
    }
    
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dfd-${level}-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Export successful',
      message: 'DFD exported as SVG',
      color: 'green',
    });
  }, [exportSvg, level]);
  
  /**
   * Handle PNG export
   */
  const handleExportPng = useCallback(async () => {
    notifications.show({
      id: 'export-png',
      title: 'Exporting...',
      message: 'Generating PNG image',
      loading: true,
      autoClose: false,
    });
    
    const pngUrl = await exportPng();
    
    notifications.hide('export-png');
    
    if (!pngUrl) {
      notifications.show({
        title: 'Export failed',
        message: 'Failed to generate PNG',
        color: 'red',
      });
      return;
    }
    
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `dfd-${level}-${Date.now()}.png`;
    link.click();
    
    notifications.show({
      title: 'Export successful',
      message: 'DFD exported as PNG',
      color: 'green',
    });
  }, [exportPng, level]);
  
  /**
   * Handle node click from diagram
   */
  const handleNodeClickInternal = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onNodeClick) return;
    
    const target = event.target as HTMLElement;
    const nodeElement = target.closest('.node');
    
    if (nodeElement) {
      // Extract node ID from the element
      const nodeId = nodeElement.getAttribute('id')?.replace('flowchart-', '').replace(/-\d+$/, '') || '';
      if (nodeId) {
        onNodeClick(nodeId);
      }
    }
  }, [onNodeClick]);
  
  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') {
      handleZoomIn();
    } else if (event.key === '-' || event.key === '_') {
      handleZoomOut();
    } else if (event.key === '0') {
      handleZoomReset();
    }
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);
  
  // Empty state
  if (!dfd) {
    return (
      <Paper p="xl" withBorder className={styles.emptyState}>
        <Stack align="center" gap="md">
          <IconAlertCircle size={48} color="var(--mantine-color-gray-5)" />
          <Text size="lg" c="dimmed">No DFD data available</Text>
          <Text size="sm" c="dimmed">Upload Terraform configuration to generate diagrams</Text>
        </Stack>
      </Paper>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Rendering Error"
        color="red"
        variant="filled"
      >
        {error}
      </Alert>
    );
  }
  
  return (
    <Container fluid className={styles.container}>
      <Stack gap="md">
        {/* Toolbar */}
        <Paper p="sm" withBorder className={styles.toolbar}>
          <Group justify="space-between">
            <Group gap="md">
              {/* Level selector */}
              {onLevelChange && (
                <SegmentedControl
                  value={level}
                  onChange={(value) => onLevelChange(value as 'service' | 'component' | 'code')}
                  data={[
                    { label: 'Service', value: 'service' },
                    { label: 'Component', value: 'component' },
                    { label: 'Code', value: 'code' },
                  ]}
                  aria-label="DFD abstraction level"
                />
              )}
              
              {/* Statistics */}
              <Group gap="xs">
                <Badge variant="light" size="lg">
                  {dfd.nodes.length} nodes
                </Badge>
                <Badge variant="light" size="lg">
                  {dfd.edges.length} edges
                </Badge>
                {dfd.trust_boundaries && (
                  <Badge variant="light" size="lg" color="blue">
                    {dfd.trust_boundaries.length} boundaries
                  </Badge>
                )}
              </Group>
            </Group>
            
            <Group gap="xs">
              {/* Settings */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Tooltip label="Display settings">
                    <ActionIcon variant="subtle" size="lg" aria-label="Settings">
                      <IconSettings size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                
                <Menu.Dropdown>
                  <Menu.Label>Display Options</Menu.Label>
                  <Menu.Item>
                    <Switch
                      label="Color by risk"
                      checked={colorByRisk}
                      onChange={(e) => setColorByRisk(e.currentTarget.checked)}
                    />
                  </Menu.Item>
                  <Menu.Item>
                    <Switch
                      label="Show trust boundaries"
                      checked={showTrustBoundaries}
                      onChange={(e) => setShowTrustBoundaries(e.currentTarget.checked)}
                    />
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              
              {/* Zoom controls */}
              <Tooltip label="Zoom out (-)">
                <ActionIcon
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  variant="subtle"
                  size="lg"
                  aria-label="Zoom out"
                >
                  <IconZoomOut size={20} />
                </ActionIcon>
              </Tooltip>
              
              <Text size="sm" fw={500} style={{ minWidth: '60px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </Text>
              
              <Tooltip label="Zoom in (+)">
                <ActionIcon
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  variant="subtle"
                  size="lg"
                  aria-label="Zoom in"
                >
                  <IconZoomIn size={20} />
                </ActionIcon>
              </Tooltip>
              
              <Tooltip label="Reset zoom (0)">
                <ActionIcon
                  onClick={handleZoomReset}
                  variant="subtle"
                  size="lg"
                  aria-label="Reset zoom"
                >
                  <IconZoomReset size={20} />
                </ActionIcon>
              </Tooltip>
              
              {/* Export */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Tooltip label="Export diagram">
                    <Button
                      leftSection={<IconDownload size={16} />}
                      variant="light"
                      size="sm"
                    >
                      Export
                    </Button>
                  </Tooltip>
                </Menu.Target>
                
                <Menu.Dropdown>
                  <Menu.Label>Export Format</Menu.Label>
                  <Menu.Item
                    leftSection={<IconFileTypeSvg size={16} />}
                    onClick={handleExportSvg}
                  >
                    Export as SVG
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconPhoto size={16} />}
                    onClick={handleExportPng}
                  >
                    Export as PNG
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Paper>
        
        {/* Diagram container */}
        <Paper
          p="md"
          withBorder
          className={styles.diagramContainer}
          style={{ position: 'relative' }}
        >
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <Loader size="lg" />
              <Text mt="md" c="dimmed">Rendering diagram...</Text>
            </div>
          )}
          
          <div
            ref={containerRef}
            className={styles.diagram}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              minHeight: '400px',
            }}
            onClick={handleNodeClickInternal}
            onKeyDown={handleKeyDown}
            role="img"
            aria-label={`Data flow diagram showing ${dfd.nodes.length} nodes and ${dfd.edges.length} connections`}
            tabIndex={0}
          />
        </Paper>
        
        {/* Legend */}
        <Paper p="sm" withBorder className={styles.legend}>
          <Group gap="lg">
            <Text size="sm" fw={600}>Legend:</Text>
            <Group gap="md">
              <Group gap="xs">
                <div className={styles.legendBox} style={{ backgroundColor: '#ffe3e3', borderColor: '#fa5252' }} />
                <Text size="xs">Critical</Text>
              </Group>
              <Group gap="xs">
                <div className={styles.legendBox} style={{ backgroundColor: '#fff3e0', borderColor: '#fd7e14' }} />
                <Text size="xs">High</Text>
              </Group>
              <Group gap="xs">
                <div className={styles.legendBox} style={{ backgroundColor: '#fff9db', borderColor: '#fab005' }} />
                <Text size="xs">Medium</Text>
              </Group>
              <Group gap="xs">
                <div className={styles.legendBox} style={{ backgroundColor: '#ebfbee', borderColor: '#51cf66' }} />
                <Text size="xs">Low</Text>
              </Group>
              <Group gap="xs">
                <div className={styles.legendBox} style={{ backgroundColor: '#f4fce3', borderColor: '#94d82d' }} />
                <Text size="xs">Info</Text>
              </Group>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
};
