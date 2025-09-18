/**
 * Phase Validator
 * Ensures each phase contains only appropriate content
 * Enforces strict separation of concerns per SDD philosophy
 */

export interface PhaseValidationResult {
  phase: string;
  valid: boolean;
  appropriateContent: string[];
  inappropriateContent: string[];
  suggestions: string[];
  confidence: number;
}

export interface ContentPattern {
  pattern: RegExp;
  description: string;
  severity: 'error' | 'warning';
}

export class PhaseValidator {
  /**
   * SPEC Phase: WHAT and WHY only
   * Users, Problems, Requirements, Success Criteria
   * NO technical implementation details
   */
  private readonly specAllowed: ContentPattern[] = [
    { pattern: /user|사용자|고객|customer|persona/i, description: 'User definitions', severity: 'error' },
    { pattern: /problem|문제|pain point|challenge/i, description: 'Problem statements', severity: 'error' },
    { pattern: /requirement|요구사항|need|must|should/i, description: 'Functional requirements', severity: 'error' },
    { pattern: /success|성공|metric|measure|kpi/i, description: 'Success criteria', severity: 'error' },
    { pattern: /goal|목표|objective|purpose/i, description: 'Goals and objectives', severity: 'warning' },
    { pattern: /scenario|시나리오|use case|story/i, description: 'User scenarios', severity: 'warning' },
  ];

  private readonly specForbidden: ContentPattern[] = [
    { pattern: /typescript|javascript|python|java|react|vue|angular/i, description: 'Programming languages', severity: 'error' },
    { pattern: /database|mongodb|mysql|postgres|redis/i, description: 'Database technologies', severity: 'error' },
    { pattern: /api|rest|graphql|websocket/i, description: 'API specifications', severity: 'error' },
    { pattern: /architecture|microservice|monolith|serverless/i, description: 'Architecture patterns', severity: 'error' },
    { pattern: /docker|kubernetes|aws|azure|gcp/i, description: 'Infrastructure details', severity: 'error' },
    { pattern: /class|function|method|interface|component/i, description: 'Code structures', severity: 'warning' },
  ];

  /**
   * PLAN Phase: HOW - Technical Architecture
   * Architecture, Technology Stack, Data Models, Integration
   * NO user stories or test cases
   */
  private readonly planAllowed: ContentPattern[] = [
    { pattern: /architecture|아키텍처|design|structure/i, description: 'System architecture', severity: 'error' },
    { pattern: /technology|tech stack|framework|library/i, description: 'Technology choices', severity: 'error' },
    { pattern: /database|data model|schema|entity/i, description: 'Data structures', severity: 'error' },
    { pattern: /integration|api|interface|protocol/i, description: 'Integration points', severity: 'error' },
    { pattern: /security|authentication|authorization/i, description: 'Security measures', severity: 'warning' },
    { pattern: /scalability|performance|optimization/i, description: 'Performance considerations', severity: 'warning' },
  ];

  private readonly planForbidden: ContentPattern[] = [
    { pattern: /user story|사용자 스토리|persona|as a user/i, description: 'User stories (belongs in spec)', severity: 'error' },
    { pattern: /test case|테스트 케이스|unit test|e2e test/i, description: 'Test cases (belongs in implement)', severity: 'error' },
    { pattern: /code|snippet|implementation|구현/i, description: 'Code implementations', severity: 'error' },
    { pattern: /todo|task|작업|할일/i, description: 'Task breakdowns (belongs in tasks)', severity: 'warning' },
  ];

  /**
   * TASKS Phase: Work Breakdown
   * Task decomposition, Dependencies, Priorities, Estimations
   * NO implementation details
   */
  private readonly tasksAllowed: ContentPattern[] = [
    { pattern: /task|작업|todo|할일|work item/i, description: 'Task definitions', severity: 'error' },
    { pattern: /dependency|의존|depends on|requires/i, description: 'Dependencies', severity: 'error' },
    { pattern: /priority|우선순위|critical|important/i, description: 'Priorities', severity: 'error' },
    { pattern: /estimate|예상|hours|days|points/i, description: 'Time estimates', severity: 'warning' },
    { pattern: /milestone|마일스톤|phase|sprint/i, description: 'Milestones', severity: 'warning' },
  ];

