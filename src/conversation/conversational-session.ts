/**
 * Conversational Session Management
 * Implements AI-SDD's "iterative dialogue" principle
 */

import fs from 'fs-extra';
import * as path from 'path';

export interface Question {
  id: string;
  type: 'clarification' | 'edge_case' | 'validation' | 'preference' | 'confirmation';
  content: string;
  context: string;
  phase: 'spec' | 'plan' | 'tasks' | 'implement';
  expectedAnswerType: 'text' | 'choice' | 'boolean' | 'list';
  choices?: string[];
  criticality: 'high' | 'medium' | 'low';
  dependsOn?: string[]; // Other question IDs this depends on
}

export interface Answer {
  questionId: string;
  content: string;
  timestamp: Date;
  confidence: number | undefined; // User confidence in their answer (1-5)
}

export interface QuestionAnswerPair {
  question: Question;
  answer: Answer;
  followUpQuestions?: Question[];
}

export interface ConversationalState {
  sessionId: string;
  projectPath: string;
  phase: 'spec' | 'plan' | 'tasks' | 'implement';
  status: 'questioning' | 'waiting_response' | 'refining' | 'completed' | 'paused';
  currentQuestion: Question | undefined;
  pendingQuestions: Question[];
  completedQA: QuestionAnswerPair[];
  documentDraft: string;
  iterationCount: number;
  startedAt: Date;
  lastActivity: Date;
  userPreferences: {
    questioningStyle: 'detailed' | 'concise' | 'adaptive';
    maxQuestionsPerRound: number;
    autoRefine: boolean;
  };
}

export class ConversationalSession {
  private state: ConversationalState;
  private readonly sessionPath: string;
  
  constructor(projectPath: string, phase: 'spec' | 'plan' | 'tasks' | 'implement', sessionId?: string) {
    const id = sessionId || this.generateSessionId();
    this.sessionPath = path.join(projectPath, '.specify', 'conversations', `${phase}-${id}.json`);
    
    this.state = {
      sessionId: id,
      projectPath,
      phase,
      status: 'questioning',
      currentQuestion: undefined,
      pendingQuestions: [],
      completedQA: [],
      documentDraft: '',
      iterationCount: 0,
      startedAt: new Date(),
      lastActivity: new Date(),
      userPreferences: {
        questioningStyle: 'adaptive',
        maxQuestionsPerRound: 3,
        autoRefine: true
      }
    };
  }

  async initialize(initialContent?: string): Promise<void> {
    await fs.ensureDir(path.dirname(this.sessionPath));
    
    if (initialContent) {
      this.state.documentDraft = initialContent;
    }
    
    // Generate initial questions based on phase and content
    this.state.pendingQuestions = await this.generateInitialQuestions();
    this.state.currentQuestion = this.getNextQuestion();
    
    await this.save();
  }

  async askNextQuestion(): Promise<Question | null> {
    if (this.state.status !== 'questioning' && this.state.status !== 'waiting_response') {
      return null;
    }

    if (!this.state.currentQuestion && this.state.pendingQuestions.length > 0) {
      this.state.currentQuestion = this.getNextQuestion();
      this.state.status = 'waiting_response';
      await this.save();
    }

    return this.state.currentQuestion || null;
  }

  async provideAnswer(questionId: string, answerContent: string, confidence?: number): Promise<{
    accepted: boolean;
    followUpQuestions: Question[];
    documentUpdate?: string;
    nextQuestion: Question | undefined;
  }> {
    const currentQ = this.state.currentQuestion;
    if (!currentQ || currentQ.id !== questionId) {
      throw new Error(`Question ${questionId} is not the current question`);
    }

    const answer: Answer = {
      questionId,
      content: answerContent,
      timestamp: new Date(),
      confidence
    };

    // Create Q&A pair
    const qaPair: QuestionAnswerPair = {
      question: currentQ,
      answer
    };

    // Generate follow-up questions based on answer
    const followUpQuestions = await this.generateFollowUpQuestions(currentQ, answer);
    qaPair.followUpQuestions = followUpQuestions;

    // Add to completed Q&As
    this.state.completedQA.push(qaPair);
    
    // Add follow-up questions to pending queue
    this.state.pendingQuestions.unshift(...followUpQuestions);

    // Update document based on answer
    const documentUpdate = await this.updateDocumentWithAnswer(qaPair);
    
    // Move to next question or refining phase
    this.state.currentQuestion = this.getNextQuestion();
    
    if (!this.state.currentQuestion && this.state.pendingQuestions.length === 0) {
      this.state.status = 'refining';
    }

    this.state.lastActivity = new Date();
    await this.save();

    return {
      accepted: true,
      followUpQuestions,
      documentUpdate,
      nextQuestion: this.state.currentQuestion
    };
  }

