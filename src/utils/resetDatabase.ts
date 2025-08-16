// Utility to reset the database to a clean state
import { forceClearData } from './clearOldData';

/**
 * Reset the entire database to a clean state
 * This will clear all localStorage data and force reinitialization
 */
export function resetDatabase(): void {
  console.log('Resetting database to clean state...');
  
  // Clear localStorage
  forceClearData();
  
  // Clear any cached database instance
  if (typeof window !== 'undefined') {
    // Force reload to reinitialize everything
    window.location.reload();
  }
}

/**
 * Check if database needs reset due to old format data
 */
export function checkAndResetIfNeeded(): boolean {
  if (typeof localStorage === 'undefined') return false;
  
  try {
    const existingData = localStorage.getItem('kirapilot-mock-db');
    if (existingData) {
      const parsed = JSON.parse(existingData);
      if (parsed.tasks && parsed.tasks.length > 0) {
        // Check if any task has old format ID
        const hasOldFormatIds = parsed.tasks.some((task: any) => 
          task.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id)
        );
        
        if (hasOldFormatIds) {
          console.log('Found old format data, resetting database...');
          resetDatabase();
          return true;
        }
      }
    }
  } catch (error) {
    console.log('Error checking database, resetting...');
    resetDatabase();
    return true;
  }
  
  return false;
}

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as any).resetKiraPilotDatabase = resetDatabase;
  (window as any).checkKiraPilotDatabase = checkAndResetIfNeeded;
}