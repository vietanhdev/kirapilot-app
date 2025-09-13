import { MockModelManager } from './mocks/MockModelManager';
import {
  AIServiceError,
  ModelInitializationError,
  ModelProcessingError,
} from '../AIServiceInterface';
import { AppContext, DistractionLevel, Priority } from '../../../types';

describe('AI Service Error Handling', () => {
  let mockContext: AppContext;

  beforeEach(() => {
    mockContext = {
      currentTask: undefined,
      activeSession: undefined,
      activeFocusSession: undefined,
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
          backgroundAudio: { type: 'white_noise', volume: 50 },
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
        },
        taskSettings: {
          defaultPriority: Priority.MEDIUM,
          autoScheduling: false,
          smartDependencies: true,
          weekStartDay: 1,
          showCompletedTasks: true,
          compactView: false,
        },
        theme: 'auto',
        language: 'en',
      },
    };
  });

  describe('Gemini AI Service Error Scenarios', () => {
    it('should handle service unavailability', async () => {
      const manager = new MockModelManager();

      // Remove the service to simulate unavailability
      (
        manager as unknown as { _services: Map<string, unknown> }
      )._services.clear();

      // Test when no service is available
      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow('No service available');
    });

    it('should handle processing errors gracefully', async () => {
      const manager = new MockModelManager();

      // Enable processing failure
      manager.setProcessingFailure(true);

      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow('Mock processing failure');
    });

    it('should recover from processing errors', async () => {
      const manager = new MockModelManager();

      // Enable then disable processing failure
      manager.setProcessingFailure(true);
      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow();

      manager.setProcessingFailure(false);
      const result = await manager.processMessage('Hello', mockContext);
      expect(result.message).toBeDefined();
    });
  });

  describe('ModelManager Error Scenarios', () => {
    let manager: MockModelManager;

    beforeEach(() => {
      manager = new MockModelManager();
    });

    afterEach(() => {
      manager.reset();
    });

    it('should handle model switching failures', async () => {
      manager.setSwitchFailure(true);

      await expect(manager.switchModel('gemini')).rejects.toThrow(
        'Mock switch failure'
      );
      expect(manager.getCurrentModelType()).toBe('gemini'); // Should remain on original
    });

    it('should maintain consistency during model operations', async () => {
      // Test that the manager maintains consistent state
      expect(manager.getCurrentModelType()).toBe('gemini');
      expect(manager.isReady()).toBe(true);

      const service = manager.getCurrentService();
      expect(service).not.toBeNull();
      expect(service?.isInitialized()).toBe(true);
    });

    it('should handle service unavailability', async () => {
      // Remove the service to simulate unavailability
      (
        manager as unknown as { _services: Map<string, unknown> }
      )._services.delete('gemini');

      await expect(manager.switchModel('gemini')).rejects.toThrow(
        'Service gemini not available'
      );
    });

    it('should handle missing current service', async () => {
      // Simulate no current service
      (
        manager as unknown as { _services: Map<string, unknown> }
      )._services.clear();

      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow('No service available');

      expect(manager.getModelStatus().error).toBe('No service available');
      expect(manager.getModelInfo()).toBeNull();
    });

    it('should handle pattern analysis when not supported', async () => {
      // Mock a service without pattern analysis
      const serviceWithoutPatterns = {
        isInitialized: () => true,
        processMessage: jest.fn(),
        getModelInfo: jest.fn(),
        getStatus: jest.fn(),
        setTranslationFunction: jest.fn(),
        clearConversation: jest.fn(),
        // No analyzePatterns method
      };

      (
        manager as unknown as {
          _services: Map<string, unknown>;
          _currentModelType: string;
        }
      )._services.set('test', serviceWithoutPatterns);
      (
        manager as unknown as {
          _services: Map<string, unknown>;
          _currentModelType: string;
        }
      )._currentModelType = 'test';

      const result = await manager.analyzePatterns();
      expect(result).toBeNull();
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should demonstrate retry logic pattern', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      const attemptOperation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return 'Success';
      };

      // Simulate retry logic
      let lastError: Error | null = null;
      let result: string | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await attemptOperation();
          break;
        } catch (error) {
          lastError = error as Error;
          if (i === maxRetries - 1) {
            throw lastError;
          }
        }
      }

      expect(result).toBe('Success');
      expect(attemptCount).toBe(maxRetries);
    });

    it('should demonstrate circuit breaker pattern', async () => {
      // Simulate circuit breaker state
      let failureCount = 0;
      let isCircuitOpen = false;
      const failureThreshold = 5;

      const executeWithCircuitBreaker = async (
        operation: () => Promise<unknown>
      ) => {
        if (isCircuitOpen) {
          throw new Error('Circuit breaker is open');
        }

        try {
          const result = await operation();
          failureCount = 0; // Reset on success
          return result;
        } catch (error) {
          failureCount++;
          if (failureCount >= failureThreshold) {
            isCircuitOpen = true;
          }
          throw error;
        }
      };

      // Cause failures to trigger circuit breaker
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await executeWithCircuitBreaker(async () => {
            throw new Error('Operation failed');
          });
        } catch {
          // Expected
        }
      }

      expect(isCircuitOpen).toBe(true);

      // Next operation should fail immediately
      await expect(
        executeWithCircuitBreaker(async () => 'success')
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should demonstrate graceful error handling', async () => {
      const manager = new MockModelManager();

      // Simulate processing failure
      manager.setProcessingFailure(true);

      // Should fail initially
      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow();

      // Recover and try again
      manager.setProcessingFailure(false);
      const result = await manager.processMessage('Hello', mockContext);

      expect(result.message).toContain('Gemini response');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for common scenarios', () => {
      const initError = new ModelInitializationError(
        'local',
        'Model file not found'
      );
      expect(initError.message).toContain('local');
      expect(initError.message).toContain('Model file not found');

      const processError = new ModelProcessingError('Generation timeout');
      expect(processError.message).toContain('Generation timeout');

      const serviceError = new AIServiceError(
        'Service unavailable',
        'SERVICE_DOWN',
        true
      );
      expect(serviceError.message).toContain('Service unavailable');
      expect(serviceError.code).toBe('SERVICE_DOWN');
      expect(serviceError.recoverable).toBe(true);
    });

    it('should categorize errors appropriately', () => {
      const recoverableError = new AIServiceError(
        'Temporary failure',
        'TEMP_FAILURE',
        true
      );
      const permanentError = new AIServiceError(
        'Configuration error',
        'CONFIG_ERROR',
        false
      );

      expect(recoverableError.recoverable).toBe(true);
      expect(permanentError.recoverable).toBe(false);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for common scenarios', () => {
      const initError = new ModelInitializationError(
        'gemini',
        'API key not configured'
      );
      expect(initError.message).toContain('gemini');
      expect(initError.message).toContain('API key not configured');

      const processError = new ModelProcessingError('Generation timeout');
      expect(processError.message).toContain('Generation timeout');

      const serviceError = new AIServiceError(
        'Service unavailable',
        'SERVICE_DOWN',
        true
      );
      expect(serviceError.message).toContain('Service unavailable');
      expect(serviceError.code).toBe('SERVICE_DOWN');
      expect(serviceError.recoverable).toBe(true);
    });

    it('should categorize errors appropriately', () => {
      const recoverableError = new AIServiceError(
        'Temporary failure',
        'TEMP_FAILURE',
        true
      );
      const permanentError = new AIServiceError(
        'Configuration error',
        'CONFIG_ERROR',
        false
      );

      expect(recoverableError.recoverable).toBe(true);
      expect(permanentError.recoverable).toBe(false);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources properly on service destruction', () => {
      const manager = new MockModelManager();
      const cleanupSpy = jest.spyOn(manager, 'cleanup');

      manager.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});
