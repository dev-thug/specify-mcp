/**
 * Tasks tool for breaking down work into detailed, executable tasks
 * Generates TDD-focused task lists with dependencies
 */

import fs from 'fs-extra';
import * as path from 'path';
import { ResourceManager } from '../resources/manager.js';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext } from '../types/index.js';

export interface TasksToolParams {
  projectId: string;
  granularity?: 'high' | 'medium' | 'low';
}

interface Task {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'test' | 'implementation' | 'integration' | 'polish';
  parallel: boolean;
  dependencies: string[];
  filePath?: string;
}

export class TasksTool {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: TasksToolParams): Promise<string> {
    const { projectId, granularity = 'medium' } = params;

    // Load plan and spec
    let planContent = '';
    let specContent = '';
    
    try {
      const plan = await this.resourceManager.readResource(
        `specify://project/${projectId}/plan/current`
      );
      planContent = plan.text || '';
    } catch {
      return 'Error: No plan found. Please run sdd_plan first.';
    }

    try {
      const spec = await this.resourceManager.readResource(
        `specify://project/${projectId}/spec/current`
      );
      specContent = spec.text || '';
    } catch {
      // Spec is optional but helpful
    }

    // Load data model and contracts if available
    let dataModel = '';
    try {
      const dm = await this.resourceManager.readResource(
        `specify://project/${projectId}/plan/data-model`
      );
      dataModel = dm.text || '';
    } catch {
      // Optional
    }

    // Load template
    const templatePath = path.join(process.cwd(), 'templates', 'tasks-template.md');
    let template = '';
    
    try {
      template = await fs.readFile(templatePath, 'utf-8');
    } catch {
      template = this.getDefaultTemplate();
    }

    // Generate tasks
    const tasks = this.generateTasks(
      planContent,
      specContent,
      dataModel,
      granularity
    );

    // Create task document
    const tasksDocument = this.createTasksDocument(tasks, template);

    // Verify tasks
    const verificationContext: IVerificationContext = {
      phase: 'tasks',
      content: tasksDocument,
      relatedDocuments: new Map([
        ['plan', planContent],
        ['spec', specContent],
      ]),
    };

    const validationResults = await this.verifier.verify(verificationContext);
    const confidence = this.verifier.calculateConfidence(validationResults);

    // Save main tasks document
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/task/main/index`,
      tasksDocument
    );

    // Create individual task folders with subtasks
    for (const task of tasks) {
      await this.createTaskFolder(projectId, task);
    }

    // Generate response
    const errors = validationResults.filter(r => r.type === 'error');

    let response = `Task breakdown created successfully!\n`;
    response += `Total tasks: ${tasks.length}\n`;
    response += `Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;

    // Task summary by category
    const categories = {
      setup: tasks.filter(t => t.category === 'setup').length,
      test: tasks.filter(t => t.category === 'test').length,
      implementation: tasks.filter(t => t.category === 'implementation').length,
      integration: tasks.filter(t => t.category === 'integration').length,
      polish: tasks.filter(t => t.category === 'polish').length,
    };

    response += '📊 Task Distribution:\n';
    Object.entries(categories).forEach(([cat, count]) => {
      if (count > 0) {
        response += `- ${cat}: ${count} tasks\n`;
      }
    });
    response += '\n';

    const parallelTasks = tasks.filter(t => t.parallel).length;
    response += `⚡ ${parallelTasks} tasks can run in parallel\n\n`;

    if (errors.length > 0) {
      response += '⚠️ Issues found:\n';
      errors.forEach(e => {
        response += `- ${e.message}\n`;
      });
      response += '\n';
    }

    response += 'Task folders created:\n';
    tasks.slice(0, 5).forEach(task => {
      response += `- task/${task.id}/ (${task.title})\n`;
    });
    if (tasks.length > 5) {
      response += `- ... and ${tasks.length - 5} more\n`;
    }
    response += '\n';

    response += 'Next step: Use `sdd_implement` with a task ID to generate TDD implementation.';

