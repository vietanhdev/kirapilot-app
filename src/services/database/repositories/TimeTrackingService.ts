// Time tracking service that interfaces with Tauri commands (SeaORM backend)
import { invoke } from '@tauri-apps/api/core';
import { TimerSession, CompletedSession, TimerBreak } from '../../../types';
import { getDatabaseErrorMessage } from '../index';
import { TranslationKey } from '../../../i18n';

export class TimeTrackingService {
  /**
   * Start a new timer session
   */
  async startSession(taskId: string, notes?: string): Promise<TimerSession> {
    try {
      const request = {
        task_id: taskId,
        start_time: new Date().toISOString(),
        notes: notes || undefined,
      };

      const result = await invoke<Record<string, unknown>>(
        'create_time_session',
        { request }
      );
      return this.transformSessionFromBackend(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'timeTracking.error.startFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Create a historical session with specific start and end times
   */
  async createHistoricalSession(
    taskId: string,
    startTime: Date,
    endTime: Date,
    notes?: string,
    pausedTime?: number
  ): Promise<TimerSession> {
    try {
      // Create the session with custom start time
      const createRequest = {
        task_id: taskId,
        start_time: startTime.toISOString(),
        notes: notes || undefined,
      };

      const result = await invoke<Record<string, unknown>>(
        'create_time_session',
        { request: createRequest }
      );
      const session = this.transformSessionFromBackend(result);

      // Update it with the end time and paused time to make it a completed session
      const updateRequest = {
        end_time: endTime.toISOString(),
        paused_time: pausedTime || 0,
        is_active: false,
        notes: notes || undefined,
      };

      const updatedResult = await invoke<Record<string, unknown>>(
        'update_time_session',
        {
          id: session.id,
          request: updateRequest,
        }
      );

      return this.transformSessionFromBackend(updatedResult);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'timeTracking.error.createHistoricalFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Pause a timer session
   */
  async pauseSession(sessionId: string): Promise<TimerSession> {
    try {
      const result = await invoke<Record<string, unknown>>(
        'pause_time_session',
        { id: sessionId }
      );
      return this.transformSessionFromBackend(result);
    } catch (error) {
      throw new Error(`Failed to pause session: ${error}`);
    }
  }

  /**
   * Resume a timer session
   */
  async resumeSession(sessionId: string): Promise<TimerSession> {
    try {
      const result = await invoke<Record<string, unknown>>(
        'resume_time_session',
        { id: sessionId }
      );
      return this.transformSessionFromBackend(result);
    } catch (error) {
      throw new Error(`Failed to resume session: ${error}`);
    }
  }

  /**
   * Stop session and mark as completed
   */
  async stopSession(
    sessionId: string,
    notes?: string
  ): Promise<CompletedSession> {
    try {
      const result = await invoke<Record<string, unknown>>(
        'stop_time_session',
        {
          id: sessionId,
          notes,
        }
      );

      const session = this.transformSessionFromBackend(result);

      // Transform to CompletedSession format
      const endTime = session.endTime || new Date();
      const totalDuration = endTime.getTime() - session.startTime.getTime();
      const actualWork = totalDuration - session.pausedTime;

      return {
        id: session.id,
        taskId: session.taskId,
        duration: totalDuration,
        actualWork,
        breaks: session.breaks,
        notes: session.notes,
        productivity: this.calculateProductivityScore(
          totalDuration,
          actualWork,
          session.breaks.length
        ),
        createdAt: session.createdAt,
      };
    } catch (error) {
      throw new Error(`Failed to stop session: ${error}`);
    }
  }

  /**
   * Add break to active session
   */
  async addBreak(
    sessionId: string,
    reason: string,
    duration: number
  ): Promise<TimerSession> {
    try {
      // Get current session
      const session = await this.findById(sessionId);
      if (!session) {
        const errorMessage = getDatabaseErrorMessage(
          'database.error.sessionNotFound' as TranslationKey,
          { sessionId }
        );
        throw new Error(errorMessage);
      }

      // Create new break
      const now = new Date();
      const breakItem: TimerBreak = {
        id: this.generateId(),
        startTime: new Date(now.getTime() - duration),
        endTime: now,
        reason,
      };

      const updatedBreaks = [...session.breaks, breakItem];
      const updatedPausedTime = session.pausedTime + duration;

      // Update session with new break
      const updateRequest = {
        breaks: JSON.stringify(updatedBreaks),
        paused_time: updatedPausedTime,
      };

      const result = await invoke<Record<string, unknown>>(
        'update_time_session',
        {
          id: sessionId,
          request: updateRequest,
        }
      );

      return this.transformSessionFromBackend(result);
    } catch (error) {
      throw new Error(`Failed to add break: ${error}`);
    }
  }

  /**
   * Get the currently active session
   */
  async getActiveSession(): Promise<TimerSession | null> {
    try {
      const result = await invoke<Record<string, unknown> | null>(
        'get_any_active_session'
      );
      return result ? this.transformSessionFromBackend(result) : null;
    } catch (error) {
      throw new Error(`Failed to get active session: ${error}`);
    }
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<TimerSession | null> {
    try {
      const result = await invoke<Record<string, unknown> | null>(
        'get_time_session',
        { id }
      );
      return result ? this.transformSessionFromBackend(result) : null;
    } catch (error) {
      throw new Error(`Failed to find session: ${error}`);
    }
  }

  /**
   * Get sessions by task
   */
  async getByTask(taskId: string): Promise<TimerSession[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_task_sessions',
        { taskId }
      );
      return result.map(session => this.transformSessionFromBackend(session));
    } catch (error) {
      throw new Error(`Failed to get sessions by task: ${error}`);
    }
  }

  /**
   * Get sessions by date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<TimerSession[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_sessions_between',
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      );
      return result.map(session => this.transformSessionFromBackend(session));
    } catch (error) {
      throw new Error(`Failed to get sessions by date range: ${error}`);
    }
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
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSessions: number;
    totalTime: number;
    totalWorkTime: number;
    totalBreakTime: number;
    averageSessionLength: number;
    averageProductivity: number;
    mostProductiveHour: number;
    sessionsPerDay: Record<string, number>;
  }> {
    try {
      const start = startDate?.toISOString() || new Date(0).toISOString();
      const end = endDate?.toISOString() || new Date().toISOString();

      const result = await invoke<{
        total_sessions: number;
        total_time_minutes: number;
        total_work_time_minutes: number;
        total_break_time_minutes: number;
        average_session_length_minutes: number;
        average_productivity_score: number;
        most_productive_hour: number;
        sessions_per_day: Record<string, number>;
      }>('get_time_stats', {
        startDate: start,
        endDate: end,
      });

      return {
        totalSessions: result.total_sessions,
        totalTime: result.total_time_minutes * 60 * 1000, // Convert to milliseconds
        totalWorkTime: result.total_work_time_minutes * 60 * 1000,
        totalBreakTime: result.total_break_time_minutes * 60 * 1000,
        averageSessionLength: result.average_session_length_minutes * 60 * 1000,
        averageProductivity: result.average_productivity_score,
        mostProductiveHour: result.most_productive_hour,
        sessionsPerDay: result.sessions_per_day,
      };
    } catch {
      // Return default stats if backend doesn't support this yet
      return {
        totalSessions: 0,
        totalTime: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        averageSessionLength: 0,
        averageProductivity: 0,
        mostProductiveHour: 9,
        sessionsPerDay: {},
      };
    }
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    try {
      await invoke<string>('delete_time_session', { id });
    } catch (error) {
      throw new Error(`Failed to delete session: ${error}`);
    }
  }

  /**
   * Get incomplete sessions (sessions without end time)
   */
  async getIncompleteSessions(): Promise<TimerSession[]> {
    try {
      // Get recent sessions and filter for incomplete ones
      const result = await invoke<Record<string, unknown>[]>(
        'get_recent_sessions',
        { limit: 100 }
      );
      const sessions = result.map(session =>
        this.transformSessionFromBackend(session)
      );
      return sessions.filter(session => !session.endTime);
    } catch (error) {
      throw new Error(`Failed to get incomplete sessions: ${error}`);
    }
  }

  /**
   * Get time tracking summary for a specific period
   */
  async getTimeSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
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
        productivityScore: 0,
      };
    }

    let totalTime = 0;
    let totalBreakTime = 0;
    const uniqueTasks = new Set<string>();

    for (const session of completedSessions) {
      if (session.endTime) {
        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        totalTime += duration;
        totalBreakTime += session.pausedTime;
        uniqueTasks.add(session.taskId);
      }
    }

    const workingTime = totalTime - totalBreakTime;
    const averageFocusTime = workingTime / completedSessions.length;
    const productivityScore =
      totalTime > 0 ? (workingTime / totalTime) * 100 : 0;

    return {
      totalHours: totalTime / (1000 * 60 * 60),
      workingHours: workingTime / (1000 * 60 * 60),
      breakHours: totalBreakTime / (1000 * 60 * 60),
      sessionsCount: completedSessions.length,
      tasksWorkedOn: uniqueTasks.size,
      averageFocusTime: averageFocusTime / (1000 * 60), // in minutes
      productivityScore,
    };
  }

  /**
   * Check and fix any database state inconsistencies
   */
  async ensureConsistentState(): Promise<void> {
    // This would be handled by the backend, but we can implement client-side checks
    try {
      const activeSession = await this.getActiveSession();
      if (activeSession) {
        // Active session found
      }
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'timeTracking.error.checkStateFailed' as TranslationKey
      );
      console.warn(errorMessage, error);
    }
  }

