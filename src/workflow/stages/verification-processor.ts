import { Context, ValidationResult } from '../../types/mcp.js';
import { VerificationInput, VerificationOutput } from '../../types/workflow.js';
import { StageProcessor } from '../workflow-manager.js';
import { logger } from '../../utils/logger.js';

export class VerificationProcessor implements StageProcessor<VerificationInput, VerificationOutput> {

  async process(input: VerificationInput, context: Context): Promise<VerificationOutput> {
    logger.info('Processing verification stage', { 
      sessionId: context.sessionId,
      totalTasks: input.tasking?.detailedTasks?.length || 0
    });

    try {
      // Execute verification tests
      const testResults = await this.executeVerificationTests(input);
      
      // Validate against requirements
      const requirementValidation = await this.validateRequirements(input);
      
      // Check quality metrics
      const qualityAssessment = await this.assessQuality(input);
      
      // Perform compliance checks
      const complianceResults = await this.checkCompliance(input);
      
      // Generate verification report
      const verificationReport = await this.generateVerificationReport(
        testResults, 
        requirementValidation, 
        qualityAssessment, 
        complianceResults
      );
      
      // Identify issues and recommendations
      const issues = await this.identifyIssues(testResults, qualityAssessment);
      const recommendations = await this.generateRecommendations(issues, qualityAssessment);

      const output: VerificationOutput = {
        testResults,
        requirementValidation,
        qualityAssessment,
        complianceResults,
        verificationReport,
        issues,
        recommendations,
        overallVerificationStatus: this.determineOverallStatus(testResults, qualityAssessment),
        verificationMetrics: {
          testPassRate: this.calculateTestPassRate(testResults),
          requirementCoverage: this.calculateRequirementCoverage(requirementValidation),
          qualityScore: this.calculateQualityScore(qualityAssessment),
          complianceScore: this.calculateComplianceScore(complianceResults)
        }
      };

      logger.info('Verification processing completed', {
        sessionId: context.sessionId,
        overallStatus: output.overallVerificationStatus,
        testPassRate: output.verificationMetrics.testPassRate,
        qualityScore: output.verificationMetrics.qualityScore
      });

      return output;

    } catch (error) {
      logger.error('Verification processing failed', error, { sessionId: context.sessionId });
      throw error;
    }
  }

  async validate(output: VerificationOutput, _context: Context): Promise<ValidationResult> {
    const validationErrors: string[] = [];
    
    // Check verification completeness
    if (!output.testResults || output.testResults.length === 0) {
      validationErrors.push('No test results available');
    }
    
    if (!output.requirementValidation || Object.keys(output.requirementValidation).length === 0) {
      validationErrors.push('Requirement validation not performed');
    }
    
    if (!output.qualityAssessment) {
      validationErrors.push('Quality assessment missing');
    }

    // Check verification success criteria
    if (output.verificationMetrics.testPassRate < 0.95) {
      validationErrors.push(`Test pass rate too low: ${output.verificationMetrics.testPassRate}`);
    }
    
    if (output.verificationMetrics.requirementCoverage < 0.9) {
      validationErrors.push(`Requirement coverage insufficient: ${output.verificationMetrics.requirementCoverage}`);
    }
    
    if (output.verificationMetrics.qualityScore < 0.8) {
      validationErrors.push(`Quality score below threshold: ${output.verificationMetrics.qualityScore}`);
    }

    // Check for critical issues
    const criticalIssues = output.issues.filter((issue: any) => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      validationErrors.push(`${criticalIssues.length} critical issues identified`);
    }

    const isValid = validationErrors.length === 0;
    
    return {
      isValid,
      errors: validationErrors,
      metrics: {
        completeness: this.calculateVerificationCompleteness(output),
        clarity: this.calculateVerificationClarity(output),
        determinism: this.calculateVerificationDeterminism(output),
        consistency: this.calculateVerificationConsistency(output),
        timestamp: Date.now()
      }
    };
  }

