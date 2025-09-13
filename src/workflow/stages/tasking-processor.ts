import { Context, ValidationResult } from '../../types/mcp.js';
import { TaskingInput, TaskingOutput } from '../../types/workflow.js';
import { StageProcessor } from '../workflow-manager.js';
import { logger } from '../../utils/logger.js';

export class TaskingProcessor implements StageProcessor<TaskingInput, TaskingOutput> {

  async process(input: TaskingInput, context: Context): Promise<TaskingOutput> {
    logger.info('Processing tasking stage', { 
      sessionId: context.sessionId,
      wbsItems: input.plan?.workBreakdownStructure?.length || 0
    });

    try {
      // Generate detailed tasks from WBS
      const detailedTasks = await this.generateDetailedTasks(input.plan);
      
      // Create task assignments
      const taskAssignments = await this.createTaskAssignments(detailedTasks, input.plan?.resourceRequirements);
      
      // Generate implementation strategies
      const implementationStrategies = await this.generateImplementationStrategies(detailedTasks);
      
      // Create quality gates
      const qualityGates = await this.createQualityGates(detailedTasks);
      
      // Define success criteria for each task
      const successCriteria = await this.defineSuccessCriteria(detailedTasks);
      
      // Generate monitoring framework
      const monitoringFramework = await this.createMonitoringFramework(detailedTasks);

      const output: TaskingOutput = {
        detailedTasks,
        taskAssignments,
        implementationStrategies,
        qualityGates,
        successCriteria,
        monitoringFramework,
        taskingMetrics: {
          totalTasks: detailedTasks.length,
          averageTaskComplexity: this.calculateAverageComplexity(detailedTasks),
          estimatedVelocity: this.estimateVelocity(detailedTasks),
          riskDistribution: this.calculateRiskDistribution(detailedTasks)
        }
      };

      logger.info('Tasking processing completed', {
        sessionId: context.sessionId,
        totalTasks: output.taskingMetrics.totalTasks,
        avgComplexity: output.taskingMetrics.averageTaskComplexity
      });

      return output;

    } catch (error) {
      logger.error('Tasking processing failed', error, { sessionId: context.sessionId });
      throw error;
    }
  }

  async validate(output: TaskingOutput, _context: Context): Promise<ValidationResult> {
    const validationErrors: string[] = [];
    
    // Check minimum tasking elements
    if (output.detailedTasks.length === 0) {
      validationErrors.push('No detailed tasks generated');
    }
    
    if (output.taskAssignments.length === 0) {
      validationErrors.push('No task assignments created');
    }

    // Validate task completeness
    const incompleteTasks = output.detailedTasks.filter(task => 
      !task.description || task.estimatedHours <= 0 || !task.acceptanceCriteria.length
    );
    
    if (incompleteTasks.length > 0) {
      validationErrors.push(`${incompleteTasks.length} tasks are incomplete or missing details`);
    }

    // Check assignment coverage
    const unassignedTasks = output.detailedTasks.filter(task =>
      !output.taskAssignments.some(assignment => assignment.taskId === task.id)
    );
    
    if (unassignedTasks.length > 0) {
      validationErrors.push(`${unassignedTasks.length} tasks are not assigned to any resource`);
    }

    // Validate quality gates
    if (output.qualityGates.length === 0) {
      validationErrors.push('No quality gates defined');
    }

    const isValid = validationErrors.length === 0;
    
    return {
      isValid,
      errors: validationErrors,
      metrics: {
        completeness: this.calculateTaskingCompleteness(output),
        clarity: this.calculateTaskingClarity(output),
        determinism: this.calculateTaskingDeterminism(output),
        consistency: this.calculateTaskingConsistency(output),
        timestamp: Date.now()
      }
    };
  }

  private async generateDetailedTasks(plan: any): Promise<Array<{
    id: string;
    name: string;
    description: string;
    type: 'development' | 'testing' | 'documentation' | 'review' | 'deployment';
    priority: 'critical' | 'high' | 'medium' | 'low';
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    estimatedHours: number;
    dependencies: string[];
    requiredSkills: string[];
    acceptanceCriteria: string[];
    deliverables: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }>> {
    const detailedTasks: any[] = [];
    const wbsItems = plan?.workBreakdownStructure || [];
    
    for (const wbsItem of wbsItems.filter((item: any) => item.type === 'task')) {
      // Break down WBS tasks into more detailed implementation tasks
      const subTasks = await this.breakDownTask(wbsItem);
      detailedTasks.push(...subTasks);
    }

    return detailedTasks;
  }

