# Specify MCP Server

A Model Context Protocol (MCP) server implementing Specification-Driven Development methodology for AI-assisted software development.

## Overview

This MCP server provides a structured workflow for software development through five distinct stages:

1. **init** - Project initialization and requirements gathering
2. **spec** - Product Requirements Document (PRD) generation  
3. **plan** - Technical architecture and technology stack planning
4. **tasks** - Work breakdown structure and task decomposition
5. **implement** - Test-Driven Development (TDD) implementation guides

Each stage includes verification modules to control AI hallucination and ensure specification quality.

## Features

- 🔄 **Iterative Refinement** - Each stage supports iterative improvement through AI dialogue
- ✅ **Verification System** - Common and stage-specific verification to ensure quality
- 📁 **Resource Management** - Structured project file organization
- 🧪 **TDD Support** - Automatic test generation for multiple frameworks
- 🏗️ **Extensible Architecture** - Modular design for easy extension

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/specify-mcp.git
cd specify-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### As MCP Server

The server implements the MCP protocol and can be integrated with AI IDEs that support MCP.

```bash
# Start the server
npm start
```

### Configuration for AI IDE

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "specify": {
      "command": "node",
      "args": ["path/to/specify-mcp/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

## Specify Workflow Tools

### 1. initialize_project

Initialize a new project with requirements gathering and setup.

```json
{
  "name": "initialize_project",
  "arguments": {
    "projectName": "MyProject",
    "description": "A web application for task management",
    "domain": "productivity",
    "goals": ["Improve task tracking", "Enable collaboration"],
    "constraints": ["Must work offline", "Mobile-first design"]
  }
}
```

### 2. create_specification

Create product specification document focusing on user needs and business value.

```json
{
  "name": "create_specification",
  "arguments": {
    "projectId": "myproject-1234567890",
    "userRequirements": "Additional requirements...",
    "focusAreas": ["user experience", "performance"],
    "excludeAreas": ["billing", "analytics"]
  }
}
```

### 3. create_technical_plan

Create technical architecture plan with technology stack and design decisions.

```json
{
  "name": "create_technical_plan",
  "arguments": {
    "projectId": "myproject-1234567890",
    "techStack": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "Express"],
      "database": ["PostgreSQL"],
      "testing": ["Jest", "Cypress"]
    },
    "architecture": "microservices"
  }
}
```

### 4. breakdown_tasks

Break down project into detailed tasks and create work breakdown structure.

```json
{
  "name": "breakdown_tasks",
  "arguments": {
    "projectId": "myproject-1234567890",
    "granularity": "medium",
    "groupingStrategy": "feature"
  }
}
```

### 5. generate_tests

Generate TDD tests and implementation guides for development.

```json
{
  "name": "generate_tests",
  "arguments": {
    "projectId": "myproject-1234567890",
    "taskId": "TASK-001",
    "testingFramework": "jest",
    "tddApproach": "red-green-refactor"
  }
}
```

## Project Structure

```
specify-mcp/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── types/                # TypeScript type definitions
│   ├── transport/            # Transport layer (STDIO/HTTP)
│   ├── tools/                # SDD workflow tools
│   │   ├── init.ts          # Project initialization
│   │   ├── spec.ts          # Specification generation
│   │   ├── plan.ts          # Technical planning
│   │   ├── tasks.ts         # Task breakdown
│   │   └── implement.ts     # TDD implementation
│   ├── resources/            # Resource management
│   └── verification/         # Verification modules
├── sdd-projects/             # Generated project files
├── package.json
├── tsconfig.json
└── README.md
```

## Generated Project Structure

Each Specify project creates the following structure:

```
.specify/
└── {project-name}/
    ├── metadata.json        # Project metadata
    ├── README.md           # Project overview
    ├── init/              # Initialization artifacts
    ├── spec/              # Specification documents
    ├── plan/              # Technical plans and ADRs
    ├── tasks/             # Task breakdown structure
    └── implement/         # TDD implementation guides
```

## Verification System

### Common Verification
- Hallucination detection
- Consistency checking
- Fact verification
- Multi-run consensus

### Stage-Specific Verification
- **init**: Project information completeness
- **spec**: Requirement ambiguity detection
- **plan**: Technology compatibility checks
- **tasks**: Coverage and dependency validation
- **implement**: Test completeness verification

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture

### Core Components

1. **MCP Server** - Handles JSON-RPC communication
2. **Transport Layer** - Abstracted for STDIO/HTTP support
3. **Tool Registry** - Manages SDD workflow tools
4. **Resource Manager** - File system operations
5. **Verification Pipeline** - Quality assurance

### Design Principles

- **Modularity** - Each stage is independent
- **Extensibility** - Easy to add new stages or verifiers
- **Type Safety** - Full TypeScript implementation
- **Clean Code** - Following best practices

## Roadmap

### Version 1.0 (Current)
- [x] STDIO transport
- [x] Core Specify workflow
- [x] Basic verification
- [x] Resource management

### Version 2.0 (Planned)
- [ ] HTTP transport with authentication
- [ ] Enhanced verification with LLM
- [ ] Web dashboard
- [ ] Multi-project management
- [ ] Team collaboration features

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - See LICENSE file for details

## Based On

This implementation is based on the AI-SDD paper and Specification-Driven Development methodology, integrating:

- AI-Augmented Specification-Driven Development principles
- Test-Driven Development practices
- Model Context Protocol standards
- Clean Code principles

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

## Important Notes

### Project ID Handling
When using the tools, the `initialize_project` tool returns a PROJECT_ID that must be used for subsequent tools. The ID is clearly marked in the response as `PROJECT_ID: {project-name}`.

### Template-Based Output
All specifications follow the structured templates in the `templates/` directory, ensuring consistent and comprehensive documentation with [NEEDS CLARIFICATION] markers for ambiguous requirements.

**Note**: This version uses local STDIO transport. HTTP transport with authentication will be added in version 2.0.
