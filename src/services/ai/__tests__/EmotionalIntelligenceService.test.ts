import { EmotionalIntelligenceService } from '../EmotionalIntelligenceService';
import {
  EmotionalIntelligenceConfig,
  MoodLevel,
  AppContext,
  ActivityEvent,
  UserPreferences,
  DistractionLevel,
  Priority,
} from '../../../types';

// Helper function to create mock preferences
const createMockPreferences = (): UserPreferences => ({
  workingHours: { start: '09:00', end: '17:00' },
  breakPreferences: {
    shortBreakDuration: 5,
    longBreakDuration: 15,
    breakInterval: 25,
  },
  focusPreferences: {
    defaultDuration: 25,
    distractionLevel: DistractionLevel.MODERATE,
    backgroundAudio: { enabled: false, volume: 50, type: 'nature' },
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
    responseStyle: 'balanced',
    suggestionFrequency: 'moderate',
    showInteractionLogs: false,
  },
  taskSettings: {
    defaultPriority: Priority.MEDIUM,
    autoScheduling: false,
    smartDependencies: false,
    weekStartDay: 1,
    showCompletedTasks: false,
    compactView: false,
  },
  soundSettings: {
    hapticFeedback: true,
    completionSound: true,
    soundVolume: 70,
  },
  theme: 'auto' as const,
  language: 'en',
  dateFormat: 'DD/MM/YYYY' as const,
});

// Mock the repository
jest.mock('../../database/repositories', () => ({
  getEmotionalIntelligenceRepository: () => ({
    storeMoodEntry: jest
      .fn()
      .mockImplementation(entry => Promise.resolve(entry)),
    getMoodEntries: jest.fn().mockResolvedValue([]),
    storeEmotionalPattern: jest.fn().mockResolvedValue({
      id: 'pattern-id',
      userId: 'test-user',
      patternType: 'daily_mood',
      timeframe: 'daily',
      data: {},
      confidence: 80,
      lastUpdated: new Date(),
    }),
    storeConfig: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn().mockResolvedValue(null),
    getMoodStatistics: jest.fn().mockResolvedValue({
      averageMood: {
        energy: 5,
        focus: 5,
        motivation: 5,
        stress: 5,
        timestamp: new Date(),
      },
      moodTrends: [],
      stressEvents: 0,
      totalEntries: 0,
    }),
    deleteOldMoodEntries: jest.fn().mockResolvedValue(0),
  }),
}));

// Mock PerformanceMonitor
jest.mock('../PerformanceMonitor', () => ({
  getPerformanceMonitor: () => ({
    startOperation: jest.fn(),
    endOperation: jest.fn(),
    recordMetric: jest.fn(),
  }),
}));

