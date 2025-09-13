import { MCPServer, MCPServerConfig } from './core/mcp-server.js';
import { redisConfig, serverConfig, isDevelopment } from './config/environment.js';
import { logger } from './utils/logger.js';

// Server configuration
const mcpServerConfig: MCPServerConfig = {
  port: serverConfig.port,
  host: serverConfig.host,
  enableWebSocket: true,
  enableCors: isDevelopment,
  rateLimiting: {
    windowMs: 60000, // 1 minute
    maxRequests: 100
  }
};

// Initialize and start the MCP server
async function startServer(): Promise<void> {
  let server: MCPServer | null = null;

  try {
    logger.info('Initializing MCP Server...');
    
    const validRedisConfig = {
    ...redisConfig,
    password: redisConfig.password || undefined
  };
  server = new MCPServer(mcpServerConfig, validRedisConfig);
    
    logger.info('Starting MCP Server...');
    await server.start();
    
    logger.info('MCP Server is running successfully!', {
      host: mcpServerConfig.host,
      port: mcpServerConfig.port,
      environment: process.env.NODE_ENV,
      websocket: mcpServerConfig.enableWebSocket,
      cors: mcpServerConfig.enableCors
    });

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, initiating graceful shutdown...');
      if (server) {
        await server.stop();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, initiating graceful shutdown...');
      if (server) {
        await server.stop();
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start MCP Server:', error);
    
    if (server) {
      try {
        await server.stop();
      } catch (stopError) {
        logger.error('Error during server cleanup:', stopError);
      }
    }
    
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled error during server startup:', error);
  process.exit(1);
});
