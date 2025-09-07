// Database service for KiraPilot using SeaORM backend via Tauri commands
import { invoke } from '@tauri-apps/api/core';
import { TranslationKey } from '../../i18n';
import { getDatabaseErrorMessage } from './utils';

// Re-export database utilities
export {
  setDatabaseTranslationFunction,
  getDatabaseErrorMessage,
} from './utils';
export type { DatabaseTranslationFunction } from './utils';

/**
 * Initialize the database connection (handled by Rust backend)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await invoke<string>('init_database');
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

// Logging services - export LogStorageService first to avoid circular dependency
export { LogStorageService } from './repositories/LogStorageService';

// Enhanced logging services - export after base service to avoid circular dependency
export {
  EnhancedLogStorageService,
  getEnhancedLogStorageService,
} from './repositories/EnhancedLogStorageService';
export type {
  EnhancedLogFilter,
  PerformanceAnalytics,
  EmotionalTrends,
  PerformanceTrends,
} from './repositories/EnhancedLogStorageService';

// Repository functions
export {
  getTaskRepository,
  getTimeTrackingRepository,
  getFocusRepository,
  getPatternRepository,
  getTaskListRepository,
  getLogStorageRepository,
  getEmotionalIntelligenceRepository,
  getThreadRepository,
} from './repositories';
