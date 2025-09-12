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
  });
});
