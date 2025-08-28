// Debug utilities for database issues
// Database debugging utilities for SeaORM backend
import { getTimeTrackingRepository } from '../services/database/repositories';

/**
 * Check if there are any active timer sessions
 */
export async function checkActiveTimerSessions(): Promise<void> {
  try {
    const timeRepo = getTimeTrackingRepository();
    const activeSession = await timeRepo.getActiveSession();

    if (activeSession) {
      console.log('Active session found:', {
        id: activeSession.id,
        taskId: activeSession.taskId,
        startTime: activeSession.startTime,
        isActive: activeSession.isActive,
        ageHours:
          (new Date().getTime() - activeSession.startTime.getTime()) /
          (1000 * 60 * 60),
      });
    } else {
      console.log('No active sessions found');
    }
  } catch (error) {
    console.error('Error checking active sessions:', error);
  }
}

/**
 * Force stop all active timer sessions (for debugging)
 */
export async function forceStopAllTimers(): Promise<void> {
  try {
    const timeRepo = getTimeTrackingRepository();
    const activeSession = await timeRepo.getActiveSession();

    if (activeSession) {
      console.log('Force stopping active session:', activeSession.id);
      await timeRepo.stopSession(
        activeSession.id,
        'Force stopped via debug utility'
      );
      console.log('Session stopped successfully');
    } else {
      console.log('No active sessions to stop');
    }
  } catch (error) {
    console.error('Error force stopping timers:', error);
  }
}

/**
 * Clean up orphaned timer sessions (sessions older than specified hours)
 */
export async function cleanupOrphanedSessions(
  maxAgeHours: number = 12
): Promise<void> {
  try {
    const timeRepo = getTimeTrackingRepository();
    const incompleteSessions = await timeRepo.getIncompleteSessions();

    let cleanedCount = 0;
    const now = new Date();

    for (const session of incompleteSessions) {
      const sessionAge = now.getTime() - session.startTime.getTime();
      const ageInHours = sessionAge / (1000 * 60 * 60);

      if (ageInHours > maxAgeHours) {
        console.log(
          `Cleaning up orphaned session: ${session.id} (age: ${Math.round(ageInHours)} hours)`
        );
        await timeRepo.stopSession(
          session.id,
          `Auto-stopped: Orphaned session cleanup (age: ${Math.round(ageInHours)}h)`
        );
        cleanedCount++;
      }
    }

    console.log(
      `Cleanup completed. Processed ${incompleteSessions.length} incomplete sessions, cleaned up ${cleanedCount} orphaned sessions`
    );
  } catch (error) {
    console.error('Error cleaning up orphaned sessions:', error);
  }
}

/**
 * Get session statistics and health information
 */
export async function getSessionHealthInfo(): Promise<{
  activeSessions: number;
  incompleteSessions: number;
  recentSessions: number;
  oldestIncompleteAge?: number;
}> {
  try {
    const timeRepo = getTimeTrackingRepository();

    // Get active sessions
    const activeSession = await timeRepo.getActiveSession();
    const activeSessions = activeSession ? 1 : 0;

    // Get incomplete sessions
    const incompleteSessions = await timeRepo.getIncompleteSessions();

    // Get recent sessions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSessions = await timeRepo.getByDateRange(oneDayAgo, new Date());

    // Find oldest incomplete session
    let oldestIncompleteAge: number | undefined;
    if (incompleteSessions.length > 0) {
      const now = new Date();
      const oldestSession = incompleteSessions.reduce((oldest, session) =>
        session.startTime < oldest.startTime ? session : oldest
      );
      oldestIncompleteAge =
        (now.getTime() - oldestSession.startTime.getTime()) / (1000 * 60 * 60);
    }

    const healthInfo = {
      activeSessions,
      incompleteSessions: incompleteSessions.length,
      recentSessions: recentSessions.length,
      oldestIncompleteAge,
    };

    console.log('Session health info:', healthInfo);
    return healthInfo;
  } catch (error) {
    console.error('Error getting session health info:', error);
    return {
      activeSessions: 0,
      incompleteSessions: 0,
      recentSessions: 0,
    };
  }
}

/**
 * Clear all timer session data (for debugging)
 */
export async function clearAllTimerData(): Promise<void> {
  try {
    // Clearing timer data is now handled by the SeaORM backend
    console.warn('clearAllTimerData: This function is not yet implemented');
  } catch (error) {
    console.error('Error clearing timer data:', error);
  }
}

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).checkActiveTimerSessions =
    checkActiveTimerSessions;
  (window as unknown as Record<string, unknown>).forceStopAllTimers =
    forceStopAllTimers;
  (window as unknown as Record<string, unknown>).cleanupOrphanedSessions =
    cleanupOrphanedSessions;
  (window as unknown as Record<string, unknown>).getSessionHealthInfo =
    getSessionHealthInfo;
  (window as unknown as Record<string, unknown>).clearAllTimerData =
    clearAllTimerData;
}
