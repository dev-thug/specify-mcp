/**
 * Quality Reporter System
 * Provides detailed quality analysis and improvement guidance
 */

export interface ScoreDetail {
  criterion: string;
  earned: number;
  possible: number;
  reason: string;
  keywords?: string[];
}

export interface ImprovementSuggestion {
  area: string;
  current: number;
  potential: number;
  suggestion: string;
  example: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QualityBreakdown {
  category: string;
  currentScore: number;
  maxScore: number;
  percentage: number;
  details: ScoreDetail[];
  improvements: ImprovementSuggestion[];
}

export interface DetailedQualityReport {
  overallScore: number;
  targetScore: number;
  phase: string;
  breakdown: QualityBreakdown[];
  prioritizedImprovements: ImprovementSuggestion[];
  nextSteps: string[];
  exampleContent: string;
}

export class QualityReporter {
  
  /**
   * Generate detailed quality report for specifications
   */
  generateSpecReport(content: string, currentScore: number): DetailedQualityReport {
    const breakdown: QualityBreakdown[] = [];
    const allImprovements: ImprovementSuggestion[] = [];
    
    // 1. Length & Structure Analysis (30 points)
    const lengthBreakdown = this.analyzeLengthQuality(content);
    breakdown.push(lengthBreakdown);
    allImprovements.push(...lengthBreakdown.improvements);
    
    // 2. User Definition Analysis (12 points)
    const userBreakdown = this.analyzeUserDefinition(content);
    breakdown.push(userBreakdown);
    allImprovements.push(...userBreakdown.improvements);
    
    // 3. Functional Requirements Analysis (12 points)
    const functionalBreakdown = this.analyzeFunctionalRequirements(content);
    breakdown.push(functionalBreakdown);
    allImprovements.push(...functionalBreakdown.improvements);
    
    // 4. Purpose & Goals Analysis (12 points)
    const purposeBreakdown = this.analyzePurposeGoals(content);
    breakdown.push(purposeBreakdown);
    allImprovements.push(...purposeBreakdown.improvements);
    
    // 5. Additional Quality Factors (remaining points)
    const additionalBreakdown = this.analyzeAdditionalFactors(content);
    breakdown.push(additionalBreakdown);
    allImprovements.push(...additionalBreakdown.improvements);
    
    // Prioritize improvements by impact
    const prioritizedImprovements = this.prioritizeImprovements(allImprovements);
    
    return {
      overallScore: currentScore,
      targetScore: 60, // Current minimum requirement
      phase: 'spec',
      breakdown,
      prioritizedImprovements,
      nextSteps: this.generateNextSteps(prioritizedImprovements),
      exampleContent: this.generateExampleContent()
    };
  }

  /**
   * Generate detailed quality report for technical plans
   */
  generatePlanReport(content: string, currentScore: number): DetailedQualityReport {
    const breakdown: QualityBreakdown[] = [];
    const allImprovements: ImprovementSuggestion[] = [];
    
    // 1. Technology Stack Analysis (15 points)
    const techStackBreakdown = this.analyzeTechStack(content);
    breakdown.push(techStackBreakdown);
    allImprovements.push(...techStackBreakdown.improvements);
    
    // 2. Framework & Libraries Analysis (15 points)
    const frameworkBreakdown = this.analyzeFrameworks(content);
    breakdown.push(frameworkBreakdown);
    allImprovements.push(...frameworkBreakdown.improvements);
    
    // 3. Database & Storage Analysis (15 points)
    const databaseBreakdown = this.analyzeDatabase(content);
    breakdown.push(databaseBreakdown);
    allImprovements.push(...databaseBreakdown.improvements);
    
    // 4. Architecture & Design Analysis (15 points)
    const architectureBreakdown = this.analyzeArchitecture(content);
    breakdown.push(architectureBreakdown);
    allImprovements.push(...architectureBreakdown.improvements);
    
    // 5. Testing Strategy Analysis (10 points)
    const testingBreakdown = this.analyzeTesting(content);
    breakdown.push(testingBreakdown);
    allImprovements.push(...testingBreakdown.improvements);
    
    const prioritizedImprovements = this.prioritizeImprovements(allImprovements);
    
    return {
      overallScore: currentScore,
      targetScore: 55, // Current minimum requirement  
      phase: 'plan',
      breakdown,
      prioritizedImprovements,
      nextSteps: this.generateNextSteps(prioritizedImprovements),
      exampleContent: this.generatePlanExampleContent()
    };
  }

