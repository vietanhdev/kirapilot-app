import { ModelManager, getModelManager, ModelType } from '../ModelManager';
import { AIServiceError } from '../AIServiceInterface';
import { DistractionLevel } from '../../../types';

// Mock ReactAIService module
const mockReactAIService = {
  isInitialized: jest.fn(() => true),
  setTranslationFunction: jest.fn(),
  setApiKey: jest.fn(),
  initialize: jest.fn().mockResolvedValue(undefined),
  processMessage: jest.fn().mockResolvedValue({
    message: 'Test response',
    actions: [],
    suggestions: [],
    context: {},
    reasoning: 'Test reasoning',
  }),
  getModelInfo: jest.fn(() => ({
    name: 'Gemini 2.0 Flash',
    type: 'cloud',
    status: 'ready',
    capabilities: ['text_generation'],
    version: '2.0',
    contextSize: 2048,
  })),
  getStatus: jest.fn(() => ({
    type: 'gemini',
    isReady: true,
    isLoading: false,
  })),
  clearConversation: jest.fn(),
  analyzePatterns: jest.fn(),
  cleanup: jest.fn(),
};

jest.mock('../ReactAIService', () => ({
  ReactAIService: jest.fn().mockImplementation(() => mockReactAIService),
}));

describe('ModelManager', () => {
  let modelManager: ModelManager;

  beforeEach(() => {
    // Clear any existing singleton instance
    jest.clearAllMocks();
    modelManager = new ModelManager();
  });

  describe('initialization', () => {
    it('should initialize with Gemini service by default', () => {
      expect(modelManager.getCurrentModelType()).toBe('gemini');
      expect(modelManager.getCurrentService()).toBeTruthy();
    });

    it('should return available models', () => {
      const availableModels = modelManager.getAvailableModels();
      expect(availableModels).toContain('gemini');
      expect(availableModels).toEqual(['gemini']);
    });
  });

  describe('model switching', () => {
    it('should switch to Gemini model successfully', async () => {
      await modelManager.switchModel('gemini', {
        type: 'gemini',
        apiKey: 'test-api-key',
      });

      expect(modelManager.getCurrentModelType()).toBe('gemini');
      expect(modelManager.isReady()).toBe(true);
    });

    it('should handle invalid model type gracefully', async () => {
      // Since we only support 'gemini', test with invalid type
      await expect(
        modelManager.switchModel('invalid' as ModelType)
      ).rejects.toThrow();
    });

    it('should handle concurrent model switching', async () => {
      const promise1 = modelManager.switchModel('gemini');
      const promise2 = modelManager.switchModel('gemini');

      await Promise.all([promise1, promise2]);

      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });
  });

  describe('model status', () => {
    it('should return correct model status', () => {
      const status = modelManager.getModelStatus();

      expect(status.type).toBe('gemini');
      expect(typeof status.isReady).toBe('boolean');
      expect(typeof status.isLoading).toBe('boolean');
    });

    it('should return model info', () => {
      const modelInfo = modelManager.getModelInfo();

      expect(modelInfo).toBeTruthy();
      expect(modelInfo?.type).toBe('cloud');
      expect(modelInfo?.name).toBeTruthy();
    });
  });

  describe('message processing', () => {
    const mockContext = {
      focusMode: false,
      timeOfDay: '10:00',
      dayOfWeek: 1,
      currentEnergy: 75,
      recentActivity: [],
      preferences: {
        workingHours: { start: '09:00', end: '17:00' },
        breakPreferences: {
          shortBreakDuration: 5,
          longBreakDuration: 15,
          breakInterval: 25,
        },
        focusPreferences: {
          defaultDuration: 25,
          distractionLevel: DistractionLevel.MINIMAL,
          backgroundAudio: { type: 'white_noise' as const, volume: 50 },
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
          showInteractionLogs: false,
        },
        taskSettings: {
          defaultPriority: 1,
          autoScheduling: false,
          smartDependencies: true,
          weekStartDay: 1 as const,
          showCompletedTasks: true,
          compactView: false,
        },
        soundSettings: {
          hapticFeedback: true,
          completionSound: true,
          soundVolume: 50,
        },
        dateFormat: 'DD/MM/YYYY' as const,
        theme: 'auto' as const,
        language: 'en',
      },
    };

    it('should throw error when no service is available', async () => {
      // Create a manager with no services
      const emptyManager = new ModelManager();
      (emptyManager as unknown as { currentService: unknown }).currentService =
        null;

      await expect(
        emptyManager.processMessage('test message', mockContext)
      ).rejects.toThrow(AIServiceError);
    });

    it('should throw error when service is not initialized', async () => {
      // Mock service that's not initialized
      const mockService = {
        isInitialized: () => false,
        processMessage: jest.fn(),
        getModelInfo: jest.fn(),
        getStatus: jest.fn(),
        setTranslationFunction: jest.fn(),
        clearConversation: jest.fn(),
      };

      (modelManager as unknown as { currentService: unknown }).currentService =
        mockService;

      await expect(
        modelManager.processMessage('test message', mockContext)
      ).rejects.toThrow(AIServiceError);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const manager1 = getModelManager();
      const manager2 = getModelManager();

      expect(manager1).toBe(manager2);
    });
  });

  describe('error handling and recovery', () => {
    it('should maintain Gemini service when invalid model switch fails', async () => {
      // Try to switch to invalid model (which will fail)
      await expect(
        modelManager.switchModel('invalid' as ModelType)
      ).rejects.toThrow();

      // Ensure we're still on Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });

    it('should handle service initialization failures gracefully', async () => {
      // Mock Gemini service initialization failure
      mockReactAIService.initialize.mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      await expect(modelManager.switchModel('gemini')).rejects.toThrow();
      expect(modelManager.getCurrentModelType()).toBe('gemini'); // Should maintain current
    });

    it('should handle concurrent model switching', async () => {
      const promise1 = modelManager.switchModel('gemini');
      const promise2 = modelManager.switchModel('gemini');

      await Promise.all([promise1, promise2]);
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });
  });

  describe('service management', () => {
    it('should set translation function on all services', () => {
      const mockTranslationFn = jest.fn();
      modelManager.setTranslationFunction(mockTranslationFn);

      expect(mockReactAIService.setTranslationFunction).toHaveBeenCalledWith(
        mockTranslationFn
      );
    });

    it('should clear conversation on current service', () => {
      modelManager.clearConversation();
      expect(mockReactAIService.clearConversation).toHaveBeenCalled();
    });

    it('should analyze patterns when supported', async () => {
      mockReactAIService.analyzePatterns.mockResolvedValueOnce({
        userId: 'test',
        analysisDate: new Date(),
        productivityPatterns: [],
        energyPatterns: [],
        recommendations: [],
        insights: {
          mostProductiveTime: { start: '09:00', end: '11:00', dayOfWeek: 1 },
          leastProductiveTime: { start: '14:00', end: '16:00', dayOfWeek: 5 },
          averageTaskDuration: 45,
          completionRate: 0.75,
          focusEfficiency: 0.82,
        },
      });

      const analysis = await modelManager.analyzePatterns();
      expect(analysis).toBeTruthy();
      expect(mockReactAIService.analyzePatterns).toHaveBeenCalled();
    });

    it('should return null for pattern analysis when not supported', async () => {
      const serviceWithoutPatterns = {
        ...mockReactAIService,
        analyzePatterns: undefined,
      };
      (modelManager as unknown as { currentService: unknown }).currentService =
        serviceWithoutPatterns;

      const analysis = await modelManager.analyzePatterns();
      expect(analysis).toBeNull();
    });
  });

  describe('model availability', () => {
    it('should check if specific model types are available', () => {
      expect(modelManager.isModelAvailable('gemini')).toBe(true);
    });

    it('should return false for unknown model types', () => {
      expect(modelManager.isModelAvailable('unknown' as ModelType)).toBe(false);
    });
  });

  describe('Gemini service error handling', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should handle Gemini service failures gracefully', async () => {
      // Make Gemini service fail
      mockReactAIService.processMessage.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const testContext = {
        focusMode: false,
        timeOfDay: '10:00',
        dayOfWeek: 1,
        currentEnergy: 75,
        recentActivity: [],
        preferences: {
          workingHours: { start: '09:00', end: '17:00' },
          breakPreferences: {
            shortBreakDuration: 5,
            longBreakDuration: 15,
            breakInterval: 25,
          },
          focusPreferences: {
            defaultDuration: 25,
            distractionLevel: DistractionLevel.MINIMAL,
            backgroundAudio: { type: 'white_noise' as const, volume: 50 },
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
            showInteractionLogs: false,
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          soundSettings: {
            hapticFeedback: true,
            completionSound: true,
            soundVolume: 50,
          },
          dateFormat: 'DD/MM/YYYY' as const,
          theme: 'auto' as const,
          language: 'en',
        },
      };

      // Should throw an error when Gemini fails
      await expect(
        modelManager.processMessage('test message', testContext)
      ).rejects.toThrow('Generation failed');
    });

    it('should handle Gemini service processing failures', async () => {
      // Clear any previous mocks and set up fresh failure
      mockReactAIService.processMessage.mockReset();
      mockReactAIService.processMessage.mockRejectedValueOnce(
        new Error('Gemini failed')
      );

      const testContext = {
        focusMode: false,
        timeOfDay: '10:00',
        dayOfWeek: 1,
        currentEnergy: 75,
        recentActivity: [],
        preferences: {
          workingHours: { start: '09:00', end: '17:00' },
          breakPreferences: {
            shortBreakDuration: 5,
            longBreakDuration: 15,
            breakInterval: 25,
          },
          focusPreferences: {
            defaultDuration: 25,
            distractionLevel: DistractionLevel.MINIMAL,
            backgroundAudio: { type: 'white_noise' as const, volume: 50 },
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
            showInteractionLogs: false,
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          soundSettings: {
            hapticFeedback: true,
            completionSound: true,
            soundVolume: 50,
          },
          dateFormat: 'DD/MM/YYYY' as const,
          theme: 'auto' as const,
          language: 'en',
        },
      };
      await expect(
        modelManager.processMessage('test message', testContext)
      ).rejects.toThrow('Gemini failed');
    });

    it('should handle service initialization failure gracefully', async () => {
      // Make Gemini service not initialized
      mockReactAIService.isInitialized.mockReturnValueOnce(false);

      const testContext = {
        focusMode: false,
        timeOfDay: '10:00',
        dayOfWeek: 1,
        currentEnergy: 75,
        recentActivity: [],
        preferences: {
          workingHours: { start: '09:00', end: '17:00' },
          breakPreferences: {
            shortBreakDuration: 5,
            longBreakDuration: 15,
            breakInterval: 25,
          },
          focusPreferences: {
            defaultDuration: 25,
            distractionLevel: DistractionLevel.MINIMAL,
            backgroundAudio: { type: 'white_noise' as const, volume: 50 },
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
            showInteractionLogs: false,
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          soundSettings: {
            hapticFeedback: true,
            completionSound: true,
            soundVolume: 50,
          },
          dateFormat: 'DD/MM/YYYY' as const,
          theme: 'auto' as const,
          language: 'en',
        },
      };
      await expect(
        modelManager.processMessage('test message', testContext)
      ).rejects.toThrow('AI service not initialized');
    });
  });

  describe('cleanup', () => {
    it('should cleanup all services', () => {
      const mockService = {
        cleanup: jest.fn(),
        isInitialized: () => true,
        processMessage: jest.fn(),
        getModelInfo: jest.fn(),
        getStatus: jest.fn(),
        setTranslationFunction: jest.fn(),
        clearConversation: jest.fn(),
      };

      (
        modelManager as unknown as { services: Map<string, unknown> }
      ).services.set('test', mockService);
      modelManager.cleanup();

      expect(mockService.cleanup).toHaveBeenCalled();
      expect(modelManager.getCurrentService()).toBeNull();
    });

    it('should handle cleanup when services have no cleanup method', () => {
      const mockService = {
        isInitialized: () => true,
        processMessage: jest.fn(),
        getModelInfo: jest.fn(),
        getStatus: jest.fn(),
        setTranslationFunction: jest.fn(),
        clearConversation: jest.fn(),
      };

      (
        modelManager as unknown as { services: Map<string, unknown> }
      ).services.set('test', mockService);

      expect(() => modelManager.cleanup()).not.toThrow();
      expect(modelManager.getCurrentService()).toBeNull();
    });
  });
});
