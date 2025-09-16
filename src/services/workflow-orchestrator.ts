/**
 * Orchestrator for AI-SDD workflow
 */

import { AmbiguityResolver } from './ambiguity-resolver.js';
import { SpecificationGenerator } from './specification-generator.js';
import { ImplementationPlanner } from './implementation-planner.js';
import { TaskGenerator } from './task-generator.js';
import { FileManager } from '../utils/file-manager.js';
import { MemoryGraph } from './memory-graph.js';
import type {
  AmbiguityResolution,
  Specification,
  ImplementationPlan,
  Task,
  ProjectContext,
  SpecifyDocument,
} from '../types/index.js';
import { 
  SPECIFICATION_LEVEL,
  RISK_TOLERANCE,
  TASK_GRANULARITY,
} from '../constants/index.js';

export interface WorkflowOptions {
  specificationLevel?: keyof typeof SPECIFICATION_LEVEL;
  includeFormSpec?: boolean;
  teamSize?: number;
  planningHorizon?: number;
  riskTolerance?: keyof typeof RISK_TOLERANCE;
  includeDependencyGraph?: boolean;
  taskGranularity?: keyof typeof TASK_GRANULARITY;
  maxTasksPerPhase?: number;
  includeTestTasks?: boolean;
  prioritizeParallelization?: boolean;
}

export interface WorkflowResult {
  ambiguityResolution: AmbiguityResolution;
  specification: Specification;
  implementationPlan: ImplementationPlan;
  tasks: Task[];
  documentsCreated: string[];
}

export class WorkflowOrchestrator {
  private ambiguityResolver: AmbiguityResolver;
  private specificationGenerator: SpecificationGenerator;
  private implementationPlanner: ImplementationPlanner;
  private taskGenerator: TaskGenerator;
  private memoryGraph: MemoryGraph;
  private fileManager: FileManager | null = null;
  private currentContext: ProjectContext | null = null;
  private currentResolution: AmbiguityResolution | null = null;
  private currentSpecification: Specification | null = null;
  private currentPlan: ImplementationPlan | null = null;
  private currentTasks: Task[] = [];

  constructor(projectPath?: string) {
    this.ambiguityResolver = new AmbiguityResolver();
    this.specificationGenerator = new SpecificationGenerator();
    this.implementationPlanner = new ImplementationPlanner();
    this.taskGenerator = new TaskGenerator();
    this.memoryGraph = new MemoryGraph();
    
    if (projectPath) {
      this.fileManager = new FileManager(projectPath);
    }
  }

