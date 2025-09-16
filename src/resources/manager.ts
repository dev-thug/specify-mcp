import type { ProjectResource } from '../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';

export class ResourceManager {
  private readonly basePath: string;
  private readonly resources: Map<string, ProjectResource>;

  constructor(basePath: string = './.specify') {
    this.basePath = basePath;
    this.resources = new Map();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async createResource(
    projectId: string,
    resourcePath: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ProjectResource> {
    const uri = this.buildUri(projectId, resourcePath);
    const fullPath = this.getFullPath(projectId, resourcePath);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    const resource: ProjectResource = {
      uri,
      name: path.basename(resourcePath),
      mimeType: this.getMimeType(resourcePath),
      content,
      metadata
    };

    this.resources.set(uri, resource);
    return resource;
  }

  async readResource(projectId: string, resourcePath: string): Promise<ProjectResource> {
    const uri = this.buildUri(projectId, resourcePath);
    
    if (this.resources.has(uri)) {
      return this.resources.get(uri)!;
    }

    const fullPath = this.getFullPath(projectId, resourcePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    const resource: ProjectResource = {
      uri,
      name: path.basename(resourcePath),
      mimeType: this.getMimeType(resourcePath),
      content
    };

    this.resources.set(uri, resource);
    return resource;
  }

  async updateResource(
    projectId: string,
    resourcePath: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ProjectResource> {
    const uri = this.buildUri(projectId, resourcePath);
    const fullPath = this.getFullPath(projectId, resourcePath);
    
    await fs.writeFile(fullPath, content, 'utf-8');

    const resource: ProjectResource = {
      uri,
      name: path.basename(resourcePath),
      mimeType: this.getMimeType(resourcePath),
      content,
      metadata
    };

    this.resources.set(uri, resource);
    return resource;
  }

  async listResources(projectId: string, pattern?: string): Promise<ProjectResource[]> {
    const projectPath = path.join(this.basePath, projectId);
    const resources: ProjectResource[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(projectPath, fullPath);
          
          if (!pattern || relativePath.includes(pattern)) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const uri = this.buildUri(projectId, relativePath);
            
            resources.push({
              uri,
              name: entry.name,
              mimeType: this.getMimeType(fullPath),
              content
            });
          }
        }
      }
    };

    try {
      await walkDir(projectPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return resources;
  }

  async deleteResource(projectId: string, resourcePath: string): Promise<void> {
    const uri = this.buildUri(projectId, resourcePath);
    const fullPath = this.getFullPath(projectId, resourcePath);
    
    await fs.unlink(fullPath);
    this.resources.delete(uri);
  }

  private buildUri(projectId: string, resourcePath: string): string {
    return `specify://${projectId}/${resourcePath.replace(/\\/g, '/')}`;
  }

  private getFullPath(projectId: string, resourcePath: string): string {
    return path.join(this.basePath, projectId, resourcePath);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml'
    };
    return mimeTypes[ext] || 'text/plain';
  }
}
