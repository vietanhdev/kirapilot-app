// Tests for TaskService scheduledDate functionality
import { TaskService } from '../repositories/TaskService';
import { Priority, TaskStatus } from '../../../types';
import { invoke } from '@tauri-apps/api/core';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('TaskService - ScheduledDate Functionality', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
    mockInvoke.mockClear();
  });

  describe('create method', () => {
    it('should serialize scheduledDate to ISO string when creating task', async () => {
      const testDate = new Date('2025-01-15T10:00:00.000Z');
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: null,
        scheduled_date: '2025-01-15T10:00:00.000Z',
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const createRequest = {
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        scheduledDate: testDate,
        timeEstimate: 60,
        tags: [],
        dependencies: [],
      };

      await service.create(createRequest);

      // Verify that invoke was called with serialized date and snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: {
          title: 'Test Task',
          description: 'Test description',
          priority: Priority.MEDIUM,
          scheduled_date: '2025-01-15T10:00:00.000Z', // Should be ISO string
          time_estimate: 60,
          tags: [],
          dependencies: [],
          due_date: undefined,
          project_id: undefined,
          parent_task_id: undefined,
          order_num: 0,
          task_list_id: undefined,
          generation_date: undefined,
          is_periodic_instance: false,
          periodic_template_id: undefined,
        },
      });
    });

    it('should handle undefined scheduledDate correctly', async () => {
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: null,
        scheduled_date: null,
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const createRequest = {
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        scheduledDate: undefined,
        timeEstimate: 60,
        tags: [],
        dependencies: [],
      };

      await service.create(createRequest);

      // Verify that invoke was called with undefined scheduledDate and snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: {
          title: 'Test Task',
          description: 'Test description',
          priority: Priority.MEDIUM,
          scheduled_date: undefined,
          time_estimate: 60,
          tags: [],
          dependencies: [],
          due_date: undefined,
          project_id: undefined,
          parent_task_id: undefined,
          order_num: 0,
          task_list_id: undefined,
          generation_date: undefined,
          is_periodic_instance: false,
          periodic_template_id: undefined,
        },
      });
    });

    it('should serialize both dueDate and scheduledDate correctly', async () => {
      const testScheduledDate = new Date('2025-01-15T10:00:00.000Z');
      const testDueDate = new Date('2025-01-20T18:00:00.000Z');

      const mockBackendResponse = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.HIGH,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 120,
        actual_time: 0,
        due_date: '2025-01-20T18:00:00.000Z',
        scheduled_date: '2025-01-15T10:00:00.000Z',
        tags: '["urgent", "important"]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const createRequest = {
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.HIGH,
        dueDate: testDueDate,
        scheduledDate: testScheduledDate,
        timeEstimate: 120,
        tags: ['urgent', 'important'],
        dependencies: [],
      };

      const result = await service.create(createRequest);

      // Verify that invoke was called with both dates serialized and snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: {
          title: 'Test Task',
          description: 'Test description',
          priority: Priority.HIGH,
          due_date: '2025-01-20T18:00:00.000Z',
          scheduled_date: '2025-01-15T10:00:00.000Z',
          time_estimate: 120,
          tags: ['urgent', 'important'],
          dependencies: [],
          project_id: undefined,
          parent_task_id: undefined,
          order_num: 0,
          task_list_id: undefined,
          generation_date: undefined,
          is_periodic_instance: false,
          periodic_template_id: undefined,
        },
      });

      // Verify that the returned task has proper Date objects
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.scheduledDate?.toISOString()).toBe(
        '2025-01-15T10:00:00.000Z'
      );
      expect(result.dueDate?.toISOString()).toBe('2025-01-20T18:00:00.000Z');
    });
  });

  describe('update method', () => {
    it('should serialize scheduledDate to ISO string when updating task', async () => {
      const testDate = new Date('2025-01-16T14:30:00.000Z');
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Updated Task',
        description: 'Updated description',
        priority: Priority.HIGH,
        status: 'in_progress',
        dependencies: '[]',
        time_estimate: 90,
        actual_time: 30,
        due_date: null,
        scheduled_date: '2025-01-16T14:30:00.000Z',
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-16T12:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const updateRequest = {
        title: 'Updated Task',
        scheduledDate: testDate,
        status: TaskStatus.IN_PROGRESS,
      };

      await service.update('test-id', updateRequest);

      // Verify that invoke was called with serialized date and snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: 'test-id',
        request: {
          title: 'Updated Task',
          scheduled_date: '2025-01-16T14:30:00.000Z',
          status: TaskStatus.IN_PROGRESS,
        },
      });
    });

    it('should handle moving task from scheduled to backlog (scheduledDate = undefined)', async () => {
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Task moved to backlog',
        description: 'Test description',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: null,
        scheduled_date: null, // Moved to backlog
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-16T12:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const updateRequest = {
        scheduledDate: undefined, // Moving to backlog
      };

      const result = await service.update('test-id', updateRequest);

      // Verify that invoke was called with clear_scheduled_date flag
      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: 'test-id',
        request: {
          clear_scheduled_date: true,
        },
      });

      // Verify that the returned task has no scheduledDate
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should handle updating scheduledDate from undefined to a specific date', async () => {
      const newScheduledDate = new Date('2025-01-17T09:00:00.000Z');
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Task scheduled',
        description: 'Test description',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: null,
        scheduled_date: '2025-01-17T09:00:00.000Z',
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-16T12:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const updateRequest = {
        scheduledDate: newScheduledDate,
      };

      const result = await service.update('test-id', updateRequest);

      // Verify that invoke was called with serialized date and snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: 'test-id',
        request: {
          scheduled_date: '2025-01-17T09:00:00.000Z',
        },
      });

      // Verify that the returned task has the correct scheduledDate
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.scheduledDate?.toISOString()).toBe(
        '2025-01-17T09:00:00.000Z'
      );
    });
  });

  describe('transformTaskFromBackend method', () => {
    it('should correctly transform backend task with scheduledDate to frontend format', async () => {
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: '2025-01-20T18:00:00.000Z',
        scheduled_date: '2025-01-15T10:00:00.000Z',
        tags: '["work", "important"]',
        project_id: 'project-123',
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await service.findById('test-id');

      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBeInstanceOf(Date);
      expect(result!.dueDate).toBeInstanceOf(Date);
      expect(result!.scheduledDate!.toISOString()).toBe(
        '2025-01-15T10:00:00.000Z'
      );
      expect(result!.dueDate!.toISOString()).toBe('2025-01-20T18:00:00.000Z');
      expect(result!.tags).toEqual(['work', 'important']);
      expect(result!.projectId).toBe('project-123');
    });

    it('should handle null scheduledDate from backend correctly', async () => {
      const mockBackendResponse = {
        id: 'test-id',
        title: 'Backlog Task',
        description: 'Task in backlog',
        priority: Priority.LOW,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 30,
        actual_time: 0,
        due_date: null,
        scheduled_date: null, // No scheduled date
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await service.findById('test-id');

      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBeUndefined();
      expect(result!.dueDate).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle Tauri invoke errors gracefully during create', async () => {
      mockInvoke.mockRejectedValue(new Error('Database connection failed'));

      const createRequest = {
        title: 'Test Task',
        scheduledDate: new Date('2025-01-15T10:00:00.000Z'),
        timeEstimate: 60,
        tags: [],
        dependencies: [],
      };

      await expect(service.create(createRequest)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle Tauri invoke errors gracefully during update', async () => {
      mockInvoke.mockRejectedValue(new Error('Task not found'));

      const updateRequest = {
        scheduledDate: new Date('2025-01-15T10:00:00.000Z'),
      };

      await expect(
        service.update('non-existent-id', updateRequest)
      ).rejects.toThrow(
        'taskService.error.updateFailed: Error: Task not found'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle weekly planner task creation scenario', async () => {
      // Simulate creating a task from the weekly planner with a specific scheduled date
      const scheduledDate = new Date('2025-01-15T00:00:00.000Z'); // Start of day
      const mockBackendResponse = {
        id: 'weekly-task-id',
        title: 'Weekly Planner Task',
        description: 'Task created from weekly planner',
        priority: Priority.MEDIUM,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        due_date: null,
        scheduled_date: '2025-01-15T00:00:00.000Z',
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-14T20:00:00.000Z',
        updated_at: '2025-01-14T20:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const createRequest = {
        title: 'Weekly Planner Task',
        description: 'Task created from weekly planner',
        priority: Priority.MEDIUM,
        scheduledDate: scheduledDate,
        timeEstimate: 60,
        tags: [],
        dependencies: [],
      };

      const result = await service.create(createRequest);

      // Verify the request was serialized correctly with snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: expect.objectContaining({
          scheduled_date: '2025-01-15T00:00:00.000Z',
        }),
      });

      // Verify the result has the correct scheduledDate
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.scheduledDate!.toISOString()).toBe(
        '2025-01-15T00:00:00.000Z'
      );
    });

    it('should handle task drag and drop scenario (updating scheduledDate)', async () => {
      // Simulate dragging a task from one day to another
      const newScheduledDate = new Date('2025-01-16T00:00:00.000Z');
      const mockBackendResponse = {
        id: 'dragged-task-id',
        title: 'Dragged Task',
        description: 'Task moved via drag and drop',
        priority: Priority.HIGH,
        status: 'pending',
        dependencies: '[]',
        time_estimate: 90,
        actual_time: 0,
        due_date: null,
        scheduled_date: '2025-01-16T00:00:00.000Z',
        tags: '[]',
        project_id: null,
        parent_task_id: null,
        subtasks: '[]',
        completed_at: null,
        created_at: '2025-01-14T20:00:00.000Z',
        updated_at: '2025-01-15T10:00:00.000Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const updateRequest = {
        scheduledDate: newScheduledDate,
      };

      const result = await service.update('dragged-task-id', updateRequest);

      // Verify the request was serialized correctly with snake_case fields
      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: 'dragged-task-id',
        request: expect.objectContaining({
          scheduled_date: '2025-01-16T00:00:00.000Z',
        }),
      });

      // Verify the result has the updated scheduledDate
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.scheduledDate!.toISOString()).toBe(
        '2025-01-16T00:00:00.000Z'
      );
    });
  });
});
