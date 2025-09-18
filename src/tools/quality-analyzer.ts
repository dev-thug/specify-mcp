/**
 * Quality Analyzer Tool
 * Provides detailed quality analysis and improvement guidance
 */

import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { QualityReporter } from '../quality/quality-reporter.js';

const QualityAnalyzerSchema = z.object({
  action: z.enum(['analyze', 'guidance']),
  project_path: z.string(),
  phase: z.enum(['spec', 'plan', 'tasks', 'implement']).optional(),
  content: z.string().optional(),
  file_path: z.string().optional()
});

export async function qualityAnalyzer(params: z.infer<typeof QualityAnalyzerSchema>) {
  const { action, project_path, phase, content, file_path } = params;
  
  const reporter = new QualityReporter();
  
  try {
    switch (action) {
      case 'analyze':
        return await analyzeQuality(reporter, project_path, phase, content, file_path);
      
      case 'guidance':
        return await provideGuidance(reporter, project_path, phase);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      message: `❌ **Quality Analysis Error**: ${error.message}`
    };
  }
}

async function analyzeQuality(
  reporter: QualityReporter,
  projectPath: string,
  phase?: string,
  content?: string,
  filePath?: string
): Promise<any> {
  let analysisContent = content;
  let targetPhase = phase || 'spec';
  
  // If no content provided, try to read from file or default locations
  if (!analysisContent) {
    if (filePath) {
      try {
        analysisContent = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        return {
          success: false,
          message: `❌ **Could not read file**: ${filePath}\n\nError: ${error}`
        };
      }
    } else {
      // Try to find content in standard locations
      const specifyPath = path.join(projectPath, '.specify');
      const possiblePaths = {
        spec: path.join(specifyPath, 'spec', 'current.md'),
        plan: path.join(specifyPath, 'plan', 'current.md'),
        tasks: path.join(specifyPath, 'tasks', 'current.md'),
        implement: path.join(specifyPath, 'implementations', 'current.md')
      };
      
      for (const [phaseType, docPath] of Object.entries(possiblePaths)) {
        if (await fs.pathExists(docPath)) {
          analysisContent = await fs.readFile(docPath, 'utf-8');
          targetPhase = phaseType;
          break;
        }
      }
      
      if (!analysisContent) {
        return {
          success: false,
          message: `❌ **No content found for analysis**

**Searched locations**:
${Object.entries(possiblePaths).map(([phase, path]) => `- ${phase.toUpperCase()}: \`${path}\``).join('\n')}

**Solutions**:
1. Provide content directly: \`content: "your document content"\`
2. Specify file path: \`file_path: "/path/to/document.md"\`
3. Create documents in standard .specify locations
4. Use \`document_scan\` to find existing documents`
        };
      }
    }
  }

  // Calculate current quality score using simple method
  const currentScore = calculateSimpleQualityScore(analysisContent, targetPhase);
  
  // Generate detailed report
  let report;
  if (targetPhase === 'spec') {
    report = reporter.generateSpecReport(analysisContent, currentScore);
  } else if (targetPhase === 'plan') {
    report = reporter.generatePlanReport(analysisContent, currentScore);
  } else {
    return {
      success: false,
      message: `❌ **Unsupported phase for detailed analysis**: ${targetPhase}\n\nSupported phases: spec, plan`
    };
  }
  
  const formattedReport = reporter.formatReport(report);
  
  return {
    success: true,
    phase: targetPhase,
    overall_score: report.overallScore,
    target_score: report.targetScore,
    passes_gate: report.overallScore >= report.targetScore,
    message: formattedReport,
    breakdown: report.breakdown,
    improvements: report.prioritizedImprovements,
    next_steps: report.nextSteps
  };
}

async function provideGuidance(
  _reporter: QualityReporter,
  _projectPath: string,
  phase?: string
): Promise<any> {
  const targetPhase = phase || 'spec';
  
  // This provides guidance on how to create good quality documents
  const guidance = generateQualityGuidance(targetPhase);
  
  return {
    success: true,
    phase: targetPhase,
    message: guidance,
    action: 'guidance'
  };
}

