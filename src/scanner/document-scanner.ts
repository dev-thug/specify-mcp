/**
 * Document Scanner System
 * Automatically finds and recognizes existing project documents
 */

import fs from 'fs-extra';
import * as path from 'path';

export interface FoundDocument {
  path: string;
  filename: string;
  type: 'spec' | 'plan' | 'tasks' | 'readme' | 'config' | 'unknown';
  confidence: number; // 0-1 confidence in type classification
  content: string;
  size: number;
  keywords: string[];
  lastModified: Date;
}

export interface ScanResult {
  foundDocuments: FoundDocument[];
  suggestions: MigrationSuggestion[];
  totalDocuments: number;
  specCandidates: FoundDocument[];
  planCandidates: FoundDocument[];
  taskCandidates: FoundDocument[];
}

export interface MigrationSuggestion {
  sourceDoc: FoundDocument;
  targetType: 'spec' | 'plan' | 'tasks';
  targetPath: string;
  confidence: number;
  reason: string;
  autoMigratable: boolean;
}

export class DocumentScanner {
  
  // File patterns for different document types
  private readonly patterns = {
    spec: {
      filenames: [
        'readme.md', 'readme.txt', 'specification.md', 'spec.md', 'requirements.md',
        'requirements.txt', 'prd.md', 'product.md', 'functional-spec.md', 'user-stories.md',
        'brief.md', 'overview.md'
      ],
      keywords: [
        'requirement', 'specification', 'user', 'feature', 'function', 'goal', 'purpose',
        '요구사항', '명세', '사용자', '기능', '목적', '목표', 'story', 'epic', 'persona'
      ]
    },
    plan: {
      filenames: [
        'architecture.md', 'design.md', 'tech-stack.md', 'technical.md', 'system-design.md',
        'api.md', 'database.md', 'infrastructure.md', 'deployment.md', 'tech.md'
      ],
      keywords: [
        'architecture', 'design', 'technology', 'database', 'api', 'framework', 'library',
        '아키텍처', '설계', '기술', '데이터베이스', 'typescript', 'react', 'node',
        'microservice', 'monolith', 'patterns', 'infrastructure'
      ]
    },
    tasks: {
      filenames: [
        'todo.md', 'tasks.md', 'backlog.md', 'milestones.md', 'roadmap.md',
        'checklist.md', 'sprint.md', 'issues.md', 'tickets.md'
      ],
      keywords: [
        'todo', 'task', 'milestone', 'backlog', 'sprint', 'issue', 'ticket',
        '할일', '작업', '마일스톤', 'checkbox', '- [ ]', '- [x]', 'progress', 'deadline'
      ]
    },
    config: {
      filenames: [
        'package.json', 'requirements.txt', 'gemfile', 'composer.json', 'cargo.toml',
        'pom.xml', 'tsconfig.json', '.env', 'docker-compose.yml', 'dockerfile'
      ],
      keywords: ['dependencies', 'scripts', 'config', 'environment', 'build']
    }
  };

  /**
   * Scan project directory for relevant documents
   */
  async scanProject(projectPath: string, options?: {
    includeSubdirs?: boolean;
    maxDepth?: number;
    ignorePatterns?: string[];
  }): Promise<ScanResult> {
    const opts = {
      includeSubdirs: true,
      maxDepth: 3,
      ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
      ...options
    };

    const foundDocuments: FoundDocument[] = [];
    
    await this.scanDirectory(projectPath, foundDocuments, opts, 0);
    
    // Classify and score documents
    const classifiedDocs = foundDocuments.map(doc => this.classifyDocument(doc));
    
    // Generate migration suggestions
    const suggestions = this.generateMigrationSuggestions(classifiedDocs, projectPath);
    
    return {
      foundDocuments: classifiedDocs,
      suggestions,
      totalDocuments: classifiedDocs.length,
      specCandidates: classifiedDocs.filter(doc => doc.type === 'spec').sort((a, b) => b.confidence - a.confidence),
      planCandidates: classifiedDocs.filter(doc => doc.type === 'plan').sort((a, b) => b.confidence - a.confidence),
      taskCandidates: classifiedDocs.filter(doc => doc.type === 'tasks').sort((a, b) => b.confidence - a.confidence)
    };
  }

