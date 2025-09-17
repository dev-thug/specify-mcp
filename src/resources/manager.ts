/**
 * Resource manager for .specify directory
 * Handles file-based storage with structured organization
 */

import fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IResource, IResourceContent, IProjectStructure, ISpecifyStructure } from '../types/index.js';

export class ResourceManager {
  private readonly rootPath: string;
  private readonly structure: ISpecifyStructure;

  constructor(rootPath?: string) {
    // rootPath is now used as a fallback working directory
    this.rootPath = rootPath || process.cwd();
    this.structure = {
      rootPath: this.rootPath,
      projects: new Map(),
    };
  }

  async initialize(): Promise<void> {
    // No global initialization needed - each project manages its own .specify directory
  }


  private async loadProjectStructure(_projectId: string, projectPath: string): Promise<IProjectStructure> {
    const structure: IProjectStructure = {
      projectPath,
      spec: {
        path: path.join(projectPath, 'spec'),
        versions: [],
      },
      plan: {
        path: path.join(projectPath, 'plan'),
      },
      tasks: {
        path: path.join(projectPath, 'tasks'),
        taskFolders: new Map(),
      },
      implementations: {
        path: path.join(projectPath, 'implementations'),
        taskFolders: new Map(),
      },
    };

    // Load spec versions
    const specVersionsPath = path.join(structure.spec.path, 'versions');
    if (await fs.pathExists(specVersionsPath)) {
      structure.spec.versions = await fs.readdir(specVersionsPath);
    }

    // Load task folders
    const tasksPath = structure.tasks.path;
    if (await fs.pathExists(tasksPath)) {
      const taskDirs = await fs.readdir(tasksPath);
      for (const taskDir of taskDirs) {
        const taskPath = path.join(tasksPath, taskDir);
        const stat = await fs.stat(taskPath);
        if (stat.isDirectory()) {
          const indexPath = path.join(taskPath, 'index.md');
          const subtasks = (await fs.readdir(taskPath))
            .filter(file => file !== 'index.md' && file.endsWith('.md'));
          
          structure.tasks.taskFolders.set(taskDir, {
            indexPath,
            subtasks: subtasks.map(file => path.join(taskPath, file)),
          });
        }
      }
    }

    // Load implementation task folders
    const implementationsPath = structure.implementations.path;
    if (await fs.pathExists(implementationsPath)) {
      const implTaskDirs = await fs.readdir(implementationsPath);
      for (const implTaskDir of implTaskDirs) {
        const implTaskPath = path.join(implementationsPath, implTaskDir);
        const stat = await fs.stat(implTaskPath);
        if (stat.isDirectory()) {
          const indexPath = path.join(implTaskPath, 'index.md');
          const tests = new Map<string, string>();
          const code = new Map<string, string>();

          // Load tests
          const testsPath = path.join(implTaskPath, 'tests');
          if (await fs.pathExists(testsPath)) {
            const testFiles = await fs.readdir(testsPath);
            for (const testFile of testFiles.filter(f => f.endsWith('.md'))) {
              const basename = path.basename(testFile, '.md');
              tests.set(basename, path.join(testsPath, testFile));
            }
          }

          // Load code
          const codePath = path.join(implTaskPath, 'code');
          if (await fs.pathExists(codePath)) {
            const codeFiles = await fs.readdir(codePath);
            for (const codeFile of codeFiles.filter(f => f.endsWith('.md'))) {
              const basename = path.basename(codeFile, '.md');
              code.set(basename, path.join(codePath, codeFile));
            }
          }

          structure.implementations.taskFolders.set(implTaskDir, {
            indexPath,
            tests,
            code,
          });
        }
      }
    }

    return structure;
  }

  // Create a new project
  async createProject(projectName: string, description: string, projectDirectory?: string): Promise<string> {
    const projectId = uuidv4();
    
    // Determine project path: either in specified directory or current working directory
    const targetDir = projectDirectory || process.cwd();
    const projectPath = path.join(targetDir, '.specify');
    
    // Create project directory structure following QUICKSTART.md layout
    await fs.ensureDir(projectPath);
    await fs.ensureDir(path.join(projectPath, 'spec', 'versions'));
    await fs.ensureDir(path.join(projectPath, 'plan'));
    await fs.ensureDir(path.join(projectPath, 'tasks'));
    await fs.ensureDir(path.join(projectPath, 'implementations'));
    
    // Create project metadata
    const metadata = {
      id: projectId,
      name: projectName,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'initializing',
    };
    
    await fs.writeJSON(path.join(projectPath, 'project.json'), metadata, { spaces: 2 });
    
    // Update structure
    const structure = await this.loadProjectStructure(projectId, projectPath);
    this.structure.projects.set(projectId, structure);
    
    return projectId;
  }

