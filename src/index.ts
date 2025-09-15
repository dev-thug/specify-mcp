#!/usr/bin/env node

/**
 * AI-SDD MCP Server Entry Point
 * Implements the AI-Augmented Specification-Driven Development framework as an MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AISDDWorkflow } from './modules/aisdd-workflow.js';
import { 
  WorkflowState, 
  UserIntent, 
  AISDDConfig,
  WorkflowPhase 
} from './types/index.js';

// Server configuration
const CONFIG: AISDDConfig = {
  validation: {
    multiRunCount: 3,
    consensusThreshold: 0.8,
    maxIterations: 5,
    enableCritics: true
  },
  llm: {
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 4000,
    timeout: 30000
  },
  critics: {
    enabled: true,
    tools: ['eslint', 'sonarqube'],
    thresholds: {
      correctness: 0.9,
      security: 0.95,
      maintainability: 0.8
    }
  },
  quality: {
    minCompleteness: 0.8,
    minClarity: 0.7,
    minCorrectness: 0.9,
    minConsistency: 0.8
  }
};

// Global workflow state (in production, would use persistent storage)
let currentWorkflowState: WorkflowState | null = null;

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'specify-mcp',
    version: '1.0.0'
  });

  const workflow = new AISDDWorkflow(CONFIG);

  // Tool: resolve_ambiguities (Step 0)
  server.registerTool(
    'resolve_ambiguities', 
    {
      title: 'Resolve Ambiguities',
      description: 'Autonomously resolve ambiguities in user requirements using NLP and RAG',
      inputSchema: {
        userIntent: z.string().describe('User\'s initial intent or requirements'),
        domain: z.string().optional().describe('Application domain (e.g., web, mobile, api)'),
        constraints: z.array(z.string()).optional().describe('Known constraints or limitations'),
        context: z.record(z.unknown()).optional().describe('Additional context information')
      }
    },
    async ({ userIntent, domain, constraints, context }) => {
      try {
        const intent: UserIntent = {
          description: userIntent,
          ...(domain && { domain }),
          constraints: constraints || [],
          context: context || {},
          priority: 'high'
        };

        const resolvedIntent = await workflow.resolveAmbiguities(intent);
        
        // Update workflow state
        currentWorkflowState = {
          currentPhase: 'specification-generation',
          context: resolvedIntent,
          specification: null,
          plan: null,
          tasks: null,
          validationHistory: [],
          metadata: {
            sessionId: Date.now().toString(),
            startTime: new Date(),
            lastUpdated: new Date(),
            iterations: 1,
            totalValidations: 1,
            qualityScore: resolvedIntent.confidence
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: `✅ Ambiguities Resolved (Confidence: ${resolvedIntent.confidence})\n\n` +
                    `**Resolved Intent:** ${resolvedIntent.description}\n\n` +
                    `**Clarifications:** ${resolvedIntent.clarifications.join(', ')}\n\n` +
                    `**Resolved Ambiguities:**\n${resolvedIntent.ambiguities.map((a: any) => 
                      `- ${a.original} → ${a.resolved}`
                    ).join('\n')}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error resolving ambiguities: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: generate_specification (Step 1)  
  server.registerTool(
    'generate_specification',
    {
      title: 'Generate Specification',
      description: 'Generate formal specifications with NL-ACSL translation',
      inputSchema: {
        useCurrentContext: z.boolean().default(true).describe('Use current workflow context'),
        customIntent: z.string().optional().describe('Custom intent if not using current context'),
        includeFormSpec: z.boolean().default(true).describe('Include formal ACSL specification'),
        specificationLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed')
      }
    },
    async ({ useCurrentContext, customIntent, includeFormSpec, specificationLevel }) => {
      try {
        let intent: UserIntent;
        
        if (useCurrentContext && currentWorkflowState?.context) {
          intent = currentWorkflowState.context;
        } else if (customIntent) {
          intent = {
            description: customIntent,
            priority: 'high'
          };
        } else {
          throw new Error('No context available. Either resolve ambiguities first or provide custom intent.');
        }

        const resolvedIntent = await workflow.resolveAmbiguities(intent);
        const specification = await workflow.generateSpecification(resolvedIntent, {
          includeFormalSpec: includeFormSpec,
          level: specificationLevel
        });

        // Update workflow state
        if (currentWorkflowState) {
          currentWorkflowState = {
            ...currentWorkflowState,
            currentPhase: 'planning',
            specification,
            metadata: {
              ...currentWorkflowState.metadata,
              lastUpdated: new Date(),
              iterations: currentWorkflowState.metadata.iterations + 1
            }
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Specification Generated\n\n` +
                    `**Natural Language Specification:**\n${specification.naturalLanguage}\n\n` +
                    (specification.formalSpec ? `**Formal Specification:**\n${specification.formalSpec}\n\n` : '') +
                    `**Requirements:** ${specification.requirements.length} requirements\n` +
                    `**Constraints:** ${specification.constraints.length} constraints\n` +
                    `**Architecture Decisions:** ${specification.architecture.length} decisions`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error generating specification: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: create_implementation_plan (Step 2)
  server.registerTool(
    'create_implementation_plan',
    {
      title: 'Create Implementation Plan', 
      description: 'Create detailed implementation plan with risk assessment and dependency optimization',
      inputSchema: {
        useCurrentContext: z.boolean().default(true).describe('Use current specification'),
        planningHorizon: z.number().default(30).describe('Planning horizon in days'),
        teamSize: z.number().default(3).describe('Expected team size'),
        includeDependencyGraph: z.boolean().default(true).describe('Include detailed dependency graph'),
        riskTolerance: z.enum(['low', 'medium', 'high']).default('medium')
      }
    },
    async ({ useCurrentContext, planningHorizon, teamSize, includeDependencyGraph, riskTolerance }) => {
      try {
        if (!useCurrentContext || !currentWorkflowState?.specification) {
          throw new Error('No specification available. Generate specification first.');
        }

        const plan = await workflow.createImplementationPlan(currentWorkflowState.specification, {
          planningHorizon,
          teamSize,
          includeDependencyGraph,
          riskTolerance
        });

        // Update workflow state
        currentWorkflowState = {
          ...currentWorkflowState,
          currentPhase: 'tasking',
          plan,
          metadata: {
            ...currentWorkflowState.metadata,
            lastUpdated: new Date(),
            iterations: currentWorkflowState.metadata.iterations + 1
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: `✅ Implementation Plan Created\n\n` +
                    `**Architecture:** ${plan.architecture.style}\n` +
                    `**Components:** ${plan.architecture.components.length}\n` +
                    `**Development Phases:** ${plan.phases.length}\n` +
                    `**Timeline:** ${plan.timeline.startDate.toDateString()} - ${plan.timeline.endDate.toDateString()}\n` +
                    `**Identified Risks:** ${plan.risks.length}\n` +
                    `**Resource Requirements:** ${plan.resources.length}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error creating implementation plan: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: generate_tasks (Step 3)
  server.registerTool(
    'generate_tasks',
    {
      title: 'Generate Tasks',
      description: 'Generate SMART tasks with quality enhancement and testability checks',
      inputSchema: {
        useCurrentPlan: z.boolean().default(true).describe('Use current implementation plan'),
        taskGranularity: z.enum(['coarse', 'medium', 'fine']).default('medium'),
        includeTestTasks: z.boolean().default(true).describe('Include testing tasks'),
        maxTasksPerPhase: z.number().default(10).describe('Maximum tasks per development phase'),
        prioritizeParallelization: z.boolean().default(true).describe('Optimize for parallel execution')
      }
    },
    async ({ useCurrentPlan, taskGranularity, includeTestTasks, maxTasksPerPhase, prioritizeParallelization }) => {
      try {
        if (!useCurrentPlan || !currentWorkflowState?.plan) {
          throw new Error('No implementation plan available. Create implementation plan first.');
        }

        const tasks = await workflow.generateTasks(currentWorkflowState.plan, {
          granularity: taskGranularity,
          includeTestTasks,
          maxTasksPerPhase,
          prioritizeParallelization
        });

        // Update workflow state
        currentWorkflowState = {
          ...currentWorkflowState,
          currentPhase: 'verification',
          tasks,
          metadata: {
            ...currentWorkflowState.metadata,
            lastUpdated: new Date(),
            iterations: currentWorkflowState.metadata.iterations + 1
          }
        };

        const parallelTasks = tasks.filter((t: any) => t.parallelizable).length;
        const testTasks = tasks.filter((t: any) => t.type === 'testing').length;

        return {
          content: [
            {
              type: 'text',
              text: `✅ Tasks Generated\n\n` +
                    `**Total Tasks:** ${tasks.length}\n` +
                    `**Parallelizable Tasks:** ${parallelTasks}\n` +
                    `**Test Tasks:** ${testTasks}\n` +
                    `**Estimated Total Hours:** ${tasks.reduce((sum: number, t: any) => sum + t.estimatedHours, 0)}\n\n` +
                    `**Task Breakdown:**\n${tasks.slice(0, 5).map((t: any) => 
                      `- ${t.name} (${t.estimatedHours}h, ${t.priority})`
                    ).join('\n')}${tasks.length > 5 ? `\n... and ${tasks.length - 5} more tasks` : ''}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error generating tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: run_full_workflow
  server.registerTool(
    'run_full_workflow',
    {
      title: 'Run Full Workflow',
      description: 'Execute complete AI-SDD workflow from ambiguity resolution to task generation',
      inputSchema: {
        userIntent: z.string().describe('User\'s initial intent or requirements'),
        domain: z.string().optional().describe('Application domain'),
        constraints: z.array(z.string()).optional().describe('Known constraints'),
        options: z.object({
          specificationLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
          planningHorizon: z.number().default(30),
          teamSize: z.number().default(3),
          taskGranularity: z.enum(['coarse', 'medium', 'fine']).default('medium')
        }).optional()
      }
    },
    async ({ userIntent, domain, constraints, options = {} }) => {
      try {
        const intent: UserIntent = {
          description: userIntent,
          ...(domain && { domain }),
          constraints: constraints || [],
          priority: 'high'
        };

        const result = await workflow.runFullWorkflow(intent, options);

        // Set final workflow state
        currentWorkflowState = {
          currentPhase: 'completed',
          context: result.resolvedIntent,
          specification: result.specification,
          plan: result.plan,
          tasks: result.tasks,
          validationHistory: result.validationHistory,
          metadata: {
            sessionId: Date.now().toString(),
            startTime: new Date(),
            lastUpdated: new Date(),
            iterations: result.validationHistory.length,
            totalValidations: result.validationHistory.length,
            qualityScore: result.qualityScore
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: `✅ Full AI-SDD Workflow Completed\n\n` +
                    `**Quality Score:** ${result.qualityScore.toFixed(2)}/1.0\n` +
                    `**Total Iterations:** ${result.validationHistory.length}\n` +
                    `**Generated Tasks:** ${result.tasks.length}\n` +
                    `**Estimated Project Duration:** ${result.plan.timeline.endDate.toDateString()}\n\n` +
                    `**Summary:**\n` +
                    `- Resolved ${result.resolvedIntent.ambiguities.length} ambiguities\n` +
                    `- Generated ${result.specification.requirements.length} requirements\n` +
                    `- Created ${result.plan.phases.length} development phases\n` +
                    `- Identified ${result.plan.risks.length} risks\n` +
                    `- Produced ${result.tasks.length} actionable tasks`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error running full workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Resources for accessing current state
  server.registerResource(
    'current-context',
    'specify://context/current',
    {
      title: 'Current Workflow Context',
      description: 'Current resolved user intent and context',
      mimeType: 'application/json'
    },
    async () => {
      const context = currentWorkflowState?.context;
      return {
        contents: [
          {
            uri: 'specify://context/current',
            mimeType: 'application/json',
            text: context ? JSON.stringify(context, null, 2) : 'No context available'
          }
        ]
      };
    }
  );

  server.registerResource(
    'current-specification',
    'specify://prd/current', 
    {
      title: 'Current Specification',
      description: 'Current product specification and requirements',
      mimeType: 'application/json'
    },
    async () => {
      const spec = currentWorkflowState?.specification;
      return {
        contents: [
          {
            uri: 'specify://prd/current',
            mimeType: 'application/json',
            text: spec ? JSON.stringify(spec, null, 2) : 'No specification available'
          }
        ]
      };
    }
  );

  server.registerResource(
    'current-plan',
    'specify://plan/current',
    {
      title: 'Current Implementation Plan',
      description: 'Current implementation plan with architecture and timeline',
      mimeType: 'application/json'
    },
    async () => {
      const plan = currentWorkflowState?.plan;
      return {
        contents: [
          {
            uri: 'specify://plan/current',
            mimeType: 'application/json', 
            text: plan ? JSON.stringify(plan, null, 2) : 'No plan available'
          }
        ]
      };
    }
  );

  server.registerResource(
    'current-tasks',
    'specify://tasks/current',
    {
      title: 'Current Task List',
      description: 'Current list of generated tasks',
      mimeType: 'application/json'
    },
    async () => {
      const tasks = currentWorkflowState?.tasks;
      return {
        contents: [
          {
            uri: 'specify://tasks/current',
            mimeType: 'application/json',
            text: tasks ? JSON.stringify(tasks, null, 2) : 'No tasks available'
          }
        ]
      };
    }
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('AI-SDD MCP Server running...');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down AI-SDD MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down AI-SDD MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start AI-SDD MCP Server:', error);
  process.exit(1);
});