  /**
   * Initialize project context
   */
  async initializeProject(
    projectPath: string,
    projectType: 'new' | 'existing',
    name: string,
    description?: string
  ): Promise<ProjectContext> {
    this.fileManager = new FileManager(projectPath);
    await this.fileManager.initializeStructure();

    this.currentContext = {
      projectPath,
      projectType,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save project context
    await this.saveContext();

    return this.currentContext;
  }

  /**
   * Run full AI-SDD workflow
   */
  async runFullWorkflow(
    userIntent: string,
    domain?: string,
    constraints?: string[],
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    // Step 1: Resolve ambiguities
    const ambiguityResolution = await this.resolveAmbiguities(
      userIntent,
      domain,
      constraints,
      { projectType: this.currentContext?.projectType }
    );

    // Step 2: Generate specification
    const specification = await this.generateSpecification(
      ambiguityResolution,
      options.specificationLevel,
      options.includeFormSpec
    );

    // Step 3: Create implementation plan
    const implementationPlan = await this.createImplementationPlan(
      specification,
      options.teamSize,
      options.planningHorizon,
      options.riskTolerance,
      options.includeDependencyGraph
    );

    // Step 4: Generate tasks
    const tasks = await this.generateTasks(
      implementationPlan,
      options.taskGranularity,
      options.maxTasksPerPhase,
      options.includeTestTasks,
      options.prioritizeParallelization
    );

    // Save all documents
    const documentsCreated = await this.saveWorkflowDocuments();

    return {
      ambiguityResolution,
      specification,
      implementationPlan,
      tasks,
      documentsCreated,
    };
  }

  /**
   * Resolve ambiguities
   */
  async resolveAmbiguities(
    userIntent: string,
    domain?: string,
    constraints?: string[],
    context?: Record<string, unknown>
  ): Promise<AmbiguityResolution> {
    this.currentResolution = await this.ambiguityResolver.resolve(
      userIntent,
      domain,
      constraints,
      context
    );
    return this.currentResolution;
  }

  /**
   * Generate specification
   */
  async generateSpecification(
    resolution?: AmbiguityResolution,
    level?: keyof typeof SPECIFICATION_LEVEL,
    includeFormSpec?: boolean
  ): Promise<Specification> {
    const resolutionToUse = resolution || this.currentResolution;
    if (!resolutionToUse) {
      throw new Error('No ambiguity resolution available. Please resolve ambiguities first.');
    }

    this.currentSpecification = await this.specificationGenerator.generate(
      resolutionToUse,
      level,
      includeFormSpec
    );
    return this.currentSpecification;
  }

  /**
   * Create implementation plan
   */
  async createImplementationPlan(
    specification?: Specification,
    teamSize?: number,
    planningHorizon?: number,
    riskTolerance?: keyof typeof RISK_TOLERANCE,
    includeDependencyGraph?: boolean
  ): Promise<ImplementationPlan> {
    const specToUse = specification || this.currentSpecification;
    if (!specToUse) {
      throw new Error('No specification available. Please generate specification first.');
    }

    this.currentPlan = await this.implementationPlanner.createPlan(
      specToUse,
      teamSize,
      planningHorizon,
      riskTolerance,
      includeDependencyGraph
    );
    return this.currentPlan;
  }

  /**
   * Generate tasks
   */
  async generateTasks(
    plan?: ImplementationPlan,
    granularity?: keyof typeof TASK_GRANULARITY,
    maxTasksPerPhase?: number,
    includeTestTasks?: boolean,
    prioritizeParallelization?: boolean
  ): Promise<Task[]> {
    const planToUse = plan || this.currentPlan;
    if (!planToUse) {
      throw new Error('No implementation plan available. Please create plan first.');
    }

    this.currentTasks = await this.taskGenerator.generateTasks(
      planToUse,
      granularity,
      maxTasksPerPhase,
      includeTestTasks,
      prioritizeParallelization
    );
    return this.currentTasks;
  }

  /**
   * Get current workflow state
   */
  getCurrentState(): {
    context: ProjectContext | null;
    resolution: AmbiguityResolution | null;
    specification: Specification | null;
    plan: ImplementationPlan | null;
    tasks: Task[];
    graph?: ReturnType<MemoryGraph['buildWorkflowGraph']>;
  } {
    const graph = this.memoryGraph.buildWorkflowGraph(
      this.currentResolution,
      this.currentSpecification,
      this.currentPlan,
      this.currentTasks
    );

    return {
      context: this.currentContext,
      resolution: this.currentResolution,
      specification: this.currentSpecification,
      plan: this.currentPlan,
      tasks: this.currentTasks,
      graph,
    };
  }

  /**
   * Save workflow documents
   */
  private async saveWorkflowDocuments(): Promise<string[]> {
    if (!this.fileManager) {
      return [];
    }

    const documents: string[] = [];

    // Save PRD
    if (this.currentResolution) {
      const prdPath = await this.savePRD();
      if (prdPath) documents.push(prdPath);
    }

    // Save specification
    if (this.currentSpecification) {
      const specPath = await this.saveSpecification();
      if (specPath) documents.push(specPath);
    }

    // Save implementation plan
    if (this.currentPlan) {
      const planPath = await this.savePlan();
      if (planPath) documents.push(planPath);
    }

    // Save tasks
    if (this.currentTasks.length > 0) {
      const taskPath = await this.saveTasks();
      if (taskPath) documents.push(taskPath);
    }

    return documents;
  }

  /**
   * Save project context
   */
  private async saveContext(): Promise<string | null> {
    if (!this.fileManager || !this.currentContext) return null;

    const content = this.formatContext(this.currentContext);
    const document: SpecifyDocument = {
      path: '.specify/context/project.md',
      type: 'context',
      content,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'specify-mcp',
        status: 'active',
        tags: ['context', 'project'],
      },
    };

    await this.fileManager.saveDocument(document);
    return document.path;
  }

  /**
   * Save PRD document
   */
  private async savePRD(): Promise<string | null> {
    if (!this.fileManager || !this.currentResolution) return null;

    const content = this.formatPRD(this.currentResolution);
    const document: SpecifyDocument = {
      path: '.specify/prd/requirements.md',
      type: 'prd',
      content,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'specify-mcp',
        status: 'draft',
        tags: ['prd', 'requirements'],
      },
    };

