/**
 * Unit tests for WeekTransitionDetector service
 */

import {
  WeekTransitionDetector,
  MigrationPreferences,
} from '../WeekTransitionDetector';
import { TaskService } from '../database/repositories/TaskService';
import { Task, TaskStatus, TimePreset } from '../../types';

// Mock the TaskService
jest.mock('../database/repositories/TaskService');

// Mock the dateFormat utilities
jest.mock('../../utils/dateFormat', () => ({
  getWeekIdentifier: jest.fn(),
  getWeekStartDate: jest.fn(),
  getWeekRange: jest.fn(),
}));

import {
  getWeekIdentifier,
  getWeekStartDate,
  getWeekRange,
} from '../../utils/dateFormat';

const mockGetWeekIdentifier = getWeekIdentifier as jest.MockedFunction<
  typeof getWeekIdentifier
>;
const mockGetWeekStartDate = getWeekStartDate as jest.MockedFunction<
  typeof getWeekStartDate
>;
const mockGetWeekRange = getWeekRange as jest.MockedFunction<
  typeof getWeekRange
>;

// Helper function to create a test task
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Test Task',
  description: '',
  priority: 1,
  status: 'pending' as TaskStatus,
  order: 0,
  dependencies: [],
  timeEstimate: 30,
  timePreset: TimePreset.THIRTY_MIN,
  actualTime: 0,
  scheduledDate: new Date('2024-01-08'),
  tags: [],
  taskListId: 'default',
  isPeriodicInstance: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('WeekTransitionDetector', () => {
  let detector: WeekTransitionDetector;
  let mockTaskService: jest.Mocked<TaskService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock TaskService
    mockTaskService = new TaskService() as jest.Mocked<TaskService>;
    mockTaskService.getIncompleteTasksFromWeek = jest.fn();

    // Create detector instance
    detector = new WeekTransitionDetector(mockTaskService);

    // Setup default mock implementations
    mockGetWeekIdentifier.mockImplementation(
      (date: Date, weekStartDay: 0 | 1) => {
        // Simple implementation for testing - just use the date string
        const weekStart = new Date(date);
        const day = weekStart.getUTCDay();
        let daysToSubtract: number;

        if (weekStartDay === 0) {
          daysToSubtract = day;
        } else {
          daysToSubtract = day === 0 ? 6 : day - 1;
        }

        weekStart.setUTCDate(weekStart.getUTCDate() - daysToSubtract);
        return weekStart.toISOString().split('T')[0];
      }
    );

    mockGetWeekStartDate.mockImplementation(
      (date: Date, weekStartDay: 0 | 1) => {
        const result = new Date(date);
        const day = result.getUTCDay();

        let daysToSubtract: number;
        if (weekStartDay === 0) {
          daysToSubtract = day;
        } else {
          daysToSubtract = day === 0 ? 6 : day - 1;
        }

        result.setUTCDate(result.getUTCDate() - daysToSubtract);
        result.setUTCHours(0, 0, 0, 0);
        return result;
      }
    );

    mockGetWeekRange.mockImplementation((date: Date, weekStartDay: 0 | 1) => {
      const weekStart = mockGetWeekStartDate(date, weekStartDay);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);
      return { weekStart, weekEnd };
    });
  });

  describe('detectWeekTransition', () => {
    it('should return false when previousDate is null', () => {
      const currentDate = new Date('2024-01-15'); // Monday
      const result = detector.detectWeekTransition(currentDate, null, 1);
      expect(result).toBe(false);
    });

    it('should return false when dates are in the same week (Monday start)', () => {
      const currentDate = new Date('2024-01-17'); // Wednesday
      const previousDate = new Date('2024-01-15'); // Monday (same week)

      // Mock to return same week identifier
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-15') // current
        .mockReturnValueOnce('2024-01-15'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        1
      );
      expect(result).toBe(false);
      expect(mockGetWeekIdentifier).toHaveBeenCalledTimes(2);
    });

    it('should return true when dates are in different weeks (Monday start)', () => {
      const currentDate = new Date('2024-01-22'); // Monday (new week)
      const previousDate = new Date('2024-01-19'); // Friday (previous week)

      // Mock to return different week identifiers
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-22') // current
        .mockReturnValueOnce('2024-01-15'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        1
      );
      expect(result).toBe(true);
    });

    it('should return false when dates are in the same week (Sunday start)', () => {
      const currentDate = new Date('2024-01-17'); // Wednesday
      const previousDate = new Date('2024-01-14'); // Sunday (same week)

      // Mock to return same week identifier
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-14') // current
        .mockReturnValueOnce('2024-01-14'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        0
      );
      expect(result).toBe(false);
    });

    it('should return true when dates are in different weeks (Sunday start)', () => {
      const currentDate = new Date('2024-01-21'); // Sunday (new week)
      const previousDate = new Date('2024-01-19'); // Friday (previous week)

      // Mock to return different week identifiers
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-21') // current
        .mockReturnValueOnce('2024-01-14'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        0
      );
      expect(result).toBe(true);
    });
  });

  describe('shouldShowMigrationPrompt', () => {
    it('should return false when migration is disabled', async () => {
      detector.disableMigration();
      const currentWeek = new Date('2024-01-15');

      const result = await detector.shouldShowMigrationPrompt(currentWeek, 1);
      expect(result).toBe(false);
    });

    it('should return false when week is already dismissed', async () => {
      const currentWeek = new Date('2024-01-15');
      mockGetWeekIdentifier.mockReturnValue('2024-01-15');

      detector.dismissWeek('2024-01-15');

      const result = await detector.shouldShowMigrationPrompt(currentWeek, 1);
      expect(result).toBe(false);
    });

    it('should return false when no incomplete tasks exist', async () => {
      const currentWeek = new Date('2024-01-15');
      mockGetWeekIdentifier.mockReturnValue('2024-01-15');
      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue([]);

      const result = await detector.shouldShowMigrationPrompt(currentWeek, 1);
      expect(result).toBe(false);
    });

    it('should return true when conditions are met', async () => {
      const currentWeek = new Date('2024-01-15');
      mockGetWeekIdentifier.mockReturnValue('2024-01-15');

      const incompleteTasks: Task[] = [createTestTask()];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(
        incompleteTasks
      );

      const result = await detector.shouldShowMigrationPrompt(currentWeek, 1);
      expect(result).toBe(true);
    });
  });

  describe('getIncompleteTasksFromPreviousWeek', () => {
    it('should return incomplete tasks from previous week', async () => {
      const currentWeek = new Date('2024-01-15'); // Monday
      const expectedPreviousWeek = new Date('2024-01-08'); // Previous Monday

      const incompleteTasks: Task[] = [createTestTask()];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(
        incompleteTasks
      );

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1
      );

      expect(result).toEqual(incompleteTasks);
      expect(mockTaskService.getIncompleteTasksFromWeek).toHaveBeenCalledWith(
        expectedPreviousWeek,
        1
      );
    });

    it('should filter out non-overdue periodic instances', async () => {
      const currentWeek = new Date('2024-01-15');
      const mockCurrentDate = new Date('2024-01-15'); // Use this as "today" for testing

      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Regular Task',
          scheduledDate: new Date('2024-01-08'),
          isPeriodicInstance: false,
        }),
        createTestTask({
          id: '2',
          title: 'Future Periodic Task',
          scheduledDate: new Date('2024-01-20'), // Future date
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
        }),
        createTestTask({
          id: '3',
          title: 'Overdue Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Past date
          isPeriodicInstance: true,
          periodicTemplateId: 'template-2',
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);

      // Mock findAll to return no future instances for template-2 (allowing migration)
      // but future instances for template-1 (preventing migration)
      mockTaskService.findAll = jest.fn().mockImplementation(filters => {
        if (filters.periodicTemplateId === 'template-1') {
          return Promise.resolve([
            createTestTask({
              id: '4',
              scheduledDate: new Date('2024-01-16'), // Future instance
              periodicTemplateId: 'template-1',
            }),
          ]);
        } else if (filters.periodicTemplateId === 'template-2') {
          return Promise.resolve([]); // No future instances
        }
        return Promise.resolve([]);
      });

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1,
        mockCurrentDate
      );

      // Should include regular task and overdue periodic task without future instances
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });

    it('should return empty array on error', async () => {
      const currentWeek = new Date('2024-01-15');
      mockTaskService.getIncompleteTasksFromWeek.mockRejectedValue(
        new Error('Database error')
      );

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1
      );
      expect(result).toEqual([]);
    });
  });

  describe('generateWeekIdentifier', () => {
    it('should generate consistent week identifier', () => {
      const date = new Date('2024-01-17'); // Wednesday
      mockGetWeekIdentifier.mockReturnValue('2024-01-15');

      const result = detector.generateWeekIdentifier(date, 1);
      expect(result).toBe('2024-01-15');
      expect(mockGetWeekIdentifier).toHaveBeenCalledWith(date, 1);
    });
  });

  describe('migration preferences management', () => {
    it('should get default migration preferences', () => {
      const preferences = detector.getMigrationPreferences();
      expect(preferences).toEqual({
        enabled: true,
        dismissedWeeks: new Set(),
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      });
    });

    it('should update migration preferences', () => {
      const newPreferences: Partial<MigrationPreferences> = {
        enabled: false,
        autoSuggestScheduling: false,
      };

      detector.updateMigrationPreferences(newPreferences);

      const preferences = detector.getMigrationPreferences();
      expect(preferences.enabled).toBe(false);
      expect(preferences.autoSuggestScheduling).toBe(false);
      expect(preferences.showDependencyWarnings).toBe(true); // Should remain unchanged
    });

    it('should dismiss week', () => {
      detector.dismissWeek('2024-01-15');

      const preferences = detector.getMigrationPreferences();
      expect(preferences.dismissedWeeks.has('2024-01-15')).toBe(true);
    });

    it('should clear dismissed weeks', () => {
      detector.dismissWeek('2024-01-15');
      detector.dismissWeek('2024-01-22');
      detector.clearDismissedWeeks();

      const preferences = detector.getMigrationPreferences();
      expect(preferences.dismissedWeeks.size).toBe(0);
    });

    it('should disable migration', () => {
      detector.disableMigration();

      const preferences = detector.getMigrationPreferences();
      expect(preferences.enabled).toBe(false);
    });

    it('should enable migration', () => {
      detector.disableMigration();
      detector.enableMigration();

      const preferences = detector.getMigrationPreferences();
      expect(preferences.enabled).toBe(true);
    });
  });

  describe('shouldTriggerMigrationPrompt', () => {
    it('should return false when no week transition', async () => {
      const fromDate = new Date('2024-01-15');
      const toDate = new Date('2024-01-17');

      // Mock same week
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-15') // to
        .mockReturnValueOnce('2024-01-15'); // from

      const result = await detector.shouldTriggerMigrationPrompt(
        fromDate,
        toDate,
        1
      );
      expect(result).toBe(false);
    });

    it('should return false when week transition but no incomplete tasks', async () => {
      const fromDate = new Date('2024-01-08');
      const toDate = new Date('2024-01-15');

      // Mock different weeks
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-15') // to (for transition check)
        .mockReturnValueOnce('2024-01-08') // from (for transition check)
        .mockReturnValueOnce('2024-01-15'); // to (for prompt check)

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue([]);

      const result = await detector.shouldTriggerMigrationPrompt(
        fromDate,
        toDate,
        1
      );
      expect(result).toBe(false);
    });

    it('should return true when week transition and incomplete tasks exist', async () => {
      const fromDate = new Date('2024-01-08');
      const toDate = new Date('2024-01-15');

      // Mock different weeks
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-15') // to (for transition check)
        .mockReturnValueOnce('2024-01-08') // from (for transition check)
        .mockReturnValueOnce('2024-01-15'); // to (for prompt check)

      const incompleteTasks: Task[] = [createTestTask()];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(
        incompleteTasks
      );

      const result = await detector.shouldTriggerMigrationPrompt(
        fromDate,
        toDate,
        1
      );
      expect(result).toBe(true);
    });
  });

  describe('week utility methods', () => {
    it('should get week range', () => {
      const date = new Date('2024-01-17');
      const expectedRange = {
        weekStart: new Date('2024-01-15'),
        weekEnd: new Date('2024-01-21'),
      };

      mockGetWeekRange.mockReturnValue(expectedRange);

      const result = detector.getWeekRange(date, 1);
      expect(result).toEqual(expectedRange);
      expect(mockGetWeekRange).toHaveBeenCalledWith(date, 1);
    });

    it('should get week start date', () => {
      const date = new Date('2024-01-17');
      const expectedStart = new Date('2024-01-15');

      mockGetWeekStartDate.mockReturnValue(expectedStart);

      const result = detector.getWeekStartDate(date, 1);
      expect(result).toEqual(expectedStart);
      expect(mockGetWeekStartDate).toHaveBeenCalledWith(date, 1);
    });
  });

  describe('periodic task migration handling', () => {
    beforeEach(() => {
      // Setup mock for findAll method
      mockTaskService.findAll = jest.fn();
    });

    it('should exclude periodic instances with future instances already generated', async () => {
      const currentWeek = new Date('2024-01-15');
      const mockCurrentDate = new Date('2024-01-15');

      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Overdue Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);

      // Mock future instances exist for this template
      mockTaskService.findAll.mockResolvedValue([
        createTestTask({
          id: '2',
          scheduledDate: new Date('2024-01-16'), // Future instance
          periodicTemplateId: 'template-1',
        }),
      ]);

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1,
        mockCurrentDate
      );

      // Should exclude the overdue task because future instances exist
      expect(result).toHaveLength(0);
    });

    it('should include overdue periodic instances without future instances', async () => {
      const currentWeek = new Date('2024-01-15');
      const mockCurrentDate = new Date('2024-01-15');

      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Overdue Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);

      // Mock no future instances for this template
      mockTaskService.findAll.mockResolvedValue([]);

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1,
        mockCurrentDate
      );

      // Should include the overdue task because no future instances exist
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should handle periodic instances without template IDs', async () => {
      const currentWeek = new Date('2024-01-15');
      const mockCurrentDate = new Date('2024-01-15');

      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Orphaned Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: undefined, // Missing template ID
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1,
        mockCurrentDate
      );

      // Should exclude tasks without template IDs
      expect(result).toHaveLength(0);
    });

    it('should validate periodic task migration', () => {
      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Regular Task',
          isPeriodicInstance: false,
        }),
        createTestTask({
          id: '2',
          title: 'Valid Periodic Task',
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
          generationDate: new Date('2024-01-01'),
        }),
        createTestTask({
          id: '3',
          title: 'Invalid Periodic Task',
          isPeriodicInstance: true,
          periodicTemplateId: undefined, // Missing template ID
        }),
      ];

      const result = detector.validatePeriodicTaskMigration(tasks);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('missing template ID');
      expect(result.warnings).toHaveLength(3); // One for valid periodic task + two for invalid periodic task (missing generation date + migration warning)
    });

    it('should get migration-safe periodic tasks', async () => {
      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Regular Task',
          isPeriodicInstance: false,
        }),
        createTestTask({
          id: '2',
          title: 'Safe Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
        }),
        createTestTask({
          id: '3',
          title: 'Unsafe Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: 'template-2',
        }),
      ];

      // Mock future instances for template-2 but not template-1
      mockTaskService.findAll.mockImplementation(filters => {
        if (filters.periodicTemplateId === 'template-2') {
          return Promise.resolve([
            createTestTask({
              id: '4',
              scheduledDate: new Date('2024-01-16'), // Future instance
            }),
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.getMigrationSafePeriodicTasks(
        tasks,
        new Date('2024-01-15')
      );

      // Should include regular task and safe periodic task
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['1', '2']);
    });

    it('should handle errors when checking future instances gracefully', async () => {
      const currentWeek = new Date('2024-01-15');
      const mockCurrentDate = new Date('2024-01-15');

      const tasks: Task[] = [
        createTestTask({
          id: '1',
          title: 'Periodic Task',
          scheduledDate: new Date('2024-01-01'), // Overdue
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);

      // Mock findAll to throw an error
      mockTaskService.findAll.mockRejectedValue(new Error('Database error'));

      const result = await detector.getIncompleteTasksFromPreviousWeek(
        currentWeek,
        1,
        mockCurrentDate
      );

      // Should exclude the task on error (conservative approach)
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle year boundary transitions', () => {
      const currentDate = new Date('2024-01-01'); // New Year's Day
      const previousDate = new Date('2023-12-31'); // New Year's Eve

      // Mock different week identifiers for year boundary
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-01') // current
        .mockReturnValueOnce('2023-12-25'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        1
      );
      expect(result).toBe(true);
    });

    it('should handle month boundary transitions', () => {
      const currentDate = new Date('2024-02-01'); // First day of February
      const previousDate = new Date('2024-01-31'); // Last day of January

      // Mock same week (if they're in the same week)
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-01-29') // current (Monday of that week)
        .mockReturnValueOnce('2024-01-29'); // previous (same Monday)

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        1
      );
      expect(result).toBe(false);
    });

    it('should handle leap year February', () => {
      const currentDate = new Date('2024-02-29'); // Leap year February 29
      const previousDate = new Date('2024-02-26'); // Previous Monday

      // Mock same week
      mockGetWeekIdentifier
        .mockReturnValueOnce('2024-02-26') // current
        .mockReturnValueOnce('2024-02-26'); // previous

      const result = detector.detectWeekTransition(
        currentDate,
        previousDate,
        1
      );
      expect(result).toBe(false);
    });
  });

  describe('manual migration methods', () => {
    beforeEach(() => {
      mockTaskService.findAll = jest.fn();
    });

    it('should get incomplete tasks from any specified week', async () => {
      const weekDate = new Date('2024-01-08'); // Previous week
      const incompleteTasks = [
        createTestTask({
          id: '1',
          title: 'Task 1',
          status: TaskStatus.PENDING,
        }),
        createTestTask({
          id: '2',
          title: 'Task 2',
          status: TaskStatus.IN_PROGRESS,
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(
        incompleteTasks
      );

      const result = await detector.getIncompleteTasksFromWeek(weekDate, 0);

      expect(mockTaskService.getIncompleteTasksFromWeek).toHaveBeenCalledWith(
        weekDate,
        0
      );
      expect(result).toEqual(incompleteTasks);
    });

    it('should get available weeks for migration', async () => {
      const currentWeek = new Date('2024-01-15');

      // Mock different weeks having different numbers of tasks
      mockTaskService.getIncompleteTasksFromWeek
        .mockResolvedValueOnce([createTestTask({ id: '1', title: 'Task 1' })]) // Week 1 has tasks
        .mockResolvedValueOnce([]) // Week 2 has no tasks
        .mockResolvedValueOnce([createTestTask({ id: '2', title: 'Task 2' })]) // Week 3 has tasks
        .mockResolvedValueOnce([]); // Week 4 has no tasks

      const availableWeeks = await detector.getAvailableWeeksForMigration(
        currentWeek,
        0,
        4
      );

      expect(availableWeeks).toHaveLength(2);
      expect(availableWeeks[0]).toEqual(new Date('2024-01-08')); // Week 1
      expect(availableWeeks[1]).toEqual(new Date('2023-12-25')); // Week 3
    });

    it('should format week for display correctly', () => {
      const weekDate = new Date('2024-01-10'); // Wednesday

      // Mock the getWeekStartDate to return a predictable start
      mockGetWeekStartDate.mockReturnValue(new Date('2024-01-07')); // Sunday

      const formatted = detector.formatWeekForDisplay(weekDate, 0); // Sunday start

      expect(formatted).toMatch(/Jan \d+ - Jan \d+, 2024/);
    });

    it('should handle errors in getAvailableWeeksForMigration', async () => {
      const currentWeek = new Date('2024-01-15');

      mockTaskService.getIncompleteTasksFromWeek.mockRejectedValue(
        new Error('Database error')
      );

      const availableWeeks = await detector.getAvailableWeeksForMigration(
        currentWeek,
        0,
        2
      );

      expect(availableWeeks).toEqual([]);
    });

    it('should handle errors in getIncompleteTasksFromWeek', async () => {
      const weekDate = new Date('2024-01-08');

      mockTaskService.getIncompleteTasksFromWeek.mockRejectedValue(
        new Error('Database error')
      );

      const result = await detector.getIncompleteTasksFromWeek(weekDate, 0);

      expect(result).toEqual([]);
    });

    it('should respect maxWeeksBack parameter', async () => {
      const currentWeek = new Date('2024-01-15');

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue([
        createTestTask({ id: '1', title: 'Task 1' }),
      ]);

      await detector.getAvailableWeeksForMigration(currentWeek, 0, 3);

      // Should only call for 3 weeks back
      expect(mockTaskService.getIncompleteTasksFromWeek).toHaveBeenCalledTimes(
        3
      );
    });

    it('should format week display with Monday start correctly', () => {
      const weekDate = new Date('2024-01-10'); // Wednesday

      // Mock the getWeekStartDate to return a predictable start
      mockGetWeekStartDate.mockReturnValue(new Date('2024-01-08')); // Monday

      const formatted = detector.formatWeekForDisplay(weekDate, 1); // Monday start

      expect(formatted).toMatch(/Jan \d+ - Jan \d+, 2024/);
    });

    it('should filter periodic tasks in manual migration', async () => {
      const weekDate = new Date('2024-01-08');
      const tasks = [
        createTestTask({
          id: '1',
          title: 'Regular Task',
          isPeriodicInstance: false,
        }),
        createTestTask({
          id: '2',
          title: 'Safe Periodic Task',
          isPeriodicInstance: true,
          periodicTemplateId: 'template-1',
          scheduledDate: new Date('2024-01-01'), // Overdue
        }),
      ];

      mockTaskService.getIncompleteTasksFromWeek.mockResolvedValue(tasks);
      mockTaskService.findAll.mockResolvedValue([]); // No future instances

      const result = await detector.getIncompleteTasksFromWeek(weekDate, 0);

      expect(result).toHaveLength(2); // Both tasks should be included
    });
  });
});
