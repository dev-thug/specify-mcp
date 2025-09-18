/**
 * Phase-Specific Evaluator
 * Evaluates documents according to their specific phase requirements
 */

import { SemanticQualityAnalyzer, SemanticAnalysisResult } from './semantic-quality-analyzer.js';
import { phaseValidator } from '../validators/phase-validator.js';

export interface PhaseEvaluationResult {
  phase: string;
  score: number;
  appropriateCriteria: boolean;
  semanticAnalysis: SemanticAnalysisResult;
  phaseSpecificFeedback: string;
  misplacedExpectations: string[];
  correctExpectations: string[];
}

abstract class BasePhaseEvaluator {
  protected analyzer = new SemanticQualityAnalyzer();
  
  abstract evaluate(content: string): PhaseEvaluationResult;
  abstract getPhaseRequirements(): string[];
  abstract getInappropriateRequirements(): string[];
}

/**
 * Specification Phase Evaluator
 * Focus: WHAT and WHY, not HOW
 */
export class SpecEvaluator extends BasePhaseEvaluator {
  
  evaluate(content: string): PhaseEvaluationResult {
    const phase = 'spec';
    
    // Use semantic analyzer for base analysis
    const semanticAnalysis = this.analyzer.analyze(content, phase);
    
    // Use PhaseValidator for strict content validation
    const phaseValidation = phaseValidator.validatePhase(phase, content);
    
    // Get phase requirements
    const requirements = this.getPhaseRequirements();
    const inappropriate = this.getInappropriateRequirements();
    
    // Check for misplaced technical details
    const misplacedExpectations = this.findMisplacedContent(content, inappropriate);
    
    // Generate phase-specific feedback combining both validators
    const phaseSpecificFeedback = this.generateSpecFeedback(
      semanticAnalysis, 
      misplacedExpectations,
      phaseValidation
    );
    
    // Determine if criteria are appropriate
    const appropriateCriteria = phaseValidation.valid && misplacedExpectations.length === 0;
    
    return {
      phase: 'spec',
      score: semanticAnalysis.totalScore * phaseValidation.confidence,
      appropriateCriteria,
      semanticAnalysis,
      phaseSpecificFeedback,
      misplacedExpectations,
      correctExpectations: requirements
    };
  }
  
  getPhaseRequirements(): string[] {
    return [
      'Clear user definition and personas',
      'Problem statement and pain points',
      'Goals and objectives',
      'Functional requirements (WHAT the system does)',
      'Success criteria and metrics',
      'Constraints and assumptions',
      'Use cases and scenarios'
    ];
  }
  
  getInappropriateRequirements(): string[] {
    return [
      'Technical architecture (belongs in plan)',
      'Database schema (belongs in plan)',
      'API design (belongs in plan)',
      'Code structure (belongs in implement)',
      'Technology stack details (belongs in plan)',
      'Deployment configuration (belongs in plan)'
    ];
  }
  
  private findMisplacedContent(content: string, _inappropriateItems: string[]): string[] {
    const found: string[] = [];
    const lower = content.toLowerCase();
    
    const technicalPatterns = [
      { pattern: /database\s+schema|table\s+structure/i, message: 'Database schema details' },
      { pattern: /class\s+diagram|uml/i, message: 'Technical diagrams' },
      { pattern: /api\s+endpoint|rest\s+api|graphql/i, message: 'API implementation details' },
      { pattern: /docker|kubernetes|deployment/i, message: 'Deployment configuration' },
      { pattern: /microservice|architecture\s+pattern/i, message: 'Architecture patterns' }
    ];
    
    for (const { pattern, message } of technicalPatterns) {
      if (pattern.test(lower)) {
        found.push(`${message} should be in technical planning phase`);
      }
    }
    
    return found;
  }
  