  async refineDocument(): Promise<{ refinedContent: string; additionalQuestions: Question[] }> {
    this.state.status = 'refining';
    this.state.iterationCount++;

    // Use all Q&A pairs to refine the document
    const refinedContent = await this.synthesizeDocumentFromQA();
    this.state.documentDraft = refinedContent;

    // Identify gaps or inconsistencies that need more questions
    const additionalQuestions = await this.identifyMissingInformation();
    
    if (additionalQuestions.length > 0) {
      this.state.pendingQuestions.push(...additionalQuestions);
      this.state.currentQuestion = this.getNextQuestion();
      this.state.status = 'questioning';
    } else {
      this.state.status = 'completed';
    }

    await this.save();

    return {
      refinedContent,
      additionalQuestions
    };
  }

  async pauseSession(): Promise<void> {
    this.state.status = 'paused';
    this.state.lastActivity = new Date();
    await this.save();
  }

  async resumeSession(): Promise<Question | null> {
    if (this.state.status === 'paused') {
      this.state.status = 'questioning';
      this.state.lastActivity = new Date();
      await this.save();
    }
    
    return this.askNextQuestion();
  }

  async completeSession(): Promise<{ finalDocument: string; summary: string }> {
    this.state.status = 'completed';
    
    const summary = this.generateSessionSummary();
    
    await this.save();
    
    return {
      finalDocument: this.state.documentDraft,
      summary
    };
  }

  // Static method to load existing session
  static async load(sessionPath: string): Promise<ConversationalSession> {
    const data = await fs.readJSON(sessionPath);
    const session = Object.create(ConversationalSession.prototype);
    session.state = {
      ...data,
      startedAt: new Date(data.startedAt),
      lastActivity: new Date(data.lastActivity),
      completedQA: data.completedQA.map((qa: any) => ({
        ...qa,
        answer: {
          ...qa.answer,
          timestamp: new Date(qa.answer.timestamp)
        }
      }))
    };
    session.sessionPath = sessionPath;
    return session;
  }

  getState(): ConversationalState {
    return { ...this.state };
  }

