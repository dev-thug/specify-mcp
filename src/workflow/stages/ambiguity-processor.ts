import { Context, ValidationResult } from '../../types/mcp.js';
import { AmbiguityInput, AmbiguityOutput } from '../../types/workflow.js';
import { StageProcessor } from '../workflow-manager.js';
import { logger } from '../../utils/logger.js';

export class AmbiguityProcessor implements StageProcessor<AmbiguityInput, AmbiguityOutput> {
  
  async process(input: AmbiguityInput, context: Context): Promise<AmbiguityOutput> {
    logger.info('Processing ambiguity resolution stage', { 
      sessionId: context.sessionId,
      inputLength: input.request?.length || 0 
    });

    try {
      // Analyze the input for ambiguities
      const ambiguities = await this.identifyAmbiguities(input.request);
      
      // Generate clarifying questions
      const clarifyingQuestions = await this.generateClarifyingQuestions(ambiguities, input.request);
      
      // Create resolution strategies
      const resolutionStrategies = await this.createResolutionStrategies(ambiguities);
      
      // Generate assumptions for unresolved ambiguities
      const assumptions = await this.generateAssumptions(ambiguities, input.context);

      const output: AmbiguityOutput = {
        identifiedAmbiguities: ambiguities,
        clarifyingQuestions,
        resolutionStrategies,
        assumptions,
        clarifiedRequest: await this.generateClarifiedRequest(input.request, assumptions),
        confidence: this.calculateConfidence(ambiguities, assumptions)
      };

      logger.info('Ambiguity resolution completed', {
        sessionId: context.sessionId,
        ambiguitiesCount: ambiguities.length,
        questionsCount: clarifyingQuestions.length,
        confidence: output.confidence
      });

      return output;
      
    } catch (error) {
      logger.error('Ambiguity processing failed', error, { sessionId: context.sessionId });
      throw error;
    }
  }

  async validate(output: AmbiguityOutput, _context: Context): Promise<ValidationResult> {
    const validationErrors: string[] = [];
    
    // Check required fields
    if (!output.identifiedAmbiguities || output.identifiedAmbiguities.length === 0) {
      validationErrors.push('No ambiguities identified - this may indicate insufficient analysis');
    }
    
    if (!output.clarifiedRequest || output.clarifiedRequest.trim().length === 0) {
      validationErrors.push('Clarified request is empty');
    }
    
    if (output.confidence < 0.3) {
      validationErrors.push('Confidence level too low for proceeding to next stage');
    }

    // Validate each ambiguity has resolution strategy or assumption
    for (const ambiguity of output.identifiedAmbiguities) {
      const hasStrategy = output.resolutionStrategies.some(s => s.ambiguityId === ambiguity.id);
      const hasAssumption = output.assumptions.some(a => a.ambiguityId === ambiguity.id);
      
      if (!hasStrategy && !hasAssumption) {
        validationErrors.push(`Ambiguity "${ambiguity.description}" has no resolution strategy or assumption`);
      }
    }

    const isValid = validationErrors.length === 0;
    
    return {
      isValid,
      errors: validationErrors,
      metrics: {
        completeness: this.calculateCompleteness(output),
        clarity: this.calculateClarity(output),
        determinism: this.calculateDeterminism(output),
        consistency: 1.0, // First stage, no previous output to compare
        timestamp: Date.now()
      }
    };
  }

  private async identifyAmbiguities(request: string): Promise<Array<{
    id: string;
    type: 'semantic' | 'syntactic' | 'pragmatic' | 'contextual';
    description: string;
    location: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    examples?: string[];
  }>> {
    const ambiguities: any[] = [];
    let ambiguityId = 1;

    // Semantic ambiguities - multiple meanings
    const semanticPatterns = [
      /\b(can|could|may|might|should|would)\b/gi,
      /\b(some|many|few|several|most)\b/gi,
      /\b(fast|slow|big|small|high|low)\b/gi,
      /\b(soon|later|recently|often)\b/gi
    ];

    for (const pattern of semanticPatterns) {
      const matches = request.match(pattern);
      if (matches) {
        ambiguities.push({
          id: `amb_${ambiguityId++}`,
          type: 'semantic',
          description: `Ambiguous qualifier: "${matches[0]}" needs quantification`,
          location: `Contains: ${matches.join(', ')}`,
          severity: 'medium',
          examples: [`What specific value/range is meant by "${matches[0]}"?`]
        });
      }
    }

    // Syntactic ambiguities - unclear references
    const pronounMatches = request.match(/\b(it|this|that|they|them|which)\b/gi);
    if (pronounMatches) {
      ambiguities.push({
        id: `amb_${ambiguityId++}`,
        type: 'syntactic',
        description: 'Unclear pronoun references may cause confusion',
        location: `Pronouns: ${pronounMatches.join(', ')}`,
        severity: 'low',
        examples: ['What does "it" refer to?', 'What does "this" mean?']
      });
    }

    // Contextual ambiguities - missing context
    if (request.length < 50) {
      ambiguities.push({
        id: `amb_${ambiguityId++}`,
        type: 'contextual',
        description: 'Request may be too brief, lacking sufficient context',
        location: 'Overall request',
        severity: 'high',
        examples: ['What is the broader context?', 'What are the constraints?']
      });
    }

    // Technical ambiguities
    const techTerms = request.match(/\b(system|platform|framework|tool|solution|implementation)\b/gi);
    if (techTerms) {
      ambiguities.push({
        id: `amb_${ambiguityId++}`,
        type: 'pragmatic',
        description: 'Technical terms need specification',
        location: `Technical terms: ${techTerms.join(', ')}`,
        severity: 'high',
        examples: ['Which specific technology/platform?', 'What are the technical requirements?']
      });
    }

    return ambiguities;
  }

