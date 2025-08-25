// Logging configuration utilities
import { LoggingConfig } from '../types/aiLogging';
import { LoggingConfigService } from '../services/database/repositories/LoggingConfigService';

/**
 * Configuration migration utilities for AI interaction logging
 */
export class LoggingConfigMigration {
  private configService: LoggingConfigService;

  constructor() {
    this.configService = new LoggingConfigService();
  }

  /**
   * Migrate logging configuration from user preferences to dedicated storage
   */
  async migrateFromUserPreferences(userPreferences: {
    aiSettings?: { logging?: Partial<LoggingConfig> };
  }): Promise<LoggingConfig> {
    const loggingPrefs = userPreferences.aiSettings?.logging;

    if (!loggingPrefs) {
      // No logging preferences found, return default config
      return this.configService.getConfig();
    }

    // Migrate the configuration
    return this.configService.migrateConfig(loggingPrefs);
  }

  /**
   * Check if migration is needed
   */
  async needsMigration(userPreferences: {
    aiSettings?: { logging?: Partial<LoggingConfig> };
  }): Promise<boolean> {
    try {
      // Try to get config from dedicated storage
      await this.configService.getConfig();
      return false; // Config exists, no migration needed
    } catch {
      // Config doesn't exist, check if user preferences have logging config
      return !!userPreferences.aiSettings?.logging;
    }
  }

  /**
   * Perform automatic migration if needed
   */
  async autoMigrate(userPreferences: {
    aiSettings?: { logging?: Partial<LoggingConfig> };
  }): Promise<{ migrated: boolean; config: LoggingConfig }> {
    const needsMigration = await this.needsMigration(userPreferences);

    if (needsMigration) {
      const config = await this.migrateFromUserPreferences(userPreferences);
      return { migrated: true, config };
    }

    const config = await this.configService.getConfig();
    return { migrated: false, config };
  }
}

/**
 * Configuration validation and sanitization utilities
 */
export class LoggingConfigValidator {
  /**
   * Sanitize configuration values to ensure they're within acceptable ranges
   */
  static sanitizeConfig(
    config: Partial<LoggingConfig>
  ): Partial<LoggingConfig> {
    const sanitized: Partial<LoggingConfig> = { ...config };

    // Sanitize retention days
    if (sanitized.retentionDays !== undefined) {
      sanitized.retentionDays = Math.max(
        1,
        Math.min(365, sanitized.retentionDays)
      );
    }

    // Sanitize max log size (1MB to 1GB)
    if (sanitized.maxLogSize !== undefined) {
      sanitized.maxLogSize = Math.max(
        1048576,
        Math.min(1073741824, sanitized.maxLogSize)
      );
    }

    // Ensure valid enum values
    if (sanitized.logLevel !== undefined) {
      const validLevels = ['minimal', 'standard', 'detailed'];
      if (!validLevels.includes(sanitized.logLevel)) {
        sanitized.logLevel = 'standard';
      }
    }

    if (sanitized.exportFormat !== undefined) {
      const validFormats = ['json', 'csv'];
      if (!validFormats.includes(sanitized.exportFormat)) {
        sanitized.exportFormat = 'json';
      }
    }

    return sanitized;
  }

  /**
   * Get configuration recommendations based on usage patterns
   */
  static getRecommendations(
    currentConfig: LoggingConfig,
    usageStats?: {
      averageLogsPerDay: number;
      averageLogSize: number;
      errorRate: number;
    }
  ): {
    recommendations: Array<{
      field: keyof LoggingConfig;
      currentValue: unknown;
      recommendedValue: unknown;
      reason: string;
    }>;
    severity: 'low' | 'medium' | 'high';
  } {
    const recommendations: Array<{
      field: keyof LoggingConfig;
      currentValue: unknown;
      recommendedValue: unknown;
      reason: string;
    }> = [];

    if (usageStats) {
      // Recommend retention period based on usage
      const estimatedDailySize =
        usageStats.averageLogsPerDay * usageStats.averageLogSize;
      const estimatedMonthlySize = estimatedDailySize * 30;

      if (estimatedMonthlySize > currentConfig.maxLogSize * 0.8) {
        recommendations.push({
          field: 'retentionDays',
          currentValue: currentConfig.retentionDays,
          recommendedValue: Math.floor(
            (currentConfig.maxLogSize * 0.7) / estimatedDailySize
          ),
          reason: 'Current retention period may exceed storage limit',
        });
      }

      // Recommend log level based on error rate
      if (usageStats.errorRate > 0.1 && currentConfig.logLevel === 'minimal') {
        recommendations.push({
          field: 'logLevel',
          currentValue: currentConfig.logLevel,
          recommendedValue: 'standard',
          reason: 'Higher error rate detected, consider more detailed logging',
        });
      }

      // Recommend performance metrics for high-volume usage
      if (
        usageStats.averageLogsPerDay > 100 &&
        !currentConfig.includePerformanceMetrics
      ) {
        recommendations.push({
          field: 'includePerformanceMetrics',
          currentValue: currentConfig.includePerformanceMetrics,
          recommendedValue: true,
          reason: 'High usage volume, performance metrics would be valuable',
        });
      }
    }

    // General recommendations
    if (!currentConfig.autoCleanup && currentConfig.retentionDays > 90) {
      recommendations.push({
        field: 'autoCleanup',
        currentValue: currentConfig.autoCleanup,
        recommendedValue: true,
        reason:
          'Long retention period without auto-cleanup may cause storage issues',
      });
    }

    const severity =
      recommendations.length > 2
        ? 'high'
        : recommendations.length > 0
          ? 'medium'
          : 'low';

    return { recommendations, severity };
  }
}

