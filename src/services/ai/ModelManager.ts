import {
  AIServiceInterface,
  ModelStatus,
  ModelInfo,
  AIServiceError,
  ModelInitializationError,
} from './AIServiceInterface';
import { ReactAIService } from './ReactAIService';
import { TranslationFunction } from './ToolExecutionEngine';
import { AIResponse, AppContext, PatternAnalysis } from '../../types';
import {
  LoggingInterceptor,
  getLoggingInterceptor,
} from './LoggingInterceptor';

/**
 * Model type enumeration
 */
export type ModelType = 'gemini';

/**
 * Model configuration interface
 */
export interface ModelConfig {
  type: ModelType;
  apiKey?: string;
  localModelPath?: string;
  options?: Record<string, unknown>;
}

/**
 * Model Manager - Handles switching between different AI services
 * Provides a unified interface for managing local and cloud AI models
 */
export class ModelManager {
  private currentService: AIServiceInterface | null = null;
  private modelType: ModelType = 'gemini';
  private services: Map<ModelType, AIServiceInterface> = new Map();
  private translationFunction: TranslationFunction | null = null;
  private loggingInterceptor: LoggingInterceptor | null = null;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  private currentSessionId: string | null = null;

  constructor() {
    // Initialize logging interceptor if available
    try {
      this.loggingInterceptor = getLoggingInterceptor();
    } catch {
      // Logging interceptor not initialized yet
      this.loggingInterceptor = null;
    }

    // Initialize with Gemini service by default
    this.initializeGeminiService();
  }

  /**
   * Initialize Gemini service
   */
  private initializeGeminiService(): void {
    try {
      const geminiService = new ReactAIService();
      if (this.translationFunction) {
        geminiService.setTranslationFunction(this.translationFunction);
      }
      if (this.loggingInterceptor) {
        geminiService.setLoggingInterceptor(this.loggingInterceptor);
      }
      this.services.set('gemini', geminiService);

      // Set as current service if none is set
      if (!this.currentService) {
        this.currentService = geminiService;
        this.modelType = 'gemini';
      }
    } catch (error) {
      console.error('Failed to initialize Gemini service:', error);
      // Log service initialization error
      this.logServiceError('gemini', 'initialization', error as Error);
    }
  }