  private async breakDownTask(wbsItem: any): Promise<any[]> {
    const subTasks: any[] = [];
    let taskId = 1;

    // Task breakdown patterns based on skill types
    const taskPatterns: Record<string, any[]> = {
      'Backend Development': [
        {
          suffix: 'Setup',
          description: 'Setup development environment and dependencies',
          type: 'development',
          complexity: 'simple',
          estimatedHours: 4,
          acceptanceCriteria: ['Development environment configured', 'Dependencies installed', 'Basic project structure created']
        },
        {
          suffix: 'Implementation',
          description: 'Implement core functionality',
          type: 'development',
          complexity: 'complex',
          estimatedHours: Math.floor(wbsItem.effort * 0.6),
          acceptanceCriteria: ['Core functionality implemented', 'Basic error handling added', 'Code follows standards']
        },
        {
          suffix: 'Testing',
          description: 'Write and execute unit tests',
          type: 'testing',
          complexity: 'moderate',
          estimatedHours: Math.floor(wbsItem.effort * 0.3),
          acceptanceCriteria: ['Unit tests written', 'Code coverage > 80%', 'All tests passing']
        },
        {
          suffix: 'Documentation',
          description: 'Create technical documentation',
          type: 'documentation',
          complexity: 'simple',
          estimatedHours: Math.floor(wbsItem.effort * 0.1),
          acceptanceCriteria: ['API documented', 'Code comments added', 'README updated']
        }
      ],
      'Frontend Development': [
        {
          suffix: 'Mockup',
          description: 'Create UI mockups and wireframes',
          type: 'development',
          complexity: 'simple',
          estimatedHours: 8,
          acceptanceCriteria: ['Mockups created', 'User flow designed', 'Stakeholder approval received']
        },
        {
          suffix: 'Components',
          description: 'Develop UI components',
          type: 'development',
          complexity: 'moderate',
          estimatedHours: Math.floor(wbsItem.effort * 0.5),
          acceptanceCriteria: ['Components implemented', 'Responsive design working', 'Accessibility standards met']
        },
        {
          suffix: 'Integration',
          description: 'Integrate with backend services',
          type: 'development',
          complexity: 'moderate',
          estimatedHours: Math.floor(wbsItem.effort * 0.3),
          acceptanceCriteria: ['API integration complete', 'Error handling implemented', 'Data flow working']
        },
        {
          suffix: 'Testing',
          description: 'Frontend testing and validation',
          type: 'testing',
          complexity: 'moderate',
          estimatedHours: Math.floor(wbsItem.effort * 0.2),
          acceptanceCriteria: ['UI tests written', 'Cross-browser testing done', 'Performance validated']
        }
      ]
    };

    // Default breakdown for other skills
    const defaultPattern = [
      {
        suffix: 'Analysis',
        description: 'Analyze requirements and approach',
        type: 'development',
        complexity: 'simple',
        estimatedHours: Math.floor(wbsItem.effort * 0.2),
        acceptanceCriteria: ['Requirements analyzed', 'Approach defined', 'Dependencies identified']
      },
      {
        suffix: 'Implementation',
        description: 'Implement the solution',
        type: 'development',
        complexity: 'moderate',
        estimatedHours: Math.floor(wbsItem.effort * 0.6),
        acceptanceCriteria: ['Solution implemented', 'Basic testing completed', 'Standards followed']
      },
      {
        suffix: 'Review',
        description: 'Review and refine the work',
        type: 'review',
        complexity: 'simple',
        estimatedHours: Math.floor(wbsItem.effort * 0.2),
        acceptanceCriteria: ['Work reviewed', 'Issues addressed', 'Quality standards met']
      }
    ];

    // Select appropriate pattern based on skills
    const primarySkill = wbsItem.skills?.[0] || 'General';
    const pattern = taskPatterns[primarySkill] || defaultPattern;

    for (const taskTemplate of pattern) {
      const taskIdStr = `${wbsItem.id}_${taskId.toString().padStart(2, '0')}`;
      
      subTasks.push({
        id: taskIdStr,
        name: `${wbsItem.name} - ${taskTemplate.suffix}`,
        description: taskTemplate.description,
        type: taskTemplate.type,
        priority: this.derivePriority(wbsItem),
        complexity: taskTemplate.complexity,
        estimatedHours: Math.max(1, taskTemplate.estimatedHours),
        dependencies: taskId === 1 ? [] : [`${wbsItem.id}_${(taskId - 1).toString().padStart(2, '0')}`],
        requiredSkills: wbsItem.skills || [],
        acceptanceCriteria: taskTemplate.acceptanceCriteria,
        deliverables: [`${wbsItem.name} - ${taskTemplate.suffix} Complete`],
        riskLevel: this.assessTaskRisk(taskTemplate.complexity, wbsItem.skills)
      });
      
      taskId++;
    }

    return subTasks;
  }

