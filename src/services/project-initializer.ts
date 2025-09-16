/**
 * Service for initializing projects with .specify folder structure
 */

import { promises as fs } from "fs";
import path from "path";
import { FileManager } from "../utils/file-manager.js";
import { WorkflowOrchestrator } from "./workflow-orchestrator.js";
import type { ProjectContext } from "../types/index.js";

export class ProjectInitializer {
  /**
   * Initialize a new or existing project
   */
  async initialize(
    projectPath: string,
    projectName?: string,
    description?: string
  ): Promise<ProjectContext> {
    const projectType = await this.detectProjectType(projectPath);
    const name = projectName || path.basename(projectPath);

    const orchestrator = new WorkflowOrchestrator();
    const context = await orchestrator.initializeProject(
      projectPath,
      projectType,
      name,
      description
    );

    if (projectType === "existing") {
      await this.analyzeExistingProject(projectPath, orchestrator);
    } else {
      await this.setupNewProject(projectPath);
    }

    return context;
  }

  /**
   * Detect if project is new or existing
   */
  private async detectProjectType(
    projectPath: string
  ): Promise<"new" | "existing"> {
    try {
      const files = await fs.readdir(projectPath);

      // Check for common project files
      const projectIndicators = [
        "package.json",
        "tsconfig.json",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        ".git",
        "src",
        "lib",
      ];

      const hasProjectFiles = files.some((file) =>
        projectIndicators.includes(file)
      );

      return hasProjectFiles ? "existing" : "new";
    } catch {
      // Directory doesn't exist, it's a new project
      await fs.mkdir(projectPath, { recursive: true });
      return "new";
    }
  }

  /**
   * Analyze existing project and generate initial documentation
   */
  private async analyzeExistingProject(
    projectPath: string,
    orchestrator: WorkflowOrchestrator
  ): Promise<void> {
    const analysis = await this.analyzeCodebase(projectPath);

    // Generate intent from analysis
    const intent = this.generateIntentFromAnalysis(analysis);

    // Run workflow to generate documentation
    await orchestrator.runFullWorkflow(
      intent,
      analysis.domain,
      analysis.constraints,
      {
        specificationLevel: "DETAILED",
        includeFormSpec: false,
        teamSize: 3,
        planningHorizon: 30,
        riskTolerance: "MEDIUM",
      }
    );
  }

  /**
   * Setup new project structure
   */
  private async setupNewProject(projectPath: string): Promise<void> {
    const fileManager = new FileManager(projectPath);
    await fileManager.initializeStructure();

    // Create initial README
    const readmeContent = `# Project

This project is managed by Specify-MCP.

## Structure

- \`.specify/\` - Project documentation and specifications
  - \`prd/\` - Product requirements documents
  - \`specs/\` - Technical specifications
  - \`plans/\` - Implementation plans
  - \`tasks/\` - Task lists
  - \`context/\` - Project context

## Getting Started

1. Define your requirements
2. Generate specifications
3. Create implementation plan
4. Generate and execute tasks

## Commands

Use the Specify-MCP tools to manage your project:
- \`resolve_ambiguities\` - Clarify requirements
- \`generate_specification\` - Create technical specs
- \`create_implementation_plan\` - Plan implementation
- \`generate_tasks\` - Generate development tasks
`;

    await fs.writeFile(
      path.join(projectPath, "README.md"),
      readmeContent,
      "utf-8"
    );
  }

