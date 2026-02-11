/**
 * useCompliance Hook
 * 
 * Custom hook for compliance framework operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useAppSelector } from '../store/store';
import type { ComplianceMapping, MatchedThreat } from '../types';

export type ComplianceFramework = 
  | 'NIST-800-53'
  | 'CIS-AWS'
  | 'PCI-DSS'
  | 'HIPAA'
  | 'SOC2'
  | 'ISO-27001'
  | 'GDPR';

interface ComplianceStats {
  total_controls: number;
  mapped_threats: number;
  unmapped_threats: number;
  coverage_percentage: number;
  by_category: Record<string, number>;
}

export const useCompliance = () => {
  const threats = useAppSelector((state) => state.threatModel.threats);
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework>('NIST-800-53');
  
  /**
   * Get all compliance mappings for selected framework
   */
  const getComplianceMappings = useCallback((): ComplianceMapping[] => {
    const mappings: ComplianceMapping[] = [];
    
    threats.forEach((threat) => {
      if (threat.compliance_mappings) {
        const frameworkMappings = threat.compliance_mappings[selectedFramework];
        if (frameworkMappings) {
          frameworkMappings.forEach((mapping) => {
            mappings.push({
              ...mapping,
              framework: selectedFramework,
            });
          });
        }
      }
    });
    
    return mappings;
  }, [threats, selectedFramework]);
  
  /**
   * Get threats mapped to a specific control
   */
  const getThreatsByControl = useCallback((controlId: string): MatchedThreat[] => {
    return threats.filter((threat) => {
      if (!threat.compliance_mappings) return false;
      
      const frameworkMappings = threat.compliance_mappings[selectedFramework];
      if (!frameworkMappings) return false;
      
      return frameworkMappings.some((mapping) => mapping.control_id === controlId);
    });
  }, [threats, selectedFramework]);
  
  /**
   * Get compliance statistics
   */
  const getComplianceStats = useCallback((): ComplianceStats => {
    const mappings = getComplianceMappings();
    const uniqueControls = new Set(mappings.map((m) => m.control_id));
    const threatsWithMappings = threats.filter((t) => 
      t.compliance_mappings && t.compliance_mappings[selectedFramework]
    );
    
    // Count by category
    const byCategory: Record<string, number> = {};
    mappings.forEach((mapping) => {
      const category = mapping.control_category || 'Uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });
    
    return {
      total_controls: uniqueControls.size,
      mapped_threats: threatsWithMappings.length,
      unmapped_threats: threats.length - threatsWithMappings.length,
      coverage_percentage: threats.length > 0 
        ? (threatsWithMappings.length / threats.length) * 100 
        : 0,
      by_category: byCategory,
    };
  }, [threats, selectedFramework, getComplianceMappings]);
  
  /**
   * Get controls grouped by category
   */
  const getControlsByCategory = useCallback((): Record<string, ComplianceMapping[]> => {
    const mappings = getComplianceMappings();
    const grouped: Record<string, ComplianceMapping[]> = {};
    
    mappings.forEach((mapping) => {
      const category = mapping.control_category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(mapping);
    });
    
    return grouped;
  }, [getComplianceMappings]);
  
  /**
   * Check if threat is compliant
   */
  const isThreatCompliant = useCallback((threatId: string): boolean => {
    const threat = threats.find((t) => t.matched_threat?.id === threatId);
    if (!threat || !threat.compliance_mappings) return false;
    
    const frameworkMappings = threat.compliance_mappings[selectedFramework];
    return frameworkMappings ? frameworkMappings.length > 0 : false;
  }, [threats, selectedFramework]);
  
  /**
   * Get compliance gap analysis
   */
  const getComplianceGaps = useCallback((): MatchedThreat[] => {
    return threats.filter((threat) => {
      if (!threat.compliance_mappings) return true;
      
      const frameworkMappings = threat.compliance_mappings[selectedFramework];
      return !frameworkMappings || frameworkMappings.length === 0;
    });
  }, [threats, selectedFramework]);
  
  // Available frameworks
  const availableFrameworks: ComplianceFramework[] = useMemo(() => [
    'NIST-800-53',
    'CIS-AWS',
    'PCI-DSS',
    'HIPAA',
    'SOC2',
    'ISO-27001',
    'GDPR',
  ], []);
  
  // Memoized stats
  const stats = useMemo(() => getComplianceStats(), [getComplianceStats]);
  const gaps = useMemo(() => getComplianceGaps(), [getComplianceGaps]);
  
  return {
    // State
    selectedFramework,
    availableFrameworks,
    stats,
    gaps,
    
    // Actions
    setSelectedFramework,
    
    // Methods
    getComplianceMappings,
    getThreatsByControl,
    getComplianceStats,
    getControlsByCategory,
    isThreatCompliant,
    getComplianceGaps,
  };
};
