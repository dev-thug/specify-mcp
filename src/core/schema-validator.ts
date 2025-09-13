import { z } from 'zod';
import { 
  MCPRequestSchema,
  MCPResponseSchema,
  MCPNotificationSchema,
  ContextSchema,
  ValidationResult,
  MCPErrorCodes
} from '../types/mcp.js';
import {
  AmbiguityResolutionSchema,
  SpecificationSchema,
  PlanSchema,
  TaskListSchema,
  VerificationResultSchema,
  StageInputSchema,
  StageOutputSchema
} from '../types/workflow.js';
import { logger } from '../utils/logger.js';

export class SchemaValidator {
  private schemas: Map<string, z.ZodSchema> = new Map();

  constructor() {
    this.initializeSchemas();
  }

  private initializeSchemas(): void {
    // Core MCP schemas
    this.schemas.set('mcp_request', MCPRequestSchema);
    this.schemas.set('mcp_response', MCPResponseSchema);
    this.schemas.set('mcp_notification', MCPNotificationSchema);
    this.schemas.set('context', ContextSchema);

    // Workflow-specific schemas
    this.schemas.set('ambiguity_resolution', AmbiguityResolutionSchema);
    this.schemas.set('specification', SpecificationSchema);
    this.schemas.set('plan', PlanSchema);
    this.schemas.set('task_list', TaskListSchema);
    this.schemas.set('verification_result', VerificationResultSchema);
    this.schemas.set('stage_input', StageInputSchema);
    this.schemas.set('stage_output', StageOutputSchema);

    // Method-specific parameter schemas
    this.schemas.set('negotiate_params', z.object({
      capabilities: z.array(z.string()),
      sessionId: z.string().optional()
    }));

    this.schemas.set('context_update_params', z.object({
      sessionId: z.string(),
      context: z.record(z.any()),
      stage: z.string().optional()
    }));

    this.schemas.set('workflow_execute_params', z.object({
      stage: z.enum(['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution']),
      input: z.any(),
      sessionId: z.string(),
      options: z.record(z.any()).optional()
    }));

    this.schemas.set('plugin_register_params', z.object({
      name: z.string(),
      config: z.object({
        version: z.string(),
        enabled: z.boolean().default(true),
        capabilities: z.array(z.string()),
        configuration: z.record(z.any()).optional()
      })
    }));

    this.schemas.set('tool_call_params', z.object({
      toolName: z.string(),
      parameters: z.record(z.any()).optional(),
      sessionId: z.string().optional()
    }));

    this.schemas.set('resource_access_params', z.object({
      uri: z.string(),
      operation: z.enum(['read', 'write', 'list', 'delete']),
      data: z.any().optional()
    }));

    this.schemas.set('prompt_engineering_params', z.object({
      templateName: z.string(),
      variables: z.record(z.any()).optional(),
      options: z.object({
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().positive().optional(),
        model: z.string().optional()
      }).optional()
    }));

    logger.info(`Initialized ${this.schemas.size} validation schemas`);
  }

