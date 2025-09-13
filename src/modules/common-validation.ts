import { z } from 'zod';
import { ValidationResult, ConsensusResult, Metrics } from '../types/mcp.js';
import { validationConfig } from '../config/environment.js';
import { logger } from '../utils/logger.js';

// Multi-Run Consensus Types
export const ConsensusConfigSchema = z.object({
  runs: z.number().min(3).max(10).default(5),
  threshold: z.number().min(0.5).max(1.0).default(0.8),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(5).default(3)
});

export const CriticConfigSchema = z.object({
  enabled: z.boolean().default(true),
  tools: z.array(z.enum(['sonarqube', 'eslint', 'custom'])).default(['eslint']),
  weights: z.object({
    correctness: z.number().min(0).max(1).default(0.5),
    security: z.number().min(0).max(1).default(0.3),
    performance: z.number().min(0).max(1).default(0.2)
  })
});

export type ConsensusConfig = z.infer<typeof ConsensusConfigSchema>;
export type CriticConfig = z.infer<typeof CriticConfigSchema>;

export interface ValidationContext {
  sessionId: string;
  stage: string;
  previousOutput?: any;
  currentInput: any;
  metadata?: Record<string, any>;
}

export interface CriticResult {
  tool: string;
  score: number;
  issues: Array<{
    severity: 'info' | 'warning' | 'error' | 'critical';
    category: string;
    message: string;
    line?: number;
    file?: string;
  }>;
  metrics: Record<string, number>;
}

export class CommonValidationModule {
  private consensusConfig: ConsensusConfig;
  private criticConfig: CriticConfig;

  constructor(
    consensusConfig?: Partial<ConsensusConfig>,
    criticConfig?: Partial<CriticConfig>
  ) {
    this.consensusConfig = ConsensusConfigSchema.parse(consensusConfig || {});
    this.criticConfig = CriticConfigSchema.parse(criticConfig || {});
  }

