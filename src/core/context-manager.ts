import { 
  Context, 
  WorkflowStage 
} from '../types/mcp.js';
import { 
  WorkflowExecution 
} from '../types/workflow.js';
import { RedisManager } from '../config/redis.js';
import { SchemaValidator } from './schema-validator.js';
import { logger } from '../utils/logger.js';
// import { createHash } from 'crypto'; // unused

export interface ContextUpdateOptions {
  preserveHistory?: boolean;
  updateMetrics?: boolean;
  validateSchema?: boolean;
  notifySubscribers?: boolean;
}

export class ContextManager {
  private redisManager: RedisManager;
  private schemaValidator: SchemaValidator;
  private activeContexts: Map<string, Context> = new Map();
  private contextSubscribers: Map<string, Set<string>> = new Map();

  constructor(redisManager: RedisManager, schemaValidator: SchemaValidator) {
    this.redisManager = redisManager;
    this.schemaValidator = schemaValidator;
  }

  async createContext(sessionId: string, initialData?: Partial<Context>): Promise<Context> {
    const context: Context = {
      sessionId,
      stage: 'ambiguity',
      timestamp: new Date().toISOString(),
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        ...initialData?.metadata
      },
      ...initialData
    };

    // Validate context structure
    const validation = await this.schemaValidator.validate('context', context);
    if (!validation.isValid) {
      throw new Error(`Invalid context structure: ${validation.errors?.join(', ')}`);
    }

    // Store in Redis and local cache
    await this.redisManager.setContext(sessionId, context);
    this.activeContexts.set(sessionId, context);

    // Initialize workflow execution tracking
    const workflowExecution: WorkflowExecution = {
      sessionId,
      currentStage: context.stage as WorkflowStage,
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

    await this.redisManager.setWorkflowState(sessionId, 'execution', workflowExecution);

    logger.info(`Created new context for session ${sessionId}`, { 
      stage: context.stage,
      hasMetadata: !!context.metadata
    });

    return context;
  }

  async getContext(sessionId: string): Promise<Context | null> {
    // Check local cache first
    let context = this.activeContexts.get(sessionId);
    
    if (!context) {
      // Load from Redis
      context = await this.redisManager.getContext(sessionId);
      if (context) {
        this.activeContexts.set(sessionId, context);
      }
    }

    return context || null;
  }

  async updateContext(
    sessionId: string, 
    updates: Partial<Context>,
    options: ContextUpdateOptions = {}
  ): Promise<void> {
    const currentContext = await this.getContext(sessionId);
    
    if (!currentContext) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    // Preserve history if requested
    if (options.preserveHistory && currentContext.previousOutput) {
      updates.metadata = {
        ...updates.metadata,
        previousVersions: [
          ...(currentContext.metadata?.previousVersions || []),
          {
            timestamp: currentContext.timestamp,
            stage: currentContext.stage,
            output: currentContext.previousOutput
          }
        ]
      };
    }

    const updatedContext: Context = {
      ...currentContext,
      ...updates,
      timestamp: new Date().toISOString(),
      metadata: {
        ...currentContext.metadata,
        ...updates.metadata,
        lastUpdated: new Date().toISOString()
      }
    };

    // Validate if requested
    if (options.validateSchema) {
      const validation = await this.schemaValidator.validate('context', updatedContext);
      if (!validation.isValid) {
        throw new Error(`Context validation failed: ${validation.errors?.join(', ')}`);
      }
    }

    // Store updates
    await this.redisManager.setContext(sessionId, updatedContext);
    this.activeContexts.set(sessionId, updatedContext);

    // Update metrics if requested
    if (options.updateMetrics) {
      await this.updateContextMetrics(sessionId, updatedContext);
    }

    // Notify subscribers if requested
    if (options.notifySubscribers) {
      await this.notifyContextSubscribers(sessionId, updatedContext);
    }

    logger.info(`Updated context for session ${sessionId}`, {
      stage: updatedContext.stage,
      hasNewInput: !!updates.currentInput,
      hasNewOutput: !!updates.previousOutput
    });
  }

  async deleteContext(sessionId: string): Promise<void> {
    // Remove from local cache
    this.activeContexts.delete(sessionId);
    
    // Remove from Redis
    await this.redisManager.deleteContext(sessionId);
    
    // Clean up related workflow states
    await this.clearWorkflowState(sessionId);

    // Remove subscribers
    this.contextSubscribers.delete(sessionId);

    logger.info(`Deleted context for session ${sessionId}`);
  }