  private generateSpecFeedback(
    analysis: SemanticAnalysisResult, 
    misplaced: string[],
    phaseValidation?: any
  ): string {
    let feedback = '## Specification Phase Evaluation\n\n';
    
    feedback += '### ✅ What This Phase Should Contain:\n';
    feedback += '- **User Stories**: Who uses the system and why\n';
    feedback += '- **Problem Definition**: What problems are being solved\n';
    feedback += '- **Requirements**: WHAT the system does (not HOW)\n';
    feedback += '- **Success Metrics**: How to measure success\n\n';
    
    // Include phase validation feedback if available
    if (phaseValidation) {
      if (phaseValidation.inappropriateContent.length > 0) {
        feedback += '### 🚫 Removed Inappropriate Content:\n';
        phaseValidation.inappropriateContent.forEach((item: string) => 
          feedback += `- ${item}\n`
        );
        feedback += '\n';
      }
    }
    
    if (misplaced.length > 0) {
      feedback += '### ⚠️ Content That Belongs in Other Phases:\n';
      misplaced.forEach(item => feedback += `- ${item}\n`);
      feedback += '\n💡 **Tip**: Save technical details for the planning phase\n\n';
    }
    
    if (analysis.totalScore >= 80) {
      feedback += '### 🎉 Excellent Specification!\n';
      feedback += 'Your specification focuses on the right aspects: users, problems, and requirements.\n';
    } else if (analysis.totalScore >= 60) {
      feedback += '### 👍 Good Foundation\n';
      feedback += 'Your specification covers the basics. Consider adding more detail to user stories and success criteria.\n';
    } else {
      feedback += '### 📝 Needs More Detail\n';
      feedback += 'Focus on describing WHO will use the system, WHAT problems it solves, and WHAT it should do.\n';
    }
    
    return feedback;
  }
}

/**
 * Planning Phase Evaluator
 * Focus: HOW to build it technically
 */
export class PlanEvaluator extends BasePhaseEvaluator {
  
  evaluate(content: string): PhaseEvaluationResult {
    const semanticAnalysis = this.analyzer.analyze(content, 'plan');
    const requirements = this.getPhaseRequirements();
    const inappropriate = this.getInappropriateRequirements();
    
    const misplacedExpectations = this.findMisplacedContent(content, inappropriate);
    const phaseSpecificFeedback = this.generatePlanFeedback(semanticAnalysis, misplacedExpectations);
    
    return {
      phase: 'plan',
      score: semanticAnalysis.totalScore,
      appropriateCriteria: true,
      semanticAnalysis,
      phaseSpecificFeedback,
      misplacedExpectations,
      correctExpectations: requirements
    };
  }
  
  getPhaseRequirements(): string[] {
    return [
      'System architecture and design patterns',
      'Technology stack selection with rationale',
      'Database design and data models',
      'API design and interfaces',
      'Security architecture',
      'Performance considerations',
      'Deployment and infrastructure plan'
    ];
  }
  
  getInappropriateRequirements(): string[] {
    return [
      'User personas (belongs in spec)',
      'Problem statements (belongs in spec)',
      'Test implementation (belongs in implement)',
      'Actual code (belongs in implement)',
      'Task assignments (belongs in tasks)'
    ];
  }
  
