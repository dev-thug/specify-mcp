import { EventEmitter } from 'events';
import { 
  IExtension, 
  IExtensionRegistry, 
  ExtensionStatus, 
  ExtensionContext, 
  ExtensionEvent, 
  ExtensionConfig,
  ExtensionPackage,
  IExtensionSecurity,
  SecurityAuditResult
} from './extension-interface';
import { 
  MCPRequest, 
  MCPResponse, 
  ValidationResult,
  MCPErrorCodes
} from '../types/mcp.js';
import { RedisManager } from '../config/redis.js';
import { SchemaValidator } from './schema-validator.js';
import { logger } from '../utils/logger.js';
// import { createHash } from 'crypto';

export class ExtensionManager implements IExtensionRegistry {
  private extensions: Map<string, IExtension> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private redisManager: RedisManager;
  // private schemaValidator: SchemaValidator;
  private securityManager: IExtensionSecurity;
  private extensionMetrics: Map<string, ExtensionMetrics> = new Map();

  constructor(
    redisManager: RedisManager, 
    _schemaValidator: SchemaValidator,
    securityManager?: IExtensionSecurity
  ) {
    this.redisManager = redisManager;
    // this.schemaValidator = schemaValidator;
    this.securityManager = securityManager || new DefaultExtensionSecurity();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventEmitter.setMaxListeners(100); // Support many extensions
    
    // Log all extension events
    this.eventEmitter.on('*', (event: ExtensionEvent) => {
      logger.info(`Extension event: ${event.type}`, {
        extension: event.extensionName,
        timestamp: event.timestamp,
        hasData: !!event.data
      });
    });
  }

  async register(extension: IExtension): Promise<void> {
    const name = extension.metadata.name;
    
    try {
      // Validate extension
      const validation = await this.validateExtension(extension);
      if (!validation.isValid) {
        throw new Error(`Extension validation failed: ${validation.errors?.join(', ')}`);
      }

      // Security audit
      const auditResult = await this.securityManager.auditExtension(extension);
      if (!auditResult.passed) {
        const criticalIssues = auditResult.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          throw new Error(`Extension security audit failed: ${criticalIssues.map(i => i.description).join(', ')}`);
        }
      }

      // Check for conflicts
      if (this.extensions.has(name)) {
        const existing = this.extensions.get(name)!;
        if (existing.metadata.version !== extension.metadata.version) {
          await this.unregister(name); // Remove old version
        } else {
          throw new Error(`Extension '${name}' is already registered`);
        }
      }

      // Initialize extension metrics
      this.extensionMetrics.set(name, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalExecutionTime: 0,
        lastRequestTime: 0,
        registrationTime: Date.now(),
        memoryUsage: 0
      });

      // Store in registry
      this.extensions.set(name, extension);
      extension.status = 'inactive';

      // Persist to Redis
      await this.persistExtensionToRedis(extension);

      // Install lifecycle hook
      if (extension.onInstall) {
        const context = await this.createExtensionContext(name);
        await extension.onInstall(context);
      }

      // Emit registration event
      this.emitEvent('extension.registered', name, {
        metadata: extension.metadata,
        capabilities: extension.getCapabilities()
      });

