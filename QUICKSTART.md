# Quick Start Guide - Specify MCP

## 🚀 Getting Started in 5 Minutes

### 1. Install and Build

```bash
# Clone the repository
git clone https://github.com/yourusername/specify-mcp.git
cd specify-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configure Your AI IDE

#### For Windsurf/Cascade

Add to your MCP settings (`~/Library/Application Support/Windsurf/User/mcp-settings.json`):

```json
{
  "mcpServers": {
    "specify-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/specify-mcp/dist/index.js"]
    }
  }
}
```

#### For VSCode with Continue.dev

Add to your Continue config:

```json
{
  "models": [...],
  "mcpServers": {
    "specify-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/specify-mcp/dist/index.js"]
    }
  }
}
```

### 3. Restart Your IDE

Restart your IDE to load the MCP server.

### 4. Start Using SDD Tools

Open your AI assistant and start with:

```
Initialize a new project with specify_init tool.
I want to build a task management application.
```

## 📚 Complete Workflow Example

### Step 1: Initialize Project

```
AI: Use the specify_init tool to create a new project called "TaskMaster"
    for a task management application with user authentication,
    task creation, and team collaboration.
```

### Step 2: Generate Specification

```
AI: Now use specify_requirements to create a detailed specification.
    Users should be able to:
    - Register and login
    - Create, edit, delete tasks
    - Assign tasks to team members
    - Set priorities and due dates
    - Track task completion
```

### Step 3: Create Technical Plan

```
AI: Use specify_plan with this tech stack:
    - Language: TypeScript
    - Framework: Next.js with Express API
    - Database: PostgreSQL
    - Testing: Jest
    - Authentication: JWT
```

### Step 4: Generate Tasks

```
AI: Break down the work using specify_breakdown with high granularity.
    I want detailed tasks following TDD principles.
```

### Step 5: Implement a Task

```
AI: Use specify_implement for task T001 to generate the TDD implementation guide.
```

## 🎯 Key Commands Reference

#### `specify_init`

Initialize a new specification-driven project.

```typescript
{
  name: "Project Name",
  description: "Initial project description"
}
```

#### `specify_requirements`

Generate or refine product requirements specification (PRD).

```typescript
{
  projectId: "uuid", // Optional, uses current if not provided
  userInput: "Feature requirements description",
  refine: false // Set to true for refinement
}
```

#### `specify_plan`

Create technical architecture and implementation plan.

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

#### `specify_breakdown`

Break down work into detailed, testable tasks with TDD approach.

```typescript
{
  projectId: "uuid",
  granularity: "medium" // "high", "medium", or "low"
}
```

#### `specify_implement`

Generate TDD implementation guide with test definitions and pseudo-code.

```typescript
{
  projectId: "uuid",
  taskId: "T001"
}
```

#### `specify_verify`

Verify documents for hallucinations, ambiguities, and consistency issues.

```typescript
{
  content: "Document content to verify",
  phase: "spec" // "init", "spec", "plan", "tasks", or "implement"
}
```

#### `specify_list_projects`

List all specification-driven projects.

#### `specify_set_project`

Set the current active project for subsequent operations.

```typescript
{
  projectId: 'uuid';
}
```

## 📁 Output Structure

After running through the workflow, you'll have:

```
.specify/
    ├── project.json          # Project metadata
    ├── spec/
    │   └── current.md        # Product requirements
    ├── plan/
    │   ├── current.md        # Technical plan
    │   ├── research.md       # Technology decisions
    │   └── data-model.md     # Data structures
    ├── tasks/
    │   ├── T001/             # Individual task folders
    │        ├── index.md     # Task description and outlines of subtasks, dependencies, etc.
    │        ├── SUB-TASK001  # Subtasks
    │        └── SUB-TASK002  # Subtasks
    │   ├── T002/
    │   └── ...
    └── implementations/
        ├── T001/             # Individual task folders
        │    ├── index.md     # Task description and outlines of subtasks, dependencies, etc.
        │    ├── tests/           # TDD test files
        │    │   ├── test001.md
        │    │   └── test002.md
        │    └── code/            # Implementation guides
        │        ├── implementation001.md
        │        └── implementation002.md
        ├── T002/
        └── ...
