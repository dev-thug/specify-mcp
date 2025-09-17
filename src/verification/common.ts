/**
 * Common verification module for hallucination and ambiguity detection
 * Based on AI-SDD paper principles
 */

import { IValidationResult, IVerificationContext } from '../types/index.js';
import { AdvancedQualityAnalyzer } from './advanced-quality-analyzer.js';

export class CommonVerifier {
  private readonly advancedAnalyzer = new AdvancedQualityAnalyzer();
  
  private readonly hallucinationPatterns = [
    /\b(probably|maybe|might|could be|I think|I believe|assume|guess)\b/gi,
    /\b(should work|ought to|supposed to)\b/gi,
    /\b(TODO|FIXME|XXX|HACK)\b/gi,
    /\[NEEDS CLARIFICATION[^\]]*\]/gi,
  ];

  private readonly ambiguityPatterns = [
    /\b(some|many|few|several|various|certain)\b/gi,
    /\b(fast|slow|good|bad|better|worse|optimal|efficient)\b/gi,
    /\b(soon|later|eventually|when possible)\b/gi,
    /\b(etc|and so on|and more)\b/gi,
    /\b(appropriate|suitable|reasonable|adequate)\b/gi,
  ];

  private readonly technicalDetailPatterns = [
    // Actual implementation code patterns (more restrictive per AI-SDD)
    /\bimport\s+.*from\s+['"][^'"]+['"]/g,
    /\bfunction\s+\w+\s*\([^)]*\)\s*\{/g,
    /\bclass\s+\w+\s*(?:extends\s+\w+)?\s*\{/g,
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:new\s+)?\w+/g,
    /\b(?:npm|yarn|pip)\s+install\s+/g,
    /\bpackage\.json|requirements\.txt|Gemfile/g,
    /\b(?:GET|POST|PUT|DELETE)\s+\/api\//g, // Specific API endpoints
    /\b\w+\.\w+\(\)/g, // Method calls
    /\b(?:SELECT|INSERT|UPDATE|DELETE)\s+/gi, // SQL statements
  ];

  async verify(context: IVerificationContext): Promise<IValidationResult[]> {
    const results: IValidationResult[] = [];
    
    // Use advanced quality analysis as primary verification
    const qualityAssessment = await this.advancedAnalyzer.analyzeSpecification(
      context.content, 
      context.phase
    );
    
    // Convert quality assessment to validation results
    const qualityResults = this.convertQualityToValidationResults(qualityAssessment);
    results.push(...qualityResults);
    
    // Still check for hallucination indicators (AI-SDD requirement)
    const hallucinationResults = this.detectHallucination(context);
    results.push(...hallucinationResults);
    
    // Legacy ambiguity detection (kept for backward compatibility)
    const ambiguityResults = this.detectAmbiguity(context);
    results.push(...ambiguityResults);
    
    // Phase-specific checks
    if (context.phase === 'spec') {
      const specResults = this.verifySpecification(context);
      results.push(...specResults);
    } else if (context.phase === 'plan') {
      const planResults = this.verifyPlan(context);
      results.push(...planResults);
    } else if (context.phase === 'tasks') {
      const taskResults = this.verifyTasks(context);
      results.push(...taskResults);
    } else if (context.phase === 'implement') {
      const implResults = this.verifyImplementation(context);
      results.push(...implResults);
    }
    
    // Check consistency with previous versions
    if (context.previousVersions && context.previousVersions.length > 0) {
      const consistencyResults = this.checkConsistency(context);
      results.push(...consistencyResults);
    }
    
    return results;
  }

  private detectHallucination(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const lines = context.content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of this.hallucinationPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          results.push({
            type: 'warning',
            category: 'hallucination',
            message: `Potential hallucination detected: "${matches[0]}"`,
            location: `Line ${index + 1}`,
            suggestion: 'Replace with concrete, verifiable information',
            confidence: 0.7,
          });
        }
      }
    });
    
    return results;
  }

  private detectAmbiguity(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const lines = context.content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of this.ambiguityPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          results.push({
            type: 'warning',
            category: 'ambiguity',
            message: `Ambiguous term detected: "${matches[0]}"`,
            location: `Line ${index + 1}`,
            suggestion: 'Use specific, measurable terms',
            confidence: 0.6,
          });
        }
      }
    });
    
    return results;
  }

  private verifySpecification(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const content = context.content.toLowerCase();
    
    // Check for technical details in spec
    for (const pattern of this.technicalDetailPatterns) {
      const matches = context.content.match(pattern);
      if (matches) {
        results.push({
          type: 'error',
          category: 'inconsistency',
          message: `Technical implementation detail found in specification: "${matches[0]}"`,
          location: 'Specification document',
          suggestion: 'Remove technical details, focus on WHAT and WHY',
          confidence: 0.9,
        });
      }
    }
    
    // Check for required sections
    const requiredSections = ['user scenarios', 'requirements', 'acceptance'];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        results.push({
          type: 'error',
          category: 'incompleteness',
          message: `Missing required section: ${section}`,
          location: 'Specification structure',
          suggestion: `Add ${section} section to the specification`,
          confidence: 0.95,
        });
      }
    }
    
    // Check for testable requirements
    const requirementPattern = /\bMUST\b/g;
    const requirements = context.content.match(requirementPattern);
    if (!requirements || requirements.length < 3) {
      results.push({
        type: 'warning',
        category: 'incompleteness',
        message: 'Insufficient testable requirements',
        location: 'Requirements section',
        suggestion: 'Add more specific, testable requirements using MUST keyword',
        confidence: 0.8,
      });
    }
    
    return results;
  }

  private verifyPlan(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const content = context.content.toLowerCase();
    
    // Check for tech stack definition
    if (!content.includes('language') || !content.includes('framework')) {
      results.push({
        type: 'error',
        category: 'incompleteness',
        message: 'Missing technology stack definition',
        location: 'Technical Context section',
        suggestion: 'Define language, framework, and key dependencies',
        confidence: 0.9,
      });
    }
    
    // Check for testing strategy
    if (!content.includes('test') || !content.includes('tdd')) {
      results.push({
        type: 'warning',
        category: 'incompleteness',
        message: 'Testing strategy not defined',
        location: 'Plan document',
        suggestion: 'Include TDD approach and testing tools',
        confidence: 0.75,
      });
    }
    
    // Check for architecture decisions
    if (!content.includes('architecture') && !content.includes('structure')) {
      results.push({
        type: 'warning',
        category: 'incompleteness',
        message: 'Architecture decisions not documented',
        location: 'Plan document',
        suggestion: 'Document high-level architecture and project structure',
        confidence: 0.7,
      });
    }
    
    return results;
  }

  private verifyTasks(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const lines = context.content.split('\n');
    
    // Check for task numbering and structure
    const taskPattern = /T\d{3}/;
    const tasks = lines.filter(line => taskPattern.test(line));
    
    if (tasks.length < 5) {
      results.push({
        type: 'warning',
        category: 'incompleteness',
        message: 'Insufficient task breakdown',
        location: 'Tasks document',
        suggestion: 'Break down work into more granular tasks',
        confidence: 0.7,
      });
    }
    
    // Check for test-first approach
    const testTasks = tasks.filter(task => task.toLowerCase().includes('test'));
    // Check implementation tasks exist
    
    if (testTasks.length === 0) {
      results.push({
        type: 'error',
        category: 'inconsistency',
        message: 'No test tasks found',
        location: 'Tasks document',
        suggestion: 'Add test tasks before implementation tasks (TDD)',
        confidence: 0.9,
      });
    }
    
    // Check for parallel task marking
    const parallelTasks = tasks.filter(task => task.includes('[P]'));
    if (parallelTasks.length === 0 && tasks.length > 10) {
      results.push({
        type: 'info',
        category: 'incompleteness',
        message: 'No parallel tasks identified',
        location: 'Tasks document',
        suggestion: 'Mark independent tasks with [P] for parallel execution',
        confidence: 0.6,
      });
    }
    
    return results;
  }

  private verifyImplementation(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    const content = context.content.toLowerCase();
    
    // Check for TDD phases
    const tddPhases = ['red', 'green', 'refactor'];
    for (const phase of tddPhases) {
      if (!content.includes(phase)) {
        results.push({
          type: 'warning',
          category: 'incompleteness',
          message: `TDD phase not mentioned: ${phase}`,
          location: 'Implementation document',
          suggestion: `Document ${phase} phase of TDD cycle`,
          confidence: 0.7,
        });
      }
    }
    
    // Check for test definitions
    if (!content.includes('test') || !content.includes('expect')) {
      results.push({
        type: 'error',
        category: 'incompleteness',
        message: 'Test definitions missing',
        location: 'Implementation document',
        suggestion: 'Add concrete test cases with expectations',
        confidence: 0.85,
      });
    }
    
    // Check for pseudo-code or implementation guidance
    if (!content.includes('pseudo') && !content.includes('approach') && !content.includes('algorithm')) {
      results.push({
        type: 'warning',
        category: 'incompleteness',
        message: 'Implementation approach not documented',
        location: 'Implementation document',
        suggestion: 'Add pseudo-code or implementation approach',
        confidence: 0.65,
      });
    }
    
    return results;
  }

  private checkConsistency(context: IVerificationContext): IValidationResult[] {
    const results: IValidationResult[] = [];
    
    if (!context.previousVersions || context.previousVersions.length === 0) {
      return results;
    }
    
    const currentWords = new Set(context.content.toLowerCase().split(/\s+/));
    const firstVersion = context.previousVersions[0];
    if (!firstVersion) {
      return results;
    }
    const previousWords = new Set(firstVersion.toLowerCase().split(/\s+/));
    
    // Calculate similarity
    const intersection = new Set([...currentWords].filter(x => previousWords.has(x)));
    const similarity = (intersection.size * 2) / (currentWords.size + previousWords.size);
    
    // Check for major changes
    if (similarity < 0.5) {
      results.push({
        type: 'warning',
        category: 'inconsistency',
        message: 'Significant changes from previous version detected',
        location: 'Document comparison',
        suggestion: 'Review changes to ensure continuity',
        confidence: 0.7,
      });
    }
    
    // Check for removed requirements (spec phase)
    if (context.phase === 'spec') {
      const firstVersion = context.previousVersions[0];
      if (!firstVersion) {
        return results;
      }
      const prevRequirements = firstVersion.match(/\bMUST\b[^.]+\./g) || [];
      const currRequirements = context.content.match(/\bMUST\b[^.]+\./g) || [];
      
      const removed = prevRequirements.filter(req => 
        !currRequirements.some(curr => curr.includes(req.substring(0, 20)))
      );
      
      if (removed.length > 0) {
        results.push({
          type: 'warning',
          category: 'inconsistency',
          message: `${removed.length} requirement(s) removed from previous version`,
          location: 'Requirements section',
          suggestion: 'Verify requirement removal is intentional',
          confidence: 0.8,
        });
      }
    }
    
    return results;
  }

  // Calculate confidence score for overall document
  private convertQualityToValidationResults(assessment: any): IValidationResult[] {
    const results: IValidationResult[] = [];
    
    // Convert each dimension to validation results
    for (const dimension of assessment.dimensions) {
      if (dimension.score < 0.6) {
        results.push({
          type: dimension.score < 0.4 ? 'error' : 'warning',
          category: 'quality',
          message: `${dimension.name} quality insufficient (${(dimension.score * 100).toFixed(0)}%)`,
          location: 'Document structure',
          suggestion: dimension.issues.join('; '),
          confidence: 0.9
        });
      }
    }
    
    // Add overall quality assessment
    if (assessment.requiresIteration) {
      results.push({
        type: assessment.severity === 'critical' ? 'error' : 'warning',
        category: 'quality',
        message: `Overall document quality needs improvement (${assessment.overallScore.toFixed(0)}%)`,
        location: 'Complete document',
        suggestion: assessment.recommendations.slice(0, 3).join('; '),
        confidence: 0.95
      });
    }
    
    return results;
  }

  calculateConfidence(results: IValidationResult[]): number {
    if (results.length === 0) return 1.0;
    
    const weights = {
      error: 0.3,
      warning: 0.15,
      info: 0.05,
    };
    
    let totalPenalty = 0;
    
    for (const result of results) {
      const weight = weights[result.type] || 0;
      totalPenalty += weight * result.confidence;
    }
    
    return Math.max(0, 1.0 - totalPenalty);
  }
}