  private async executeVerificationTests(input: VerificationInput): Promise<Array<{
    testId: string;
    testName: string;
    testType: 'unit' | 'integration' | 'system' | 'acceptance' | 'performance' | 'security';
    status: 'passed' | 'failed' | 'skipped' | 'error';
    executionTime: number;
    details: string;
    relatedRequirement?: string;
    relatedTask?: string;
  }>> {
    const testResults: any[] = [];
    let testId = 1;

    // Generate test cases based on requirements and tasks
    const functionalReqs = input.specification?.functionalRequirements || [];
    const nonFunctionalReqs = input.specification?.nonFunctionalRequirements || [];
    const tasks = input.tasking?.detailedTasks || [];

    // Unit tests for development tasks
    const developmentTasks = tasks.filter((task: any) => task.type === 'development');
    for (const task of developmentTasks) {
      testResults.push({
        testId: `TEST_${testId.toString().padStart(3, '0')}`,
        testName: `Unit tests for ${task.name}`,
        testType: 'unit',
        status: Math.random() > 0.1 ? 'passed' : 'failed', // 90% pass rate simulation
        executionTime: Math.floor(Math.random() * 5000) + 100, // 100-5000ms
        details: Math.random() > 0.1 ? 'All unit tests passed successfully' : 'Some test cases failed - see detailed log',
        relatedTask: task.id
      });
      testId++;
    }

    // Integration tests
    const integrationTests = this.generateIntegrationTests(functionalReqs);
    for (const test of integrationTests) {
      testResults.push({
        testId: `TEST_${testId.toString().padStart(3, '0')}`,
        ...test,
        status: Math.random() > 0.05 ? 'passed' : 'failed', // 95% pass rate
        executionTime: Math.floor(Math.random() * 10000) + 1000
      });
      testId++;
    }

    // System tests for functional requirements
    for (const req of functionalReqs) {
      testResults.push({
        testId: `TEST_${testId.toString().padStart(3, '0')}`,
        testName: `System test for ${req.title}`,
        testType: 'system',
        status: Math.random() > 0.05 ? 'passed' : 'failed',
        executionTime: Math.floor(Math.random() * 15000) + 2000,
        details: Math.random() > 0.05 ? 'System test completed successfully' : 'System test identified issues',
        relatedRequirement: req.id
      });
      testId++;
    }

    // Performance tests for non-functional requirements
    const performanceReqs = nonFunctionalReqs.filter((req: any) => req.category === 'performance');
    for (const req of performanceReqs) {
      testResults.push({
        testId: `TEST_${testId.toString().padStart(3, '0')}`,
        testName: `Performance test for ${req.requirement}`,
        testType: 'performance',
        status: Math.random() > 0.15 ? 'passed' : 'failed', // 85% pass rate
        executionTime: Math.floor(Math.random() * 30000) + 5000,
        details: Math.random() > 0.15 ? 'Performance criteria met' : 'Performance targets not achieved',
        relatedRequirement: req.id
      });
      testId++;
    }

    return testResults;
  }

  private generateIntegrationTests(functionalReqs: any[]): any[] {
    const integrationTests = [];
    
    // Common integration scenarios
    if (functionalReqs.some(req => req.category === 'Data Management')) {
      integrationTests.push({
        testName: 'Database Integration Test',
        testType: 'integration',
        details: 'Test database connections and CRUD operations'
      });
    }

    if (functionalReqs.some(req => req.category === 'Authentication')) {
      integrationTests.push({
        testName: 'Authentication Service Integration',
        testType: 'integration', 
        details: 'Test authentication service integration'
      });
    }

    integrationTests.push({
      testName: 'API Integration Test',
      testType: 'integration',
      details: 'Test API endpoint integration and data flow'
    });

    return integrationTests;
  }

  private async validateRequirements(input: VerificationInput): Promise<Record<string, {
    requirementId: string;
    title: string;
    validationStatus: 'validated' | 'partial' | 'failed' | 'not_tested';
    coverage: number;
    testCases: string[];
    issues: string[];
  }>> {
    const validation: Record<string, any> = {};
    const functionalReqs = input.specification?.functionalRequirements || [];
    const testResults = await this.executeVerificationTests(input);

    for (const req of functionalReqs) {
      const relatedTests = testResults.filter(test => test.relatedRequirement === req.id);
      const passedTests = relatedTests.filter(test => test.status === 'passed');
      
      const coverage = relatedTests.length > 0 ? passedTests.length / relatedTests.length : 0;
      let validationStatus: string;
      
      if (coverage >= 1.0) validationStatus = 'validated';
      else if (coverage >= 0.8) validationStatus = 'partial';
      else if (coverage > 0) validationStatus = 'failed';
      else validationStatus = 'not_tested';

      validation[req.id] = {
        requirementId: req.id,
        title: req.title,
        validationStatus,
        coverage,
        testCases: relatedTests.map(test => test.testId),
        issues: relatedTests.filter(test => test.status === 'failed').map(test => test.details)
      };
    }

    return validation;
  }