  // Load existing project from .specify directory
  async loadProject(projectDirectory: string): Promise<string | null> {
    const specifyPath = path.join(projectDirectory, '.specify');
    const metadataPath = path.join(specifyPath, 'project.json');
    
    if (!(await fs.pathExists(metadataPath))) {
      return null; // No project exists
    }
    
    try {
      const metadata = await fs.readJSON(metadataPath);
      const projectId = metadata.id;
      
      // Load project structure
      const structure = await this.loadProjectStructure(projectId, specifyPath);
      this.structure.projects.set(projectId, structure);
      
      return projectId;
    } catch (error) {
      console.warn(`Failed to load project from ${projectDirectory}:`, error);
      return null;
    }
  }

  // List all resources
  async listResources(): Promise<IResource[]> {
    const resources: IResource[] = [];
    
    for (const [projectId, projectStructure] of this.structure.projects) {
      // Add project metadata
      const metadataPath = path.join(projectStructure.projectPath, 'project.json');
      if (await fs.pathExists(metadataPath)) {
        resources.push({
          uri: `specify://project/${projectId}/metadata`,
          name: `Project ${projectId} Metadata`,
          mimeType: 'application/json',
          description: 'Project configuration and metadata',
        });
      }
      
      // Add spec resources
      const currentSpecPath = path.join(projectStructure.spec.path, 'current.md');
      if (await fs.pathExists(currentSpecPath)) {
        resources.push({
          uri: `specify://project/${projectId}/spec/current`,
          name: `Specification for ${projectId}`,
          mimeType: 'text/markdown',
          description: 'Current project specification',
        });
      }
      
      // Add spec versions
      for (const version of projectStructure.spec.versions) {
        resources.push({
          uri: `specify://project/${projectId}/spec/version/${version}`,
          name: `Spec Version ${version}`,
          mimeType: 'text/markdown',
          description: `Specification version ${version}`,
        });
      }
      
      // Add plan resources
      const planPath = path.join(projectStructure.plan.path, 'current.md');
      if (await fs.pathExists(planPath)) {
        resources.push({
          uri: `specify://project/${projectId}/plan/current`,
          name: `Plan for ${projectId}`,
          mimeType: 'text/markdown',
          description: 'Current technical plan',
        });
      }
      
      // Add task resources
      for (const [taskId, taskFolder] of projectStructure.tasks.taskFolders) {
        resources.push({
          uri: `specify://project/${projectId}/task/${taskId}/index`,
          name: `Task ${taskId}`,
          mimeType: 'text/markdown',
          description: 'Task description and overview',
        });
        
        for (const subtask of taskFolder.subtasks) {
          const subtaskName = path.basename(subtask, '.md');
          resources.push({
            uri: `specify://project/${projectId}/task/${taskId}/${subtaskName}`,
            name: `Subtask ${subtaskName}`,
            mimeType: 'text/markdown',
            description: `Subtask details for ${taskId}`,
          });
        }
      }
      
      // Add implementation resources
      for (const [implTaskId, implTaskFolder] of projectStructure.implementations.taskFolders) {
        resources.push({
          uri: `specify://project/${projectId}/implementation/${implTaskId}/index`,
          name: `Implementation ${implTaskId}`,
          mimeType: 'text/markdown',
          description: 'Implementation overview and guidelines',
        });
        
        // Add test files
        for (const [testName] of implTaskFolder.tests) {
          resources.push({
            uri: `specify://project/${projectId}/implementation/${implTaskId}/tests/${testName}`,
            name: `Test ${testName}`,
            mimeType: 'text/markdown',
            description: `TDD test specification for ${implTaskId}`,
          });
        }
        
        // Add code files
        for (const [codeName] of implTaskFolder.code) {
          resources.push({
            uri: `specify://project/${projectId}/implementation/${implTaskId}/code/${codeName}`,
            name: `Code ${codeName}`,
            mimeType: 'text/markdown',
            description: `Implementation guide for ${implTaskId}`,
          });
        }
      }
    }
    
    return resources;
  }

