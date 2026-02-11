/**
 * API Client
 * 
 * Axios client with interceptors for authentication, error handling, and logging
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Base URL from environment or default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * Create Axios instance with default configuration
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for LLM requests
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * Add authentication tokens, request logging, etc.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add timestamp to request
    if (config.headers) {
      config.headers['X-Request-Time'] = new Date().toISOString();
    }
    
    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handle errors, refresh tokens, logging, etc.
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }
    
    return response;
  },
  async (error: AxiosError) => {
    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;
      
      // Unauthorized - redirect to login
      if (status === 401) {
        console.error('[API Error] Unauthorized access');
        localStorage.removeItem('auth_token');
        // Optionally redirect to login
        // window.location.href = '/login';
      }
      
      // Forbidden
      if (status === 403) {
        console.error('[API Error] Forbidden access');
      }
      
      // Not Found
      if (status === 404) {
        console.error('[API Error] Resource not found');
      }
      
      // Server Error
      if (status >= 500) {
        console.error('[API Error] Server error', data);
      }
      
      // Rate Limiting
      if (status === 429) {
        console.error('[API Error] Rate limit exceeded');
        
        // Optional: Implement retry with backoff
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          console.log(`Retry after ${retryAfter} seconds`);
        }
      }
      
      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status,
          data,
        });
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('[API Error] No response received', error.request);
    } else {
      // Something else happened
      console.error('[API Error]', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * API Client Methods
 */

export const api = {
  // Terraform endpoints
  terraform: {
    parseFile: (filePath: string) =>
      apiClient.post('/terraform/parse-file', { file_path: filePath }),
    
    parseDirectory: (directoryPath: string) =>
      apiClient.post('/terraform/parse-directory', { directory_path: directoryPath }),
    
    analyzeSecurity: (config: any) =>
      apiClient.post('/terraform/analyze-security', { config }),
  },
  
  // Threat matching endpoints
  threats: {
    match: (config: any, options?: any) =>
      apiClient.post('/threats/match', { config, options }),
    
    getDatabaseStats: () =>
      apiClient.get('/threats/database/stats'),
    
    getThreatById: (threatId: string) =>
      apiClient.get(`/threats/${threatId}`),
    
    getThreatsForResourceType: (resourceType: string) =>
      apiClient.get(`/threats/resource-types/${resourceType}`),
  },
  
  // DFD endpoints
  dfd: {
    generateService: (resources: any[]) =>
      apiClient.post('/dfd/generate/service', { resources }),
    
    generateComponent: (resources: any[]) =>
      apiClient.post('/dfd/generate/component', { resources }),
    
    generateCode: (codeFlows: any[]) =>
      apiClient.post('/dfd/generate/code', { code_flows: codeFlows }),
    
    generateAll: (resources: any[], codeFlows?: any[]) =>
      apiClient.post('/dfd/generate/all', { resources, code_flows: codeFlows }),
    
    exportMermaid: (dfd: any, includeTrustBoundaries = true) =>
      apiClient.post('/dfd/export/mermaid', { dfd, include_trust_boundaries: includeTrustBoundaries }),
    
    exportSvg: (dfd: any) =>
      apiClient.post('/dfd/export/svg', { dfd }),
    
    getSummary: (dfd: any) =>
      apiClient.post('/dfd/summary', { dfd }),
  },
  
  // LLM endpoints
  llm: {
    describeThreat: (config: any, threatRule: any, useCache = true) =>
      apiClient.post('/llm/threat/describe', { config, threat_rule: threatRule, use_cache: useCache }),
    
    generateRemediation: (threat: any, context: any, useCache = true) =>
      apiClient.post('/llm/threat/remediate', { threat, context, use_cache: useCache }),
    
    explainCompliance: (threat: any, framework: string, controlId: string, useCache = true) =>
      apiClient.post('/llm/threat/compliance', { threat, framework, control_id: controlId, use_cache: useCache }),
    
    generateAttackScenario: (threat: any, context: any, useCache = true) =>
      apiClient.post('/llm/threat/attack-scenario', { threat, context, use_cache: useCache }),
    
    assessRisk: (threat: any, context: any, useCache = true) =>
      apiClient.post('/llm/threat/risk-assessment', { threat, context, use_cache: useCache }),
    
    getStatistics: () =>
      apiClient.get('/llm/statistics'),
  },
  
  // Health check
  health: () =>
    apiClient.get('/health'),
};

export default apiClient;
