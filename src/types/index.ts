/**
 * Core type definitions for Specify MCP Server
 * Following clean code principles with meaningful names
 */

import { z } from 'zod';

// ============================================
// MCP Protocol Types (JSON-RPC 2.0)
// ============================================

export interface IJsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface IJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: IJsonRpcError;
}

export interface IJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP Error Codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific error codes
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_ACCESS_DENIED: -32002,
  TOOL_NOT_FOUND: -32003,
  TOOL_EXECUTION_ERROR: -32004,
  VALIDATION_ERROR: -32005,
} as const;

// ============================================
// MCP Capabilities
// ============================================

export interface IServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {
    levels?: string[];
  };
}

export interface IClientCapabilities {
  sampling?: {
    maxTokens?: number;
  };
  roots?: {
    listChanged?: boolean;
  };
}

// ============================================
// MCP Tools
// ============================================

export const ToolInputSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).optional(),
});

export interface ITool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
}

export interface IToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

// ============================================
// MCP Resources
// ============================================

export interface IResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface IResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// ============================================
// MCP Prompts
// ============================================

export interface IPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface IPromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  };
}

// ============================================
// SDD-Specific Types
// ============================================

export interface IProjectConfig {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'initializing' | 'specified' | 'planned' | 'tasked' | 'implementing' | 'completed';
  metadata: Record<string, unknown>;
}

export interface ISpecification {
  id: string;
  projectId: string;
  content: string;
  version: number;
  status: 'draft' | 'review' | 'approved';
  validationResults?: IValidationResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlan {
  id: string;
  projectId: string;
  specificationId: string;
  techStack: ITechStack;
  architecture: string;
  content: string;
  version: number;
  validationResults?: IValidationResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITechStack {
  language: string;
  framework?: string;
  database?: string;
  testing?: string;
  dependencies: string[];
}

export interface ITask {
  id: string;
  projectId: string;
  planId: string;
  title: string;
  description: string;
  subtasks: ISubtask[];
  dependencies: string[];
  parallel: boolean;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
}

export interface ISubtask {
  id: string;
  title: string;
  content: string;
  filePath?: string;
}

export interface IImplementation {
  id: string;
  projectId: string;
  taskId: string;
  testDefinition: string;
  pseudoCode: string;
  tddApproach: string;
  status: 'red' | 'green' | 'refactor';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Verification Types
// ============================================

export interface IValidationResult {
  type: 'error' | 'warning' | 'info';
  category: 'hallucination' | 'ambiguity' | 'inconsistency' | 'incompleteness';
  message: string;
  location?: string;
  suggestion?: string;
  confidence: number; // 0.0 to 1.0
}

export interface IVerificationContext {
  phase: 'init' | 'spec' | 'plan' | 'tasks' | 'implement';
  content: string;
  previousVersions?: string[];
  relatedDocuments?: Map<string, string>;
}

// ============================================
// Template Types
// ============================================

export interface ITemplate {
  name: string;
  path: string;
  variables: string[];
  sections: ITemplateSection[];
}

export interface ITemplateSection {
  name: string;
  required: boolean;
  placeholder: string;
  validation?: z.ZodSchema;
}

// ============================================
// Transport Types
// ============================================

export interface ITransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: IJsonRpcResponse): Promise<void>;
  onMessage(handler: (message: IJsonRpcRequest) => Promise<void>): void;
}

// ============================================
// Client Capability Types (Sampling & Elicitation)
// ============================================

export interface ISamplingRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  modelPreferences?: {
    hints?: string[];
    temperature?: number;
    maxTokens?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  stopSequences?: string[];
}

export interface ISamplingResponse {
  role: 'assistant';
  content: {
    type: 'text';
    text: string;
  };
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

export interface IElicitationRequest {
  prompt: string;
  options?: {
    type?: 'text' | 'boolean' | 'select';
    choices?: string[];
    default?: string | boolean;
  };
}

export interface IElicitationResponse {
  value: string | boolean;
  cancelled?: boolean;
}

// ============================================
// Directory Structure Types
// ============================================

export interface ISpecifyStructure {
  rootPath: string;
  projects: Map<string, IProjectStructure>;
}

export interface IProjectStructure {
  projectPath: string;
  spec: {
    path: string;
    versions: string[];
  };
  plan: {
    path: string;
    research?: string;
    dataModel?: string;
    contracts?: string[];
  };
  tasks: {
    path: string;
    taskFolders: Map<string, ITaskFolder>;
  };
  implementations: {
    path: string;
    taskFolders: Map<string, IImplementationTaskFolder>;
  };
}

export interface ITaskFolder {
  indexPath: string;
  subtasks: string[];
}

export interface IImplementationTaskFolder {
  indexPath: string;
  tests: Map<string, string>; // filename -> filepath
  code: Map<string, string>;  // filename -> filepath
}
