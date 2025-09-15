/**
 * Core types and interfaces for AI-SDD MCP Server
 * Following TypeScript best practices with meaningful names and clear interfaces
 */

export interface UserIntent {
  readonly description: string;
  readonly domain?: string;
  readonly constraints?: string[];
  readonly context?: Record<string, unknown>;
  readonly priority: 'low' | 'medium' | 'high';
}

export interface ResolvedIntent extends UserIntent {
  readonly ambiguities: AmbiguityResolution[];
  readonly clarifications: string[];
  readonly confidence: number;
}

export interface AmbiguityResolution {
  readonly original: string;
  readonly resolved: string;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface Specification {
  readonly naturalLanguage: string;
  readonly formalSpec?: string | undefined; // ACSL or other formal specification
  readonly requirements: Requirement[];
  readonly constraints: Constraint[];
  readonly architecture: ArchitectureDecision[];
  readonly metadata: SpecificationMetadata;
}

export interface Requirement {
  readonly id: string;
  readonly type: 'functional' | 'non-functional' | 'constraint';
  readonly description: string;
  readonly priority: 'must' | 'should' | 'could' | 'wont';
  readonly testable: boolean;
  readonly dependencies: string[];
}

export interface Constraint {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
}

export interface ArchitectureDecision {
  readonly id: string;
  readonly title: string;
  readonly decision: string;
  readonly rationale: string;
  readonly alternatives: string[];
  readonly consequences: string[];
}

export interface SpecificationMetadata {
  readonly version: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly author: string;
  readonly reviewStatus: 'draft' | 'review' | 'approved' | 'rejected';
}

export interface ImplementationPlan {
  readonly architecture: SystemArchitecture;
  readonly phases: DevelopmentPhase[];
  readonly timeline: Timeline;
  readonly resources: ResourceRequirement[];
  readonly risks: RiskAssessment[];
  readonly dependencies: DependencyGraph;
}

export interface SystemArchitecture {
  readonly style: string; // e.g., "microservices", "monolithic", "layered"
  readonly components: Component[];
  readonly interfaces: SystemInterface[];
  readonly dataFlow: DataFlowDiagram;
  readonly technologyStack: TechnologyStack;
  readonly securityArchitecture?: SecurityArchitecture;
  readonly performanceArchitecture?: PerformanceArchitecture;
  readonly qualityAttributes?: string[];
  readonly deploymentStrategy?: DeploymentStrategy;
  readonly monitoringStrategy?: MonitoringStrategy;
}

export interface Component {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly responsibilities: string[];
  readonly dependencies: string[];
  readonly interfaces: string[];
}

export interface SystemInterface {
  readonly id: string;
  readonly name: string;
  readonly type: 'api' | 'ui' | 'data' | 'integration';
  readonly protocol: string;
  readonly specification: string;
}

export interface DataFlowDiagram {
  readonly nodes: DataFlowNode[];
  readonly edges: DataFlowEdge[];
}

export interface DataFlowNode {
  readonly id: string;
  readonly type: 'process' | 'datastore' | 'external';
  readonly name: string;
}

export interface DataFlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly dataType: string;
}

export interface TechnologyStack {
  readonly languages: string[];
  readonly frameworks: string[];
  readonly databases: string[];
  readonly infrastructure: string[];
  readonly tools: string[];
}

export interface SecurityArchitecture {
  readonly authentication?: {
    readonly method: string;
    readonly tokenExpiry: string;
    readonly refreshToken: string;
    readonly mfa: string;
  };
  readonly authorization?: {
    readonly model: string;
    readonly permissions: string[];
    readonly roles: string[];
  };
  readonly dataProtection: {
    readonly encryption: string;
    readonly encryptionAtRest: boolean;
    readonly encryptionInTransit: boolean;
    readonly keyManagement: string;
  };
  readonly apiSecurity?: {
    readonly rateLimiting: boolean;
    readonly cors: string;
    readonly inputValidation: string;
    readonly outputSanitization: boolean;
  };
  readonly monitoring: {
    readonly auditLogs: boolean;
    readonly securityEvents: boolean;
    readonly alerting: string;
  };
}

export interface PerformanceArchitecture {
  readonly caching: {
    readonly levels: string[];
    readonly strategy: string;
    readonly ttl: string;
  };
  readonly loadBalancing?: {
    readonly algorithm: string;
    readonly healthChecks: boolean;
    readonly failover: string;
  };
  readonly database: {
    readonly connectionPooling: boolean;
    readonly indexing: string;
    readonly replication?: string;
  };
  readonly monitoring: {
    readonly responseTime: boolean;
    readonly throughput: boolean;
    readonly errorRate: boolean;
    readonly resourceUsage: boolean;
  };
}

export interface DeploymentStrategy {
  readonly strategy: string;
  readonly containerization: string;
  readonly orchestration: string;
  readonly cicd: {
    readonly pipeline: string;
    readonly stages: string[];
    readonly environments: string[];
  };
  readonly monitoring: {
    readonly healthChecks: boolean;
    readonly metricsCollection: boolean;
    readonly logAggregation: boolean;
  };
}

