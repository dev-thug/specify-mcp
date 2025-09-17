/**
 * Spec tool for generating Product Requirements Document (PRD)
 * Focuses on WHAT and WHY, excludes technical details
 */

import fs from 'fs-extra';
import * as path from 'path';
import { ResourceManager } from '../resources/manager.js';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext } from '../types/index.js';

export interface SpecToolParams {
  projectId: string;
  userInput: string;
  refine?: boolean;
}

export class SpecTool {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: SpecToolParams): Promise<string> {
    const { projectId, userInput, refine = false } = params;

    // Load existing spec if refining
    let existingContent = '';
    let previousVersions: string[] = [];

    if (refine) {
      try {
        const existing = await this.resourceManager.readResource(
          `specify://project/${projectId}/spec/current`
        );
        existingContent = existing.text || '';
        previousVersions = [existingContent];
      } catch {
        // No existing spec, proceed with new
      }
    }

    // Load template
    const templatePath = path.join(process.cwd(), 'templates', 'spec-template.md');
    let template = '';
    
    try {
      template = await fs.readFile(templatePath, 'utf-8');
    } catch {
      template = this.getDefaultTemplate();
    }

    // Generate specification
    const specification = this.generateSpecification(
      userInput,
      template,
      existingContent
    );

    // Verify specification
    const verificationContext: IVerificationContext = {
      phase: 'spec',
      content: specification,
      previousVersions,
    };

    const validationResults = await this.verifier.verify(verificationContext);
    const confidence = this.verifier.calculateConfidence(validationResults);

    // Save specification
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/spec/current`,
      specification
    );

    // Generate response
    const errors = validationResults.filter(r => r.type === 'error');
    const warnings = validationResults.filter(r => r.type === 'warning');

    let response = `Specification ${refine ? 'refined' : 'created'} successfully!\n`;
    response += `Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;

    if (errors.length > 0) {
      response += '⚠️ ERRORS (must fix):\n';
      errors.forEach(e => {
        response += `- ${e.message}\n  Suggestion: ${e.suggestion}\n`;
      });
      response += '\n';
    }

    if (warnings.length > 0) {
      response += '⚡ WARNINGS:\n';
      warnings.forEach(w => {
        response += `- ${w.message}\n`;
      });
      response += '\n';
    }

