/**
 * Service for creating implementation plans with risk assessment
 */

import type {
  ImplementationPlan,
  Phase,
  DependencyGraph,
  RiskAssessment,
  Risk,
  Specification,
  DependencyNode,
  DependencyEdge,
} from '../types/index.js';
import { RISK_TOLERANCE, DEFAULT_PLANNING_HORIZON, DEFAULT_TEAM_SIZE } from '../constants/index.js';

export class ImplementationPlanner {
  /**
   * Create implementation plan from specification
   */
  async createPlan(
    specification: Specification,
    teamSize: number = DEFAULT_TEAM_SIZE,
    planningHorizon: number = DEFAULT_PLANNING_HORIZON,
    riskTolerance: keyof typeof RISK_TOLERANCE = 'MEDIUM',
    includeDependencyGraph = true
  ): Promise<ImplementationPlan> {
    const phases = this.generatePhases(specification, teamSize);
    const dependencies = includeDependencyGraph 
      ? this.buildDependencyGraph(phases, specification)
      : { nodes: [], edges: [] };
    const riskAssessment = this.assessRisks(specification, phases, riskTolerance);
    const estimatedDuration = this.calculateDuration(phases);

    return {
      id: this.generateId(),
      phases: this.optimizePhases(phases, dependencies),
      dependencies,
      riskAssessment,
      estimatedDuration: Math.min(estimatedDuration, planningHorizon),
      teamSize,
    };
  }

