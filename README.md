# Specify-MCP

AI-powered Software Design and Decomposition MCP Server

## Overview

Specify-MCP is a Model Context Protocol (MCP) server that implements AI-SDD (AI-powered Software Design and Decomposition) methodology. It helps automate the software development process by:

- Resolving ambiguities in requirements using NLP
- Generating formal specifications with ACSL translation
- Creating risk-assessed implementation plans
- Generating SMART tasks with testability checks
- Managing project documentation in `.specify` folder structure

## Features

### 🎯 Core Capabilities

- **Ambiguity Resolution**: Automatically identifies and resolves vague requirements
- **Specification Generation**: Creates detailed technical specifications from requirements
- **Implementation Planning**: Builds phase-based plans with dependency optimization
- **Task Generation**: Produces SMART tasks with acceptance criteria
- **Project Management**: Maintains structured documentation in `.specify` folder

### 🛠 MCP Tools

- `initialize_project` - Initialize new or existing projects
- `resolve_ambiguities` - Clarify requirements using NLP
- `generate_specification` - Create formal specifications
- `create_implementation_plan` - Build implementation plans
- `generate_tasks` - Generate development tasks
- `run_full_workflow` - Execute complete AI-SDD workflow

### 📚 MCP Resources

- `specify://context/current` - Project context
- `specify://prd/current` - Product requirements document
- `specify://spec/current` - Technical specification
- `specify://plan/current` - Implementation plan
- `specify://tasks/current` - Task list

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Claude Desktop (for MCP integration)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/specify-mcp.git
cd specify-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Claude Desktop Integration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "specify-mcp": {
      "command": "node",
      "args": ["path/to/specify-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

## Usage

### Initialize a Project

```javascript
// For new project
await initialize_project({
  projectPath: "/path/to/project",
  projectName: "My App",
  description: "E-commerce platform"
});

// For existing project
await initialize_project({
  projectPath: "/path/to/existing/project"
});
```

### Run Full Workflow

```javascript
await run_full_workflow({
  userIntent: "Create a web application for task management with user authentication",
  domain: "web",
  constraints: ["Must support 1000+ concurrent users", "GDPR compliant"],
  options: {
    specificationLevel: "detailed",
    teamSize: 5,
    planningHorizon: 30,
    taskGranularity: "medium"
  }
});
```

### Generate Specification Only

```javascript
// First resolve ambiguities
await resolve_ambiguities({
  userIntent: "Build a fast API for data processing",
  domain: "api"
});

// Then generate specification
await generate_specification({
  specificationLevel: "comprehensive",
  includeFormSpec: true
});
```

## Project Structure

```
.specify/
├── context/          # Project context and metadata
│   └── project.md
├── prd/             # Product requirements documents
│   └── requirements.md
├── specs/           # Technical specifications
│   └── specification.md
├── plans/           # Implementation plans
│   └── implementation.md
└── tasks/           # Task lists and tracking
    └── tasks.md
```

## Document Format

All documents are stored as Markdown with YAML frontmatter:

```markdown
---
version: 1.0.0
createdAt: 2024-01-01T00:00:00Z
updatedAt: 2024-01-01T00:00:00Z
author: specify-mcp
status: draft
tags:
  - specification
  - technical
---

# Document Content
...
```

## API Reference

### Tools

#### initialize_project
Initialize a new or existing project with `.specify` folder structure.

**Parameters:**
- `projectPath` (string, required): Path to project directory
- `projectName` (string, optional): Project name
- `description` (string, optional): Project description

#### resolve_ambiguities
Resolve ambiguities in user requirements.

**Parameters:**
- `userIntent` (string, required): Initial requirements
- `domain` (string, optional): Application domain (web, mobile, api)
- `constraints` (array, optional): Known constraints
- `context` (object, optional): Additional context

#### generate_specification
Generate formal specifications from resolved requirements.

**Parameters:**
- `useCurrentContext` (boolean): Use current workflow context
- `specificationLevel` (string): basic, detailed, or comprehensive
- `includeFormSpec` (boolean): Include formal ACSL specification

#### create_implementation_plan
Create implementation plan with risk assessment.

**Parameters:**
- `teamSize` (number): Expected team size
- `planningHorizon` (number): Planning horizon in days
- `riskTolerance` (string): low, medium, or high
- `includeDependencyGraph` (boolean): Include dependency graph

#### generate_tasks
Generate SMART tasks from implementation plan.

**Parameters:**
- `taskGranularity` (string): coarse, medium, or fine
- `maxTasksPerPhase` (number): Maximum tasks per phase
- `includeTestTasks` (boolean): Include testing tasks
- `prioritizeParallelization` (boolean): Optimize for parallel execution

## Development

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run in development mode
- `npm run lint` - Run ESLint
- `npm test` - Run tests

### Architecture

The system follows clean architecture principles:

```
src/
├── index.ts           # MCP server entry point
├── types/            # TypeScript type definitions
├── constants/        # Application constants
├── services/         # Core business logic
│   ├── ambiguity-resolver.ts
│   ├── specification-generator.ts
│   ├── implementation-planner.ts
│   ├── task-generator.ts
│   ├── workflow-orchestrator.ts
│   ├── project-initializer.ts
│   └── memory-graph.ts
└── utils/            # Utility functions
    └── file-manager.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow clean code principles
4. Write tests for new features
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
