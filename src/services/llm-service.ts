import Anthropic from '@anthropic-ai/sdk';
import { RedisManager } from '../config/redis.js';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

export interface LLMRequest {
  prompt: string;
  context?: string;
  type: 'analysis' | 'generation' | 'validation' | 'refinement';
  temperature?: number;
  maxTokens?: number;
  cacheKey?: string;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cached: boolean;
  model: string;
  requestId: string;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  timeout: number;
  enableCache: boolean;
  cacheTTL: number;
}

export class LLMService {
  private anthropic: Anthropic;
  private redisManager: RedisManager;
  private config: LLMConfig;
  private rateLimitQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  constructor(redisManager: RedisManager, config?: Partial<LLMConfig>) {
    this.redisManager = redisManager;
    
    this.config = {
      apiKey: env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-haiku-20240307',
      maxRetries: 3,
      timeout: 30000,
      enableCache: true,
      cacheTTL: 24 * 60 * 60, // 24 hours
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.anthropic = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const requestId = this.generateRequestId();
    
    logger.info('LLM request initiated', {
      requestId,
      type: request.type,
      promptLength: request.prompt.length,
      hasContext: !!request.context
    });

    try {
      // Check cache first if enabled
      if (this.config.enableCache) {
        const cachedResponse = await this.getCachedResponse(request);
        if (cachedResponse) {
          logger.info('LLM response served from cache', { requestId });
          return { ...cachedResponse, requestId };
        }
      }

      // Generate new response
      const response = await this.callAnthropicAPI(request, requestId);
      
      // Cache the response if enabled
      if (this.config.enableCache) {
        await this.cacheResponse(request, response);
      }

      logger.info('LLM response generated', {
        requestId,
        outputLength: response.content.length,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens
      });

      return { ...response, requestId };

    } catch (error) {
      logger.error('LLM request failed', error, { requestId });
      throw error;
    }
  }

  async analyzeAmbiguity(text: string, context?: string): Promise<{
    ambiguities: Array<{
      text: string;
      type: 'semantic' | 'syntactic' | 'pragmatic';
      severity: 'low' | 'medium' | 'high';
      suggestions: string[];
    }>;
    clarityScore: number;
    recommendations: string[];
  }> {
    const prompt = this.buildAmbiguityAnalysisPrompt(text, context);
    
    const response = await this.generateResponse({
      prompt,
      type: 'analysis',
      temperature: 0.3,
      maxTokens: 2000,
      systemPrompt: 'You are an expert in requirements analysis and technical writing. Analyze text for ambiguities and provide structured feedback.'
    });

    return this.parseAmbiguityAnalysis(response.content);
  }

  async generateSpecification(requirements: string, ambiguityResolution?: any): Promise<{
    functionalRequirements: any[];
    nonFunctionalRequirements: any[];
    systemBoundaries: any;
    dataModels: any[];
  }> {
    const prompt = this.buildSpecificationPrompt(requirements, ambiguityResolution);
    
    const response = await this.generateResponse({
      prompt,
      type: 'generation',
      temperature: 0.4,
      maxTokens: 4000,
      systemPrompt: 'You are a senior systems analyst. Generate comprehensive technical specifications from user requirements.'
    });

    return this.parseSpecificationResponse(response.content);
  }

  async optimizeTaskBreakdown(tasks: any[], context: any): Promise<{
    optimizedTasks: any[];
    suggestions: string[];
    riskAssessment: any[];
  }> {
    const prompt = this.buildTaskOptimizationPrompt(tasks, context);
    
    const response = await this.generateResponse({
      prompt,
      type: 'refinement',
      temperature: 0.5,
      maxTokens: 3000,
      systemPrompt: 'You are a project management expert. Optimize task breakdown and identify risks.'
    });

    return this.parseTaskOptimization(response.content);
  }

  async validateRequirements(requirements: any[], testResults: any[]): Promise<{
    coverage: number;
    gaps: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const prompt = this.buildValidationPrompt(requirements, testResults);
    
    const response = await this.generateResponse({
      prompt,
      type: 'validation',
      temperature: 0.2,
      maxTokens: 2000,
      systemPrompt: 'You are a quality assurance expert. Validate requirement coverage and identify gaps.'
    });

    return this.parseValidationResponse(response.content);
  }

  async generateImprovements(systemAnalysis: any, performanceData: any): Promise<{
    improvements: Array<{
      category: string;
      priority: 'low' | 'medium' | 'high';
      description: string;
      impact: string;
      effort: string;
    }>;
    roadmap: any;
  }> {
    const prompt = this.buildImprovementPrompt(systemAnalysis, performanceData);
    
    const response = await this.generateResponse({
      prompt,
      type: 'analysis',
      temperature: 0.6,
      maxTokens: 3000,
      systemPrompt: 'You are a software architect. Analyze systems and recommend improvements.'
    });

    return this.parseImprovementResponse(response.content);
  }

  private async callAnthropicAPI(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      this.rateLimitQueue.push(async () => {
        try {
          const messages: Anthropic.Messages.MessageParam[] = [];
          
          if (request.context) {
            messages.push({
              role: 'user',
              content: `Context: ${request.context}`
            });
          }
          
          messages.push({
            role: 'user',
            content: request.prompt
          });

          const response = await this.anthropic.messages.create({
            model: this.config.model,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.5,
            ...(request.systemPrompt && { system: request.systemPrompt }),
            messages
          });

          const content = response.content
            .filter(block => block.type === 'text')
            .map(block => (block as any).text)
            .join('\n');

          resolve({
            content,
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens
            },
            cached: false,
            model: response.model,
            requestId
          });

        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.rateLimitQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.rateLimitQueue.length > 0) {
      const request = this.rateLimitQueue.shift();
      if (request) {
        await request();
        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessingQueue = false;
  }

  private generateCacheKey(request: LLMRequest): string {
    if (request.cacheKey) {
      return `llm:cache:${request.cacheKey}`;
    }

    const content = JSON.stringify({
      prompt: request.prompt,
      context: request.context,
      type: request.type,
      temperature: request.temperature,
      systemPrompt: request.systemPrompt
    });

    const hash = createHash('sha256').update(content).digest('hex');
    return `llm:cache:${hash}`;
  }

  private async getCachedResponse(request: LLMRequest): Promise<LLMResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const client = this.redisManager.getClient();
      const cached = await client.get(cacheKey);
      
      if (cached) {
        const response = JSON.parse(cached);
        return { ...response, cached: true };
      }
      
      return null;
    } catch (error) {
      logger.warn('Cache retrieval failed', error);
      return null;
    }
  }

  private async cacheResponse(request: LLMRequest, response: LLMResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const client = this.redisManager.getClient();
      
      await client.setEx(
        cacheKey,
        this.config.cacheTTL,
        JSON.stringify({
          content: response.content,
          usage: response.usage,
          model: response.model
        })
      );
    } catch (error) {
      logger.warn('Cache storage failed', error);
    }
  }

  private generateRequestId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildAmbiguityAnalysisPrompt(text: string, context?: string): string {
    return `
Analyze the following text for ambiguities and unclear statements:

${context ? `Context: ${context}\n` : ''}
Text to analyze: "${text}"

Please identify:
1. Semantic ambiguities (multiple meanings)
2. Syntactic ambiguities (unclear references)
3. Pragmatic ambiguities (context-dependent meanings)

For each ambiguity, provide:
- The ambiguous text
- Type (semantic/syntactic/pragmatic)
- Severity (low/medium/high)
- Suggested clarifications

Also provide:
- Overall clarity score (0-1)
- General recommendations for improvement

Format your response as JSON.
`;
  }

  private buildSpecificationPrompt(requirements: string, ambiguityResolution?: any): string {
    return `
Generate a comprehensive technical specification from these requirements:

Requirements: ${requirements}

${ambiguityResolution ? `Ambiguity Resolution: ${JSON.stringify(ambiguityResolution, null, 2)}\n` : ''}

Please generate:
1. Functional Requirements (with IDs, descriptions, priorities)
2. Non-functional Requirements (performance, security, usability)
3. System Boundaries (in-scope, out-of-scope)
4. Data Models (entities, attributes, relationships)

Format as structured JSON with clear categorization.
`;
  }

  private buildTaskOptimizationPrompt(tasks: any[], context: any): string {
    return `
Optimize this task breakdown for better execution:

Tasks: ${JSON.stringify(tasks, null, 2)}
Context: ${JSON.stringify(context, null, 2)}

Please provide:
1. Optimized task sequence
2. Dependency recommendations
3. Risk assessment for each task
4. Resource allocation suggestions
5. Timeline optimization opportunities

Format as JSON with clear improvements and rationale.
`;
  }

  private buildValidationPrompt(requirements: any[], testResults: any[]): string {
    return `
Validate requirement coverage against test results:

Requirements: ${JSON.stringify(requirements, null, 2)}
Test Results: ${JSON.stringify(testResults, null, 2)}

Please assess:
1. Coverage percentage
2. Uncovered requirements
3. Test gaps
4. Risk level assessment
5. Recommendations for improvement

Format as JSON with specific gap analysis.
`;
  }

  private buildImprovementPrompt(systemAnalysis: any, performanceData: any): string {
    return `
Analyze system state and recommend improvements:

System Analysis: ${JSON.stringify(systemAnalysis, null, 2)}
Performance Data: ${JSON.stringify(performanceData, null, 2)}

Please provide:
1. Prioritized improvement opportunities
2. Impact assessment for each improvement
3. Implementation effort estimates
4. Evolution roadmap
5. Risk considerations

Format as JSON with actionable recommendations.
`;
  }

  // Parser methods for structured responses
  private parseAmbiguityAnalysis(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      logger.warn('Failed to parse ambiguity analysis, using fallback', { content });
      return {
        ambiguities: [],
        clarityScore: 0.5,
        recommendations: ['Response parsing failed - manual review required']
      };
    }
  }

