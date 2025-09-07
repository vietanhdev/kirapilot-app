import { PeriodicTaskService } from '../PeriodicTaskService';
import { RecurrenceType, Priority } from '../../../../types';

// Mock the Tauri invoke function
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('PeriodicTaskService', () => {
  let service: PeriodicTaskService;

  beforeEach(() => {
    service = new PeriodicTaskService();
    mockInvoke.mockClear();
  });

  describe('createTemplate', () => {
    it('should create a periodic task template', async () => {
      const mockTemplate = {
        id: 'template-1',
        title: 'Daily Exercise',
        description: 'Go for a 30-minute walk',
        priority: Priority.MEDIUM,
        time_estimate: 30,
        tags: '["health", "exercise"]',
        task_list_id: 'list-1',
        recurrence_type: RecurrenceType.DAILY,
        recurrence_interval: 1,
        recurrence_unit: null,
        start_date: '2024-01-01T00:00:00Z',
        next_generation_date: '2024-01-02T00:00:00Z',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockTemplate);

      const request = {
        title: 'Daily Exercise',
        description: 'Go for a 30-minute walk',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['health', 'exercise'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        startDate: new Date('2024-01-01T00:00:00Z'),
      };

      const result = await service.createTemplate(request);

      expect(mockInvoke).toHaveBeenCalledWith('create_periodic_task_template', {
        request: {
          title: 'Daily Exercise',
          description: 'Go for a 30-minute walk',
          priority: Priority.MEDIUM,
          time_estimate: 30,
          tags: ['health', 'exercise'],
          task_list_id: 'list-1',
          recurrence_type: RecurrenceType.DAILY,
          recurrence_interval: 1,
          recurrence_unit: undefined,
          start_date: '2024-01-01T00:00:00.000Z',
        },
      });

      expect(result).toEqual({
        id: 'template-1',
        title: 'Daily Exercise',
        description: 'Go for a 30-minute walk',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['health', 'exercise'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: null,
        startDate: new Date('2024-01-01T00:00:00Z'),
        nextGenerationDate: new Date('2024-01-02T00:00:00Z'),
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
    });

    it('should handle creation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database connection failed'));

      const request = {
        title: 'Daily Exercise',
        recurrenceType: RecurrenceType.DAILY,
        startDate: new Date('2024-01-01T00:00:00Z'),
      };

      await expect(service.createTemplate(request)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('findTemplateById', () => {
    it('should find a template by ID', async () => {
      const mockTemplate = {
        id: 'template-1',
        title: 'Daily Exercise',
        description: 'Go for a 30-minute walk',
        priority: Priority.MEDIUM,
        time_estimate: 30,
        tags: '["health"]',
        task_list_id: 'list-1',
        recurrence_type: RecurrenceType.DAILY,
        recurrence_interval: 1,
        recurrence_unit: null,
        start_date: '2024-01-01T00:00:00Z',
        next_generation_date: '2024-01-02T00:00:00Z',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockTemplate);

      const result = await service.findTemplateById('template-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_periodic_task_template', {
        id: 'template-1',
      });

      expect(result).toEqual({
        id: 'template-1',
        title: 'Daily Exercise',
        description: 'Go for a 30-minute walk',
        priority: Priority.MEDIUM,
        timeEstimate: 30,
        tags: ['health'],
        taskListId: 'list-1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceUnit: null,
        startDate: new Date('2024-01-01T00:00:00Z'),
        nextGenerationDate: new Date('2024-01-02T00:00:00Z'),
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
    });

    it('should return null when template not found', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await service.findTemplateById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('generatePendingInstances', () => {
    it('should generate pending instances', async () => {
      const mockInstances = [
        {
          id: 'task-1',
          title: 'Daily Exercise',
          description: 'Go for a 30-minute walk',
          priority: Priority.MEDIUM,
          status: 'pending',
          order_num: 0,
          dependencies: '[]',
          time_estimate: 30,
          actual_time: 0,
          due_date: null,
          scheduled_date: null,
          tags: '["health"]',
          project_id: null,
          parent_task_id: null,
          subtasks: '[]',
          task_list_id: 'list-1',
          periodic_template_id: 'template-1',
          is_periodic_instance: true,
          generation_date: '2024-01-02T00:00:00Z',
          completed_at: null,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockInvoke.mockResolvedValueOnce(mockInstances);
      mockInvoke.mockResolvedValueOnce([]); // findActiveTemplates

      const result = await service.generatePendingInstances();

      expect(mockInvoke).toHaveBeenCalledWith('generate_pending_instances');
      expect(result.generatedInstances).toHaveLength(1);
      expect(result.totalGenerated).toBe(1);
      expect(result.generatedInstances[0].title).toBe('Daily Exercise');
      expect(result.generatedInstances[0].isPeriodicInstance).toBe(true);
    });
  });

  describe('calculateNextGenerationDate', () => {
    it('should calculate next generation date', async () => {
      const nextDate = '2024-01-02T00:00:00Z';
      mockInvoke.mockResolvedValue(nextDate);

      const currentDate = new Date('2024-01-01T00:00:00Z');
      const result = await service.calculateNextGenerationDate(
        currentDate,
        RecurrenceType.DAILY,
        1
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'calculate_next_generation_date',
        {
          current_date: '2024-01-01T00:00:00.000Z',
          recurrence_type: RecurrenceType.DAILY,
          interval: 1,
          unit: undefined,
        }
      );

      expect(result).toEqual(new Date('2024-01-02T00:00:00Z'));
    });
  });
});
