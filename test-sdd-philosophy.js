#!/usr/bin/env node

/**
 * Test Script for SDD Philosophy Implementation
 * Verifies that each phase strictly adheres to its designated role
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 **SDD Philosophy Compliance Test**\n');
console.log('=' .repeat(50));
console.log('Testing strict separation of concerns per phase');
console.log('=' .repeat(50) + '\n');

// Test scenarios for each phase
const testScenarios = {
  spec: {
    good: `
# User Management System

## Users
- Primary: System administrators who manage user accounts
- Secondary: End users who access their profiles

## Problem Statement
Organizations need a centralized way to manage user accounts, permissions, and access control. Current manual processes lead to security risks and inefficiencies.

## Functional Requirements
- System MUST allow administrators to create user accounts
- System MUST enforce unique email addresses
- Users MUST be able to reset their passwords
- System MUST log all access attempts

## Success Criteria
- 99.9% authentication success rate
- <2 second response time for login
- Zero unauthorized access incidents
`,
    bad: `
# User Management System

## Users
System administrators using React dashboard

## Problem
Need user management with MongoDB database

## Requirements
- Create REST API with Express.js
- Use JWT tokens for authentication
- Deploy on AWS Lambda
- Implement with TypeScript classes

## Architecture
Microservices with Docker containers
`
  },
  plan: {
    good: `
# Technical Architecture

## System Architecture
- Pattern: Microservices architecture
- Communication: REST APIs with OpenAPI 3.0

## Technology Stack
- Backend: Node.js 20 LTS with TypeScript
- Database: PostgreSQL 15 for relational data
- Cache: Redis for session management
- Framework: NestJS for enterprise structure

## Data Model
- Users table: id, email, password_hash, created_at
- Sessions table: id, user_id, token, expires_at
- Permissions table: id, name, resource

## Security
- Authentication: JWT with RSA256
- Password: Argon2 hashing
- Rate limiting: 100 requests per minute
`,
    bad: `
# Technical Plan

## What We're Building
A system for users to manage their accounts

## User Stories
As an admin, I want to create users
As a user, I want to login

## Test Cases
- Test user creation
- Test login functionality
- Test password reset

## Implementation Steps
1. Create user model
2. Add authentication
3. Build UI components
`
  }
};

// Create test directories
for (const [phase, scenarios] of Object.entries(testScenarios)) {
  console.log(`\n📝 Testing ${phase.toUpperCase()} Phase`);
  console.log('-'.repeat(40));
  
  // Test GOOD content (should pass)
  const goodPath = path.join(__dirname, `test-${phase}-good`);
  const goodSpecPath = path.join(goodPath, '.specify', phase);
  fs.mkdirSync(goodSpecPath, { recursive: true });
  fs.writeFileSync(path.join(goodSpecPath, 'current.md'), scenarios.good);
  console.log(`✅ Created GOOD ${phase} example: ${goodPath}`);
  
  // Test BAD content (should fail validation)
  const badPath = path.join(__dirname, `test-${phase}-bad`);
  const badSpecPath = path.join(badPath, '.specify', phase);
  fs.mkdirSync(badSpecPath, { recursive: true });
  fs.writeFileSync(path.join(badSpecPath, 'current.md'), scenarios.bad);
  console.log(`❌ Created BAD ${phase} example: ${badPath}`);
}

console.log('\n' + '='.repeat(50));
console.log('📊 **Test Scenarios Created**');
console.log('='.repeat(50));

console.log(`
🎯 **What to Test:**

1. **SPEC Phase Validation**
   - Good: specify_verify project_path="test-spec-good"
     Should show high score, no inappropriate content
   
   - Bad: specify_verify project_path="test-spec-bad"
     Should detect and remove technical details

2. **PLAN Phase Validation**
   - Good: specify_verify project_path="test-plan-good"
     Should recognize proper technical planning
   
   - Bad: specify_verify project_path="test-plan-bad"
     Should flag user stories and test cases as misplaced

3. **Expected Behaviors:**
   ✅ Each phase accepts only its designated content
   ✅ Inappropriate content is flagged or removed
   ✅ Clear guidance on what belongs where
   ✅ Score reflects adherence to phase boundaries

4. **SDD Philosophy Check:**
   - Spec = WHAT & WHY (no HOW)
   - Plan = HOW (no WHAT)
   - Tasks = Work breakdown (no implementation)
   - Implement = TDD & Code (everything allowed)
`);

console.log('\n🚀 Run "npm run dev" and test with the MCP tools above!');
