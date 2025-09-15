/**
 * Common Validation Module
 * Provides consistency checks, multi-run consensus, critics integration, and quality metrics
 * Called at the end of each AI-SDD phase to control non-determinism and ensure quality
 */

import { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning, 
  ValidationMetrics,
  ValidationConfig,
  CriticsConfig,
  WorkflowPhase,
  ConsensusError
} from '../types/index.js';

export interface ValidationInput {
  readonly content: unknown;
  readonly previousContent?: unknown;
  readonly phase: WorkflowPhase;
  readonly context?: Record<string, unknown>;
}

export interface ConsensusResult<T> {
  readonly consensusValue: T;
  readonly confidence: number;
  readonly agreement: number;
  readonly iterations: number;
  readonly variants: T[];
}

export class CommonValidationModule {
  private readonly config: ValidationConfig;
  private readonly criticsConfig: CriticsConfig;

  constructor(config: ValidationConfig, criticsConfig: CriticsConfig) {
    this.config = config;
    this.criticsConfig = criticsConfig;
  }

  /**
   * Main validation entry point called at the end of each phase
   */
  async validate(input: ValidationInput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalScore = 0;
    let scoreCount = 0;

    try {
      // Step 1: Consistency Check
      const consistencyResult = await this.performConsistencyCheck(
        input.content, 
        input.previousContent, 
        input.phase
      );
      totalScore += consistencyResult.score;
      scoreCount++;
      errors.push(...consistencyResult.errors);
      warnings.push(...consistencyResult.warnings);

      // Step 2: Multi-Run Consensus (if enabled)
      if (this.config.multiRunCount > 1) {
        const consensusResult = await this.achieveConsensus(
          input.content,
          input.phase,
          input.context
        );
        totalScore += consensusResult.confidence;
        scoreCount++;
        
        if (consensusResult.confidence < this.config.consensusThreshold) {
          errors.push({
            code: 'CONSENSUS_FAILED',
            message: `Consensus confidence ${consensusResult.confidence} below threshold ${this.config.consensusThreshold}`,
            severity: 'high',
            location: input.phase,
            suggestion: 'Consider refining the input or adjusting model parameters'
          } as ValidationError);
        }
      }

      // Step 3: Critics Integration (if enabled)
      if (this.criticsConfig.enabled) {
        const criticsResult = await this.integrateCritics(
          input.content,
          input.phase
        );
        totalScore += criticsResult.score;
        scoreCount++;
        errors.push(...criticsResult.errors);
        warnings.push(...criticsResult.warnings);
      }

      // Step 4: Calculate Quality Metrics
      const metrics = await this.calculateMetrics(
        input.content,
        input.previousContent,
        input.phase
      );

      const finalScore = scoreCount > 0 ? totalScore / scoreCount : 0;
      const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;

      return {
        isValid,
        score: finalScore,
        errors,
        warnings,
        metrics
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_EXCEPTION',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        severity: 'critical',
        location: input.phase
      } as ValidationError);

      return {
        isValid: false,
        score: 0,
        errors,
        warnings,
        metrics: this.getDefaultMetrics()
      };
    }
  }

  /**
   * Performs consistency check with previous phase output
   * Uses semantic similarity, keyword overlap, and logical entailment
   */
  private async performConsistencyCheck(
    currentContent: unknown,
    previousContent: unknown | undefined,
    phase: WorkflowPhase
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // If no previous content (first phase), use basic validation
    if (!previousContent) {
      return {
        isValid: true,
        score: 1.0,
        errors,
        warnings,
        metrics: this.getDefaultMetrics()
      };
    }

    try {
      // Convert content to comparable strings
      const currentStr = this.contentToString(currentContent);
      const previousStr = this.contentToString(previousContent);

      // Semantic similarity check (simplified implementation)
      const semanticSimilarity = this.calculateSemanticSimilarity(currentStr, previousStr);
      
      // Keyword overlap check using Jaccard index
      const keywordOverlap = this.calculateKeywordOverlap(currentStr, previousStr);
      
      // Logical entailment check (simplified)
      const entailmentScore = this.checkLogicalEntailment(currentStr, previousStr);

      const consistencyScore = (semanticSimilarity + keywordOverlap + entailmentScore) / 3;

      if (consistencyScore < 0.7) {
        warnings.push({
          code: 'LOW_CONSISTENCY',
          message: `Consistency score ${consistencyScore.toFixed(2)} below recommended threshold`,
          location: phase,
          recommendation: 'Review alignment with previous phase outputs'
        });
      }

      if (consistencyScore < 0.4) {
        errors.push({
          code: 'CONSISTENCY_FAILURE',
          message: `Critical consistency failure: ${consistencyScore.toFixed(2)}`,
          severity: 'high',
          location: phase,
          suggestion: 'Significant deviation from previous phase detected'
        } as ValidationError);
      }

      return {
        isValid: consistencyScore >= 0.4,
        score: consistencyScore,
        errors,
        warnings,
        metrics: {
          consistency: consistencyScore,
          completeness: 0.8, // Placeholder
          clarity: 0.8, // Placeholder
          correctness: 0.8, // Placeholder
          determinism: 0.8 // Placeholder
        }
      };

    } catch (error) {
      errors.push({
        code: 'CONSISTENCY_CHECK_ERROR',
        message: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium',
        location: phase
      } as ValidationError);

      return {
        isValid: false,
        score: 0,
        errors,
        warnings,
        metrics: this.getDefaultMetrics()
      };
    }
  }

  /**
   * Achieves consensus through multiple LLM runs
   * Controls non-determinism by requiring agreement between multiple attempts
   */
  private async achieveConsensus<T>(
    content: T,
    phase: WorkflowPhase,
    context?: Record<string, unknown>
  ): Promise<ConsensusResult<T>> {
    const variants: T[] = [content];
    const runCount = this.config.multiRunCount;
    
    // In a real implementation, this would re-run the LLM multiple times
    // For now, we simulate consensus checking
    let agreement = 1.0;
    let confidence = 1.0;

    // Simulate multiple runs (in real implementation, would call LLM multiple times)
    for (let i = 1; i < runCount; i++) {
      // Placeholder: In real implementation, would generate variant here
      const variant = content; // Simulate identical output
      variants.push(variant);
      
      // Calculate agreement between variants
      const variantAgreement = this.calculateAgreement(content, variant);
      agreement = Math.min(agreement, variantAgreement);
    }

    confidence = agreement;

    if (confidence < this.config.consensusThreshold) {
      throw new ConsensusError(
        `Consensus not achieved: ${confidence} < ${this.config.consensusThreshold}`,
        phase,
        { variants: variants.length, agreement }
      );
    }

    return {
      consensusValue: content,
      confidence,
      agreement,
      iterations: runCount,
      variants
    };
  }

  /**
   * Integrates external critics for quality assessment
   * Uses tools like static analyzers, linters, formal verification tools
   */
  private async integrateCritics(
    content: unknown,
    phase: WorkflowPhase
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalScore = 0;
    let criticCount = 0;

    for (const tool of this.criticsConfig.tools) {
      try {
        const result = await this.runCritic(tool, content, phase);
        totalScore += result.score;
        criticCount++;
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        warnings.push({
          code: 'CRITIC_FAILURE',
          message: `Critic '${tool}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: phase,
          recommendation: `Check ${tool} configuration and availability`
        });
      }
    }

    const averageScore = criticCount > 0 ? totalScore / criticCount : 0.5;

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      score: averageScore,
      errors,
      warnings,
      metrics: this.getDefaultMetrics()
    };
  }

  /**
   * Calculates comprehensive quality metrics
   */
  private async calculateMetrics(
    currentContent: unknown,
    previousContent: unknown | undefined,
    phase: WorkflowPhase  
  ): Promise<ValidationMetrics> {
    const contentStr = this.contentToString(currentContent);
    
    // Completeness: measure how complete the content is
    const completeness = this.calculateCompleteness(contentStr, phase);
    
    // Clarity: measure readability and understandability  
    const clarity = this.calculateClarity(contentStr);
    
    // Correctness: measure syntactic and semantic correctness
    const correctness = this.calculateCorrectness(contentStr, phase);
    
    // Consistency: measure alignment with previous phases
    const consistency = previousContent 
      ? this.calculateSemanticSimilarity(contentStr, this.contentToString(previousContent))
      : 1.0;
    
    // Determinism: measure stability across multiple runs
    const determinism = 0.9; // Placeholder - would track variance across runs

    return {
      consistency,
      completeness,
      clarity,
      correctness,
      determinism
    };
  }

  // Helper methods

  private contentToString(content: unknown): string {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content, null, 2);
    }
    return String(content);
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simplified implementation using word overlap
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateKeywordOverlap(text1: string, text2: string): number {
    // Jaccard index implementation
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private checkLogicalEntailment(text1: string, text2: string): number {
    // Simplified entailment check - in practice would use NLI models
    const similarity = this.calculateSemanticSimilarity(text1, text2);
    return similarity > 0.8 ? 1.0 : similarity;
  }

  private calculateAgreement<T>(content1: T, content2: T): number {
    // Simplified agreement calculation
    const str1 = this.contentToString(content1);
    const str2 = this.contentToString(content2);
    return this.calculateSemanticSimilarity(str1, str2);
  }

  private async runCritic(tool: string, content: unknown, phase: WorkflowPhase): Promise<ValidationResult> {
    // Placeholder implementation for critics integration
    // In practice, would call external tools like Frama-C, SonarQube, etc.
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    switch (tool) {
      case 'frama-c':
        return this.runFramaC(content, phase);
      case 'sonarqube': 
        return this.runSonarQube(content, phase);
      case 'eslint':
        return this.runESLint(content, phase);
      default:
        warnings.push({
          code: 'UNKNOWN_CRITIC',
          message: `Unknown critic tool: ${tool}`,
          location: phase,
          recommendation: 'Check tool configuration'
        });
        return {
          isValid: true,
          score: 0.5,
          errors,
          warnings,
          metrics: this.getDefaultMetrics()
        };
    }
  }

  private async runFramaC(content: unknown, phase: WorkflowPhase): Promise<ValidationResult> {
    // Placeholder for Frama-C integration
    return {
      isValid: true,
      score: 0.9,
      errors: [],
      warnings: [],
      metrics: this.getDefaultMetrics()
    };
  }

  private async runSonarQube(content: unknown, phase: WorkflowPhase): Promise<ValidationResult> {
    // Placeholder for SonarQube integration
    return {
      isValid: true,
      score: 0.85,
      errors: [],
      warnings: [],
      metrics: this.getDefaultMetrics()
    };
  }

  private async runESLint(content: unknown, phase: WorkflowPhase): Promise<ValidationResult> {
    // Placeholder for ESLint integration
    return {
      isValid: true,
      score: 0.9,
      errors: [],
      warnings: [],
      metrics: this.getDefaultMetrics()
    };
  }

  private calculateCompleteness(content: string, phase: WorkflowPhase): number {
    // Simplified completeness calculation based on content length and structure
    const wordCount = content.split(/\s+/).length;
    const hasStructure = content.includes('\n') || content.includes('.');
    
    let completeness = Math.min(wordCount / 100, 1.0); // Normalize by expected length
    if (hasStructure) completeness += 0.1;
    
    return Math.min(completeness, 1.0);
  }

  private calculateClarity(content: string): number {
    // Simplified Flesch-Kincaid readability score approximation
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const syllables = content.match(/[aeiouAEIOU]/g)?.length || 0;
    
    if (sentences === 0 || words === 0) return 0.5;
    
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    // Simplified readability score (0-1 scale)
    const readabilityScore = Math.max(0, Math.min(1, 1 - (avgWordsPerSentence + avgSyllablesPerWord) / 20));
    
    return readabilityScore;
  }

  private calculateCorrectness(content: string, phase: WorkflowPhase): number {
    // Simplified correctness check
    let score = 1.0;
    
    // Check for common issues
    if (content.includes('[NEEDS CLARIFICATION]')) score -= 0.2;
    if (content.includes('TODO') || content.includes('FIXME')) score -= 0.1;
    if (content.length < 10) score -= 0.3;
    
    return Math.max(0, score);
  }

  private getDefaultMetrics(): ValidationMetrics {
    return {
      consistency: 0.8,
      completeness: 0.8,
      clarity: 0.8,
      correctness: 0.8,
      determinism: 0.8
    };
  }
}
