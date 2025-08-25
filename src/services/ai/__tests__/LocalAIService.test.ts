import { LocalAIService } from '../LocalAIService';
import { AppContext, Priority, DistractionLevel } from '../../../types';
import { invoke } from '@tauri-apps/api/core';
import { ModelProcessingError } from '../AIServiceInterface';
import { ModelInitializationError } from '../AIServiceInterface';

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock Tauri invoke
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock tool execution engine
const mockToolExecutionEngine = {
  getAvailableTools: jest.fn(() => [
    'create_task',
    'update_task',
    'start_timer',
    'get_tasks',
    'stop_timer',
  ]),
  validateExecution: jest.fn(() => ({ allowed: true, reason: '' })),
  setTranslationFunction: jest.fn(),
  getToolInfo: jest.fn((toolName: string) => ({
    description: `Mock description for ${toolName}`,
  })),
};

const mockResultFormatter = {
  format: jest.fn(() => ({
    success: true,
    userMessage: 'Task created successfully',
    formattedMessage: '✅ Task created successfully',
  })),
};

jest.mock('../ToolExecutionEngine', () => ({
  getToolExecutionEngine: () => mockToolExecutionEngine,
}));

jest.mock('../ToolResultFormatter', () => ({
  getToolResultFormatter: () => mockResultFormatter,
}));

