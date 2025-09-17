/**
 * Agent Behavior Controller
 * Enforces SDD principles by controlling agent behavior and preventing workflow bypasses
 */

export interface AgentGuidance {
  canProceed: boolean;
  blockingMessage: string;
  requiredActions: string[];
  strictInstructions: string[];
  prohibitedActions: string[];
}

export class AgentBehaviorController {
  /**
   * Generate strict instructions that force agent to follow SDD workflow
   */
  static generateStrictGuidance(
    currentPhase: string,
    qualityScore: number,
    blockingReasons: string[]
  ): AgentGuidance {
    const guidance: AgentGuidance = {
      canProceed: false,
      blockingMessage: '',
      requiredActions: [],
      strictInstructions: [],
      prohibitedActions: []
    };

    // Universal prohibitions
    guidance.prohibitedActions = [
      '❌ DO NOT write any code files directly',
      '❌ DO NOT create implementation without using MCP tools', 
      '❌ DO NOT bypass the SDD workflow',
      '❌ DO NOT ignore quality gates and verification',
      '❌ DO NOT proceed to implementation without completing all previous phases',
      '❌ DO NOT make assumptions - use the specification tools to clarify requirements'
    ];

    switch (currentPhase) {
      case 'init':
        return this.generateInitGuidance();
      
      case 'spec':
        return this.generateSpecGuidance(qualityScore);
      
      case 'plan':
        return this.generatePlanGuidance(qualityScore);
      
      case 'tasks':
        return this.generateTasksGuidance(qualityScore);
      
      case 'implement':
        if (qualityScore < 85) {
          return this.generateBlockedImplementationGuidance(qualityScore, blockingReasons);
        }
        return this.generateImplementationGuidance();
      
      default:
        return this.generateUnknownPhaseGuidance();
    }
  }

  private static generateInitGuidance(): AgentGuidance {
    return {
      canProceed: true,
      blockingMessage: '',
      requiredActions: [
        '✅ Use `specify_init` to initialize the project',
        '✅ Then use `specify_requirements` with conversational mode to start requirement gathering'
      ],
      strictInstructions: [
        '🎯 **YOU MUST**: Start with project initialization using MCP tools',
        '🎯 **YOU MUST**: Use conversational specification mode for requirements',
        '🎯 **YOU MUST**: Follow the AI-SDD iterative dialogue approach'
      ],
      prohibitedActions: [
        '❌ DO NOT create any code files yet',
        '❌ DO NOT skip the specification phase'
      ]
    };
  }

  private static generateSpecGuidance(qualityScore: number): AgentGuidance {
    if (qualityScore < 75) {
      return {
        canProceed: false,
        blockingMessage: `🛑 **SPECIFICATION QUALITY INSUFFICIENT** (${qualityScore}/75 required)\n\n**YOU ARE PROHIBITED FROM PROCEEDING TO IMPLEMENTATION**`,
        requiredActions: [
          '✅ Use `specify_requirements` with conversational mode',
          '✅ Answer all AI questions to refine requirements',
          '✅ Use `specify_verify` to check specification quality',
          '✅ Iterate until quality score reaches 75+'
        ],
        strictInstructions: [
          '🎯 **YOU MUST**: Complete the conversational specification process',
          '🎯 **YOU MUST**: Achieve minimum 75% quality score before proceeding',
          '🎯 **YOU MUST**: Use MCP verification tools to validate specification',
          '⚠️ **CRITICAL**: Any attempt to bypass this will result in poor quality software'
        ],
        prohibitedActions: [
          '❌ DO NOT proceed to planning without completing specification',
          '❌ DO NOT write any implementation code',
          '❌ DO NOT create technical documents without completing PRD first'
        ]
      };
    }

    return {
      canProceed: true,
      blockingMessage: '',
      requiredActions: [
        '✅ Specification complete! Now use `specify_plan` to create technical architecture'
      ],
      strictInstructions: [
        '🎯 **NEXT STEP**: Create technical plan using `specify_plan`'
      ],
      prohibitedActions: []
    };
  }

  private static generatePlanGuidance(qualityScore: number): AgentGuidance {
    if (qualityScore < 80) {
      return {
        canProceed: false,
        blockingMessage: `🛑 **TECHNICAL PLAN QUALITY INSUFFICIENT** (${qualityScore}/80 required)`,
        requiredActions: [
          '✅ Use `specify_plan` to create detailed technical architecture',
          '✅ Define technology stack, data models, and system design',
          '✅ Use `specify_verify` to validate plan quality'
        ],
        strictInstructions: [
          '🎯 **YOU MUST**: Complete technical planning with 80%+ quality',
          '🎯 **YOU MUST**: Define clear architecture before task breakdown'
        ],
        prohibitedActions: [
          '❌ DO NOT proceed to task breakdown without solid technical plan',
          '❌ DO NOT write any implementation code yet'
        ]
      };
    }

    return {
      canProceed: true,
      blockingMessage: '',
      requiredActions: [
        '✅ Technical plan complete! Now use `specify_tasks` to break down work'
      ],
      strictInstructions: [
        '🎯 **NEXT STEP**: Break down work into tasks using `specify_tasks`'
      ],
      prohibitedActions: []
    };
  }