describe('EmotionalIntelligenceService', () => {
  let service: EmotionalIntelligenceService;
  let config: EmotionalIntelligenceConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      dailyMoodTracking: true,
      stressDetection: true,
      encouragementFrequency: 'medium',
      celebrationStyle: 'enthusiastic',
      personalitySettings: {
        warmth: 7,
        enthusiasm: 6,
        supportiveness: 8,
        humor: 5,
      },
      interactionStyle: 'friendly',
      emojiUsage: 'moderate',
    };

    service = new EmotionalIntelligenceService(config, 'test-user');
  });

  describe('mood detection', () => {
    it('should detect positive mood from message', () => {
      const userMessage = 'I feel great and motivated today!';
      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '09:00',
        dayOfWeek: 1,
        currentEnergy: 7,
        recentActivity: [],
        preferences: createMockPreferences(),
      };

      const result = service.detectMoodFromInteraction(
        userMessage,
        appContext,
        []
      );

      expect(result.detectedMood.motivation).toBe(8);
      expect(result.detectedMood.energy).toBeGreaterThanOrEqual(6);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.indicators).toContain('Positive language detected');
    });

    it('should detect stress from message', () => {
      const userMessage = 'I am so stressed and overwhelmed with work';
      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '14:00',
        dayOfWeek: 3,
        currentEnergy: 3,
        recentActivity: [],
        preferences: createMockPreferences(),
      };

      const result = service.detectMoodFromInteraction(
        userMessage,
        appContext,
        []
      );

      expect(result.detectedMood.stress).toBeGreaterThan(6);
      expect(result.detectedMood.energy).toBeLessThan(5);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.indicators).toContain('Stress-related language detected');
    });

    it('should detect fatigue from message', () => {
      const userMessage = 'I am so tired and drained today';
      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '16:00',
        dayOfWeek: 5,
        currentEnergy: 2,
        recentActivity: [],
        preferences: createMockPreferences(),
      };

      const result = service.detectMoodFromInteraction(
        userMessage,
        appContext,
        []
      );

      expect(result.detectedMood.energy).toBeLessThan(4);
      expect(result.detectedMood.focus).toBeLessThan(4);
      expect(result.indicators).toContain('Fatigue indicators in message');
    });
  });

  describe('emotional context generation', () => {
    it('should generate appropriate emotional context', () => {
      const mood: MoodLevel = {
        energy: 3,
        focus: 4,
        motivation: 2,
        stress: 8,
        timestamp: new Date(),
      };

      const recentActivity: ActivityEvent[] = [
        {
          id: '1',
          type: 'task_created',
          timestamp: new Date(),
          data: { taskId: 'task1' },
        },
        {
          id: '2',
          type: 'task_created',
          timestamp: new Date(),
          data: { taskId: 'task2' },
        },
      ];

      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '14:00',
        dayOfWeek: 3,
        currentEnergy: 3,
        recentActivity,
        preferences: createMockPreferences(),
      };

      const context = service.generateEmotionalContext(
        mood,
        recentActivity,
        appContext
      );

      expect(context.currentMood).toEqual(mood);
      expect(context.stressIndicators.length).toBeGreaterThan(0);
      expect(context.supportNeeds.length).toBeGreaterThan(0);

      // Should detect stress and low energy
      const stressSupport = context.supportNeeds.find(
        need => need.type === 'stress_relief'
      );
      const energySupport = context.supportNeeds.find(
        need => need.type === 'break_suggestion'
      );
      const motivationSupport = context.supportNeeds.find(
        need => need.type === 'encouragement'
      );

      expect(stressSupport).toBeDefined();
      expect(energySupport).toBeDefined();
      expect(motivationSupport).toBeDefined();
    });

    it('should identify achievements from activity', () => {
      const mood: MoodLevel = {
        energy: 7,
        focus: 6,
        motivation: 8,
        stress: 3,
        timestamp: new Date(),
      };

      const recentActivity: ActivityEvent[] = [
        {
          id: '1',
          type: 'task_completed',
          timestamp: new Date(),
          data: { taskId: 'task1' },
        },
        {
          id: '2',
          type: 'task_completed',
          timestamp: new Date(),
          data: { taskId: 'task2' },
        },
        {
          id: '3',
          type: 'focus_ended',
          timestamp: new Date(),
          data: { sessionId: 'session1' },
        },
      ];

      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '10:00',
        dayOfWeek: 2,
        currentEnergy: 7,
        recentActivity,
        preferences: createMockPreferences(),
      };

      const context = service.generateEmotionalContext(
        mood,
        recentActivity,
        appContext
      );

      expect(context.recentAchievements.length).toBeGreaterThan(0);

      const taskAchievement = context.recentAchievements.find(
        ach => ach.type === 'task_completion'
      );
      const focusAchievement = context.recentAchievements.find(
        ach => ach.type === 'productivity_milestone'
      );

      expect(taskAchievement).toBeDefined();
      expect(focusAchievement).toBeDefined();

      // Should suggest celebration
      const celebrationSupport = context.supportNeeds.find(
        need => need.type === 'celebration'
      );
      expect(celebrationSupport).toBeDefined();
    });
  });

  describe('supportive response generation', () => {
    it('should generate appropriate supportive response for stress', () => {
      const emotionalContext = {
        currentMood: {
          energy: 3,
          focus: 4,
          motivation: 2,
          stress: 8,
          timestamp: new Date(),
        },
        stressIndicators: [
          {
            type: 'task_overload' as const,
            severity: 8,
            description: 'High task load detected',
            detectedAt: new Date(),
          },
        ],
        recentAchievements: [],
        supportNeeds: [
          {
            type: 'stress_relief' as const,
            priority: 8,
            message: 'You seem stressed',
            actionable: true,
            suggestedActions: ['Take a break', 'Prioritize tasks'],
          },
        ],
      };

      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '14:00',
        dayOfWeek: 3,
        currentEnergy: 3,
        recentActivity: [],
        preferences: createMockPreferences(),
      };

      const response = service.generateSupportiveResponse(
        emotionalContext,
        'I have too much to do',
        appContext
      );

      expect(response.emotionalSupport).toBe(true);
      expect(response.message).toContain('pressure');
      expect(response.suggestedActions.length).toBeGreaterThan(0);
      expect(response.tone.supportiveness).toBeGreaterThan(6);
    });

    it('should generate celebratory response for achievements', () => {
      const emotionalContext = {
        currentMood: {
          energy: 7,
          focus: 6,
          motivation: 8,
          stress: 3,
          timestamp: new Date(),
        },
        stressIndicators: [],
        recentAchievements: [
          {
            id: '1',
            type: 'task_completion' as const,
            title: 'Completed 3 tasks',
            description: "You've completed 3 tasks today!",
            significance: 6,
            achievedAt: new Date(),
          },
        ],
        supportNeeds: [
          {
            type: 'celebration' as const,
            priority: 6,
            message: 'Great work!',
            actionable: false,
          },
        ],
      };

      const appContext: AppContext = {
        focusMode: false,
        timeOfDay: '10:00',
        dayOfWeek: 2,
        currentEnergy: 7,
        recentActivity: [],
        preferences: createMockPreferences(),
      };

      const response = service.generateSupportiveResponse(
        emotionalContext,
        'I finished my tasks',
        appContext
      );

      expect(response.emotionalSupport).toBe(true);
      expect(response.message).toMatch(/(great|amazing|awesome)/i);
      expect(response.tone.enthusiasm).toBeGreaterThan(5);
    });
  });

  describe('mood recording', () => {
    it('should record mood entry successfully', async () => {
      const mood: MoodLevel = {
        energy: 6,
        focus: 7,
        motivation: 8,
        stress: 4,
        timestamp: new Date(),
      };

      const entry = await service.recordMoodEntry(mood, 'Feeling good today');

      expect(entry.userId).toBe('test-user');
      expect(entry.mood).toEqual(mood);
      expect(entry.notes).toBe('Feeling good today');
      expect(entry.id).toBeDefined();
      expect(entry.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', async () => {
      const updates = {
        encouragementFrequency: 'high' as const,
        personalitySettings: {
          warmth: 9,
          enthusiasm: 8,
          supportiveness: 9,
          humor: 6,
        },
      };

      await service.updateConfig(updates);

      // Configuration should be updated
      expect(service['config'].encouragementFrequency).toBe('high');
      expect(service['config'].personalitySettings.warmth).toBe(9);
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics for mood detection', () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the service
      (
        service as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      const context: AppContext = {
        currentView: 'planning',
        activeTask: null,
        recentTasks: [],
        timeOfDay: new Date().toTimeString().slice(0, 5),
        userPreferences: {},
      };

      service.detectMoodFromInteraction('I feel great today!', context, []);

      expect(performanceMonitorSpy.startOperation).toHaveBeenCalledWith(
        expect.stringContaining('mood-detection'),
        expect.objectContaining({
          type: 'mood_detection',
          messageLength: expect.any(Number),
          activityCount: 0,
        })
      );

      expect(performanceMonitorSpy.endOperation).toHaveBeenCalledWith(
        expect.stringContaining('mood-detection'),
        expect.objectContaining({
          success: true,
          additionalMetrics: expect.objectContaining({
            indicators_found: expect.any(Number),
            confidence_score: expect.any(Number),
          }),
        })
      );
    });

    it('should handle performance monitoring for large datasets', () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the service
      (
        service as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      const context: AppContext = {
        currentView: 'planning',
        activeTask: null,
        recentTasks: [],
        timeOfDay: new Date().toTimeString().slice(0, 5),
        userPreferences: {},
      };

      // Create large activity array to test performance
      const largeActivity: ActivityEvent[] = Array.from(
        { length: 100 },
        (_, i) => ({
          type: 'task_completed',
          timestamp: new Date(),
          data: { taskId: `task-${i}` },
        })
      );

      const longMessage =
        'I am feeling overwhelmed with all these tasks. '.repeat(50);

      service.detectMoodFromInteraction(longMessage, context, largeActivity);

      expect(performanceMonitorSpy.startOperation).toHaveBeenCalledWith(
        expect.stringContaining('mood-detection'),
        expect.objectContaining({
          messageLength: longMessage.length,
          activityCount: 100,
        })
      );
    });
  });
});
