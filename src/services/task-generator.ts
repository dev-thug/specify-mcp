/**
 * Service for generating SMART tasks with quality enhancement
 */

import type {
  Task,
  ImplementationPlan,
  Phase,
} from '../types/index.js';
import { 
  TASK_GRANULARITY, 
  MAX_TASKS_PER_PHASE,
} from '../constants/index.js';

export class TaskGenerator {
  /**
   * Generate tasks from implementation plan
   */
  async generateTasks(
    plan: ImplementationPlan,
    granularity: keyof typeof TASK_GRANULARITY = 'MEDIUM',
    maxTasksPerPhase: number = MAX_TASKS_PER_PHASE,
    includeTestTasks = true,
    prioritizeParallelization = true
  ): Promise<Task[]> {
    const allTasks: Task[] = [];

    plan.phases.forEach(phase => {
      const phaseTasks = this.generatePhaseTasks(
        phase,
        granularity,
        maxTasksPerPhase,
        includeTestTasks
      );

      const optimizedTasks = prioritizeParallelization
        ? this.optimizeForParallelization(phaseTasks, plan)
        : phaseTasks;

      allTasks.push(...optimizedTasks);
    });

    return this.ensureSmartCriteria(allTasks);
  }

  /**
   * Generate tasks for a phase
   */
  private generatePhaseTasks(
    phase: Phase,
    granularity: keyof typeof TASK_GRANULARITY,
    maxTasks: number,
    includeTests: boolean
  ): Task[] {
    const tasks: Task[] = [];
    phase.tasks.forEach((taskId, index) => {
      const baseTasks = this.decomposeTask(taskId, phase.name, granularity);
      
      // Limit tasks per phase
      const tasksToAdd = baseTasks.slice(0, Math.max(1, maxTasks - tasks.length));
      tasks.push(...tasksToAdd);

      // Add test tasks if requested
      if (includeTests && index < maxTasks - 1) {
        const testTask = this.createTestTask(taskId);
        if (testTask) {
          tasks.push(testTask);
        }
      }
    });

    return tasks;
  }

  /**
   * Decompose task based on granularity
   */
  private decomposeTask(
    taskId: string,
    phaseName: string,
    granularity: keyof typeof TASK_GRANULARITY
  ): Task[] {
    const tasks: Task[] = [];
    const baseTask = this.createBaseTask(taskId, phaseName);

    switch (granularity) {
      case 'FINE':
        // Break down into multiple sub-tasks
        tasks.push(
          this.createSubTask(baseTask, 'design', 'Design and plan implementation'),
          this.createSubTask(baseTask, 'implement', 'Core implementation'),
          this.createSubTask(baseTask, 'test', 'Testing and validation'),
          this.createSubTask(baseTask, 'document', 'Documentation')
        );
        break;

      case 'MEDIUM':
        // Moderate breakdown
        tasks.push(
          this.createSubTask(baseTask, 'implement', 'Implementation and testing'),
          this.createSubTask(baseTask, 'validate', 'Validation and documentation')
        );
        break;

      case 'COARSE':
      default:
        // Single task
        tasks.push(baseTask);
        break;
    }

    return tasks;
  }

  /**
   * Create base task
   */
  private createBaseTask(taskId: string, phaseName: string): Task {
    const taskName = this.getTaskName(taskId);
    const priority = this.determinePriority(taskId, phaseName);
    const estimatedHours = this.estimateHours(taskId);

    return {
      id: taskId,
      title: taskName,
      description: `${taskName} for ${phaseName}`,
      status: 'pending',
      priority,
      dependencies: [],
      estimatedHours,
      acceptance: this.generateAcceptanceCriteria(taskId),
      testable: true,
    };
  }

  /**
   * Create sub-task
   */
  private createSubTask(baseTask: Task, suffix: string, description: string): Task {
    return {
      ...baseTask,
      id: `${baseTask.id}-${suffix}`,
      title: `${baseTask.title} - ${suffix}`,
      description,
      estimatedHours: Math.ceil(baseTask.estimatedHours / 2),
      dependencies: suffix === 'implement' ? [] : [`${baseTask.id}-design`],
    };
  }

  /**
   * Create test task
   */
  private createTestTask(taskId: string): Task | null {
    if (!taskId.includes('test')) {
      return {
        id: `${taskId}-test`,
        title: `Test ${this.getTaskName(taskId)}`,
        description: `Write and execute tests for ${this.getTaskName(taskId)}`,
        status: 'pending',
        priority: 'medium',
        dependencies: [taskId],
        estimatedHours: 2,
        acceptance: [
          'Unit tests written and passing',
          'Code coverage > 80%',
          'Edge cases covered',
        ],
        testable: true,
      };
    }
    return null;
  }

  /**
   * Optimize tasks for parallel execution
   */
  private optimizeForParallelization(
    tasks: Task[],
    plan: ImplementationPlan
  ): Task[] {
    const optimized = [...tasks];

    // Identify independent tasks
    const independentGroups = this.identifyIndependentGroups(tasks, plan);

    // Adjust dependencies to enable parallelization
    independentGroups.forEach(group => {
      if (group.length > 1) {
        // Remove inter-group dependencies where possible
        group.forEach(task => {
          const newDeps = task.dependencies.filter(dep =>
            !group.some(other => other.id === dep)
          );
          Object.assign(task, { ...task, dependencies: newDeps });
        });
      }
    });

    return optimized;
  }