  private async generateClarifyingQuestions(ambiguities: any[], _request: string): Promise<Array<{
    id: string;
    ambiguityId: string;
    question: string;
    type: 'yes_no' | 'multiple_choice' | 'open_ended' | 'quantitative';
    priority: 'low' | 'medium' | 'high' | 'critical';
    suggestedAnswers?: string[];
  }>> {
    const questions: any[] = [];
    let questionId = 1;

    for (const ambiguity of ambiguities) {
      switch (ambiguity.type) {
        case 'semantic':
          questions.push({
            id: `q_${questionId++}`,
            ambiguityId: ambiguity.id,
            question: `Can you specify the exact ${ambiguity.description.includes('qualifier') ? 'value or range' : 'meaning'} for the term mentioned?`,
            type: 'open_ended',
            priority: ambiguity.severity,
            suggestedAnswers: ambiguity.examples
          });
          break;

        case 'contextual':
          questions.push({
            id: `q_${questionId++}`,
            ambiguityId: ambiguity.id,
            question: 'Can you provide more context about your requirements, constraints, and expected outcomes?',
            type: 'open_ended',
            priority: 'high'
          });
          break;

        case 'pragmatic':
          questions.push({
            id: `q_${questionId++}`,
            ambiguityId: ambiguity.id,
            question: 'Which specific technologies, platforms, or tools do you prefer or are constrained to use?',
            type: 'multiple_choice',
            priority: 'high',
            suggestedAnswers: ['Any modern technology', 'Specific platform (please specify)', 'Legacy system integration required']
          });
          break;

        case 'syntactic':
          questions.push({
            id: `q_${questionId++}`,
            ambiguityId: ambiguity.id,
            question: 'Can you clarify what the pronouns in your request refer to?',
            type: 'open_ended',
            priority: 'medium'
          });
          break;
      }
    }

    return questions;
  }

  private async createResolutionStrategies(ambiguities: any[]): Promise<Array<{
    id: string;
    ambiguityId: string;
    strategy: string;
    confidence: number;
    reasoning: string;
  }>> {
    const strategies: any[] = [];
    let strategyId = 1;

    for (const ambiguity of ambiguities) {
      let strategy: string;
      let confidence: number;
      let reasoning: string;

      switch (ambiguity.severity) {
        case 'critical':
          strategy = 'Request immediate clarification before proceeding';
          confidence = 0.9;
          reasoning = 'Critical ambiguities must be resolved to prevent project failure';
          break;

        case 'high':
          strategy = 'Apply industry best practices and document assumptions';
          confidence = 0.7;
          reasoning = 'High-impact ambiguities should use proven approaches';
          break;

        case 'medium':
          strategy = 'Use reasonable defaults with validation checkpoints';
          confidence = 0.6;
          reasoning = 'Medium ambiguities can be addressed with standard approaches';
          break;

        case 'low':
          strategy = 'Document assumption and proceed with common interpretation';
          confidence = 0.8;
          reasoning = 'Low-impact ambiguities rarely cause significant issues';
          break;

        default:
          strategy = 'Use standard interpretation and validate later';
          confidence = 0.5;
          reasoning = 'Default approach when severity is unclear';
      }

      strategies.push({
        id: `strategy_${strategyId++}`,
        ambiguityId: ambiguity.id,
        strategy,
        confidence,
        reasoning
      });
    }

    return strategies;
  }

