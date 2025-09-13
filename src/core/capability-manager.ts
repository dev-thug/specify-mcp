import { 
  CapabilityDefinition 
} from '../types/mcp.js';
// import { MCPResponse } from '../types/mcp.js'; // unused
import { RedisManager } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export class CapabilityManager {
  private capabilities: Map<string, CapabilityDefinition> = new Map();
  private redisManager: RedisManager;

  constructor(redisManager: RedisManager) {
    this.redisManager = redisManager;
    this.initializeDefaultCapabilities();
  }

  private initializeDefaultCapabilities(): void {
    const defaultCapabilities: CapabilityDefinition[] = [
      {
        name: 'context_update',
        description: 'Update and manage conversation context state',
        version: '1.0.0',
        parameters: {
          sessionId: { type: 'string', required: true },
          context: { type: 'object', required: true }
        },
        metadata: {
          category: 'core',
          requiresAuth: false
        }
      },
      {
        name: 'schema_validate',
        description: 'Validate data against predefined schemas',
        version: '1.0.0',
        parameters: {
          schema: { type: 'string', required: true },
          data: { type: 'object', required: true }
        },
        metadata: {
          category: 'validation',
          requiresAuth: false
        }
      },
      {
        name: 'workflow_execute',
        description: 'Execute AI-SDD workflow stages',
        version: '1.0.0',
        parameters: {
          stage: { type: 'string', enum: ['ambiguity', 'specification', 'planning', 'tasking', 'verification', 'evolution'] },
          input: { type: 'object', required: true },
          sessionId: { type: 'string', required: true }
        },
        metadata: {
          category: 'workflow',
          requiresAuth: true
        }
      },
      {
        name: 'plugin_register',
        description: 'Register and manage server plugins',
        version: '1.0.0',
        parameters: {
          name: { type: 'string', required: true },
          config: { type: 'object', required: true }
        },
        metadata: {
          category: 'extension',
          requiresAuth: true
        }
      },
      {
        name: 'tool_call',
        description: 'Execute registered tools',
        version: '1.0.0',
        parameters: {
          toolName: { type: 'string', required: true },
          parameters: { type: 'object' }
        },
        metadata: {
          category: 'tools',
          requiresAuth: true
        }
      },
      {
        name: 'resource_access',
        description: 'Access server resources and files',
        version: '1.0.0',
        parameters: {
          uri: { type: 'string', required: true },
          operation: { type: 'string', enum: ['read', 'write', 'list'] }
        },
        metadata: {
          category: 'resources',
          requiresAuth: true
        }
      },
      {
        name: 'prompt_engineering',
        description: 'Advanced prompt template management',
        version: '1.0.0',
        parameters: {
          templateName: { type: 'string', required: true },
          variables: { type: 'object' }
        },
        metadata: {
          category: 'prompts',
          requiresAuth: false
        }
      }
    ];

    defaultCapabilities.forEach(capability => {
      this.capabilities.set(capability.name, capability);
    });

    logger.info(`Initialized ${defaultCapabilities.length} default capabilities`);
  }

  async negotiateCapabilities(clientCapabilities: CapabilityDefinition[], _serverCapabilities?: CapabilityDefinition[]): Promise<CapabilityDefinition[]> {
    try {
      // Filter available capabilities based on client request
      const availableCapabilities: CapabilityDefinition[] = [];
      const unsupportedCapabilities: string[] = [];

      for (const requestedCapability of clientCapabilities) {
        const capability = this.capabilities.get(requestedCapability.name);
        if (capability) {
          availableCapabilities.push(capability);
        } else {
          unsupportedCapabilities.push(requestedCapability.name);
        }
      }

      return availableCapabilities;
    } catch (error) {
      logger.error('Capability negotiation failed:', error);
      throw error;
    }
  }

  async addCapability(capability: CapabilityDefinition): Promise<void> {
    // Validate capability definition
    if (!capability.name || !capability.description || !capability.version) {
      throw new Error('Invalid capability definition: missing required fields');
    }

    this.capabilities.set(capability.name, capability);
    
    // Persist to Redis
    await this.redisManager.addCapability(capability.name);
    await this.redisManager.registerPlugin(capability.name, capability);

    logger.info(`Added new capability: ${capability.name} v${capability.version}`);
  }

  async removeCapability(name: string): Promise<boolean> {
    const removed = this.capabilities.delete(name);
    
    if (removed) {
      // Remove from Redis (we'll need to implement this in RedisManager)
      const client = this.redisManager.getClient();
      await client.sRem('mcp:capabilities', name);
      await client.hDel('mcp:plugin:registry', name);
      
      logger.info(`Removed capability: ${name}`);
    }
    
    return removed;
  }

  getCapability(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  getAllCapabilities(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  getCapabilityNames(): string[] {
    return Array.from(this.capabilities.keys());
  }

  hasCapability(name: string): boolean {
    return this.capabilities.has(name);
  }

  async validateCapabilityAccess(
    capabilityName: string, 
    sessionId: string,
    userAuth?: any
  ): Promise<boolean> {
    const capability = this.getCapability(capabilityName);
    
    if (!capability) {
      return false;
    }

    // Check if capability requires authentication
    if (capability.metadata?.requiresAuth && !userAuth) {
      return false;
    }

    // Check session context for negotiated capabilities
    const context = await this.redisManager.getContext(sessionId);
    if (context?.negotiatedCapabilities) {
      return context.negotiatedCapabilities.includes(capabilityName);
    }

    // Default to allow if no session context (for initial negotiation)
    return true;
  }

  async getCapabilityUsageMetrics(capabilityName: string): Promise<any> {
    // Get usage metrics from Redis
    const metrics = await this.redisManager.getMetrics(`capability:${capabilityName}`);
    
    return {
      name: capabilityName,
      totalCalls: metrics.length,
      recentCalls: metrics.filter(m => 
        m.timestamp > Date.now() - 24 * 60 * 60 * 1000
      ).length,
      averageExecutionTime: metrics.reduce((sum, m) => 
        sum + (m.value || 0), 0
      ) / metrics.length || 0
    };
  }

  negotiate = this.negotiateCapabilities;

  // private createErrorResponse method removed - unused

  // Dynamic capability loading support
  async loadCapabilitiesFromConfig(_configPath?: string): Promise<void> {
    // This could load capabilities from a configuration file
    // For now, we'll skip implementation but provide the interface
    logger.info('Dynamic capability loading not implemented yet');
  }

  // Hot-reloading capability updates
  async refreshCapabilities(): Promise<void> {
    // Reload capabilities from Redis registry
    const registeredPlugins = await this.redisManager.getRegisteredPlugins();
    
    for (const [name, config] of Object.entries(registeredPlugins)) {
      if (this.isValidCapabilityConfig(config)) {
        this.capabilities.set(name, config as CapabilityDefinition);
      }
    }

    logger.info(`Refreshed capabilities from registry: ${Object.keys(registeredPlugins).length} plugins`);
  }

  private isValidCapabilityConfig(config: any): boolean {
    return config && 
           typeof config.name === 'string' && 
           typeof config.description === 'string' && 
           typeof config.version === 'string';
  }
}
