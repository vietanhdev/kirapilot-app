// Pattern repository for productivity analytics
import { getDatabase, executeTransaction } from '../index';
import { 
  ProductivityPattern, 
  EnergyPattern, 
  TimeSlot, 
  PatternAnalysis,
  TrendData 
} from '../../../types';
import { generateId } from '../../../utils';

export class PatternRepository {
  /**
   * Record productivity data point
   */
  async recordProductivityData(
    userId: string,
    patternType: 'daily' | 'weekly' | 'task_based' | 'energy_based',
    timeSlot: string,
    productivityScore: number,
    confidenceLevel: number = 1.0
  ): Promise<void> {
    return await executeTransaction(async (db) => {
      // Check if pattern already exists
      const existing = await db.select<any[]>(`
        SELECT * FROM productivity_patterns 
        WHERE user_id = ? AND pattern_type = ? AND time_slot = ?
      `, [userId, patternType, timeSlot]);

      if (existing.length > 0) {
        // Update existing pattern with weighted average
        const existingPattern = existing[0];
        const newSampleSize = existingPattern.sample_size + 1;
        const newScore = (
          (existingPattern.productivity_score * existingPattern.sample_size) + productivityScore
        ) / newSampleSize;
        const newConfidence = Math.min(
          (existingPattern.confidence_level * existingPattern.sample_size + confidenceLevel) / newSampleSize,
          1.0
        );

        await db.execute(`
          UPDATE productivity_patterns SET
            productivity_score = ?,
            confidence_level = ?,
            sample_size = ?,
            updated_at = ?
          WHERE id = ?
        `, [newScore, newConfidence, newSampleSize, new Date().toISOString(), existingPattern.id]);
      } else {
        // Create new pattern
        await db.execute(`
          INSERT INTO productivity_patterns (
            id, user_id, pattern_type, time_slot, productivity_score,
            confidence_level, sample_size, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          generateId(), userId, patternType, timeSlot, productivityScore,
          confidenceLevel, 1, new Date().toISOString(), new Date().toISOString()
        ]);
      }
    });
  }

  /**
   * Get productivity patterns by type
   */
  async getPatternsByType(
    userId: string, 
    patternType: 'daily' | 'weekly' | 'task_based' | 'energy_based'
  ): Promise<ProductivityPattern[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(`
      SELECT * FROM productivity_patterns 
      WHERE user_id = ? AND pattern_type = ?
      ORDER BY productivity_score DESC
    `, [userId, patternType]);

    return result.map(row => ({
      id: row.id,
      userId: row.user_id,
      patternType: row.pattern_type,
      timeSlots: this.parseTimeSlot(row.time_slot),
      productivity: row.productivity_score,
      confidence: row.confidence_level,
      sampleSize: row.sample_size,
      lastUpdated: new Date(row.updated_at)
    }));
  }

  /**
   * Get daily productivity patterns
   */
  async getDailyPatterns(userId: string): Promise<EnergyPattern[]> {
    const patterns = await this.getPatternsByType(userId, 'daily');
    
    return patterns.map(pattern => ({
      timeSlot: pattern.timeSlots[0], // Daily patterns have single time slot
      averageEnergy: pattern.productivity,
      confidence: pattern.confidence,
      sampleSize: pattern.sampleSize
    }));
  }

  /**
   * Get optimal work times based on patterns
   */
  async getOptimalWorkTimes(userId: string, limit: number = 5): Promise<TimeSlot[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(`
      SELECT time_slot, productivity_score, confidence_level, sample_size
      FROM productivity_patterns 
      WHERE user_id = ? AND pattern_type = 'daily' AND sample_size >= 3
      ORDER BY (productivity_score * confidence_level) DESC
      LIMIT ?
    `, [userId, limit]);

    return result.map(row => this.parseTimeSlot(row.time_slot)[0]);
  }

  /**
   * Analyze productivity trends
   */
  async analyzeProductivityTrends(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<PatternAnalysis> {
    const db = await getDatabase();
    
    // Get completed tasks in date range
    const tasks = await db.select<any[]>(`
      SELECT * FROM tasks 
      WHERE completed_at >= ? AND completed_at <= ? AND status = 'completed'
      ORDER BY completed_at
    `, [startDate.toISOString(), endDate.toISOString()]);

    // Get focus sessions in date range
    const focusSessions = await db.select<any[]>(`
      SELECT * FROM focus_sessions 
      WHERE created_at >= ? AND created_at <= ? AND completed_at IS NOT NULL
      ORDER BY created_at
    `, [startDate.toISOString(), endDate.toISOString()]);

    // Get time sessions in date range
    const timeSessions = await db.select<any[]>(`
      SELECT * FROM time_sessions 
      WHERE created_at >= ? AND created_at <= ? AND end_time IS NOT NULL
      ORDER BY created_at
    `, [startDate.toISOString(), endDate.toISOString()]);

    // Analyze patterns
    const productivityPatterns = await this.getPatternsByType(userId, 'daily');
    const energyPatterns = await this.getDailyPatterns(userId);
    
    // Generate insights
    const insights = this.generateInsights(tasks, focusSessions, timeSessions, productivityPatterns);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(userId, insights);

    return {
      userId,
      analysisDate: new Date(),
      productivityPatterns,
      energyPatterns,
      recommendations,
      insights
    };
  }

  /**
   * Record task completion for pattern learning
   */
  async recordTaskCompletion(
    userId: string,
    _taskId: string,
    completionTime: Date,
    actualTime: number,
    estimatedTime: number
  ): Promise<void> {
    const hour = completionTime.getHours();
    const dayOfWeek = completionTime.getDay();
    
    // Calculate productivity score based on estimation accuracy and completion
    const estimationAccuracy = estimatedTime > 0 ? Math.min(estimatedTime / actualTime, actualTime / estimatedTime) : 0.5;
    const productivityScore = Math.min(100, estimationAccuracy * 100);

    // Record daily pattern
    const dailyTimeSlot = `${hour}:00-${hour + 1}:00`;
    await this.recordProductivityData(userId, 'daily', dailyTimeSlot, productivityScore);

    // Record weekly pattern
    const weeklyTimeSlot = `${dayOfWeek}-${hour}:00-${hour + 1}:00`;
    await this.recordProductivityData(userId, 'weekly', weeklyTimeSlot, productivityScore);
  }

  /**
   * Record focus session for pattern learning
   */
  async recordFocusSession(
    userId: string,
    sessionStart: Date,
    _duration: number,
    focusScore: number,
    distractionCount: number
  ): Promise<void> {
    const hour = sessionStart.getHours();
    
    // Adjust focus score based on distractions
    const adjustedScore = Math.max(0, focusScore - (distractionCount * 5));

    // Record daily pattern
    const dailyTimeSlot = `${hour}:00-${hour + 1}:00`;
    await this.recordProductivityData(userId, 'daily', dailyTimeSlot, adjustedScore);

    // Record energy-based pattern
    const energyLevel = this.categorizeEnergyLevel(adjustedScore);
    await this.recordProductivityData(userId, 'energy_based', energyLevel, adjustedScore);
  }

  /**
   * Get productivity trend data
   */
  async getProductivityTrend(
    _userId: string, 
    startDate: Date, 
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<TrendData[]> {
    const db = await getDatabase();
    
    let groupBy: string;
    
    switch (granularity) {
      case 'hour':
        groupBy = 'strftime("%Y-%m-%d %H", created_at)';
        break;
      case 'week':
        groupBy = 'strftime("%Y-W%W", created_at)';
        break;
      default: // day
        groupBy = 'DATE(created_at)';
    }

    // Get task completion trend
    const taskTrend = await db.select<any[]>(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as completed_tasks,
        AVG(CASE WHEN time_estimate > 0 THEN (actual_time * 1.0 / time_estimate) ELSE 1 END) as efficiency
      FROM tasks 
      WHERE completed_at >= ? AND completed_at <= ? AND status = 'completed'
      GROUP BY ${groupBy}
      ORDER BY period
    `, [startDate.toISOString(), endDate.toISOString()]);

    // Get focus session trend
    const focusTrend = await db.select<any[]>(`
      SELECT 
        ${groupBy} as period,
        AVG(focus_score) as avg_focus_score,
        COUNT(*) as focus_sessions
      FROM focus_sessions 
      WHERE created_at >= ? AND created_at <= ? AND completed_at IS NOT NULL
      GROUP BY ${groupBy}
      ORDER BY period
    `, [startDate.toISOString(), endDate.toISOString()]);

    // Combine trends
    const trendMap = new Map<string, TrendData>();

    for (const task of taskTrend) {
      const productivity = (task.completed_tasks * 10) + ((1 / task.efficiency) * 50);
      trendMap.set(task.period, {
        timestamp: new Date(task.period),
        value: Math.min(100, productivity),
        type: 'productivity'
      });
    }

    for (const focus of focusTrend) {
      const existing = trendMap.get(focus.period);
      if (existing) {
        // Combine task and focus data
        existing.value = (existing.value + focus.avg_focus_score) / 2;
      } else {
        trendMap.set(focus.period, {
          timestamp: new Date(focus.period),
          value: focus.avg_focus_score,
          type: 'focus'
        });
      }
    }

    return Array.from(trendMap.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear old patterns (for privacy/performance)
   */
  async clearOldPatterns(userId: string, olderThanDays: number = 90): Promise<void> {
    const db = await getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await db.execute(`
      DELETE FROM productivity_patterns 
      WHERE user_id = ? AND updated_at < ? AND sample_size < 5
    `, [userId, cutoffDate.toISOString()]);
  }

  /**
   * Get pattern statistics
   */
  async getPatternStatistics(userId: string): Promise<{
    totalPatterns: number;
    patternsByType: Record<string, number>;
    averageConfidence: number;
    mostReliableTimeSlot: string;
    leastReliableTimeSlot: string;
  }> {
    const db = await getDatabase();
    
    const patterns = await db.select<any[]>(`
      SELECT * FROM productivity_patterns WHERE user_id = ?
    `, [userId]);

    if (patterns.length === 0) {
      return {
        totalPatterns: 0,
        patternsByType: {},
        averageConfidence: 0,
        mostReliableTimeSlot: 'Unknown',
        leastReliableTimeSlot: 'Unknown'
      };
    }

    const patternsByType: Record<string, number> = {};
    let totalConfidence = 0;
    let mostReliable = { timeSlot: 'Unknown', confidence: 0 };
    let leastReliable = { timeSlot: 'Unknown', confidence: 1 };

    for (const pattern of patterns) {
      patternsByType[pattern.pattern_type] = (patternsByType[pattern.pattern_type] || 0) + 1;
      totalConfidence += pattern.confidence_level;

      if (pattern.confidence_level > mostReliable.confidence) {
        mostReliable = { timeSlot: pattern.time_slot, confidence: pattern.confidence_level };
      }

      if (pattern.confidence_level < leastReliable.confidence) {
        leastReliable = { timeSlot: pattern.time_slot, confidence: pattern.confidence_level };
      }
    }

    return {
      totalPatterns: patterns.length,
      patternsByType,
      averageConfidence: totalConfidence / patterns.length,
      mostReliableTimeSlot: mostReliable.timeSlot,
      leastReliableTimeSlot: leastReliable.timeSlot
    };
  }

  /**
   * Parse time slot string into TimeSlot objects
   */
  private parseTimeSlot(timeSlotStr: string): TimeSlot[] {
    // Handle different time slot formats
    if (timeSlotStr.includes('-')) {
      const [start, end] = timeSlotStr.split('-');
      const dayOfWeek = start.includes(':') ? 0 : parseInt(start);
      
      if (start.includes(':')) {
        // Format: "09:00-10:00"
        return [{
          start: start,
          end: end,
          dayOfWeek: 0 // Default to Sunday, should be determined from context
        }];
      } else {
        // Format: "1-09:00-10:00" (day-start-end)
        const [startTime, endTime] = end.split('-');
        return [{
          start: startTime,
          end: endTime,
          dayOfWeek
        }];
      }
    }
    
    // Single time slot
    return [{
      start: timeSlotStr,
      end: timeSlotStr,
      dayOfWeek: 0
    }];
  }

  /**
   * Categorize energy level
   */
  private categorizeEnergyLevel(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium-high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low-medium';
    return 'low';
  }

  /**
   * Generate insights from data
   */
  private generateInsights(
    tasks: any[], 
    focusSessions: any[], 
    _timeSessions: any[], 
    patterns: ProductivityPattern[]
  ) {
    // Find most productive time
    const mostProductivePattern = patterns.reduce((max, pattern) => 
      pattern.productivity > max.productivity ? pattern : max, 
      patterns[0] || { timeSlots: [{ start: '09:00', end: '10:00', dayOfWeek: 1 }], productivity: 0 }
    );

    // Find least productive time
    const leastProductivePattern = patterns.reduce((min, pattern) => 
      pattern.productivity < min.productivity ? pattern : min,
      patterns[0] || { timeSlots: [{ start: '15:00', end: '16:00', dayOfWeek: 1 }], productivity: 100 }
    );

    // Calculate average task duration
    const completedTasks = tasks.filter(t => t.actual_time > 0);
    const averageTaskDuration = completedTasks.length > 0 
      ? completedTasks.reduce((sum, t) => sum + t.actual_time, 0) / completedTasks.length 
      : 0;

    // Calculate completion rate
    const totalTasks = tasks.length;
    const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
    const completionRate = totalTasks > 0 ? (completedTasksCount / totalTasks) * 100 : 0;

    // Calculate focus efficiency
    const completedFocusSessions = focusSessions.filter(s => s.focus_score !== null);
    const focusEfficiency = completedFocusSessions.length > 0
      ? completedFocusSessions.reduce((sum, s) => sum + s.focus_score, 0) / completedFocusSessions.length
      : 0;

    return {
      mostProductiveTime: mostProductivePattern.timeSlots[0],
      leastProductiveTime: leastProductivePattern.timeSlots[0],
      averageTaskDuration,
      completionRate,
      focusEfficiency
    };
  }

  /**
   * Generate AI recommendations based on patterns
   */
  private async generateRecommendations(_userId: string, insights: any) {
    // This would typically integrate with the AI system
    // For now, return basic recommendations based on patterns
    
    const recommendations = [];

    if (insights.focusEfficiency < 70) {
      recommendations.push({
        id: generateId(),
        type: 'focus' as const,
        title: 'Improve Focus Sessions',
        description: 'Your focus efficiency is below optimal. Consider shorter, more frequent focus sessions.',
        confidence: 80,
        actionable: true,
        priority: 2,
        estimatedImpact: 25,
        reasoning: 'Low focus efficiency detected in recent sessions',
        createdAt: new Date()
      });
    }

    if (insights.completionRate < 80) {
      recommendations.push({
        id: generateId(),
        type: 'task' as const,
        title: 'Review Task Planning',
        description: 'Consider breaking down large tasks into smaller, manageable pieces.',
        confidence: 75,
        actionable: true,
        priority: 1,
        estimatedImpact: 30,
        reasoning: 'Task completion rate is below target',
        createdAt: new Date()
      });
    }

    return recommendations;
  }
}