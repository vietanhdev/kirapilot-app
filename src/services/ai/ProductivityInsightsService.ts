import {
  Task,
  TaskStatus,
  TimerSession,
  ProductivityPattern,
  PatternAnalysis,
  AISuggestion,
  Priority,
  TimeSlot,
  EnergyPattern,
  DistractionLevel,
} from '../../types';
import { TaskService } from '../database/repositories/TaskService';
import { TimeTrackingService } from '../database/repositories/TimeTrackingService';

export interface WorkingStyle {
  preferredWorkingHours: TimeSlot[];
  averageTaskDuration: number;
  breakFrequency: number; // minutes between breaks
  focusPatterns: 'morning' | 'afternoon' | 'evening' | 'flexible';
  taskCompletionStyle: 'batch' | 'distributed' | 'deadline-driven';
  energyLevels: EnergyPattern[];
}

export interface ProductivityInsight {
  id: string;
  type: 'pattern' | 'recommendation' | 'warning' | 'celebration';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions: string[];
  basedOnData: {
    timeRange: { start: Date; end: Date };
    sampleSize: number;
    dataTypes: ('tasks' | 'time_tracking' | 'patterns')[];
  };
  createdAt: Date;
}

export interface PersonalizedRecommendation {
  id: string;
  category:
    | 'scheduling'
    | 'task_management'
    | 'energy_optimization'
    | 'focus_improvement';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  estimatedImpact: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeToImplement: number; // minutes
  actions: {
    primary: string;
    secondary?: string[];
  };
  personalizedFor: {
    workingStyle: Partial<WorkingStyle>;
    recentPatterns: string[];
    userPreferences: Record<string, unknown>;
  };
  validUntil?: Date;
  createdAt: Date;
}

export class ProductivityInsightsService {
  private taskService: TaskService;
  private timeTrackingService: TimeTrackingService;

  constructor() {
    this.taskService = new TaskService();
    this.timeTrackingService = new TimeTrackingService();
  }

