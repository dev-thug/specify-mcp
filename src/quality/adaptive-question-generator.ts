/**
 * Adaptive Question Generator
 * Dynamically generates questions based on project complexity and previous answers
 * Solves the "2 questions only" limitation
 */

export interface ProjectComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'enterprise';
  score: number; // 0-100
  factors: {
    userTypes: number;
    features: number;
    integrations: number;
    scale: string;
    technicalChallenges: number;
  };
  reasoning: string;
}

export interface Question {
  id: string;
  text: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  followUpTo?: string; // ID of question this follows up on
  dependsOn?: string[]; // IDs of questions this depends on
  expectedDetailLevel: 'brief' | 'moderate' | 'detailed';
  examples?: string[];
  whyAsking: string;
}

export interface QuestionSet {
  phase: string;
  complexity: ProjectComplexity;
  totalQuestions: number;
  criticalQuestions: Question[];
  additionalQuestions: Question[];
  followUpQuestions: Question[];
  estimatedTime: string;
}

export interface Answer {
  questionId: string;
  content: string;
  confidence: number;
  timestamp: Date;
  wordCount: number;
  hasExamples: boolean;
  hasNumbers: boolean;
}

export class AdaptiveQuestionGenerator {
  private questionHistory: Map<string, Answer[]> = new Map();
  private contextMemory: Map<string, any> = new Map();
  
  /**
   * Analyze project complexity from initial description
   */
  analyzeProjectComplexity(initialDescription: string): ProjectComplexity {
    const lower = initialDescription.toLowerCase();
    let score = 0;
    const factors = {
      userTypes: 0,
      features: 0,
      integrations: 0,
      scale: 'small',
      technicalChallenges: 0
    };
    
    // Count user types
    const userPatterns = [
      'admin', 'user', 'customer', 'client', 'manager', 'developer',
      'operator', 'analyst', 'viewer', 'guest', 'moderator'
    ];
    factors.userTypes = userPatterns.filter(p => lower.includes(p)).length;
    score += Math.min(factors.userTypes * 5, 20);
    
    // Count features
    const featureIndicators = [
      'dashboard', 'reporting', 'analytics', 'api', 'integration',
      'authentication', 'authorization', 'payment', 'notification',
      'search', 'filter', 'export', 'import', 'workflow', 'automation'
    ];
    factors.features = featureIndicators.filter(f => lower.includes(f)).length;
    score += Math.min(factors.features * 4, 30);
    
    // Check for integrations
    const integrationPatterns = [
      'integrate', 'third-party', 'external', 'api', 'webhook',
      'plugin', 'extension', 'connect with', 'sync with'
    ];
    factors.integrations = integrationPatterns.filter(i => lower.includes(i)).length;
    score += Math.min(factors.integrations * 6, 20);
    
    // Determine scale
    if (lower.includes('enterprise') || lower.includes('large-scale')) {
      factors.scale = 'enterprise';
      score += 20;
    } else if (lower.includes('medium') || lower.includes('mid-size')) {
      factors.scale = 'medium';
      score += 10;
    } else {
      factors.scale = 'small';
    }
    
    // Count technical challenges
    const challengeIndicators = [
      'real-time', 'scalable', 'distributed', 'microservice',
      'high availability', 'performance', 'security', 'compliance',
      'machine learning', 'ai', 'blockchain', 'iot'
    ];
    factors.technicalChallenges = challengeIndicators.filter(c => lower.includes(c)).length;
    score += Math.min(factors.technicalChallenges * 5, 20);
    
    // Determine complexity level
    let level: ProjectComplexity['level'];
    let reasoning: string;
    
    if (score >= 70) {
      level = 'enterprise';
      reasoning = 'Enterprise-level project with multiple user types, extensive features, and technical challenges';
    } else if (score >= 45) {
      level = 'complex';
      reasoning = 'Complex project requiring detailed planning and multiple integrations';
    } else if (score >= 25) {
      level = 'moderate';
      reasoning = 'Moderate complexity with standard features and some integrations';
    } else {
      level = 'simple';
      reasoning = 'Simple project with basic requirements';
    }
    
    return {
      level,
      score,
      factors,
      reasoning
    };
  }
  
