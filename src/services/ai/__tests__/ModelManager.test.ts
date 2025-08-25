import { ModelManager, getModelManager, ModelType } from '../ModelManager';
import {
  AIServiceError,
  ModelInitializationError,
} from '../AIServiceInterface';
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

// Mock LocalAIService module
const mockLocalAIService = {
  isInitialized: jest.fn(() => false),
  setTranslationFunction: jest.fn(),
  initialize: jest
    .fn()
    .mockRejectedValue(
      new ModelInitializationError('local', 'Not implemented yet')
    ),
  processMessage: jest.fn().mockResolvedValue({
    message: 'Local response',
    actions: [],
    suggestions: [],
    context: {},
    reasoning: 'Local reasoning',
  }),
  getModelInfo: jest.fn(() => ({
    name: 'gemma-3-270m-it',
    type: 'local',
    status: 'not_initialized',
    capabilities: ['text_generation', 'offline_operation'],
    version: '270M',
    contextSize: 2048,
  })),
  getStatus: jest.fn(() => ({
    type: 'local',
    isReady: false,
    isLoading: false,
    error: 'Not implemented yet',
  })),
  clearConversation: jest.fn(),
  analyzePatterns: jest.fn(),
  cleanup: jest.fn(),
};

jest.mock('../LocalAIService', () => ({
  LocalAIService: jest.fn().mockImplementation(() => mockLocalAIService),
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
      expect(availableModels).toContain('local');
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

    it('should throw error when switching to local model fails', async () => {
      await expect(modelManager.switchModel('local')).rejects.toThrow(
        ModelInitializationError
      );
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
        },
        taskSettings: {
          defaultPriority: 1,
          autoScheduling: false,
          smartDependencies: true,
          weekStartDay: 1 as const,
          showCompletedTasks: true,
          compactView: false,
        },
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
    it('should attempt fallback to Gemini when local model fails', async () => {
      // First switch to local model (which will fail)
      await expect(modelManager.switchModel('local')).rejects.toThrow();

      // Ensure we're still on Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });

    it('should handle service initialization failures gracefully', async () => {
      mockLocalAIService.initialize.mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      await expect(modelManager.switchModel('local')).rejects.toThrow();
      expect(modelManager.getCurrentModelType()).toBe('gemini'); // Should fallback
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
      expect(modelManager.isModelAvailable('local')).toBe(true);
    });

    it('should return false for unknown model types', () => {
      expect(modelManager.isModelAvailable('unknown' as ModelType)).toBe(false);
    });
  });

  describe('automatic fallback behavior', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should attempt fallback when local model processing fails', async () => {
      // Setup local service as current but make it fail
      mockLocalAIService.isInitialized.mockReturnValue(true);
      mockLocalAIService.processMessage.mockRejectedValueOnce(
        new Error('Generation failed')
      );
      (
        modelManager as unknown as {
          currentService: unknown;
          modelType: string;
        }
      ).currentService = mockLocalAIService;
      (
        modelManager as unknown as {
          currentService: unknown;
          modelType: string;
        }
      ).modelType = 'local';

      // Mock successful switch to Gemini
      mockReactAIService.processMessage.mockResolvedValueOnce({
        message: 'Fallback response from Gemini',
        actions: [],
        suggestions: [],
        context: {},
        reasoning: 'Fallback reasoning',
      });

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
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          theme: 'auto' as const,
          language: 'en',
        },
      };
      const response = await modelManager.processMessage(
        'test message',
        testContext
      );

      expect(response.message).toContain('Switched to cloud model');
      expect(mockReactAIService.processMessage).toHaveBeenCalled();
    });

    it('should not attempt fallback for Gemini service failures', async () => {
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
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          theme: 'auto' as const,
          language: 'en',
        },
      };
      await expect(
        modelManager.processMessage('test message', testContext)
      ).rejects.toThrow();
    });

    it('should handle fallback failure gracefully', async () => {
      // Setup local service failure
      mockLocalAIService.isInitialized.mockReturnValue(true);
      mockLocalAIService.processMessage.mockRejectedValueOnce(
        new Error('Local failed')
      );
      (
        modelManager as unknown as {
          currentService: unknown;
          modelType: string;
        }
      ).currentService = mockLocalAIService;
      (
        modelManager as unknown as {
          currentService: unknown;
          modelType: string;
        }
      ).modelType = 'local';

      // Make Gemini fallback also fail
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
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: true,
            weekStartDay: 1 as const,
            showCompletedTasks: true,
            compactView: false,
          },
          theme: 'auto' as const,
          language: 'en',
        },
      };
      await expect(
        modelManager.processMessage('test message', testContext)
      ).rejects.toThrow(
        'Both local and cloud AI services are currently unavailable'
      );
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
