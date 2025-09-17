/**
 * Advanced Specification Quality Analyzer
 * Based on formal methods and academic research (MIT, IEEE, ACM 2024)
 * Implements multi-dimensional quality assessment for AI-SDD framework
 */

export interface QualityDimension {
  name: string;
  score: number; // 0-1
  weight: number; // Relative importance
  details: string[];
  issues: string[];
}

export interface QualityAssessment {
  overallScore: number; // 0-100
  dimensions: QualityDimension[];
  recommendations: string[];
  severity: 'critical' | 'major' | 'minor' | 'acceptable';
  requiresIteration: boolean;
}

export interface StructuralMetrics {
  sectionCount: number;
  hierarchyDepth: number;
  logicalFlow: number; // 0-1
  crossReferences: number;
  completenessIndex: number; // 0-1
}

export interface SemanticMetrics {
  ambiguityScore: number; // 0-1 (lower is better)
  specificityIndex: number; // 0-1
  consistencyScore: number; // 0-1
  clarityIndex: number; // 0-1
}

export class AdvancedQualityAnalyzer {
  private readonly structuralAnalyzer = new StructuralAnalyzer();
  private readonly completenessAnalyzer = new CompletenessAnalyzer();
  private readonly ambiguityDetector = new AmbiguityDetector();
  private readonly consistencyValidator = new ConsistencyValidator();

  async analyzeSpecification(content: string, phase: string): Promise<QualityAssessment> {
    const dimensions: QualityDimension[] = [];

    // 1. Structural Quality (25% weight)
    const structural = await this.structuralAnalyzer.analyze(content, phase);
    dimensions.push({
      name: 'Structural Quality',
      score: structural.score,
      weight: 0.25,
      details: structural.details,
      issues: structural.issues
    });

    // 2. Completeness (30% weight) 
    const completeness = await this.completenessAnalyzer.analyze(content, phase);
    dimensions.push({
      name: 'Completeness',
      score: completeness.score,
      weight: 0.30,
      details: completeness.details,
      issues: completeness.issues
    });

    // 3. Clarity & Ambiguity (25% weight)
    const clarity = await this.ambiguityDetector.analyze(content);
    dimensions.push({
      name: 'Clarity & Specificity',
      score: clarity.score,
      weight: 0.25,
      details: clarity.details,
      issues: clarity.issues
    });

    // 4. Consistency (20% weight)
    const consistency = await this.consistencyValidator.analyze(content, phase);
    dimensions.push({
      name: 'Internal Consistency',
      score: consistency.score,
      weight: 0.20,
      details: consistency.details,
      issues: consistency.issues
    });

    // Calculate weighted overall score
    const overallScore = dimensions.reduce(
      (sum, dim) => sum + (dim.score * dim.weight), 0
    ) * 100;

    // Determine severity and iteration requirements
    const severity = this.determineSeverity(overallScore, dimensions);
    const requiresIteration = this.shouldRequireIteration(overallScore, dimensions, phase);

    // Generate actionable recommendations
    const recommendations = this.generateRecommendations(dimensions, phase);

    return {
      overallScore,
      dimensions,
      recommendations,
      severity,
      requiresIteration
    };
  }

  private determineSeverity(score: number, dimensions: QualityDimension[]): 'critical' | 'major' | 'minor' | 'acceptable' {
    // Critical: Any dimension below 0.4 OR overall below 50
    const hasCritical = dimensions.some(d => d.score < 0.4);
    if (hasCritical || score < 50) return 'critical';
    
    // Major: Overall below 70 OR any dimension below 0.6
    const hasMajor = dimensions.some(d => d.score < 0.6);
    if (score < 70 || hasMajor) return 'major';
    
    // Minor: Overall below 85
    if (score < 85) return 'minor';
    
    return 'acceptable';
  }

  private shouldRequireIteration(score: number, dimensions: QualityDimension[], phase: string): boolean {
    // Phase-specific thresholds based on AI-SDD requirements
    const thresholds = {
      'spec': 75,    // Requirements must be thorough
      'plan': 80,    // Technical plans must be precise
      'tasks': 70,   // Task breakdown needs clarity
      'implement': 85 // Implementation guides must be exact
    };

    const threshold = thresholds[phase as keyof typeof thresholds] || 70;
    
    // Require iteration if below threshold OR any dimension is critically low
    return score < threshold || dimensions.some(d => d.score < 0.5);
  }

