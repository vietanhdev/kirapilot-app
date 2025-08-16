import { isOldFormatId, isValidUUID, migrateId, migrateTaskData } from '../migration';

describe('Migration Utilities', () => {
  describe('isOldFormatId', () => {
    it('should identify old format IDs', () => {
      expect(isOldFormatId('1755312393493-5widbnepc')).toBe(true);
      expect(isOldFormatId('123456789-abc123')).toBe(true);
    });

    it('should not identify UUIDs as old format', () => {
      expect(isOldFormatId('550e8400-e29b-41d4-a716-446655440001')).toBe(false);
    });

    it('should not identify other formats as old format', () => {
      expect(isOldFormatId('simple-id')).toBe(false);
      expect(isOldFormatId('123')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should identify valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440001')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should not identify invalid UUIDs', () => {
      expect(isValidUUID('1755312393493-5widbnepc')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
    });
  });

  describe('migrateId', () => {
    it('should keep valid UUIDs unchanged', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440001';
      expect(migrateId(validUuid)).toBe(validUuid);
    });

    it('should generate new UUID for old format IDs', () => {
      const oldId = '1755312393493-5widbnepc';
      const newId = migrateId(oldId);
      expect(newId).not.toBe(oldId);
      expect(isValidUUID(newId)).toBe(true);
    });

    it('should generate new UUID for unknown formats', () => {
      const unknownId = 'unknown-format';
      const newId = migrateId(unknownId);
      expect(newId).not.toBe(unknownId);
      expect(isValidUUID(newId)).toBe(true);
    });
  });

  describe('migrateTaskData', () => {
    it('should migrate task IDs and preserve relationships', () => {
      const oldTasks = [
        {
          id: '1755312393493-5widbnepc',
          title: 'Task 1',
          dependencies: ['1755312393494-abc123'],
          parentTaskId: undefined,
          subtasks: []
        },
        {
          id: '1755312393494-abc123',
          title: 'Task 2',
          dependencies: [],
          parentTaskId: '1755312393493-5widbnepc',
          subtasks: []
        }
      ];

      const migratedTasks = migrateTaskData(oldTasks);

      // All IDs should be valid UUIDs
      expect(isValidUUID(migratedTasks[0].id)).toBe(true);
      expect(isValidUUID(migratedTasks[1].id)).toBe(true);

      // Relationships should be preserved
      expect(migratedTasks[0].dependencies[0]).toBe(migratedTasks[1].id);
      expect(migratedTasks[1].parentTaskId).toBe(migratedTasks[0].id);
    });

    it('should keep valid UUIDs unchanged', () => {
      const validTasks = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Task 1',
          dependencies: [],
          parentTaskId: undefined,
          subtasks: []
        }
      ];

      const migratedTasks = migrateTaskData(validTasks);
      expect(migratedTasks[0].id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });
  });
});