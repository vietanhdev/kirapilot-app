// Migration utilities for handling data format changes
import { generateId } from './index';

/**
 * Check if an ID is in the old timestamp format
 */
export function isOldFormatId(id: string): boolean {
  // Old format: timestamp-randomstring (e.g., "1755312393493-5widbnepc")
  return /^\d+-[a-z0-9]+$/.test(id);
}

/**
 * Check if an ID is a valid UUID (any version)
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Migrate old format ID to new UUID format
 */
export function migrateId(oldId: string): string {
  if (isValidUUID(oldId)) {
    return oldId; // Already valid UUID
  }
  
  if (isOldFormatId(oldId)) {
    // Generate a new UUID to replace the old format ID
    return generateId();
  }
  
  // If it's neither format, generate a new UUID
  console.warn(`Unknown ID format: ${oldId}, generating new UUID`);
  return generateId();
}

/**
 * Create a mapping of old IDs to new UUIDs for maintaining relationships
 */
export function createIdMigrationMap(oldIds: string[]): Map<string, string> {
  const migrationMap = new Map<string, string>();
  
  for (const oldId of oldIds) {
    if (!isValidUUID(oldId)) {
      migrationMap.set(oldId, generateId());
    } else {
      migrationMap.set(oldId, oldId); // Keep valid UUIDs as-is
    }
  }
  
  return migrationMap;
}

/**
 * Migrate task data to use proper UUIDs
 */
export function migrateTaskData(tasks: any[]): any[] {
  // First pass: create ID migration map
  const allIds = tasks.map(task => task.id);
  const idMap = createIdMigrationMap(allIds);
  
  // Second pass: update tasks with new IDs and fix relationships
  return tasks.map(task => ({
    ...task,
    id: idMap.get(task.id) || generateId(),
    dependencies: task.dependencies?.map((depId: string) => idMap.get(depId) || depId) || [],
    parentTaskId: task.parentTaskId ? (idMap.get(task.parentTaskId) || task.parentTaskId) : undefined,
    subtasks: task.subtasks?.map((subtaskId: string) => idMap.get(subtaskId) || subtaskId) || []
  }));
}

/**
 * Clear localStorage and force data migration
 */
export function forceMigration(): void {
  if (typeof localStorage !== 'undefined') {
    const existingData = localStorage.getItem('kirapilot-mock-db');
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData);
        if (parsed.tasks && parsed.tasks.length > 0) {
          console.log('Migrating task data to UUID format...');
          const migratedTasks = migrateTaskData(parsed.tasks);
          
          const newData = {
            ...parsed,
            tasks: migratedTasks
          };
          
          localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
          console.log('Migration completed successfully');
        }
      } catch (error) {
        console.error('Migration failed, clearing data:', error);
        localStorage.removeItem('kirapilot-mock-db');
      }
    }
  }
}