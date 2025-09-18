/**
 * Session Memory Manager
 * Maintains context and learning across sessions
 * Addresses: "세션 간 연속성 - 이전 세션 학습 능력 향상"
 */

import fs from 'fs-extra';
import * as path from 'path';

export interface SessionContext {
  projectId: string;
  phase: string;
  timestamp: string;
  learnings: Learning[];
  preferences: UserPreference[];
  feedback: FeedbackItem[];
  patterns: Pattern[];
}

export interface Learning {
  type: 'success' | 'failure' | 'preference' | 'pattern';
  content: string;
  context: string;
  timestamp: string;
  confidence: number;
}

export interface UserPreference {
  category: string;
  preference: string;
  examples: string[];
  strength: number; // 0-1, how strong this preference is
}

export interface FeedbackItem {
  phase: string;
  originalContent: string;
  feedback: string;
  accepted: boolean;
  timestamp: string;
}

export interface Pattern {
  name: string;
  description: string;
  occurrences: number;
  examples: string[];
  reliability: number; // 0-1, how reliable this pattern is
}

export class SessionMemoryManager {
  private readonly memoryPath: string;
  private currentSession: SessionContext | null = null;
  
  constructor(projectPath: string) {
    this.memoryPath = path.join(projectPath, '.specify', '.session-memory.json');
  }
  
  /**
   * Load previous session memory
   */
  async loadSession(projectId: string, phase: string): Promise<SessionContext> {
    try {
      if (await fs.pathExists(this.memoryPath)) {
        const sessions: SessionContext[] = await fs.readJSON(this.memoryPath);
        
        // Find most recent session for this project and phase
        const relevantSessions = sessions.filter(
          s => s.projectId === projectId && s.phase === phase
        );
        
        if (relevantSessions.length > 0) {
          // Merge learnings from all relevant sessions
          this.currentSession = this.mergeSessions(relevantSessions);
          return this.currentSession;
        }
      }
    } catch (error) {
      console.warn('Could not load session memory:', error);
    }
    
    // Create new session
    this.currentSession = {
      projectId,
      phase,
      timestamp: new Date().toISOString(),
      learnings: [],
      preferences: [],
      feedback: [],
      patterns: []
    };
    
    return this.currentSession;
  }
  
  /**
   * Save current session memory
   */
  async saveSession(): Promise<void> {
    if (!this.currentSession) return;
    
    try {
      let sessions: SessionContext[] = [];
      
      if (await fs.pathExists(this.memoryPath)) {
        sessions = await fs.readJSON(this.memoryPath);
      }
      
      // Add or update current session
      const existingIndex = sessions.findIndex(
        s => s.projectId === this.currentSession!.projectId && 
            s.phase === this.currentSession!.phase
      );
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = this.currentSession;
      } else {
        sessions.push(this.currentSession);
      }
      
      // Keep only last 10 sessions per project
      const grouped = this.groupByProject(sessions);
      const trimmed: SessionContext[] = [];
      
      for (const [_projectId, projectSessions] of Object.entries(grouped)) {
        const sorted = projectSessions.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        trimmed.push(...sorted.slice(0, 10));
      }
      
      await fs.ensureDir(path.dirname(this.memoryPath));
      await fs.writeJSON(this.memoryPath, trimmed, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save session memory:', error);
    }
  }
  
  /**
   * Record a learning from the current session
   */
  recordLearning(type: Learning['type'], content: string, context: string): void {
    if (!this.currentSession) return;
    
    this.currentSession.learnings.push({
      type,
      content,
      context,
      timestamp: new Date().toISOString(),
      confidence: 0.8 // Default confidence
    });
    
    // Update patterns if applicable
    this.updatePatterns(content, context);
  }
  
  /**
   * Record user preference
   */
  recordPreference(category: string, preference: string, example: string): void {
    if (!this.currentSession) return;
    
    const existing = this.currentSession.preferences.find(
      p => p.category === category && p.preference === preference
    );
    
    if (existing) {
      existing.examples.push(example);
      existing.strength = Math.min(1, existing.strength + 0.1);
    } else {
      this.currentSession.preferences.push({
        category,
        preference,
        examples: [example],
        strength: 0.5
      });
    }
  }
  