  private async createTaskAssignments(tasks: any[], _resourceRequirements: any[] = []): Promise<Array<{
    id: string;
    taskId: string;
    resourceRole: string;
    assignedTo?: string;
    startDate: string;
    endDate: string;
    workload: number;
    notes?: string;
  }>> {
    const assignments: any[] = [];
    let assignmentId = 1;
    let currentDate = new Date();

    // Create skill-to-role mapping
    const roleMapping: Record<string, string> = {
      'Backend Development': 'Backend Developer',
      'Frontend Development': 'Frontend Developer',
      'Testing': 'QA Engineer',
      'Documentation': 'Technical Writer',
      'Architecture': 'System Architect',
      'DevOps': 'DevOps Engineer',
      'UI Design': 'UI/UX Designer'
    };

    for (const task of tasks) {
      const primarySkill = task.requiredSkills[0] || 'Development';
      const role = roleMapping[primarySkill] || 'Developer';
      
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + Math.ceil(task.estimatedHours / 8));

      assignments.push({
        id: `ASSIGN_${assignmentId.toString().padStart(3, '0')}`,
        taskId: task.id,
        resourceRole: role,
        assignedTo: undefined, // To be assigned during project execution
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        workload: task.estimatedHours,
        notes: task.complexity === 'very_complex' ? 'High-complexity task requiring senior resource' : undefined
      });

      assignmentId++;
      currentDate = new Date(endDate);
    }

