import { z } from 'zod';

// Base MCP Message Types
export const MessageTypeSchema = z.enum([
  'request',
  'response',
  'notification',
  'error'
]);

export const MCPVersionSchema = z.string().default('1.0.0');

// MCP Request Schema
export const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.any()).optional()
});

// MCP Response Schema
export const MCPResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional()
  }).optional()
});

// MCP Notification Schema
export const MCPNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.any()).optional()
});

// Capability Types
export const CapabilityTypeSchema = z.enum([
  'context_update',
  'schema_validate',
  'workflow_execute',
  'plugin_register',
  'tool_call',
  'resource_access',
  'prompt_engineering'
]);

// Capability Definition Schema
export const CapabilityDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  parameters: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

// Context Schema
export const ContextSchema = z.object({
  sessionId: z.string(),
  stage: z.string(),
  previousOutput: z.record(z.any()).optional(),
  currentInput: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
  workflowState: z.record(z.any()).optional()
});

// Workflow Stage Schema
export const WorkflowStageSchema = z.enum([
  'ambiguity',
  'specification',
  'planning',
  'tasking',
  'verification',
  'evolution'
]);

// Tool Definition Schema
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()),
  outputSchema: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

// Resource Definition Schema
export const ResourceDefinitionSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Prompt Template Schema
export const PromptTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  template: z.string(),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

// Metrics Schema
export const MetricsSchema = z.object({
  completeness: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  determinism: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  executionTime: z.number().optional(),
  validationTime: z.number().optional(),
  timestamp: z.number()
});

// Validation Result Schema
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  metrics: MetricsSchema.optional()
});

// Multi-Run Consensus Schema
export const ConsensusResultSchema = z.object({
  consensus: z.boolean(),
  confidence: z.number(),
  results: z.array(z.any()),
  finalResult: z.any(),
  metadata: z.record(z.any()).optional()
});

// Plugin Configuration Schema
export const PluginConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  enabled: z.boolean(),
  configuration: z.record(z.any()).optional(),
  capabilities: z.array(CapabilityTypeSchema),
  dependencies: z.array(z.string()).optional()
});

// Server Information Schema
export const ServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  capabilities: z.array(CapabilityDefinitionSchema),
  protocolVersion: MCPVersionSchema,
  metadata: z.record(z.any()).optional()
});

// Type exports
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type MCPRequest = z.infer<typeof MCPRequestSchema>;
export type MCPResponse = z.infer<typeof MCPResponseSchema>;
export type MCPNotification = z.infer<typeof MCPNotificationSchema>;
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ResourceDefinition = z.infer<typeof ResourceDefinitionSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type ServerInfo = z.infer<typeof ServerInfoSchema>;

// Union type for all MCP messages
export type MCPMessage = MCPRequest | MCPResponse | MCPNotification;

// Error codes
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
  CAPABILITY_NOT_SUPPORTED: -32001,
  CONTEXT_NOT_FOUND: -32002,
  VALIDATION_FAILED: -32003,
  CONSENSUS_FAILED: -32004,
  PLUGIN_ERROR: -32005
} as const;

export type MCPErrorCode = typeof MCPErrorCodes[keyof typeof MCPErrorCodes];
