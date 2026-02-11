/**
 * ControlDetailModal Component
 * 
 * Modal displaying detailed information about a compliance control
 */

import React from 'react';
import { Modal, Stack, Group, Text, Badge, Card, Divider, Accordion, Alert } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck, IconInfoCircle } from '@tabler/icons-react';
import { ThreatCard } from '../common/ThreatCard';
import type { MatchedThreat, ComplianceMapping } from '../../types';

interface ControlDetailModalProps {
  opened: boolean;
  onClose: () => void;
  control: ComplianceControl | null;
  framework: string;
}

export interface ComplianceControl {
  id: string;
  name: string;
  description?: string;
  category?: string;
  mapped_threats: MatchedThreat[];
  total_threats: number;
  coverage_percentage: number;
  status: 'covered' | 'partial' | 'gap' | 'accepted';
  documentation_url?: string;
}

const statusConfig = {
  covered: {
    label: 'Fully Covered',
    color: 'green',
    icon: IconShieldCheck,
  },
  partial: {
    label: 'Partially Covered',
    color: 'yellow',
    icon: IconAlertTriangle,
  },
  gap: {
    label: 'Coverage Gap',
    color: 'red',
    icon: IconAlertTriangle,
  },
  accepted: {
    label: 'Risk Accepted',
    color: 'blue',
    icon: IconInfoCircle,
  },
};

export const ControlDetailModal: React.FC<ControlDetailModalProps> = ({
  opened,
  onClose,
  control,
  framework,
}) => {
  if (!control) return null;
  
  const config = statusConfig[control.status];
  const StatusIcon = config.icon;
  
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} size="lg">{control.id}</Text>
          <Badge color={config.color} variant="light">
            {framework}
          </Badge>
        </Group>
      }
      size="xl"
      padding="lg"
    >
      <Stack gap="md">
        {/* Control Header */}
        <div>
          <Text fw={600} size="lg">{control.name}</Text>
          {control.description && (
            <Text size="sm" c="dimmed" mt="xs">
              {control.description}
            </Text>
          )}
        </div>
        
        {/* Status Alert */}
        <Alert
          icon={<StatusIcon size={20} />}
          color={config.color}
          variant="light"
        >
          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm">{config.label}</Text>
              <Text size="xs" c="dimmed">
                {control.mapped_threats.length} of {control.total_threats} threats mapped
              </Text>
            </div>
            <Text fw={700} size="xl">{control.coverage_percentage}%</Text>
          </Group>
        </Alert>
        
        {/* Category */}
        {control.category && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">Category:</Text>
            <Badge variant="outline">{control.category}</Badge>
          </Group>
        )}
        
        <Divider />
        
        {/* Mapped Threats */}
        <div>
          <Text fw={600} size="md" mb="sm">
            Mapped Threats ({control.mapped_threats.length})
          </Text>
          
          {control.mapped_threats.length > 0 ? (
            <Stack gap="sm">
              {control.mapped_threats.map((threat) => (
                <ThreatCard
                  key={threat.threat_id}
                  threat={threat}
                  compact
                />
              ))}
            </Stack>
          ) : (
            <Alert color="gray" variant="light">
              No threats currently mapped to this control
            </Alert>
          )}
        </div>
        
        {/* Remediation Guidance */}
        {control.mapped_threats.length > 0 && (
          <>
            <Divider />
            <Accordion variant="separated">
              <Accordion.Item value="remediation">
                <Accordion.Control icon={<IconShieldCheck size={20} />}>
                  Remediation Guidance
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {control.mapped_threats.map((threat) => (
                      <Card key={threat.threat_id} padding="sm" withBorder>
                        <Stack gap="xs">
                          <Text fw={600} size="sm">{threat.threat_name}</Text>
                          
                          {threat.mitigations && threat.mitigations.length > 0 ? (
                            <Stack gap="xs">
                              {threat.mitigations.map((mitigation, index) => (
                                <div key={index}>
                                  <Text size="xs" fw={500}>Mitigation {index + 1}</Text>
                                  <Text size="xs" c="dimmed">{mitigation.description}</Text>
                                  {mitigation.steps && mitigation.steps.length > 0 && (
                                    <Text size="xs" c="dimmed" mt={4}>
                                      Steps: {mitigation.steps.join(', ')}
                                    </Text>
                                  )}
                                </div>
                              ))}
                            </Stack>
                          ) : (
                            <Text size="xs" c="dimmed">
                              No specific remediation guidance available
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
              
              <Accordion.Item value="evidence">
                <Accordion.Control icon={<IconInfoCircle size={20} />}>
                  Evidence Collection
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Text size="sm">
                      For audit purposes, collect the following evidence:
                    </Text>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                      <li>
                        <Text size="sm">Terraform configuration files showing security controls</Text>
                      </li>
                      <li>
                        <Text size="sm">Threat analysis reports from this platform</Text>
                      </li>
                      <li>
                        <Text size="sm">Remediation implementation commits/pull requests</Text>
                      </li>
                      <li>
                        <Text size="sm">Security scan results before and after fixes</Text>
                      </li>
                      <li>
                        <Text size="sm">Change management tickets for security updates</Text>
                      </li>
                    </ul>
                    <Alert color="blue" variant="light" mt="sm">
                      <Text size="xs">
                        All threat findings and remediation steps in this platform can be exported
                        as evidence documentation for compliance audits.
                      </Text>
                    </Alert>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </>
        )}
        
        {/* Documentation Link */}
        {control.documentation_url && (
          <>
            <Divider />
            <Group gap="xs">
              <Text size="sm" c="dimmed">Official Documentation:</Text>
              <a
                href={control.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.875rem' }}
              >
                {control.documentation_url}
              </a>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};
