import { ModelType } from '../../ModelManager';
import {
  AIServiceInterface,
  ModelStatus,
  ModelInfo,
} from '../../AIServiceInterface';
import { AIResponse, AppContext, PatternAnalysis } from '../../../../types';
import { TranslationFunction } from '../../ToolExecutionEngine';
import { MockLocalAIService } from './MockLocalAIService';

/**
 * Mock implementation of ModelManager for testing
 * Provides controlled behavior for testing model switching and management
 */
export class MockModelManager {
  private _currentModelType: ModelType = 'gemini';
  private _services: Map<ModelType, AIServiceInterface> = new Map();
  // private _translationFunction: TranslationFunction | null = null;
  private _shouldFailSwitch = false;
  private _isInitializing = false;

  constructor() {
    // Initialize with mock services
    this._services.set('gemini', new MockGeminiService());
    this._services.set('local', new MockLocalAIService());
  }

  async switchModel(type: ModelType): Promise<void> {
    if (this._isInitializing) {
      throw new Error('Already switching models');
    }

    if (this._shouldFailSwitch) {
      throw new Error('Mock switch failure');
    }

    this._isInitializing = true;

    try {
      const service = this._services.get(type);
      if (!service) {
        throw new Error(`Service ${type} not available`);
      }

      if (service.initialize) {
        await service.initialize();
      }

      this._currentModelType = type;
    } finally {
      this._isInitializing = false;
    }
  }

  getCurrentService(): AIServiceInterface | null {
    return this._services.get(this._currentModelType) || null;
  }

  getCurrentModelType(): ModelType {
    return this._currentModelType;
  }

  getModelStatus(): ModelStatus {
    const service = this.getCurrentService();
    return (
      service?.getStatus() || {
        type: this._currentModelType,
        isReady: false,
        isLoading: this._isInitializing,
        error: 'No service available',
      }
    );
  }

  getModelInfo(): ModelInfo | null {
    const service = this.getCurrentService();
    return service?.getModelInfo() || null;
  }

  isReady(): boolean {
    const service = this.getCurrentService();
    return service?.isInitialized() ?? false;
  }

  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    const service = this.getCurrentService();
    if (!service) {
      throw new Error('No service available');
    }

    if (!service.isInitialized()) {
      throw new Error('Service not initialized');
    }

    return await service.processMessage(message, context);
  }

  setTranslationFunction(fn: TranslationFunction): void {
    // this._translationFunction = fn;
    for (const service of this._services.values()) {
      service.setTranslationFunction(fn);
    }
  }

  clearConversation(): void {
    const service = this.getCurrentService();
    service?.clearConversation();
  }

  async analyzePatterns(): Promise<PatternAnalysis | null> {
    const service = this.getCurrentService();
    if (!service?.analyzePatterns) {
      return null;
    }
    return await service.analyzePatterns();
  }

  getAvailableModels(): ModelType[] {
    return ['gemini', 'local'];
  }

  isModelAvailable(type: ModelType): boolean {
    return this._services.has(type);
  }

  cleanup(): void {
    for (const service of this._services.values()) {
      if ('cleanup' in service && typeof service.cleanup === 'function') {
        service.cleanup();
      }
    }
  }

  // Mock-specific methods for testing
  setSwitchFailure(shouldFail: boolean): void {
    this._shouldFailSwitch = shouldFail;
  }

  getService(type: ModelType): AIServiceInterface | undefined {
    return this._services.get(type);
  }

  reset(): void {
    this._currentModelType = 'gemini';
    this._shouldFailSwitch = false;
    this._isInitializing = false;

    // Reset all services
    for (const service of this._services.values()) {
      if ('reset' in service && typeof service.reset === 'function') {
        (service as unknown as { reset?: () => void }).reset?.();
      }
    }
  }
}

/**
 * Mock Gemini service for testing
 */
class MockGeminiService implements AIServiceInterface {
  private _isInitialized = true;
  // private _translationFunction: TranslationFunction | null = null;

  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    return {
      message: `Gemini response to: ${message}`,
      actions: [],
      suggestions: [],
      context,
      reasoning: 'Gemini reasoning',
    };
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  getModelInfo(): ModelInfo {
    return {
      name: 'Mock Gemini',
      type: 'cloud',
      status: 'ready',
      capabilities: ['text_generation', 'tool_calling'],
      version: '2.0',
      contextSize: 2048,
    };
  }

  getStatus(): ModelStatus {
    return {
      type: 'gemini',
      isReady: this._isInitialized,
      isLoading: false,
    };
  }

  setTranslationFunction(_fn: TranslationFunction): void {
    // this._translationFunction = fn;
  }

  clearConversation(): void {
    // Mock implementation
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
}
