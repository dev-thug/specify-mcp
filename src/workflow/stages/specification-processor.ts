import { Context, ValidationResult } from '../../types/mcp.js';
import { SpecificationInput, SpecificationOutput } from '../../types/workflow.js';
import { StageProcessor } from '../workflow-manager.js';
import { logger } from '../../utils/logger.js';

export class SpecificationProcessor implements StageProcessor<SpecificationInput, SpecificationOutput> {

  async process(input: SpecificationInput, context: Context): Promise<SpecificationOutput> {
    logger.info('Processing specification stage', { 
      sessionId: context.sessionId,
      ambiguitiesResolved: input.ambiguityResolution?.identifiedAmbiguities?.length || 0
    });

    try {
      // Extract requirements from clarified request
      const functionalRequirements = await this.extractFunctionalRequirements(input);
      const nonFunctionalRequirements = await this.extractNonFunctionalRequirements(input);
      
      // Define system boundaries and interfaces
      const systemBoundaries = await this.defineSystemBoundaries(input);
      const interfaces = await this.defineInterfaces(input, systemBoundaries);
      
      // Create data models and schemas
      const dataModels = await this.createDataModels(functionalRequirements);
      
      // Define business rules and constraints
      const businessRules = await this.extractBusinessRules(input);
      const constraints = await this.identifyConstraints(input);
      
      // Generate acceptance criteria
      const acceptanceCriteria = await this.generateAcceptanceCriteria(
        functionalRequirements, 
        nonFunctionalRequirements
      );

      const output: SpecificationOutput = {
        functionalRequirements,
        nonFunctionalRequirements,
        systemBoundaries,
        interfaces,
        dataModels,
        businessRules,
        constraints,
        acceptanceCriteria,
        traceabilityMatrix: await this.createTraceabilityMatrix(input, functionalRequirements),
        completenessScore: 0 // Will be calculated in validation
      };

      // Calculate completeness score
      output.completenessScore = this.calculateSpecificationCompleteness(output);

      logger.info('Specification processing completed', {
        sessionId: context.sessionId,
        functionalReqCount: functionalRequirements.length,
        nonFunctionalReqCount: nonFunctionalRequirements.length,
        completenessScore: output.completenessScore
      });

      return output;

    } catch (error) {
      logger.error('Specification processing failed', error, { sessionId: context.sessionId });
      throw error;
    }
  }

  async validate(output: SpecificationOutput, _context: Context): Promise<ValidationResult> {
    const validationErrors: string[] = [];
    
    // Check minimum requirements
    if (output.functionalRequirements.length === 0) {
      validationErrors.push('No functional requirements identified');
    }
    
    if (output.nonFunctionalRequirements.length === 0) {
      validationErrors.push('No non-functional requirements identified');
    }
    
    if (output.acceptanceCriteria.length === 0) {
      validationErrors.push('No acceptance criteria defined');
    }

    // Check requirement quality
    const vagueFunctionalReqs = output.functionalRequirements.filter(req => 
      req.description.length < 20 || req.priority === undefined
    );
    
    if (vagueFunctionalReqs.length > output.functionalRequirements.length * 0.3) {
      validationErrors.push('Too many vague or incomplete functional requirements');
    }

    // Check traceability
    if (!output.traceabilityMatrix || Object.keys(output.traceabilityMatrix).length === 0) {
      validationErrors.push('Traceability matrix is missing or empty');
    }

    // Check completeness score
    if (output.completenessScore < 0.6) {
      validationErrors.push(`Specification completeness too low: ${output.completenessScore}`);
    }

    const isValid = validationErrors.length === 0;
    
    return {
      isValid,
      errors: validationErrors,
      metrics: {
        completeness: output.completenessScore,
        clarity: this.calculateSpecificationClarity(output),
        determinism: this.calculateSpecificationDeterminism(output),
        consistency: this.calculateSpecificationConsistency(output),
        timestamp: Date.now()
      }
    };
  }