  /**
   * Generate questions based on complexity and phase
   */
  generateQuestions(
    phase: string,
    complexity: ProjectComplexity,
    previousAnswers: Answer[] = []
  ): QuestionSet {
    // Determine question count based on complexity
    const baseCount = this.getBaseQuestionCount(complexity.level);
    
    // Generate phase-specific questions
    let questions: Question[] = [];
    switch (phase) {
      case 'spec':
        questions = this.generateSpecQuestions(complexity, previousAnswers);
        break;
      case 'plan':
        questions = this.generatePlanQuestions(complexity, previousAnswers);
        break;
      case 'tasks':
        questions = this.generateTaskQuestions(complexity, previousAnswers);
        break;
      default:
        questions = this.generateSpecQuestions(complexity, previousAnswers);
    }
    
    // Categorize questions
    const criticalQuestions = questions.filter(q => q.priority === 'critical');
    const highQuestions = questions.filter(q => q.priority === 'high');
    const mediumQuestions = questions.filter(q => q.priority === 'medium');
    
    // Generate follow-up questions based on previous answers
    const followUpQuestions = this.generateFollowUpQuestions(previousAnswers, phase);
    
    // Limit total questions but ensure critical ones are included
    const totalQuestions = Math.min(
      criticalQuestions.length + highQuestions.length + Math.floor(mediumQuestions.length / 2),
      baseCount + followUpQuestions.length
    );
    
    // Estimate time
    const estimatedTime = this.estimateAnswerTime(totalQuestions, complexity.level);
    
    return {
      phase,
      complexity,
      totalQuestions,
      criticalQuestions,
      additionalQuestions: [...highQuestions, ...mediumQuestions],
      followUpQuestions,
      estimatedTime
    };
  }
  
  /**
   * Get base question count by complexity
   */
  private getBaseQuestionCount(level: ProjectComplexity['level']): number {
    switch (level) {
      case 'simple': return 3;
      case 'moderate': return 5;
      case 'complex': return 8;
      case 'enterprise': return 12;
      default: return 5;
    }
  }
  
  /**
   * Generate specification phase questions
   */
  private generateSpecQuestions(
    complexity: ProjectComplexity,
    _previousAnswers: Answer[]
  ): Question[] {
    const questions: Question[] = [];
    
    // Critical questions (always ask)
    questions.push({
      id: 'spec-users-primary',
      text: 'Who are the primary users of this system? Describe their roles, goals, and technical expertise.',
      category: 'users',
      priority: 'critical',
      expectedDetailLevel: complexity.level === 'simple' ? 'moderate' : 'detailed',
      examples: ['Developers managing multiple projects', 'Customers browsing products'],
      whyAsking: 'Understanding users is fundamental to creating appropriate solutions'
    });
    
    questions.push({
      id: 'spec-problem-core',
      text: 'What specific problems are you solving? What pain points exist in the current situation?',
      category: 'problem',
      priority: 'critical',
      expectedDetailLevel: 'detailed',
      examples: ['Users lose track of tasks when switching projects', 'Manual data entry causes errors'],
      whyAsking: 'Clear problem definition guides all design decisions'
    });
    
    questions.push({
      id: 'spec-success-criteria',
      text: 'How will you measure success? What metrics or outcomes indicate the solution is working?',
      category: 'success',
      priority: 'critical',
      expectedDetailLevel: 'moderate',
      examples: ['50% reduction in task completion time', '90% user satisfaction score'],
      whyAsking: 'Success criteria ensure we build the right solution'
    });
    
    // High priority (ask for moderate+ complexity)
    if (complexity.level !== 'simple') {
      questions.push({
        id: 'spec-users-secondary',
        text: 'Are there secondary user groups or stakeholders? How do their needs differ?',
        category: 'users',
        priority: 'high',
        expectedDetailLevel: 'moderate',
        whyAsking: 'Secondary users often have different requirements'
      });
      
      questions.push({
        id: 'spec-constraints',
        text: 'What constraints or limitations must the solution respect? (technical, business, legal)',
        category: 'constraints',
        priority: 'high',
        expectedDetailLevel: 'moderate',
        examples: ['Must work offline', 'GDPR compliance required', 'Budget under $50k'],
        whyAsking: 'Constraints shape the solution boundaries'
      });
    }
    
    // Medium priority (ask for complex+ projects)
    if (complexity.level === 'complex' || complexity.level === 'enterprise') {
      questions.push({
        id: 'spec-scale',
        text: 'What scale must the system support? (users, data volume, transactions)',
        category: 'scale',
        priority: 'medium',
        expectedDetailLevel: 'detailed',
        examples: ['10,000 concurrent users', '1TB of data per month'],
        whyAsking: 'Scale requirements affect architecture decisions'
      });
      
      questions.push({
        id: 'spec-integration',
        text: 'What existing systems or services must this integrate with?',
        category: 'integration',
        priority: 'medium',
        expectedDetailLevel: 'detailed',
        whyAsking: 'Integration requirements affect design and timeline'
      });
      
      questions.push({
        id: 'spec-compliance',
        text: 'Are there regulatory or compliance requirements?',
        category: 'compliance',
        priority: 'medium',
        expectedDetailLevel: 'moderate',
        examples: ['HIPAA for healthcare data', 'PCI DSS for payments'],
        whyAsking: 'Compliance affects architecture and implementation'
      });
    }
    
    // Enterprise-specific questions
    if (complexity.level === 'enterprise') {
      questions.push({
        id: 'spec-governance',
        text: 'What governance or approval processes are required?',
        category: 'process',
        priority: 'medium',
        expectedDetailLevel: 'moderate',
        whyAsking: 'Enterprise projects need clear governance structure'
      });
      
      questions.push({
        id: 'spec-rollout',
        text: 'How will the solution be rolled out? (pilot, phased, big bang)',
        category: 'deployment',
        priority: 'medium',
        expectedDetailLevel: 'moderate',
        whyAsking: 'Rollout strategy affects development priorities'
      });
    }
    
    return questions;
  }
  