  async validate(schemaName: string, data: any): Promise<ValidationResult> {
    const timer = logger.child({ operation: 'schema_validation' });
    const startTime = Date.now();

    try {
      const schema = this.schemas.get(schemaName);
      
      if (!schema) {
        return {
          isValid: false,
          errors: [`Schema '${schemaName}' not found`],
          metrics: {
            completeness: 0,
            clarity: 0,
            determinism: 0,
            consistency: 0,
            validationTime: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }

      // Perform validation
      const result = schema.safeParse(data);
      
      if (result.success) {
        const validationTime = Date.now() - startTime;
        timer.info(`Schema validation successful for '${schemaName}'`, { 
          validationTime,
          dataSize: JSON.stringify(data).length 
        });

        return {
          isValid: true,
          metrics: {
            completeness: 1,
            clarity: 1,
            determinism: 1,
            consistency: 1,
            validationTime,
            timestamp: Date.now()
          }
        };
      } else {
        const errors = result.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );

        timer.warn(`Schema validation failed for '${schemaName}'`, { 
          errors,
          validationTime: Date.now() - startTime 
        });

        return {
          isValid: false,
          errors,
          metrics: {
            completeness: 0,
            clarity: 0,
            determinism: 0,
            consistency: 0,
            validationTime: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }
    } catch (error) {
      const validationTime = Date.now() - startTime;
      timer.error(`Schema validation error for '${schemaName}':`, error);
      
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metrics: {
          completeness: 0,
          clarity: 0,
          determinism: 0,
          consistency: 0,
          validationTime,
          timestamp: Date.now()
        }
      };
    }
  }

  async validateMCPMessage(message: any): Promise<ValidationResult> {
    // Determine message type and validate accordingly
    let schemaName: string;
    
    if (message.id !== undefined && message.method !== undefined) {
      schemaName = 'mcp_request';
    } else if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      schemaName = 'mcp_response';
    } else if (message.method !== undefined && message.id === undefined) {
      schemaName = 'mcp_notification';
    } else {
      return {
        isValid: false,
        errors: ['Unable to determine MCP message type'],
        metrics: {
          completeness: 0,
          clarity: 0,
          determinism: 0,
          consistency: 0,
          validationTime: 0,
          timestamp: Date.now()
        }
      };
    }

    return await this.validate(schemaName, message);
  }

  async validateMethodParameters(method: string, params: any): Promise<ValidationResult> {
    const schemaName = `${method}_params`;
    return await this.validate(schemaName, params);
  }

  registerSchema(name: string, schema: z.ZodSchema): void {
    this.schemas.set(name, schema);
    logger.info(`Registered new schema: ${name}`);
  }

  unregisterSchema(name: string): boolean {
    const removed = this.schemas.delete(name);
    if (removed) {
      logger.info(`Unregistered schema: ${name}`);
    }
    return removed;
  }

  getAvailableSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  // Batch validation for multiple items
  async validateBatch(items: Array<{ schemaName: string; data: any }>): Promise<ValidationResult[]> {
    const results = await Promise.all(
      items.map(item => this.validate(item.schemaName, item.data))
    );

    // const overallValid = results.every(result => result.isValid);
    // const totalErrors = results.reduce((acc, result) => 
    //   acc.concat(result.errors || []), [] as string[]
    // );

    logger.info(`Batch validation completed`, {
      totalItems: items.length,
      validItems: results.filter(r => r.isValid).length,
      invalidItems: results.filter(r => !r.isValid).length
    });

    return results;
  }

  // Validate with transformation
  async validateAndTransform<T>(schemaName: string, data: any): Promise<{ 
    isValid: boolean; 
    data?: T; 
    errors?: string[]; 
    warnings?: string[];
  }> {
    const schema = this.schemas.get(schemaName);
    
    if (!schema) {
      return {
        isValid: false,
        errors: [`Schema '${schemaName}' not found`]
      };
    }

    try {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return {
          isValid: true,
          data: result.data as T
        };
      } else {
        const errors = result.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );
        
        return {
          isValid: false,
          errors
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  // Middleware for Express.js
  createValidationMiddleware(schemaName: string) {
    return async (req: any, res: any, next: any) => {
      const validation = await this.validate(schemaName, req.body);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
          errorCode: MCPErrorCodes.VALIDATION_FAILED
        });
      }
      
      next();
    };
  }

  // Create validation middleware for MCP method parameters
  createMethodValidationMiddleware(method: string) {
    return this.createValidationMiddleware(`${method}_params`);
  }

  // Validate nested objects recursively
  async validateNested(schemaMap: Record<string, string>, data: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalValidationTime = 0;

    for (const [key, schemaName] of Object.entries(schemaMap)) {
      if (data[key] !== undefined) {
        const result = await this.validate(schemaName, data[key]);
        totalValidationTime += result.metrics?.validationTime || 0;
        
        if (!result.isValid) {
          errors.push(...(result.errors || []).map(err => `${key}.${err}`));
        }
        
        if (result.warnings) {
          warnings.push(...result.warnings.map(warn => `${key}.${warn}`));
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metrics: {
        completeness: errors.length === 0 ? 1 : 0,
        clarity: 1,
        determinism: 1,
        consistency: 1,
        validationTime: totalValidationTime,
        timestamp: Date.now()
      }
    };
  }

  // Get validation statistics
  getValidationStats(): {
    totalSchemas: number;
    schemaNames: string[];
    lastValidationTime?: number;
  } {
    return {
      totalSchemas: this.schemas.size,
      schemaNames: Array.from(this.schemas.keys())
    };
  }

  // Create custom error response with validation details
  createValidationError(requestId: string | number, validation: ValidationResult) {
    return {
      jsonrpc: '2.0' as const,
      id: requestId,
      error: {
        code: MCPErrorCodes.VALIDATION_FAILED,
        message: 'Request validation failed',
        data: {
          errors: validation.errors,
          warnings: validation.warnings,
          metrics: validation.metrics
        }
      }
    };
  }
}
