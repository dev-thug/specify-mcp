/**
 * STDIO transport implementation for MCP server
 * Handles communication via process.stdin and process.stdout
 */

import { BaseTransport } from './base.js';
import { IJsonRpcResponse } from '../types/index.js';
import * as readline from 'readline';

export class StdioTransport extends BaseTransport {
  private reader?: readline.Interface;

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Transport already running');
    }

    // Create readline interface for reading from stdin
    this.reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Set up message handling
    this.reader.on('line', (line) => {
      void this.processLine(line);
    });

    this.reader.on('close', () => {
      void this.stop();
    });

    this.isRunning = true;
    
    // Send ready signal
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.reader) {
      this.reader.close();
      this.reader = undefined as any;
    }

    this.emit('stopped');
  }

  async send(message: IJsonRpcResponse): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Transport not running');
    }

    const formatted = this.formatJsonRpcMessage(message);
    
    // MCP uses line-delimited JSON for STDIO
    process.stdout.write(`${formatted}\n`);
  }

  private async processLine(line: string): Promise<void> {
    // Trim whitespace
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      return;
    }

    // Process as complete JSON-RPC message
    await this.handleIncomingMessage(trimmed);
  }
}
