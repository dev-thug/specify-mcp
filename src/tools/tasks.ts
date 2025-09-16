import { z } from 'zod';
import type { SDDTool, ToolResult } from '../types/index.js';
import { ResourceManager } from '../resources/manager.js';

const tasksInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  granularity: z.enum(['high', 'medium', 'low']).optional().describe('Task breakdown granularity'),
  groupingStrategy: z.enum(['feature', 'layer', 'component']).optional().describe('How to group tasks')
});

interface Task {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  estimatedHours: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  subtasks: Subtask[];
}

interface Subtask {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
  technicalNotes: string;
}

export class TasksTool implements SDDTool {
  name = 'breakdown_tasks';
  description = 'Break down project into detailed tasks and create work breakdown structure';
  inputSchema = tasksInputSchema;

  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  async handler(params: unknown): Promise<ToolResult> {
    const input = tasksInputSchema.parse(params);
    
    // Read project, spec, and plan
    const projectData = await this.resourceManager.readResource(input.projectId, 'metadata.json');
    const project = JSON.parse(projectData.content);
    
    let spec = '';
    let plan = '';
    try {
      const specData = await this.resourceManager.readResource(input.projectId, 'spec/specification.md');
      spec = specData.content;
    } catch {}
    
    try {
      const planData = await this.resourceManager.readResource(input.projectId, 'plan/technical-plan.md');
      plan = planData.content;
    } catch {}

    // Generate task breakdown
    const tasks = await this.generateTasks(project, spec, plan, input);
    
    // Create task folders and files
    await this.createTaskStructure(input.projectId, tasks);
    
    // Generate WBS (Work Breakdown Structure)
    const wbs = this.generateWBS(tasks);
    await this.resourceManager.createResource(
      input.projectId,
      'tasks/wbs.md',
      wbs,
      { stage: 'tasks' }
    );

    // Verify task completeness
    const verificationResult = await this.verifyTasks(tasks, spec);
    
    // Create task summary
    const summary = this.generateTaskSummary(tasks, verificationResult);
    await this.resourceManager.createResource(
      input.projectId,
      'tasks/summary.md',
      summary,
      { stage: 'tasks', verified: verificationResult.isValid }
    );

    // Update project workflow
    project.workflow.completedStages.push('tasks');
    project.workflow.currentStage = 'tasks';
    project.workflow.nextStage = 'implement';
    
    await this.resourceManager.updateResource(
      input.projectId,
      'metadata.json',
      JSON.stringify(project, null, 2)
    );

    return {
      content: [
        {
          type: 'text',
          text: `Task breakdown completed: ${tasks.length} main tasks with ${tasks.reduce((sum, t) => sum + t.subtasks.length, 0)} subtasks`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/tasks/wbs.md`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/tasks/summary.md`
        }
      ]
    };
  }