  /**
   * Generate implementation phases
   */
  private generatePhases(specification: Specification, teamSize: number): Phase[] {
    const phases: Phase[] = [];

    // Phase 1: Setup and Architecture
    phases.push({
      id: 'phase-1',
      name: 'Setup and Architecture',
      description: 'Project initialization, architecture design, and environment setup',
      tasks: [
        'task-init-project',
        'task-setup-dev-env',
        'task-design-architecture',
        'task-setup-ci-cd',
      ],
      duration: Math.ceil(3 / teamSize),
      dependencies: [],
    });

    // Phase 2: Core Development
    const coreTasks: string[] = [];
    specification.functionalRequirements.forEach((req) => {
      if (req.priority === 'high') {
        coreTasks.push(`task-impl-${req.id}`);
      }
    });

    if (coreTasks.length > 0) {
      phases.push({
        id: 'phase-2',
        name: 'Core Development',
        description: 'Implementation of core functional requirements',
        tasks: coreTasks,
        duration: Math.ceil(coreTasks.length * 2 / teamSize),
        dependencies: ['phase-1'],
      });
    }

    // Phase 3: Extended Features
    const extendedTasks: string[] = [];
    specification.functionalRequirements.forEach(req => {
      if (req.priority !== 'high') {
        extendedTasks.push(`task-impl-${req.id}`);
      }
    });

    if (extendedTasks.length > 0) {
      phases.push({
        id: 'phase-3',
        name: 'Extended Features',
        description: 'Implementation of additional features',
        tasks: extendedTasks,
        duration: Math.ceil(extendedTasks.length * 1.5 / teamSize),
        dependencies: ['phase-2'],
      });
    }

    // Phase 4: Non-functional Requirements
    const nfrTasks = specification.nonFunctionalRequirements.map(req => `task-nfr-${req.id}`);
    
    phases.push({
      id: 'phase-4',
      name: 'Non-functional Requirements',
      description: 'Performance optimization, security hardening, and quality improvements',
      tasks: nfrTasks,
      duration: Math.ceil(nfrTasks.length * 1.5 / teamSize),
      dependencies: coreTasks.length > 0 ? ['phase-2'] : ['phase-1'],
    });

    // Phase 5: Testing and Validation
    phases.push({
      id: 'phase-5',
      name: 'Testing and Validation',
      description: 'Comprehensive testing, validation, and bug fixes',
      tasks: [
        'task-unit-testing',
        'task-integration-testing',
        'task-performance-testing',
        'task-security-testing',
        'task-user-acceptance',
      ],
      duration: Math.ceil(5 / teamSize),
      dependencies: ['phase-3', 'phase-4'].filter(p => phases.some(ph => ph.id === p)),
    });

    // Phase 6: Deployment
    phases.push({
      id: 'phase-6',
      name: 'Deployment and Release',
      description: 'Production deployment, monitoring setup, and documentation',
      tasks: [
        'task-prepare-deployment',
        'task-deploy-production',
        'task-setup-monitoring',
        'task-documentation',
      ],
      duration: Math.ceil(2 / teamSize),
      dependencies: ['phase-5'],
    });

    return phases;
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(
    phases: Phase[],
    specification: Specification
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Add phase nodes
    phases.forEach(phase => {
      nodes.push({
        id: phase.id,
        type: 'phase',
        name: phase.name,
      });

      // Add task nodes
      phase.tasks.forEach(taskId => {
        nodes.push({
          id: taskId,
          type: 'task',
          name: this.getTaskName(taskId, specification),
        });

        // Task depends on phase
        edges.push({
          from: phase.id,
          to: taskId,
          type: 'depends_on',
        });
      });

      // Add phase dependencies
      phase.dependencies.forEach(depId => {
        edges.push({
          from: depId,
          to: phase.id,
          type: 'blocks',
        });
      });
    });

    // Add requirement-based dependencies
    specification.functionalRequirements.forEach(req => {
      req.dependencies.forEach(depId => {
        const fromTask = `task-impl-${depId}`;
        const toTask = `task-impl-${req.id}`;
        
        if (nodes.some(n => n.id === fromTask) && nodes.some(n => n.id === toTask)) {
          edges.push({
            from: fromTask,
            to: toTask,
            type: 'depends_on',
          });
        }
      });
    });

    return { nodes, edges };
  }

  /**
   * Assess risks
   */
  private assessRisks(
    specification: Specification,
    phases: Phase[],
    riskTolerance: keyof typeof RISK_TOLERANCE
  ): RiskAssessment {
    const risks: Risk[] = [];

    // Technical complexity risk
    const complexityScore = specification.functionalRequirements.length * 0.1;
    if (complexityScore > 0.5) {
      risks.push({
        id: 'risk-1',
        description: 'High technical complexity may lead to delays',
        probability: Math.min(complexityScore, 0.8),
        impact: 0.7,
        mitigation: 'Allocate additional time for complex features, consider POC first',
      });
    }

    // Team size risk
    const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
    const taskPerPersonRatio = totalTasks / phases[0].duration;
    if (taskPerPersonRatio > 5) {
      risks.push({
        id: 'risk-2',
        description: 'Team may be overwhelmed with parallel tasks',
        probability: 0.6,
        impact: 0.6,
        mitigation: 'Consider increasing team size or extending timeline',
      });
    }

    // Dependency risk
    const criticalPath = this.findCriticalPath(phases);
    if (criticalPath.length > 4) {
      risks.push({
        id: 'risk-3',
        description: 'Long critical path may cause cascading delays',
        probability: 0.5,
        impact: 0.8,
        mitigation: 'Identify parallel work opportunities, add buffer time',
      });
    }

    // Integration risk
    if (specification.nonFunctionalRequirements.some(r => r.description.includes('integration'))) {
      risks.push({
        id: 'risk-4',
        description: 'External system integration may face compatibility issues',
        probability: 0.4,
        impact: 0.6,
        mitigation: 'Early integration testing, maintain fallback options',
      });
    }

    // Calculate overall risk level
    const avgRisk = risks.reduce((sum, r) => sum + (r.probability * r.impact), 0) / Math.max(risks.length, 1);
    const overallLevel = avgRisk > 0.6 ? 'high' : avgRisk > 0.3 ? 'medium' : 'low';

    // Filter risks based on tolerance
    const filteredRisks = this.filterRisksByTolerance(risks, riskTolerance);

    return {
      risks: filteredRisks,
      overallLevel,
    };
  }

  /**
   * Filter risks by tolerance level
   */
  private filterRisksByTolerance(
    risks: Risk[],
    tolerance: keyof typeof RISK_TOLERANCE
  ): Risk[] {
    const threshold = tolerance === 'LOW' ? 0.3 : tolerance === 'MEDIUM' ? 0.5 : 0.7;
    return risks.filter(r => r.probability * r.impact >= threshold);
  }

  /**
   * Find critical path through phases
   */
  private findCriticalPath(phases: Phase[]): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    // Simple DFS to find longest path
    const dfs = (phaseId: string): void => {
      if (visited.has(phaseId)) return;
      visited.add(phaseId);
      path.push(phaseId);
      
      const phase = phases.find(p => p.id === phaseId);
      if (phase) {
        const nextPhases = phases.filter(p => p.dependencies.includes(phaseId));
        nextPhases.forEach(next => dfs(next.id));
      }
    };
    
    // Start from phases with no dependencies
    phases.filter(p => p.dependencies.length === 0).forEach(p => dfs(p.id));
    
    return path;
  }