  private async scanDirectory(
    dirPath: string, 
    foundDocuments: FoundDocument[], 
    options: any, 
    currentDepth: number
  ): Promise<void> {
    if (currentDepth > options.maxDepth) return;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip ignored patterns
        if (options.ignorePatterns.some((pattern: string) => entry.name.includes(pattern))) {
          continue;
        }
        
        if (entry.isDirectory() && options.includeSubdirs) {
          await this.scanDirectory(fullPath, foundDocuments, options, currentDepth + 1);
        } else if (entry.isFile() && this.shouldScanFile(entry.name)) {
          const doc = await this.processFile(fullPath);
          if (doc) {
            foundDocuments.push(doc);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dirPath}:`, error);
    }
  }

  private shouldScanFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const name = filename.toLowerCase();
    
    // Check for relevant extensions
    const relevantExtensions = ['.md', '.txt', '.json', '.yml', '.yaml'];
    if (!relevantExtensions.includes(ext) && !this.isConfigFile(name)) {
      return false;
    }
    
    // Check for relevant filenames
    const allPatterns = [
      ...this.patterns.spec.filenames,
      ...this.patterns.plan.filenames,
      ...this.patterns.tasks.filenames,
      ...this.patterns.config.filenames
    ];
    
    return allPatterns.some(pattern => name.includes(pattern.toLowerCase()));
  }

  private isConfigFile(filename: string): boolean {
    return this.patterns.config.filenames.includes(filename);
  }

  private async processFile(filePath: string): Promise<FoundDocument | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Skip very large files (>1MB) or very small files (<10 chars)
      if (stats.size > 1024 * 1024 || content.length < 10) {
        return null;
      }
      
      const filename = path.basename(filePath);
      
      return {
        path: filePath,
        filename,
        type: 'unknown', // Will be classified later
        confidence: 0,
        content,
        size: stats.size,
        keywords: [],
        lastModified: stats.mtime
      };
    } catch (error) {
      console.warn(`Could not process file ${filePath}:`, error);
      return null;
    }
  }

  private classifyDocument(doc: FoundDocument): FoundDocument {
    const filename = doc.filename.toLowerCase();
    const content = doc.content.toLowerCase();
    
    let bestType: 'spec' | 'plan' | 'tasks' | 'config' | 'readme' | 'unknown' = 'unknown';
    let bestScore = 0;
    let foundKeywords: string[] = [];
    
    // Check each document type
    for (const [type, patterns] of Object.entries(this.patterns)) {
      let score = 0;
      const typeKeywords: string[] = [];
      
      // Filename matching (40% weight)
      const filenameMatch = patterns.filenames.some(pattern => filename.includes(pattern));
      if (filenameMatch) {
        score += 0.4;
      }
      
      // Keyword matching (60% weight)
      const matchedKeywords = patterns.keywords.filter(keyword => {
        const found = content.includes(keyword.toLowerCase());
        if (found) {
          typeKeywords.push(keyword);
        }
        return found;
      });
      
      if (matchedKeywords.length > 0) {
        // More keywords = higher confidence, but with diminishing returns
        const keywordScore = Math.min(matchedKeywords.length / 5, 1) * 0.6;
        score += keywordScore;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestType = type as any;
        foundKeywords = typeKeywords;
      }
    }
    
    // Handle README files specially
    if (filename.includes('readme')) {
      bestType = 'readme';
      if (bestScore < 0.3) {
        bestScore = 0.3; // READMEs are often good spec candidates
      }
    }
    
    // If it looks like a spec document but classified as readme, prefer spec
    if (bestType === 'readme' && bestScore > 0.5) {
      const specKeywords = this.patterns.spec.keywords.filter(k => content.includes(k.toLowerCase()));
      if (specKeywords.length > 2) {
        bestType = 'spec';
      }
    }
    
    return {
      ...doc,
      type: bestType,
      confidence: Math.min(bestScore, 1),
      keywords: foundKeywords
    };
  }

  private generateMigrationSuggestions(documents: FoundDocument[], projectPath: string): MigrationSuggestion[] {
    const suggestions: MigrationSuggestion[] = [];
    const specifyPath = path.join(projectPath, '.specify');
    
    // Find best candidates for each type
    const specCandidates = documents.filter(doc => 
      (doc.type === 'spec' || doc.type === 'readme') && doc.confidence > 0.3
    ).sort((a, b) => b.confidence - a.confidence);
    
    const planCandidates = documents.filter(doc => 
      doc.type === 'plan' && doc.confidence > 0.3
    ).sort((a, b) => b.confidence - a.confidence);
    
    const taskCandidates = documents.filter(doc => 
      doc.type === 'tasks' && doc.confidence > 0.3
    ).sort((a, b) => b.confidence - a.confidence);
    
    // Generate suggestions for spec documents
    if (specCandidates.length > 0) {
      const bestSpec = specCandidates[0];
      if (bestSpec) {
        suggestions.push({
          sourceDoc: bestSpec,
          targetType: 'spec',
          targetPath: path.join(specifyPath, 'spec', 'current.md'),
          confidence: bestSpec.confidence,
          reason: `High-confidence specification document with ${bestSpec.keywords.length} relevant keywords`,
          autoMigratable: bestSpec.confidence > 0.7
        });
      }
    }
    
    // Generate suggestions for plan documents
    if (planCandidates.length > 0) {
      const bestPlan = planCandidates[0];
      if (bestPlan) {
        suggestions.push({
          sourceDoc: bestPlan,
          targetType: 'plan',
          targetPath: path.join(specifyPath, 'plan', 'current.md'),
          confidence: bestPlan.confidence,
          reason: `Technical planning document with architecture/design content`,
          autoMigratable: bestPlan.confidence > 0.6
        });
      }
    }
    
    // Generate suggestions for task documents
    if (taskCandidates.length > 0) {
      const bestTasks = taskCandidates[0];
      if (bestTasks) {
        suggestions.push({
          sourceDoc: bestTasks,
          targetType: 'tasks',
          targetPath: path.join(specifyPath, 'tasks', 'imported.md'),
          confidence: bestTasks.confidence,
          reason: `Task management document with actionable items`,
          autoMigratable: bestTasks.confidence > 0.6
        });
      }
    }
    
    // Look for config files that might inform tech stack
    const configFiles = documents.filter(doc => doc.type === 'config');
    for (const config of configFiles) {
      if (config.filename === 'package.json') {
        suggestions.push({
          sourceDoc: config,
          targetType: 'plan',
          targetPath: path.join(specifyPath, 'plan', 'tech-stack.md'),
          confidence: 0.8,
          reason: 'package.json contains technology stack information',
          autoMigratable: true
        });
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Auto-migrate documents based on suggestions
   */
  async autoMigrate(suggestions: MigrationSuggestion[], force = false): Promise<{
    migrated: MigrationSuggestion[];
    skipped: MigrationSuggestion[];
    errors: { suggestion: MigrationSuggestion; error: string }[];
  }> {
    const migrated: MigrationSuggestion[] = [];
    const skipped: MigrationSuggestion[] = [];
    const errors: { suggestion: MigrationSuggestion; error: string }[] = [];
    
    for (const suggestion of suggestions) {
      try {
        // Only auto-migrate high-confidence suggestions unless forced
        if (!force && !suggestion.autoMigratable) {
          skipped.push(suggestion);
          continue;
        }
        
        // Ensure target directory exists
        await fs.ensureDir(path.dirname(suggestion.targetPath));
        
        // Process content based on type
        let processedContent = suggestion.sourceDoc.content;
        
        if (suggestion.sourceDoc.filename === 'package.json' && suggestion.targetType === 'plan') {
          processedContent = this.extractTechStackFromPackageJson(suggestion.sourceDoc.content);
        }
        
        // Add migration header
        const migrationHeader = `<!-- Migrated from ${suggestion.sourceDoc.path} on ${new Date().toISOString()} -->\n\n`;
        processedContent = migrationHeader + processedContent;
        
        // Write to target location
        await fs.writeFile(suggestion.targetPath, processedContent);
        
        migrated.push(suggestion);
      } catch (error: any) {
        errors.push({
          suggestion,
          error: error.message
        });
      }
    }
    
    return { migrated, skipped, errors };
  }

  private extractTechStackFromPackageJson(content: string): string {
    try {
      const pkg = JSON.parse(content);
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      
      let techStack = '# Technology Stack\n\n## Dependencies\n\n';
      
      const categories = {
        'Frontend Frameworks': ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'],
        'Backend Frameworks': ['express', 'koa', 'fastify', 'nest', 'apollo'],
        'Testing': ['jest', 'mocha', 'cypress', 'playwright', 'vitest'],
        'Build Tools': ['webpack', 'vite', 'rollup', 'parcel', 'turbo'],
        'Databases': ['mongodb', 'postgres', 'mysql', 'redis', 'sqlite']
      };
      
      for (const [category, tools] of Object.entries(categories)) {
        const found = Object.keys(dependencies).filter(dep => 
          tools.some(tool => dep.includes(tool))
        );
        
        if (found.length > 0) {
          techStack += `\n### ${category}\n`;
          found.forEach(dep => {
            techStack += `- ${dep}: ${dependencies[dep]}\n`;
          });
        }
      }
      