  async advanceStage(
    sessionId: string, 
    nextStage: WorkflowStage,
    stageOutput?: any
  ): Promise<void> {
    const context = await this.getContext(sessionId);
    
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    // Validate stage transition
    if (!this.isValidStageTransition(context.stage as WorkflowStage, nextStage)) {
      throw new Error(`Invalid stage transition: ${context.stage} -> ${nextStage}`);
    }

    // Store current stage output
    if (stageOutput) {
      await this.setWorkflowState(sessionId, context.stage as WorkflowStage, {
        output: stageOutput,
        completedAt: new Date().toISOString(),
        metrics: await this.calculateStageMetrics(stageOutput)
      });
    }

    // Update context with new stage
    await this.updateContext(sessionId, {
      stage: nextStage,
      previousOutput: stageOutput,
      currentInput: undefined // Clear current input for new stage
    }, { 
      preserveHistory: true, 
      updateMetrics: true,
      notifySubscribers: true 
    });

    // Update workflow execution
    const workflowExecution = await this.redisManager.getWorkflowState(sessionId, 'execution') as WorkflowExecution;
    if (workflowExecution) {
      workflowExecution.currentStage = nextStage;
      workflowExecution.executionHistory.push({
        stage: context.stage as WorkflowStage,
        timestamp: new Date().toISOString(),
        duration: Date.now() - new Date(context.timestamp).getTime(),
        result: stageOutput,
        metrics: await this.calculateStageMetrics(stageOutput)
      });
      
      await this.redisManager.setWorkflowState(sessionId, 'execution', workflowExecution);
    }

    logger.info(`Advanced stage for session ${sessionId}`, {
      fromStage: context.stage,
      toStage: nextStage,
      hasOutput: !!stageOutput
    });
  }

  async setStageInput(
    sessionId: string,
    input: any,
    validateInput: boolean = true
  ): Promise<void> {
    if (validateInput) {
      const validation = await this.schemaValidator.validate('stage_input', input);
      if (!validation.isValid) {
        throw new Error(`Invalid stage input: ${validation.errors?.join(', ')}`);
      }
    }

    await this.updateContext(sessionId, {
      currentInput: input
    });
  }

  async getStageHistory(sessionId: string): Promise<any[]> {
    const workflowExecution = await this.redisManager.getWorkflowState(sessionId, 'execution') as WorkflowExecution;
    return workflowExecution?.executionHistory || [];
  }

  async getStageOutput(sessionId: string, stage: WorkflowStage): Promise<any> {
    const stageState = await this.redisManager.getWorkflowState(sessionId, stage);
    return stageState?.output;
  }

  // Context subscription for real-time updates
  async subscribeToContext(sessionId: string, subscriberId: string): Promise<void> {
    if (!this.contextSubscribers.has(sessionId)) {
      this.contextSubscribers.set(sessionId, new Set());
    }
    
    this.contextSubscribers.get(sessionId)!.add(subscriberId);
    logger.debug(`Subscriber ${subscriberId} subscribed to context ${sessionId}`);
  }

  async unsubscribeFromContext(sessionId: string, subscriberId: string): Promise<void> {
    const subscribers = this.contextSubscribers.get(sessionId);
    if (subscribers) {
      subscribers.delete(subscriberId);
      if (subscribers.size === 0) {
        this.contextSubscribers.delete(sessionId);
      }
    }
  }

  private async notifyContextSubscribers(sessionId: string, _context: Context): Promise<void> {
    const subscribers = this.contextSubscribers.get(sessionId);
    if (subscribers && subscribers.size > 0) {
      // In a real implementation, this would send notifications via WebSocket or similar
      logger.debug(`Notifying ${subscribers.size} subscribers of context update for ${sessionId}`);
    }
  }

  private async clearWorkflowState(sessionId: string, stage?: WorkflowStage): Promise<void> {
    if (stage) {
      await this.redisManager.getClient().del(`mcp:workflow:${sessionId}:${stage}`);
    } else {
      // Clear all workflow states for session
      const stages: WorkflowStage[] = ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'];
      await Promise.all(
        stages.map(s => this.redisManager.getClient().del(`mcp:workflow:${sessionId}:${s}`))
      );
    }
  }