  private findMisplacedContent(content: string, _inappropriateItems: string[]): string[] {
    const found: string[] = [];
    const lower = content.toLowerCase();
    
    const specPatterns = [
      { pattern: /user\s+persona|target\s+audience/i, message: 'User personas' },
      { pattern: /problem\s+statement|pain\s+points/i, message: 'Problem definitions' },
      { pattern: /user\s+story|as\s+a\s+user/i, message: 'User stories' }
    ];
    
    const implementPatterns = [
      { pattern: /```[^`]+function|class|const/i, message: 'Implementation code' },
      { pattern: /test\s+case|describe\(|it\(/i, message: 'Test implementations' }
    ];
    
    for (const { pattern, message } of specPatterns) {
      if (pattern.test(lower)) {
        found.push(`${message} should be in specification phase`);
      }
    }
    
    for (const { pattern, message } of implementPatterns) {
      if (pattern.test(lower)) {
        found.push(`${message} should be in implementation phase`);
      }
    }
    
    return found;
  }
  
  private generatePlanFeedback(analysis: SemanticAnalysisResult, misplaced: string[]): string {
    let feedback = '## Technical Planning Phase Evaluation\n\n';
    
    feedback += '### ✅ What This Phase Should Contain:\n';
    feedback += '- **Architecture**: System design and patterns\n';
    feedback += '- **Tech Stack**: Languages, frameworks, databases\n';
    feedback += '- **Data Models**: Database schema and relationships\n';
    feedback += '- **APIs**: Interface design and contracts\n';
    feedback += '- **Infrastructure**: Deployment and scaling plans\n\n';
    
    if (misplaced.length > 0) {
      feedback += '### ⚠️ Content That Belongs in Other Phases:\n';
      misplaced.forEach(item => feedback += `- ${item}\n`);
      feedback += '\n';
    }
    
    if (analysis.totalScore >= 80) {
      feedback += '### 🎉 Comprehensive Technical Plan!\n';
      feedback += 'Your plan provides clear technical direction with good architectural decisions.\n';
    } else if (analysis.totalScore >= 55) {
      feedback += '### 👍 Solid Technical Foundation\n';
      feedback += 'Consider adding more detail about data models and API design.\n';
    } else {
      feedback += '### 📝 Needs Technical Detail\n';
      feedback += 'Focus on HOW the system will be built: architecture, technologies, and design decisions.\n';
    }
    
    return feedback;
  }
}

/**
 * Tasks Phase Evaluator
 * Focus: Breaking down work into manageable pieces
 */
export class TasksEvaluator extends BasePhaseEvaluator {
  
  evaluate(content: string): PhaseEvaluationResult {
    const semanticAnalysis = this.analyzer.analyze(content, 'tasks');
    const requirements = this.getPhaseRequirements();
    const inappropriate = this.getInappropriateRequirements();
    
    const misplacedExpectations = this.findMisplacedContent(content, inappropriate);
    const phaseSpecificFeedback = this.generateTasksFeedback(semanticAnalysis);
    
    return {
      phase: 'tasks',
      score: semanticAnalysis.totalScore,
      appropriateCriteria: true,
      semanticAnalysis,
      phaseSpecificFeedback,
      misplacedExpectations,
      correctExpectations: requirements
    };
  }
  
  getPhaseRequirements(): string[] {
    return [
      'Task breakdown structure',
      'Task dependencies and sequencing',
      'Effort estimates',
      'Testing approach for each task',
      'Definition of done for tasks',
      'Risk assessment'
    ];
  }
  
  getInappropriateRequirements(): string[] {
    return [
      'User requirements (belongs in spec)',
      'Architecture details (belongs in plan)',
      'Code implementation (belongs in implement)'
    ];
  }
  
  private findMisplacedContent(_content: string, _inappropriateItems: string[]): string[] {
    const found: string[] = [];
    // Task phase is more flexible, fewer restrictions
    return found;
  }
  
  private generateTasksFeedback(analysis: SemanticAnalysisResult): string {
    let feedback = '## Task Breakdown Phase Evaluation\n\n';
    
    feedback += '### ✅ What This Phase Should Contain:\n';
    feedback += '- **Work Breakdown**: Granular, manageable tasks\n';
    feedback += '- **Dependencies**: Task order and relationships\n';
    feedback += '- **Estimates**: Time/effort for each task\n';
    feedback += '- **Testing Strategy**: TDD approach for tasks\n\n';
    
    if (analysis.totalScore >= 80) {
      feedback += '### 🎉 Excellent Task Planning!\n';
      feedback += 'Tasks are well-defined with clear dependencies and estimates.\n';
    } else if (analysis.totalScore >= 50) {
      feedback += '### 👍 Good Task Structure\n';
      feedback += 'Consider adding more specific estimates and test strategies.\n';
    } else {
      feedback += '### 📝 Break Down Further\n';
      feedback += 'Divide work into smaller, more manageable tasks with clear dependencies.\n';
    }
    
    return feedback;
  }
}

/**
 * Implementation Phase Evaluator
 * Focus: Test-driven development guides
 */
export class ImplementEvaluator extends BasePhaseEvaluator {
  