  private async extractFunctionalRequirements(input: SpecificationInput): Promise<Array<{
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    source: string;
    dependencies: string[];
  }>> {
    const requirements: any[] = [];
    const clarifiedRequest = input.ambiguityResolution?.clarifiedRequest || input.originalRequest;
    
    // Extract key action verbs and nouns to identify requirements
    const actionPatterns = [
      /(?:shall|must|should|will|can)\s+([^.!?]+)/gi,
      /(?:user|system|application)\s+(?:shall|must|should|will|can)\s+([^.!?]+)/gi,
      /(?:the|a|an)\s+(\w+)\s+(?:shall|must|should|will|can)\s+([^.!?]+)/gi
    ];

    let reqId = 1;
    
    for (const pattern of actionPatterns) {
      const matches = [...clarifiedRequest.matchAll(pattern)];
      
      for (const match of matches) {
        const description = match[1]?.trim();
        if (description && description.length > 10) {
          
          const priority = this.determinePriority(description);
          const category = this.categorizeRequirement(description);
          
          requirements.push({
            id: `FR_${reqId.toString().padStart(3, '0')}`,
            title: this.generateRequirementTitle(description),
            description: description,
            priority,
            category,
            source: 'User Request',
            dependencies: []
          });
          
          reqId++;
        }
      }
    }

    // Add basic CRUD requirements if data is mentioned
    if (clarifiedRequest.toLowerCase().includes('data') || 
        clarifiedRequest.toLowerCase().includes('information') ||
        clarifiedRequest.toLowerCase().includes('record')) {
      
      const dataRequirements = [
        {
          id: `FR_${reqId.toString().padStart(3, '0')}`,
          title: 'Data Creation',
          description: 'System shall allow users to create new data records',
          priority: 'high' as const,
          category: 'Data Management',
          source: 'Inferred from data usage',
          dependencies: []
        },
        {
          id: `FR_${(reqId + 1).toString().padStart(3, '0')}`,
          title: 'Data Retrieval',
          description: 'System shall allow users to retrieve and view data records',
          priority: 'high' as const,
          category: 'Data Management',
          source: 'Inferred from data usage',
          dependencies: [`FR_${reqId.toString().padStart(3, '0')}`]
        },
        {
          id: `FR_${(reqId + 2).toString().padStart(3, '0')}`,
          title: 'Data Update',
          description: 'System shall allow users to modify existing data records',
          priority: 'medium' as const,
          category: 'Data Management',
          source: 'Inferred from data usage',
          dependencies: [`FR_${reqId.toString().padStart(3, '0')}`]
        },
        {
          id: `FR_${(reqId + 3).toString().padStart(3, '0')}`,
          title: 'Data Deletion',
          description: 'System shall allow users to delete data records',
          priority: 'medium' as const,
          category: 'Data Management',
          source: 'Inferred from data usage',
          dependencies: [`FR_${reqId.toString().padStart(3, '0')}`]
        }
      ];
      
      requirements.push(...dataRequirements);
    }

    return requirements;
  }

