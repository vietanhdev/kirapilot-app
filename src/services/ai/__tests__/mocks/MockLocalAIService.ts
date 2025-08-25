import {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
} from '../../AIServiceInterface';
import {
  AIResponse,
  AppContext,
  PatternAnalysis,
  AIAction,
} from '../../../../types';
import { TranslationFunction } from '../../ToolExecutionEngine';

/**
 * Mock implementation of LocalAIService for testing
 * Provides predictable responses without requiring actual model loading
 */
export class MockLocalAIService implements AIServiceInterface {
  private _isInitialized = false;
  private _shouldFailInit = false;
  private _shouldFailGeneration = false;
  // private _translationFunction: TranslationFunction | null = null;
  private _conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  constructor(options?: {
    shouldFailInit?: boolean;
    shouldFailGeneration?: boolean;
  }) {
    this._shouldFailInit = options?.shouldFailInit ?? false;
    this._shouldFailGeneration = options?.shouldFailGeneration ?? false;
  }

  async initialize(): Promise<void> {
    if (this._shouldFailInit) {
      throw new Error('Mock initialization failure');
    }
    this._isInitialized = true;
  }

  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    if (!this._isInitialized) {
      throw new Error('Service not initialized');
    }

    if (this._shouldFailGeneration) {
      throw new Error('Mock generation failure');
    }

    // Add to conversation history
    this._conversationHistory.push({ role: 'user', content: message });

    // Generate mock response based on message content
    let responseMessage = '';
    const actions: AIAction[] = [];

    if (
      message.toLowerCase().includes('create') &&
      message.toLowerCase().includes('task')
    ) {
      responseMessage = "I'll create a task for you.";
      actions.push({
        type: 'CREATE_TASK',
        parameters: { title: 'Mock Task' },
        context,
        confidence: 90,
        reasoning: 'User requested task creation',
      });
    } else if (
      message.toLowerCase().includes('start') &&
      message.toLowerCase().includes('timer')
    ) {
      responseMessage = 'Starting the timer now.';
      actions.push({
        type: 'START_TIMER',
        parameters: {},
        context,
        confidence: 95,
        reasoning: 'User requested timer start',
      });
    } else if (
      message.toLowerCase().includes('create') &&
      message.toLowerCase().includes('project')
    ) {
      responseMessage = "I'll create a project task for you.";
      actions.push({
        type: 'CREATE_TASK',
        parameters: { title: 'Project Task' },
        context,
        confidence: 85,
        reasoning: 'User requested project task creation',
      });
    } else {
      responseMessage =
        "I'm a mock AI assistant. I can help you with tasks and time tracking.";
    }

    this._conversationHistory.push({
      role: 'assistant',
      content: responseMessage,
    });

    return {
      message: responseMessage,
      actions,
      suggestions: [],
      context,
      reasoning: 'Mock reasoning',
    };
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  getModelInfo(): ModelInfo {
    return {
      name: 'Mock Local Model',
      type: 'local',
      status: this._isInitialized ? 'ready' : 'not_initialized',
      capabilities: ['text_generation', 'tool_calling', 'offline_operation'],
      version: 'mock-1.0',
      size: '~150MB',
      contextSize: 2048,
    };
  }

  getStatus(): ModelStatus {
    return {
      type: 'local',
      isReady: this._isInitialized,
      isLoading: false,
      error: this._isInitialized ? undefined : 'Not initialized',
      modelInfo: this.getModelInfo(),
    };
  }

  setTranslationFunction(_fn: TranslationFunction): void {
    // this._translationFunction = fn;
  }

  clearConversation(): void {
    this._conversationHistory = [];
  }

  async analyzePatterns(): Promise<PatternAnalysis> {
    return {
      userId: 'mock-user',
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
    };
  }

  // Mock-specific methods for testing
  setInitializationFailure(shouldFail: boolean): void {
    this._shouldFailInit = shouldFail;
  }

  setGenerationFailure(shouldFail: boolean): void {
    this._shouldFailGeneration = shouldFail;
  }

  getConversationHistory(): Array<{
    role: 'user' | 'assistant';
    content: string;
  }> {
    return [...this._conversationHistory];
  }

  reset(): void {
    this._isInitialized = false;
    this._shouldFailInit = false;
    this._shouldFailGeneration = false;
    this._conversationHistory = [];
  }
}
