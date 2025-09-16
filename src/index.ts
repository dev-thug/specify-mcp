#!/usr/bin/env node

/**
 * Specify MCP Server - AI-powered Software Design and Decomposition
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { WorkflowOrchestrator } from './services/workflow-orchestrator.js';
import { ProjectInitializer } from './services/project-initializer.js';
import { SERVER_NAME, SERVER_VERSION } from './constants/index.js';

// Initialize server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Global workflow orchestrator
let orchestrator = new WorkflowOrchestrator();
const projectInitializer = new ProjectInitializer();

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const state = orchestrator.getCurrentState();
  const resources = [];

  if (state.context) {
    resources.push({
      uri: 'specify://context/current',
      name: 'Current Project Context',
      description: 'Current project context and configuration',
      mimeType: 'application/json',
    });
  }

  if (state.resolution) {
    resources.push({
      uri: 'specify://prd/current',
      name: 'Current PRD',
      description: 'Current Product Requirements Document',
      mimeType: 'application/json',
    });
  }

  if (state.specification) {
    resources.push({
      uri: 'specify://spec/current',
      name: 'Current Specification',
      description: 'Current technical specification',
      mimeType: 'application/json',
    });
  }

  if (state.plan) {
    resources.push({
      uri: 'specify://plan/current',
      name: 'Current Implementation Plan',
      description: 'Current implementation plan with phases',
      mimeType: 'application/json',
    });
  }

  if (state.tasks.length > 0) {
    resources.push({
      uri: 'specify://tasks/current',
      name: 'Current Task List',
      description: 'Current development tasks',
      mimeType: 'application/json',
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const state = orchestrator.getCurrentState();
  const uri = request.params.uri;

  switch (uri) {
    case 'specify://context/current':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state.context, null, 2),
        }],
      };

    case 'specify://prd/current':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state.resolution, null, 2),
        }],
      };

    case 'specify://spec/current':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state.specification, null, 2),
        }],
      };

    case 'specify://plan/current':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state.plan, null, 2),
        }],
      };

    case 'specify://tasks/current':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state.tasks, null, 2),
        }],
      };

    default:
      throw new Error(`Resource not found: ${uri}`);
  }
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'initialize_project',
        description: 'Initialize a new or existing project with .specify folder structure',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory',
            },
            projectName: {
              type: 'string',
              description: 'Name of the project (optional)',
            },
            description: {
              type: 'string',
              description: 'Project description (optional)',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'resolve_ambiguities',
        description: 'Resolve ambiguities in user requirements using NLP and RAG',
        inputSchema: {
          type: 'object',
          properties: {
            userIntent: {
              type: 'string',
              description: 'User\'s initial intent or requirements',
            },
            domain: {
              type: 'string',
              description: 'Application domain (e.g., web, mobile, api)',
            },
            constraints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Known constraints or limitations',
            },
            context: {
              type: 'object',
              description: 'Additional context information',
            },
          },
          required: ['userIntent'],
        },
      },
      {
        name: 'generate_specification',
        description: 'Generate formal specifications with NL-ACSL translation',
        inputSchema: {
          type: 'object',
          properties: {
            useCurrentContext: {
              type: 'boolean',
              description: 'Use current workflow context',
              default: true,
            },
            customIntent: {
              type: 'string',
              description: 'Custom intent if not using current context',
            },
            specificationLevel: {
              type: 'string',
              enum: ['basic', 'detailed', 'comprehensive'],
              default: 'detailed',
            },
            includeFormSpec: {
              type: 'boolean',
              description: 'Include formal ACSL specification',
              default: true,
            },
          },
        },
      },
      {
        name: 'create_implementation_plan',
        description: 'Create detailed implementation plan with risk assessment and dependency optimization',
        inputSchema: {
          type: 'object',
          properties: {
            useCurrentContext: {
              type: 'boolean',
              description: 'Use current specification',
              default: true,
            },
            teamSize: {
              type: 'number',
              description: 'Expected team size',
              default: 3,
            },
            planningHorizon: {
              type: 'number',
              description: 'Planning horizon in days',
              default: 30,
            },
            riskTolerance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
            },
            includeDependencyGraph: {
              type: 'boolean',
              description: 'Include detailed dependency graph',
              default: true,
            },
          },
        },
      },
      {
        name: 'generate_tasks',
        description: 'Generate SMART tasks with quality enhancement and testability checks',
        inputSchema: {
          type: 'object',
          properties: {
            useCurrentPlan: {
              type: 'boolean',
              description: 'Use current implementation plan',
              default: true,
            },
            taskGranularity: {
              type: 'string',
              enum: ['coarse', 'medium', 'fine'],
              default: 'medium',
            },
            maxTasksPerPhase: {
              type: 'number',
              description: 'Maximum tasks per development phase',
              default: 10,
            },
            includeTestTasks: {
              type: 'boolean',
              description: 'Include testing tasks',
              default: true,
            },
            prioritizeParallelization: {
              type: 'boolean',
              description: 'Optimize for parallel execution',
              default: true,
            },
          },
        },
      },
      {
        name: 'run_full_workflow',
        description: 'Execute complete AI-SDD workflow from ambiguity resolution to task generation',
        inputSchema: {
          type: 'object',
          properties: {
            userIntent: {
              type: 'string',
              description: 'User\'s initial intent or requirements',
            },
            domain: {
              type: 'string',
              description: 'Application domain',
            },
            constraints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Known constraints',
            },
            options: {
              type: 'object',
              properties: {
                specificationLevel: {
                  type: 'string',
                  enum: ['basic', 'detailed', 'comprehensive'],
                  default: 'detailed',
                },
                teamSize: {
                  type: 'number',
                  default: 3,
                },
                planningHorizon: {
                  type: 'number',
                  default: 30,
                },
                taskGranularity: {
                  type: 'string',
                  enum: ['coarse', 'medium', 'fine'],
                  default: 'medium',
                },
              },
            },
          },
          required: ['userIntent'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'initialize_project': {
        const { projectPath, projectName, description } = args as any;
        const context = await projectInitializer.initialize(
          projectPath,
          projectName,
          description
        );
        
        // Update orchestrator with new project path
        orchestrator = new WorkflowOrchestrator(projectPath);
        await orchestrator.initializeProject(
          projectPath,
          context.projectType,
          context.name,
          context.description
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Project initialized at ${projectPath}`,
                context,
              }, null, 2),
            },
          ],
        };
      }

      case 'resolve_ambiguities': {
        const { userIntent, domain, constraints, context } = args as any;
        const resolution = await orchestrator.resolveAmbiguities(
          userIntent,
          domain,
          constraints,
          context
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resolution, null, 2),
            },
          ],
        };
      }

      case 'generate_specification': {
        const { useCurrentContext, customIntent, specificationLevel, includeFormSpec } = args as any;
        
        if (!useCurrentContext && customIntent) {
          await orchestrator.resolveAmbiguities(customIntent);
        }
        
        const specification = await orchestrator.generateSpecification(
          undefined,
          specificationLevel?.toUpperCase(),
          includeFormSpec
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(specification, null, 2),
            },
          ],
        };
      }

      case 'create_implementation_plan': {
        const { teamSize, planningHorizon, riskTolerance, includeDependencyGraph } = args as any;
        
        const plan = await orchestrator.createImplementationPlan(
          undefined,
          teamSize,
          planningHorizon,
          riskTolerance?.toUpperCase(),
          includeDependencyGraph
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(plan, null, 2),
            },
          ],
        };
      }

      case 'generate_tasks': {
        const { taskGranularity, maxTasksPerPhase, includeTestTasks, prioritizeParallelization } = args as any;
        
        const tasks = await orchestrator.generateTasks(
          undefined,
          taskGranularity?.toUpperCase(),
          maxTasksPerPhase,
          includeTestTasks,
          prioritizeParallelization
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case 'run_full_workflow': {
        const { userIntent, domain, constraints, options } = args as any;
        
        const result = await orchestrator.runFullWorkflow(
          userIntent,
          domain,
          constraints,
          {
            specificationLevel: options?.specificationLevel?.toUpperCase(),
            teamSize: options?.teamSize,
            planningHorizon: options?.planningHorizon,
            taskGranularity: options?.taskGranularity?.toUpperCase(),
          }
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                documentsCreated: result.documentsCreated,
                summary: {
                  requirementsResolved: true,
                  specificationGenerated: true,
                  planCreated: true,
                  tasksGenerated: result.tasks.length,
                },
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message || 'An error occurred',
          }, null, 2),
        },
      ],
    };
  }
});

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'create_web_app',
        description: 'Generate requirements for a web application',
        arguments: [
          {
            name: 'app_type',
            description: 'Type of web application (e.g., e-commerce, social, dashboard)',
            required: true,
          },
          {
            name: 'features',
            description: 'Comma-separated list of features',
            required: false,
          },
        ],
      },
      {
        name: 'create_api_service',
        description: 'Generate requirements for an API service',
        arguments: [
          {
            name: 'service_type',
            description: 'Type of API service (e.g., REST, GraphQL, gRPC)',
            required: true,
          },
          {
            name: 'resources',
            description: 'Comma-separated list of resources to manage',
            required: false,
          },
        ],
      },
      {
        name: 'analyze_requirements',
        description: 'Analyze and improve existing requirements',
        arguments: [
          {
            name: 'requirements',
            description: 'Existing requirements text',
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_web_app': {
      const appType = args?.app_type || 'general';
      const features = args?.features || 'user authentication, data management, reporting';
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ${appType} web application with the following features: ${features}. 
The application should be scalable, secure, and user-friendly. 
Include responsive design, proper error handling, and comprehensive testing.`,
            },
          },
        ],
      };
    }

    case 'create_api_service': {
      const serviceType = args?.service_type || 'REST';
      const resources = args?.resources || 'users, products, orders';
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ${serviceType} API service to manage: ${resources}. 
The API should follow best practices, include authentication, rate limiting, and proper documentation.
Ensure scalability, security, and maintainability.`,
            },
          },
        ],
      };
    }

    case 'analyze_requirements': {
      const requirements = args?.requirements || '';
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze and improve the following requirements:

${requirements}

Identify ambiguities, add missing details, and structure the requirements properly.`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
