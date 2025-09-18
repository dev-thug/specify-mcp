/**
 * Workflow Guard System
 * Prevents premature progression through SDD phases
 * Ensures proper requirement refinement before implementation
 */

import fs from 'fs-extra';
import * as path from 'path';
import { AdvancedQualityAnalyzer } from '../verification/advanced-quality-analyzer.js';
import {
  AgentBehaviorController,
  AgentGuidance,
} from '../enforcement/agent-behavior-controller.js';
import { QualityReporter } from '../quality/quality-reporter.js';
import { DocumentScanner } from '../scanner/document-scanner.js';
import { SemanticQualityAnalyzer } from '../quality/semantic-quality-analyzer.js';
import { PhaseSpecificEvaluator } from '../quality/phase-specific-evaluator.js';
import { IterationQualityTracker } from '../quality/iteration-quality-tracker.js';
import { scoreTransparency } from '../quality/score-transparency.js';
import { SessionMemoryManager } from '../memory/session-memory-manager.js';
import { isFeatureEnabled } from '../config/feature-flags.js';
import { phaseValidator } from '../validators/phase-validator.js';

export interface WorkflowGate {
  phase: 'init' | 'spec' | 'plan' | 'tasks' | 'implement';
  requiredQuality: number; // 0-100
  requiredIterations: number;
  requiredContent: string[];
  blockingConditions: string[];
}

export interface WorkflowStatus {
  currentPhase: 'init' | 'spec' | 'plan' | 'tasks' | 'implement';
  canProceed: boolean;
  blockingReasons: string[];
  qualityScore: number;
  iterationCount: number;
  recommendations: string[];
  agentGuidance: AgentGuidance; // NEW: Strict agent control
  strictInstructions: string; // NEW: Formatted instructions for agent
  detailedReport: string | undefined; // NEW: Detailed quality feedback
  scanReport: string | undefined; // NEW: Document scan results
}

export class WorkflowGuard {
  private readonly qualityAnalyzer = new AdvancedQualityAnalyzer();
  private readonly qualityReporter = new QualityReporter();
  private readonly documentScanner = new DocumentScanner();
  private readonly semanticAnalyzer = new SemanticQualityAnalyzer();
  private readonly phaseEvaluator = new PhaseSpecificEvaluator();
  private readonly iterationTracker = new IterationQualityTracker();
  private readonly scoreTransparency = scoreTransparency;
  private sessionMemory: SessionMemoryManager | null = null; // Ready for session tracking

  constructor() {
    // Initialize components
    void this.scoreTransparency; // Acknowledge for TypeScript
    void this.sessionMemory; // Ready for future use
  }

  private readonly gates: WorkflowGate[] = [
    {
      phase: 'spec',
      requiredQuality: 60, // More achievable baseline
      requiredIterations: 1, // Reduced from 2
      requiredContent: ['user_definition', 'functional_requirements', 'success_criteria'],
      blockingConditions: ['insufficient_detail', 'ambiguous_requirements', 'missing_user_context'],
    },
    {
      phase: 'plan',
      requiredQuality: 55, // Much more realistic for technical plans
      requiredIterations: 1,
      requiredContent: ['architecture', 'technology_stack', 'data_model'],
      blockingConditions: ['incomplete_specification', 'insufficient_technical_detail'],
    },
    {
      phase: 'tasks',
      requiredQuality: 50, // Focus on basic task structure
      requiredIterations: 1,
      requiredContent: ['task_breakdown', 'dependencies', 'testing_strategy'],
      blockingConditions: ['incomplete_planning', 'unclear_task_boundaries'],
    },
    {
      phase: 'implement',
      requiredQuality: 65, // Reasonable implementation readiness
      requiredIterations: 1,
      requiredContent: ['test_cases', 'implementation_guide', 'integration_plan'],
      blockingConditions: ['incomplete_tasks', 'insufficient_tdd_guidance'],
    },
  ];

