import { TaskMigrationService } from '../TaskMigrationService';
import { TaskService } from '../database/repositories/TaskService';
import { Task, Priority, TaskStatus } from '../../types';

// Mock the TaskService
jest.mock('../database/repositories/TaskService');
const MockedTaskService = TaskService as jest.MockedClass<typeof TaskService>;

// Mock date utilities
jest.mock('../../utils/dateFormat', () => ({
  getWeekRange: jest.fn((_date: Date, _weekStartDay: number) => {
    const weekStart = new Date('2024-01-15'); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date('2024-01-21'); // Sunday
    weekEnd.setHours(23, 59, 59, 999);

    return { weekStart, weekEnd };
  }),
}));

describe('TaskMigrationService - Smart Scheduling Suggestions', () => {
  let taskMigrationService: TaskMigrationService;
  let mockTaskService: jest.Mocked<TaskService>;

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    priority: Priority.MEDIUM,
    status: TaskStatus.PENDING,
    order: 0,
    dependencies: [],
    timePreset: 0,
    timeEstimate: 60,
    actualTime: 0,
    tags: [],
    subtasks: [],
    taskListId: 'default',
    isPeriodicInstance: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskService = new MockedTaskService() as jest.Mocked<TaskService>;
    taskMigrationService = new TaskMigrationService(mockTaskService);
  });

  describe('suggestSchedulingForTasks', () => {
    it('should provide suggestions for all tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', priority: Priority.HIGH }),
        createMockTask({ id: 'task-2', priority: Priority.LOW }),
      ];

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        tasks,
        targetWeek
      );

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].taskId).toBe('task-1');
      expect(suggestions[1].taskId).toBe('task-2');

      // High priority task should have higher confidence
      const highPrioritySuggestion = suggestions.find(
        s => s.taskId === 'task-1'
      );
      const lowPrioritySuggestion = suggestions.find(
        s => s.taskId === 'task-2'
      );

      expect(highPrioritySuggestion?.confidence).toBeGreaterThan(
        lowPrioritySuggestion?.confidence || 0
      );
    });

    it('should suggest priority-based scheduling for high priority tasks', async () => {
      const highPriorityTask = createMockTask({
        id: 'task-1',
        priority: Priority.HIGH,
        timeEstimate: 60,
      });

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [highPriorityTask],
        targetWeek
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].reason).toBe('priority');
      expect(suggestions[0].confidence).toBeGreaterThan(0.8);
      // Should suggest Monday (start of week)
      expect(suggestions[0].suggestedDate.getDay()).toBe(1); // Monday
    });

    it('should suggest dependency-based scheduling', async () => {
      const dependencyTask = createMockTask({
        id: 'dep-1',
        scheduledDate: new Date('2024-01-16'), // Tuesday
      });
      const taskWithDependency = createMockTask({
        id: 'task-1',
        dependencies: ['dep-1'],
        timeEstimate: 60,
      });

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);
      mockTaskService.findById.mockResolvedValueOnce(dependencyTask);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [taskWithDependency],
        targetWeek
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].reason).toBe('dependencies');
      expect(suggestions[0].confidence).toBeGreaterThan(0.9);
      // Should suggest Wednesday (day after dependency)
      expect(suggestions[0].suggestedDate.getDate()).toBe(17);
    });

    it('should handle workload balancing', async () => {
      const task = createMockTask({
        id: 'task-1',
        timeEstimate: 60,
        priority: Priority.LOW, // Low priority to avoid priority-based scheduling
      });

      // Mock existing tasks with heavy workload on Monday
      const existingTasks = [
        createMockTask({
          id: 'existing-1',
          scheduledDate: new Date('2024-01-15'), // Monday
          timeEstimate: 240, // 4 hours
        }),
      ];
      mockTaskService.getTasksForWeek.mockResolvedValueOnce(existingTasks);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [task],
        targetWeek
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedDate).toBeInstanceOf(Date);
      expect(suggestions[0].confidence).toBeGreaterThan(0);
    });

    it('should adjust confidence based on time estimates', async () => {
      const shortTask = createMockTask({
        id: 'task-1',
        timeEstimate: 15, // Short task
        priority: Priority.LOW,
      });
      const longTask = createMockTask({
        id: 'task-2',
        timeEstimate: 180, // Long task (3 hours)
        priority: Priority.LOW,
      });

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [shortTask, longTask],
        targetWeek
      );

      const shortTaskSuggestion = suggestions.find(s => s.taskId === 'task-1');
      const longTaskSuggestion = suggestions.find(s => s.taskId === 'task-2');

      expect(shortTaskSuggestion?.confidence).toBeGreaterThan(
        longTaskSuggestion?.confidence || 0
      );
    });

    it('should handle tasks without time estimates', async () => {
      const taskWithoutEstimate = createMockTask({
        id: 'task-1',
        timeEstimate: 0,
        priority: Priority.LOW,
      });

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [taskWithoutEstimate],
        targetWeek
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBeGreaterThan(0);
      expect(suggestions[0].suggestedDate).toBeInstanceOf(Date);
    });

    it('should handle empty task arrays', async () => {
      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [],
        targetWeek
      );

      expect(suggestions).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const task = createMockTask({
        id: 'task-1',
        dependencies: ['dep-1'],
      });

      mockTaskService.getTasksForWeek.mockResolvedValueOnce([]);
      mockTaskService.findById.mockRejectedValueOnce(
        new Error('Database error')
      );

      const targetWeek = new Date('2024-01-15');
      const suggestions = await taskMigrationService.suggestSchedulingForTasks(
        [task],
        targetWeek
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].taskId).toBe('task-1');
      expect(suggestions[0].suggestedDate).toBeInstanceOf(Date);
      expect(suggestions[0].confidence).toBeGreaterThan(0);
    });
  });
});
