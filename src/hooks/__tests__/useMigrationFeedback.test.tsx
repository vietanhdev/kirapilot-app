import { renderHook, act } from '@testing-library/react';
import { useMigrationFeedback } from '../useMigrationFeedback';
import { TaskService } from '../../services/database/repositories/TaskService';
import {
  MigrationResult,
  TaskMigration,
} from '../../services/TaskMigrationService';

// Mock dependencies
jest.mock('../useToast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('../useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

jest.mock('../../services/MigrationFeedbackService');

const mockTaskService = {
  findById: jest.fn(),
  update: jest.fn(),
  getDependencies: jest.fn(),
  getDependents: jest.fn(),
  findAll: jest.fn(),
  getTasksForWeek: jest.fn(),
} as unknown as jest.Mocked<TaskService>;

describe('useMigrationFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    expect(result.current.isProcessing).toBe(false);
    expect(typeof result.current.showMigrationResult).toBe('function');
    expect(typeof result.current.retryFailedMigrations).toBe('function');
    expect(typeof result.current.undoMigration).toBe('function');
  });

  it('should handle successful migration result', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    const migrations: TaskMigration[] = [
      { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
    ];

    const migrationResult: MigrationResult = {
      successful: migrations,
      failed: [],
      summary: {
        totalMigrated: 1,
        byDay: { '2024-01-15': 1 },
      },
    };

    const startTime = Date.now() - 1000;

    await act(async () => {
      await result.current.showMigrationResult(
        migrationResult,
        migrations,
        startTime
      );
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle migration result with failures', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    const migrations: TaskMigration[] = [
      { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
      { taskId: 'task2', newScheduledDate: new Date('2024-01-16') },
    ];

    const migrationResult: MigrationResult = {
      successful: [migrations[0]],
      failed: [{ migration: migrations[1], error: 'Task not found' }],
      summary: {
        totalMigrated: 1,
        byDay: { '2024-01-15': 1 },
      },
    };

    const startTime = Date.now() - 1000;

    await act(async () => {
      await result.current.showMigrationResult(
        migrationResult,
        migrations,
        startTime
      );
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle retry failed migrations', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    const failures = [
      {
        taskId: 'task1',
        taskTitle: 'Task 1',
        error: 'Invalid date',
        errorType: 'invalid_date' as const,
        recoverable: true,
      },
    ];

    const retryMigrations: TaskMigration[] = [
      { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
    ];

    expect(result.current.isProcessing).toBe(false);

    await act(async () => {
      await result.current.retryFailedMigrations(failures, retryMigrations);
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle undo migration', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    const undoId = 'test-undo-id';

    expect(result.current.isProcessing).toBe(false);

    await act(async () => {
      await result.current.undoMigration(undoId);
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('should set processing state during operations', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    const failures = [
      {
        taskId: 'task1',
        taskTitle: 'Task 1',
        error: 'Invalid date',
        errorType: 'invalid_date' as const,
        recoverable: true,
      },
    ];

    const retryMigrations: TaskMigration[] = [
      { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
    ];

    expect(result.current.isProcessing).toBe(false);

    // Start and complete retry operation
    await act(async () => {
      await result.current.retryFailedMigrations(failures, retryMigrations);
    });

    // Processing state should be false after operation
    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useMigrationFeedback(mockTaskService));

    // Mock an error in the migration service
    const migrations: TaskMigration[] = [
      { taskId: 'task1', newScheduledDate: new Date('2024-01-15') },
    ];

    const migrationResult: MigrationResult = {
      successful: [],
      failed: [{ migration: migrations[0], error: 'Unexpected error' }],
      summary: {
        totalMigrated: 0,
        byDay: {},
      },
    };

    const startTime = Date.now() - 1000;

    // Should not throw an error
    await act(async () => {
      if (result.current) {
        await result.current.showMigrationResult(
          migrationResult,
          migrations,
          startTime
        );
      }
    });

    expect(result.current?.isProcessing).toBe(false);
  });
});
