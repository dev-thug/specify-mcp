#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { ResourceManager } from './resources/manager.js';
import { InitTool } from './tools/init.js';
import { SpecTool } from './tools/spec.js';
import { PlanTool } from './tools/plan.js';
import { TasksTool } from './tools/tasks.js';
import { ImplementTool } from './tools/implement.js';
import type { SDDTool } from './types/index.js';

class SpecifyMCPServer {
  private server: Server;
  private resourceManager: ResourceManager;
  private tools: Map<string, SDDTool>;

  constructor() {
    this.server = new Server(
      {
        name: 'specify-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
      }
    );

    this.resourceManager = new ResourceManager('./.specify');
    this.tools = new Map();
    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    // Register SDD workflow tools
    const initTool = new InitTool(this.resourceManager);
    const specTool = new SpecTool(this.resourceManager);
    const planTool = new PlanTool(this.resourceManager);
    const tasksTool = new TasksTool(this.resourceManager);
    const implementTool = new ImplementTool(this.resourceManager);

    this.tools.set(initTool.name, initTool);
    this.tools.set(specTool.name, specTool);
    this.tools.set(planTool.name, planTool);
    this.tools.set(tasksTool.name, tasksTool);
    this.tools.set(implementTool.name, implementTool);
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolsList = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object' as const,
          properties: {}
        }
      }));

      return {
        tools: toolsList
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = this.tools.get(request.params.name);
      
      if (!tool) {
        throw new Error(`Tool not found: ${request.params.name}`);
      }

      try {
        const result = await tool.handler(request.params.arguments);
        return {
          content: result.content
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${request.params.name}: ${errorMessage}`
            }
          ]
        };
      }
    });

    // Handle resource listing
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      // List all available project resources
      const projects = await this.resourceManager.listResources('', 'project.json');
      
      const resources = projects.map(project => ({
        uri: project.uri,
        name: project.name,
        mimeType: project.mimeType,
        description: 'SDD Project Resource'
      }));

      return {
        resources
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      // Parse URI to extract project ID and resource path
      const match = uri.match(/^specify:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error(`Invalid resource URI: ${uri}`);
      }

      const [, projectId, resourcePath] = match;
      
      try {
        const resource = await this.resourceManager.readResource(projectId, resourcePath);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: resource.content
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Resource not found';
        throw new Error(`Failed to read resource: ${errorMessage}`);
      }
    });

    // Handle prompts listing
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'specify_workflow',
            description: 'Start the complete Specify workflow for a new project',
            arguments: [
              {
                name: 'projectName',
                description: 'Name of the project to create',
                required: true
              }
            ]
          },
          {
            name: 'specify_status',
            description: 'Check the status of a Specify project',
            arguments: [
              {
                name: 'projectId',
                description: 'ID of the project to check',
                required: true
              }
            ]
          }
        ]
      };
    });

    // Handle prompt getting
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const args = request.params.arguments || {};

      if (promptName === 'specify_workflow') {
        return {
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: `You are an AI assistant helping with Specification-Driven Development.
                
The Specify workflow consists of the following stages:
1. **init**: Initialize project and gather requirements
2. **spec**: Create product requirements document (PRD)
3. **plan**: Define technical architecture and stack
4. **tasks**: Break down into detailed tasks
5. **implement**: Generate TDD tests and implementation guides

Guide the user through each stage, ensuring proper validation and verification at each step.`
              }
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: `I want to create a new project called "${args.projectName}". Let's start the Specify workflow.`
              }
            }
          ]
        };
      }

      if (promptName === 'specify_status') {
        const projectId = args.projectId as string;
        try {
          const projectData = await this.resourceManager.readResource(projectId, 'project.json');
          const project = JSON.parse(projectData.content);
          
          return {
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: `Project Status for ${project.projectName}:
- Current Stage: ${project.workflow.currentStage}
- Completed Stages: ${project.workflow.completedStages.join(', ') || 'None'}
- Next Stage: ${project.workflow.nextStage}`
                }
              }
            ]
          };
        } catch (error) {
          return {
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: `Project ${projectId} not found or invalid.`
                }
              }
            ]
          };
        }
      }

      throw new Error(`Unknown prompt: ${promptName}`);
    });
  }

  async start(): Promise<void> {
    // Initialize resource manager
    await this.resourceManager.initialize();

    // Start the server with STDIO transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Specify MCP Server started successfully');
  }
}

// Main entry point
async function main(): Promise<void> {
  try {
    const server = new SpecifyMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start Specify MCP Server:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
