# Specify MCP - Specification-Driven Development Server

An MCP (Model Context Protocol) server that implements Specification-Driven Development (SDD) methodology, enabling AI-augmented software development with controlled non-determinism and iterative refinement.

## Overview

Specify MCP provides a structured workflow for software development through five key phases:
1. **Init** - Project initialization through conversation
2. **Spec** - Product requirements documentation (PRD) focusing on WHAT and WHY
3. **Plan** - Technical architecture and implementation planning
4. **Tasks** - Work breakdown into detailed, testable tasks
5. **Implement** - TDD-based implementation with pseudo-code and test definitions

## Features

- 🎯 **AI-Augmented Development** - Leverages LLMs for specification generation and refinement
- 🔄 **Iterative Refinement** - Each phase supports continuous improvement through AI dialogue
- ✅ **Verification Modules** - Common and phase-specific validation to control hallucination
- 📁 **Structured Storage** - Organized `.specify` directory for all project artifacts
- 🧪 **TDD Focus** - Enforces Test-Driven Development with RED-GREEN-REFACTOR cycle
- 🔌 **Extensible Transport** - Version 1 with STDIO, extensible to HTTP (Version 2)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/specify-mcp.git
cd specify-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Run in development mode
npm run dev
```

## Usage with AI IDE

### Configuration

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "specify-mcp": {
      "command": "node",
      "args": ["/path/to/specify-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Available Tools

#### `sdd_init`
Initialize a new SDD project.

```typescript
{
  name: "Project Name",
  description: "Initial project description"
}
```

#### `sdd_spec`
Generate or refine product requirements specification.

```typescript
{
  projectId: "uuid", // Optional, uses current if not provided
  userInput: "Feature requirements description",
  refine: false // Set to true for refinement
}
```

#### `sdd_plan`
Create technical implementation plan.

```typescript
{
  projectId: "uuid",
  techStack: {
    language: "TypeScript",
    framework: "Express",
    database: "PostgreSQL",
    testing: "Jest"
  },
  refine: false
}
```

#### `sdd_tasks`
Break down work into detailed tasks.

```typescript
{
  projectId: "uuid",
  granularity: "medium" // "high", "medium", or "low"
}
```

#### `sdd_implement`
Generate TDD implementation guide for a specific task.

```typescript
{
  projectId: "uuid",
  taskId: "T001"
}
```

#### `sdd_verify`
Verify any document for issues.

```typescript
{
  content: "Document content to verify",
  phase: "spec" // "init", "spec", "plan", "tasks", or "implement"
}
```

#### `sdd_list_projects`
List all available projects.

#### `sdd_set_current_project`
Set the current working project.

```typescript
{
  projectId: "uuid"
}
```

## Project Structure

```
.specify/
├── projects/
│   └── [project-id]/
│       ├── project.json
│       ├── spec/
│       │   ├── current.md
│       │   └── versions/
│       ├── plan/
│       │   ├── current.md
│       │   ├── research.md
│       │   └── data-model.md
│       ├── tasks/
│       │   └── [task-id]/
│       │       ├── index.md
│       │       └── implementation.md
│       └── implementations/
│           ├── tests/
│           └── code/
├── templates/
├── cache/
└── logs/
```

## Workflow Example

```bash
# 1. Initialize project
> Use tool: sdd_init
  Input: { name: "Todo App", description: "A simple todo application" }

# 2. Create specification
> Use tool: sdd_spec
  Input: { userInput: "Users can create, edit, delete todos..." }

# 3. Plan technical implementation
> Use tool: sdd_plan
  Input: { techStack: { language: "TypeScript", framework: "Express" } }

# 4. Generate tasks
> Use tool: sdd_tasks
  Input: { granularity: "medium" }

# 5. Implement specific task
> Use tool: sdd_implement
  Input: { taskId: "T001" }
```

## Verification System

The server includes comprehensive verification for:

- **Hallucination Detection** - Identifies uncertain or speculative language
- **Ambiguity Detection** - Flags vague or unclear terms
- **Technical Consistency** - Ensures alignment across phases
- **Completeness Checking** - Validates required sections and content
- **TDD Compliance** - Enforces test-first development

## Architecture

### Core Components

- **Transport Layer** - Abstract transport with STDIO implementation
- **Resource Manager** - Handles `.specify` directory and file operations
- **Verification Module** - Common and phase-specific validators
- **Tool Implementations** - Individual tools for each SDD phase
- **Template System** - Markdown templates for consistent documentation

### Technology Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **Testing**: Jest
- **Validation**: Zod
- **Logging**: Winston

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck
```

## Clean Code Principles

The project follows clean code guidelines:

- ✅ Meaningful names revealing intent
- ✅ Single responsibility functions
- ✅ DRY (Don't Repeat Yourself)
- ✅ Proper encapsulation and interfaces
- ✅ Test-Driven Development
- ✅ Continuous refactoring

## Future Enhancements (Version 2)

- 🌐 HTTP transport with REST API
- 🔐 JWT authentication and authorization
- 🚀 Remote deployment capabilities
- 📊 Analytics and metrics dashboard
- 🤝 Multi-user collaboration
- 🔄 Real-time synchronization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TDD principles
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [AI-SDD Paper](doc/ai-sdd.md)
- [Specification-Driven Development](doc/spec-driven.md)

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

*Built with ❤️ for AI-augmented software development*
