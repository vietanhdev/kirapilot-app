import { TaskListService } from '../repositories/TaskListService';
import { CreateTaskListRequest, UpdateTaskListRequest } from '../../../types';
import { invoke } from '@tauri-apps/api/core';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock the database error message function
jest.mock('../index', () => ({
  getDatabaseErrorMessage: (key: string) => `Error: ${key}`,
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('TaskListService Error Handling', () => {
  let service: TaskListService;

  beforeEach(() => {
    service = new TaskListService();
    mockInvoke.mockClear();
  });

  describe('createTaskList', () => {
    it('should validate request before calling backend', async () => {
      const invalidRequest: CreateTaskListRequest = { name: '' };

      await expect(service.createTaskList(invalidRequest)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name is required'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should validate name length', async () => {
      const longName = 'a'.repeat(256);
      const invalidRequest: CreateTaskListRequest = { name: longName };

      await expect(service.createTaskList(invalidRequest)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name cannot exceed 255 characters'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should validate reserved names', async () => {
      const invalidRequest: CreateTaskListRequest = { name: 'All' };

      await expect(service.createTaskList(invalidRequest)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name cannot be a reserved name (All)'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', async () => {
      const request: CreateTaskListRequest = { name: '  Test List  ' };
      const mockResult = {
        id: '123',
        name: 'Test List',
        is_default: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockResult);

      await service.createTaskList(request);

      expect(mockInvoke).toHaveBeenCalledWith('create_task_list', {
        request: { name: 'Test List' },
      });
    });

    it('should handle backend validation errors', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockRejectedValue(
        'DUPLICATE_ERROR: A task list with the name "Test" already exists'
      );

      const error = await service.createTaskList(request).catch(e => e);

      expect(error.message).toContain('taskListService.error.createFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('DUPLICATE_ERROR');
    });

    it('should handle database errors', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockRejectedValue('DATABASE_ERROR: Connection failed');

      const error = await service.createTaskList(request).catch(e => e);

      expect(error.message).toContain('taskListService.error.createFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('DATABASE_ERROR');
    });
  });

  describe('updateTaskList', () => {
    it('should validate task list ID', async () => {
      const request: UpdateTaskListRequest = { name: 'Updated Name' };

      await expect(service.updateTaskList('', request)).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      await expect(service.updateTaskList('   ', request)).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should validate request before calling backend', async () => {
      const invalidRequest: UpdateTaskListRequest = { name: '' };

      await expect(
        service.updateTaskList('123', invalidRequest)
      ).rejects.toThrow('VALIDATION_ERROR: Task list name is required');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should trim whitespace from ID and name', async () => {
      const request: UpdateTaskListRequest = { name: '  Updated Name  ' };
      const mockResult = {
        id: '123',
        name: 'Updated Name',
        is_default: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockResult);

      await service.updateTaskList('  123  ', request);

      expect(mockInvoke).toHaveBeenCalledWith('update_task_list', {
        id: '123',
        request: { name: 'Updated Name' },
      });
    });

    it('should handle business rule errors', async () => {
      const request: UpdateTaskListRequest = { name: 'New Name' };
      mockInvoke.mockRejectedValue(
        'BUSINESS_RULE_ERROR: Cannot update the default task list name'
      );

      const error = await service.updateTaskList('123', request).catch(e => e);

      expect(error.message).toContain('taskListService.error.updateFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('BUSINESS_RULE_ERROR');
    });
  });

  describe('deleteTaskList', () => {
    it('should validate task list ID', async () => {
      await expect(service.deleteTaskList('')).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      await expect(service.deleteTaskList('   ')).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should trim whitespace from ID', async () => {
      mockInvoke.mockResolvedValue('Task list deleted successfully');

      await service.deleteTaskList('  123  ');

      expect(mockInvoke).toHaveBeenCalledWith('delete_task_list', {
        id: '123',
      });
    });

    it('should handle not found errors', async () => {
      mockInvoke.mockRejectedValue(
        'RECORD_NOT_FOUND: Task list with ID "123" not found'
      );

      const error = await service.deleteTaskList('123').catch(e => e);

      expect(error.message).toContain('taskListService.error.deleteFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('RECORD_NOT_FOUND');
    });

    it('should handle business rule errors', async () => {
      mockInvoke.mockRejectedValue(
        'BUSINESS_RULE_ERROR: Cannot delete the default task list'
      );

      const error = await service.deleteTaskList('123').catch(e => e);

      expect(error.message).toContain('taskListService.error.deleteFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('BUSINESS_RULE_ERROR');
    });
  });

  describe('moveTaskToList', () => {
    it('should validate task ID and task list ID', async () => {
      await expect(service.moveTaskToList('', 'list123')).rejects.toThrow(
        'VALIDATION_ERROR: Task ID is required'
      );

      await expect(service.moveTaskToList('task123', '')).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should trim whitespace from IDs', async () => {
      const mockResult = {
        id: 'task123',
        title: 'Test Task',
        description: '',
        priority: 1,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        tags: '[]',
        subtasks: '[]',
        task_list_id: 'list123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockResult);

      await service.moveTaskToList('  task123  ', '  list123  ');

      expect(mockInvoke).toHaveBeenCalledWith('move_task_to_list', {
        taskId: 'task123',
        taskListId: 'list123',
      });
    });

    it('should handle not found errors', async () => {
      mockInvoke.mockRejectedValue('RECORD_NOT_FOUND: Task list not found');

      const error = await service
        .moveTaskToList('task123', 'list123')
        .catch(e => e);

      expect(error.message).toContain('taskListService.error.moveTaskFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('RECORD_NOT_FOUND');
    });
  });

  describe('getTasksByTaskList', () => {
    it('should validate task list ID', async () => {
      await expect(service.getTasksByTaskList('')).rejects.toThrow(
        'VALIDATION_ERROR: Task list ID is required'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should trim whitespace from ID', async () => {
      mockInvoke.mockResolvedValue([]);

      await service.getTasksByTaskList('  list123  ');

      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_task_list', {
        task_list_id: 'list123',
      });
    });
  });

  describe('getAllTaskLists', () => {
    it('should handle network errors', async () => {
      mockInvoke.mockRejectedValue('Network error: fetch failed');

      const error = await service.getAllTaskLists().catch(e => e);

      expect(error.message).toContain('taskListService.error.getAllFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('NETWORK_ERROR');
    });
  });

  describe('getDefaultTaskList', () => {
    it('should handle dependency errors', async () => {
      mockInvoke.mockRejectedValue(
        'DEPENDENCY_ERROR: Failed to get default task list'
      );

      const error = await service.getDefaultTaskList().catch(e => e);

      expect(error.message).toContain('Failed to get default task list');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('DEPENDENCY_ERROR');
    });
  });

  describe('Enhanced validation edge cases', () => {
    it('should validate names with special characters', async () => {
      const invalidRequests = [
        { name: 'test\0name' }, // null character
        { name: '.hidden' }, // starts with dot
        { name: 'name.' }, // ends with dot
        { name: '..' }, // only dots
      ];

      for (const request of invalidRequests) {
        await expect(service.createTaskList(request)).rejects.toThrow();
        expect(mockInvoke).not.toHaveBeenCalled();
        mockInvoke.mockClear();
      }
    });

    it('should handle case-insensitive reserved names', async () => {
      const reservedNames = ['All', 'ALL', 'all', 'aLL', 'AlL'];

      for (const name of reservedNames) {
        await expect(service.createTaskList({ name })).rejects.toThrow();
        expect(mockInvoke).not.toHaveBeenCalled();
        mockInvoke.mockClear();
      }
    });

    it('should handle concurrent operation errors', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockRejectedValue(
        'TRANSACTION_ERROR: Concurrent modification detected'
      );

      const error = await service.createTaskList(request).catch(e => e);

      expect(error.message).toContain('taskListService.error.createFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('TRANSACTION_ERROR');
    });

    it('should handle consistency errors', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockRejectedValue(
        'CONSISTENCY_ERROR: Data integrity violation'
      );

      const error = await service.createTaskList(request).catch(e => e);

      expect(error.message).toContain('taskListService.error.createFailed');
      expect(error.taskListError).toBeDefined();
      expect(error.taskListError.type).toBe('CONSISTENCY_ERROR');
    });

    it('should handle malformed backend responses', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockResolvedValue(null); // Invalid response

      await expect(service.createTaskList(request)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const request: CreateTaskListRequest = { name: 'Test' };
      mockInvoke.mockRejectedValue('NETWORK_ERROR: Request timeout');

      const error = await service.createTaskList(request).catch(e => e);

      expect(error.taskListError.type).toBe('NETWORK_ERROR');
    });
  });
});
