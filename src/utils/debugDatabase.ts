// Debug utilities for database issues
// Database debugging utilities for SeaORM backend

/**
 * Check if there are any active timer sessions
 */
export async function checkActiveTimerSessions(): Promise<void> {
  try {
    // Active timer session checking is now handled by the SeaORM backend
  } catch (error) {
    console.error('Error checking active sessions:', error);
  }
}

/**
 * Force stop all active timer sessions (for debugging)
 */
export async function forceStopAllTimers(): Promise<void> {
  try {
    // Force stopping timers is now handled by the SeaORM backend
  } catch (error) {
    console.error('Error force stopping timers:', error);
  }
}

/**
 * Clear all timer session data (for debugging)
 */
export async function clearAllTimerData(): Promise<void> {
  try {
    // Clearing timer data is now handled by the SeaORM backend
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
  (window as unknown as Record<string, unknown>).clearAllTimerData =
    clearAllTimerData;
}
