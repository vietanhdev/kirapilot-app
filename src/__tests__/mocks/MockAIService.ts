import {
  AIResponse,
  AIAction,
  AISuggestion,
  AppContext,
  PatternAnalysis,
  Priority,
  DistractionLevel,
} from '../../types';
import { MockAIConfig } from '../setup/testUtils';
import { PermissionLevel } from '../../services/ai/types';

export class MockAIService {
  private responses: Map<string, AIResponse> = new Map();
  private config: MockAIConfig;
  private conversationHistory: Array<{ input: string; response: AIResponse }> =
    [];
  private toolPermissions: string[] = [];
  private initialized = false;

  constructor(config: MockAIConfig = {}) {
    this.config = {
      simulateDelay: 0,
      simulateErrors: false,
      responses: new Map(),
      ...config,
    };

    // Initialize with default responses
    this.setupDefaultResponses();

    // Add any custom responses from config
    if (this.config.responses) {
      this.config.responses.forEach((response, input) => {
        this.responses.set(input, response as AIResponse);
      });
    }

    // Set default tool permissions
    this.toolPermissions = [
      'get_tasks',
      'create_task',
      'update_task',
      'start_timer',
      'stop_timer',
      'get_time_data',
      'analyze_productivity',
    ];

    // Initialize by default for testing
    this.initialized = true;
  }

  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    await this.simulateDelay();
    this.throwIfError();

    if (!this.initialized) {
      throw new Error(
        'AI service not initialized. Please provide a valid API key.'
      );
    }

    // Check for exact match first
    let response = this.responses.get(message);

    // If no exact match, try pattern matching
    if (!response) {
      response = this.findPatternMatch(message);
    }

    // If still no match, use default response
    if (!response) {
      response = this.getDefaultResponse(message, context);
    }

    // Ensure context is included in response
    response = {
      ...response,
      context,
    };

    // Store in conversation history
    this.conversationHistory.push({ input: message, response });