    return response;
  }

  private generateTasks(
    planContent: string,
    specContent: string,
    dataModel: string,
    granularity: 'high' | 'medium' | 'low'
  ): Task[] {
    const tasks: Task[] = [];
    let taskCounter = 1;

    // Extract technical context from plan
    const techStack = this.extractTechStack(planContent);
    const projectType = this.extractProjectType(planContent);
    
    // Extract requirements from spec
    const requirements = this.extractRequirements(specContent);
    
    // Extract entities from data model
    const entities = this.extractEntities(dataModel);

    // Phase 1: Setup tasks
    tasks.push(...this.generateSetupTasks(techStack, projectType, taskCounter));
    taskCounter += tasks.filter(t => t.category === 'setup').length;

    // Phase 2: Test tasks (TDD - tests first!)
    const testTasks = this.generateTestTasks(
      requirements,
      entities,
      techStack,
      taskCounter,
      granularity
    );
    tasks.push(...testTasks);
    taskCounter += testTasks.length;

    // Phase 3: Implementation tasks
    const implTasks = this.generateImplementationTasks(
      requirements,
      entities,
      techStack,
      taskCounter,
      granularity
    );
    tasks.push(...implTasks);
    taskCounter += implTasks.length;

    // Phase 4: Integration tasks
    const integrationTasks = this.generateIntegrationTasks(
      techStack,
      projectType,
      taskCounter
    );
    tasks.push(...integrationTasks);
    taskCounter += integrationTasks.length;

    // Phase 5: Polish tasks
    const polishTasks = this.generatePolishTasks(taskCounter, granularity);
    tasks.push(...polishTasks);

    // Set dependencies
    this.setTaskDependencies(tasks);

    return tasks;
  }

  private extractTechStack(planContent: string): any {
    const techStack: any = {};
    
    const langMatch = planContent.match(/\*\*Language\/Version\*\*:\s*([^\n]+)/);
    techStack.language = langMatch?.[1]?.split('[')[0]?.trim() || 'TypeScript';
    
    const frameworkMatch = planContent.match(/\*\*Primary Dependencies\*\*:\s*([^\n]+)/);
    techStack.framework = frameworkMatch?.[1]?.split('[')[0]?.trim() || 'Express';
    
    const dbMatch = planContent.match(/\*\*Storage\*\*:\s*([^\n]+)/);
    techStack.database = dbMatch?.[1]?.split('[')[0]?.trim() || 'PostgreSQL';
    
    const testMatch = planContent.match(/\*\*Testing\*\*:\s*([^\n]+)/);
    techStack.testing = testMatch?.[1]?.split('[')[0]?.trim() || 'Jest';
    
    return techStack;
  }

  private extractProjectType(planContent: string): string {
    const typeMatch = planContent.match(/\*\*Project Type\*\*:\s*([^\n]+)/);
    return typeMatch?.[1]?.trim() || 'single';
  }

  private extractRequirements(specContent: string): string[] {
    const reqPattern = /\*\*FR-\d+\*\*:\s*([^[\n]+)/g;
    const requirements: string[] = [];
    let match;
    
    while ((match = reqPattern.exec(specContent)) !== null) {
      if (match[1]) {
        requirements.push(match[1].trim());
      }
    }
    
    return requirements;
  }

  private extractEntities(dataModel: string): string[] {
    const entityPattern = /### ([A-Z][a-z]+)/g;
    const entities: string[] = [];
    let match;
    
    while ((match = entityPattern.exec(dataModel)) !== null) {
      if (match[1]) {
        entities.push(match[1]);
      }
    }
    
    return entities;
  }

  private generateSetupTasks(techStack: any, projectType: string, startId: number): Task[] {
    const tasks: Task[] = [];
    
    tasks.push({
      id: `T${String(startId).padStart(3, '0')}`,
      title: 'Initialize project structure',
      description: `Create ${projectType} project structure with required directories`,
      category: 'setup',
      parallel: false,
      dependencies: [],
      filePath: 'project root',
    });

    tasks.push({
      id: `T${String(startId + 1).padStart(3, '0')}`,
      title: 'Setup dependencies',
      description: `Install ${techStack.framework} and related dependencies`,
      category: 'setup',
      parallel: false,
      dependencies: [`T${String(startId).padStart(3, '0')}`],
      filePath: 'package.json',
    });

    tasks.push({
      id: `T${String(startId + 2).padStart(3, '0')}`,
      title: 'Configure development environment',
      description: `Setup linting, formatting, and ${techStack.testing} configuration`,
      category: 'setup',
      parallel: true,
      dependencies: [`T${String(startId + 1).padStart(3, '0')}`],
      filePath: '.eslintrc, jest.config.js',
    });

    return tasks;
  }

  private generateTestTasks(
    requirements: string[],
    entities: string[],
    techStack: any,
    startId: number,
    granularity: string
  ): Task[] {
    const tasks: Task[] = [];
    let currentId = startId;

    // Contract tests for each entity
    entities.forEach(entity => {
      tasks.push({
        id: `T${String(currentId++).padStart(3, '0')}`,
        title: `Contract test for ${entity} CRUD operations`,
        description: `Write failing contract tests for ${entity} API endpoints`,
        category: 'test',
        parallel: true,
        dependencies: [],
        filePath: `tests/contract/test_${entity.toLowerCase()}.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
      });
    });

    // Integration tests for main workflows
    if (requirements.length > 0) {
      const mainWorkflows = requirements.slice(0, granularity === 'high' ? 5 : 3);
      mainWorkflows.forEach((req, idx) => {
        tasks.push({
          id: `T${String(currentId++).padStart(3, '0')}`,
          title: `Integration test for requirement ${idx + 1}`,
          description: `Test: ${req.substring(0, 50)}...`,
          category: 'test',
          parallel: true,
          dependencies: [],
          filePath: `tests/integration/test_workflow_${idx + 1}.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
        });
      });
    }

    // E2E test
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'End-to-end test setup',
      description: 'Create E2E test for complete user journey',
      category: 'test',
      parallel: false,
      dependencies: [],
      filePath: `tests/e2e/test_journey.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
    });

    return tasks;
  }

  private generateImplementationTasks(
    requirements: string[],
    entities: string[],
    techStack: any,
    startId: number,
    granularity: string
  ): Task[] {
    const tasks: Task[] = [];
    let currentId = startId;

    // Model implementation for each entity
    entities.forEach(entity => {
      tasks.push({
        id: `T${String(currentId++).padStart(3, '0')}`,
        title: `Implement ${entity} model`,
        description: `Create ${entity} model with validation and relationships`,
        category: 'implementation',
        parallel: true,
        dependencies: [],
        filePath: `src/models/${entity.toLowerCase()}.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
      });
    });

    // Service layer
    entities.forEach(entity => {
      tasks.push({
        id: `T${String(currentId++).padStart(3, '0')}`,
        title: `Implement ${entity} service`,
        description: `Create service layer for ${entity} business logic`,
        category: 'implementation',
        parallel: true,
        dependencies: [`T${String(startId + entities.indexOf(entity)).padStart(3, '0')}`],
        filePath: `src/services/${entity.toLowerCase()}Service.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
      });
    });

    // API endpoints (if applicable)
    if (techStack.framework && techStack.framework.toLowerCase().includes('express')) {
      entities.forEach(entity => {
        tasks.push({
          id: `T${String(currentId++).padStart(3, '0')}`,
          title: `Implement ${entity} API endpoints`,
          description: `Create REST endpoints for ${entity}`,
          category: 'implementation',
          parallel: false,
          dependencies: [],
          filePath: `src/routes/${entity.toLowerCase()}.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
        });
      });
    }

    // Core business logic based on requirements
    if (granularity !== 'low') {
      requirements.slice(0, 3).forEach((req, idx) => {
        tasks.push({
          id: `T${String(currentId++).padStart(3, '0')}`,
          title: `Implement business logic ${idx + 1}`,
          description: `Implement: ${req.substring(0, 50)}...`,
          category: 'implementation',
          parallel: false,
          dependencies: [],
          filePath: `src/lib/feature_${idx + 1}.${techStack.language === 'TypeScript' ? 'ts' : 'js'}`,
        });
      });
    }

    return tasks;
  }

  private generateIntegrationTasks(
    techStack: any,
    _projectType: string,
    startId: number
  ): Task[] {
    const tasks: Task[] = [];
    let currentId = startId;

    // Database integration
    if (techStack.database && techStack.database !== 'In-memory') {
      tasks.push({
        id: `T${String(currentId++).padStart(3, '0')}`,
        title: 'Setup database connection',
        description: `Configure ${techStack.database} connection and migrations`,
        category: 'integration',
        parallel: false,
        dependencies: [],
        filePath: 'src/db/connection.ts',
      });
    }

    // Authentication middleware
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Implement authentication',
      description: 'Setup authentication middleware and JWT handling',
      category: 'integration',
      parallel: false,
      dependencies: [],
      filePath: 'src/middleware/auth.ts',
    });

    // Logging and monitoring
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Setup structured logging',
      description: 'Implement Winston or similar for structured logs',
      category: 'integration',
      parallel: true,
      dependencies: [],
      filePath: 'src/lib/logger.ts',
    });

    // Error handling
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Global error handling',
      description: 'Implement centralized error handling and recovery',
      category: 'integration',
      parallel: false,
      dependencies: [],
      filePath: 'src/middleware/errorHandler.ts',
    });

    return tasks;
  }

  private generatePolishTasks(startId: number, granularity: string): Task[] {
    const tasks: Task[] = [];
    let currentId = startId;

    // Unit tests
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Add unit tests',
      description: 'Write unit tests for utility functions and helpers',
      category: 'polish',
      parallel: true,
      dependencies: [],
      filePath: 'tests/unit/',
    });

    // Performance testing
    if (granularity !== 'low') {
      tasks.push({
        id: `T${String(currentId++).padStart(3, '0')}`,
        title: 'Performance testing',
        description: 'Validate performance requirements and optimize',
        category: 'polish',
        parallel: false,
        dependencies: [],
        filePath: 'tests/performance/',
      });
    }

    // Documentation
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Update documentation',
      description: 'Generate API docs and update README',
      category: 'polish',
      parallel: true,
      dependencies: [],
      filePath: 'docs/',
    });

    // Code cleanup
    tasks.push({
      id: `T${String(currentId++).padStart(3, '0')}`,
      title: 'Refactor and cleanup',
      description: 'Remove duplication, improve code quality',
      category: 'polish',
      parallel: false,
      dependencies: [],
      filePath: 'src/',
    });

    return tasks;
  }

  private setTaskDependencies(tasks: Task[]): void {
    // Setup tasks block everything
    const setupTasks = tasks.filter(t => t.category === 'setup').map(t => t.id);
    
    // Tests depend on setup
    tasks.filter(t => t.category === 'test').forEach(task => {
      if (task.dependencies.length === 0) {
        task.dependencies.push(...setupTasks);
      }
    });

    // Implementation depends on tests (TDD)
    const testTasks = tasks.filter(t => t.category === 'test').map(t => t.id);
    tasks.filter(t => t.category === 'implementation').forEach(task => {
      if (task.dependencies.filter(d => testTasks.includes(d)).length === 0) {
        const firstTestTask = testTasks[0];
        if (firstTestTask) {
          task.dependencies.push(firstTestTask);
        }
      }
    });

    // Integration depends on some implementation
    const implTasks = tasks.filter(t => t.category === 'implementation').map(t => t.id);
    tasks.filter(t => t.category === 'integration').forEach(task => {
      if (task.dependencies.filter(d => implTasks.includes(d)).length === 0 && implTasks.length > 0) {
        const firstImplTask = implTasks[0];
        if (firstImplTask) {
          task.dependencies.push(firstImplTask);
        }
      }
    });

    // Polish depends on everything else
    const allPriorTasks = tasks.filter(t => t.category !== 'polish').map(t => t.id);
    tasks.filter(t => t.category === 'polish').forEach(task => {
      if (task.dependencies.length === 0 && allPriorTasks.length > 0) {
        const lastPriorTask = allPriorTasks[allPriorTasks.length - 1];
        if (lastPriorTask) {
          task.dependencies.push(lastPriorTask);
        }
      }
    });
  }

  private createTasksDocument(tasks: Task[], template: string): string {
    let document = template;

    // Replace header
    document = document.replace('[FEATURE NAME]', 'Generated Tasks');
    document = document.replace('[###-feature-name]', 'main');

    // Group tasks by category
    const categories = {
      setup: tasks.filter(t => t.category === 'setup'),
      test: tasks.filter(t => t.category === 'test'),
      implementation: tasks.filter(t => t.category === 'implementation'),
      integration: tasks.filter(t => t.category === 'integration'),
      polish: tasks.filter(t => t.category === 'polish'),
    };

    // Generate task sections
    let taskSections = '';
    
    taskSections += '## Phase 3.1: Setup\n';
    categories.setup.forEach(task => {
      taskSections += `- [ ] ${task.id} ${task.parallel ? '[P]' : ''} ${task.title}\n`;
    });
    
    taskSections += '\n## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3\n';
    taskSections += '**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**\n';
    categories.test.forEach(task => {
      taskSections += `- [ ] ${task.id} ${task.parallel ? '[P]' : ''} ${task.title}\n`;
    });
    
    taskSections += '\n## Phase 3.3: Core Implementation (ONLY after tests are failing)\n';
    categories.implementation.forEach(task => {
      taskSections += `- [ ] ${task.id} ${task.parallel ? '[P]' : ''} ${task.title}\n`;
    });
    
    taskSections += '\n## Phase 3.4: Integration\n';
    categories.integration.forEach(task => {
      taskSections += `- [ ] ${task.id} ${task.parallel ? '[P]' : ''} ${task.title}\n`;
    });
    
    taskSections += '\n## Phase 3.5: Polish\n';
    categories.polish.forEach(task => {
      taskSections += `- [ ] ${task.id} ${task.parallel ? '[P]' : ''} ${task.title}\n`;
    });

    // Replace sections in template
    document = document.replace(
      /## Phase 3.1: Setup[\s\S]*## Dependencies/,
      taskSections + '\n## Dependencies'
    );

    // Generate dependencies section
    let dependencySection = '## Dependencies\n\n';
    tasks.forEach(task => {
      if (task.dependencies.length > 0) {
        dependencySection += `- ${task.id} depends on: ${task.dependencies.join(', ')}\n`;
      }
    });

    document = document.replace(
      /## Dependencies[\s\S]*## Parallel Example/,
      dependencySection + '\n## Parallel Example'
    );

    // Generate parallel example
    const parallelTasks = tasks.filter(t => t.parallel).slice(0, 4);
    let parallelExample = '## Parallel Example\n```\n# Launch together:\n';
    parallelTasks.forEach(task => {
      parallelExample += `Task: "${task.title}"\n`;
    });
    parallelExample += '```\n';

    document = document.replace(
      /## Parallel Example[\s\S]*## Notes/,
      parallelExample + '\n## Notes'
    );

    return document;
  }

  private async createTaskFolder(projectId: string, task: Task): Promise<void> {
    const indexContent = `# Task ${task.id}: ${task.title}

**Category**: ${task.category}
**Parallel**: ${task.parallel}
**Dependencies**: ${task.dependencies.join(', ') || 'None'}
**Target File**: ${task.filePath || 'N/A'}

## Description
${task.description}

## Acceptance Criteria
- [ ] Tests written and failing (if applicable)
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated

## Implementation Notes
[To be filled during implementation]

## Testing Strategy
[To be filled based on TDD approach]
`;

    await this.resourceManager.writeResource(
      `specify://project/${projectId}/task/${task.id}/index`,
      indexContent
    );

    // Create subtask for detailed implementation
    const subtaskContent = `# Implementation Details for ${task.id}

## Technical Approach
[Detailed technical approach]

## Code Structure
\`\`\`
[Pseudo-code or structure]
\`\`\`

## Test Cases
1. [Test case 1]
2. [Test case 2]

## Edge Cases
- [Edge case 1]
- [Edge case 2]

## Performance Considerations
[Any performance notes]

## Security Considerations
[Any security notes]
`;

    await this.resourceManager.writeResource(
      `specify://project/${projectId}/task/${task.id}/implementation`,
      subtaskContent
    );
  }

  private getDefaultTemplate(): string {
    return `# Tasks: [FEATURE NAME]

## Phase 3.1: Setup
- [ ] T001 Initialize project structure

## Phase 3.2: Tests First (TDD)
- [ ] T002 [P] Write contract tests

## Phase 3.3: Core Implementation
- [ ] T003 Implement models

## Phase 3.4: Integration
- [ ] T004 Setup database

## Phase 3.5: Polish
- [ ] T005 Add documentation

## Dependencies
- Tasks must be executed in order

## Parallel Example
\`\`\`
Tasks marked [P] can run in parallel
\`\`\`

## Notes
- Follow TDD strictly
- Commit after each task`;
  }
}