  async checkPhaseReadiness(
    projectPath: string,
    targetPhase: 'spec' | 'plan' | 'tasks' | 'implement',
    inputParams?: any
  ): Promise<WorkflowStatus> {
    const gate = this.gates.find((g) => g.phase === targetPhase);
    if (!gate) {
      // Generate default agent guidance for unknown phase
      const defaultGuidance = AgentBehaviorController.generateStrictGuidance('init', 0, [
        `Unknown phase: ${targetPhase}`,
      ]);

      return {
        currentPhase: 'init',
        canProceed: false,
        blockingReasons: [`Unknown phase: ${targetPhase}`],
        qualityScore: 0,
        iterationCount: 0,
        recommendations: [],
        agentGuidance: defaultGuidance,
        strictInstructions: AgentBehaviorController.generateAgentInstructions(defaultGuidance),
        detailedReport: undefined,
        scanReport: undefined,
      };
    }

    const specifyPath = path.join(projectPath, '.specify');
    const currentStatus = await this.analyzeCurrentStatusAdvanced(
      specifyPath,
      targetPhase,
      inputParams
    );

    const canProceed = this.evaluateGateAdvanced(currentStatus, gate);
    const blockingReasons = canProceed
      ? []
      : this.generateBlockingReasonsAdvanced(currentStatus, gate);

    // NEW: Generate strict agent behavior control
    const agentGuidance = AgentBehaviorController.generateStrictGuidance(
      targetPhase,
      currentStatus.qualityScore,
      blockingReasons
    );

    const strictInstructions = AgentBehaviorController.generateAgentInstructions(agentGuidance);

    // Generate detailed quality report if quality is insufficient
    let detailedReport: string | undefined;
    let scanReport: string | undefined;

    if (!canProceed || currentStatus.qualityScore < gate.requiredQuality) {
      // Generate detailed feedback for the specific phase
      if (targetPhase === 'spec' && currentStatus.documentExists) {
        // Generate detailed quality report with transparency
        if (currentStatus.qualityScore < gate.requiredQuality) {
          // Generate traditional report
          const content = await this.getDocumentContent(specifyPath, targetPhase);
          const specReport = this.qualityReporter.generateSpecReport(
            content || '',
            currentStatus.qualityScore
          );
          detailedReport = this.qualityReporter.formatReport(specReport);

          // Add transparent score breakdown if enabled
          if (isFeatureEnabled('USE_SEMANTIC_ANALYZER')) {
            const content = await this.getDocumentContent(specifyPath, targetPhase);
            if (content) {
              const semanticResult = this.semanticAnalyzer.analyze(
                content,
                targetPhase as 'spec' | 'plan'
              );

              // Generate score breakdown
              const componentScores: Record<string, number> = {};
              const findings: Record<string, string[]> = {};

              semanticResult.sectionScores.forEach((section) => {
                const componentName = section.sectionName.toLowerCase().replace(/\s+/g, '');
                componentScores[componentName] = section.quality;
                findings[componentName] = [section.feedback];
              });

              const breakdown = this.scoreTransparency.generateBreakdown(
                targetPhase,
                componentScores,
                findings
              );
              const scoreCard = this.scoreTransparency.generateScoreCard(breakdown);

              // Append transparency information
              detailedReport += '\n\n' + breakdown.explanation;
              detailedReport += '\n' + scoreCard;
            }
          }
        }
      } else if (targetPhase === 'plan' && currentStatus.documentExists) {
        const planReport = this.qualityReporter.generatePlanReport(
          (await this.getDocumentContent(specifyPath, 'plan')) || '',
          currentStatus.qualityScore
        );
        detailedReport = this.qualityReporter.formatReport(planReport);
      }

      // If no documents exist, run document scan to find alternatives
      if (!currentStatus.documentExists) {
        try {
          const scanResult = await this.documentScanner.scanProject(projectPath);
          scanReport = this.documentScanner.formatScanReport(scanResult);
        } catch (error) {
          console.warn('Document scan failed:', error);
        }
      }
    }

    return {
      currentPhase: targetPhase,
      canProceed,
      blockingReasons,
      qualityScore: currentStatus.qualityScore,
      iterationCount: currentStatus.iterationCount,
      recommendations: currentStatus.recommendations,
      agentGuidance,
      strictInstructions,
      detailedReport,
      scanReport,
    };
  }