  private async extractNonFunctionalRequirements(_input: SpecificationInput): Promise<Array<{
    id: string;
    category: 'performance' | 'security' | 'usability' | 'reliability' | 'scalability' | 'maintainability';
    requirement: string;
    measurableCriteria: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>> {
    const nfRequirements: any[] = [];
    let nfrId = 1;

    // Standard non-functional requirements
    const standardNFRs = [
      {
        category: 'performance',
        requirement: 'System response time shall be acceptable for user operations',
        measurableCriteria: 'Response time < 2 seconds for 95% of operations',
        priority: 'high'
      },
      {
        category: 'security',
        requirement: 'System shall protect user data and prevent unauthorized access',
        measurableCriteria: 'All data encrypted at rest and in transit, role-based access control',
        priority: 'critical'
      },
      {
        category: 'usability',
        requirement: 'System shall be intuitive and easy to use',
        measurableCriteria: 'Users can complete primary tasks without training in < 5 minutes',
        priority: 'high'
      },
      {
        category: 'reliability',
        requirement: 'System shall be available when users need it',
        measurableCriteria: '99.5% uptime during business hours',
        priority: 'high'
      },
      {
        category: 'scalability',
        requirement: 'System shall handle growth in users and data',
        measurableCriteria: 'Support 10x current load with linear resource scaling',
        priority: 'medium'
      },
      {
        category: 'maintainability',
        requirement: 'System shall be easy to maintain and update',
        measurableCriteria: 'Code coverage > 80%, modular architecture',
        priority: 'medium'
      }
    ];

    for (const nfr of standardNFRs) {
      nfRequirements.push({
        id: `NFR_${nfrId.toString().padStart(3, '0')}`,
        ...nfr
      });
      nfrId++;
    }

    return nfRequirements;
  }

  private async defineSystemBoundaries(input: SpecificationInput): Promise<{
    inScope: string[];
    outOfScope: string[];
    interfaces: string[];
    assumptions: string[];
  }> {
    const clarifiedRequest = input.ambiguityResolution?.clarifiedRequest || input.originalRequest;
    
    // Extract scope from request
    const inScope = this.extractScopeItems(clarifiedRequest, true);
    const outOfScope = this.extractScopeItems(clarifiedRequest, false);
    
    return {
      inScope: inScope.length > 0 ? inScope : ['Core functionality as described in requirements'],
      outOfScope: outOfScope.length > 0 ? outOfScope : ['External system integration beyond defined interfaces'],
      interfaces: ['User Interface', 'Data Storage Interface', 'External APIs (if applicable)'],
      assumptions: input.ambiguityResolution?.assumptions?.map(a => a.assumption) || []
    };
  }

  private async defineInterfaces(_input: SpecificationInput, _boundaries: any): Promise<Array<{
    id: string;
    name: string;
    type: 'user' | 'system' | 'data' | 'external';
    description: string;
    protocols: string[];
    dataFormats: string[];
  }>> {
    const interfaces: any[] = [];
    let intId = 1;

    // Standard interfaces
    interfaces.push({
      id: `INT_${intId.toString().padStart(3, '0')}`,
      name: 'User Interface',
      type: 'user',
      description: 'Primary interface for user interaction with the system',
      protocols: ['HTTP/HTTPS'],
      dataFormats: ['HTML', 'JSON', 'Form Data']
    });

    intId++;

    interfaces.push({
      id: `INT_${intId.toString().padStart(3, '0')}`,
      name: 'Data Storage Interface',
      type: 'data',
      description: 'Interface for persistent data storage and retrieval',
      protocols: ['Database Connection'],
      dataFormats: ['Structured Data', 'JSON', 'Binary']
    });

    return interfaces;
  }

  private async createDataModels(functionalRequirements: any[]): Promise<Array<{
    id: string;
    name: string;
    description: string;
    attributes: Array<{
      name: string;
      type: string;
      required: boolean;
      constraints?: string[];
    }>;
    relationships: Array<{
      target: string;
      type: 'one-to-one' | 'one-to-many' | 'many-to-many';
      description: string;
    }>;
  }>> {
    const dataModels: any[] = [];
    
    // Infer basic models from requirements
    const hasUserData = functionalRequirements.some(req => 
      req.description.toLowerCase().includes('user') || 
      req.description.toLowerCase().includes('account')
    );
    
    if (hasUserData) {
      dataModels.push({
        id: 'DM_001',
        name: 'User',
        description: 'Represents a system user',
        attributes: [
          { name: 'id', type: 'string', required: true, constraints: ['unique', 'not_null'] },
          { name: 'email', type: 'string', required: true, constraints: ['unique', 'valid_email'] },
          { name: 'name', type: 'string', required: true },
          { name: 'createdAt', type: 'datetime', required: true },
          { name: 'updatedAt', type: 'datetime', required: true }
        ],
        relationships: []
      });
    }

    return dataModels;
  }

  private async extractBusinessRules(_input: SpecificationInput): Promise<Array<{
    id: string;
    rule: string;
    rationale: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
  }>> {
    return [
      {
        id: 'BR_001',
        rule: 'Data integrity must be maintained at all times',
        rationale: 'Ensures system reliability and user trust',
        impact: 'high',
        category: 'Data Management'
      },
      {
        id: 'BR_002',
        rule: 'User access must be authenticated and authorized',
        rationale: 'Protects system and user data from unauthorized access',
        impact: 'high',
        category: 'Security'
      }
    ];
  }

  private async identifyConstraints(_input: SpecificationInput): Promise<Array<{
    id: string;
    type: 'technical' | 'business' | 'regulatory' | 'resource';
    constraint: string;
    impact: string;
    mitigation?: string;
  }>> {
    return [
      {
        id: 'CON_001',
        type: 'technical',
        constraint: 'Must be compatible with existing systems',
        impact: 'May limit technology choices',
        mitigation: 'Use standard protocols and interfaces'
      },
      {
        id: 'CON_002',
        type: 'business',
        constraint: 'Budget limitations may affect scope',
        impact: 'May require phased implementation',
        mitigation: 'Prioritize core features for MVP'
      }
    ];
  }

  private async generateAcceptanceCriteria(
    functionalReqs: any[], 
    nonFunctionalReqs: any[]
  ): Promise<Array<{
    id: string;
    requirementId: string;
    criteria: string;
    testable: boolean;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>> {
    const criteria: any[] = [];
    let criteriaId = 1;

    // Generate criteria for functional requirements
    for (const req of functionalReqs) {
      criteria.push({
        id: `AC_${criteriaId.toString().padStart(3, '0')}`,
        requirementId: req.id,
        criteria: `Given the system is operational, when ${req.description.toLowerCase()}, then the operation completes successfully`,
        testable: true,
        priority: req.priority
      });
      criteriaId++;
    }

    // Generate criteria for non-functional requirements
    for (const req of nonFunctionalReqs) {
      criteria.push({
        id: `AC_${criteriaId.toString().padStart(3, '0')}`,
        requirementId: req.id,
        criteria: req.measurableCriteria,
        testable: true,
        priority: req.priority
      });
      criteriaId++;
    }

    return criteria;
  }

  private async createTraceabilityMatrix(
    input: SpecificationInput, 
    functionalReqs: any[]
  ): Promise<Record<string, {
    source: string;
    requirements: string[];
    testCases: string[];
    designElements: string[];
  }>> {
    const matrix: Record<string, any> = {};

    // Map original request to requirements
    matrix['user_request'] = {
      source: 'Original user request',
      requirements: functionalReqs.map(req => req.id),
      testCases: [],
      designElements: []
    };

    // Map ambiguity resolutions to requirements if available
    if (input.ambiguityResolution?.identifiedAmbiguities) {
      for (const ambiguity of input.ambiguityResolution.identifiedAmbiguities) {
        matrix[ambiguity.id] = {
          source: `Ambiguity: ${ambiguity.description}`,
          requirements: functionalReqs.filter(req => 
            req.description.toLowerCase().includes(ambiguity.description.toLowerCase().split(' ')[0])
          ).map(req => req.id),
          testCases: [],
          designElements: []
        };
      }
    }

    return matrix;
  }

  private determinePriority(description: string): 'critical' | 'high' | 'medium' | 'low' {
    const criticalKeywords = ['must', 'shall', 'critical', 'essential', 'required'];
    const highKeywords = ['should', 'important', 'necessary'];
    const lowKeywords = ['may', 'optional', 'nice', 'could'];

    const lowerDesc = description.toLowerCase();
    
    if (criticalKeywords.some(keyword => lowerDesc.includes(keyword))) return 'critical';
    if (highKeywords.some(keyword => lowerDesc.includes(keyword))) return 'high';
    if (lowKeywords.some(keyword => lowerDesc.includes(keyword))) return 'low';
    
    return 'medium';
  }

  private categorizeRequirement(description: string): string {
    const categories = {
      'Authentication': ['login', 'auth', 'user', 'account', 'password'],
      'Data Management': ['data', 'store', 'save', 'retrieve', 'update', 'delete'],
      'User Interface': ['display', 'show', 'interface', 'screen', 'page'],
      'Integration': ['api', 'external', 'integrate', 'connect'],
      'Security': ['secure', 'encrypt', 'permission', 'access'],
      'Performance': ['fast', 'quick', 'performance', 'speed'],
      'Reporting': ['report', 'export', 'generate', 'analytics']
    };

    const lowerDesc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        return category;
      }
    }
    
    return 'General';
  }

