/**
 * Semantic Quality Analyzer
 * Evaluates document quality based on content meaning and structure, not just keywords
 */

export interface Section {
  title: string;
  content: string;
  level: number; // 1 for #, 2 for ##, etc.
  wordCount: number;
  hasExamples: boolean;
  hasNumbers: boolean;
  subsections: Section[];
}

export interface SectionScore {
  sectionName: string;
  exists: boolean;
  quality: number; // 0-100
  depth: number; // 0-100
  specificity: number; // 0-100
  feedback: string;
}

export interface SemanticAnalysisResult {
  totalScore: number;
  sectionScores: SectionScore[];
  contentDepth: number;
  specificity: number;
  coherence: number;
  completeness: number;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
}

export class SemanticQualityAnalyzer {
  
  /**
   * Main analysis function that evaluates content semantically
   */
  analyze(content: string, phase: 'spec' | 'plan' | 'tasks' | 'implement'): SemanticAnalysisResult {
    const sections = this.extractSections(content);
    const requiredSections = this.getRequiredSections(phase);
    
    // Evaluate each required section
    const sectionScores = this.evaluateSections(sections, requiredSections, phase);
    
    // Analyze overall content quality
    const contentDepth = this.analyzeContentDepth(sections);
    const specificity = this.analyzeSpecificity(content);
    const coherence = this.analyzeCoherence(sections);
    const completeness = this.analyzeCompleteness(sectionScores);
    
    // Calculate total score (weighted average)
    const totalScore = this.calculateTotalScore({
      sectionScores,
      contentDepth,
      specificity,
      coherence,
      completeness
    });
    
    // Generate feedback
    const { strengths, improvements } = this.generateFeedback({
      sectionScores,
      contentDepth,
      specificity,
      coherence,
      completeness
    });
    
    return {
      totalScore,
      sectionScores,
      contentDepth,
      specificity,
      coherence,
      completeness,
      strengths,
      improvements,
      detailedFeedback: this.formatDetailedFeedback({
        totalScore,
        sectionScores,
        strengths,
        improvements
      })
    };
  }
  
  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): Section[] {
    const lines = content.split('\n');
    const sections: Section[] = [];
    const sectionStack: { section: Section; level: number }[] = [];
    
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      
      if (headerMatch) {
        // Save previous section content if exists
        if (sectionStack.length > 0) {
          const current = sectionStack[sectionStack.length - 1];
          if (current) {
            current.section.content = currentContent.join('\n').trim();
            current.section.wordCount = this.countWords(current.section.content);
            current.section.hasExamples = this.checkForExamples(current.section.content);
            current.section.hasNumbers = this.checkForNumbers(current.section.content);
          }
        }
        
        // Create new section
        const level = headerMatch[1]?.length || 1;
        const title = headerMatch[2]?.trim() || '';
        const newSection: Section = {
          title,
          content: '',
          level,
          wordCount: 0,
          hasExamples: false,
          hasNumbers: false,
          subsections: []
        };
        
        // Pop sections from stack that are same or lower level
        while (sectionStack.length > 0) {
          const lastItem = sectionStack[sectionStack.length - 1];
          if (lastItem && lastItem.level >= level) {
            sectionStack.pop();
          } else {
            break;
          }
        }
        
        // Add to parent or root
        if (sectionStack.length === 0) {
          sections.push(newSection);
        } else {
          const parent = sectionStack[sectionStack.length - 1];
          if (parent) {
            parent.section.subsections.push(newSection);
          }
        }
        
        sectionStack.push({ section: newSection, level });
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    // Save last section content
    if (sectionStack.length > 0) {
      const current = sectionStack[sectionStack.length - 1];
      if (current) {
        current.section.content = currentContent.join('\n').trim();
        current.section.wordCount = this.countWords(current.section.content);
        current.section.hasExamples = this.checkForExamples(current.section.content);
        current.section.hasNumbers = this.checkForNumbers(current.section.content);
      }
    }
    
    return sections;
  }
  
  /**
   * Get required sections for each phase
   */
  private getRequiredSections(phase: string): string[] {
    const requirements: Record<string, string[]> = {
      spec: [
        'overview|introduction|background',
        'users?|target audience|personas?',
        'problems?|pain points?|challenges?',
        'goals?|objectives?|purpose',
        'requirements?|features?|functionality',
        'success criteria|metrics|kpis?',
        'constraints?|limitations?|assumptions?'
      ],
      plan: [
        'architecture|system design|overview',
        'tech(?:nology)? stack|technologies',
        'database|data model|storage',
        'api|interfaces?|endpoints?',
        'security|authentication|authorization',
        'testing strategy|test plan',
        'deployment|infrastructure'
      ],
      tasks: [
        'overview|summary|introduction',
        'task breakdown|work breakdown|tasks',
        'dependencies|prerequisites',
        'timeline|schedule|milestones',
        'testing approach|tdd strategy',
        'risk assessment|risks'
      ],
      implement: [
        'overview|introduction',
        'test cases|test scenarios',
        'implementation guide|coding standards',
        'integration plan|integration strategy',
        'deployment guide|deployment steps',
        'monitoring|observability'
      ]
    };
    
    return requirements[phase] || requirements.spec || [];
  }
  
  /**
   * Evaluate sections against requirements
   */
  private evaluateSections(
    sections: Section[], 
    requiredPatterns: string[], 
    _phase: string
  ): SectionScore[] {
    const scores: SectionScore[] = [];
    
    for (const pattern of requiredPatterns) {
      const regex = new RegExp(pattern, 'i');
      const foundSection = this.findSection(sections, regex);
      
      if (foundSection) {
        const quality = this.evaluateSectionQuality(foundSection);
        const depth = this.evaluateSectionDepth(foundSection);
        const specificity = this.evaluateSectionSpecificity(foundSection);
        
        scores.push({
          sectionName: pattern.split('|')[0]?.replace(/[?\\]/g, '') || pattern,
          exists: true,
          quality,
          depth,
          specificity,
          feedback: this.generateSectionFeedback(foundSection, quality, depth, specificity)
        });
      } else {
        scores.push({
          sectionName: pattern.split('|')[0]?.replace(/[?\\]/g, '') || pattern,
          exists: false,
          quality: 0,
          depth: 0,
          specificity: 0,
          feedback: `Missing section: Consider adding a "${pattern.split('|')[0]}" section`
        });
      }
    }
    
    return scores;
  }
  
  /**
   * Find section by pattern (recursive)
   */
  private findSection(sections: Section[], pattern: RegExp): Section | null {
    for (const section of sections) {
      if (pattern.test(section.title)) {
        return section;
      }
      const found = this.findSection(section.subsections, pattern);
      if (found) return found;
    }
    return null;
  }
  
  /**
   * Evaluate quality of a section
   */
  private evaluateSectionQuality(section: Section): number {
    let score = 0;
    
    // Word count (30 points)
    if (section.wordCount >= 100) score += 30;
    else if (section.wordCount >= 50) score += 20;
    else if (section.wordCount >= 25) score += 10;
    
    // Has subsections (20 points)
    if (section.subsections.length > 0) score += 20;
    
    // Has examples (25 points)
    if (section.hasExamples) score += 25;
    
    // Has specific numbers/metrics (25 points)
    if (section.hasNumbers) score += 25;
    
    return Math.min(score, 100);
  }
  
  /**
   * Evaluate depth of content
   */
  private evaluateSectionDepth(section: Section): number {
    let score = 0;
    
    // Base score for content length
    const words = section.wordCount;
    if (words >= 200) score += 40;
    else if (words >= 100) score += 30;
    else if (words >= 50) score += 20;
    else score += Math.floor(words / 5);
    
    // Subsection depth
    const maxDepth = this.getMaxDepth(section);
    score += Math.min(maxDepth * 15, 30);
    
    // Content variety (bullet points, code blocks, etc.)
    const hasLists = /^[\s]*[-*+•]\s/m.test(section.content);
    const hasCode = /```[\s\S]*```/.test(section.content);
    const hasTables = /\|.*\|/.test(section.content);
    
    if (hasLists) score += 10;
    if (hasCode) score += 10;
    if (hasTables) score += 10;
    
    return Math.min(score, 100);
  }
  
  /**
   * Evaluate specificity of content
   */
  private evaluateSectionSpecificity(section: Section): number {
    let score = 0;
    const content = section.content.toLowerCase();
    
    // Check for specific indicators
    const specificIndicators = [
      /\d+\s*(hours?|days?|weeks?|months?)/,  // Time estimates
      /\d+\s*(%|percent)/,                     // Percentages
      /\$\d+|\d+\s*(usd|dollars?)/,           // Money
      /\d+\s*(users?|customers?|clients?)/,    // User counts
      /version\s*\d+/,                         // Versions
      /"[^"]{10,}"/,                           // Quoted examples
      /for example|e\.g\.|such as|including/,  // Example indicators
      /specifically|exactly|precisely/,        // Precision words
    ];
    
    let matchCount = 0;
    for (const indicator of specificIndicators) {
      if (indicator.test(content)) {
        matchCount++;
      }
    }
    
    score = Math.min(matchCount * 12.5, 100);
    
    return score;
  }
  
  /**
   * Get maximum depth of section tree
   */
  private getMaxDepth(section: Section, currentDepth = 0): number {
    if (section.subsections.length === 0) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    for (const subsection of section.subsections) {
      const depth = this.getMaxDepth(subsection, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }
  
  /**
   * Analyze overall content depth
   */
  private analyzeContentDepth(sections: Section[]): number {
    if (sections.length === 0) return 0;
    
    const totalWords = this.getTotalWordCount(sections);
    const totalSections = this.getTotalSectionCount(sections);
    // const avgWordsPerSection = totalWords / Math.max(totalSections, 1); // Reserved for future use
    const maxDepth = Math.max(...sections.map(s => this.getMaxDepth(s)));
    
    let score = 0;
    
    // Total content volume (40 points)
    if (totalWords >= 1000) score += 40;
    else if (totalWords >= 500) score += 30;
    else if (totalWords >= 250) score += 20;
    else score += Math.floor(totalWords / 25);
    
    // Section organization (30 points)
    if (totalSections >= 7) score += 30;
    else if (totalSections >= 5) score += 20;
    else if (totalSections >= 3) score += 10;
    
    // Depth of structure (30 points)
    score += Math.min(maxDepth * 10, 30);
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze content specificity
   */
  private analyzeSpecificity(content: string): number {
    const lower = content.toLowerCase();
    let score = 0;
    
    // Count specific elements
    const numbers = (content.match(/\d+/g) || []).length;
    const quotes = (content.match(/"[^"]+"/g) || []).length;
    const examples = (lower.match(/for example|e\.g\.|such as|like|including/g) || []).length;
    const lists = (content.match(/^[\s]*[-*+•]\s/gm) || []).length;
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    
    // Weight each element
    score += Math.min(numbers * 2, 30);      // Numbers (up to 30 points)
    score += Math.min(quotes * 5, 20);       // Quotes (up to 20 points)
    score += Math.min(examples * 5, 20);     // Examples (up to 20 points)
    score += Math.min(lists, 15);            // Lists (up to 15 points)
    score += Math.min(codeBlocks * 5, 15);   // Code blocks (up to 15 points)
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze document coherence
   */
  private analyzeCoherence(sections: Section[]): number {
    if (sections.length === 0) return 0;
    
    let score = 0;
    
    // Check logical flow (sections in expected order)
    const hasLogicalFlow = this.checkLogicalFlow(sections);
    if (hasLogicalFlow) score += 40;
    
    // Check cross-references
    const hasCrossReferences = this.checkCrossReferences(sections);
    if (hasCrossReferences) score += 30;
    
    // Check consistency in terminology
    const terminologyConsistency = this.checkTerminologyConsistency(sections);
    score += Math.floor(terminologyConsistency * 30);
    
    return Math.min(score, 100);
  }
  
  /**
   * Check logical flow of sections
   */
  private checkLogicalFlow(sections: Section[]): boolean {
    // Define expected patterns for logical flow
    const expectedPatterns = [
      ['introduction', 'overview', 'background'],
      ['problem', 'solution', 'benefits'],
      ['requirements', 'design', 'implementation'],
      ['goals', 'approach', 'outcomes']
    ];
    
    const sectionTitles = sections.map(s => s.title.toLowerCase());
    
    for (const pattern of expectedPatterns) {
      let lastIndex = -1;
      let matchCount = 0;
      
      for (const expected of pattern) {
        const index = sectionTitles.findIndex(title => title.includes(expected));
        if (index > lastIndex) {
          matchCount++;
          lastIndex = index;
        }
      }
      
      if (matchCount >= 2) return true;
    }
    
    return sections.length >= 3; // At least has multiple sections
  }
  
  /**
   * Check for cross-references between sections
   */
  private checkCrossReferences(sections: Section[]): boolean {
    const allContent = sections.map(s => s.content).join(' ').toLowerCase();
    
    const referencePatterns = [
      /as mentioned/,
      /see section/,
      /described above/,
      /described below/,
      /previously discussed/,
      /following section/,
      /next section/,
      /prior section/
    ];
    
    for (const pattern of referencePatterns) {
      if (pattern.test(allContent)) return true;
    }
    
    return false;
  }
  
  /**
   * Check terminology consistency
   */
  private checkTerminologyConsistency(sections: Section[]): number {
    const allContent = sections.map(s => s.content).join(' ');
    
    // Common term variations to check
    const termVariations = [
      ['user', 'users', 'customer', 'customers', 'client', 'clients'],
      ['system', 'application', 'app', 'software', 'platform'],
      ['feature', 'functionality', 'capability', 'function'],
      ['requirement', 'requirements', 'need', 'needs']
    ];
    
    let consistencyScore = 0;
    
    for (const variations of termVariations) {
      const counts = variations.map(term => 
        (allContent.match(new RegExp(`\\b${term}\\b`, 'gi')) || []).length
      );
      
      const totalUsage = counts.reduce((a, b) => a + b, 0);
      if (totalUsage === 0) continue;
      
      const maxUsage = Math.max(...counts);
      const consistency = maxUsage / totalUsage;
      
      consistencyScore += consistency;
    }
    
    return consistencyScore / termVariations.length;
  }
  
  /**
   * Analyze completeness based on section scores
   */
  private analyzeCompleteness(sectionScores: SectionScore[]): number {
    if (sectionScores.length === 0) return 0;
    
    const existingCount = sectionScores.filter(s => s.exists).length;
    const totalRequired = sectionScores.length;
    const existenceRatio = existingCount / totalRequired;
    
    const avgQuality = sectionScores
      .filter(s => s.exists)
      .reduce((sum, s) => sum + s.quality, 0) / Math.max(existingCount, 1);
    
    // Weight: 60% for existence, 40% for quality
    const score = (existenceRatio * 60) + (avgQuality * 0.4);
    
    return Math.min(score, 100);
  }
  
  /**
   * Calculate total score with weights
   */
  private calculateTotalScore(metrics: {
    sectionScores: SectionScore[];
    contentDepth: number;
    specificity: number;
    coherence: number;
    completeness: number;
  }): number {
    const { sectionScores, contentDepth, specificity, coherence, completeness } = metrics;
    
    // Calculate average section score
    const avgSectionScore = sectionScores.length > 0
      ? sectionScores.reduce((sum, s) => sum + (s.quality * 0.4 + s.depth * 0.3 + s.specificity * 0.3), 0) / sectionScores.length
      : 0;
    
    // Weighted calculation
    const weights = {
      sections: 0.35,      // 35% - Section presence and quality
      depth: 0.20,         // 20% - Content depth
      specificity: 0.20,   // 20% - Specificity and examples
      coherence: 0.15,     // 15% - Document coherence
      completeness: 0.10   // 10% - Overall completeness
    };
    
    const totalScore = 
      avgSectionScore * weights.sections +
      contentDepth * weights.depth +
      specificity * weights.specificity +
      coherence * weights.coherence +
      completeness * weights.completeness;
    
    return Math.round(Math.min(totalScore, 100));
  }
  
  /**
   * Generate feedback based on analysis
   */
  private generateFeedback(metrics: any): { strengths: string[]; improvements: string[] } {
    const strengths: string[] = [];
    const improvements: string[] = [];
    
    // Analyze section scores
    const missingSections = metrics.sectionScores.filter((s: SectionScore) => !s.exists);
    const weakSections = metrics.sectionScores.filter((s: SectionScore) => s.exists && s.quality < 50);
    const strongSections = metrics.sectionScores.filter((s: SectionScore) => s.quality >= 80);
    
    // Strengths
    if (strongSections.length > 0) {
      strengths.push(`Strong sections: ${strongSections.map((s: SectionScore) => s.sectionName).join(', ')}`); 
    }
    if (metrics.contentDepth >= 70) {
      strengths.push('Comprehensive content depth with good structure');
    }
    if (metrics.specificity >= 70) {
      strengths.push('Excellent use of specific examples and metrics');
    }
    if (metrics.coherence >= 80) {
      strengths.push('Well-organized document with logical flow');
    }
    
    // Improvements
    if (missingSections.length > 0) {
      improvements.push(`Add missing sections: ${missingSections.map((s: SectionScore) => s.sectionName).join(', ')}`); 
    }
    if (weakSections.length > 0) {
      improvements.push(`Expand weak sections: ${weakSections.map((s: SectionScore) => s.sectionName).join(', ')}`); 
    }
    if (metrics.contentDepth < 50) {
      improvements.push('Add more detail and depth to existing sections');
    }
    if (metrics.specificity < 50) {
      improvements.push('Include specific examples, numbers, and concrete details');
    }
    if (metrics.coherence < 50) {
      improvements.push('Improve document organization and logical flow');
    }
    
    return { strengths, improvements };
  }
  
  /**
   * Format detailed feedback
   */
  private formatDetailedFeedback(data: any): string {
    let feedback = `## 📊 Semantic Quality Analysis\n\n`;
    feedback += `**Total Score: ${data.totalScore}/100**\n\n`;
    
    feedback += `### 📋 Section Analysis\n\n`;
    for (const section of data.sectionScores) {
      const icon = section.exists ? (section.quality >= 70 ? '✅' : '⚠️') : '❌';
      feedback += `${icon} **${section.sectionName}**: `;
      if (section.exists) {
        feedback += `Quality ${section.quality}/100, Depth ${section.depth}/100, Specificity ${section.specificity}/100\n`;
        feedback += `   ${section.feedback}\n`;
      } else {
        feedback += `Missing - ${section.feedback}\n`;
      }
    }
    
    if (data.strengths.length > 0) {
      feedback += `\n### 💪 Strengths\n`;
      data.strengths.forEach((s: string) => feedback += `- ${s}\n`);
    }
    
    if (data.improvements.length > 0) {
      feedback += `\n### 🎯 Areas for Improvement\n`;
      data.improvements.forEach((i: string) => feedback += `- ${i}\n`);
    }
    
    return feedback;
  }
  
  /**
   * Generate section-specific feedback
   */
  private generateSectionFeedback(section: Section, quality: number, _depth: number, specificity: number): string {
    const feedbacks: string[] = [];
    
    if (quality < 50) {
      if (section.wordCount < 50) {
        feedbacks.push('Expand with more detail (aim for 100+ words)');
      }
      if (!section.hasExamples) {
        feedbacks.push('Add concrete examples');
      }
      if (!section.hasNumbers) {
        feedbacks.push('Include specific metrics or numbers');
      }
    } else if (quality < 80) {
      if (!section.subsections.length) {
        feedbacks.push('Consider breaking into subsections');
      }
      if (specificity < 70) {
        feedbacks.push('Add more specific details');
      }
    } else {
      feedbacks.push('Well-developed section');
    }
    
    return feedbacks.join('; ');
  }
  
  // Utility methods
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  private getTotalWordCount(sections: Section[]): number {
    let total = 0;
    for (const section of sections) {
      total += section.wordCount;
      total += this.getTotalWordCount(section.subsections);
    }
    return total;
  }
  
  private getTotalSectionCount(sections: Section[]): number {
    let total = sections.length;
    for (const section of sections) {
      total += this.getTotalSectionCount(section.subsections);
    }
    return total;
  }
  
  private checkForExamples(content: string): boolean {
    const exampleIndicators = [
      /for example/i,
      /e\.g\./i,
      /such as/i,
      /for instance/i,
      /like\s+\w+/i,
      /including/i,
      /"[^"]{20,}"/,  // Long quotes often are examples
      /```[\s\S]+```/  // Code blocks are examples
    ];
    
    return exampleIndicators.some(pattern => pattern.test(content));
  }
  
  private checkForNumbers(content: string): boolean {
    const numberIndicators = [
      /\d+/,                               // Any number
      /\d+\s*%/,                          // Percentages
      /\$\d+/,                            // Money
      /\d+\s*(hours?|days?|weeks?)/,     // Time
      /\d+\s*(users?|customers?)/,       // Counts
      /version\s*\d+/                     // Versions
    ];
    
    return numberIndicators.some(pattern => pattern.test(content));
  }
}