  /**
   * Generate planning phase questions
   */
  private generatePlanQuestions(
    complexity: ProjectComplexity,
    _previousAnswers: Answer[]
  ): Question[] {
    const questions: Question[] = [];
    
    // Critical technical questions
    questions.push({
      id: 'plan-tech-preferences',
      text: 'Do you have technology preferences or existing stack requirements?',
      category: 'technology',
      priority: 'critical',
      expectedDetailLevel: 'moderate',
      examples: ['Must use React and Node.js', 'Prefer Python for ML components'],
      whyAsking: 'Technology choices affect entire development process'
    });
    
    questions.push({
      id: 'plan-performance',
      text: 'What are the performance requirements? (response time, throughput)',
      category: 'performance',
      priority: 'critical',
      expectedDetailLevel: 'detailed',
      examples: ['<200ms response time', '1000 requests/second'],
      whyAsking: 'Performance requirements drive architecture decisions'
    });
    
    // Additional questions based on complexity
    if (complexity.level !== 'simple') {
      questions.push({
        id: 'plan-data-volume',
        text: 'What data volumes are expected? How will data grow over time?',
        category: 'data',
        priority: 'high',
        expectedDetailLevel: 'detailed',
        whyAsking: 'Data volume affects database and architecture choices'
      });
      
      questions.push({
        id: 'plan-security',
        text: 'What are the security requirements? What data needs protection?',
        category: 'security',
        priority: 'high',
        expectedDetailLevel: 'detailed',
        whyAsking: 'Security must be designed in from the start'
      });
    }
    
    return questions;
  }
  
  /**
   * Generate task breakdown questions
   */
  private generateTaskQuestions(
    complexity: ProjectComplexity,
    _previousAnswers: Answer[]
  ): Question[] {
    const questions: Question[] = [];
    
    questions.push({
      id: 'tasks-priorities',
      text: 'What features or components are highest priority for initial release?',
      category: 'priorities',
      priority: 'critical',
      expectedDetailLevel: 'moderate',
      whyAsking: 'Prioritization guides task sequencing'
    });
    
    questions.push({
      id: 'tasks-timeline',
      text: 'What is your target timeline or deadline?',
      category: 'timeline',
      priority: 'critical',
      expectedDetailLevel: 'brief',
      examples: ['MVP in 3 months', 'Full launch by Q3'],
      whyAsking: 'Timeline affects task breakdown granularity'
    });
    
    if (complexity.level !== 'simple') {
      questions.push({
        id: 'tasks-resources',
        text: 'What resources are available? (team size, skills, budget)',
        category: 'resources',
        priority: 'high',
        expectedDetailLevel: 'moderate',
        whyAsking: 'Resource constraints affect task assignment'
      });
    }
    
    return questions;
  }
  
  /**
   * Generate follow-up questions based on previous answers
   */
  private generateFollowUpQuestions(previousAnswers: Answer[], _phase: string): Question[] {
    const followUps: Question[] = [];
    
    for (const answer of previousAnswers) {
      // Check if answer is vague or brief
      if (answer.wordCount < 30 && answer.confidence < 0.7) {
        followUps.push({
          id: `followup-${answer.questionId}-detail`,
          text: `Can you provide more detail about: "${answer.content.substring(0, 100)}..."?`,
          category: 'clarification',
          priority: 'high',
          followUpTo: answer.questionId,
          expectedDetailLevel: 'detailed',
          whyAsking: 'Previous answer needs more detail for proper understanding'
        });
      }
      
      // Check if answer mentions something needing exploration
      if (answer.content.toLowerCase().includes('multiple') || answer.content.includes('various')) {
        followUps.push({
          id: `followup-${answer.questionId}-specifics`,
          text: `You mentioned multiple/various items. Can you list them specifically?`,
          category: 'specification',
          priority: 'medium',
          followUpTo: answer.questionId,
          expectedDetailLevel: 'moderate',
          whyAsking: 'Specific information needed for accurate planning'
        });
      }
      
      // Check if answer lacks examples
      if (!answer.hasExamples && answer.confidence < 0.8) {
        followUps.push({
          id: `followup-${answer.questionId}-examples`,
          text: `Can you provide specific examples for what you described?`,
          category: 'examples',
          priority: 'medium',
          followUpTo: answer.questionId,
          expectedDetailLevel: 'moderate',
          whyAsking: 'Examples help clarify requirements'
        });
      }
    }
    
    // Limit follow-ups to avoid overwhelming
    return followUps.slice(0, 3);
  }
  
