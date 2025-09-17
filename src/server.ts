/**
 * Main MCP Server implementation for SDD
 * Handles tool registration, resource management, and client communication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ResourceManager } from './resources/manager.js';
import { CommonVerifier } from './verification/common.js';

// Import tools
import { InitTool } from './tools/init.js';
import { SpecTool } from './tools/spec.js';
import { PlanTool } from './tools/plan.js';
import { TasksTool } from './tools/tasks.js';
import { ImplementTool } from './tools/implement.js';

export class SDDMCPServer {
  private server: Server;
  private resourceManager: ResourceManager;
  private verifier: CommonVerifier;
  private currentProjectId?: string;

  constructor() {
    this.server = new Server(
      {
        name: 'specify-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.resourceManager = new ResourceManager();
    this.verifier = new CommonVerifier();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'specify_init',
            description: 'Initialize a new project with specification-driven approach',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Project name',
                },
                description: {
                  type: 'string',
                  description: 'Initial project description',
                },
                projectDirectory: {
                  type: 'string',
                  description: 'Target directory for the project (creates .specify folder here)',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'specify_requirements',
            description: 'Generate product requirements specification focusing on WHAT and WHY',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID (optional, uses current if not provided)',
                },
                userInput: {
                  type: 'string',
                  description: 'User description of features and requirements',
                },
                refine: {
                  type: 'boolean',
                  description: 'Whether to refine existing spec',
                },
              },
              required: ['userInput'],
            },
          },
          {
            name: 'specify_plan',
            description: 'Create technical architecture and implementation plan',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID',
                },
                techStack: {
                  type: 'object',
                  properties: {
                    language: { type: 'string' },
                    framework: { type: 'string' },
                    database: { type: 'string' },
                    testing: { type: 'string' },
                  },
                },
                refine: {
                  type: 'boolean',
                  description: 'Whether to refine existing plan',
                },
              },
            },
          },
          {
            name: 'specify_breakdown',
            description: 'Break down project into detailed, testable tasks with TDD approach',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID',
                },
                granularity: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Level of task breakdown detail',
                },
              },
            },
          },
          {
            name: 'specify_implement',
            description: 'Generate TDD implementation guide with test definitions and pseudo-code',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID',
                },
                taskId: {
                  type: 'string',
                  description: 'Task ID to implement',
                },
              },
              required: ['taskId'],
            },
          },
          {
            name: 'specify_verify',
            description: 'Verify documents for hallucinations, ambiguities, and consistency issues',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Content to verify',
                },
                phase: {
                  type: 'string',
                  enum: ['init', 'spec', 'plan', 'tasks', 'implement'],
                  description: 'SDD phase for context',
                },
              },
              required: ['content', 'phase'],
            },
          },
          {
            name: 'specify_list_projects',
            description: 'List all specification-driven projects',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'specify_set_project',
            description: 'Set the current active project for subsequent operations',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID to set as current',
                },
              },
              required: ['projectId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'specify_init': {
            const initTool = new InitTool(this.resourceManager, this.verifier);
            const result = await initTool.execute(args as any);
            
            // If result contains project ID at the end, extract it
            const projectIdMatch = result.match(/프로젝트 ID\*\*:\s*([^\s\n]+)/);
            if (projectIdMatch && projectIdMatch[1]) {
              this.currentProjectId = projectIdMatch[1];
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
            };
          }

          case 'specify_requirements': {
            const projectId = (args as any).projectId || this.currentProjectId;
            if (!projectId) {
              throw new Error('No project ID provided and no current project set');
            }
            const specTool = new SpecTool(this.resourceManager, this.verifier);
            const result = await specTool.execute({
              ...(args as any),
              projectId,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
            };
          }

          case 'specify_plan': {
            const projectId = (args as any).projectId || this.currentProjectId;
            if (!projectId) {
              throw new Error('No project ID provided and no current project set');
            }
            const planTool = new PlanTool(this.resourceManager, this.verifier);
            const result = await planTool.execute({
              ...(args as any),
              projectId,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
            };
          }

          case 'specify_breakdown': {
            const projectId = (args as any).projectId || this.currentProjectId;
            if (!projectId) {
              throw new Error('No project ID provided and no current project set');
            }
            const tasksTool = new TasksTool(this.resourceManager, this.verifier);
            const result = await tasksTool.execute({
              ...(args as any),
              projectId,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
            };
          }

          case 'specify_implement': {
            const projectId = (args as any).projectId || this.currentProjectId;
            if (!projectId) {
              throw new Error('No project ID provided and no current project set');
            }
            const implementTool = new ImplementTool(this.resourceManager, this.verifier);
            const result = await implementTool.execute({
              ...(args as any),
              projectId,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
            };
          }

          case 'specify_verify': {
            const { content, phase } = args as any;
            const results = await this.verifier.verify({
              phase,
              content,
            });

            const confidence = this.verifier.calculateConfidence(results);

            const summary =
              `Verification Results (Confidence: ${(confidence * 100).toFixed(1)}%):\n` +
              `- Errors: ${results.filter((r) => r.type === 'error').length}\n` +
              `- Warnings: ${results.filter((r) => r.type === 'warning').length}\n` +
              `- Info: ${results.filter((r) => r.type === 'info').length}\n\n` +
              results
                .map(
                  (r) =>
                    `[${r.type.toUpperCase()}] ${r.message}\n  Location: ${r.location}\n  Suggestion: ${r.suggestion}`
                )
                .join('\n\n');

            return {
              content: [
                {
                  type: 'text',
                  text: summary,
                },
              ],
            };
          }

          case 'specify_list_projects': {
            const projects = this.resourceManager.listProjects();
            const projectList = projects
              .map((id) => `- ${id}${id === this.currentProjectId ? ' (current)' : ''}`)
              .join('\n');

            return {
              content: [
                {
                  type: 'text',
                  text: `Available projects:\n${projectList}`,
                },
              ],
            };
          }

          case 'specify_set_project': {
            const { projectId } = args as any;
            const project = this.resourceManager.getProject(projectId);

            if (!project) {
              throw new Error(`Project not found: ${projectId}`);
            }

            this.currentProjectId = projectId;

            return {
              content: [
                {
                  type: 'text',
                  text: `Current project set to: ${projectId}`,
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.resourceManager.listResources();
      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const content = await this.resourceManager.readResource(uri);

      return {
        contents: [
          {
            uri,
            mimeType: content.mimeType,
            text: content.text,
          },
        ],
      };
    });

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'specify_workflow',
            description: 'Complete specification-driven development workflow guidance',
          },
          {
            name: 'specify_requirements_template',
            description: 'Product requirements specification template',
          },
          {
            name: 'specify_plan_template',
            description: 'Technical architecture planning template',
          },
          {
            name: 'specify_tdd_guide',
            description: 'Test-Driven Development implementation guide',
          },
        ],
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;

      const prompts: Record<string, string> = {
        specify_workflow: `You are helping with Specification-Driven Development. Follow these phases:
1. Init: Gather project information through conversation using specify_init
2. Requirements: Write PRD focusing on WHAT and WHY using specify_requirements
3. Plan: Define technical stack and architecture using specify_plan
4. Breakdown: Break down work into detailed, testable tasks using specify_breakdown
5. Implement: Generate TDD definitions and pseudo-code using specify_implement

Always use specify_verify to check outputs for hallucination and ambiguity.`,

        specify_requirements_template: `When writing product requirements with specify_requirements:
- Focus on user scenarios and acceptance criteria
- Use MUST for testable requirements
- Avoid technical implementation details
- Mark unclear areas with [NEEDS CLARIFICATION]
- Include edge cases and error scenarios`,

        specify_plan_template: `When creating technical plans with specify_plan:
- Define language, framework, database, testing tools
- Document architecture decisions
- Consider scalability and performance
- Follow TDD principles
- Plan for observability and monitoring`,

        specify_tdd_guide: `Follow Test-Driven Development with specify_implement:
1. RED: Write failing tests first
2. GREEN: Implement minimum code to pass
3. REFACTOR: Improve code quality
- Tests must fail before implementation
- Use real dependencies, not mocks
- Commit after each phase`,
      };

      const promptContent = prompts[name];
      if (!promptContent) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      return {
        messages: [
          {
            role: 'system',
            content: {
              type: 'text',
              text: promptContent,
            },
          },
        ],
      };
    });
  }

  async start(): Promise<void> {
    // Initialize resource manager
    await this.resourceManager.initialize();

    // Start the server with stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('SDD MCP Server started successfully');
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SDDMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
