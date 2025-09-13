import { z } from 'zod';
import { WorkflowStageSchema, MetricsSchema } from './mcp.js';

// AI-SDD Workflow Specific Types
export const AmbiguityResolutionSchema = z.object({
  originalQuery: z.string(),
  identifiedAmbiguities: z.array(z.object({
    type: z.enum(['semantic', 'syntactic', 'contextual']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high'])
  })),
  clarificationQuestions: z.array(z.string()),
  resolvedQuery: z.string(),
  confidence: z.number().min(0).max(1)
});

export const SpecificationSchema = z.object({
  functionalRequirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    testCriteria: z.array(z.string())
  })),
  nonFunctionalRequirements: z.array(z.object({
    type: z.enum(['performance', 'security', 'usability', 'reliability']),
    description: z.string(),
    metrics: z.record(z.any())
  })),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string()),
  interfaceDefinitions: z.array(z.object({
    name: z.string(),
    type: z.enum(['api', 'ui', 'database', 'external']),
    specification: z.record(z.any())
  }))
});

export const PlanSchema = z.object({
  architecture: z.object({
    pattern: z.string(),
    components: z.array(z.object({
      name: z.string(),
      type: z.string(),
      responsibilities: z.array(z.string()),
      dependencies: z.array(z.string())
    })),
    dataFlow: z.array(z.object({
      from: z.string(),
      to: z.string(),
      data: z.string(),
      protocol: z.string()
    }))
  }),
  implementationStrategy: z.object({
    approach: z.enum(['incremental', 'big-bang', 'parallel', 'phased']),
    phases: z.array(z.object({
      name: z.string(),
      duration: z.string(),
      deliverables: z.array(z.string()),
      dependencies: z.array(z.string())
    }))
  }),
  riskAssessment: z.array(z.object({
    risk: z.string(),
    probability: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    mitigation: z.string()
  }))
});

export const TaskSchema: z.ZodLazy<z.ZodObject<any>> = z.lazy(() => z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
  assignee: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().optional(),
  subtasks: z.array(TaskSchema).optional(),
  metadata: z.record(z.any()).optional()
}));

export const TaskListSchema = z.object({
  projectId: z.string(),
  version: z.string(),
  tasks: z.array(TaskSchema),
  metadata: z.object({
    totalTasks: z.number(),
    completedTasks: z.number(),
    estimatedCompletion: z.string().optional(),
    lastUpdated: z.string()
  })
});

export const VerificationResultSchema = z.object({
  testResults: z.array(z.object({
    testId: z.string(),
    testName: z.string(),
    status: z.enum(['passed', 'failed', 'skipped', 'error']),
    details: z.string().optional(),
    executionTime: z.number().optional()
  })),
  codeQuality: z.object({
    complexity: z.number(),
    coverage: z.number(),
    violations: z.array(z.object({
      rule: z.string(),
      severity: z.enum(['info', 'warning', 'error']),
      file: z.string(),
      line: z.number().optional(),
      message: z.string()
    }))
  }),
  complianceCheck: z.object({
    specificationCompliance: z.number(),
    requirementsCoverage: z.number(),
    issues: z.array(z.object({
      type: z.enum(['missing', 'deviation', 'enhancement']),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high'])
    }))
  })
});

export const EvolutionSuggestionSchema = z.object({
  type: z.enum(['optimization', 'feature', 'refactoring', 'security', 'performance']),
  description: z.string(),
  rationale: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
  priority: z.number().min(1).max(10),
  suggestedImplementation: z.string().optional()
});

export const WorkflowExecutionSchema = z.object({
  sessionId: z.string(),
  currentStage: WorkflowStageSchema,
  stageResults: z.record(z.any()),
  overallMetrics: MetricsSchema,
  executionHistory: z.array(z.object({
    stage: WorkflowStageSchema,
    timestamp: z.string(),
    duration: z.number(),
    result: z.any(),
    metrics: MetricsSchema
  })),
  status: z.enum(['running', 'completed', 'failed', 'paused']),
  errorInfo: z.object({
    stage: WorkflowStageSchema,
    error: z.string(),
    timestamp: z.string()
  }).optional()
});

// Workflow Stage Input/Output Interfaces
export const StageInputSchema = z.object({
  sessionId: z.string(),
  previousStageOutput: z.any().optional(),
  userInput: z.any(),
  context: z.record(z.any()).optional(),
  preferences: z.record(z.any()).optional()
});

