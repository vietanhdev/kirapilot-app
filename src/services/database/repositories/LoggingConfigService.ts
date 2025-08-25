// Logging configuration management service
import { LoggingConfig } from '../../../types/aiLogging';
import { validateLoggingConfig } from '../../../types/validation';
import { LogStorageService } from './LogStorageService';

export class LoggingConfigService {
  private logStorageService: LogStorageService;
  private cachedConfig: LoggingConfig | null = null;

  constructor() {
    this.logStorageService = new LogStorageService();
  }

  /**
   * Get the default logging configuration
   */
  static getDefaultConfig(): LoggingConfig {
    return {
      enabled: true, // Enable logging by default
      logLevel: 'standard',
      retentionDays: 30,
      maxLogSize: 10485760, // 10MB
      maxLogCount: 10000, // 10,000 logs
      includeSystemPrompts: true,
      includeToolExecutions: true,
      includePerformanceMetrics: true,
      autoCleanup: true,
      exportFormat: 'json',
    };
  }

  /**
   * Get current logging configuration
   */
  async getConfig(): Promise<LoggingConfig> {
    try {
      // Return cached config if available
      if (this.cachedConfig) {
        return this.cachedConfig;
      }

      // Try to get config from database
      const config = await this.logStorageService.getLoggingConfig();
      this.cachedConfig = config;
      return config;
    } catch (error) {
      console.warn(
        'Failed to get logging config from database, using default:',
        error
      );
      // Return default config if database fails
      const defaultConfig = LoggingConfigService.getDefaultConfig();
      this.cachedConfig = defaultConfig;
      return defaultConfig;
    }
  }

  /**
   * Update logging configuration
   */
  async updateConfig(updates: Partial<LoggingConfig>): Promise<LoggingConfig> {
    // Validate the updates
    const validation = validateLoggingConfig(updates);
    if (!validation.success) {
      throw new Error(
        `Invalid logging configuration: ${validation.error.message}`
      );
    }

    try {
      // Update config in database
      const updatedConfig =
        await this.logStorageService.updateLoggingConfig(updates);

      // Update cache
      this.cachedConfig = updatedConfig;

      return updatedConfig;
    } catch (error) {
      console.error('Failed to update logging configuration:', error);
      throw new Error(`Failed to update logging configuration: ${error}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<LoggingConfig> {
    const defaultConfig = LoggingConfigService.getDefaultConfig();
    return this.updateConfig(defaultConfig);
  }

  /**
   * Validate configuration object
   */
  validateConfig(config: unknown): { valid: boolean; errors?: string[] } {
    const validation = validateLoggingConfig(config);

    if (validation.success) {
      return { valid: true };
    }

    const errors = validation.error.issues.map(
      err => `${err.path.join('.')}: ${err.message}`
    );

    return { valid: false, errors };
  }

  /**
   * Migrate configuration from old format to new format
   */
  async migrateConfig(
    oldConfig: Record<string, unknown>
  ): Promise<LoggingConfig> {
    const defaultConfig = LoggingConfigService.getDefaultConfig();

    // Map old configuration keys to new format
    const migratedConfig: Partial<LoggingConfig> = {
      enabled: this.safeBooleanValue(oldConfig.enabled, defaultConfig.enabled),
      logLevel: this.safeEnumValue(
        oldConfig.logLevel || oldConfig.log_level,
        ['minimal', 'standard', 'detailed'] as const,
        defaultConfig.logLevel
      ),
      retentionDays: this.safeNumberValue(
        oldConfig.retentionDays || oldConfig.retention_days,
        1,
        365,
        defaultConfig.retentionDays
      ),
      maxLogSize: this.safeNumberValue(
        oldConfig.maxLogSize || oldConfig.max_log_size,
        1048576,
        1073741824,
        defaultConfig.maxLogSize
      ),
      maxLogCount: this.safeNumberValue(
        oldConfig.maxLogCount || oldConfig.max_log_count,
        100,
        100000,
        defaultConfig.maxLogCount || 10000
      ),
      includeSystemPrompts: this.safeBooleanValue(
        oldConfig.includeSystemPrompts || oldConfig.include_system_prompts,
        defaultConfig.includeSystemPrompts
      ),
      includeToolExecutions: this.safeBooleanValue(
        oldConfig.includeToolExecutions || oldConfig.include_tool_executions,
        defaultConfig.includeToolExecutions
      ),
      includePerformanceMetrics: this.safeBooleanValue(
        oldConfig.includePerformanceMetrics ||
          oldConfig.include_performance_metrics,
        defaultConfig.includePerformanceMetrics
      ),
      autoCleanup: this.safeBooleanValue(
        oldConfig.autoCleanup || oldConfig.auto_cleanup,
        defaultConfig.autoCleanup
      ),
      exportFormat: this.safeEnumValue(
        oldConfig.exportFormat || oldConfig.export_format,
        ['json', 'csv'] as const,
        defaultConfig.exportFormat
      ),
    };

    // Update the configuration
    return this.updateConfig(migratedConfig);
  }

  /**
   * Check if logging is currently enabled
   */
  async isLoggingEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  /**
   * Enable or disable logging
   */
  async setLoggingEnabled(enabled: boolean): Promise<LoggingConfig> {
    return this.updateConfig({ enabled });
  }

  /**
   * Clear cached configuration (force reload from database)
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Get configuration for export (without sensitive data)
   */
  async getConfigForExport(): Promise<Omit<LoggingConfig, 'maxLogSize'>> {
    const config = await this.getConfig();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { maxLogSize: _maxLogSize, ...exportConfig } = config;
    return exportConfig;
  }

  // Helper methods for safe value extraction during migration
  private safeBooleanValue(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }

  private safeNumberValue(
    value: unknown,
    min: number,
    max: number,
    defaultValue: number
  ): number {
    if (typeof value === 'number' && value >= min && value <= max) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        return parsed;
      }
    }
    return defaultValue;
  }

  private safeEnumValue<T extends string>(
    value: unknown,
    validValues: readonly T[],
    defaultValue: T
  ): T {
    if (
      typeof value === 'string' &&
      (validValues as readonly string[]).includes(value)
    ) {
      return value as T;
    }
    return defaultValue;
  }
}
