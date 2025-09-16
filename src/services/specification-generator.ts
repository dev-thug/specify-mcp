/**
 * Service for generating software specifications with formal ACSL translation
 */

import type { 
  Specification, 
  Requirement, 
  FormalSpecification,
  AmbiguityResolution 
} from '../types/index.js';
import { SPECIFICATION_LEVEL } from '../constants/index.js';

export class SpecificationGenerator {
  /**
   * Generate specification from resolved intent
   */
  async generate(
    resolution: AmbiguityResolution,
    level: keyof typeof SPECIFICATION_LEVEL = 'DETAILED',
    includeFormSpec = true
  ): Promise<Specification> {
    const functionalRequirements = this.extractFunctionalRequirements(resolution);
    const nonFunctionalRequirements = this.extractNonFunctionalRequirements(resolution);
    const formalSpec = includeFormSpec ? this.generateFormalSpec(functionalRequirements) : undefined;

    return {
      id: this.generateId(),
      title: this.extractTitle(resolution.resolvedIntent),
      description: resolution.resolvedIntent,
      functionalRequirements: this.enrichRequirements(functionalRequirements, level),
      nonFunctionalRequirements: this.enrichRequirements(nonFunctionalRequirements, level),
      formalSpec,
      version: '1.0.0',
      status: 'draft',
    };
  }

  /**
   * Extract functional requirements from resolved intent
   */
  private extractFunctionalRequirements(resolution: AmbiguityResolution): Requirement[] {
    const requirements: Requirement[] = [];
    const intent = resolution.resolvedIntent.toLowerCase();

    // Extract action-based requirements
    const actionPatterns = [
      { pattern: /create\s+(\w+)/g, template: 'System shall create $1' },
      { pattern: /update\s+(\w+)/g, template: 'System shall update $1' },
      { pattern: /delete\s+(\w+)/g, template: 'System shall delete $1' },
      { pattern: /display\s+(\w+)/g, template: 'System shall display $1' },
      { pattern: /process\s+(\w+)/g, template: 'System shall process $1' },
      { pattern: /authenticate\s+(\w+)/g, template: 'System shall authenticate $1' },
      { pattern: /validate\s+(\w+)/g, template: 'System shall validate $1' },
    ];

    actionPatterns.forEach(({ pattern, template }, index) => {
      const matches = Array.from(intent.matchAll(pattern));
      matches.forEach((match, subIndex) => {
        requirements.push({
          id: `FR-${index + 1}.${subIndex + 1}`,
          description: template.replace('$1', match[1]),
          priority: 'high',
          acceptance: this.generateAcceptanceCriteria(template, match[1]),
          dependencies: [],
        });
      });
    });

    // Add default requirements if none found
    if (requirements.length === 0) {
      requirements.push({
        id: 'FR-1',
        description: 'System shall provide core functionality as specified',
        priority: 'high',
        acceptance: ['Functionality is implemented', 'Tests pass'],
        dependencies: [],
      });
    }

    return requirements;
  }

  /**
   * Extract non-functional requirements
   */
  private extractNonFunctionalRequirements(resolution: AmbiguityResolution): Requirement[] {
    const requirements: Requirement[] = [];

    // Performance requirements
    if (resolution.resolvedIntent.includes('response time')) {
      requirements.push({
        id: 'NFR-1',
        description: 'System shall respond within specified time limits',
        priority: 'high',
        acceptance: ['95% of requests complete within 200ms', '99% within 1s'],
        dependencies: [],
      });
    }

    // Security requirements
    requirements.push({
      id: 'NFR-2',
      description: 'System shall implement secure authentication',
      priority: 'high',
      acceptance: ['JWT or OAuth2 authentication', 'Encrypted passwords', 'Session management'],
      dependencies: [],
    });

    // Scalability requirements
    requirements.push({
      id: 'NFR-3',
      description: 'System shall handle concurrent users',
      priority: 'medium',
      acceptance: ['Support 100+ concurrent users', 'Horizontal scaling capability'],
      dependencies: [],
    });

    // Maintainability requirements
    requirements.push({
      id: 'NFR-4',
      description: 'System shall follow clean code principles',
      priority: 'medium',
      acceptance: ['Code coverage > 80%', 'Documentation complete', 'Modular architecture'],
      dependencies: [],
    });

    return requirements;
  }

