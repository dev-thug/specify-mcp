import { 
  WorkflowStageTypes,
  WorkflowExecution
} from '../types/workflow.js';
import { Context, ValidationResult, WorkflowStage } from '../types/mcp.js';
import { RedisManager } from '../config/redis.js';
import { ContextManager } from '../core/context-manager.js';
import { CommonValidationModule, ValidationContext } from '../modules/common-validation.js';
import { logger } from '../utils/logger.js';

// Stage processors
import { AmbiguityProcessor } from './stages/ambiguity-processor.js';
import { SpecificationProcessor } from './stages/specification-processor.js';
import { PlanningProcessor } from './stages/planning-processor.js';
import { TaskingProcessor } from './stages/tasking-processor.js';
import { VerificationProcessor } from './stages/verification-processor.js';
import { EvolutionProcessor } from './stages/evolution-processor.js';

export interface WorkflowManagerConfig {
  enableValidation: boolean;
  enableConsensus: boolean;
  enableCritics: boolean;
  enableRefinement: boolean;
  timeoutMs: number;
}

export interface StageProcessor<TInput = any, TOutput = any> {
  process(input: TInput, context: Context): Promise<TOutput>;
  validate?(output: TOutput, context: Context): Promise<ValidationResult>;
}

export class WorkflowManager {
  private redisManager: RedisManager;
  private contextManager: ContextManager;
  private validationModule: CommonValidationModule;
  private config: WorkflowManagerConfig;
  
  // Stage processors
  private processors: Map<WorkflowStage, StageProcessor> = new Map();

  constructor(
    redisManager: RedisManager,
    contextManager: ContextManager,
    validationModule: CommonValidationModule,
    config?: Partial<WorkflowManagerConfig>
  ) {
    this.redisManager = redisManager;
    this.contextManager = contextManager;
    this.validationModule = validationModule;
    
    this.config = {
      enableValidation: true,
      enableConsensus: true,
      enableCritics: true,
      enableRefinement: true,
      timeoutMs: 300000, // 5 minutes
      ...config
    };

    this.initializeProcessors();
  }

  private initializeProcessors(): void {
    this.processors.set('ambiguity', new AmbiguityProcessor());
    this.processors.set('specification', new SpecificationProcessor());
    this.processors.set('planning', new PlanningProcessor());
    this.processors.set('tasking', new TaskingProcessor());
    this.processors.set('verification', new VerificationProcessor());
    this.processors.set('evolution', new EvolutionProcessor());
  }

  async executeStage<K extends WorkflowStage>(
    sessionId: string,
    stage: K,
    input: WorkflowStageTypes[K]['input']
  ): Promise<WorkflowStageTypes[K]['output']> {
    
    const startTime = Date.now();
    logger.info(`Executing workflow stage: ${stage}`, { sessionId, stage });

    try {
      // Get current context
      const context = await this.contextManager.getContext(sessionId);
      if (!context) {
        throw new Error(`Context not found for session: ${sessionId}`);
      }

      // Get stage processor
      const processor = this.processors.get(stage);
      if (!processor) {
        throw new Error(`No processor found for stage: ${stage}`);
      }

      // Create validation context
      const validationContext: ValidationContext = {
        sessionId,
        stage,
        currentInput: input,
        previousOutput: context.previousOutput,
        metadata: context.metadata || {}
      };

      let output: any;

      if (this.config.enableConsensus) {
        // Execute with consensus validation
        const consensusResult = await this.validationModule.validateWithConsensus(
          validationContext,
          async (validatedInput) => {
            return await processor.process(validatedInput, context);
          }
        );

        if (!consensusResult.consensus) {
          throw new Error(`Consensus validation failed for stage ${stage}: confidence ${consensusResult.confidence}`);
        }

        output = consensusResult.finalResult;
      } else {
        // Execute directly
        output = await processor.process(input, context);
      }

      // Run critics integration if enabled
      let criticResults;
      if (this.config.enableCritics) {
        criticResults = await this.validationModule.runCriticsIntegration(validationContext, output);
      }

      // Apply refinement if enabled
      if (this.config.enableRefinement) {
        const refinementResult = await this.validationModule.refinementLoop(
          validationContext,
          output,
          async (refinementInput, _previousAttempts) => {
            return await processor.process(refinementInput, context);
          }
        );
        
        if (refinementResult.refined) {
          output = refinementResult.finalOutput;
          logger.info(`Stage output refined after ${refinementResult.attempts} attempts`, {
            sessionId,
            stage,
            attempts: refinementResult.attempts
          });
        }
      }

      // Calculate metrics
      const metrics = this.validationModule.calculateMetrics(validationContext, output, criticResults);

      // Update context with results
      await this.contextManager.advanceStage(sessionId, this.getNextStage(stage), output);

      // Store stage results
      await this.storeStageResults(sessionId, stage, {
        input,
        output,
        metrics,
        criticResults: criticResults || [],
        executionTime: Date.now() - startTime
      });

      logger.info(`Workflow stage completed: ${stage}`, {
        sessionId,
        stage,
        executionTime: Date.now() - startTime,
        metrics
      });

      return output;

    } catch (error) {
      logger.error(`Workflow stage failed: ${stage}`, error, { sessionId });
      
      // Update execution with error
      await this.updateExecutionWithError(sessionId, stage, error as Error);
      
      throw error;
    }
  }

