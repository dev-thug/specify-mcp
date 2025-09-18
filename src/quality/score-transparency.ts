/**
 * Score Transparency Module
 * Provides detailed breakdown of quality scores with full transparency
 * Addresses: "품질 점수 기준 투명성 - 점수 산출 기준과 가중치 공개"
 */

export interface ScoreComponent {
  name: string;
  description: string;
  weight: number;      // 0-1 (percentage of total)
  rawScore: number;    // 0-100
  weightedScore: number; // rawScore * weight
  criteria: string[];  // What we're checking for
  findings: string[];  // What we found
  suggestions: string[]; // How to improve
}

export interface ScoreBreakdown {
  phase: string;
  totalScore: number;
  components: ScoreComponent[];
  explanation: string;
  confidence: number; // How confident the system is in this score
  timestamp: string;
}

export class ScoreTransparency {
  /**
   * Weight configurations for different phases
   */
  private readonly phaseWeights = {
    spec: {
      userDefinition: 0.25,      // 25% - WHO uses it and WHY
      problemStatement: 0.20,     // 20% - WHAT problem it solves
      requirements: 0.25,         // 25% - WHAT it does
      successCriteria: 0.15,      // 15% - HOW we measure success
      constraints: 0.10,          // 10% - Limitations and boundaries
      structure: 0.05            // 5% - Document organization
    },
    plan: {
      architecture: 0.30,         // 30% - HOW it's built
      technology: 0.20,           // 20% - Tech stack choices
      dataModel: 0.20,           // 20% - Data structures
      integration: 0.15,          // 15% - External connections
      security: 0.10,            // 10% - Security measures
      structure: 0.05            // 5% - Document organization
    },
    tasks: {
      breakdown: 0.30,            // 30% - Task granularity
      dependencies: 0.25,         // 25% - Task relationships
      estimation: 0.20,           // 20% - Time/effort estimates
      priorities: 0.15,           // 15% - Priority levels
      assignments: 0.05,          // 5% - Who does what
      structure: 0.05            // 5% - Document organization
    },
    implement: {
      testCases: 0.35,           // 35% - Test coverage
      tddGuide: 0.30,            // 30% - TDD approach
      codeStructure: 0.15,       // 15% - Implementation plan
      integration: 0.10,          // 10% - Integration tests
      documentation: 0.05,        // 5% - Code documentation
      structure: 0.05            // 5% - Document organization
    }
  };