  /**
   * Generate formal specification
   */
  private generateFormalSpec(requirements: Requirement[]): FormalSpecification {
    const preconditions: string[] = [];
    const postconditions: string[] = [];
    const invariants: string[] = [];

    requirements.forEach(req => {
      // Extract preconditions
      if (req.description.includes('authenticate')) {
        preconditions.push('requires valid_user(user)');
      }
      if (req.description.includes('create')) {
        preconditions.push('requires !exists(entity)');
      }
      if (req.description.includes('update') || req.description.includes('delete')) {
        preconditions.push('requires exists(entity)');
      }

      // Extract postconditions
      if (req.description.includes('create')) {
        postconditions.push('ensures exists(entity)');
      }
      if (req.description.includes('delete')) {
        postconditions.push('ensures !exists(entity)');
      }
      if (req.description.includes('update')) {
        postconditions.push('ensures entity.updated == true');
      }
    });

    // Add invariants
    invariants.push('invariant database_connection_valid()');
    invariants.push('invariant user_session_timeout < 3600');
    invariants.push('invariant 0 <= response_time <= 1000');

    // Generate ACSL specification
    const acslSpec = this.generateACSL(preconditions, postconditions, invariants);

    return {
      preconditions,
      postconditions,
      invariants,
      acslSpec,
    };
  }

  /**
   * Generate ACSL specification
   */
  private generateACSL(
    preconditions: string[],
    postconditions: string[],
    invariants: string[]
  ): string {
    let acsl = '/*@\n';
    
    preconditions.forEach(pre => {
      acsl += `  ${pre};\n`;
    });
    
    postconditions.forEach(post => {
      acsl += `  ${post};\n`;
    });
    
    invariants.forEach(inv => {
      acsl += `  ${inv};\n`;
    });
    
    acsl += '*/';
    
    return acsl;
  }

  /**
   * Enrich requirements based on specification level
   */
  private enrichRequirements(
    requirements: Requirement[],
    level: keyof typeof SPECIFICATION_LEVEL
  ): Requirement[] {
    switch (level) {
      case 'COMPREHENSIVE':
        return requirements.map(req => ({
          ...req,
          acceptance: [...req.acceptance, 'Edge cases handled', 'Error scenarios covered'],
          dependencies: this.inferDependencies(req, requirements),
        }));
      
      case 'DETAILED':
        return requirements.map(req => ({
          ...req,
          acceptance: [...req.acceptance, 'Unit tests pass'],
        }));
      
      default:
        return requirements;
    }
  }

  /**
   * Generate acceptance criteria
   */
  private generateAcceptanceCriteria(template: string, entity: string): string[] {
    const criteria: string[] = [];
    
    if (template.includes('create')) {
      criteria.push(`${entity} is successfully created`);
      criteria.push(`${entity} data is validated`);
      criteria.push(`${entity} is persisted to database`);
    } else if (template.includes('update')) {
      criteria.push(`${entity} exists before update`);
      criteria.push(`${entity} is successfully updated`);
      criteria.push('Update timestamp is recorded');
    } else if (template.includes('delete')) {
      criteria.push(`${entity} exists before deletion`);
      criteria.push(`${entity} is successfully deleted`);
      criteria.push('Related data is handled appropriately');
    } else {
      criteria.push('Operation completes successfully');
      criteria.push('Expected output is produced');
    }
    
    return criteria;
  }

  /**
   * Infer dependencies between requirements
   */
  private inferDependencies(
    requirement: Requirement,
    allRequirements: Requirement[]
  ): string[] {
    const dependencies: string[] = [];
    
    // Authentication dependencies
    if (requirement.description.includes('update') || 
        requirement.description.includes('delete')) {
      const authReq = allRequirements.find(r => r.description.includes('authenticate'));
      if (authReq) {
        dependencies.push(authReq.id);
      }
    }
    
    // Create before update/delete
    if (requirement.description.includes('update') || 
        requirement.description.includes('delete')) {
      const createReq = allRequirements.find(r => 
        r.description.includes('create') && 
        r.id !== requirement.id
      );
      if (createReq) {
        dependencies.push(createReq.id);
      }
    }
    
    return dependencies;
  }

  /**
   * Extract title from intent
   */
  private extractTitle(intent: string): string {
    const firstLine = intent.split('\n')[0];
    return firstLine.length > 50 
      ? firstLine.substring(0, 47) + '...'
      : firstLine;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
