/**
 * Analysis Slice
 * 
 * State management for infrastructure analysis, DFD generation, and LLM operations
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  Resource,
  DFD,
  TerraformParseResult,
  LLMThreatDescription,
  LLMRemediation,
  LLMComplianceExplanation,
  LLMAttackScenario,
  LLMRiskAssessment,
} from '../types';
import { apiClient } from '../services/api.client';

interface AnalysisState {
  // Terraform/Infrastructure
  resources: Resource[];
  parseResult: TerraformParseResult | null;
  uploadedFiles: File[];
  
  // DFDs
  serviceDfd: DFD | null;
  componentDfd: DFD | null;
  codeDfd: DFD | null;
  selectedDfdLevel: 'service' | 'component' | 'code';
  
  // LLM Generated Content
  threatDescriptions: Record<string, LLMThreatDescription>;
  remediations: Record<string, LLMRemediation>;
  complianceExplanations: Record<string, LLMComplianceExplanation>;
  attackScenarios: Record<string, LLMAttackScenario>;
  riskAssessments: Record<string, LLMRiskAssessment>;
  
  // UI State
  loading: {
    parsing: boolean;
    dfdGeneration: boolean;
    llmDescription: boolean;
    llmRemediation: boolean;
    llmCompliance: boolean;
  };
  error: string | null;
  selectedResource: Resource | null;
}

const initialState: AnalysisState = {
  resources: [],
  parseResult: null,
  uploadedFiles: [],
  serviceDfd: null,
  componentDfd: null,
  codeDfd: null,
  selectedDfdLevel: 'service',
  threatDescriptions: {},
  remediations: {},
  complianceExplanations: {},
  attackScenarios: {},
  riskAssessments: {},
  loading: {
    parsing: false,
    dfdGeneration: false,
    llmDescription: false,
    llmRemediation: false,
    llmCompliance: false,
  },
  error: null,
  selectedResource: null,
};

// Async Thunks
export const uploadTerraform = createAsyncThunk(
  'analysis/uploadTerraform',
  async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    
    const response = await apiClient.post<TerraformParseResult>(
      '/terraform/parse-directory',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    
    return response.data;
  }
);

export const generateDFDs = createAsyncThunk(
  'analysis/generateDFDs',
  async (resources: Resource[]) => {
    const response = await apiClient.post('/dfd/generate/all', { resources });
    return response.data;
  }
);

export const generateThreatDescription = createAsyncThunk(
  'analysis/generateThreatDescription',
  async ({ config, threat_rule, threatId }: {
    config: Resource;
    threat_rule: any;
    threatId: string;
  }) => {
    const response = await apiClient.post<LLMThreatDescription>(
      '/llm/threat/describe',
      { config, threat_rule }
    );
    return { threatId, data: response.data };
  }
);

export const generateRemediation = createAsyncThunk(
  'analysis/generateRemediation',
  async ({ threat, context, threatId }: {
    threat: any;
    context: any;
    threatId: string;
  }) => {
    const response = await apiClient.post<LLMRemediation>(
      '/llm/threat/remediate',
      { threat, context }
    );
    return { threatId, data: response.data };
  }
);

export const generateComplianceExplanation = createAsyncThunk(
  'analysis/generateComplianceExplanation',
  async ({ threat, framework, control_id, key }: {
    threat: any;
    framework: string;
    control_id: string;
    key: string;
  }) => {
    const response = await apiClient.post<LLMComplianceExplanation>(
      '/llm/threat/compliance',
      { threat, framework, control_id }
    );
    return { key, data: response.data };
  }
);

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    setResources: (state, action: PayloadAction<Resource[]>) => {
      state.resources = action.payload;
    },
    
    selectResource: (state, action: PayloadAction<Resource | null>) => {
      state.selectedResource = action.payload;
    },
    
    setSelectedDfdLevel: (
      state,
      action: PayloadAction<'service' | 'component' | 'code'>
    ) => {
      state.selectedDfdLevel = action.payload;
    },
    
    clearAnalysis: (state) => {
      state.resources = [];
      state.parseResult = null;
      state.serviceDfd = null;
      state.componentDfd = null;
      state.codeDfd = null;
      state.threatDescriptions = {};
      state.remediations = {};
      state.complianceExplanations = {};
      state.selectedResource = null;
      state.error = null;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Upload Terraform
    builder
      .addCase(uploadTerraform.pending, (state) => {
        state.loading.parsing = true;
        state.error = null;
      })
      .addCase(uploadTerraform.fulfilled, (state, action) => {
        state.loading.parsing = false;
        state.parseResult = action.payload;
        state.resources = action.payload.resources;
      })
      .addCase(uploadTerraform.rejected, (state, action) => {
        state.loading.parsing = false;
        state.error = action.error.message || 'Failed to parse Terraform files';
      });
    
    // Generate DFDs
    builder
      .addCase(generateDFDs.pending, (state) => {
        state.loading.dfdGeneration = true;
        state.error = null;
      })
      .addCase(generateDFDs.fulfilled, (state, action) => {
        state.loading.dfdGeneration = false;
        state.serviceDfd = action.payload.service_level;
        state.componentDfd = action.payload.component_level;
        state.codeDfd = action.payload.code_level;
      })
      .addCase(generateDFDs.rejected, (state, action) => {
        state.loading.dfdGeneration = false;
        state.error = action.error.message || 'Failed to generate DFDs';
      });
    
    // Generate Threat Description
    builder
      .addCase(generateThreatDescription.pending, (state) => {
        state.loading.llmDescription = true;
      })
      .addCase(generateThreatDescription.fulfilled, (state, action) => {
        state.loading.llmDescription = false;
        state.threatDescriptions[action.payload.threatId] = action.payload.data;
      })
      .addCase(generateThreatDescription.rejected, (state, action) => {
        state.loading.llmDescription = false;
        state.error = action.error.message || 'Failed to generate threat description';
      });
    
    // Generate Remediation
    builder
      .addCase(generateRemediation.pending, (state) => {
        state.loading.llmRemediation = true;
      })
      .addCase(generateRemediation.fulfilled, (state, action) => {
        state.loading.llmRemediation = false;
        state.remediations[action.payload.threatId] = action.payload.data;
      })
      .addCase(generateRemediation.rejected, (state, action) => {
        state.loading.llmRemediation = false;
        state.error = action.error.message || 'Failed to generate remediation';
      });
    
    // Generate Compliance Explanation
    builder
      .addCase(generateComplianceExplanation.pending, (state) => {
        state.loading.llmCompliance = true;
      })
      .addCase(generateComplianceExplanation.fulfilled, (state, action) => {
        state.loading.llmCompliance = false;
        state.complianceExplanations[action.payload.key] = action.payload.data;
      })
      .addCase(generateComplianceExplanation.rejected, (state, action) => {
        state.loading.llmCompliance = false;
        state.error = action.error.message || 'Failed to generate compliance explanation';
      });
  },
});

export const {
  setResources,
  selectResource,
  setSelectedDfdLevel,
  clearAnalysis,
  setError,
  clearError,
} = analysisSlice.actions;

export default analysisSlice.reducer;

// Selectors
export const selectCurrentDfd = (state: { analysis: AnalysisState }) => {
  const { selectedDfdLevel, serviceDfd, componentDfd, codeDfd } = state.analysis;
  
  switch (selectedDfdLevel) {
    case 'service':
      return serviceDfd;
    case 'component':
      return componentDfd;
    case 'code':
      return codeDfd;
    default:
      return serviceDfd;
  }
};

export const selectResourceById = (resourceId: string) => (state: { analysis: AnalysisState }) => {
  return state.analysis.resources.find((r) => r.id === resourceId);
};