describe('LocalAIService', () => {
  let service: LocalAIService;
  let mockContext: AppContext;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new LocalAIService();

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

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize successfully when model is available', async () => {
      // Mock successful model status and initialization
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model',
        })
        .mockResolvedValueOnce('Model initialized successfully');

      await service.initialize();

      expect(service.isInitialized()).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('get_model_status');
    });

    it('should download and initialize model when not available', async () => {
      // Mock model not available, then successful download and initialization
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockResolvedValueOnce('Model downloaded successfully')
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model',
        });

      await service.initialize();

      expect(service.isInitialized()).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('download_model', {
        repo: 'unsloth/gemma-3-270m-it-GGUF',
        model: 'gemma-3-270m-it-Q4_K_M.gguf',
      });
      expect(mockInvoke).toHaveBeenCalledWith('initialize_local_model');
    });

    it('should throw error when initialization fails', async () => {
      mockInvoke.mockRejectedValueOnce(
        new Error('Model initialization failed')
      );

      await expect(service.initialize()).rejects.toThrow();
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('model information', () => {
    it('should return correct model info', () => {
      const modelInfo = service.getModelInfo();

      expect(modelInfo).toEqual({
        name: 'gemma-3-270m-it',
        type: 'local',
        status: 'not_initialized',
        capabilities: [
          'text_generation',
          'tool_calling',
          'reasoning',
          'task_management',
          'time_tracking',
          'offline_operation',
        ],
        version: '270M',
        size: '~150MB',
        contextSize: 2048,
      });
    });

    it('should return correct status', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        type: 'local',
        isReady: false,
        isLoading: false,
        error: 'Model not initialized',
        modelInfo: expect.any(Object),
      });
    });
  });

  describe('message processing', () => {
    beforeEach(async () => {
      // Initialize the service for message processing tests
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });

      await service.initialize();
      jest.clearAllMocks(); // Clear mocks after initialization
    });

    it('should process simple message without tool calls', async () => {
      const mockResponse =
        'I can help you with task management and productivity.';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage(
        'Hello, how can you help me?',
        mockContext
      );

      expect(result).toEqual({
        message: mockResponse,
        actions: [],
        suggestions: expect.any(Array),
        context: {},
        reasoning: '',
      });

      expect(mockInvoke).toHaveBeenCalledWith('generate_text', {
        prompt: expect.stringContaining('Hello, how can you help me?'),
        maxTokens: 512,
        temperature: 0.7,
      });
    });

    it('should parse tool calls from response', async () => {
      const mockResponse =
        'I\'ll create a task for you. TOOL_CALL: create_task(title="Test Task", description="A test task")';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage(
        'Create a task called Test Task',
        mockContext
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        type: 'CREATE_TASK',
        parameters: {
          title: 'Test Task',
          description: 'A test task',
        },
        context: {},
        confidence: 90,
        reasoning: 'Selected create_task tool based on user request analysis',
      });

      expect(mockToolExecutionEngine.validateExecution).toHaveBeenCalledWith(
        'create_task',
        {
          title: 'Test Task',
          description: 'A test task',
        }
      );
    });

    it('should handle multiple tool calls', async () => {
      const mockResponse =
        'I\'ll create a task and start the timer. TOOL_CALL: create_task(title="Work Task") TOOL_CALL: start_timer(taskId="123")';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage(
        'Create a task and start working on it',
        mockContext
      );

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('CREATE_TASK');
      expect(result.actions[1].type).toBe('START_TIMER');
    });

    it('should throw error when model is not initialized', async () => {
      const uninitializedService = new LocalAIService();

      await expect(
        uninitializedService.processMessage('Hello', mockContext)
      ).rejects.toThrow('Local model not initialized');
    });

    it('should handle generation errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow('Generation failed');
    });
  });

  describe('conversation management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });

      await service.initialize();
      jest.clearAllMocks(); // Clear mocks after initialization
    });

    it('should maintain conversation history', async () => {
      mockInvoke
        .mockResolvedValueOnce('Hello! How can I help you?')
        .mockResolvedValueOnce('I can help you create tasks.');

      await service.processMessage('Hello', mockContext);
      await service.processMessage('What can you do?', mockContext);

      // Verify that the second call includes conversation history in the prompt
      const secondCallArgs = mockInvoke.mock.calls[1][1] as { prompt: string };
      expect(secondCallArgs?.prompt).toContain(
        '<start_of_turn>user\nHello<end_of_turn>'
      );
      expect(secondCallArgs?.prompt).toContain(
        '<start_of_turn>assistant\nHello! How can I help you?<end_of_turn>'
      );
    });

    it('should clear conversation history', async () => {
      mockInvoke.mockResolvedValueOnce('Hello!');

      await service.processMessage('Hello', mockContext);
      service.clearConversation();

      mockInvoke.mockResolvedValueOnce('How can I help?');
      await service.processMessage('What can you do?', mockContext);

      // Verify that the prompt doesn't contain previous conversation
      const secondCallArgs = mockInvoke.mock.calls[2][1] as { prompt: string };
      expect(secondCallArgs?.prompt).not.toContain(
        '<start_of_turn>user\nHello<end_of_turn>'
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });

      await service.initialize();
      expect(service.isInitialized()).toBe(true);

      mockInvoke.mockResolvedValueOnce('Cleanup successful');
      await service.cleanup();

      expect(service.isInitialized()).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_model');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });

      await service.initialize();

      mockInvoke.mockRejectedValueOnce(new Error('Cleanup failed'));

      // Should not throw error
      await expect(service.cleanup()).resolves.toBeUndefined();
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('pattern analysis', () => {
    it('should return basic pattern analysis', async () => {
      const analysis = await service.analyzePatterns();

      expect(analysis).toEqual({
        userId: 'current-user',
        analysisDate: expect.any(Date),
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
    });
  });

  describe('error handling and recovery', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should handle circuit breaker scenarios', async () => {
      // Simulate repeated failures to trigger circuit breaker
      mockInvoke.mockRejectedValue(new Error('Service unavailable'));

      for (let i = 0; i < 6; i++) {
        try {
          await service.processMessage('Hello', mockContext);
        } catch {
          // Expected to fail
        }
      }

      // Next call should fail immediately due to circuit breaker
      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow();
    });

    it('should retry on recoverable errors', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('Success after retries');
      });

      const result = await service.processMessage('Hello', mockContext);
      expect(result.message).toBe('Success after retries');
      expect(callCount).toBe(3);
    });

    it('should not retry on non-recoverable errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Model not found'));

      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow();

      // Should only be called once (no retries)
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors with proper error types', async () => {
      const uninitializedService = new LocalAIService();
      mockInvoke.mockRejectedValue(new Error('Initialization failed'));

      await expect(uninitializedService.initialize()).rejects.toThrow(
        ModelInitializationError
      );
    });

    it('should handle processing errors with proper error types', async () => {
      mockInvoke.mockRejectedValue(new Error('Generation failed'));

      await expect(
        service.processMessage('Hello', mockContext)
      ).rejects.toThrow(ModelProcessingError);
    });
  });

  describe('tool call parsing', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should parse JSON-style tool calls', async () => {
      const mockResponse =
        'I\'ll help you. {"tool": "create_task", "args": {"title": "Test Task", "priority": 2}}';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage('Create a task', mockContext);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].parameters).toEqual({
        title: 'Test Task',
        priority: 2,
      });
    });

    it('should parse function-style tool calls', async () => {
      const mockResponse =
        'I\'ll start the timer.\ncreate_task(title="Work Task", description="Important work")';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage(
        'Create a work task',
        mockContext
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].parameters).toEqual({
        title: 'Work Task',
        description: 'Important work',
      });
    });

    it('should handle tool calls with complex arguments', async () => {
      const mockResponse =
        'TOOL_CALL: get_tasks(filters={"status": ["pending", "in_progress"]}, limit=10)';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage(
        'Show my active tasks',
        mockContext
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].parameters.filters).toEqual({
        status: ['pending', 'in_progress'],
      });
      expect(result.actions[0].parameters.limit).toBe(10);
    });

    it('should handle malformed tool calls gracefully', async () => {
      const mockResponse =
        'TOOL_CALL: invalid_tool(malformed args without quotes)';
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await service.processMessage('Do something', mockContext);

      // Should not crash, but may not parse the tool call
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });

  describe('resource management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue({
        is_available: true,
        is_loaded: true,
        model_path: '/path/to/model',
      });
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should get resource usage statistics', async () => {
      const mockUsage = {
        memory_usage_mb: 512,
        cpu_usage_percent: 45,
        active_requests: 2,
        queued_requests: 0,
        avg_processing_time_ms: 1500,
        total_requests: 100,
        failed_requests: 5,
        last_updated: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValueOnce(mockUsage);

      const usage = await service.getResourceUsage();
      expect(usage).toEqual(mockUsage);
      expect(mockInvoke).toHaveBeenCalledWith('get_resource_usage');
    });

    it('should get performance recommendations', async () => {
      const mockRecommendations = [
        'Consider reducing context size to improve performance',
        'Close other applications to free memory',
        'Reduce thread count if CPU usage is high',
      ];

      mockInvoke.mockResolvedValueOnce(mockRecommendations);

      const recommendations = await service.getPerformanceRecommendations();

      expect(recommendations).toEqual(mockRecommendations);
      expect(mockInvoke).toHaveBeenCalledWith(
        'get_performance_recommendations'
      );
    });
  });
});
