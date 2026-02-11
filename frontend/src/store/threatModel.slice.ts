/**
 * Threat Model Slice
 * 
 * State management for threat data, filters, and selections
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Threat,
  MatchedThreat,
  Severity,
  FilterState,
  ComplianceMapping,
} from '../types';

interface ThreatModelState {
  threats: MatchedThreat[];
  allThreats: Threat[];
  selectedThreat: MatchedThreat | null;
  filters: FilterState;
  loading: boolean;
  error: string | null;
  statistics: {
    total: number;
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
    average_risk_score: number;
  };
}

const initialState: ThreatModelState = {
  threats: [],
  allThreats: [],
  selectedThreat: null,
  filters: {
    severity: [],
    category: [],
    cloudProvider: [],
    trustBoundary: [],
    searchQuery: '',
  },
  loading: false,
  error: null,
  statistics: {
    total: 0,
    by_severity: {},
    by_category: {},
    average_risk_score: 0,
  },
};

const threatModelSlice = createSlice({
  name: 'threatModel',
  initialState,
  reducers: {
    setThreats: (state, action: PayloadAction<MatchedThreat[]>) => {
      state.threats = action.payload;
      state.loading = false;
      state.error = null;
      
      // Update statistics
      state.statistics.total = action.payload.length;
      state.statistics.by_severity = action.payload.reduce((acc, threat) => {
        acc[threat.severity] = (acc[threat.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      state.statistics.by_category = action.payload.reduce((acc, threat) => {
        acc[threat.category] = (acc[threat.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      state.statistics.average_risk_score =
        action.payload.reduce((sum, threat) => sum + threat.risk_score, 0) /
        (action.payload.length || 1);
    },
    
    setAllThreats: (state, action: PayloadAction<Threat[]>) => {
      state.allThreats = action.payload;
    },
    
    selectThreat: (state, action: PayloadAction<MatchedThreat | null>) => {
      state.selectedThreat = action.payload;
    },
    
    setFilter: (state, action: PayloadAction<Partial<FilterState>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    clearThreats: (state) => {
      state.threats = [];
      state.selectedThreat = null;
      state.statistics = initialState.statistics;
    },
  },
});

export const {
  setThreats,
  setAllThreats,
  selectThreat,
  setFilter,
  clearFilters,
  setLoading,
  setError,
  clearError,
  clearThreats,
} = threatModelSlice.actions;

export default threatModelSlice.reducer;

// Selectors
export const selectFilteredThreats = (state: { threatModel: ThreatModelState }) => {
  const { threats, filters } = state.threatModel;
  
  return threats.filter((threat) => {
    // Severity filter
    if (filters.severity.length > 0 && !filters.severity.includes(threat.severity as Severity)) {
      return false;
    }
    
    // Category filter
    if (filters.category.length > 0 && !filters.category.includes(threat.category)) {
      return false;
    }
    
    // Cloud provider filter
    if (filters.cloudProvider.length > 0 && !filters.cloudProvider.includes(threat.cloud_provider as any)) {
      return false;
    }
    
    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = threat.threat_name.toLowerCase().includes(query);
      const matchesDescription = threat.description.toLowerCase().includes(query);
      const matchesId = threat.threat_id.toLowerCase().includes(query);
      
      if (!matchesName && !matchesDescription && !matchesId) {
        return false;
      }
    }
    
    return true;
  });
};

export const selectThreatById = (threatId: string) => (state: { threatModel: ThreatModelState }) => {
  return state.threatModel.threats.find((t) => t.threat_id === threatId);
};

export const selectCriticalThreats = (state: { threatModel: ThreatModelState }) => {
  return state.threatModel.threats.filter(
    (threat) => threat.severity === Severity.CRITICAL
  );
};

export const selectHighRiskThreats = (state: { threatModel: ThreatModelState }) => {
  return state.threatModel.threats.filter((threat) => threat.risk_score >= 7.0);
};