  private analyzeLengthQuality(content: string): QualityBreakdown {
    const length = content.length;
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (length > 2000) {
      earned = 30;
      details.push({
        criterion: 'Document Length',
        earned: 30,
        possible: 30,
        reason: `Excellent length (${length} characters) indicates comprehensive coverage`
      });
    } else if (length > 1000) {
      earned = 20;
      details.push({
        criterion: 'Document Length',
        earned: 20,
        possible: 30,
        reason: `Good length (${length} characters) but could be more detailed`
      });
      improvements.push({
        area: 'Document Detail',
        current: 20,
        potential: 30,
        suggestion: 'Add more detailed explanations, examples, and edge cases',
        example: 'Include user scenarios, acceptance criteria, and specific requirements',
        priority: 'medium'
      });
    } else if (length > 500) {
      earned = 10;
      details.push({
        criterion: 'Document Length', 
        earned: 10,
        possible: 30,
        reason: `Basic length (${length} characters) needs significant expansion`
      });
      improvements.push({
        area: 'Document Completeness',
        current: 10,
        potential: 30,
        suggestion: 'Significantly expand content with detailed sections',
        example: 'Add user definitions, functional requirements, success criteria, constraints',
        priority: 'high'
      });
    } else {
      earned = 0;
      details.push({
        criterion: 'Document Length',
        earned: 0,
        possible: 30,
        reason: `Too short (${length} characters) - needs major expansion`
      });
      improvements.push({
        area: 'Basic Content',
        current: 0,
        potential: 30,
        suggestion: 'Create comprehensive specification with all required sections',
        example: 'Minimum 500+ characters covering users, features, goals, and requirements',
        priority: 'high'
      });
    }
    
    return {
      category: 'Length & Structure',
      currentScore: earned,
      maxScore: 30,
      percentage: Math.round((earned / 30) * 100),
      details,
      improvements
    };
  }

