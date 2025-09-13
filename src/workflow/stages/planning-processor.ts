import { Context, ValidationResult } from '../../types/mcp.js';
import { PlanningInput, PlanningOutput } from '../../types/workflow.js';
import { StageProcessor } from '../workflow-manager.js';
import { logger } from '../../utils/logger.js';

export class PlanningProcessor implements StageProcessor<PlanningInput, PlanningOutput> {

  async process(input: PlanningInput, context: Context): Promise<PlanningOutput> {
    logger.info('Processing planning stage', { 
      sessionId: context.sessionId,
      functionalReqCount: input.specification?.functionalRequirements?.length || 0
    });

    try {
      // Create project phases
      const phases = await this.createProjectPhases(input.specification);
      
      // Generate work breakdown structure
      const workBreakdownStructure = await this.generateWBS(input.specification, phases);
      
      // Estimate effort and timeline
      const timeline = await this.estimateTimeline(workBreakdownStructure, phases);
      const effortEstimates = this.estimateEffort(workBreakdownStructure);
      
      // Identify resources and dependencies
      const resourceRequirements = this.identifyResourceRequirements(workBreakdownStructure);
      const dependencies = this.identifyDependencies(workBreakdownStructure);
      
      // Create risk assessment
      const riskAssessment = await this.assessRisks(input.specification, timeline);
      
      // Generate milestones
      const milestones = this.generateMilestones(phases, timeline);

      const output: PlanningOutput = {
        phases,
        workBreakdownStructure,
        timeline,
        effortEstimates,
        resourceRequirements,
        dependencies,
        riskAssessment,
        milestones,
        planningMetrics: {
          totalEffort: effortEstimates.totalHours,
          criticalPathDuration: timeline.totalDuration,
          riskScore: this.calculateOverallRiskScore(riskAssessment),
          complexityScore: this.calculateComplexityScore(input.specification)
        }
      };

      logger.info('Planning processing completed', {
        sessionId: context.sessionId,
        phaseCount: phases.length,
        totalEffort: output.planningMetrics.totalEffort,
        riskScore: output.planningMetrics.riskScore
      });

      return output;

    } catch (error) {
      logger.error('Planning processing failed', error, { sessionId: context.sessionId });
      throw error;
    }
  }

  async validate(output: PlanningOutput, _context: Context): Promise<ValidationResult> {
    const validationErrors: string[] = [];
    
    // Check minimum planning elements
    if (output.phases.length === 0) {
      validationErrors.push('No project phases defined');
    }
    
    if (output.workBreakdownStructure.length === 0) {
      validationErrors.push('Work breakdown structure is empty');
    }
    
    if (!output.timeline || output.timeline.totalDuration <= 0) {
      validationErrors.push('Invalid timeline estimation');
    }

    // Check effort estimates
    if (!output.effortEstimates || output.effortEstimates.totalHours <= 0) {
      validationErrors.push('Invalid effort estimates');
    }

    // Check dependencies are valid
    const invalidDeps = output.dependencies.filter(dep => 
      !output.workBreakdownStructure.some(wbs => wbs.id === dep.predecessor) ||
      !output.workBreakdownStructure.some(wbs => wbs.id === dep.successor)
    );
    
    if (invalidDeps.length > 0) {
      validationErrors.push(`Invalid dependencies found: ${invalidDeps.length} dependencies reference non-existent tasks`);
    }

    // Check risk assessment completeness
    if (output.riskAssessment.length === 0) {
      validationErrors.push('No risks identified - this may indicate insufficient analysis');
    }

    const isValid = validationErrors.length === 0;
    
    return {
      isValid,
      errors: validationErrors,
      metrics: {
        completeness: this.calculatePlanningCompleteness(output),
        clarity: this.calculatePlanningClarity(output),
        determinism: this.calculatePlanningDeterminism(output),
        consistency: this.calculatePlanningConsistency(output),
        timestamp: Date.now()
      }
    };
  }

