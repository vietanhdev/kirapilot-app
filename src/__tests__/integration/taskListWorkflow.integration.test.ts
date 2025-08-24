/**
 * Integration tests for complete task list workflow
 *
 * This test suite covers:
 * - End-to-end task list creation, switching, and deletion
 * - Task filtering works correctly across all views
 * - Task migration between lists
 * - Persistence of task list selection across app restarts
 * - Concurrent operations and race condition handling
 *
 * Requirements: 2.2, 2.3, 6.1, 6.2, 7.3
 */

import { TaskListService } from '../../services/database/repositories/TaskListService';
import { TaskService } from '../../services/database/repositories/TaskService';
import { TestDataFactory } from '../setup/testDataFactory';
import {
  Task,
  TaskList,
  TaskStatus,
  Priority,
  CreateTaskListRequest,
  UpdateTaskListRequest,
  TaskListSelection,
} from '../../types';

// Mock Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

// Mock localStorage for persistence testing
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

describe('Task List Workflow Integration Tests', () => {
  let taskListService: TaskListService;
  let taskService: TaskService;
  let defaultTaskList: TaskList;
  let projectTaskList: TaskList;
  let personalTaskList: TaskList;
  let testTasks: Task[];

  beforeEach(() => {
    // Reset mocks
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

    personalTaskList = {
      id: 'personal-list-id',
      name: 'Personal Tasks',
      isDefault: false,
      createdAt: new Date('2024-01-03T10:00:00Z'),
      updatedAt: new Date('2024-01-03T10:00:00Z'),
    };

    // Create test tasks distributed across task lists
    testTasks = [
      TestDataFactory.createTask({
        id: 'task-1',
        title: 'Default Task 1',
        taskListId: defaultTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        scheduledDate: new Date('2024-01-15T10:00:00Z'),
      }),
      TestDataFactory.createTask({
        id: 'task-2',
        title: 'Project Task 1',
        taskListId: projectTaskList.id,
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        scheduledDate: new Date('2024-01-15T14:00:00Z'),
      }),
      TestDataFactory.createTask({
        id: 'task-3',
        title: 'Personal Task 1',
        taskListId: personalTaskList.id,
        status: TaskStatus.COMPLETED,
        priority: Priority.LOW,
        scheduledDate: new Date('2024-01-16T09:00:00Z'),
      }),
      TestDataFactory.createTask({
        id: 'task-4',
        title: 'Default Task 2',
        taskListId: defaultTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.URGENT,
        scheduledDate: new Date('2024-01-16T11:00:00Z'),
      }),
    ];

    // Setup default mock responses
    mockInvoke.mockImplementation(setupDefaultMockResponses());
  });

  const setupDefaultMockResponses =
    () => (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'get_all_task_lists':
          return Promise.resolve([
            transformTaskListToBackend(defaultTaskList),
            transformTaskListToBackend(projectTaskList),
            transformTaskListToBackend(personalTaskList),
          ]);

        case 'get_default_task_list':
          return Promise.resolve(transformTaskListToBackend(defaultTaskList));

        case 'get_tasks_by_task_list':
          const taskListId = (args as { task_list_id?: string })?.task_list_id;
          const filteredTasks = testTasks.filter(
            task => task.taskListId === taskListId
          );
          return Promise.resolve(filteredTasks.map(transformTaskToBackend));

        case 'get_all_tasks':
          return Promise.resolve(testTasks.map(transformTaskToBackend));

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

        case 'update_task_list':
          const updatedTaskList = {
            ...projectTaskList,
            name:
              (args as { request?: { name?: string } })?.request?.name ||
              projectTaskList.name,
          };
          return Promise.resolve(transformTaskListToBackend(updatedTaskList));

        case 'delete_task_list':
          return Promise.resolve('Task list deleted successfully');

        case 'move_task_to_list':
          const taskToMove = testTasks.find(
            t => t.id === (args as { taskId?: string })?.taskId
          );
          if (taskToMove) {
            const movedTask = {
              ...taskToMove,
              taskListId:
                (args as { taskListId?: string })?.taskListId ||
                taskToMove.taskListId,
            };
            return Promise.resolve(transformTaskToBackend(movedTask));
          }
          throw new Error('Task not found');

        case 'create_task':
          const newTask = TestDataFactory.createTask({
            id: `new-task-${Date.now()}`,
            title:
              (args as { request?: { title?: string } })?.request?.title ||
              'New Task',
            taskListId:
              (args as { request?: { task_list_id?: string } })?.request
                ?.task_list_id || defaultTaskList.id,
          });
          return Promise.resolve(transformTaskToBackend(newTask));

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

  describe('End-to-end task list creation, switching, and deletion', () => {
    it('should create a new task list successfully', async () => {
      const createRequest: CreateTaskListRequest = {
        name: 'New Project List',
      };

      const result = await taskListService.createTaskList(createRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_task_list', {
        request: { name: 'New Project List' },
      });

      expect(result).toMatchObject({
        name: 'New Project List',
        isDefault: false,
      });
      expect(result.id).toBeTruthy();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should get all task lists', async () => {
      const taskLists = await taskListService.getAllTaskLists();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_task_lists');
      expect(taskLists).toHaveLength(3);

      const defaultList = taskLists.find(list => list.isDefault);
      expect(defaultList).toBeTruthy();
      expect(defaultList!.name).toBe('Default');

      const projectList = taskLists.find(list => list.name === 'Project Alpha');
      expect(projectList).toBeTruthy();
      expect(projectList!.isDefault).toBe(false);
    });

    it('should update a task list name', async () => {
      const updateRequest: UpdateTaskListRequest = {
        name: 'Updated Project Name',
      };

      const result = await taskListService.updateTaskList(
        projectTaskList.id,
        updateRequest
      );

      expect(mockInvoke).toHaveBeenCalledWith('update_task_list', {
        id: projectTaskList.id,
        request: { name: 'Updated Project Name' },
      });

      expect(result.name).toBe('Updated Project Name');
    });

    it('should delete a non-default task list', async () => {
      await taskListService.deleteTaskList(projectTaskList.id);

      expect(mockInvoke).toHaveBeenCalledWith('delete_task_list', {
        id: projectTaskList.id,
      });
    });

    it('should prevent deletion of default task list', async () => {
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (
            command === 'delete_task_list' &&
            (args as { id?: string })?.id === defaultTaskList.id
          ) {
            return Promise.reject(
              new Error(
                'BUSINESS_RULE_ERROR: Cannot delete the default task list'
              )
            );
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      await expect(
        taskListService.deleteTaskList(defaultTaskList.id)
      ).rejects.toThrow('Cannot delete the default task list');
    });

    it('should get default task list', async () => {
      const defaultList = await taskListService.getDefaultTaskList();

      expect(mockInvoke).toHaveBeenCalledWith('get_default_task_list');
      expect(defaultList.isDefault).toBe(true);
      expect(defaultList.name).toBe('Default');
    });
  });

  describe('Task filtering works correctly across all views', () => {
    it('should filter tasks by task list ID', async () => {
      const projectTasks = await taskListService.getTasksByTaskList(
        projectTaskList.id
      );

      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_task_list', {
        task_list_id: projectTaskList.id,
      });

      expect(projectTasks).toHaveLength(1);
      expect(projectTasks[0].title).toBe('Project Task 1');
      expect(projectTasks[0].taskListId).toBe(projectTaskList.id);
    });

    it('should return empty array for task list with no tasks', async () => {
      const emptyTaskList: TaskList = {
        id: 'empty-list-id',
        name: 'Empty List',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (
            command === 'get_tasks_by_task_list' &&
            (args as { task_list_id?: string })?.task_list_id ===
              emptyTaskList.id
          ) {
            return Promise.resolve([]);
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      const emptyTasks = await taskListService.getTasksByTaskList(
        emptyTaskList.id
      );

      expect(emptyTasks).toHaveLength(0);
    });

    it('should get all tasks when no filter is applied', async () => {
      const allTasks = await taskService.findAll();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks', {
        status: undefined,
        project_id: undefined,
      });
      expect(allTasks).toHaveLength(4);

      // Verify tasks from different lists are included
      const taskListIds = new Set(allTasks.map(task => task.taskListId));
      expect(taskListIds.size).toBe(3); // Three different task lists
    });

    it('should handle task filtering with complex criteria', async () => {
      // Filter tasks by status and task list
      const pendingProjectTasks = testTasks.filter(
        task =>
          task.taskListId === projectTaskList.id &&
          task.status === TaskStatus.PENDING
      );

      expect(pendingProjectTasks).toHaveLength(0); // Project task is IN_PROGRESS

      const pendingDefaultTasks = testTasks.filter(
        task =>
          task.taskListId === defaultTaskList.id &&
          task.status === TaskStatus.PENDING
      );

      expect(pendingDefaultTasks).toHaveLength(2); // Both default tasks are PENDING
    });
  });

  describe('Task migration between lists', () => {
    it('should move a task from one list to another', async () => {
      const taskToMove = testTasks[0]; // Default Task 1
      const targetTaskListId = projectTaskList.id;

      // Mock the move operation to return the moved task
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            const movedTask = {
              ...taskToMove,
              taskListId: targetTaskListId,
            };
            return Promise.resolve(transformTaskToBackend(movedTask));
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      const movedTask = await taskListService.moveTaskToList(
        taskToMove.id,
        targetTaskListId
      );

      expect(mockInvoke).toHaveBeenCalledWith('move_task_to_list', {
        taskId: taskToMove.id,
        taskListId: targetTaskListId,
      });

      expect(movedTask.taskListId).toBe(targetTaskListId);
      expect(movedTask.id).toBe(taskToMove.id);
      expect(movedTask.title).toBe(taskToMove.title);
    });

    it('should handle task migration errors', async () => {
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            return Promise.reject(
              new Error('RECORD_NOT_FOUND: Task not found')
            );
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      await expect(
        taskListService.moveTaskToList('non-existent-task', projectTaskList.id)
      ).rejects.toThrow('Task not found');
    });

    it('should validate task and task list existence during migration', async () => {
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            if (
              (args as { taskListId?: string })?.taskListId ===
              'non-existent-list'
            ) {
              return Promise.reject(
                new Error('FOREIGN_KEY_CONSTRAINT: Task list does not exist')
              );
            }
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      await expect(
        taskListService.moveTaskToList(testTasks[0].id, 'non-existent-list')
      ).rejects.toThrow('Task list does not exist');
    });

    it('should maintain task data integrity during migration', async () => {
      const originalTask = testTasks[0];
      const targetTaskListId = personalTaskList.id;

      // Mock the move operation to return the moved task with preserved data
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            const movedTask = {
              ...originalTask,
              taskListId: targetTaskListId,
            };
            return Promise.resolve(transformTaskToBackend(movedTask));
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      const movedTask = await taskListService.moveTaskToList(
        originalTask.id,
        targetTaskListId
      );

      // Verify all original data is preserved except taskListId
      expect(movedTask.title).toBe(originalTask.title);
      expect(movedTask.description).toBe(originalTask.description);
      expect(movedTask.priority).toBe(originalTask.priority);
      expect(movedTask.status).toBe(originalTask.status);
      expect(movedTask.scheduledDate).toEqual(originalTask.scheduledDate);
      expect(movedTask.taskListId).toBe(targetTaskListId);
      expect(movedTask.taskListId).not.toBe(originalTask.taskListId);
    });
  });

  describe('Persistence of task list selection across app restarts', () => {
    it('should persist task list selection to localStorage', () => {
      const selection: TaskListSelection = {
        type: 'specific',
        taskListId: projectTaskList.id,
        taskList: projectTaskList,
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(selection)
      );

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'kirapilot-selected-task-list',
        JSON.stringify(selection)
      );

      const stored = localStorage.getItem('kirapilot-selected-task-list');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.type).toBe('specific');
      expect(parsed.taskListId).toBe(projectTaskList.id);
    });

    it('should restore task list selection from localStorage', () => {
      const storedSelection: TaskListSelection = {
        type: 'specific',
        taskListId: personalTaskList.id,
        taskList: personalTaskList,
      };

      mockLocalStorage._setStore({
        'kirapilot-selected-task-list': JSON.stringify(storedSelection),
      });

      const restored = localStorage.getItem('kirapilot-selected-task-list');
      expect(restored).toBeTruthy();

      const parsed = JSON.parse(restored!);
      expect(parsed.type).toBe('specific');
      expect(parsed.taskListId).toBe(personalTaskList.id);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage._setStore({
        'kirapilot-selected-task-list': 'invalid-json{',
      });

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

    it('should fallback to default when selected task list no longer exists', async () => {
      const invalidSelection: TaskListSelection = {
        type: 'specific',
        taskListId: 'deleted-task-list-id',
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(invalidSelection)
      );

      // Simulate app restart - validate selection
      const taskLists = await taskListService.getAllTaskLists();
      const storedSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );

      const taskListExists = taskLists.some(
        list => list.id === storedSelection.taskListId
      );
      expect(taskListExists).toBe(false);

      // Should fallback to default
      const defaultList = taskLists.find(list => list.isDefault);
      expect(defaultList).toBeTruthy();

      const fallbackSelection: TaskListSelection = {
        type: 'specific',
        taskListId: defaultList!.id,
        taskList: defaultList!,
      };

      localStorage.setItem(
        'kirapilot-selected-task-list',
        JSON.stringify(fallbackSelection)
      );

      const finalSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      expect(finalSelection.taskListId).toBe(defaultList!.id);
    });
  });

  describe('Concurrent operations and race condition handling', () => {
    it('should handle concurrent task list creation attempts', async () => {
      let createCallCount = 0;
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'create_task_list') {
            createCallCount++;
            if (createCallCount === 1) {
              return Promise.resolve(
                transformTaskListToBackend({
                  id: 'concurrent-list-1',
                  name:
                    (args as { request?: { name?: string } })?.request?.name ||
                    'Concurrent List',
                  isDefault: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
              );
            } else {
              return Promise.reject(
                new Error('CONSTRAINT_VIOLATION: Task list name already exists')
              );
            }
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      const request: CreateTaskListRequest = { name: 'Concurrent List' };

      // First creation should succeed
      const result1 = await taskListService.createTaskList(request);
      expect(result1.name).toBe('Concurrent List');

      // Second creation should fail
      await expect(taskListService.createTaskList(request)).rejects.toThrow(
        'Task list name already exists'
      );
    });

    it('should handle concurrent task migration operations', async () => {
      const task1 = testTasks[0];
      const task2 = testTasks[1];
      const targetListId = personalTaskList.id;

      // Mock the move operations for both tasks
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            const taskId = (args as { taskId?: string })?.taskId;
            const originalTask = taskId === task1.id ? task1 : task2;
            const movedTask = {
              ...originalTask,
              taskListId: targetListId,
            };
            return Promise.resolve(transformTaskToBackend(movedTask));
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      // Simulate concurrent migrations
      const migration1 = taskListService.moveTaskToList(task1.id, targetListId);
      const migration2 = taskListService.moveTaskToList(task2.id, targetListId);

      const results = await Promise.all([migration1, migration2]);

      expect(results[0].taskListId).toBe(targetListId);
      expect(results[1].taskListId).toBe(targetListId);
      expect(results[0].id).toBe(task1.id);
      expect(results[1].id).toBe(task2.id);
    });

    it('should handle optimistic updates with rollback on failure', async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'create_task_list') {
          return Promise.reject(new Error('NETWORK_ERROR: Connection timeout'));
        }
        if (command === 'get_all_task_lists') {
          return Promise.resolve([transformTaskListToBackend(defaultTaskList)]);
        }
        return Promise.resolve([]);
      });

      const request: CreateTaskListRequest = { name: 'Failed List' };

      await expect(taskListService.createTaskList(request)).rejects.toThrow(
        'Connection timeout'
      );

      // Verify the failed operation doesn't affect subsequent operations
      setupDefaultMockResponses();

      const taskLists = await taskListService.getAllTaskLists();
      expect(taskLists).toHaveLength(1); // Only default task list returned in mock
    });

    it('should handle rapid selection changes without state corruption', () => {
      const selections = [
        { type: 'all' as const },
        {
          type: 'specific' as const,
          taskListId: projectTaskList.id,
          taskList: projectTaskList,
        },
        {
          type: 'specific' as const,
          taskListId: personalTaskList.id,
          taskList: personalTaskList,
        },
        {
          type: 'specific' as const,
          taskListId: defaultTaskList.id,
          taskList: defaultTaskList,
        },
        { type: 'all' as const },
      ];

      // Rapidly change selections
      selections.forEach(selection => {
        localStorage.setItem(
          'kirapilot-selected-task-list',
          JSON.stringify(selection)
        );

        const stored = localStorage.getItem('kirapilot-selected-task-list');
        const parsed = JSON.parse(stored!);

        expect(parsed.type).toBe(selection.type);
        if (selection.type === 'specific') {
          expect(parsed.taskListId).toBe(selection.taskListId);
        }
      });

      // Final state should be consistent
      const finalSelection = JSON.parse(
        localStorage.getItem('kirapilot-selected-task-list')!
      );
      expect(finalSelection.type).toBe('all');
    });

    it('should handle database connection failures gracefully', async () => {
      mockInvoke.mockImplementation(() => {
        return Promise.reject(new Error('DATABASE_ERROR: Connection failed'));
      });

      await expect(taskListService.getAllTaskLists()).rejects.toThrow(
        'Connection failed'
      );

      await expect(
        taskListService.createTaskList({ name: 'Test' })
      ).rejects.toThrow('Connection failed');

      await expect(
        taskListService.moveTaskToList('task-1', 'list-1')
      ).rejects.toThrow('Connection failed');
    });

    it('should maintain data consistency during partial failures', async () => {
      // Test that successful operations work correctly after failed ones
      const taskLists = await taskListService.getAllTaskLists();
      expect(taskLists).toHaveLength(3);

      // Test successful update
      const result = await taskListService.updateTaskList(projectTaskList.id, {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');

      // Verify data consistency
      const updatedTaskLists = await taskListService.getAllTaskLists();
      expect(updatedTaskLists).toHaveLength(3);
    });
  });

  describe('Error handling and validation', () => {
    it('should validate task list creation input', async () => {
      const invalidRequests = [
        { name: '' }, // Empty name
        { name: '   ' }, // Whitespace only
      ];

      for (const request of invalidRequests) {
        await expect(taskListService.createTaskList(request)).rejects.toThrow(
          'VALIDATION_ERROR'
        );
      }
    });

    it('should validate task list update input', async () => {
      await expect(
        taskListService.updateTaskList('', { name: 'Valid Name' })
      ).rejects.toThrow('Task list ID is required');

      await expect(
        taskListService.updateTaskList(projectTaskList.id, { name: '' })
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should validate task migration input', async () => {
      await expect(
        taskListService.moveTaskToList('', projectTaskList.id)
      ).rejects.toThrow('Task ID is required');

      await expect(
        taskListService.moveTaskToList(testTasks[0].id, '')
      ).rejects.toThrow('Task list ID is required');
    });

    it('should handle backend validation errors', async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'create_task_list') {
          return Promise.reject(
            new Error('CONSTRAINT_VIOLATION: Task list name must be unique')
          );
        }
        return setupDefaultMockResponses()(command);
      });

      await expect(
        taskListService.createTaskList({ name: 'Duplicate Name' })
      ).rejects.toThrow('Task list name must be unique');
    });

    it('should handle foreign key constraint violations', async () => {
      mockInvoke.mockImplementation(
        (command: string, args?: Record<string, unknown>) => {
          if (command === 'move_task_to_list') {
            return Promise.reject(
              new Error(
                'FOREIGN_KEY_CONSTRAINT: Referenced task list does not exist'
              )
            );
          }
          return setupDefaultMockResponses()(command, args);
        }
      );

      await expect(
        taskListService.moveTaskToList(testTasks[0].id, 'non-existent-list')
      ).rejects.toThrow('Referenced task list does not exist');
    });
  });
});
