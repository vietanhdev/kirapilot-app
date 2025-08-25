// Tests for TaskService (SeaORM backend)
import { describe, test, expect, beforeEach } from '@jest/globals';
import { TaskService } from '../TaskService';
import { Priority, TaskStatus } from '../../../../types';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core');
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock the database initialization
jest.mock('../../index', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    service = new TaskService();
    mockInvoke.mockClear();
  });

  describe('create', () => {
    test('should create a new task', async () => {
      const taskRequest = {
        title: 'Test Task',
        description: 'A test task description',
        priority: Priority.HIGH,
        timeEstimate: 60,
        tags: ['test', 'unit'],
      };

      const mockBackendTask = {
        id: 'test-id',
        title: taskRequest.title,
        description: taskRequest.description,
        priority: taskRequest.priority,
        status: 'pending',
        dependencies: '[]',
        time_estimate: taskRequest.timeEstimate,
        actual_time: 0,
        due_date: null,
        scheduled_date: null,
        tags: JSON.stringify(taskRequest.tags),
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockBackendTask);

      const task = await service.create(taskRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: {
          title: taskRequest.title,
          description: taskRequest.description,
          priority: taskRequest.priority,
          order_num: 0,
          time_estimate: taskRequest.timeEstimate,
          due_date: undefined,
          scheduled_date: undefined,
          tags: taskRequest.tags,
          dependencies: undefined,
          project_id: undefined,
          parent_task_id: undefined,
          task_list_id: undefined,
        },
      });
      expect(task.id).toBe('test-id');
      expect(task.title).toBe(taskRequest.title);
      expect(task.description).toBe(taskRequest.description);
      expect(task.priority).toBe(taskRequest.priority);
      expect(task.status).toBe('pending');
      expect(task.timeEstimate).toBe(taskRequest.timeEstimate);
      expect(task.tags).toEqual(taskRequest.tags);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle creation errors', async () => {
      const taskRequest = {
        title: 'Test Task',
        description: 'A test task description',
      };

      mockInvoke.mockRejectedValue(new Error('Backend error'));

      await expect(service.create(taskRequest)).rejects.toThrow(
        'Backend error'
      );
    });
  });

  describe('findById', () => {
    test('should find existing task', async () => {
      const mockBackendTask = {
        id: 'test-id',
        title: 'Test Task',
        description: 'A test task',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 0,
        actual_time: 0,
        due_date: null,
        scheduled_date: null,
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockBackendTask);

      const foundTask = await service.findById('test-id');

      expect(mockInvoke).toHaveBeenCalledWith('get_task', { id: 'test-id' });
      expect(foundTask).not.toBeNull();
      expect(foundTask!.id).toBe('test-id');
      expect(foundTask!.title).toBe('Test Task');
    });

    test('should return null for non-existent task', async () => {
      mockInvoke.mockResolvedValue(null);

      const foundTask = await service.findById('non-existent-id');

      expect(foundTask).toBeNull();
    });
  });

  describe('findAll', () => {
    test('should return all tasks without filters', async () => {
      const mockBackendTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          priority: Priority.HIGH,
          status: 'pending',
          dependencies: '[]',
          time_estimate: 0,
          actual_time: 0,
          due_date: null,
          scheduled_date: null,
          tags: '[]',
          project_id: null,
          parent_task_id: null,
          subtasks: '[]',
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          priority: Priority.LOW,
          status: 'completed',
          dependencies: '[]',
          time_estimate: 0,
          actual_time: 0,
          due_date: null,
          scheduled_date: null,
          tags: '[]',
          project_id: null,
          parent_task_id: null,
          subtasks: '[]',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendTasks);

      const tasks = await service.findAll();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks', {
        status: undefined,
        project_id: undefined,
      });
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[1].id).toBe('task-2');
    });

    test('should filter by status', async () => {
      const mockBackendTasks = [
        {
          id: 'task-1',
          title: 'Pending Task',
          description: 'A pending task',
          priority: Priority.MEDIUM,
          status: 'pending',
          dependencies: '[]',
          time_estimate: 0,
          actual_time: 0,
          due_date: null,
          scheduled_date: null,
          tags: '[]',
          project_id: null,
          parent_task_id: null,
          subtasks: '[]',
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendTasks);

      const pendingTasks = await service.findAll({
        status: [TaskStatus.PENDING],
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks', {
        status: 'pending',
        project_id: undefined,
      });
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].status).toBe('pending');
    });
  });

  describe('update', () => {
    test('should update task properties', async () => {
      const mockUpdatedTask = {
        id: 'test-id',
        title: 'Updated Title',
        description: 'Original description',
        priority: Priority.HIGH,
        status: 'in_progress',
        dependencies: '[]',
        time_estimate: 0,
        actual_time: 0,
        due_date: null,
        scheduled_date: null,
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockUpdatedTask);

      const updateRequest = {
        title: 'Updated Title',
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
      };

      const updatedTask = await service.update('test-id', updateRequest);

      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: 'test-id',
        request: updateRequest,
      });
      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.priority).toBe(Priority.HIGH);
      expect(updatedTask.status).toBe('in_progress');
    });
  });

  describe('delete', () => {
    test('should delete task', async () => {
      mockInvoke.mockResolvedValue('Task deleted successfully');

      await service.delete('test-id');

      expect(mockInvoke).toHaveBeenCalledWith('delete_task', { id: 'test-id' });
    });
  });

  describe('search', () => {
    test('should search tasks', async () => {
      const mockSearchResults = [
        {
          id: 'task-1',
          title: 'Matching Task',
          description: 'A task that matches the search',
          priority: Priority.MEDIUM,
          status: 'pending',
          dependencies: '[]',
          time_estimate: 0,
          actual_time: 0,
          due_date: null,
          scheduled_date: null,
          tags: '[]',
          project_id: null,
          parent_task_id: null,
          subtasks: '[]',
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockSearchResults);

      const results = await service.search('matching');

      expect(mockInvoke).toHaveBeenCalledWith('search_tasks', {
        query: 'matching',
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Matching Task');
    });
  });

  describe('getStatistics', () => {
    test('should return task statistics', async () => {
      const mockStats = {
        total: 10,
        completed: 5,
        in_progress: 3,
        pending: 2,
      };

      mockInvoke.mockResolvedValue(mockStats);

      const stats = await service.getStatistics();

      expect(mockInvoke).toHaveBeenCalledWith('get_task_stats');
      expect(stats.total).toBe(10);
      expect(stats.byStatus.completed).toBe(5);
      expect(stats.byStatus.in_progress).toBe(3);
      expect(stats.byStatus.pending).toBe(2);
    });
  });
});