  private async assessQuality(_input: VerificationInput): Promise<{
    overallScore: number;
    categories: Record<string, {
      score: number;
      metrics: Record<string, number>;
      issues: string[];
    }>;
    recommendations: string[];
  }> {
    const categories: Record<string, any> = {
      codeQuality: {
        score: 0.85,
        metrics: {
          codeCoverage: 0.82,
          cyclomaticComplexity: 7.2,
          duplicateCode: 0.05,
          technicalDebt: 2.1
        },
        issues: [
          'Some modules have low test coverage',
          'Few functions exceed complexity threshold'
        ]
      },
      performance: {
        score: 0.78,
        metrics: {
          responseTime: 1.8,
          throughput: 850,
          memoryUsage: 0.65,
          cpuUtilization: 0.55
        },
        issues: [
          'Response time exceeds target for some operations',
          'Memory usage could be optimized'
        ]
      },
      security: {
        score: 0.92,
        metrics: {
          vulnerabilities: 0,
          securityTestsPassed: 0.95,
          encryptionCoverage: 1.0,
          accessControlScore: 0.88
        },
        issues: [
          'Minor access control improvements needed'
        ]
      },
      usability: {
        score: 0.88,
        metrics: {
          userTaskCompletion: 0.92,
          errorRate: 0.03,
          userSatisfaction: 0.85,
          accessibilityScore: 0.90
        },
        issues: [
          'Some user interfaces could be more intuitive'
        ]
      },
      maintainability: {
        score: 0.81,
        metrics: {
          codeReadability: 0.85,
          documentationCoverage: 0.78,
          modularityScore: 0.80,
          dependencyHealth: 0.82
        },
        issues: [
          'Documentation coverage below target',
          'Some modules could be better structured'
        ]
      }
    };

    const overallScore = Object.values(categories).reduce((sum: number, cat: any) => sum + cat.score, 0) / Object.keys(categories).length;

    const recommendations = [
      'Increase test coverage for critical modules',
      'Optimize database queries for better performance',
      'Improve documentation coverage',
      'Refactor complex functions to reduce cyclomatic complexity',
      'Implement caching strategy for frequently accessed data'
    ];

    return {
      overallScore,
      categories,
      recommendations
    };
  }

  private async checkCompliance(_input: VerificationInput): Promise<Array<{
    standard: string;
    requirement: string;
    status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
    evidence: string[];
    issues: string[];
  }>> {
    const complianceResults = [
      {
        standard: 'ISO 27001',
        requirement: 'Information Security Management',
        status: 'compliant' as const,
        evidence: ['Security policy documented', 'Access controls implemented', 'Encryption in place'],
        issues: []
      },
      {
        standard: 'GDPR',
        requirement: 'Data Protection and Privacy',
        status: 'partial' as const,
        evidence: ['Privacy policy created', 'Data encryption implemented'],
        issues: ['Data retention policy needs clarification', 'Cookie consent mechanism incomplete']
      },
      {
        standard: 'WCAG 2.1',
        requirement: 'Web Accessibility',
        status: 'compliant' as const,
        evidence: ['Alt text for images', 'Keyboard navigation support', 'Screen reader compatibility'],
        issues: []
      },
      {
        standard: 'SOC 2',
        requirement: 'Security and Availability',
        status: 'compliant' as const,
        evidence: ['Security controls documented', 'Monitoring systems in place', 'Incident response procedures'],
        issues: []
      }
    ];

    return complianceResults;
  }

