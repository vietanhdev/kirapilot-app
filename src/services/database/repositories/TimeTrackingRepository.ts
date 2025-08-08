// Time tracking repository for database operations
import { getDatabase, executeTransaction } from '../index';
import { 
  TimerSession, 
  CompletedSession, 
  TimerBreak 
} from '../../../types';
import { 
  timerSessionToDbRow, 
  dbRowToTimerSession 
} from '../../../utils/transformations';
import { validateTimerSession } from '../../../types/validation';
import { generateId } from '../../../utils';

export class TimeTrackingRepository {
  /**
   * Start a new timer session
   */
  async startSession(taskId: string, notes?: string): Promise<TimerSession> {
    return await executeTransaction(async (db) => {
      // Check if there's already an active session
      const activeSession = await this.getActiveSession();
      if (activeSession) {
        throw new Error('Another timer session is already active');
      }

      // Verify task exists
      const taskExists = await db.select<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM tasks WHERE id = ?',
        [taskId]
      );
      
      if (taskExists[0]?.count === 0) {
        throw new Error(`Task with id ${taskId} not found`);
      }

      const session: TimerSession = {
        id: generateId(),
        taskId,
        startTime: new Date(),
        pausedTime: 0,
        isActive: true,
        notes: notes || '',
        breaks: [],
        createdAt: new Date()
      };

      // Validate session
      const validation = validateTimerSession(session);
      if (!validation.success) {
        throw new Error(`Invalid session data: ${validation.error.issues.map(i => i.message).join(', ')}`);
      }

      const dbRow = timerSessionToDbRow(session);
      await db.execute(`
        INSERT INTO time_sessions (
          id, task_id, start_time, end_time, paused_time,
          is_active, notes, breaks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbRow.id, dbRow.task_id, dbRow.start_time, dbRow.end_time,
        dbRow.paused_time, dbRow.is_active, dbRow.notes, dbRow.breaks, dbRow.created_at
      ]);

      return session;
    });
  }

  /**
   * Pause active session
   */
  async pauseSession(sessionId: string): Promise<TimerSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      if (!session.isActive) {
        throw new Error('Session is not active');
      }

      // Calculate additional paused time since last resume
      const now = new Date();
      const additionalPausedTime = now.getTime() - session.startTime.getTime();
      
      const updatedSession: TimerSession = {
        ...session,
        pausedTime: session.pausedTime + additionalPausedTime,
        isActive: false
      };

      const dbRow = timerSessionToDbRow(updatedSession);
      await db.execute(
        'UPDATE time_sessions SET paused_time = ?, is_active = ? WHERE id = ?',
        [dbRow.paused_time, dbRow.is_active, sessionId]
      );

      return updatedSession;
    });
  }

  /**
   * Resume paused session
   */
  async resumeSession(sessionId: string): Promise<TimerSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      if (session.isActive) {
        throw new Error('Session is already active');
      }

      // Check if there's another active session
      const activeSession = await this.getActiveSession();
      if (activeSession && activeSession.id !== sessionId) {
        throw new Error('Another timer session is already active');
      }

      const updatedSession: TimerSession = {
        ...session,
        startTime: new Date(), // Reset start time for resume
        isActive: true
      };

      const dbRow = timerSessionToDbRow(updatedSession);
      await db.execute(
        'UPDATE time_sessions SET start_time = ?, is_active = ? WHERE id = ?',
        [dbRow.start_time, dbRow.is_active, sessionId]
      );

      return updatedSession;
    });
  }

  /**
   * Stop session and mark as completed
   */
  async stopSession(sessionId: string, notes?: string): Promise<CompletedSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const endTime = new Date();
      const totalDuration = endTime.getTime() - session.createdAt.getTime();
      const actualWork = totalDuration - session.pausedTime;

      // Update session
      await db.execute(`
        UPDATE time_sessions SET 
          end_time = ?, 
          is_active = ?, 
          notes = ?
        WHERE id = ?
      `, [endTime.toISOString(), false, notes || session.notes, sessionId]);

      // Update task's actual time
      await db.execute(`
        UPDATE tasks SET 
          actual_time = actual_time + ?,
          updated_at = ?
        WHERE id = ?
      `, [Math.round(actualWork / (1000 * 60)), new Date().toISOString(), session.taskId]);

      const completedSession: CompletedSession = {
        id: session.id,
        taskId: session.taskId,
        duration: totalDuration,
        actualWork,
        breaks: session.breaks,
        notes: notes || session.notes,
        productivity: this.calculateProductivityScore(totalDuration, actualWork, session.breaks.length),
        createdAt: session.createdAt
      };

      return completedSession;
    });
  }

  /**
   * Add break to active session
   */
  async addBreak(sessionId: string, reason: string, duration: number): Promise<TimerSession> {
    return await executeTransaction(async (db) => {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const now = new Date();
      const breakItem: TimerBreak = {
        id: generateId(),
        startTime: new Date(now.getTime() - duration),
        endTime: now,
        reason
      };

      const updatedBreaks = [...session.breaks, breakItem];
      const updatedSession: TimerSession = {
        ...session,
        breaks: updatedBreaks,
        pausedTime: session.pausedTime + duration
      };

      const dbRow = timerSessionToDbRow(updatedSession);
      await db.execute(
        'UPDATE time_sessions SET breaks = ?, paused_time = ? WHERE id = ?',
        [dbRow.breaks, dbRow.paused_time, sessionId]
      );

      return updatedSession;
    });
  }

  /**
   * Get active session
   */
  async getActiveSession(): Promise<TimerSession | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE is_active = ? LIMIT 1',
      [true]
    );

    return result.length > 0 ? dbRowToTimerSession(result[0]) : null;
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<TimerSession | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE id = ?',
      [id]
    );

    return result.length > 0 ? dbRowToTimerSession(result[0]) : null;
  }

  /**
   * Get sessions by task
   */
  async getByTask(taskId: string): Promise<TimerSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE task_id = ? ORDER BY created_at DESC',
      [taskId]
    );

    return result.map(row => dbRowToTimerSession(row));
  }

  /**
   * Get sessions by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<TimerSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC',
      [startDate.toISOString(), endDate.toISOString()]
    );

    return result.map(row => dbRowToTimerSession(row));
  }

  /**
   * Get today's sessions
   */
  async getTodaySessions(): Promise<TimerSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getByDateRange(today, tomorrow);
  }

  /**
   * Get session statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalSessions: number;
    totalTime: number;
    totalWorkTime: number;
    totalBreakTime: number;
    averageSessionLength: number;
    averageProductivity: number;
    mostProductiveHour: number;
    sessionsPerDay: Record<string, number>;
  }> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM time_sessions WHERE end_time IS NOT NULL';
    const params: any[] = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    const sessions = await db.select<any[]>(query, params);
    const completedSessions = sessions.map(row => dbRowToTimerSession(row));

    if (completedSessions.length === 0) {
      return {
        totalSessions: 0,
        totalTime: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        averageSessionLength: 0,
        averageProductivity: 0,
        mostProductiveHour: 9,
        sessionsPerDay: {}
      };
    }

    let totalTime = 0;
    let totalBreakTime = 0;
    const hourCounts: Record<number, number> = {};
    const dailyCounts: Record<string, number> = {};

    for (const session of completedSessions) {
      if (session.endTime) {
        const duration = session.endTime.getTime() - session.startTime.getTime();
        totalTime += duration;
        totalBreakTime += session.pausedTime;

        // Track sessions by hour
        const hour = session.startTime.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        // Track sessions by day
        const day = session.startTime.toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }
    }

    const totalWorkTime = totalTime - totalBreakTime;
    const averageSessionLength = totalTime / completedSessions.length;
    const averageProductivity = totalWorkTime / totalTime * 100;

    // Find most productive hour
    const mostProductiveHour = Object.entries(hourCounts)
      .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, { hour: 9, count: 0 })
      .hour;

    return {
      totalSessions: completedSessions.length,
      totalTime,
      totalWorkTime,
      totalBreakTime,
      averageSessionLength,
      averageProductivity,
      mostProductiveHour,
      sessionsPerDay: dailyCounts
    };
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    
    const session = await this.findById(id);
    if (!session) {
      throw new Error(`Session with id ${id} not found`);
    }

    await db.execute('DELETE FROM time_sessions WHERE id = ?', [id]);
  }

  /**
   * Get incomplete sessions (sessions without end time)
   */
  async getIncompleteSessions(): Promise<TimerSession[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE end_time IS NULL ORDER BY created_at DESC'
    );

    return result.map(row => dbRowToTimerSession(row));
  }

  /**
   * Calculate productivity score based on session metrics
   */
  private calculateProductivityScore(totalDuration: number, actualWork: number, breakCount: number): number {
    if (totalDuration === 0) return 0;

    const workRatio = actualWork / totalDuration;
    const breakPenalty = Math.min(breakCount * 0.05, 0.3); // Max 30% penalty for breaks
    
    return Math.max(0, Math.min(100, (workRatio * 100) - (breakPenalty * 100)));
  }

  /**
   * Get time tracking summary for a specific period
   */
  async getTimeSummary(startDate: Date, endDate: Date): Promise<{
    totalHours: number;
    workingHours: number;
    breakHours: number;
    sessionsCount: number;
    tasksWorkedOn: number;
    averageFocusTime: number;
    productivityScore: number;
  }> {
    const sessions = await this.getByDateRange(startDate, endDate);
    const completedSessions = sessions.filter(s => s.endTime);

    if (completedSessions.length === 0) {
      return {
        totalHours: 0,
        workingHours: 0,
        breakHours: 0,
        sessionsCount: 0,
        tasksWorkedOn: 0,
        averageFocusTime: 0,
        productivityScore: 0
      };
    }

    let totalTime = 0;
    let totalBreakTime = 0;
    const uniqueTasks = new Set<string>();

    for (const session of completedSessions) {
      if (session.endTime) {
        const duration = session.endTime.getTime() - session.startTime.getTime();
        totalTime += duration;
        totalBreakTime += session.pausedTime;
        uniqueTasks.add(session.taskId);
      }
    }

    const workingTime = totalTime - totalBreakTime;
    const averageFocusTime = workingTime / completedSessions.length;
    const productivityScore = totalTime > 0 ? (workingTime / totalTime) * 100 : 0;

    return {
      totalHours: totalTime / (1000 * 60 * 60),
      workingHours: workingTime / (1000 * 60 * 60),
      breakHours: totalBreakTime / (1000 * 60 * 60),
      sessionsCount: completedSessions.length,
      tasksWorkedOn: uniqueTasks.size,
      averageFocusTime: averageFocusTime / (1000 * 60), // in minutes
      productivityScore
    };
  }
}