  private analyzeUserDefinition(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const userKeywords = ['사용자', 'user', '고객', 'customer', '이용자', '대상', 'persona', '유저'];
    
    const hasUserKeywords = userKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasUserKeywords) {
      earned = 12;
      details.push({
        criterion: 'User Definition',
        earned: 12,
        possible: 12,
        reason: 'Contains user/customer references',
        keywords: userKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      earned = 0;
      details.push({
        criterion: 'User Definition',
        earned: 0,
        possible: 12,
        reason: 'Missing user/customer definition'
      });
      improvements.push({
        area: 'User Definition',
        current: 0,
        potential: 12,
        suggestion: 'Define who will use this system',
        example: 'Add section: "Primary users are individual developers who manage multiple projects and need better task organization"',
        priority: 'high'
      });
    }
    
    return {
      category: 'User Definition',
      currentScore: earned,
      maxScore: 12,
      percentage: Math.round((earned / 12) * 100),
      details,
      improvements
    };
  }

  private analyzeFunctionalRequirements(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const functionalKeywords = ['기능', 'function', '역할', '할 수', '할일', '작업', 'task', 'feature', 'capability'];
    
    const hasFunctionalKeywords = functionalKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasFunctionalKeywords) {
      earned = 12;
      details.push({
        criterion: 'Functional Requirements',
        earned: 12,
        possible: 12,
        reason: 'Contains functional/feature references',
        keywords: functionalKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      earned = 0;
      details.push({
        criterion: 'Functional Requirements',
        earned: 0,
        possible: 12,
        reason: 'Missing functional requirements'
      });
      improvements.push({
        area: 'Functional Requirements',
        current: 0,
        potential: 12,
        suggestion: 'Define what the system should do',
        example: 'Add section: "Core features: 1) Task creation and management, 2) Project categorization, 3) Progress tracking"',
        priority: 'high'
      });
    }
    
    return {
      category: 'Functional Requirements',
      currentScore: earned,
      maxScore: 12,
      percentage: Math.round((earned / 12) * 100),
      details,
      improvements
    };
  }

  private analyzePurposeGoals(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const purposeKeywords = ['목적', '목표', 'purpose', 'goal', '해결', 'solve', '문제', 'problem', 'why'];
    
    const hasPurposeKeywords = purposeKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasPurposeKeywords) {
      earned = 12;
      details.push({
        criterion: 'Purpose & Goals',
        earned: 12,
        possible: 12,
        reason: 'Contains purpose/goal references',
        keywords: purposeKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      earned = 0;
      details.push({
        criterion: 'Purpose & Goals',
        earned: 0,
        possible: 12,
        reason: 'Missing purpose and goals'
      });
      improvements.push({
        area: 'Purpose & Goals',
        current: 0,
        potential: 12,
        suggestion: 'Explain why this system is needed',
        example: 'Add section: "Purpose: Solve the problem of developers losing track of tasks across multiple projects"',
        priority: 'high'
      });
    }
    
    return {
      category: 'Purpose & Goals',
      currentScore: earned,
      maxScore: 12,
      percentage: Math.round((earned / 12) * 100),
      details,
      improvements
    };
  }

  private analyzeAdditionalFactors(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    const maxScore = 14; // Remaining points
    
    // Check for requirements
    const requirementKeywords = ['제약', '요구사항', 'requirement', '조건', 'condition'];
    const hasRequirements = requirementKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasRequirements) {
      earned += 5;
      details.push({
        criterion: 'Requirements & Constraints',
        earned: 5,
        possible: 5,
        reason: 'Contains requirement references'
      });
    } else {
      improvements.push({
        area: 'Requirements & Constraints',
        current: 0,
        potential: 5,
        suggestion: 'Add specific requirements and constraints',
        example: 'System must handle 100+ tasks, work offline, support multiple projects',
        priority: 'medium'
      });
    }
    
    // Check for scenarios
    const scenarioKeywords = ['시나리오', 'scenario', 'use case', '상황', '경우'];
    const hasScenarios = scenarioKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasScenarios) {
      earned += 4;
      details.push({
        criterion: 'Scenarios & Use Cases',
        earned: 4,
        possible: 4,
        reason: 'Contains scenario references'
      });
    } else {
      improvements.push({
        area: 'Use Cases & Scenarios',
        current: 0,
        potential: 4,
        suggestion: 'Add user scenarios and use cases',
        example: 'Scenario: Developer switches between 3 projects daily, needs quick task overview',
        priority: 'medium'
      });
    }
    
    // Check for success criteria
    const criteriaKeywords = ['성공기준', 'criteria', '기준', '완료', 'complete', 'success'];
    const hasCriteria = criteriaKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasCriteria) {
      earned += 3;
      details.push({
        criterion: 'Success Criteria',
        earned: 3,
        possible: 3,
        reason: 'Contains success criteria'
      });
    } else {
      improvements.push({
        area: 'Success Criteria',
        current: 0,
        potential: 3,
        suggestion: 'Define success metrics',
        example: 'Success: 50% reduction in task-switching time, 90% task completion rate',
        priority: 'low'
      });
    }
    
    // Structure bonus
    const lines = content.split('\n').filter(line => line.trim()).length;
    if (lines > 10) {
      earned += 2;
      details.push({
        criterion: 'Document Structure',
        earned: 2,
        possible: 2,
        reason: 'Well-structured with multiple sections'
      });
    } else {
      improvements.push({
        area: 'Document Structure',
        current: 0,
        potential: 2,
        suggestion: 'Improve document structure with clear sections',
        example: 'Use headings: ## Users, ## Features, ## Requirements, ## Success Criteria',
        priority: 'low'
      });
    }
    
    if (earned === 0) {
      details.push({
        criterion: 'Additional Quality Factors',
        earned: 0,
        possible: maxScore,
        reason: 'Missing requirements, scenarios, and success criteria'
      });
    }
    
    return {
      category: 'Additional Quality Factors',
      currentScore: earned,
      maxScore: maxScore,
      percentage: Math.round((earned / maxScore) * 100),
      details,
      improvements
    };
  }

