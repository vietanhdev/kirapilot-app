// Utility to clear old format data from localStorage
import { isValidUUID } from './migration';

/**
 * Clear localStorage if it contains old format data
 */
export function clearOldDataIfNeeded(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const existingData = localStorage.getItem('kirapilot-mock-db');
    if (existingData) {
      const parsed = JSON.parse(existingData);
      if (parsed.tasks && parsed.tasks.length > 0) {
        // Check if any task has old format ID
        const hasOldFormatIds = parsed.tasks.some(
          (task: { id: string }) => task.id && !isValidUUID(task.id)
        );

        if (hasOldFormatIds) {
          console.log('Clearing localStorage due to old format task IDs...');
          localStorage.removeItem('kirapilot-mock-db');
        }
      }
    }
  } catch (error) {
    console.log('Error checking localStorage, clearing it:', error);
    localStorage.removeItem('kirapilot-mock-db');
  }
}

/**
 * Force clear all localStorage data
 */
export function forceClearData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('kirapilot-mock-db');
    console.log('Forced clear of localStorage data');
  }
}