    const clarifications = (specification.match(/\[NEEDS CLARIFICATION[^\]]*\]/g) || []).length;
    if (clarifications > 0) {
      response += `📝 ${clarifications} areas need clarification. Please refine the specification.\n`;
    }

    response += '\nNext step: Use `sdd_plan` to create technical implementation plan.';

    return response;
  }

  private generateSpecification(
    userInput: string,
    template: string,
    existingContent: string
  ): string {
    const timestamp = new Date().toISOString();
    
    // Extract key concepts from user input
    const concepts = this.extractConcepts(userInput);
    
    // If refining, merge with existing content
    if (existingContent) {
      return this.refineSpecification(existingContent, userInput, concepts);
    }

    // Generate new specification from template
    let spec = template;
    
    // Replace placeholders
    spec = spec.replace('[FEATURE NAME]', concepts.featureName || 'Untitled Feature');
    const dateString = timestamp.split('T')[0];
    if (dateString) {
      spec = spec.replace('[DATE]', dateString);
    }
    spec = spec.replace('$ARGUMENTS', userInput);
    
    // Fill in sections based on extracted concepts
    spec = this.fillUserScenarios(spec, concepts);
    spec = this.fillRequirements(spec, concepts);
    spec = this.fillEntities(spec, concepts);
    spec = this.markAmbiguities(spec, concepts);

    return spec;
  }

  private extractConcepts(userInput: string): any {
    const concepts = {
      featureName: '',
      actors: [] as string[],
      actions: [] as string[],
      data: [] as string[],
      constraints: [] as string[],
    };

    // Simple extraction logic (can be enhanced with NLP)
    const lines = userInput.split(/[.!?]+/);
    
    // Extract potential actors (words before verbs)
    const actorPattern = /\b(user|admin|customer|client|manager|system|api)\b/gi;
    const actorMatches = userInput.match(actorPattern) || [];
    concepts.actors = [...new Set(actorMatches.map(a => a.toLowerCase()))];

    // Extract actions (verbs)
    const actionPattern = /\b(create|read|update|delete|submit|approve|reject|view|edit|manage|upload|download|search|filter|login|logout|register)\b/gi;
    const actionMatches = userInput.match(actionPattern) || [];
    concepts.actions = [...new Set(actionMatches.map(a => a.toLowerCase()))];

    // Extract data entities
    const dataPattern = /\b(data|record|document|file|profile|account|order|product|item|list|report|dashboard)\b/gi;
    const dataMatches = userInput.match(dataPattern) || [];
    concepts.data = [...new Set(dataMatches.map(d => d.toLowerCase()))];

    // Generate feature name from first significant noun phrase
    const firstLine = lines[0] || '';
    concepts.featureName = firstLine.substring(0, 50).trim() || 'Feature';

    return concepts;
  }

  private fillUserScenarios(spec: string, concepts: any): string {
    const { actors, actions } = concepts;
    
    if (actors.length === 0 || actions.length === 0) {
      return spec.replace(
        '[Describe the main user journey in plain language]',
        '[NEEDS CLARIFICATION: Please describe the main user journey and key scenarios]'
      );
    }

    const primaryActor = actors[0];
    const primaryAction = actions[0];
    
    const userStory = `As a ${primaryActor}, I want to ${primaryAction} so that [NEEDS CLARIFICATION: business value]`;
    
    return spec.replace(
      '[Describe the main user journey in plain language]',
      userStory
    );
  }

  private fillRequirements(spec: string, concepts: any): string {
    const { actions, actors } = concepts;
    const requirements: string[] = [];

    // Generate requirements based on concepts
    if (actors.includes('user')) {
      requirements.push('System MUST authenticate users before allowing access');
      requirements.push('System MUST maintain user sessions securely');
    }

    actions.forEach((action: string) => {
      if (action === 'create') {
        requirements.push(`System MUST validate input data before creating records`);
      }
      if (action === 'delete') {
        requirements.push(`System MUST require confirmation before deletion`);
      }
      if (action === 'search') {
        requirements.push(`System MUST provide search functionality with filters`);
      }
    });

    if (requirements.length === 0) {
      requirements.push('[NEEDS CLARIFICATION: Define specific functional requirements]');
    }

    // Replace in template
    const reqSection = requirements.map((req, idx) => 
      `- **FR-${String(idx + 1).padStart(3, '0')}**: ${req}`
    ).join('\n');

    return spec.replace(
      /- \*\*FR-001\*\*: System MUST.*\n.*\n.*\n.*\n.*\n/,
      reqSection + '\n'
    );
  }

  private fillEntities(spec: string, concepts: any): string {
    const { data } = concepts;
    
    if (data.length === 0) {
      return spec;
    }

    const entities = concepts.data.map((entity: string) => 
      `- **${entity.charAt(0).toUpperCase() + entity.slice(1)}**: [NEEDS CLARIFICATION: Define attributes and relationships]`
    ).join('\n');

    return spec.replace(
      /- \*\*\[Entity 1\]\*\*:.*\n- \*\*\[Entity 2\]\*\*:.*/,
      entities
    );
  }

  private markAmbiguities(spec: string, _concepts: any): string {
    // Mark areas that need clarification
    const ambiguousTerms = [
      'fast', 'slow', 'good', 'bad', 'user-friendly', 'intuitive',
      'scalable', 'reliable', 'secure', 'efficient'
    ];

    let marked = spec;
    ambiguousTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      marked = marked.replace(regex, `${term} [NEEDS CLARIFICATION: Define specific metrics]`);
    });

    return marked;
  }

  private refineSpecification(
    existing: string,
    userInput: string,
    concepts: any
  ): string {
    // Add refinement note
    const refinementNote = `
## Refinement History
**Date**: ${new Date().toISOString()}
**Input**: ${userInput}
**Changes**: Updated based on additional requirements

---

`;

    // Merge new concepts with existing
    let refined = existing;
    
    // Remove old NEEDS CLARIFICATION markers that are addressed
    const clarifications = userInput.match(/clarify|specify|define|explain/gi);
    if (clarifications) {
      // Simple replacement of some markers
      refined = refined.replace(
        /\[NEEDS CLARIFICATION:[^\]]*\]/,
        userInput.substring(0, 100)
      );
    }

    // Add new requirements if mentioned
    if (concepts.actions.length > 0) {
      const reqSection = refined.match(/### Functional Requirements[\s\S]*?(?=###|$)/);
      if (reqSection) {
        const newReqs = concepts.actions.map((action: string, idx: number) => 
          `- **FR-NEW-${idx + 1}**: System MUST ${action} [Refined requirement]`
        ).join('\n');
        
        refined = refined.replace(
          '### Functional Requirements',
          `### Functional Requirements\n${newReqs}\n`
        );
      }
    }

    return refinementNote + refined;
  }

  private getDefaultTemplate(): string {
    // Fallback template if file not found
    return `# Feature Specification: [FEATURE NAME]

**Created**: [DATE]
**Status**: Draft
**Input**: "$ARGUMENTS"

## User Scenarios & Testing

### Primary User Story
[Describe the main user journey in plain language]

### Acceptance Scenarios
1. **Given** [initial state], **When** [action], **Then** [expected outcome]

## Requirements

### Functional Requirements
- **FR-001**: System MUST [requirement]

### Key Entities
- **[Entity 1]**: [Description]

## Review Checklist
- [ ] No implementation details
- [ ] Requirements are testable
- [ ] All scenarios covered`;
  }
}