  private readonly tasksForbidden: ContentPattern[] = [
    { pattern: /code|function|class|method/i, description: 'Code details', severity: 'error' },
    { pattern: /test implementation|테스트 구현/i, description: 'Test implementations', severity: 'error' },
    { pattern: /user interface|ui design|화면 설계/i, description: 'UI specifications', severity: 'warning' },
  ];

  /**
   * IMPLEMENT Phase: TDD and Code Generation
   * Test cases, TDD guides, Implementation steps
   */
  private readonly implementAllowed: ContentPattern[] = [
    { pattern: /test|테스트|spec|assertion|expect/i, description: 'Test definitions', severity: 'error' },
    { pattern: /tdd|test.?driven|red.?green.?refactor/i, description: 'TDD approach', severity: 'error' },
    { pattern: /implementation|구현|code|코드/i, description: 'Implementation details', severity: 'error' },
    { pattern: /integration|통합|e2e|end.?to.?end/i, description: 'Integration tests', severity: 'warning' },
    { pattern: /mock|stub|spy|fake/i, description: 'Test doubles', severity: 'warning' },
  ];

  /**
   * Validate content for a specific phase
   */
  validatePhase(phase: string, content: string): PhaseValidationResult {
    const lowerContent = content.toLowerCase();
    const result: PhaseValidationResult = {
      phase,
      valid: true,
      appropriateContent: [],
      inappropriateContent: [],
      suggestions: [],
      confidence: 1.0,
    };

    // Get patterns for the phase
    const { allowed, forbidden } = this.getPatternsForPhase(phase);

    // Check for required content
    let requiredCount = 0;
    for (const pattern of allowed) {
      if (pattern.pattern.test(lowerContent)) {
        result.appropriateContent.push(pattern.description);
        requiredCount++;
      }
    }

    // Check for forbidden content
    for (const pattern of forbidden) {
      if (pattern.pattern.test(lowerContent)) {
        result.inappropriateContent.push(pattern.description);
        result.valid = false;
        
        if (pattern.severity === 'error') {
          result.suggestions.push(`Remove ${pattern.description} - this belongs in a different phase`);
        } else {
          result.suggestions.push(`Consider removing ${pattern.description}`);
        }
      }
    }

    // Calculate confidence based on content appropriateness
    const totalPatterns = allowed.length;
    const matchRatio = requiredCount / totalPatterns;
    const penaltyRatio = result.inappropriateContent.length * 0.2;
    result.confidence = Math.max(0, Math.min(1, matchRatio - penaltyRatio));

    // Add suggestions for missing content
    if (requiredCount < allowed.length / 2) {
      result.suggestions.push(`Add more ${phase}-specific content: ${this.getMissingContent(phase, result.appropriateContent)}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Filter out inappropriate content from a document
   */
  filterContent(phase: string, content: string): string {
    const lines = content.split('\n');
    const { forbidden } = this.getPatternsForPhase(phase);
    const filteredLines: string[] = [];
    
    for (const line of lines) {
      let shouldKeep = true;
      
      // Check each forbidden pattern
      for (const pattern of forbidden) {
        if (pattern.severity === 'error' && pattern.pattern.test(line)) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        filteredLines.push(line);
      }
    }
    
    return filteredLines.join('\n');
  }

  /**
   * Get patterns for a specific phase
   */
  private getPatternsForPhase(phase: string): { allowed: ContentPattern[], forbidden: ContentPattern[] } {
    switch (phase) {
      case 'spec':
        return { allowed: this.specAllowed, forbidden: this.specForbidden };
      case 'plan':
        return { allowed: this.planAllowed, forbidden: this.planForbidden };
      case 'tasks':
        return { allowed: this.tasksAllowed, forbidden: this.tasksForbidden };
      case 'implement':
        return { allowed: this.implementAllowed, forbidden: [] }; // Implement can contain anything
      default:
        return { allowed: [], forbidden: [] };
    }
  }

  /**
   * Get missing content descriptions for a phase
   */
  private getMissingContent(phase: string, existingContent: string[]): string {
    const { allowed } = this.getPatternsForPhase(phase);
    const missing = allowed
      .filter(p => p.severity === 'error')
      .map(p => p.description)
      .filter(desc => !existingContent.includes(desc));
    
    return missing.join(', ');
  }

  /**
   * Generate phase-specific guidance
   */
  generateGuidance(phase: string): string {
    switch (phase) {
      case 'spec':
        return `
## SPEC Phase Guidelines (WHAT & WHY)

✅ **MUST Include:**
- **Users**: Who will use the system? What are their roles and goals?
- **Problem**: What problem does this solve? Why is it important?
- **Requirements**: What must the system do? (functional requirements only)
- **Success Criteria**: How do we measure success? What are the KPIs?

❌ **MUST NOT Include:**
- Technical implementation details (languages, frameworks)
- Architecture decisions (that's for PLAN)
- Database schemas or API specifications
- Test cases or code examples

📝 **Focus on:** User needs, business value, and measurable outcomes.
        `.trim();
      
      case 'plan':
        return `
## PLAN Phase Guidelines (HOW - Technical)

✅ **MUST Include:**
- **Architecture**: System design and patterns (microservices, monolith, etc.)
- **Technology Stack**: Languages, frameworks, and tools with justification
- **Data Model**: Database design, entities, and relationships
- **Integration**: External services, APIs, and protocols

❌ **MUST NOT Include:**
- User stories or personas (that's in SPEC)
- Actual code implementations
- Test case implementations
- Task breakdowns (that's for TASKS)

📝 **Focus on:** Technical decisions, system design, and infrastructure.
        `.trim();
      
      case 'tasks':
        return `
## TASKS Phase Guidelines (Work Breakdown)

✅ **MUST Include:**
- **Task Breakdown**: Granular, actionable work items
- **Dependencies**: Task relationships and sequencing
- **Priorities**: Critical path and importance levels
- **Estimations**: Time/effort estimates for each task

❌ **MUST NOT Include:**
- Code implementations
- Detailed test cases
- Technical specifications (use PLAN references)

📝 **Focus on:** Work organization, scheduling, and resource planning.
        `.trim();
      
      case 'implement':
        return `
## IMPLEMENT Phase Guidelines (TDD & Code)

✅ **MUST Include:**
- **Test Cases**: Comprehensive test scenarios
- **TDD Approach**: Red-Green-Refactor cycles
- **Implementation Guide**: Step-by-step coding approach
- **Integration Tests**: System-level test plans

📝 **Focus on:** Test-driven development and quality assurance.
        `.trim();
      
      default:
        return 'Unknown phase';
    }
  }

  /**
   * Check phase transition readiness
   */
  canTransition(fromPhase: string, toPhase: string, content: string): { allowed: boolean; reason: string } {
    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
      'init': ['spec'],
      'spec': ['plan'],
      'plan': ['tasks'],
      'tasks': ['implement'],
      'implement': [], // Terminal phase
    };

    // Check if transition is valid
    const allowedTransitions = validTransitions[fromPhase] || [];
    if (!allowedTransitions.includes(toPhase)) {
      return {
        allowed: false,
        reason: `Cannot transition from ${fromPhase} to ${toPhase}. Valid transitions: ${allowedTransitions.join(', ')}`,
      };
    }

    // Validate current phase content
    const validation = this.validatePhase(fromPhase, content);
    if (!validation.valid) {
      return {
        allowed: false,
        reason: `Current ${fromPhase} phase has issues: ${validation.suggestions.join('; ')}`,
      };
    }

    return {
      allowed: true,
      reason: `Ready to transition from ${fromPhase} to ${toPhase}`,
    };
  }
}

// Export singleton instance
export const phaseValidator = new PhaseValidator();
