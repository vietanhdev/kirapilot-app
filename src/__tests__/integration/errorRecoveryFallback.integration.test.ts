/**
 * Integration tests for error recovery and fallback mechanisms
 * Tests automatic fallback to Gemini, circuit breaker patterns,
 * retry mechanisms, and error recovery workflows
 */

import { ModelManager } from '../../services/ai/ModelManager';
import { ReactAIService } from '../../services/ai/ReactAIService';
import { MockAIService } from '../mocks/MockAIService';
import {
  AppContext,
  TaskStatus,
  Priority,
  DistractionLevel,
  TimePreset,
} from '../../types';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock the AI services
jest.mock('../../services/ai/ReactAIService');

const MockedReactAIService = ReactAIService as jest.MockedClass<
  typeof ReactAIService
>;

describe('Error Recovery and Fallback Integration Tests', () => {
  let modelManager: ModelManager;
  let mockGeminiService: MockAIService;
  let testContext: AppContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockClear();

    // Create mock services
    mockGeminiService = new MockAIService();

    // Mock service constructors
    MockedReactAIService.mockImplementation(
      () => mockGeminiService as unknown as ReactAIService
    );

    modelManager = new ModelManager();

    testContext = {
      currentTask: {
        id: 'test-task-1',
        title: 'Test Task',
        description: 'A test task',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        order: 0,
        timePreset: TimePreset.SIXTY_MIN,
        timeEstimate: 60,
        actualTime: 0,
        dependencies: [],
        subtasks: [],
        taskListId: 'default',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      activeSession: undefined,
      focusMode: false,
      timeOfDay: 'morning',
      dayOfWeek: 1,
      currentEnergy: 85,
      recentActivity: [],
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
          defaultPriority: Priority.MEDIUM,
          autoScheduling: false,
          smartDependencies: true,
          weekStartDay: 1 as 0 | 1,
          showCompletedTasks: true,
          compactView: false,
        },
        theme: 'light' as const,
        language: 'en',
      },
    };
  });

  describe('Gemini Service Error Handling', () => {
    it('should initialize with Gemini by default', async () => {
      expect(modelManager.getCurrentModelType()).toBe('gemini');
      expect(modelManager.isReady()).toBe(true);

      // Should be able to process messages
      const response = await modelManager.processMessage('Hello', testContext);
      expect(response).toHaveProperty('message');
    });

    it.skip('should fallback during message processing when local model fails', async () => {
      // Successfully switch to local model first
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');
      expect(modelManager.getCurrentModelType()).toBe('local');

      // Configure local service to fail during processing
      mockLocalService.setGenerationFailure(true);

      // Process message - should trigger fallback
      const response = await modelManager.processMessage(
        'Create a task for project review',
        testContext
      );

      // Should have switched to Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
      expect(response.message).toContain('Switched to cloud model');
      expect(response).toHaveProperty('actions');
    });

    it.skip('should include fallback notification in response', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Configure failure
      mockLocalService.setGenerationFailure(true);

      const response = await modelManager.processMessage(
        'Help me',
        testContext
      );

      expect(response.message).toMatch(/⚠️.*Switched to cloud model/);
    });

    it.skip('should attempt recovery after fallback', async () => {
      // Setup and fail local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');
      mockLocalService.setGenerationFailure(true);

      // Trigger fallback
      await modelManager.processMessage('Test message', testContext);
      expect(modelManager.getCurrentModelType()).toBe('gemini');

      // Simulate recovery attempt (would normally happen after timeout)
      mockLocalService.setGenerationFailure(false);

      // Mock successful recovery
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      // Manually trigger recovery (in real scenario this would be automatic)
      await modelManager.switchModel('local');
      expect(modelManager.getCurrentModelType()).toBe('local');
    });
  });

  describe.skip('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after repeated failures', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Configure repeated failures
      mockLocalService.setGenerationFailure(true);

      // Multiple failures should trigger circuit breaker and fallback
      for (let i = 0; i < 5; i++) {
        try {
          await modelManager.processMessage(`Message ${i}`, testContext);
        } catch {
          // Some may fail before fallback kicks in
        }
      }

      // Should have fallen back to Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });

    it('should prevent operations when circuit breaker is open', async () => {
      // Create a service that simulates circuit breaker behavior
      const failingService = new MockLocalAIService({
        shouldFailGeneration: true,
      });
      MockedLocalAIService.mockImplementation(
        () => failingService as unknown as LocalAIService
      );

      const testManager = new ModelManager();

      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await testManager.switchModel('local');

      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await testManager.processMessage(`Fail ${i}`, testContext);
        } catch {
          // Expected failures
        }
      }

      // Should have fallen back to Gemini due to circuit breaker
      expect(testManager.getCurrentModelType()).toBe('gemini');
    });

    it('should reset circuit breaker after successful operations', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Cause some failures
      mockLocalService.setGenerationFailure(true);

      try {
        await modelManager.processMessage('Fail', testContext);
      } catch {
        // Expected failure
      }

      // Reset to success
      mockLocalService.setGenerationFailure(false);

      // Should work normally after reset
      const response = await modelManager.processMessage(
        'Success',
        testContext
      );
      expect(response).toHaveProperty('message');
    });
  });

  describe.skip('Retry Mechanisms with Exponential Backoff', () => {
    it('should retry operations with exponential backoff', async () => {
      // Reset the mock to ensure clean state
      jest.clearAllMocks();
      let attemptCount = 0;

      // Mock the LocalAIService constructor to track initialization attempts
      MockedLocalAIService.mockImplementation(() => {
        const mockService = new MockLocalAIService();
        mockService.initialize = jest.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary failure');
          }
          // Succeed on the 3rd attempt
          (
            mockService as unknown as { _isInitialized: boolean }
          )._isInitialized = true;
        });
        return mockService as unknown as LocalAIService;
      });

      // Create a fresh ModelManager instance for this test
      const testModelManager = new ModelManager();

      // Should eventually succeed after retries
      await testModelManager.switchModel('local');

      // The exact number might vary due to service initialization, but should be at least 3
      expect(attemptCount).toBeGreaterThanOrEqual(3);
      expect(testModelManager.isReady()).toBe(true);
    });

    it('should respect maximum retry attempts', async () => {
      // Test that the ModelManager doesn't retry indefinitely when a service fails
      let attemptCount = 0;

      // Configure mock to always fail
      mockLocalService.initialize = jest.fn().mockImplementation(async () => {
        attemptCount++;
        throw new Error('Persistent failure');
      });

      // Should fail without infinite retries
      await expect(modelManager.switchModel('local')).rejects.toThrow();

      // ModelManager should retry up to maxRetries times
      expect(attemptCount).toBe(3);
    });

    it('should not retry non-recoverable errors', async () => {
      // Test that the ModelManager handles non-recoverable errors appropriately
      let attemptCount = 0;

      // Configure mock to fail with a configuration error
      mockLocalService.initialize = jest.fn().mockImplementation(async () => {
        attemptCount++;
        throw new Error('CONFIGURATION_ERROR: Invalid API key');
      });

      await expect(modelManager.switchModel('local')).rejects.toThrow();

      // Should not retry configuration errors
      expect(attemptCount).toBe(1);
    });
  });

  describe.skip('Error Classification and Handling', () => {
    it('should classify errors correctly for fallback decisions', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Test different error types
      const errorTypes = [
        'Model not found',
        'Insufficient resources',
        'Network timeout',
        'Generation failed',
        'Circuit breaker open',
      ];

      for (const errorType of errorTypes) {
        // Reset service
        mockLocalService.reset();
        await mockLocalService.initialize();

        // Configure specific error
        mockLocalService.setGenerationFailure(true);

        try {
          await modelManager.processMessage(`Test ${errorType}`, testContext);
        } catch {
          // Some errors may not trigger fallback immediately
        }
      }

      // Should have triggered fallback for recoverable errors
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });

    it('should provide detailed error information for troubleshooting', async () => {
      mockLocalService.setInitializationFailure(true);

      try {
        await modelManager.switchModel('local');
        fail('Expected initialization to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          'Mock initialization failure'
        );
      }
    });

    it('should handle resource constraint errors with suggestions', async () => {
      // Configure mock local service to fail initialization with resource constraint error
      mockLocalService.setInitializationFailure(true);

      mockInvoke.mockResolvedValueOnce({
        is_available: false,
        is_loaded: false,
        model_path: null,
        error_message: 'Insufficient memory: Need 2GB, have 1GB available',
      });

      try {
        await modelManager.switchModel('local');
      } catch (error) {
        expect((error as Error).message).toContain('initialization');
      }

      // Should still be able to use Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
      const response = await modelManager.processMessage('Hello', testContext);
      expect(response).toHaveProperty('message');
    });
  });

  describe.skip('Service Recovery and Health Monitoring', () => {
    it('should monitor service health and trigger recovery', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Simulate health check failure
      mockLocalService.setGenerationFailure(true);

      // Process message to trigger health check
      await modelManager.processMessage('Health check', testContext);

      // Should have fallen back to Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');
    });

    it('should handle graceful degradation under resource pressure', async () => {
      // Mock resource pressure scenario
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        .mockResolvedValueOnce({
          memory_usage_mb: 1800, // High memory usage
          cpu_usage_percent: 95, // High CPU usage
          active_requests: 5,
          queued_requests: 10,
          avg_processing_time_ms: 5000, // Slow processing
          total_requests: 100,
          failed_requests: 15,
          last_updated: new Date().toISOString(),
        });

      await modelManager.switchModel('local');

      // Should handle resource pressure gracefully
      const response = await modelManager.processMessage(
        'Process under pressure',
        testContext
      );
      expect(response).toHaveProperty('message');
    });

    it('should recover from temporary service interruptions', async () => {
      // Setup local model
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');

      // Simulate temporary interruption
      mockLocalService.setGenerationFailure(true);

      try {
        await modelManager.processMessage('Interrupted', testContext);
      } catch {
        // Expected failure
      }

      // Simulate recovery
      mockLocalService.setGenerationFailure(false);

      // Should work again
      const response = await modelManager.processMessage(
        'Recovered',
        testContext
      );
      expect(response).toHaveProperty('message');
    });
  });

  describe.skip('Fallback Chain and Multiple Services', () => {
    it('should handle complete service failure gracefully', async () => {
      // Configure both services to fail
      mockLocalService.setInitializationFailure(true);
      mockGeminiService.setFailureMode(true);

      // Try to switch to local (will fail)
      await expect(modelManager.switchModel('local')).rejects.toThrow();

      // Should still have Gemini as fallback, but it's also failing
      try {
        await modelManager.processMessage('Test', testContext);
      } catch (error) {
        expect((error as Error).message).toContain('service');
      }
    });

    it('should provide helpful error messages when all services fail', async () => {
      // Configure all services to fail
      mockLocalService.setInitializationFailure(true);
      mockGeminiService.setFailureMode(true);

      try {
        await modelManager.switchModel('local');
      } catch {
        // Expected failure
      }

      try {
        await modelManager.processMessage('Test', testContext);
      } catch (error) {
        expect((error as Error).message).toContain('service');
      }
    });

    it('should maintain service preferences after recovery', async () => {
      // Setup local model successfully
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await modelManager.switchModel('local');
      expect(modelManager.getCurrentModelType()).toBe('local');

      // Cause temporary failure and fallback
      mockLocalService.setGenerationFailure(true);
      await modelManager.processMessage('Fail', testContext);
      expect(modelManager.getCurrentModelType()).toBe('gemini');

      // Recover local service
      mockLocalService.setGenerationFailure(false);

      // Mock recovery initialization
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      // Should be able to switch back to local
      await modelManager.switchModel('local');
      expect(modelManager.getCurrentModelType()).toBe('local');
    });
  });
});
