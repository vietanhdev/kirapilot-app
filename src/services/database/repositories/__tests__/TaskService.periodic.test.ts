import { TaskService } from '../TaskService';
import { Task, TaskStatus, Priority, TaskFilters } from '../../../../types';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('TaskService - Periodic Task Integration', () => {
  let taskService: TaskService;
  let mockTasks: Task[];

  beforeEach(() => {
    taskService = new TaskService();

    // Create mock tasks with periodic instances
    mockTasks = [
      {
        id: 'task-1',
        title: 'Regular Task',
        description: 'A regular task',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        order: 0,
        timePreset: 60,
        timeEstimate: 60,
        actualTime: 0,
        dependencies: [],
        subtasks: [],
        tags: [],
        taskListId: 'list-1',
        isPeriodicInstance: false,
        periodicTemplateId: undefined,
        generationDate: undefined,
        completedAt: undefined,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'task-2',
        title: 'Periodic Instance 1',
        description: 'First instance of periodic task',
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        order: 0,
        timePreset: 30,
        timeEstimate: 30,
        actualTime: 0,
        dependencies: [],
        subtasks: [],
        tags: ['recurring'],
        taskListId: 'list-1',
        isPeriodicInstance: true,
        periodicTemplateId: 'template-1',
        generationDate: new Date('2024-01-01'),
        completedAt: undefined,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'task-3',
        title: 'Periodic Instance 2',
        description: 'Second instance of periodic task',
        status: TaskStatus.COMPLETED,
        priority: Priority.HIGH,
        order: 0,
        timePreset: 30,
        timeEstimate: 30,
        actualTime: 25,
        dependencies: [],
        subtasks: [],
        tags: ['recurring'],
        taskListId: 'list-1',
        isPeriodicInstance: true,
        periodicTemplateId: 'template-1',
        generationDate: new Date('2024-01-02'),
        completedAt: new Date('2024-01-02'),
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];
  });

  describe('applyClientSideFilters', () => {
    it('should filter to show only periodic instances', () => {
      const filters: TaskFilters = {
        periodicFilter: 'instances_only',
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(2);
      expect(result.every(task => task.isPeriodicInstance)).toBe(true);
      expect(result.map(task => task.id)).toEqual(['task-2', 'task-3']);
    });

    it('should filter to show only regular tasks', () => {
      const filters: TaskFilters = {
        periodicFilter: 'regular_only',
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(1);
      expect(result.every(task => !task.isPeriodicInstance)).toBe(true);
      expect(result[0].id).toBe('task-1');
    });

    it('should show all tasks when periodicFilter is "all"', () => {
      const filters: TaskFilters = {
        periodicFilter: 'all',
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(3);
    });

    it('should filter by specific periodic template', () => {
      const filters: TaskFilters = {
        periodicTemplateId: 'template-1',
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(2);
      expect(
        result.every(task => task.periodicTemplateId === 'template-1')
      ).toBe(true);
    });

    it('should combine periodic filters with other filters', () => {
      const filters: TaskFilters = {
        periodicFilter: 'instances_only',
        status: [TaskStatus.PENDING],
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-2');
      expect(result[0].isPeriodicInstance).toBe(true);
      expect(result[0].status).toBe(TaskStatus.PENDING);
    });

    it('should handle empty filters gracefully', () => {
      const filters: TaskFilters = {};

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockTasks);
    });

    it('should handle undefined periodicFilter', () => {
      const filters: TaskFilters = {
        periodicFilter: undefined,
      };

      const result = taskService.applyClientSideFilters(mockTasks, filters);

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockTasks);
    });
  });
});