    await this.fileManager.saveDocument(document);
    return document.path;
  }

  /**
   * Save specification document
   */
  private async saveSpecification(): Promise<string | null> {
    if (!this.fileManager || !this.currentSpecification) return null;

    const content = this.formatSpecification(this.currentSpecification);
    const document: SpecifyDocument = {
      path: '.specify/specs/specification.md',
      type: 'spec',
      content,
      metadata: {
        version: this.currentSpecification.version,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'specify-mcp',
        status: this.currentSpecification.status,
        tags: ['specification', 'technical'],
      },
    };

    await this.fileManager.saveDocument(document);
    return document.path;
  }

  /**
   * Save implementation plan
   */
  private async savePlan(): Promise<string | null> {
    if (!this.fileManager || !this.currentPlan) return null;

    const content = this.formatPlan(this.currentPlan);
    const document: SpecifyDocument = {
      path: '.specify/plans/implementation.md',
      type: 'plan',
      content,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'specify-mcp',
        status: 'active',
        tags: ['plan', 'implementation'],
      },
    };

    await this.fileManager.saveDocument(document);
    return document.path;
  }

  /**
   * Save tasks document
   */
  private async saveTasks(): Promise<string | null> {
    if (!this.fileManager || this.currentTasks.length === 0) return null;

    const content = this.formatTasks(this.currentTasks);
    const document: SpecifyDocument = {
      path: '.specify/tasks/tasks.md',
      type: 'task',
      content,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'specify-mcp',
        status: 'active',
        tags: ['tasks', 'development'],
      },
    };

    await this.fileManager.saveDocument(document);
    return document.path;
  }

  /**
   * Format context as markdown
   */
  private formatContext(context: ProjectContext): string {
    return `# Project Context

## Project Information
- **Name**: ${context.name}
- **Type**: ${context.projectType}
- **Path**: ${context.projectPath}
${context.description ? `- **Description**: ${context.description}` : ''}

## Timestamps
- **Created**: ${context.createdAt.toISOString()}
- **Updated**: ${context.updatedAt.toISOString()}
`;
  }

  /**
   * Format PRD as markdown
   */
  private formatPRD(resolution: AmbiguityResolution): string {
    return `# Product Requirements Document

## Original Intent
${resolution.originalIntent}

## Resolved Intent
${resolution.resolvedIntent}

## Clarifications
${resolution.clarifications.map(c => `- ${c}`).join('\n')}

## Assumptions
${resolution.assumptions.map(a => `- ${a}`).join('\n')}

## Constraints
${resolution.constraints.map(c => `- ${c}`).join('\n')}
`;
  }

  /**
   * Format specification as markdown
   */
  private formatSpecification(spec: Specification): string {
    let content = `# Software Specification

## Overview
- **ID**: ${spec.id}
- **Title**: ${spec.title}
- **Version**: ${spec.version}
- **Status**: ${spec.status}

## Description
${spec.description}

## Functional Requirements
`;

    spec.functionalRequirements.forEach(req => {
      content += `
### ${req.id}: ${req.description}
- **Priority**: ${req.priority}
- **Dependencies**: ${req.dependencies.join(', ') || 'None'}
- **Acceptance Criteria**:
${req.acceptance.map(a => `  - ${a}`).join('\n')}
`;
    });

    content += `
## Non-Functional Requirements
`;

    spec.nonFunctionalRequirements.forEach(req => {
      content += `
### ${req.id}: ${req.description}
- **Priority**: ${req.priority}
- **Dependencies**: ${req.dependencies.join(', ') || 'None'}
- **Acceptance Criteria**:
${req.acceptance.map(a => `  - ${a}`).join('\n')}
`;
    });

    if (spec.formalSpec) {
      content += `
## Formal Specification

### Preconditions
${spec.formalSpec.preconditions.map(p => `- ${p}`).join('\n')}

### Postconditions
${spec.formalSpec.postconditions.map(p => `- ${p}`).join('\n')}

### Invariants
${spec.formalSpec.invariants.map(i => `- ${i}`).join('\n')}

${spec.formalSpec.acslSpec ? `### ACSL Specification
\`\`\`c
${spec.formalSpec.acslSpec}
\`\`\`` : ''}
`;
    }

    return content;
  }

  /**
   * Format plan as markdown
   */
  private formatPlan(plan: ImplementationPlan): string {
    let content = `# Implementation Plan

## Overview
- **ID**: ${plan.id}
- **Team Size**: ${plan.teamSize}
- **Estimated Duration**: ${plan.estimatedDuration} days
- **Risk Level**: ${plan.riskAssessment.overallLevel}

## Phases
`;

    plan.phases.forEach(phase => {
      content += `
### ${phase.name}
- **ID**: ${phase.id}
- **Duration**: ${phase.duration} days
- **Dependencies**: ${phase.dependencies.join(', ') || 'None'}
- **Description**: ${phase.description}
- **Tasks**: ${phase.tasks.length} tasks
`;
    });

    content += `
## Risk Assessment
`;

    plan.riskAssessment.risks.forEach(risk => {
      content += `
### ${risk.id}
- **Description**: ${risk.description}
- **Probability**: ${(risk.probability * 100).toFixed(0)}%
- **Impact**: ${(risk.impact * 100).toFixed(0)}%
- **Mitigation**: ${risk.mitigation}
`;
    });

    return content;
  }

  /**
   * Format tasks as markdown
   */
  private formatTasks(tasks: Task[]): string {
    let content = `# Task List

## Summary
- **Total Tasks**: ${tasks.length}
- **High Priority**: ${tasks.filter(t => t.priority === 'high').length}
- **Medium Priority**: ${tasks.filter(t => t.priority === 'medium').length}
- **Low Priority**: ${tasks.filter(t => t.priority === 'low').length}

## Tasks
`;

    tasks.forEach(task => {
      content += `
### ${task.title}
- **ID**: ${task.id}
- **Status**: ${task.status}
- **Priority**: ${task.priority}
- **Estimated Hours**: ${task.estimatedHours}
- **Testable**: ${task.testable ? 'Yes' : 'No'}
- **Dependencies**: ${task.dependencies.join(', ') || 'None'}

**Description**: ${task.description}

**Acceptance Criteria**:
${task.acceptance.map(a => `- ${a}`).join('\n')}
`;
    });

    return content;
  }
}
