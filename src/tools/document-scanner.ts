/**
 * Document Scanner Tool
 * Automatically scans and migrates existing project documents
 */

import { z } from 'zod';
import { DocumentScanner } from '../scanner/document-scanner.js';

const DocumentScannerSchema = z.object({
  action: z.enum(['scan', 'migrate', 'list']),
  project_path: z.string(),
  include_subdirs: z.boolean().optional().default(true),
  max_depth: z.number().optional().default(3),
  auto_migrate: z.boolean().optional().default(false),
  force_migrate: z.boolean().optional().default(false)
});

export async function documentScanner(params: z.infer<typeof DocumentScannerSchema>) {
  const { action, project_path, include_subdirs, max_depth, auto_migrate, force_migrate } = params;
  
  const scanner = new DocumentScanner();
  
  try {
    switch (action) {
      case 'scan':
        return await scanDocuments(scanner, project_path, include_subdirs, max_depth);
      
      case 'migrate':
        return await migrateDocuments(scanner, project_path, include_subdirs, max_depth, auto_migrate, force_migrate);
      
      case 'list':
        return await listFoundDocuments(scanner, project_path, include_subdirs, max_depth);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      message: `❌ **Document Scanner Error**: ${error.message}`
    };
  }
}

async function scanDocuments(
  scanner: DocumentScanner,
  projectPath: string,
  includeSubdirs?: boolean,
  maxDepth?: number
): Promise<any> {
  const scanResult = await scanner.scanProject(projectPath, {
    includeSubdirs: includeSubdirs ?? true,
    maxDepth: maxDepth ?? 3,
    ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
  });
  
  const report = scanner.formatScanReport(scanResult);
  
  return {
    success: true,
    total_documents: scanResult.totalDocuments,
    spec_candidates: scanResult.specCandidates.length,
    plan_candidates: scanResult.planCandidates.length,
    task_candidates: scanResult.taskCandidates.length,
    migration_suggestions: scanResult.suggestions.length,
    auto_migratable: scanResult.suggestions.filter(s => s.autoMigratable).length,
    message: report,
    suggestions: scanResult.suggestions,
    documents: scanResult.foundDocuments
  };
}

async function migrateDocuments(
  scanner: DocumentScanner,
  projectPath: string,
  includeSubdirs?: boolean,
  maxDepth?: number,
  autoMigrate?: boolean,
  forceMigrate?: boolean
): Promise<any> {
  // First scan for documents
  const scanResult = await scanner.scanProject(projectPath, {
    includeSubdirs: includeSubdirs ?? true,
    maxDepth: maxDepth ?? 3,
    ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
  });
  
  if (scanResult.suggestions.length === 0) {
    return {
      success: true,
      message: `📂 **No Migration Candidates Found**

Scanned ${scanResult.totalDocuments} documents but found no suitable candidates for migration.

**Common document names we look for**:
- **Specifications**: README.md, SPECIFICATION.md, REQUIREMENTS.md
- **Technical Plans**: ARCHITECTURE.md, DESIGN.md, TECH-STACK.md  
- **Tasks**: TODO.md, TASKS.md, BACKLOG.md

**Suggestion**: Create documents with these names in your project root for automatic recognition.`,
      scanned: scanResult.totalDocuments,
      migrated: 0,
      suggestions: []
    };
  }
  
  // If auto_migrate is true, proceed with migration
  if (autoMigrate) {
    const migrationResult = await scanner.autoMigrate(scanResult.suggestions, forceMigrate);
    
    let message = `🚀 **Document Migration Complete**\n\n`;
    
    message += `**Results**:\n`;
    message += `- ✅ **Migrated**: ${migrationResult.migrated.length} documents\n`;
    message += `- ⏸️ **Skipped**: ${migrationResult.skipped.length} documents (low confidence)\n`;
    message += `- ❌ **Errors**: ${migrationResult.errors.length} documents\n\n`;
    
    if (migrationResult.migrated.length > 0) {
      message += `**Successfully Migrated**:\n`;
      migrationResult.migrated.forEach(m => {
        message += `- \`${m.sourceDoc.filename}\` → \`${m.targetPath}\` (${Math.round(m.confidence * 100)}% confidence)\n`;
      });
      message += `\n`;
    }
    
    if (migrationResult.skipped.length > 0) {
      message += `**Skipped (use force_migrate=true to override)**:\n`;
      migrationResult.skipped.forEach(s => {
        message += `- \`${s.sourceDoc.filename}\` (${Math.round(s.confidence * 100)}% confidence - too low for auto-migration)\n`;
      });
      message += `\n`;
    }
    
    if (migrationResult.errors.length > 0) {
      message += `**Errors**:\n`;
      migrationResult.errors.forEach(e => {
        message += `- \`${e.suggestion.sourceDoc.filename}\`: ${e.error}\n`;
      });
      message += `\n`;
    }
    
    message += `💡 **Next Steps**:\n`;
    message += `1. Review migrated documents in \`.specify/\` directories\n`;
    message += `2. Use \`quality_analyzer\` to check document quality\n`;
    message += `3. Edit and improve documents as needed\n`;
    
    return {
      success: true,
      message,
      migrated: migrationResult.migrated.length,
      skipped: migrationResult.skipped.length,
      errors: migrationResult.errors.length,
      migrated_files: migrationResult.migrated.map(m => ({
        source: m.sourceDoc.path,
        target: m.targetPath,
        type: m.targetType,
        confidence: m.confidence
      }))
    };
  } else {
    // Just show what would be migrated
    const autoMigratableCount = scanResult.suggestions.filter(s => s.autoMigratable).length;
    
    let message = `📋 **Migration Preview**\n\n`;
    message += `**Found ${scanResult.suggestions.length} migration candidates**:\n\n`;
    
    scanResult.suggestions.forEach((suggestion, index) => {
      const status = suggestion.autoMigratable ? '✅ **Auto-migratable**' : '⚠️ **Manual review needed**';
      message += `### ${index + 1}. ${suggestion.sourceDoc.filename}\n`;
      message += `- **Type**: ${suggestion.targetType.toUpperCase()}\n`;
      message += `- **Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      message += `- **Target**: \`${suggestion.targetPath}\`\n`;
      message += `- **Status**: ${status}\n`;
      message += `- **Reason**: ${suggestion.reason}\n\n`;
    });
    
    message += `**To migrate documents**:\n`;
    if (autoMigratableCount > 0) {
      message += `- Use \`auto_migrate: true\` to migrate ${autoMigratableCount} high-confidence documents\n`;
    }
    if (scanResult.suggestions.length > autoMigratableCount) {
      message += `- Use \`force_migrate: true\` to migrate all ${scanResult.suggestions.length} documents (including low-confidence)\n`;
    }
    
    return {
      success: true,
      message,
      preview: true,
      total_suggestions: scanResult.suggestions.length,
      auto_migratable: autoMigratableCount,
      suggestions: scanResult.suggestions
    };
  }
}

