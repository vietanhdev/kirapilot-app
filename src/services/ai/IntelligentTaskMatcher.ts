// Intelligent task matching service with fuzzy matching and natural language processing

import { Task, TaskStatus } from '../../types';
import {
  TaskMatchResult,
  TaskMatchQuery,
  TaskMatchContext,
  MatchType,
  UserIntent,
  MatchingWeights,
  DEFAULT_MATCHING_WEIGHTS,
  TASK_IDENTIFICATION_PATTERNS,
} from '../../types/taskMatching';
import { getTaskRepository } from '../database/repositories';
import {
  getPerformanceMonitor,
  PerformanceMonitor,
} from './PerformanceMonitor';

export class IntelligentTaskMatcher {
  private taskRepository = getTaskRepository();
  private weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS;
  private performanceMonitor: PerformanceMonitor = getPerformanceMonitor();

  /**
   * Find tasks matching a natural language query
   */
  async findTasksByDescription(
    query: string,
    context?: TaskMatchContext
  ): Promise<TaskMatchResult[]> {
    const operationId = `task-match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.performanceMonitor.startOperation(operationId, {
      type: 'task_matching',
      queryLength: query.length,
      hasContext: !!context,
    });

    try {
      const matchQuery: TaskMatchQuery = {
        query,
        context,
        maxResults: 10,
        minConfidence: 0.3,
      };

      const result = await this.matchTasks(matchQuery);

      // End performance monitoring - success
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        additionalMetrics: {
          tasks_processed: result.length,
          matches_found: result.length,
          highest_confidence: result.length > 0 ? result[0].confidence : 0,
        },
      });

      return result;
    } catch (error) {
      // End performance monitoring - error
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract task reference and intent from natural language
   */
  extractTaskReference(
    input: string
  ): { taskReference: string; intent: UserIntent; confidence: number } | null {
    for (const pattern of TASK_IDENTIFICATION_PATTERNS) {
      const match = input.match(pattern.pattern);
      if (match) {
        return {
          taskReference: pattern.extractTaskReference(match),
          intent: pattern.intent,
          confidence: pattern.confidence,
        };
      }
    }
    return null;
  }

  /**
   * Main task matching method
   */
  async matchTasks(query: TaskMatchQuery): Promise<TaskMatchResult[]> {
    // Get all available tasks (could be optimized with better filtering)
    const allTasks = await this.taskRepository.findAll();

    // Filter out completed and cancelled tasks unless specifically looking for them
    const activeTasks = allTasks.filter(
      task =>
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED
    );

    const results: TaskMatchResult[] = [];

    // Try different matching strategies
    for (const task of activeTasks) {
      const matchResults = this.scoreTask(task, query);
      if (matchResults.length > 0) {
        results.push(...matchResults);
      }
    }

    // Sort by confidence score (descending)
    results.sort((a, b) => b.confidence - a.confidence);

    // Filter by minimum confidence and max results
    const filtered = results
      .filter(result => result.confidence >= (query.minConfidence || 0.3))
      .slice(0, query.maxResults || 10);

    // Add alternatives for low-confidence matches
    return this.addAlternatives(filtered, results);
  }

  /**
   * Score a single task against the query
   */
  private scoreTask(task: Task, query: TaskMatchQuery): TaskMatchResult[] {
    const results: TaskMatchResult[] = [];
    const queryLower = query.query.toLowerCase().trim();

    // Exact title match
    if (task.title.toLowerCase() === queryLower) {
      results.push({
        task,
        confidence: 100,
        matchReason: 'Exact title match',
        matchType: MatchType.EXACT_TITLE,
      });
    }

    // Fuzzy title match (check for word matches too)
    const titleScore = this.calculateFuzzyScore(task.title, query.query);
    const wordMatchScore = this.calculateWordMatchScore(
      task.title,
      query.query
    );
    const bestTitleScore = Math.max(titleScore, wordMatchScore);

    if (bestTitleScore > 0.3) {
      results.push({
        task,
        confidence: Math.round(bestTitleScore * 100 * this.weights.fuzzyTitle),
        matchReason: `Title similarity: ${Math.round(bestTitleScore * 100)}%`,
        matchType: MatchType.FUZZY_TITLE,
      });
    }

    // Description match
    if (task.description) {
      const descScore = this.calculateFuzzyScore(task.description, query.query);
      const descWordScore = this.calculateWordMatchScore(
        task.description,
        query.query
      );
      const bestDescScore = Math.max(descScore, descWordScore);

      if (bestDescScore > 0.3) {
        results.push({
          task,
          confidence: Math.round(
            bestDescScore * 100 * this.weights.description
          ),
          matchReason: `Description contains similar text: ${Math.round(bestDescScore * 100)}%`,
          matchType: MatchType.DESCRIPTION_MATCH,
        });
      }
    }

    // Tag match
    if (task.tags && Array.isArray(task.tags)) {
      for (const tag of task.tags) {
        const tagScore = this.calculateFuzzyScore(tag, query.query);
        if (tagScore > 0.6) {
          results.push({
            task,
            confidence: Math.round(tagScore * 100 * this.weights.tags),
            matchReason: `Tag match: "${tag}"`,
            matchType: MatchType.TAG_MATCH,
          });
        }
      }
    }

    // Contextual matching - boost existing matches if contextually relevant
    if (query.context && results.length > 0) {
      const contextScore = this.calculateContextualScore(task, query.context);
      if (contextScore > 0.5) {
        // Create a contextual match that boosts the best existing match
        const bestExisting = results.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        results.push({
          task,
          confidence: Math.min(
            100,
            Math.round(bestExisting.confidence + contextScore * 30)
          ),
          matchReason: 'Contextually relevant',
          matchType: MatchType.CONTEXTUAL,
        });
      }
    }

    // Return only the best match for this task
    if (results.length > 0) {
      const bestMatch = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      return [bestMatch];
    }

    return [];
  }

  /**
   * Calculate word-based matching score
   */
  private calculateWordMatchScore(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const word2 of words2) {
      for (const word1 of words1) {
        if (
          word1.includes(word2) ||
          word2.includes(word1) ||
          this.calculateFuzzyScore(word1, word2) > 0.7
        ) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / Math.max(words1.length, words2.length);
  }

  /**
   * Calculate fuzzy string similarity score using Levenshtein distance
   */
  private calculateFuzzyScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) {
      return 1.0;
    }
    if (s1.length === 0 || s2.length === 0) {
      return 0.0;
    }

    // Check for substring matches
    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      // Give higher score for substring matches
      return Math.max(0.6, shorter.length / longer.length);
    }

    // Calculate Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calculate contextual relevance score
   */
  private calculateContextualScore(
    task: Task,
    context: TaskMatchContext
  ): number {
    let score = 0;

    // Boost score if task is current task
    if (context.currentTask && context.currentTask.id === task.id) {
      score += 0.8;
    }

    // Boost score if task is in recent tasks
    if (context.recentTasks) {
      const isRecent = context.recentTasks.some(
        recentTask => recentTask.id === task.id
      );
      if (isRecent) {
        score += 0.6;
      }
    }

    // Apply filter context
    if (context.activeFilters) {
      const filters = context.activeFilters;

      if (filters.status && filters.status.includes(task.status)) {
        score += 0.3;
      }

      if (filters.priority && filters.priority.includes(task.priority)) {
        score += 0.2;
      }

      if (filters.tags && filters.tags.some(tag => task.tags.includes(tag))) {
        score += 0.4;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Add alternative suggestions for ambiguous matches
   */
  private addAlternatives(
    filtered: TaskMatchResult[],
    allResults: TaskMatchResult[]
  ): TaskMatchResult[] {
    return filtered.map(result => {
      // If confidence is below 80%, add alternatives
      if (result.confidence < 80) {
        const alternatives = allResults
          .filter(
            r =>
              r.task.id !== result.task.id &&
              r.confidence >= 30 &&
              r.confidence < result.confidence
          )
          .slice(0, 3)
          .map(r => r.task);

        if (alternatives.length > 0) {
          return { ...result, alternatives };
        }
      }
      return result;
    });
  }

  /**
   * Suggest tasks based on current context
   */
  async suggestTasksForContext(context: TaskMatchContext): Promise<Task[]> {
    const allTasks = await this.taskRepository.findAll();
    const activeTasks = allTasks.filter(
      task =>
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED
    );

    // Score tasks based on context
    const scoredTasks = activeTasks.map(task => ({
      task,
      score: this.calculateContextualScore(task, context),
    }));

    // Sort by score and return top suggestions
    return scoredTasks
      .filter(item => item.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.task);
  }

  /**
   * Resolve ambiguous task reference with user input
   */
  async resolveAmbiguousReference(
    _query: string,
    candidates: Task[]
  ): Promise<Task | null> {
    // This method would typically show a UI dialog
    // For now, return the first candidate or null
    if (candidates.length === 0) {
      return null;
    }

    // Simple heuristic: prefer tasks with higher priority or more recent updates
    const sorted = candidates.sort((a, b) => {
      // First sort by priority (higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by update time (more recent first)
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return sorted[0];
  }

  /**
   * Update matching weights for personalization
   */
  updateWeights(newWeights: Partial<MatchingWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current matching weights
   */
  getWeights(): MatchingWeights {
    return { ...this.weights };
  }

  /**
   * Search for tasks with natural language query
   */
  async searchTasks(
    query: string,
    context?: TaskMatchContext
  ): Promise<TaskMatchResult[]> {
    // First try to extract task reference and intent
    const extracted = this.extractTaskReference(query);

    if (extracted) {
      // Use the extracted task reference for more focused search
      const matchQuery: TaskMatchQuery = {
        query: extracted.taskReference,
        context: {
          ...context,
          userIntent: extracted.intent,
        },
        maxResults: 5,
        minConfidence: 0.4,
      };

      return this.matchTasks(matchQuery);
    } else {
      // Fall back to general matching
      return this.findTasksByDescription(query, context);
    }
  }
}
