/**
 * Workflow Guard System
 * Prevents premature progression through SDD phases
 * Ensures proper requirement refinement before implementation
 */

import fs from 'fs-extra';
import * as path from 'path';
import { AdvancedQualityAnalyzer } from '../verification/advanced-quality-analyzer.js';

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
}

export class WorkflowGuard {
  private readonly qualityAnalyzer = new AdvancedQualityAnalyzer();
  
  private readonly gates: WorkflowGate[] = [
    {
      phase: 'spec',
      requiredQuality: 75, // AI-SDD standard: High quality specifications
      requiredIterations: 2, // Iterative refinement required
      requiredContent: ['user_definition', 'functional_requirements', 'success_criteria'],
      blockingConditions: ['insufficient_detail', 'ambiguous_requirements', 'missing_user_context']
    },
    {
      phase: 'plan', 
      requiredQuality: 80, // Technical precision required
      requiredIterations: 1,
      requiredContent: ['architecture', 'technology_stack', 'data_model'],
      blockingConditions: ['incomplete_specification', 'insufficient_technical_detail']
    },
    {
      phase: 'tasks',
      requiredQuality: 78, // Task clarity for TDD approach
      requiredIterations: 1,
      requiredContent: ['task_breakdown', 'dependencies', 'testing_strategy'],
      blockingConditions: ['incomplete_planning', 'unclear_task_boundaries']
    },
    {
      phase: 'implement',
      requiredQuality: 85, // Implementation guides must be precise
      requiredIterations: 1,
      requiredContent: ['test_cases', 'implementation_guide', 'integration_plan'],
      blockingConditions: ['incomplete_tasks', 'insufficient_tdd_guidance']
    }
  ];

  async checkPhaseReadiness(
    projectPath: string, 
    targetPhase: 'spec' | 'plan' | 'tasks' | 'implement'
  ): Promise<WorkflowStatus> {
    const gate = this.gates.find(g => g.phase === targetPhase);
    if (!gate) {
      return {
        currentPhase: 'init',
        canProceed: false,
        blockingReasons: [`Unknown phase: ${targetPhase}`],
        qualityScore: 0,
        iterationCount: 0,
        recommendations: []
      };
    }

    const specifyPath = path.join(projectPath, '.specify');
    const currentStatus = await this.analyzeCurrentStatusAdvanced(specifyPath, targetPhase);
    
    const canProceed = this.evaluateGateAdvanced(currentStatus, gate);
    
    return {
      currentPhase: targetPhase,
      canProceed,
      blockingReasons: canProceed ? [] : this.generateBlockingReasonsAdvanced(currentStatus, gate),
      qualityScore: currentStatus.qualityScore,
      iterationCount: currentStatus.iterationCount,
      recommendations: currentStatus.recommendations
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
    if (userKeywords.some(keyword => lowerContent.includes(keyword))) score += 12;
    if (functionalKeywords.some(keyword => lowerContent.includes(keyword))) score += 12;
    if (purposeKeywords.some(keyword => lowerContent.includes(keyword))) score += 12;
    if (requirementKeywords.some(keyword => lowerContent.includes(keyword))) score += 10;
    if (scenarioKeywords.some(keyword => lowerContent.includes(keyword))) score += 8;
    if (criteriaKeywords.some(keyword => lowerContent.includes(keyword))) score += 8;
    
    // 구체성 보너스 점수 (8점)
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length >= 5) score += 4; // 충분한 분량
    if (content.includes('예시') || content.includes('example') || content.includes('예를 들어')) score += 4; // 구체적 예시
    
    // 품질 지표 추가 점수 (10점)
    if (content.length > 800) score += 5; // 충분한 길이
    if (content.split('\n').filter(line => line.trim()).length > 10) score += 5; // 구조화된 내용
    
    return Math.min(score, 70); // spec 단계는 최대 70점
  }

  private evaluatePlanQuality(content: string): number {
    let score = 0;
    
    // Check for technical elements
    if (content.includes('아키텍처') || content.includes('architecture')) score += 15;
    if (content.includes('기술스택') || content.includes('tech stack')) score += 15;
    if (content.includes('데이터베이스') || content.includes('database')) score += 10;
    if (content.includes('API') || content.includes('interface')) score += 10;
    if (content.includes('보안') || content.includes('security')) score += 10;
    if (content.includes('성능') || content.includes('performance')) score += 5;
    
    return score;
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


  async recordIteration(projectPath: string, phase: string, content: string): Promise<void> {
    const specifyPath = path.join(projectPath, '.specify');
    const historyPath = path.join(specifyPath, '.workflow-history.json');
    
    let history: Record<string, any[]> = {};
    
    if (await fs.pathExists(historyPath)) {
      history = await fs.readJSON(historyPath);
    }
    
    if (!history[phase]) {
      history[phase] = [];
    }
    
    history[phase].push({
      timestamp: new Date().toISOString(),
      contentLength: content.length,
      qualityScore: this.calculateQualityScore(content, phase)
    });
    
    await fs.writeJSON(historyPath, history, { spaces: 2 });
  }

  // New advanced analysis methods
  private async analyzeCurrentStatusAdvanced(
    specifyPath: string, 
    phase: string
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
          documentExists: false
        };
    }

    const documentExists = await fs.pathExists(documentPath);
    
    if (!documentExists) {
      return {
        qualityScore: 0,
        iterationCount: 0,
        recommendations: [`No ${phase} document found`],
        documentExists: false
      };
    }

    // For file-based phases, use advanced quality analyzer
    if (phase === 'spec' || phase === 'plan') {
      try {
        const content = await fs.readFile(documentPath, 'utf-8');
        const qualityAssessment = await this.qualityAnalyzer.analyzeSpecification(content, phase);
        const iterationCount = await this.getIterationCount(specifyPath, phase);
        
        return {
          qualityScore: qualityAssessment.overallScore,
          iterationCount,
          recommendations: qualityAssessment.recommendations,
          documentExists: true
        };
      } catch (error) {
        return {
          qualityScore: 0,
          iterationCount: 0,
          recommendations: [`Error reading ${phase} document: ${error}`],
          documentExists: false
        };
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
        documentExists: hasContent
      };
    } catch {
      return {
        qualityScore: 0,
        iterationCount: 0,
        recommendations: [`${phase} directory not accessible`],
        documentExists: false
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
    status: { qualityScore: number; iterationCount: number; documentExists: boolean; recommendations: string[] },
    gate: WorkflowGate
  ): string[] {
    const reasons: string[] = [];
    
    if (!status.documentExists) {
      reasons.push(`${gate.phase} document does not exist`);
    }
    
    if (status.qualityScore < gate.requiredQuality) {
      reasons.push(`Quality score insufficient (${status.qualityScore.toFixed(0)}/${gate.requiredQuality} required)`);
    }
    
    if (status.iterationCount < gate.requiredIterations) {
      reasons.push(`Insufficient iterations (${status.iterationCount}/${gate.requiredIterations} required)`);
    }

    // Add specific quality issues
    if (status.recommendations.length > 0) {
      reasons.push('Quality issues identified:');
      reasons.push(...status.recommendations.slice(0, 3).map(rec => `  • ${rec}`));
    }
    
    return reasons;
  }
}