  /**
   * Analyze existing codebase
   */
  private async analyzeCodebase(projectPath: string): Promise<{
    domain: string;
    constraints: string[];
    technologies: string[];
    structure: Record<string, number>;
  }> {
    const analysis = {
      domain: "general",
      constraints: [] as string[],
      technologies: [] as string[],
      structure: {} as Record<string, number>,
    };

    try {
      // Check for package.json
      const packageJsonPath = path.join(projectPath, "package.json");
      try {
        const packageJson = await fs.readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(packageJson);

        // Detect technologies from dependencies
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps["react"] || deps["next"] || deps["vue"] || deps["angular"]) {
          analysis.domain = "web";
          analysis.technologies.push("Frontend Framework");
        }

        if (deps["express"] || deps["fastify"] || deps["koa"]) {
          analysis.domain = analysis.domain === "web" ? "web" : "api";
          analysis.technologies.push("Node.js Backend");
        }

        if (deps["react-native"] || deps["expo"]) {
          analysis.domain = "mobile";
          analysis.technologies.push("React Native");
        }

        analysis.constraints.push("Node.js environment");
      } catch {
        // No package.json
      }

      // Check for Python requirements
      const requirementsPath = path.join(projectPath, "requirements.txt");
      try {
        await fs.access(requirementsPath);
        analysis.technologies.push("Python");
        analysis.constraints.push("Python environment");

        const requirements = await fs.readFile(requirementsPath, "utf-8");
        if (requirements.includes("django") || requirements.includes("flask")) {
          analysis.domain =
            analysis.domain === "general" ? "web" : analysis.domain;
          analysis.technologies.push("Python Web Framework");
        }
      } catch {
        // No requirements.txt
      }

      // Analyze directory structure
      const structure = await this.analyzeDirectoryStructure(projectPath);
      analysis.structure = structure;

      // Infer domain from structure
      if (structure["controllers"] || structure["routes"] || structure["api"]) {
        analysis.domain =
          analysis.domain === "general" ? "api" : analysis.domain;
      }

      if (structure["components"] || structure["pages"] || structure["views"]) {
        analysis.domain =
          analysis.domain === "general" ? "web" : analysis.domain;
      }

      if (structure["models"] || structure["schemas"]) {
        analysis.constraints.push("Database integration required");
      }

      if (structure["tests"] || structure["__tests__"] || structure["spec"]) {
        analysis.constraints.push("Test coverage required");
      }
    } catch (error) {
      // Error analyzing codebase
    }

    return analysis;
  }

  /**
   * Analyze directory structure
   */
  private async analyzeDirectoryStructure(
    projectPath: string,
    depth = 2,
    currentDepth = 0
  ): Promise<Record<string, number>> {
    const structure: Record<string, number> = {};

    if (currentDepth >= depth) return structure;

    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules"
        ) {
          structure[entry.name] = (structure[entry.name] || 0) + 1;

          const subPath = path.join(projectPath, entry.name);
          const subStructure = await this.analyzeDirectoryStructure(
            subPath,
            depth,
            currentDepth + 1
          );

          Object.entries(subStructure).forEach(([key, value]) => {
            structure[key] = (structure[key] || 0) + value;
          });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          structure[ext] = (structure[ext] || 0) + 1;
        }
      }
    } catch {
      // Error reading directory
    }

    return structure;
  }

  /**
   * Generate intent from codebase analysis
   */
  private generateIntentFromAnalysis(analysis: {
    domain: string;
    constraints: string[];
    technologies: string[];
    structure: Record<string, number>;
  }): string {
    let intent = `Maintain and enhance existing ${analysis.domain} application`;

    if (analysis.technologies.length > 0) {
      intent += ` built with ${analysis.technologies.join(", ")}`;
    }

    intent += ". The application should:";

    // Add requirements based on structure
    if (analysis.structure["controllers"] || analysis.structure["routes"]) {
      intent += "\n- Provide RESTful API endpoints";
    }

    if (analysis.structure["components"] || analysis.structure["views"]) {
      intent += "\n- Deliver responsive user interface";
    }

    if (analysis.structure["models"] || analysis.structure["schemas"]) {
      intent += "\n- Manage data persistence and retrieval";
    }

    if (analysis.structure["tests"]) {
      intent += "\n- Maintain comprehensive test coverage";
    }

    if (analysis.structure["auth"] || analysis.structure["middleware"]) {
      intent += "\n- Implement secure authentication and authorization";
    }

    // Add constraints
    if (analysis.constraints.length > 0) {
      intent += "\n\nConstraints:\n";
      analysis.constraints.forEach((constraint) => {
        intent += `- ${constraint}\n`;
      });
    }

    return intent;
  }
}
