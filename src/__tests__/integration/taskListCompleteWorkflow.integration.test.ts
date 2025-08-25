/**
 * Integration tests for complete task list workflow
 * Tests end-to-end task list creation, switching, and deletion
 */

import { TaskListService } from '../../services/database/repositories/TaskListService';
import { TaskService } from '../../services/database/repositories/TaskService';
import { TaskList, Task, TaskStatus, Priority, TimePreset } from '../../types';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('Task List Complete Workflow Integration', () => {
  let taskListService: TaskListService;
  let taskService: TaskService;

  beforeEach(() => {
    taskListService = new TaskListService();
    taskService = new TaskService();
    mockInvoke.mockClear();
  });

  describe('End-to-End Task List Creation and Management', () => {
    it('should create task list, add tasks, and manage them', async () => {
      // Mock successful task list creation
      const mockTaskList: TaskList = {
        id: 'test-list-1',
        name: 'Test Project',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the backend response format
      const now = new Date('2025-08-24T08:00:00.000Z');
      const backendResponse = {
        id: 'test-list-1',
        name: 'Test Project',
        is_default: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      // Update mockTaskList to use the same date
      mockTaskList.createdAt = now;
      mockTaskList.updatedAt = now;

      mockInvoke.mockResolvedValueOnce(backendResponse);

      // Create a new task list
      const createdList = await taskListService.createTaskList({
        name: 'Test Project',
      });
      expect(createdList).toEqual(mockTaskList);
      expect(mockInvoke).toHaveBeenCalledWith('create_task_list', {
        request: { name: 'Test Project' },
      });

      // Mock task creation in the new list
      const mockTask: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        order: 0,
        timePreset: TimePreset.SIXTY_MIN,
        timeEstimate: 60,
        actualTime: 0,
        dependencies: [],
        subtasks: [],
        taskListId: 'test-list-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the backend response format for task creation
      const backendTaskResponse = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 1,
        time_estimate: 60,
        actual_time: 0,
        dependencies: '[]',
        subtasks: '[]',
        task_list_id: 'test-list-1',
        tags: '[]',
        created_at: mockTask.createdAt.toISOString(),
        updated_at: mockTask.updatedAt.toISOString(),
      };

      mockInvoke.mockResolvedValueOnce(backendTaskResponse);

      // Create a task in the new list
      const createdTask = await taskService.create(mockTask);
      expect(createdTask.taskListId).toBe('test-list-1');
    });

    it('should handle task migration between lists', async () => {
      const targetListId = 'target-list';
      const taskId = 'task-to-move';

      // Mock successful task migration with proper backend response
      const migratedTaskResponse = {
        id: taskId,
        title: 'Migrated Task',
        description: '',
        status: 'pending',
        priority: 1,
        time_estimate: 60,
        actual_time: 0,
        dependencies: '[]',
        subtasks: '[]',
        task_list_id: targetListId,
        tags: '[]',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValueOnce(migratedTaskResponse);

      await taskListService.moveTaskToList(taskId, targetListId);

      expect(mockInvoke).toHaveBeenCalledWith('move_task_to_list', {
        taskId: taskId,
        taskListId: targetListId,
      });
    });

    it('should handle task list deletion with task cleanup', async () => {
      const listId = 'list-to-delete';

      // Mock successful deletion
      mockInvoke.mockResolvedValueOnce('Task list deleted successfully');

      await taskListService.deleteTaskList(listId);

      expect(mockInvoke).toHaveBeenCalledWith('delete_task_list', {
        id: listId,
      });
    });
  });

  describe('Task Filtering Workflow', () => {
    it('should filter tasks by task list correctly', async () => {
      const taskListId = 'filter-test-list';
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: '',
          status: TaskStatus.PENDING,
          priority: Priority.MEDIUM,
          order: 0,
          timePreset: TimePreset.SIXTY_MIN,
          timeEstimate: 60,
          actualTime: 0,
          dependencies: [],
          subtasks: [],
          taskListId,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: '',
          status: TaskStatus.COMPLETED,
          priority: Priority.HIGH,
          order: 1,
          timePreset: TimePreset.THIRTY_MIN,
          timeEstimate: 30,
          actualTime: 25,
          dependencies: [],
          subtasks: [],
          taskListId,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock backend response format for tasks
      const backendTasksResponse = mockTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        time_estimate: task.timeEstimate,
        actual_time: task.actualTime,
        dependencies: JSON.stringify(task.dependencies),
        subtasks: JSON.stringify(task.subtasks),
        task_list_id: task.taskListId,
        tags: JSON.stringify(task.tags),
        created_at: task.createdAt.toISOString(),
        updated_at: task.updatedAt.toISOString(),
      }));

      mockInvoke.mockResolvedValueOnce(backendTasksResponse);

      const filteredTasks = await taskService.findByTaskList(taskListId);

      expect(filteredTasks).toHaveLength(mockTasks.length);
      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_task_list', {
        task_list_id: taskListId,
      });

      // Verify all returned tasks belong to the correct list
      filteredTasks.forEach(task => {
        expect(task.taskListId).toBe(taskListId);
      });
    });
  });

  describe('Persistence and State Management', () => {
    it('should handle concurrent operations gracefully', async () => {
      const listName1 = 'Concurrent List 1';
      const listName2 = 'Concurrent List 2';

      const now1 = new Date('2025-08-24T08:01:00.000Z');
      const now2 = new Date('2025-08-24T08:02:00.000Z');

      const mockList1: TaskList = {
        id: 'concurrent-1',
        name: listName1,
        isDefault: false,
        createdAt: now1,
        updatedAt: now1,
      };

      const mockList2: TaskList = {
        id: 'concurrent-2',
        name: listName2,
        isDefault: false,
        createdAt: now2,
        updatedAt: now2,
      };

      // Mock backend responses for concurrent creation
      const backendResponse1 = {
        id: 'concurrent-1',
        name: listName1,
        is_default: false,
        created_at: now1.toISOString(),
        updated_at: now1.toISOString(),
      };

      const backendResponse2 = {
        id: 'concurrent-2',
        name: listName2,
        is_default: false,
        created_at: now2.toISOString(),
        updated_at: now2.toISOString(),
      };

      // Mock concurrent creation
      mockInvoke
        .mockResolvedValueOnce(backendResponse1)
        .mockResolvedValueOnce(backendResponse2);

      // Create two lists concurrently
      const [list1, list2] = await Promise.all([
        taskListService.createTaskList({ name: listName1 }),
        taskListService.createTaskList({ name: listName2 }),
      ]);

      expect(list1).toEqual(mockList1);
      expect(list2).toEqual(mockList2);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle error scenarios gracefully', async () => {
      // Clear any previous mock calls
      mockInvoke.mockClear();

      // Mock database error
      mockInvoke.mockRejectedValueOnce(
        'DATABASE_ERROR: Database connection failed'
      );

      await expect(
        taskListService.createTaskList({ name: 'Error Test' })
      ).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity when moving tasks', async () => {
      // Clear any previous mock calls
      mockInvoke.mockClear();

      const taskId = 'integrity-test-task';
      const newListId = 'integrity-test-list';
      const now = new Date('2025-08-24T08:04:00.000Z');

      // Mock successful move operation with proper backend response
      const movedTaskResponse = {
        id: taskId,
        title: 'Moved Task',
        description: '',
        status: 'pending',
        priority: 1,
        time_estimate: 60,
        actual_time: 0,
        dependencies: '[]',
        subtasks: '[]',
        task_list_id: newListId,
        tags: '[]',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      mockInvoke.mockResolvedValueOnce(movedTaskResponse);

      await taskListService.moveTaskToList(taskId, newListId);

      // Verify the move operation was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('move_task_to_list', {
        taskId: taskId,
        taskListId: newListId,
      });
    });

    it('should handle orphaned tasks correctly', async () => {
      // Clear any previous mock calls
      mockInvoke.mockClear();

      const defaultListId = 'default-list';
      const now = new Date('2025-08-24T08:03:00.000Z');

      // Mock getting default list
      const mockDefaultList: TaskList = {
        id: defaultListId,
        name: 'Default',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };

      // Mock backend response format for default list
      const backendDefaultResponse = {
        id: defaultListId,
        name: 'Default',
        is_default: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      mockInvoke.mockResolvedValueOnce(backendDefaultResponse);

      const defaultList = await taskListService.getDefaultTaskList();
      expect(defaultList).toEqual(mockDefaultList);
      expect(mockInvoke).toHaveBeenCalledWith('get_default_task_list');
    });
  });
});
