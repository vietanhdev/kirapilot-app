// Time tracking repository for database operations
import { getDatabase, executeTransaction, executeWithoutTransaction } from '../index';
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
  
  private async executeWithRetry(operation: () => Promise<any>, maxRetries = 3, delay = 100): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (error?.message?.includes('database is locked') && attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          console.warn(`Database locked, retrying attempt ${attempt + 1}/${maxRetries}`);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Start a new timer session
   */
  async startSession(taskId: string, notes?: string): Promise<TimerSession> {
    return await executeTransaction(async (db) => {
      // Check if there's already an active session using the transaction db
      const activeSessionResult = await db.select<any[]>(
        'SELECT * FROM time_sessions WHERE is_active = ? LIMIT 1',
        [true]
      );
      
      if (activeSessionResult.length > 0) {
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
        console.error('Timer session validation failed:', {
          session,
          errors: validation.error.issues
        });
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
   * Pause a timer session
   */
  async pauseSession(sessionId: string): Promise<TimerSession> {
    const db = await getDatabase();
    
    // Get session
    const sessionResult = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    
    if (sessionResult.length === 0) {
      throw new Error(`Session with id ${sessionId} not found`);
    }
    
    const session = dbRowToTimerSession(sessionResult[0]);
    
    console.log('Session before pause:', {
      id: session.id,
      taskId: session.taskId,
      isActive: session.isActive,
      startTime: session.startTime.toISOString(),
      pausedTime: session.pausedTime
    });

    if (!session.isActive) {
      console.warn(`Session ${sessionId} is already paused, returning current state`);
      return session; // Already paused, return as-is
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
    console.log('Updating session with values:', {
      sessionId,
      pausedTime: dbRow.paused_time,
      isActive: dbRow.is_active,
      typeof_isActive: typeof dbRow.is_active
    });
    
    const updateResult = await db.execute(
      'UPDATE time_sessions SET paused_time = ?, is_active = ? WHERE id = ?',
      [dbRow.paused_time, dbRow.is_active, sessionId]
    );
    
    console.log('Update result:', {
      rowsAffected: updateResult.rowsAffected,
      lastInsertRowid: updateResult.lastInsertRowid
    });
    
    // If no rows were affected, the WHERE clause didn't match
    if (updateResult.rowsAffected === 0) {
      console.error('UPDATE affected 0 rows - WHERE clause did not match any records');
      // Check if the session still exists
      const recheckResult = await db.select<any[]>(
        'SELECT id, is_active FROM time_sessions WHERE id = ?',
        [sessionId]
      );
      console.error('Session recheck:', recheckResult);
      throw new Error('Failed to update session - session ID not found or WHERE clause failed');
    }
    
    // Verify the update
    const verifyResult = await db.select<any[]>(
      'SELECT is_active FROM time_sessions WHERE id = ?',
      [sessionId]
    );
    
    console.log('Verification result:', {
      found: verifyResult.length > 0,
      is_active: verifyResult[0]?.is_active,
      typeof_is_active: typeof verifyResult[0]?.is_active
    });
    
    // Check if is_active is still truthy (could be 1 or true)
    if (verifyResult.length > 0 && verifyResult[0].is_active) {
      throw new Error('Failed to update session state - database inconsistency');
    }

    console.log(`Session ${sessionId} successfully paused`);
    return updatedSession;
  }

  /**
   * Resume a timer session
   */
  async resumeSession(sessionId: string): Promise<TimerSession> {
    const db = await getDatabase();
    
    // Get session
    const sessionResult = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    
    if (sessionResult.length === 0) {
      throw new Error(`Session with id ${sessionId} not found`);
    }
    
    const session = dbRowToTimerSession(sessionResult[0]);

    if (session.isActive) {
      console.warn(`Session ${sessionId} is already active, returning current state`);
      return session; // Already active, return as-is
    }

    // Check if there's another active session (should not happen with proper state management)
    const activeSessionResult = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE is_active = ? AND id != ? LIMIT 1',
      [1, sessionId] // Use 1 instead of true for SQLite
    );
    
    if (activeSessionResult.length > 0) {
      throw new Error('Another timer session is already active');
    }

    const updatedSession: TimerSession = {
      ...session,
      startTime: new Date(), // Reset start time for resume
      isActive: true
    };

    const dbRow = timerSessionToDbRow(updatedSession);
    console.log('Resuming session with values:', {
      sessionId,
      startTime: dbRow.start_time,
      isActive: dbRow.is_active,
      typeof_isActive: typeof dbRow.is_active
    });
    
    await db.execute(
      'UPDATE time_sessions SET start_time = ?, is_active = ? WHERE id = ?',
      [dbRow.start_time, dbRow.is_active, sessionId]
    );

    // Verify the update
    const verifyResult = await db.select<any[]>(
      'SELECT is_active FROM time_sessions WHERE id = ?',
      [sessionId]
    );
    
    console.log('Resume verification result:', {
      found: verifyResult.length > 0,
      is_active: verifyResult[0]?.is_active,
      typeof_is_active: typeof verifyResult[0]?.is_active
    });
    
    // Check if is_active is falsy (could be 0 or false)
    if (verifyResult.length === 0 || !verifyResult[0].is_active) {
      throw new Error('Failed to update session state - database inconsistency');
    }

    console.log(`Session ${sessionId} successfully resumed`);
    return updatedSession;
  }

  /**
   * Stop session and mark as completed
   */
  async stopSession(sessionId: string, notes?: string): Promise<CompletedSession> {
    return await this.executeWithRetry(async () => {
      const db = await getDatabase();
      
      // Get session
      const sessionResult = await db.select<any[]>(
        'SELECT * FROM time_sessions WHERE id = ?',
        [sessionId]
      );
      
      if (sessionResult.length === 0) {
        throw new Error(`Session with id ${sessionId} not found`);
      }
      
      const session = dbRowToTimerSession(sessionResult[0]);

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

      // Update task's actual time (separate operation with retry)
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
      // Get session using transaction db
      const sessionResult = await db.select<any[]>(
        'SELECT * FROM time_sessions WHERE id = ?',
        [sessionId]
      );
      
      if (sessionResult.length === 0) {
        throw new Error(`Session with id ${sessionId} not found`);
      }
      
      const session = dbRowToTimerSession(sessionResult[0]);

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
   * Get the currently active session
   */
  async getActiveSession(): Promise<TimerSession | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE is_active = ? LIMIT 1',
      [1] // Use 1 instead of true for SQLite
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
    
    // Check if session exists first
    const sessionResult = await db.select<any[]>(
      'SELECT id FROM time_sessions WHERE id = ?',
      [id]
    );
    
    if (sessionResult.length === 0) {
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

  /**
   * Check and fix any database state inconsistencies
   */
  async ensureConsistentState(): Promise<void> {
    const db = await getDatabase();
    
    // Check for multiple active sessions (should never happen)
    const activeSessions = await db.select<any[]>(
      'SELECT id, task_id, created_at FROM time_sessions WHERE is_active = ?',
      [1] // Use 1 instead of true for SQLite
    );
    
    if (activeSessions.length > 1) {
      console.warn(`Found ${activeSessions.length} active sessions, fixing...`);
      // Keep the most recent one, deactivate others
      const sortedSessions = activeSessions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      for (let i = 1; i < sortedSessions.length; i++) {
        await db.execute(
          'UPDATE time_sessions SET is_active = ? WHERE id = ?',
          [0, sortedSessions[i].id] // Use 0 instead of false for SQLite
        );
        console.log(`Deactivated duplicate session: ${sortedSessions[i].id}`);
      }
    }
  }
}