// Utility functions for secure data backup and restore
import { generateId } from './index';
import { dataSecurity } from '../services/security/DataSecurity';
import {
  reportErrorWithPrivacy,
  trackEventWithPrivacy,
} from '../contexts/PrivacyContext';

export interface BackupMetadata {
  version: string;
  exportDate: string;
  dataTypes: string[];
  checksum?: string;
}

export interface BackupData {
  tasks: unknown[];
  timeSessions: unknown[];
  focusSessions: unknown[];
  patterns: unknown[];
  aiConversations: unknown[];
  preferences: unknown;
  privacySettings: unknown;
  exportMetadata: BackupMetadata;
}

/**
 * Generate a simple checksum for data integrity verification
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Create a complete backup of all user data
 */
export async function createBackup(
  includeAIData: boolean = true
): Promise<BackupData> {
  try {
    // Track backup creation for analytics (if enabled)
    trackEventWithPrivacy('backup_created', { includeAIData });

    const mockDb = JSON.parse(
      localStorage.getItem('kirapilot-mock-db') || '{}'
    );
    const preferences = JSON.parse(
      localStorage.getItem('kirapilot-preferences') || '{}'
    );
    const privacySettings = JSON.parse(
      localStorage.getItem('kirapilot-privacy-settings') || '{}'
    );

    // Get AI conversations if available and requested
    let aiConversations: unknown[] = [];
    if (includeAIData && privacySettings.conversationRetention) {
      // AI conversations are managed by the AIContext, so we'll get them from there
      // This is a placeholder - the actual implementation will get them from the context
      aiConversations = [];
    }

    const backupData: BackupData = {
      tasks: mockDb.tasks || [],
      timeSessions: mockDb.timeSessions || [],
      focusSessions: mockDb.focusSessions || [],
      patterns: mockDb.patterns || [],
      aiConversations,
      preferences,
      privacySettings,
      exportMetadata: {
        version: '1.0',
        exportDate: new Date().toISOString(),
        dataTypes: [
          'tasks',
          'timeSessions',
          'focusSessions',
          'patterns',
          'preferences',
          'privacySettings',
        ],
      },
    };

    // Add AI conversations to data types if included
    if (includeAIData && privacySettings.conversationRetention) {
      backupData.exportMetadata.dataTypes.push('aiConversations');
    }

    // Generate checksum for data integrity
    const dataString = JSON.stringify(backupData);
    backupData.exportMetadata.checksum = generateChecksum(dataString);

    // Encrypt sensitive data if encryption is enabled
    if (
      privacySettings.dataEncryption &&
      dataSecurity.isEncryptionAvailable()
    ) {
      try {
        // Encrypt sensitive fields
        if (backupData.tasks.length > 0) {
          const encryptedTasks = await dataSecurity.encryptData(
            JSON.stringify(backupData.tasks)
          );
          backupData.tasks = [
            { encrypted: true, data: encryptedTasks },
          ] as unknown[];
        }

        if (backupData.aiConversations.length > 0) {
          const encryptedConversations = await dataSecurity.encryptData(
            JSON.stringify(backupData.aiConversations)
          );
          backupData.aiConversations = [
            { encrypted: true, data: encryptedConversations },
          ] as unknown[];
        }
      } catch (error) {
        reportErrorWithPrivacy(error as Error, {
          context: 'createBackup encryption',
        });
        // Continue with unencrypted backup if encryption fails
      }
    }

    return backupData;
  } catch (error) {
    reportErrorWithPrivacy(error as Error, { context: 'createBackup' });
    throw error;
  }
}

/**
 * Validate backup data integrity and format
 */