export interface MonitoringStrategy {
  readonly applicationMonitoring: {
    readonly metrics: string[];
    readonly alerts: string[];
    readonly dashboards: string[];
  };
  readonly infrastructureMonitoring: {
    readonly metrics: string[];
    readonly alerts: string[];
    readonly tools: string[];
  };
  readonly logging: {
    readonly levels: string[];
    readonly aggregation: string;
    readonly retention: string;
  };
  readonly tracing?: {
    readonly distributed: boolean;
    readonly sampling: string;
    readonly tool: string;
  };
}

export interface DevelopmentPhase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly deliverables: string[];
  readonly duration: number; // in days
  readonly dependencies: string[];
  readonly parallelizable: boolean;
}

export interface Timeline {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly milestones: Milestone[];
  readonly criticalPath: string[];
}

export interface Milestone {
  readonly id: string;
  readonly name: string;
  readonly date: Date;
  readonly deliverables: string[];
  readonly criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceRequirement {
  readonly type: 'human' | 'hardware' | 'software' | 'service';
  readonly name: string;
  readonly quantity: number;
  readonly duration: number;
  readonly cost?: number;
  readonly availability?: string;
}

export interface RiskAssessment {
  readonly id: string;
  readonly description: string;
  readonly probability: number; // 0-1
  readonly impact: number; // 0-1
  readonly mitigation: string;
  readonly contingency: string;
  readonly owner: string;
}

export interface DependencyGraph {
  readonly nodes: DependencyNode[];
  readonly edges: DependencyEdge[];
  readonly criticalPath: string[];
}

export interface DependencyNode {
  readonly id: string;
  readonly name: string;
  readonly type: 'task' | 'milestone' | 'resource' | 'external';
  readonly duration: number;
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  readonly lag: number;
}

export interface Task {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: 'development' | 'testing' | 'documentation' | 'review' | 'deployment';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly estimatedHours: number;
  readonly dependencies: string[];
  readonly assignee?: string;
  readonly status: TaskStatus;
  readonly acceptance: AcceptanceCriteria[];
  readonly testable: boolean;
  readonly parallelizable: boolean;
}

export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'review' | 'completed' | 'cancelled';

export interface AcceptanceCriteria {
  readonly id: string;
  readonly description: string;
  readonly type: 'functional' | 'technical' | 'usability' | 'performance' | 'security';
  readonly testMethod: string;
  readonly priority: 'must' | 'should' | 'could';
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly score: number; // 0-1
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
  readonly metrics: ValidationMetrics;
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly location?: string;
  readonly suggestion?: string;
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly location?: string;
  readonly recommendation?: string;
}

export interface ValidationMetrics {
  readonly consistency: number; // 0-1
  readonly completeness: number; // 0-1
  readonly clarity: number; // 0-1
  readonly correctness: number; // 0-1
  readonly determinism: number; // 0-1
}

export interface WorkflowState {
  readonly currentPhase: WorkflowPhase;
  readonly context: ResolvedIntent | null;
  readonly specification: Specification | null;
  readonly plan: ImplementationPlan | null;
  readonly tasks: Task[] | null;
  readonly validationHistory: ValidationResult[];
  readonly metadata: WorkflowMetadata;
}

export type WorkflowPhase = 
  | 'ambiguity-resolution'
  | 'specification-generation'
  | 'planning'
  | 'tasking'
  | 'verification'
  | 'iteration'
  | 'evolution'
  | 'completed';

export interface WorkflowMetadata {
  readonly sessionId: string;
  readonly startTime: Date;
  readonly lastUpdated: Date;
  readonly iterations: number;
  readonly totalValidations: number;
  readonly qualityScore: number;
}

// Configuration interfaces
export interface AISDDConfig {
  readonly validation: ValidationConfig;
  readonly llm: LLMConfig;
  readonly critics: CriticsConfig;
  readonly quality: QualityConfig;
}

export interface ValidationConfig {
  readonly multiRunCount: number;
  readonly consensusThreshold: number;
  readonly maxIterations: number;
  readonly enableCritics: boolean;
}

export interface LLMConfig {
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeout: number;
}

export interface CriticsConfig {
  readonly enabled: boolean;
  readonly tools: string[];
  readonly thresholds: Record<string, number>;
}

export interface QualityConfig {
  readonly minCompleteness: number;
  readonly minClarity: number;
  readonly minCorrectness: number;
  readonly minConsistency: number;
}

// Error types
export class AISDDError extends Error {
  readonly code: string;
  readonly phase: WorkflowPhase;
  readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, phase: WorkflowPhase, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AISDDError';
    this.code = code;
    this.phase = phase;
    this.context = context ?? {};
  }
}

export class ValidationErrorClass extends AISDDError {
  constructor(message: string, phase: WorkflowPhase, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', phase, context);
    this.name = 'ValidationErrorClass';
  }
}

export class ConsensusError extends AISDDError {
  constructor(message: string, phase: WorkflowPhase, context?: Record<string, unknown>) {
    super(message, 'CONSENSUS_ERROR', phase, context);
    this.name = 'ConsensusError';
  }
}