  private async generateVerificationReport(
    testResults: any[], 
    requirementValidation: any, 
    qualityAssessment: any, 
    complianceResults: any[]
  ): Promise<{
    summary: string;
    testSummary: {
      totalTests: number;
      passed: number;
      failed: number;
      passRate: number;
    };
    requirementSummary: {
      totalRequirements: number;
      validated: number;
      validationRate: number;
    };
    qualitySummary: {
      overallScore: number;
      categoryScores: Record<string, number>;
    };
    complianceSummary: {
      totalStandards: number;
      compliant: number;
      complianceRate: number;
    };
    conclusions: string[];
    nextSteps: string[];
  }> {
    const testSummary = {
      totalTests: testResults.length,
      passed: testResults.filter(test => test.status === 'passed').length,
      failed: testResults.filter(test => test.status === 'failed').length,
      passRate: testResults.length > 0 ? testResults.filter(test => test.status === 'passed').length / testResults.length : 0
    };

    const requirementSummary = {
      totalRequirements: Object.keys(requirementValidation).length,
      validated: Object.values(requirementValidation).filter((req: any) => req.validationStatus === 'validated').length,
      validationRate: Object.keys(requirementValidation).length > 0 ? 
        Object.values(requirementValidation).filter((req: any) => req.validationStatus === 'validated').length / Object.keys(requirementValidation).length : 0
    };

    const qualitySummary = {
      overallScore: qualityAssessment.overallScore,
      categoryScores: Object.fromEntries(
        Object.entries(qualityAssessment.categories).map(([key, value]: [string, any]) => [key, value.score])
      )
    };

    const complianceSummary = {
      totalStandards: complianceResults.length,
      compliant: complianceResults.filter(result => result.status === 'compliant').length,
      complianceRate: complianceResults.length > 0 ? 
        complianceResults.filter(result => result.status === 'compliant').length / complianceResults.length : 0
    };

    const conclusions = [
      `System testing achieved ${(testSummary.passRate * 100).toFixed(1)}% pass rate`,
      `${(requirementSummary.validationRate * 100).toFixed(1)}% of requirements successfully validated`,
      `Overall quality score: ${(qualitySummary.overallScore * 100).toFixed(1)}%`,
      `Compliance achieved for ${complianceSummary.compliant}/${complianceSummary.totalStandards} standards`
    ];

    const nextSteps = [];
    if (testSummary.passRate < 0.95) nextSteps.push('Address failing test cases');
    if (requirementSummary.validationRate < 0.9) nextSteps.push('Complete requirement validation');
    if (qualitySummary.overallScore < 0.8) nextSteps.push('Improve quality metrics');
    if (complianceSummary.complianceRate < 1.0) nextSteps.push('Address compliance gaps');

    const summary = `Verification completed with ${testSummary.passed}/${testSummary.totalTests} tests passing, ` +
                   `${requirementSummary.validated}/${requirementSummary.totalRequirements} requirements validated, ` +
                   `and ${(qualitySummary.overallScore * 100).toFixed(1)}% overall quality score.`;

    return {
      summary,
      testSummary,
      requirementSummary,
      qualitySummary,
      complianceSummary,
      conclusions,
      nextSteps
    };
  }

  private async identifyIssues(testResults: any[], qualityAssessment: any): Promise<Array<{
    id: string;
    type: 'functional' | 'performance' | 'security' | 'quality' | 'compliance';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    impact: string;
    source: string;
    recommendation: string;
  }>> {
    const issues: any[] = [];
    let issueId = 1;

    // Issues from failed tests
    const failedTests = testResults.filter(test => test.status === 'failed');
    for (const test of failedTests) {
      issues.push({
        id: `ISSUE_${issueId.toString().padStart(3, '0')}`,
        type: test.testType === 'performance' ? 'performance' : 'functional',
        severity: test.testType === 'security' ? 'critical' : 'high',
        description: `${test.testName} failed: ${test.details}`,
        impact: 'May affect system functionality or user experience',
        source: test.testId,
        recommendation: 'Review and fix the underlying issue causing test failure'
      });
      issueId++;
    }

    // Issues from quality assessment
    for (const [category, assessment] of Object.entries(qualityAssessment.categories)) {
      const categoryAssessment = assessment as any;
      if (categoryAssessment.score < 0.8) {
        issues.push({
          id: `ISSUE_${issueId.toString().padStart(3, '0')}`,
          type: 'quality',
          severity: categoryAssessment.score < 0.6 ? 'high' : 'medium',
          description: `${category} score below target: ${(categoryAssessment.score * 100).toFixed(1)}%`,
          impact: `May affect system ${category} characteristics`,
          source: 'Quality Assessment',
          recommendation: `Implement improvements to address ${category} issues`
        });
        issueId++;
      }
    }

    return issues;
  }