  /**
   * Identify groups of tasks that can run independently
   */
  private identifyIndependentGroups(
    tasks: Task[],
    plan: ImplementationPlan
  ): Task[][] {
    const groups: Task[][] = [];
    const processed = new Set<string>();

    tasks.forEach(task => {
      if (processed.has(task.id)) return;

      const group: Task[] = [task];
      processed.add(task.id);

      // Find tasks with no dependencies on this task
      tasks.forEach(other => {
        if (processed.has(other.id)) return;
        
        const hasDirectDependency = 
          other.dependencies.includes(task.id) ||
          task.dependencies.includes(other.id);

        const hasGraphDependency = plan.dependencies.edges.some(edge =>
          (edge.from === task.id && edge.to === other.id) ||
          (edge.from === other.id && edge.to === task.id)
        );

        if (!hasDirectDependency && !hasGraphDependency) {
          group.push(other);
          processed.add(other.id);
        }
      });

      if (group.length > 1) {
        groups.push(group);
      }
    });

    return groups;
  }

  /**
   * Ensure SMART criteria for all tasks
   */
  private ensureSmartCriteria(tasks: Task[]): Task[] {
    return tasks.map(task => ({
      ...task,
      // Specific
      title: this.makeSpecific(task.title),
      // Measurable
      acceptance: task.acceptance.length > 0 
        ? task.acceptance 
        : this.generateAcceptanceCriteria(task.id),
      // Achievable
      estimatedHours: task.estimatedHours > 0 
        ? Math.min(task.estimatedHours, 40) 
        : this.estimateHours(task.id),
      // Relevant
      priority: task.priority || 'medium',
      // Time-bound
      status: task.status || 'pending',
      testable: task.testable !== false,
    }));
  }

  /**
   * Make task title specific
   */
  private makeSpecific(title: string): string {
    const vagueTerms: Record<string, string> = {
      'Implement': 'Develop and integrate',
      'Create': 'Design and build',
      'Setup': 'Configure and initialize',
      'Fix': 'Identify and resolve',
      'Update': 'Modify and validate',
      'Test': 'Write tests and validate',
    };

    let specific = title;
    Object.entries(vagueTerms).forEach(([vague, specific_term]) => {
      if (title.startsWith(vague)) {
        specific = title.replace(vague, specific_term);
      }
    });

    return specific;
  }

  /**
   * Generate acceptance criteria
   */
  private generateAcceptanceCriteria(taskId: string): string[] {
    const criteria: string[] = [];

    if (taskId.includes('impl') || taskId.includes('develop')) {
      criteria.push('Feature implemented according to specification');
      criteria.push('Code follows clean code principles');
      criteria.push('Unit tests written and passing');
    } else if (taskId.includes('test')) {
      criteria.push('Test coverage > 80%');
      criteria.push('All test cases passing');
      criteria.push('Edge cases identified and tested');
    } else if (taskId.includes('design')) {
      criteria.push('Design documented and reviewed');
      criteria.push('Architecture decisions recorded');
      criteria.push('Interfaces defined');
    } else if (taskId.includes('deploy')) {
      criteria.push('Deployment successful');
      criteria.push('Health checks passing');
      criteria.push('Rollback plan documented');
    } else {
      criteria.push('Task completed successfully');
      criteria.push('Output validated');
      criteria.push('Documentation updated');
    }

    return criteria;
  }

  /**
   * Determine task priority
   */
  private determinePriority(taskId: string, phaseName: string): Task['priority'] {
    if (phaseName.includes('Core') || taskId.includes('critical')) {
      return 'high';
    }
    if (phaseName.includes('Testing') || taskId.includes('security')) {
      return 'high';
    }
    if (phaseName.includes('Extended') || taskId.includes('optional')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Estimate hours for task
   */
  private estimateHours(taskId: string): number {
    if (taskId.includes('impl') || taskId.includes('develop')) {
      return 8;
    }
    if (taskId.includes('test')) {
      return 4;
    }
    if (taskId.includes('design') || taskId.includes('architecture')) {
      return 6;
    }
    if (taskId.includes('document')) {
      return 2;
    }
    if (taskId.includes('deploy')) {
      return 3;
    }
    return 4;
  }

  /**
   * Get task name from ID
   */
  private getTaskName(taskId: string): string {
    const taskNames: Record<string, string> = {
      'task-init-project': 'Initialize project',
      'task-setup-dev-env': 'Setup development environment',
      'task-design-architecture': 'Design architecture',
      'task-setup-ci-cd': 'Setup CI/CD',
      'task-unit-testing': 'Unit testing',
      'task-integration-testing': 'Integration testing',
      'task-performance-testing': 'Performance testing',
      'task-security-testing': 'Security testing',
      'task-user-acceptance': 'User acceptance testing',
      'task-prepare-deployment': 'Prepare deployment',
      'task-deploy-production': 'Deploy to production',
      'task-setup-monitoring': 'Setup monitoring',
      'task-documentation': 'Create documentation',
    };

    if (taskNames[taskId]) {
      return taskNames[taskId];
    }

    // Extract meaningful name from ID
    const parts = taskId.split('-');
    if (parts.length > 1) {
      return parts.slice(1).join(' ').replace(/_/g, ' ');
    }

    return taskId;
  }
}