  /**
   * Record feedback on generated content
   */
  recordFeedback(
    phase: string, 
    originalContent: string, 
    feedback: string, 
    accepted: boolean
  ): void {
    if (!this.currentSession) return;
    
    this.currentSession.feedback.push({
      phase,
      originalContent: originalContent.substring(0, 200), // Store snippet
      feedback,
      accepted,
      timestamp: new Date().toISOString()
    });
    
    // Learn from feedback
    if (!accepted) {
      this.recordLearning(
        'failure',
        `User rejected: ${feedback}`,
        `Phase: ${phase}`
      );
    } else {
      this.recordLearning(
        'success',
        `User accepted content`,
        `Phase: ${phase}`
      );
    }
  }
  
  /**
   * Get relevant learnings for current context
   */
  getRelevantLearnings(phase: string, context: string): Learning[] {
    if (!this.currentSession) return [];
    
    return this.currentSession.learnings.filter(l => {
      // Filter by phase relevance
      if (l.context.includes(phase)) return true;
      
      // Filter by context similarity
      const contextWords = context.toLowerCase().split(/\s+/);
      const learningWords = l.content.toLowerCase().split(/\s+/);
      
      const overlap = contextWords.filter(w => learningWords.includes(w)).length;
      const similarity = overlap / Math.max(contextWords.length, learningWords.length);
      
      return similarity > 0.3;
    });
  }
  
  /**
   * Get user preferences for category
   */
  getPreferences(category: string): UserPreference[] {
    if (!this.currentSession) return [];
    
    return this.currentSession.preferences
      .filter(p => p.category === category)
      .sort((a, b) => b.strength - a.strength);
  }
  
  /**
   * Get identified patterns
   */
  getPatterns(): Pattern[] {
    if (!this.currentSession) return [];
    
    return this.currentSession.patterns
      .filter(p => p.reliability > 0.6)
      .sort((a, b) => b.reliability - a.reliability);
  }
  
  /**
   * Generate session summary
   */
  generateSummary(): string {
    if (!this.currentSession) return 'No session data available';
    
    const { learnings, preferences, feedback, patterns } = this.currentSession;
    
    let summary = '📊 **Session Memory Summary**\n\n';
    
    // Learnings summary
    const successCount = learnings.filter(l => l.type === 'success').length;
    const failureCount = learnings.filter(l => l.type === 'failure').length;
    summary += `**Learnings:** ${learnings.length} total\n`;
    summary += `• Successes: ${successCount}\n`;
    summary += `• Failures: ${failureCount}\n\n`;
    
    // Preferences summary
    if (preferences.length > 0) {
      summary += `**User Preferences:**\n`;
      const topPrefs = preferences.slice(0, 3);
      topPrefs.forEach(p => {
        summary += `• ${p.category}: ${p.preference} (strength: ${(p.strength * 100).toFixed(0)}%)\n`;
      });
      summary += '\n';
    }
    
    // Feedback summary
    const acceptanceRate = feedback.length > 0
      ? (feedback.filter(f => f.accepted).length / feedback.length) * 100
      : 0;
    summary += `**Feedback:** ${feedback.length} items\n`;
    summary += `• Acceptance rate: ${acceptanceRate.toFixed(0)}%\n\n`;
    
    // Patterns summary
    if (patterns.length > 0) {
      summary += `**Identified Patterns:**\n`;
      const topPatterns = patterns.slice(0, 3);
      topPatterns.forEach(p => {
        summary += `• ${p.name}: ${p.occurrences} occurrences (${(p.reliability * 100).toFixed(0)}% reliable)\n`;
      });
    }
    
    return summary;
  }
  
