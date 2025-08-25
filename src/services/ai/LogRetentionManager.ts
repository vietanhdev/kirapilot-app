import { LogStorageService } from '../database/repositories/LogStorageService';
import { LoggingConfigService } from '../database/repositories/LoggingConfigService';
import { LoggingConfig } from '../../types/aiLogging';

export interface RetentionPolicy {
  maxAgeDays: number;
  maxLogCount: number;
  maxStorageSize: number; // in bytes
}

export interface CleanupProgress {
  totalLogs: number;
  processedLogs: number;
  deletedLogs: number;
  freedSpace: number;
  isComplete: boolean;
}

export interface StorageWarning {
  type: 'age' | 'count' | 'size';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  current: number;
}

export class LogRetentionManager {
  private logStorageService: LogStorageService;
  private configService: LoggingConfigService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;

  constructor(
    logStorageService: LogStorageService,
    configService: LoggingConfigService
  ) {
    this.logStorageService = logStorageService;
    this.configService = configService;
  }

  /**
   * Start automatic cleanup scheduling based on user preferences
   */
  async startAutomaticCleanup(): Promise<void> {
    const config = await this.configService.getConfig();

    if (!config.autoCleanup) {
      return;
    }

    // Stop existing interval if running
    this.stopAutomaticCleanup();

    // Run cleanup every 24 hours
    this.cleanupInterval = setInterval(
      async () => {
        try {
          await this.performAutomaticCleanup();
        } catch (error) {
          console.error('Automatic cleanup failed:', error);
        }
      },
      24 * 60 * 60 * 1000
    ); // 24 hours

    // Run initial cleanup
    setTimeout(() => this.performAutomaticCleanup(), 5000); // 5 seconds delay
  }

