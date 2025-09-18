#!/usr/bin/env node

/**
 * Test script for SemanticQualityAnalyzer integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample test document
const testSpec = `
# Project Specification

## Users
Primary users are individual developers who manage multiple projects simultaneously. They need a way to quickly switch between tasks without losing context.

## Problem Statement
Developers often lose track of what they were working on when switching between projects. This leads to:
- Wasted time trying to remember context
- Important tasks being forgotten
- Difficulty prioritizing work across projects

## Functional Requirements
The system must:
- Support multiple project workspaces
- Allow task prioritization (High/Medium/Low)
- Track task status (Todo/In Progress/Done)
- Provide quick task switching capabilities
- Maintain context for each project

## Success Criteria
- 50% reduction in context-switching time
- 90% task completion rate
- Under 2 seconds to find any task
`;

// Create test directory
const testDir = path.join(__dirname, 'test-project', '.specify', 'spec');
fs.mkdirSync(testDir, { recursive: true });

// Write test spec
fs.writeFileSync(path.join(testDir, 'current.md'), testSpec);

console.log('✅ Test file created at:', path.join(testDir, 'current.md'));
console.log('\n📋 Test document preview:');
console.log('---');
console.log(testSpec.substring(0, 200) + '...');
console.log('---');
console.log('\n🚀 Now you can test with MCP tools to see the quality score comparison!');
console.log('   Try: specify_verify with project_path: test-project');
