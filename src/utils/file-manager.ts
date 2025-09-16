/**
 * File management utilities for .specify folder structure
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SPECIFY_FOLDER, FOLDER_STRUCTURE, FILE_EXTENSIONS } from '../constants/index.js';
import type { SpecifyDocument, DocumentMetadata } from '../types/index.js';

export class FileManager {
  private readonly projectPath: string;
  private readonly specifyPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.specifyPath = path.join(projectPath, SPECIFY_FOLDER);
  }

  /**
   * Initialize .specify folder structure
   */
  async initializeStructure(): Promise<void> {
    await this.ensureDirectory(this.specifyPath);
    
    for (const folder of Object.values(FOLDER_STRUCTURE)) {
      await this.ensureDirectory(path.join(this.specifyPath, folder));
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Save document to .specify folder
   */
  async saveDocument(document: SpecifyDocument): Promise<void> {
    const fullPath = path.join(this.projectPath, document.path);
    const dir = path.dirname(fullPath);
    
    await this.ensureDirectory(dir);
    
    const frontmatter = this.generateFrontmatter(document.metadata);
    const fullContent = `${frontmatter}\n${document.content}`;
    
    await fs.writeFile(fullPath, fullContent, 'utf-8');
  }

  /**
   * Read document from .specify folder
   */
  async readDocument(relativePath: string): Promise<SpecifyDocument | null> {
    const fullPath = path.join(this.projectPath, relativePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const { metadata, body } = this.parseFrontmatter(content);
      
      return {
        path: relativePath,
        type: this.getDocumentType(relativePath),
        content: body,
        metadata: this.parseMetadataToType(metadata),
      };
    } catch {
      return null;
    }
  }

  /**
   * List all documents of a specific type
   */
  async listDocuments(type: keyof typeof FOLDER_STRUCTURE): Promise<string[]> {
    const folderPath = path.join(this.specifyPath, FOLDER_STRUCTURE[type]);
    
    try {
      const files = await fs.readdir(folderPath);
      return files
        .filter(file => file.endsWith(FILE_EXTENSIONS.MARKDOWN))
        .map(file => path.join(SPECIFY_FOLDER, FOLDER_STRUCTURE[type], file));
    } catch {
      return [];
    }
  }

  /**
   * Check if .specify folder exists
   */
  async isInitialized(): Promise<boolean> {
    try {
      await fs.access(this.specifyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate frontmatter from metadata
   */
  private generateFrontmatter(metadata: DocumentMetadata): string {
    const lines = ['---'];
    for (const [key, value] of Object.entries(metadata)) {
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        value.forEach(item => lines.push(`  - ${item}`));
      } else if (value instanceof Date) {
        lines.push(`${key}: ${value.toISOString()}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Parse frontmatter from content
   */
  private parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { metadata: {}, body: content };
    }
    
    const [, frontmatter, body] = match;
    const metadata: Record<string, unknown> = {};
    
    const lines = frontmatter.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('  - ') && currentKey) {
        currentArray.push(line.substring(4));
      } else if (line.includes(': ')) {
        if (currentKey && currentArray.length > 0) {
          metadata[currentKey] = currentArray;
          currentArray = [];
        }
        
        const [key, value] = line.split(': ', 2);
        currentKey = key;
        
        if (value) {
          metadata[key] = this.parseValue(value);
        }
      } else if (line.endsWith(':')) {
        if (currentKey && currentArray.length > 0) {
          metadata[currentKey] = currentArray;
        }
        currentKey = line.slice(0, -1);
        currentArray = [];
      }
    }
    
    if (currentKey && currentArray.length > 0) {
      metadata[currentKey] = currentArray;
    }
    
    return { metadata, body: body.trim() };
  }

  /**
   * Parse value from frontmatter
   */
  private parseValue(value: string): string | Date | number | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (dateRegex.test(value)) {
      return new Date(value);
    }
    
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }
    
    return value;
  }

  /**
   * Parse metadata to DocumentMetadata type
   */
  private parseMetadataToType(metadata: Record<string, unknown>): DocumentMetadata {
    return {
      version: metadata.version as string || '1.0.0',
      createdAt: metadata.createdAt instanceof Date ? metadata.createdAt : new Date(metadata.createdAt as string || Date.now()),
      updatedAt: metadata.updatedAt instanceof Date ? metadata.updatedAt : new Date(metadata.updatedAt as string || Date.now()),
      author: metadata.author as string || 'specify-mcp',
      status: metadata.status as string || 'draft',
      tags: metadata.tags as string[] || [],
    };
  }

  /**
   * Get document type from path
   */
  private getDocumentType(relativePath: string): SpecifyDocument['type'] {
    if (relativePath.includes(FOLDER_STRUCTURE.PRD)) return 'prd';
    if (relativePath.includes(FOLDER_STRUCTURE.SPECS)) return 'spec';
    if (relativePath.includes(FOLDER_STRUCTURE.PLANS)) return 'plan';
    if (relativePath.includes(FOLDER_STRUCTURE.TASKS)) return 'task';
    return 'context';
  }
}
