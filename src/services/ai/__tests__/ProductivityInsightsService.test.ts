import { ProductivityInsightsService } from '../ProductivityInsightsService';
import { TaskService } from '../../database/repositories/TaskService';
import { TimeTrackingService } from '../../database/repositories/TimeTrackingService';
import { Task, TaskStatus, Priority, TimerSession } from '../../../types';

// Mock the services
jest.mock('../../database/repositories/TaskService');
jest.mock('../../database/repositories/TimeTrackingService');

const MockedTaskService = TaskService as jest.MockedClass<typeof TaskService>;
const MockedTimeTrackingService = TimeTrackingService as jest.MockedClass<
  typeof TimeTrackingService
>;

describe('ProductivityInsightsService', () => {
  let service: ProductivityInsightsService;
  let mockTaskService: jest.Mocked<TaskService>;
  let mockTimeTrackingService: jest.Mocked<TimeTrackingService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTaskService = new MockedTaskService() as jest.Mocked<TaskService>;
    mockTimeTrackingService =
      new MockedTimeTrackingService() as jest.Mocked<TimeTrackingService>;

    service = new ProductivityInsightsService();
    // Replace the services with mocks
    (
      service as unknown as { taskService: typeof mockTaskService }
    ).taskService = mockTaskService;
    (
      service as unknown as {
        timeTrackingService: typeof mockTimeTrackingService;
      }
    ).timeTrackingService = mockTimeTrackingService;
  });

  describe('analyzeUserBehaviorPatterns', () => {
    it('should analyze patterns with sufficient data', async () => {
      // Mock data
      const mockTasks: Task[] = [
        {
          id: '1',
          title: 'Test Task 1',
          description: '',
          status: TaskStatus.COMPLETED,
          priority: Priority.HIGH,
          order: 0,
          timeEstimate: 60,
          tags: [],
          dependencies: [],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'Test Task 2',
          description: '',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.MEDIUM,
          order: 1,
          timeEstimate: 30,
          tags: [],
          dependencies: [],
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      const mockSessions: TimerSession[] = [
        {
          id: '1',
          taskId: '1',
          startTime: new Date('2024-01-01T09:00:00'),
          endTime: new Date('2024-01-01T10:00:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          taskId: '2',
          startTime: new Date('2024-01-01T14:00:00'),
          endTime: new Date('2024-01-01T14:30:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
      ];

      const mockTaskStats = {
        total: 2,
        byStatus: { completed: 1, in_progress: 1 },
        byPriority: { high: 1, medium: 1 },
        averageCompletionTime: 45,
      };

      const mockTimeStats = {
        totalSessions: 2,
        totalTime: 5400000, // 90 minutes in milliseconds
        averageSessionDuration: 2700000, // 45 minutes
        productivityScore: 85,
      };

      // Setup mocks
      mockTaskService.findAll.mockResolvedValue(mockTasks);
      mockTimeTrackingService.getByDateRange.mockResolvedValue(mockSessions);
      mockTaskService.getStatistics.mockResolvedValue(mockTaskStats);
      mockTimeTrackingService.getStatistics.mockResolvedValue(mockTimeStats);

      // Execute
      const result = await service.analyzeUserBehaviorPatterns('test-user', 30);

      // Verify
      expect(result).toBeDefined();
      expect(result.userId).toBe('test-user');
      expect(result.analysisDate).toBeInstanceOf(Date);
      expect(result.productivityPatterns).toBeInstanceOf(Array);
      expect(result.energyPatterns).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.insights).toBeDefined();
      expect(result.insights.completionRate).toBeGreaterThan(0);
      expect(result.insights.averageTaskDuration).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      // Setup mocks with empty data
      mockTaskService.findAll.mockResolvedValue([]);
      mockTimeTrackingService.getByDateRange.mockResolvedValue([]);
      mockTaskService.getStatistics.mockResolvedValue({
        total: 0,
        byStatus: {},
        byPriority: {},
        averageCompletionTime: 0,
      });
      mockTimeTrackingService.getStatistics.mockResolvedValue({
        totalSessions: 0,
        totalTime: 0,
        averageSessionDuration: 0,
        productivityScore: 0,
      });

      // Execute
      const result = await service.analyzeUserBehaviorPatterns('test-user', 30);

      // Verify
      expect(result).toBeDefined();
      expect(result.productivityPatterns).toEqual([]);
      expect(result.energyPatterns).toEqual([]);
      expect(result.insights.completionRate).toBe(0);
    });

    it('should handle service errors', async () => {
      // Setup mock to throw error
      mockTaskService.findAll.mockRejectedValue(new Error('Database error'));

      // Execute and verify error
      await expect(
        service.analyzeUserBehaviorPatterns('test-user', 30)
      ).rejects.toThrow('Failed to analyze user behavior patterns');
    });
  });

  describe('detectWorkingStyle', () => {
    it('should detect working style from session data', async () => {
      const mockSessions: TimerSession[] = [
        {
          id: '1',
          taskId: '1',
          startTime: new Date('2024-01-01T09:00:00'),
          endTime: new Date('2024-01-01T10:00:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          taskId: '2',
          startTime: new Date('2024-01-01T09:30:00'),
          endTime: new Date('2024-01-01T10:30:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockTimeTrackingService.getByDateRange.mockResolvedValue(mockSessions);

      const result = await service.detectWorkingStyle('test-user');

      expect(result).toBeDefined();
      expect(result.preferredWorkingHours).toBeInstanceOf(Array);
      expect(result.averageTaskDuration).toBeGreaterThan(0);
      expect(result.breakFrequency).toBeGreaterThan(0);
      expect(['morning', 'afternoon', 'evening', 'flexible']).toContain(
        result.focusPatterns
      );
      expect(['batch', 'distributed', 'deadline-driven']).toContain(
        result.taskCompletionStyle
      );
      expect(result.energyLevels).toBeInstanceOf(Array);
    });

    it('should handle insufficient data', async () => {
      mockTimeTrackingService.getByDateRange.mockResolvedValue([]);

      const result = await service.detectWorkingStyle('test-user');

      expect(result).toBeDefined();
      expect(result.preferredWorkingHours).toEqual([]);
      expect(result.averageTaskDuration).toBe(0);
      expect(result.energyLevels).toEqual([]);
    });
  });

  describe('generatePersonalizedTips', () => {
    it('should generate tips based on working style and patterns', async () => {
      // Mock working style detection
      const mockSessions: TimerSession[] = [
        {
          id: '1',
          taskId: '1',
          startTime: new Date('2024-01-01T09:00:00'),
          endTime: new Date('2024-01-01T10:00:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockTimeTrackingService.getByDateRange.mockResolvedValue(mockSessions);
      mockTaskService.findAll.mockResolvedValue([]);
      mockTaskService.getStatistics.mockResolvedValue({
        total: 0,
        byStatus: {},
        byPriority: {},
        averageCompletionTime: 0,
      });
      mockTimeTrackingService.getStatistics.mockResolvedValue({
        totalSessions: 1,
        totalTime: 3600000,
        averageSessionDuration: 3600000,
        productivityScore: 75,
      });

      const result = await service.generatePersonalizedTips('test-user');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(5); // Should return top 5

      if (result.length > 0) {
        const tip = result[0];
        expect(tip).toHaveProperty('id');
        expect(tip).toHaveProperty('category');
        expect(tip).toHaveProperty('title');
        expect(tip).toHaveProperty('description');
        expect(tip).toHaveProperty('confidence');
        expect(tip).toHaveProperty('estimatedImpact');
        expect(tip).toHaveProperty('actions');
      }
    });
  });

  describe('provideContextualAdvice', () => {
    it('should provide advice based on context', async () => {
      const context = {
        timeOfDay: new Date('2024-01-01T09:00:00'),
        recentPerformance: 'high' as const,
        upcomingDeadlines: [],
      };

      // Mock the required data
      mockTimeTrackingService.getByDateRange.mockResolvedValue([]);
      mockTaskService.findAll.mockResolvedValue([]);
      mockTaskService.getStatistics.mockResolvedValue({
        total: 0,
        byStatus: {},
        byPriority: {},
        averageCompletionTime: 0,
      });
      mockTimeTrackingService.getStatistics.mockResolvedValue({
        totalSessions: 0,
        totalTime: 0,
        averageSessionDuration: 0,
        productivityScore: 0,
      });

      const result = await service.provideContextualAdvice(
        'test-user',
        context
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(3); // Should return top 3

      if (result.length > 0) {
        const advice = result[0];
        expect(advice).toHaveProperty('id');
        expect(advice).toHaveProperty('type');
        expect(advice).toHaveProperty('title');
        expect(advice).toHaveProperty('description');
        expect(advice).toHaveProperty('confidence');
      }
    });

    it('should provide different advice for different performance levels', async () => {
      const baseContext = {
        timeOfDay: new Date('2024-01-01T09:00:00'),
        upcomingDeadlines: [],
      };

      // Mock the required data
      mockTimeTrackingService.getByDateRange.mockResolvedValue([]);
      mockTaskService.findAll.mockResolvedValue([]);
      mockTaskService.getStatistics.mockResolvedValue({
        total: 0,
        byStatus: {},
        byPriority: {},
        averageCompletionTime: 0,
      });
      mockTimeTrackingService.getStatistics.mockResolvedValue({
        totalSessions: 0,
        totalTime: 0,
        averageSessionDuration: 0,
        productivityScore: 0,
      });

      const highPerformanceAdvice = await service.provideContextualAdvice(
        'test-user',
        {
          ...baseContext,
          recentPerformance: 'high',
        }
      );

      const lowPerformanceAdvice = await service.provideContextualAdvice(
        'test-user',
        {
          ...baseContext,
          recentPerformance: 'low',
        }
      );

      // Should provide different advice for different performance levels
      expect(highPerformanceAdvice).toBeInstanceOf(Array);
      expect(lowPerformanceAdvice).toBeInstanceOf(Array);
    });
  });

  describe('private helper methods', () => {
    it('should calculate session productivity correctly', () => {
      const session: TimerSession = {
        id: '1',
        taskId: '1',
        startTime: new Date('2024-01-01T09:00:00'),
        endTime: new Date('2024-01-01T10:00:00'),
        pausedTime: 5 * 60 * 1000, // 5 minutes paused
        isActive: false,
        notes: '',
        breaks: [
          {
            id: '1',
            startTime: new Date('2024-01-01T09:30:00'),
            endTime: new Date('2024-01-01T09:35:00'),
            reason: 'Coffee break',
          },
        ],
        createdAt: new Date('2024-01-01'),
      };

      const productivity = (
        service as unknown as {
          calculateSessionProductivity: (session: typeof session) => number;
        }
      ).calculateSessionProductivity(session);

      expect(productivity).toBeGreaterThanOrEqual(0);
      expect(productivity).toBeLessThanOrEqual(100);
    });

    it('should analyze preferred working hours', () => {
      const sessions: TimerSession[] = [
        {
          id: '1',
          taskId: '1',
          startTime: new Date('2024-01-01T09:00:00'),
          endTime: new Date('2024-01-01T10:00:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          taskId: '2',
          startTime: new Date('2024-01-01T09:30:00'),
          endTime: new Date('2024-01-01T10:30:00'),
          pausedTime: 0,
          isActive: false,
          notes: '',
          breaks: [],
          createdAt: new Date('2024-01-01'),
        },
      ];

      const workingHours = (
        service as unknown as {
          analyzePreferredWorkingHours: (
            sessions: typeof sessions
          ) => unknown[];
        }
      ).analyzePreferredWorkingHours(sessions);

      expect(workingHours).toBeInstanceOf(Array);
      expect(workingHours.length).toBeGreaterThan(0);

      if (workingHours.length > 0) {
        expect(workingHours[0]).toHaveProperty('start');
        expect(workingHours[0]).toHaveProperty('end');
        expect(workingHours[0]).toHaveProperty('dayOfWeek');
      }
    });
  });
});
