import {
  LoggingConfigMigration,
  LoggingConfigValidator,
  LoggingConfigBackup,
  loggingConfigUtils,
} from '../loggingConfigUtils';
import { LoggingConfigService } from '../../services/database/repositories/LoggingConfigService';
import { LoggingConfig } from '../../types/aiLogging';

// Mock the LoggingConfigService
jest.mock('../../services/database/repositories/LoggingConfigService');

// Mock the static method
const mockGetDefaultConfig = jest.fn();
LoggingConfigService.getDefaultConfig = mockGetDefaultConfig;

describe('LoggingConfigMigration', () => {
  let migration: LoggingConfigMigration;
  let mockConfigService: jest.Mocked<LoggingConfigService>;

  const defaultConfig: LoggingConfig = {
    enabled: false,
    logLevel: 'standard',
    retentionDays: 30,
    maxLogSize: 10485760,
    includeSystemPrompts: true,
    includeToolExecutions: true,
    includePerformanceMetrics: true,
    autoCleanup: true,
    exportFormat: 'json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultConfig.mockReturnValue(defaultConfig);
    migration = new LoggingConfigMigration();
    mockConfigService = jest.mocked(LoggingConfigService.prototype);
  });

  describe('migrateFromUserPreferences', () => {
    it('should migrate logging preferences', async () => {
      const userPreferences = {
        aiSettings: {
          logging: {
            enabled: true,
            logLevel: 'detailed' as const,
            retentionDays: 60,
          },
        },
      };

      const migratedConfig: LoggingConfig = {
        enabled: true,
        logLevel: 'detailed',
        retentionDays: 60,
        maxLogSize: 10485760,
        includeSystemPrompts: true,
        includeToolExecutions: true,
        includePerformanceMetrics: true,
        autoCleanup: true,
        exportFormat: 'json',
      };

      mockConfigService.migrateConfig.mockResolvedValue(migratedConfig);

      const result =
        await migration.migrateFromUserPreferences(userPreferences);

      expect(result).toEqual(migratedConfig);
      expect(mockConfigService.migrateConfig).toHaveBeenCalledWith(
        userPreferences.aiSettings.logging
      );
    });

    it('should return default config when no logging preferences exist', async () => {
      const userPreferences = { aiSettings: {} };

      mockConfigService.getConfig.mockResolvedValue(defaultConfig);

      const result =
        await migration.migrateFromUserPreferences(userPreferences);

      expect(result).toEqual(defaultConfig);
      expect(mockConfigService.getConfig).toHaveBeenCalled();
    });
  });

  describe('needsMigration', () => {
    it('should return false when config exists', async () => {
      const userPreferences = {
        aiSettings: { logging: { enabled: true } },
      };

      mockConfigService.getConfig.mockResolvedValue(defaultConfig);

      const result = await migration.needsMigration(userPreferences);

      expect(result).toBe(false);
    });

    it('should return true when config does not exist but user preferences do', async () => {
      const userPreferences = {
        aiSettings: { logging: { enabled: true } },
      };

      mockConfigService.getConfig.mockRejectedValue(
        new Error('Config not found')
      );

      const result = await migration.needsMigration(userPreferences);

      expect(result).toBe(true);
    });

    it('should return false when neither config nor preferences exist', async () => {
      const userPreferences = { aiSettings: {} };

      mockConfigService.getConfig.mockRejectedValue(
        new Error('Config not found')
      );

      const result = await migration.needsMigration(userPreferences);

      expect(result).toBe(false);
    });
  });

  describe('autoMigrate', () => {
    it('should migrate when needed', async () => {
      const userPreferences = {
        aiSettings: { logging: { enabled: true } },
      };

      const migratedConfig = { ...defaultConfig, enabled: true };

      mockConfigService.getConfig.mockRejectedValueOnce(
        new Error('Config not found')
      );
      mockConfigService.migrateConfig.mockResolvedValue(migratedConfig);

      const result = await migration.autoMigrate(userPreferences);

      expect(result.migrated).toBe(true);
      expect(result.config).toEqual(migratedConfig);
    });

    it('should not migrate when not needed', async () => {
      const userPreferences = { aiSettings: {} };

      mockConfigService.getConfig.mockResolvedValue(defaultConfig);

      const result = await migration.autoMigrate(userPreferences);

      expect(result.migrated).toBe(false);
      expect(result.config).toEqual(defaultConfig);
    });
  });
});

