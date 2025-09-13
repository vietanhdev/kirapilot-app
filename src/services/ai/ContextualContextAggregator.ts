// Contextual Context Aggregator for enhanced AI interactions

import {
  AppContext,
  Priority,
  TaskStatus,
  Task,
  TimerSession,
} from '../../types';
import {
  EnhancedAppContext,
  WorkflowState,
  ProductivityMetrics,
  UserPattern,
  ContextualInsight,
  EnvironmentalFactors,
  ContextRelevanceScore,
  AIUserIntent,
  ContextAggregationConfig,
  ContextAggregationResult,
  TaskDeadline,
  WorkflowStreak,
} from '../../types/enhancedContext';
import { getTaskRepository } from '../database/repositories';

export class ContextualContextAggregator {
  private config: ContextAggregationConfig;
  private cache: Map<string, { data: EnhancedAppContext; timestamp: number }>;
  private taskRepository: ReturnType<typeof getTaskRepository>;

  constructor(config: Partial<ContextAggregationConfig> = {}) {
    this.config = {
      includeHistoricalData: true,
      historicalDataDays: 7,
      patternAnalysisDepth: 'medium',
      environmentalDataSources: ['system', 'time'],
      privacyLevel: 'standard',
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes
      ...config,
    };
    this.cache = new Map();
    this.taskRepository = getTaskRepository();
  }

