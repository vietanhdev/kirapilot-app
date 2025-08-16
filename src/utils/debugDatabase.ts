// Debug utilities for database issues
import { getDatabase } from '../services/database';

/**
 * Check if there are any active timer sessions
 */
export async function checkActiveTimerSessions(): Promise<void> {
  try {
    const db = await getDatabase();
    const activeSessions = await db.select<any[]>(
      'SELECT * FROM time_sessions WHERE is_active = ?',
      [true]
    );

    console.log('Active timer sessions:', activeSessions.length);
    activeSessions.forEach(session => {
      console.log(`- Session ${session.id} for task ${session.task_id}`);
    });
  } catch (error) {
    console.error('Error checking active sessions:', error);
  }
}

/**
 * Force stop all active timer sessions (for debugging)
 */
export async function forceStopAllTimers(): Promise<void> {
  try {
    const db = await getDatabase();
    const result = await db.execute(
      'UPDATE time_sessions SET is_active = ?, end_time = ? WHERE is_active = ?',
      [false, new Date().toISOString(), true]
    );

    console.log('Force stopped all active timers:', result);
  } catch (error) {
    console.error('Error force stopping timers:', error);
  }
}

/**
 * Clear all timer session data (for debugging)
 */
export async function clearAllTimerData(): Promise<void> {
  try {
    const db = await getDatabase();
    const result = await db.execute('DELETE FROM time_sessions');
    console.log('Cleared all timer data:', result);
  } catch (error) {
    console.error('Error clearing timer data:', error);
  }
}

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as any).checkActiveTimerSessions = checkActiveTimerSessions;
  (window as any).forceStopAllTimers = forceStopAllTimers;
  (window as any).clearAllTimerData = clearAllTimerData;
}
