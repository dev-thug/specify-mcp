import type { 
  VerificationResult, 
  CommonVerificationConfig
} from '../types/index.js';

export class CommonVerifier {
  private readonly config: CommonVerificationConfig;

  constructor(config: Partial<CommonVerificationConfig> = {}) {
    this.config = {
      enableHallucinationCheck: true,
      enableConsistencyCheck: true,
      enableFactCheck: true,
      consensusRuns: 3,
      ...config
    };
  }

  async verify(content: string, context?: Record<string, unknown>): Promise<VerificationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    if (this.config.enableHallucinationCheck) {
      const hallucinationResult = await this.checkHallucination(content);
      issues.push(...hallucinationResult.issues);
      suggestions.push(...hallucinationResult.suggestions);
      confidence *= hallucinationResult.confidence;
    }

    if (this.config.enableConsistencyCheck) {
      const consistencyResult = await this.checkConsistency(content, context);
      issues.push(...consistencyResult.issues);
      suggestions.push(...consistencyResult.suggestions);
      confidence *= consistencyResult.confidence;
    }

    if (this.config.enableFactCheck) {
      const factResult = await this.checkFacts(content);
      issues.push(...factResult.issues);
      suggestions.push(...factResult.suggestions);
      confidence *= factResult.confidence;
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence
    };
  }

  async runWithConsensus(
    content: string,
    runs: number = this.config.consensusRuns || 3
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    
    for (let i = 0; i < runs; i++) {
      const result = await this.verify(content);
      results.push(result);
    }

    return results;
  }

  private async checkHallucination(content: string): Promise<VerificationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for common hallucination patterns
    const hallucinationPatterns = [
      /as of my last update/i,
      /I don't have access to/i,
      /I cannot access/i,
      /hypothetically/i,
      /supposedly/i
    ];

    for (const pattern of hallucinationPatterns) {
      if (pattern.test(content)) {
        issues.push(`Potential hallucination detected: ${pattern.source}`);
        suggestions.push('Remove uncertain language and verify facts');
      }
    }

    // Check for unexplained technical terms
    const technicalTerms = content.match(/\b[A-Z]{2,}(?:[a-z]+[A-Z])*[a-z]*\b/g) || [];
    const unexplainedTerms = technicalTerms.filter(term => 
      !content.includes(`${term} (`) && !content.includes(`${term} is`)
    );

    if (unexplainedTerms.length > 0) {
      suggestions.push(`Consider explaining technical terms: ${unexplainedTerms.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: issues.length === 0 ? 0.95 : 0.7
    };
  }

  private async checkConsistency(
    content: string, 
    context?: Record<string, unknown>
  ): Promise<VerificationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for contradictions within the content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const contradictionPairs = [
      ['must', 'optional'],
      ['always', 'sometimes'],
      ['required', 'optional'],
      ['synchronous', 'asynchronous']
    ];

    for (const [term1, term2] of contradictionPairs) {
      const hasTerm1 = sentences.some(s => s.toLowerCase().includes(term1));
      const hasTerm2 = sentences.some(s => s.toLowerCase().includes(term2));
      
      if (hasTerm1 && hasTerm2) {
        issues.push(`Potential contradiction: both "${term1}" and "${term2}" used`);
        suggestions.push('Clarify whether requirements are mandatory or optional');
      }
    }

    // Check consistency with context
    if (context?.previousContent) {
      const prevContent = String(context.previousContent);
      if (prevContent && this.hasContradiction(content, prevContent)) {
        issues.push('Content contradicts previous specifications');
        suggestions.push('Review and align with previous decisions');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: issues.length === 0 ? 0.9 : 0.6
    };
  }

  private async checkFacts(content: string): Promise<VerificationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for verifiable facts
    const numberClaims = content.match(/\d+\s*(?:%|percent|times|x)/gi) || [];
    if (numberClaims.length > 0) {
      suggestions.push(`Verify numerical claims: ${numberClaims.join(', ')}`);
    }

    // Check for date/time claims
    const dateClaims = content.match(/\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi) || [];
    if (dateClaims.length > 0) {
      suggestions.push('Verify date and timeline accuracy');
    }

    // Check for technology version claims
    const versionClaims = content.match(/v?\d+\.\d+(?:\.\d+)?/g) || [];
    if (versionClaims.length > 0) {
      suggestions.push(`Verify version numbers: ${versionClaims.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: 0.85
    };
  }

  private hasContradiction(content1: string, content2: string): boolean {
    // Simple contradiction detection - can be enhanced with NLP
    // const normalize = (s: string): string => s.toLowerCase().trim();
    
    const negationPairs = [
      ['will', 'will not'],
      ['should', 'should not'],
      ['must', 'must not'],
      ['can', 'cannot']
    ];

    for (const [positive, negative] of negationPairs) {
      const has1Positive = content1.toLowerCase().includes(positive);
      const has1Negative = content1.toLowerCase().includes(negative);
      const has2Positive = content2.toLowerCase().includes(positive);
      const has2Negative = content2.toLowerCase().includes(negative);

      if ((has1Positive && has2Negative) || (has1Negative && has2Positive)) {
        return true;
      }
    }

    return false;
  }
}
