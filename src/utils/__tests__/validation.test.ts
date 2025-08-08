// Tests for validation schemas
import { describe, test, expect } from '@jest/globals';
import { 
  validateCreateTaskRequest, 
  validateUpdateTaskRequest,
  validateFocusConfig,
  validateUserPreferences 
} from '../../types/validation';
import { Priority, DistractionLevel } from '../../types';

describe('Validation Schemas', () => {
  describe('CreateTaskRequest validation', () => {
    test('should validate valid task creation request', () => {
      const validRequest = {
        title: 'Test Task',
        description: 'A test task description',
        priority: Priority.HIGH,
        timeEstimate: 60,
        tags: ['work', 'urgent'],
      };

      const result = validateCreateTaskRequest(validRequest);
      expect(result.success).toBe(true);
    });

    test('should reject task with empty title', () => {
      const invalidRequest = {
        title: '',
        description: 'A test task description',
      };

      const result = validateCreateTaskRequest(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Title is required');
      }
    });

    test('should reject task with too long title', () => {
      const invalidRequest = {
        title: 'A'.repeat(201), // Too long
        description: 'A test task description',
      };

      const result = validateCreateTaskRequest(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Title too long');
      }
    });

    test('should apply default values', () => {
      const minimalRequest = {
        title: 'Test Task',
      };

      const result = validateCreateTaskRequest(minimalRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(Priority.MEDIUM);
        expect(result.data.tags).toEqual([]);
        expect(result.data.dependencies).toEqual([]);
      }
    });
  });

  describe('UpdateTaskRequest validation', () => {
    test('should validate partial update', () => {
      const updateRequest = {
        title: 'Updated Task',
        priority: Priority.LOW,
      };

      const result = validateUpdateTaskRequest(updateRequest);
      expect(result.success).toBe(true);
    });

    test('should allow empty update', () => {
      const updateRequest = {};

      const result = validateUpdateTaskRequest(updateRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('FocusConfig validation', () => {
    test('should validate valid focus config', () => {
      const validConfig = {
        duration: 45,
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        distractionLevel: DistractionLevel.MODERATE,
        breakReminders: true,
        breakInterval: 25,
      };

      const result = validateFocusConfig(validConfig);
      expect(result.success).toBe(true);
    });

    test('should reject invalid duration', () => {
      const invalidConfig = {
        duration: 0, // Too short
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        distractionLevel: DistractionLevel.MODERATE,
        breakReminders: true,
      };

      const result = validateFocusConfig(invalidConfig);
      expect(result.success).toBe(false);
    });

    test('should reject invalid task ID', () => {
      const invalidConfig = {
        duration: 45,
        taskId: 'invalid-uuid',
        distractionLevel: DistractionLevel.MODERATE,
        breakReminders: true,
      };

      const result = validateFocusConfig(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('UserPreferences validation', () => {
    test('should validate valid preferences', () => {
      const validPreferences = {
        workingHours: {
          start: '09:00',
          end: '17:00',
        },
        breakPreferences: {
          shortBreakDuration: 5,
          longBreakDuration: 30,
          breakInterval: 60,
        },
        focusPreferences: {
          defaultDuration: 45,
          distractionLevel: DistractionLevel.MODERATE,
          backgroundAudio: {
            type: 'white_noise' as const,
            volume: 50,
          },
        },
        notifications: {
          breakReminders: true,
          taskDeadlines: true,
          dailySummary: false,
          weeklyReview: true,
        },
        theme: 'dark' as const,
        language: 'en',
      };

      const result = validateUserPreferences(validPreferences);
      expect(result.success).toBe(true);
    });

    test('should reject invalid time format', () => {
      const invalidPreferences = {
        workingHours: {
          start: '25:00', // Invalid hour
          end: '17:00',
        },
        breakPreferences: {
          shortBreakDuration: 5,
          longBreakDuration: 30,
          breakInterval: 60,
        },
        focusPreferences: {
          defaultDuration: 45,
          distractionLevel: DistractionLevel.MODERATE,
          backgroundAudio: {
            type: 'white_noise' as const,
            volume: 50,
          },
        },
        notifications: {
          breakReminders: true,
          taskDeadlines: true,
          dailySummary: false,
          weeklyReview: true,
        },
        theme: 'dark' as const,
        language: 'en',
      };

      const result = validateUserPreferences(invalidPreferences);
      expect(result.success).toBe(false);
    });

    test('should reject end time before start time', () => {
      const invalidPreferences = {
        workingHours: {
          start: '17:00',
          end: '09:00', // End before start
        },
        breakPreferences: {
          shortBreakDuration: 5,
          longBreakDuration: 30,
          breakInterval: 60,
        },
        focusPreferences: {
          defaultDuration: 45,
          distractionLevel: DistractionLevel.MODERATE,
          backgroundAudio: {
            type: 'white_noise' as const,
            volume: 50,
          },
        },
        notifications: {
          breakReminders: true,
          taskDeadlines: true,
          dailySummary: false,
          weeklyReview: true,
        },
        theme: 'dark' as const,
        language: 'en',
      };

      const result = validateUserPreferences(invalidPreferences);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('End time must be after start time');
      }
    });
  });
});