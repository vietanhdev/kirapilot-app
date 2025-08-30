import { AIResponse, AppContext, PatternAnalysis } from '../../types';
import { TranslationFunction } from './types';

/**
 * Model information interface
 */
export interface ModelInfo {
  name: string;
  type: 'local' | 'cloud';
  status: 'ready' | 'loading' | 'downloading' | 'error' | 'not_initialized';
  capabilities: string[];
  version?: string;
  size?: string;
  contextSize?: number;
}

/**
 * Model status interface for tracking model state
 */
export interface ModelStatus {
  type: 'local' | 'gemini';
  isReady: boolean;
  isLoading: boolean;
  downloadProgress?: number;
  error?: string;
  modelInfo?: ModelInfo;
}

/**
 * AI Service Interface - Abstract interface defining common AI operations
 * This interface allows switching between different AI backends (local, cloud)
 * while maintaining consistent functionality across the application.
 */
export interface AIServiceInterface {
  /**
   * Process a user message and return AI response
   * @param message - User input message
   * @param context - Current application context
   * @returns Promise resolving to AI response
   */
  processMessage(message: string, context: AppContext): Promise<AIResponse>;

  /**
   * Check if the service is initialized and ready to use
   * @returns True if service is ready, false otherwise
   */
  isInitialized(): boolean;

  /**
   * Get information about the current model
   * @returns Model information including type, status, and capabilities
   */
  getModelInfo(): ModelInfo;

  /**
   * Set translation function for localized messages
   * @param fn - Translation function
   */
  setTranslationFunction(fn: TranslationFunction): void;

  /**
   * Clear conversation history
   */
  clearConversation(): void;

  /**
   * Analyze productivity patterns (optional - may not be supported by all models)
   * @returns Promise resolving to pattern analysis or null if not supported
   */
  analyzePatterns?(): Promise<PatternAnalysis>;

  /**
   * Initialize the service (for services that require setup)
   * @returns Promise that resolves when initialization is complete
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources when service is no longer needed
   */
  cleanup?(): void;

  /**
   * Get current service status
   * @returns Current model status
   */
  getStatus(): ModelStatus;
}

/**
 * AI Service Error types for better error handling
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ModelNotAvailableError extends AIServiceError {
  constructor(modelType: string) {
    super(`Model ${modelType} is not available`, 'MODEL_NOT_AVAILABLE', false);
  }
}

export class ModelInitializationError extends AIServiceError {
  constructor(modelType: string, reason: string) {
    super(
      `Failed to initialize ${modelType} model: ${reason}`,
      'MODEL_INITIALIZATION_FAILED',
      true
    );
  }
}

export class ModelProcessingError extends AIServiceError {
  constructor(reason: string) {
    super(
      `Failed to process message: ${reason}`,
      'MODEL_PROCESSING_FAILED',
      true
    );
  }
}
