/**
 * Tests for the common verification module
 * Following TDD principles - these tests should define expected behavior
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CommonVerifier } from '../verification/common.js';
import { IVerificationContext } from '../types/index.js';

describe('CommonVerifier', () => {
  let verifier: CommonVerifier;

  beforeEach(() => {
    verifier = new CommonVerifier();
  });

  describe('Hallucination Detection', () => {
    it('should detect uncertain language', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The system probably should handle user authentication',
      };

      const results = await verifier.verify(context);
      const hallucinations = results.filter(r => r.category === 'hallucination');

      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].message).toContain('probably');
    });

    it('should detect TODO markers', async () => {
      const context: IVerificationContext = {
        phase: 'plan',
        content: 'TODO: Define the database schema',
      };

      const results = await verifier.verify(context);
      const hallucinations = results.filter(r => r.category === 'hallucination');

      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].message).toContain('TODO');
    });

    it('should detect NEEDS CLARIFICATION markers', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The response time should be [NEEDS CLARIFICATION: exact metric]',
      };

      const results = await verifier.verify(context);
      const hallucinations = results.filter(r => r.category === 'hallucination');

      expect(hallucinations.length).toBeGreaterThan(0);
    });
  });

  describe('Ambiguity Detection', () => {
    it('should detect vague quantifiers', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The system should handle many users efficiently',
      };

      const results = await verifier.verify(context);
      const ambiguities = results.filter(r => r.category === 'ambiguity');

      expect(ambiguities.length).toBeGreaterThan(0);
      expect(ambiguities.some(a => a.message.includes('many'))).toBe(true);
    });

    it('should detect non-specific timing', async () => {
      const context: IVerificationContext = {
        phase: 'plan',
        content: 'The feature will be implemented soon',
      };

      const results = await verifier.verify(context);
      const ambiguities = results.filter(r => r.category === 'ambiguity');

      expect(ambiguities.length).toBeGreaterThan(0);
      expect(ambiguities.some(a => a.message.includes('soon'))).toBe(true);
    });
  });

  describe('Specification Validation', () => {
    it('should detect technical details in spec', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The system MUST use React for the frontend and PostgreSQL for the database',
      };

      const results = await verifier.verify(context);
      const errors = results.filter(r => r.type === 'error' && r.category === 'inconsistency');

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('React'))).toBe(true);
    });

    it('should check for required sections', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'This is a specification without proper sections',
      };

      const results = await verifier.verify(context);
      const incomplete = results.filter(r => r.category === 'incompleteness');

      expect(incomplete.length).toBeGreaterThan(0);
      expect(incomplete.some(i => i.message.includes('user scenarios'))).toBe(true);
    });

    it('should validate testable requirements', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The system needs to be good and user-friendly',
      };

      const results = await verifier.verify(context);
      const warnings = results.filter(r => r.type === 'warning');

      expect(warnings.some(w => w.message.includes('testable requirements'))).toBe(true);
    });
  });

  describe('Plan Validation', () => {
    it('should check for tech stack definition', async () => {
      const context: IVerificationContext = {
        phase: 'plan',
        content: 'This is a plan without technical details',
      };

      const results = await verifier.verify(context);
      const errors = results.filter(r => r.category === 'incompleteness');

      expect(errors.some(e => e.message.includes('technology stack'))).toBe(true);
    });

    it('should check for testing strategy', async () => {
      const context: IVerificationContext = {
        phase: 'plan',
        content: 'Language: TypeScript\nFramework: Express',
      };

      const results = await verifier.verify(context);
      const warnings = results.filter(r => r.category === 'incompleteness');

      expect(warnings.some(w => w.message.includes('Testing strategy'))).toBe(true);
    });
  });

  describe('Tasks Validation', () => {
    it('should check for sufficient task breakdown', async () => {
      const context: IVerificationContext = {
        phase: 'tasks',
        content: 'T001 Setup project\nT002 Implement everything',
      };

      const results = await verifier.verify(context);
      const warnings = results.filter(r => r.type === 'warning');

      expect(warnings.some(w => w.message.includes('Insufficient task breakdown'))).toBe(true);
    });

    it('should enforce TDD with test tasks', async () => {
      const context: IVerificationContext = {
        phase: 'tasks',
        content: 'T001 Implement feature\nT002 Create service\nT003 Build UI',
      };

      const results = await verifier.verify(context);
      const errors = results.filter(r => r.type === 'error');

      expect(errors.some(e => e.message.includes('No test tasks'))).toBe(true);
    });
  });

  describe('Implementation Validation', () => {
    it('should check for TDD phases', async () => {
      const context: IVerificationContext = {
        phase: 'implement',
        content: 'Just implement the feature directly',
      };

      const results = await verifier.verify(context);
      const warnings = results.filter(r => r.category === 'incompleteness');

      expect(warnings.some(w => w.message.includes('TDD phase'))).toBe(true);
    });

    it('should require test definitions', async () => {
      const context: IVerificationContext = {
        phase: 'implement',
        content: 'Implement the following algorithm...',
      };

      const results = await verifier.verify(context);
      const errors = results.filter(r => r.type === 'error');

      expect(errors.some(e => e.message.includes('Test definitions'))).toBe(true);
    });
  });

  describe('Confidence Calculation', () => {
    it('should return high confidence for clean content', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: `# User Scenarios
The user can log in.
## Requirements
- The system MUST authenticate users
- The system MUST validate input
## Acceptance Criteria
Given valid credentials, when user logs in, then access is granted.`,
      };

      const results = await verifier.verify(context);
      const confidence = verifier.calculateConfidence(results);

      expect(confidence).toBeGreaterThan(0.5);
    });

    it('should return low confidence for problematic content', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'Maybe the system should probably do something good soon using React',
      };

      const results = await verifier.verify(context);
      const confidence = verifier.calculateConfidence(results);

      expect(confidence).toBeLessThan(0.5);
    });

    it('should return 1.0 for perfect content', () => {
      const confidence = verifier.calculateConfidence([]);
      expect(confidence).toBe(1.0);
    });
  });

  describe('Consistency Checking', () => {
    it('should detect major changes from previous versions', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'Completely new specification content',
        previousVersions: ['Original specification with different requirements'],
      };

      const results = await verifier.verify(context);
      const inconsistencies = results.filter(r => r.category === 'inconsistency');

      expect(inconsistencies.some(i => i.message.includes('Significant changes'))).toBe(true);
    });

    it('should detect removed requirements', async () => {
      const context: IVerificationContext = {
        phase: 'spec',
        content: 'The system MUST validate input.',
        previousVersions: [
          'The system MUST validate input. The system MUST authenticate users. The system MUST log actions.',
        ],
      };

      const results = await verifier.verify(context);
      const inconsistencies = results.filter(r => r.category === 'inconsistency');

      expect(inconsistencies.some(i => i.message.includes('requirement(s) removed'))).toBe(true);
    });
  });
});