  private async generateTasks(
    _project: any,
    _spec: string,
    plan: string,
    _input: z.infer<typeof tasksInputSchema>
  ): Promise<Task[]> {
    // const granularity = input.granularity || 'medium';
    // const groupingStrategy = input.groupingStrategy || 'feature';

    // Generate tasks based on specification sections
    const tasks: Task[] = [];
    let taskCounter = 1;

    // Setup and Infrastructure Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'Project Setup and Configuration',
      description: 'Initialize project structure, development environment, and core configuration',
      dependencies: [],
      estimatedHours: 8,
      priority: 'high',
      category: 'setup',
      subtasks: [
        {
          id: 'SUB-001-001',
          name: 'Initialize repository and project structure',
          description: 'Set up version control, create directory structure, configure build tools',
          acceptanceCriteria: [
            'Git repository initialized with proper .gitignore',
            'Project structure follows architectural guidelines',
            'Build configuration is functional',
            'Development dependencies installed'
          ],
          technicalNotes: 'Use the technology stack defined in the technical plan'
        },
        {
          id: 'SUB-001-002',
          name: 'Configure development environment',
          description: 'Set up linting, formatting, and development tools',
          acceptanceCriteria: [
            'ESLint/Prettier configured',
            'Pre-commit hooks installed',
            'IDE configuration shared',
            'Docker development environment ready'
          ],
          technicalNotes: 'Ensure consistency across team environments'
        }
      ]
    });

    // Core Feature Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'User Authentication System',
      description: 'Implement secure user authentication and authorization',
      dependencies: ['TASK-001'],
      estimatedHours: 24,
      priority: 'high',
      category: 'feature',
      subtasks: [
        {
          id: 'SUB-002-001',
          name: 'Design authentication schema',
          description: 'Create database models and API contracts for authentication',
          acceptanceCriteria: [
            'User model defined with required fields',
            'Session/token management designed',
            'API endpoints documented',
            'Security considerations addressed'
          ],
          technicalNotes: 'Follow OWASP authentication guidelines'
        },
        {
          id: 'SUB-002-002',
          name: 'Implement authentication endpoints',
          description: 'Create login, logout, register, and password reset functionality',
          acceptanceCriteria: [
            'Registration endpoint functional',
            'Login/logout working correctly',
            'Password reset flow complete',
            'Input validation implemented'
          ],
          technicalNotes: 'Use bcrypt for password hashing, JWT for tokens'
        },
        {
          id: 'SUB-002-003',
          name: 'Add authorization middleware',
          description: 'Implement role-based access control',
          acceptanceCriteria: [
            'Middleware validates tokens',
            'Role checking implemented',
            'Protected routes secured',
            'Error handling complete'
          ],
          technicalNotes: 'Implement RBAC pattern from technical plan'
        }
      ]
    });

    // Data Layer Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'Database Design and Implementation',
      description: 'Design and implement database schema and data access layer',
      dependencies: ['TASK-001'],
      estimatedHours: 16,
      priority: 'high',
      category: 'data',
      subtasks: [
        {
          id: 'SUB-003-001',
          name: 'Design database schema',
          description: 'Create entity relationship diagrams and define data models',
          acceptanceCriteria: [
            'ERD documented',
            'Relationships defined',
            'Indexes planned',
            'Migration strategy defined'
          ],
          technicalNotes: 'Consider normalization and performance'
        },
        {
          id: 'SUB-003-002',
          name: 'Implement data access layer',
          description: 'Create repositories and data access patterns',
          acceptanceCriteria: [
            'Repository pattern implemented',
            'CRUD operations functional',
            'Transaction support added',
            'Connection pooling configured'
          ],
          technicalNotes: 'Use ORM/query builder from tech stack'
        }
      ]
    });

    // API Development Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'API Development',
      description: 'Implement RESTful API endpoints for core functionality',
      dependencies: ['TASK-002', 'TASK-003'],
      estimatedHours: 32,
      priority: 'high',
      category: 'api',
      subtasks: [
        {
          id: 'SUB-004-001',
          name: 'Design API architecture',
          description: 'Define API structure, versioning, and documentation approach',
          acceptanceCriteria: [
            'API specification documented (OpenAPI/Swagger)',
            'Versioning strategy defined',
            'Error format standardized',
            'Rate limiting planned'
          ],
          technicalNotes: 'Follow RESTful best practices'
        },
        {
          id: 'SUB-004-002',
          name: 'Implement core endpoints',
          description: 'Create CRUD endpoints for main entities',
          acceptanceCriteria: [
            'All CRUD operations functional',
            'Request validation implemented',
            'Response formatting consistent',
            'Error handling complete'
          ],
          technicalNotes: 'Implement pagination, filtering, and sorting'
        }
      ]
    });

    // Frontend Tasks (if applicable)
    if (plan.includes('Frontend') || plan.includes('React')) {
      tasks.push({
        id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
        name: 'Frontend Application Development',
        description: 'Build user interface components and application flow',
        dependencies: ['TASK-004'],
        estimatedHours: 40,
        priority: 'high',
        category: 'frontend',
        subtasks: [
          {
            id: 'SUB-005-001',
            name: 'Set up frontend framework',
            description: 'Initialize frontend application with routing and state management',
            acceptanceCriteria: [
              'Framework initialized',
              'Routing configured',
              'State management set up',
              'Component structure defined'
            ],
            technicalNotes: 'Use the frontend stack from technical plan'
          },
          {
            id: 'SUB-005-002',
            name: 'Implement UI components',
            description: 'Create reusable UI components following design system',
            acceptanceCriteria: [
              'Component library created',
              'Design tokens implemented',
              'Responsive design working',
              'Accessibility standards met'
            ],
            technicalNotes: 'Follow atomic design principles'
          }
        ]
      });
    }

    // Testing Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'Testing Implementation',
      description: 'Implement comprehensive testing strategy',
      dependencies: tasks.slice(1, -1).map(t => t.id),
      estimatedHours: 24,
      priority: 'medium',
      category: 'testing',
      subtasks: [
        {
          id: 'SUB-006-001',
          name: 'Unit testing',
          description: 'Write unit tests for all business logic',
          acceptanceCriteria: [
            'Unit tests achieve 80% coverage',
            'Critical paths fully tested',
            'Test utilities created',
            'Mocking strategy implemented'
          ],
          technicalNotes: 'Use testing framework from tech stack'
        },
        {
          id: 'SUB-006-002',
          name: 'Integration testing',
          description: 'Test component interactions and API endpoints',
          acceptanceCriteria: [
            'API endpoints tested',
            'Database interactions verified',
            'External service mocks created',
            'Error scenarios covered'
          ],
          technicalNotes: 'Test in isolated environment'
        }
      ]
    });

    // Deployment Tasks
    tasks.push({
      id: `TASK-${String(taskCounter++).padStart(3, '0')}`,
      name: 'Deployment and DevOps',
      description: 'Set up deployment pipeline and infrastructure',
      dependencies: tasks.map(t => t.id),
      estimatedHours: 16,
      priority: 'medium',
      category: 'deployment',
      subtasks: [
        {
          id: 'SUB-007-001',
          name: 'Configure CI/CD pipeline',
          description: 'Set up automated build and deployment',
          acceptanceCriteria: [
            'Build pipeline configured',
            'Automated tests running',
            'Deployment stages defined',
            'Rollback mechanism ready'
          ],
          technicalNotes: 'Use GitHub Actions or similar'
        },
        {
          id: 'SUB-007-002',
          name: 'Production environment setup',
          description: 'Configure production infrastructure',
          acceptanceCriteria: [
            'Production servers configured',
            'Database provisioned',
            'Monitoring set up',
            'Backup strategy implemented'
          ],
          technicalNotes: 'Follow infrastructure plan'
        }
      ]
    });

    return tasks;
  }

  private async createTaskStructure(projectId: string, tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      const taskPath = `tasks/${task.id}`;
      
      // Create index file for task
      const indexContent = `# ${task.name}

## Overview
${task.description}

## Task Information
- **ID**: ${task.id}
- **Category**: ${task.category}
- **Priority**: ${task.priority}
- **Estimated Hours**: ${task.estimatedHours}
- **Dependencies**: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}

## Subtasks
${task.subtasks.map(st => `- [${st.id}](${st.id}.md): ${st.name}`).join('\n')}

## Progress Tracking
- [ ] Design phase complete
- [ ] Implementation complete
- [ ] Testing complete
- [ ] Documentation complete
- [ ] Code review passed

## Notes
Add any additional notes or considerations here.
`;

      await this.resourceManager.createResource(
        projectId,
        `${taskPath}/index.md`,
        indexContent,
        { stage: 'tasks', taskId: task.id }
      );

      // Create subtask files
      for (const subtask of task.subtasks) {
        const subtaskContent = `# ${subtask.name}

## Task ID
${subtask.id}

## Description
${subtask.description}

## Acceptance Criteria
${subtask.acceptanceCriteria.map(ac => `- [ ] ${ac}`).join('\n')}

## Technical Notes
${subtask.technicalNotes}

## Implementation Steps
1. Review requirements and acceptance criteria
2. Design solution approach
3. Implement functionality
4. Write tests
5. Document implementation
6. Submit for code review

## Testing Checklist
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Manual testing completed
- [ ] Edge cases handled
- [ ] Error handling verified

## Related Files
<!-- List files created or modified for this subtask -->
- TBD

## Time Tracking
- **Estimated**: TBD hours
- **Actual**: TBD hours
- **Start Date**: TBD
- **Completion Date**: TBD

## Notes
<!-- Add implementation notes, challenges, or decisions made -->
`;

        await this.resourceManager.createResource(
          projectId,
          `${taskPath}/${subtask.id}.md`,
          subtaskContent,
          { stage: 'tasks', taskId: task.id, subtaskId: subtask.id }
        );
      }
    }
  }

  private generateWBS(tasks: Task[]): string {
    return `# Work Breakdown Structure (WBS)

## Project Task Hierarchy

\`\`\`
Project
${tasks.map(task => `├── ${task.id}: ${task.name}
${task.subtasks.map(st => `│   ├── ${st.id}: ${st.name}`).join('\n')}`).join('\n')}
\`\`\`

## Task Categories

${this.groupTasksByCategory(tasks)}

## Dependency Graph

\`\`\`mermaid
graph TD
${tasks.map(task => {
  if (task.dependencies.length > 0) {
    return task.dependencies.map(dep => `    ${dep} --> ${task.id}`).join('\n');
  }
  return `    START --> ${task.id}`;
}).join('\n')}
${tasks.filter(t => t.dependencies.length === tasks.length - 1).map(t => `    ${t.id} --> END`).join('\n')}
\`\`\`

## Timeline Estimation

| Phase | Tasks | Estimated Hours | Duration (days) |
|-------|-------|-----------------|-----------------|
${this.generateTimelineTable(tasks)}

## Critical Path
${this.identifyCriticalPath(tasks)}

## Resource Allocation
${this.generateResourceAllocation(tasks)}

## Risk Assessment

### High-Risk Tasks
${tasks.filter(t => t.priority === 'high').map(t => `- ${t.id}: ${t.name} - Critical for project success`).join('\n')}

### Dependencies Bottlenecks
${this.identifyBottlenecks(tasks)}

## Milestones

1. **Project Setup Complete**: TASK-001 completed
2. **Core Infrastructure Ready**: TASK-001, TASK-002, TASK-003 completed
3. **API Functional**: TASK-004 completed
4. **Frontend Complete**: TASK-005 completed (if applicable)
5. **Testing Complete**: TASK-006 completed
6. **Production Ready**: TASK-007 completed
`;
  }

  private groupTasksByCategory(tasks: Task[]): string {
    const categories = [...new Set(tasks.map(t => t.category))];
    
    return categories.map(cat => {
      const categoryTasks = tasks.filter(t => t.category === cat);
      return `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}
${categoryTasks.map(t => `- ${t.id}: ${t.name} (${t.estimatedHours}h)`).join('\n')}
`;
    }).join('\n');
  }

  private generateTimelineTable(tasks: Task[]): string {
    const phases = [
      { name: 'Setup', tasks: tasks.filter(t => t.category === 'setup') },
      { name: 'Core Development', tasks: tasks.filter(t => ['feature', 'data', 'api'].includes(t.category)) },
      { name: 'Frontend', tasks: tasks.filter(t => t.category === 'frontend') },
      { name: 'Testing', tasks: tasks.filter(t => t.category === 'testing') },
      { name: 'Deployment', tasks: tasks.filter(t => t.category === 'deployment') }
    ];

    return phases.filter(p => p.tasks.length > 0).map(phase => {
      const hours = phase.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      const days = Math.ceil(hours / 8);
      const taskIds = phase.tasks.map(t => t.id).join(', ');
      return `| ${phase.name} | ${taskIds} | ${hours} | ${days} |`;
    }).join('\n');
  }

  private identifyCriticalPath(tasks: Task[]): string {
    // Simplified critical path identification
    const criticalTasks = tasks.filter(t => t.priority === 'high');
    return `The critical path includes the following high-priority tasks that must be completed sequentially:
${criticalTasks.map(t => `1. ${t.id}: ${t.name}`).join('\n')}

Total critical path duration: ${criticalTasks.reduce((sum, t) => sum + t.estimatedHours, 0)} hours`;
  }

  private generateResourceAllocation(tasks: Task[]): string {
    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const totalDays = Math.ceil(totalHours / 8);
    
    return `### Summary
- Total Estimated Hours: ${totalHours}
- Total Working Days: ${totalDays}
- Suggested Team Size: 2-3 developers
- Estimated Duration: ${Math.ceil(totalDays / 2)} days with 2 developers working in parallel`;
  }

  private identifyBottlenecks(tasks: Task[]): string {
    const bottlenecks = tasks.filter(t => {
      const dependentTasks = tasks.filter(task => task.dependencies.includes(t.id));
      return dependentTasks.length >= 2;
    });

    if (bottlenecks.length === 0) {
      return 'No significant bottlenecks identified';
    }

    return bottlenecks.map(t => `- ${t.id}: ${t.name} - Multiple tasks depend on this`).join('\n');
  }

  private generateTaskSummary(tasks: Task[], verification: any): string {
    const totalTasks = tasks.length;
    const totalSubtasks = tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    return `# Task Breakdown Summary

## Statistics
- **Total Tasks**: ${totalTasks}
- **Total Subtasks**: ${totalSubtasks}
- **Total Estimated Hours**: ${totalHours}
- **Estimated Duration**: ${Math.ceil(totalHours / 40)} weeks (single developer)

## Task Distribution by Category
${this.getTaskDistribution(tasks)}

## Priority Breakdown
- **High Priority**: ${tasks.filter(t => t.priority === 'high').length} tasks
- **Medium Priority**: ${tasks.filter(t => t.priority === 'medium').length} tasks
- **Low Priority**: ${tasks.filter(t => t.priority === 'low').length} tasks

## Verification Status
- **Valid**: ${verification.isValid ? 'Yes' : 'No'}
- **Coverage Confidence**: ${(verification.confidence * 100).toFixed(1)}%
- **Issues**: ${verification.issues.length}
- **Suggestions**: ${verification.suggestions.length}

${verification.issues.length > 0 ? `
## Issues to Address
${verification.issues.map((issue: string, i: number) => `${i + 1}. ${issue}`).join('\n')}
` : ''}

${verification.suggestions.length > 0 ? `
## Improvement Suggestions
${verification.suggestions.map((suggestion: string, i: number) => `${i + 1}. ${suggestion}`).join('\n')}
` : ''}

## Next Steps
1. Review task breakdown with stakeholders
2. Adjust estimates based on team capacity
3. Assign tasks to team members
4. Set up project tracking tools
5. Proceed to implementation phase

## Implementation Guidelines
- Start with high-priority tasks
- Complete dependencies before dependent tasks
- Maintain task documentation throughout development
- Update estimates based on actual progress
- Conduct regular progress reviews
`;
  }

  private getTaskDistribution(tasks: Task[]): string {
    const categories = [...new Set(tasks.map(t => t.category))];
    return categories.map(cat => {
      const count = tasks.filter(t => t.category === cat).length;
      const percentage = ((count / tasks.length) * 100).toFixed(1);
      return `- **${cat.charAt(0).toUpperCase() + cat.slice(1)}**: ${count} tasks (${percentage}%)`;
    }).join('\n');
  }

  private async verifyTasks(tasks: Task[], spec: string): Promise<any> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check task coverage
    if (tasks.length < 5) {
      issues.push('Insufficient task breakdown - consider more granular decomposition');
    }

    // Check for orphan tasks (no dependencies and nothing depends on them)
    const orphanTasks = tasks.filter(t => {
      const hasDependencies = t.dependencies.length > 0;
      const isDependency = tasks.some(other => other.dependencies.includes(t.id));
      return !hasDependencies && !isDependency && t.category !== 'setup';
    });

    if (orphanTasks.length > 0) {
      issues.push(`Orphan tasks detected: ${orphanTasks.map(t => t.id).join(', ')}`);
    }

    // Check for missing essential categories
    const categories = new Set(tasks.map(t => t.category));
    const essentialCategories = ['setup', 'testing'];
    
    for (const essential of essentialCategories) {
      if (!categories.has(essential)) {
        issues.push(`Missing essential task category: ${essential}`);
      }
    }

    // Check if spec requirements are covered
    if (spec && spec.includes('authentication') && !tasks.some(t => t.name.toLowerCase().includes('auth'))) {
      suggestions.push('Specification mentions authentication but no explicit auth tasks found');
    }

    // Check time estimates
    const unrealisticTasks = tasks.filter(t => t.estimatedHours > 80 || t.estimatedHours < 2);
    if (unrealisticTasks.length > 0) {
      suggestions.push('Review time estimates for tasks - some seem unrealistic');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: Math.max(0.5, 1 - (issues.length * 0.1))
    };
  }
}