  private generateRecommendations(dimensions: QualityDimension[], phase: string): string[] {
    const recommendations: string[] = [];

    for (const dimension of dimensions) {
      if (dimension.score < 0.6) {
        recommendations.push(`**${dimension.name}** needs improvement (${(dimension.score * 100).toFixed(0)}%)`);
        recommendations.push(...dimension.issues.map(issue => `  • ${issue}`));
      }
    }

    // Phase-specific guidance
    const phaseGuidance = this.getPhaseSpecificGuidance(phase);
    recommendations.push(...phaseGuidance);

    return recommendations;
  }

  private getPhaseSpecificGuidance(phase: string): string[] {
    const guidance = {
      'spec': [
        'Focus on WHAT and WHY, avoid HOW (technical implementation)',
        'Include concrete user scenarios and acceptance criteria',
        'Define clear success metrics and constraints'
      ],
      'plan': [
        'Specify technical architecture and design patterns',
        'Include detailed technology stack decisions',
        'Address scalability, security, and performance considerations'
      ],
      'tasks': [
        'Break down work into testable, independent units',
        'Define clear dependencies between tasks',
        'Include TDD approach for each task'
      ],
      'implement': [
        'Provide specific test cases and implementation guidance',
        'Include code examples and patterns',
        'Ensure traceability to requirements and tasks'
      ]
    };

    return guidance[phase as keyof typeof guidance] || [];
  }
}

class StructuralAnalyzer {
  async analyze(content: string, phase: string): Promise<{ score: number; details: string[]; issues: string[] }> {
    const issues: string[] = [];
    const details: string[] = [];

    // Analyze document structure
    let score = 0;

    // Section organization (0.3 weight)
    const sectionScore = this.analyzeSectionStructure(content, phase);
    score += sectionScore * 0.3;
    if (sectionScore < 0.6) {
      issues.push('Document structure is incomplete or poorly organized');
    }
    details.push(`Section organization: ${(sectionScore * 100).toFixed(0)}%`);

    // Logical flow (0.4 weight) 
    const flowScore = this.analyzeLogicalFlow(content);
    score += flowScore * 0.4;
    if (flowScore < 0.7) {
      issues.push('Logical flow between sections needs improvement');
    }
    details.push(`Logical flow: ${(flowScore * 100).toFixed(0)}%`);

    // Content depth (0.3 weight)
    const depthScore = this.analyzeContentDepth(content, phase);
    score += depthScore * 0.3;
    if (depthScore < 0.6) {
      issues.push('Content lacks sufficient detail and depth');
    }
    details.push(`Content depth: ${(depthScore * 100).toFixed(0)}%`);

    return { score, details, issues };
  }


  private analyzeSectionStructure(content: string, phase: string): number {
    const requiredSections = this.getRequiredSections(phase);
    const existingSections = this.extractSections(content);
    
    let score = 0;
    let found = 0;

    for (const required of requiredSections) {
      if (existingSections.some(section => 
        section.toLowerCase().includes(required.toLowerCase()) ||
        this.isSectionSimilar(section, required)
      )) {
        found++;
      }
    }

    score = found / requiredSections.length;
    return Math.min(score, 1.0);
  }

  private analyzeLogicalFlow(content: string): number {
    // Analyze transitions between sections
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    let transitionScore = 0;
    
    for (let i = 1; i < paragraphs.length; i++) {
      const curr = paragraphs[i]?.toLowerCase() || '';
      
      // Look for logical connectors
      const connectors = ['therefore', 'however', 'furthermore', 'consequently', 'as a result', 'in addition'];
      if (connectors.some(connector => curr.includes(connector))) {
        transitionScore += 1;
      }
    }

    return Math.min(transitionScore / Math.max(paragraphs.length - 1, 1), 1.0);
  }

  private analyzeContentDepth(content: string, phase: string): number {
    const minLengthByPhase = {
      'spec': 800,
      'plan': 1200, 
      'tasks': 600,
      'implement': 1000
    };

    const expectedLength = minLengthByPhase[phase as keyof typeof minLengthByPhase] || 800;
    const lengthScore = Math.min(content.length / expectedLength, 1.0);
    
    // Count detailed elements
    const bullets = (content.match(/^\s*[-*+]/gm) || []).length;
    const numberedItems = (content.match(/^\s*\d+\./gm) || []).length;
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    
    const detailScore = Math.min((bullets + numberedItems + codeBlocks) / 10, 1.0);
    
    return (lengthScore + detailScore) / 2;
  }

  private getRequiredSections(phase: string): string[] {
    const sectionsByPhase = {
      'spec': ['overview', 'user', 'requirements', 'scenarios', 'criteria', 'constraints'],
      'plan': ['architecture', 'technology', 'design', 'data model', 'api', 'security'],
      'tasks': ['breakdown', 'dependencies', 'timeline', 'testing', 'deliverables'],
      'implement': ['tests', 'implementation', 'examples', 'integration', 'deployment']
    };

    return sectionsByPhase[phase as keyof typeof sectionsByPhase] || [];
  }

