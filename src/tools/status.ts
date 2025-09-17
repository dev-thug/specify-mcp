/**
 * Project Status Tool for SDD
 * Analyzes project status and provides workflow guidance
 */

import { ResourceManager } from '../resources/manager.js';
import fs from 'fs-extra';
import * as path from 'path';

export interface StatusToolParams {
  projectDirectory?: string;
  detailed?: boolean;
}

export interface ProjectStatus {
  phase: 'init' | 'spec' | 'plan' | 'tasks' | 'implement' | 'complete';
  completedSteps: string[];
  nextSteps: string[];
  missingDocuments: string[];
  recommendations: string[];
  quality: {
    score: number;
    issues: string[];
  };
}

export class StatusTool {
  constructor(
    private readonly resourceManager: ResourceManager
  ) {}

  async execute(params: StatusToolParams): Promise<string> {
    const { projectDirectory, detailed = false } = params;

    try {
      // Load project
      const targetDir = projectDirectory || process.cwd();
      const projectId = await this.resourceManager.loadProject(targetDir);
      
      if (!projectId) {
        return this.generateNotInitializedMessage(targetDir);
      }

      // Analyze project status
      const status = await this.analyzeProjectStatus(projectId, targetDir);
      
      return detailed 
        ? this.generateDetailedStatusReport(status, targetDir)
        : this.generateQuickStatusReport(status, targetDir);

    } catch (error) {
      return `❌ **상태 분석 실패**: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async analyzeProjectStatus(_projectId: string, projectDir: string): Promise<ProjectStatus> {
    const specifyPath = path.join(projectDir, '.specify');
    
    // Check existing documents
    const existingDocs = await this.getExistingDocuments(specifyPath);
    const completedSteps = this.determineCompletedSteps(existingDocs);
    const phase = this.determineCurrentPhase(completedSteps);
    const nextSteps = this.generateNextSteps(phase, completedSteps);
    const missingDocuments = this.findMissingDocuments(phase, existingDocs);
    const recommendations = await this.generateRecommendations(phase, existingDocs, specifyPath);
    const quality = await this.assessQuality(existingDocs, specifyPath);

    return {
      phase,
      completedSteps,
      nextSteps,
      missingDocuments,
      recommendations,
      quality
    };
  }

  private async getExistingDocuments(specifyPath: string): Promise<string[]> {
    const docs: string[] = [];
    
    // Check standard files
    const standardFiles = [
      'project.json',
      'spec/current.md',
      'plan/current.md',
      'plan/research.md',
      'plan/data-model.md'
    ];

    for (const file of standardFiles) {
      const filePath = path.join(specifyPath, file);
      if (await fs.pathExists(filePath)) {
        docs.push(file);
      }
    }

    // Check tasks
    const tasksDir = path.join(specifyPath, 'tasks');
    if (await fs.pathExists(tasksDir)) {
      const taskFolders = await fs.readdir(tasksDir);
      for (const folder of taskFolders) {
        const folderPath = path.join(tasksDir, folder);
        if ((await fs.stat(folderPath)).isDirectory()) {
          docs.push(`tasks/${folder}/index.md`);
        }
      }
    }

    // Check implementations
    const implDir = path.join(specifyPath, 'implementations');
    if (await fs.pathExists(implDir)) {
      const implFolders = await fs.readdir(implDir);
      for (const folder of implFolders) {
        const folderPath = path.join(implDir, folder);
        if ((await fs.stat(folderPath)).isDirectory()) {
          docs.push(`implementations/${folder}/index.md`);
        }
      }
    }

    return docs;
  }

  private determineCompletedSteps(existingDocs: string[]): string[] {
    const steps: string[] = [];
    
    if (existingDocs.includes('project.json')) {
      steps.push('초기화 (Init)');
    }
    
    if (existingDocs.includes('spec/current.md')) {
      steps.push('요구사항 명세 (Specification)');
    }
    
    if (existingDocs.includes('plan/current.md')) {
      steps.push('기술 계획 (Plan)');
    }
    
    if (existingDocs.some(doc => doc.startsWith('tasks/'))) {
      steps.push('작업 분해 (Tasks)');
    }
    
    if (existingDocs.some(doc => doc.startsWith('implementations/'))) {
      steps.push('구현 가이드 (Implementation)');
    }

    return steps;
  }

  private determineCurrentPhase(completedSteps: string[]): ProjectStatus['phase'] {
    if (completedSteps.includes('구현 가이드 (Implementation)')) return 'implement';
    if (completedSteps.includes('작업 분해 (Tasks)')) return 'tasks';
    if (completedSteps.includes('기술 계획 (Plan)')) return 'plan';
    if (completedSteps.includes('요구사항 명세 (Specification)')) return 'spec';
    if (completedSteps.includes('초기화 (Init)')) return 'init';
    return 'init';
  }

  private generateNextSteps(phase: ProjectStatus['phase'], _completedSteps: string[]): string[] {
    const allSteps = [
      { phase: 'init', step: '프로젝트 초기화', tool: 'specify_init' },
      { phase: 'spec', step: '요구사항 명세 작성', tool: 'specify_requirements' },
      { phase: 'plan', step: '기술 계획 수립', tool: 'specify_plan' },
      { phase: 'tasks', step: '작업 분해', tool: 'specify_tasks' },
      { phase: 'implement', step: '구현 가이드 생성', tool: 'specify_implement' }
    ];

    const phaseOrder = ['init', 'spec', 'plan', 'tasks', 'implement'];
    const currentPhaseIndex = phaseOrder.indexOf(phase);
    
    const nextSteps: string[] = [];
    
    // Add current phase recommendations
    if (currentPhaseIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentPhaseIndex + 1];
      const nextStep = allSteps.find(s => s.phase === nextPhase);
      if (nextStep) {
        nextSteps.push(`${nextStep.step} (\`${nextStep.tool}\`)`);
      }
    }