  private async generateAssumptions(ambiguities: any[], _inputContext?: any): Promise<Array<{
    id: string;
    ambiguityId: string;
    assumption: string;
    rationale: string;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    validationMethod: string;
  }>> {
    const assumptions: any[] = [];
    let assumptionId = 1;

    for (const ambiguity of ambiguities) {
      let assumption: string;
      let rationale: string;
      let confidence: number;
      let riskLevel: 'low' | 'medium' | 'high';
      let validationMethod: string;

      switch (ambiguity.type) {
        case 'semantic':
          assumption = 'Use industry-standard interpretation of ambiguous terms';
          rationale = 'Industry standards provide reliable defaults for ambiguous terminology';
          confidence = 0.7;
          riskLevel = 'medium';
          validationMethod = 'Stakeholder review and approval';
          break;

        case 'contextual':
          assumption = 'Apply common use case patterns for similar projects';
          rationale = 'Missing context can be inferred from typical project patterns';
          confidence = 0.6;
          riskLevel = 'high';
          validationMethod = 'Early prototype validation';
          break;

        case 'pragmatic':
          assumption = 'Use modern, widely-adopted technologies unless specified otherwise';
          rationale = 'Modern technologies offer better support and future-proofing';
          confidence = 0.8;
          riskLevel = 'low';
          validationMethod = 'Technical review and approval';
          break;

        case 'syntactic':
          assumption = 'Resolve references to nearest logical antecedent';
          rationale = 'Grammatical proximity usually indicates intended reference';
          confidence = 0.7;
          riskLevel = 'low';
          validationMethod = 'Document review';
          break;

        default:
          assumption = 'Use most common interpretation in similar contexts';
          rationale = 'Common interpretations are usually correct';
          confidence = 0.5;
          riskLevel = 'medium';
          validationMethod = 'Iterative validation';
      }

      assumptions.push({
        id: `assumption_${assumptionId++}`,
        ambiguityId: ambiguity.id,
        assumption,
        rationale,
        confidence,
        riskLevel,
        validationMethod
      });
    }

    return assumptions;
  }

  private async generateClarifiedRequest(originalRequest: string, assumptions: any[]): Promise<string> {
    let clarifiedRequest = originalRequest;

    // Apply assumptions to clarify the request
    for (const assumption of assumptions) {
      // This is a simplified approach - in a real implementation,
      // this would use more sophisticated NLP techniques
      clarifiedRequest += `\n\n[ASSUMPTION: ${assumption.assumption}]`;
    }

    return clarifiedRequest;
  }

  private calculateConfidence(ambiguities: any[], assumptions: any[]): number {
    if (ambiguities.length === 0) {
      return 1.0; // Perfect clarity
    }

    const criticalCount = ambiguities.filter(a => a.severity === 'critical').length;
    const highCount = ambiguities.filter(a => a.severity === 'high').length;
    const mediumCount = ambiguities.filter(a => a.severity === 'medium').length;
    const lowCount = ambiguities.filter(a => a.severity === 'low').length;

    // Calculate weighted impact
    const totalImpact = (criticalCount * 1.0) + (highCount * 0.7) + (mediumCount * 0.4) + (lowCount * 0.1);
    const maxPossibleImpact = ambiguities.length * 1.0;

    // Base confidence decreases with ambiguity impact
    let baseConfidence = Math.max(0.1, 1.0 - (totalImpact / maxPossibleImpact));

    // Boost confidence based on assumption quality
    const avgAssumptionConfidence = assumptions.length > 0
      ? assumptions.reduce((sum, a) => sum + a.confidence, 0) / assumptions.length
      : 0.5;

    return Math.min(1.0, baseConfidence * 0.7 + avgAssumptionConfidence * 0.3);
  }

  private calculateCompleteness(output: AmbiguityOutput): number {
    let score = 0;
    const maxScore = 5;

    if (output.identifiedAmbiguities.length > 0) score += 1;
    if (output.clarifyingQuestions.length > 0) score += 1;
    if (output.resolutionStrategies.length > 0) score += 1;
    if (output.assumptions.length > 0) score += 1;
    if (output.clarifiedRequest && output.clarifiedRequest.length > 50) score += 1;

    return score / maxScore;
  }

  private calculateClarity(output: AmbiguityOutput): number {
    // Clarity is inversely related to remaining ambiguities
    const totalAmbiguities = output.identifiedAmbiguities.length;
    const resolvedAmbiguities = output.resolutionStrategies.length + output.assumptions.length;
    
    if (totalAmbiguities === 0) return 1.0;
    
    return Math.min(1.0, resolvedAmbiguities / totalAmbiguities);
  }

  private calculateDeterminism(output: AmbiguityOutput): number {
    // Determinism is based on the confidence of assumptions and strategies
    const allConfidences = [
      ...output.resolutionStrategies.map(s => s.confidence),
      ...output.assumptions.map(a => a.confidence)
    ];

    if (allConfidences.length === 0) return 0.5;

    return allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length;
  }
}