  private extractSections(content: string): string[] {
    const headers = content.match(/^#+\s.*$/gm) || [];
    return headers.map(h => h.replace(/^#+\s/, '').trim());
  }

  private isSectionSimilar(section: string, required: string): boolean {
    const synonyms: { [key: string]: string[] } = {
      'user': ['users', 'stakeholder', 'persona', 'audience'],
      'requirements': ['needs', 'specs', 'criteria', 'demand'],
      'scenarios': ['use cases', 'stories', 'flows', 'journeys'],
      'architecture': ['design', 'structure', 'framework', 'pattern'],
      'technology': ['tech stack', 'tools', 'platform', 'framework'],
      'testing': ['tests', 'validation', 'qa', 'verification']
    };

    const sectionLower = section.toLowerCase();
    const requiredSynonyms = synonyms[required.toLowerCase()] || [];
    
    return requiredSynonyms.some(synonym => sectionLower.includes(synonym));
  }

}


class CompletenessAnalyzer {
  async analyze(content: string, phase: string): Promise<{ score: number; details: string[]; issues: string[] }> {
    const issues: string[] = [];
    const details: string[] = [];

    const phaseRequirements = this.getPhaseRequirements(phase);
    let totalScore = 0;
    let checkedItems = 0;

    for (const [category, requirements] of Object.entries(phaseRequirements)) {
      const categoryScore = this.checkCategoryCompleteness(content, requirements);
      totalScore += categoryScore;
      checkedItems++;
      
      details.push(`${category}: ${(categoryScore * 100).toFixed(0)}%`);
      
      if (categoryScore < 0.6) {
        issues.push(`${category} section is incomplete or missing key elements`);
      }
    }

    const score = checkedItems > 0 ? totalScore / checkedItems : 0;

    return { score, details, issues };
  }

  private getPhaseRequirements(phase: string) {
    const requirements = {
      'spec': {
        'User Definition': ['user type', 'stakeholder', 'persona', 'target audience'],
        'Functional Requirements': ['feature', 'functionality', 'capability', 'behavior'],
        'Success Criteria': ['metric', 'measurement', 'goal', 'objective', 'kpi'],
        'Constraints': ['limitation', 'constraint', 'boundary', 'restriction']
      },
      'plan': {
        'Architecture': ['architecture', 'pattern', 'design', 'structure'],
        'Technology Stack': ['technology', 'framework', 'library', 'tool', 'platform'],
        'Data Model': ['data', 'model', 'schema', 'entity', 'relationship'],
        'Integration': ['api', 'interface', 'integration', 'service', 'endpoint']
      },
      'tasks': {
        'Task Breakdown': ['task', 'subtask', 'activity', 'work item'],
        'Dependencies': ['dependency', 'prerequisite', 'requires', 'depends on'],
        'Testing Strategy': ['test', 'testing', 'validation', 'verification'],
        'Timeline': ['timeline', 'schedule', 'milestone', 'deadline']
      },
      'implement': {
        'Test Cases': ['test case', 'unit test', 'integration test', 'scenario'],
        'Implementation Guide': ['implementation', 'code', 'algorithm', 'logic'],
        'Examples': ['example', 'sample', 'demo', 'illustration'],
        'Integration': ['integration', 'deployment', 'configuration', 'setup']
      }
    };

    return requirements[phase as keyof typeof requirements] || {};
  }

  private checkCategoryCompleteness(content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    let found = 0;

    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        found++;
      }
    }

    return Math.min(found / keywords.length, 1.0);
  }
}

class AmbiguityDetector {
  private ambiguousPatterns = [
    /\b(some|many|few|several|various|often|usually|sometimes|might|could|should|may)\b/gi,
    /\b(appropriate|suitable|reasonable|adequate|sufficient|proper|good|bad|better|optimal)\b/gi,
    /\b(large|small|big|little|fast|slow|quick|simple|complex|easy|difficult)\b/gi,
    /\b(soon|later|eventually|frequently|regularly|occasionally|periodically)\b/gi,
    /\b(etc|and so on|among others|such as|including but not limited to)\b/gi
  ];

  private vaguePhrases = [
    'user-friendly', 'easy to use', 'intuitive', 'robust', 'scalable', 'flexible',
    'high performance', 'efficient', 'reliable', 'secure', 'maintainable'
  ];

