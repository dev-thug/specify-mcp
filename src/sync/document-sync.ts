/**
 * Document Synchronization Manager
 * Manages document dependencies, versions, and automatic updates
 */

import fs from 'fs-extra';
import * as path from 'path';

export interface DocumentMetadata {
  lastModified: string;
  version: string;
  dependencies: string[];
  status: 'active' | 'outdated' | 'draft';
  checksum: string;
}

export interface SyncCheckResult {
  isUpToDate: boolean;
  outdatedDocuments: string[];
  recommendations: string[];
  conflicts: string[];
}

export class DocumentSyncManager {
  private readonly metadataCache = new Map<string, DocumentMetadata>();

  async checkProjectSync(specifyPath: string): Promise<SyncCheckResult> {
    const result: SyncCheckResult = {
      isUpToDate: true,
      outdatedDocuments: [],
      recommendations: [],
      conflicts: []
    };

    try {
      // Load all document metadata
      await this.loadMetadata(specifyPath);
      
      // Check dependencies between documents
      const dependencies = this.buildDependencyGraph();
      
      // Analyze sync status
      for (const [docPath, metadata] of this.metadataCache) {
        const syncStatus = await this.checkDocumentSync(docPath, metadata, dependencies);
        
        if (!syncStatus.isUpToDate) {
          result.isUpToDate = false;
          result.outdatedDocuments.push(docPath);
          result.recommendations.push(...syncStatus.recommendations);
        }
        
        if (syncStatus.hasConflicts) {
          result.conflicts.push(...syncStatus.conflicts);
        }
      }

      // Generate overall recommendations
      result.recommendations.push(...this.generateGlobalRecommendations(result));

    } catch (error) {
      result.recommendations.push(`동기화 체크 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  async updateDocumentMetadata(
    specifyPath: string, 
    documentPath: string, 
    content: string
  ): Promise<void> {
    const fullPath = path.join(specifyPath, documentPath);
    const metadata: DocumentMetadata = {
      lastModified: new Date().toISOString(),
      version: this.generateVersion(documentPath),
      dependencies: this.extractDependencies(documentPath, content),
      status: 'active',
      checksum: this.calculateChecksum(content)
    };

    // Save metadata alongside document
    const metadataPath = this.getMetadataPath(fullPath);
    await fs.ensureDir(path.dirname(metadataPath));
    await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

    // Update cache
    this.metadataCache.set(documentPath, metadata);
  }

  private async loadMetadata(specifyPath: string): Promise<void> {
    this.metadataCache.clear();
    
    // Recursively find all .md files and their metadata
    await this.scanDirectory(specifyPath, specifyPath);
  }

  private async scanDirectory(currentDir: string, baseDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, baseDir);
        } else if (entry.name.endsWith('.md')) {
          const relativePath = path.relative(baseDir, fullPath);
          await this.loadDocumentMetadata(relativePath, fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist, skip
    }
  }

  private async loadDocumentMetadata(relativePath: string, fullPath: string): Promise<void> {
    const metadataPath = this.getMetadataPath(fullPath);
    
    let metadata: DocumentMetadata;
    
    if (await fs.pathExists(metadataPath)) {
      try {
        metadata = await fs.readJSON(metadataPath);
      } catch (error) {
        // Metadata corrupted, regenerate
        metadata = await this.generateDefaultMetadata(relativePath, fullPath);
      }
    } else {
      // No metadata exists, generate default
      metadata = await this.generateDefaultMetadata(relativePath, fullPath);
    }

    this.metadataCache.set(relativePath, metadata);
  }

  private async generateDefaultMetadata(relativePath: string, fullPath: string): Promise<DocumentMetadata> {
    let content = '';
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      // File doesn't exist or can't be read
    }

    const stats = await fs.stat(fullPath).catch(() => null);
    
    return {
      lastModified: stats ? stats.mtime.toISOString() : new Date().toISOString(),
      version: '1.0.0',
      dependencies: this.extractDependencies(relativePath, content),
      status: 'active',
      checksum: this.calculateChecksum(content)
    };
  }

  private buildDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Build standard dependency relationships
    const standardDeps = {
      'plan/current.md': ['spec/current.md'],
      'plan/research.md': ['spec/current.md'],
      'plan/data-model.md': ['spec/current.md', 'plan/current.md'],
    };

    // Add task dependencies
    for (const [docPath] of this.metadataCache) {
      if (docPath.startsWith('tasks/') && docPath.endsWith('/index.md')) {
        graph.set(docPath, ['spec/current.md', 'plan/current.md']);
      }
      
      if (docPath.startsWith('implementations/') && docPath.includes('/index.md')) {
        const taskId = docPath.split('/')[1];
        graph.set(docPath, [`tasks/${taskId}/index.md`, 'plan/current.md']);
      }
      
      if (docPath.startsWith('implementations/') && docPath.includes('/tests/')) {
        const taskId = docPath.split('/')[1];
        graph.set(docPath, [`implementations/${taskId}/index.md`]);
      }
      
      if (docPath.startsWith('implementations/') && docPath.includes('/code/')) {
        const taskId = docPath.split('/')[1];
        graph.set(docPath, [`implementations/${taskId}/tests/`]);
      }
    }

    // Add standard dependencies
    for (const [doc, deps] of Object.entries(standardDeps)) {
      graph.set(doc, deps);
    }

    return graph;
  }

  private async checkDocumentSync(
    docPath: string, 
    metadata: DocumentMetadata, 
    dependencies: Map<string, string[]>
  ): Promise<{
    isUpToDate: boolean;
    recommendations: string[];
    hasConflicts: boolean;
    conflicts: string[];
  }> {
    const result = {
      isUpToDate: true,
      recommendations: [] as string[],
      hasConflicts: false,
      conflicts: [] as string[]
    };

    const docDeps = dependencies.get(docPath) || [];
    
    for (const depPath of docDeps) {
      const depMetadata = this.metadataCache.get(depPath);
      
      if (!depMetadata) {
        result.isUpToDate = false;
        result.recommendations.push(`의존성 문서 누락: ${depPath}`);
        continue;
      }
      
      // Check if dependency is newer
      const docTime = new Date(metadata.lastModified);
      const depTime = new Date(depMetadata.lastModified);
      
      if (depTime > docTime) {
        result.isUpToDate = false;
        result.recommendations.push(`${docPath}가 ${depPath}보다 오래됨 - 업데이트 필요`);
      }
      
      // Check for status conflicts
      if (depMetadata.status === 'outdated' && metadata.status === 'active') {
        result.hasConflicts = true;
        result.conflicts.push(`${docPath}가 outdated 의존성 ${depPath}를 참조함`);
      }
    }

    return result;
  }

  private extractDependencies(documentPath: string, content: string): string[] {
    const dependencies: string[] = [];
    
    // Standard document dependencies based on SDD workflow
    if (documentPath.startsWith('plan/')) {
      dependencies.push('spec/current.md');
    }
    
    if (documentPath.startsWith('tasks/')) {
      dependencies.push('spec/current.md', 'plan/current.md');
    }
    
    if (documentPath.startsWith('implementations/')) {
      const taskId = documentPath.split('/')[1];
      dependencies.push(`tasks/${taskId}/index.md`);
    }

    // Extract explicit references from content
    const referencePattern = /\[.*?\]\(([^)]+\.md)\)/g;
    let match;
    while ((match = referencePattern.exec(content)) !== null) {
      const referencedPath = match[1];
      if (referencedPath && !dependencies.includes(referencedPath)) {
        dependencies.push(referencedPath);
      }
    }

    return dependencies;
  }

  private generateVersion(documentPath: string): string {
    const existing = this.metadataCache.get(documentPath);
    if (!existing) {
      return '1.0.0';
    }
    
    // Simple version increment
    const parts = existing.version.split('.').map(Number);
    if (parts.length >= 3 && typeof parts[2] === 'number') {
      parts[2]++; // Increment patch version
      return parts.join('.');
    }
    return '1.0.1'; // Fallback for invalid version format
  }

  private calculateChecksum(content: string): string {
    // Simple checksum based on content length and hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${content.length}-${Math.abs(hash).toString(16)}`;
  }

  private getMetadataPath(documentPath: string): string {
    const dir = path.dirname(documentPath);
    const base = path.basename(documentPath, path.extname(documentPath));
    return path.join(dir, `.${base}.meta.json`);
  }

  private generateGlobalRecommendations(result: SyncCheckResult): string[] {
    const recommendations: string[] = [];
    
    if (result.outdatedDocuments.length > 0) {
      recommendations.push('프로젝트 문서들이 동기화되지 않았습니다. 순차적으로 업데이트하세요.');
    }
    
    if (result.conflicts.length > 0) {
      recommendations.push('문서 간 충돌이 발견되었습니다. 의존성을 재검토하세요.');
    }
    
    if (result.isUpToDate) {
      recommendations.push('모든 문서가 최신 상태입니다! 🎉');
    }

    return recommendations;
  }

  // Utility method to mark document as outdated
  async markAsOutdated(specifyPath: string, documentPath: string): Promise<void> {
    const metadata = this.metadataCache.get(documentPath);
    if (metadata) {
      metadata.status = 'outdated';
      const fullPath = path.join(specifyPath, documentPath);
      const metadataPath = this.getMetadataPath(fullPath);
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });
      this.metadataCache.set(documentPath, metadata);
    }
  }

  // Utility method to get sync recommendations for a specific document
  getDocumentRecommendations(documentPath: string): string[] {
    const metadata = this.metadataCache.get(documentPath);
    if (!metadata) {
      return [`문서 ${documentPath}의 메타데이터를 찾을 수 없습니다.`];
    }

    const recommendations: string[] = [];
    
    if (metadata.status === 'outdated') {
      recommendations.push('이 문서는 outdated 상태입니다. 업데이트가 필요합니다.');
    }
    
    if (metadata.status === 'draft') {
      recommendations.push('이 문서는 초안 상태입니다. 완성 후 active로 변경하세요.');
    }

    const age = Date.now() - new Date(metadata.lastModified).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);
    
    if (daysOld > 7) {
      recommendations.push(`이 문서는 ${Math.floor(daysOld)}일 전에 수정되었습니다. 최신성을 확인하세요.`);
    }

    return recommendations;
  }
}
