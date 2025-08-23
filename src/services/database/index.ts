// Database service for KiraPilot using SeaORM backend via Tauri commands
import { invoke } from '@tauri-apps/api/core';
import { TranslationKey } from '../../i18n';

// Translation function type for database services
export type DatabaseTranslationFunction = (
  key: TranslationKey,
  variables?: Record<string, string | number>
) => string;

// Global translation function for database services
let databaseTranslationFunction: DatabaseTranslationFunction = (
  key: TranslationKey
) => key;

/**
 * Set translation function for database services
 */
export function setDatabaseTranslationFunction(
  translationFunction: DatabaseTranslationFunction
): void {
  databaseTranslationFunction = translationFunction;
}

/**
 * Get localized database error message
 */
export function getDatabaseErrorMessage(
  key: TranslationKey,
  variables?: Record<string, string | number>
): string {
  return databaseTranslationFunction(key, variables);
}

/**
 * Initialize the database connection (handled by Rust backend)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await invoke<string>('init_database');
    console.log('Database initialized successfully via SeaORM backend');
  } catch (error) {
    const errorMessage = getDatabaseErrorMessage(
      'database.error.initFailed' as TranslationKey
    );
    console.error(errorMessage, error);
    throw new Error(`${errorMessage}: ${error}`);
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
    const errorMessage = getDatabaseErrorMessage(
      'database.error.healthCheckFailed' as TranslationKey
    );
    console.error(errorMessage, error);
    return {
      isHealthy: false,
      version: 'unknown',
      tableCount: 0,
    };
  }
}
