import { z } from 'zod';
import { 
  CapabilityDefinition, 
  MCPRequest, 
  MCPResponse, 
  ValidationResult 
} from '../types/mcp.js';

// Extension lifecycle states
export const ExtensionStatusSchema = z.enum([
  'inactive',
  'initializing', 
  'active',
  'error',
  'disabled'
]);

// Extension metadata schema
export const ExtensionMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  license: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  mcpVersion: z.string().default('1.0.0'),
  supportedPlatforms: z.array(z.enum(['node', 'browser', 'edge'])).default(['node'])
});

// Extension configuration schema
export const ExtensionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(true),
  priority: z.number().min(0).max(100).default(50),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(10).default(3),
  settings: z.record(z.any()).optional(),
  resources: z.object({
    maxMemory: z.number().positive().optional(),
    maxCpu: z.number().positive().optional(),
    maxConnections: z.number().positive().optional()
  }).optional()
});

// Extension execution context
export const ExtensionContextSchema = z.object({
  sessionId: z.string(),
  requestId: z.string(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
  environment: z.enum(['development', 'production', 'test']),
  capabilities: z.array(z.string()),
  resources: z.record(z.any()).optional()
});

// Type exports
export type ExtensionStatus = z.infer<typeof ExtensionStatusSchema>;
export type ExtensionMetadata = z.infer<typeof ExtensionMetadataSchema>;
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;
export type ExtensionContext = z.infer<typeof ExtensionContextSchema>;

// Extension execution result
export interface ExtensionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metrics?: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage?: number;
  };
  metadata?: Record<string, any>;
}

// Extension lifecycle hooks
export interface ExtensionLifecycleHooks {
  onInstall?: (context: ExtensionContext) => Promise<ExtensionResult>;
  onActivate?: (context: ExtensionContext) => Promise<ExtensionResult>;
  onDeactivate?: (context: ExtensionContext) => Promise<ExtensionResult>;
  onUninstall?: (context: ExtensionContext) => Promise<ExtensionResult>;
  onError?: (error: Error, context: ExtensionContext) => Promise<ExtensionResult>;
  onConfigUpdate?: (newConfig: ExtensionConfig, context: ExtensionContext) => Promise<ExtensionResult>;
}

// Main extension interface
export interface IExtension extends ExtensionLifecycleHooks {
  // Required metadata
  readonly metadata: ExtensionMetadata;
  
  // Extension status
  status: ExtensionStatus;
  
  // Configuration
  config: ExtensionConfig;
  
  // Capabilities provided by this extension
  getCapabilities(): CapabilityDefinition[];
  
  // Execute extension functionality
  execute(request: MCPRequest, context: ExtensionContext): Promise<MCPResponse>;
  
  // Validate extension input/output
  validate(data: any, schema?: string): Promise<ValidationResult>;
  
  // Health check for the extension
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, any>;
  }>;
  
  // Get extension metrics
  getMetrics(): Promise<{
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    memoryUsage: number;
  }>;
}

// Tool extension interface for external tools
export interface IToolExtension extends IExtension {
  // Tool-specific methods
  getTool(name: string): Promise<ToolDefinition | null>;
  getTools(): Promise<ToolDefinition[]>;
  executeTool(name: string, parameters: any, context: ExtensionContext): Promise<ExtensionResult>;
}

// Resource extension interface for data access
export interface IResourceExtension extends IExtension {
  // Resource-specific methods
  getResource(uri: string): Promise<ResourceDefinition | null>;
  getResources(): Promise<ResourceDefinition[]>;
  accessResource(uri: string, operation: string, data?: any, context?: ExtensionContext): Promise<ExtensionResult>;
}

// Prompt extension interface for LLM prompts
export interface IPromptExtension extends IExtension {
  // Prompt-specific methods
  getPrompt(name: string): Promise<PromptTemplate | null>;
  getPrompts(): Promise<PromptTemplate[]>;
  executePrompt(name: string, variables: Record<string, any>, context: ExtensionContext): Promise<ExtensionResult>;
}

// Extension factory interface
export interface IExtensionFactory {
  createExtension(metadata: ExtensionMetadata, config: ExtensionConfig): Promise<IExtension>;
  validateExtension(extension: IExtension): Promise<ValidationResult>;
  getExtensionTypes(): string[];
}

// Extension event system
export interface ExtensionEvent {
  type: string;
  extensionName: string;
  timestamp: string;
  data?: any;
  context?: ExtensionContext;
}

export interface IExtensionEventEmitter {
  on(event: string, listener: (event: ExtensionEvent) => void): void;
  off(event: string, listener: (event: ExtensionEvent) => void): void;
  emit(event: string, data: ExtensionEvent): void;
}

// Plugin package format (for loading from files)
export interface ExtensionPackage {
  manifest: {
    metadata: ExtensionMetadata;
    config: ExtensionConfig;
    main: string; // Entry point file
    files: string[]; // Required files
  };
  code: string | Buffer; // Extension code
  dependencies?: Record<string, string>; // NPM dependencies
  checksum?: string; // Security verification
}

// Extension security interface
export interface IExtensionSecurity {
  validatePackage(pkg: ExtensionPackage): Promise<ValidationResult>;
  sanitizeConfig(config: ExtensionConfig): ExtensionConfig;
  checkPermissions(extension: IExtension, operation: string): Promise<boolean>;
  auditExtension(extension: IExtension): Promise<SecurityAuditResult>;
}

export interface SecurityAuditResult {
  passed: boolean;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'security' | 'performance' | 'compatibility';
    description: string;
    recommendation?: string;
  }>;
  score: number; // 0-100
}

// Helper types for tool/resource definitions
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables?: string[];
  metadata?: Record<string, any>;
}

// Extension registry interface
export interface IExtensionRegistry {
  // Registration
  register(extension: IExtension): Promise<void>;
  unregister(name: string): Promise<void>;
  
  // Discovery
  find(name: string): Promise<IExtension | null>;
  findByCapability(capability: string): Promise<IExtension[]>;
  list(): Promise<IExtension[]>;
  
  // Lifecycle management
  activate(name: string): Promise<void>;
  deactivate(name: string): Promise<void>;
  reload(name: string): Promise<void>;
  
  // Status and metrics
  getStatus(name: string): Promise<ExtensionStatus>;
  getMetrics(name?: string): Promise<Record<string, any>>;
  
  // Events
  subscribe(callback: (event: ExtensionEvent) => void): void;
  unsubscribe(callback: (event: ExtensionEvent) => void): void;
}
