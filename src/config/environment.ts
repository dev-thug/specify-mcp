import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('localhost'),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_URL: z.string().optional(),

  // MCP Configuration
  MCP_SERVER_NAME: z.string().default('specify-mcp'),
  MCP_SERVER_VERSION: z.string().default('0.0.1'),
  MCP_REGISTRY_ENABLED: z.coerce.boolean().default(true),

  // Authentication
  JWT_SECRET: z.string().default('dev-secret-key'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // LLM Integration
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  LLM_MAX_TOKENS: z.coerce.number().default(4000),
  LLM_TEMPERATURE: z.coerce.number().default(0.1),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/mcp-server.log'),

  // Performance
  CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  MAX_CONCURRENT_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Validation
  MULTI_RUN_COUNT: z.coerce.number().default(3),
  CONSENSUS_THRESHOLD: z.coerce.number().default(0.8),
  REFINEMENT_MAX_ATTEMPTS: z.coerce.number().default(3)
});

export type Environment = z.infer<typeof envSchema>;

// Validate and export environment variables
export const env: Environment = envSchema.parse(process.env);

// Configuration objects
export const serverConfig = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV
};

export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
  url: env.REDIS_URL
};

export const mcpConfig = {
  serverName: env.MCP_SERVER_NAME,
  serverVersion: env.MCP_SERVER_VERSION,
  registryEnabled: env.MCP_REGISTRY_ENABLED
};

export const authConfig = {
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN
};

export const llmConfig = {
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  model: env.LLM_MODEL,
  maxTokens: env.LLM_MAX_TOKENS,
  temperature: env.LLM_TEMPERATURE
};

export const performanceConfig = {
  cacheTtl: env.CACHE_TTL_SECONDS,
  maxConcurrentRequests: env.MAX_CONCURRENT_REQUESTS,
  rateLimitWindow: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS
};

export const validationConfig = {
  multiRunCount: env.MULTI_RUN_COUNT,
  consensusThreshold: env.CONSENSUS_THRESHOLD,
  refinementMaxAttempts: env.REFINEMENT_MAX_ATTEMPTS
};

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