  async executeFullWorkflow(
    sessionId: string,
    initialInput: string
  ): Promise<WorkflowExecution> {
    logger.info(`Starting full workflow execution`, { sessionId });

    try {
      // Initialize workflow execution
      const execution: WorkflowExecution = {
        sessionId,
        currentStage: 'ambiguity',
        stageResults: {},
        overallMetrics: {
          completeness: 0,
          clarity: 0,
          determinism: 0,
          consistency: 0,
          timestamp: Date.now()
        },
        executionHistory: [],
        status: 'running'
      };

      await this.redisManager.setWorkflowState(sessionId, 'execution', execution);

      // Execute each stage sequentially
      let currentInput: any = initialInput;
      const stages: WorkflowStage[] = ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'];

      for (const stage of stages) {
        try {
          currentInput = await this.executeStage(sessionId, stage, currentInput);
          execution.stageResults[stage] = currentInput;
          execution.currentStage = stage;
          
          // Update execution status
          await this.redisManager.setWorkflowState(sessionId, 'execution', execution);
          
        } catch (error) {
          execution.status = 'failed';
          execution.errorInfo = {
            stage,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          
          await this.redisManager.setWorkflowState(sessionId, 'execution', execution);
          throw error;
        }
      }

      // Calculate overall metrics
      execution.overallMetrics = await this.calculateOverallMetrics(sessionId);
      execution.status = 'completed';

      await this.redisManager.setWorkflowState(sessionId, 'execution', execution);

      logger.info(`Full workflow execution completed`, { 
        sessionId, 
        overallMetrics: execution.overallMetrics 
      });

      return execution;

    } catch (error) {
      logger.error(`Full workflow execution failed`, error, { sessionId });
      throw error;
    }
  }

  async getWorkflowExecution(sessionId: string): Promise<WorkflowExecution | null> {
    return await this.redisManager.getWorkflowState(sessionId, 'execution') as WorkflowExecution;
  }

  async pauseWorkflow(sessionId: string): Promise<void> {
    const execution = await this.getWorkflowExecution(sessionId);
    if (execution && execution.status === 'running') {
      execution.status = 'paused';
      await this.redisManager.setWorkflowState(sessionId, 'execution', execution);
      logger.info(`Workflow paused`, { sessionId });
    }
  }

  async resumeWorkflow(sessionId: string): Promise<void> {
    const execution = await this.getWorkflowExecution(sessionId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      await this.redisManager.setWorkflowState(sessionId, 'execution', execution);
      logger.info(`Workflow resumed`, { sessionId });
    }
  }

  async resetWorkflow(sessionId: string): Promise<void> {
    // Clear all workflow state
    const stages: WorkflowStage[] = ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'];
    
    for (const stage of stages) {
      const client = this.redisManager.getClient();
      await client.del(`mcp:workflow:${sessionId}:${stage}`);
    }

    const client = this.redisManager.getClient();
    await client.del(`mcp:workflow:${sessionId}:execution`);
    
    logger.info(`Workflow reset`, { sessionId });
  }

  private getNextStage(currentStage: WorkflowStage): WorkflowStage {
    const stageOrder: WorkflowStage[] = [
      'ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'
    ];
    
    const currentIndex = stageOrder.indexOf(currentStage);
    const nextIndex = currentIndex + 1;
    
    return nextIndex < stageOrder.length ? stageOrder[nextIndex] : 'evolution';
  }

  private async storeStageResults(
    sessionId: string,
    stage: WorkflowStage,
    results: {
      input: any;
      output: any;
      metrics: any;
      criticResults?: any[];
      executionTime: number;
    }
  ): Promise<void> {
    const stageData = {
      ...results,
      timestamp: new Date().toISOString(),
      stage
    };

    await this.redisManager.setWorkflowState(sessionId, stage, stageData);
    
    // Also store in metrics for analytics
    await this.redisManager.addMetric(
      sessionId,
      `stage_${stage}_execution_time`,
      results.executionTime
    );
    
    if (results.metrics) {
      await this.redisManager.addMetric(
        sessionId,
        `stage_${stage}_completeness`,
        results.metrics.completeness
      );
      
      await this.redisManager.addMetric(
        sessionId,
        `stage_${stage}_clarity`,
        results.metrics.clarity
      );
    }
  }

  private async updateExecutionWithError(
    sessionId: string,
    stage: WorkflowStage,
    error: Error
  ): Promise<void> {
    const execution = await this.getWorkflowExecution(sessionId);
    if (execution) {
      execution.status = 'failed';
      execution.errorInfo = {
        stage,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      await this.redisManager.setWorkflowState(sessionId, 'execution', execution);
    }
  }

  private async calculateOverallMetrics(sessionId: string): Promise<any> {
    const stages: WorkflowStage[] = ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'];
    
    let totalCompleteness = 0;
    let totalClarity = 0;
    let totalDeterminism = 0;
    let totalConsistency = 0;
    let stageCount = 0;

    for (const stage of stages) {
      const stageData = await this.redisManager.getWorkflowState(sessionId, stage);
      if (stageData?.metrics) {
        totalCompleteness += stageData.metrics.completeness || 0;
        totalClarity += stageData.metrics.clarity || 0;
        totalDeterminism += stageData.metrics.determinism || 0;
        totalConsistency += stageData.metrics.consistency || 0;
        stageCount++;
      }
    }

    if (stageCount === 0) {
      return {
        completeness: 0,
        clarity: 0,
        determinism: 0,
        consistency: 0,
        timestamp: Date.now()
      };
    }

    return {
      completeness: totalCompleteness / stageCount,
      clarity: totalClarity / stageCount,
      determinism: totalDeterminism / stageCount,
      consistency: totalConsistency / stageCount,
      timestamp: Date.now()
    };
  }

  // Get workflow analytics
  async getWorkflowAnalytics(sessionId: string): Promise<{
    totalExecutionTime: number;
    stageBreakdown: Record<WorkflowStage, {
      executionTime: number;
      metrics: any;
      criticResults?: any[];
    }>;
    overallMetrics: any;
    status: string;
  }> {
    const execution = await this.getWorkflowExecution(sessionId);
    const stages: WorkflowStage[] = ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'];
    
    const stageBreakdown: any = {};
    let totalExecutionTime = 0;

    for (const stage of stages) {
      const stageData = await this.redisManager.getWorkflowState(sessionId, stage);
      if (stageData) {
        stageBreakdown[stage] = {
          executionTime: stageData.executionTime || 0,
          metrics: stageData.metrics || {},
          criticResults: stageData.criticResults || []
        };
        totalExecutionTime += stageData.executionTime || 0;
      }
    }

    return {
      totalExecutionTime,
      stageBreakdown,
      overallMetrics: execution?.overallMetrics || {},
      status: execution?.status || 'unknown'
    };
  }

  // Health check for workflow manager
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      processorsLoaded: number;
      redisConnected: boolean;
      validationModuleReady: boolean;
    };
  }> {
    const processorsLoaded = this.processors.size;
    const redisConnected = await this.redisManager.healthCheck();
    const validationModuleReady = !!this.validationModule;

    const status = processorsLoaded === 6 && redisConnected && validationModuleReady 
      ? 'healthy' 
      : 'degraded';

    return {
      status,
      details: {
        processorsLoaded,
        redisConnected,
        validationModuleReady
      }
    };
  }
}
