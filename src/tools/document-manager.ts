/**
 * Document Manager Tool for SDD
 * Provides CRUD operations for all SDD documents
 */

import { ResourceManager } from '../resources/manager.js';
import { IResource } from '../types/index.js';

export interface DocumentManagerParams {
  action: 'list' | 'read' | 'update' | 'delete';
  projectDirectory?: string;
  resourceType?: 'spec' | 'plan' | 'task' | 'implementation';
  resourcePath?: string;
  content?: string;
}

export interface DocumentListItem {
  uri: string;
  name: string;
  type: string;
  size: string;
  lastModified: string;
  status: 'active' | 'outdated' | 'draft';
}

export class DocumentManagerTool {
  constructor(
    private readonly resourceManager: ResourceManager
  ) {}

  async execute(params: DocumentManagerParams): Promise<string> {
    const { action, projectDirectory } = params;

    // Load project if directory specified
    if (projectDirectory) {
      const projectId = await this.resourceManager.loadProject(projectDirectory);
      if (!projectId) {
        return `❌ **프로젝트를 찾을 수 없습니다**\n\n${projectDirectory}에 .specify 폴더가 없습니다. 먼저 \`specify_init\`을 실행하세요.`;
      }
    }

    switch (action) {
      case 'list':
        return await this.listDocuments(params);
      case 'read':
        return await this.readDocument(params);
      case 'update':
        return await this.updateDocument(params);
      case 'delete':
        return await this.deleteDocument(params);
      default:
        return `❌ **잘못된 액션**: ${action}\n\n사용 가능한 액션: list, read, update, delete`;
    }
  }

  private async listDocuments(_params: DocumentManagerParams): Promise<string> {
    try {
      const resources = await this.resourceManager.listResources();
      
      if (resources.length === 0) {
        return `📋 **문서 없음**\n\n아직 생성된 문서가 없습니다. \`specify_requirements\`부터 시작하세요.`;
      }

      // Group resources by type
      const grouped = this.groupResourcesByType(resources);
      
      let result = `📚 **프로젝트 문서 목록**\n\n`;
      
      for (const [type, items] of Object.entries(grouped)) {
        result += `## ${this.getTypeDisplayName(type)}\n\n`;
        
        for (const item of items) {
          const status = await this.getDocumentStatus(item.uri);
          const statusIcon = this.getStatusIcon(status);
          result += `${statusIcon} **${item.name}**\n`;
          result += `   📍 URI: \`${item.uri}\`\n`;
          result += `   📊 상태: ${status}\n\n`;
        }
      }

      result += `\n💡 **사용법**:\n`;
      result += `- 읽기: \`specify_manage\` action=read resourcePath="spec/current"\n`;
      result += `- 수정: \`specify_manage\` action=update resourcePath="spec/current" content="새 내용"\n`;
      result += `- 삭제: \`specify_manage\` action=delete resourcePath="spec/current"\n`;

      return result;

    } catch (error) {
      return `❌ **문서 목록 조회 실패**: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async readDocument(params: DocumentManagerParams): Promise<string> {
    const { resourcePath } = params;
    
    if (!resourcePath) {
      return `❌ **resourcePath가 필요합니다**\n\n예시: resourcePath="spec/current"`;
    }

    try {
      // Construct URI - we need to get project ID first
      const resources = await this.resourceManager.listResources();
      const matchingResource = resources.find(r => r.uri.includes(resourcePath));
      
      if (!matchingResource) {
        return `❌ **문서를 찾을 수 없습니다**: ${resourcePath}\n\n\`specify_manage action=list\`로 사용 가능한 문서를 확인하세요.`;
      }

      const content = await this.resourceManager.readResource(matchingResource.uri);
      
      return `📖 **${matchingResource.name}**\n\n\`\`\`markdown\n${content.text}\n\`\`\``;

    } catch (error) {
      return `❌ **문서 읽기 실패**: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async updateDocument(params: DocumentManagerParams): Promise<string> {
    const { resourcePath, content } = params;
    
    if (!resourcePath || !content) {
      return `❌ **resourcePath와 content가 필요합니다**\n\n예시: resourcePath="spec/current" content="새로운 내용"`;
    }

    try {
      // Find existing resource
      const resources = await this.resourceManager.listResources();
      const matchingResource = resources.find(r => r.uri.includes(resourcePath));
      
      if (!matchingResource) {
        return `❌ **문서를 찾을 수 없습니다**: ${resourcePath}`;
      }

      // Update the document
      await this.resourceManager.writeResource(matchingResource.uri, content);
      
      return `✅ **문서 업데이트 완료**\n\n📄 **${matchingResource.name}**가 성공적으로 업데이트되었습니다.\n\n💡 관련 문서들도 검토가 필요할 수 있습니다. \`specify_status\`로 확인하세요.`;

    } catch (error) {
      return `❌ **문서 업데이트 실패**: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async deleteDocument(_params: DocumentManagerParams): Promise<string> {
    // TODO: Implement document deletion
    return `🚧 **삭제 기능 준비중**\n\n안전한 삭제 메커니즘을 구현 중입니다.`;
  }

  private groupResourcesByType(resources: IResource[]): Record<string, IResource[]> {
    const grouped: Record<string, IResource[]> = {};
    
    for (const resource of resources) {
      try {
        const type = this.extractTypeFromUri(resource.uri);
        if (type && type !== 'unknown') {
          if (!grouped[type]) {
            grouped[type] = [];
          }
          grouped[type].push(resource);
        }
      } catch (error) {
        console.warn(`Failed to process resource: ${resource.uri}`, error);
      }
    }
    
    return grouped;
  }

  private extractTypeFromUri(uri: string): string {
    if (!uri || typeof uri !== 'string') {
      return 'unknown';
    }
    
    const parts = uri.split('/');
    if (parts.length >= 3 && parts[0] === 'specify:' && parts[1] === '' && parts[2] === 'project') {
      return parts[4] || 'unknown'; // spec, plan, task, implementation 
    }
    
    return parts[2] || 'unknown';
  }

  private getTypeDisplayName(type: string): string {
    const names: Record<string, string> = {
      'spec': '📋 요구사항 명세서',
      'plan': '🏗️ 기술 계획서',
      'task': '📝 작업 분해',
      'implementation': '💻 구현 가이드',
      'metadata': '⚙️ 프로젝트 메타데이터'
    };
    return names[type] || `📄 ${type}`;
  }

  private async getDocumentStatus(_uri: string): Promise<string> {
    // TODO: Implement proper status checking
    return 'active';
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'active': '✅',
      'outdated': '⚠️',
      'draft': '📝'
    };
    return icons[status] || '❓';
  }
}
