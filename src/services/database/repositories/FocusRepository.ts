// Focus session repository for database operations
import { getDatabase, executeTransaction } from '../index';
import { 
  FocusSession, 
  FocusConfig, 
  FocusMetrics, 
  FocusBreak
} from '../../../types';
import { 
  focusSessionToDbRow, 
  dbRowToFocusSession 
} from '../../../utils/transformations';
import { validateFocusConfig } from '../../../types/validation';
import { generateId } from '../../../utils';

export class FocusRepository {
  /**
   * Start a new focus session
   */
  async startSession(config: FocusConfig): Promise<FocusSession> {
    // Validate config
    const validation = validateFocusConfig(config);
    if (!validation.success) {
      throw new Error(`Invalid focus config: ${validation.error.issues.map(i => i.message).join(', ')}`);
    }

    return await executeTransaction(async (db) => {
      // Check if there's already an active focus session
      const activeSession = await this.getActiveSession();
      if (activeSession) {
        throw new Error('Another focus session is already active');
      }

      // Verify task exists
      const taskExists = await db.select<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM tasks WHERE id = ?',
        [config.taskId]
      );
      
      if (taskExists[0]?.count === 0) {
        throw new Error(`Task with id ${config.taskId} not found`);
      }

      const session: FocusSession = {
        id: generateId(),
        taskId: config.taskId,
        plannedDuration: config.duration,
        distractionCount: 0,
        distractionLevel: config.distractionLevel,
        backgroundAudio: config.backgroundAudio,
        notes: '',
        breaks: [],
        metrics: {
          totalDistractions: 0,
          longestFocusStreak: 0,
          averageFocusStreak: 0,
          productivityScore: 0,
          energyLevel: 100
        },
        createdAt: new Date()
      };

      const dbRow = focusSessionToDbRow(session);
      await db.execute(`
        INSERT INTO focus_sessions (
          id, task_id, planned_duration, actual_duration, focus_score,
          distraction_count, distraction_level, background_audio, notes,
          breaks, metrics, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbRow.id, dbRow.task_id, dbRow.planned_duration, dbRow.actual_duration,
        dbRow.focus_score, dbRow.distraction_count, dbRow.distraction_level,
        dbRow.background_audio, dbRow.notes, dbRow.breaks, dbRow.metrics,
        dbRow.created_at, dbRow.completed_at
      ]);

      return session;
    });
  }

  /**
   * Complete focus session
   */
  async completeSession(sessionId: string, notes?: string): Promise<FocusSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Focus session with id ${sessionId} not found`);
      }

      if (session.completedAt) {
        throw new Error('Focus session is already completed');
      }

      const completedAt = new Date();
      const actualDuration = Math.round((completedAt.getTime() - session.createdAt.getTime()) / (1000 * 60));
      
      // Calculate final metrics
      const finalMetrics = this.calculateFinalMetrics(session, actualDuration);
      const focusScore = this.calculateFocusScore(session, actualDuration);

      const updatedSession: FocusSession = {
        ...session,
        actualDuration,
        focusScore,
        notes: notes || session.notes,
        metrics: finalMetrics,
        completedAt
      };

      const dbRow = focusSessionToDbRow(updatedSession);
      await db.execute(`
        UPDATE focus_sessions SET 
          actual_duration = ?,
          focus_score = ?,
          notes = ?,
          metrics = ?,
          completed_at = ?
        WHERE id = ?
      `, [
        dbRow.actual_duration, dbRow.focus_score, dbRow.notes,
        dbRow.metrics, dbRow.completed_at, sessionId
      ]);

      return updatedSession;
    });
  }

  /**
   * Add distraction to session
   */
  async addDistraction(sessionId: string, reason?: string): Promise<FocusSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Focus session with id ${sessionId} not found`);
      }

      if (session.completedAt) {
        throw new Error('Cannot add distraction to completed session');
      }

      const now = new Date();
      const distractionBreak: FocusBreak = {
        id: generateId(),
        startTime: now,
        endTime: now,
        type: 'distraction',
        reason: reason || 'Unspecified distraction'
      };

      const updatedSession: FocusSession = {
        ...session,
        distractionCount: session.distractionCount + 1,
        breaks: [...session.breaks, distractionBreak],
        metrics: {
          ...session.metrics,
          totalDistractions: session.metrics.totalDistractions + 1
        }
      };

      const dbRow = focusSessionToDbRow(updatedSession);
      await db.execute(`
        UPDATE focus_sessions SET 
          distraction_count = ?,
          breaks = ?,
          metrics = ?
        WHERE id = ?
      `, [
        dbRow.distraction_count, dbRow.breaks, dbRow.metrics, sessionId
      ]);

      return updatedSession;
    });
  }

  /**
   * Add planned break to session
   */
  async addPlannedBreak(sessionId: string, duration: number, reason?: string): Promise<FocusSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Focus session with id ${sessionId} not found`);
      }

      if (session.completedAt) {
        throw new Error('Cannot add break to completed session');
      }

      const now = new Date();
      const plannedBreak: FocusBreak = {
        id: generateId(),
        startTime: new Date(now.getTime() - duration * 1000),
        endTime: now,
        type: 'planned',
        reason: reason || 'Planned break'
      };

      const updatedSession: FocusSession = {
        ...session,
        breaks: [...session.breaks, plannedBreak]
      };

      const dbRow = focusSessionToDbRow(updatedSession);
      await db.execute(
        'UPDATE focus_sessions SET breaks = ? WHERE id = ?',
        [dbRow.breaks, sessionId]
      );

      return updatedSession;
    });
  }

  /**
   * Update session energy level
   */
  async updateEnergyLevel(sessionId: string, energyLevel: number): Promise<FocusSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Focus session with id ${sessionId} not found`);
      }

      const updatedMetrics: FocusMetrics = {
        ...session.metrics,
        energyLevel: Math.max(0, Math.min(100, energyLevel))
      };

      const updatedSession: FocusSession = {
        ...session,
        metrics: updatedMetrics
      };

      const dbRow = focusSessionToDbRow(updatedSession);
      await db.execute(
        'UPDATE focus_sessions SET metrics = ? WHERE id = ?',
        [dbRow.metrics, sessionId]
      );

      return updatedSession;
    });
  }

  /**
   * Get active focus session
   */
  async getActiveSession(): Promise<FocusSession | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM focus_sessions WHERE completed_at IS NULL LIMIT 1'
    );

    return result.length > 0 ? dbRowToFocusSession(result[0]) : null;
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<FocusSession | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM focus_sessions WHERE id = ?',
      [id]
    );

    return result.length > 0 ? dbRowToFocusSession(result[0]) : null;
  }

  /**
   * Get sessions by task
   */
  async getByTask(taskId: string): Promise<FocusSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM focus_sessions WHERE task_id = ? ORDER BY created_at DESC',
      [taskId]
    );

    return result.map(row => dbRowToFocusSession(row));
  }

  /**
   * Get sessions by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<FocusSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM focus_sessions WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC',
      [startDate.toISOString(), endDate.toISOString()]
    );

    return result.map(row => dbRowToFocusSession(row));
  }

  /**
   * Get today's sessions
   */
  async getTodaySessions(): Promise<FocusSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getByDateRange(today, tomorrow);
  }

  /**
   * Get focus statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalFocusTime: number;
    averageFocusScore: number;
    averageDistractions: number;
    bestFocusStreak: number;
    mostProductiveTime: string;
    distractionTypes: Record<string, number>;
  }> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM focus_sessions';
    const params: any[] = [];

    if (startDate) {
      query += ' WHERE created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      const whereClause = startDate ? ' AND' : ' WHERE';
      query += `${whereClause} created_at <= ?`;
      params.push(endDate.toISOString());
    }

    const sessions = await db.select<any[]>(query, params);
    const focusSessions = sessions.map(row => dbRowToFocusSession(row));

    if (focusSessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalFocusTime: 0,
        averageFocusScore: 0,
        averageDistractions: 0,
        bestFocusStreak: 0,
        mostProductiveTime: '09:00',
        distractionTypes: {}
      };
    }

    const completedSessions = focusSessions.filter(s => s.completedAt);
    let totalFocusTime = 0;
    let totalFocusScore = 0;
    let totalDistractions = 0;
    let bestFocusStreak = 0;
    const hourCounts: Record<number, { sessions: number; avgScore: number }> = {};
    const distractionTypes: Record<string, number> = {};

    for (const session of completedSessions) {
      if (session.actualDuration) {
        totalFocusTime += session.actualDuration;
      }
      
      if (session.focusScore) {
        totalFocusScore += session.focusScore;
      }

      totalDistractions += session.distractionCount;
      
      if (session.metrics.longestFocusStreak > bestFocusStreak) {
        bestFocusStreak = session.metrics.longestFocusStreak;
      }

      // Track sessions by hour
      const hour = session.createdAt.getHours();
      if (!hourCounts[hour]) {
        hourCounts[hour] = { sessions: 0, avgScore: 0 };
      }
      hourCounts[hour].sessions++;
      hourCounts[hour].avgScore += session.focusScore || 0;

      // Track distraction types
      for (const breakItem of session.breaks) {
        if (breakItem.type === 'distraction' && breakItem.reason) {
          distractionTypes[breakItem.reason] = (distractionTypes[breakItem.reason] || 0) + 1;
        }
      }
    }

    // Find most productive time
    let mostProductiveHour = 9;
    let bestScore = 0;
    for (const [hour, data] of Object.entries(hourCounts)) {
      const avgScore = data.avgScore / data.sessions;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        mostProductiveHour = parseInt(hour);
      }
    }

    const mostProductiveTime = `${mostProductiveHour.toString().padStart(2, '0')}:00`;

    return {
      totalSessions: focusSessions.length,
      completedSessions: completedSessions.length,
      totalFocusTime,
      averageFocusScore: completedSessions.length > 0 ? totalFocusScore / completedSessions.length : 0,
      averageDistractions: completedSessions.length > 0 ? totalDistractions / completedSessions.length : 0,
      bestFocusStreak,
      mostProductiveTime,
      distractionTypes
    };
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    
    const session = await this.findById(id);
    if (!session) {
      throw new Error(`Focus session with id ${id} not found`);
    }

    await db.execute('DELETE FROM focus_sessions WHERE id = ?', [id]);
  }

  /**
   * Get incomplete sessions
   */
  async getIncompleteSessions(): Promise<FocusSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM focus_sessions WHERE completed_at IS NULL ORDER BY created_at DESC'
    );

    return result.map(row => dbRowToFocusSession(row));
  }

  /**
   * Calculate final metrics for completed session
   */
  private calculateFinalMetrics(session: FocusSession, actualDuration: number): FocusMetrics {
    const plannedMinutes = session.plannedDuration;
    const actualMinutes = actualDuration;
    
    // Calculate focus streaks
    const distractionBreaks = session.breaks.filter(b => b.type === 'distraction');
    const focusStreaks = this.calculateFocusStreaks(session.createdAt, distractionBreaks, actualMinutes);
    
    const longestFocusStreak = Math.max(...focusStreaks, 0);
    const averageFocusStreak = focusStreaks.length > 0 ? focusStreaks.reduce((a, b) => a + b, 0) / focusStreaks.length : 0;

    // Calculate productivity score
    const completionRatio = Math.min(actualMinutes / plannedMinutes, 1);
    const distractionPenalty = Math.min(session.distractionCount * 0.1, 0.5);
    const productivityScore = Math.max(0, (completionRatio * 100) - (distractionPenalty * 100));

    return {
      totalDistractions: session.distractionCount,
      longestFocusStreak,
      averageFocusStreak,
      productivityScore,
      energyLevel: session.metrics.energyLevel
    };
  }

  /**
   * Calculate focus score
   */
  private calculateFocusScore(session: FocusSession, actualDuration: number): number {
    const plannedMinutes = session.plannedDuration;
    const actualMinutes = actualDuration;
    
    // Base score from completion ratio
    const completionScore = Math.min(actualMinutes / plannedMinutes, 1) * 50;
    
    // Distraction penalty
    const distractionPenalty = Math.min(session.distractionCount * 5, 30);
    
    // Duration bonus (longer sessions get slight bonus)
    const durationBonus = Math.min(actualMinutes / 60, 1) * 10;
    
    // Energy level contribution
    const energyContribution = (session.metrics.energyLevel / 100) * 20;
    
    return Math.max(0, Math.min(100, completionScore - distractionPenalty + durationBonus + energyContribution));
  }

  /**
   * Calculate focus streaks between distractions
   */
  private calculateFocusStreaks(startTime: Date, distractions: FocusBreak[], totalMinutes: number): number[] {
    if (distractions.length === 0) {
      return [totalMinutes];
    }

    const streaks: number[] = [];
    let lastTime = startTime.getTime();

    // Sort distractions by time
    const sortedDistractions = distractions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (const distraction of sortedDistractions) {
      const streakDuration = (distraction.startTime.getTime() - lastTime) / (1000 * 60);
      if (streakDuration > 0) {
        streaks.push(streakDuration);
      }
      lastTime = distraction.endTime.getTime();
    }

    // Add final streak
    const endTime = startTime.getTime() + (totalMinutes * 60 * 1000);
    const finalStreak = (endTime - lastTime) / (1000 * 60);
    if (finalStreak > 0) {
      streaks.push(finalStreak);
    }

    return streaks;
  }

  /**
   * Get focus session summary for a specific period
   */
  async getFocusSummary(startDate: Date, endDate: Date): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalFocusHours: number;
    averageSessionLength: number;
    averageFocusScore: number;
    totalDistractions: number;
    mostCommonDistraction: string;
    focusEfficiency: number;
  }> {
    const sessions = await this.getByDateRange(startDate, endDate);
    const completedSessions = sessions.filter(s => s.completedAt);

    if (completedSessions.length === 0) {
      return {
        totalSessions: sessions.length,
        completedSessions: 0,
        totalFocusHours: 0,
        averageSessionLength: 0,
        averageFocusScore: 0,
        totalDistractions: 0,
        mostCommonDistraction: 'None',
        focusEfficiency: 0
      };
    }

    let totalFocusTime = 0;
    let totalFocusScore = 0;
    let totalDistractions = 0;
    const distractionReasons: Record<string, number> = {};

    for (const session of completedSessions) {
      totalFocusTime += session.actualDuration || 0;
      totalFocusScore += session.focusScore || 0;
      totalDistractions += session.distractionCount;

      // Count distraction reasons
      for (const breakItem of session.breaks) {
        if (breakItem.type === 'distraction' && breakItem.reason) {
          distractionReasons[breakItem.reason] = (distractionReasons[breakItem.reason] || 0) + 1;
        }
      }
    }

    const mostCommonDistraction = Object.entries(distractionReasons)
      .reduce((max, [reason, count]) => count > max.count ? { reason, count } : max, { reason: 'None', count: 0 })
      .reason;

    const averageSessionLength = totalFocusTime / completedSessions.length;
    const averageFocusScore = totalFocusScore / completedSessions.length;
    const focusEfficiency = averageFocusScore / 100;

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalFocusHours: totalFocusTime / 60,
      averageSessionLength,
      averageFocusScore,
      totalDistractions,
      mostCommonDistraction,
      focusEfficiency
    };
  }
}