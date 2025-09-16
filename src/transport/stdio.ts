import { BaseTransport } from './base.js';
import * as readline from 'readline';

export class StdioTransport extends BaseTransport {
  private rl?: readline.Interface;
  private buffer = '';

  async start(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.rl.on('line', (line) => {
      this.buffer += line;
      
      // Try to parse complete JSON-RPC messages
      try {
        const message = JSON.parse(this.buffer);
        this.buffer = '';
        void this.handleIncomingMessage(message);
      } catch {
        // Not a complete JSON yet, continue buffering
      }
    });

    process.stdin.on('end', () => {
      void this.stop();
    });
  }

  async stop(): Promise<void> {
    this.rl?.close();
  }

  async send(message: unknown): Promise<void> {
    const json = JSON.stringify(message);
    process.stdout.write(json + '\n');
  }
}