  /**
   * Estimate time to answer questions
   */
  private estimateAnswerTime(questionCount: number, level: ProjectComplexity['level']): string {
    const minutesPerQuestion = level === 'simple' ? 2 : level === 'moderate' ? 3 : 4;
    const totalMinutes = questionCount * minutesPerQuestion;
    
    if (totalMinutes < 15) return '10-15 minutes';
    if (totalMinutes < 30) return '20-30 minutes';
    if (totalMinutes < 45) return '30-45 minutes';
    return '45-60 minutes';
  }
  
  /**
   * Process an answer and update context
   */
  processAnswer(answer: Answer): void {
    // Store answer
    const projectAnswers = this.questionHistory.get(answer.questionId) || [];
    projectAnswers.push(answer);
    this.questionHistory.set(answer.questionId, projectAnswers);
    
    // Extract and store context
    this.extractContext(answer);
  }
  
  /**
   * Extract context from answer for future use
   */
  private extractContext(answer: Answer): void {
    const lower = answer.content.toLowerCase();
    
    // Extract mentioned technologies
    const techKeywords = ['react', 'vue', 'angular', 'node', 'python', 'java', 'typescript'];
    const mentionedTech = techKeywords.filter(t => lower.includes(t));
    if (mentionedTech.length > 0) {
      this.contextMemory.set('mentioned_technologies', mentionedTech);
    }
    
    // Extract scale indicators
    const numbers = answer.content.match(/\d+/g);
    if (numbers) {
      this.contextMemory.set('mentioned_numbers', numbers);
    }
    
    // Store high-confidence answers for reference
    if (answer.confidence > 0.8) {
      const confident = this.contextMemory.get('confident_answers') || [];
      confident.push(answer);
      this.contextMemory.set('confident_answers', confident);
    }
  }
  
  /**
   * Generate question summary
   */
  generateQuestionSummary(questionSet: QuestionSet): string {
    let summary = `## 📋 Adaptive Question Set\n\n`;
    summary += `**Project Complexity**: ${questionSet.complexity.level.toUpperCase()} (${questionSet.complexity.score}/100)\n`;
    summary += `**Total Questions**: ${questionSet.totalQuestions}\n`;
    summary += `**Estimated Time**: ${questionSet.estimatedTime}\n\n`;
    
    summary += `### 🎯 Critical Questions (Must Answer)\n`;
    questionSet.criticalQuestions.forEach((q, i) => {
      summary += `${i + 1}. **${q.text}**\n`;
      summary += `   - Why: ${q.whyAsking}\n`;
      if (q.examples) {
        summary += `   - Examples: ${q.examples.join(', ')}\n`;
      }
      summary += '\n';
    });
    
    if (questionSet.additionalQuestions.length > 0) {
      summary += `### 📝 Additional Questions (Recommended)\n`;
      questionSet.additionalQuestions.slice(0, 5).forEach((q, i) => {
        summary += `${i + 1}. ${q.text}\n`;
      });
      summary += '\n';
    }
    
    if (questionSet.followUpQuestions.length > 0) {
      summary += `### 🔄 Follow-up Questions\n`;
      questionSet.followUpQuestions.forEach((q, i) => {
        summary += `${i + 1}. ${q.text}\n`;
      });
      summary += '\n';
    }
    
    summary += `### 💡 Complexity Analysis\n`;
    summary += `- User Types: ${questionSet.complexity.factors.userTypes}\n`;
    summary += `- Features: ${questionSet.complexity.factors.features}\n`;
    summary += `- Integrations: ${questionSet.complexity.factors.integrations}\n`;
    summary += `- Scale: ${questionSet.complexity.factors.scale}\n`;
    summary += `- Technical Challenges: ${questionSet.complexity.factors.technicalChallenges}\n`;
    summary += `\n**Reasoning**: ${questionSet.complexity.reasoning}\n`;
    
    return summary;
  }
}