  async analyze(content: string): Promise<{ score: number; details: string[]; issues: string[] }> {
    const issues: string[] = [];
    const details: string[] = [];

    let ambiguityCount = 0;
    let totalWords = content.split(/\s+/).length;

    // Check for ambiguous patterns
    for (const pattern of this.ambiguousPatterns) {
      const matches = content.match(pattern) || [];
      ambiguityCount += matches.length;
      
      if (matches.length > 0) {
        issues.push(`Found ${matches.length} ambiguous terms: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
      }
    }

    // Check for vague phrases
    const contentLower = content.toLowerCase();
    for (const phrase of this.vaguePhrases) {
      if (contentLower.includes(phrase)) {
        ambiguityCount++;
        issues.push(`Vague phrase detected: "${phrase}" - needs specific criteria`);
      }
    }

    // Calculate clarity score (inverse of ambiguity)
    const ambiguityRatio = ambiguityCount / Math.max(totalWords / 100, 1); // Per 100 words
    const clarityScore = Math.max(0, 1 - (ambiguityRatio / 10)); // Normalize

    details.push(`Ambiguous terms found: ${ambiguityCount}`);
    details.push(`Clarity ratio: ${(clarityScore * 100).toFixed(0)}%`);
    details.push(`Word count: ${totalWords}`);

    return {
      score: clarityScore,
      details,
      issues
    };
  }
}

class ConsistencyValidator {
  async analyze(content: string, _phase: string): Promise<{ score: number; details: string[]; issues: string[] }> {
    const issues: string[] = [];
    const details: string[] = [];

    let consistencyScore = 0;
    let checks = 0;

    // Terminology consistency
    const termScore = this.checkTerminologyConsistency(content);
    consistencyScore += termScore;
    checks++;
    
    details.push(`Terminology consistency: ${(termScore * 100).toFixed(0)}%`);
    if (termScore < 0.7) {
      issues.push('Inconsistent terminology usage detected');
    }

    // Format consistency
    const formatScore = this.checkFormatConsistency(content);
    consistencyScore += formatScore;
    checks++;
    
    details.push(`Format consistency: ${(formatScore * 100).toFixed(0)}%`);
    if (formatScore < 0.8) {
      issues.push('Inconsistent formatting or structure');
    }

    // Reference consistency
    const refScore = this.checkReferenceConsistency(content);
    consistencyScore += refScore;
    checks++;
    
    details.push(`Reference consistency: ${(refScore * 100).toFixed(0)}%`);
    if (refScore < 0.9) {
      issues.push('Inconsistent references or cross-links');
    }

    const finalScore = checks > 0 ? consistencyScore / checks : 0;

    return {
      score: finalScore,
      details,
      issues
    };
  }

  private checkTerminologyConsistency(content: string): number {
    // Simple heuristic: check for consistent use of key terms
    const keyTerms = this.extractKeyTerms(content);
    let consistencyScore = 1.0;

    for (const [_term, variants] of keyTerms.entries()) {
      if (variants.size > 1) {
        // Multiple variants found - potential inconsistency
        consistencyScore -= 0.1;
      }
    }

    return Math.max(consistencyScore, 0);
  }

  private checkFormatConsistency(content: string): number {
    // Check consistency in headers, lists, formatting
    const headers = content.match(/^#+\s/gm) || [];

    // Simple scoring based on format uniformity
    let score = 1.0;
    
    // Check header consistency
    const headerLevels = headers.map(h => h.match(/#/g)?.length || 0);
    if (headerLevels.length > 0) {
      const maxLevel = Math.max(...headerLevels);
      const minLevel = Math.min(...headerLevels);
      if (maxLevel - minLevel > 3) score -= 0.2; // Too many levels
    }

    return Math.max(score, 0);
  }

  private checkReferenceConsistency(content: string): number {
    // Check that all references are properly formatted and complete
    const references = content.match(/\[.*?\]/g) || [];
    let validRefs = 0;

    for (const ref of references) {
      // Simple check: reference should not be empty or contain only whitespace
      if (ref.length > 3 && ref.trim() !== '[]') {
        validRefs++;
      }
    }

    return references.length > 0 ? validRefs / references.length : 1.0;
  }

  private extractKeyTerms(content: string): Map<string, Set<string>> {
    // Extract potential key terms and their variants
    const terms = new Map<string, Set<string>>();
    
    // Simple implementation - would be more sophisticated in practice
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const commonWords = new Set(['user', 'system', 'application', 'service', 'data', 'function']);
    
    for (const word of words) {
      if (commonWords.has(word)) {
        if (!terms.has(word)) {
          terms.set(word, new Set());
        }
        terms.get(word)!.add(word);
      }
    }

    return terms;
  }
}