      logger.info(`Extension '${name}' registered successfully`, {
        version: extension.metadata.version,
        capabilities: extension.getCapabilities().length
      });

    } catch (error) {
      logger.error(`Failed to register extension '${name}':`, error);
      throw error;
    }
  }

  async unregister(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension '${name}' not found`);
    }

    try {
      // Deactivate if active
      if (extension.status === 'active') {
        await this.deactivate(name);
      }

      // Uninstall lifecycle hook
      if (extension.onUninstall) {
        const context = await this.createExtensionContext(name);
        await extension.onUninstall(context);
      }

      // Remove from registry
      this.extensions.delete(name);
      this.extensionMetrics.delete(name);

      // Remove from Redis
      const client = this.redisManager.getClient();
      await client.hDel('mcp:plugin:registry', name);
      await client.del(`mcp:extension:${name}:config`);
      await client.del(`mcp:extension:${name}:metrics`);

      // Emit unregistration event
      this.emitEvent('extension.unregistered', name, {
        metadata: extension.metadata
      });

      logger.info(`Extension '${name}' unregistered successfully`);

    } catch (error) {
      logger.error(`Failed to unregister extension '${name}':`, error);
      throw error;
    }
  }

  async activate(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension '${name}' not found`);
    }

    if (extension.status === 'active') {
      return; // Already active
    }

    try {
      extension.status = 'initializing';
      
      // Check permissions
      const hasPermission = await this.securityManager.checkPermissions(extension, 'activate');
      if (!hasPermission) {
        throw new Error(`Insufficient permissions to activate extension '${name}'`);
      }

      // Activate lifecycle hook
      if (extension.onActivate) {
        const context = await this.createExtensionContext(name);
        const result = await this.executeWithTimeout(
          () => extension.onActivate!(context),
          extension.config.timeout || 30000
        );
        
        if (!result.success) {
          throw new Error(`Extension activation failed: ${result.error}`);
        }
      }

      extension.status = 'active';

      // Register capabilities
      const capabilities = extension.getCapabilities();
      for (const capability of capabilities) {
        await this.redisManager.addCapability(capability.name);
      }

      // Update metrics
      const metrics = this.extensionMetrics.get(name)!;
      metrics.lastActivationTime = Date.now();

      // Emit activation event
      this.emitEvent('extension.activated', name, {
        capabilities: capabilities.map(c => c.name)
      });

      logger.info(`Extension '${name}' activated successfully`, {
        capabilities: capabilities.length
      });

    } catch (error) {
      extension.status = 'error';
      logger.error(`Failed to activate extension '${name}':`, error);
      throw error;
    }
  }

  async deactivate(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension '${name}' not found`);
    }

    if (extension.status !== 'active') {
      return; // Not active
    }

    try {
      // Deactivate lifecycle hook
      if (extension.onDeactivate) {
        const context = await this.createExtensionContext(name);
        await extension.onDeactivate(context);
      }

      extension.status = 'inactive';

      // Unregister capabilities
      const capabilities = extension.getCapabilities();
      const client = this.redisManager.getClient();
      for (const capability of capabilities) {
        await client.sRem('mcp:capabilities', capability.name);
      }

      // Emit deactivation event
      this.emitEvent('extension.deactivated', name, {
        capabilities: capabilities.map(c => c.name)
      });

      logger.info(`Extension '${name}' deactivated successfully`);

    } catch (error) {
      extension.status = 'error';
      logger.error(`Failed to deactivate extension '${name}':`, error);
      throw error;
    }
  }

  async reload(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension '${name}' not found`);
    }

    const wasActive = extension.status === 'active';

    // Deactivate if active
    if (wasActive) {
      await this.deactivate(name);
    }

    // Reload configuration
    const config = await this.loadExtensionConfig(name);
    if (config) {
      extension.config = config;
      
      if (extension.onConfigUpdate) {
        const context = await this.createExtensionContext(name);
        await extension.onConfigUpdate(config, context);
      }
    }

    // Reactivate if it was active
    if (wasActive) {
      await this.activate(name);
    }

    this.emitEvent('extension.reloaded', name, { config });
    logger.info(`Extension '${name}' reloaded successfully`);
  }

  async execute(name: string, request: MCPRequest): Promise<MCPResponse> {
    const extension = this.extensions.get(name);
    if (!extension) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.METHOD_NOT_FOUND,
        `Extension '${name}' not found`
      );
    }

    if (extension.status !== 'active') {
      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.SERVER_ERROR,
        `Extension '${name}' is not active (status: ${extension.status})`
      );
    }

    const startTime = Date.now();
    const metrics = this.extensionMetrics.get(name)!;
    
    try {
      // Create execution context
      const context = await this.createExtensionContext(name, request.id.toString());
      
      // Execute with timeout
      const response = await this.executeWithTimeout(
        () => extension.execute(request, context),
        extension.config.timeout || 30000
      );

      // Update success metrics
      const executionTime = Date.now() - startTime;
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.totalExecutionTime += executionTime;
      metrics.lastRequestTime = Date.now();

      // Emit execution event
      this.emitEvent('extension.executed', name, {
        requestId: request.id,
        executionTime,
        success: true
      });

      if ('result' in response) {
        return response as MCPResponse;
      } else {
        // Convert ExtensionResult to MCPResponse
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: response
        };
      }

    } catch (error) {
      // Update error metrics
      const executionTime = Date.now() - startTime;
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.totalExecutionTime += executionTime;
      metrics.lastRequestTime = Date.now();

      // Handle extension errors
      if (extension.onError) {
        const context = await this.createExtensionContext(name, request.id.toString());
        await extension.onError(error as Error, context);
      }

      // Emit error event
      this.emitEvent('extension.error', name, {
        requestId: request.id,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error(`Extension '${name}' execution failed:`, error);

      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.SERVER_ERROR,
        `Extension execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Discovery methods
  async find(name: string): Promise<IExtension | null> {
    return this.extensions.get(name) || null;
  }

  async findByCapability(capability: string): Promise<IExtension[]> {
    const results: IExtension[] = [];
    
    for (const extension of this.extensions.values()) {
      const capabilities = extension.getCapabilities();
      if (capabilities.some(cap => cap.name === capability)) {
        results.push(extension);
      }
    }
    
    return results;
  }

  async list(): Promise<IExtension[]> {
    return Array.from(this.extensions.values());
  }

  async getStatus(name: string): Promise<ExtensionStatus> {
    const extension = this.extensions.get(name);
    return extension ? extension.status : 'inactive';
  }

  async getMetrics(name?: string): Promise<Record<string, any>> {
    if (name) {
      const extension = this.extensions.get(name);
      const metrics = this.extensionMetrics.get(name);
      
      if (!extension || !metrics) {
        throw new Error(`Extension '${name}' not found`);
      }

      const extensionMetrics = await extension.getMetrics();
      
      return {
        ...extensionMetrics,
        internal: metrics
      };
    } else {
      // Return aggregate metrics for all extensions
      const allMetrics: Record<string, any> = {};
      
      for (const [extensionName, metrics] of this.extensionMetrics.entries()) {
        const extension = this.extensions.get(extensionName);
        if (extension) {
          allMetrics[extensionName] = {
            status: extension.status,
            metrics: await extension.getMetrics(),
            internal: metrics
          };
        }
      }
      
      return allMetrics;
    }
  }

  // Event subscription
  subscribe(callback: (event: ExtensionEvent) => void): void {
    this.eventEmitter.on('*', callback);
  }

  unsubscribe(callback: (event: ExtensionEvent) => void): void {
    this.eventEmitter.off('*', callback);
  }

  // Extension validation
  async validateExtension(extension: IExtension): Promise<ValidationResult> {
    const errors: string[] = [];
    
    // Validate metadata
    if (!extension.metadata.name || extension.metadata.name.length === 0) {
      errors.push('Extension name is required');
    }
    
    if (!extension.metadata.version || extension.metadata.version.length === 0) {
      errors.push('Extension version is required');
    }

    // Validate capabilities
    try {
      const capabilities = extension.getCapabilities();
      for (const capability of capabilities) {
        if (!capability.name || !capability.description) {
          errors.push(`Invalid capability definition: ${JSON.stringify(capability)}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to get extension capabilities: ${error}`);
    }

    // Health check
    try {
      const health = await extension.healthCheck();
      if (health.status === 'unhealthy') {
        errors.push('Extension health check failed');
      }
    } catch (error) {
      errors.push(`Extension health check error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Utility methods
  private async createExtensionContext(extensionName: string, requestId?: string): Promise<ExtensionContext> {
    const sessionId = requestId || 'system';
    
    return {
      sessionId,
      requestId: requestId || `ext-${Date.now()}`,
      timestamp: new Date().toISOString(),
      environment: (process.env.NODE_ENV as any) || 'development',
      capabilities: await this.redisManager.getCapabilities(),
      metadata: {
        extensionName,
        managerId: 'mcp-extension-manager'
      }
    };
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

  private async persistExtensionToRedis(extension: IExtension): Promise<void> {
    const extensionData = {
      metadata: extension.metadata,
      config: extension.config,
      status: extension.status,
      capabilities: extension.getCapabilities(),
      registrationTime: Date.now()
    };

    await this.redisManager.registerPlugin(
      extension.metadata.name,
      extensionData
    );
  }

  private async loadExtensionConfig(name: string): Promise<ExtensionConfig | null> {
    const client = this.redisManager.getClient();
    const configData = await client.get(`mcp:extension:${name}:config`);
    
    return configData ? JSON.parse(configData) : null;
  }

  private emitEvent(type: string, extensionName: string, data?: any): void {
    const event: ExtensionEvent = {
      type,
      extensionName,
      timestamp: new Date().toISOString(),
      data
    };

    this.eventEmitter.emit('*', event);
    this.eventEmitter.emit(type, event);
  }

  private createErrorResponse(id: string | number, code: number, message: string): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message }
    };
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down extension manager...');
    
    const extensions = Array.from(this.extensions.keys());
    for (const name of extensions) {
      try {
        await this.deactivate(name);
        await this.unregister(name);
      } catch (error) {
        logger.error(`Error shutting down extension '${name}':`, error);
      }
    }

    this.eventEmitter.removeAllListeners();
    logger.info('Extension manager shutdown complete');
  }
}