    return assignments;
  }

  private async generateImplementationStrategies(tasks: any[]): Promise<Array<{
    taskId: string;
    strategy: string;
    approach: 'incremental' | 'iterative' | 'waterfall' | 'prototype';
    tools: string[];
    techniques: string[];
    qualityMeasures: string[];
  }>> {
    const strategies: any[] = [];

    for (const task of tasks) {
      let strategy: string;
      let approach: 'incremental' | 'iterative' | 'waterfall' | 'prototype';
      let tools: string[];
      let techniques: string[];
      let qualityMeasures: string[];

      switch (task.type) {
        case 'development':
          strategy = task.complexity === 'very_complex' ? 
            'Break down into smaller components and implement incrementally' :
            'Direct implementation with regular testing';
          approach = task.complexity === 'very_complex' ? 'incremental' : 'iterative';
          tools = this.getToolsForSkills(task.requiredSkills);
          techniques = ['Code review', 'Pair programming', 'TDD'];
          qualityMeasures = ['Code coverage', 'Cyclomatic complexity', 'Performance benchmarks'];
          break;

        case 'testing':
          strategy = 'Comprehensive testing approach covering unit, integration, and acceptance tests';
          approach = 'iterative';
          tools = ['Jest', 'Cypress', 'Postman', 'Selenium'];
          techniques = ['Test-driven development', 'Behavior-driven development', 'Risk-based testing'];
          qualityMeasures = ['Test coverage', 'Defect density', 'Test pass rate'];
          break;

        case 'documentation':
          strategy = 'Create comprehensive, maintainable documentation aligned with code';
          approach = 'waterfall';
          tools = ['Markdown', 'Swagger/OpenAPI', 'JSDoc'];
          techniques = ['Documentation as code', 'Living documentation', 'Template-based writing'];
          qualityMeasures = ['Documentation coverage', 'Readability score', 'Accuracy validation'];
          break;

        case 'review':
          strategy = 'Systematic review process with multiple checkpoints';
          approach = 'waterfall';
          tools = ['Code review tools', 'Checklists', 'Metrics dashboards'];
          techniques = ['Peer review', 'Checklist-based review', 'Walkthrough'];
          qualityMeasures = ['Review coverage', 'Issue detection rate', 'Resolution time'];
          break;

        default:
          strategy = 'Standard implementation approach with quality gates';
          approach = 'iterative';
          tools = ['Standard development tools'];
          techniques = ['Best practices', 'Regular checkpoints'];
          qualityMeasures = ['Quality metrics', 'Progress tracking'];
      }

      strategies.push({
        taskId: task.id,
        strategy,
        approach,
        tools,
        techniques,
        qualityMeasures
      });
    }

    return strategies;
  }

  private async createQualityGates(tasks: any[]): Promise<Array<{
    id: string;
    name: string;
    description: string;
    applicableTasks: string[];
    criteria: Array<{
      metric: string;
      threshold: string | number;
      required: boolean;
    }>;
    automatable: boolean;
  }>> {
    const qualityGates: any[] = [
      {
        id: 'QG_001',
        name: 'Code Quality Gate',
        description: 'Ensures code meets quality standards before progression',
        applicableTasks: tasks.filter(t => t.type === 'development').map(t => t.id),
        criteria: [
          { metric: 'Code Coverage', threshold: '80%', required: true },
          { metric: 'Cyclomatic Complexity', threshold: 10, required: true },
          { metric: 'Code Review Approval', threshold: 'Required', required: true },
          { metric: 'Static Analysis Score', threshold: 'A', required: false }
        ],
        automatable: true
      },
      {
        id: 'QG_002',
        name: 'Testing Quality Gate',
        description: 'Validates testing completeness and effectiveness',
        applicableTasks: tasks.filter(t => t.type === 'testing').map(t => t.id),
        criteria: [
          { metric: 'Test Pass Rate', threshold: '100%', required: true },
          { metric: 'Test Coverage', threshold: '95%', required: true },
          { metric: 'Critical Bugs', threshold: 0, required: true },
          { metric: 'Performance Tests', threshold: 'Passed', required: false }
        ],
        automatable: true
      },
      {
        id: 'QG_003',
        name: 'Documentation Quality Gate',
        description: 'Ensures documentation is complete and accurate',
        applicableTasks: tasks.filter(t => t.type === 'documentation').map(t => t.id),
        criteria: [
          { metric: 'Documentation Coverage', threshold: '100%', required: true },
          { metric: 'Readability Score', threshold: 'Good', required: true },
          { metric: 'Technical Accuracy', threshold: 'Validated', required: true },
          { metric: 'Stakeholder Approval', threshold: 'Approved', required: true }
        ],
        automatable: false
      }
    ];

    return qualityGates;
  }

  private async defineSuccessCriteria(tasks: any[]): Promise<Array<{
    taskId: string;
    criteria: Array<{
      description: string;
      measurable: boolean;
      verificationMethod: string;
      priority: 'must_have' | 'should_have' | 'nice_to_have';
    }>;
  }>> {
    const successCriteria: any[] = [];

    for (const task of tasks) {
      const criteria = task.acceptanceCriteria.map((criterion: string) => ({
        description: criterion,
        measurable: this.isMeasurable(criterion),
        verificationMethod: this.getVerificationMethod(criterion, task.type),
        priority: 'must_have' as const
      }));

      // Add type-specific criteria
      if (task.type === 'development') {
        criteria.push({
          description: 'Code follows established coding standards',
          measurable: true,
          verificationMethod: 'Static analysis tool',
          priority: 'must_have'
        });
      }

      if (task.complexity === 'very_complex') {
        criteria.push({
          description: 'Solution has been peer-reviewed by senior team member',
          measurable: false,
          verificationMethod: 'Peer review process',
          priority: 'must_have'
        });
      }

      successCriteria.push({
        taskId: task.id,
        criteria
      });
    }

    return successCriteria;
  }

  private async createMonitoringFramework(_tasks: any[]): Promise<{
    trackingMetrics: Array<{
      name: string;
      description: string;
      formula: string;
      frequency: 'daily' | 'weekly' | 'milestone';
      target: string;
    }>;
    reportingSchedule: Array<{
      reportType: string;
      frequency: string;
      stakeholders: string[];
      content: string[];
    }>;
    alertThresholds: Array<{
      metric: string;
      condition: string;
      action: string;
    }>;
  }> {
    const trackingMetrics = [
      {
        name: 'Task Completion Rate',
        description: 'Percentage of tasks completed on schedule',
        formula: '(Completed Tasks / Total Tasks) * 100',
        frequency: 'daily' as const,
        target: '100% on schedule'
      },
      {
        name: 'Quality Gate Success Rate',
        description: 'Percentage of tasks passing quality gates on first attempt',
        formula: '(Tasks Passed QG First Time / Total Tasks Through QG) * 100',
        frequency: 'weekly' as const,
        target: '>80%'
      },
      {
        name: 'Risk Realization Rate',
        description: 'Percentage of identified risks that materialized',
        formula: '(Risks Materialized / Total Risks Identified) * 100',
        frequency: 'milestone' as const,
        target: '<20%'
      },
      {
        name: 'Resource Utilization',
        description: 'Percentage of planned resource hours utilized',
        formula: '(Actual Hours / Planned Hours) * 100',
        frequency: 'weekly' as const,
        target: '90-110%'
      }
    ];

    const reportingSchedule = [
      {
        reportType: 'Daily Progress Report',
        frequency: 'Daily',
        stakeholders: ['Project Manager', 'Team Leads'],
        content: ['Tasks completed', 'Blockers identified', 'Next day plan']
      },
      {
        reportType: 'Weekly Status Report',
        frequency: 'Weekly',
        stakeholders: ['Stakeholders', 'Management', 'Project Team'],
        content: ['Progress summary', 'Quality metrics', 'Risk status', 'Schedule adherence']
      },
      {
        reportType: 'Milestone Report',
        frequency: 'Per Milestone',
        stakeholders: ['Executive Sponsors', 'Key Stakeholders'],
        content: ['Milestone achievement', 'Budget status', 'Risk assessment', 'Next phase readiness']
      }
    ];

    const alertThresholds = [
      {
        metric: 'Task Completion Rate',
        condition: '<80% for 3 consecutive days',
        action: 'Trigger schedule risk review'
      },
      {
        metric: 'Quality Gate Failure Rate',
        condition: '>30% in any week',
        action: 'Initiate quality improvement actions'
      },
      {
        metric: 'Resource Utilization',
        condition: '<70% or >130%',
        action: 'Review resource allocation'
      }
    ];

    return {
      trackingMetrics,
      reportingSchedule,
      alertThresholds
    };
  }

  private derivePriority(wbsItem: any): 'critical' | 'high' | 'medium' | 'low' {
    // Derive priority from parent phase or task characteristics
    if (wbsItem.parentId?.includes('PHASE_001')) return 'high'; // Analysis & Design
    if (wbsItem.skills?.includes('Architecture')) return 'critical';
    if (wbsItem.skills?.includes('Security')) return 'high';
    return 'medium';
  }

  private assessTaskRisk(complexity: string, skills: string[] = []): 'low' | 'medium' | 'high' {
    if (complexity === 'very_complex' || skills.includes('Architecture')) return 'high';
    if (complexity === 'complex' || skills.includes('Integration')) return 'medium';
    return 'low';
  }

  private getToolsForSkills(skills: string[]): string[] {
    const toolMapping: Record<string, string[]> = {
      'Backend Development': ['Node.js', 'Express', 'MongoDB', 'Jest'],
      'Frontend Development': ['React', 'TypeScript', 'Webpack', 'Cypress'],
      'Testing': ['Jest', 'Postman', 'Selenium', 'JMeter'],
      'Documentation': ['Markdown', 'Swagger', 'GitBook'],
      'DevOps': ['Docker', 'Jenkins', 'AWS', 'Terraform']
    };

    const tools = new Set<string>();
    for (const skill of skills) {
      const skillTools = toolMapping[skill] || ['Standard Development Tools'];
      skillTools.forEach(tool => tools.add(tool));
    }

    return Array.from(tools);
  }

  private isMeasurable(criterion: string): boolean {
    const measurableKeywords = ['>', '<', '%', 'count', 'number', 'time', 'rate', 'coverage'];
    return measurableKeywords.some(keyword => criterion.toLowerCase().includes(keyword));
  }

  private getVerificationMethod(criterion: string, taskType: string): string {
    if (criterion.toLowerCase().includes('test')) return 'Automated testing';
    if (criterion.toLowerCase().includes('coverage')) return 'Coverage analysis tool';
    if (criterion.toLowerCase().includes('review')) return 'Peer review';
    if (criterion.toLowerCase().includes('standard')) return 'Static analysis';
    
    switch (taskType) {
      case 'development': return 'Code inspection and testing';
      case 'testing': return 'Test execution and results validation';
      case 'documentation': return 'Documentation review';
      case 'review': return 'Review checklist completion';
      default: return 'Manual verification';
    }
  }

  private calculateAverageComplexity(tasks: any[]): number {
    const complexityScores = { simple: 1, moderate: 2, complex: 3, very_complex: 4 };
    const totalScore = tasks.reduce((sum, task) => 
      sum + (complexityScores[task.complexity as keyof typeof complexityScores] || 2), 0
    );
    return tasks.length > 0 ? totalScore / tasks.length : 0;
  }

  private estimateVelocity(tasks: any[]): number {
    // Estimate tasks per week based on complexity and hours
    const totalHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    const assumedHoursPerWeek = 40;
    return totalHours > 0 ? tasks.length / (totalHours / assumedHoursPerWeek) : 0;
  }

  private calculateRiskDistribution(tasks: any[]): Record<string, number> {
    const distribution = { low: 0, medium: 0, high: 0 };
    tasks.forEach(task => {
      distribution[task.riskLevel as keyof typeof distribution]++;
    });
    return distribution;
  }

  private calculateTaskingCompleteness(output: TaskingOutput): number {
    let score = 0;
    const maxScore = 6;

    if (output.detailedTasks.length > 0) score += 1;
    if (output.taskAssignments.length > 0) score += 1;
    if (output.implementationStrategies.length > 0) score += 1;
    if (output.qualityGates.length > 0) score += 1;
    if (output.successCriteria.length > 0) score += 1;
    if (output.monitoringFramework.trackingMetrics.length > 0) score += 1;

    return score / maxScore;
  }

  private calculateTaskingClarity(output: TaskingOutput): number {
    const tasksWithDetails = output.detailedTasks.filter(task =>
      task.description.length > 20 && task.acceptanceCriteria.length > 0
    );
    
    return output.detailedTasks.length > 0 ? tasksWithDetails.length / output.detailedTasks.length : 0;
  }

  private calculateTaskingDeterminism(output: TaskingOutput): number {
    const tasksWithEstimates = output.detailedTasks.filter(task => task.estimatedHours > 0);
    const assignmentsWithDates = output.taskAssignments.filter(assignment => 
      assignment.startDate && assignment.endDate
    );
    
    const estimateScore = output.detailedTasks.length > 0 ? tasksWithEstimates.length / output.detailedTasks.length : 0;
    const assignmentScore = output.taskAssignments.length > 0 ? assignmentsWithDates.length / output.taskAssignments.length : 0;
    
    return (estimateScore + assignmentScore) / 2;
  }

  private calculateTaskingConsistency(output: TaskingOutput): number {
    // Check consistency between tasks and assignments
    const tasksWithAssignments = output.detailedTasks.filter(task =>
      output.taskAssignments.some(assignment => assignment.taskId === task.id)
    );
    
    const assignmentConsistency = output.detailedTasks.length > 0 ? 
      tasksWithAssignments.length / output.detailedTasks.length : 1;
    
    // Check quality gate coverage
    const tasksWithQualityGates = output.detailedTasks.filter(task =>
      output.qualityGates.some(qg => qg.applicableTasks.includes(task.id))
    );
    
    const qualityGateConsistency = output.detailedTasks.length > 0 ?
      tasksWithQualityGates.length / output.detailedTasks.length : 1;
    
    return (assignmentConsistency + qualityGateConsistency) / 2;
  }
}
