// Type exports for the MCP server
export * from './mcp';
export * from './workflow';

// Additional utility types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    redis: boolean;
    llm: boolean;
    server: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
  };
}
