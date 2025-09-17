/**
 * Init tool for SDD project initialization
 * Handles user conversation and project setup
 */

import { ResourceManager } from '../resources/manager.js';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext } from '../types/index.js';

export interface InitToolParams {
  name: string;
  description?: string;
  conversational?: boolean;
  projectDirectory?: string;
}

export class InitTool {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: InitToolParams): Promise<string> {
    const { name, description = '', conversational = true, projectDirectory } = params;

    const targetDir = projectDirectory || process.cwd();
    
    // Check if project already exists
    const existingProjectId = await this.resourceManager.loadProject(targetDir);
    if (existingProjectId) {
      return `🔄 **기존 프로젝트 발견!**

📋 **프로젝트 ID**: ${existingProjectId}
📁 **프로젝트 경로**: ${targetDir}/.specify

기존 프로젝트가 이미 초기화되어 있습니다. 새로운 프로젝트를 만들려면 다른 디렉토리를 사용하거나, 기존 프로젝트를 계속 사용하려면 \`specify_requirements\` 도구를 사용해 요구사항을 작성하세요.`;
    }

    // Create project structure
    const projectId = await this.resourceManager.createProject(name, description, projectDirectory);

    // Generate initial project document
    const initContent = this.generateInitDocument(name, description);

    // Verify the content
    const verificationContext: IVerificationContext = {
      phase: 'init',
      content: initContent,
    };

    const validationResults = await this.verifier.verify(verificationContext);

    // Save initial document
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/spec/current`,
      initContent
    );

    // Return project ID and validation summary with conversational guidance
    const hasIssues = validationResults.length > 0;
    const confidence = this.verifier.calculateConfidence(validationResults);

    if (conversational && hasIssues) {
      const conversationalResponse = this.generateConversationalResponse(
        projectId, 
        name, 
        description, 
        validationResults, 
        confidence
      );
      return conversationalResponse;
    } else if (hasIssues) {
      const issues = validationResults
        .map(r => `- [${r.type}] ${r.message}`)
        .join('\n');
      
      return `Project initialized: ${projectId}\n\nValidation issues found (Confidence: ${(confidence * 100).toFixed(1)}%):\n${issues}\n\nPlease refine the project description using specify_requirements tool.`;
    }

    return `Project initialized successfully: ${projectId}\n\nUse this ID for subsequent operations.`;
  }

  private generateInitDocument(name: string, description: string): string {
    const timestamp = new Date().toISOString();
    
    return `# Project Initialization: ${name}

**Project ID**: [Generated]
**Created**: ${timestamp}
**Status**: Initializing
**Input**: "${description}"

## Initial Context

### Project Overview
${description || '[NEEDS CLARIFICATION: Please provide a detailed project description]'}

### Key Questions to Address

1. **Users and Stakeholders**
   - [NEEDS CLARIFICATION: Who are the primary users?]
   - [NEEDS CLARIFICATION: Who are the stakeholders?]
   - [NEEDS CLARIFICATION: What are their roles and permissions?]

2. **Core Functionality**
   - [NEEDS CLARIFICATION: What is the main problem being solved?]
   - [NEEDS CLARIFICATION: What are the key features required?]
   - [NEEDS CLARIFICATION: What are the success criteria?]

3. **Constraints and Requirements**
   - [NEEDS CLARIFICATION: Are there specific performance requirements?]
   - [NEEDS CLARIFICATION: Are there regulatory or compliance needs?]
   - [NEEDS CLARIFICATION: What are the scalability expectations?]

4. **Integration and Dependencies**
   - [NEEDS CLARIFICATION: Does this integrate with existing systems?]
   - [NEEDS CLARIFICATION: Are there external dependencies or APIs?]
   - [NEEDS CLARIFICATION: What data sources are required?]

## Next Steps

1. Use \`sdd_spec\` tool to create detailed product requirements
2. Address all [NEEDS CLARIFICATION] markers through iterative refinement
3. Validate requirements with stakeholders
4. Proceed to technical planning phase

## Conversation Log

\`\`\`
User: ${description}
System: Project initialized. Please provide additional details for areas marked as [NEEDS CLARIFICATION].
\`\`\`

---
*This document will be refined through conversation and evolve into a complete specification.*`;
  }

  private generateConversationalResponse(
    projectId: string,
    name: string,
    description: string,
    _validationResults: any[],
    confidence: number
  ): string {
    const questions = this.extractMissingInformation(description);
    
    return `🎯 **프로젝트 "${name}" 초기화 완료!**

📋 **프로젝트 ID**: ${projectId}
📁 **프로젝트 경로**: ${process.cwd()}/.specify
🎯 **현재 신뢰도**: ${(confidence * 100).toFixed(1)}%

📝 **현재까지 파악된 내용**:
${description ? `"${description}"` : '(아직 구체적인 설명이 부족합니다)'}

💬 **더 나은 명세를 위해 몇 가지 질문드립니다**:

${questions.join('\n')}

🔄 **다음 단계**:
더 자세한 정보를 제공해 주시면, \`specify_requirements\` 도구를 사용해서 구체적인 요구사항 명세서를 작성할 수 있습니다.

예시: "이 투두앱의 주요 사용자는 개인 사용자들이고, 할 일 추가/수정/삭제/완료 상태 변경 기능이 필요하며, 우선순위와 마감일 설정 기능도 원합니다."`;
  }

  private extractMissingInformation(description: string): string[] {
    const questions = [
      "1️⃣ **주요 사용자는 누구인가요?** (개인 사용자, 팀, 기업 등)",
      "2️⃣ **핵심 기능은 무엇인가요?** (가장 중요한 3-5가지 기능)",
      "3️⃣ **이 앱으로 해결하고 싶은 문제는?** (현재 어떤 불편함이 있나요?)",
    ];

    // 더 구체적인 질문들을 조건부로 추가
    if (description.length < 50) {
      questions.push("4️⃣ **프로젝트를 더 자세히 설명해 주세요.** (현재 설명이 너무 간단합니다)");
    }
    
    if (!description.includes('사용자') && !description.includes('user')) {
      questions.push("5️⃣ **대상 사용자층을 구체적으로 알려주세요.**");
    }

    return questions;
  }
}
