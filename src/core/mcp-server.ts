import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { 
  MCPRequest, 
  MCPResponse, 
  // MCPNotification, // unused 
  MCPErrorCodes,
  ServerInfo
} from '../types/mcp.js';
import { HealthCheckResult } from '../types/index.js';
import { RedisManager, RedisConfig } from '../config/redis.js';
import { CapabilityManager } from './capability-manager.js';
import { SchemaValidator } from './schema-validator.js';
import { ContextManager } from './context-manager.js';
import { logger, addRequestId } from '../utils/logger.js';
import { mcpConfig } from '../config/environment.js';
import { v4 as uuidv4 } from 'uuid';

export interface MCPServerConfig {
  port: number;
  host: string;
  enableWebSocket: boolean;
  enableCors: boolean;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
}

export class MCPServer {
  private app: Express;
  private server: Server;
  private wsServer?: WebSocketServer;
  private redisManager: RedisManager;
  private capabilityManager: CapabilityManager;
  private schemaValidator: SchemaValidator;
  private contextManager: ContextManager;
  private config: MCPServerConfig;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private activeConnections: Set<WebSocket> = new Set();

  constructor(config: MCPServerConfig, redisConfig: RedisConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    
    // Initialize core components
    this.redisManager = new RedisManager(redisConfig);
    this.capabilityManager = new CapabilityManager(this.redisManager);
    this.schemaValidator = new SchemaValidator();
    this.contextManager = new ContextManager(this.redisManager, this.schemaValidator);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS middleware
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://yourdomain.com'] 
          : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true
      }));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging and ID injection
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = uuidv4();
      req.headers['x-request-id'] = requestId;
      
      const requestLogger = addRequestId(requestId);
      requestLogger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
      });

      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Rate limiting (basic implementation)
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || 'unknown';
      const now = Date.now();
      const windowMs = this.config.rateLimiting.windowMs;
      const maxRequests = this.config.rateLimiting.maxRequests;

      const clientData = requestCounts.get(clientIp);
      if (!clientData || now > clientData.resetTime) {
        requestCounts.set(clientIp || 'unknown', { count: 1, resetTime: now + windowMs });
        next();
      } else {
        clientData.count++;
        if (clientData.count > maxRequests) {
          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            errorCode: MCPErrorCodes.SERVER_ERROR
          });
        } else {
          next();
        }
      }
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));
    
    // Server info endpoint
    this.app.get('/info', this.handleServerInfo.bind(this));

    // Main MCP endpoints
    this.app.post('/mcp', this.handleMCPRequest.bind(this));
    this.app.post('/mcp/negotiate', this.handleCapabilityNegotiation.bind(this));
    this.app.post('/mcp/context', this.handleContextUpdate.bind(this));
    this.app.get('/mcp/context/:sessionId', this.handleGetContext.bind(this));
    this.app.delete('/mcp/context/:sessionId', this.handleDeleteContext.bind(this));
    
    // Workflow endpoints
    this.app.post('/mcp/workflow/execute', this.handleWorkflowExecution.bind(this));
    this.app.get('/mcp/workflow/:sessionId/history', this.handleGetWorkflowHistory.bind(this));
    
    // Plugin endpoints
    this.app.post('/mcp/plugins/register', this.handlePluginRegistration.bind(this));
    this.app.get('/mcp/plugins', this.handleGetPlugins.bind(this));
    
    // Metrics endpoints
    this.app.get('/mcp/metrics/:sessionId', this.handleGetMetrics.bind(this));
    
    // 404 handler
    this.app.use('*', (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        errorCode: MCPErrorCodes.METHOD_NOT_FOUND
      });
    });
  }

  private setupWebSocket(): void {
    if (!this.config.enableWebSocket) return;

    this.wsServer = new WebSocketServer({ server: this.server });
    
    this.wsServer.on('connection', (ws: WebSocket, req) => {
      const sessionId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('sessionId');
      
      logger.info('WebSocket connection established', { sessionId, ip: req.socket.remoteAddress });
      
      this.activeConnections.add(ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          const response = await this.processMCPMessage(message);
          ws.send(JSON.stringify(response));
        } catch (error) {
          logger.error('WebSocket message processing error:', error);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: MCPErrorCodes.PARSE_ERROR,
              message: 'Failed to parse message'
            }
          }));
        }
      });

      ws.on('close', () => {
        this.activeConnections.delete(ws);
        logger.info('WebSocket connection closed', { sessionId });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.activeConnections.delete(ws);
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error in request processing:', error, {
        path: req.path,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        errorCode: MCPErrorCodes.INTERNAL_ERROR,
        requestId: req.headers['x-request-id']
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown(1);
    });
  }

  // Route handlers
  private async handleHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const healthResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: await this.redisManager.healthCheck(),
          llm: true, // TODO: Implement LLM health check
          server: this.isRunning
        },
        metrics: {
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage().heapUsed,
          activeConnections: this.activeConnections.size
        }
      };

      const allServicesHealthy = Object.values(healthResult.services).every(Boolean);
      healthResult.status = allServicesHealthy ? 'healthy' : 'degraded';

      res.status(healthResult.status === 'healthy' ? 200 : 503).json(healthResult);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleServerInfo(_req: Request, res: Response): Promise<void> {
    const serverInfo: ServerInfo = {
      name: mcpConfig.serverName,
      version: mcpConfig.serverVersion,
      capabilities: this.capabilityManager.getAllCapabilities(),
      protocolVersion: '1.0.0',
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        uptime: Date.now() - this.startTime,
        activeConnections: this.activeConnections.size,
        availableSchemas: this.schemaValidator.getAvailableSchemas()
      }
    };

    res.json({ success: true, data: serverInfo });
  }

  private async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.processMCPMessage(req.body);
      res.json(response);
    } catch (error) {
      logger.error('MCP request processing failed:', error);
      res.status(500).json(this.createErrorResponse(
        req.body.id || 'unknown',
        MCPErrorCodes.INTERNAL_ERROR,
        'Request processing failed'
      ));
    }
  }

  private async handleCapabilityNegotiation(req: Request, res: Response): Promise<void> {
    try {
      const validation = await this.schemaValidator.validateMCPMessage(req.body);
      if (!validation.isValid) {
        res.status(400).json(this.schemaValidator.createValidationError(req.body.id, validation));
        return;
      }

      const negotiatedCapabilities = await this.capabilityManager.negotiate(req.body.capabilities || []);
      res.json(negotiatedCapabilities);
    } catch (error) {
      logger.error('Capability negotiation failed:', error);
      res.status(500).json(this.createErrorResponse(
        req.body.id,
        MCPErrorCodes.CAPABILITY_NOT_SUPPORTED,
        'Capability negotiation failed'
      ));
    }
  }

  private async handleContextUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, context, options } = req.body;
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required',
          errorCode: MCPErrorCodes.INVALID_PARAMS
        });
      }

      const existingContext = await this.contextManager.getContext(sessionId);
      if (!existingContext) {
        // Create new context
        const newContext = await this.contextManager.createContext(sessionId, context);
        res.json({ success: true, data: newContext });
      } else {
        // Update existing context
        const updatedContext = await this.contextManager.updateContext(sessionId, context, options);
        res.json({ success: true, data: updatedContext });
      }
    } catch (error) {
      logger.error('Context update failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Context update failed',
        errorCode: MCPErrorCodes.CONTEXT_NOT_FOUND
      });
    }
  }

  private async handleGetContext(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const context = await this.contextManager.getContext(sessionId);
      
      if (!context) {
        res.status(400).json({
          success: false,
          error: 'Method not found',
          requestId: req.body.id
        });
        return;
      }

      res.json({ success: true, data: context });
    } catch (error) {
      logger.error('Get context failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve context',
        errorCode: MCPErrorCodes.INTERNAL_ERROR
      });
    }
  }

  private async handleDeleteContext(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      await this.contextManager.deleteContext(sessionId);
      res.json({ success: true, message: 'Context deleted successfully' });
    } catch (error) {
      logger.error('Delete context failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete context',
        errorCode: MCPErrorCodes.INTERNAL_ERROR
      });
    }
  }

  private async handleWorkflowExecution(_req: Request, res: Response): Promise<void> {
    // TODO: Implement workflow execution
    res.status(501).json({
      success: false,
      error: 'Workflow execution not implemented yet',
      errorCode: MCPErrorCodes.METHOD_NOT_FOUND
    });
  }

  private async handleGetWorkflowHistory(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const history = await this.contextManager.getStageHistory(sessionId);
      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Get workflow history failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve workflow history',
        errorCode: MCPErrorCodes.INTERNAL_ERROR
      });
    }
  }

  private async handlePluginRegistration(_req: Request, res: Response): Promise<void> {
    // TODO: Implement plugin registration
    res.status(501).json({
      success: false,
      error: 'Plugin registration not implemented yet',
      errorCode: MCPErrorCodes.METHOD_NOT_FOUND
    });
  }

  private async handleGetPlugins(_req: Request, res: Response): Promise<void> {
    try {
      const plugins = await this.redisManager.getRegisteredPlugins();
      res.json({ success: true, data: plugins });
    } catch (error) {
      logger.error('Get plugins failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve plugins',
        errorCode: MCPErrorCodes.INTERNAL_ERROR
      });
    }
  }

  private async handleGetMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const metrics = await this.redisManager.getMetrics(sessionId);
      res.json({ success: true, data: metrics });
    } catch (error) {
      logger.error('Get metrics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
        errorCode: MCPErrorCodes.INTERNAL_ERROR
      });
    }
  }

  // Core MCP message processing
  private async processMCPMessage(message: any): Promise<MCPResponse> {
    try {
      // Validate message structure
      const validation = await this.schemaValidator.validateMCPMessage(message);
      if (!validation.isValid) {
        return this.createErrorResponse(
          message.id || 'unknown',
          MCPErrorCodes.INVALID_REQUEST,
          `Invalid message structure: ${validation.errors?.join(', ')}`
        );
      }

      const request = message as MCPRequest;

      // Route to appropriate handler based on method
      switch (request.method) {
        case 'negotiate': {
          const capabilities = await this.capabilityManager.negotiate(request.params?.capabilities || []);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: capabilities
          };
        }
        
        case 'context_update':
          return await this.handleContextUpdateMCP(request);
        
        case 'workflow_execute':
          return await this.handleWorkflowExecuteMCP(request);
        
        default:
          return this.createErrorResponse(
            request.id,
            MCPErrorCodes.METHOD_NOT_FOUND,
            `Method '${request.method}' not found`
          );
      }
    } catch (error) {
      logger.error('MCP message processing error:', error);
      return this.createErrorResponse(
        message.id || 'unknown',
        MCPErrorCodes.INTERNAL_ERROR,
        'Internal processing error'
      );
    }
  }

  private async handleContextUpdateMCP(request: MCPRequest): Promise<MCPResponse> {
    try {
      const { sessionId, context } = request.params || {};
      
      if (!sessionId) {
        return this.createErrorResponse(
          request.id,
          MCPErrorCodes.INVALID_PARAMS,
          'Session ID is required'
        );
      }

      const updatedContext = await this.contextManager.updateContext(sessionId, context);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { context: updatedContext }
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.CONTEXT_NOT_FOUND,
        error instanceof Error ? error.message : 'Context update failed'
      );
    }
  }

  private async handleWorkflowExecuteMCP(request: MCPRequest): Promise<MCPResponse> {
    // TODO: Implement workflow execution logic
    return this.createErrorResponse(
      request.id,
      MCPErrorCodes.METHOD_NOT_FOUND,
      'Workflow execution not implemented yet'
    );
  }

  private createErrorResponse(id: string | number, code: number, message: string): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message }
    };
  }

  // Server lifecycle methods
  async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redisManager.connect();
      
      // Start server
      this.startTime = Date.now();
      await new Promise<void>((resolve) => {
        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          logger.info(`MCP Server started on ${this.config.host}:${this.config.port}`, {
            webSocket: this.config.enableWebSocket,
            cors: this.config.enableCors
          });
          resolve();
        });
      });
    } catch (error) {
      logger.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.gracefulShutdown();
  }

  private async gracefulShutdown(exitCode: number = 0): Promise<void> {
    logger.info('Initiating graceful shutdown...');
    
    this.isRunning = false;

    // Close WebSocket connections
    if (this.wsServer) {
      this.activeConnections.forEach(ws => ws.close());
      this.wsServer.close();
    }

    // Close HTTP server
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // Disconnect from Redis
    await this.redisManager.disconnect();

    logger.info('Graceful shutdown completed');
    
    if (exitCode > 0) {
      process.exit(exitCode);
    }
  }

  // Getters for components (useful for testing)
  getCapabilityManager(): CapabilityManager {
    return this.capabilityManager;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  getSchemaValidator(): SchemaValidator {
    return this.schemaValidator;
  }

  getRedisManager(): RedisManager {
    return this.redisManager;
  }
}