  /**
   * Analyze user behavior patterns from historical data
   */
  async analyzeUserBehaviorPatterns(
    userId: string,
    daysBack: number = 30
  ): Promise<PatternAnalysis> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    try {
      // Get historical data
      const [tasks, sessions, taskStats, timeStats] = await Promise.all([
        this.taskService.findAll(),
        this.timeTrackingService.getByDateRange(startDate, endDate),
        this.taskService.getStatistics(),
        this.timeTrackingService.getStatistics(startDate, endDate),
      ]);

      // Analyze productivity patterns
      const productivityPatterns = await this.analyzeProductivityPatterns(
        tasks,
        sessions
      );

      // Analyze energy patterns
      const energyPatterns = await this.analyzeEnergyPatterns(sessions);

      // Generate insights
      const insights = await this.generateInsights(
        tasks,
        sessions,
        taskStats,
        timeStats
      );

      // Generate recommendations
      const recommendations = await this.generatePersonalizedRecommendations(
        productivityPatterns,
        energyPatterns,
        insights
      );

      return {
        userId,
        analysisDate: new Date(),
        productivityPatterns,
        energyPatterns,
        recommendations,
        insights,
      };
    } catch (error) {
      throw new Error(`Failed to analyze user behavior patterns: ${error}`);
    }
  }

  /**
   * Detect working style from user behavior
   */
  async detectWorkingStyle(userId: string): Promise<WorkingStyle> {
    const daysBack = 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    try {
      const sessions = await this.timeTrackingService.getByDateRange(
        startDate,
        endDate
      );

      // Analyze preferred working hours
      const preferredWorkingHours = this.analyzePreferredWorkingHours(sessions);

      // Calculate average task duration
      const averageTaskDuration = this.calculateAverageTaskDuration(sessions);

      // Analyze break frequency
      const breakFrequency = this.analyzeBreakFrequency(sessions);

      // Determine focus patterns
      const focusPatterns = this.determineFocusPatterns(sessions);

      // Analyze task completion style
      const taskCompletionStyle = await this.analyzeTaskCompletionStyle(userId);

      // Generate energy levels
      const energyLevels = await this.analyzeEnergyPatterns(sessions);

      return {
        preferredWorkingHours,
        averageTaskDuration,
        breakFrequency,
        focusPatterns,
        taskCompletionStyle,
        energyLevels,
      };
    } catch (error) {
      throw new Error(`Failed to detect working style: ${error}`);
    }
  }

  /**
   * Generate personalized productivity tips
   */
  async generatePersonalizedTips(
    userId: string,
    context?: {
      currentTime?: Date;
      currentTask?: Task;
      recentActivity?: 'high' | 'medium' | 'low';
    }
  ): Promise<PersonalizedRecommendation[]> {
    try {
      const workingStyle = await this.detectWorkingStyle(userId);
      const patternAnalysis = await this.analyzeUserBehaviorPatterns(userId);

      const recommendations: PersonalizedRecommendation[] = [];

      // Generate scheduling recommendations
      recommendations.push(
        ...this.generateSchedulingRecommendations(workingStyle, context)
      );

      // Generate task management recommendations
      recommendations.push(
        ...this.generateTaskManagementRecommendations(
          workingStyle,
          patternAnalysis
        )
      );

      // Generate energy optimization recommendations
      recommendations.push(
        ...this.generateEnergyOptimizationRecommendations(workingStyle, context)
      );

      // Generate focus improvement recommendations
      recommendations.push(
        ...this.generateFocusImprovementRecommendations(
          workingStyle,
          patternAnalysis
        )
      );

      // Sort by confidence and impact
      return recommendations
        .sort(
          (a, b) =>
            b.confidence * b.estimatedImpact - a.confidence * a.estimatedImpact
        )
        .slice(0, 5); // Return top 5 recommendations
    } catch (error) {
      throw new Error(`Failed to generate personalized tips: ${error}`);
    }
  }

  /**
   * Provide contextual advice based on historical data
   */
  async provideContextualAdvice(
    userId: string,
    context: {
      currentTask?: Task;
      timeOfDay: Date;
      recentPerformance: 'high' | 'medium' | 'low';
      upcomingDeadlines: Task[];
    }
  ): Promise<AISuggestion[]> {
    try {
      const workingStyle = await this.detectWorkingStyle(userId);
      const patternAnalysis = await this.analyzeUserBehaviorPatterns(userId);

      const suggestions: AISuggestion[] = [];

      // Analyze current context against historical patterns
      const currentHour = context.timeOfDay.getHours();
      const currentDay = context.timeOfDay.getDay();

      // Find similar historical situations
      const similarSituations = await this.findSimilarHistoricalSituations(
        context,
        patternAnalysis
      );

      // Generate contextual suggestions based on patterns
      if (context.currentTask) {
        suggestions.push(
          ...this.generateTaskSpecificAdvice(
            context.currentTask,
            workingStyle,
            similarSituations
          )
        );
      }

      // Generate time-based advice
      suggestions.push(
        ...this.generateTimeBasedAdvice(
          currentHour,
          currentDay,
          workingStyle,
          patternAnalysis
        )
      );

      // Generate performance-based advice
      suggestions.push(
        ...this.generatePerformanceBasedAdvice(
          context.recentPerformance,
          workingStyle,
          patternAnalysis
        )
      );

      // Generate deadline-based advice
      if (context.upcomingDeadlines.length > 0) {
        suggestions.push(
          ...this.generateDeadlineBasedAdvice(
            context.upcomingDeadlines,
            workingStyle,
            patternAnalysis
          )
        );
      }

      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Return top 3 suggestions
    } catch (error) {
      throw new Error(`Failed to provide contextual advice: ${error}`);
    }
  }

  // Private helper methods for pattern analysis

  private async analyzeProductivityPatterns(
    tasks: Task[],
    sessions: TimerSession[]
  ): Promise<ProductivityPattern[]> {
    const patterns: ProductivityPattern[] = [];

    // Analyze daily patterns
    const dailyPattern = this.analyzeDailyProductivityPattern(tasks, sessions);
    if (dailyPattern) {
      patterns.push(dailyPattern);
    }

    // Analyze weekly patterns
    const weeklyPattern = this.analyzeWeeklyProductivityPattern(
      tasks,
      sessions
    );
    if (weeklyPattern) {
      patterns.push(weeklyPattern);
    }

    // Analyze task-based patterns
    const taskBasedPattern = this.analyzeTaskBasedProductivityPattern(
      tasks,
      sessions
    );
    if (taskBasedPattern) {
      patterns.push(taskBasedPattern);
    }

    return patterns;
  }

  private async analyzeEnergyPatterns(
    sessions: TimerSession[]
  ): Promise<EnergyPattern[]> {
    const energyByHour: Record<number, { total: number; count: number }> = {};

    sessions.forEach(session => {
      if (session.endTime) {
        const hour = session.startTime.getHours();
        const productivity = this.calculateSessionProductivity(session);

        if (!energyByHour[hour]) {
          energyByHour[hour] = { total: 0, count: 0 };
        }

        energyByHour[hour].total += productivity;
        energyByHour[hour].count += 1;
      }
    });

    return Object.entries(energyByHour).map(([hour, data]) => ({
      timeSlot: {
        start: `${hour.padStart(2, '0')}:00`,
        end: `${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`,
        dayOfWeek: -1, // All days
      },
      averageEnergy: data.total / data.count,
      confidence: Math.min(data.count * 10, 100),
      sampleSize: data.count,
    }));
  }

  private async generateInsights(
    tasks: Task[],
    sessions: TimerSession[],
    _taskStats: unknown,
    _timeStats: unknown
  ): Promise<PatternAnalysis['insights']> {
    // Find most productive time
    const energyPatterns = await this.analyzeEnergyPatterns(sessions);

    let mostProductivePattern = null;
    let leastProductivePattern = null;

    if (energyPatterns.length > 0) {
      mostProductivePattern = energyPatterns.reduce((max, pattern) =>
        pattern.averageEnergy > max.averageEnergy ? pattern : max
      );

      leastProductivePattern = energyPatterns.reduce((min, pattern) =>
        pattern.averageEnergy < min.averageEnergy ? pattern : min
      );
    }

    // Calculate average task duration
    const completedSessions = sessions.filter(s => s.endTime);
    const averageTaskDuration =
      completedSessions.reduce((sum, session) => {
        const duration =
          session.endTime!.getTime() - session.startTime.getTime();
        return sum + duration / (1000 * 60); // Convert to minutes
      }, 0) / completedSessions.length || 0;

    // Calculate completion rate
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const completionRate = (completedTasks.length / tasks.length) * 100 || 0;

    // Calculate focus efficiency (time spent vs. estimated time)
    const focusEfficiency = this.calculateFocusEfficiency(tasks, sessions);

    return {
      mostProductiveTime: mostProductivePattern?.timeSlot || {
        start: '09:00',
        end: '12:00',
        dayOfWeek: 1,
      },
      leastProductiveTime: leastProductivePattern?.timeSlot || {
        start: '15:00',
        end: '17:00',
        dayOfWeek: 5,
      },
      averageTaskDuration,
      completionRate,
      focusEfficiency,
    };
  }

  private async generatePersonalizedRecommendations(
    _productivityPatterns: ProductivityPattern[],
    energyPatterns: EnergyPattern[],
    insights: PatternAnalysis['insights']
  ): Promise<AISuggestion[]> {
    const recommendations: AISuggestion[] = [];

    // Generate recommendations based on productivity patterns
    if (insights.completionRate < 70) {
      recommendations.push({
        id: `rec-completion-${Date.now()}`,
        type: 'productivity',
        title: 'Improve Task Completion Rate',
        description: `Your current completion rate is ${insights.completionRate.toFixed(1)}%. Consider breaking down large tasks into smaller, manageable chunks.`,
        confidence: 85,
        actionable: true,
        priority: Priority.HIGH,
        estimatedImpact: 80,
        reasoning:
          'Low completion rates often indicate tasks are too large or poorly defined',
        createdAt: new Date(),
      });
    }

    // Generate energy-based recommendations
    const highEnergyPeriods = energyPatterns
      .filter(p => p.averageEnergy > 70)
      .sort((a, b) => b.averageEnergy - a.averageEnergy);

    if (highEnergyPeriods.length > 0) {
      const bestTime = highEnergyPeriods[0];
      recommendations.push({
        id: `rec-energy-${Date.now()}`,
        type: 'schedule',
        title: 'Optimize High-Energy Tasks',
        description: `Schedule your most challenging tasks around ${bestTime.timeSlot.start} when your energy is typically highest (${bestTime.averageEnergy.toFixed(1)}% productivity).`,
        confidence: bestTime.confidence,
        actionable: true,
        priority: Priority.MEDIUM,
        estimatedImpact: 70,
        reasoning:
          'Historical data shows peak performance during this time period',
        createdAt: new Date(),
      });
    }

    // Generate focus efficiency recommendations
    if (insights.focusEfficiency < 60) {
      recommendations.push({
        id: `rec-focus-${Date.now()}`,
        type: 'focus',
        title: 'Improve Focus Efficiency',
        description: `Your focus efficiency is ${insights.focusEfficiency.toFixed(1)}%. Try the Pomodoro technique or eliminate distractions during work sessions.`,
        confidence: 75,
        actionable: true,
        priority: Priority.MEDIUM,
        estimatedImpact: 65,
        reasoning:
          'Low focus efficiency suggests frequent interruptions or overestimated task complexity',
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  // Additional helper methods will be implemented in the next part...

  private analyzePreferredWorkingHours(sessions: TimerSession[]): TimeSlot[] {
    // Implementation for analyzing preferred working hours
    const hourCounts: Record<number, number> = {};

    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find top 3 most active hours
    const topHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return topHours.map(hour => ({
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      dayOfWeek: -1, // All days
    }));
  }

  private calculateAverageTaskDuration(sessions: TimerSession[]): number {
    const completedSessions = sessions.filter(s => s.endTime);
    if (completedSessions.length === 0) {
      return 0;
    }

    const totalDuration = completedSessions.reduce((sum, session) => {
      const duration = session.endTime!.getTime() - session.startTime.getTime();
      return sum + duration;
    }, 0);

    return totalDuration / completedSessions.length / (1000 * 60); // Convert to minutes
  }

  private analyzeBreakFrequency(sessions: TimerSession[]): number {
    // Calculate average time between sessions as break frequency
    if (sessions.length < 2) {
      return 60; // Default 60 minutes
    }

    const sortedSessions = sessions
      .filter(s => s.endTime)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    let totalBreakTime = 0;
    let breakCount = 0;

    for (let i = 1; i < sortedSessions.length; i++) {
      const prevEnd = sortedSessions[i - 1].endTime!;
      const currentStart = sortedSessions[i].startTime;
      const breakDuration = currentStart.getTime() - prevEnd.getTime();

      // Only count breaks between 5 minutes and 4 hours
      if (breakDuration > 5 * 60 * 1000 && breakDuration < 4 * 60 * 60 * 1000) {
        totalBreakTime += breakDuration;
        breakCount++;
      }
    }

    return breakCount > 0 ? totalBreakTime / breakCount / (1000 * 60) : 60;
  }

  private determineFocusPatterns(
    sessions: TimerSession[]
  ): 'morning' | 'afternoon' | 'evening' | 'flexible' {
    const hourCounts = { morning: 0, afternoon: 0, evening: 0 };

    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      if (hour >= 6 && hour < 12) {
        hourCounts.morning++;
      } else if (hour >= 12 && hour < 18) {
        hourCounts.afternoon++;
      } else if (hour >= 18 && hour < 24) {
        hourCounts.evening++;
      }
    });

    const total =
      hourCounts.morning + hourCounts.afternoon + hourCounts.evening;
    if (total === 0) {
      return 'flexible';
    }

    const morningPercent = hourCounts.morning / total;
    const afternoonPercent = hourCounts.afternoon / total;
    const eveningPercent = hourCounts.evening / total;

    if (morningPercent > 0.5) {
      return 'morning';
    }
    if (afternoonPercent > 0.5) {
      return 'afternoon';
    }
    if (eveningPercent > 0.5) {
      return 'evening';
    }
    return 'flexible';
  }

  private async analyzeTaskCompletionStyle(
    _userId: string
  ): Promise<'batch' | 'distributed' | 'deadline-driven'> {
    // This would require more complex analysis of task completion patterns
    // For now, return a default value
    return 'distributed';
  }

  // Pattern analysis implementations
  private analyzeDailyProductivityPattern(
    _tasks: Task[],
    sessions: TimerSession[]
  ): ProductivityPattern | null {
    if (sessions.length < 5) {
      return null;
    } // Need minimum data

    const hourlyProductivity: Record<number, { total: number; count: number }> =
      {};

    sessions.forEach(session => {
      if (session.endTime) {
        const hour = session.startTime.getHours();
        const productivity = this.calculateSessionProductivity(session);

        if (!hourlyProductivity[hour]) {
          hourlyProductivity[hour] = { total: 0, count: 0 };
        }

        hourlyProductivity[hour].total += productivity;
        hourlyProductivity[hour].count += 1;
      }
    });

    // Find peak productivity hours
    const peakHours = Object.entries(hourlyProductivity)
      .filter(([, data]) => data.count >= 2) // Minimum sample size
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgProductivity: data.total / data.count,
        sampleSize: data.count,
      }))
      .sort((a, b) => b.avgProductivity - a.avgProductivity)
      .slice(0, 3); // Top 3 hours

    if (peakHours.length === 0) {
      return null;
    }

    const timeSlots: TimeSlot[] = peakHours.map(({ hour }) => ({
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      dayOfWeek: -1, // All days
    }));

    const avgProductivity =
      peakHours.reduce((sum, h) => sum + h.avgProductivity, 0) /
      peakHours.length;
    const totalSamples = peakHours.reduce((sum, h) => sum + h.sampleSize, 0);

    return {
      id: `daily-pattern-${Date.now()}`,
      userId: 'current-user',
      patternType: 'daily',
      timeSlots,
      productivity: avgProductivity,
      confidence: Math.min(totalSamples * 5, 100),
      sampleSize: totalSamples,
      lastUpdated: new Date(),
    };
  }

  private analyzeWeeklyProductivityPattern(
    _tasks: Task[],
    sessions: TimerSession[]
  ): ProductivityPattern | null {
    if (sessions.length < 10) {
      return null;
    } // Need minimum data

    const dailyProductivity: Record<number, { total: number; count: number }> =
      {};

    sessions.forEach(session => {
      if (session.endTime) {
        const dayOfWeek = session.startTime.getDay();
        const productivity = this.calculateSessionProductivity(session);

        if (!dailyProductivity[dayOfWeek]) {
          dailyProductivity[dayOfWeek] = { total: 0, count: 0 };
        }

        dailyProductivity[dayOfWeek].total += productivity;
        dailyProductivity[dayOfWeek].count += 1;
      }
    });

    // Find most productive days
    const productiveDays = Object.entries(dailyProductivity)
      .filter(([, data]) => data.count >= 2)
      .map(([day, data]) => ({
        day: parseInt(day),
        avgProductivity: data.total / data.count,
        sampleSize: data.count,
      }))
      .sort((a, b) => b.avgProductivity - a.avgProductivity);

    if (productiveDays.length === 0) {
      return null;
    }

    // Create time slots for the most productive days
    const timeSlots: TimeSlot[] = productiveDays.slice(0, 3).map(({ day }) => ({
      start: '09:00',
      end: '17:00',
      dayOfWeek: day,
    }));

    const avgProductivity =
      productiveDays
        .slice(0, 3)
        .reduce((sum, d) => sum + d.avgProductivity, 0) /
      Math.min(3, productiveDays.length);
    const totalSamples = productiveDays
      .slice(0, 3)
      .reduce((sum, d) => sum + d.sampleSize, 0);

    return {
      id: `weekly-pattern-${Date.now()}`,
      userId: 'current-user',
      patternType: 'weekly',
      timeSlots,
      productivity: avgProductivity,
      confidence: Math.min(totalSamples * 3, 100),
      sampleSize: totalSamples,
      lastUpdated: new Date(),
    };
  }

  private analyzeTaskBasedProductivityPattern(
    tasks: Task[],
    sessions: TimerSession[]
  ): ProductivityPattern | null {
    if (tasks.length < 5 || sessions.length < 5) {
      return null;
    }

    // Group sessions by task priority
    const priorityProductivity: Record<
      number,
      { total: number; count: number }
    > = {};

    sessions.forEach(session => {
      if (session.endTime) {
        const task = tasks.find(t => t.id === session.taskId);
        if (task) {
          const priority = task.priority;
          const productivity = this.calculateSessionProductivity(session);

          if (!priorityProductivity[priority]) {
            priorityProductivity[priority] = { total: 0, count: 0 };
          }

          priorityProductivity[priority].total += productivity;
          priorityProductivity[priority].count += 1;
        }
      }
    });

    // Find the priority level with best productivity
    const bestPriority = Object.entries(priorityProductivity)
      .filter(([, data]) => data.count >= 2)
      .map(([priority, data]) => ({
        priority: parseInt(priority),
        avgProductivity: data.total / data.count,
        sampleSize: data.count,
      }))
      .sort((a, b) => b.avgProductivity - a.avgProductivity)[0];

    if (!bestPriority) {
      return null;
    }

    // Create a general time slot (this could be more sophisticated)
    const timeSlots: TimeSlot[] = [
      {
        start: '09:00',
        end: '17:00',
        dayOfWeek: -1,
      },
    ];

    return {
      id: `task-based-pattern-${Date.now()}`,
      userId: 'current-user',
      patternType: 'task_based',
      timeSlots,
      productivity: bestPriority.avgProductivity,
      confidence: Math.min(bestPriority.sampleSize * 10, 100),
      sampleSize: bestPriority.sampleSize,
      lastUpdated: new Date(),
    };
  }

  private calculateSessionProductivity(session: TimerSession): number {
    // Calculate productivity score based on session characteristics
    if (!session.endTime) {
      return 0;
    }

    const totalDuration =
      session.endTime.getTime() - session.startTime.getTime();
    const breakTime = session.breaks.reduce((total, breakItem) => {
      return (
        total + (breakItem.endTime.getTime() - breakItem.startTime.getTime())
      );
    }, 0);

    const activeTime = totalDuration - breakTime - session.pausedTime;
    const productivity = (activeTime / totalDuration) * 100;

    return Math.max(0, Math.min(100, productivity));
  }

  private calculateFocusEfficiency(
    tasks: Task[],
    sessions: TimerSession[]
  ): number {
    // Calculate focus efficiency based on estimated vs actual time
    let totalEstimated = 0;
    let totalActual = 0;

    tasks.forEach(task => {
      if (task.timeEstimate && task.status === TaskStatus.COMPLETED) {
        const taskSessions = sessions.filter(
          s => s.taskId === task.id && s.endTime
        );
        const actualTime = taskSessions.reduce((sum, session) => {
          return (
            sum + (session.endTime!.getTime() - session.startTime.getTime())
          );
        }, 0);

        totalEstimated += task.timeEstimate * 60 * 1000; // Convert minutes to milliseconds
        totalActual += actualTime;
      }
    });

    if (totalEstimated === 0) {
      return 75; // Default efficiency
    }
    return Math.min(100, (totalEstimated / totalActual) * 100);
  }

  // Recommendation generation methods
  private generateSchedulingRecommendations(
    workingStyle: WorkingStyle,
    _context?: unknown
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    // Recommend scheduling during high-energy periods
    if (workingStyle.energyLevels.length > 0) {
      const highEnergyPeriod = workingStyle.energyLevels.sort(
        (a, b) => b.averageEnergy - a.averageEnergy
      )[0];

      recommendations.push({
        id: `sched-energy-${Date.now()}`,
        category: 'scheduling',
        title: 'Schedule Important Tasks During Peak Energy',
        description: `Your energy is typically highest around ${highEnergyPeriod.timeSlot.start}. Consider scheduling your most challenging tasks during this time.`,
        reasoning: `Analysis of your work patterns shows ${highEnergyPeriod.averageEnergy.toFixed(1)}% productivity during this period.`,
        confidence: highEnergyPeriod.confidence,
        estimatedImpact: 75,
        difficulty: 'easy',
        timeToImplement: 5,
        actions: {
          primary: 'Move important tasks to your peak energy time',
          secondary: [
            'Block calendar during high-energy periods',
            'Set reminders for task scheduling',
          ],
        },
        personalizedFor: {
          workingStyle: { energyLevels: [highEnergyPeriod] },
          recentPatterns: ['high-energy-periods'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    // Recommend break scheduling based on patterns
    if (workingStyle.breakFrequency > 0) {
      recommendations.push({
        id: `sched-breaks-${Date.now()}`,
        category: 'scheduling',
        title: 'Optimize Break Timing',
        description: `Based on your patterns, you typically take breaks every ${Math.round(workingStyle.breakFrequency)} minutes. Consider scheduling regular breaks to maintain productivity.`,
        reasoning: 'Regular breaks help maintain focus and prevent burnout.',
        confidence: 70,
        estimatedImpact: 60,
        difficulty: 'easy',
        timeToImplement: 2,
        actions: {
          primary:
            'Set break reminders every ' +
            Math.round(workingStyle.breakFrequency) +
            ' minutes',
          secondary: [
            'Use Pomodoro technique',
            'Take short walks during breaks',
          ],
        },
        personalizedFor: {
          workingStyle: { breakFrequency: workingStyle.breakFrequency },
          recentPatterns: ['break-frequency'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  private generateTaskManagementRecommendations(
    workingStyle: WorkingStyle,
    patternAnalysis: PatternAnalysis
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    // Recommend task sizing based on average duration
    if (workingStyle.averageTaskDuration > 0) {
      const optimalDuration = workingStyle.averageTaskDuration;

      recommendations.push({
        id: `task-sizing-${Date.now()}`,
        category: 'task_management',
        title: 'Optimize Task Size',
        description: `Your average task duration is ${Math.round(optimalDuration)} minutes. Consider breaking larger tasks into ${Math.round(optimalDuration)}-minute chunks for better completion rates.`,
        reasoning:
          'Tasks matching your natural work rhythm are more likely to be completed successfully.',
        confidence: 80,
        estimatedImpact: 70,
        difficulty: 'medium',
        timeToImplement: 10,
        actions: {
          primary: `Break large tasks into ${Math.round(optimalDuration)}-minute segments`,
          secondary: [
            'Use time estimates when creating tasks',
            'Review and adjust task complexity',
          ],
        },
        personalizedFor: {
          workingStyle: { averageTaskDuration: optimalDuration },
          recentPatterns: ['task-duration'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    // Recommend completion strategy based on patterns
    if (patternAnalysis.insights.completionRate < 80) {
      recommendations.push({
        id: `completion-strategy-${Date.now()}`,
        category: 'task_management',
        title: 'Improve Task Completion Strategy',
        description: `Your completion rate is ${patternAnalysis.insights.completionRate.toFixed(1)}%. Try the "2-minute rule" - if a task takes less than 2 minutes, do it immediately.`,
        reasoning:
          'Quick wins build momentum and improve overall completion rates.',
        confidence: 75,
        estimatedImpact: 65,
        difficulty: 'easy',
        timeToImplement: 1,
        actions: {
          primary: 'Apply 2-minute rule for quick tasks',
          secondary: ['Prioritize by effort level', 'Celebrate small wins'],
        },
        personalizedFor: {
          workingStyle: {},
          recentPatterns: ['low-completion-rate'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  private generateEnergyOptimizationRecommendations(
    workingStyle: WorkingStyle,
    context?: {
      currentTime?: Date;
      currentTask?: Task;
      recentActivity?: 'high' | 'medium' | 'low';
    }
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    // Recommend energy management based on focus patterns
    if (workingStyle.focusPatterns !== 'flexible') {
      recommendations.push({
        id: `energy-focus-${Date.now()}`,
        category: 'energy_optimization',
        title: `Optimize Your ${workingStyle.focusPatterns} Energy`,
        description: `You're most focused during ${workingStyle.focusPatterns} hours. Protect this time from meetings and interruptions.`,
        reasoning: `Your work patterns show strongest focus during ${workingStyle.focusPatterns} periods.`,
        confidence: 85,
        estimatedImpact: 80,
        difficulty: 'medium',
        timeToImplement: 15,
        actions: {
          primary: `Block ${workingStyle.focusPatterns} hours for deep work`,
          secondary: [
            'Turn off notifications during focus time',
            'Communicate boundaries to colleagues',
          ],
        },
        personalizedFor: {
          workingStyle: { focusPatterns: workingStyle.focusPatterns },
          recentPatterns: ['focus-patterns'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    // Recommend energy restoration based on current context
    if (context?.recentActivity === 'high') {
      recommendations.push({
        id: `energy-restore-${Date.now()}`,
        category: 'energy_optimization',
        title: 'Restore Your Energy',
        description:
          "You've been highly active recently. Consider taking a longer break or switching to lighter tasks.",
        reasoning:
          'High activity periods should be balanced with recovery time to maintain sustainable productivity.',
        confidence: 70,
        estimatedImpact: 60,
        difficulty: 'easy',
        timeToImplement: 5,
        actions: {
          primary: 'Take a 10-15 minute break',
          secondary: [
            'Do some light stretching',
            'Switch to administrative tasks',
          ],
        },
        personalizedFor: {
          workingStyle: {},
          recentPatterns: ['high-activity'],
          userPreferences: {},
        },
        validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000), // Valid for 2 hours
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  private generateFocusImprovementRecommendations(
    workingStyle: WorkingStyle,
    patternAnalysis: PatternAnalysis
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    // Recommend focus techniques based on efficiency
    if (patternAnalysis.insights.focusEfficiency < 70) {
      recommendations.push({
        id: `focus-technique-${Date.now()}`,
        category: 'focus_improvement',
        title: 'Improve Focus Efficiency',
        description: `Your focus efficiency is ${patternAnalysis.insights.focusEfficiency.toFixed(1)}%. Try the Pomodoro Technique to improve concentration.`,
        reasoning:
          'Structured work intervals can significantly improve focus and reduce distractions.',
        confidence: 80,
        estimatedImpact: 75,
        difficulty: 'easy',
        timeToImplement: 5,
        actions: {
          primary: 'Use 25-minute focused work sessions',
          secondary: [
            'Eliminate distractions before starting',
            'Take 5-minute breaks between sessions',
          ],
        },
        personalizedFor: {
          workingStyle: {},
          recentPatterns: ['low-focus-efficiency'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    // Recommend environment optimization
    if (workingStyle.averageTaskDuration > 60) {
      recommendations.push({
        id: `focus-environment-${Date.now()}`,
        category: 'focus_improvement',
        title: 'Optimize Your Work Environment',
        description:
          'Since you work in longer sessions, ensure your workspace is comfortable and distraction-free.',
        reasoning:
          'Longer work sessions require a well-optimized environment to maintain focus.',
        confidence: 70,
        estimatedImpact: 65,
        difficulty: 'medium',
        timeToImplement: 20,
        actions: {
          primary: 'Set up a dedicated, comfortable workspace',
          secondary: [
            'Adjust lighting and temperature',
            'Remove visual distractions',
          ],
        },
        personalizedFor: {
          workingStyle: {
            averageTaskDuration: workingStyle.averageTaskDuration,
          },
          recentPatterns: ['long-sessions'],
          userPreferences: {},
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  private async findSimilarHistoricalSituations(
    _context: unknown,
    _patternAnalysis: PatternAnalysis
  ): Promise<unknown[]> {
    // This would analyze historical data to find similar situations
    // For now, return empty array as placeholder
    return [];
  }

  private generateTaskSpecificAdvice(
    task: Task,
    workingStyle: WorkingStyle,
    _similarSituations: unknown[]
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    // Advice based on task priority and working style
    if (
      task.priority === Priority.HIGH &&
      workingStyle.focusPatterns !== 'flexible'
    ) {
      suggestions.push({
        id: `task-timing-${Date.now()}`,
        type: 'schedule',
        title: 'Optimal Timing for High-Priority Task',
        description: `This high-priority task would be best tackled during your ${workingStyle.focusPatterns} focus period.`,
        confidence: 80,
        actionable: true,
        priority: Priority.MEDIUM,
        estimatedImpact: 75,
        reasoning: `Your focus patterns show peak performance during ${workingStyle.focusPatterns} hours.`,
        createdAt: new Date(),
      });
    }

    // Advice based on task duration estimate
    if (
      task.timeEstimate &&
      task.timeEstimate > workingStyle.averageTaskDuration * 2
    ) {
      suggestions.push({
        id: `task-breakdown-${Date.now()}`,
        type: 'task',
        title: 'Consider Breaking Down This Task',
        description: `This task (${task.timeEstimate} min) is much longer than your typical ${Math.round(workingStyle.averageTaskDuration)} min tasks. Consider breaking it into smaller parts.`,
        confidence: 75,
        actionable: true,
        priority: Priority.MEDIUM,
        estimatedImpact: 70,
        reasoning:
          'Tasks significantly longer than your average tend to have lower completion rates.',
        createdAt: new Date(),
      });
    }

    return suggestions;
  }

  private generateTimeBasedAdvice(
    hour: number,
    _day: number,
    workingStyle: WorkingStyle,
    _patternAnalysis: PatternAnalysis
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    // Find energy level for current hour
    const currentEnergyPattern = workingStyle.energyLevels.find(pattern => {
      const startHour = parseInt(pattern.timeSlot.start.split(':')[0]);
      return startHour === hour;
    });

    if (currentEnergyPattern) {
      if (currentEnergyPattern.averageEnergy > 80) {
        suggestions.push({
          id: `time-high-energy-${Date.now()}`,
          type: 'energy',
          title: 'High Energy Period',
          description: `This is typically a high-energy time for you (${currentEnergyPattern.averageEnergy.toFixed(1)}% productivity). Perfect for challenging tasks!`,
          confidence: currentEnergyPattern.confidence,
          actionable: true,
          priority: Priority.MEDIUM,
          estimatedImpact: 80,
          reasoning: 'Historical data shows peak performance during this hour.',
          createdAt: new Date(),
        });
      } else if (currentEnergyPattern.averageEnergy < 50) {
        suggestions.push({
          id: `time-low-energy-${Date.now()}`,
          type: 'energy',
          title: 'Lower Energy Period',
          description: `Your energy is typically lower now (${currentEnergyPattern.averageEnergy.toFixed(1)}% productivity). Consider lighter tasks or taking a break.`,
          confidence: currentEnergyPattern.confidence,
          actionable: true,
          priority: Priority.LOW,
          estimatedImpact: 60,
          reasoning:
            'Historical data shows reduced performance during this hour.',
          createdAt: new Date(),
        });
      }
    }

    return suggestions;
  }

  private generatePerformanceBasedAdvice(
    performance: 'high' | 'medium' | 'low',
    _workingStyle: WorkingStyle,
    _patternAnalysis: PatternAnalysis
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    switch (performance) {
      case 'high':
        suggestions.push({
          id: `perf-high-${Date.now()}`,
          type: 'productivity',
          title: 'Riding the Wave',
          description:
            "You're performing well! Consider tackling that challenging task you've been putting off.",
          confidence: 85,
          actionable: true,
          priority: Priority.MEDIUM,
          estimatedImpact: 75,
          reasoning:
            'High performance periods are ideal for difficult or important tasks.',
          createdAt: new Date(),
        });
        break;

      case 'low':
        suggestions.push({
          id: `perf-low-${Date.now()}`,
          type: 'break',
          title: 'Time to Recharge',
          description:
            'Your recent performance suggests you might benefit from a break or switching to easier tasks.',
          confidence: 75,
          actionable: true,
          priority: Priority.HIGH,
          estimatedImpact: 70,
          reasoning:
            'Low performance periods often indicate fatigue or need for recovery.',
          createdAt: new Date(),
        });
        break;

      case 'medium':
        suggestions.push({
          id: `perf-medium-${Date.now()}`,
          type: 'productivity',
          title: 'Steady Progress',
          description:
            "You're maintaining steady progress. This is a good time for routine tasks and planning.",
          confidence: 70,
          actionable: true,
          priority: Priority.LOW,
          estimatedImpact: 60,
          reasoning:
            'Medium performance periods are suitable for consistent, moderate-difficulty work.',
          createdAt: new Date(),
        });
        break;
    }

    return suggestions;
  }

  private generateDeadlineBasedAdvice(
    deadlines: Task[],
    workingStyle: WorkingStyle,
    _patternAnalysis: PatternAnalysis
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    const urgentTasks = deadlines.filter(task => {
      if (!task.dueDate) {
        return false;
      }
      const daysUntilDue =
        (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilDue <= 2;
    });

    if (urgentTasks.length > 0) {
      suggestions.push({
        id: `deadline-urgent-${Date.now()}`,
        type: 'schedule',
        title: 'Urgent Deadlines Approaching',
        description: `You have ${urgentTasks.length} task(s) due within 2 days. Consider prioritizing these during your next high-energy period.`,
        confidence: 90,
        actionable: true,
        priority: Priority.HIGH,
        estimatedImpact: 85,
        reasoning:
          'Urgent deadlines require immediate attention and optimal scheduling.',
        actions: urgentTasks.map(task => ({
          type: 'SCHEDULE_FOCUS',
          parameters: {
            taskId: task.id,
            suggestedTime: workingStyle.energyLevels[0]?.timeSlot,
          },
          context: {
            currentTask: undefined,
            activeSession: undefined,
            activeFocusSession: undefined,
            focusMode: false,
            timeOfDay: new Date().toTimeString().slice(0, 5),
            dayOfWeek: new Date().getDay(),
            currentEnergy: 75,
            recentActivity: [],
            preferences: {
              workingHours: { start: '09:00', end: '17:00' },
              breakPreferences: {
                shortBreakDuration: 5,
                longBreakDuration: 15,
                breakInterval: 25,
              },
              focusPreferences: {
                defaultDuration: 25,
                distractionLevel: DistractionLevel.MODERATE,
                backgroundAudio: { enabled: false, volume: 50, type: 'nature' },
              },
              notifications: {
                breakReminders: true,
                taskDeadlines: true,
                dailySummary: true,
                weeklyReview: true,
              },
              aiSettings: {
                conversationHistory: true,
                autoSuggestions: true,
                toolPermissions: true,
                responseStyle: 'balanced',
                suggestionFrequency: 'moderate',
                showInteractionLogs: false,
              },
              taskSettings: {
                defaultPriority: Priority.MEDIUM,
                autoScheduling: false,
                smartDependencies: false,
                weekStartDay: 1,
                showCompletedTasks: false,
                compactView: false,
              },
              soundSettings: {
                hapticFeedback: true,
                completionSound: true,
                soundVolume: 70,
              },
              theme: 'auto' as const,
              language: 'en',
              dateFormat: 'DD/MM/YYYY' as const,
            },
          }, // This would be filled with actual app context
          confidence: 90,
          reasoning:
            'Urgent deadline requires immediate attention during peak energy period',
        })),
        createdAt: new Date(),
      });
    }

    return suggestions;
  }
}