  private generateRequirementTitle(description: string): string {
    // Extract key action and object from description
    const words = description.split(' ');
    const actionWord = words.find(word => 
      ['create', 'update', 'delete', 'view', 'manage', 'process', 'handle', 'support'].includes(word.toLowerCase())
    );
    
    if (actionWord) {
      return `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${description.split(' ').slice(1, 4).join(' ')}`;
    }
    
    return description.split(' ').slice(0, 5).join(' ');
  }

  private extractScopeItems(_request: string, inScope: boolean): string[] {
    // Simple scope extraction - in a real system this would be more sophisticated
    if (inScope) {
      return ['Primary functionality as described', 'User interface components', 'Data management features'];
    } else {
      return ['Advanced analytics', 'Third-party integrations not specified', 'Legacy system migration'];
    }
  }

  private calculateSpecificationCompleteness(output: SpecificationOutput): number {
    let score = 0;
    const maxScore = 8;

    if (output.functionalRequirements.length > 0) score += 1;
    if (output.nonFunctionalRequirements.length > 0) score += 1;
    if (output.systemBoundaries.inScope.length > 0) score += 1;
    if (output.interfaces.length > 0) score += 1;
    if (output.dataModels.length > 0) score += 1;
    if (output.businessRules.length > 0) score += 1;
    if (output.constraints.length > 0) score += 1;
    if (output.acceptanceCriteria.length > 0) score += 1;

    return score / maxScore;
  }