  private static generateTasksGuidance(qualityScore: number): AgentGuidance {
    if (qualityScore < 78) {
      return {
        canProceed: false,
        blockingMessage: `🛑 **TASK BREAKDOWN QUALITY INSUFFICIENT** (${qualityScore}/78 required)`,
        requiredActions: [
          '✅ Use `specify_tasks` to create detailed task breakdown',
          '✅ Define clear TDD approach and testing strategy',
          '✅ Ensure tasks are granular and testable'
        ],
        strictInstructions: [
          '🎯 **YOU MUST**: Create comprehensive task breakdown with 78%+ quality',
          '🎯 **YOU MUST**: Include TDD guidance for each task'
        ],
        prohibitedActions: [
          '❌ DO NOT proceed to implementation without proper task breakdown',
          '❌ DO NOT write code without clear task definitions'
        ]
      };
    }

    return {
      canProceed: true,
      blockingMessage: '',
      requiredActions: [
        '✅ Tasks defined! Now use `specify_implement` to generate implementation guides'
      ],
      strictInstructions: [
        '🎯 **NEXT STEP**: Generate implementation guides using `specify_implement`'
      ],
      prohibitedActions: []
    };
  }

  private static generateBlockedImplementationGuidance(
    qualityScore: number, 
    blockingReasons: string[]
  ): AgentGuidance {
    return {
      canProceed: false,
      blockingMessage: `
🚫 **IMPLEMENTATION BLOCKED - SDD WORKFLOW VIOLATION**

📊 **Current Quality**: ${qualityScore}/85 (INSUFFICIENT)

❌ **Blocking Issues**:
${blockingReasons.map(reason => `   • ${reason}`).join('\n')}

⚠️ **CRITICAL WARNING**: You are attempting to implement without completing the SDD workflow.
This violates AI-SDD principles and will result in:
   • Poor code quality
   • Missing requirements
   • Technical debt
   • Maintenance issues

🛑 **YOU ARE STRICTLY PROHIBITED FROM**:
   • Writing any implementation code
   • Creating code files directly
   • Bypassing the SDD process
   • Ignoring these workflow requirements`,
      
      requiredActions: [
        '✅ Complete missing SDD phases using MCP tools',
        '✅ Use `specify_verify` to check each phase quality',
        '✅ Achieve minimum quality scores for all phases',
        '✅ Only then proceed to `specify_implement`'
      ],
      
      strictInstructions: [
        '🎯 **MANDATORY**: You MUST complete all SDD phases before implementation',
        '🎯 **MANDATORY**: You MUST use MCP tools for all specification work',
        '🎯 **MANDATORY**: You MUST achieve quality gates before proceeding',
        '⚡ **REMEMBER**: "What might take days of meetings happens in hours" - but only when done properly!'
      ],
      
      prohibitedActions: [
        '❌ ABSOLUTE PROHIBITION: Do not write any code files',
        '❌ ABSOLUTE PROHIBITION: Do not create implementation without MCP tools',
        '❌ ABSOLUTE PROHIBITION: Do not bypass SDD workflow',
        '❌ ABSOLUTE PROHIBITION: Do not ignore quality requirements'
      ]
    };
  }

  private static generateImplementationGuidance(): AgentGuidance {
    return {
      canProceed: true,
      blockingMessage: '',
      requiredActions: [
        '✅ All SDD phases complete! Use `specify_implement` to generate implementation guides',
        '✅ Follow TDD approach as defined in task breakdown',
        '✅ Implement according to generated guides'
      ],
      strictInstructions: [
        '🎯 **NOW YOU CAN**: Proceed with implementation using `specify_implement`',
        '🎯 **FOLLOW**: The TDD approach defined in your task breakdown',
        '🎯 **MAINTAIN**: Quality standards throughout implementation'
      ],
      prohibitedActions: []
    };
  }

  private static generateUnknownPhaseGuidance(): AgentGuidance {
    return {
      canProceed: false,
      blockingMessage: '🚫 **UNKNOWN PROJECT STATE** - SDD workflow cannot be determined',
      requiredActions: [
        '✅ Use `specify_status` to check current project state',
        '✅ Start with `specify_init` if no project exists'
      ],
      strictInstructions: [
        '🎯 **YOU MUST**: Determine current project state before proceeding',
        '🎯 **YOU MUST**: Follow SDD workflow from appropriate phase'
      ],
      prohibitedActions: [
        '❌ DO NOT proceed without knowing current project state',
        '❌ DO NOT write code without proper SDD workflow'
      ]
    };
  }

  /**
   * Generate agent-specific instructions that are hard to ignore
   */
  static generateAgentInstructions(guidance: AgentGuidance): string {
    let instructions = `
🤖 **AGENT BEHAVIOR CONTROL - MANDATORY COMPLIANCE**

${guidance.blockingMessage ? `⛔ **WORKFLOW BLOCKED**:\n${guidance.blockingMessage}\n` : ''}

📋 **REQUIRED ACTIONS** (You must complete these in order):
${guidance.requiredActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

⚠️ **STRICT INSTRUCTIONS** (You must follow these):
${guidance.strictInstructions.map(instruction => `${instruction}`).join('\n')}

🚫 **PROHIBITED ACTIONS** (You must NOT do these):
${guidance.prohibitedActions.map(prohibition => `${prohibition}`).join('\n')}

💡 **REMEMBER**: AI-SDD success depends on following the proper workflow.
"Through iterative dialogue with AI, this idea becomes a comprehensive PRD" 
- but only when the process is respected!

${!guidance.canProceed ? `
🛑 **IMPLEMENTATION BLOCKED**: You cannot proceed until the above requirements are met.
Any attempt to bypass this workflow will result in poor quality software.
` : ''}
    `.trim();

    return instructions;
  }
}
