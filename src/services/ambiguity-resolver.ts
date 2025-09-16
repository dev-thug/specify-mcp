/**
 * Service for resolving ambiguities in user requirements using NLP
 */

import type { AmbiguityResolution } from '../types/index.js';

export class AmbiguityResolver {
  /**
   * Resolve ambiguities in user intent
   */
  async resolve(
    userIntent: string,
    domain?: string,
    constraints?: string[],
    context?: Record<string, unknown>
  ): Promise<AmbiguityResolution> {
    const clarifications = this.extractClarifications(userIntent, context);
    const assumptions = this.generateAssumptions(userIntent, domain);
    const resolvedIntent = this.clarifyIntent(userIntent, clarifications, assumptions);

    return {
      originalIntent: userIntent,
      resolvedIntent,
      clarifications,
      assumptions,
      constraints: constraints || [],
    };
  }

  /**
   * Extract clarifications from user intent
   */
  private extractClarifications(
    intent: string,
    context?: Record<string, unknown>
  ): string[] {
    const clarifications: string[] = [];
    
    // Check for vague terms
    const vagueTerms = ['some', 'many', 'few', 'fast', 'slow', 'good', 'bad'];
    const intentLower = intent.toLowerCase();
    
    vagueTerms.forEach(term => {
      if (intentLower.includes(term)) {
        clarifications.push(`Define specific metrics for "${term}"`);
      }
    });

    // Check for missing scope
    if (!intentLower.includes('user') && !intentLower.includes('system')) {
      clarifications.push('Specify target users or system boundaries');
    }

    // Check for missing non-functional requirements
    if (!intentLower.includes('performance') && !intentLower.includes('security')) {
      clarifications.push('Consider performance and security requirements');
    }

    // Context-based clarifications
    if (context?.projectType === 'existing') {
      clarifications.push('Consider compatibility with existing codebase');
    }

    return clarifications;
  }

  /**
   * Generate assumptions based on domain
   */
  private generateAssumptions(intent: string, domain?: string): string[] {
    const assumptions: string[] = [];
    
    // Domain-specific assumptions
    switch (domain) {
      case 'web':
        assumptions.push('Application will be accessed via web browsers');
        assumptions.push('Responsive design for mobile and desktop');
        assumptions.push('Modern browser compatibility (Chrome, Firefox, Safari, Edge)');
        break;
      case 'mobile':
        assumptions.push('Native mobile application development');
        assumptions.push('Support for iOS and Android platforms');
        assumptions.push('Offline capability considerations');
        break;
      case 'api':
        assumptions.push('RESTful API design principles');
        assumptions.push('JSON data format for requests/responses');
        assumptions.push('Authentication and authorization required');
        break;
      default:
        assumptions.push('Standard software development practices apply');
    }

    // General assumptions
    if (intent.toLowerCase().includes('database')) {
      assumptions.push('Relational database unless NoSQL explicitly required');
    }
    
    if (intent.toLowerCase().includes('user')) {
      assumptions.push('User authentication and session management required');
    }

    return assumptions;
  }

  /**
   * Clarify intent with resolved ambiguities
   */
  private clarifyIntent(
    originalIntent: string,
    clarifications: string[],
    assumptions: string[]
  ): string {
    let resolved = originalIntent;

    // Add quantifiable metrics
    resolved = resolved.replace(/fast/gi, 'with response time < 200ms');
    resolved = resolved.replace(/many/gi, 'up to 10,000');
    resolved = resolved.replace(/secure/gi, 'with industry-standard security practices');

    // Append clarifications and assumptions
    if (clarifications.length > 0) {
      resolved += '\n\nClarifications needed:\n';
      resolved += clarifications.map(c => `- ${c}`).join('\n');
    }

    if (assumptions.length > 0) {
      resolved += '\n\nAssumptions:\n';
      resolved += assumptions.map(a => `- ${a}`).join('\n');
    }

    return resolved;
  }
}