  private calculateQualityScore(content: string, phase: string): number {
    let score = 0;

    // Length score (30 points)
    if (content.length > 2000) score += 30;
    else if (content.length > 1000) score += 20;
    else if (content.length > 500) score += 10;

    // Content quality based on phase (70 points)
    switch (phase) {
      case 'spec':
        score += this.evaluateSpecQuality(content);
        break;
      case 'plan':
        score += this.evaluatePlanQuality(content);
        break;
      default:
        score += 35; // Default moderate score
    }

    return Math.min(score, 100);
  }

  private evaluateSpecQuality(content: string): number {
    let score = 0;
    const lowerContent = content.toLowerCase();

    // Essential elements (더 관대하게 점수 부여)
    const userKeywords = ['사용자', 'user', '고객', 'customer', '이용자', '대상'];
    const functionalKeywords = ['기능', 'function', '역할', '할 수', '할일', '작업', 'task'];
    const purposeKeywords = ['목적', '목표', 'purpose', 'goal', '해결', 'solve', '문제'];
    const requirementKeywords = ['제약', '요구사항', 'requirement', '조건', 'condition'];
    const scenarioKeywords = ['시나리오', 'scenario', 'use case', '상황', '경우'];
    const criteriaKeywords = ['성공기준', 'criteria', '기준', '완료', 'complete'];

    // 각 카테고리별로 키워드가 하나라도 있으면 점수 부여
    if (userKeywords.some((keyword) => lowerContent.includes(keyword))) score += 12;
    if (functionalKeywords.some((keyword) => lowerContent.includes(keyword))) score += 12;
    if (purposeKeywords.some((keyword) => lowerContent.includes(keyword))) score += 12;
    if (requirementKeywords.some((keyword) => lowerContent.includes(keyword))) score += 10;
    if (scenarioKeywords.some((keyword) => lowerContent.includes(keyword))) score += 8;
    if (criteriaKeywords.some((keyword) => lowerContent.includes(keyword))) score += 8;

    // 구체성 보너스 점수 (8점)
    const sentences = content.split(/[.!?]/).filter((s) => s.trim().length > 0);
    if (sentences.length >= 5) score += 4; // 충분한 분량
    if (content.includes('예시') || content.includes('example') || content.includes('예를 들어'))
      score += 4; // 구체적 예시

    // 품질 지표 추가 점수 (10점)
    if (content.length > 800) score += 5; // 충분한 길이
    if (content.split('\n').filter((line) => line.trim()).length > 10) score += 5; // 구조화된 내용

    return Math.min(score, 70); // spec 단계는 최대 70점
  }

  private evaluatePlanQuality(content: string): number {
    let score = 0;
    const lowerContent = content.toLowerCase();

    // Core technical elements (더 관대한 점수)
    const techStackKeywords = [
      'typescript',
      'javascript',
      'python',
      'java',
      'react',
      'vue',
      'next',
      'express',
      'nest',
      'django',
      'spring',
    ];
    const frameworkKeywords = [
      'framework',
      'library',
      '프레임워크',
      '라이브러리',
      'tech stack',
      '기술스택',
    ];
    const dbKeywords = [
      'database',
      'db',
      'mysql',
      'postgres',
      'mongodb',
      'redis',
      'memory',
      '데이터베이스',
    ];
    const archKeywords = ['architecture', 'design', 'structure', '아키텍처', '구조', '설계'];
    const testKeywords = ['test', 'testing', 'jest', 'cypress', 'mocha', '테스트'];

    // 기본 기술 요소 점수 (각 15점씩, 총 60점 가능)
    if (techStackKeywords.some((keyword) => lowerContent.includes(keyword))) score += 15;
    if (frameworkKeywords.some((keyword) => lowerContent.includes(keyword))) score += 15;
    if (dbKeywords.some((keyword) => lowerContent.includes(keyword))) score += 15;
    if (archKeywords.some((keyword) => lowerContent.includes(keyword))) score += 15;

    // 테스팅 전략 (10점)
    if (testKeywords.some((keyword) => lowerContent.includes(keyword))) score += 10;

    // 구체성 보너스 (10점)
    const hasSpecificTech = /typescript|next\.?js|jest|cypress|react|vue|express|nest/i.test(
      content
    );
    if (hasSpecificTech) score += 10;

    return Math.min(score, 70); // 최대 70점
  }

