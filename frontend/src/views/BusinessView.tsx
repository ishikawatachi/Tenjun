/**
 * BusinessView Component
 * 
 * Executive dashboard with risk metrics and compliance status
 */

import React, { useState } from 'react';
import { Container, Title, Text, Stack, Paper, Drawer } from '@mantine/core';
import { ThreatMatrix } from '../components/ThreatMatrix';
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
          <ThreatMatrix threats={threats} onThreatClick={handleThreatClick} />
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
              key={threat.matched_threat.id}
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