      if (pkg.scripts) {
        techStack += '\n## Available Scripts\n\n';
        Object.entries(pkg.scripts).forEach(([name, script]) => {
          techStack += `- **${name}**: \`${script}\`\n`;
        });
      }
      
      return techStack;
    } catch {
      return '# Technology Stack\n\nExtracted from package.json:\n\n```json\n' + content + '\n```';
    }
  }

  /**
   * Generate scan report as formatted text
   */
  formatScanReport(result: ScanResult): string {
    const { foundDocuments, suggestions, specCandidates, planCandidates, taskCandidates } = result;
    
    let report = `
📁 **Document Scan Report**

**Total Documents Found**: ${foundDocuments.length}
**Migration Suggestions**: ${suggestions.length}
**Auto-Migratable**: ${suggestions.filter(s => s.autoMigratable).length}

## 📋 **Document Candidates**

### Specification Candidates (${specCandidates.length})
${specCandidates.slice(0, 3).map(doc => `
- **${doc.filename}** (${Math.round(doc.confidence * 100)}% confidence)
  📁 \`${doc.path}\`
  🏷️ Keywords: ${doc.keywords.slice(0, 5).join(', ')}
  📊 ${doc.size} bytes, modified: ${doc.lastModified.toLocaleDateString()}`).join('')}

