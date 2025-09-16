import { z } from 'zod';
import type { SDDTool, ToolResult } from '../types/index.js';
import { CommonVerifier } from '../verification/common.js';
import { ResourceManager } from '../resources/manager.js';

const planInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  techStack: z.object({
    frontend: z.array(z.string()).optional(),
    backend: z.array(z.string()).optional(),
    database: z.array(z.string()).optional(),
    infrastructure: z.array(z.string()).optional(),
    testing: z.array(z.string()).optional()
  }).optional().describe('Proposed technology stack'),
  architecture: z.string().optional().describe('Architecture pattern (e.g., microservices, monolithic)'),
  designSystem: z.string().optional().describe('Design system or UI framework')
});

export class PlanTool implements SDDTool {
  name = 'create_technical_plan';
  description = 'Create technical architecture plan with technology stack and design decisions';
  inputSchema = planInputSchema;

  private verifier: CommonVerifier;
  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.verifier = new CommonVerifier();
    this.resourceManager = resourceManager;
  }

  async handler(params: unknown): Promise<ToolResult> {
    const input = planInputSchema.parse(params);
    
    // Read project and specification
    const projectData = await this.resourceManager.readResource(input.projectId, 'metadata.json');
    const project = JSON.parse(projectData.content);
    
    // Read specification if available
    try {
      await this.resourceManager.readResource(
        input.projectId, 
        'spec/specification.md'
      );
    } catch {
      // Specification not available yet
    }

    // Generate technical plan
    const plan = await this.generateTechnicalPlan(project, '', input);
    
    // Verify plan for consistency and feasibility
    const verificationResult = await this.verifyPlan(plan);
    
    // Save plan document
    await this.resourceManager.createResource(
      input.projectId,
      'plan/technical-plan.md',
      plan,
      { stage: 'plan', verified: verificationResult.isValid }
    );

    // Create architecture decision records (ADRs)
    const adr = this.generateADR(input);
    await this.resourceManager.createResource(
      input.projectId,
      'plan/adr-001-tech-stack.md',
      adr,
      { stage: 'plan', type: 'adr' }
    );

    // Update project workflow
    project.workflow.completedStages.push('plan');
    project.workflow.currentStage = 'plan';
    project.workflow.nextStage = 'tasks';
    
    await this.resourceManager.updateResource(
      input.projectId,
      'metadata.json',
      JSON.stringify(project, null, 2)
    );

    return {
      content: [
        {
          type: 'text',
          text: `Technical plan created for project ${input.projectId}`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/plan/technical-plan.md`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/plan/adr-001-tech-stack.md`
        }
      ]
    };
  }

  private async generateTechnicalPlan(
    project: any,
    _spec: string,
    input: z.infer<typeof planInputSchema>
  ): Promise<string> {
    const techStack = input.techStack || this.getDefaultTechStack();
    const architecture = input.architecture || 'modular monolith';
    const designSystem = input.designSystem || 'custom';

    return `# Technical Plan
## ${project.projectName}

### Document Information
- **Version**: 1.0.0
- **Date**: ${new Date().toISOString().split('T')[0]}
- **Project ID**: ${project.projectId}
- **Based on**: Specification v1.0.0

## 1. Architecture Overview

### Architecture Pattern
**${architecture}**

${this.getArchitectureDescription(architecture)}

### Key Design Principles
- Separation of Concerns
- Single Responsibility
- Dependency Inversion
- Interface Segregation
- Open/Closed Principle

## 2. Technology Stack

### Frontend
${techStack.frontend?.map((tech: string) => `- ${tech}`).join('\n') || '- Not applicable'}

### Backend
${techStack.backend?.map((tech: string) => `- ${tech}`).join('\n') || '- Node.js\n- TypeScript'}

### Database
${techStack.database?.map((tech: string) => `- ${tech}`).join('\n') || '- PostgreSQL'}

### Infrastructure
${techStack.infrastructure?.map((tech: string) => `- ${tech}`).join('\n') || '- Docker\n- Cloud-native'}

### Testing Tools
${techStack.testing?.map((tech: string) => `- ${tech}`).join('\n') || '- Jest\n- Testing Library'}

## 3. Design System
**${designSystem}**

### UI Components
- Atomic design methodology
- Component library structure
- Responsive design approach
- Accessibility standards (WCAG 2.1 AA)

### Design Tokens
- Colors and theming
- Typography scales
- Spacing system
- Animation standards

## 4. System Architecture

### High-Level Components
\`\`\`
┌─────────────────┐     ┌─────────────────┐
│   Presentation  │────▶│   Application   │
│      Layer      │     │     Layer       │
└─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│     Domain      │────▶│  Infrastructure │
│     Layer       │     │      Layer      │
└─────────────────┘     └─────────────────┘
\`\`\`

### Data Flow
1. User interaction triggers UI event
2. Application layer processes business logic
3. Domain layer enforces business rules
4. Infrastructure layer handles persistence
5. Response flows back through layers

## 5. Development Standards

### Code Organization
\`\`\`
/src
  /application    # Use cases and application services
  /domain        # Business logic and entities
  /infrastructure # External services and persistence
  /presentation  # UI components and controllers
  /shared        # Common utilities and types
\`\`\`

### Coding Standards
- TypeScript strict mode enabled
- ESLint configuration for consistency
- Prettier for code formatting
- Conventional commits for version control

### Testing Strategy
- Unit tests: 80% coverage minimum
- Integration tests for critical paths
- End-to-end tests for user workflows
- Performance testing for bottlenecks

## 6. Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- OAuth 2.0 integration support

### Data Protection
- Encryption at rest and in transit
- Input validation and sanitization
- SQL injection prevention
- XSS protection

## 7. Performance Requirements

### Target Metrics
- Page load time: < 3 seconds
- API response time: < 200ms (p95)
- Concurrent users: 1000+
- Availability: 99.9%

### Optimization Strategies
- Code splitting and lazy loading
- Caching strategy (Redis/CDN)
- Database query optimization
- Asset optimization

## 8. Deployment Strategy

### Environments
- Development: Local Docker
- Staging: Cloud staging environment
- Production: Cloud production with auto-scaling

### CI/CD Pipeline
1. Code commit triggers pipeline
2. Automated testing suite runs
3. Code quality checks
4. Build and containerization
5. Deployment to appropriate environment
6. Health checks and monitoring

## 9. Monitoring & Observability

### Logging
- Structured logging (JSON format)
- Log levels (ERROR, WARN, INFO, DEBUG)
- Centralized log management

### Metrics
- Application performance monitoring (APM)
- Business metrics tracking
- Error rate monitoring
- Resource utilization

### Alerting
- Critical error notifications
- Performance degradation alerts
- Security incident alerts

## 10. Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Scalability issues | High | Horizontal scaling architecture |
| Security breaches | High | Security-first design, regular audits |
| Technology obsolescence | Medium | Modular architecture, regular updates |
| Integration failures | Medium | Comprehensive testing, fallback mechanisms |

## 11. Timeline Estimation

### Development Phases
1. **Foundation** (2 weeks)
   - Project setup
   - Core architecture
   - Development environment

2. **Core Features** (6-8 weeks)
   - Primary functionality
   - Data models
   - API development

3. **Integration** (2-3 weeks)
   - External services
   - Third-party APIs
   - Authentication

4. **Testing & Refinement** (2-3 weeks)
   - Comprehensive testing
   - Bug fixes
   - Performance optimization

5. **Deployment** (1 week)
   - Production setup
   - Monitoring setup
   - Documentation

## 12. Dependencies

### External Services
- Cloud provider services
- Email service provider
- Payment processing (if applicable)
- Analytics platform

### Third-Party Libraries
- Framework dependencies
- Utility libraries
- Security libraries
- Testing frameworks

---
*This technical plan provides the blueprint for implementation while maintaining flexibility for adjustments during development.*
`;
  }

  private getDefaultTechStack(): any {
    return {
      frontend: ['React', 'TypeScript', 'Tailwind CSS'],
      backend: ['Node.js', 'Express', 'TypeScript'],
      database: ['PostgreSQL', 'Redis'],
      infrastructure: ['Docker', 'Kubernetes', 'AWS/GCP'],
      testing: ['Jest', 'React Testing Library', 'Cypress']
    };
  }

  private getArchitectureDescription(architecture: string): string {
    const descriptions: Record<string, string> = {
      'microservices': 'Distributed architecture with independently deployable services, each owning its data and business logic.',
      'monolithic': 'Single deployable unit containing all application components, suitable for smaller teams and simpler deployments.',
      'modular monolith': 'Monolithic deployment with clear module boundaries, preparing for potential future decomposition.',
      'serverless': 'Event-driven architecture using cloud functions, optimal for variable workloads and rapid scaling.',
      'event-driven': 'Asynchronous communication between components using events, enabling loose coupling and scalability.'
    };
    
    return descriptions[architecture] || 'Custom architecture pattern tailored to project requirements.';
  }

  private generateADR(input: z.infer<typeof planInputSchema>): string {
    const date = new Date().toISOString().split('T')[0];
    const techStack = input.techStack || this.getDefaultTechStack();

    return `# ADR-001: Technology Stack Selection

## Status
Accepted

## Date
${date}

## Context
We need to select a technology stack that balances developer productivity, performance, maintainability, and scalability for the project.

## Decision
We will use the following technology stack:

### Frontend
${techStack.frontend?.map((tech: string) => `- **${tech}**: Selected for its ecosystem, performance, and developer experience`).join('\n') || '- Not applicable'}

### Backend
${techStack.backend?.map((tech: string) => `- **${tech}**: Chosen for type safety and robust ecosystem`).join('\n') || '- **Node.js with TypeScript**: For consistency with frontend and type safety'}

### Database
${techStack.database?.map((tech: string) => `- **${tech}**: Reliable, scalable, and well-supported`).join('\n') || '- **PostgreSQL**: ACID compliance and rich feature set'}

### Infrastructure
${techStack.infrastructure?.map((tech: string) => `- **${tech}**: Industry standard for containerization and orchestration`).join('\n') || '- **Docker & Kubernetes**: For scalability and deployment flexibility'}

## Consequences

### Positive
- Unified language (TypeScript) across stack reduces context switching
- Strong type safety reduces runtime errors
- Excellent tooling and community support
- Scalable architecture from the start

### Negative
- Learning curve for team members unfamiliar with TypeScript
- Initial setup complexity
- Potential over-engineering for simple requirements

### Risks
- Technology lock-in
- Dependency on third-party libraries
- Need for continuous updates and maintenance

## Alternatives Considered
1. **Python/Django**: Rejected due to team's JavaScript expertise
2. **Java/Spring**: Rejected due to higher complexity and slower development cycle
3. **Ruby on Rails**: Rejected due to scalability concerns
4. **PHP/Laravel**: Rejected due to type safety requirements

## References
- Technology comparison studies
- Team skill assessment
- Performance benchmarks
- Industry best practices
`;
  }

  private async verifyPlan(plan: string): Promise<any> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for technology compatibility
    if (plan.includes('React') && plan.includes('Angular')) {
      issues.push('Multiple competing frontend frameworks detected');
    }

    // Check for missing critical sections
    const requiredSections = [
      'Architecture', 'Technology Stack', 'Security', 'Performance', 'Deployment'
    ];
    
    for (const section of requiredSections) {
      if (!plan.includes(section)) {
        issues.push(`Missing critical section: ${section}`);
      }
    }

    // Run common verification
    const commonVerification = await this.verifier.verify(plan);
    issues.push(...commonVerification.issues);
    suggestions.push(...commonVerification.suggestions);

    // Technology-specific suggestions
    if (plan.includes('microservices')) {
      suggestions.push('Consider service mesh for microservices communication');
      suggestions.push('Plan for distributed tracing and monitoring');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      confidence: Math.max(0.5, 1 - (issues.length * 0.1))
    };
  }
}
