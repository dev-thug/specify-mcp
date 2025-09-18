/**
 * Spec tool for generating Product Requirements Document (PRD)
 * Focuses on WHAT and WHY, excludes technical details
 */

import fs from 'fs-extra';
import * as path from 'path';
import { z } from 'zod';
import { IVerificationContext } from '../types/index.js';
import { CommonVerifier } from '../verification/common.js';
import { conversationalSpec } from './conversational-spec.js';
import { phaseValidator } from '../validators/phase-validator.js';

// Import the ResourceManager class (defined in the SpecTool class for now)
class ResourceManager {
  constructor(private projectPath: string) {}
  
  async writeResource(uri: string, content: string): Promise<void> {
    // Simple file writing implementation
    const fileName = uri.split('/').pop() || 'current.md';
    const specDir = path.join(this.projectPath, '.specify', 'spec');
    await fs.ensureDir(specDir);
    await fs.writeFile(path.join(specDir, fileName), content);
  }
  
  async readResource(uri: string): Promise<{ text: string }> {
    const fileName = uri.split('/').pop() || 'current.md';
    const specDir = path.join(this.projectPath, '.specify', 'spec');
    const content = await fs.readFile(path.join(specDir, fileName), 'utf-8');
    return { text: content };
  }
}

export interface SpecToolParams {
  projectId: string;
  userInput: string;
  refine?: boolean;
  action?: 'create' | 'update' | 'read';
  projectDirectory?: string;
}

export class SpecTool {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: SpecToolParams): Promise<string> {
    const { projectId, userInput, refine = false, action = 'create' } = params;

    // 사용자 입력이 너무 간단한 경우 대화형 가이드 제공
    if (!refine && userInput.length < 100) {
      return this.generateInteractiveGuide(userInput);
    }

    // action이 read인 경우 기존 문서 읽기
    if (action === 'read') {
      return this.readExistingSpec(projectId);
    }

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

    // Phase-specific validation first
    const phaseValidation = phaseValidator.validatePhase('spec', specification);
    
    // Verify specification
    const verificationContext: IVerificationContext = {
      phase: 'spec',
      content: specification,
      previousVersions,
    };

    const validationResults = await this.verifier.verify(verificationContext);
    let confidence = this.verifier.calculateConfidence(validationResults);
    
    // Adjust confidence based on phase validation
    confidence = confidence * phaseValidation.confidence;

    // Save specification resource
    const specResource = await this.createSpecificationResource(projectId, specification, refine);
    await this.resourceManager.writeResource(specResource.uri, specification);

    // Generate response with validation results
    const errors = validationResults.filter(r => r.type === 'error');
    const warnings = validationResults.filter(r => r.type === 'warning');

    let response = `✅ **요구사항 명세서 ${refine ? '개선' : '생성'} 완료!**\n\n`;
    response += `📊 **신뢰도**: ${(confidence * 100).toFixed(1)}%\n\n`;
    
    // Add phase validation feedback
    if (!phaseValidation.valid || phaseValidation.inappropriateContent.length > 0) {
      response += '🎯 **단계별 콘텐츠 검증**:\n';
      
      if (phaseValidation.inappropriateContent.length > 0) {
        response += '   ⚠️ 제거된 부적절한 콘텐츠:\n';
        phaseValidation.inappropriateContent.forEach(item => {
          response += `      • ${item}\n`;
        });
      }
      
      if (phaseValidation.appropriateContent.length > 0) {
        response += '   ✅ 적절한 콘텐츠:\n';
        phaseValidation.appropriateContent.forEach(item => {
          response += `      • ${item}\n`;
        });
      }
      response += '\n';
    }

    if (errors.length > 0) {
      response += '❌ **오류 (수정 필요)**:\n';
      errors.forEach(e => {
        response += `   • ${e.message}\n     💡 ${e.suggestion}\n`;
      });
      response += '\n';
    }

    if (warnings.length > 0) {
      response += '⚠️ **경고 (검토 권장)**:\n';
      warnings.forEach(w => {
        response += `   • ${w.message}\n`;
      });
      response += '\n';
    }

    response += '💾 **명세서가 프로젝트에 저장되었습니다.**\n\n';
    response += '🔄 **다음 단계**: `specify_plan`으로 기술 계획을 수립하세요.';

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

    // IMPORTANT: Filter out any technical content that doesn't belong in spec
    spec = phaseValidator.filterContent('spec', spec);
    
    // Add phase-specific guidance
    if (!existingContent) {
      spec = phaseValidator.generateGuidance('spec') + '\n\n---\n\n' + spec;
    }

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

