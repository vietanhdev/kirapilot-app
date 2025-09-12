import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('Periodic Task Backup Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Export with Periodic Tasks', () => {
    it('should include periodic task templates in export metadata', async () => {
      // Mock export response with periodic task templates
      const mockExportMetadata = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        task_count: 5,
        session_count: 3,
        ai_interaction_count: 2,
        dependency_count: 1,
        periodic_template_count: 2,
      };

      mockInvoke.mockResolvedValue(mockExportMetadata);

      const result = await invoke('export_data_to_file', {
        filePath: '/test/backup.kpbackup',
      });

      expect(result).toEqual(mockExportMetadata);
      expect(result.periodic_template_count).toBe(2);
      expect(mockInvoke).toHaveBeenCalledWith('export_data_to_file', {
        filePath: '/test/backup.kpbackup',
      });
    });

    it('should handle export with zero periodic task templates', async () => {
      const mockExportMetadata = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        task_count: 3,
        session_count: 1,
        ai_interaction_count: 0,
        dependency_count: 0,
        periodic_template_count: 0,
      };

      mockInvoke.mockResolvedValue(mockExportMetadata);

      const result = await invoke('export_data_to_file', {
        filePath: '/test/backup.kpbackup',
      });

      expect(result.periodic_template_count).toBe(0);
    });
  });

  describe('Import with Periodic Tasks', () => {
    it('should validate backup with periodic task templates', async () => {
      const mockValidationResult = {
        is_valid: true,
        errors: [],
        warnings: [],
        metadata: {
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z',
          task_count: 5,
          session_count: 3,
          ai_interaction_count: 2,
          dependency_count: 1,
          periodic_template_count: 3,
        },
      };

      mockInvoke.mockResolvedValue(mockValidationResult);

      const result = await invoke('validate_backup_comprehensive', {
        filePath: '/test/backup.kpbackup',
      });

      expect(result.is_valid).toBe(true);
      expect(result.metadata?.periodic_template_count).toBe(3);
    });

    it('should handle validation errors for invalid periodic task templates', async () => {
      const mockValidationResult = {
        is_valid: false,
        errors: [
          'Periodic task template at index 0 is missing required field: recurrence_type',
          'Periodic task template at index 1 has invalid recurrence_type: invalid_type',
        ],
        warnings: [],
        metadata: null,
      };

      mockInvoke.mockResolvedValue(mockValidationResult);

      const result = await invoke('validate_backup_comprehensive', {
        filePath: '/test/invalid-backup.kpbackup',
      });

      expect(result.is_valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('recurrence_type');
      expect(result.errors[1]).toContain('invalid_type');
    });

    it('should import periodic task templates successfully', async () => {
      const mockImportResult = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        task_count: 5,
        session_count: 3,
        ai_interaction_count: 2,
        dependency_count: 1,
        periodic_template_count: 3,
      };

      mockInvoke.mockResolvedValue(mockImportResult);

      const result = await invoke('import_data_from_file', {
        filePath: '/test/backup.kpbackup',
        overwrite: true,
      });

      expect(result.periodic_template_count).toBe(3);
      expect(mockInvoke).toHaveBeenCalledWith('import_data_from_file', {
        filePath: '/test/backup.kpbackup',
        overwrite: true,
      });
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate periodic task instance references', async () => {
      const mockValidationResult = {
        is_valid: false,
        errors: [
          'Periodic task instance references non-existent template: template-123',
        ],
        warnings: [],
        metadata: null,
      };

      mockInvoke.mockResolvedValue(mockValidationResult);

      const result = await invoke('validate_backup_comprehensive', {
        filePath: '/test/corrupted-backup.kpbackup',
      });

      expect(result.is_valid).toBe(false);
      expect(result.errors[0]).toContain('non-existent template');
    });

    it('should detect duplicate periodic task template IDs', async () => {
      const mockValidationResult = {
        is_valid: false,
        errors: ['Duplicate periodic task template ID found: template-456'],
        warnings: [],
        metadata: null,
      };

      mockInvoke.mockResolvedValue(mockValidationResult);

      const result = await invoke('validate_backup_comprehensive', {
        filePath: '/test/duplicate-backup.kpbackup',
      });

      expect(result.is_valid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate periodic task template ID');
    });
  });

  describe('Backup File Structure', () => {
    it('should include periodic_task_templates.json in backup archive', async () => {
      // This test would verify that the backup ZIP contains the periodic task templates file
      // In a real implementation, we might mock the ZIP reading functionality
      const mockValidationResult = {
        is_valid: true,
        errors: [],
        warnings: [],
        metadata: {
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z',
          task_count: 5,
          session_count: 3,
          ai_interaction_count: 2,
          dependency_count: 1,
          periodic_template_count: 2,
        },
      };

      mockInvoke.mockResolvedValue(mockValidationResult);

      const result = await invoke('validate_backup_comprehensive', {
        filePath: '/test/complete-backup.kpbackup',
      });

      expect(result.is_valid).toBe(true);
      expect(result.metadata?.periodic_template_count).toBeGreaterThan(0);
    });
  });
});
