/**
 * Iteration Quality Tracker
 * Tracks meaningful improvements between document versions
 * Solves the "0/1 iterations" problem by measuring quality gains, not just counts
 */

import { diffWords, Change } from 'diff';

export interface ContentDelta {
  additions: string[];
  removals: string[];
  modifications: string[];
  totalAddedWords: number;
  totalRemovedWords: number;
  netWordChange: number;
}

export interface QualityImprovement {
  previousScore: number;
  currentScore: number;
  improvement: number;
  improvementPercentage: number;
  significantImprovement: boolean;
}

export interface FeedbackIncorporation {
  suggestionsProvided: string[];
  suggestionsImplemented: string[];
  incorporationRate: number;
  missedSuggestions: string[];
}

export interface IterationAnalysis {
  iterationNumber: number;
  qualityImprovement: QualityImprovement;
  contentDelta: ContentDelta;
  feedbackIncorporation: FeedbackIncorporation;
  meaningful: boolean;
  summary: string;
  detailedAnalysis: string;
}

export class IterationQualityTracker {
  private iterations: Map<string, IterationAnalysis[]> = new Map();
  // private previousFeedback: Map<string, string[]> = new Map(); // Reserved for future use
  
  /**
   * Track an iteration and analyze improvements
   */
  trackIteration(
    projectId: string,
    oldContent: string,
    newContent: string,
    oldScore: number,
    newScore: number,
    previousSuggestions: string[] = []
  ): IterationAnalysis {
    // Get or create iteration history
    const history = this.iterations.get(projectId) || [];
    const iterationNumber = history.length + 1;
    
    // Analyze content changes
    const contentDelta = this.analyzeContentDelta(oldContent, newContent);
    
    // Analyze quality improvement
    const qualityImprovement = this.analyzeQualityImprovement(oldScore, newScore);
    
    // Analyze feedback incorporation
    const feedbackIncorporation = this.analyzeFeedbackIncorporation(
      newContent,
      previousSuggestions
    );
    
    // Determine if iteration is meaningful
    const meaningful = this.isIterationMeaningful(
      qualityImprovement,
      contentDelta,
      feedbackIncorporation
    );
    
    // Generate summary
    const summary = this.generateIterationSummary(
      iterationNumber,
      qualityImprovement,
      contentDelta,
      feedbackIncorporation,
      meaningful
    );
    
    // Generate detailed analysis
    const detailedAnalysis = this.generateDetailedAnalysis(
      iterationNumber,
      qualityImprovement,
      contentDelta,
      feedbackIncorporation
    );
    
    const analysis: IterationAnalysis = {
      iterationNumber,
      qualityImprovement,
      contentDelta,
      feedbackIncorporation,
      meaningful,
      summary,
      detailedAnalysis
    };
    
    // Store iteration
    history.push(analysis);
    this.iterations.set(projectId, history);
    
    return analysis;
  }
  
  /**
   * Analyze content changes between versions
   */
  private analyzeContentDelta(oldContent: string, newContent: string): ContentDelta {
    // Use diff to find changes
    const changes = diffWords(oldContent, newContent);
    
    const additions: string[] = [];
    const removals: string[] = [];
    const modifications: string[] = [];
    
    let totalAddedWords = 0;
    let totalRemovedWords = 0;
    
    for (const change of changes) {
      if (change.added) {
        additions.push(change.value);
        totalAddedWords += this.countWords(change.value);
      } else if (change.removed) {
        removals.push(change.value);
        totalRemovedWords += this.countWords(change.value);
      }
    }
    
    // Detect modifications (removed + added in same area)
    const modificationPairs = this.detectModifications(changes);
    modifications.push(...modificationPairs);
    
    return {
      additions,
      removals,
      modifications,
      totalAddedWords,
      totalRemovedWords,
      netWordChange: totalAddedWords - totalRemovedWords
    };
  }
  
  /**
   * Analyze quality score improvement
   */
  private analyzeQualityImprovement(oldScore: number, newScore: number): QualityImprovement {
    const improvement = newScore - oldScore;
    const improvementPercentage = oldScore > 0 ? (improvement / oldScore) * 100 : 100;
    const significantImprovement = improvement >= 10 || improvementPercentage >= 15;
    
    return {
      previousScore: oldScore,
      currentScore: newScore,
      improvement,
      improvementPercentage,
      significantImprovement
    };
  }
  
