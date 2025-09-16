/**
 * Core types for Specify MCP Server
 */

export interface ProjectContext {
  readonly projectPath: string;
  readonly projectType: 'new' | 'existing';
  readonly name: string;
  readonly description?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AmbiguityResolution {
  readonly originalIntent: string;
  readonly resolvedIntent: string;
  readonly clarifications: string[];
  readonly assumptions: string[];
  readonly constraints: string[];
}

export interface Specification {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly functionalRequirements: Requirement[];
  readonly nonFunctionalRequirements: Requirement[];
  readonly formalSpec?: FormalSpecification;
  readonly version: string;
  readonly status: 'draft' | 'review' | 'approved';
}

export interface Requirement {
  readonly id: string;
  readonly description: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly acceptance: string[];
  readonly dependencies: string[];
}

export interface FormalSpecification {
  readonly preconditions: string[];
  readonly postconditions: string[];
  readonly invariants: string[];
  readonly acslSpec?: string;
}

export interface ImplementationPlan {
  readonly id: string;
  readonly phases: Phase[];
  readonly dependencies: DependencyGraph;
  readonly riskAssessment: RiskAssessment;
  readonly estimatedDuration: number;
  readonly teamSize: number;
}

export interface Phase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tasks: string[];
  readonly duration: number;
  readonly dependencies: string[];
}

export interface DependencyGraph {
  readonly nodes: DependencyNode[];
  readonly edges: DependencyEdge[];
}

export interface DependencyNode {
  readonly id: string;
  readonly type: 'task' | 'phase' | 'milestone';
  readonly name: string;
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly type: 'depends_on' | 'blocks' | 'relates_to';
}

export interface RiskAssessment {
  readonly risks: Risk[];
  readonly overallLevel: 'low' | 'medium' | 'high';
}

export interface Risk {
  readonly id: string;
  readonly description: string;
  readonly probability: number;
  readonly impact: number;
  readonly mitigation: string;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  readonly priority: 'high' | 'medium' | 'low';
  readonly assignee?: string;
  readonly dependencies: string[];
  readonly estimatedHours: number;
  readonly acceptance: string[];
  readonly testable: boolean;
}

export interface SpecifyDocument {
  readonly path: string;
  readonly type: 'prd' | 'spec' | 'plan' | 'task' | 'context';
  readonly content: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  readonly version: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly author: string;
  readonly status: string;
  readonly tags: string[];
}