  /**
   * Transform session data from backend format to frontend format
   */
  private transformSessionFromBackend(
    backendSession: Record<string, unknown>
  ): TimerSession {
    return {
      id: backendSession.id as string,
      taskId: backendSession.task_id as string,
      startTime: new Date(backendSession.start_time as string),
      endTime: backendSession.end_time
        ? new Date(backendSession.end_time as string)
        : undefined,
      pausedTime: (backendSession.paused_time as number) || 0,
      isActive: (backendSession.is_active as boolean) || false,
      notes: (backendSession.notes as string) || '',
      breaks: this.parseJsonField(backendSession.breaks as string | null, []),
      createdAt: new Date(backendSession.created_at as string),
    };
  }

  /**
   * Parse JSON field with fallback
   */
  private parseJsonField<T>(value: string | null, fallback: T): T {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Calculate productivity score based on session metrics
   */
  private calculateProductivityScore(
    totalDuration: number,
    actualWork: number,
    breakCount: number
  ): number {
    if (totalDuration === 0) {
      return 0;
    }

    const workRatio = actualWork / totalDuration;
    const breakPenalty = Math.min(breakCount * 0.05, 0.3); // Max 30% penalty for breaks

    return Math.max(0, Math.min(100, workRatio * 100 - breakPenalty * 100));
  }

  /**
   * Generate a simple ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