/**
 * Configuration backup and restore utilities
 */
export class LoggingConfigBackup {
  private configService: LoggingConfigService;

  constructor() {
    this.configService = new LoggingConfigService();
  }

  /**
   * Create a backup of current configuration
   */
  async createBackup(): Promise<{
    config: LoggingConfig;
    timestamp: Date;
    version: string;
  }> {
    const config = await this.configService.getConfig();

    return {
      config,
      timestamp: new Date(),
      version: '1.0.0', // Configuration schema version
    };
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backup: {
    config: LoggingConfig;
    timestamp: Date;
    version: string;
  }): Promise<LoggingConfig> {
    // Validate backup format
    if (!backup.config || !backup.timestamp || !backup.version) {
      throw new Error('Invalid backup format');
    }

    // Check if backup is too old (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (backup.timestamp < oneYearAgo) {
      console.warn('Restoring from old backup, some settings may be outdated');
    }

    // Sanitize the configuration before restoring
    const sanitizedConfig = LoggingConfigValidator.sanitizeConfig(
      backup.config
    );

    return this.configService.updateConfig(sanitizedConfig);
  }

  /**
   * Export configuration for sharing or backup
   */
  async exportConfig(): Promise<string> {
    const backup = await this.createBackup();
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import configuration from exported data
   */
  async importConfig(exportedData: string): Promise<LoggingConfig> {
    try {
      const backup = JSON.parse(exportedData);

      // Convert timestamp string back to Date if needed
      if (typeof backup.timestamp === 'string') {
        backup.timestamp = new Date(backup.timestamp);
      }

      return this.restoreFromBackup(backup);
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }
}

/**
 * Convenience functions for common configuration operations
 */
export const loggingConfigUtils = {
  /**
   * Get a new LoggingConfigService instance
   */
  getService: () => new LoggingConfigService(),

  /**
   * Get a new migration utility instance
   */
  getMigration: () => new LoggingConfigMigration(),

  /**
   * Get a new backup utility instance
   */
  getBackup: () => new LoggingConfigBackup(),

  /**
   * Quick validation of configuration
   */
  validate: (config: unknown) => {
    const service = new LoggingConfigService();
    return service.validateConfig(config);
  },

  /**
   * Quick sanitization of configuration
   */
  sanitize: LoggingConfigValidator.sanitizeConfig,

  /**
   * Get configuration recommendations
   */
  getRecommendations: LoggingConfigValidator.getRecommendations,

  /**
   * Check if a configuration change requires restart
   */
  requiresRestart: (
    oldConfig: LoggingConfig,
    newConfig: LoggingConfig
  ): boolean => {
    // Changes that require restart
    const restartFields: (keyof LoggingConfig)[] = ['maxLogSize'];

    return restartFields.some(field => oldConfig[field] !== newConfig[field]);
  },

  /**
   * Get human-readable description of configuration changes
   */
  getChangeDescription: (
    oldConfig: LoggingConfig,
    newConfig: LoggingConfig
  ): string[] => {
    const changes: string[] = [];

    if (oldConfig.enabled !== newConfig.enabled) {
      changes.push(`Logging ${newConfig.enabled ? 'enabled' : 'disabled'}`);
    }

    if (oldConfig.logLevel !== newConfig.logLevel) {
      changes.push(
        `Log level changed from ${oldConfig.logLevel} to ${newConfig.logLevel}`
      );
    }

    if (oldConfig.retentionDays !== newConfig.retentionDays) {
      changes.push(
        `Retention period changed from ${oldConfig.retentionDays} to ${newConfig.retentionDays} days`
      );
    }

    if (oldConfig.autoCleanup !== newConfig.autoCleanup) {
      changes.push(
        `Auto-cleanup ${newConfig.autoCleanup ? 'enabled' : 'disabled'}`
      );
    }

    return changes;
  },
};