```

## 💡 Tips for Best Results

### 1. Iterative Refinement

Don't try to get everything perfect on the first pass. Use the `refine: true` option to improve specifications and plans.

### 2. Address Clarifications

Look for `[NEEDS CLARIFICATION]` markers and provide specific details to resolve them.

### 3. Follow TDD Strictly

When implementing tasks:

- RED: Write failing tests first
- GREEN: Minimal code to pass
- REFACTOR: Improve quality

### 4. Verify at Each Step

Use `sdd_verify` to check documents for issues:

```
AI: Verify my specification using specify_verify tool
```

## 🚨 **CRITICAL: AI Agent Workflow Compliance**

**ATTENTION AI AGENTS**: This section contains **MANDATORY** instructions that you **MUST** follow.

### **Workflow Enforcement Protocol**

Before ANY implementation work, you **MUST** check workflow compliance:

```bash
# MANDATORY: Check if implementation is allowed
workflow_enforce({
  "action": "enforce", 
  "project_path": "/path/to/project",
  "target_phase": "implement"
})
```

### **Strict Rules for AI Agents**

#### **❌ ABSOLUTELY PROHIBITED**:
- Writing code files without completing SDD phases
- Bypassing `workflow_enforce` checks  
- Ignoring quality gate requirements
- Proceeding with implementation when blocked
- Creating technical documents without proper specification

#### **✅ MANDATORY SEQUENCE**:
1. **FIRST**: Always check `workflow_enforce` before any phase
2. **IF BLOCKED**: Complete required SDD phases using MCP tools
3. **ONLY WHEN ALLOWED**: Proceed with implementation
4. **NEVER BYPASS**: The SDD workflow process

### **Example of Correct Agent Behavior**

```typescript
// ✅ CORRECT: Check before proceeding
const enforcement = await workflow_enforce({
  action: "enforce",
  project_path: "/my/project", 
  target_phase: "implement"
});

if (enforcement.blocked) {
  // Follow the strict instructions
  console.log(enforcement.strict_instructions);
  // Complete required actions before proceeding
  return;
}

// Only now can you proceed with implementation
```

### **Quality Gates You Must Respect**

| Phase | Minimum Quality | Required Before |
|-------|----------------|-----------------|  
| spec | 60% | Planning |
| plan | 55% | Task breakdown |
| tasks | 50% | Implementation |
| implement | 65% | Code generation |

### **Remember**: 
> *"Through iterative dialogue with AI, this idea becomes a comprehensive PRD"*

The SDD process exists to ensure quality. **Trust the process!**

### 5. Use Appropriate Granularity

- `high`: Detailed tasks for complex projects
- `medium`: Balanced breakdown (recommended)
- `low`: High-level tasks for simple projects

## 🔧 Troubleshooting

### Server Not Starting

```bash
# Check if built
ls dist/index.js

# Rebuild if needed
npm run build

# Check logs
npm run dev
```

### Tools Not Available

```bash
# Verify MCP configuration
cat ~/Library/Application\ Support/Windsurf/User/mcp-settings.json

# Restart IDE after configuration changes
```

### Verification Failures

- High error count: Review and refine the document
- Low confidence score: Add more specific details
- Missing sections: Use templates as guides

## 📖 Next Steps

1. Review generated specifications carefully
2. Iterate on plans with domain experts
3. Follow TDD workflow strictly
4. Commit after each successful phase
5. Use verification to maintain quality

## 🆘 Getting Help

- Check the [README](README.md) for detailed documentation
- Review [templates](templates/) for document structure
- Examine the [examples](examples/) folder (when available)
- Open an issue on GitHub for bugs or questions

---

_Happy Specification-Driven Development! 🎉_