  // Plan-specific analysis methods
  private analyzeTechStack(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const techStackKeywords = ['typescript', 'javascript', 'python', 'java', 'react', 'vue', 'next', 'express', 'nest', 'django', 'spring'];
    
    const hasTechStack = techStackKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasTechStack) {
      earned = 15;
      details.push({
        criterion: 'Technology Stack',
        earned: 15,
        possible: 15,
        reason: 'Specific technologies mentioned',
        keywords: techStackKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      improvements.push({
        area: 'Technology Stack',
        current: 0,
        potential: 15,
        suggestion: 'Specify programming languages and core technologies',
        example: 'Technology Stack: TypeScript, Node.js, React for frontend, Express for backend',
        priority: 'high'
      });
    }
    
    return {
      category: 'Technology Stack',
      currentScore: earned,
      maxScore: 15,
      percentage: Math.round((earned / 15) * 100),
      details,
      improvements
    };
  }

  private analyzeFrameworks(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const frameworkKeywords = ['framework', 'library', '프레임워크', '라이브러리', 'tech stack', '기술스택'];
    
    const hasFrameworks = frameworkKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasFrameworks) {
      earned = 15;
      details.push({
        criterion: 'Frameworks & Libraries',
        earned: 15,
        possible: 15,
        reason: 'Framework references found'
      });
    } else {
      improvements.push({
        area: 'Frameworks & Libraries',
        current: 0,
        potential: 15,
        suggestion: 'Define frameworks and libraries to be used',
        example: 'Frameworks: Next.js for React SSR, Express.js for API, Jest for testing',
        priority: 'high'
      });
    }
    
    return {
      category: 'Frameworks & Libraries',
      currentScore: earned,
      maxScore: 15,
      percentage: Math.round((earned / 15) * 100),
      details,
      improvements
    };
  }

  private analyzeDatabase(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const dbKeywords = ['database', 'db', 'mysql', 'postgres', 'mongodb', 'redis', 'memory', '데이터베이스', 'storage'];
    
    const hasDatabase = dbKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasDatabase) {
      earned = 15;
      details.push({
        criterion: 'Database & Storage',
        earned: 15,
        possible: 15,
        reason: 'Database solution specified',
        keywords: dbKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      improvements.push({
        area: 'Database & Storage',
        current: 0,
        potential: 15,
        suggestion: 'Specify data storage solution',
        example: 'Database: PostgreSQL for structured data, Redis for caching',
        priority: 'high'
      });
    }
    
    return {
      category: 'Database & Storage',
      currentScore: earned,
      maxScore: 15,
      percentage: Math.round((earned / 15) * 100),
      details,
      improvements
    };
  }

  private analyzeArchitecture(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const archKeywords = ['architecture', 'design', 'structure', '아키텍처', '구조', '설계', 'pattern', 'microservice', 'monolith'];
    
    const hasArchitecture = archKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasArchitecture) {
      earned = 15;
      details.push({
        criterion: 'Architecture & Design',
        earned: 15,
        possible: 15,
        reason: 'Architectural approach mentioned'
      });
    } else {
      improvements.push({
        area: 'Architecture & Design',
        current: 0,
        potential: 15,
        suggestion: 'Define system architecture and design patterns',
        example: 'Architecture: MVC pattern, RESTful API design, component-based frontend',
        priority: 'medium'
      });
    }
    
    return {
      category: 'Architecture & Design',
      currentScore: earned,
      maxScore: 15,
      percentage: Math.round((earned / 15) * 100),
      details,
      improvements
    };
  }

  private analyzeTesting(content: string): QualityBreakdown {
    const lowerContent = content.toLowerCase();
    const testKeywords = ['test', 'testing', 'jest', 'cypress', 'mocha', '테스트', 'tdd', 'bdd'];
    
    const hasTesting = testKeywords.some(keyword => lowerContent.includes(keyword));
    const details: ScoreDetail[] = [];
    const improvements: ImprovementSuggestion[] = [];
    
    let earned = 0;
    
    if (hasTesting) {
      earned = 10;
      details.push({
        criterion: 'Testing Strategy',
        earned: 10,
        possible: 10,
        reason: 'Testing approach defined',
        keywords: testKeywords.filter(k => lowerContent.includes(k))
      });
    } else {
      improvements.push({
        area: 'Testing Strategy',
        current: 0,
        potential: 10,
        suggestion: 'Define testing strategy and tools',
        example: 'Testing: Jest for unit tests, Cypress for E2E, TDD approach',
        priority: 'medium'
      });
    }
    
    return {
      category: 'Testing Strategy',
      currentScore: earned,
      maxScore: 10,
      percentage: Math.round((earned / 10) * 100),
      details,
      improvements
    };
  }

  private prioritizeImprovements(improvements: ImprovementSuggestion[]): ImprovementSuggestion[] {
    return improvements.sort((a, b) => {
      // Priority order: high > medium > low
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by potential impact
      return (b.potential - b.current) - (a.potential - a.current);
    });
  }

