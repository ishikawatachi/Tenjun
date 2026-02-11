/**
 * ThreatCard Component
 * 
 * Card displaying threat information
 */

import React from 'react';
import { Card, Badge, Group, Text, Stack, Button } from '@mantine/core';
import { IconAlertTriangle, IconShield, IconArrowRight } from '@tabler/icons-react';
import type { MatchedThreat, Severity } from '../../types';

interface ThreatCardProps {
  threat: MatchedThreat;
  onClick?: (threat: MatchedThreat) => void;
  compact?: boolean;
}

const severityColors: Record<Severity, string> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'blue',
  INFO: 'gray',
};

export const ThreatCard: React.FC<ThreatCardProps> = ({
  threat,
  onClick,
  compact = false,
}) => {
  const severity = threat.matched_threat.severity;
  const color = severityColors[severity];
  
  return (
    <Card
      shadow="sm"
      padding={compact ? 'sm' : 'lg'}
      radius="md"
      withBorder
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(threat)}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <IconAlertTriangle size={20} color={`var(--mantine-color-${color}-6)`} />
            <Text fw={600} size={compact ? 'sm' : 'md'}>
              {threat.matched_threat.name}
            </Text>
          </Group>
          
          <Group gap="xs">
            <Badge color={color} size={compact ? 'sm' : 'md'}>
              {severity}
            </Badge>
            {threat.matched_threat.category && (
              <Badge variant="light" size={compact ? 'sm' : 'md'}>
                {threat.matched_threat.category}
              </Badge>
            )}
          </Group>
        </Group>
        
        {!compact && (
          <>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {threat.matched_threat.description}
            </Text>
            
            <Group justify="space-between">
              <Group gap="xs">
                <IconShield size={16} />
                <Text size="xs" c="dimmed">
                  {threat.mitigations?.length || 0} mitigations
                </Text>
              </Group>
              
              {onClick && (
                <Button
                  variant="subtle"
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                >
                  View Details
                </Button>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
};