    return response;
  }

  // Legacy method for backward compatibility
  async sendMessage(
    message: string,
    context?: AppContext
  ): Promise<AIResponse> {
    const defaultContext: AppContext = {
      currentTask: undefined,
      activeSession: undefined,
      activeFocusSession: undefined,
      focusMode: false,
      timeOfDay: new Date().toTimeString().slice(0, 5),
      dayOfWeek: new Date().getDay(),
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

    return this.processMessage(message, context || defaultContext);
  }

  async executeAction(action: AIAction): Promise<unknown> {
    await this.simulateDelay();
    this.throwIfError();

    // Mock action execution based on action type
    switch (action.type) {
      case 'CREATE_TASK':
        return {
          success: true,
          taskId: `mock-task-${Date.now()}`,
          message: 'Task created successfully',
        };

      case 'UPDATE_TASK':
        return {
          success: true,
          message: 'Task updated successfully',
        };

      case 'START_TIMER':
        return {
          success: true,
          sessionId: `mock-session-${Date.now()}`,
          message: 'Timer started',
        };

      case 'STOP_TIMER':
        return {
          success: true,
          message: 'Timer stopped',
        };

      case 'SCHEDULE_FOCUS':
        return {
          success: true,
          focusSessionId: `mock-focus-${Date.now()}`,
          message: 'Focus session scheduled',
        };

      case 'TAKE_BREAK':
        return {
          success: true,
          message: 'Break initiated',
        };

      case 'ANALYZE_PRODUCTIVITY':
        return {
          success: true,
          analysis: {
            productivityScore: 85,
            focusTime: 120,
            completedTasks: 5,
            suggestions: ['Take more breaks', 'Focus on high-priority tasks'],
          },
        };

      case 'SUGGEST_SCHEDULE':
        return {
          success: true,
          schedule: [
            { time: '09:00', task: 'High priority task', duration: 60 },
            { time: '10:30', task: 'Break', duration: 15 },
            { time: '10:45', task: 'Medium priority task', duration: 45 },
          ],
        };

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  }

  async getSuggestions(context?: AppContext): Promise<AISuggestion[]> {
    await this.simulateDelay();
    this.throwIfError();

    // Return mock suggestions based on context
    const suggestions: AISuggestion[] = [
      {
        id: `suggestion-${Date.now()}-1`,
        type: 'task',
        title: 'Break down large task',
        description:
          'Consider breaking your current task into smaller, manageable subtasks',
        confidence: 85,
        actionable: true,
        priority: 1,
        estimatedImpact: 75,
        reasoning: 'Large tasks can be overwhelming and reduce productivity',
        actions: [
          {
            type: 'CREATE_TASK',
            parameters: { parentTaskId: context?.currentTask?.id },
            context: context || ({} as AppContext),
            confidence: 85,
          },
        ],
        createdAt: new Date(),
      },
      {
        id: `suggestion-${Date.now()}-2`,
        type: 'break',
        title: 'Take a short break',
        description:
          "You've been working for a while. A 5-minute break could help refresh your focus",
        confidence: 70,
        actionable: true,
        priority: 0,
        estimatedImpact: 60,
        reasoning:
          'Regular breaks improve sustained attention and prevent burnout',
        actions: [
          {
            type: 'TAKE_BREAK',
            parameters: { duration: 5 },
            context: context || ({} as AppContext),
            confidence: 70,
          },
        ],
        createdAt: new Date(),
      },
    ];

    return suggestions;
  }

  // Configuration methods
  setResponse(input: string, response: AIResponse): void {
    this.responses.set(input, response);
  }

  setResponsePattern(pattern: RegExp, response: AIResponse): void {
    this.responses.set(pattern.toString(), response);
  }

  setSimulateDelay(ms: number): void {
    this.config.simulateDelay = ms;
  }

  setSimulateError(shouldError: boolean): void {
    this.config.simulateErrors = shouldError;
  }

  simulateError(shouldError: boolean): void {
    this.setSimulateError(shouldError);
  }

  setFailureMode(shouldFail: boolean): void {
    this.setSimulateError(shouldFail);
  }

  reset(): void {
    this.responses.clear();
    this.conversationHistory = [];
    this.setupDefaultResponses();
  }

  // Get conversation history for testing
  getConversationHistory(): Array<{ input: string; response: AIResponse }> {
    return [...this.conversationHistory];
  }

  // AI Service interface methods
  setApiKey(_apiKey: string): void {
    this.initialized = true;
  }

  setTranslationFunction(
    _translationFunction: (
      key: string,
      variables?: Record<string, string | number>
    ) => string
  ): void {
    // Mock implementation - translation function is stored but not used in mock
  }

  setToolPermissions(permissions: PermissionLevel[]): void {
    // Update available tools based on permissions
    this.toolPermissions = [];

    if (
      permissions.includes(PermissionLevel.READ_ONLY) ||
      permissions.includes(PermissionLevel.FULL_ACCESS)
    ) {
      this.toolPermissions.push(
        'get_tasks',
        'get_time_data',
        'analyze_productivity'
      );
    }

    if (
      permissions.includes(PermissionLevel.MODIFY_TASKS) ||
      permissions.includes(PermissionLevel.FULL_ACCESS)
    ) {
      this.toolPermissions.push('create_task', 'update_task');
    }

    if (
      permissions.includes(PermissionLevel.TIMER_CONTROL) ||
      permissions.includes(PermissionLevel.FULL_ACCESS)
    ) {
      this.toolPermissions.push('start_timer', 'stop_timer');
    }
  }

  getAvailableTools(): string[] {
    return [...this.toolPermissions];
  }

  toolRequiresConfirmation(toolName: string): boolean {
    // Mock implementation - only destructive actions require confirmation
    const confirmationRequired = ['update_task', 'create_task'];
    return confirmationRequired.includes(toolName);
  }

  getToolInfo(toolName: string):
    | {
        description: string;
        requiredPermissions: PermissionLevel[];
        requiresConfirmation: boolean;
      }
    | undefined {
    const toolInfoMap: Record<
      string,
      {
        description: string;
        requiredPermissions: PermissionLevel[];
        requiresConfirmation: boolean;
      }
    > = {
      get_tasks: {
        description: 'Retrieve and search tasks',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
      },
      create_task: {
        description: 'Create new tasks',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
      },
      update_task: {
        description: 'Update existing tasks',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
      },
      start_timer: {
        description: 'Start timer for tasks',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
      },
      stop_timer: {
        description: 'Stop active timer',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
      },
      get_time_data: {
        description: 'Retrieve time tracking data',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
      },
      analyze_productivity: {
        description: 'Analyze productivity patterns',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
      },
    };

    return toolInfoMap[toolName];
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  clearConversation(): void {
    this.conversationHistory = [];
  }

  async analyzePatterns(): Promise<PatternAnalysis> {
    await this.simulateDelay();
    this.throwIfError();

    const now = new Date();

    return {
      userId: 'mock-user',
      analysisDate: now,
      productivityPatterns: [
        {
          id: 'pattern-1',
          userId: 'mock-user',
          patternType: 'daily',
          timeSlots: [
            { start: '09:00', end: '11:00', dayOfWeek: 1 },
            { start: '14:00', end: '16:00', dayOfWeek: 1 },
          ],
          productivity: 85,
          confidence: 90,
          sampleSize: 20,
          lastUpdated: now,
        },
      ],
      energyPatterns: [
        {
          timeSlot: { start: '09:00', end: '11:00', dayOfWeek: 1 },
          averageEnergy: 85,
          confidence: 90,
          sampleSize: 15,
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          type: 'schedule',
          title: 'Optimize morning productivity',
          description:
            'Schedule your most important tasks between 9-11 AM when your energy is highest',
          confidence: 85,
          actionable: true,
          priority: Priority.HIGH,
          estimatedImpact: 80,
          reasoning:
            'Analysis shows consistently high productivity during morning hours',
          createdAt: now,
        },
      ],
      insights: {
        mostProductiveTime: { start: '09:00', end: '11:00', dayOfWeek: 1 },
        leastProductiveTime: { start: '14:00', end: '16:00', dayOfWeek: 5 },
        averageTaskDuration: 45,
        completionRate: 0.75,
        focusEfficiency: 0.82,
      },
    };
  }

  // Mock-specific methods for testing
  simulateToolExecution(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return this.executeAction({
      type: toolName.toUpperCase() as AIAction['type'],
      parameters: args,
      context: {} as AppContext,
      confidence: 90,
    });
  }

  setMockResponse(input: string, response: AIResponse): void {
    this.setResponse(input, response);
  }

  setMockPatternResponse(pattern: RegExp, response: AIResponse): void {
    this.setResponsePattern(pattern, response);
  }

  getMockConversationHistory(): Array<{ input: string; response: AIResponse }> {
    return this.getConversationHistory();
  }

  resetMockState(): void {
    this.reset();
  }

  // Private helper methods
  private setupDefaultResponses(): void {
    this.responses.set('hello', {
      message: 'Hello! How can I help you with your tasks today?',
      actions: [],
      suggestions: [],
      context: {} as AppContext,
    });

    this.responses.set('help', {
      message:
        'I can help you manage tasks, track time, schedule focus sessions, and analyze your productivity. What would you like to do?',
      actions: [],
      suggestions: [],
      context: {} as AppContext,
    });

    this.responses.set('create task', {
      message:
        "I'll help you create a new task. What would you like to work on?",
      actions: [
        {
          type: 'CREATE_TASK',
          parameters: {},
          context: {} as AppContext,
          confidence: 90,
        },
      ],
      suggestions: [],
      context: {} as AppContext,
    });

    this.responses.set('start timer', {
      message: 'Starting the timer for your current task.',
      actions: [
        {
          type: 'START_TIMER',
          parameters: {},
          context: {} as AppContext,
          confidence: 95,
        },
      ],
      suggestions: [],
      context: {} as AppContext,
    });
  }

  private findPatternMatch(message: string): AIResponse | undefined {
    const lowerMessage = message.toLowerCase();

    // Pattern matching for common phrases
    if (lowerMessage.includes('create') && lowerMessage.includes('task')) {
      return this.responses.get('create task');
    }

    if (lowerMessage.includes('start') && lowerMessage.includes('timer')) {
      return this.responses.get('start timer');
    }

    if (lowerMessage.includes('help')) {
      return this.responses.get('help');
    }

    return undefined;
  }

  private getDefaultResponse(
    message: string,
    context?: AppContext
  ): AIResponse {
    return {
      message: `I received your message: "${message}". This is a mock response for testing.`,
      actions: [],
      suggestions: [],
      context: context || ({} as AppContext),
      reasoning: 'This is a default mock response',
    };
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.simulateDelay && this.config.simulateDelay > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, this.config.simulateDelay)
      );
    }
  }

  private throwIfError(): void {
    if (this.config.simulateErrors) {
      throw new Error('Mock AI service error');
    }
  }
}