  private generateNextSteps(improvements: ImprovementSuggestion[]): string[] {
    const highPriority = improvements.filter(imp => imp.priority === 'high').slice(0, 3);
    const steps = highPriority.map((imp, index) => 
      `${index + 1}. ${imp.suggestion} (potential +${imp.potential - imp.current} points)`
    );
    
    if (steps.length === 0) {
      steps.push('1. Current quality is sufficient - consider adding more detail for even better scores');
    }
    
    return steps;
  }

  private generateExampleContent(): string {
    return `
# Example High-Quality Specification

## Primary Users
- **Individual Developers**: Manage 3-5 concurrent projects, need quick task switching
- **Small Teams**: 2-4 developers collaborating on shared projects
- **Freelancers**: Track client work across multiple contracts

## Core Problems Solved  
- **Task Context Loss**: Developers lose track of what they were working on when switching projects
- **Priority Confusion**: Important tasks get buried under less critical ones
- **Progress Invisibility**: Hard to see overall project progress at a glance

## Functional Requirements
- **FR-001**: System MUST support multiple project workspaces
- **FR-002**: System MUST allow task prioritization (High/Medium/Low)
- **FR-003**: System MUST track task status (Todo/In Progress/Done)
- **FR-004**: System MUST provide project progress visualization

## Success Criteria
- 50% reduction in task-switching overhead
- 90% task completion rate
- Under 2 seconds to find any specific task
    `.trim();
  }

  private generatePlanExampleContent(): string {
    return `
# Example High-Quality Technical Plan

## Technology Stack
- **Language**: TypeScript for type safety and developer experience
- **Runtime**: Node.js 18+ for backend services
- **Frontend**: React 18 with modern hooks and concurrent features

## Framework & Libraries
- **Frontend Framework**: Next.js 13+ for SSR and optimal performance
- **Backend Framework**: Express.js with TypeScript for RESTful APIs
- **State Management**: Zustand for lightweight client state

## Database & Storage
- **Primary Database**: PostgreSQL for structured task/project data
- **Caching Layer**: Redis for session management and quick lookups
- **File Storage**: Local filesystem for development, S3 for production

## Architecture & Design
- **Pattern**: MVC architecture with clear separation of concerns
- **API Design**: RESTful endpoints with OpenAPI documentation
- **Frontend Architecture**: Component-based with custom hooks for logic

## Testing Strategy
- **Unit Testing**: Jest with React Testing Library
- **Integration Testing**: Supertest for API endpoint testing
- **E2E Testing**: Cypress for complete user workflows
- **TDD Approach**: Write tests first, implement functionality second
    `.trim();
  }

  /**
   * Format quality report as user-friendly text
   */
  formatReport(report: DetailedQualityReport): string {
    let formatted = `
📊 **Detailed Quality Analysis**

**Overall Score**: ${report.overallScore.toFixed(1)}/${report.targetScore} (${Math.round((report.overallScore / report.targetScore) * 100)}%)
**Phase**: ${report.phase.toUpperCase()}
${report.overallScore >= report.targetScore ? '✅ **PASSES** quality gate' : '❌ **NEEDS IMPROVEMENT** to pass quality gate'}

## 📋 **Score Breakdown**

${report.breakdown.map(category => `
### ${category.category} (${category.currentScore}/${category.maxScore} points - ${category.percentage}%)

${category.details.map(detail => `
- **${detail.criterion}**: ${detail.earned}/${detail.possible} points
  ${detail.reason}${detail.keywords ? ` (Found: ${detail.keywords.join(', ')})` : ''}`).join('')}
`).join('')}

## 🎯 **Priority Improvements**

${report.prioritizedImprovements.slice(0, 5).map((imp, index) => `
### ${index + 1}. ${imp.area} (${imp.priority.toUpperCase()} Priority)
**Potential Gain**: +${imp.potential - imp.current} points
**What to do**: ${imp.suggestion}
**Example**: ${imp.example}
`).join('')}

## 📝 **Next Steps**

${report.nextSteps.map(step => step).join('\n')}

## 💡 **Example Content**

Here's an example of high-quality content for reference:

${report.exampleContent}

---
💡 **Tip**: Focus on the highest priority improvements first for maximum score impact!
    `.trim();

    return formatted;
  }
}
