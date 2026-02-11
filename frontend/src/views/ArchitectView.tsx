/**
 * ArchitectView Component
 * 
 * System architecture diagrams with threat analysis
 */

import React, { useState } from 'react';
import { Container, Title, Text, Stack, Paper, Button, Group } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { DFDVisualizer } from '../components/DFDVisualizer';
import { FileUpload } from '../components/common/FileUpload';
import { useAnalysis } from '../hooks/useAnalysis';

export const ArchitectView: React.FC = () => {
  const {
    currentDfd,
    selectedDfdLevel,
    setSelectedDfdLevel,
    uploadTerraform,
    loading,
  } = useAnalysis();
  
  const [showUpload, setShowUpload] = useState(!currentDfd);
  
  const handleUpload = async (files: FileList) => {
    try {
      await uploadTerraform(files);
      setShowUpload(false);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };
  
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Architect View</Title>
          <Text c="dimmed" size="lg" mt="sm">
            System architecture diagrams with threat analysis
          </Text>
        </div>
        
        {showUpload ? (
          <Paper p="xl" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600} size="lg">Upload Terraform Configuration</Text>
                {currentDfd && (
                  <Button variant="subtle" onClick={() => setShowUpload(false)}>
                    View Existing Diagram
                  </Button>
                )}
              </Group>
              <FileUpload onUpload={handleUpload} loading={loading.parsing} />
            </Stack>
          </Paper>
        ) : (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Visualize your infrastructure architecture and identify trust boundaries
              </Text>
              <Button
                leftSection={<IconUpload size={16} />}
                variant="light"
                onClick={() => setShowUpload(true)}
              >
                Upload New Config
              </Button>
            </Group>
            
            <DFDVisualizer
              dfd={currentDfd}
              level={selectedDfdLevel}
              onLevelChange={setSelectedDfdLevel}
              onNodeClick={(nodeId) => {
                console.log('Node clicked:', nodeId);
                // TODO: Show node details in drawer
              }}
            />
          </>
        )}
      </Stack>
    </Container>
  );
};