  async validateWithConsensus(
    context: ValidationContext,
    validator: (input: any) => Promise<any>
  ): Promise<ConsensusResult> {
    const startTime = Date.now();
    const results: any[] = [];
    const errors: string[] = [];

    logger.info(`Starting consensus validation`, {
      sessionId: context.sessionId,
      stage: context.stage,
      runs: this.consensusConfig.runs
    });

    // Execute multiple validation runs
    for (let i = 0; i < this.consensusConfig.runs; i++) {
      try {
        const result = await this.executeWithTimeout(
          () => validator(context.currentInput),
          this.consensusConfig.timeout
        );
        results.push(result);
      } catch (error) {
        errors.push(`Run ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logger.warn(`Validation run ${i + 1} failed:`, error);
      }
    }

    // Check if we have enough successful results
    if (results.length < Math.ceil(this.consensusConfig.runs / 2)) {
      return {
        consensus: false,
        confidence: 0,
        results,
        finalResult: null,
        metadata: {
          errors,
          executionTime: Date.now() - startTime,
          successfulRuns: results.length,
          totalRuns: this.consensusConfig.runs
        }
      };
    }

    // Calculate consensus
    const consensus = await this.calculateConsensus(results);
    const executionTime = Date.now() - startTime;

    logger.info(`Consensus validation completed`, {
      sessionId: context.sessionId,
      consensus: consensus.consensus,
      confidence: consensus.confidence,
      executionTime
    });

    return {
      ...consensus,
      metadata: {
        ...consensus.metadata,
        errors,
        executionTime,
        successfulRuns: results.length,
        totalRuns: this.consensusConfig.runs
      }
    };
  }

  async runCriticsIntegration(
    context: ValidationContext,
    output: any
  ): Promise<CriticResult[]> {
    if (!this.criticConfig.enabled) {
      return [];
    }

    const criticResults: CriticResult[] = [];
    
    for (const tool of this.criticConfig.tools) {
      try {
        const result = await this.runCriticTool(tool, context, output);
        criticResults.push(result);
      } catch (error) {
        logger.error(`Critic tool ${tool} failed:`, error);
        criticResults.push({
          tool,
          score: 0,
          issues: [{
            severity: 'error',
            category: 'tool_error',
            message: error instanceof Error ? error.message : 'Tool execution failed'
          }],
          metrics: {}
        });
      }
    }

    return criticResults;
  }

  async refinementLoop(
    context: ValidationContext,
    initialOutput: any,
    validator: (input: any, previousAttempts: any[]) => Promise<any>
  ): Promise<{ finalOutput: any; attempts: number; refined: boolean }> {
    const maxAttempts = validationConfig.refinementMaxAttempts;
    const attempts: any[] = [initialOutput];
    let currentOutput = initialOutput;
    let refined = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Validate current output
      const validation = await this.validateOutput(currentOutput, context);
      
      if (validation.isValid && validation.metrics && this.isQualityAcceptable(validation.metrics)) {
        break;
      }

      if (attempt === maxAttempts) {
        logger.warn(`Refinement loop reached max attempts (${maxAttempts})`, {
          sessionId: context.sessionId,
          stage: context.stage
        });
        break;
      }

      // Attempt refinement
      try {
        const refinedOutput = await validator(context.currentInput, attempts);
        if (this.isDifferentFromPrevious(refinedOutput, attempts)) {
          attempts.push(refinedOutput);
          currentOutput = refinedOutput;
          refined = true;
        } else {
          // No meaningful change, stop refinement
          break;
        }
      } catch (error) {
        logger.error(`Refinement attempt ${attempt} failed:`, error);
        break;
      }
    }

    return {
      finalOutput: currentOutput,
      attempts: attempts.length,
      refined
    };
  }

  calculateMetrics(
    context: ValidationContext,
    output: any,
    criticResults?: CriticResult[]
  ): Metrics {
    const timestamp = Date.now();
    
    // Base metrics calculation
    let completeness = this.calculateCompleteness(output);
    let clarity = this.calculateClarity(output);
    let determinism = this.calculateDeterminism(output);
    let consistency = this.calculateConsistency(output, context.previousOutput);

    // Apply critic weights if available
    if (criticResults && criticResults.length > 0) {
      const weights = this.criticConfig.weights;
      const criticScores = this.aggregateCriticScores(criticResults);
      
      // Adjust metrics based on critic feedback
      completeness = completeness * (1 - weights.correctness) + criticScores.correctness * weights.correctness;
      consistency = consistency * (1 - weights.security) + criticScores.security * weights.security;
      clarity = clarity * (1 - weights.performance) + criticScores.performance * weights.performance;
    }

    return {
      completeness: Math.max(0, Math.min(1, completeness)),
      clarity: Math.max(0, Math.min(1, clarity)),
      determinism: Math.max(0, Math.min(1, determinism)),
      consistency: Math.max(0, Math.min(1, consistency)),
      timestamp
    };
  }

  private async calculateConsensus(results: any[]): Promise<ConsensusResult> {
    if (results.length === 0) {
      return {
        consensus: false,
        confidence: 0,
        results: [],
        finalResult: null
      };
    }

    if (results.length === 1) {
      return {
        consensus: true,
        confidence: 1.0,
        results,
        finalResult: results[0]
      };
    }

    // Simple similarity-based consensus
    const similarities: number[][] = [];
    
    for (let i = 0; i < results.length; i++) {
      similarities[i] = [];
      for (let j = 0; j < results.length; j++) {
        similarities[i][j] = this.calculateSimilarity(results[i], results[j]);
      }
    }

    // Find the result with highest average similarity
    let bestIndex = 0;
    let bestScore = 0;
    
    for (let i = 0; i < results.length; i++) {
      const avgSimilarity = similarities[i].reduce((sum, sim) => sum + sim, 0) / similarities[i].length;
      if (avgSimilarity > bestScore) {
        bestScore = avgSimilarity;
        bestIndex = i;
      }
    }

    const consensus = bestScore >= this.consensusConfig.threshold;
    
    return {
      consensus,
      confidence: bestScore,
      results,
      finalResult: results[bestIndex],
      metadata: {
        bestIndex,
        averageSimilarity: bestScore,
        threshold: this.consensusConfig.threshold
      }
    };
  }

  private calculateSimilarity(result1: any, result2: any): number {
    if (result1 === result2) return 1.0;
    
    const str1 = JSON.stringify(result1);
    const str2 = JSON.stringify(result2);
    
    // Simple Jaccard similarity
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private async runCriticTool(tool: string, context: ValidationContext, output: any): Promise<CriticResult> {
    switch (tool) {
      case 'eslint':
        return this.runESLintCritic(output);
      case 'sonarqube':
        return this.runSonarQubeCritic(output);
      case 'custom':
        return this.runCustomCritic(context, output);
      default:
        throw new Error(`Unknown critic tool: ${tool}`);
    }
  }

  private async runESLintCritic(output: any): Promise<CriticResult> {
    // Simplified ESLint-style analysis
    const issues: CriticResult['issues'] = [];
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    
    // Basic code quality checks
    if (outputStr.includes('eval(')) {
      issues.push({
        severity: 'error',
        category: 'security',
        message: 'Use of eval() is dangerous'
      });
    }
    
    if (outputStr.length > 10000) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        message: 'Output is very large, consider optimization'
      });
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, 1 - (errorCount * 0.2 + warningCount * 0.1));

    return {
      tool: 'eslint',
      score,
      issues,
      metrics: {
        errorCount,
        warningCount,
        lineCount: outputStr.split('\n').length
      }
    };
  }

  private async runSonarQubeCritic(_output: any): Promise<CriticResult> {
    // Placeholder for SonarQube integration
    return {
      tool: 'sonarqube',
      score: 0.8,
      issues: [],
      metrics: {
        complexity: 5,
        coverage: 0.85,
        duplications: 0.02
      }
    };
  }

  private async runCustomCritic(_context: ValidationContext, _output: any): Promise<CriticResult> {
    // Custom validation logic
    const issues: CriticResult['issues'] = [];
    let score = 1.0;

    // Check output structure
    if (!_output || typeof _output !== 'object') {
      issues.push({
        severity: 'warning',
        category: 'structure',
        message: 'Output should be a structured object'
      });
      score -= 0.2;
    }

    return {
      tool: 'custom',
      score: Math.max(0, score),
      issues,
      metrics: {
        structureScore: score
      }
    };
  }

  private calculateCompleteness(output: any): number {
    if (!output) return 0;
    
    const outputStr = JSON.stringify(output);
    const baseScore = Math.min(1, outputStr.length / 1000); // Assume 1000 chars is "complete"
    
    // Check for key indicators of completeness
    const hasDescription = outputStr.includes('description');
    const hasDetails = outputStr.includes('detail');
    const hasStructure = typeof output === 'object' && Object.keys(output).length > 3;
    
    let bonusScore = 0;
    if (hasDescription) bonusScore += 0.1;
    if (hasDetails) bonusScore += 0.1;
    if (hasStructure) bonusScore += 0.1;
    
    return Math.min(1, baseScore + bonusScore);
  }

  private calculateClarity(output: any): number {
    const outputStr = JSON.stringify(output);
    
    // Simple readability metrics
    const avgWordLength = outputStr.split(' ').reduce((sum, word) => sum + word.length, 0) / outputStr.split(' ').length;
    const sentenceCount = (outputStr.match(/[.!?]/g) || []).length;
    const wordCount = outputStr.split(' ').length;
    
    // Clarity decreases with very long words or very long sentences
    const wordLengthScore = Math.max(0, 1 - Math.max(0, avgWordLength - 6) * 0.1);
    const sentenceLengthScore = sentenceCount > 0 ? Math.min(1, 20 / (wordCount / sentenceCount)) : 0.5;
    
    return (wordLengthScore + sentenceLengthScore) / 2;
  }

  private calculateDeterminism(output: any): number {
    // For determinism, we expect consistent structure and format
    if (typeof output === 'object' && output !== null) {
      const keys = Object.keys(output);
      return keys.length > 0 ? 0.8 : 0.4; // Structured output is more deterministic
    }
    
    return 0.6; // Default for unstructured output
  }

  private calculateConsistency(output: any, previousOutput?: any): number {
    if (!previousOutput) return 1.0; // No previous output to compare
    
    return this.calculateSimilarity(output, previousOutput);
  }

  private aggregateCriticScores(criticResults: CriticResult[]): Record<string, number> {
    const scores = {
      correctness: 0,
      security: 0,
      performance: 0
    };
    
    let correctnessCount = 0;
    let securityCount = 0;
    let performanceCount = 0;
    
    for (const result of criticResults) {
      for (const issue of result.issues) {
        switch (issue.category) {
          case 'correctness':
          case 'structure':
            scores.correctness += result.score;
            correctnessCount++;
            break;
          case 'security':
            scores.security += result.score;
            securityCount++;
            break;
          case 'performance':
            scores.performance += result.score;
            performanceCount++;
            break;
        }
      }
    }
    
    return {
      correctness: correctnessCount > 0 ? scores.correctness / correctnessCount : 0.8,
      security: securityCount > 0 ? scores.security / securityCount : 0.9,
      performance: performanceCount > 0 ? scores.performance / performanceCount : 0.8
    };
  }

  private async validateOutput(output: any, context: ValidationContext): Promise<ValidationResult> {
    const metrics = this.calculateMetrics(context, output);
    
    return {
      isValid: this.isQualityAcceptable(metrics),
      metrics
    };
  }

  private isQualityAcceptable(metrics: Metrics): boolean {
    return metrics.completeness >= 0.7 && 
           metrics.clarity >= 0.6 && 
           metrics.consistency >= 0.7;
  }

  private isDifferentFromPrevious(output: any, previousAttempts: any[]): boolean {
    const similarity = this.calculateSimilarity(
      output, 
      previousAttempts[previousAttempts.length - 1]
    );
    return similarity < 0.95; // Consider different if less than 95% similar
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
