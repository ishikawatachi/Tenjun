/**
 * BusinessView Component
 * 
 * Executive dashboard with risk metrics and compliance status
 */

import React, { useState } from 'react';
import { Container, Title, Text, Stack, Paper, Drawer, Tabs } from '@mantine/core';
import { IconChartDots, IconShieldCheck } from '@tabler/icons-react';
import { ThreatMatrix } from '../components/ThreatMatrix';
import { ComplianceMapper } from '../components/ComplianceMapper';
import { ThreatCard } from '../components/common/ThreatCard';
import { useThreatModel } from '../hooks/useThreatModel';
import type { MatchedThreat } from '../types';

export const BusinessView: React.FC = () => {
  const { threats } = useThreatModel();
  const [selectedThreats, setSelectedThreats] = useState<MatchedThreat[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const handleThreatClick = (cellThreats: MatchedThreat[]) => {
    setSelectedThreats(cellThreats);
    setDrawerOpen(true);
  };
  
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Business View</Title>
          <Text c="dimmed" size="lg" mt="sm">
            Executive dashboard with risk metrics and compliance status
          </Text>
        </div>
        
        {threats.length > 0 ? (
          <Tabs defaultValue="risk-matrix" variant="outline">
            <Tabs.List>
              <Tabs.Tab
                value="risk-matrix"
                leftSection={<IconChartDots size={16} />}
              >
                Risk Matrix
              </Tabs.Tab>
              <Tabs.Tab
                value="compliance"
                leftSection={<IconShieldCheck size={16} />}
              >
                Compliance Mapping
              </Tabs.Tab>
            </Tabs.List>
            
            <Tabs.Panel value="risk-matrix" pt="md">
              <ThreatMatrix threats={threats} onThreatClick={handleThreatClick} />
            </Tabs.Panel>
            
            <Tabs.Panel value="compliance" pt="md">
              <ComplianceMapper threats={threats} />
            </Tabs.Panel>
          </Tabs>
        ) : (
          <Paper p="xl" withBorder>
            <Stack gap="md" align="center">
              <Text size="lg" fw={600}>No Threats Analyzed Yet</Text>
              <Text c="dimmed" ta="center">
                Upload Terraform configuration in the Architect view to begin threat analysis
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>
      
      {/* Threat Details Drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${selectedThreats.length} Threat(s)`}
        position="right"
        size="lg"
      >
        <Stack gap="md">
          {selectedThreats.map((threat) => (
            <ThreatCard
              key={threat.threat_id}
              threat={threat}
              onClick={() => {
                // Could navigate to detailed view
                console.log('Threat clicked:', threat);
              }}
            />
          ))}
        </Stack>
      </Drawer>
    </Container>
  );
};