  private parseSpecificationResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      return {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        systemBoundaries: {},
        dataModels: []
      };
    }
  }

  private parseTaskOptimization(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      return {
        optimizedTasks: [],
        suggestions: [],
        riskAssessment: []
      };
    }
  }

  private parseValidationResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      return {
        coverage: 0,
        gaps: [],
        recommendations: [],
        riskLevel: 'high' as const
      };
    }
  }

  private parseImprovementResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      return {
        improvements: [],
        roadmap: {}
      };
    }
  }

  // Health check and metrics
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      apiKeyConfigured: boolean;
      cacheAvailable: boolean;
      queueLength: number;
    };
  }> {
    const apiKeyConfigured = !!this.config.apiKey;
    const cacheAvailable = await this.redisManager.healthCheck();
    const queueLength = this.rateLimitQueue.length;

    const status = apiKeyConfigured && cacheAvailable && queueLength < 100 
      ? 'healthy' 
      : 'degraded';

    return {
      status,
      details: {
        apiKeyConfigured,
        cacheAvailable,
        queueLength
      }
    };
  }

  // Get usage statistics
  async getUsageStats(): Promise<{
    totalRequests: number;
    cacheHitRate: number;
    averageResponseTime: number;
    totalTokensUsed: number;
  }> {
    try {
      const client = this.redisManager.getClient();
      const stats = await client.hGetAll('llm:stats');
      
      return {
        totalRequests: parseInt(stats.totalRequests || '0'),
        cacheHitRate: parseFloat(stats.cacheHitRate || '0'),
        averageResponseTime: parseFloat(stats.averageResponseTime || '0'),
        totalTokensUsed: parseInt(stats.totalTokensUsed || '0')
      };
    } catch (error) {
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0
      };
    }
  }
}