  private generateInteractiveGuide(initialInput: string): string {
    return `🤔 **요구사항이 아직 구체적이지 않습니다**

📝 **현재 입력**: "${initialInput}"

💡 **더 구체적인 정보가 필요합니다**. 다음 질문들에 답해주세요:

## 🎯 **핵심 질문들**

### 1️⃣ **사용자와 목적**
- 🙋‍♂️ **주요 사용자는 누구인가요?** (개인, 팀, 기업, 학생 등)
- 🎯 **왜 이 앱이 필요한가요?** (어떤 문제를 해결하나요?)
- 📈 **성공했다면 사용자에게 어떤 가치를 제공하나요?**

### 2️⃣ **핵심 기능**
- ⭐ **가장 중요한 3가지 기능은 무엇인가요?**
- 🔄 **사용자가 주로 하게 될 작업의 흐름은?**
- 🚫 **절대 빠뜨리면 안 되는 기능이 있나요?**

### 3️⃣ **제약사항과 요구사항**
- 📱 **어떤 플랫폼에서 사용하나요?** (웹, 모바일, 데스크톱)
- 👥 **몇 명이 동시에 사용할 예정인가요?**
- 🔒 **특별한 보안이나 성능 요구사항이 있나요?**

## 📝 **예시 응답**

다음과 같이 구체적으로 작성해주세요:

\`\`\`
이 투두 앱의 주요 사용자는 개인 개발자들입니다. 
현재 개발자들은 여러 프로젝트를 동시에 진행하면서 할 일 관리가 어려워합니다.

핵심 기능:
1. 프로젝트별 할 일 분류 및 관리
2. 우선순위 설정 및 마감일 알림
3. 진행상황 시각화 대시보드

웹 기반으로 개발하되, 모바일에서도 사용 가능해야 합니다.
\`\`\`

🔄 **다음 단계**: 위 정보를 바탕으로 다시 \`specify_requirements\`를 실행해주세요!`;
  }

  private async readExistingSpec(projectId: string): Promise<string> {
    try {
      const existing = await this.resourceManager.readResource(
        `specify://project/${projectId}/spec/current`
      );
      return `📋 **현재 요구사항 명세서**

${existing.text}

💡 **수정이 필요하다면**: \`specify_requirements\` refine=true를 사용하세요.`;
    } catch (error) {
      return '❌ **요구사항 명세서가 없습니다**\n\n먼저 `specify_requirements`로 요구사항을 작성하세요.';
    }
  }

  private async createSpecificationResource(projectId: string, content: string, refine: boolean) {
    const uri = `specify://project/${projectId}/spec/current`;
    return {
      uri,
      name: `Specification for ${projectId}`,
      mimeType: 'text/markdown',
      description: `Product requirements specification ${refine ? '(refined)' : '(new)'}`,
      content
    };
  }
}

const SpecificationSchema = z.object({
  action: z.enum(['create', 'update', 'conversational']),
  project_path: z.string(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  // Conversational mode parameters
  conversation_action: z.enum(['start', 'answer', 'refine', 'complete']).optional(),
  session_id: z.string().optional(),
  question_id: z.string().optional(),
  answer: z.string().optional(),
  confidence: z.number().min(1).max(5).optional(),
});

export async function specifyRequirements(params: z.infer<typeof SpecificationSchema>) {
  const { action, project_path, description, conversation_action, session_id, question_id, answer, confidence } = params;
  
  // Handle conversational mode - the new AI-SDD iterative dialogue approach
  if (action === 'conversational') {
    return conversationalSpec({
      action: conversation_action || 'start',
      project_path,
      session_id,
      question_id,
      answer,
      confidence,
      initial_idea: description
    });
  }

  // Legacy mode for backward compatibility
  // TODO: Deprecate this in favor of conversational mode
  return {
    success: false,
    message: `🔄 **Transitioning to Conversational Mode**

The traditional specification generation has been replaced with an **iterative dialogue system** based on AI-SDD principles.

**New Approach**: 
- Use \`action: "conversational"\` with \`conversation_action: "start"\`
- This enables the "iterative dialogue" process from AI-SDD research
- Much more effective for requirement refinement

**Example**:
\`\`\`
specify_requirements({
  action: "conversational", 
  conversation_action: "start",
  project_path: "${project_path}",
  description: "${description || 'your initial idea'}"
})
\`\`\`

This new method implements the AI-SDD paper's core principle: "*Through iterative dialogue with AI, this idea becomes a comprehensive PRD*"`,
    deprecated_mode: 'legacy',
    recommended_action: 'conversational'
  };
}
