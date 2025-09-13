// Tests for ContextualContextAggregator

import { ContextualContextAggregator } from '../ContextualContextAggregator';
import { AppContext, Priority, TaskStatus, Task } from '../../../types';
import { getTaskRepository } from '../../database/repositories';

// Mock the task repository
jest.mock('../../database/repositories', () => ({
  getTaskRepository: jest.fn(),
}));

const mockTaskRepository = {
  findAll: jest.fn(),
};

(getTaskRepository as jest.Mock).mockReturnValue(mockTaskRepository);

describe('ContextualContextAggregator', () => {
  let aggregator: ContextualContextAggregator;
  let mockContext: AppContext;

  beforeEach(() => {
    aggregator = new ContextualContextAggregator();
    mockContext = {
      currentTask: undefined,
      activeSession: undefined,
      activeFocusSession: undefined,
      focusMode: false,
      timeOfDay: '10:00',
      dayOfWeek: 1,
      currentEnergy: 7,
      recentActivity: [],
      weeklyPlan: undefined,
      preferences: {
        workingHours: {
          start: '09:00',
          end: '17:00',
        },
        breakPreferences: {
          shortBreakDuration: 5,
          longBreakDuration: 15,
          breakInterval: 25,
        },
        focusPreferences: {
          defaultDuration: 25,
          distractionLevel: 'minimal' as const,
          backgroundAudio: {
            type: 'white_noise' as const,
            volume: 50,
          },
        },
        notifications: {
          breakReminders: true,
          taskDeadlines: true,
          dailySummary: true,
          weeklyReview: true,
        },
        aiSettings: {
          conversationHistory: true,
          autoSuggestions: true,
          toolPermissions: true,
          responseStyle: 'balanced' as const,
          suggestionFrequency: 'moderate' as const,
          showInteractionLogs: true,
        },
        taskSettings: {
          defaultPriority: Priority.MEDIUM,
          autoScheduling: false,
          smartDependencies: false,
          weekStartDay: 1 as const,
          showCompletedTasks: true,
          compactView: false,
        },
        soundSettings: {
          hapticFeedback: true,
          completionSound: true,
          soundVolume: 70,
        },
        dateFormat: 'DD/MM/YYYY' as const,
        theme: 'light' as const,
        language: 'en',
      },
    };

    // Reset mocks
    jest.clearAllMocks();
    mockTaskRepository.findAll.mockResolvedValue([]);
  });

  describe('buildEnhancedContext', () => {
    it('should build enhanced context from basic context', async () => {
      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'help me with my tasks'
      );

      expect(result.enhancedContext).toBeDefined();
      expect(result.enhancedContext.workflowState).toBeDefined();
      expect(result.enhancedContext.productivityMetrics).toBeDefined();
      expect(result.enhancedContext.recentPatterns).toBeDefined();
      expect(result.enhancedContext.contextualInsights).toBeDefined();
      expect(result.enhancedContext.environmentalFactors).toBeDefined();
      expect(result.relevanceScore).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockTaskRepository.findAll.mockRejectedValue(new Error('Database error'));

      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'help me with my tasks'
      );

      expect(result.enhancedContext).toBeDefined();
      // The error handling is in individual methods, not the main buildEnhancedContext
      // So we just verify it doesn't crash and returns valid data
      expect(result.enhancedContext.workflowState).toBeDefined();
      expect(result.enhancedContext.productivityMetrics).toBeDefined();
    });

    it('should use cache when available', async () => {
      // First call
      await aggregator.buildEnhancedContext(
        mockContext,
        'help me with my tasks'
      );

      // Second call with same parameters
      const result2 = await aggregator.buildEnhancedContext(
        mockContext,
        'help me with my tasks'
      );

      expect(result2.cacheHit).toBe(true);
      expect(result2.dataSourcesUsed).toContain('cache');
    });
  });

  describe('analyzeContextRelevance', () => {
    it('should calculate relevance scores', async () => {
      const enhancedContext = {
        ...mockContext,
        workflowState: {
          currentPhase: 'executing' as const,
          focusLevel: 8,
          workloadIntensity: 'moderate' as const,
          timeInCurrentPhase: 30,
          upcomingDeadlines: [],
          recentTaskSwitches: 2,
          currentStreak: {
            type: 'focus' as const,
            count: 3,
            startTime: new Date(),
            bestStreak: 5,
          },
        },
        productivityMetrics: {
          todayCompletionRate: 0.7,
          averageTaskDuration: 45,
          focusSessionEfficiency: 0.8,
          breakPatternAdherence: 0.6,
          energyLevel: 7,
          tasksCompletedToday: 5,
          timeSpentToday: 240,
          distractionCount: 3,
          productivityTrend: 'increasing' as const,
        },
        recentPatterns: [],
        contextualInsights: [],
        environmentalFactors: {
          timeOfDay: 'morning' as const,
          dayOfWeek: 1,
          isWorkingHours: true,
          upcomingMeetings: 0,
          systemLoad: 'low' as const,
          networkStatus: 'online' as const,
        },
      };

      const userIntent = {
        primary: 'task_management',
        secondary: [],
        confidence: 0.8,
        category: 'task_management' as const,
        urgency: 'medium' as const,
        complexity: 'simple' as const,
        requiresContext: true,
      };

      const relevanceScore = await aggregator.analyzeContextRelevance(
        enhancedContext,
        userIntent
      );

      expect(relevanceScore.overall).toBeGreaterThan(0);
      expect(relevanceScore.overall).toBeLessThanOrEqual(1);
      expect(relevanceScore.breakdown).toBeDefined();
      expect(relevanceScore.reasoning).toBeInstanceOf(Array);
      expect(relevanceScore.criticalFactors).toBeInstanceOf(Array);
    });
  });

  describe('workflow state detection', () => {
    it('should detect executing phase when active session exists', async () => {
      const contextWithSession = {
        ...mockContext,
        activeSession: {
          id: 'session-1',
          taskId: 'task-1',
          startTime: new Date(),
          pausedTime: 0,
          isActive: true,
          notes: '',
          breaks: [],
          createdAt: new Date(),
        },
      };

      const result = await aggregator.buildEnhancedContext(
        contextWithSession,
        'how am I doing?'
      );

      expect(result.enhancedContext.workflowState.currentPhase).toBe(
        'executing'
      );
      expect(result.enhancedContext.workflowState.focusLevel).toBeGreaterThan(
        5
      );
    });

    it('should calculate workload intensity based on task count', async () => {
      // Mock many urgent tasks
      const urgentTasks = Array.from({ length: 6 }, (_, i) => ({
        id: `task-${i}`,
        title: `Urgent Task ${i}`,
        description: '',
        priority: Priority.URGENT,
        status: TaskStatus.PENDING,
        order: i,
        dependencies: [],
        timePreset: 30 as const,
        timeEstimate: 30,
        actualTime: 0,
        tags: [],
        subtasks: [],
        taskListId: 'list-1',
        isPeriodicInstance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockTaskRepository.findAll.mockResolvedValue(urgentTasks);

      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'what should I work on?'
      );

      expect(result.enhancedContext.workflowState.workloadIntensity).toBe(
        'overwhelming'
      );
    });
  });

  describe('productivity metrics calculation', () => {
    it('should calculate completion rate correctly', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTasks = [
        {
          id: 'task-1',
          title: 'Completed Task',
          status: TaskStatus.COMPLETED,
          createdAt: new Date(today.getTime() + 1000),
          completedAt: new Date(),
        },
        {
          id: 'task-2',
          title: 'Pending Task',
          status: TaskStatus.PENDING,
          createdAt: new Date(today.getTime() + 2000),
        },
      ];

      mockTaskRepository.findAll.mockResolvedValue(todayTasks as Task[]);

      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'how productive am I today?'
      );

      expect(
        result.enhancedContext.productivityMetrics.todayCompletionRate
      ).toBeGreaterThan(0);
    });
  });

  describe('environmental factors', () => {
    it('should detect time of day correctly', async () => {
      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'what time is it?'
      );

      expect(result.enhancedContext.environmentalFactors.timeOfDay).toMatch(
        /morning|afternoon|evening|night/
      );
      expect(
        result.enhancedContext.environmentalFactors.dayOfWeek
      ).toBeGreaterThanOrEqual(0);
      expect(
        result.enhancedContext.environmentalFactors.dayOfWeek
      ).toBeLessThanOrEqual(6);
    });

    it('should detect working hours correctly', async () => {
      const result = await aggregator.buildEnhancedContext(
        mockContext,
        'am I in working hours?'
      );

      expect(
        typeof result.enhancedContext.environmentalFactors.isWorkingHours
      ).toBe('boolean');
    });
  });
});