    // Add quality improvements
    nextSteps.push('문서 품질 검토 (`specify_manage action=list`)');
    nextSteps.push('프로젝트 동기화 확인');

    return nextSteps;
  }

  private findMissingDocuments(phase: ProjectStatus['phase'], existingDocs: string[]): string[] {
    const requiredByPhase: Record<string, string[]> = {
      'init': ['project.json'],
      'spec': ['project.json', 'spec/current.md'],
      'plan': ['project.json', 'spec/current.md', 'plan/current.md'],
      'tasks': ['project.json', 'spec/current.md', 'plan/current.md', 'tasks/T001/index.md'],
      'implement': ['project.json', 'spec/current.md', 'plan/current.md', 'tasks/T001/index.md', 'implementations/T001/index.md']
    };

    const required = requiredByPhase[phase] || [];
    return required.filter(doc => !existingDocs.includes(doc));
  }

  private async generateRecommendations(
    phase: ProjectStatus['phase'], 
    existingDocs: string[], 
    specifyPath: string
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Phase-specific recommendations
    switch (phase) {
      case 'init':
        recommendations.push('요구사항을 구체적으로 정의하여 명세서를 작성하세요');
        break;
      case 'spec':
        recommendations.push('기술 스택과 아키텍처를 결정하여 계획서를 작성하세요');
        break;
      case 'plan':
        recommendations.push('구현 가능한 작업 단위로 분해하세요');
        break;
      case 'tasks':
        recommendations.push('TDD 방식으로 구현 가이드를 작성하세요');
        break;
      case 'implement':
        recommendations.push('문서를 참고하여 실제 구현을 시작하세요');
        break;
    }

    // Document quality recommendations
    if (existingDocs.includes('spec/current.md')) {
      const specContent = await this.readDocumentSafely(path.join(specifyPath, 'spec/current.md'));
      if (specContent && specContent.length < 500) {
        recommendations.push('요구사항 명세서가 너무 간단합니다. 더 구체적으로 작성하세요');
      }
    }

    // Missing complementary documents
    if (existingDocs.includes('plan/current.md') && !existingDocs.includes('plan/research.md')) {
      recommendations.push('기술 연구 문서(research.md)를 추가하세요');
    }

    if (existingDocs.includes('plan/current.md') && !existingDocs.includes('plan/data-model.md')) {
      recommendations.push('데이터 모델 문서(data-model.md)를 추가하세요');
    }

    return recommendations;
  }

  private async assessQuality(existingDocs: string[], specifyPath: string): Promise<{ score: number; issues: string[] }> {
    let score = 0;
    const issues: string[] = [];
    const maxScore = 100;

    // Basic existence checks (60 points)

    if (existingDocs.includes('project.json')) score += 10;
    else issues.push('프로젝트 메타데이터 누락');

    if (existingDocs.includes('spec/current.md')) score += 20;
    else issues.push('요구사항 명세서 누락');

    if (existingDocs.includes('plan/current.md')) score += 15;
    else issues.push('기술 계획서 누락');

    if (existingDocs.some(doc => doc.startsWith('tasks/'))) score += 15;
    else issues.push('작업 분해 문서 누락');

    // Content quality (30 points)
    const specContent = await this.readDocumentSafely(path.join(specifyPath, 'spec/current.md'));
    if (specContent) {
      if (specContent.length > 1000) score += 15;
      else issues.push('요구사항 명세서가 너무 간단함');

      if (specContent.includes('사용자') || specContent.includes('기능')) score += 15;
      else issues.push('요구사항 명세서에 핵심 요소 부족');
    }

    // Completeness bonus (10 points)
    if (existingDocs.includes('plan/research.md')) score += 5;
    if (existingDocs.includes('plan/data-model.md')) score += 5;

    return { score: Math.min(score, maxScore), issues };
  }

  private async readDocumentSafely(filePath: string): Promise<string | null> {
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readFile(filePath, 'utf-8');
      }
    } catch (error) {
      // Ignore read errors
    }
    return null;
  }

  private generateNotInitializedMessage(targetDir: string): string {
    return `🚨 **프로젝트가 초기화되지 않음**

📁 **확인한 디렉토리**: ${targetDir}

이 디렉토리에 Specify 프로젝트가 초기화되지 않았습니다.

🎯 **다음 중 하나를 선택하세요**:

1. **새 프로젝트 시작**:
   \`\`\`
   specify_init name="프로젝트명" description="설명" projectDirectory="${targetDir}"
   \`\`\`

2. **다른 디렉토리 확인**:
   \`\`\`
   specify_status projectDirectory="/path/to/project"
   \`\`\`

💡 **Specify 프로젝트는 .specify 폴더를 통해 관리됩니다.**`;
  }

  private generateQuickStatusReport(status: ProjectStatus, projectDir: string): string {
    const phaseNames: Record<string, string> = {
      'init': '🚀 초기화',
      'spec': '📋 요구사항 명세',
      'plan': '🏗️ 기술 계획',
      'tasks': '📝 작업 분해',
      'implement': '💻 구현 가이드'
    };

    const progressBar = this.generateProgressBar(status.phase);

    return `🎯 **프로젝트 현황**

📁 **프로젝트**: ${projectDir}
📊 **현재 단계**: ${phaseNames[status.phase]}
📈 **진행률**: ${progressBar}
🏆 **품질 점수**: ${status.quality.score}/100

✅ **완료된 단계**: 
${status.completedSteps.map(step => `   • ${step}`).join('\n')}

🔄 **다음 할 일**:
${status.nextSteps.slice(0, 2).map(step => `   • ${step}`).join('\n')}

${status.missingDocuments.length > 0 ? 
  `❌ **누락된 문서**:\n${status.missingDocuments.map(doc => `   • ${doc}`).join('\n')}\n\n` : ''
}

💡 **자세한 분석**: \`specify_status detailed=true\`
📚 **문서 관리**: \`specify_manage action=list\``;
  }

  private generateDetailedStatusReport(status: ProjectStatus, projectDir: string): string {
    const quick = this.generateQuickStatusReport(status, projectDir);

    const detailed = `

## 📋 **상세 분석**

### 💡 **추천사항**
${status.recommendations.map(rec => `• ${rec}`).join('\n')}

### ⚠️ **품질 이슈**
${status.quality.issues.length > 0 
  ? status.quality.issues.map(issue => `• ${issue}`).join('\n')
  : '• 발견된 이슈 없음 ✨'
}

### 🛠️ **사용 가능한 도구들**
• \`specify_manage\` - 문서 CRUD 관리
• \`specify_requirements\` - 요구사항 작성/수정
• \`specify_plan\` - 기술 계획 수립
• \`specify_tasks\` - 작업 분해
• \`specify_implement\` - 구현 가이드 생성

### 📖 **워크플로우 가이드**
1. **문서 먼저**: 코딩 전에 반드시 관련 문서를 검토하세요
2. **점진적 개선**: 각 단계에서 이전 문서들을 지속적으로 업데이트하세요  
3. **품질 유지**: 정기적으로 \`specify_status\`로 프로젝트 상태를 확인하세요`;

    return quick + detailed;
  }

  private generateProgressBar(phase: ProjectStatus['phase']): string {
    const phases = ['init', 'spec', 'plan', 'tasks', 'implement'];
    const currentIndex = phases.indexOf(phase);
    const totalPhases = phases.length;
    const progress = ((currentIndex + 1) / totalPhases) * 100;

    const filledBlocks = Math.floor(progress / 10);
    const emptyBlocks = 10 - filledBlocks;

    return `${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progress.toFixed(0)}%`;
  }
}
