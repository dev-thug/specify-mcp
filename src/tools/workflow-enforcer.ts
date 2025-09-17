/**
 * Workflow Enforcer Tool
 * Provides strict workflow enforcement with agent behavior control
 */

import { z } from 'zod';
import { WorkflowGuard } from '../workflow/workflow-guard.js';

const WorkflowEnforcerSchema = z.object({
  action: z.enum(['check', 'enforce', 'status']),
  project_path: z.string(),
  target_phase: z.enum(['init', 'spec', 'plan', 'tasks', 'implement']).optional(),
});

export async function workflowEnforcer(params: z.infer<typeof WorkflowEnforcerSchema>) {
  const { action, project_path, target_phase } = params;
  
  const guard = new WorkflowGuard();
  
  try {
    switch (action) {
      case 'check':
      case 'enforce':
        if (!target_phase) {
          throw new Error('target_phase is required for check/enforce actions');
        }
        
        // Handle init phase specially since it doesn't need workflow check
        if (target_phase === 'init') {
          return {
            success: true,
            can_proceed: true,
            phase: 'init',
            message: '✅ **Init Phase Ready** - You can start with specify_init'
          };
        }
        
        const status = await guard.checkPhaseReadiness(project_path, target_phase);
        
        // Generate enforcement response
        return generateEnforcementResponse(status);
      
      case 'status':
        // Check all phases and provide comprehensive status
        const allPhases = ['spec', 'plan', 'tasks', 'implement'] as const;
        const results: Record<string, any> = {};
        
        for (const phase of allPhases) {
          try {
            const phaseStatus = await guard.checkPhaseReadiness(project_path, phase);
            results[phase] = {
              canProceed: phaseStatus.canProceed,
              qualityScore: phaseStatus.qualityScore,
              blockingReasons: phaseStatus.blockingReasons.slice(0, 2) // Limit for readability
            };
          } catch {
            results[phase] = { canProceed: false, qualityScore: 0, blockingReasons: ['Phase not accessible'] };
          }
        }
        
        return {
          success: true,
          message: generateStatusOverview(results),
          all_phases: results
        };
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      message: `❌ **Workflow Enforcement Error**: ${error.message}\n\n🎯 **REMEMBER**: You must use SDD workflow tools properly!`
    };
  }
}

function generateEnforcementResponse(status: any) {
  const { canProceed, currentPhase, strictInstructions, agentGuidance } = status;
  
  if (canProceed) {
    return {
      success: true,
      can_proceed: true,
      phase: currentPhase,
      message: `✅ **Phase ${currentPhase.toUpperCase()} Ready**\n\n${strictInstructions}`,
      instructions: strictInstructions,
      guidance: agentGuidance
    };
  }
  
  // BLOCKED - Generate strict enforcement message
  const enforcementMessage = `
🚨 **CRITICAL WORKFLOW VIOLATION DETECTED**

${strictInstructions}

⚡ **THIS IS A MANDATORY STOP** ⚡

You are attempting to proceed with ${currentPhase} phase but the SDD workflow requirements are not met.

🛑 **ABSOLUTE REQUIREMENTS**:
${agentGuidance.requiredActions.map((action: string, i: number) => `${i + 1}. ${action}`).join('\n')}

❌ **YOU ARE STRICTLY FORBIDDEN FROM**:
${agentGuidance.prohibitedActions.map((action: string) => `   ${action}`).join('\n')}

📊 **Current Status**: Quality ${status.qualityScore}% (Required: ${getRequiredQuality(currentPhase)}%+)

🎯 **AI-SDD PRINCIPLE**: "${getSDDPrinciple(currentPhase)}"

⚠️ **WARNING**: Bypassing this workflow will result in:
   • Poor code quality and technical debt
   • Missing requirements and edge cases  
   • Maintenance nightmares
   • Project failure

🔄 **NEXT STEPS** (You MUST follow these in order):
${agentGuidance.requiredActions.map((action: string, i: number) => `${i + 1}. ${action}`).join('\n')}

💡 **Remember**: The SDD process exists to ensure quality. Trust the process!
  `.trim();

  return {
    success: false,
    can_proceed: false,
    phase: currentPhase,
    blocked: true,
    quality_score: status.qualityScore,
    required_quality: getRequiredQuality(currentPhase),
    blocking_reasons: status.blockingReasons,
    message: enforcementMessage,
    strict_instructions: strictInstructions,
    agent_guidance: agentGuidance,
    
    // Extra emphasis for stubborn agents
    CRITICAL_WARNING: '🚨 DO NOT PROCEED WITHOUT COMPLETING REQUIRED ACTIONS 🚨',
    MANDATORY_COMPLIANCE: 'You must use MCP tools to complete SDD phases before implementation'
  };
}

function generateStatusOverview(results: any): string {
  let overview = `📊 **SDD Workflow Status Overview**\n\n`;
  
  const phases = ['init', 'spec', 'plan', 'tasks', 'implement'];
  let currentPhase = 'init';
  
  for (const phase of phases) {
    const status = results[phase];
    const icon = status.canProceed ? '✅' : '❌';
    const quality = status.qualityScore || 0;
    
    overview += `${icon} **${phase.toUpperCase()}**: ${quality}% quality`;
    
    if (status.canProceed) {
      overview += ` (Ready)\n`;
      currentPhase = phase;
    } else {
      overview += ` (Blocked: ${status.blockingReasons[0] || 'Requirements not met'})\n`;
      break;
    }
  }
  
  overview += `\n🎯 **Current Active Phase**: ${currentPhase.toUpperCase()}\n`;
  overview += `💡 **Next Action**: Use workflow tools to complete the current phase\n`;
  
  return overview;
}

function getRequiredQuality(phase: string): number {
  const requirements: Record<string, number> = {
    'init': 0,
    'spec': 75,
    'plan': 80,
    'tasks': 78,
    'implement': 85
  };
  return requirements[phase] || 0;
}

function getSDDPrinciple(phase: string): string {
  const principles: Record<string, string> = {
    'init': 'Start with clear project structure and goals',
    'spec': 'Through iterative dialogue with AI, ideas become comprehensive PRDs',
    'plan': 'Technical architecture must be solid before task breakdown',
    'tasks': 'Clear, testable tasks enable TDD approach',
    'implement': 'Implementation guides ensure code quality and consistency'
  };
  return principles[phase] || 'Follow the SDD workflow for quality outcomes';
}
