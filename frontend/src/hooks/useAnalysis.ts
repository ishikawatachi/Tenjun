/**
 * useAnalysis Hook
 * 
 * Custom hook for infrastructure analysis state and operations
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  setResources,
  selectResource,
  setSelectedDfdLevel,
  clearAnalysis,
  setError,
  clearError,
  uploadTerraform,
  generateDFDs,
  generateThreatDescription,
  generateRemediation,
  generateComplianceExplanation,
  selectCurrentDfd,
  selectResourceById,
} from '../store/analysis.slice';
import type { Resource } from '../types';

export const useAnalysis = () => {
  const dispatch = useAppDispatch();
  
  // Select state
  const resources = useAppSelector((state) => state.analysis.resources);
  const parseResult = useAppSelector((state) => state.analysis.parseResult);
  const uploadedFiles = useAppSelector((state) => state.analysis.uploadedFiles);
  const serviceDfd = useAppSelector((state) => state.analysis.serviceDfd);
  const componentDfd = useAppSelector((state) => state.analysis.componentDfd);
  const codeDfd = useAppSelector((state) => state.analysis.codeDfd);
  const selectedDfdLevel = useAppSelector((state) => state.analysis.selectedDfdLevel);
  const threatDescriptions = useAppSelector((state) => state.analysis.threatDescriptions);
  const remediations = useAppSelector((state) => state.analysis.remediations);
  const complianceExplanations = useAppSelector((state) => state.analysis.complianceExplanations);
  const loading = useAppSelector((state) => state.analysis.loading);
  const error = useAppSelector((state) => state.analysis.error);
  const selectedResource = useAppSelector((state) => state.analysis.selectedResource);
  
  // Select current DFD
  const currentDfd = useAppSelector(selectCurrentDfd);
  
  // Actions
  const setResourcesAction = useCallback(
    (resources: Resource[]) => dispatch(setResources(resources)),
    [dispatch]
  );
  
  const selectResourceAction = useCallback(
    (resource: Resource | null) => dispatch(selectResource(resource)),
    [dispatch]
  );
  
  const setSelectedDfdLevelAction = useCallback(
    (level: 'service' | 'component' | 'code') => dispatch(setSelectedDfdLevel(level)),
    [dispatch]
  );
  
  const clearAnalysisAction = useCallback(
    () => dispatch(clearAnalysis()),
    [dispatch]
  );
  
  const setErrorAction = useCallback(
    (error: string | null) => dispatch(setError(error)),
    [dispatch]
  );
  
  const clearErrorAction = useCallback(
    () => dispatch(clearError()),
    [dispatch]
  );
  
  // Async actions
  const uploadTerraformAction = useCallback(
    (files: FileList) => dispatch(uploadTerraform(files)),
    [dispatch]
  );
  
  const generateDFDsAction = useCallback(
    (resources: Resource[]) => dispatch(generateDFDs(resources)),
    [dispatch]
  );
  
  const generateThreatDescriptionAction = useCallback(
    (params: { config: Resource; threat_rule: any; threatId: string }) =>
      dispatch(generateThreatDescription(params)),
    [dispatch]
  );
  
  const generateRemediationAction = useCallback(
    (params: { threat: any; context: any; threatId: string }) =>
      dispatch(generateRemediation(params)),
    [dispatch]
  );
  
  const generateComplianceExplanationAction = useCallback(
    (params: { threat: any; framework: string; control_id: string; key: string }) =>
      dispatch(generateComplianceExplanation(params)),
    [dispatch]
  );
  
  // Selector with ID
  const getResourceById = useCallback(
    (id: string) => selectResourceById(id)({ analysis: { resources, parseResult, uploadedFiles, serviceDfd, componentDfd, codeDfd, selectedDfdLevel, threatDescriptions, remediations, complianceExplanations, loading, error, selectedResource, attackScenarios: {}, riskAssessments: {} } }),
    [resources, parseResult, uploadedFiles, serviceDfd, componentDfd, codeDfd, selectedDfdLevel, threatDescriptions, remediations, complianceExplanations, loading, error, selectedResource]
  );
  
  return {
    // State
    resources,
    parseResult,
    uploadedFiles,
    serviceDfd,
    componentDfd,
    codeDfd,
    selectedDfdLevel,
    currentDfd,
    threatDescriptions,
    remediations,
    complianceExplanations,
    loading,
    error,
    selectedResource,
    
    // Actions
    setResources: setResourcesAction,
    selectResource: selectResourceAction,
    setSelectedDfdLevel: setSelectedDfdLevelAction,
    clearAnalysis: clearAnalysisAction,
    setError: setErrorAction,
    clearError: clearErrorAction,
    
    // Async actions
    uploadTerraform: uploadTerraformAction,
    generateDFDs: generateDFDsAction,
    generateThreatDescription: generateThreatDescriptionAction,
    generateRemediation: generateRemediationAction,
    generateComplianceExplanation: generateComplianceExplanationAction,
    
    // Selectors
    getResourceById,
  };
};