  /**
   * Optimize phases for parallel execution
   */
  private optimizePhases(phases: Phase[], dependencies: DependencyGraph): Phase[] {
    // Identify phases that can run in parallel
    const optimized = [...phases];
    
    optimized.forEach(phase => {
      // Check if any dependencies can be relaxed
      const canParallelize = phase.dependencies.filter(depId => {
        const depPhase = optimized.find(p => p.id === depId);
        if (!depPhase) return false;
        
        // Check if there's actual task dependency
        const hasTaskDependency = dependencies.edges.some(e => 
          e.type === 'depends_on' &&
          phase.tasks.includes(e.to) &&
          depPhase.tasks.includes(e.from)
        );
        
        return !hasTaskDependency;
      });
      
      // Remove dependencies that can be parallelized
      // Remove dependencies that can be parallelized
      const newDependencies = phase.dependencies.filter(d => !canParallelize.includes(d));
      // Create a new phase object with updated dependencies
      Object.assign(phase, { ...phase, dependencies: newDependencies });
    });
    
    return optimized;
  }

  /**
   * Calculate total duration
   */
  private calculateDuration(phases: Phase[]): number {
    // Consider parallel execution
    const parallelGroups: Phase[][] = [];
    const processed = new Set<string>();
    
    phases.forEach(phase => {
      if (processed.has(phase.id)) return;
      
      const group = [phase];
      processed.add(phase.id);
      
      // Find phases that can run in parallel
      phases.forEach(other => {
        if (processed.has(other.id)) return;
        if (other.dependencies.length === phase.dependencies.length &&
            other.dependencies.every(d => phase.dependencies.includes(d))) {
          group.push(other);
          processed.add(other.id);
        }
      });
      
      parallelGroups.push(group);
    });
    
    // Calculate duration considering parallel execution
    return parallelGroups.reduce((total, group) => {
      const maxDuration = Math.max(...group.map(p => p.duration));
      return total + maxDuration;
    }, 0);
  }

  /**
   * Get task name from ID
   */
  private getTaskName(taskId: string, specification: Specification): string {
    if (taskId.startsWith('task-impl-')) {
      const reqId = taskId.replace('task-impl-', '');
      const req = specification.functionalRequirements.find(r => r.id === reqId);
      return req ? `Implement: ${req.description}` : taskId;
    }
    
    if (taskId.startsWith('task-nfr-')) {
      const reqId = taskId.replace('task-nfr-', '');
      const req = specification.nonFunctionalRequirements.find(r => r.id === reqId);
      return req ? `Implement: ${req.description}` : taskId;
    }
    
    const taskNames: Record<string, string> = {
      'task-init-project': 'Initialize project structure',
      'task-setup-dev-env': 'Setup development environment',
      'task-design-architecture': 'Design system architecture',
      'task-setup-ci-cd': 'Setup CI/CD pipeline',
      'task-unit-testing': 'Write unit tests',
      'task-integration-testing': 'Perform integration testing',
      'task-performance-testing': 'Conduct performance testing',
      'task-security-testing': 'Execute security testing',
      'task-user-acceptance': 'User acceptance testing',
      'task-prepare-deployment': 'Prepare deployment package',
      'task-deploy-production': 'Deploy to production',
      'task-setup-monitoring': 'Setup monitoring and alerts',
      'task-documentation': 'Complete documentation',
    };
    
    return taskNames[taskId] || taskId;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
