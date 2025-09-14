import { MigrationFeedbackService } from '../MigrationFeedbackService';
import { TaskService } from '../database/repositories/TaskService';
import { Task, TaskStatus, Priority } from '../../types';
import { MigrationResult, TaskMigration } from '../TaskMigrationService';

// Mock TaskService
const mockTaskService = {
  findById: jest.fn(),
  update: jest.fn(),
  getDependencies: jest.fn(),
  getDependents: jest.fn(),
  findAll: jest.fn(),
  getTasksForWeek: jest.fn(),
} as unknown as jest.Mocked<TaskService>;

describe('MigrationFeedbackService', () => {
  let service: MigrationFeedbackService;

  beforeEach(() => {
    service = new MigrationFeedbackService(mockTaskService);
    jest.clearAllMocks();
  });

  const createMockTask = (
    id: string,
    title: string,
    scheduledDate?: Date
  ): Task => ({
    id,
    title,
    description: '',
    status: TaskStatus.PENDING,
    priority: Priority.MEDIUM,
    scheduledDate: scheduledDate || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeEstimate: 30,
    dependencies: [],
    tags: [],
    isPeriodicInstance: false,
    periodicTemplateId: null,
    generationDate: null,
    taskListId: 'default',
  });

  describe('processMigrationResult', () => {
    it('should process successful migration result', async () => {
      const task1 = createMockTask('task1', 'Task 1');
      const task2 = createMockTask('task2', 'Task 2');

      mockTaskService.findById.mockImplementation((id: string) => {
        if (id === 'task1') {
          return Promise.resolve(task1);
        }
        if (id === 'task2') {
          return Promise.resolve(task2);
        }
        return Promise.resolve(null);
      });

      const migrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
        { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
      ];

      const result: MigrationResult = {
        successful: migrations,
        failed: [],
        summary: {
          totalMigrated: 2,
          byDay: {
            '2024-01-15': 1,
            '2024-01-16': 1,
          },
        },
      };

      const startTime = Date.now() - 1000;
      const feedback = await service.processMigrationResult(
        result,
        migrations,
        startTime
      );

      expect(feedback.success).toBe(true);
      expect(feedback.summary.totalTasks).toBe(2);
      expect(feedback.summary.successful).toBe(2);
      expect(feedback.summary.failed).toBe(0);
      expect(feedback.canUndo).toBe(true);
      expect(feedback.undoTimeLimit).toBeDefined();
      expect(feedback.failures).toHaveLength(0);
    });

    it('should process partial migration result with failures', async () => {
      const task1 = createMockTask('task1', 'Task 1');

      mockTaskService.findById.mockImplementation((id: string) => {
        if (id === 'task1') {
          return Promise.resolve(task1);
        }
        if (id === 'task2') {
          return Promise.resolve(null); // Task not found
        }
        return Promise.resolve(null);
      });

      const migrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
        { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
      ];

      const result: MigrationResult = {
        successful: [migrations[0]],
        failed: [{ migration: migrations[1], error: 'Task not found' }],
        summary: {
          totalMigrated: 1,
          byDay: {
            '2024-01-15': 1,
          },
        },
      };

      const startTime = Date.now() - 1000;
      const feedback = await service.processMigrationResult(
        result,
        migrations,
        startTime
      );

      expect(feedback.success).toBe(false);
      expect(feedback.summary.totalTasks).toBe(2);
      expect(feedback.summary.successful).toBe(1);
      expect(feedback.summary.failed).toBe(1);
      expect(feedback.canUndo).toBe(true);
      expect(feedback.failures).toHaveLength(1);
      expect(feedback.failures[0]?.taskTitle).toBe('Task task2');
      expect(feedback.failures[0]?.errorType).toBe('task_not_found');
      expect(feedback.failures[0]?.recoverable).toBe(false);
    });

    it('should categorize different error types correctly', async () => {
      const migrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
        { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
        { taskId: 'task3', newScheduledDate: new Date('2024-01-17') },
        { taskId: 'task4', newScheduledDate: new Date('2024-01-18') },
      ];

      const result: MigrationResult = {
        successful: [],
        failed: [
          { migration: migrations[0], error: 'Task not found' },
          { migration: migrations[1], error: 'Invalid date provided' },
          { migration: migrations[2], error: 'Dependency conflict detected' },
          { migration: migrations[3], error: 'Permission denied for user' },
        ],
        summary: {
          totalMigrated: 0,
          byDay: {},
        },
      };

      mockTaskService.findById.mockResolvedValue(null);

      const startTime = Date.now() - 1000;
      const feedback = await service.processMigrationResult(
        result,
        migrations,
        startTime
      );

      expect(feedback.failures).toHaveLength(4);
      expect(feedback.failures[0]?.errorType).toBe('task_not_found');
      expect(feedback.failures[0]?.recoverable).toBe(false);
      expect(feedback.failures[1]?.errorType).toBe('invalid_date');
      expect(feedback.failures[1]?.recoverable).toBe(true);
      expect(feedback.failures[2]?.errorType).toBe('dependency_conflict');
      expect(feedback.failures[2]?.recoverable).toBe(true);
      expect(feedback.failures[3]?.errorType).toBe('permission_denied');
      expect(feedback.failures[3]?.recoverable).toBe(false);
    });
  });

  describe('undoMigration', () => {
    it('should successfully undo a migration', async () => {
      const task1 = createMockTask('task1', 'Task 1', new Date('2024-01-15'));

      mockTaskService.findById.mockResolvedValue(task1);
      mockTaskService.update.mockResolvedValue(undefined);

      const migrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
      ];

      const result: MigrationResult = {
        successful: migrations,
        failed: [],
        summary: {
          totalMigrated: 1,
          byDay: { '2024-01-15': 1 },
        },
      };

      // First process the migration to create undo data
      const startTime = Date.now() - 1000;
      const feedback = await service.processMigrationResult(
        result,
        migrations,
        startTime
      );

      expect(feedback.canUndo).toBe(true);

      // Get the undo ID from available operations
      const availableUndos = service.getAvailableUndoOperations();
      expect(availableUndos).toHaveLength(1);

      const undoResult = await service.undoMigration(
        availableUndos[0]?.id || ''
      );

      expect(undoResult.success).toBe(true);
      expect(undoResult.undoneCount).toBe(1);
      expect(mockTaskService.update).toHaveBeenCalledWith('task1', {
        scheduledDate: undefined,
      });
    });

    it('should fail to undo expired migration', async () => {
      // Create a service with very short undo time limit for testing
      const shortTimeService = new (class extends MigrationFeedbackService {
        private readonly DEFAULT_UNDO_TIME_LIMIT = 1; // 1ms for testing

        constructor(taskService: TaskService) {
          super(taskService);
        }
      })(mockTaskService);

      const migrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
      ];

      const result: MigrationResult = {
        successful: migrations,
        failed: [],
        summary: {
          totalMigrated: 1,
          byDay: { '2024-01-15': 1 },
        },
      };

      // Process migration
      const startTime = Date.now() - 1000;
      await shortTimeService.processMigrationResult(
        result,
        migrations,
        startTime
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const availableUndos = shortTimeService.getAvailableUndoOperations();
      expect(availableUndos).toHaveLength(0);

      const undoResult =
        await shortTimeService.undoMigration('non-existent-id');
      expect(undoResult.success).toBe(false);
      expect(undoResult.error).toBe('Undo data not found or expired');
    });
  });

  describe('generateSummaryMessage', () => {
    it('should generate correct summary for successful migration', () => {
      const summary = {
        totalTasks: 3,
        successful: 3,
        failed: 0,
        byDay: {
          '2024-01-15': 2,
          '2024-01-16': 1,
        },
        duration: 1500,
      };

      const result = service.generateSummaryMessage(summary);

      expect(result.title).toBe('migration.result.success.title');
      expect(result.message).toBe('migration.result.success.message');
      expect(result.byDayBreakdown).toHaveLength(2);
      expect(result.byDayBreakdown[0].count).toBe(2);
      expect(result.byDayBreakdown[1].count).toBe(1);
    });

    it('should generate correct summary for partial migration', () => {
      const summary = {
        totalTasks: 3,
        successful: 2,
        failed: 1,
        byDay: {
          '2024-01-15': 2,
        },
        duration: 1500,
      };

      const result = service.generateSummaryMessage(summary);

      expect(result.title).toBe('migration.result.partial.title');
      expect(result.message).toBe('migration.result.partial.message');
      expect(result.byDayBreakdown).toHaveLength(1);
    });

    it('should generate correct summary for failed migration', () => {
      const summary = {
        totalTasks: 2,
        successful: 0,
        failed: 2,
        byDay: {},
        duration: 500,
      };

      const result = service.generateSummaryMessage(summary);

      expect(result.title).toBe('migration.result.failure.title');
      expect(result.message).toBe('migration.result.failure.message');
      expect(result.byDayBreakdown).toHaveLength(0);
    });
  });

  describe('retryFailedMigrations', () => {
    it('should retry only recoverable failures', async () => {
      const failures = [
        {
          taskId: 'task1',
          taskTitle: 'Task 1',
          error: 'Invalid date',
          errorType: 'invalid_date' as const,
          recoverable: true,
        },
        {
          taskId: 'task2',
          taskTitle: 'Task 2',
          error: 'Task not found',
          errorType: 'task_not_found' as const,
          recoverable: false,
        },
      ];

      const retryMigrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
        { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
      ];

      const result = await service.retryFailedMigrations(
        failures,
        retryMigrations
      );

      // Should only have attempted to retry task1 (recoverable)
      // The result will contain task1 since it's recoverable, but not task2
      expect(result.successful).toHaveLength(1);
      expect(result.successful[0]?.taskId).toBe('task1');
      expect(result.failed).toHaveLength(0);
      expect(result.summary.totalMigrated).toBe(1);
    });

    it('should return empty result when no recoverable failures', async () => {
      const failures = [
        {
          taskId: 'task1',
          taskTitle: 'Task 1',
          error: 'Task not found',
          errorType: 'task_not_found' as const,
          recoverable: false,
        },
      ];

      const retryMigrations: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
      ];

      const result = await service.retryFailedMigrations(
        failures,
        retryMigrations
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.summary.totalMigrated).toBe(0);
    });
  });

  describe('getAvailableUndoOperations', () => {
    it('should return available undo operations sorted by timestamp', async () => {
      const migrations1: TaskMigration[] = [
        { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
      ];
      const migrations2: TaskMigration[] = [
        { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
      ];

      const result1: MigrationResult = {
        successful: migrations1,
        failed: [],
        summary: { totalMigrated: 1, byDay: { '2024-01-15': 1 } },
      };

      const result2: MigrationResult = {
        successful: migrations2,
        failed: [],
        summary: { totalMigrated: 1, byDay: { '2024-01-16': 1 } },
      };

      mockTaskService.findById.mockResolvedValue(
        createMockTask('task1', 'Task 1')
      );

      // Process two migrations with different timestamps
      await service.processMigrationResult(
        result1,
        migrations1,
        Date.now() - 2000
      );
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await service.processMigrationResult(
        result2,
        migrations2,
        Date.now() - 1000
      );

      const availableUndos = service.getAvailableUndoOperations();

      expect(availableUndos).toHaveLength(2);
      // Should be sorted by timestamp (most recent first)
      expect(availableUndos[0]?.timestamp).toBeGreaterThan(
        availableUndos[1]?.timestamp || 0
      );
      expect(availableUndos[0]?.taskCount).toBe(1);
      expect(availableUndos[1]?.taskCount).toBe(1);
    });
  });
});
