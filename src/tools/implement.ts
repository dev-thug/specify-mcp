/**
 * Implement tool for generating TDD implementation guides
 * Creates test definitions and pseudo-code following TDD principles
 */

import { ResourceManager } from '../resources/manager.js';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext } from '../types/index.js';
import { WorkflowGuard } from '../workflow/workflow-guard.js';
import * as path from 'path';

export interface ImplementToolParams {
  projectId: string;
  taskId: string;
}

export class ImplementTool {
  private workflowGuard = new WorkflowGuard();
  
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly verifier: CommonVerifier
  ) {}

  async execute(params: ImplementToolParams): Promise<string> {
    const { projectId, taskId } = params;

    // Get project path for workflow check
    const projectStructure = this.resourceManager.getProject(projectId);
    if (!projectStructure) {
      return `❌ **프로젝트를 찾을 수 없습니다**: ${projectId}`;
    }

    // Check if ready to proceed to implementation phase
    const projectPath = path.dirname(projectStructure.projectPath);
    const workflowStatus = await this.workflowGuard.checkPhaseReadiness(projectPath, 'implement');
    
    if (!workflowStatus.canProceed) {
      return this.generateWorkflowBlockMessage(workflowStatus);
    }

    // Load task details
    let taskContent = '';
    let taskImplementation = '';
    
    try {
      const task = await this.resourceManager.readResource(
        `specify://project/${projectId}/task/${taskId}/index`
      );
      taskContent = task.text || '';
    } catch {
      return `Error: Task ${taskId} not found. Please run sdd_tasks first or check task ID.`;
    }

    try {
      const impl = await this.resourceManager.readResource(
        `specify://project/${projectId}/task/${taskId}/implementation`
      );
      taskImplementation = impl.text || '';
    } catch {
      // Implementation details might not exist yet
    }

    // Extract task information
    const taskInfo = this.extractTaskInfo(taskContent);
    
    // Load technical context from plan
    let techStack: any = {};
    try {
      const plan = await this.resourceManager.readResource(
        `specify://project/${projectId}/plan/current`
      );
      techStack = this.extractTechStack(plan.text || '');
    } catch {
      techStack = {
        language: 'TypeScript',
        testing: 'Jest',
        framework: 'Express',
      };
    }

    // Generate TDD implementation based on task category
    const implementation = this.generateTDDImplementation(
      taskInfo,
      techStack,
      taskImplementation
    );

    // Verify implementation
    const verificationContext: IVerificationContext = {
      phase: 'implement',
      content: implementation.fullDocument,
    };

    const validationResults = await this.verifier.verify(verificationContext);
    const confidence = this.verifier.calculateConfidence(validationResults);

    // Save implementation documents
    await this.resourceManager.writeResource(
      `specify://project/${projectId}/implementation/test/${taskId}_test`,
      implementation.testCode
    );

    await this.resourceManager.writeResource(
      `specify://project/${projectId}/implementation/code/${taskId}_pseudo`,
      implementation.pseudoCode
    );

    await this.resourceManager.writeResource(
      `specify://project/${projectId}/task/${taskId}/tdd_guide`,
      implementation.tddGuide
    );

    // Generate response
    let response = `TDD Implementation generated for task ${taskId}!\n`;
    response += `Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;

    response += `📝 TDD Phase: ${implementation.currentPhase}\n\n`;

    response += '**Generated Files**:\n';
    response += `- Test Definition: implementation/test/${taskId}_test\n`;
    response += `- Pseudo-code: implementation/code/${taskId}_pseudo\n`;
    response += `- TDD Guide: task/${taskId}/tdd_guide\n\n`;

    response += '**TDD Workflow**:\n';
    response += implementation.workflow;
    response += '\n\n';

    const errors = validationResults.filter(r => r.type === 'error');
    if (errors.length > 0) {
      response += '⚠️ Issues to address:\n';
      errors.forEach(e => {
        response += `- ${e.message}\n`;
      });
      response += '\n';
    }

    response += '**Next Steps**:\n';
    response += '1. Run the tests - they should FAIL (Red phase)\n';
    response += '2. Implement minimal code to pass tests (Green phase)\n';
    response += '3. Refactor while keeping tests green (Refactor phase)\n';
    response += '4. Commit after each phase\n';

    return response;
  }

  private extractTaskInfo(taskContent: string): {
    id?: string;
    title?: string;
    category: string;
    targetFile?: string;
    description?: string;
  } {
    const info: any = {};
    
    // Extract task ID and title
    const titleMatch = taskContent.match(/# Task (T\d+): (.+)/);
    if (titleMatch) {
      info.id = titleMatch[1];
      info.title = titleMatch[2];
    }

    // Extract category
    const categoryMatch = taskContent.match(/\*\*Category\*\*:\s*(\w+)/);
    info.category = categoryMatch ? categoryMatch[1] : 'implementation';

    // Extract target file
    const fileMatch = taskContent.match(/\*\*Target File\*\*:\s*(.+)/);
    info.targetFile = fileMatch ? fileMatch[1] : 'src/unknown.ts';

    // Extract description
    const descMatch = taskContent.match(/## Description\n(.+)/);
    info.description = descMatch ? descMatch[1] : '';

    return info;
  }

  private extractTechStack(planContent: string): {
    language: string;
    testing: string;
    framework: string;
  } {
    const techStack: any = {};
    
    const langMatch = planContent.match(/\*\*Language\/Version\*\*:\s*([^\n]+)/);
    techStack.language = langMatch?.[1]?.split('[')[0]?.trim() || 'TypeScript';
    
    const testMatch = planContent.match(/\*\*Testing\*\*:\s*([^\n]+)/);
    techStack.testing = testMatch?.[1]?.split('[')[0]?.trim() || 'Jest';
    
    const frameworkMatch = planContent.match(/\*\*Primary Dependencies\*\*:\s*([^\n]+)/);
    techStack.framework = frameworkMatch?.[1]?.split('[')[0]?.trim() || 'Express';
    
    return techStack;
  }

  private generateTDDImplementation(
    taskInfo: any,
    techStack: any,
    _existingImplementation: string
  ): {
    currentPhase: string;
    workflow: string;
    testCode: string;
    pseudoCode: string;
    tddGuide: string;
    fullDocument: string;
  } {
    const implementation: any = {
      currentPhase: 'RED',
      workflow: '',
      testCode: '',
      pseudoCode: '',
      tddGuide: '',
      fullDocument: '',
    };

    // Generate based on task category
    switch (taskInfo.category) {
      case 'test':
        implementation.testCode = this.generateContractTest(taskInfo, techStack);
        implementation.pseudoCode = '// No implementation needed - this is a test-only task';
        implementation.workflow = '1. Write the test\n2. Ensure it can run\n3. Verify it fails with correct error';
        break;
      
      case 'implementation':
        implementation.testCode = this.generateUnitTest(taskInfo, techStack);
        implementation.pseudoCode = this.generatePseudoCode(taskInfo, techStack);
        implementation.workflow = '1. Run test (RED)\n2. Implement code (GREEN)\n3. Refactor (REFACTOR)';
        break;
      
      case 'integration':
        implementation.testCode = this.generateIntegrationTest(taskInfo, techStack);
        implementation.pseudoCode = this.generateIntegrationPseudo(taskInfo, techStack);
        implementation.workflow = '1. Test integration points\n2. Connect components\n3. Verify data flow';
        break;
      
      default:
        implementation.testCode = this.generateGenericTest(taskInfo, techStack);
        implementation.pseudoCode = this.generateGenericPseudo(taskInfo, techStack);
        implementation.workflow = '1. Define test\n2. Implement\n3. Refine';
    }

    // Generate TDD guide
    implementation.tddGuide = this.generateTDDGuide(taskInfo, techStack, implementation);
    
    // Combine for full document
    implementation.fullDocument = `${implementation.tddGuide}\n\n${implementation.testCode}\n\n${implementation.pseudoCode}`;

    return implementation;
  }

  private generateContractTest(taskInfo: any, techStack: any): string {
    const isTypeScript = techStack.language === 'TypeScript';
    const ext = isTypeScript ? 'ts' : 'js';
    
    return `// Contract Test for ${taskInfo.title}
// File: ${taskInfo.targetFile?.replace(/\.\w+$/, '')}_test.${ext}
// Framework: ${techStack.testing}

${isTypeScript ? "import { describe, it, expect, beforeEach } from '@jest/globals';" : "const { describe, it, expect, beforeEach } = require('@jest/globals');"}

describe('${taskInfo.title}', () => {
  beforeEach(() => {
    // Setup test environment
    // This should fail initially as implementation doesn't exist
  });

  describe('Request validation', () => {
    it('should validate required fields', async () => {
      // RED: This test MUST fail first
      const request = {
        // Define request structure
      };
      
      // Expect validation to pass (will fail without implementation)
      expect(() => validateRequest(request)).not.toThrow();
    });

    it('should reject invalid data types', async () => {
      const invalidRequest = {
        // Define invalid request
      };
      
      expect(() => validateRequest(invalidRequest)).toThrow('Validation error');
    });
  });

  describe('Response contract', () => {
    it('should return expected schema', async () => {
      // Define expected response structure
      const response = await makeRequest();
      
      expect(response).toMatchObject({
        success: expect.any(Boolean),
        data: expect.any(Object),
        // Add more schema validation
      });
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully', async () => {
      // Force an error condition
      const errorResponse = await makeFailingRequest();
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });
});

// Helper functions (implement these)
function validateRequest(request${isTypeScript ? ': any' : ''})${isTypeScript ? ': void' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function makeRequest()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function makeFailingRequest()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}`;
  }

  private generateUnitTest(taskInfo: any, techStack: any): string {
    const isTypeScript = techStack.language === 'TypeScript';
    const ext = isTypeScript ? 'ts' : 'js';
    
    return `// Unit Test for ${taskInfo.title}
// File: ${taskInfo.targetFile?.replace(/\.\w+$/, '')}_test.${ext}
// Framework: ${techStack.testing}

${isTypeScript ? "import { describe, it, expect, jest } from '@jest/globals';" : "const { describe, it, expect, jest } = require('@jest/globals');"}

describe('${taskInfo.title}', () => {
  describe('Core functionality', () => {
    it('should perform main operation', () => {
      // RED: Write failing test first
      const input = 'test input';
      const result = processData(input);
      
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      expect(() => processData(null)).toThrow('Invalid input');
      expect(processData('')).toBe('');
    });
  });

  describe('Data validation', () => {
    it('should validate input types', () => {
      const validData = { id: 1, name: 'Test' };
      expect(validateData(validData)).toBe(true);
    });

    it('should reject invalid data', () => {
      const invalidData = { id: 'not-a-number' };
      expect(validateData(invalidData)).toBe(false);
    });
  });

  describe('Business rules', () => {
    it('should apply business logic correctly', () => {
      // Define business rule test
      const scenario = createScenario();
      const result = applyBusinessRules(scenario);
      
      expect(result.status).toBe('approved');
    });
  });
});

// Functions to implement (RED phase)
function processData(input${isTypeScript ? ': any' : ''})${isTypeScript ? ': any' : ''} {
  throw new Error('Not implemented - RED phase');
}

function validateData(data${isTypeScript ? ': any' : ''})${isTypeScript ? ': boolean' : ''} {
  throw new Error('Not implemented - RED phase');
}

function createScenario()${isTypeScript ? ': any' : ''} {
  return {};
}

function applyBusinessRules(scenario${isTypeScript ? ': any' : ''})${isTypeScript ? ': any' : ''} {
  throw new Error('Not implemented - RED phase');
}`;
  }

  private generateIntegrationTest(taskInfo: any, techStack: any): string {
    const isTypeScript = techStack.language === 'TypeScript';
    const ext = isTypeScript ? 'ts' : 'js';
    
    return `// Integration Test for ${taskInfo.title}
// File: ${taskInfo.targetFile?.replace(/\.\w+$/, '')}_test.${ext}
// Framework: ${techStack.testing}

${isTypeScript ? "import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';" : "const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');"}

describe('${taskInfo.title} Integration', () => {
  let testContext${isTypeScript ? ': any' : ''};

  beforeAll(async () => {
    // Setup integration environment
    testContext = await setupTestEnvironment();
  });

  afterAll(async () => {
    // Cleanup
    await teardownTestEnvironment(testContext);
  });

  describe('Component integration', () => {
    it('should connect components correctly', async () => {
      // RED: Test component connections
      const componentA = await initComponentA();
      const componentB = await initComponentB();
      
      const result = await connectComponents(componentA, componentB);
      expect(result.connected).toBe(true);
    });

    it('should handle data flow between components', async () => {
      const data = { message: 'test' };
      const result = await sendDataThroughPipeline(data);
      
      expect(result.processed).toBe(true);
      expect(result.data).toMatchObject(data);
    });
  });

  describe('External service integration', () => {
    it('should connect to external services', async () => {
      const connection = await connectToService();
      expect(connection.status).toBe('connected');
    });

    it('should handle service failures gracefully', async () => {
      const result = await handleServiceFailure();
      expect(result.fallbackUsed).toBe(true);
    });
  });
});

// Integration helpers (implement in GREEN phase)
async function setupTestEnvironment()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function teardownTestEnvironment(context${isTypeScript ? ': any' : ''})${isTypeScript ? ': Promise<void>' : ''} {
  // Cleanup logic
}

async function initComponentA()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function initComponentB()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function connectComponents(a${isTypeScript ? ': any' : ''}, b${isTypeScript ? ': any' : ''})${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function sendDataThroughPipeline(data${isTypeScript ? ': any' : ''})${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function connectToService()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}

async function handleServiceFailure()${isTypeScript ? ': Promise<any>' : ''} {
  throw new Error('Not implemented - RED phase');
}`;
  }

  private generateGenericTest(taskInfo: any, _techStack: any): string {
    return `// Test for ${taskInfo.title}
// RED Phase: This test MUST fail first

describe('${taskInfo.title}', () => {
  it('should implement required functionality', () => {
    // Write your failing test here
    expect(true).toBe(false); // This will fail - replace with actual test
  });
});`;
  }

  private generatePseudoCode(taskInfo: any, techStack: any): string {
    const isTypeScript = techStack.language === 'TypeScript';
    
    return `// Pseudo-code for ${taskInfo.title}
// GREEN Phase: Implement minimal code to make tests pass

/*
ALGORITHM: ${taskInfo.title}

1. Input validation
   - Check for null/undefined
   - Validate data types
   - Ensure required fields present

2. Core logic
   - Process input data
   - Apply business rules
   - Transform as needed

3. Output generation
   - Format response
   - Include metadata
   - Handle errors

4. Return result
*/

${isTypeScript ? '// TypeScript Implementation' : '// JavaScript Implementation'}
export function implement${taskInfo.id}(input${isTypeScript ? ': any' : ''})${isTypeScript ? ': any' : ''} {
  // Step 1: Validation
  if (!input) {
    throw new Error('Input is required');
  }

  // Step 2: Processing
  const processed = {
    // Transform input
    data: input,
    timestamp: new Date(),
  };

  // Step 3: Business logic
  // TODO: Implement actual logic here

  // Step 4: Return
  return {
    success: true,
    result: processed,
  };
}

/*
REFACTOR Phase considerations:
- Extract validation to separate function
- Create types/interfaces (TypeScript)
- Add logging
- Optimize performance
- Add caching if needed
- Improve error messages
*/`;
  }

  private generateIntegrationPseudo(taskInfo: any, _techStack: any): string {
    return `// Integration Pseudo-code for ${taskInfo.title}

/*
INTEGRATION FLOW:

1. Initialize connections
   - Database connection
   - External services
   - Message queues

2. Setup middleware
   - Authentication
   - Logging
   - Error handling

3. Wire components
   - Dependency injection
   - Event listeners
   - Data pipelines

4. Configure monitoring
   - Health checks
   - Metrics collection
   - Alerting

5. Graceful shutdown
   - Close connections
   - Flush buffers
   - Save state
*/

class Integration {
  constructor() {
    this.connections = new Map();
    this.middleware = [];
  }

  async initialize() {
    // Step 1: Setup connections
    await this.connectDatabase();
    await this.connectServices();
    
    // Step 2: Configure middleware
    this.setupMiddleware();
    
    // Step 3: Wire components
    this.wireComponents();
    
    // Step 4: Start monitoring
    this.startMonitoring();
  }

  async shutdown() {
    // Graceful shutdown logic
    for (const [name, connection] of this.connections) {
      await connection.close();
    }
  }
}

/*
KEY CONSIDERATIONS:
- Connection pooling
- Retry logic
- Circuit breakers
- Timeout handling
- Rate limiting
*/`;
  }

  private generateGenericPseudo(taskInfo: any, _techStack: any): string {
    return `// Pseudo-code for ${taskInfo.title}

/*
STEPS:
1. Define the problem
2. Implement solution
3. Test thoroughly
4. Refactor for clarity
*/

function implement() {
  // Your implementation here
  // Make the tests pass with minimal code
  // Then refactor for quality
}`;
  }

  private generateTDDGuide(taskInfo: any, techStack: any, _implementation: any): string {
    const timestamp = new Date().toISOString();
    
    return `# TDD Implementation Guide for ${taskInfo.id}

**Task**: ${taskInfo.title}
**Generated**: ${timestamp}
**Testing Framework**: ${techStack.testing}
**Language**: ${techStack.language}

## TDD Cycle

### 🔴 RED Phase (Current)
**Goal**: Write a failing test that defines desired functionality

1. Write test first (see test file)
2. Run test and confirm it fails
3. Verify failure is for the right reason
4. Commit the failing test

**Command**: 
\`\`\`bash
npm test ${taskInfo.targetFile?.replace(/\.\w+$/, '')}_test
\`\`\`

**Expected**: Test should fail with "Not implemented" error

### 🟢 GREEN Phase
**Goal**: Write minimal code to make test pass

1. Implement just enough code to pass
2. Don't worry about quality yet
3. Run test and confirm it passes
4. Commit the passing implementation

**Guidelines**:
- No extra features
- Hardcode if necessary
- Focus only on making test green
- Don't refactor yet

### 🔄 REFACTOR Phase
**Goal**: Improve code quality while keeping tests green

1. Improve code structure
2. Remove duplication
3. Enhance readability
4. Add error handling
5. Run tests after each change
6. Commit improvements

**Refactoring checklist**:
- [ ] Extract methods for clarity
- [ ] Remove magic numbers/strings
- [ ] Improve variable names
- [ ] Add type annotations (TypeScript)
- [ ] Optimize performance
- [ ] Add logging
- [ ] Update documentation

## Implementation Checklist

### Before Starting
- [ ] Understand the requirement
- [ ] Review related documentation
- [ ] Set up test environment
- [ ] Ensure all dependencies installed

### During RED Phase
- [ ] Test is comprehensive
- [ ] Test covers edge cases
- [ ] Test failure is meaningful
- [ ] Test is readable

### During GREEN Phase
- [ ] Implementation is minimal
- [ ] All tests pass
- [ ] No premature optimization
- [ ] Code works correctly

### During REFACTOR Phase
- [ ] Code follows team standards
- [ ] No duplication (DRY)
- [ ] Clear naming
- [ ] Proper error handling
- [ ] Performance acceptable
- [ ] Documentation updated

## Common Pitfalls to Avoid

1. **Writing implementation before test**
   - Always write test first
   - Test defines the interface

2. **Making test pass accidentally**
   - Ensure test fails initially
   - Verify failure reason

3. **Over-engineering in GREEN phase**
   - Keep it simple
   - Just make it work

4. **Skipping REFACTOR phase**
   - Always improve after GREEN
   - Technical debt accumulates

5. **Testing implementation details**
   - Test behavior, not internals
   - Allow refactoring freedom

## Resources

- Test file: ${taskInfo.targetFile?.replace(/\.\w+$/, '')}_test
- Implementation file: ${taskInfo.targetFile}
- Related specs: See project specifications
- Tech stack docs: ${techStack.framework} documentation

## Notes

${taskInfo.description}

---
*Follow TDD strictly: RED → GREEN → REFACTOR*`;
  }

  private generateWorkflowBlockMessage(status: any): string {
    return `🚫 **구현 단계로 진행할 수 없습니다**

📊 **현재 상태**: 품질 점수 ${status.qualityScore}/100 (필요: 85점 이상)

❌ **차단 이유**:
${status.blockingReasons.map((reason: string) => `   • ${reason}`).join('\n')}

💡 **권장사항**:
${status.recommendations.map((rec: string) => `   • ${rec}`).join('\n')}

🎯 **SDD 원칙**: 모든 사전 단계가 완료된 후에만 구현을 시작하세요!

📝 **다음 단계**: \`specify_tasks\`로 작업 분해를 완성하세요.

⚠️ **중요**: 성급한 구현은 기술부채와 품질 저하를 야기합니다.`;
  }
}