  /**
   * Merge multiple sessions into one
   */
  private mergeSessions(sessions: SessionContext[]): SessionContext {
    if (sessions.length === 0) {
      throw new Error('Cannot merge empty sessions array');
    }
    
    const firstSession = sessions[0];
    if (!firstSession) {
      throw new Error('Invalid session data');
    }
    
    const merged: SessionContext = {
      projectId: firstSession.projectId,
      phase: firstSession.phase,
      timestamp: new Date().toISOString(),
      learnings: [],
      preferences: [],
      feedback: [],
      patterns: []
    };
    
    // Merge learnings (deduplicate by content)
    const learningMap = new Map<string, Learning>();
    sessions.forEach(s => {
      s.learnings.forEach(l => {
        const key = `${l.type}-${l.content}`;
        if (!learningMap.has(key) || l.confidence > learningMap.get(key)!.confidence) {
          learningMap.set(key, l);
        }
      });
    });
    merged.learnings = Array.from(learningMap.values());
    
    // Merge preferences (combine strengths)
    const prefMap = new Map<string, UserPreference>();
    sessions.forEach(s => {
      s.preferences.forEach(p => {
        const key = `${p.category}-${p.preference}`;
        if (prefMap.has(key)) {
          const existing = prefMap.get(key)!;
          existing.examples = [...new Set([...existing.examples, ...p.examples])];
          existing.strength = Math.min(1, existing.strength + p.strength * 0.1);
        } else {
          prefMap.set(key, { ...p });
        }
      });
    });
    merged.preferences = Array.from(prefMap.values());
    
    // Merge feedback (keep all)
    sessions.forEach(s => {
      merged.feedback.push(...s.feedback);
    });
    
    // Merge patterns (combine occurrences)
    const patternMap = new Map<string, Pattern>();
    sessions.forEach(s => {
      s.patterns.forEach(p => {
        if (patternMap.has(p.name)) {
          const existing = patternMap.get(p.name)!;
          existing.occurrences += p.occurrences;
          existing.examples = [...new Set([...existing.examples, ...p.examples])].slice(0, 5);
          existing.reliability = (existing.reliability + p.reliability) / 2;
        } else {
          patternMap.set(p.name, { ...p });
        }
      });
    });
    merged.patterns = Array.from(patternMap.values());
    
    return merged;
  }
  
  /**
   * Group sessions by project
   */
  private groupByProject(sessions: SessionContext[]): Record<string, SessionContext[]> {
    const grouped: Record<string, SessionContext[]> = {};
    
    sessions.forEach(s => {
      if (!grouped[s.projectId]) {
        grouped[s.projectId] = [];
      }
      const projectGroup = grouped[s.projectId];
      if (projectGroup) {
        projectGroup.push(s);
      }
    });
    
    return grouped;
  }
  
  /**
   * Update patterns based on new content
   */
  private updatePatterns(content: string, context: string): void {
    if (!this.currentSession) return;
    
    // Simple pattern detection (can be enhanced)
    const patterns = [
      { regex: /user\s+(story|stories|persona)/gi, name: 'User-focused approach' },
      { regex: /test[- ]driven|TDD/gi, name: 'Test-driven development' },
      { regex: /microservice|micro-service/gi, name: 'Microservices architecture' },
      { regex: /API[- ]first/gi, name: 'API-first design' },
      { regex: /agile|scrum|sprint/gi, name: 'Agile methodology' }
    ];
    
    patterns.forEach(({ regex, name }) => {
      const matches = content.match(regex);
      if (matches) {
        const existing = this.currentSession!.patterns.find(p => p.name === name);
        if (existing) {
          existing.occurrences++;
          existing.examples.push(context.substring(0, 100));
          existing.reliability = Math.min(1, existing.reliability + 0.05);
        } else {
          this.currentSession!.patterns.push({
            name,
            description: `Pattern detected: ${name}`,
            occurrences: 1,
            examples: [context.substring(0, 100)],
            reliability: 0.5
          });
        }
      }
    });
  }
}

// Export factory function
export function createSessionMemory(projectPath: string): SessionMemoryManager {
  return new SessionMemoryManager(projectPath);
}