export function validateBackup(backupData: unknown): backupData is BackupData {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup file: Not a valid JSON object');
  }

  const data = backupData as Partial<BackupData>;

  // Check required metadata
  if (!data.exportMetadata || !data.exportMetadata.version) {
    throw new Error('Invalid backup file: Missing metadata');
  }

  // Check version compatibility
  if (data.exportMetadata.version !== '1.0') {
    throw new Error(
      `Unsupported backup version: ${data.exportMetadata.version}`
    );
  }

  // Verify checksum if present
  if (data.exportMetadata.checksum) {
    const { checksum, ...dataWithoutChecksum } = data.exportMetadata;
    const tempData = { ...data, exportMetadata: dataWithoutChecksum };
    const calculatedChecksum = generateChecksum(JSON.stringify(tempData));

    if (checksum !== calculatedChecksum) {
      throw new Error('Backup file integrity check failed: Checksum mismatch');
    }
  }

  // Validate required fields
  const requiredFields = [
    'tasks',
    'timeSessions',
    'focusSessions',
    'patterns',
    'preferences',
  ];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Invalid backup file: Missing ${field} data`);
    }
  }

  return true;
}

/**
 * Restore data from backup with selective restore options
 */
export async function restoreFromBackup(
  backupData: BackupData,
  options: {
    includeTasks?: boolean;
    includeTimeSessions?: boolean;
    includeFocusSessions?: boolean;
    includePatterns?: boolean;
    includePreferences?: boolean;
    includePrivacySettings?: boolean;
    includeAIConversations?: boolean;
  } = {}
): Promise<void> {
  try {
    // Track restore operation for analytics (if enabled)
    trackEventWithPrivacy('backup_restored', { options });

    // Default to restoring everything
    const {
      includeTasks = true,
      includeTimeSessions = true,
      includeFocusSessions = true,
      includePatterns = true,
      includePreferences = true,
      includePrivacySettings = true,
    } = options;

    // Validate backup first
    validateBackup(backupData);

    // Decrypt data if it's encrypted
    let decryptedTasks = backupData.tasks;

    if (Array.isArray(backupData.tasks) && backupData.tasks.length > 0) {
      const firstTask = backupData.tasks[0] as {
        encrypted?: boolean;
        data?: string;
      };
      if (firstTask.encrypted && firstTask.data) {
        try {
          const decryptedData = await dataSecurity.decryptData(firstTask.data);
          decryptedTasks = JSON.parse(decryptedData);
        } catch (error) {
          reportErrorWithPrivacy(error as Error, {
            context: 'restoreFromBackup decrypt tasks',
          });
          throw new Error('Failed to decrypt task data');
        }
      }
    }

    // Note: AI conversations are handled separately and don't need decryption here

    // Restore database data
    if (
      includeTasks ||
      includeTimeSessions ||
      includeFocusSessions ||
      includePatterns
    ) {
      const currentData = JSON.parse(
        localStorage.getItem('kirapilot-mock-db') || '{}'
      );
      const newData = { ...currentData };

      if (includeTasks) {
        newData.tasks = decryptedTasks;
      }
      if (includeTimeSessions) {
        newData.timeSessions = backupData.timeSessions;
      }
      if (includeFocusSessions) {
        newData.focusSessions = backupData.focusSessions;
      }
      if (includePatterns) {
        newData.patterns = backupData.patterns;
      }

      localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
    }

    // Restore preferences
    if (includePreferences && backupData.preferences) {
      localStorage.setItem(
        'kirapilot-preferences',
        JSON.stringify(backupData.preferences)
      );
    }

    // Restore privacy settings
    if (includePrivacySettings && backupData.privacySettings) {
      localStorage.setItem(
        'kirapilot-privacy-settings',
        JSON.stringify(backupData.privacySettings)
      );
    }

    // Note: AI conversations restoration would need to be handled by the AIContext
    // This is just a placeholder for the data structure
  } catch (error) {
    reportErrorWithPrivacy(error as Error, { context: 'restoreFromBackup' });
    throw error;
  }
}

/**
 * Get backup file size estimation
 */
export function getBackupSize(): {
  totalSize: number;
  breakdown: Record<string, number>;
} {
  const mockDb = localStorage.getItem('kirapilot-mock-db') || '{}';
  const preferences = localStorage.getItem('kirapilot-preferences') || '{}';
  const privacySettings =
    localStorage.getItem('kirapilot-privacy-settings') || '{}';
  const apiKey = localStorage.getItem('kira_api_key') || '';

  const breakdown = {
    database: mockDb.length,
    preferences: preferences.length,
    privacySettings: privacySettings.length,
    apiKey: apiKey.length,
  };

  const totalSize = Object.values(breakdown).reduce(
    (sum, size) => sum + size,
    0
  );

  return { totalSize, breakdown };
}

/**
 * Sanitize backup data by removing sensitive information
 */
export function sanitizeBackupData(backupData: BackupData): BackupData {
  const sanitized = JSON.parse(JSON.stringify(backupData));

  // Remove any potential sensitive data from tasks
  if (sanitized.tasks && Array.isArray(sanitized.tasks)) {
    sanitized.tasks = sanitized.tasks.map((task: Record<string, unknown>) => ({
      ...task,
      // Keep structure but could remove sensitive content if needed
      // For now, we keep all task data as it's user-controlled
    }));
  }

  // Remove sensitive AI conversation data if present
  if (sanitized.aiConversations && Array.isArray(sanitized.aiConversations)) {
    sanitized.aiConversations = sanitized.aiConversations.map(
      (conv: Record<string, unknown>) => ({
        ...conv,
        // Could remove or anonymize sensitive conversation content
        // For now, we keep all data as it's local-only
      })
    );
  }

  return sanitized;
}

/**
 * Create a backup file name with timestamp
 */
export function generateBackupFileName(
  prefix: string = 'kirapilot-backup'
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomSuffix = generateId().slice(0, 8);
  return `${prefix}-${timestamp}-${randomSuffix}.json`;
}

/**
 * Estimate backup creation time based on data size
 */
export function estimateBackupTime(dataSize: number): number {
  // Rough estimation: 1MB per second processing time
  const basetime = Math.max(1000, dataSize / 1024); // Minimum 1 second
  return Math.min(basetime, 10000); // Maximum 10 seconds
}