export const StageOutputSchema = z.object({
  result: z.any(),
  metrics: MetricsSchema,
  nextStageReady: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

// Type exports
export type AmbiguityResolution = z.infer<typeof AmbiguityResolutionSchema>;
export type Specification = z.infer<typeof SpecificationSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskList = z.infer<typeof TaskListSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
export type EvolutionSuggestion = z.infer<typeof EvolutionSuggestionSchema>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export type StageInput = z.infer<typeof StageInputSchema>;
export type StageOutput = z.infer<typeof StageOutputSchema>;

// Stage-specific input/output types
export interface AmbiguityInput {
  request: string;
  context?: any;
}

export interface AmbiguityOutput {
  identifiedAmbiguities: Array<{
    id: string;
    type: 'semantic' | 'syntactic' | 'pragmatic' | 'contextual';
    description: string;
    location: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    examples?: string[];
  }>;
  clarifyingQuestions: Array<{
    id: string;
    ambiguityId: string;
    question: string;
    type: 'yes_no' | 'multiple_choice' | 'open_ended' | 'quantitative';
    priority: 'low' | 'medium' | 'high' | 'critical';
    suggestedAnswers?: string[];
  }>;
  resolutionStrategies: Array<{
    id: string;
    ambiguityId: string;
    strategy: string;
    confidence: number;
    reasoning: string;
  }>;
  assumptions: Array<{
    id: string;
    ambiguityId: string;
    assumption: string;
    rationale: string;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    validationMethod: string;
  }>;
  clarifiedRequest: string;
  confidence: number;
}

export interface SpecificationInput {
  originalRequest: string;
  ambiguityResolution?: AmbiguityOutput;
}

export interface SpecificationOutput {
  functionalRequirements: any[];
  nonFunctionalRequirements: any[];
  systemBoundaries: any;
  interfaces: any[];
  dataModels: any[];
  businessRules: any[];
  constraints: any[];
  acceptanceCriteria: any[];
  traceabilityMatrix: Record<string, any>;
  completenessScore: number;
}

export interface PlanningInput {
  specification?: SpecificationOutput;
}

export interface PlanningOutput {
  phases: any[];
  workBreakdownStructure: any[];
  timeline: any;
  effortEstimates: any;
  resourceRequirements: any[];
  dependencies: any[];
  riskAssessment: any[];
  milestones: any[];
  planningMetrics: {
    totalEffort: number;
    criticalPathDuration: number;
    riskScore: number;
    complexityScore: number;
  };
}

export interface TaskingInput {
  plan?: PlanningOutput;
}

export interface TaskingOutput {
  detailedTasks: any[];
  taskAssignments: any[];
  implementationStrategies: any[];
  qualityGates: any[];
  successCriteria: any[];
  monitoringFramework: any;
  taskingMetrics: {
    totalTasks: number;
    averageTaskComplexity: number;
    estimatedVelocity: number;
    riskDistribution: Record<string, number>;
  };
}

export interface VerificationInput {
  specification?: SpecificationOutput;
  tasking?: TaskingOutput;
}

export interface VerificationOutput {
  testResults: any[];
  requirementValidation: Record<string, any>;
  qualityAssessment: any;
  complianceResults: any[];
  verificationReport: any;
  issues: any[];
  recommendations: any[];
  overallVerificationStatus: 'passed' | 'passed_with_issues' | 'failed';
  verificationMetrics: {
    testPassRate: number;
    requirementCoverage: number;
    qualityScore: number;
    complianceScore: number;
  };
}

export interface EvolutionInput {
  verification?: VerificationOutput;
}

export interface EvolutionOutput {
  systemAnalysis: any;
  improvementOpportunities: any[];
  enhancements: any[];
  futureIterations: any[];
  scalabilityAssessment: any;
  lessonsLearned: any[];
  evolutionRoadmap: any;
  evolutionMetrics: {
    maturityScore: number;
    improvementPotential: number;
    evolutionReadiness: number;
  };
}

// Stage-specific type mappings
export interface WorkflowStageTypes {
  ambiguity: {
    input: AmbiguityInput;
    output: AmbiguityOutput;
  };
  specification: {
    input: SpecificationInput;
    output: SpecificationOutput;
  };
  planning: {
    input: PlanningInput;
    output: PlanningOutput;
  };
  tasking: {
    input: TaskingInput;
    output: TaskingOutput;
  };
  verification: {
    input: VerificationInput;
    output: VerificationOutput;
  };
  evolution: {
    input: EvolutionInput;
    output: EvolutionOutput;
  };
}
