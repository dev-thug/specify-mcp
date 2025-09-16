import type { TransportAdapter } from '../types/index.js';

export abstract class BaseTransport implements TransportAdapter {
  protected messageHandler?: (message: unknown) => Promise<void>;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(message: unknown): Promise<void>;

  onMessage(handler: (message: unknown) => Promise<void>): void {
    this.messageHandler = handler;
  }

  protected async handleIncomingMessage(message: unknown): Promise<void> {
    if (!this.messageHandler) {
      throw new Error('No message handler registered');
    }
    await this.messageHandler(message);
  }
}
