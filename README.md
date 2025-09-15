# Specify-MCP: AI-Augmented Specification-Driven Development

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

AI-Augmented Specification-Driven Development (AI-SDD) MCP Server that enables intelligent software specification generation, validation, and iterative improvement through AI assistance.

## 🚀 Features

- **AI-Powered Requirement Analysis**: Automatically resolve ambiguities and generate clear specifications
- **Intelligent Task Planning**: Create comprehensive implementation plans with dependency management
- **Quality Metrics & Validation**: Continuous quality monitoring and feedback-driven improvement
- **Formal Verification**: Generate formal verification conditions for requirements
- **Iterative Learning**: AI model performance monitoring and adaptive improvement
- **MCP Integration**: Seamless integration with Claude Desktop and other MCP-compatible tools

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **TypeScript**: Version 5.0+ (installed automatically)

## 🛠️ Installation Methods

### Method 1: Local Development Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/specify-mcp.git
cd specify-mcp
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Build the Project
```bash
npm run build
```

#### 4. Run Locally
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Or run directly
node dist/index.js
```

### Method 2: NPM Package Installation

#### 1. Install from NPM
```bash
# Global installation (recommended)
npm install -g specify-mcp

# Local installation
npm install specify-mcp
```

#### 2. Run the Server
```bash
# If installed globally
specify-mcp

# If installed locally
npx specify-mcp
```

## 🔧 Configuration

### Claude Desktop Integration

1. **Locate Claude Desktop Config**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add MCP Server Configuration**
```json
{
  "mcpServers": {
    "specify-mcp": {
      "command": "specify-mcp",
      "args": []
    }
  }
}
```

3. **For Local Development**
```json
{
  "mcpServers": {
    "specify-mcp": {
      "command": "node",
      "args": ["/path/to/specify-mcp/dist/index.js"],
      "cwd": "/path/to/specify-mcp"
    }
  }
}
```

## 📖 Usage

### Available Tools

The MCP server provides the following tools:

- **`resolve_ambiguities`**: Analyze and resolve ambiguous requirements
- **`generate_specification`**: Create detailed technical specifications
- **`create_implementation_plan`**: Generate comprehensive development plans
- **`generate_tasks`**: Create specific development tasks with acceptance criteria
- **`run_full_workflow`**: Execute the complete AI-SDD workflow

### Available Resources

- **`specify://context/current`**: Current analysis context
- **`specify://prd/current`**: Product requirements document
- **`specify://plan/current`**: Implementation plan
- **`specify://tasks/current`**: Generated tasks

### Available Prompts

- **`create_web_app`**: Web application specification template
- **`create_api_service`**: API service specification template
- **`analyze_requirements`**: Requirements analysis template

### Example Usage in Claude

```
I want to create a task management web application with user authentication, 
real-time notifications, and project collaboration features.

Please use the specify-mcp tools to:
1. Analyze and resolve any ambiguities in my requirements
2. Generate a detailed specification
3. Create an implementation plan
4. Generate specific development tasks
```

## 🧪 Development

### Development Scripts

```bash
# Build the project
npm run build

# Development mode with watch
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Project Structure

```
specify-mcp/
├── src/
│   ├── modules/
│   │   └── aisdd-workflow.ts      # Core AI-SDD workflow implementation
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   ├── validation/
│   │   └── common-validation.ts   # Validation utilities
│   └── index.ts                   # MCP server entry point
├── dist/                          # Compiled JavaScript output
├── .windsurf/                     # IDE configuration
├── reference/                     # Documentation and research papers
├── package.json
├── tsconfig.json
└── README.md
```

### Core Workflow Steps

The AI-SDD workflow implements a 5-step process:

1. **Requirements Analysis**: Parse and understand natural language requirements
2. **Specification Generation**: Create detailed technical specifications
3. **Task Planning**: Generate implementation tasks with dependencies
4. **Formal Verification**: Create verification conditions and quality metrics
5. **Iterative Improvement**: Monitor performance and adapt based on feedback

## 🔍 API Documentation

### Tool: `resolve_ambiguities`

Analyzes natural language requirements and identifies ambiguous terms or concepts.

**Input:**
```json
{
  "naturalLanguage": "Create a fast and user-friendly web application",
  "domain": "web-development"
}
```

**Output:**
```json
{
  "resolvedIntent": {
    "description": "Web application with performance and UX focus",
    "ambiguities": ["fast", "user-friendly"],
    "clarifications": ["< 500ms response time", "intuitive UI design"]
  }
}
```

### Tool: `generate_specification`

Creates comprehensive technical specifications from resolved requirements.

**Input:**
```json
{
  "resolvedIntent": { /* resolved requirements */ },
  "config": {
    "includeArchitecture": true,
    "includePerformanceMetrics": true
  }
}
```

### Tool: `run_full_workflow`

Executes the complete AI-SDD workflow from natural language to implementation tasks.

**Input:**
```json
{
  "naturalLanguage": "Build a real-time chat application",
  "domain": "web-development",
  "config": {
    "qualityThreshold": 0.8,
    "maxIterations": 5
  }
}
```

## 🧩 Integration Examples

### With VS Code

1. Install the MCP extension for VS Code
2. Configure the server in your workspace settings
3. Use AI-SDD commands directly in your editor

### With Other MCP Clients

The server follows the standard MCP protocol and can be integrated with any MCP-compatible client.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Coding Standards

- Follow TypeScript best practices
- Maintain test coverage above 80%
- Use meaningful commit messages
- Document all public APIs
- Follow the existing code style

## 📊 Quality Metrics

The system tracks multiple quality dimensions:

- **Completeness**: Requirement coverage and specification depth
- **Consistency**: Alignment between requirements, specs, and tasks
- **Clarity**: Unambiguous language and clear definitions
- **Testability**: Verifiable acceptance criteria
- **Maintainability**: Code quality and documentation
- **Performance**: System efficiency and response times
- **Security**: Security considerations and best practices

## 🐛 Troubleshooting

### Common Issues

**Issue**: MCP server not connecting to Claude Desktop
- **Solution**: Check the configuration file path and syntax
- **Verify**: The server executable is accessible

**Issue**: TypeScript compilation errors
- **Solution**: Run `npm run build` and check for type errors
- **Verify**: All dependencies are installed correctly

**Issue**: Permission denied when running globally installed package
- **Solution**: Use `sudo npm install -g specify-mcp` (macOS/Linux) or run as administrator (Windows)

### Debug Mode

Enable debug logging:
```bash
DEBUG=specify-mcp* specify-mcp
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/desktop)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [AI-SDD Research Papers](./reference/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/specify-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/specify-mcp/discussions)
- **Email**: your-email@example.com

## 🙏 Acknowledgments

- Model Context Protocol team for the excellent standard
- AI-SDD research community for foundational concepts
- TypeScript and Node.js communities for robust tooling

---

**Note**: This project is under active development. Features and APIs may change between versions. Please check the changelog for breaking changes.