  private calculateSpecificationClarity(output: SpecificationOutput): number {
    // Measure clarity based on requirement descriptions
    const allDescriptions = [
      ...output.functionalRequirements.map(r => r.description),
      ...output.nonFunctionalRequirements.map(r => r.requirement)
    ];

    if (allDescriptions.length === 0) return 0;

    const avgLength = allDescriptions.reduce((sum, desc) => sum + desc.length, 0) / allDescriptions.length;
    const clarityScore = Math.min(1.0, avgLength / 100); // Assume 100 chars is good clarity

    return clarityScore;
  }

  private calculateSpecificationDeterminism(output: SpecificationOutput): number {
    // Count specific, measurable criteria
    const measurableNFRs = output.nonFunctionalRequirements.filter(nfr => 
      nfr.measurableCriteria && nfr.measurableCriteria.includes('<') || nfr.measurableCriteria.includes('>')
    );

    const testableAC = output.acceptanceCriteria.filter(ac => ac.testable);

    const totalRequirements = output.functionalRequirements.length + output.nonFunctionalRequirements.length;
    const deterministic = measurableNFRs.length + testableAC.length;

    return totalRequirements > 0 ? Math.min(1.0, deterministic / totalRequirements) : 0;
  }

  private calculateSpecificationConsistency(output: SpecificationOutput): number {
    // Check for consistent naming and categorization
    const categories = output.functionalRequirements.map(r => r.category);
    const uniqueCategories = new Set(categories);
    
    // More consistent if requirements are well-categorized
    const consistencyScore = categories.length > 0 ? uniqueCategories.size / categories.length : 1.0;
    
    return Math.min(1.0, consistencyScore);
  }
}