  /**
   * Analyze how well previous feedback was incorporated
   */
  private analyzeFeedbackIncorporation(
    newContent: string,
    previousSuggestions: string[]
  ): FeedbackIncorporation {
    const suggestionsImplemented: string[] = [];
    const missedSuggestions: string[] = [];
    const lowerContent = newContent.toLowerCase();
    
    for (const suggestion of previousSuggestions) {
      // Check if suggestion seems to be addressed
      if (this.isSuggestionImplemented(suggestion, lowerContent)) {
        suggestionsImplemented.push(suggestion);
      } else {
        missedSuggestions.push(suggestion);
      }
    }
    
    const incorporationRate = previousSuggestions.length > 0
      ? (suggestionsImplemented.length / previousSuggestions.length) * 100
      : 0;
    
    return {
      suggestionsProvided: previousSuggestions,
      suggestionsImplemented,
      incorporationRate,
      missedSuggestions
    };
  }
  
  /**
   * Check if a suggestion was implemented
   */
  private isSuggestionImplemented(suggestion: string, content: string): boolean {
    const lower = suggestion.toLowerCase();
    
    // Extract key terms from suggestion
    const keyTerms = this.extractKeyTerms(lower);
    
    // Check if key terms appear in new content
    let matchCount = 0;
    for (const term of keyTerms) {
      if (content.includes(term)) {
        matchCount++;
      }
    }
    
    // Consider implemented if >60% of key terms present
    return keyTerms.length > 0 && (matchCount / keyTerms.length) > 0.6;
  }
  
  /**
   * Extract key terms from a suggestion
   */
  private extractKeyTerms(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'add', 'include', 'consider', 'the', 'a', 'an', 'and', 'or', 'but',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'more', 'section'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    return [...new Set(words)]; // Remove duplicates
  }
  
  /**
   * Determine if iteration is meaningful
   */
  private isIterationMeaningful(
    quality: QualityImprovement,
    content: ContentDelta,
    feedback: FeedbackIncorporation
  ): boolean {
    // Meaningful if any of these conditions are met:
    // 1. Significant quality improvement (10+ points or 15%+)
    if (quality.significantImprovement) return true;
    
    // 2. Substantial content addition (50+ words)
    if (content.totalAddedWords >= 50) return true;
    
    // 3. Good feedback incorporation (60%+)
    if (feedback.incorporationRate >= 60) return true;
    
    // 4. Net positive change with quality improvement
    if (content.netWordChange > 20 && quality.improvement > 0) return true;
    
    return false;
  }
  
  /**
   * Generate iteration summary
   */
  private generateIterationSummary(
    iterationNumber: number,
    quality: QualityImprovement,
    content: ContentDelta,
    feedback: FeedbackIncorporation,
    meaningful: boolean
  ): string {
    if (!meaningful) {
      const qualityChange = quality.improvement >= 0 ? `+${quality.improvement.toFixed(1)}` : quality.improvement.toFixed(1);
      const wordChange = content.netWordChange >= 0 ? `+${content.netWordChange}` : content.netWordChange.toString();
      return `Iteration ${iterationNumber}: Minor revision (${qualityChange} points, ${wordChange} words)`;
    }
    
    const parts: string[] = [`Iteration ${iterationNumber}:`];
    
    if (quality.significantImprovement) {
      parts.push(`Quality ↑${quality.improvement.toFixed(0)}pts (${quality.improvementPercentage.toFixed(0)}%)`);
    }
    
    if (content.netWordChange > 0) {
      parts.push(`Content +${content.totalAddedWords} words`);
    }
    
    if (feedback.incorporationRate > 0) {
      parts.push(`Feedback ${feedback.incorporationRate.toFixed(0)}% incorporated`);
    }
    
    return parts.join(' | ');
  }
  