  private async createProjectPhases(specification: any): Promise<Array<{
    id: string;
    name: string;
    description: string;
    objectives: string[];
    deliverables: string[];
    duration: number;
    dependencies: string[];
  }>> {
    const phases: any[] = [];

    // Standard software development phases
    const standardPhases = [
      {
        id: 'PHASE_001',
        name: 'Analysis & Design',
        description: 'Detailed analysis of requirements and system design',
        objectives: [
          'Finalize system architecture',
          'Create detailed design documents',
          'Validate technical approach'
        ],
        deliverables: [
          'System Architecture Document',
          'Technical Design Specification',
          'Database Design',
          'API Specification'
        ],
        duration: 15, // days
        dependencies: []
      },
      {
        id: 'PHASE_002',
        name: 'Development',
        description: 'Implementation of core system functionality',
        objectives: [
          'Implement core features',
          'Develop user interfaces',
          'Integrate system components'
        ],
        deliverables: [
          'Core Application',
          'User Interface',
          'API Implementation',
          'Unit Tests'
        ],
        duration: 30,
        dependencies: ['PHASE_001']
      },
      {
        id: 'PHASE_003',
        name: 'Testing & Quality Assurance',
        description: 'Comprehensive testing and quality validation',
        objectives: [
          'Execute test plans',
          'Validate requirements',
          'Ensure quality standards'
        ],
        deliverables: [
          'Test Results',
          'Bug Reports',
          'Performance Test Results',
          'Quality Assessment Report'
        ],
        duration: 10,
        dependencies: ['PHASE_002']
      },
      {
        id: 'PHASE_004',
        name: 'Deployment & Handover',
        description: 'System deployment and knowledge transfer',
        objectives: [
          'Deploy to production',
          'Train end users',
          'Transfer knowledge'
        ],
        deliverables: [
          'Production System',
          'User Documentation',
          'Training Materials',
          'Support Procedures'
        ],
        duration: 5,
        dependencies: ['PHASE_003']
      }
    ];

    phases.push(...standardPhases);

    // Add additional phases based on specification complexity
    if (specification?.nonFunctionalRequirements?.some((nfr: any) => nfr.category === 'security')) {
      phases.splice(2, 0, {
        id: 'PHASE_SEC',
        name: 'Security Implementation',
        description: 'Implementation of security measures and controls',
        objectives: [
          'Implement authentication',
          'Add authorization controls',
          'Security testing'
        ],
        deliverables: [
          'Security Implementation',
          'Security Test Results',
          'Security Documentation'
        ],
        duration: 7,
        dependencies: ['PHASE_002']
      });
    }

    return phases;
  }

  private async generateWBS(_specification: any, phases: any[]): Promise<Array<{
    id: string;
    name: string;
    description: string;
    type: 'phase' | 'deliverable' | 'task' | 'subtask';
    parentId?: string;
    effort: number;
    duration: number;
    resources: string[];
    skills: string[];
  }>> {
    const wbs: any[] = [];
    let taskId = 1;

    for (const phase of phases) {
      // Add phase as top-level WBS item
      wbs.push({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        type: 'phase',
        effort: 0, // Will be calculated from child tasks
        duration: phase.duration,
        resources: [],
        skills: []
      });

      // Generate tasks for each deliverable
      for (const deliverable of phase.deliverables) {
        const tasks = await this.generateTasksForDeliverable(deliverable, phase.id, taskId);
        wbs.push(...tasks);
        taskId += tasks.length;
      }
    }

    // Update phase effort based on child tasks
    for (const phase of wbs.filter(item => item.type === 'phase')) {
      const childTasks = wbs.filter(item => item.parentId === phase.id);
      phase.effort = childTasks.reduce((sum, task) => sum + task.effort, 0);
    }

    return wbs;
  }

  private async generateTasksForDeliverable(deliverable: string, phaseId: string, startId: number): Promise<any[]> {
    const tasks: any[] = [];
    
    const taskTemplates: Record<string, any[]> = {
      'System Architecture Document': [
        { name: 'Define system architecture', effort: 16, skills: ['Architecture', 'System Design'] },
        { name: 'Create architecture diagrams', effort: 8, skills: ['Documentation', 'Diagramming'] },
        { name: 'Review architecture decisions', effort: 4, skills: ['Architecture Review'] }
      ],
      'Core Application': [
        { name: 'Setup development environment', effort: 4, skills: ['DevOps', 'Development'] },
        { name: 'Implement core business logic', effort: 40, skills: ['Backend Development'] },
        { name: 'Create data access layer', effort: 16, skills: ['Database', 'Backend Development'] },
        { name: 'Implement API endpoints', effort: 24, skills: ['API Development'] }
      ],
      'User Interface': [
        { name: 'Create UI mockups', effort: 8, skills: ['UI Design'] },
        { name: 'Implement frontend components', effort: 32, skills: ['Frontend Development'] },
        { name: 'Integrate with backend APIs', effort: 16, skills: ['Frontend Development', 'Integration'] }
      ],
      'Unit Tests': [
        { name: 'Write unit tests', effort: 20, skills: ['Testing', 'Development'] },
        { name: 'Setup test automation', effort: 8, skills: ['Test Automation'] },
        { name: 'Achieve code coverage targets', effort: 12, skills: ['Testing'] }
      ]
    };

    const defaultTasks = [
      { name: `Analyze ${deliverable} requirements`, effort: 4, skills: ['Analysis'] },
      { name: `Design ${deliverable}`, effort: 8, skills: ['Design'] },
      { name: `Implement ${deliverable}`, effort: 16, skills: ['Development'] },
      { name: `Review ${deliverable}`, effort: 4, skills: ['Review'] }
    ];

    const tasksToCreate = taskTemplates[deliverable] || defaultTasks;

    tasksToCreate.forEach((task, index) => {
      tasks.push({
        id: `TASK_${(startId + index).toString().padStart(3, '0')}`,
        name: task.name,
        description: `Task for creating ${deliverable}`,
        type: 'task',
        parentId: phaseId,
        effort: task.effort,
        duration: Math.ceil(task.effort / 8), // Assuming 8 hours per day
        resources: ['Developer'],
        skills: task.skills
      });
    });

    return tasks;
  }