async function listFoundDocuments(
  scanner: DocumentScanner,
  projectPath: string,
  includeSubdirs?: boolean,
  maxDepth?: number
): Promise<any> {
  const scanResult = await scanner.scanProject(projectPath, {
    includeSubdirs: includeSubdirs ?? true,
    maxDepth: maxDepth ?? 3,
    ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
  });
  
  let message = `📁 **Found Documents**\\n\\n`;
  message += `**Total**: ${scanResult.totalDocuments} documents\\n\\n`;
  
  if (scanResult.foundDocuments.length === 0) {
    message += `No relevant documents found in \`${projectPath}\`\\n\\n`;
    message += `**Search criteria**:\\n`;
    message += `- File extensions: .md, .txt, .json, .yml\\n`;
    message += `- Relevant names: README, SPEC, TODO, ARCHITECTURE, etc.\\n`;
    message += `- Max depth: ${maxDepth} levels\\n`;
    message += `- Relevant names: README, SPEC, TODO, ARCHITECTURE, etc.\n`;
    message += `- Max depth: ${maxDepth} levels\n`;
  } else {
    // Group by type
    const byType = scanResult.foundDocuments.reduce((acc, doc) => {
      if (!acc[doc.type]) acc[doc.type] = [];
      acc[doc.type]!.push(doc);
      return acc;
    }, {} as Record<string, typeof scanResult.foundDocuments>);
    
    for (const [type, docs] of Object.entries(byType)) {
      message += `### ${type.toUpperCase()} Documents (${docs.length})\n`;
      docs.forEach(doc => {
        message += `- **${doc.filename}** (${Math.round(doc.confidence * 100)}% confidence)\n`;
        message += `  📁 \`${doc.path}\`\n`;
        message += `  📊 ${doc.size} bytes, ${doc.keywords.length} keywords\n`;
      });
      message += `\n`;
    }
  }
  
  return {
    success: true,
    message,
    total_documents: scanResult.totalDocuments,
    documents: scanResult.foundDocuments,
    by_type: scanResult.foundDocuments.reduce((acc, doc) => {
      if (!acc[doc.type]) acc[doc.type] = 0;
      acc[doc.type]!++;
      return acc;
    }, {} as Record<string, number>)
  };
}
