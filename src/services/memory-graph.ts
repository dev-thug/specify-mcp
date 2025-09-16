/**
 * Memory graph integration for task dependencies and workflow state
 */

import type {
  Task,
  ImplementationPlan,
  Specification,
  AmbiguityResolution,
} from '../types/index.js';

export interface GraphEntity {
  readonly name: string;
  readonly entityType: string;
  readonly observations: string[];
}

export interface GraphRelation {
  readonly from: string;
  readonly to: string;
  readonly relationType: string;
}

export interface WorkflowGraph {
  entities: GraphEntity[];
  relations: GraphRelation[];
}

export class MemoryGraph {
  private entities: Map<string, GraphEntity> = new Map();
  private relations: GraphRelation[] = [];

  /**
   * Build workflow graph from AI-SDD components
   */
  buildWorkflowGraph(
    resolution: AmbiguityResolution | null,
    specification: Specification | null,
    plan: ImplementationPlan | null,
    tasks: Task[]
  ): WorkflowGraph {
    this.clear();

    // Add resolution entity
    if (resolution) {
      this.addResolutionEntity(resolution);
    }

    // Add specification entities
    if (specification) {
      this.addSpecificationEntities(specification);
    }

    // Add plan entities
    if (plan) {
      this.addPlanEntities(plan);
    }

    // Add task entities
    if (tasks.length > 0) {
      this.addTaskEntities(tasks);
    }

    // Build relations
    this.buildRelations(resolution, specification, plan, tasks);

    return {
      entities: Array.from(this.entities.values()),
      relations: this.relations,
    };
  }

  /**
   * Add resolution entity
   */
  private addResolutionEntity(resolution: AmbiguityResolution): void {
    const entity: GraphEntity = {
      name: 'Requirements',
      entityType: 'prd',
      observations: [
        `Original: ${resolution.originalIntent}`,
        `Resolved: ${resolution.resolvedIntent}`,
        ...resolution.clarifications.map(c => `Clarification: ${c}`),
        ...resolution.assumptions.map(a => `Assumption: ${a}`),
      ],
    };
    this.entities.set('requirements', entity);
  }

  /**
   * Add specification entities
   */
  private addSpecificationEntities(specification: Specification): void {
    // Main specification entity
    const specEntity: GraphEntity = {
      name: specification.title,
      entityType: 'specification',
      observations: [
        specification.description,
        `Version: ${specification.version}`,
        `Status: ${specification.status}`,
      ],
    };
    this.entities.set(specification.id, specEntity);

    // Functional requirements
    specification.functionalRequirements.forEach(req => {
      const reqEntity: GraphEntity = {
        name: req.description,
        entityType: 'functional_requirement',
        observations: [
          `Priority: ${req.priority}`,
          ...req.acceptance.map(a => `Acceptance: ${a}`),
        ],
      };
      this.entities.set(req.id, reqEntity);
    });

    // Non-functional requirements
    specification.nonFunctionalRequirements.forEach(req => {
      const reqEntity: GraphEntity = {
        name: req.description,
        entityType: 'nonfunctional_requirement',
        observations: [
          `Priority: ${req.priority}`,
          ...req.acceptance.map(a => `Acceptance: ${a}`),
        ],
      };
      this.entities.set(req.id, reqEntity);
    });
  }

  /**
   * Add plan entities
   */
  private addPlanEntities(plan: ImplementationPlan): void {
    // Main plan entity
    const planEntity: GraphEntity = {
      name: 'Implementation Plan',
      entityType: 'plan',
      observations: [
        `Team Size: ${plan.teamSize}`,
        `Duration: ${plan.estimatedDuration} days`,
        `Risk Level: ${plan.riskAssessment.overallLevel}`,
      ],
    };
    this.entities.set(plan.id, planEntity);

    // Phase entities
    plan.phases.forEach(phase => {
      const phaseEntity: GraphEntity = {
        name: phase.name,
        entityType: 'phase',
        observations: [
          phase.description,
          `Duration: ${phase.duration} days`,
          `Tasks: ${phase.tasks.length}`,
        ],
      };
      this.entities.set(phase.id, phaseEntity);
    });

    // Risk entities
    plan.riskAssessment.risks.forEach(risk => {
      const riskEntity: GraphEntity = {
        name: risk.description,
        entityType: 'risk',
        observations: [
          `Probability: ${(risk.probability * 100).toFixed(0)}%`,
          `Impact: ${(risk.impact * 100).toFixed(0)}%`,
          `Mitigation: ${risk.mitigation}`,
        ],
      };
      this.entities.set(risk.id, riskEntity);
    });
  }