  /**
   * Generate a complete score breakdown with transparency
   */
  generateBreakdown(
    phase: string,
    componentScores: Record<string, number>,
    findings: Record<string, string[]>
  ): ScoreBreakdown {
    const weights = this.getPhaseWeights(phase);
    const components: ScoreComponent[] = [];
    let totalWeightedScore = 0;

    // Process each component
    for (const [componentName, weight] of Object.entries(weights)) {
      const rawScore = componentScores[componentName] || 0;
      const weightedScore = rawScore * weight;
      totalWeightedScore += weightedScore;

      components.push({
        name: this.formatComponentName(componentName),
        description: this.getComponentDescription(phase, componentName),
        weight,
        rawScore,
        weightedScore,
        criteria: this.getComponentCriteria(phase, componentName),
        findings: findings[componentName] || [],
        suggestions: this.generateSuggestions(phase, componentName, rawScore)
      });
    }

    return {
      phase,
      totalScore: Math.round(totalWeightedScore),
      components,
      explanation: this.generateExplanation(phase, totalWeightedScore, components),
      confidence: this.calculateConfidence(components),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get phase-specific weights
   */
  private getPhaseWeights(phase: string): Record<string, number> {
    const weights = this.phaseWeights[phase as keyof typeof this.phaseWeights];
    return weights || this.phaseWeights.spec;
  }

  /**
   * Format component name for display
   */
  private formatComponentName(name: string): string {
    // Convert camelCase to Title Case
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get component description
   */
  private getComponentDescription(phase: string, component: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      spec: {
        userDefinition: 'Defines WHO will use the system and their characteristics',
        problemStatement: 'Explains WHAT problem the system solves',
        requirements: 'Lists WHAT the system must do (functional requirements)',
        successCriteria: 'Defines HOW we measure if the system is successful',
        constraints: 'Identifies limitations and boundaries',
        structure: 'Overall document organization and clarity'
      },
      plan: {
        architecture: 'System architecture and design patterns',
        technology: 'Technology stack selection and justification',
        dataModel: 'Data structures and database design',
        integration: 'External services and API integrations',
        security: 'Security measures and considerations',
        structure: 'Technical document organization'
      },
      tasks: {
        breakdown: 'How well tasks are broken down into manageable pieces',
        dependencies: 'Task relationships and sequencing',
        estimation: 'Time and effort estimates for tasks',
        priorities: 'Priority levels and critical path identification',
        assignments: 'Resource allocation and responsibility assignment',
        structure: 'Task organization and clarity'
      },
      implement: {
        testCases: 'Comprehensive test scenario coverage',
        tddGuide: 'Test-driven development approach and guidance',
        codeStructure: 'Implementation plan and code organization',
        integration: 'Integration test planning',
        documentation: 'Code documentation requirements',
        structure: 'Implementation guide organization'
      }
    };

    return descriptions[phase]?.[component] || 'Component evaluation';
  }

  /**
   * Get evaluation criteria for each component
   */
  private getComponentCriteria(phase: string, component: string): string[] {
    const criteria: Record<string, Record<string, string[]>> = {
      spec: {
        userDefinition: [
          'Clear identification of user types/roles',
          'User goals and motivations described',
          'Technical expertise level specified',
          'User journey or workflow outlined'
        ],
        problemStatement: [
          'Problem clearly defined',
          'Impact of problem quantified',
          'Current pain points listed',
          'Value proposition stated'
        ],
        requirements: [
          'Functional requirements listed',
          'Requirements are specific and measurable',
          'Priority levels assigned',
          'Acceptance criteria defined'
        ],
        successCriteria: [
          'Quantifiable metrics defined',
          'Baseline measurements provided',
          'Target goals specified',
          'Evaluation timeline set'
        ]
      },
      plan: {
        architecture: [
          'System components identified',
          'Component interactions defined',
          'Design patterns specified',
          'Scalability considerations'
        ],
        technology: [
          'Tech stack justified',
          'Version compatibility checked',
          'Dependencies listed',
          'Alternative options considered'
        ]
      }
      // Add more criteria for other phases as needed
    };

    return criteria[phase]?.[component] || ['General quality criteria'];
  }

  /**
   * Generate improvement suggestions based on score
   */
  private generateSuggestions(phase: string, component: string, score: number): string[] {
    if (score >= 80) {
      return ['Excellent! Consider adding advanced examples or edge cases'];
    }

    const suggestions: string[] = [];
    
    if (score < 30) {
      suggestions.push(`This section needs significant expansion`);
      suggestions.push(`Add concrete details and specific examples`);
    } else if (score < 60) {
      suggestions.push(`Add more detail to strengthen this section`);
      suggestions.push(`Include specific metrics or acceptance criteria`);
    } else {
      suggestions.push(`Good foundation - add examples for clarity`);
    }

    // Component-specific suggestions
    if (phase === 'spec' && component === 'userDefinition' && score < 70) {
      suggestions.push('Add user personas with specific roles and goals');
    }
    if (phase === 'spec' && component === 'requirements' && score < 70) {
      suggestions.push('Make requirements more specific and measurable');
    }

    return suggestions;
  }

  /**
   * Generate human-readable explanation of the score
   */
  private generateExplanation(phase: string, totalScore: number, components: ScoreComponent[]): string {
    const weakComponents = components.filter(c => c.rawScore < 50);
    const strongComponents = components.filter(c => c.rawScore >= 80);

    let explanation = `📊 **Quality Score: ${Math.round(totalScore)}/100**\n\n`;
    
    if (totalScore >= 80) {
      explanation += `✅ Excellent ${phase} document! Well-structured with comprehensive details.\n\n`;
    } else if (totalScore >= 60) {
      explanation += `📈 Good ${phase} document with room for improvement.\n\n`;
    } else if (totalScore >= 40) {
      explanation += `⚠️ ${phase} document needs significant improvements.\n\n`;
    } else {
      explanation += `❌ ${phase} document requires major revision.\n\n`;
    }

    // Highlight strengths
    if (strongComponents.length > 0) {
      explanation += `**Strengths:**\n`;
      strongComponents.forEach(c => {
        explanation += `• ${c.name} (${Math.round(c.rawScore)}/100) - Well documented\n`;
      });
      explanation += '\n';
    }

    // Highlight weaknesses
    if (weakComponents.length > 0) {
      explanation += `**Areas for Improvement:**\n`;
      weakComponents.forEach(c => {
        explanation += `• ${c.name} (${Math.round(c.rawScore)}/100) - Needs expansion\n`;
      });
      explanation += '\n';
    }

    // Weight breakdown explanation
    explanation += `**Scoring Breakdown:**\n`;
    components.forEach(c => {
      const percentage = Math.round(c.weight * 100);
      const contribution = Math.round(c.weightedScore);
      explanation += `• ${c.name}: ${percentage}% weight × ${Math.round(c.rawScore)} score = ${contribution} points\n`;
    });

    return explanation;
  }

  /**
   * Calculate confidence in the score
   */
  private calculateConfidence(components: ScoreComponent[]): number {
    // Higher confidence when more components have findings
    const componentsWithFindings = components.filter(c => c.findings.length > 0).length;
    const confidenceRatio = componentsWithFindings / components.length;
    
    // Scale to 0-100
    return Math.round(confidenceRatio * 100);
  }

  /**
   * Generate a visual score card
   */
  generateScoreCard(breakdown: ScoreBreakdown): string {
    let card = '┌─────────────────────────────────────────┐\n';
    card += `│        ${breakdown.phase.toUpperCase()} QUALITY SCORE CARD        │\n`;
    card += '├─────────────────────────────────────────┤\n';
    card += `│ Total Score: ${breakdown.totalScore}/100                   │\n`;
    card += `│ Confidence: ${breakdown.confidence}%                      │\n`;
    card += '├─────────────────────────────────────────┤\n';
    
    breakdown.components.forEach(c => {
      const bar = this.generateProgressBar(c.rawScore);
      const weightStr = `${Math.round(c.weight * 100)}%`;
      card += `│ ${c.name.padEnd(20)} ${weightStr.padStart(4)} │\n`;
      card += `│ ${bar} ${Math.round(c.rawScore).toString().padStart(3)}/100 │\n`;
    });
    
    card += '└─────────────────────────────────────────┘\n';
    
    return card;
  }

  /**
   * Generate a visual progress bar
   */
  private generateProgressBar(score: number, width: number = 20): string {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

// Export singleton instance
export const scoreTransparency = new ScoreTransparency();
