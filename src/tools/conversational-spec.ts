/**
 * Conversational Specification Tool
 * Implements iterative dialogue for requirement refinement
 */

import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { ConversationalSession, Question } from '../conversation/conversational-session.js';
// Simple ResourceManager implementation for conversational spec
class ResourceManager {
  constructor(private projectPath: string) {}
  
  async ensureDirectories(): Promise<void> {
    await fs.ensureDir(path.join(this.projectPath, '.specify', 'spec'));
    await fs.ensureDir(path.join(this.projectPath, '.specify', 'conversations'));
  }
  
  async saveSpecification(content: string): Promise<string> {
    const specPath = path.join(this.projectPath, '.specify', 'spec', 'current.md');
    await fs.writeFile(specPath, content);
    return specPath;
  }
}

const ConversationalSpecSchema = z.object({
  action: z.enum(['start', 'answer', 'refine', 'complete', 'pause', 'resume', 'status']),
  project_path: z.string(),
  session_id: z.string().optional(),
  question_id: z.string().optional(),
  answer: z.string().optional(),
  confidence: z.number().min(1).max(5).optional(),
  initial_idea: z.string().optional(),
});

export async function conversationalSpec(params: z.infer<typeof ConversationalSpecSchema>) {
  const { action, project_path, session_id, question_id, answer, confidence, initial_idea } = params;
  
  const resourceManager = new ResourceManager(project_path);
  await resourceManager.ensureDirectories();

  try {
    switch (action) {
      case 'start':
        return await startConversationalSession(project_path, initial_idea);
      
      case 'answer':
        if (!session_id || !question_id || !answer) {
          throw new Error('session_id, question_id, and answer are required for answer action');
        }
        return await provideAnswer(project_path, session_id, question_id, answer, confidence);
      
      case 'refine':
        if (!session_id) {
          throw new Error('session_id is required for refine action');
        }
        return await refineDocument(project_path, session_id);
      
      case 'complete':
        if (!session_id) {
          throw new Error('session_id is required for complete action');
        }
        return await completeSession(project_path, session_id);
      
      case 'pause':
        if (!session_id) {
          throw new Error('session_id is required for pause action');
        }
        return await pauseSession(project_path, session_id);
      
      case 'resume':
        if (!session_id) {
          throw new Error('session_id is required for resume action');
        }
        return await resumeSession(project_path, session_id);
      
      case 'status':
        return await getSessionStatus(project_path, session_id);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      action
    };
  }
}

async function startConversationalSession(projectPath: string, initialIdea?: string) {
  // Check if there's already an active session
  const activeSession = await findActiveSession(projectPath, 'spec');
  if (activeSession) {
    return {
      success: false,
      error: 'There is already an active specification session. Use "resume" to continue or "complete" to finish it.',
      active_session_id: activeSession.sessionId
    };
  }

  const session = new ConversationalSession(projectPath, 'spec');
  await session.initialize(initialIdea);
  
  const firstQuestion = await session.askNextQuestion();
  const progress = session.getProgress();
  
  return {
    success: true,
    message: '🚀 **Started conversational specification process**\n\nI\'ll guide you through creating a comprehensive specification through targeted questions.',
    session_id: session.getState().sessionId,
    current_question: firstQuestion ? formatQuestion(firstQuestion) : null,
    progress,
    instructions: `
**How this works**:
1. I ask targeted questions about your requirements
2. You provide answers with optional confidence levels (1-5)
3. I generate follow-up questions based on your responses
4. We iteratively refine the specification together
5. You can pause/resume at any time

**Your first question is ready above** 👆

Use \`conversational_spec\` with action="answer" to respond.
    `.trim()
  };
}

async function provideAnswer(
  projectPath: string, 
  sessionId: string, 
  questionId: string, 
  answer: string, 
  confidence?: number
) {
  const session = await loadSession(projectPath, sessionId);
  
  const result = await session.provideAnswer(questionId, answer, confidence);
  const progress = session.getProgress();
  
  let responseMessage = '✅ **Answer recorded and processed**\n\n';
  
  if (result.documentUpdate) {
    responseMessage += `**Document updated** with your input.\n\n`;
  }
  
  if (result.followUpQuestions.length > 0) {
    responseMessage += `**Generated ${result.followUpQuestions.length} follow-up questions** based on your answer.\n\n`;
  }
  
  if (result.nextQuestion) {
    responseMessage += `**Next Question** (${progress.answeredQuestions + 1}/${progress.totalQuestions}):\n\n`;
    responseMessage += formatQuestion(result.nextQuestion);
  } else {
    responseMessage += `**All questions completed!** Ready to refine the specification.\n\nUse action="refine" to generate the refined document.`;
  }

  return {
    success: true,
    message: responseMessage,
    session_id: sessionId,
    current_question: result.nextQuestion ? formatQuestion(result.nextQuestion) : null,
    follow_up_questions: result.followUpQuestions.map(formatQuestion),
    progress,
    document_update: result.documentUpdate
  };
}

async function refineDocument(projectPath: string, sessionId: string) {
  const session = await loadSession(projectPath, sessionId);
  
  const result = await session.refineDocument();
  const progress = session.getProgress();
  
  let message = '🔄 **Document refined based on your responses**\n\n';
  
  if (result.additionalQuestions.length > 0) {
    message += `**Identified ${result.additionalQuestions.length} areas needing clarification**:\n\n`;
    result.additionalQuestions.forEach((q, i) => {
      message += `${i + 1}. ${q.content}\n`;
    });
    message += `\nNext question is ready to answer.`;
  } else {
    message += `**Specification appears complete!** All key areas have been addressed.\n\n`;
    message += `Use action="complete" to finalize and save the specification.`;
  }

  return {
    success: true,
    message,
    session_id: sessionId,
    refined_content: result.refinedContent,
    additional_questions: result.additionalQuestions.map(formatQuestion),
    progress,
    ready_to_complete: result.additionalQuestions.length === 0
  };
}