  /**
   * Create virtual content from input parameters for scoring purposes
   */
  private createVirtualContentFromParams(phase: string, params: any): string {
    switch (phase) {
      case 'plan':
        if (params.techStack) {
          const { language, framework, database, testing } = params.techStack;
          return `
# Technical Plan

## Technology Stack
- **Language**: ${language || 'Not specified'}
- **Framework**: ${framework || 'Not specified'}  
- **Database**: ${database || 'Not specified'}
- **Testing**: ${testing || 'Not specified'}

## Architecture
Basic architecture using ${framework || 'the selected framework'} with ${database || 'database'} storage.

## Implementation Approach
Following TDD with ${testing || 'testing framework'} for quality assurance.
          `.trim();
        }
        break;

      case 'spec':
        if (params.description || params.requirements) {
          return `
# Specification

## Description
${params.description || 'Project specification'}

## Requirements
${Array.isArray(params.requirements) ? params.requirements.join('\n- ') : 'Basic requirements defined'}
          `.trim();
        }
        break;
    }

    return `# ${phase.toUpperCase()} Phase\n\nBasic ${phase} structure with provided parameters.`;
  }

  private async getIterationCount(specifyPath: string, phase: string): Promise<number> {
    try {
      const historyPath = path.join(specifyPath, '.workflow-history.json');

      if (!(await fs.pathExists(historyPath))) {
        return 0;
      }

      const history = await fs.readJSON(historyPath);
      const phaseHistory = history[phase] || [];

      return phaseHistory.length;
    } catch {
      return 0;
    }
  }

  async recordIteration(projectPath: string, phase: string, content: string): Promise<string> {
    const specifyPath = path.join(projectPath, '.specify');
    const historyPath = path.join(specifyPath, '.workflow-history.json');

    let history: Record<string, any[]> = {};

    if (await fs.pathExists(historyPath)) {
      history = await fs.readJSON(historyPath);
    }

    if (!history[phase]) {
      history[phase] = [];
    }

    // Use IterationQualityTracker for meaningful iteration tracking
    if (isFeatureEnabled('USE_ITERATION_TRACKER')) {
      // Get previous content if exists
      const previousEntry = history[phase]?.[history[phase].length - 1];
      const previousContent = previousEntry?.content || '';
      const previousScore = previousEntry?.qualityScore || 0;

      // Calculate current score
      let currentScore = 0;
      if (isFeatureEnabled('USE_SEMANTIC_ANALYZER')) {
        const semanticResult = this.semanticAnalyzer.analyze(content, phase as 'spec' | 'plan');
        currentScore = semanticResult.totalScore;
      } else {
        currentScore = this.calculateQualityScore(content, phase);
      }

      // Track iteration with quality analysis
      const analysis = this.iterationTracker.trackIteration(
        projectPath,
        previousContent,
        content,
        previousScore,
        currentScore,
        [] // TODO: Add feedback from previous iteration
      );

      // Record detailed iteration data
      const phaseHistory = history[phase];
      if (phaseHistory) {
        phaseHistory.push({
          timestamp: new Date().toISOString(),
          contentLength: content.length,
          qualityScore: currentScore,
          content: content, // Store for next comparison
          analysis: {
            meaningful: analysis.meaningful,
            qualityImprovement: analysis.qualityImprovement.improvement,
            contentDelta: analysis.contentDelta.netWordChange,
            summary: analysis.summary,
          },
        });
      }

      await fs.writeJSON(historyPath, history, { spaces: 2 });

      // Return iteration summary for user feedback
      return (
        `🔄 **Iteration Tracked**: ${analysis.summary}\n` +
        `• Quality: ${currentScore.toFixed(0)}/100 (${analysis.qualityImprovement.improvement >= 0 ? '+' : ''}${analysis.qualityImprovement.improvement.toFixed(0)} points)\n` +
        `• Content: ${analysis.contentDelta.netWordChange >= 0 ? '+' : ''}${analysis.contentDelta.netWordChange} words\n` +
        `• Meaningful: ${analysis.meaningful ? '✅ Yes' : '⚠️ Minor revision'}`
      );
    } else {
      // Fallback to simple tracking
      const phaseHistory = history[phase];
      if (phaseHistory) {
        phaseHistory.push({
          timestamp: new Date().toISOString(),
          contentLength: content.length,
          qualityScore: this.calculateQualityScore(content, phase),
        });
      }

      await fs.writeJSON(historyPath, history, { spaces: 2 });
      return '✅ Iteration recorded';
    }
  }

