#!/usr/bin/env node
/**
 * Specify MCP Server - Entry Point
 * Specification-Driven Development through MCP
 */

import { SDDMCPServer } from './server.js';

async function main(): Promise<void> {
  try {
    const server = new SDDMCPServer();
    await server.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
