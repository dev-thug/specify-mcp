import { z } from 'zod';
import type { SDDTool, ToolResult } from '../types/index.js';
import { ResourceManager } from '../resources/manager.js';

const implementInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  taskId: z.string().describe('Task ID to implement'),
  testingFramework: z.string().optional().describe('Testing framework to use'),
  tddApproach: z.enum(['red-green-refactor', 'outside-in', 'inside-out']).optional()
});

interface TestCase {
  name: string;
  description: string;
  input: string;
  expectedOutput: string;
  testType: 'unit' | 'integration' | 'e2e';
}

export class ImplementTool implements SDDTool {
  name = 'generate_tests';
  description = 'Generate TDD tests and implementation guides for development';
  inputSchema = implementInputSchema;

  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  async handler(params: unknown): Promise<ToolResult> {
    const input = implementInputSchema.parse(params);
    
    // Read project and task information
    const projectData = await this.resourceManager.readResource(input.projectId, 'metadata.json');
    const project = JSON.parse(projectData.content);
    
    // Read technical plan for tech stack info
    let techStack: any = {};
    try {
      const planData = await this.resourceManager.readResource(
        input.projectId,
        'plan/technical-plan.md'
      );
      techStack = this.extractTechStack(planData.content);
    } catch {}

    // Read task details
    let taskDetails = '';
    try {
      const taskData = await this.resourceManager.readResource(
        input.projectId,
        `tasks/${input.taskId}/index.md`
      );
      taskDetails = taskData.content;
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: `Task ${input.taskId} not found. Please run tasks stage first.`
          }
        ]
      };
    }

    // Determine testing framework
    const testingFramework = input.testingFramework || 
                            techStack.testing?.[0] || 
                            'jest';

    const tddApproach = input.tddApproach || 'red-green-refactor';

    // Generate TDD artifacts
    const tddPlan = this.generateTDDPlan(input.taskId, taskDetails, tddApproach);
    const testCases = this.generateTestCases(taskDetails);
    const testCode = this.generateTestCode(testCases, testingFramework, techStack);
    const pseudoCode = this.generatePseudoCode(taskDetails, testCases);
    const methodology = this.generateTDDMethodology(tddApproach, testingFramework);

    // Save TDD artifacts
    const taskPath = `implement/${input.taskId}`;
    
    await this.resourceManager.createResource(
      input.projectId,
      `${taskPath}/tdd-plan.md`,
      tddPlan,
      { stage: 'implement', taskId: input.taskId }
    );

    await this.resourceManager.createResource(
      input.projectId,
      `${taskPath}/test.${this.getTestFileExtension(testingFramework)}`,
      testCode,
      { stage: 'implement', taskId: input.taskId, type: 'test' }
    );

    await this.resourceManager.createResource(
      input.projectId,
      `${taskPath}/pseudocode.md`,
      pseudoCode,
      { stage: 'implement', taskId: input.taskId, type: 'pseudocode' }
    );

    await this.resourceManager.createResource(
      input.projectId,
      `${taskPath}/methodology.md`,
      methodology,
      { stage: 'implement', taskId: input.taskId, type: 'methodology' }
    );

    // Generate implementation checklist
    const checklist = this.generateImplementationChecklist(input.taskId, tddApproach);
    await this.resourceManager.createResource(
      input.projectId,
      `${taskPath}/checklist.md`,
      checklist,
      { stage: 'implement', taskId: input.taskId }
    );

    // Update project workflow
    if (!project.workflow.completedStages.includes('implement')) {
      project.workflow.completedStages.push('implement');
    }
    project.workflow.currentStage = 'implement';
    
    await this.resourceManager.updateResource(
      input.projectId,
      'metadata.json',
      JSON.stringify(project, null, 2)
    );

    return {
      content: [
        {
          type: 'text',
          text: `TDD implementation prepared for task ${input.taskId}`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/${taskPath}/tdd-plan.md`
        },
        {
          type: 'resource',
          uri: `specify://${input.projectId}/${taskPath}/test.${this.getTestFileExtension(testingFramework)}`
        },
        {
          type: 'text',
          text: `Testing framework: ${testingFramework}, Approach: ${tddApproach}`
        }
      ]
    };
  }

  private extractTechStack(planContent: string): any {
    // Simple extraction - in real implementation, would parse more carefully
    const techStack: any = {};
    
    if (planContent.includes('Jest')) {
      techStack.testing = ['jest'];
    }
    if (planContent.includes('TypeScript')) {
      techStack.language = 'typescript';
    }
    if (planContent.includes('React')) {
      techStack.frontend = ['react'];
    }
    if (planContent.includes('Node.js')) {
      techStack.backend = ['nodejs'];
    }

    return techStack;
  }

  private generateTDDPlan(taskId: string, _taskDetails: string, approach: string): string {
    return `# TDD Implementation Plan for ${taskId}

## Overview
This document outlines the Test-Driven Development approach for implementing task ${taskId}.

## TDD Approach
**${approach.replace(/-/g, ' ').toUpperCase()}**

${this.getApproachDescription(approach)}

## Implementation Phases

### Phase 1: Red - Write Failing Tests
1. Identify test scenarios from requirements
2. Write test cases that capture expected behavior
3. Run tests to confirm they fail (no implementation yet)
4. Review test coverage for completeness

### Phase 2: Green - Make Tests Pass
1. Write minimal code to pass the first test
2. Run tests to verify the fix
3. Implement code for each subsequent test
4. Focus on functionality, not optimization

### Phase 3: Refactor - Improve Code Quality
1. Identify code smells and duplication
2. Extract methods and create abstractions
3. Improve naming and structure
4. Ensure all tests still pass

## Test Categories

### Unit Tests
- Test individual functions/methods in isolation
- Mock external dependencies
- Verify business logic correctness
- Ensure edge cases are handled

### Integration Tests
- Test component interactions
- Verify data flow between modules
- Test database operations
- Validate API endpoints

### End-to-End Tests
- Test complete user workflows
- Verify system behavior from user perspective
- Validate critical paths
- Ensure requirements are met

## Success Criteria
- All tests pass consistently
- Code coverage > 80%
- No untested code paths
- Clean, maintainable implementation
- Performance requirements met

## Risk Mitigation
- Write tests before code
- Keep tests simple and focused
- Avoid testing implementation details
- Maintain test independence
- Regular refactoring cycles

## Documentation Requirements
- Inline code comments for complex logic
- Test descriptions explain "what" and "why"
- README with setup instructions
- API documentation if applicable
`;
  }

  private getApproachDescription(approach: string): string {
    const descriptions: Record<string, string> = {
      'red-green-refactor': `The classic TDD cycle:
- **Red**: Write a failing test that defines desired functionality
- **Green**: Write minimal code to make the test pass
- **Refactor**: Improve code structure while keeping tests green`,
      
      'outside-in': `Start from the user interface and work towards the core:
- Begin with acceptance tests
- Move to integration tests
- Finally implement unit tests
- Best for user-facing features`,
      
      'inside-out': `Start from the core logic and build outwards:
- Begin with unit tests for core logic
- Add integration tests for module interactions
- Finally add end-to-end tests
- Best for algorithmic or data-heavy features`
    };

    return descriptions[approach] || descriptions['red-green-refactor'];
  }

  private generateTestCases(_taskDetails: string): TestCase[] {
    // Generate test cases based on task details
    // This is simplified - real implementation would parse task details more thoroughly
    
    const testCases: TestCase[] = [
      {
        name: 'should handle valid input correctly',
        description: 'Test the happy path with valid input',
        input: '{ valid: true }',
        expectedOutput: '{ success: true }',
        testType: 'unit'
      },
      {
        name: 'should handle invalid input gracefully',
        description: 'Test error handling for invalid input',
        input: '{ valid: false }',
        expectedOutput: '{ error: "Invalid input" }',
        testType: 'unit'
      },
      {
        name: 'should handle edge cases',
        description: 'Test boundary conditions and edge cases',
        input: 'null',
        expectedOutput: '{ error: "Input required" }',
        testType: 'unit'
      },
      {
        name: 'should integrate with external services',
        description: 'Test integration points',
        input: '{ action: "fetch" }',
        expectedOutput: '{ data: [...] }',
        testType: 'integration'
      }
    ];

    return testCases;
  }

  private generateTestCode(
    testCases: TestCase[], 
    framework: string, 
    techStack: any
  ): string {
    const isTypeScript = techStack.language === 'typescript';
    // const fileExt = isTypeScript ? 'ts' : 'js';

    if (framework.toLowerCase().includes('jest')) {
      return this.generateJestTests(testCases, isTypeScript);
    } else if (framework.toLowerCase().includes('mocha')) {
      return this.generateMochaTests(testCases, isTypeScript);
    } else if (framework.toLowerCase().includes('vitest')) {
      return this.generateVitestTests(testCases, isTypeScript);
    }

    // Default to Jest format
    return this.generateJestTests(testCases, isTypeScript);
  }

  private generateJestTests(testCases: TestCase[], isTypeScript: boolean): string {
    const imports = isTypeScript
      ? `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import the module to test (update path as needed)
// import { functionToTest } from './implementation';`
      : `const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
// Import the module to test (update path as needed)
// const { functionToTest } = require('./implementation');`;

    return `${imports}

describe('Task Implementation Tests', () => {
  // Setup and teardown
  beforeEach(() => {
    // Test setup
  });

  afterEach(() => {
    // Test cleanup
  });

  // Unit Tests
  describe('Unit Tests', () => {
${testCases.filter(tc => tc.testType === 'unit').map(tc => `
    it('${tc.name}', () => {
      // Arrange
      const input = ${tc.input};
      const expected = ${tc.expectedOutput};
      
      // Act
      // const result = functionToTest(input);
      
      // Assert
      // expect(result).toEqual(expected);
      
      // TODO: Implement this test
      expect(true).toBe(false); // This should fail initially (RED phase)
    });`).join('\n')}
  });

  // Integration Tests
  describe('Integration Tests', () => {
${testCases.filter(tc => tc.testType === 'integration').map(tc => `
    it('${tc.name}', async () => {
      // Arrange
      const input = ${tc.input};
      const expected = ${tc.expectedOutput};
      
      // Act
      // const result = await integratedFunction(input);
      
      // Assert
      // expect(result).toEqual(expected);
      
      // TODO: Implement this test
      expect(true).toBe(false); // This should fail initially (RED phase)
    });`).join('\n')}
  });

  // Edge Cases
  describe('Edge Cases', () => {
    it('should handle null input', () => {
      // TODO: Test null input handling
      expect(true).toBe(false);
    });

    it('should handle empty input', () => {
      // TODO: Test empty input handling
      expect(true).toBe(false);
    });

    it('should handle maximum values', () => {
      // TODO: Test maximum boundary conditions
      expect(true).toBe(false);
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    it('should throw error for invalid input type', () => {
      // TODO: Test error throwing
      expect(() => {
        // functionToTest('invalid');
      }).toThrow();
    });

    it('should handle async errors gracefully', async () => {
      // TODO: Test async error handling
      await expect(async () => {
        // await asyncFunction();
      }).rejects.toThrow();
    });
  });
});

// Performance Tests (optional)
describe('Performance Tests', () => {
  it('should complete within performance threshold', () => {
    const startTime = performance.now();
    
    // TODO: Run performance-critical operation
    // functionToTest(largeDataSet);
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});
`;
  }

  private generateMochaTests(_testCases: TestCase[], _isTypeScript: boolean): string {
    // Similar to Jest but with Mocha syntax
    return `// Mocha test implementation
const { expect } = require('chai');

describe('Task Implementation Tests', function() {
  // Test cases here
});`;
  }

  private generateVitestTests(_testCases: TestCase[], _isTypeScript: boolean): string {
    // Similar to Jest but with Vitest imports
    return `import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Task Implementation Tests', () => {
  // Test cases here
});`;
  }

  private generatePseudoCode(_taskDetails: string, _testCases: TestCase[]): string {
    return `# Pseudocode Implementation Guide

## Overview
This pseudocode outlines the implementation approach for passing all test cases.

## Main Function Structure

\`\`\`pseudocode
FUNCTION implementFeature(input)
  // Step 1: Input Validation
  IF input is NULL or UNDEFINED
    THROW Error("Input required")
  END IF
  
  IF input is not valid type
    THROW Error("Invalid input type")
  END IF
  
  // Step 2: Process Input
  result = INITIALIZE empty result object
  
  TRY
    // Parse and validate input structure
    parsedInput = parseInput(input)
    
    // Apply business logic
    IF parsedInput.valid == TRUE
      result = processValidInput(parsedInput)
    ELSE
      result = handleInvalidInput(parsedInput)
    END IF
    
    // Step 3: Format Output
    formattedResult = formatOutput(result)
    
    RETURN formattedResult
    
  CATCH error
    // Error handling
    logError(error)
    RETURN createErrorResponse(error)
  END TRY
END FUNCTION
\`\`\`

## Helper Functions

### Input Parsing
\`\`\`pseudocode
FUNCTION parseInput(rawInput)
  parsed = CREATE new object
  
  // Extract required fields
  parsed.valid = rawInput.valid OR FALSE
  parsed.data = rawInput.data OR NULL
  
  // Validate required fields exist
  IF required fields are missing
    THROW ValidationError
  END IF
  
  RETURN parsed
END FUNCTION
\`\`\`

### Business Logic Processing
\`\`\`pseudocode
FUNCTION processValidInput(input)
  result = CREATE new result object
  
  // Core business logic
  FOR EACH item IN input.data
    processedItem = processItem(item)
    result.add(processedItem)
  END FOR
  
  result.success = TRUE
  RETURN result
END FUNCTION
\`\`\`

### Error Handling
\`\`\`pseudocode
FUNCTION handleInvalidInput(input)
  errorResponse = CREATE error object
  errorResponse.error = "Invalid input"
  errorResponse.details = getValidationErrors(input)
  
  RETURN errorResponse
END FUNCTION
\`\`\`

## Data Structures

### Input Object
\`\`\`
INPUT {
  valid: BOOLEAN
  data: ARRAY or OBJECT
  options: OBJECT (optional)
}
\`\`\`

### Output Object
\`\`\`
OUTPUT {
  success: BOOLEAN
  data: ARRAY or OBJECT (optional)
  error: STRING (optional)
  metadata: OBJECT (optional)
}
\`\`\`

## Algorithm Steps

1. **Initialization**
   - Set up required variables
   - Initialize data structures
   - Configure dependencies

2. **Validation**
   - Check input existence
   - Validate input format
   - Verify business rules

3. **Processing**
   - Transform input data
   - Apply business logic
   - Handle special cases

4. **Output Generation**
   - Format results
   - Add metadata
   - Ensure consistency

5. **Cleanup**
   - Release resources
   - Log completion
   - Return final result

## Edge Cases to Handle

1. **Null/Undefined Input**
   - Return error with clear message
   - Don't attempt processing

2. **Empty Collections**
   - Return empty result set
   - Don't treat as error

3. **Maximum Values**
   - Handle integer overflow
   - Implement pagination if needed

4. **Concurrent Access**
   - Implement locking if needed
   - Handle race conditions

## Performance Considerations

- Use efficient data structures (HashMap for lookups)
- Implement caching for repeated operations
- Consider async processing for I/O operations
- Batch database operations when possible

## Security Considerations

- Sanitize all input data
- Implement rate limiting
- Use parameterized queries
- Never expose internal errors to clients
`;
  }

  private generateTDDMethodology(approach: string, framework: string): string {
    return `# TDD Methodology Guide

## Framework: ${framework}
## Approach: ${approach.replace(/-/g, ' ').toUpperCase()}

## Development Workflow

### 1. Setup Development Environment
\`\`\`bash
# Install testing framework
npm install --save-dev ${framework}

# Install additional testing utilities
npm install --save-dev @types/${framework}  # For TypeScript
npm install --save-dev ${framework}-mock     # For mocking

# Configure test scripts in package.json
"scripts": {
  "test": "${framework}",
  "test:watch": "${framework} --watch",
  "test:coverage": "${framework} --coverage"
}
\`\`\`

### 2. TDD Cycle Implementation

#### Step 1: RED Phase (Write Failing Test)
1. Identify a small piece of functionality
2. Write a test that captures the requirement
3. Run the test to see it fail
4. Verify the failure is for the right reason

\`\`\`javascript
// Example: Testing a calculator add function
it('should add two numbers correctly', () => {
  const result = add(2, 3);
  expect(result).toBe(5);
});
// This test will fail because 'add' doesn't exist yet
\`\`\`

#### Step 2: GREEN Phase (Make Test Pass)
1. Write the minimum code to pass the test
2. Don't worry about perfect code yet
3. Focus only on making the test green

\`\`\`javascript
// Minimal implementation
function add(a, b) {
  return a + b;
}
// Test now passes!
\`\`\`

#### Step 3: REFACTOR Phase (Improve Code)
1. Clean up the implementation
2. Remove duplication
3. Improve naming and structure
4. Ensure tests still pass

\`\`\`javascript
// Refactored implementation
function add(a, b) {
  validateNumbers(a, b);
  return a + b;
}

function validateNumbers(...args) {
  args.forEach(arg => {
    if (typeof arg !== 'number') {
      throw new TypeError('Arguments must be numbers');
    }
  });
}
\`\`\`

### 3. Test Organization Best Practices

#### Arrange-Act-Assert (AAA) Pattern
\`\`\`javascript
it('should process user data correctly', () => {
  // Arrange - Set up test data
  const userData = { name: 'John', age: 30 };
  const processor = new UserProcessor();
  
  // Act - Execute the functionality
  const result = processor.process(userData);
  
  // Assert - Verify the outcome
  expect(result.isValid).toBe(true);
  expect(result.processedName).toBe('JOHN');
});
\`\`\`

#### Given-When-Then (BDD Style)
\`\`\`javascript
describe('User Authentication', () => {
  it('should authenticate valid user', () => {
    // Given - Initial context
    const validCredentials = { username: 'user', password: 'pass' };
    
    // When - Action occurs
    const authResult = authenticate(validCredentials);
    
    // Then - Expected outcome
    expect(authResult.success).toBe(true);
    expect(authResult.token).toBeDefined();
  });
});
\`\`\`

### 4. Testing Strategies

#### Unit Testing Strategy
- Test one thing at a time
- Mock external dependencies
- Keep tests fast and isolated
- Use descriptive test names

#### Integration Testing Strategy
- Test component interactions
- Use real dependencies when possible
- Test data flow between modules
- Verify system boundaries

#### E2E Testing Strategy
- Test complete user journeys
- Use realistic data
- Test in production-like environment
- Focus on critical paths

### 5. Common Testing Patterns

#### Mocking and Stubbing
\`\`\`javascript
// Mock external service
const mockApiClient = {
  fetchData: jest.fn().mockResolvedValue({ data: 'test' })
};

// Use mock in test
it('should handle API response', async () => {
  const service = new DataService(mockApiClient);
  const result = await service.getData();
  
  expect(mockApiClient.fetchData).toHaveBeenCalled();
  expect(result).toEqual({ data: 'test' });
});
\`\`\`

#### Test Fixtures
\`\`\`javascript
// Reusable test data
const fixtures = {
  validUser: { id: 1, name: 'Test User', email: 'test@example.com' },
  invalidUser: { id: null, name: '', email: 'invalid' }
};

// Use fixtures in tests
it('should validate user', () => {
  expect(validateUser(fixtures.validUser)).toBe(true);
  expect(validateUser(fixtures.invalidUser)).toBe(false);
});
\`\`\`

### 6. Coverage Goals

#### Coverage Metrics
- **Line Coverage**: Aim for 80%+
- **Branch Coverage**: Cover all conditional paths
- **Function Coverage**: Test all functions
- **Statement Coverage**: Execute all statements

#### What to Test
✅ Business logic
✅ Edge cases
✅ Error handling
✅ Public APIs
✅ Complex algorithms

#### What NOT to Test
❌ Third-party libraries
❌ Framework code
❌ Simple getters/setters
❌ Configuration files
❌ Generated code

### 7. Continuous Integration

#### CI Pipeline Configuration
\`\`\`yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
\`\`\`

### 8. Debugging Failed Tests

#### Debugging Techniques
1. Use \`console.log\` to inspect values
2. Use debugger breakpoints
3. Run single test in isolation
4. Check test environment setup
5. Verify mock configurations

#### Common Issues
- Async timing issues
- Incorrect mock setup
- Test pollution (shared state)
- Environment differences
- Flaky tests

### 9. Documentation

#### Test Documentation
- Write clear test descriptions
- Include context in test names
- Add comments for complex setups
- Document test utilities

#### Living Documentation
- Tests serve as usage examples
- Keep tests readable
- Update tests with code changes
- Use tests to onboard new developers

### 10. Tools and Resources

#### Essential Tools
- Testing Framework: ${framework}
- Assertion Library: Built-in or Chai
- Mocking: Built-in or Sinon
- Coverage: NYC or built-in
- Watch Mode: Built-in

#### Useful Extensions
- Test runners for IDE
- Coverage visualization
- Test generators
- Mutation testing tools

## Quick Reference Commands

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.spec.js

# Run tests matching pattern
npm test -- --grep "should add"

# Debug tests
node --inspect-brk node_modules/.bin/${framework}
\`\`\`

## Next Steps
1. Set up your testing environment
2. Write your first failing test
3. Implement code to pass the test
4. Refactor and repeat
5. Maintain high test coverage
6. Integrate with CI/CD pipeline
`;
  }

  private generateImplementationChecklist(taskId: string, _approach: string): string {
    return `# Implementation Checklist for ${taskId}

## Pre-Implementation
- [ ] Review task requirements and acceptance criteria
- [ ] Understand dependencies and integration points
- [ ] Set up development environment
- [ ] Configure testing framework
- [ ] Review existing code and patterns

## TDD Cycle 1: Core Functionality
### RED Phase
- [ ] Write test for primary happy path
- [ ] Verify test fails with expected error
- [ ] Review test for clarity and completeness

### GREEN Phase
- [ ] Implement minimal code to pass test
- [ ] Run test to verify it passes
- [ ] Commit working code

### REFACTOR Phase
- [ ] Identify code improvements
- [ ] Apply refactoring
- [ ] Verify tests still pass
- [ ] Commit refactored code

## TDD Cycle 2: Error Handling
### RED Phase
- [ ] Write tests for error conditions
- [ ] Test invalid inputs
- [ ] Test boundary conditions

### GREEN Phase
- [ ] Implement error handling
- [ ] Add input validation
- [ ] Handle edge cases

### REFACTOR Phase
- [ ] Consolidate error handling
- [ ] Improve error messages
- [ ] Extract validation logic

## TDD Cycle 3: Integration
### RED Phase
- [ ] Write integration tests
- [ ] Test component interactions
- [ ] Test external dependencies

### GREEN Phase
- [ ] Implement integration logic
- [ ] Handle async operations
- [ ] Manage state correctly

### REFACTOR Phase
- [ ] Optimize performance
- [ ] Improve modularity
- [ ] Update documentation

## Code Quality Checks
- [ ] All tests passing
- [ ] Code coverage > 80%
- [ ] No linting errors
- [ ] Type checking passes (if TypeScript)
- [ ] Code follows style guide
- [ ] No code smells

## Documentation
- [ ] Inline code comments added
- [ ] README updated
- [ ] API documentation complete
- [ ] Test descriptions clear
- [ ] Change log updated

## Review Preparation
- [ ] Self-review completed
- [ ] Tests are comprehensive
- [ ] Code is clean and readable
- [ ] Performance acceptable
- [ ] Security considerations addressed

## Final Steps
- [ ] Create pull request
- [ ] Address review feedback
- [ ] Update related documentation
- [ ] Notify stakeholders
- [ ] Archive implementation artifacts

## Sign-off
- [ ] Developer review complete
- [ ] Peer review complete
- [ ] Tests passing in CI
- [ ] Ready for integration

---
**Notes:**
- Check off items as completed
- Add notes for any deviations
- Document any technical debt
- Record actual time spent
`;
  }

  private getTestFileExtension(framework: string): string {
    if (framework.toLowerCase().includes('jest')) {
      return 'test.ts';
    } else if (framework.toLowerCase().includes('mocha')) {
      return 'spec.ts';
    } else if (framework.toLowerCase().includes('vitest')) {
      return 'test.ts';
    }
    return 'test.ts';
  }
}
