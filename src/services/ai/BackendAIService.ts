import { invoke } from '@tauri-apps/api/core';
import {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
  AIServiceError,
  ModelProcessingError,
} from './AIServiceInterface';
import {
  AIResponse,
  AppContext,
  PatternAnalysis,
  BackendAIRequest,
  BackendAIResponse,
  BackendServiceStatus,
  BackendInteractionLog,
  BackendRetryConfig,
  DistractionLevel,
} from '../../types';

/**
 * Backend AI Service Client
 *
 * This service replaces the current frontend AI services by delegating all
 * AI processing to the Rust backend through Tauri commands. It provides
 * proper TypeScript interfaces, request/response serialization, validation,
 * and connection management with retry logic.
 */
export class BackendAIService implements AIServiceInterface {
  private sessionId: string | null = null;
  private retryConfig: BackendRetryConfig;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private currentModelType: 'local' | 'gemini' = 'gemini';

  constructor(retryConfig?: Partial<BackendRetryConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      ...retryConfig,
    };
  }

  /**
   * Initialize the backend AI service
   */
  async initialize(): Promise<void> {
    try {
      // Wait a bit for the backend to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = await this.getBackendStatus();
      this.isConnected = status.service_ready;
      this.lastError = null;

      console.log(`🔍 [BackendAIService] Backend status:`, status);

      // Set the current model type based on the active provider
      if (
        status.active_provider === 'local' ||
        status.active_provider === 'gemini'
      ) {
        this.currentModelType = status.active_provider;
        console.log(
          `🔍 [BackendAIService] Initialized with active provider: ${this.currentModelType}`
        );
      } else {
        console.warn(
          `⚠️ [BackendAIService] Unknown active provider: ${status.active_provider}, defaulting to gemini`
        );
        this.currentModelType = 'gemini';
      }

      if (!this.isConnected) {
        // Provide detailed information about provider statuses
        const providerInfo = Object.entries(status.providers)
          .map(([name, providerStatus]) => {
            if (typeof providerStatus === 'object' && providerStatus !== null) {
              if ('Unavailable' in providerStatus) {
                const reason =
                  (providerStatus as { Unavailable?: { reason?: string } })
                    .Unavailable?.reason || 'unknown reason';
                return `${name}: unavailable (${reason})`;
              } else if ('Error' in providerStatus) {
                const message =
                  (providerStatus as { Error?: { message?: string } }).Error
                    ?.message || 'unknown error';
                return `${name}: error (${message})`;
              } else if ('Ready' in providerStatus) {
                return `${name}: ready`;
              } else if ('Initializing' in providerStatus) {
                return `${name}: initializing`;
              }
            }
            return `${name}: ${JSON.stringify(providerStatus)}`;
          })
          .join(', ');

        const detailedMessage = `Backend AI service is not ready. Active provider: ${status.active_provider}. Provider statuses: ${providerInfo}. Please configure at least one AI provider (Gemini API key or local model).`;

        throw new AIServiceError(detailedMessage, 'BACKEND_NOT_READY', true);
      }
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw new AIServiceError(
        `Failed to initialize backend AI service: ${this.lastError}`,
        'INITIALIZATION_FAILED',
        true
      );
    }
  }

  /**
   * Check if the service is initialized and ready to use
   */
  isInitialized(): boolean {
    return this.isConnected;
  }

  /**
   * Process a user message and return AI response
   */
  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    if (!this.isConnected) {
      throw new AIServiceError(
        'Backend AI service is not connected',
        'NOT_CONNECTED',
        true
      );
    }

    // Validate input
    if (!message || message.trim().length === 0) {
      throw new AIServiceError(
        'Message cannot be empty',
        'INVALID_INPUT',
        false
      );
    }

    if (message.length > 100000) {
      throw new AIServiceError(
        'Message too long (max 100,000 characters)',
        'MESSAGE_TOO_LONG',
        false
      );
    }

    // Prepare request
    const request: BackendAIRequest = {
      message: message.trim(),
      session_id: this.sessionId || undefined,
      context: this.serializeContext(context),
    };

    // Log raw prompt to console
    console.log('\n=== RAW PROMPT TO MODEL ===');
    console.log('Model Type:', this.currentModelType);
    console.log('Session ID:', this.sessionId || 'new session');
    console.log('Message:', message.trim());
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('Full Request:', JSON.stringify(request, null, 2));
    console.log('=============================\n');

    try {
      // Send request to backend with retry logic
      const response = await this.executeWithRetry(async () => {
        return await invoke<BackendAIResponse>('process_ai_message', {
          request,
        });
      });

      // Log raw response from model
      console.log('\n=== RAW RESPONSE FROM MODEL ===');
      console.log('Model Type:', this.currentModelType);
      console.log('Session ID:', response.session_id);
      console.log('Raw Backend Response:', JSON.stringify(response, null, 2));
      console.log('================================\n');

      // Update session ID
      this.sessionId = response.session_id;

      // Convert backend response to frontend format
      const convertedResponse = this.convertBackendResponse(response);

      // Log converted response
      console.log('\n=== CONVERTED FRONTEND RESPONSE ===');
      console.log('Message:', convertedResponse.message);
      console.log('Actions Count:', convertedResponse.actions.length);
      console.log(
        'Actions:',
        JSON.stringify(convertedResponse.actions, null, 2)
      );
      console.log('Suggestions Count:', convertedResponse.suggestions.length);
      console.log(
        'Full Converted Response:',
        JSON.stringify(convertedResponse, null, 2)
      );
      console.log('====================================\n');

      return convertedResponse;
    } catch (error) {
      this.handleConnectionError(error);
      throw new ModelProcessingError(
        error instanceof Error ? error.message : 'Unknown processing error'
      );
    }
  }

  /**
   * Get information about the current model
   */
  getModelInfo(): ModelInfo {
    // This will be populated after successful initialization or message processing
    // For now, return a placeholder that will be updated by the backend
    return {
      name: 'Backend AI Service',
      type: 'cloud',
      status: this.isConnected ? 'ready' : 'not_initialized',
      capabilities: ['text-generation', 'tool-execution', 'reasoning'],
      contextSize: 4096,
    };
  }

  /**
   * Get current service status
   */
  getStatus(): ModelStatus {
    return {
      type: this.currentModelType,
      isReady: this.isConnected,
      isLoading: false,
      error: this.lastError || undefined,
    };
  }

  /**
   * Get current service status from backend (async version)
   */
  async getStatusFromBackend(): Promise<ModelStatus> {
    try {
      const backendStatus = await this.getBackendStatus();

      // Update local state to match backend
      if (
        backendStatus.active_provider === 'local' ||
        backendStatus.active_provider === 'gemini'
      ) {
        this.currentModelType = backendStatus.active_provider;
      }

      return {
        type: this.currentModelType,
        isReady: backendStatus.service_ready,
        isLoading: false,
        error: backendStatus.service_ready ? undefined : 'Service not ready',
      };
    } catch (error) {
      return {
        type: this.currentModelType,
        isReady: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set translation function for localized messages
   */
  setTranslationFunction(_fn: unknown): void {
    // Translation function not needed in backend service
    // Backend handles localization internally
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.sessionId = null;
    // Also clear backend session if connected
    if (this.isConnected) {
      this.executeWithRetry(async () => {
        await invoke('clear_ai_conversation');
      }).catch(error => {
        console.warn('Failed to clear backend conversation:', error);
      });
    }
  }

  /**
   * Switch to a different AI model/provider
   */
  async switchModel(modelType: 'local' | 'gemini'): Promise<void> {
    console.log(`🔄 [BackendAIService] Switching to ${modelType} model...`);

    // Log model switch details
    console.log('\n=== MODEL SWITCH REQUEST ===');
    console.log('From Model:', this.currentModelType);
    console.log('To Model:', modelType);
    console.log('Timestamp:', new Date().toISOString());
    console.log('============================\n');

    if (!this.isConnected) {
      throw new AIServiceError(
        'Backend AI service is not connected. Cannot switch models.',
        'NOT_CONNECTED',
        true
      );
    }

    // If switching to Gemini, configure the API key first
    if (modelType === 'gemini') {
      try {
        // Get API key from localStorage preferences
        let apiKey: string | null = null;
        try {
          const stored = localStorage.getItem('kirapilot-preferences');
          if (stored) {
            const prefs = JSON.parse(stored);
            apiKey = prefs.aiSettings?.geminiApiKey || null;
          }
        } catch (error) {
          console.warn('Failed to get Gemini API key from preferences:', error);
        }

        if (apiKey) {
          console.log(`🔧 [BackendAIService] Configuring Gemini API key...`);
          await this.executeWithRetry(async () => {
            return await invoke('configure_gemini_provider', { apiKey });
          });
          console.log(`✅ [BackendAIService] Gemini API key configured`);
        } else {
          throw new AIServiceError(
            'Gemini API key is required but not found in preferences',
            'MISSING_API_KEY',
            false
          );
        }
      } catch (error) {
        console.error(
          `❌ [BackendAIService] Failed to configure Gemini API key:`,
          error
        );
        throw error;
      }
    }

    try {
      const result = await this.executeWithRetry(async () => {
        return await invoke('switch_ai_model', { providerName: modelType });
      });

      console.log(`✅ [BackendAIService] Switch command result:`, result);

      // Update the current model type
      this.currentModelType = modelType;

      // Clear current session when switching models
      this.sessionId = null;

      // Log successful model switch
      console.log('\n=== MODEL SWITCH SUCCESS ===');
      console.log('New Active Model:', modelType);
      console.log('Session Reset:', 'Yes');
      console.log('Switch Result:', result);
      console.log('Timestamp:', new Date().toISOString());
      console.log('=============================\n');

      // Verify the switch was successful by checking status
      try {
        const status = await this.getStatus();
        console.log(`🔍 [BackendAIService] Post-switch status:`, status);

        if (!status.isReady) {
          console.warn(
            `⚠️ [BackendAIService] Service not ready after switch:`,
            status.error
          );
        }
      } catch (statusError) {
        console.warn(
          `⚠️ [BackendAIService] Could not verify switch status:`,
          statusError
        );
      }

      console.log(
        `✅ [BackendAIService] Successfully switched to ${modelType} model`
      );
    } catch (error) {
      console.error(
        `❌ [BackendAIService] Failed to switch to ${modelType}:`,
        error
      );
      throw new AIServiceError(
        `Failed to switch to ${modelType} model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MODEL_SWITCH_FAILED',
        true
      );
    }
  }

  /**
   * Get recent interaction logs
   */
  async getInteractionLogs(
    limit: number = 50
  ): Promise<BackendInteractionLog[]> {
    try {
      return await this.executeWithRetry(async () => {
        return await invoke<BackendInteractionLog[]>(
          'get_ai_interaction_logs',
          { limit }
        );
      });
    } catch (error) {
      throw new AIServiceError(
        `Failed to get interaction logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOG_RETRIEVAL_FAILED',
        true
      );
    }
  }

  /**
   * Cleanup resources when service is no longer needed
   */
  cleanup(): void {
    this.sessionId = null;
    this.isConnected = false;
    this.lastError = null;
  }

  /**
   * Analyze productivity patterns (optional implementation)
   */
  async analyzePatterns(): Promise<PatternAnalysis> {
    // This would be implemented when pattern analysis is moved to backend
    throw new AIServiceError(
      'Pattern analysis not yet implemented in backend service',
      'NOT_IMPLEMENTED',
      false
    );
  }

  // Private helper methods

  /**
   * Get backend service status
   */
  private async getBackendStatus(): Promise<BackendServiceStatus> {
    return await invoke<BackendServiceStatus>('get_ai_model_status');
  }

  /**
   * Refresh current model type from backend
   */
  async refreshModelType(): Promise<void> {
    try {
      const status = await this.getBackendStatus();
      if (
        status.active_provider === 'local' ||
        status.active_provider === 'gemini'
      ) {
        this.currentModelType = status.active_provider;
        console.log(
          `🔄 [BackendAIService] Refreshed model type: ${this.currentModelType}`
        );
      }
    } catch (error) {
      console.warn(
        `⚠️ [BackendAIService] Failed to refresh model type:`,
        error
      );
    }
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelayMs *
            Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelayMs
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        console.warn(
          `Backend AI service attempt ${attempt + 1} failed, retrying in ${jitteredDelay}ms:`,
          error
        );
        await this.sleep(jitteredDelay);
      }
    }

    throw lastError || new Error('Unknown error during retry execution');
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Don't retry validation errors, authentication errors, etc.
      return (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('not found') ||
        message.includes('bad request')
      );
    }

    return false;
  }

  /**
   * Handle connection errors and update service state
   */
  private handleConnectionError(error: unknown): void {
    this.isConnected = false;
    this.lastError =
      error instanceof Error ? error.message : 'Connection error';

    console.error('Backend AI service connection error:', error);
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Serialize app context for backend communication
   */
  private serializeContext(context: AppContext): Record<string, unknown> {
    return {
      currentTask: context.currentTask
        ? {
            id: context.currentTask.id,
            title: context.currentTask.title,
            description: context.currentTask.description,
            priority: context.currentTask.priority,
            status: context.currentTask.status,
            taskListId: context.currentTask.taskListId,
          }
        : null,
      activeSession: context.activeSession
        ? {
            id: context.activeSession.id,
            taskId: context.activeSession.taskId,
            isActive: context.activeSession.isActive,
            startTime: context.activeSession.startTime.toISOString(),
          }
        : null,
      activeFocusSession: context.activeFocusSession
        ? {
            id: context.activeFocusSession.id,
            taskId: context.activeFocusSession.taskId,
            plannedDuration: context.activeFocusSession.plannedDuration,
          }
        : null,
      focusMode: context.focusMode,
      timeOfDay: context.timeOfDay,
      dayOfWeek: context.dayOfWeek,
      currentEnergy: context.currentEnergy,
      recentActivity: context.recentActivity.slice(0, 5), // Limit to recent 5 activities
      weeklyPlan: context.weeklyPlan
        ? {
            id: context.weeklyPlan.id,
            weekStart: context.weeklyPlan.weekStart.toISOString(),
            totalPlannedHours: context.weeklyPlan.totalPlannedHours,
            completionRate: context.weeklyPlan.completionRate,
          }
        : null,
      preferences: {
        aiSettings: context.preferences.aiSettings,
        taskSettings: context.preferences.taskSettings,
        workingHours: context.preferences.workingHours,
      },
    };
  }

  /**
   * Convert backend response to frontend AIResponse format
   */
  private convertBackendResponse(
    backendResponse: BackendAIResponse
  ): AIResponse {
    return {
      message: backendResponse.message,
      actions: this.extractActions(backendResponse.metadata),
      suggestions: this.extractSuggestions(backendResponse.metadata),
      context: this.extractUpdatedContext(backendResponse.metadata),
      reasoning: this.extractReasoning(backendResponse.metadata),
    };
  }

  /**
   * Extract reasoning information from backend response metadata
   */
  private extractReasoning(
    metadata: Record<string, unknown>
  ): string | undefined {
    if (metadata.reasoning && typeof metadata.reasoning === 'string') {
      return metadata.reasoning;
    }
    return undefined;
  }

  /**
   * Extract AI actions from backend response metadata
   */
  private extractActions(
    metadata: Record<string, unknown>
  ): import('../../types').AIAction[] {
    if (metadata.actions && Array.isArray(metadata.actions)) {
      return metadata.actions.filter(
        action =>
          action &&
          typeof action === 'object' &&
          'type' in action &&
          'parameters' in action
      );
    }
    return [];
  }

  /**
   * Extract AI suggestions from backend response metadata
   */
  private extractSuggestions(
    metadata: Record<string, unknown>
  ): import('../../types').AISuggestion[] {
    if (metadata.suggestions && Array.isArray(metadata.suggestions)) {
      return metadata.suggestions.filter(
        suggestion =>
          suggestion &&
          typeof suggestion === 'object' &&
          'id' in suggestion &&
          'type' in suggestion &&
          'title' in suggestion
      );
    }
    return [];
  }

  /**
   * Extract updated context from backend response metadata
   */
  private extractUpdatedContext(
    _metadata: Record<string, unknown>
  ): AppContext {
    // Return a minimal context - in a full implementation, this would be
    // constructed from the backend response or maintained in the frontend
    return {
      focusMode: false,
      timeOfDay: new Date().toLocaleTimeString(),
      dayOfWeek: new Date().getDay(),
      currentEnergy: 50,
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
          distractionLevel: DistractionLevel.MODERATE,
          backgroundAudio: {
            type: 'silence' as const,
            volume: 0,
          },
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
          showInteractionLogs: false,
        },
        taskSettings: {
          defaultPriority: 1, // MEDIUM
          autoScheduling: false,
          smartDependencies: false,
          weekStartDay: 1, // Monday
          showCompletedTasks: false,
          compactView: false,
        },
        soundSettings: {
          hapticFeedback: true,
          completionSound: true,
          soundVolume: 50,
        },
        dateFormat: 'DD/MM/YYYY' as const,
        theme: 'auto' as const,
        language: 'en',
      },
    };
  }
}

/**
 * Create and initialize a new BackendAIService instance
 */
export async function createBackendAIService(
  retryConfig?: Partial<BackendRetryConfig>
): Promise<BackendAIService> {
  const service = new BackendAIService(retryConfig);
  await service.initialize();
  return service;
}

/**
 * Singleton instance management
 */
let backendAIServiceInstance: BackendAIService | null = null;

/**
 * Get the singleton BackendAIService instance
 */
export function getBackendAIService(): BackendAIService {
  if (!backendAIServiceInstance) {
    backendAIServiceInstance = new BackendAIService();
  }
  return backendAIServiceInstance;
}

/**
 * Initialize the singleton BackendAIService instance
 */
export async function initializeBackendAIService(
  retryConfig?: Partial<BackendRetryConfig>
): Promise<BackendAIService> {
  if (!backendAIServiceInstance) {
    backendAIServiceInstance = new BackendAIService(retryConfig);
  }

  await backendAIServiceInstance.initialize();
  return backendAIServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBackendAIService(): void {
  if (backendAIServiceInstance) {
    backendAIServiceInstance.cleanup();
    backendAIServiceInstance = null;
  }
}