function calculateSimpleQualityScore(content: string, phase: string): number {
  let score = 0;
  const lowerContent = content.toLowerCase();
  
  // Length scoring (30 points max)
  const length = content.length;
  if (length > 2000) score += 30;
  else if (length > 1000) score += 20;
  else if (length > 500) score += 10;
  
  // Phase-specific keyword scoring
  if (phase === 'spec') {
    const specKeywords = [
      'user', 'customer', 'requirement', 'function', 'feature', 'goal', 'purpose',
      '사용자', '고객', '요구사항', '기능', '목적', '목표'
    ];
    const foundKeywords = specKeywords.filter(k => lowerContent.includes(k));
    score += Math.min(foundKeywords.length * 5, 40);
  } else if (phase === 'plan') {
    const planKeywords = [
      'architecture', 'database', 'framework', 'technology', 'design', 'api',
      'typescript', 'react', 'node', 'express', 'mongodb', 'postgres'
    ];
    const foundKeywords = planKeywords.filter(k => lowerContent.includes(k));
    score += Math.min(foundKeywords.length * 6, 50);
  }
  
  return Math.min(score, 100);
}

function generateQualityGuidance(phase: string): string {
  if (phase === 'spec') {
    return `
📋 **How to Write High-Quality Specifications**

## 🎯 **Essential Elements (Required for 60+ score)**

### 1. User Definition (12 points)
- **What to include**: Who will use the system?
- **Keywords that help**: user, customer, persona, target audience
- **Example**: "Primary users are individual developers managing 3-5 concurrent projects"

### 2. Functional Requirements (12 points)
- **What to include**: What should the system do?
- **Keywords that help**: function, feature, capability, task
- **Example**: "System must allow task creation, editing, and status tracking"

### 3. Purpose & Goals (12 points)
- **What to include**: Why is this system needed?
- **Keywords that help**: purpose, goal, problem, solve
- **Example**: "Purpose: Reduce task context-switching overhead by 50%"

### 4. Document Length (30 points)
- **Target**: 500+ characters for basic (10 pts), 1000+ for good (20 pts), 2000+ for excellent (30 pts)
- **Tips**: Include examples, scenarios, edge cases, and detailed explanations

## 🏆 **Bonus Elements (Additional points)**

- **Requirements & Constraints** (+5 points): Technical or business constraints
- **Scenarios & Use Cases** (+4 points): Specific user scenarios
- **Success Criteria** (+3 points): How to measure success
- **Structure** (+2 points): Well-organized with clear headings

## 📝 **Quick Template**

\`\`\`markdown
# Project Specification

## Users
[Who will use this? Roles, expertise, goals]

## Problem
[What problem does this solve? Current pain points]

## Functions
[What should the system do? Core features]

## Requirements
[Specific requirements, constraints, conditions]

## Success
[How will you know it's working? Metrics, criteria]
\`\`\`

## 💡 **Pro Tips**
- Use specific numbers and metrics when possible
- Include real user scenarios and examples
- Explain the "why" behind each requirement
- Keep it focused but comprehensive
    `.trim();
  } else if (phase === 'plan') {
    return `
🏗️ **How to Write High-Quality Technical Plans**

## 🎯 **Essential Elements (Required for 55+ score)**

### 1. Technology Stack (15 points)
- **What to include**: Programming languages, core technologies
- **Keywords that help**: typescript, javascript, python, react, node
- **Example**: "Technology Stack: TypeScript for type safety, Node.js for runtime"

### 2. Frameworks & Libraries (15 points)
- **What to include**: Specific frameworks and tools
- **Keywords that help**: framework, library, next, express, jest
- **Example**: "Frontend: Next.js for SSR, Backend: Express.js for APIs"

### 3. Database & Storage (15 points)
- **What to include**: Data storage solutions
- **Keywords that help**: database, postgres, mongodb, redis, storage
- **Example**: "Database: PostgreSQL for structured data, Redis for caching"

### 4. Architecture & Design (15 points)
- **What to include**: System design patterns
- **Keywords that help**: architecture, design, pattern, structure
- **Example**: "Architecture: MVC pattern with RESTful API design"

## 🏆 **Bonus Elements**

- **Testing Strategy** (+10 points): Testing approach and tools
- **Performance Considerations**: Scalability, optimization
- **Security Measures**: Authentication, authorization
- **Deployment Strategy**: CI/CD, hosting, monitoring

## 📝 **Quick Template**

\`\`\`markdown
# Technical Plan

## Technology Stack
- **Language**: [Primary programming language]
- **Runtime**: [Runtime environment]
- **Framework**: [Main framework]

## Architecture
[System design, patterns, structure]

## Database
[Data storage, schema, relationships]

## Testing
[Testing strategy, tools, approach]

## Deployment
[How will it be deployed and maintained]
\`\`\`

## 💡 **Pro Tips**
- Be specific about versions (Node.js 18+, React 18)
- Explain technology choices and trade-offs
- Include both development and production considerations
- Consider scalability and maintenance from the start
    `.trim();
  }
  
  return `Quality guidance not available for phase: ${phase}`;
}
