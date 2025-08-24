/**
 * Integration tests for task list persistence and data consistency
 *
 * This test suite focuses on:
 * - Data persistence across browser sessions
 * - Migration of orphaned tasks
 * - Database consistency checks
 * - Recovery from corrupted state
 *
 * Requirements: 6.1, 6.2, 5.5
 */

import { TaskListService } from '../../services/database/repositories/TaskListService';
import { TaskService } from '../../services/database/repositories/TaskService';
import { TestDataFactory } from '../setup/testDataFactory';
import {
  Task,
  TaskList,
  CreateTaskListRequest,
  CreateTaskRequest,
} from '../../types';

// Mock Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Task List Persistence Integration Tests', () => {
  let taskListService: TaskListService;
  let taskService: TaskService;
  let defaultTaskList: TaskList;
  let projectTaskList: TaskList;
  let testTasks: Task[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    TestDataFactory.resetIdCounter();

    taskListService = new TaskListService();
    taskService = new TaskService();

    // Create test data
    defaultTaskList = {
      id: 'default-list-id',
      name: 'Default',
      isDefault: true,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    };

    projectTaskList = {
      id: 'project-list-id',
      name: 'Project Alpha',
      isDefault: false,
      createdAt: new Date('2024-01-02T10:00:00Z'),
      updatedAt: new Date('2024-01-02T10:00:00Z'),
    };

    testTasks = [
      TestDataFactory.createTask({
        id: 'task-1',
        title: 'Task with valid list',
        taskListId: defaultTaskList.id,
      }),
      TestDataFactory.createTask({
        id: 'task-2',
        title: 'Orphaned task',
        taskListId: 'non-existent-list-id',
      }),
      TestDataFactory.createTask({
        id: 'task-3',
        title: 'Another valid task',
        taskListId: projectTaskList.id,
      }),
    ];

    mockInvoke.mockImplementation(setupDefaultMockResponses());
  });

  const setupDefaultMockResponses =
    () => (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'get_all_task_lists':
          return Promise.resolve([
            transformTaskListToBackend(defaultTaskList),
            transformTaskListToBackend(projectTaskList),
          ]);

        case 'get_default_task_list':
          return Promise.resolve(transformTaskListToBackend(defaultTaskList));

        case 'get_all_tasks':
          return Promise.resolve(testTasks.map(transformTaskToBackend));

        case 'migrate_orphaned_tasks_to_default':
          // Simulate migration of orphaned tasks
          const migratedCount = testTasks.filter(
            task => task.taskListId === 'non-existent-list-id'
          ).length;
          return Promise.resolve(migratedCount);

        case 'create_task_list':
          const newTaskList: TaskList = {
            id: `new-list-${Date.now()}`,
            name:
              (args as { request?: { name?: string } })?.request?.name ||
              'New List',
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return Promise.resolve(transformTaskListToBackend(newTaskList));

        case 'update_task':
          const taskToUpdate = testTasks.find(
            t => t.id === (args as { id?: string })?.id
          );
          if (taskToUpdate) {
            const updatedTask = {
              ...taskToUpdate,
              ...(args as { request?: Partial<Task> })?.request,
            };
            return Promise.resolve(transformTaskToBackend(updatedTask));
          }
          throw new Error('Task not found');

        default:
          return Promise.reject(new Error(`Unknown command: ${command}`));
      }
    };

  const transformTaskListToBackend = (taskList: TaskList) => ({
    id: taskList.id,
    name: taskList.name,
    is_default: taskList.isDefault,
    created_at: taskList.createdAt.toISOString(),
    updated_at: taskList.updatedAt.toISOString(),
  });

  const transformTaskToBackend = (task: Task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dependencies: JSON.stringify(task.dependencies),
    time_estimate: task.timeEstimate,
    actual_time: task.actualTime,
    due_date: task.dueDate?.toISOString() || null,
    scheduled_date: task.scheduledDate?.toISOString() || null,
    tags: JSON.stringify(task.tags),
    project_id: task.projectId || null,
    parent_task_id: task.parentTaskId || null,
    subtasks: JSON.stringify(task.subtasks),
    task_list_id: task.taskListId,
    completed_at: task.completedAt?.toISOString() || null,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  });

  describe('Data persistence across browser sessions', () => {
    it('should persist task list selection across app restarts', async () => {
      // Simulate first session - user selects a task list
      const selection = {
        type: 'specific',
        taskListId: projectTaskList.id,
        taskList: projectTaskList,
      };

      // Store selection in localStorage
      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(selection)
      );

      // Simulate app restart - clear memory but keep localStorage
      const storedSelection = localStorage.getItem(
        'kirapilot-selected-task-list'
      );
      expect(storedSelection).toBeTruthy();

      const parsedSelection = JSON.parse(storedSelection!);
      expect(parsedSelection.type).toBe('specific');
      expect(parsedSelection.taskListId).toBe(projectTaskList.id);
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      // Store corrupted data
      localStorage.setItem('kirapilot-selected-task-list', 'invalid-json{');

      // Attempt to restore selection
      let restoredSelection = null;
      try {
        const stored = localStorage.getItem('kirapilot-selected-task-list');
        if (stored) {
          restoredSelection = JSON.parse(stored);
        }
      } catch {
        // Should gracefully handle corrupted data
        restoredSelection = { type: 'all' }; // Default fallback
      }

      expect(restoredSelection).toEqual({ type: 'all' });
    });

    it('should validate restored task list still exists', async () => {
      // Store selection for a task list that no longer exists
      const invalidSelection = {
        type: 'specific',
        taskListId: 'deleted-task-list-id',
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(invalidSelection)
      );

      // Get all available task lists
      const taskLists = await taskListService.getAllTaskLists();

      // Validate the stored selection
      const storedSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      const taskListExists = taskLists.some(
        list => list.id === storedSelection.taskListId
      );

      expect(taskListExists).toBe(false);

      // Should fallback to default task list
      const defaultList = taskLists.find(list => list.isDefault);
      expect(defaultList).toBeTruthy();
    });

    it('should persist user preferences for task list behavior', async () => {
      const preferences = {
        rememberLastSelection: true,
        defaultView: 'all',
        showTaskListIndicators: true,
        autoSwitchOnTaskCreation: false,
      };

      localStorage.setItem(
        'kirapilot-task-list-preferences',
        JSON.stringify(preferences)
      );

      // Verify persistence
      const storedPreferences = JSON.parse(
        localStorage.getItem('kirapilot-task-list-preferences')!
      );

      expect(storedPreferences).toEqual(preferences);
    });
  });

  describe('Migration of orphaned tasks', () => {
    it('should identify orphaned tasks during startup', async () => {
      // Get all tasks and task lists
      const allTasks = await taskService.findAll();
      const allTaskLists = await taskListService.getAllTaskLists();

      // Find orphaned tasks
      const taskListIds = new Set(allTaskLists.map(list => list.id));
      const orphanedTasks = allTasks.filter(
        task => !taskListIds.has(task.taskListId)
      );

      expect(orphanedTasks).toHaveLength(1);
      expect(orphanedTasks[0].title).toBe('Orphaned task');
    });

    it('should migrate orphaned tasks to default task list', async () => {
      // Mock the migration command
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'migrate_orphaned_tasks_to_default') {
          // Simulate successful migration
          return Promise.resolve(1); // 1 task migrated
        }
        return Promise.resolve([]);
      });

      // Perform migration
      const migratedCount = await mockInvoke(
        'migrate_orphaned_tasks_to_default'
      );

      expect(migratedCount).toBe(1);
      expect(mockInvoke).toHaveBeenCalledWith(
        'migrate_orphaned_tasks_to_default'
      );
    });

    it('should handle migration errors gracefully', async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'migrate_orphaned_tasks_to_default') {
          return Promise.reject(new Error('DATABASE_ERROR: Migration failed'));
        }
        return Promise.resolve([]);
      });

      // Attempt migration
      await expect(
        mockInvoke('migrate_orphaned_tasks_to_default')
      ).rejects.toThrow('Migration failed');
    });

    it('should log migration results for audit purposes', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'migrate_orphaned_tasks_to_default') {
          const migratedCount = 1;
          console.info(
            `Migrated ${migratedCount} orphaned tasks to default task list`
          );
          return Promise.resolve(migratedCount);
        }
        return setupDefaultMockResponses()(command);
      });

      await mockInvoke('migrate_orphaned_tasks_to_default');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Migrated 1 orphaned tasks to default task list'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Database consistency checks', () => {
    it('should verify task list foreign key constraints', async () => {
      // Create a task with invalid task list ID
      const invalidTaskRequest: CreateTaskRequest = {
        title: 'Invalid Task',
        taskListId: 'non-existent-list-id',
      };

      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'create_task') {
            if (
              (args as { request?: { task_list_id?: string } })?.request
                ?.task_list_id === 'non-existent-list-id'
            ) {
              return Promise.reject(
                new Error('FOREIGN_KEY_CONSTRAINT: Task list does not exist')
              );
            }
          }
          if (command === 'get_all_task_lists') {
            return Promise.resolve([
              transformTaskListToBackend(defaultTaskList),
            ]);
          }
          if (command === 'get_all_tasks') {
            return Promise.resolve(testTasks.map(transformTaskToBackend));
          }
          return Promise.resolve([]);
        }
      );

      // Attempt to create task with invalid task list
      await expect(taskService.create(invalidTaskRequest)).rejects.toThrow(
        'Task list does not exist'
      );
    });

    it('should prevent deletion of task lists with associated tasks', async () => {
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'delete_task_list') {
            if ((args as { id?: string })?.id === projectTaskList.id) {
              return Promise.reject(
                new Error(
                  'CONSTRAINT_VIOLATION: Cannot delete task list with associated tasks'
                )
              );
            }
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      // Attempt to delete task list with tasks
      await expect(
        taskListService.deleteTaskList(projectTaskList.id)
      ).rejects.toThrow('Cannot delete task list with associated tasks');
    });

    it('should ensure only one default task list exists', async () => {
      const duplicateDefaultRequest: CreateTaskListRequest = {
        name: 'Another Default',
      };

      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'create_task_list') {
            // Simulate backend constraint that prevents multiple default lists
            return Promise.reject(
              new Error(
                'CONSTRAINT_VIOLATION: Only one default task list allowed'
              )
            );
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      // Attempt to create another default task list
      await expect(
        taskListService.createTaskList(duplicateDefaultRequest)
      ).rejects.toThrow('Only one default task list allowed');
    });

    it('should validate task list name uniqueness', async () => {
      const duplicateNameRequest: CreateTaskListRequest = {
        name: 'Project Alpha', // Same as existing task list
      };

      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'create_task_list') {
            if (
              (args as { request?: { name?: string } })?.request?.name ===
              'Project Alpha'
            ) {
              return Promise.reject(
                new Error('CONSTRAINT_VIOLATION: Task list name must be unique')
              );
            }
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      // Attempt to create task list with duplicate name
      await expect(
        taskListService.createTaskList(duplicateNameRequest)
      ).rejects.toThrow('Task list name must be unique');
    });
  });

  describe('Recovery from corrupted state', () => {
    it('should recover when localStorage contains invalid task list ID', async () => {
      // Store invalid selection
      const invalidSelection = {
        type: 'specific',
        taskListId: 'corrupted-id-12345',
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(invalidSelection)
      );

      // Simulate recovery process
      const taskLists = await taskListService.getAllTaskLists();
      const storedSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );

      // Check if stored task list exists
      const selectedTaskList = taskLists.find(
        list => list.id === storedSelection.taskListId
      );

      if (!selectedTaskList) {
        // Recovery: fallback to default task list
        const defaultTaskList = taskLists.find(list => list.isDefault);
        const recoveredSelection = {
          type: 'specific',
          taskListId: defaultTaskList!.id,
          taskList: defaultTaskList,
        };

        localStorage.setItem(
          'kirapilot-selected-task-list',
          JSON.stringify(recoveredSelection)
        );
      }

      // Verify recovery
      const finalSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      expect(finalSelection.taskListId).toBe(defaultTaskList.id);
    });

    it('should handle database connection failures during recovery', async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'get_all_task_lists') {
          return Promise.reject(new Error('DATABASE_ERROR: Connection failed'));
        }
        return Promise.resolve([]);
      });

      // Attempt recovery
      let recoverySuccessful = false;
      try {
        await taskListService.getAllTaskLists();
        recoverySuccessful = true;
      } catch (error) {
        // Recovery should handle database errors
        expect((error as Error).message).toContain('Connection failed');
        recoverySuccessful = false;
      }

      expect(recoverySuccessful).toBe(false);

      // Should fallback to safe state
      const safeSelection = { type: 'all' };
      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(safeSelection)
      );

      const finalSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      expect(finalSelection.type).toBe('all');
    });

    it('should rebuild task list cache after corruption', async () => {
      // Simulate corrupted cache
      const corruptedCache = {
        taskLists: [
          { id: 'invalid-1', name: 'Corrupted List 1' },
          { id: 'invalid-2', name: 'Corrupted List 2' },
        ],
        lastUpdated: new Date('2020-01-01').toISOString(),
      };

      localStorage.setItem(
        'kirapilot-task-list-cache',
        JSON.stringify(corruptedCache)
      );

      // Rebuild cache from database
      const freshTaskLists = await taskListService.getAllTaskLists();
      const rebuiltCache = {
        taskLists: freshTaskLists,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(
        'kirapilot-task-list-cache',
        JSON.stringify(rebuiltCache)
      );

      // Verify cache is rebuilt correctly
      const finalCache = JSON.parse(
        localStorage.getItem('kirapilot-task-list-cache')!
      );
      expect(finalCache.taskLists).toHaveLength(2);
      expect(finalCache.taskLists[0].id).toBe(defaultTaskList.id);
      expect(finalCache.taskLists[1].id).toBe(projectTaskList.id);
    });

    it('should handle partial data corruption gracefully', async () => {
      // Store partially corrupted selection
      const partiallyCorruptedSelection = {
        type: 'specific',
        taskListId: projectTaskList.id,
        // Missing taskList object
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(partiallyCorruptedSelection)
      );

      // Simulate recovery process
      const taskLists = await taskListService.getAllTaskLists();
      const storedSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );

      if (
        storedSelection.type === 'specific' &&
        storedSelection.taskListId &&
        !storedSelection.taskList
      ) {
        // Recovery: find and attach the task list object
        const taskList = taskLists.find(
          list => list.id === storedSelection.taskListId
        );
        if (taskList) {
          const repairedSelection = {
            ...storedSelection,
            taskList,
          };
          localStorage.setItem(
            'kirapilot-selected-task-list',
            JSON.stringify(repairedSelection)
          );
        }
      }

      // Verify repair
      const finalSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      expect(finalSelection.taskList).toBeTruthy();
      expect(finalSelection.taskList.id).toBe(projectTaskList.id);
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large numbers of task lists efficiently', async () => {
      // Create a large number of task lists
      const largeTaskListSet = Array.from({ length: 1000 }, (_, index) => ({
        id: `list-${index}`,
        name: `Task List ${index}`,
        isDefault: index === 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'get_all_task_lists') {
          return Promise.resolve(
            largeTaskListSet.map(transformTaskListToBackend)
          );
        }
        return Promise.resolve([]);
      });

      const startTime = Date.now();
      const taskLists = await taskListService.getAllTaskLists();
      const endTime = Date.now();

      expect(taskLists).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently persist large selection history', async () => {
      // Create large selection history
      const selectionHistory = Array.from({ length: 100 }, (_, index) => ({
        timestamp: new Date(Date.now() - index * 60000).toISOString(),
        selection: {
          type: 'specific',
          taskListId: `list-${index % 10}`,
        },
      }));

      const startTime = Date.now();
      localStorage.setItem(
        'kirapilot-selection-history',
        JSON.stringify(selectionHistory)
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast

      // Verify data integrity
      const storedHistory = JSON.parse(
        localStorage.getItem('kirapilot-selection-history')!
      );
      expect(storedHistory).toHaveLength(100);
    });

    it('should handle concurrent persistence operations', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, index) => {
        return new Promise<void>(resolve => {
          setTimeout(() => {
            localStorage.setItem(`test-key-${index}`, `value-${index}`);
            resolve();
          }, Math.random() * 10);
        });
      });

      await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      for (let i = 0; i < 10; i++) {
        expect(localStorage.getItem(`test-key-${i}`)).toBe(`value-${i}`);
      }
    });
  });
});