  // Read resource content
  async readResource(uri: string): Promise<IResourceContent> {
    const parsed = this.parseResourceUri(uri);
    
    if (!parsed) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const { projectId, resourceType, resourcePath } = parsed;
    const projectStructure = this.structure.projects.get(projectId);
    
    if (!projectStructure) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    let filePath: string;
    let mimeType = 'text/markdown';
    
    switch (resourceType) {
      case 'metadata':
        filePath = path.join(projectStructure.projectPath, 'project.json');
        mimeType = 'application/json';
        break;
      case 'spec':
        if (resourcePath === 'current') {
          filePath = path.join(projectStructure.spec.path, 'current.md');
        } else if (resourcePath?.startsWith('version/')) {
          const version = resourcePath.substring('version/'.length);
          filePath = path.join(projectStructure.spec.path, 'versions', version);
        } else {
          throw new Error(`Invalid spec resource: ${resourcePath}`);
        }
        break;
      case 'plan':
        filePath = path.join(projectStructure.plan.path, 'current.md');
        break;
      case 'task':
        const taskParts = resourcePath?.split('/') || [];
        if (taskParts.length < 2) {
          throw new Error(`Invalid task resource: ${resourcePath}`);
        }
        const taskId = taskParts[0];
        const taskFile = taskParts[1];
        
        if (!taskId || !taskFile) {
          throw new Error(`Invalid task resource parts: ${resourcePath}`);
        }
        
        if (taskFile === 'index') {
          filePath = path.join(projectStructure.tasks.path, taskId, 'index.md');
        } else {
          filePath = path.join(projectStructure.tasks.path, taskId, `${taskFile}.md`);
        }
        break;
      case 'implementation':
        const implParts = resourcePath?.split('/') || [];
        if (implParts.length < 2) {
          throw new Error(`Invalid implementation resource: ${resourcePath}. Expected format: taskId/type/filename or taskId/index`);
        }
        const implTaskId = implParts[0];
        const implType = implParts[1];
        
        if (!implTaskId || !implType) {
          throw new Error(`Invalid implementation resource parts: ${resourcePath}`);
        }
        
        if (implType === 'index') {
          filePath = path.join(projectStructure.implementations.path, implTaskId, 'index.md');
        } else if (implParts.length >= 3) {
          const implFile = implParts.slice(2).join('/');
          if (implType === 'tests') {
            filePath = path.join(projectStructure.implementations.path, implTaskId, 'tests', `${implFile}.md`);
          } else if (implType === 'code') {
            filePath = path.join(projectStructure.implementations.path, implTaskId, 'code', `${implFile}.md`);
          } else {
            throw new Error(`Invalid implementation type: ${implType}`);
          }
        } else {
          throw new Error(`Invalid implementation resource format: ${resourcePath}`);
        }
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      uri,
      mimeType,
      text: content,
    };
  }

