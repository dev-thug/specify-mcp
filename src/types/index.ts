import type { z } from 'zod';

export interface TransportAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: unknown): Promise<void>;
  onMessage(handler: (message: unknown) => Promise<void>): void;
}

export interface SDDStage {
  name: string;
  description: string;
  execute(context: SDDContext): Promise<SDDStageResult>;
  verify(result: SDDStageResult): Promise<VerificationResult>;
}

export interface SDDContext {
  projectId: string;
  currentStage: string;
  previousResults: Map<string, SDDStageResult>;
  metadata: Record<string, unknown>;
}

export interface SDDStageResult {
  stage: string;
  content: string;
  artifacts: Map<string, string>;
  timestamp: number;
  verified: boolean;
}

export interface VerificationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  confidence: number;
}

export interface ProjectResource {
  uri: string;
  name: string;
  mimeType: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export type ToolInputSchema = z.ZodType<unknown>;

export interface SDDTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (params: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    uri?: string;
  }>;
}

export interface ElicitationRequest {
  message: string;
  schema?: z.ZodType<unknown>;
  options?: string[];
}

export interface SamplingRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  modelPreferences?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface CommonVerificationConfig {
  enableHallucinationCheck: boolean;
  enableConsistencyCheck: boolean;
  enableFactCheck: boolean;
  consensusRuns?: number;
}
