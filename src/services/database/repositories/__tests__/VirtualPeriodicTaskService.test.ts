import { VirtualPeriodicTaskService } from '../VirtualPeriodicTaskService';
import {
  PeriodicTaskTemplate,
  RecurrenceType,
  Priority,
  Task,
  TaskStatus,
  VirtualTask,
  TimePreset,
} from '../../../../types';

// Mock the PeriodicTaskService
jest.mock('../PeriodicTaskService', () => ({
  PeriodicTaskService: jest.fn().mockImplementation(() => ({
    findActiveTemplates: jest.fn(),
    findTemplateById: jest.fn(),
    generateInstanceFromTemplate: jest.fn(),
  })),
}));

// Mock TaskService
jest.mock('../TaskService', () => ({
  TaskService: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
  })),
}));

describe('VirtualPeriodicTaskService', () => {
  let service: VirtualPeriodicTaskService;
  let mockPeriodicService: {
    findActiveTemplates: jest.Mock;
    findTemplateById: jest.Mock;
    generateInstanceFromTemplate: jest.Mock;
  };

  beforeEach(() => {
    service = new VirtualPeriodicTaskService();
    mockPeriodicService = (
      service as unknown as { periodicService: typeof mockPeriodicService }
    ).periodicService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateVirtualTasks', () => {
    it('should generate virtual tasks for active templates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      const mockTemplate: PeriodicTaskTemplate = {
        id: 'template-1',
        title: 'Daily Task',
        description: 'A daily recurring task',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['work'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: undefined,
        startDate: new Date('2024-01-01'),
        nextGenerationDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      };

      mockPeriodicService.findActiveTemplates.mockResolvedValue([mockTemplate]);

      const virtualTasks = await service.generateVirtualTasks(
        startDate,
        endDate,
        []
      );

      expect(virtualTasks).toHaveLength(7); // 7 days
      expect(virtualTasks[0].title).toBe('Daily Task');
      expect(virtualTasks[0].isVirtual).toBe(true);
      expect(virtualTasks[0].originalTemplateId).toBe('template-1');
    });

    it('should not generate virtual tasks for dates with existing instances', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      const mockTemplate: PeriodicTaskTemplate = {
        id: 'template-1',
        title: 'Daily Task',
        description: 'A daily recurring task',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['work'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: undefined,
        startDate: new Date('2024-01-01'),
        nextGenerationDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      };

      const existingTask: Task = {
        id: 'task-1',
        title: 'Daily Task',
        description: 'A daily recurring task',
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        order: 0,
        dependencies: [],
        timePreset: 30 as unknown as TimePreset,
        timeEstimate: 30,
        actualTime: 0,
        scheduledDate: new Date('2024-01-02'),
        tags: ['work'],
        projectId: undefined,
        parentTaskId: undefined,
        subtasks: [],
        taskListId: 'list-1',
        periodicTemplateId: 'template-1',
        isPeriodicInstance: true,
        generationDate: new Date('2024-01-02'),
        completedAt: undefined,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      };

      mockPeriodicService.findActiveTemplates.mockResolvedValue([mockTemplate]);

      const virtualTasks = await service.generateVirtualTasks(
        startDate,
        endDate,
        [existingTask]
      );

      expect(virtualTasks).toHaveLength(2); // Only Jan 1 and Jan 3, not Jan 2 (existing)
      expect(
        virtualTasks.find(t => t.scheduledDate?.getDate() === 2)
      ).toBeUndefined();
    });

    it('should handle weekly recurrence correctly', async () => {
      const startDate = new Date('2024-01-01'); // Monday
      const endDate = new Date('2024-01-21'); // 3 weeks later

      const mockTemplate: PeriodicTaskTemplate = {
        id: 'template-1',
        title: 'Weekly Task',
        description: 'A weekly recurring task',
        priority: Priority.MEDIUM,
        timeEstimate: 60,
        tags: ['weekly'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.WEEKLY,
        recurrenceInterval: 1,
        recurrenceUnit: undefined,
        startDate: new Date('2024-01-01'),
        nextGenerationDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      };

      mockPeriodicService.findActiveTemplates.mockResolvedValue([mockTemplate]);

      const virtualTasks = await service.generateVirtualTasks(
        startDate,
        endDate,
        []
      );

      expect(virtualTasks).toHaveLength(3); // Jan 1, Jan 8, Jan 15
      expect(virtualTasks[0].scheduledDate?.getDate()).toBe(1);
      expect(virtualTasks[1].scheduledDate?.getDate()).toBe(8);
      expect(virtualTasks[2].scheduledDate?.getDate()).toBe(15);
    });
  });

  describe('isVirtualTask', () => {
    it('should correctly identify virtual tasks', () => {
      const virtualTask = {
        id: 'virtual-1',
        isVirtual: true,
        virtualId: 'virtual-1',
        originalTemplateId: 'template-1',
      } as unknown as VirtualTask;

      const regularTask = {
        id: 'task-1',
        isVirtual: false,
      } as unknown as Task;

      expect(VirtualPeriodicTaskService.isVirtualTask(virtualTask)).toBe(true);
      expect(VirtualPeriodicTaskService.isVirtualTask(regularTask)).toBe(false);
    });
  });

  describe('getVirtualTasksForWeek', () => {
    it('should generate virtual tasks for a week', async () => {
      const weekStart = new Date('2024-01-01'); // Monday

      const mockTemplate: PeriodicTaskTemplate = {
        id: 'template-1',
        title: 'Daily Task',
        description: 'A daily recurring task',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['work'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: undefined,
        startDate: new Date('2024-01-01'),
        nextGenerationDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      };

      mockPeriodicService.findActiveTemplates.mockResolvedValue([mockTemplate]);

      const virtualTasks = await service.getVirtualTasksForWeek(weekStart, []);

      expect(virtualTasks).toHaveLength(7); // 7 days in a week
    });
  });

  describe('getVirtualTasksForDay', () => {
    it('should generate virtual tasks for a specific day', async () => {
      const date = new Date('2024-01-01');

      const mockTemplate: PeriodicTaskTemplate = {
        id: 'template-1',
        title: 'Daily Task',
        description: 'A daily recurring task',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['work'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: undefined,
        startDate: new Date('2024-01-01'),
        nextGenerationDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      };

      mockPeriodicService.findActiveTemplates.mockResolvedValue([mockTemplate]);

      const virtualTasks = await service.getVirtualTasksForDay(date, []);

      expect(virtualTasks).toHaveLength(1);
      expect(virtualTasks[0].scheduledDate?.getDate()).toBe(1);
    });
  });
});