  private async estimateTimeline(wbs: any[], _phases: any[]): Promise<{
    totalDuration: number;
    phases: Array<{
      phaseId: string;
      startDate: string;
      endDate: string;
      duration: number;
    }>;
    criticalPath: string[];
  }> {
    const phases = wbs.filter(item => item.type === 'phase');
    let currentDate = new Date();
    const phaseTimeline: any[] = [];
    
    for (const phase of phases) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + phase.duration);
      
      phaseTimeline.push({
        phaseId: phase.id,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        duration: phase.duration
      });
      
      currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() + 1); // 1 day buffer between phases
    }

    const totalDuration = phaseTimeline.reduce((sum, phase) => sum + phase.duration, 0);
    const criticalPath = phases.map(phase => phase.id); // Simplified critical path

    return {
      totalDuration,
      phases: phaseTimeline,
      criticalPath
    };
  }

  private async assessRisks(specification: any, _timeline: any): Promise<Array<{
    id: string;
    category: 'technical' | 'schedule' | 'resource' | 'business' | 'external';
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    mitigation: string;
    contingency: string;
  }>> {
    const risks: any[] = [];
    let riskId = 1;

    // Standard project risks
    const standardRisks = [
      {
        category: 'technical',
        description: 'Technical complexity may exceed initial estimates',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Conduct proof of concept for complex features',
        contingency: 'Simplify features or extend timeline'
      },
      {
        category: 'schedule',
        description: 'Timeline may be optimistic given scope',
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Regular progress monitoring and early issue identification',
        contingency: 'Reduce scope or add resources'
      },
      {
        category: 'resource',
        description: 'Key team members may become unavailable',
        probability: 'low',
        impact: 'high',
        mitigation: 'Knowledge sharing and documentation',
        contingency: 'Cross-train team members'  
      },
      {
        category: 'business',
        description: 'Requirements may change during development',
        probability: 'high',
        impact: 'medium',
        mitigation: 'Regular stakeholder reviews and change control process',
        contingency: 'Agile development approach'
      }
    ];

    // Add complexity-based risks
    if (specification?.functionalRequirements?.length > 20) {
      standardRisks.push({
        category: 'technical',
        description: 'High number of requirements increases integration complexity',
        probability: 'high',
        impact: 'medium',
        mitigation: 'Phased development and integration testing',
        contingency: 'Prioritize core features'
      });
    }

    for (const risk of standardRisks) {
      const probabilityScore = this.getProbabilityScore(risk.probability);
      const impactScore = this.getImpactScore(risk.impact);
      
      risks.push({
        id: `RISK_${riskId.toString().padStart(3, '0')}`,
        ...risk,
        riskScore: probabilityScore * impactScore
      });
      
      riskId++;
    }

    return risks;
  }


  private getProbabilityScore(probability: string): number {
    const scores = { low: 1, medium: 2, high: 3 };
    return scores[probability as keyof typeof scores] || 2;
  }

  private getImpactScore(impact: string): number {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[impact as keyof typeof scores] || 2;
  }

  private calculateOverallRiskScore(risks: any[]): number {
    if (risks.length === 0) return 0;
    return risks.reduce((sum, risk) => sum + risk.riskScore, 0) / risks.length;
  }

  private calculateComplexityScore(specification: any): number {
    let score = 0;
    
    if (specification?.functionalRequirements) {
      score += specification.functionalRequirements.length * 0.1;
    }
    
    if (specification?.nonFunctionalRequirements) {
      score += specification.nonFunctionalRequirements.length * 0.2;
    }
    
    if (specification?.interfaces) {
      score += specification.interfaces.length * 0.3;
    }
    
    return Math.min(10, score); // Cap at 10
  }

  private calculatePlanningCompleteness(output: PlanningOutput): number {
    let score = 0;
    const maxScore = 7;

    if (output.phases.length > 0) score += 1;
    if (output.workBreakdownStructure.length > 0) score += 1;
    if (output.timeline && output.timeline.totalDuration > 0) score += 1;
    if (output.effortEstimates && output.effortEstimates.totalHours > 0) score += 1;
    if (output.resourceRequirements.length > 0) score += 1;
    if (output.riskAssessment.length > 0) score += 1;
    if (output.milestones.length > 0) score += 1;

    return score / maxScore;
  }

  private calculatePlanningClarity(output: PlanningOutput): number {
    // Measure clarity based on descriptions and details
    const hasDetailedPhases = output.phases.every(phase => 
      phase.description.length > 20 && phase.objectives.length > 0
    );
    
    const hasDetailedTasks = output.workBreakdownStructure.every(wbs =>
      wbs.description.length > 10 && wbs.effort > 0
    );

    return (hasDetailedPhases ? 0.5 : 0) + (hasDetailedTasks ? 0.5 : 0);
  }

  private calculatePlanningDeterminism(output: PlanningOutput): number {
    // Measure determinism based on quantified estimates
    const hasQuantifiedEstimates = output.effortEstimates.totalHours > 0 && 
                                  output.timeline.totalDuration > 0;
    
    const hasDetailedBreakdown = output.workBreakdownStructure.length > 5;
    
    const hasRiskQuantification = output.riskAssessment.every(risk => 
      typeof risk.riskScore === 'number'
    );

    let score = 0;
    if (hasQuantifiedEstimates) score += 0.4;
    if (hasDetailedBreakdown) score += 0.3;
    if (hasRiskQuantification) score += 0.3;

    return score;
  }

  private estimateEffort(wbs: any[]): any {
    const totalDays = wbs.reduce((sum, item) => sum + item.duration, 0);
    const totalHours = wbs.reduce((sum, item) => sum + item.effort, 0);
    
    return {
      totalHours,
      totalDays,
      averageVelocity: totalHours / (totalDays || 1),
      effortDistribution: wbs.reduce((dist, item) => {
        dist[item.type] = (dist[item.type] || 0) + item.effort;
        return dist;
      }, {})
    };
  }

  private identifyResourceRequirements(wbs: any[]): Array<{
    role: string;
    skillLevel: 'junior' | 'mid' | 'senior';
    requiredSkills: string[];
    workload: number;
    availability: string;
  }> {
    const uniqueSkills = new Set(wbs.flatMap(item => item.skills));
    const resources: any[] = [];
    
    uniqueSkills.forEach(skill => {
      resources.push({
        role: `${skill} Developer`,
        skillLevel: 'mid' as const,
        requiredSkills: [skill],
        workload: 1.0,
        availability: 'Full-time'
      });
    });
    
    return resources;
  }

  private identifyDependencies(wbs: any[]): Array<{
    type: 'internal' | 'external';
    description: string;
    dependentTask: string;
    prerequisiteTask: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const dependencies: any[] = [];
    
    wbs.forEach(item => {
      if (item.type === 'task' && item.parentId) {
        dependencies.push({
          type: 'internal' as const,
          description: `${item.name} depends on completion of ${item.parentId}`,
          dependentTask: item.id,
          prerequisiteTask: item.parentId,
          impact: 'high' as const
        });
      }
    });
    
    return dependencies;
  }

  private generateMilestones(phases: any[], _timeline: any): Array<{
    id: string;
    name: string;
    description: string;
    targetDate: string;
    criteria: string[];
    dependencies: string[];
  }> {
    const milestones: any[] = [];
    let milestoneId = 1;

    phases.forEach(phase => {
      milestones.push({
        id: `MS_${milestoneId.toString().padStart(3, '0')}`,
        name: `${phase.name} Complete`,
        description: `Completion of ${phase.name} phase`,
        targetDate: new Date(Date.now() + milestoneId * 30 * 24 * 60 * 60 * 1000).toISOString(),
        criteria: phase.deliverables || [`${phase.name} deliverables completed`],
        dependencies: [phase.id]
      });
      milestoneId++;
    });
    
    return milestones;
  }

  private calculatePlanningConsistency(output: PlanningOutput): number {
    // Check consistency between different planning elements
    const phaseIds = new Set(output.phases.map(p => p.id));
    const timelinePhaseIds = new Set(output.timeline.phases.map((p: any) => p.phaseId));
    const wbsPhaseIds = new Set(output.workBreakdownStructure
      .filter(wbs => wbs.type === 'phase')
      .map(wbs => wbs.id)
    );

    // All phase IDs should be consistent across planning elements
    const allPhasesConsistent = phaseIds.size === timelinePhaseIds.size && 
                               phaseIds.size === wbsPhaseIds.size;

    return allPhasesConsistent ? 1.0 : 0.7;
  }
}