  /**
   * Add task entities
   */
  private addTaskEntities(tasks: Task[]): void {
    tasks.forEach(task => {
      const taskEntity: GraphEntity = {
        name: task.title,
        entityType: 'task',
        observations: [
          task.description,
          `Status: ${task.status}`,
          `Priority: ${task.priority}`,
          `Estimated: ${task.estimatedHours}h`,
          `Testable: ${task.testable}`,
          ...task.acceptance.map(a => `Acceptance: ${a}`),
        ],
      };
      this.entities.set(task.id, taskEntity);
    });
  }

  /**
   * Build relations between entities
   */
  private buildRelations(
    resolution: AmbiguityResolution | null,
    specification: Specification | null,
    plan: ImplementationPlan | null,
    tasks: Task[]
  ): void {
    // Requirements -> Specification
    if (resolution && specification) {
      this.relations.push({
        from: 'requirements',
        to: specification.id,
        relationType: 'generates',
      });
    }

    // Specification -> Plan
    if (specification && plan) {
      this.relations.push({
        from: specification.id,
        to: plan.id,
        relationType: 'generates',
      });

      // Requirements -> Plan phases
      specification.functionalRequirements.forEach(req => {
        const implementTask = `task-impl-${req.id}`;
        const phase = plan.phases.find(p => p.tasks.includes(implementTask));
        if (phase) {
          this.relations.push({
            from: req.id,
            to: phase.id,
            relationType: 'implemented_in',
          });
        }
      });
    }

    // Plan -> Phases
    if (plan) {
      plan.phases.forEach(phase => {
        this.relations.push({
          from: plan.id,
          to: phase.id,
          relationType: 'contains',
        });

        // Phase dependencies
        phase.dependencies.forEach(depId => {
          this.relations.push({
            from: depId,
            to: phase.id,
            relationType: 'blocks',
          });
        });
      });

      // Dependency graph relations
      if (plan.dependencies) {
        plan.dependencies.edges.forEach(edge => {
          if (this.entities.has(edge.from) && this.entities.has(edge.to)) {
            this.relations.push({
              from: edge.from,
              to: edge.to,
              relationType: edge.type,
            });
          }
        });
      }
    }

    // Task dependencies
    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (this.entities.has(depId)) {
          this.relations.push({
            from: depId,
            to: task.id,
            relationType: 'depends_on',
          });
        }
      });
    });
  }

  /**
   * Get graph statistics
   */
  getStatistics(): {
    totalEntities: number;
    totalRelations: number;
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  } {
    const entityTypes: Record<string, number> = {};
    const relationTypes: Record<string, number> = {};

    this.entities.forEach(entity => {
      entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
    });

    this.relations.forEach(relation => {
      relationTypes[relation.relationType] = (relationTypes[relation.relationType] || 0) + 1;
    });

    return {
      totalEntities: this.entities.size,
      totalRelations: this.relations.length,
      entityTypes,
      relationTypes,
    };
  }

  /**
   * Find critical path through tasks
   */
  findCriticalPath(tasks: Task[]): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    // Find tasks with no dependencies (starting points)
    const startTasks = tasks.filter(t => t.dependencies.length === 0);

    // DFS to find longest path
    const dfs = (taskId: string, currentPath: string[]): string[] => {
      if (visited.has(taskId)) return currentPath;
      
      visited.add(taskId);
      currentPath.push(taskId);

      // Find tasks that depend on this one
      const dependentTasks = tasks.filter(t => 
        t.dependencies.includes(taskId)
      );

      if (dependentTasks.length === 0) {
        return currentPath;
      }

      let longestPath = currentPath;
      dependentTasks.forEach(depTask => {
        const newPath = dfs(depTask.id, [...currentPath]);
        if (newPath.length > longestPath.length) {
          longestPath = newPath;
        }
      });

      return longestPath;
    };

    // Find longest path from each starting point
    startTasks.forEach(task => {
      visited.clear();
      const taskPath = dfs(task.id, []);
      if (taskPath.length > path.length) {
        path.length = 0;
        path.push(...taskPath);
      }
    });

    return path;
  }

  /**
   * Export graph as Mermaid diagram
   */
  exportAsMermaid(): string {
    let mermaid = 'graph TD\n';

    // Add entities as nodes
    this.entities.forEach((entity, id) => {
      const nodeId = id.replace(/[^a-zA-Z0-9]/g, '_');
      const label = entity.name.replace(/"/g, '\\"');
      mermaid += `    ${nodeId}["${label}"]\n`;
    });

    // Add relations as edges
    this.relations.forEach(relation => {
      const fromId = relation.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = relation.to.replace(/[^a-zA-Z0-9]/g, '_');
      mermaid += `    ${fromId} -->|${relation.relationType}| ${toId}\n`;
    });

    return mermaid;
  }

  /**
   * Clear graph
   */
  private clear(): void {
    this.entities.clear();
    this.relations = [];
  }
}