  evaluate(content: string): PhaseEvaluationResult {
    const semanticAnalysis = this.analyzer.analyze(content, 'implement');
    const requirements = this.getPhaseRequirements();
    const inappropriate = this.getInappropriateRequirements();
    
    const misplacedExpectations = this.findMisplacedContent(content, inappropriate);
    const phaseSpecificFeedback = this.generateImplementFeedback(semanticAnalysis);
    
    return {
      phase: 'implement',
      score: semanticAnalysis.totalScore,
      appropriateCriteria: true,
      semanticAnalysis,
      phaseSpecificFeedback,
      misplacedExpectations,
      correctExpectations: requirements
    };
  }
  
  getPhaseRequirements(): string[] {
    return [
      'Test cases and scenarios',
      'TDD implementation guide',
      'Code structure and patterns',
      'Integration approach',
      'Error handling strategy',
      'Documentation requirements'
    ];
  }
  
  getInappropriateRequirements(): string[] {
    return [
      'User research (belongs in spec)',
      'Technology selection (belongs in plan)',
      'Task breakdown (belongs in tasks)'
    ];
  }
  
  private findMisplacedContent(_content: string, _inappropriateItems: string[]): string[] {
    // Implementation phase can contain most technical content
    return [];
  }
  
  private generateImplementFeedback(analysis: SemanticAnalysisResult): string {
    let feedback = '## Implementation Phase Evaluation\n\n';
    
    feedback += '### ✅ What This Phase Should Contain:\n';
    feedback += '- **Test Cases**: Comprehensive test scenarios\n';
    feedback += '- **TDD Guide**: Test-first development approach\n';
    feedback += '- **Code Patterns**: Consistent implementation patterns\n';
    feedback += '- **Integration**: How components work together\n\n';
    
    if (analysis.totalScore >= 80) {
      feedback += '### 🎉 Ready for High-Quality Implementation!\n';
      feedback += 'Excellent test coverage and clear implementation guidance.\n';
    } else if (analysis.totalScore >= 65) {
      feedback += '### 👍 Good Implementation Plan\n';
      feedback += 'Consider adding more test scenarios and error handling details.\n';
    } else {
      feedback += '### 📝 Strengthen Test Coverage\n';
      feedback += 'Focus on comprehensive test cases and clear TDD guidance.\n';
    }
    
    return feedback;
  }
}

/**
 * Main Phase-Specific Evaluator
 * Routes evaluation to appropriate phase evaluator
 */
export class PhaseSpecificEvaluator {
  private evaluators: Record<string, BasePhaseEvaluator> = {
    spec: new SpecEvaluator(),
    plan: new PlanEvaluator(),
    tasks: new TasksEvaluator(),
    implement: new ImplementEvaluator()
  };
  
  /**
   * Evaluate content according to its phase
   */
  evaluate(content: string, phase: string): PhaseEvaluationResult {
    const evaluator = this.evaluators[phase];
    
    if (!evaluator) {
      // Default to spec evaluator
      const specEvaluator = this.evaluators.spec;
      if (specEvaluator) {
        return specEvaluator.evaluate(content);
      }
      throw new Error(`No evaluator found for phase: ${phase}`);
    }
    
    return evaluator.evaluate(content);
  }
  
  /**
   * Get appropriate requirements for phase
   */
  getPhaseRequirements(phase: string): string[] {
    const evaluator = this.evaluators[phase];
    return evaluator ? evaluator.getPhaseRequirements() : [];
  }
  
  /**
   * Check if content matches its phase
   */
  validatePhaseAlignment(content: string, phase: string): {
    aligned: boolean;
    misalignments: string[];
    suggestions: string[];
  } {
    const evaluation = this.evaluate(content, phase);
    
    const aligned = evaluation.misplacedExpectations.length === 0;
    const misalignments = evaluation.misplacedExpectations;
    const suggestions = this.generateAlignmentSuggestions(misalignments, phase);
    
    return { aligned, misalignments, suggestions };
  }
  
  private generateAlignmentSuggestions(misalignments: string[], phase: string): string[] {
    const suggestions: string[] = [];
    
    if (misalignments.length > 0) {
      suggestions.push(`Focus on ${phase}-specific content`);
      suggestions.push(`Move technical details to appropriate phases`);
      suggestions.push(`Review the phase requirements checklist`);
    }
    
    return suggestions;
  }
}