  // Write resource content
  async writeResource(uri: string, content: string): Promise<void> {
    const parsed = this.parseResourceUri(uri);
    
    if (!parsed) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const { projectId, resourceType, resourcePath } = parsed;
    const projectStructure = this.structure.projects.get(projectId);
    
    if (!projectStructure) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    let filePath: string;
    
    switch (resourceType) {
      case 'spec':
        if (resourcePath === 'current') {
          filePath = path.join(projectStructure.spec.path, 'current.md');
          // Also save as a version
          const version = `v${Date.now()}`;
          const versionPath = path.join(projectStructure.spec.path, 'versions', `${version}.md`);
          await fs.writeFile(versionPath, content, 'utf-8');
          projectStructure.spec.versions.push(`${version}.md`);
        } else {
          throw new Error('Can only write to current spec');
        }
        break;
      case 'plan':
        if (resourcePath === 'current') {
          filePath = path.join(projectStructure.plan.path, 'current.md');
        } else if (resourcePath === 'research') {
          filePath = path.join(projectStructure.plan.path, 'research.md');
        } else if (resourcePath === 'data-model') {
          filePath = path.join(projectStructure.plan.path, 'data-model.md');
        } else {
          // Allow any plan file with .md extension
          filePath = path.join(projectStructure.plan.path, `${resourcePath}.md`);
        }
        break;
      case 'task':
        const taskParts = resourcePath?.split('/') || [];
        if (taskParts.length < 2) {
          throw new Error(`Invalid task resource: ${resourcePath}`);
        }
        const taskId = taskParts[0];
        const taskFile = taskParts[1];
        
        if (!taskId) {
          throw new Error(`Invalid task ID: ${taskId}`);
        }
        const taskDir = path.join(projectStructure.tasks.path, taskId);
        await fs.ensureDir(taskDir);
        
        if (taskFile === 'index') {
          filePath = path.join(taskDir, 'index.md');
        } else {
          filePath = path.join(taskDir, `${taskFile}.md`);
        }
        
        // Update task structure
        if (!projectStructure.tasks.taskFolders.has(taskId)) {
          projectStructure.tasks.taskFolders.set(taskId, {
            indexPath: path.join(taskDir, 'index.md'),
            subtasks: [],
          });
        }
        
        if (taskFile !== 'index') {
          const taskFolder = projectStructure.tasks.taskFolders.get(taskId)!;
          if (!taskFolder.subtasks.includes(filePath)) {
            taskFolder.subtasks.push(filePath);
          }
        }
        break;
      case 'implementation':
        const implParts = resourcePath?.split('/') || [];
        if (implParts.length < 3) {
          throw new Error(`Invalid implementation resource: ${resourcePath}. Expected format: taskId/type/filename`);
        }
        const implTaskId = implParts[0];
        const implType = implParts[1]; // 'tests' or 'code'
        const implFile = implParts.slice(2).join('/');
        
        if (!implTaskId || !implType || !implFile) {
          throw new Error(`Invalid implementation resource: ${resourcePath}`);
        }
        
        // Ensure task folder exists in implementations
        const implTaskDir = path.join(projectStructure.implementations.path, implTaskId);
        await fs.ensureDir(implTaskDir);
        
        // Initialize task folder if not exists
        if (!projectStructure.implementations.taskFolders.has(implTaskId)) {
          projectStructure.implementations.taskFolders.set(implTaskId, {
            indexPath: path.join(implTaskDir, 'index.md'),
            tests: new Map(),
            code: new Map(),
          });
        }
        
        const taskFolder = projectStructure.implementations.taskFolders.get(implTaskId)!;
        
        if (implType === 'tests') {
          const testsDir = path.join(implTaskDir, 'tests');
          await fs.ensureDir(testsDir);
          filePath = path.join(testsDir, `${implFile}.md`);
          taskFolder.tests.set(implFile, filePath);
        } else if (implType === 'code') {
          const codeDir = path.join(implTaskDir, 'code');
          await fs.ensureDir(codeDir);
          filePath = path.join(codeDir, `${implFile}.md`);
          taskFolder.code.set(implFile, filePath);
        } else if (implType === 'index') {
          filePath = path.join(implTaskDir, 'index.md');
        } else {
          throw new Error(`Invalid implementation type: ${implType}. Expected 'tests', 'code', or 'index'`);
        }
        break;
      default:
        throw new Error(`Cannot write to resource type: ${resourceType}`);
    }
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Update project metadata
    const metadataPath = path.join(projectStructure.projectPath, 'project.json');
    if (await fs.pathExists(metadataPath)) {
      const metadata = await fs.readJSON(metadataPath);
      metadata.updatedAt = new Date().toISOString();
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });
    }
  }

  // Parse resource URI
  private parseResourceUri(uri: string): {
    projectId: string;
    resourceType: string;
    resourcePath?: string;
  } | null {
    const match = uri.match(/^specify:\/\/project\/([^\/]+)\/([^\/]+)(?:\/(.+))?$/);
    
    if (!match) {
      return null;
    }
    
    const result: {
      projectId: string;
      resourceType: string;
      resourcePath?: string;
    } = {
      projectId: match[1]!,
      resourceType: match[2]!,
    };
    
    if (match[3]) {
      result.resourcePath = match[3];
    }
    
    return result;
  }

  // Get project by ID
  getProject(projectId: string): IProjectStructure | undefined {
    return this.structure.projects.get(projectId);
  }

  // List all projects
  listProjects(): string[] {
    return Array.from(this.structure.projects.keys());
  }
}