  private async getDocumentContent(specifyPath: string, phase: string): Promise<string | null> {
    try {
      let documentPath: string;

      switch (phase) {
        case 'spec':
          documentPath = path.join(specifyPath, 'spec', 'current.md');
          break;
        case 'plan':
          documentPath = path.join(specifyPath, 'plan', 'current.md');
          break;
        default:
          return null;
      }

      if (await fs.pathExists(documentPath)) {
        return await fs.readFile(documentPath, 'utf-8');
      }

      return null;
    } catch (error) {
      console.warn(`Could not read document for phase ${phase}:`, error);
      return null;
    }
  }

  // New advanced analysis methods
  private async analyzeCurrentStatusAdvanced(
    specifyPath: string,
    phase: string,
    inputParams?: any
  ): Promise<{
    qualityScore: number;
    iterationCount: number;
    recommendations: string[];
    documentExists: boolean;
  }> {
    let documentPath: string;

    switch (phase) {
      case 'spec':
        documentPath = path.join(specifyPath, 'spec', 'current.md');
        break;
      case 'plan':
        documentPath = path.join(specifyPath, 'plan', 'current.md');
        break;
      case 'tasks':
        documentPath = path.join(specifyPath, 'tasks');
        break;
      case 'implement':
        documentPath = path.join(specifyPath, 'implementations');
        break;
      default:
        return {
          qualityScore: 0,
          iterationCount: 0,
          recommendations: [`Unknown phase: ${phase}`],
          documentExists: false,
        };
    }

    const documentExists = await fs.pathExists(documentPath);
    let content = '';

    // Try to read existing document first
    if (documentExists) {
      try {
        content = await fs.readFile(documentPath, 'utf-8');
      } catch (error) {
        console.warn(`Could not read ${documentPath}:`, error);
      }
    }

    // If no document exists but we have input parameters, create virtual content for scoring
    if (!documentExists && inputParams) {
      content = this.createVirtualContentFromParams(phase, inputParams);
    }

    // If still no content, return minimal score but allow progress for simple cases
    if (!content || content.trim().length === 0) {
      return {
        qualityScore: inputParams ? 20 : 0, // Give some credit for having parameters
        iterationCount: 0,
        recommendations: [`No ${phase} content found - create detailed ${phase} document`],
        documentExists: false,
      };
    }

    // For file-based phases, use quality analyzers
    if (phase === 'spec' || phase === 'plan') {
      try {
        let qualityScore: number;
        let recommendations: string[];

        // Use new quality systems if feature flags are enabled
        if (isFeatureEnabled('USE_SEMANTIC_ANALYZER')) {
          const startTime = Date.now();

          // New semantic analysis
          const semanticResult = this.semanticAnalyzer.analyze(content, phase as 'spec' | 'plan');
          qualityScore = semanticResult.totalScore;
          recommendations = [...semanticResult.improvements, ...semanticResult.strengths];

          // Phase-specific evaluation if enabled
          if (isFeatureEnabled('USE_PHASE_EVALUATOR')) {
            const phaseResult = this.phaseEvaluator.evaluate(content, phase);

            // Add phase-specific feedback
            if (phaseResult.misplacedExpectations.length > 0) {
              recommendations.push(
                `⚠️ Content that belongs in other phases: ${phaseResult.misplacedExpectations.join(', ')}`
              );
            }

            // Log phase evaluation
            console.log(`📂 Phase-Specific Evaluation for ${phase}:`);
            console.log(`  Appropriate content: ${phaseResult.appropriateCriteria ? '✅' : '❌'}`);
            console.log(`  Misplaced items: ${phaseResult.misplacedExpectations.length}`);
          }
          
          // Additional validation using PhaseValidator
          const strictValidation = phaseValidator.validatePhase(phase, content);
          if (!strictValidation.valid) {
            recommendations.push(...strictValidation.suggestions);
          }

          // Log comparison if enabled
          if (isFeatureEnabled('LOG_QUALITY_COMPARISON')) {
            try {
              const oldAssessment = await this.qualityAnalyzer.analyzeSpecification(content, phase);
              const oldScore = oldAssessment.overallScore;

              console.log(`📊 Quality Score Comparison for ${phase}:`);
              console.log(`  Old System: ${oldScore.toFixed(1)}/100`);
              console.log(`  New System: ${qualityScore.toFixed(1)}/100`);
              console.log(`  Difference: ${(qualityScore - oldScore).toFixed(1)} points`);

              if (isFeatureEnabled('LOG_PERFORMANCE_METRICS')) {
                const processingTime = Date.now() - startTime;
                console.log(`  Processing Time: ${processingTime}ms`);
              }
            } catch (comparisonError) {
              console.warn('Could not compare scores:', comparisonError);
            }
          }
        } else {
          // Use old system
          const qualityAssessment = await this.qualityAnalyzer.analyzeSpecification(content, phase);
          qualityScore = qualityAssessment.overallScore;
          recommendations = qualityAssessment.recommendations;
        }

        const iterationCount = await this.getIterationCount(specifyPath, phase);

        return {
          qualityScore,
          iterationCount,
          recommendations,
          documentExists: documentExists,
        };
      } catch (error) {
        // Fallback behavior
        if (isFeatureEnabled('FALLBACK_ON_ERROR')) {
          console.warn(`Quality analysis failed, using fallback: ${error}`);
          const simpleScore = this.calculateQualityScore(content, phase);
          return {
            qualityScore: simpleScore,
            iterationCount: 0,
            recommendations: [`Using simple scoring due to analyzer error: ${error}`],
            documentExists: documentExists,
          };
        } else {
          throw error;
        }
      }
    }

    // For directory-based phases (tasks, implement)
    try {
      const entries = await fs.readdir(documentPath);
      const hasContent = entries.length > 0;

      return {
        qualityScore: hasContent ? 70 : 0, // Basic score for having structure
        iterationCount: hasContent ? 1 : 0,
        recommendations: hasContent ? [] : [`No ${phase} content found`],
        documentExists: hasContent,
      };
    } catch {
      return {
        qualityScore: 0,
        iterationCount: 0,
        recommendations: [`${phase} directory not accessible`],
        documentExists: false,
      };
    }
  }