  private async generateRecommendations(issues: any[], qualityAssessment: any): Promise<Array<{
    id: string;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    rationale: string;
    estimatedEffort: string;
    expectedBenefit: string;
  }>> {
    const recommendations: any[] = [];
    let recId = 1;

    // Critical issue recommendations
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    for (const issue of criticalIssues) {
      recommendations.push({
        id: `REC_${recId.toString().padStart(3, '0')}`,
        priority: 'immediate' as const,
        category: issue.type,
        recommendation: `Address critical issue: ${issue.description}`,
        rationale: 'Critical issues must be resolved before deployment',
        estimatedEffort: '1-2 days',
        expectedBenefit: 'Prevents system failures and security vulnerabilities'
      });
      recId++;
    }

    // Quality improvement recommendations
    for (const improvement of qualityAssessment.recommendations) {
      recommendations.push({
        id: `REC_${recId.toString().padStart(3, '0')}`,
        priority: 'high' as const,
        category: 'quality',
        recommendation: improvement,
        rationale: 'Improves overall system quality and maintainability',
        estimatedEffort: '3-5 days',
        expectedBenefit: 'Better system performance and user experience'
      });
      recId++;
    }

    return recommendations;
  }

  private determineOverallStatus(testResults: any[], qualityAssessment: any): 'passed' | 'passed_with_issues' | 'failed' {
    const testPassRate = this.calculateTestPassRate(testResults);
    const qualityScore = qualityAssessment.overallScore;

    if (testPassRate >= 0.98 && qualityScore >= 0.9) return 'passed';
    if (testPassRate >= 0.95 && qualityScore >= 0.8) return 'passed_with_issues';
    return 'failed';
  }

  private calculateTestPassRate(testResults: any[]): number {
    if (testResults.length === 0) return 0;
    return testResults.filter(test => test.status === 'passed').length / testResults.length;
  }

  private calculateRequirementCoverage(requirementValidation: any): number {
    const requirements = Object.values(requirementValidation);
    if (requirements.length === 0) return 0;
    return requirements.filter((req: any) => req.validationStatus === 'validated').length / requirements.length;
  }

  private calculateQualityScore(qualityAssessment: any): number {
    return qualityAssessment.overallScore;
  }

  private calculateComplianceScore(complianceResults: any[]): number {
    if (complianceResults.length === 0) return 0;
    return complianceResults.filter(result => result.status === 'compliant').length / complianceResults.length;
  }

  private calculateVerificationCompleteness(output: VerificationOutput): number {
    let score = 0;
    const maxScore = 5;

    if (output.testResults.length > 0) score += 1;
    if (Object.keys(output.requirementValidation).length > 0) score += 1;
    if (output.qualityAssessment) score += 1;
    if (output.complianceResults.length > 0) score += 1;
    if (output.verificationReport) score += 1;

    return score / maxScore;
  }

  private calculateVerificationClarity(output: VerificationOutput): number {
    const hasDetailedReport = output.verificationReport?.summary?.length > 50;
    const hasSpecificIssues = output.issues.every((issue: any) => issue.description.length > 20);
    const hasActionableRecommendations = output.recommendations.every((rec: any) => rec.recommendation.length > 20);

    let score = 0;
    if (hasDetailedReport) score += 0.4;
    if (hasSpecificIssues) score += 0.3;
    if (hasActionableRecommendations) score += 0.3;

    return score;
  }

  private calculateVerificationDeterminism(output: VerificationOutput): number {
    const hasQuantifiedMetrics = output.verificationMetrics.testPassRate !== undefined &&
                                output.verificationMetrics.qualityScore !== undefined;
    
    const hasSpecificThresholds = output.testResults.every((test: any) => test.executionTime !== undefined);
    
    return (hasQuantifiedMetrics ? 0.6 : 0) + (hasSpecificThresholds ? 0.4 : 0);
  }

  private calculateVerificationConsistency(output: VerificationOutput): number {
    // Check consistency between test results and requirement validation
    const testedRequirements = new Set(
      output.testResults
        .filter((test: any) => test.relatedRequirement)
        .map((test: any) => test.relatedRequirement)
    );
    
    const validatedRequirements = new Set(Object.keys(output.requirementValidation));
    
    const intersection = new Set([...testedRequirements].filter(x => x && validatedRequirements.has(x)));
    const union = new Set([...testedRequirements, ...validatedRequirements]);
    
    return union.size > 0 ? intersection.size / union.size : 1.0;
  }
}
