/**
 * useThreatModel Hook
 * 
 * Custom hook for threat model state and operations
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  setThreats,
  selectThreat,
  setFilter,
  clearFilters,
  setLoading,
  setError,
  clearThreats,
  selectFilteredThreats,
  selectThreatById,
  selectCriticalThreats,
  selectHighRiskThreats,
} from '../store/threatModel.slice';
import type { MatchedThreat, FilterState } from '../types';

export const useThreatModel = () => {
  const dispatch = useAppDispatch();
  
  // Select state
  const threats = useAppSelector((state) => state.threatModel.threats);
  const allThreats = useAppSelector((state) => state.threatModel.allThreats);
  const selectedThreat = useAppSelector((state) => state.threatModel.selectedThreat);
  const filters = useAppSelector((state) => state.threatModel.filters);
  const statistics = useAppSelector((state) => state.threatModel.statistics);
  const loading = useAppSelector((state) => state.threatModel.loading);
  const error = useAppSelector((state) => state.threatModel.error);
  
  // Select filtered threats
  const filteredThreats = useAppSelector(selectFilteredThreats);
  const criticalThreats = useAppSelector(selectCriticalThreats);
  const highRiskThreats = useAppSelector(selectHighRiskThreats);
  
  // Actions
  const setThreatsAction = useCallback(
    (threats: MatchedThreat[]) => dispatch(setThreats(threats)),
    [dispatch]
  );
  
  const selectThreatAction = useCallback(
    (threat: MatchedThreat | null) => dispatch(selectThreat(threat)),
    [dispatch]
  );
  
  const setFilterAction = useCallback(
    (filterKey: keyof FilterState, value: any) => dispatch(setFilter({ key: filterKey, value })),
    [dispatch]
  );
  
  const clearFiltersAction = useCallback(
    () => dispatch(clearFilters()),
    [dispatch]
  );
  
  const setLoadingAction = useCallback(
    (loading: boolean) => dispatch(setLoading(loading)),
    [dispatch]
  );
  
  const setErrorAction = useCallback(
    (error: string | null) => dispatch(setError(error)),
    [dispatch]
  );
  
  const clearThreatsAction = useCallback(
    () => dispatch(clearThreats()),
    [dispatch]
  );
  
  // Selector with ID
  const getThreatById = useCallback(
    (id: string) => selectThreatById(id)({ threatModel: { threats, allThreats, selectedThreat, filters, statistics, loading, error } }),
    [threats, allThreats, selectedThreat, filters, statistics, loading, error]
  );
  
  return {
    // State
    threats,
    allThreats,
    selectedThreat,
    filters,
    statistics,
    loading,
    error,
    filteredThreats,
    criticalThreats,
    highRiskThreats,
    
    // Actions
    setThreats: setThreatsAction,
    selectThreat: selectThreatAction,
    setFilter: setFilterAction,
    clearFilters: clearFiltersAction,
    setLoading: setLoadingAction,
    setError: setErrorAction,
    clearThreats: clearThreatsAction,
    
    // Selectors
    getThreatById,
  };
};
