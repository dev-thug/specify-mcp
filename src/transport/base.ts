/**
 * Abstract transport layer for MCP server
 * Supports both STDIO (v1) and HTTP (v2) transports
 */

import { IJsonRpcRequest, IJsonRpcResponse, ITransport } from '../types/index.js';
import { EventEmitter } from 'events';

export abstract class BaseTransport extends EventEmitter implements ITransport {
  protected isRunning = false;
  protected messageHandler?: (message: IJsonRpcRequest) => Promise<void>;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(message: IJsonRpcResponse): Promise<void>;

  onMessage(handler: (message: IJsonRpcRequest) => Promise<void>): void {
    this.messageHandler = handler;
  }

  protected async handleIncomingMessage(data: string): Promise<void> {
    if (!this.messageHandler) {
      console.error('No message handler registered');
      return;
    }

    try {
      // Parse JSON-RPC message
      const message = this.parseJsonRpcMessage(data);
      if (message) {
        await this.messageHandler(message);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
      // Send parse error response
      const errorResponse: IJsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      await this.send(errorResponse);
    }
  }

  protected parseJsonRpcMessage(data: string): IJsonRpcRequest | null {
    try {
      const parsed = JSON.parse(data) as unknown;
      
      // Validate JSON-RPC 2.0 structure
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'jsonrpc' in parsed &&
        (parsed as { jsonrpc: unknown }).jsonrpc === '2.0' &&
        'method' in parsed &&
        typeof (parsed as { method: unknown }).method === 'string'
      ) {
        return parsed as IJsonRpcRequest;
      }
      
      console.error('Invalid JSON-RPC message structure');
      return null;
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      return null;
    }
  }

  protected formatJsonRpcMessage(message: IJsonRpcResponse): string {
    return JSON.stringify(message);
  }
}
