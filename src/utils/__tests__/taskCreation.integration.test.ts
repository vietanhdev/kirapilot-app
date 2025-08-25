// Integration test to verify task creation with dates works correctly
import { TaskService } from '../../services/database/repositories/TaskService';
import { Priority } from '../../types';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

describe('Task Creation Integration Test', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    mockInvoke.mockClear();
  });

  it('should create task with scheduledDate correctly', async () => {
    const scheduledDate = new Date('2025-01-15T10:00:00.000Z');
    const dueDate = new Date('2025-01-20T18:00:00.000Z');

    // Mock the backend response
    const mockBackendTask = {
      id: 'test-task-id',
      title: 'Test Task',
      description: 'Test description',
      priority: 1,
      status: 'pending',
      dependencies: null,
      time_estimate: 60,
      actual_time: 0,
      due_date: dueDate.toISOString(),
      scheduled_date: scheduledDate.toISOString(),
      tags: null,
      project_id: null,
      parent_task_id: null,
      subtasks: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockInvoke.mockResolvedValue(mockBackendTask);

    const createRequest = {
      title: 'Test Task',
      description: 'Test description',
      priority: Priority.MEDIUM,
      scheduledDate: scheduledDate,
      dueDate: dueDate,
      timeEstimate: 60,
      tags: [],
      dependencies: [],
    };

    const result = await taskService.create(createRequest);

    // Verify the invoke was called with correctly serialized dates and snake_case fields
    expect(mockInvoke).toHaveBeenCalledWith('create_task', {
      request: {
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.MEDIUM,
        scheduled_date: scheduledDate.toISOString(),
        due_date: dueDate.toISOString(),
        time_estimate: 60,
        tags: [],
        dependencies: [],
        project_id: undefined,
        parent_task_id: undefined,
        order_num: 0,
        task_list_id: undefined,
      },
    });

    // Verify the result has proper Date objects
    expect(result.scheduledDate).toBeInstanceOf(Date);
    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.scheduledDate?.toISOString()).toBe(
      scheduledDate.toISOString()
    );
    expect(result.dueDate?.toISOString()).toBe(dueDate.toISOString());
  });

  it('should create task without dates (backlog task)', async () => {
    // Mock the backend response
    const mockBackendTask = {
      id: 'backlog-task-id',
      title: 'Backlog Task',
      description: 'Task without dates',
      priority: 0,
      status: 'pending',
      dependencies: null,
      time_estimate: 30,
      actual_time: 0,
      due_date: null,
      scheduled_date: null,
      tags: null,
      project_id: null,
      parent_task_id: null,
      subtasks: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockInvoke.mockResolvedValue(mockBackendTask);

    const createRequest = {
      title: 'Backlog Task',
      description: 'Task without dates',
      priority: Priority.LOW,
      timeEstimate: 30,
      tags: [],
      dependencies: [],
    };

    const result = await taskService.create(createRequest);

    // Verify the invoke was called with undefined dates and snake_case fields
    expect(mockInvoke).toHaveBeenCalledWith('create_task', {
      request: {
        title: 'Backlog Task',
        description: 'Task without dates',
        priority: Priority.LOW,
        scheduled_date: undefined,
        due_date: undefined,
        time_estimate: 30,
        tags: [],
        dependencies: [],
        project_id: undefined,
        parent_task_id: undefined,
        order_num: 0,
        task_list_id: undefined,
      },
    });

    // Verify the result has no dates
    expect(result.scheduledDate).toBeUndefined();
    expect(result.dueDate).toBeUndefined();
  });

  it('should update task scheduledDate correctly', async () => {
    const newScheduledDate = new Date('2025-01-16T14:30:00.000Z');

    // Mock the backend response
    const mockBackendTask = {
      id: 'update-task-id',
      title: 'Updated Task',
      description: 'Updated description',
      priority: 2,
      status: 'in_progress',
      dependencies: null,
      time_estimate: 90,
      actual_time: 0,
      due_date: null,
      scheduled_date: newScheduledDate.toISOString(),
      tags: null,
      project_id: null,
      parent_task_id: null,
      subtasks: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockInvoke.mockResolvedValue(mockBackendTask);

    const updateRequest = {
      scheduledDate: newScheduledDate,
    };

    const result = await taskService.update('update-task-id', updateRequest);

    // Verify the invoke was called with correctly serialized date and snake_case fields
    expect(mockInvoke).toHaveBeenCalledWith('update_task', {
      id: 'update-task-id',
      request: {
        scheduled_date: newScheduledDate.toISOString(),
      },
    });

    // Verify the result has proper Date object
    expect(result.scheduledDate).toBeInstanceOf(Date);
    expect(result.scheduledDate?.toISOString()).toBe(
      newScheduledDate.toISOString()
    );
  });

  it('should handle task creation errors gracefully', async () => {
    const scheduledDate = new Date('2025-01-15T10:00:00.000Z');

    // Mock a backend error
    mockInvoke.mockRejectedValue(new Error('Database connection failed'));

    const createRequest = {
      title: 'Test Task',
      scheduledDate: scheduledDate,
      priority: Priority.MEDIUM,
      timeEstimate: 60,
      tags: [],
      dependencies: [],
    };

    await expect(taskService.create(createRequest)).rejects.toThrow(
      'Database connection failed'
    );

    // Verify the invoke was still called with correct serialization and snake_case fields
    expect(mockInvoke).toHaveBeenCalledWith('create_task', {
      request: {
        title: 'Test Task',
        scheduled_date: scheduledDate.toISOString(),
        due_date: undefined,
        priority: Priority.MEDIUM,
        time_estimate: 60,
        tags: [],
        dependencies: [],
        project_id: undefined,
        parent_task_id: undefined,
        description: undefined,
        order_num: 0,
        task_list_id: undefined,
      },
    });
  });
});
