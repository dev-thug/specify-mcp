/**
 * Feature Flags for Progressive System Integration
 * Enables gradual rollout of new quality systems
 */

export interface FeatureFlags {
  // Quality Analysis Systems
  USE_SEMANTIC_ANALYZER: boolean;
  USE_PHASE_EVALUATOR: boolean;
  USE_ITERATION_TRACKER: boolean;
  USE_ADAPTIVE_QUESTIONS: boolean;
  
  // Logging and Comparison
  LOG_QUALITY_COMPARISON: boolean;
  LOG_PERFORMANCE_METRICS: boolean;
  
  // Fallback Behavior
  FALLBACK_ON_ERROR: boolean;
}

/**
 * Current feature flag configuration
 * Enable systems one by one after testing
 */
export const FEATURE_FLAGS: FeatureFlags = {
  // Phase 1: Enable semantic analysis (NOW)
  USE_SEMANTIC_ANALYZER: true,
  
  // Phase 2: Enable phase-specific evaluation (NOW ACTIVE)
  USE_PHASE_EVALUATOR: true,
  
  // Phase 3: Enable iteration tracking (NOW ACTIVE)
  USE_ITERATION_TRACKER: true,
  
  // Phase 4: Enable adaptive questions (NOW ACTIVE)
  USE_ADAPTIVE_QUESTIONS: true,
  
  // Debugging and monitoring
  LOG_QUALITY_COMPARISON: true,  // Compare old vs new scores
  LOG_PERFORMANCE_METRICS: true, // Track processing time
  
  // Safety
  FALLBACK_ON_ERROR: true // Use old system if new one fails
};

/**
 * Helper to check if a feature is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Helper to log feature flag status
 */
export function logFeatureStatus(): void {
  console.log('🚀 Feature Flags Status:');
  Object.entries(FEATURE_FLAGS).forEach(([key, value]) => {
    const icon = value ? '✅' : '⏸️';
    console.log(`  ${icon} ${key}: ${value}`);
  });
}
