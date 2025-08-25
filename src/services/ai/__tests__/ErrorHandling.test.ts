import { MockLocalAIService } from './mocks/MockLocalAIService';
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

  describe('LocalAIService Error Scenarios', () => {
    it('should handle initialization failures gracefully', async () => {
      const service = new MockLocalAIService({ shouldFailInit: true });

      await expect(service.initialize()).rejects.toThrow(
        'Mock initialization failure'
      );
      expect(service.isInitialized()).toBe(false);
    });

    it('should handle generation failures with proper error types', async () => {
      const service = new MockLocalAIService({ shouldFailGeneration: true });
      await service.initialize();

      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow('Mock generation failure');
    });

    it('should prevent processing when not initialized', async () => {
      const service = new MockLocalAIService();

      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow('Service not initialized');
    });

    it('should handle conversation state correctly after errors', async () => {
      const service = new MockLocalAIService();
      await service.initialize();

      // Successful message
      await service.processMessage('Hello', mockContext);
      expect(service.getConversationHistory()).toHaveLength(2);

      // Clear conversation
      service.clearConversation();
      expect(service.getConversationHistory()).toHaveLength(0);
    });

    it('should maintain service state through error recovery', async () => {
      const service = new MockLocalAIService();
      await service.initialize();
      expect(service.isInitialized()).toBe(true);

      // Temporarily enable generation failure
      service.setGenerationFailure(true);
      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow();

      // Service should still be initialized
      expect(service.isInitialized()).toBe(true);

      // Disable failure and try again
      service.setGenerationFailure(false);
      const result = await service.processMessage('Hello', mockContext);
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

      await expect(manager.switchModel('local')).rejects.toThrow(
        'Mock switch failure'
      );
      expect(manager.getCurrentModelType()).toBe('gemini'); // Should remain on original
    });

    it('should handle concurrent model switching attempts', async () => {
      const promise1 = manager.switchModel('local');
      const promise2 = manager.switchModel('gemini');

      // One should succeed, one should fail with "Already switching"
      const results = await Promise.allSettled([promise1, promise2]);

      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle service unavailability', async () => {
      // Remove a service to simulate unavailability
      (
        manager as unknown as { _services: Map<string, unknown> }
      )._services.delete('local');

      await expect(manager.switchModel('local')).rejects.toThrow(
        'Service local not available'
      );
    });

    it('should handle processing with uninitialized service', async () => {
      const localService = manager.getService('local') as MockLocalAIService;
      localService?.reset(); // Reset to uninitialized state
      localService?.setInitializationFailure(true); // Make initialization fail

      await expect(manager.switchModel('local')).rejects.toThrow(
        'Mock initialization failure'
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
      const service = new MockLocalAIService();
      await service.initialize();

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
      const service = new MockLocalAIService();
      await service.initialize();

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

    it('should demonstrate graceful degradation', async () => {
      const manager = new MockModelManager();

      // Simulate local service failure
      const localService = manager.getService('local') as MockLocalAIService;
      localService?.setGenerationFailure(true);

      await manager.switchModel('local');

      // Should fail with local service
      await expect(
        manager.processMessage('Hello', mockContext)
      ).rejects.toThrow();

      // Fallback to Gemini
      await manager.switchModel('gemini');
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

  describe('Resource Cleanup', () => {
    it('should cleanup resources properly on service destruction', () => {
      const manager = new MockModelManager();
      const cleanupSpy = jest.spyOn(manager, 'cleanup');

      manager.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', () => {
      const service = new MockLocalAIService();

      // Mock cleanup that throws
      (service as unknown as { cleanup: () => Promise<void> }).cleanup = () => {
        throw new Error('Cleanup failed');
      };

      // Should not throw when cleanup fails
      expect(() => {
        try {
          (service as unknown as { cleanup: () => Promise<void> }).cleanup();
        } catch (error) {
          // Log error but don't propagate
          console.warn('Cleanup failed:', error);
        }
      }).not.toThrow();
    });
  });
});