  getProgress(): {
    totalQuestions: number;
    answeredQuestions: number;
    pendingQuestions: number;
    completionPercentage: number;
  } {
    const answered = this.state.completedQA.length;
    const pending = this.state.pendingQuestions.length;
    const total = answered + pending;
    
    return {
      totalQuestions: total,
      answeredQuestions: answered,
      pendingQuestions: pending,
      completionPercentage: total > 0 ? Math.round((answered / total) * 100) : 0
    };
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextQuestion(): Question | undefined {
    // Prioritize high criticality questions
    const highPriority = this.state.pendingQuestions.filter(q => q.criticality === 'high');
    if (highPriority.length > 0 && highPriority[0]) {
      return this.state.pendingQuestions.splice(
        this.state.pendingQuestions.indexOf(highPriority[0]), 1
      )[0];
    }

    // Then medium priority
    const mediumPriority = this.state.pendingQuestions.filter(q => q.criticality === 'medium');
    if (mediumPriority.length > 0 && mediumPriority[0]) {
      return this.state.pendingQuestions.splice(
        this.state.pendingQuestions.indexOf(mediumPriority[0]), 1
      )[0];
    }

    // Finally low priority
    return this.state.pendingQuestions.shift();
  }

  private async generateInitialQuestions(): Promise<Question[]> {
    const questions: Question[] = [];
    
    switch (this.state.phase) {
      case 'spec':
        questions.push(
          {
            id: 'user-definition',
            type: 'clarification',
            content: 'Who are the primary users of this system? Please describe their roles, expertise levels, and main goals.',
            context: 'Understanding user personas is crucial for requirement definition',
            phase: 'spec',
            expectedAnswerType: 'text',
            criticality: 'high'
          },
          {
            id: 'core-problem',
            type: 'clarification', 
            content: 'What specific problem does this system solve? What pain points or inefficiencies will it address?',
            context: 'Problem definition drives all subsequent requirements',
            phase: 'spec',
            expectedAnswerType: 'text',
            criticality: 'high'
          },
          {
            id: 'success-criteria',
            type: 'validation',
            content: 'How will you measure success? What metrics or outcomes indicate the system is working effectively?',
            context: 'Success criteria enable proper validation and testing',
            phase: 'spec',
            expectedAnswerType: 'text',
            criticality: 'high'
          }
        );
        break;

      case 'plan':
        questions.push(
          {
            id: 'architecture-style',
            type: 'preference',
            content: 'What architectural style do you prefer for this system?',
            context: 'Architecture choice affects scalability and maintainability',
            phase: 'plan',
            expectedAnswerType: 'choice',
            choices: ['Monolithic', 'Microservices', 'Serverless', 'Hybrid', 'Not sure - recommend based on requirements'],
            criticality: 'high'
          },
          {
            id: 'technology-constraints',
            type: 'clarification',
            content: 'Are there any technology constraints, existing systems to integrate with, or organizational preferences?',
            context: 'Constraints shape technology selection',
            phase: 'plan', 
            expectedAnswerType: 'text',
            criticality: 'medium'
          }
        );
        break;

      case 'tasks':
        questions.push(
          {
            id: 'team-structure',
            type: 'clarification',
            content: 'What is your team structure? How many developers, and what are their skill levels?',
            context: 'Team structure affects task breakdown and assignment',
            phase: 'tasks',
            expectedAnswerType: 'text', 
            criticality: 'medium'
          },
          {
            id: 'timeline-constraints',
            type: 'clarification',
            content: 'What are your timeline constraints? Are there any hard deadlines or milestones?',
            context: 'Timeline affects task prioritization and parallelization',
            phase: 'tasks',
            expectedAnswerType: 'text',
            criticality: 'high'
          }
        );
        break;

      case 'implement':
        questions.push(
          {
            id: 'coding-standards',
            type: 'preference',
            content: 'Do you have existing coding standards, style guides, or architectural patterns to follow?',
            context: 'Consistency with existing codebase is important',
            phase: 'implement',
            expectedAnswerType: 'text',
            criticality: 'medium'
          },
          {
            id: 'testing-approach',
            type: 'preference',
            content: 'What testing approach do you prefer?',
            context: 'Testing strategy affects implementation structure',
            phase: 'implement',
            expectedAnswerType: 'choice',
            choices: ['TDD (Test-Driven Development)', 'BDD (Behavior-Driven Development)', 'Traditional (Write tests after)', 'Integration-focused', 'Not sure - recommend best approach'],
            criticality: 'high'
          }
        );
        break;
    }

    return questions;
  }

  private async generateFollowUpQuestions(question: Question, answer: Answer): Promise<Question[]> {
    const followUps: Question[] = [];

    // Generate context-aware follow-up questions based on the answer
    switch (question.id) {
      case 'user-definition':
        if (answer.content.includes('beginner') || answer.content.includes('novice')) {
          followUps.push({
            id: 'user-onboarding',
            type: 'clarification',
            content: 'Since you mentioned beginner users, how should the system onboard and guide new users?',
            context: 'Beginner users need special consideration for UX',
            phase: this.state.phase,
            expectedAnswerType: 'text',
            criticality: 'medium'
          });
        }
        
        if (answer.content.includes('multiple') || answer.content.includes('different')) {
          followUps.push({
            id: 'user-roles',
            type: 'clarification', 
            content: 'You mentioned multiple user types. Should different users have different permissions or interfaces?',
            context: 'Multiple user types may need role-based access',
            phase: this.state.phase,
            expectedAnswerType: 'text',
            criticality: 'high'
          });
        }
        break;

      case 'core-problem':
        followUps.push({
          id: 'problem-scope',
          type: 'validation',
          content: 'Are there related problems this system should NOT solve? What is explicitly out of scope?',
          context: 'Defining scope boundaries prevents feature creep',
          phase: this.state.phase,
          expectedAnswerType: 'text',
          criticality: 'medium'
        });
        break;

      case 'architecture-style':
        if (answer.content.includes('Microservices')) {
          followUps.push({
            id: 'microservice-boundaries',
            type: 'clarification',
            content: 'How would you like to divide the system into microservices? What should be the service boundaries?',
            context: 'Microservice boundaries affect development and deployment',
            phase: this.state.phase,
            expectedAnswerType: 'text',
            criticality: 'high'
          });
        }
        break;
    }

    return followUps;
  }

  private async updateDocumentWithAnswer(qaPair: QuestionAnswerPair): Promise<string> {
    // This would use AI to intelligently update the document
    // For now, we'll append the Q&A in a structured way
    
    const update = `\n\n### ${qaPair.question.type.charAt(0).toUpperCase() + qaPair.question.type.slice(1)}: ${qaPair.question.content}\n\n${qaPair.answer.content}\n`;
    
    this.state.documentDraft += update;
    return update;
  }

  private async synthesizeDocumentFromQA(): Promise<string> {
    // This would use AI to create a coherent document from all Q&A pairs
    // For now, we'll create a structured format
    
    let synthesized = `# ${this.state.phase.toUpperCase()} Document\n\n`;
    synthesized += `*Generated through conversational specification process*\n\n`;
    synthesized += `**Iteration**: ${this.state.iterationCount}\n`;
    synthesized += `**Generated**: ${new Date().toISOString()}\n\n`;

    for (const qa of this.state.completedQA) {
      synthesized += `## ${qa.question.content}\n\n${qa.answer.content}\n\n`;
      
      if (qa.followUpQuestions && qa.followUpQuestions.length > 0) {
        synthesized += `### Follow-up considerations:\n`;
        for (const followUp of qa.followUpQuestions) {
          const followUpAnswer = this.state.completedQA.find(
            completed => completed.question.id === followUp.id
          );
          if (followUpAnswer) {
            synthesized += `- **${followUp.content}**: ${followUpAnswer.answer.content}\n`;
          }
        }
        synthesized += `\n`;
      }
    }

    return synthesized;
  }

  private async identifyMissingInformation(): Promise<Question[]> {
    const missing: Question[] = [];
    
    // Analyze the current document and Q&A history to identify gaps
    // This would use AI analysis in a real implementation
    
    const answeredTopics = this.state.completedQA.map(qa => qa.question.type);
    
    if (this.state.phase === 'spec') {
      if (!answeredTopics.includes('edge_case')) {
        missing.push({
          id: 'edge-cases',
          type: 'edge_case',
          content: 'What edge cases or error conditions should the system handle?',
          context: 'Edge cases are often overlooked but critical for robustness',
          phase: 'spec',
          expectedAnswerType: 'text',
          criticality: 'medium'
        });
      }
    }

    return missing;
  }

  private generateSessionSummary(): string {
    const progress = this.getProgress();
    const duration = new Date().getTime() - this.state.startedAt.getTime();
    const durationMinutes = Math.round(duration / (1000 * 60));
    
    return `
**Conversational Session Summary**

- **Phase**: ${this.state.phase.toUpperCase()}  
- **Duration**: ${durationMinutes} minutes
- **Questions Answered**: ${progress.answeredQuestions}
- **Iterations**: ${this.state.iterationCount}
- **Final Status**: ${this.state.status}
- **Session ID**: ${this.state.sessionId}

**Key Insights Gathered**:
${this.state.completedQA.map(qa => `- ${qa.question.content}: ${qa.answer.content.slice(0, 100)}...`).join('\n')}
    `.trim();
  }

  private async save(): Promise<void> {
    await fs.ensureDir(path.dirname(this.sessionPath));
    await fs.writeJSON(this.sessionPath, this.state, { spaces: 2 });
  }
}