  /**
   * Generate detailed analysis
   */
  private generateDetailedAnalysis(
    iterationNumber: number,
    quality: QualityImprovement,
    content: ContentDelta,
    feedback: FeedbackIncorporation
  ): string {
    let analysis = `## Iteration ${iterationNumber} Analysis\n\n`;
    
    // Quality improvement section
    analysis += `### 📈 Quality Improvement\n`;
    analysis += `- Previous Score: ${quality.previousScore.toFixed(1)}/100\n`;
    analysis += `- Current Score: ${quality.currentScore.toFixed(1)}/100\n`;
    analysis += `- **Improvement: ${quality.improvement >= 0 ? '+' : ''}${quality.improvement.toFixed(1)} points`;
    analysis += ` (${quality.improvementPercentage >= 0 ? '+' : ''}${quality.improvementPercentage.toFixed(1)}%)**\n`;
    
    if (quality.significantImprovement) {
      analysis += `- ✅ Significant improvement achieved!\n`;
    } else if (quality.improvement > 0) {
      analysis += `- 👍 Positive improvement\n`;
    } else if (quality.improvement === 0) {
      analysis += `- ➖ No change in quality\n`;
    } else {
      analysis += `- ⚠️ Quality decreased - review changes\n`;
    }
    analysis += '\n';
    
    // Content changes section
    analysis += `### 📝 Content Changes\n`;
    analysis += `- Words Added: ${content.totalAddedWords}\n`;
    analysis += `- Words Removed: ${content.totalRemovedWords}\n`;
    analysis += `- Net Change: ${content.netWordChange >= 0 ? '+' : ''}${content.netWordChange} words\n`;
    
    if (content.totalAddedWords > 100) {
      analysis += `- 🎯 Substantial content addition\n`;
    } else if (content.totalAddedWords > 50) {
      analysis += `- 📄 Moderate content addition\n`;
    }
    analysis += '\n';
    
    // Feedback incorporation section
    if (feedback.suggestionsProvided.length > 0) {
      analysis += `### 🎯 Feedback Incorporation\n`;
      analysis += `- Suggestions Provided: ${feedback.suggestionsProvided.length}\n`;
      analysis += `- Suggestions Implemented: ${feedback.suggestionsImplemented.length}\n`;
      analysis += `- **Incorporation Rate: ${feedback.incorporationRate.toFixed(0)}%**\n`;
      
      if (feedback.incorporationRate >= 80) {
        analysis += `- ✅ Excellent feedback incorporation!\n`;
      } else if (feedback.incorporationRate >= 60) {
        analysis += `- 👍 Good feedback incorporation\n`;
      } else if (feedback.incorporationRate >= 40) {
        analysis += `- ⚠️ Partial feedback incorporation\n`;
      } else {
        analysis += `- ❌ Low feedback incorporation - review suggestions\n`;
      }
      
      if (feedback.missedSuggestions.length > 0) {
        analysis += `\n#### Missed Suggestions:\n`;
        feedback.missedSuggestions.forEach(s => {
          analysis += `- ${s}\n`;
        });
      }
    }
    
    return analysis;
  }
  
  /**
   * Detect modifications (paired add/remove)
   */
  private detectModifications(changes: Change[]): string[] {
    const modifications: string[] = [];
    
    for (let i = 0; i < changes.length - 1; i++) {
      if (changes[i]?.removed && changes[i + 1]?.added) {
        const removed = changes[i]?.value || '';
        const added = changes[i + 1]?.value || '';
        
        // Check if they're similar (modification rather than replacement)
        const similarity = this.calculateSimilarity(removed, added);
        if (similarity > 0.3) {
          modifications.push(`Modified: "${removed.substring(0, 50)}..." → "${added.substring(0, 50)}..."`);
        }
      }
    }
    
    return modifications;
  }
  
  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  /**
   * Get iteration history for a project
   */
  getIterationHistory(projectId: string): IterationAnalysis[] {
    return this.iterations.get(projectId) || [];
  }
  
  /**
   * Get meaningful iteration count
   */
  getMeaningfulIterationCount(projectId: string): number {
    const history = this.getIterationHistory(projectId);
    return history.filter(iter => iter.meaningful).length;
  }
  
  /**
   * Get total quality improvement
   */
  getTotalQualityImprovement(projectId: string): number {
    const history = this.getIterationHistory(projectId);
    if (history.length === 0) return 0;
    
    const first = history[0];
    const last = history[history.length - 1];
    
    if (!first || !last) return 0;
    
    const firstScore = first.qualityImprovement.previousScore;
    const lastScore = last.qualityImprovement.currentScore;
    
    return lastScore - firstScore;
  }
  
  /**
   * Generate iteration report
   */
  generateIterationReport(projectId: string): string {
    const history = this.getIterationHistory(projectId);
    
    if (history.length === 0) {
      return 'No iterations recorded yet.';
    }
    
    let report = `# Iteration History Report\n\n`;
    report += `**Total Iterations**: ${history.length}\n`;
    report += `**Meaningful Iterations**: ${this.getMeaningfulIterationCount(projectId)}\n`;
    report += `**Total Quality Improvement**: +${this.getTotalQualityImprovement(projectId).toFixed(1)} points\n\n`;
    
    report += `## Iteration Timeline\n\n`;
    history.forEach(iter => {
      const icon = iter.meaningful ? '✅' : '○';
      report += `${icon} **${iter.summary}**\n`;
      if (iter.meaningful) {
        report += `   Quality: ${iter.qualityImprovement.previousScore.toFixed(0)} → ${iter.qualityImprovement.currentScore.toFixed(0)} | `;
        report += `Content: +${iter.contentDelta.totalAddedWords} words | `;
        report += `Feedback: ${iter.feedbackIncorporation.incorporationRate.toFixed(0)}%\n`;
      }
      report += '\n';
    });
    
    return report;
  }
}