  private isValidStageTransition(currentStage: WorkflowStage, nextStage: WorkflowStage): boolean {
    const stageOrder: WorkflowStage[] = [
      'ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'
    ];
    
    const currentIndex = stageOrder.indexOf(currentStage);
    const nextIndex = stageOrder.indexOf(nextStage);
    
    // Allow forward progression or reset to beginning
    return nextIndex === currentIndex + 1 || nextStage === 'ambiguity';
  }

  private async calculateStageMetrics(stageOutput: any): Promise<any> {
    // Calculate basic metrics based on output
    const outputString = JSON.stringify(stageOutput || {});
    
    return {
      completeness: outputString.length > 100 ? 0.8 : 0.4, // Simple heuristic
      clarity: outputString.includes('description') ? 0.9 : 0.6,
      determinism: 0.7, // Default value
      consistency: 0.8, // Default value
      timestamp: Date.now()
    };
  }

  private async updateContextMetrics(sessionId: string, context: Context): Promise<void> {
    const metrics = await this.calculateStageMetrics(context.currentInput);
    
    await this.redisManager.addMetric(
      sessionId, 
      `context_update_${context.stage}`, 
      metrics.completeness
    );
  }

  private async setWorkflowState(sessionId: string, stage: WorkflowStage, state: any): Promise<void> {
    await this.redisManager.setWorkflowState(sessionId, stage, {
      ...state,
      updatedAt: new Date().toISOString(),
      sessionId
    });

    // Update context to reflect current workflow progress
    const context = await this.getContext(sessionId);
    if (context) {
      await this.updateContext(sessionId, {
        metadata: {
          ...context.metadata,
          workflowProgress: {
            ...context.metadata?.workflowProgress,
            [stage]: {
              completed: true,
              completedAt: new Date().toISOString()
            }
          }
        }
      }, { updateMetrics: true });
    }
  }

  // Batch operations for performance
  async getMultipleContexts(sessionIds: string[]): Promise<Map<string, Context | null>> {
    const results = new Map<string, Context | null>();
    
    // Use Redis pipeline for efficiency
    const client = this.redisManager.getClient();
    const pipeline = client.multi();
    
    sessionIds.forEach(sessionId => {
      pipeline.hGetAll(`mcp:context:${sessionId}`);
    });
    
    const pipelineResults = await pipeline.exec();
    
    sessionIds.forEach((sessionId, index) => {
      const contextData = pipelineResults?.[index] as any;
      if (contextData && Object.keys(contextData).length > 0) {
        // Parse context data similar to RedisManager.getContext
        if (contextData.previousOutput) {
          contextData.previousOutput = JSON.parse(contextData.previousOutput);
        }
        if (contextData.currentInput) {
          contextData.currentInput = JSON.parse(contextData.currentInput);
        }
        results.set(sessionId, contextData as Context);
        this.activeContexts.set(sessionId, contextData as Context);
      } else {
        results.set(sessionId, null);
      }
    });
    
    return results;
  }

  // Context search and filtering
  async searchContexts(criteria: {
    stage?: WorkflowStage;
    createdAfter?: Date;
    createdBefore?: Date;
    hasOutput?: boolean;
  }): Promise<Context[]> {
    // This would require implementing search indices in Redis
    // For now, return empty array with a note for future implementation
    logger.info('Context search not fully implemented yet', criteria);
    return [];
  }

  // Health check for context manager
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      activeContexts: number;
      redisConnected: boolean;
      subscriberCount: number;
    };
  }> {
    const redisConnected = await this.redisManager.healthCheck();
    const activeContextCount = this.activeContexts.size;
    const totalSubscribers = Array.from(this.contextSubscribers.values())
      .reduce((total, subscribers) => total + subscribers.size, 0);

    const status = redisConnected && activeContextCount >= 0 ? 'healthy' : 'degraded';

    return {
      status,
      details: {
        activeContexts: activeContextCount,
        redisConnected,
        subscriberCount: totalSubscribers
      }
    };
  }

  async getSessionMetrics(sessionId?: string): Promise<any> {
    if (!sessionId) {
      return [];
    }
    const workflowExecution = await this.redisManager.getWorkflowState(sessionId, 'execution') as WorkflowExecution;
    return workflowExecution?.executionHistory || [];
  }

  async getWorkflowState(sessionId: string, stage?: WorkflowStage): Promise<any> {
    if (!stage) {
      return null;
    }
    const stageState = await this.redisManager.getWorkflowState(sessionId, stage);
    return stageState?.output;
  }

  async validateContextStructure(context: Context): Promise<boolean> {
    const validation = await this.schemaValidator.validate('context', context);
    return validation.isValid;
  }
}