describe('LoggingConfigValidator', () => {
  describe('sanitizeConfig', () => {
    it('should sanitize retention days within valid range', () => {
      const config = { retentionDays: -5 };
      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized.retentionDays).toBe(1);
    });

    it('should sanitize retention days above maximum', () => {
      const config = { retentionDays: 500 };
      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized.retentionDays).toBe(365);
    });

    it('should sanitize max log size within valid range', () => {
      const config = { maxLogSize: 100 }; // Too small
      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized.maxLogSize).toBe(1048576); // 1MB minimum
    });

    it('should sanitize invalid log level', () => {
      const config = {
        logLevel: 'invalid' as 'minimal' | 'standard' | 'detailed',
      };
      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized.logLevel).toBe('standard');
    });

    it('should sanitize invalid export format', () => {
      const config = { exportFormat: 'xml' as 'json' | 'csv' };
      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized.exportFormat).toBe('json');
    });

    it('should preserve valid values', () => {
      const config: Partial<LoggingConfig> = {
        enabled: true,
        logLevel: 'detailed',
        retentionDays: 30,
        maxLogSize: 10485760,
        exportFormat: 'csv',
      };

      const sanitized = LoggingConfigValidator.sanitizeConfig(config);

      expect(sanitized).toEqual(config);
    });
  });

  describe('getRecommendations', () => {
    const testDefaultConfig: LoggingConfig = {
      enabled: false,
      logLevel: 'standard',
      retentionDays: 30,
      maxLogSize: 10485760,
      includeSystemPrompts: true,
      includeToolExecutions: true,
      includePerformanceMetrics: true,
      autoCleanup: true,
      exportFormat: 'json',
    };

    it('should recommend shorter retention for high usage', () => {
      const usageStats = {
        averageLogsPerDay: 1000,
        averageLogSize: 50000,
        errorRate: 0.05,
      };

      const result = LoggingConfigValidator.getRecommendations(
        testDefaultConfig,
        usageStats
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          field: 'retentionDays',
          reason: expect.stringContaining('storage limit'),
        })
      );
    });

    it('should recommend standard logging for high error rate', () => {
      const config = { ...testDefaultConfig, logLevel: 'minimal' as const };
      const usageStats = {
        averageLogsPerDay: 10,
        averageLogSize: 1000,
        errorRate: 0.15, // High error rate
      };

      const result = LoggingConfigValidator.getRecommendations(
        config,
        usageStats
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          field: 'logLevel',
          recommendedValue: 'standard',
          reason: expect.stringContaining('error rate'),
        })
      );
    });

    it('should recommend performance metrics for high volume', () => {
      const config = { ...testDefaultConfig, includePerformanceMetrics: false };
      const usageStats = {
        averageLogsPerDay: 150, // High volume
        averageLogSize: 1000,
        errorRate: 0.02,
      };

      const result = LoggingConfigValidator.getRecommendations(
        config,
        usageStats
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          field: 'includePerformanceMetrics',
          recommendedValue: true,
          reason: expect.stringContaining('performance metrics'),
        })
      );
    });

    it('should recommend auto-cleanup for long retention without cleanup', () => {
      const config = {
        ...testDefaultConfig,
        retentionDays: 120,
        autoCleanup: false,
      };

      const result = LoggingConfigValidator.getRecommendations(config);

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          field: 'autoCleanup',
          recommendedValue: true,
          reason: expect.stringContaining('auto-cleanup'),
        })
      );
    });

    it('should return appropriate severity levels', () => {
      const config = {
        ...testDefaultConfig,
        logLevel: 'minimal' as const,
        autoCleanup: false,
        retentionDays: 120,
      };
      const usageStats = {
        averageLogsPerDay: 1000,
        averageLogSize: 50000,
        errorRate: 0.15,
      };

      const result = LoggingConfigValidator.getRecommendations(
        config,
        usageStats
      );

      expect(result.severity).toBe('high'); // Multiple recommendations
    });
  });
});

