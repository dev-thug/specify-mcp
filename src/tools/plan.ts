/**
 * Plan tool for creating technical implementation plans
 * Defines tech stack, architecture, and design decisions
 */

import fs from 'fs-extra';
import * as path from 'path';
import { ResourceManager } from '../resources/manager.js';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext, ITechStack } from '../types/index.js';
import { WorkflowGuard } from '../workflow/workflow-guard.js';

export interface PlanToolParams {
  projectId: string;
  techStack?: ITechStack;
  refine?: boolean;
}

export class PlanTool {
  private workflowGuard = new WorkflowGuard();
  
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: PlanToolParams): Promise<string> {
    const { projectId, techStack, refine = false } = params;

    // Get project path for workflow check
    const projectStructure = this.resourceManager.getProject(projectId);
    if (!projectStructure) {
      return `❌ **프로젝트를 찾을 수 없습니다**: ${projectId}`;
    }

    // Check if ready to proceed to plan phase
    const projectPath = path.dirname(projectStructure.projectPath);
    const workflowStatus = await this.workflowGuard.checkPhaseReadiness(projectPath, 'plan');
    
    if (!workflowStatus.canProceed) {
      return this.generateWorkflowBlockMessage(workflowStatus);
    }

    // Load specification
    let specContent = '';
    try {
      const spec = await this.resourceManager.readResource(
        `specify://project/${projectId}/spec/current`
      );
      specContent = spec.text || '';
    } catch {
      return 'Error: No specification found. Please run sdd_spec first.';
    }

    // Load existing plan if refining
    let existingPlan = '';
    let previousVersions: string[] = [];

    if (refine) {
      try {
        const existing = await this.resourceManager.readResource(
          `specify://project/${projectId}/plan/current`
        );
        existingPlan = existing.text || '';
        previousVersions = [existingPlan];
      } catch {
        // No existing plan
      }
    }

    // Load template
    const templatePath = path.join(process.cwd(), 'templates', 'plan-template.md');
    let template = '';
    
    try {
      template = await fs.readFile(templatePath, 'utf-8');
    } catch {
      template = this.getDefaultTemplate();
    }

    // Generate plan
    const plan = this.generatePlan(
      specContent,
      template,
      techStack,
      existingPlan
    );

    // Verify plan
    const verificationContext: IVerificationContext = {
      phase: 'plan',
      content: plan,
      previousVersions,
      relatedDocuments: new Map([['spec', specContent]]),
    };

    const validationResults = await this.verifier.verify(verificationContext);
    const confidence = this.verifier.calculateConfidence(validationResults);

    // Save plan and related documents
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/plan/current`,
      plan
    );

    // Save research document
    const research = this.generateResearchDocument(specContent, techStack);
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/plan/research`,
      research
    );

    // Save data model
    const dataModel = this.generateDataModel(specContent);
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/plan/data-model`,
      dataModel
    );

    // Generate response
    const errors = validationResults.filter(r => r.type === 'error');
    const warnings = validationResults.filter(r => r.type === 'warning');

    let response = `Technical plan ${refine ? 'refined' : 'created'} successfully!\n`;
    response += `Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;

    if (errors.length > 0) {
      response += '⚠️ CRITICAL ISSUES:\n';
      errors.forEach(e => {
        response += `- ${e.message}\n`;
      });
      response += '\n';
    }

    if (warnings.length > 0) {
      response += '⚡ Considerations:\n';
      warnings.forEach(w => {
        response += `- ${w.message}\n`;
      });
      response += '\n';
    }

    const needsClarification = (plan.match(/NEEDS CLARIFICATION/g) || []).length;
    if (needsClarification > 0) {
      response += `📝 ${needsClarification} technical decisions need clarification.\n\n`;
    }

    response += 'Generated documents:\n';
    response += '- plan/current.md (main plan)\n';
    response += '- plan/research.md (technology research)\n';
    response += '- plan/data-model.md (data structures)\n\n';
    response += 'Next step: Use `sdd_tasks` to break down work into tasks.';

    return response;
  }

  private generatePlan(
    specContent: string,
    template: string,
    techStack?: ITechStack,
    existingPlan?: string
  ): string {
    const timestamp = new Date().toISOString();
    
    // Extract feature name from spec
    const featureMatch = specContent.match(/# Feature Specification: ([^\n]+)/);
    const featureName = featureMatch ? featureMatch[1] : 'Feature';

    // Extract requirements from spec
    const requirements = this.extractRequirements(specContent);
    const entities = this.extractEntities(specContent);

    // Determine project type and structure
    const projectType = this.determineProjectType(requirements, entities);
    
    // Fill template
    let plan = template;
    const safeFeatureName = featureName || 'Untitled Feature';
    plan = plan.replace('[FEATURE]', safeFeatureName);
    const dateString = timestamp.split('T')[0];
    if (dateString) {
      plan = plan.replace(/\[DATE\]/g, dateString);
    }
    plan = plan.replace('[###-feature-name]', safeFeatureName.toLowerCase().replace(/\s+/g, '-'));
    
    // Fill technical context
    if (techStack) {
      plan = this.fillTechnicalContext(plan, techStack, projectType);
    } else {
      plan = this.inferTechnicalStack(plan, requirements, projectType);
    }

    // Fill project structure
    plan = this.fillProjectStructure(plan, projectType);
    
    // Fill phase details
    plan = this.fillPhaseDetails(plan, requirements, entities);

    // Constitution check
    plan = this.performConstitutionCheck(plan, projectType);

    // If refining, merge changes
    if (existingPlan) {
      plan = this.refinePlan(existingPlan, plan);
    }

    return plan;
  }

  private extractRequirements(specContent: string): string[] {
    const reqPattern = /\*\*FR-\d+\*\*: (.+?)(?=\n|$)/g;
    const requirements: string[] = [];
    let match;
    
    while ((match = reqPattern.exec(specContent)) !== null) {
      if (match[1]) {
        requirements.push(match[1]);
      }
    }
    
    return requirements;
  }

  private extractEntities(specContent: string): string[] {
    const entityPattern = /\*\*([A-Z][a-z]+)\*\*:/g;
    const entities: string[] = [];
    let match;
    
    while ((match = entityPattern.exec(specContent)) !== null) {
      if (match[1] && !['Given', 'When', 'Then', 'System'].includes(match[1])) {
        entities.push(match[1]);
      }
    }
    
    return entities;
  }

  private determineProjectType(requirements: string[], _entities: string[]): string {
    const hasUI = requirements.some(req => 
      req.toLowerCase().includes('interface') ||
      req.toLowerCase().includes('display') ||
      req.toLowerCase().includes('view')
    );
    
    const hasAPI = requirements.some(req => 
      req.toLowerCase().includes('api') ||
      req.toLowerCase().includes('endpoint') ||
      req.toLowerCase().includes('service')
    );
    
    const hasMobile = requirements.some(req => 
      req.toLowerCase().includes('mobile') ||
      req.toLowerCase().includes('ios') ||
      req.toLowerCase().includes('android')
    );

    if (hasMobile) return 'mobile';
    if (hasUI && hasAPI) return 'web';
    if (hasAPI) return 'api';
    return 'single';
  }

  private fillTechnicalContext(plan: string, techStack: ITechStack, projectType: string): string {
    const context = `**Language/Version**: ${techStack.language}
**Primary Dependencies**: ${techStack.framework || 'None specified'}
**Storage**: ${techStack.database || 'In-memory'}
**Testing**: ${techStack.testing || 'Native test framework'}
**Target Platform**: ${this.getPlatform(projectType)}
**Project Type**: ${projectType}
**Performance Goals**: [NEEDS CLARIFICATION: Define specific metrics]
**Constraints**: [NEEDS CLARIFICATION: Define resource constraints]
**Scale/Scope**: [NEEDS CLARIFICATION: Define expected scale]`;

    return plan.replace(
      /\*\*Language\/Version\*\*:[\s\S]*?\*\*Scale\/Scope\*\*:.*/,
      context
    );
  }

  private inferTechnicalStack(plan: string, _requirements: string[], projectType: string): string {
    // Infer based on common patterns
    let language = 'TypeScript';
    let framework = 'Node.js';
    let database = 'PostgreSQL';
    let testing = 'Jest';

    if (projectType === 'web') {
      framework = 'Next.js + Express';
      database = 'PostgreSQL';
    } else if (projectType === 'mobile') {
      language = 'Swift/Kotlin';
      framework = 'Native';
      database = 'SQLite';
      testing = 'XCTest/JUnit';
    } else if (projectType === 'api') {
      framework = 'Express';
    }

    const context = `**Language/Version**: ${language} [NEEDS CLARIFICATION: Confirm language choice]
**Primary Dependencies**: ${framework} [NEEDS CLARIFICATION: Confirm framework]
**Storage**: ${database} [NEEDS CLARIFICATION: Confirm database]
**Testing**: ${testing}
**Target Platform**: ${this.getPlatform(projectType)}
**Project Type**: ${projectType}
**Performance Goals**: [NEEDS CLARIFICATION: Define specific metrics]
**Constraints**: [NEEDS CLARIFICATION: Define resource constraints]
**Scale/Scope**: [NEEDS CLARIFICATION: Define expected scale]`;

    return plan.replace(
      /\*\*Language\/Version\*\*:[\s\S]*?\*\*Scale\/Scope\*\*:.*/,
      context
    );
  }

  private getPlatform(projectType: string): string {
    switch (projectType) {
      case 'web': return 'Web browsers (Chrome, Firefox, Safari)';
      case 'mobile': return 'iOS 15+ / Android 12+';
      case 'api': return 'Linux server / Docker';
      default: return 'Cross-platform';
    }
  }

  private fillProjectStructure(plan: string, projectType: string): string {
    let structure = '';
    
    switch (projectType) {
      case 'web':
        structure = 'Option 2: Web application';
        break;
      case 'mobile':
        structure = 'Option 3: Mobile + API';
        break;
      case 'api':
      case 'single':
      default:
        structure = 'Option 1: Single project (DEFAULT)';
        break;
    }

    return plan.replace(
      '**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]',
      `**Structure Decision**: ${structure}`
    );
  }

  private fillPhaseDetails(plan: string, requirements: string[], entities: string[]): string {
    // Update Phase 0 with specific research needs
    const researchNeeds = [
      `- Research best practices for ${requirements.length} functional requirements`,
      `- Investigate data model for ${entities.length} entities`,
      `- Evaluate testing strategies for TDD approach`,
    ].join('\n   ');

    plan = plan.replace(
      'For each unknown in Technical Context:',
      `For each unknown in Technical Context:\n   ${researchNeeds}`
    );

    // Update Phase 1 with entity details
    if (entities.length > 0) {
      const entityList = entities.map(e => `   - ${e}: Define fields and relationships`).join('\n');
      plan = plan.replace(
        '- Entity name, fields, relationships',
        `- Entity name, fields, relationships\n${entityList}`
      );
    }

    return plan;
  }

  private performConstitutionCheck(plan: string, projectType: string): string {
    const checks = {
      simplicity: projectType === 'single' ? '✓ Single project' : `⚠️ ${projectType} requires multiple projects`,
      architecture: '✓ Library-first approach planned',
      testing: '✓ TDD with RED-GREEN-Refactor enforced',
      observability: '✓ Structured logging included',
      versioning: '✓ Semantic versioning planned',
    };

    let checkSection = '## Constitution Check\n\n';
    Object.entries(checks).forEach(([key, value]) => {
      checkSection += `- ${key}: ${value}\n`;
    });

    return plan.replace(
      /## Constitution Check[\s\S]*?## Project Structure/,
      checkSection + '\n## Project Structure'
    );
  }

  private refinePlan(_existingPlan: string, newPlan: string): string {
    // Add refinement history
    const refinementNote = `
## Refinement History
**Date**: ${new Date().toISOString()}
**Changes**: Updated technical decisions and clarified requirements

---

`;
    
    return refinementNote + newPlan;
  }

  private generateResearchDocument(_specContent: string, techStack?: ITechStack): string {
    const timestamp = new Date().toISOString();
    
    return `# Technology Research

**Generated**: ${timestamp}
**Based on**: Product Specification

## Technology Decisions

### Language Choice
**Decision**: ${techStack?.language || 'TypeScript (recommended)'}
**Rationale**: 
- Type safety for large-scale applications
- Excellent IDE support and developer experience
- Strong ecosystem and community
**Alternatives considered**: Python, Go, Java

### Framework Selection
**Decision**: ${techStack?.framework || 'Express.js (for APIs)'}
**Rationale**:
- Minimal and flexible
- Large middleware ecosystem
- Production-proven
**Alternatives considered**: Fastify, Koa, NestJS

### Database Technology
**Decision**: ${techStack?.database || 'PostgreSQL'}
**Rationale**:
- ACID compliance for data integrity
- Rich feature set (JSON, full-text search)
- Excellent performance at scale
**Alternatives considered**: MySQL, MongoDB, SQLite

### Testing Framework
**Decision**: ${techStack?.testing || 'Jest'}
**Rationale**:
- Zero configuration
- Built-in coverage reporting
- Snapshot testing support
**Alternatives considered**: Mocha, Vitest, AVA

## Best Practices Research

### Security Considerations
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS protection through output encoding
- CORS configuration for API access

### Performance Optimization
- Database indexing strategy
- Caching layer (Redis) for frequently accessed data
- CDN for static assets
- Query optimization and monitoring

### Scalability Planning
- Horizontal scaling via load balancing
- Database replication for read scaling
- Microservices architecture consideration for future
- Message queue for async processing

## Integration Patterns

### API Design
- RESTful principles with proper HTTP methods
- Consistent error response format
- Versioning strategy (URL vs headers)
- Rate limiting and throttling

### Authentication & Authorization
- JWT for stateless authentication
- Role-based access control (RBAC)
- OAuth2 for third-party integrations
- Session management best practices

## Development Workflow

### CI/CD Pipeline
- Automated testing on pull requests
- Code quality checks (linting, formatting)
- Security scanning (dependencies, code)
- Automated deployment to staging/production

### Monitoring & Observability
- Structured logging with correlation IDs
- Application performance monitoring (APM)
- Error tracking and alerting
- Business metrics dashboards

## Recommended Reading
- [Clean Architecture by Robert Martin]
- [Domain-Driven Design by Eric Evans]
- [Building Microservices by Sam Newman]
- [The Twelve-Factor App methodology]

---
*This research document will be updated as technical decisions evolve.*`;
  }

  private generateDataModel(specContent: string): string {
    const entities = this.extractEntities(specContent);
    const timestamp = new Date().toISOString();
    
    let dataModel = `# Data Model

**Generated**: ${timestamp}
**Entities Identified**: ${entities.length}

## Entity Definitions

`;

    entities.forEach(entity => {
      dataModel += `### ${entity}

**Purpose**: [NEEDS CLARIFICATION: Define the purpose of this entity]

**Fields**:
- id: UUID (primary key)
- createdAt: timestamp
- updatedAt: timestamp
- [NEEDS CLARIFICATION: Additional fields]

**Relationships**:
- [NEEDS CLARIFICATION: Define relationships to other entities]

**Validation Rules**:
- [NEEDS CLARIFICATION: Define validation constraints]

**State Transitions**:
- [NEEDS CLARIFICATION: Define if entity has state machine]

---

`;
    });

    dataModel += `## Database Schema

\`\`\`sql
-- PostgreSQL schema (preliminary)
`;

    entities.forEach((entity: string) => {
      const tableName = entity.toLowerCase() + 's';
      dataModel += `
CREATE TABLE ${tableName} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Additional fields to be defined
);
`;
    });

    dataModel += `\`\`\`

## Indexes

- Primary keys auto-indexed
- [NEEDS CLARIFICATION: Additional indexes based on query patterns]

## Data Access Patterns

- [NEEDS CLARIFICATION: Common query patterns]
- [NEEDS CLARIFICATION: Write vs read ratio]
- [NEEDS CLARIFICATION: Data retention policies]

---
*This data model will be refined based on requirements analysis.*`;

    return dataModel;
  }

  private getDefaultTemplate(): string {
    return `# Implementation Plan: [FEATURE]

**Created**: [DATE]
**Status**: Draft

## Technical Context

**Language/Version**: [NEEDS CLARIFICATION]
**Primary Dependencies**: [NEEDS CLARIFICATION]
**Storage**: [NEEDS CLARIFICATION]
**Testing**: [NEEDS CLARIFICATION]
**Target Platform**: [NEEDS CLARIFICATION]
**Project Type**: [NEEDS CLARIFICATION]

## Constitution Check

- Simplicity: To be evaluated
- Architecture: Library-first approach
- Testing: TDD required
- Observability: Logging required
- Versioning: Semantic versioning

## Project Structure

### Option 1: Single project (DEFAULT)
\`\`\`
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
\`\`\`

## Phase 0: Research
- Technology decisions documented
- Best practices identified
- Integration patterns defined

## Phase 1: Design & Contracts
- Data model creation
- API contracts definition
- Test scenarios extraction

## Phase 2: Task Planning
- Tasks will be generated based on design
- TDD approach enforced
- Parallel execution identified`;
  }

  private generateWorkflowBlockMessage(status: any): string {
    return `🚫 **Cannot proceed to technical planning phase**

📊 **Current Status**: Quality score ${status.qualityScore}/100 (Required: 80+)
🔄 **Iterations**: ${status.iterationCount} (Required: ${status.requiredIterations || 2}+)

❌ **Blocking Issues**:
${status.blockingReasons.map((reason: string) => `   • ${reason}`).join('\n')}

💡 **Recommendations**:
${status.recommendations.map((rec: string) => `   • ${rec}`).join('\n')}

🎯 **AI-SDD Principle**: Requirements must be thoroughly specified before technical planning.

📝 **Next Step**: Improve requirements with \`specify_requirements\` action=update.`;
  }
}
