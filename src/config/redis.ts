import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  url?: string | undefined;
}

export class RedisManager {
  private client: RedisClientType;
  // private config: RedisConfig;
  private connected: boolean = false;

  constructor(config: RedisConfig) {
    // this.config = config;
    this.client = createClient({
      url: config.url || `redis://${config.host}:${config.port}`,
      ...(config.password && { password: config.password }),
      database: config.db,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 500)
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.connected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis connection ended');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.initializeSchema();
      logger.info('Redis connected and schema initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  private async initializeSchema(): Promise<void> {
    // Initialize default capabilities
    await this.client.sAdd('mcp:capabilities', [
      'context_update',
      'schema_validate',
      'workflow_execute',
      'plugin_register'
    ]);

    // Set cache structure metadata
    const cacheStructure = {
      keyPatterns: {
        context: 'mcp:context:{sessionId}',
        capabilities: 'mcp:capabilities',
        workflow: 'mcp:workflow:{sessionId}:{stage}',
        llmCache: 'mcp:llm:cache:{hash}',
        metrics: 'mcp:metrics:{sessionId}',
        sessionMeta: 'mcp:session:{sessionId}:meta',
        pluginRegistry: 'mcp:plugin:registry'
      },
      expirationPolicy: {
        context: 86400, // 24 hours
        llmCache: 604800, // 7 days
        workflowState: 3600, // 1 hour
        metrics: 2592000 // 30 days
      }
    };

    await this.client.setEx(
      'mcp:schema:structure',
      2592000, // 30 days
      JSON.stringify(cacheStructure)
    );

    logger.info('Redis schema initialized successfully');
  }

  // Context Management Methods
  async setContext(sessionId: string, context: any): Promise<void> {
    const key = `mcp:context:${sessionId}`;
    await this.client.hSet(key, {
      stage: context.stage || 'initial',
      previousOutput: JSON.stringify(context.previousOutput || {}),
      currentInput: JSON.stringify(context.currentInput || {}),
      timestamp: new Date().toISOString(),
      ...context
    });
    await this.client.expire(key, 86400); // 24 hours
  }

  async getContext(sessionId: string): Promise<any | null> {
    const key = `mcp:context:${sessionId}`;
    const context = await this.client.hGetAll(key);
    
    if (Object.keys(context).length === 0) {
      return null;
    }

    // Parse JSON strings back to objects
    if (context.previousOutput) {
      context.previousOutput = JSON.parse(context.previousOutput);
    }
    if (context.currentInput) {
      context.currentInput = JSON.parse(context.currentInput);
    }

    return context;
  }

  async deleteContext(sessionId: string): Promise<void> {
    const key = `mcp:context:${sessionId}`;
    await this.client.del(key);
  }

  // Workflow State Management
  async setWorkflowState(sessionId: string, stage: string, state: any): Promise<void> {
    const key = `mcp:workflow:${sessionId}:${stage}`;
    await this.client.setEx(key, 3600, JSON.stringify(state)); // 1 hour
  }

  async getWorkflowState(sessionId: string, stage: string): Promise<any | null> {
    const key = `mcp:workflow:${sessionId}:${stage}`;
    const state = await this.client.get(key);
    return state ? JSON.parse(state) : null;
  }

  // LLM Cache Management
  async setCachedLLMResponse(hash: string, response: any): Promise<void> {
    const key = `mcp:llm:cache:${hash}`;
    await this.client.setEx(key, 604800, JSON.stringify(response)); // 7 days
  }

  async getCachedLLMResponse(hash: string): Promise<any | null> {
    const key = `mcp:llm:cache:${hash}`;
    const response = await this.client.get(key);
    return response ? JSON.parse(response) : null;
  }

  // Capabilities Management
  async addCapability(capability: string): Promise<void> {
    await this.client.sAdd('mcp:capabilities', capability);
  }

  async getCapabilities(): Promise<string[]> {
    return await this.client.sMembers('mcp:capabilities');
  }

  async hasCapability(capability: string): Promise<boolean> {
    return await this.client.sIsMember('mcp:capabilities', capability);
  }

  // Metrics Management
  async addMetric(sessionId: string, metric: string, value: number, timestamp?: number): Promise<void> {
    const key = `mcp:metrics:${sessionId}`;
    const score = timestamp || Date.now();
    await this.client.zAdd(key, { score, value: `${metric}:${value}` });
    await this.client.expire(key, 2592000); // 30 days
  }

  async getMetrics(sessionId: string, start?: number, end?: number): Promise<any[]> {
    const key = `mcp:metrics:${sessionId}`;
    const metrics = await this.client.zRangeByScoreWithScores(key, start || 0, end || '+inf');

    return metrics.map(item => {
      const [metric, value] = item.value.split(':');
      return {
        metric,
        value: parseFloat(value),
        timestamp: item.score
      };
    });
  }

  // Plugin Registry Management
  async registerPlugin(name: string, config: any): Promise<void> {
    await this.client.hSet('mcp:plugin:registry', name, JSON.stringify(config));
  }

  async getRegisteredPlugins(): Promise<Record<string, any>> {
    const plugins = await this.client.hGetAll('mcp:plugin:registry');
    const result: Record<string, any> = {};
    
    for (const [name, config] of Object.entries(plugins)) {
      result[name] = JSON.parse(config);
    }
    
    return result;
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Getter for client (for advanced operations)
  getClient(): RedisClientType {
    return this.client;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