// Extension metrics interface
interface ExtensionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalExecutionTime: number;
  lastRequestTime: number;
  registrationTime: number;
  lastActivationTime?: number;
  memoryUsage: number;
}

// Default security manager implementation
class DefaultExtensionSecurity implements IExtensionSecurity {
  async validatePackage(pkg: ExtensionPackage): Promise<ValidationResult> {
    // Basic validation - in production, implement proper security checks
    const errors: string[] = [];

    if (!pkg.manifest || !pkg.manifest.metadata) {
      errors.push('Invalid package manifest');
    }

    if (!pkg.code) {
      errors.push('Package code is missing');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  sanitizeConfig(config: ExtensionConfig): ExtensionConfig {
    // Remove potentially dangerous configuration options
    return {
      ...config,
      settings: this.sanitizeSettings(config.settings || {})
    };
  }

  async checkPermissions(_extension: IExtension, _operation: string): Promise<boolean> {
    // Basic permission check - implement proper RBAC in production
    return true;
  }

  async auditExtension(_extension: IExtension): Promise<SecurityAuditResult> {
    // Basic security audit - implement comprehensive checks in production
    return {
      passed: true,
      issues: [],
      score: 100
    };
  }

  private sanitizeSettings(settings: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(settings)) {
      // Remove dangerous keys
      if (!key.includes('password') && !key.includes('secret') && !key.includes('token')) {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}