async function completeSession(projectPath: string, sessionId: string) {
  const session = await loadSession(projectPath, sessionId);
  
  const result = await session.completeSession();
  
  // Save the final specification
  const resourceManager = new ResourceManager(projectPath);
  const specPath = await resourceManager.saveSpecification(result.finalDocument);
  
  return {
    success: true,
    message: `✅ **Conversational specification completed successfully!**\n\n${result.summary}\n\n📄 **Final specification saved** to: \`${specPath}\`\n\n🎯 **Ready for next phase**: Use \`create_plan\` to begin technical planning.`,
    session_id: sessionId,
    final_document: result.finalDocument,
    summary: result.summary,
    specification_path: specPath,
    next_steps: [
      'Review the generated specification',
      'Use create_plan to begin technical architecture',
      'Share specification with stakeholders for validation'
    ]
  };
}

async function pauseSession(projectPath: string, sessionId: string) {
  const session = await loadSession(projectPath, sessionId);
  await session.pauseSession();
  
  const progress = session.getProgress();
  
  return {
    success: true,
    message: `⏸️ **Session paused**\n\nYour progress has been saved. You can resume anytime with action="resume".`,
    session_id: sessionId,
    progress
  };
}

async function resumeSession(projectPath: string, sessionId: string) {
  const session = await loadSession(projectPath, sessionId);
  const nextQuestion = await session.resumeSession();
  const progress = session.getProgress();
  
  let message = `▶️ **Session resumed**\n\n`;
  
  if (nextQuestion) {
    message += `**Continuing where we left off**:\n\n${formatQuestion(nextQuestion)}`;
  } else {
    message += `**No pending questions**. Use action="refine" to process your answers.`;
  }

  return {
    success: true,
    message,
    session_id: sessionId,
    current_question: nextQuestion ? formatQuestion(nextQuestion) : null,
    progress
  };
}

async function getSessionStatus(projectPath: string, sessionId?: string) {
  if (sessionId) {
    const session = await loadSession(projectPath, sessionId);
    const state = session.getState();
    const progress = session.getProgress();
    
    return {
      success: true,
      session_id: sessionId,
      status: state.status,
      phase: state.phase,
      progress,
      current_question: state.currentQuestion ? formatQuestion(state.currentQuestion) : null,
      started_at: state.startedAt,
      last_activity: state.lastActivity,
      iteration_count: state.iterationCount
    };
  } else {
    // List all sessions
    const sessions = await listSessions(projectPath);
    return {
      success: true,
      sessions: sessions.map(s => ({
        session_id: s.sessionId,
        phase: s.phase,
        status: s.status,
        started_at: s.startedAt,
        progress: calculateProgress(s)
      }))
    };
  }
}

// Helper functions
async function findActiveSession(projectPath: string, phase: 'spec' | 'plan' | 'tasks' | 'implement') {
  const conversationDir = path.join(projectPath, '.specify', 'conversations');
  
  if (!(await fs.pathExists(conversationDir))) {
    return null;
  }
  
  const files = await fs.readdir(conversationDir);
  const sessionFiles = files.filter(f => f.startsWith(`${phase}-`) && f.endsWith('.json'));
  
  for (const file of sessionFiles) {
    const session = await ConversationalSession.load(path.join(conversationDir, file));
    const state = session.getState();
    
    if (state.status !== 'completed') {
      return state;
    }
  }
  
  return null;
}

async function loadSession(projectPath: string, sessionId: string): Promise<ConversationalSession> {
  const conversationDir = path.join(projectPath, '.specify', 'conversations');
  const files = await fs.readdir(conversationDir);
  const sessionFile = files.find(f => f.includes(sessionId));
  
  if (!sessionFile) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  return ConversationalSession.load(path.join(conversationDir, sessionFile));
}

async function listSessions(projectPath: string) {
  const conversationDir = path.join(projectPath, '.specify', 'conversations');
  
  if (!(await fs.pathExists(conversationDir))) {
    return [];
  }
  
  const files = await fs.readdir(conversationDir);
  const sessionFiles = files.filter(f => f.endsWith('.json'));
  
  const sessions = [];
  for (const file of sessionFiles) {
    try {
      const session = await ConversationalSession.load(path.join(conversationDir, file));
      sessions.push(session.getState());
    } catch (error) {
      // Skip invalid session files
    }
  }
  
  return sessions;
}

function calculateProgress(state: any) {
  const answered = state.completedQA?.length || 0;
  const pending = state.pendingQuestions?.length || 0;
  const total = answered + pending;
  
  return {
    totalQuestions: total,
    answeredQuestions: answered,
    pendingQuestions: pending,
    completionPercentage: total > 0 ? Math.round((answered / total) * 100) : 0
  };
}

function formatQuestion(question: Question): string {
  let formatted = `**${question.content}**\n\n`;
  
  if (question.context) {
    formatted += `*${question.context}*\n\n`;
  }
  
  if (question.expectedAnswerType === 'choice' && question.choices) {
    formatted += `**Please choose one**:\n`;
    question.choices.forEach((choice, i) => {
      formatted += `${i + 1}. ${choice}\n`;
    });
    formatted += `\n`;
  }
  
  formatted += `**Question ID**: \`${question.id}\`\n`;
  formatted += `**Criticality**: ${question.criticality}\n`;
  
  if (question.expectedAnswerType === 'boolean') {
    formatted += `\n*Please answer with "yes" or "no"*`;
  } else if (question.expectedAnswerType === 'list') {
    formatted += `\n*Please provide a list of items*`;
  }
  
  return formatted;
}
