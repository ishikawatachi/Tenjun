/**
 * Main Application Component
 * 
 * Configures routing and layout structure
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Container } from '@mantine/core';
import { Navigation } from './components/Navigation';
import { BusinessView } from './views/BusinessView';
import { ArchitectView } from './views/ArchitectView';
import { DeveloperView } from './views/DeveloperView';
import './App.css';

const NotFound = () => (
  <Container>
    <h1>404 - Page Not Found</h1>
  </Container>
);

function App() {
  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Navigation />
      </AppShell.Header>
      
      <AppShell.Main>
        <Routes>
          {/* Default route redirects to business view */}
          <Route path="/" element={<Navigate to="/business" replace />} />
          
          {/* Three main views */}
          <Route path="/business" element={<BusinessView />} />
          <Route path="/architect" element={<ArchitectView />} />
          <Route path="/developer" element={<DeveloperView />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