  /**
   * Build enhanced context from basic AppContext
   */
  async buildEnhancedContext(
    baseContext: AppContext,
    userMessage: string,
    _conversationHistory: unknown[] = []
  ): Promise<ContextAggregationResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(baseContext, userMessage);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedContext(cacheKey);
      if (cached) {
        return {
          enhancedContext: cached,
          relevanceScore: await this.analyzeContextRelevance(
            cached,
            this.extractUserIntent(userMessage)
          ),
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['cache'],
          cacheHit: true,
          warnings: [],
        };
      }
    }

    const warnings: string[] = [];
    const dataSourcesUsed: string[] = ['base_context'];

    try {
      // Build enhanced context components
      const [
        workflowState,
        productivityMetrics,
        recentPatterns,
        contextualInsights,
        environmentalFactors,
      ] = await Promise.all([
        this.buildWorkflowState(baseContext),
        this.buildProductivityMetrics(baseContext),
        this.analyzeRecentPatterns(baseContext),
        this.generateContextualInsights(baseContext),
        this.gatherEnvironmentalFactors(baseContext),
      ]);

      dataSourcesUsed.push(
        'workflow',
        'productivity',
        'patterns',
        'insights',
        'environment'
      );

      const enhancedContext: EnhancedAppContext = {
        ...baseContext,
        workflowState,
        productivityMetrics,
        recentPatterns,
        contextualInsights,
        environmentalFactors,
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setCachedContext(cacheKey, enhancedContext);
      }

      const userIntent = this.extractUserIntent(userMessage);
      const relevanceScore = await this.analyzeContextRelevance(
        enhancedContext,
        userIntent
      );

      return {
        enhancedContext,
        relevanceScore,
        processingTime: Date.now() - startTime,
        dataSourcesUsed,
        cacheHit: false,
        warnings,
      };
    } catch (error) {
      warnings.push(
        `Context aggregation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Return basic enhanced context on error
      const fallbackContext: EnhancedAppContext = {
        ...baseContext,
        workflowState: this.getDefaultWorkflowState(),
        productivityMetrics: this.getDefaultProductivityMetrics(),
        recentPatterns: [],
        contextualInsights: [],
        environmentalFactors: this.getBasicEnvironmentalFactors(),
      };

      return {
        enhancedContext: fallbackContext,
        relevanceScore: await this.analyzeContextRelevance(
          fallbackContext,
          this.extractUserIntent(userMessage)
        ),
        processingTime: Date.now() - startTime,
        dataSourcesUsed: ['fallback'],
        cacheHit: false,
        warnings,
      };
    }
  }

  /**
   * Analyze context relevance for current interaction
   */
  async analyzeContextRelevance(
    context: EnhancedAppContext,
    intent: AIUserIntent
  ): Promise<ContextRelevanceScore> {
    const scores = {
      workflowState: this.scoreWorkflowRelevance(context.workflowState, intent),
      productivityMetrics: this.scoreProductivityRelevance(
        context.productivityMetrics,
        intent
      ),
      recentPatterns: this.scorePatternsRelevance(
        context.recentPatterns,
        intent
      ),
      environmentalFactors: this.scoreEnvironmentalRelevance(
        context.environmentalFactors,
        intent
      ),
      contextualInsights: this.scoreInsightsRelevance(
        context.contextualInsights,
        intent
      ),
    };

    // Calculate weighted overall score
    const weights = {
      workflowState: 0.25,
      productivityMetrics: 0.2,
      recentPatterns: 0.2,
      environmentalFactors: 0.15,
      contextualInsights: 0.2,
    };

    const overall = Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * weights[key as keyof typeof weights],
      0
    );

    const reasoning: string[] = [];
    const criticalFactors: string[] = [];

    // Generate reasoning based on scores
    if (scores.workflowState > 0.7) {
      reasoning.push(
        'Current workflow state is highly relevant to user intent'
      );
      criticalFactors.push('workflow_state');
    }
    if (scores.productivityMetrics > 0.7) {
      reasoning.push('Productivity metrics provide important context');
      criticalFactors.push('productivity_metrics');
    }
    if (scores.recentPatterns > 0.7) {
      reasoning.push('Recent patterns strongly inform the response');
      criticalFactors.push('recent_patterns');
    }

    return {
      overall,
      breakdown: scores,
      reasoning,
      criticalFactors,
    };
  }

  /**
   * Build workflow state from current context
   */
  private async buildWorkflowState(
    context: AppContext
  ): Promise<WorkflowState> {
    const currentPhase = this.determineWorkflowPhase(context);
    const focusLevel = this.calculateFocusLevel(context);
    const workloadIntensity = await this.assessWorkloadIntensity(context);
    const upcomingDeadlines = await this.getUpcomingDeadlines();
    const recentTaskSwitches = await this.countRecentTaskSwitches();
    const currentStreak = await this.getCurrentStreak(context);

    return {
      currentPhase,
      focusLevel,
      workloadIntensity,
      timeInCurrentPhase: this.calculateTimeInPhase(context),
      upcomingDeadlines,
      recentTaskSwitches,
      currentStreak,
    };
  }

  /**
   * Build productivity metrics from historical data
   */
  private async buildProductivityMetrics(
    _context: AppContext
  ): Promise<ProductivityMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [
        completionRate,
        avgDuration,
        focusEfficiency,
        breakAdherence,
        tasksCompleted,
        timeSpent,
        distractionCount,
      ] = await Promise.all([
        this.calculateTodayCompletionRate(),
        this.calculateAverageTaskDuration(),
        this.calculateFocusSessionEfficiency(),
        this.calculateBreakPatternAdherence(),
        this.countTasksCompletedToday(),
        this.calculateTimeSpentToday(),
        this.countTodayDistractions(),
      ]);

      const energyLevel = this.estimateEnergyLevel(_context);
      const productivityTrend = await this.calculateProductivityTrend();

      return {
        todayCompletionRate: completionRate,
        averageTaskDuration: avgDuration,
        focusSessionEfficiency: focusEfficiency,
        breakPatternAdherence: breakAdherence,
        energyLevel,
        tasksCompletedToday: tasksCompleted,
        timeSpentToday: timeSpent,
        distractionCount,
        productivityTrend,
      };
    } catch {
      return this.getDefaultProductivityMetrics();
    }
  }

  /**
   * Analyze recent user patterns
   */
  private async analyzeRecentPatterns(
    _context: AppContext
  ): Promise<UserPattern[]> {
    const patterns: UserPattern[] = [];
    const daysToAnalyze = this.config.historicalDataDays;

    try {
      // Analyze different pattern types
      const [
        productivityPatterns,
        breakPatterns,
        taskSwitchingPatterns,
        focusPatterns,
      ] = await Promise.all([
        this.analyzeProductivityPatterns(daysToAnalyze),
        this.analyzeBreakPatterns(daysToAnalyze),
        this.analyzeTaskSwitchingPatterns(daysToAnalyze),
        this.analyzeFocusPatterns(daysToAnalyze),
      ]);

      patterns.push(
        ...productivityPatterns,
        ...breakPatterns,
        ...taskSwitchingPatterns,
        ...focusPatterns
      );

      // Sort by confidence and recency
      return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10); // Keep top 10 most relevant patterns
    } catch {
      return [];
    }
  }

  /**
   * Generate contextual insights based on current state
   */
  private async generateContextualInsights(
    context: AppContext
  ): Promise<ContextualInsight[]> {
    const insights: ContextualInsight[] = [];

    try {
      // Check for optimization opportunities
      if (context.activeSession && this.isLongSession(context.activeSession)) {
        insights.push({
          type: 'suggestion',
          message: "Consider taking a break - you've been focused for a while",
          actionable: true,
          priority: Priority.MEDIUM,
          confidence: 0.8,
          relatedData: {
            sessionDuration: this.getSessionDuration(context.activeSession),
          },
          category: 'wellbeing',
        });
      }

      // Check for productivity patterns
      const currentHour = new Date().getHours();
      if (await this.isLowProductivityTime(currentHour)) {
        insights.push({
          type: 'warning',
          message: 'This is typically a low-productivity time for you',
          actionable: true,
          priority: Priority.LOW,
          confidence: 0.7,
          relatedData: { hour: currentHour },
          category: 'productivity',
        });
      }

      // Check for upcoming deadlines
      const urgentDeadlines = await this.getUrgentDeadlines();
      if (urgentDeadlines.length > 0) {
        insights.push({
          type: 'warning',
          message: `You have ${urgentDeadlines.length} urgent deadline(s) approaching`,
          actionable: true,
          priority: Priority.HIGH,
          confidence: 1.0,
          relatedData: { deadlines: urgentDeadlines },
          category: 'planning',
        });
      }

      return insights.slice(0, 5); // Limit to 5 most important insights
    } catch {
      return [];
    }
  }

  /**
   * Gather environmental factors
   */
  private async gatherEnvironmentalFactors(
    context: AppContext
  ): Promise<EnvironmentalFactors> {
    const now = new Date();
    const hour = now.getHours();

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }

    const isWorkingHours = this.isWithinWorkingHours(now, context.preferences);

    return {
      timeOfDay,
      dayOfWeek: now.getDay(),
      isWorkingHours,
      upcomingMeetings: 0, // Would integrate with calendar API
      systemLoad: 'low', // Would check system resources
      networkStatus: 'online', // Would check network connectivity
    };
  }

  // Helper methods for context relevance scoring
  private scoreWorkflowRelevance(
    workflowState: WorkflowState,
    intent: AIUserIntent
  ): number {
    let score = 0.5; // Base score

    // Higher relevance for task management intents during executing phase
    if (
      intent.category === 'task_management' &&
      workflowState.currentPhase === 'executing'
    ) {
      score += 0.3;
    }

    // Higher relevance for planning intents during planning phase
    if (
      intent.category === 'planning' &&
      workflowState.currentPhase === 'planning'
    ) {
      score += 0.3;
    }

    // Consider focus level
    if (workflowState.focusLevel > 7 && intent.urgency === 'low') {
      score += 0.2; // High focus, low urgency - good match
    }

    return Math.min(score, 1.0);
  }

  private scoreProductivityRelevance(
    metrics: ProductivityMetrics,
    intent: AIUserIntent
  ): number {
    let score = 0.3; // Base score

    // Higher relevance for productivity and analysis intents
    if (intent.category === 'productivity' || intent.category === 'analysis') {
      score += 0.4;
    }

    // Consider current productivity state
    if (
      metrics.todayCompletionRate < 0.3 &&
      intent.category === 'task_management'
    ) {
      score += 0.3; // Low completion rate makes task management more relevant
    }

    return Math.min(score, 1.0);
  }

  private scorePatternsRelevance(
    patterns: UserPattern[],
    intent: AIUserIntent
  ): number {
    if (patterns.length === 0) {
      return 0.1;
    }

    let score = 0.2; // Base score

    // Check if any patterns are relevant to current intent
    const relevantPatterns = patterns.filter(pattern => {
      if (
        intent.category === 'productivity' &&
        pattern.type === 'productivity'
      ) {
        return true;
      }
      if (intent.category === 'time_tracking' && pattern.type === 'focus') {
        return true;
      }
      if (intent.category === 'planning' && pattern.type === 'scheduling') {
        return true;
      }
      return false;
    });

    score += relevantPatterns.length * 0.2;

    // Boost for high-confidence patterns
    const highConfidencePatterns = patterns.filter(p => p.confidence > 0.8);
    score += highConfidencePatterns.length * 0.1;

    return Math.min(score, 1.0);
  }

  private scoreEnvironmentalRelevance(
    factors: EnvironmentalFactors,
    intent: AIUserIntent
  ): number {
    let score = 0.2; // Base score

    // Time-sensitive intents get higher relevance
    if (intent.urgency === 'high' && !factors.isWorkingHours) {
      score += 0.3; // Urgent request outside working hours
    }

    // Planning intents are more relevant during planning times
    if (intent.category === 'planning' && factors.timeOfDay === 'morning') {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private scoreInsightsRelevance(
    insights: ContextualInsight[],
    intent: AIUserIntent
  ): number {
    if (insights.length === 0) {
      return 0.1;
    }

    let score = 0.2; // Base score

    // Check for actionable insights matching intent category
    const relevantInsights = insights.filter(insight => {
      if (
        insight.category === 'productivity' &&
        intent.category === 'productivity'
      ) {
        return true;
      }
      if (insight.category === 'planning' && intent.category === 'planning') {
        return true;
      }
      if (insight.actionable && intent.urgency === 'high') {
        return true;
      }
      return false;
    });

    score += relevantInsights.length * 0.2;

    // Boost for high-priority insights
    const highPriorityInsights = insights.filter(
      i => i.priority === Priority.HIGH
    );
    score += highPriorityInsights.length * 0.15;

    return Math.min(score, 1.0);
  }

  // Helper methods for building context components
  private determineWorkflowPhase(
    context: AppContext
  ): 'planning' | 'executing' | 'reviewing' | 'break' {
    if (context.activeSession) {
      return 'executing';
    }
    if (context.activeFocusSession) {
      return 'executing';
    }

    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) {
      return 'planning';
    }
    if (hour >= 17 && hour <= 18) {
      return 'reviewing';
    }

    return 'planning';
  }

  private calculateFocusLevel(context: AppContext): number {
    let level = 5; // Base level

    if (context.activeSession) {
      level += 3;
    }
    if (context.activeFocusSession) {
      level += 2;
    }
    if (context.focusMode) {
      level += 2;
    }

    return Math.min(level, 10);
  }

  private async assessWorkloadIntensity(
    _context: AppContext
  ): Promise<'light' | 'moderate' | 'heavy' | 'overwhelming'> {
    try {
      const pendingTasks = await this.taskRepository.findAll({
        status: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
      });
      const taskCount = pendingTasks.length;
      const urgentTasks = pendingTasks.filter(
        (task: Task) => task.priority === Priority.URGENT
      ).length;

      if (urgentTasks > 5 || taskCount > 20) {
        return 'overwhelming';
      }
      if (urgentTasks > 2 || taskCount > 15) {
        return 'heavy';
      }
      if (taskCount > 8) {
        return 'moderate';
      }
      return 'light';
    } catch {
      return 'moderate';
    }
  }

  private calculateTimeInPhase(context: AppContext): number {
    if (context.activeSession) {
      return Math.floor(
        (Date.now() - context.activeSession.startTime.getTime()) / (1000 * 60)
      );
    }
    return 0;
  }

  private async getUpcomingDeadlines(): Promise<TaskDeadline[]> {
    try {
      const tasks = await this.taskRepository.findAll({});
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return tasks
        .filter(
          (task: Task) =>
            task.dueDate &&
            task.dueDate <= nextWeek &&
            task.status !== TaskStatus.COMPLETED
        )
        .map((task: Task) => ({
          taskId: task.id,
          taskTitle: task.title,
          dueDate: task.dueDate!,
          priority: task.priority,
          hoursRemaining: Math.max(
            0,
            Math.floor(
              (task.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60)
            )
          ),
          estimatedTimeToComplete: task.timeEstimate,
          riskLevel: this.assessDeadlineRisk(
            task.dueDate!,
            task.timeEstimate,
            now
          ),
        }))
        .sort(
          (a: TaskDeadline, b: TaskDeadline) =>
            a.dueDate.getTime() - b.dueDate.getTime()
        )
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  private assessDeadlineRisk(
    dueDate: Date,
    estimatedTime: number,
    now: Date
  ): 'low' | 'medium' | 'high' | 'critical' {
    const hoursRemaining =
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const estimatedHours = estimatedTime / 60;

    if (hoursRemaining < estimatedHours) {
      return 'critical';
    }
    if (hoursRemaining < estimatedHours * 1.5) {
      return 'high';
    }
    if (hoursRemaining < estimatedHours * 3) {
      return 'medium';
    }
    return 'low';
  }

  private async countRecentTaskSwitches(): Promise<number> {
    // This would analyze recent activity events
    // For now, return a placeholder
    return 0;
  }

  private async getCurrentStreak(
    _context: AppContext
  ): Promise<WorkflowStreak> {
    // This would analyze current productivity streak
    // For now, return a default streak
    return {
      type: 'focus',
      count: 0,
      startTime: new Date(),
      bestStreak: 0,
    };
  }

  // Productivity metrics calculation methods
  private async calculateTodayCompletionRate(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const allTasks = await this.taskRepository.findAll({});
      const todayTasks = allTasks.filter(
        (task: Task) => task.createdAt >= today && task.createdAt < tomorrow
      );

      if (todayTasks.length === 0) {
        return 0;
      }

      const completedTasks = todayTasks.filter(
        (task: Task) => task.status === TaskStatus.COMPLETED
      );
      return completedTasks.length / todayTasks.length;
    } catch {
      return 0;
    }
  }

  private async calculateAverageTaskDuration(): Promise<number> {
    // This would analyze completed sessions
    // For now, return a reasonable default
    return 45; // minutes
  }

  private async calculateFocusSessionEfficiency(): Promise<number> {
    // This would analyze focus session data
    // For now, return a default
    return 0.75;
  }

  private async calculateBreakPatternAdherence(): Promise<number> {
    // This would analyze break patterns vs recommendations
    // For now, return a default
    return 0.6;
  }

  private async countTasksCompletedToday(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasks = await this.taskRepository.findAll({
        status: [TaskStatus.COMPLETED],
      });
      return tasks.filter(
        (task: Task) => task.completedAt && task.completedAt >= today
      ).length;
    } catch {
      return 0;
    }
  }

  private async calculateTimeSpentToday(): Promise<number> {
    // This would sum up timer sessions for today
    // For now, return a placeholder
    return 0;
  }

  private async countTodayDistractions(): Promise<number> {
    // This would count distraction events
    // For now, return a placeholder
    return 0;
  }

  private estimateEnergyLevel(context: AppContext): number {
    const hour = new Date().getHours();
    let energy = 5; // Base energy

    // Time-based energy patterns
    if (hour >= 9 && hour <= 11) {
      energy += 2; // Morning peak
    }
    if (hour >= 14 && hour <= 16) {
      energy += 1; // Afternoon peak
    }
    if (hour >= 22 || hour <= 6) {
      energy -= 3; // Night/early morning
    }

    // Context-based adjustments
    if (context.activeSession) {
      energy += 1;
    }
    if (context.focusMode) {
      energy += 1;
    }

    return Math.max(1, Math.min(10, energy));
  }

  private async calculateProductivityTrend(): Promise<
    'increasing' | 'stable' | 'decreasing'
  > {
    // This would analyze productivity over recent days
    // For now, return stable
    return 'stable';
  }

  // Pattern analysis methods (simplified implementations)
  private async analyzeProductivityPatterns(
    _days: number
  ): Promise<UserPattern[]> {
    return []; // Placeholder - would analyze productivity data
  }

  private async analyzeBreakPatterns(_days: number): Promise<UserPattern[]> {
    return []; // Placeholder - would analyze break data
  }

  private async analyzeTaskSwitchingPatterns(
    _days: number
  ): Promise<UserPattern[]> {
    return []; // Placeholder - would analyze task switching data
  }

  private async analyzeFocusPatterns(_days: number): Promise<UserPattern[]> {
    return []; // Placeholder - would analyze focus session data
  }

  // Insight generation helper methods
  private isLongSession(session: TimerSession): boolean {
    const duration = Date.now() - session.startTime.getTime();
    return duration > 90 * 60 * 1000; // 90 minutes
  }

  private getSessionDuration(session: TimerSession): number {
    return Math.floor((Date.now() - session.startTime.getTime()) / (1000 * 60));
  }

  private async isLowProductivityTime(hour: number): Promise<boolean> {
    // This would check historical productivity data for this hour
    // For now, assume post-lunch dip
    return hour >= 13 && hour <= 15;
  }

  private async getUrgentDeadlines(): Promise<TaskDeadline[]> {
    const deadlines = await this.getUpcomingDeadlines();
    return deadlines.filter(
      d => d.riskLevel === 'critical' || d.riskLevel === 'high'
    );
  }

  private isWithinWorkingHours(
    date: Date,
    preferences: AppContext['preferences']
  ): boolean {
    const hour = date.getHours();
    const startHour = parseInt(preferences.workingHours.start.split(':')[0]);
    const endHour = parseInt(preferences.workingHours.end.split(':')[0]);

    return hour >= startHour && hour < endHour;
  }

  // Default/fallback methods
  private getDefaultWorkflowState(): WorkflowState {
    return {
      currentPhase: 'planning',
      focusLevel: 5,
      workloadIntensity: 'moderate',
      timeInCurrentPhase: 0,
      upcomingDeadlines: [],
      recentTaskSwitches: 0,
      currentStreak: {
        type: 'focus',
        count: 0,
        startTime: new Date(),
        bestStreak: 0,
      },
    };
  }

  private getDefaultProductivityMetrics(): ProductivityMetrics {
    return {
      todayCompletionRate: 0,
      averageTaskDuration: 45,
      focusSessionEfficiency: 0.7,
      breakPatternAdherence: 0.6,
      energyLevel: 5,
      tasksCompletedToday: 0,
      timeSpentToday: 0,
      distractionCount: 0,
      productivityTrend: 'stable',
    };
  }

  private getBasicEnvironmentalFactors(): EnvironmentalFactors {
    const now = new Date();
    const hour = now.getHours();

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }

    return {
      timeOfDay,
      dayOfWeek: now.getDay(),
      isWorkingHours: hour >= 9 && hour < 17,
      upcomingMeetings: 0,
      systemLoad: 'low',
      networkStatus: 'online',
    };
  }

  // Intent extraction (simplified)
  private extractUserIntent(message: string): AIUserIntent {
    const lowerMessage = message.toLowerCase();

    let category: AIUserIntent['category'] = 'general';
    let urgency: AIUserIntent['urgency'] = 'medium';
    let complexity: AIUserIntent['complexity'] = 'simple';

    // Simple keyword-based intent detection
    if (lowerMessage.includes('task') || lowerMessage.includes('todo')) {
      category = 'task_management';
    } else if (
      lowerMessage.includes('timer') ||
      lowerMessage.includes('time')
    ) {
      category = 'time_tracking';
    } else if (
      lowerMessage.includes('plan') ||
      lowerMessage.includes('schedule')
    ) {
      category = 'planning';
    } else if (
      lowerMessage.includes('productivity') ||
      lowerMessage.includes('analyze')
    ) {
      category = 'analysis';
    }

    // Detect urgency
    if (
      lowerMessage.includes('urgent') ||
      lowerMessage.includes('asap') ||
      lowerMessage.includes('immediately')
    ) {
      urgency = 'high';
    } else if (
      lowerMessage.includes('later') ||
      lowerMessage.includes('eventually')
    ) {
      urgency = 'low';
    }

    // Detect complexity
    if (
      lowerMessage.includes('complex') ||
      lowerMessage.includes('detailed') ||
      lowerMessage.split(' ').length > 20
    ) {
      complexity = 'complex';
    } else if (lowerMessage.split(' ').length > 10) {
      complexity = 'moderate';
    }

    return {
      primary: category,
      secondary: [],
      confidence: 0.7,
      category,
      urgency,
      complexity,
      requiresContext: category !== 'general',
    };
  }

  // Cache management
  private generateCacheKey(context: AppContext, message: string): string {
    const contextHash = JSON.stringify({
      currentTask: context.currentTask?.id,
      activeSession: context.activeSession?.id,
      timeOfDay: Math.floor(Date.now() / (1000 * 60 * 15)), // 15-minute buckets
    });
    return `${contextHash}-${message.slice(0, 50)}`;
  }

  private getCachedContext(key: string): EnhancedAppContext | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const isExpired =
      Date.now() - cached.timestamp > this.config.cacheTTL * 1000;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedContext(key: string, context: EnhancedAppContext): void {
    this.cache.set(key, {
      data: context,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
}