  private evaluateGateAdvanced(
    status: { qualityScore: number; iterationCount: number; documentExists: boolean },
    gate: WorkflowGate
  ): boolean {
    if (!status.documentExists) return false;
    if (status.qualityScore < gate.requiredQuality) return false;
    if (status.iterationCount < gate.requiredIterations) return false;

    return true;
  }

  private generateBlockingReasonsAdvanced(
    status: {
      qualityScore: number;
      iterationCount: number;
      documentExists: boolean;
      recommendations: string[];
    },
    gate: WorkflowGate
  ): string[] {
    const reasons: string[] = [];

    if (!status.documentExists) {
      reasons.push(`${gate.phase} document does not exist`);
    }

    if (status.qualityScore < gate.requiredQuality) {
      reasons.push(
        `Quality score insufficient (${status.qualityScore.toFixed(0)}/${gate.requiredQuality} required)`
      );
    }

    if (status.iterationCount < gate.requiredIterations) {
      reasons.push(
        `Insufficient iterations (${status.iterationCount}/${gate.requiredIterations} required)`
      );
    }

    // Add specific quality issues
    if (status.recommendations.length > 0) {
      reasons.push('Quality issues identified:');
      reasons.push(...status.recommendations.slice(0, 3).map((rec) => `  • ${rec}`));
    }

    return reasons;
  }
}