### Technical Plan Candidates (${planCandidates.length})
${planCandidates.slice(0, 3).map(doc => `
- **${doc.filename}** (${Math.round(doc.confidence * 100)}% confidence)
  📁 \`${doc.path}\`
  🏷️ Keywords: ${doc.keywords.slice(0, 5).join(', ')}
  📊 ${doc.size} bytes, modified: ${doc.lastModified.toLocaleDateString()}`).join('')}

### Task/TODO Candidates (${taskCandidates.length})
${taskCandidates.slice(0, 3).map(doc => `
- **${doc.filename}** (${Math.round(doc.confidence * 100)}% confidence)
  📁 \`${doc.path}\`
  🏷️ Keywords: ${doc.keywords.slice(0, 5).join(', ')}
  📊 ${doc.size} bytes, modified: ${doc.lastModified.toLocaleDateString()}`).join('')}

## 🚀 **Migration Suggestions**

${suggestions.map((suggestion, index) => `
### ${index + 1}. ${suggestion.sourceDoc.filename} → ${suggestion.targetType.toUpperCase()}
**Confidence**: ${Math.round(suggestion.confidence * 100)}%
**Target**: \`${suggestion.targetPath}\`
**Reason**: ${suggestion.reason}
${suggestion.autoMigratable ? '✅ **Auto-migratable**' : '⚠️ **Manual review recommended**'}
`).join('')}

## 💡 **Next Steps**

${suggestions.length > 0 ? `
1. Review the migration suggestions above
2. Use \`document_migrate\` tool to automatically migrate high-confidence documents
3. Manually review and adjust migrated content as needed
4. Run quality analysis on migrated documents
` : `
No suitable documents found for automatic migration.
Consider creating documents in standard locations:
- README.md or SPECIFICATION.md for requirements
- ARCHITECTURE.md or DESIGN.md for technical plans
- TODO.md or TASKS.md for task management
`}

---
💡 **Tip**: Documents with 70%+ confidence are usually safe to auto-migrate!
    `.trim();

    return report;
  }
}
