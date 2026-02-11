/**
 * BusinessView Component
 * 
 * Executive dashboard with risk metrics and compliance status
 */

import React from 'react';
import { Container, Title, Text, Stack } from '@mantine/core';

export const BusinessView: React.FC = () => {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Business View</Title>
          <Text c="dimmed" size="lg" mt="sm">
            Executive dashboard with risk metrics and compliance status
          </Text>
        </div>
        
        <Text>
          This view is under construction. It will include:
        </Text>
        <ul>
          <li>Risk score overview and trends</li>
          <li>Compliance framework coverage</li>
          <li>Critical threat summary</li>
          <li>Business impact assessment</li>
          <li>Executive reports and exports</li>
        </ul>
      </Stack>
    </Container>
  );
};
