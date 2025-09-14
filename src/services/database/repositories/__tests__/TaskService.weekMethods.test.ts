import { TaskService } from '../TaskService';
import { Task, TaskStatus, Priority } from '../../../../types';
import { invoke } from '@tauri-apps/api/core';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('TaskService - Week-based Methods', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();
  });

  describe('getTasksForWeek', () => {
    const mockTasks: Record<string, unknown>[] = [
      {
        id: 'task-1',
        title: 'Monday Task',
        description: 'Task scheduled for Monday',
        priority: 1,
        status: 'pending',
        order_num: 0,
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        scheduled_date: '2024-01-15T10:00:00.000Z', // Monday
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T08:00:00.000Z',
      },
      {
        id: 'task-2',
        title: 'Wednesday Task',
        description: 'Task scheduled for Wednesday',
        priority: 2,
        status: 'in_progress',
        order_num: 1,
        dependencies: '[]',
        time_estimate: 30,
        actual_time: 15,
        scheduled_date: '2024-01-17T14:00:00.000Z', // Wednesday
        tags: '["work"]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-17T08:00:00.000Z',
        updated_at: '2024-01-17T08:00:00.000Z',
      },
      {
        id: 'task-3',
        title: 'Friday Task',
        description: 'Task scheduled for Friday',
        priority: 3,
        status: 'completed',
        order_num: 2,
        dependencies: '[]',
        time_estimate: 45,
        actual_time: 50,
        scheduled_date: '2024-01-19T16:00:00.000Z', // Friday
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-19T08:00:00.000Z',
        updated_at: '2024-01-19T08:00:00.000Z',
      },
    ];

    it('should get tasks for week starting on Monday', async () => {
      mockInvoke.mockResolvedValue(mockTasks);

      const weekDate = new Date('2024-01-17'); // Wednesday in the week
      const weekStartDay = 1; // Monday

      const result = await taskService.getTasksForWeek(weekDate, weekStartDay);

      expect(mockInvoke).toHaveBeenCalledWith('get_scheduled_tasks', {
        startDate: '2024-01-15T00:00:00.000Z', // Monday start
        endDate: '2024-01-21T23:59:59.999Z', // Sunday end
      });

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Monday Task');
      expect(result[1].title).toBe('Wednesday Task');
      expect(result[2].title).toBe('Friday Task');
    });

    it('should get tasks for week starting on Sunday', async () => {
      mockInvoke.mockResolvedValue(mockTasks);

      const weekDate = new Date('2024-01-17'); // Wednesday in the week
      const weekStartDay = 0; // Sunday

      const result = await taskService.getTasksForWeek(weekDate, weekStartDay);

      expect(mockInvoke).toHaveBeenCalledWith('get_scheduled_tasks', {
        startDate: '2024-01-14T00:00:00.000Z', // Sunday start
        endDate: '2024-01-20T23:59:59.999Z', // Saturday end
      });

      expect(result).toHaveLength(3);
    });

    it('should handle empty result', async () => {
      mockInvoke.mockResolvedValue([]);

      const weekDate = new Date('2024-01-17');
      const weekStartDay = 1;

      const result = await taskService.getTasksForWeek(weekDate, weekStartDay);

      expect(result).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const weekDate = new Date('2024-01-17');
      const weekStartDay = 1;

      await expect(
        taskService.getTasksForWeek(weekDate, weekStartDay)
      ).rejects.toThrow(
        'taskService.error.findScheduledFailed: Error: Database error'
      );
    });

    it('should work with different week boundaries', async () => {
      mockInvoke.mockResolvedValue([]);

      // Test week that spans month boundary
      const weekDate = new Date('2024-01-31'); // Wednesday
      const weekStartDay = 1; // Monday

      await taskService.getTasksForWeek(weekDate, weekStartDay);

      expect(mockInvoke).toHaveBeenCalledWith('get_scheduled_tasks', {
        startDate: '2024-01-29T00:00:00.000Z', // Monday
        endDate: '2024-02-04T23:59:59.999Z', // Sunday (next month)
      });
    });
  });

  describe('getIncompleteTasksFromWeek', () => {
    const mockMixedTasks: Record<string, unknown>[] = [
      {
        id: 'task-pending',
        title: 'Pending Task',
        description: 'Task that is pending',
        priority: 1,
        status: 'pending',
        order_num: 0,
        dependencies: '[]',
        time_estimate: 60,
        actual_time: 0,
        scheduled_date: '2024-01-15T10:00:00.000Z',
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T08:00:00.000Z',
      },
      {
        id: 'task-in-progress',
        title: 'In Progress Task',
        description: 'Task that is in progress',
        priority: 2,
        status: 'in_progress',
        order_num: 1,
        dependencies: '[]',
        time_estimate: 30,
        actual_time: 15,
        scheduled_date: '2024-01-16T14:00:00.000Z',
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-16T08:00:00.000Z',
        updated_at: '2024-01-16T08:00:00.000Z',
      },
      {
        id: 'task-completed',
        title: 'Completed Task',
        description: 'Task that is completed',
        priority: 1,
        status: 'completed',
        order_num: 2,
        dependencies: '[]',
        time_estimate: 45,
        actual_time: 40,
        scheduled_date: '2024-01-17T16:00:00.000Z',
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-17T08:00:00.000Z',
        updated_at: '2024-01-17T08:00:00.000Z',
      },
      {
        id: 'task-cancelled',
        title: 'Cancelled Task',
        description: 'Task that is cancelled',
        priority: 1,
        status: 'cancelled',
        order_num: 3,
        dependencies: '[]',
        time_estimate: 20,
        actual_time: 0,
        scheduled_date: '2024-01-18T12:00:00.000Z',
        tags: '[]',
        task_list_id: 'default-task-list',
        is_periodic_instance: false,
        created_at: '2024-01-18T08:00:00.000Z',
        updated_at: '2024-01-18T08:00:00.000Z',
      },
    ];

    it('should return only pending and in_progress tasks', async () => {
      mockInvoke.mockResolvedValue(mockMixedTasks);

      const weekDate = new Date('2024-01-17');
      const weekStartDay = 1;

      const result = await taskService.getIncompleteTasksFromWeek(
        weekDate,
        weekStartDay
      );

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
      expect(result[0].title).toBe('Pending Task');
      expect(result[1].status).toBe('in_progress');
      expect(result[1].title).toBe('In Progress Task');
    });

    it('should return empty array when no incomplete tasks exist', async () => {
      const completedTasks = mockMixedTasks.filter(
        task => task.status === 'completed' || task.status === 'cancelled'
      );
      mockInvoke.mockResolvedValue(completedTasks);

      const weekDate = new Date('2024-01-17');
      const weekStartDay = 1;

      const result = await taskService.getIncompleteTasksFromWeek(
        weekDate,
        weekStartDay
      );

      expect(result).toHaveLength(0);
    });

    it('should work with different weekStartDay values', async () => {
      mockInvoke.mockResolvedValue(mockMixedTasks);

      // Test with Sunday start
      const weekDate = new Date('2024-01-17');
      const weekStartDay = 0;

      const result = await taskService.getIncompleteTasksFromWeek(
        weekDate,
        weekStartDay
      );

      expect(result).toHaveLength(2);
      expect(mockInvoke).toHaveBeenCalledWith('get_scheduled_tasks', {
        startDate: '2024-01-14T00:00:00.000Z', // Sunday
        endDate: '2024-01-20T23:59:59.999Z', // Saturday
      });
    });

    it('should handle errors from getTasksForWeek', async () => {
      mockInvoke.mockRejectedValue(new Error('Database connection failed'));

      const weekDate = new Date('2024-01-17');
      const weekStartDay = 1;

      await expect(
        taskService.getIncompleteTasksFromWeek(weekDate, weekStartDay)
      ).rejects.toThrow('taskService.error.getIncompleteTasksFromWeekFailed');
    });
  });

  describe('Week-based filtering in applyClientSideFilters', () => {
    const testTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Week 1 Task',
        description: '',
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        order: 0,
        dependencies: [],
        timePreset: 60,
        timeEstimate: 60,
        actualTime: 0,
        scheduledDate: new Date('2024-01-15T10:00:00.000Z'), // Monday week 1
        tags: [],
        taskListId: 'default-task-list',
        subtasks: [],
        isPeriodicInstance: false,
        createdAt: new Date('2024-01-15T08:00:00.000Z'),
        updatedAt: new Date('2024-01-15T08:00:00.000Z'),
      },
      {
        id: 'task-2',
        title: 'Week 2 Task',
        description: '',
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        order: 1,
        dependencies: [],
        timePreset: 30,
        timeEstimate: 30,
        actualTime: 15,
        scheduledDate: new Date('2024-01-22T14:00:00.000Z'), // Monday week 2
        tags: [],
        taskListId: 'default-task-list',
        subtasks: [],
        isPeriodicInstance: false,
        createdAt: new Date('2024-01-22T08:00:00.000Z'),
        updatedAt: new Date('2024-01-22T08:00:00.000Z'),
      },
      {
        id: 'task-3',
        title: 'Periodic Instance',
        description: '',
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        order: 2,
        dependencies: [],
        timePreset: 45,
        timeEstimate: 45,
        actualTime: 0,
        scheduledDate: new Date('2024-01-16T16:00:00.000Z'), // Tuesday week 1
        tags: [],
        taskListId: 'default-task-list',
        subtasks: [],
        isPeriodicInstance: true,
        periodicTemplateId: 'template-1',
        createdAt: new Date('2024-01-16T08:00:00.000Z'),
        updatedAt: new Date('2024-01-16T08:00:00.000Z'),
      },
      {
        id: 'task-4',
        title: 'Unscheduled Task',
        description: '',
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        order: 3,
        dependencies: [],
        timePreset: 20,
        timeEstimate: 20,
        actualTime: 0,
        scheduledDate: undefined, // No scheduled date
        tags: [],
        taskListId: 'default-task-list',
        subtasks: [],
        isPeriodicInstance: false,
        createdAt: new Date('2024-01-17T08:00:00.000Z'),
        updatedAt: new Date('2024-01-17T08:00:00.000Z'),
      },
    ];

    it('should filter tasks by scheduled week', () => {
      const weekStart = new Date('2024-01-15T00:00:00.000Z'); // Monday
      const weekEnd = new Date('2024-01-21T23:59:59.999Z'); // Sunday

      const filters = {
        scheduledWeek: { weekStart, weekEnd },
      };

      const result = taskService.applyClientSideFilters(testTasks, filters);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Week 1 Task');
      expect(result[1].title).toBe('Periodic Instance');
    });

    it('should exclude periodic instances when requested', () => {
      const filters = {
        excludePeriodicInstances: true,
      };

      const result = taskService.applyClientSideFilters(testTasks, filters);

      expect(result).toHaveLength(3);
      expect(result.every(task => !task.isPeriodicInstance)).toBe(true);
    });

    it('should combine week filtering with periodic exclusion', () => {
      const weekStart = new Date('2024-01-15T00:00:00.000Z');
      const weekEnd = new Date('2024-01-21T23:59:59.999Z');

      const filters = {
        scheduledWeek: { weekStart, weekEnd },
        excludePeriodicInstances: true,
      };

      const result = taskService.applyClientSideFilters(testTasks, filters);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Week 1 Task');
      expect(result[0].isPeriodicInstance).toBe(false);
    });

    it('should exclude tasks without scheduled dates from week filtering', () => {
      const weekStart = new Date('2024-01-15T00:00:00.000Z');
      const weekEnd = new Date('2024-01-21T23:59:59.999Z');

      const filters = {
        scheduledWeek: { weekStart, weekEnd },
      };

      const result = taskService.applyClientSideFilters(testTasks, filters);

      expect(result.every(task => task.scheduledDate !== undefined)).toBe(true);
    });
  });
});