  /**
   * Stop automatic cleanup scheduling
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Perform automatic cleanup based on retention policies
   */
  async performAutomaticCleanup(): Promise<CleanupProgress> {
    if (this.isCleanupRunning) {
      throw new Error('Cleanup is already running');
    }

    this.isCleanupRunning = true;

    try {
      const config = await this.configService.getConfig();
      const policy = this.getRetentionPolicy(config);
      const stats = await this.logStorageService.getStorageStats();

      const progress: CleanupProgress = {
        totalLogs: stats.totalLogs,
        processedLogs: 0,
        deletedLogs: 0,
        freedSpace: 0,
        isComplete: false,
      };

      // Clean up by age
      if (policy.maxAgeDays > 0) {
        const ageResult = await this.cleanupByAge(policy.maxAgeDays);
        progress.deletedLogs += ageResult.deletedCount;
        progress.freedSpace += ageResult.freedSpace;
      }

      // Clean up by count
      if (policy.maxLogCount > 0) {
        const countResult = await this.cleanupByCount(policy.maxLogCount);
        progress.deletedLogs += countResult.deletedCount;
        progress.freedSpace += countResult.freedSpace;
      }

      // Clean up by size
      if (policy.maxStorageSize > 0) {
        const sizeResult = await this.cleanupBySize(policy.maxStorageSize);
        progress.deletedLogs += sizeResult.deletedCount;
        progress.freedSpace += sizeResult.freedSpace;
      }

      progress.processedLogs = progress.totalLogs;
      progress.isComplete = true;

      return progress;
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Perform manual cleanup with progress callback
   */
  async performManualCleanup(
    onProgress?: (progress: CleanupProgress) => void
  ): Promise<CleanupProgress> {
    const result = await this.performAutomaticCleanup();

    if (onProgress) {
      onProgress(result);
    }

    return result;
  }

  /**
   * Get current storage warnings based on retention policies
   */
  async getStorageWarnings(): Promise<StorageWarning[]> {
    const config = await this.configService.getConfig();
    const policy = this.getRetentionPolicy(config);
    const stats = await this.logStorageService.getStorageStats();
    const warnings: StorageWarning[] = [];

    // Check age warnings
    if (policy.maxAgeDays > 0 && stats.oldestLog) {
      const daysSinceOldest = Math.floor(
        (Date.now() - stats.oldestLog.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceOldest > policy.maxAgeDays * 1.2) {
        warnings.push({
          type: 'age',
          severity: 'critical',
          message: `Logs are ${daysSinceOldest} days old, exceeding retention policy of ${policy.maxAgeDays} days`,
          threshold: policy.maxAgeDays,
          current: daysSinceOldest,
        });
      } else if (daysSinceOldest > policy.maxAgeDays) {
        warnings.push({
          type: 'age',
          severity: 'warning',
          message: `Some logs exceed retention policy of ${policy.maxAgeDays} days`,
          threshold: policy.maxAgeDays,
          current: daysSinceOldest,
        });
      }
    }

    // Check count warnings
    if (policy.maxLogCount > 0) {
      if (stats.totalLogs > policy.maxLogCount * 1.2) {
        warnings.push({
          type: 'count',
          severity: 'critical',
          message: `${stats.totalLogs} logs exceed maximum of ${policy.maxLogCount}`,
          threshold: policy.maxLogCount,
          current: stats.totalLogs,
        });
      } else if (stats.totalLogs > policy.maxLogCount) {
        warnings.push({
          type: 'count',
          severity: 'warning',
          message: `Log count approaching maximum of ${policy.maxLogCount}`,
          threshold: policy.maxLogCount,
          current: stats.totalLogs,
        });
      }
    }

    // Check size warnings
    if (policy.maxStorageSize > 0) {
      if (stats.totalSize > policy.maxStorageSize * 1.2) {
        warnings.push({
          type: 'size',
          severity: 'critical',
          message: `Log storage (${this.formatBytes(stats.totalSize)}) exceeds maximum of ${this.formatBytes(policy.maxStorageSize)}`,
          threshold: policy.maxStorageSize,
          current: stats.totalSize,
        });
      } else if (stats.totalSize > policy.maxStorageSize) {
        warnings.push({
          type: 'size',
          severity: 'warning',
          message: `Log storage approaching maximum of ${this.formatBytes(policy.maxStorageSize)}`,
          threshold: policy.maxStorageSize,
          current: stats.totalSize,
        });
      }
    }

    return warnings;
  }

  /**
   * Get retention policy from configuration
   */
  private getRetentionPolicy(config: LoggingConfig): RetentionPolicy {
    return {
      maxAgeDays: config.retentionDays,
      maxLogCount: config.maxLogCount || 10000, // Default max count
      maxStorageSize: config.maxLogSize || 100 * 1024 * 1024, // Default 100MB
    };
  }

  /**
   * Clean up logs older than specified days
   */
  private async cleanupByAge(
    maxAgeDays: number
  ): Promise<{ deletedCount: number; freedSpace: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const oldLogs = await this.logStorageService.getInteractionLogs({
      endDate: cutoffDate,
      limit: 1000, // Process in batches
    });

    let deletedCount = 0;
    let freedSpace = 0;

    for (const log of oldLogs) {
      try {
        // Estimate log size (rough calculation)
        const logSize = JSON.stringify(log).length * 2; // UTF-16 approximation
        await this.logStorageService.deleteInteractionLog(log.id);
        deletedCount++;
        freedSpace += logSize;
      } catch (error) {
        console.error(`Failed to delete log ${log.id}:`, error);
      }
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Clean up logs to maintain maximum count
   */
  private async cleanupByCount(
    maxLogCount: number
  ): Promise<{ deletedCount: number; freedSpace: number }> {
    const stats = await this.logStorageService.getStorageStats();

    if (stats.totalLogs <= maxLogCount) {
      return { deletedCount: 0, freedSpace: 0 };
    }

    const excessCount = stats.totalLogs - maxLogCount;

    // Get oldest logs to delete
    const oldestLogs = await this.logStorageService.getInteractionLogs({
      limit: excessCount,
    });

    let deletedCount = 0;
    let freedSpace = 0;

    for (const log of oldestLogs) {
      try {
        const logSize = JSON.stringify(log).length * 2;
        await this.logStorageService.deleteInteractionLog(log.id);
        deletedCount++;
        freedSpace += logSize;
      } catch (error) {
        console.error(`Failed to delete log ${log.id}:`, error);
      }
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Clean up logs to maintain maximum storage size
   */
  private async cleanupBySize(
    maxStorageSize: number
  ): Promise<{ deletedCount: number; freedSpace: number }> {
    const stats = await this.logStorageService.getStorageStats();

    if (stats.totalSize <= maxStorageSize) {
      return { deletedCount: 0, freedSpace: 0 };
    }

    const excessSize = stats.totalSize - maxStorageSize;
    let deletedCount = 0;
    let freedSpace = 0;
    let offset = 0;
    const batchSize = 100;

    // Delete oldest logs until we're under the size limit
    while (freedSpace < excessSize) {
      const logs = await this.logStorageService.getInteractionLogs({
        limit: batchSize,
        offset,
      });

      if (logs.length === 0) {
        break; // No more logs to process
      }

      for (const log of logs) {
        try {
          const logSize = JSON.stringify(log).length * 2;
          await this.logStorageService.deleteInteractionLog(log.id);
          deletedCount++;
          freedSpace += logSize;

          if (freedSpace >= excessSize) {
            break;
          }
        } catch (error) {
          console.error(`Failed to delete log ${log.id}:`, error);
        }
      }

      offset += batchSize;
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if cleanup is currently running
   */
  isRunning(): boolean {
    return this.isCleanupRunning;
  }
}