describe('LoggingConfigBackup', () => {
  let backup: LoggingConfigBackup;
  let mockConfigService: jest.Mocked<LoggingConfigService>;

  const defaultConfig: LoggingConfig = {
    enabled: false,
    logLevel: 'standard',
    retentionDays: 30,
    maxLogSize: 10485760,
    includeSystemPrompts: true,
    includeToolExecutions: true,
    includePerformanceMetrics: true,
    autoCleanup: true,
    exportFormat: 'json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultConfig.mockReturnValue(defaultConfig);
    backup = new LoggingConfigBackup();
    mockConfigService = jest.mocked(LoggingConfigService.prototype);
  });

  describe('createBackup', () => {
    it('should create backup with current config', async () => {
      mockConfigService.getConfig.mockResolvedValue(defaultConfig);

      const result = await backup.createBackup();

      expect(result.config).toEqual(defaultConfig);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore config from valid backup', async () => {
      const backupData = {
        config: defaultConfig,
        timestamp: new Date(),
        version: '1.0.0',
      };

      const mockUpdateConfig = jest
        .spyOn(LoggingConfigService.prototype, 'updateConfig')
        .mockResolvedValue(backupData.config);

      const result = await backup.restoreFromBackup(backupData);

      expect(result).toEqual(backupData.config);
      expect(mockUpdateConfig).toHaveBeenCalled();

      mockUpdateConfig.mockRestore();
    });

    it('should throw error for invalid backup format', async () => {
      const invalidBackup = { config: null } as { config: null };

      await expect(backup.restoreFromBackup(invalidBackup)).rejects.toThrow(
        'Invalid backup format'
      );
    });

    it('should warn about old backups', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

      const oldBackup = {
        config: defaultConfig,
        timestamp: oldDate,
        version: '1.0.0',
      };

      const mockUpdateConfig = jest
        .spyOn(LoggingConfigService.prototype, 'updateConfig')
        .mockResolvedValue(oldBackup.config);

      await backup.restoreFromBackup(oldBackup);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('old backup')
      );

      consoleSpy.mockRestore();
      mockUpdateConfig.mockRestore();
    });
  });

  describe('exportConfig', () => {
    it('should export config as JSON string', async () => {
      mockConfigService.getConfig.mockResolvedValue(defaultConfig);

      const result = await backup.exportConfig();

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.config).toEqual(defaultConfig);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.version).toBe('1.0.0');
    });
  });

  describe('importConfig', () => {
    it('should import config from JSON string', async () => {
      const exportData = JSON.stringify({
        config: defaultConfig,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });

      const mockUpdateConfig = jest
        .spyOn(LoggingConfigService.prototype, 'updateConfig')
        .mockResolvedValue(defaultConfig);

      const result = await backup.importConfig(exportData);

      expect(result).toEqual(defaultConfig);

      mockUpdateConfig.mockRestore();
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = 'invalid json string';

      await expect(backup.importConfig(invalidJson)).rejects.toThrow(
        'Failed to import configuration'
      );
    });
  });
});

describe('loggingConfigUtils', () => {
  const defaultConfig: LoggingConfig = {
    enabled: false,
    logLevel: 'standard',
    retentionDays: 30,
    maxLogSize: 10485760,
    includeSystemPrompts: true,
    includeToolExecutions: true,
    includePerformanceMetrics: true,
    autoCleanup: true,
    exportFormat: 'json',
  };

  describe('requiresRestart', () => {
    it('should return true for maxLogSize changes', () => {
      const oldConfig = defaultConfig;
      const newConfig = { ...oldConfig, maxLogSize: 20971520 };

      const result = loggingConfigUtils.requiresRestart(oldConfig, newConfig);

      expect(result).toBe(true);
    });

    it('should return false for non-restart changes', () => {
      const oldConfig = defaultConfig;
      const newConfig = { ...oldConfig, enabled: !oldConfig.enabled };

      const result = loggingConfigUtils.requiresRestart(oldConfig, newConfig);

      expect(result).toBe(false);
    });
  });

  describe('getChangeDescription', () => {
    it('should describe configuration changes', () => {
      const oldConfig = defaultConfig;
      const newConfig = {
        ...oldConfig,
        enabled: true,
        logLevel: 'detailed' as const,
        retentionDays: 60,
        autoCleanup: false,
      };

      const result = loggingConfigUtils.getChangeDescription(
        oldConfig,
        newConfig
      );

      expect(result).toContain('Logging enabled');
      expect(result).toContain('Log level changed from standard to detailed');
      expect(result).toContain('Retention period changed from 30 to 60 days');
      expect(result).toContain('Auto-cleanup disabled');
    });

    it('should return empty array for no changes', () => {
      const config = defaultConfig;

      const result = loggingConfigUtils.getChangeDescription(config, config);

      expect(result).toEqual([]);
    });
  });

  describe('utility functions', () => {
    it('should provide service instance', () => {
      const service = loggingConfigUtils.getService();
      expect(service).toBeInstanceOf(LoggingConfigService);
    });

    it('should provide migration instance', () => {
      const migration = loggingConfigUtils.getMigration();
      expect(migration).toBeInstanceOf(LoggingConfigMigration);
    });

    it('should provide backup instance', () => {
      const backupInstance = loggingConfigUtils.getBackup();
      expect(backupInstance).toBeInstanceOf(LoggingConfigBackup);
    });

    it('should validate configuration', () => {
      const validConfig = defaultConfig;

      // Mock the validateConfig method on the prototype
      const mockValidateConfig = jest
        .spyOn(LoggingConfigService.prototype, 'validateConfig')
        .mockReturnValue({ valid: true });

      const result = loggingConfigUtils.validate(validConfig);

      expect(result.valid).toBe(true);
      expect(mockValidateConfig).toHaveBeenCalledWith(validConfig);

      mockValidateConfig.mockRestore();
    });

    it('should sanitize configuration', () => {
      const config = { retentionDays: -5 };
      const sanitized = loggingConfigUtils.sanitize(config);

      expect(sanitized.retentionDays).toBe(1);
    });
  });
});
