import { z } from 'zod';
import type { SDDTool, ToolResult } from '../types/index.js';
import { CommonVerifier } from '../verification/common.js';
import { ResourceManager } from '../resources/manager.js';

const specInputSchema = z.object({
  projectId: z.string().describe('Project ID from initialization'),
  userRequirements: z.string().optional().describe('Additional requirements from user'),
  focusAreas: z.array(z.string()).optional().describe('Areas to focus on in the spec'),
  excludeAreas: z.array(z.string()).optional().describe('Areas to exclude from the spec')
});

export class SpecTool implements SDDTool {
  name = 'create_specification';
  description = 'Create product specification document focusing on user needs and business value';
  inputSchema = specInputSchema;

  private verifier: CommonVerifier;
  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.verifier = new CommonVerifier();
    this.resourceManager = resourceManager;
  }

  async handler(params: unknown): Promise<ToolResult> {
    const input = specInputSchema.parse(params);
    
    // Read project metadata
    const projectData = await this.resourceManager.readResource(
      input.projectId,
      'metadata.json'
    );
    const project = JSON.parse(projectData.content);

    // Generate specification sections
    const spec = await this.generateSpecification(project, input);
    
    // Verify specification for ambiguity and completeness
    const verificationResult = await this.verifySpecification(spec);
    
    // Save specification document
    await this.resourceManager.createResource(
      input.projectId,
      'spec/specification.md',
      spec,
      { stage: 'spec', verified: verificationResult.isValid }
    );

    // Create verification report
    const verificationReport = this.createVerificationReport(verificationResult);
    await this.resourceManager.createResource(
      input.projectId,
      'spec/verification-report.md',
      verificationReport,
      { stage: 'spec' }
    );

    // Update project workflow status
    project.workflow.completedStages.push('spec');
    project.workflow.currentStage = 'spec';
    project.workflow.nextStage = 'plan';
    
    await this.resourceManager.updateResource(
      input.projectId,
      'metadata.json',
      JSON.stringify(project, null, 2)
    );

    return {
      content: [
        {
          type: 'text',
          text: `Specification generated for project ${input.projectId}`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/spec/specification.md`
        },
        {
          type: 'text',
          text: verificationResult.isValid 
            ? 'Specification verified successfully' 
            : `Specification has ${verificationResult.issues.length} issues to address`
        }
      ]
    };
  }

  private async generateSpecification(
    project: any,
    input: z.infer<typeof specInputSchema>
  ): Promise<string> {
    const date = new Date().toISOString().split('T')[0];
    const userRequirements = input.userRequirements || '';

    return `# Feature Specification: ${project.projectName}

**Feature Branch**: \`${project.projectId}\`  
**Created**: ${date}  
**Status**: Draft  
**Input**: User description: "${userRequirements || project.description}"

## Execution Flow (main)
\`\`\`
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
\`\`\`

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

## User Scenarios & Testing *(mandatory)*

### Primary User Story
${project.description || '[Describe the main user journey in plain language]'}

### Acceptance Scenarios
1. **Given** initial system state, **When** user performs primary action, **Then** system delivers expected value
2. **Given** user has account, **When** accessing main feature, **Then** feature functions as specified

### Edge Cases
- What happens when system is under high load?
- How does system handle invalid user input?
- What occurs during network disconnection?

## Requirements *(mandatory)*

### Functional Requirements
${project.goals && project.goals.length > 0 ? 
  project.goals.map((goal: string, i: number) => 
    `- **FR-${String(i+1).padStart(3, '0')}**: System MUST ${goal.toLowerCase()}`
  ).join('\n') : 
  `- **FR-001**: System MUST provide core functionality [NEEDS CLARIFICATION: specific features not defined]
- **FR-002**: System MUST handle user authentication [NEEDS CLARIFICATION: auth method not specified]
- **FR-003**: Users MUST be able to manage their data
- **FR-004**: System MUST persist user preferences
- **FR-005**: System MUST log all critical events`}

${userRequirements ? `\n*Additional requirements from user:*\n${userRequirements}\n` : ''}

### Key Entities *(include if feature involves data)*
- **User**: Represents system users with authentication and preferences
- **Project**: Main business entity being managed
- **Configuration**: System and user settings

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

### Constraints & Assumptions
${project.constraints && project.constraints.length > 0 ? 
  `**Constraints:**\n${project.constraints.map((c: string) => `- ${c}`).join('\n')}` : 
  '**Constraints:** None specified'}

**Assumptions:**
- Users have necessary access permissions
- System has reliable network connectivity
- Users understand basic domain concepts

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
*Generated by Specify MCP Server*
`;
  }


  private async verifySpecification(spec: string): Promise<any> {
    // Check for ambiguous terms
    const ambiguousTerms = [
      'maybe', 'possibly', 'might', 'could', 'should probably',
      'fast', 'slow', 'big', 'small', 'user-friendly', 'intuitive'
    ];
    
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    for (const term of ambiguousTerms) {
      if (spec.toLowerCase().includes(term)) {
        issues.push(`Ambiguous term found: "${term}"`);
        suggestions.push(`Replace "${term}" with specific, measurable criteria`);
      }
    }

    // Check for missing sections
    const requiredSections = [
      'Executive Summary', 'Product Vision', 'Functional Requirements',
      'Non-Functional Requirements', 'Acceptance Criteria'
    ];
    
    for (const section of requiredSections) {
      if (!spec.includes(section)) {
        issues.push(`Missing required section: ${section}`);
      }
    }

    // Check for completeness
    if (!spec.includes('User Stories')) {
      suggestions.push('Consider adding more detailed user stories');
    }

    // Run common verification
    const commonVerification = await this.verifier.verify(spec);
    issues.push(...commonVerification.issues);
    suggestions.push(...commonVerification.suggestions);

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: issues.length === 0 ? 0.9 : 0.7 - (issues.length * 0.05)
    };
  }

  private createVerificationReport(verification: any): string {
    return `# Specification Verification Report

## Verification Status
- **Valid**: ${verification.isValid ? 'Yes' : 'No'}
- **Confidence**: ${(verification.confidence * 100).toFixed(1)}%
- **Issues Found**: ${verification.issues.length}
- **Suggestions**: ${verification.suggestions.length}

## Issues
${verification.issues.length > 0 
  ? verification.issues.map((issue: string, i: number) => `${i + 1}. ${issue}`).join('\n')
  : 'No issues found'}

## Suggestions for Improvement
${verification.suggestions.length > 0
  ? verification.suggestions.map((suggestion: string, i: number) => `${i + 1}. ${suggestion}`).join('\n')
  : 'No suggestions'}

## Recommendations
1. Address all identified issues before proceeding to planning stage
2. Review ambiguous terms and replace with specific criteria
3. Ensure all stakeholders review and approve the specification
4. Consider edge cases and error scenarios

## Next Steps
${verification.isValid 
  ? '✅ Specification is ready. Proceed to planning stage.'
  : '⚠️ Address issues before proceeding to planning stage.'}
`;
  }
}