  /**
   * Switch to a different model type
   * @param type - Model type to switch to
   * @param config - Optional configuration for the model
   */
  async switchModel(type: ModelType, config?: ModelConfig): Promise<void> {
    if (this.isInitializing) {
      // Wait for current initialization to complete
      if (this.initializationPromise) {
        await this.initializationPromise;
      }
    }

    // Background initialization is not needed for Gemini-only setup
    // TODO: Remove this when local model support is fully removed

    this.isInitializing = true;
    this.initializationPromise = this._switchModel(type, config);

    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Internal method to handle model switching
   */
  private async _switchModel(
    type: ModelType,
    config?: ModelConfig
  ): Promise<void> {
    try {
      let service = this.services.get(type);

      if (!service) {
        // Initialize the service if it doesn't exist
        if (type === 'gemini') {
          this.initializeGeminiService();
          service = this.services.get('gemini');
        }

        if (!service) {
          throw new ModelInitializationError(type, 'Service creation failed');
        }
      }

      // Configure the service if config is provided
      if (config) {
        if (config.apiKey && 'setApiKey' in service) {
          (service as ReactAIService).setApiKey(config.apiKey);
        }
      }

      // Initialize the service if it has an initialize method
      if (service.initialize) {
        await service.initialize();
      }

      // Verify the service is ready
      if (!service.isInitialized()) {
        throw new ModelInitializationError(
          type,
          'Service failed to initialize'
        );
      }

      // Set translation function if available
      if (this.translationFunction) {
        service.setTranslationFunction(this.translationFunction);
      }

      // Set logging interceptor if available
      if (this.loggingInterceptor) {
        if ('setLoggingInterceptor' in service) {
          (service as ReactAIService).setLoggingInterceptor(
            this.loggingInterceptor
          );
        }
      }

      // Start new session when switching services to maintain session consistency
      if (this.loggingInterceptor) {
        this.currentSessionId = this.loggingInterceptor.startNewSession();
      }

      // Switch to the new service
      this.currentService = service;
      this.modelType = type;
    } catch (error) {
      console.error(`Failed to switch to ${type} model:`, error);
      // Log service switching error
      this.logServiceError(type, 'switching', error as Error);

      // If switching fails and we don't have a current service, fall back to Gemini
      if (!this.currentService) {
        try {
          this.initializeGeminiService();
          const geminiService = this.services.get('gemini');
          if (geminiService && geminiService.isInitialized()) {
            this.currentService = geminiService;
            this.modelType = 'gemini';
          }
        } catch (fallbackError) {
          console.error('Fallback to Gemini also failed:', fallbackError);
          // Log fallback error
          this.logServiceError('gemini', 'fallback', fallbackError as Error);
        }
      }

      throw error;
    }
  }

  /**
   * Get the current AI service
   * @returns Current AI service or null if none is available
   */
  getCurrentService(): AIServiceInterface | null {
    return this.currentService;
  }

  /**
   * Get the current model type
   * @returns Current model type
   */
  getCurrentModelType(): ModelType {
    return this.modelType;
  }

  /**
   * Get model status for the current service
   * @returns Model status information
   */
  getModelStatus(): ModelStatus {
    if (!this.currentService) {
      return {
        type: this.modelType,
        isReady: false,
        isLoading: false,
        error: 'No service available',
      };
    }

    return this.currentService.getStatus();
  }

  /**
   * Get model information for the current service
   * @returns Model information
   */
  getModelInfo(): ModelInfo | null {
    if (!this.currentService) {
      return null;
    }

    return this.currentService.getModelInfo();
  }

  /**
   * Check if any service is initialized and ready
   * @returns True if a service is ready, false otherwise
   */
  isReady(): boolean {
    return this.currentService?.isInitialized() ?? false;
  }

  /**
   * Process a message using the current service with automatic fallback
   * @param message - User message
   * @param context - Application context
   * @returns AI response
   */
  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    if (!this.currentService) {
      throw new AIServiceError('No AI service available', 'NO_SERVICE', false);
    }

    if (!this.currentService.isInitialized()) {
      throw new AIServiceError(
        'AI service not initialized',
        'SERVICE_NOT_INITIALIZED',
        true
      );
    }

    try {
      const response = await this.currentService.processMessage(
        message,
        context
      );

      return response;
    } catch (error) {
      console.error(
        'Error processing message with',
        this.modelType,
        'service:',
        error
      );

      // If error is already an AIServiceError, re-throw it
      if (error instanceof AIServiceError) {
        throw error;
      }

      throw new AIServiceError(
        `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVICE_ERROR',
        true
      );
    }
  }

  /**
   * Set translation function for all services
   * @param fn - Translation function
   */
  setTranslationFunction(fn: TranslationFunction): void {
    this.translationFunction = fn;

    // Apply to all existing services
    for (const service of this.services.values()) {
      service.setTranslationFunction(fn);
    }
  }

  /**
   * Set logging interceptor for all services
   * @param interceptor - Logging interceptor instance
   */
  setLoggingInterceptor(interceptor: LoggingInterceptor): void {
    this.loggingInterceptor = interceptor;

    // Apply to all existing services
    for (const service of this.services.values()) {
      if ('setLoggingInterceptor' in service) {
        (service as ReactAIService).setLoggingInterceptor(interceptor);
      }
    }

    // Start new session
    this.currentSessionId = interceptor.startNewSession();
  }

  /**
   * Get current session ID
   * @returns Current session ID or null if logging is not enabled
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Start a new logging session
   * @returns New session ID or null if logging is not enabled
   */
  startNewSession(): string | null {
    if (this.loggingInterceptor) {
      this.currentSessionId = this.loggingInterceptor.startNewSession();
      return this.currentSessionId;
    }
    return null;
  }

  /**
   * Log service errors for debugging and monitoring
   * @param modelType - Type of model that encountered the error
   * @param operation - Operation that failed (initialization, switching, fallback)
   * @param error - Error that occurred
   */
  private logServiceError(
    modelType: ModelType,
    operation: string,
    error: Error
  ): void {
    // This could be enhanced to use a proper logging service
    // For now, we'll use console logging with structured information
    console.error(`ModelManager ${operation} error:`, {
      modelType,
      operation,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
    });

    // If we have a logging interceptor, we could potentially log this as a system event
    // This would require extending the logging system to handle system events
  }

  /**
   * Clear conversation for the current service
   */
  clearConversation(): void {
    this.currentService?.clearConversation();
  }

  /**
   * Analyze patterns using the current service
   * @returns Pattern analysis or null if not supported
   */
  async analyzePatterns(): Promise<PatternAnalysis | null> {
    if (!this.currentService?.analyzePatterns) {
      return null;
    }

    return await this.currentService.analyzePatterns();
  }

  /**
   * Get available model types
   * @returns Array of available model types
   */
  getAvailableModels(): ModelType[] {
    return ['gemini'];
  }

  /**
   * Check if a specific model type is available
   * @param type - Model type to check
   * @returns True if model is available, false otherwise
   */
  isModelAvailable(type: ModelType): boolean {
    return this.getAvailableModels().includes(type);
  }

  /**
   * Auto-load local model in background (for test compatibility)
   * @param _config - Model configuration (unused)
   * @returns Promise that resolves when auto-loading is complete
   */
  async autoLoadLocalModel(_config: ModelConfig): Promise<void> {
    // This method is kept for test compatibility but doesn't do anything
    // since we only support Gemini in the current implementation
    return Promise.resolve();
  }

  /**
   * Preload service manually (for test compatibility)
   * @param _type - Model type to preload (unused)
   * @returns Promise that resolves when preloading is complete
   */
  async preloadServiceManually(_type: ModelType): Promise<void> {
    // This method is kept for test compatibility but doesn't do anything
    // since we only support Gemini in the current implementation
    return Promise.resolve();
  }

  /**
   * Get preloading status (for test compatibility)
   * @returns Object with preloading status for each model type
   */
  getPreloadingStatus(): Record<string, boolean> {
    return {
      local: false,
      gemini: false,
    };
  }

  /**
   * Check if a model is currently preloading (for test compatibility)
   * @param _type - Model type to check (unused)
   * @returns True if preloading, false otherwise
   */
  isPreloading(_type: ModelType): boolean {
    return false;
  }

  /**
   * Cleanup all services and resources
   */
  cleanup(): void {
    for (const service of this.services.values()) {
      if (service.cleanup) {
        service.cleanup();
      }
    }
    this.services.clear();
    this.currentService = null;
  }
}

// Singleton instance
let modelManagerInstance: ModelManager | null = null;

/**
 * Get ModelManager singleton instance
 * @returns ModelManager instance
 */
export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }
  return modelManagerInstance;
}

/**
 * Initialize ModelManager with specific configuration
 * @param config - Initial model configuration
 * @returns ModelManager instance
 */
export async function initializeModelManager(
  config?: ModelConfig
): Promise<ModelManager> {
  const manager = getModelManager();

  if (config) {
    await manager.switchModel(config.type, config);
  }

  return manager;
}
