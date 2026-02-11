/**
 * Navigation Component
 * 
 * Top navigation bar with view switching
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Group, Button, Title } from '@mantine/core';
import { IconBriefcase, IconBuildingBridge, IconCode } from '@tabler/icons-react';

export const Navigation: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <Group justify="space-between" style={{ height: '100%', padding: '0 2rem' }}>
      <Title order={3} c="white">Threat Model Platform</Title>
      
      <Group gap="md">
        <Button
          component={Link}
          to="/business"
          variant={isActive('/business') ? 'filled' : 'subtle'}
          color={isActive('/business') ? 'white' : 'gray.2'}
          leftSection={<IconBriefcase size={16} />}
        >
          Business
        </Button>
        
        <Button
          component={Link}
          to="/architect"
          variant={isActive('/architect') ? 'filled' : 'subtle'}
          color={isActive('/architect') ? 'white' : 'gray.2'}
          leftSection={<IconBuildingBridge size={16} />}
        >
          Architect
        </Button>
        
        <Button
          component={Link}
          to="/developer"
          variant={isActive('/developer') ? 'filled' : 'subtle'}
          color={isActive('/developer') ? 'white' : 'gray.2'}
          leftSection={<IconCode size={16} />}
        >
          Developer
        </Button>
      </Group>
    </Group>
  );
};
