// Database service for KiraPilot using SeaORM backend via Tauri commands
import { invoke } from '@tauri-apps/api/core';

/**
 * Initialize the database connection (handled by Rust backend)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await invoke<string>('init_database');
    console.log('Database initialized successfully via SeaORM backend');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  version: string;
  tableCount: number;
  lastMigration?: string;
}> {
  try {
    const health = await invoke<{
      is_healthy: boolean;
      version: string;
      table_count: number;
      last_migration?: string;
    }>('get_database_health');

    return {
      isHealthy: health.is_healthy,
      version: health.version,
      tableCount: health.table_count,
      lastMigration: health.last_migration,
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      isHealthy: false,
      version: 'unknown',
      tableCount: 0,
    };
  }
}
