import { invoke } from '@tauri-apps/api/core';
import {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
  ModelInitializationError,
  ModelProcessingError,
  AIServiceError,
} from './AIServiceInterface';
import {
  AIResponse,
  AppContext,
  AIAction,
  AISuggestion,
  Priority,
  PatternAnalysis,
} from '../../types';
import {
  ToolExecutionEngine,
  ToolExecutionResult,
  TranslationFunction,
  getToolExecutionEngine,
} from './ToolExecutionEngine';
import {
  ToolResultFormatter,
  FormattedToolResult,
  getToolResultFormatter,
} from './ToolResultFormatter';

/**
 * Local model configuration interface
 */
export interface LocalModelConfig {
  modelName: string;
  modelRepo: string;
  modelFile: string;
  contextSize: number;
  maxTokens: number;
  temperature: number;
  threads: number;
}

/**
 * Generation options for local model
 */
export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
}

/**
 * Model metadata from enhanced model manager
 */
export interface ModelMetadata {
  name: string;
  repo: string;
  filename: string;
  size_bytes: number;
  checksum?: string;
  download_date: string;
  last_used?: string;
  usage_count: number;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  total_bytes: number;
  downloaded_bytes: number;
  percentage: number;
  speed_bytes_per_sec: number;
  eta_seconds?: number;
  status:
    | 'Initializing'
    | 'Downloading'
    | 'Verifying'
    | 'Completed'
    | 'Failed'
    | 'Cancelled';
}

/**
 * Storage information
 */
export interface StorageInfo {
  total_space_bytes: number;
  available_space_bytes: number;
  used_by_models_bytes: number;
  models_directory: string;
}

/**
 * Resource usage statistics
 */
export interface ResourceUsage {
  memory_usage_mb: number;
  cpu_usage_percent: number;
  active_requests: number;
  queued_requests: number;
  avg_processing_time_ms: number;
  total_requests: number;
  failed_requests: number;
  last_updated: string;
}

/**
 * Error recovery configuration
 */
interface ErrorRecoveryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

/**
 * Retry attempt information
 */
interface RetryAttempt {
  attempt: number;
  error: Error;
  timestamp: Date;
  nextRetryDelay?: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

/**
 * Local AI Service implementation using llama-cpp-rs
 * Provides offline AI capabilities while maintaining compatibility with the existing AI service interface
 */
export class LocalAIService implements AIServiceInterface {
  private isModelReady = false;
  private isInitializing = false;
  private _modelPath: string | null = null;
  private toolExecutionEngine: ToolExecutionEngine;
  private resultFormatter: ToolResultFormatter;
  private _translationFunction: TranslationFunction | null = null;
  private conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  // Error handling and recovery
  private errorRecoveryConfig: ErrorRecoveryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
  };

  private circuitBreakerState: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
  };

  private recentErrors: RetryAttempt[] = [];
  private lastSuccessfulOperation?: Date;

  // Default configuration for the local model
  private config: LocalModelConfig = {
    modelName: 'gemma-3-270m-it',
    modelRepo: 'unsloth/gemma-3-270m-it-GGUF',
    modelFile: 'gemma-3-270m-it-Q4_K_M.gguf',
    contextSize: 2048,
    maxTokens: 512,
    temperature: 0.7,
    threads: 4,
  };

  constructor(config?: Partial<LocalModelConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.toolExecutionEngine = getToolExecutionEngine();
    this.resultFormatter = getToolResultFormatter();
  }

  /**
   * Initialize the local model service with comprehensive error handling
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) {
      throw new ModelInitializationError('local', 'Already initializing');
    }

    if (this.isModelReady) {
      return; // Already initialized
    }

    return this.executeWithRetry(
      async () => {
        this.isInitializing = true;

        try {
          console.log('Initializing local AI model...');

          // Check circuit breaker
          if (this.isCircuitBreakerOpen()) {
            throw new AIServiceError(
              'Local model service is temporarily unavailable due to repeated failures',
              'CIRCUIT_BREAKER_OPEN',
              true
            );
          }

          // Check if model is already available
          const status = await this.getModelStatusFromBackend();

          if (status.is_available && status.is_loaded) {
            this.isModelReady = true;
            this._modelPath = status.model_path || null;
            console.log('Local model already loaded and ready');

            // Configure optimal resources and start monitoring
            await this.setupResourceManagement();
            this.recordSuccess();
            return;
          }

          // Download and initialize the model
          await this.downloadModelWithRetry();

          // Initialize the model
          const result = await invoke<string>('initialize_local_model');
          console.log('Model initialization result:', result);

          // Verify the model is ready
          const finalStatus = await this.getModelStatusFromBackend();
          if (!finalStatus.is_loaded) {
            throw new ModelInitializationError(
              'local',
              'Model failed to load after initialization'
            );
          }

          this.isModelReady = true;
          this._modelPath = finalStatus.model_path || null;

          // Configure optimal resources and start monitoring
          await this.setupResourceManagement();

          console.log('Local model initialized successfully');
          this.recordSuccess();
        } catch (error) {
          console.error('Failed to initialize local model:', error);
          this.isModelReady = false;
          this.recordFailure(error as Error);

          throw new ModelInitializationError(
            'local',
            error instanceof Error
              ? error.message
              : 'Unknown initialization error'
          );
        } finally {
          this.isInitializing = false;
        }
      },
      'initialization',
      { maxRetries: 2, baseDelay: 2000 } // Custom config for initialization
    );
  }

  /**
   * Get list of cached models
   */
  async getCachedModels(): Promise<ModelMetadata[]> {
    try {
      return await invoke<ModelMetadata[]>('get_cached_models');
    } catch (error) {
      console.error('Failed to get cached models:', error);
      return [];
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo | null> {
    try {
      return await invoke<StorageInfo>('get_storage_info');
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return null;
    }
  }

  /**
   * Cleanup old models
   */
  async cleanupOldModels(
    maxAgeDays: number = 30,
    maxUnusedModels: number = 3
  ): Promise<string[]> {
    try {
      return await invoke<string[]>('cleanup_old_models', {
        maxAgeDays,
        maxUnusedModels,
      });
    } catch (error) {
      console.error('Failed to cleanup old models:', error);
      return [];
    }
  }

  /**
   * Verify model integrity
   */
  async verifyModelIntegrity(modelPath: string): Promise<boolean> {
    try {
      return await invoke<boolean>('verify_model_integrity', {
        modelPath,
      });
    } catch (error) {
      console.error('Failed to verify model integrity:', error);
      return false;
    }
  }

  /**
   * Get model status from the backend
   */
  private async getModelStatusFromBackend(): Promise<{
    is_available: boolean;
    is_loaded: boolean;
    model_path?: string;
    error_message?: string;
    model_info?: unknown;
  }> {
    try {
      return await invoke('get_model_status');
    } catch (error) {
      console.error('Failed to get model status:', error);
      return {
        is_available: false,
        is_loaded: false,
        model_path: undefined,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a user message using the local model
   */
  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    if (!this.isInitialized()) {
      throw new ModelProcessingError('Local model not initialized');
    }

    try {
      // Format the prompt for the local model
      const prompt = this.formatPrompt(message, context);

      // Generate response using the local model
      const generationOptions: GenerationOptions = {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      };

      const rawResponse = await invoke<string>('generate_text', {
        prompt,
        maxTokens: generationOptions.maxTokens,
        temperature: generationOptions.temperature,
      });

      // Parse the response and extract tool calls
      const parsedResponse = await this.parseResponse(rawResponse, context);

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: parsedResponse.message }
      );

      // Keep conversation history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return parsedResponse;
    } catch (error) {
      console.error('Local model processing error:', error);
      throw new ModelProcessingError(
        error instanceof Error ? error.message : 'Unknown processing error'
      );
    }
  }

  /**
   * Format prompt for the local model using Gemma chat template
   */
  private formatPrompt(message: string, context: AppContext): string {
    const systemPrompt = this.getSystemPrompt(context);

    // Build conversation context
    let conversationContext = '';
    if (this.conversationHistory.length > 0) {
      conversationContext = this.conversationHistory
        .slice(-10) // Keep last 10 exchanges
        .map(
          entry => `<start_of_turn>${entry.role}\n${entry.content}<end_of_turn>`
        )
        .join('\n');
    }

    // Format using Gemma chat template
    const prompt = `<bos><start_of_turn>system
${systemPrompt}<end_of_turn>
${conversationContext}
<start_of_turn>user
${message}<end_of_turn>
<start_of_turn>model
`;

    return prompt;
  }

  /**
   * Get system prompt with current context
   */
  private getSystemPrompt(context: AppContext): string {
    const availableTools = this.toolExecutionEngine.getAvailableTools();

    // Get detailed tool information
    const toolDescriptions = availableTools
      .map(toolName => {
        // Check if getToolInfo method exists before calling it
        const toolInfo =
          typeof this.toolExecutionEngine.getToolInfo === 'function'
            ? this.toolExecutionEngine.getToolInfo(toolName)
            : null;
        return `- ${toolName}: ${toolInfo?.description || 'No description available'}`;
      })
      .join('\n');

    return `You are Kira, an AI assistant for KiraPilot, a productivity application. You help users manage their tasks, track time, and improve productivity.

Your role is to:
1. Help users create, update, and organize tasks
2. Assist with time tracking and timer management
3. Provide productivity insights and suggestions
4. Support weekly planning and scheduling

Available tools:
${toolDescriptions}

Current context:
- Current task: ${context.currentTask ? context.currentTask.title : 'None'}
- Active session: ${context.activeSession ? 'Yes' : 'No'}
- Focus mode: ${context.focusMode ? 'On' : 'Off'}
- Time of day: ${context.timeOfDay}
- Current energy: ${context.currentEnergy}%

Guidelines:
- Always reason through problems step by step
- Use tools when users request specific actions
- Provide clear explanations for your reasoning
- Respect user privacy - all data stays local
- Be helpful, concise, and professional

IMPORTANT: When you need to use a tool, format it exactly as:
TOOL_CALL: tool_name(arg1="value1", arg2="value2")

Examples:
- To create a task: TOOL_CALL: create_task(title="Review project proposal", priority=2)
- To get tasks: TOOL_CALL: get_tasks(filters={"status": ["pending", "in_progress"]})
- To start timer: TOOL_CALL: start_timer(taskId="task-123")

Think through each user request carefully and use the appropriate tools to help them achieve their productivity goals.`;
  }

  /**
   * Parse the model response and extract tool calls
   */
  private async parseResponse(
    response: string,
    context: AppContext
  ): Promise<AIResponse> {
    const actions: AIAction[] = [];
    const suggestions: AISuggestion[] = [];
    let cleanedMessage = response;
    const formattedResults: FormattedToolResult[] = [];

    // Extract tool calls using multiple patterns for better compatibility
    const toolCalls = this.extractToolCalls(response);

    // Process each tool call
    for (const toolCall of toolCalls) {
      try {
        // Validate tool execution
        const validation = this.toolExecutionEngine.validateExecution(
          toolCall.name,
          toolCall.args
        );

        if (!validation.allowed) {
          const errorResult: FormattedToolResult = {
            success: false,
            error: validation.reason,
            userMessage: `❌ ${toolCall.name} failed: ${validation.reason}`,
            formattedMessage: `❌ ${toolCall.name} failed: ${validation.reason}`,
          };
          formattedResults.push(errorResult);
          continue;
        }

        // Execute the tool
        const executionResult = await this.executeTool(
          toolCall.name,
          toolCall.args
        );

        // Format the result
        const formattedResult = this.resultFormatter.format(
          toolCall.name,
          executionResult,
          JSON.parse((executionResult.data as string) || '{}')
        );

        formattedResults.push(formattedResult);

        // Create action record
        actions.push({
          type: toolCall.name.toUpperCase() as AIAction['type'],
          parameters: toolCall.args,
          context,
          confidence: formattedResult.success ? 95 : 0,
          reasoning: `Selected ${toolCall.name} tool based on user request analysis and current context`,
        });

        // Remove tool call from message
        cleanedMessage = cleanedMessage
          .replace(toolCall.originalText, '')
          .trim();
      } catch (error) {
        console.error(`Failed to execute tool ${toolCall.name}:`, error);

        const errorResult: FormattedToolResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          userMessage: `❌ ${toolCall.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          formattedMessage: `❌ ${toolCall.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        formattedResults.push(errorResult);
      }
    }

    // Generate suggestions based on context
    const contextSuggestions = this.generateContextualSuggestions();
    suggestions.push(...contextSuggestions);

    // Clean up the message and integrate tool results
    cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();

    // If we have tool executions, integrate their formatted messages
    if (formattedResults.length > 0) {
      const toolMessages = formattedResults
        .map(result => result.formattedMessage)
        .join('\n\n');

      if (!cleanedMessage.trim()) {
        cleanedMessage = toolMessages;
      } else {
        cleanedMessage = `${cleanedMessage}\n\n${toolMessages}`;
      }
    }

    if (!cleanedMessage) {
      cleanedMessage =
        actions.length > 0
          ? "I've processed your request and executed the appropriate actions."
          : 'I understand your request. How can I help you further?';
    }

    return {
      message: cleanedMessage,
      actions,
      suggestions,
      context,
      reasoning: this.extractReasoning(cleanedMessage),
    };
  }

  /**
   * Extract tool calls from response using multiple patterns
   */
  private extractToolCalls(response: string): Array<{
    name: string;
    args: Record<string, unknown>;
    originalText: string;
  }> {
    const toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      originalText: string;
    }> = [];

    // Pattern 1: TOOL_CALL: tool_name(arg1="value1", arg2="value2")
    const toolCallRegex = /TOOL_CALL:\s*(\w+)\((.*?)\)/g;
    let match;

    while ((match = toolCallRegex.exec(response)) !== null) {
      const toolName = match[1];
      const argsString = match[2];
      const originalText = match[0];

      try {
        const args = this.parseToolArguments(argsString);
        toolCalls.push({
          name: toolName,
          args,
          originalText,
        });
      } catch (error) {
        console.error(`Failed to parse tool call ${toolName}:`, error);
      }
    }

    // Pattern 2: JSON-like tool calls (for better model compatibility)
    const jsonToolRegex =
      /\{[\s]*"tool"[\s]*:[\s]*"(\w+)"[\s]*,[\s]*"args"[\s]*:[\s]*(\{[^}]*\})[\s]*\}/g;

    while ((match = jsonToolRegex.exec(response)) !== null) {
      const toolName = match[1];
      const argsJson = match[2];
      const originalText = match[0];

      try {
        const args = JSON.parse(argsJson);
        toolCalls.push({
          name: toolName,
          args,
          originalText,
        });
      } catch (error) {
        console.error(`Failed to parse JSON tool call ${toolName}:`, error);
      }
    }

    // Pattern 3: Function call style - tool_name(args)
    const functionCallRegex = /(?:^|\n)\s*(\w+)\((.*?)\)(?:\s*$|\s*\n)/g;
    const availableTools = this.toolExecutionEngine.getAvailableTools();

    while ((match = functionCallRegex.exec(response)) !== null) {
      const toolName = match[1];
      const argsString = match[2];
      const originalText = match[0];

      // Only process if it's a known tool
      if (availableTools.includes(toolName)) {
        try {
          const args = this.parseToolArguments(argsString);
          toolCalls.push({
            name: toolName,
            args,
            originalText,
          });
        } catch (error) {
          console.error(`Failed to parse function call ${toolName}:`, error);
        }
      }
    }

    return toolCalls;
  }

  /**
   * Parse tool arguments from string format with multiple patterns
   */
  private parseToolArguments(argsString: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    // Try to parse as JSON first
    try {
      return JSON.parse(argsString);
    } catch {
      // Fall back to key-value parsing
    }

    // Pattern 1: key="value" or key='value'
    const quotedArgRegex = /(\w+)\s*=\s*["']([^"']*?)["']/g;
    let match;

    while ((match = quotedArgRegex.exec(argsString)) !== null) {
      const key = match[1];
      let value: unknown = match[2];

      // Try to parse as JSON for complex values
      try {
        value = JSON.parse(match[2]);
      } catch {
        // Keep as string if not valid JSON
      }

      args[key] = value;
    }

    // Pattern 2: key=value (unquoted)
    const unquotedArgRegex = /(\w+)\s*=\s*([^,\s)]+)/g;

    while ((match = unquotedArgRegex.exec(argsString)) !== null) {
      const key = match[1];
      let value: unknown = match[2];

      // Try to convert to appropriate type
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }

      // Only add if not already present from quoted parsing
      if (!(key in args)) {
        args[key] = value;
      }
    }

    return args;
  }

  /**
   * Execute a tool using a simplified approach for local model
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // For now, simulate tool execution since we don't have actual tool implementations
      // In a full implementation, this would call actual tool functions

      let result:
        | { tasks?: unknown[]; count?: number; error?: string }
        | unknown;
      let userMessage: string;

      switch (toolName) {
        case 'get_tasks':
          result = { tasks: [], count: 0 };
          userMessage = '✅ Retrieved 0 tasks';
          break;
        case 'create_task':
          result = { id: 'task-' + Date.now(), title: args.title };
          userMessage = `✅ Created task: ${args.title}`;
          break;
        case 'update_task':
          result = { id: args.id, updated: true };
          userMessage = `✅ Updated task: ${args.id}`;
          break;
        case 'start_timer':
          result = { sessionId: 'session-' + Date.now(), started: true };
          userMessage = '✅ Timer started';
          break;
        case 'stop_timer':
          result = { stopped: true };
          userMessage = '✅ Timer stopped';
          break;
        default:
          result = { executed: true };
          userMessage = `✅ ${toolName} executed successfully`;
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        userMessage,
        metadata: {
          executionTime,
          toolName,
          permissions: [],
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        userMessage: `❌ ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          executionTime,
          toolName,
          permissions: [],
        },
      };
    }
  }

  /**
   * Generate contextual suggestions
   */
  private generateContextualSuggestions(): AISuggestion[] {
    const suggestions: AISuggestion[] = [];
    const now = new Date();

    // Simple time-based suggestion
    const hour = now.getHours();
    if (hour >= 14 && hour <= 16) {
      suggestions.push({
        id: `afternoon-break-${now.getTime()}`,
        type: 'break',
        title: 'Afternoon Energy Dip',
        description:
          'Consider taking a short break or switching to lighter tasks during the afternoon energy dip.',
        confidence: 70,
        actionable: true,
        priority: Priority.MEDIUM,
        estimatedImpact: 60,
        reasoning:
          'Most people experience lower energy levels in mid-afternoon',
        createdAt: now,
      });
    }

    return suggestions;
  }

  /**
   * Extract reasoning from response text
   */
  private extractReasoning(response: string): string {
    const reasoningWords = [
      'because',
      'since',
      'due to',
      'this is',
      'the reason',
    ];

    for (const word of reasoningWords) {
      const index = response.toLowerCase().indexOf(word);
      if (index !== -1) {
        const sentence = response.substring(index);
        const endIndex =
          sentence.indexOf('.') !== -1
            ? sentence.indexOf('.') + 1
            : Math.min(sentence.length, 100);
        return sentence.substring(0, endIndex);
      }
    }

    return '';
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.isModelReady;
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    return {
      name: this.config.modelName,
      type: 'local',
      status: this.isModelReady
        ? 'ready'
        : this.isInitializing
          ? 'loading'
          : 'not_initialized',
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
      contextSize: this.config.contextSize,
    };
  }

  /**
   * Get current service status
   */
  getStatus(): ModelStatus {
    return {
      type: 'local',
      isReady: this.isModelReady,
      isLoading: this.isInitializing,
      error: this.isModelReady ? undefined : 'Model not initialized',
      modelInfo: this.getModelInfo(),
    };
  }

  /**
   * Set translation function for localized messages
   */
  setTranslationFunction(fn: TranslationFunction): void {
    this._translationFunction = fn;
    this.toolExecutionEngine.setTranslationFunction(fn);
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current model path
   */
  get modelPath(): string | null {
    return this._modelPath;
  }

  /**
   * Get current translation function
   */
  get translationFunction(): TranslationFunction | null {
    return this._translationFunction;
  }

  /**
   * Analyze productivity patterns (basic implementation for local model)
   */
  async analyzePatterns(): Promise<PatternAnalysis> {
    const now = new Date();

    return {
      userId: 'current-user',
      analysisDate: now,
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

  /**
   * Setup resource management for optimal performance
   */
  private async setupResourceManagement(): Promise<void> {
    try {
      // Configure optimal resources based on system capabilities
      await invoke<string>('configure_optimal_resources');
      console.log('Optimal resource configuration applied');

      // Start resource monitoring
      await invoke<string>('start_resource_monitoring');
      console.log('Resource monitoring started');
    } catch (error) {
      console.warn('Failed to setup resource management:', error);
      // Don't throw error as this is not critical for basic functionality
    }
  }

  /**
   * Get current resource usage statistics
   */
  async getResourceUsage(): Promise<ResourceUsage | null> {
    try {
      const usage = await invoke<ResourceUsage | null>('get_resource_usage');
      return usage;
    } catch (error) {
      console.error('Failed to get resource usage:', error);
      return null;
    }
  }

  /**
   * Get performance recommendations
   */
  async getPerformanceRecommendations(): Promise<string[]> {
    try {
      const recommendations = await invoke<string[]>(
        'get_performance_recommendations'
      );
      return recommendations;
    } catch (error) {
      console.error('Failed to get performance recommendations:', error);
      return [];
    }
  }

  /**
   * Update resource configuration
   */
  async updateResourceConfig(config: Partial<LocalModelConfig>): Promise<void> {
    try {
      // Convert LocalModelConfig to ResourceConfig
      const resourceConfig = {
        max_concurrent_requests: 2,
        max_threads: config.threads || this.config.threads,
        max_memory_mb: 0, // Let system manage
        cpu_limit_percent: 80,
        request_timeout_seconds: 30,
        max_queue_size: 10,
        enable_monitoring: true,
      };

      await invoke<string>('update_resource_config', {
        config: resourceConfig,
      });

      // Update local config
      this.config = { ...this.config, ...config };
      console.log('Resource configuration updated successfully');
    } catch (error) {
      console.error('Failed to update resource configuration:', error);
      throw new Error(
        `Failed to update resource configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute operation with retry logic and circuit breaker
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    customConfig?: Partial<ErrorRecoveryConfig>
  ): Promise<T> {
    const config = { ...this.errorRecoveryConfig, ...customConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        // Check circuit breaker before each attempt
        if (config.enableCircuitBreaker && this.isCircuitBreakerOpen()) {
          throw new AIServiceError(
            `Service temporarily unavailable (circuit breaker open)`,
            'CIRCUIT_BREAKER_OPEN',
            true
          );
        }

        const result = await operation();

        // Reset circuit breaker on success
        if (attempt > 1) {
          console.log(`${operationType} succeeded on attempt ${attempt}`);
        }
        this.recordSuccess();

        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(lastError);

        // Don't retry on the last attempt
        if (attempt > config.maxRetries) {
          break;
        }

        // Check if error is recoverable
        if (!this.isRecoverableError(lastError)) {
          console.error(
            `Non-recoverable error in ${operationType}:`,
            lastError
          );
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempt, config);
        console.warn(
          `${operationType} failed (attempt ${attempt}/${config.maxRetries + 1}), retrying in ${delay}ms:`,
          lastError.message
        );

        await this.sleep(delay);
      }
    }

    // All attempts failed
    const errorMessage = `${operationType} failed after ${config.maxRetries + 1} attempts: ${lastError?.message}`;
    console.error(errorMessage);

    throw new AIServiceError(errorMessage, 'MAX_RETRIES_EXCEEDED', true);
  }

  /**
   * Check if an error is recoverable (can be retried)
   */
  private isRecoverableError(error: Error): boolean {
    if (error instanceof AIServiceError) {
      return error.recoverable;
    }

    // Check error message patterns for common recoverable errors
    const errorMessage = error.message.toLowerCase();
    const recoverablePatterns = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'unavailable',
      'busy',
      'overloaded',
      'rate limit',
      'throttled',
    ];

    return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    config: ErrorRecoveryConfig
  ): number {
    const delay =
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, config.maxDelay);
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.lastSuccessfulOperation = new Date();

    // Reset circuit breaker
    this.circuitBreakerState = {
      isOpen: false,
      failureCount: 0,
    };

    // Clear old errors
    this.recentErrors = [];
  }

  /**
   * Record failed operation
   */
  private recordFailure(error: Error): void {
    const attempt: RetryAttempt = {
      attempt: this.recentErrors.length + 1,
      error,
      timestamp: new Date(),
    };

    this.recentErrors.push(attempt);

    // Keep only recent errors (last 10)
    if (this.recentErrors.length > 10) {
      this.recentErrors = this.recentErrors.slice(-10);
    }

    // Update circuit breaker
    if (this.errorRecoveryConfig.enableCircuitBreaker) {
      this.circuitBreakerState.failureCount++;
      this.circuitBreakerState.lastFailureTime = new Date();

      if (
        this.circuitBreakerState.failureCount >=
        this.errorRecoveryConfig.circuitBreakerThreshold
      ) {
        this.circuitBreakerState.isOpen = true;
        this.circuitBreakerState.nextRetryTime = new Date(
          Date.now() + this.errorRecoveryConfig.circuitBreakerTimeout
        );

        console.warn(
          `Circuit breaker opened after ${this.circuitBreakerState.failureCount} failures. Next retry at:`,
          this.circuitBreakerState.nextRetryTime
        );
      }
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (
      !this.errorRecoveryConfig.enableCircuitBreaker ||
      !this.circuitBreakerState.isOpen
    ) {
      return false;
    }

    // Check if timeout has passed
    if (
      this.circuitBreakerState.nextRetryTime &&
      new Date() >= this.circuitBreakerState.nextRetryTime
    ) {
      console.log('Circuit breaker timeout expired, allowing retry attempt');
      this.circuitBreakerState.isOpen = false;
      this.circuitBreakerState.failureCount = Math.max(
        0,
        this.circuitBreakerState.failureCount - 1
      );
      return false;
    }

    return true;
  }

  /**
   * Download model with retry logic
   */
  private async downloadModelWithRetry(): Promise<void> {
    return this.executeWithRetry(
      async () => {
        try {
          console.log(
            `Downloading model ${this.config.modelFile} from ${this.config.modelRepo}...`
          );

          // Try enhanced download first
          try {
            const result = await invoke<string>(
              'download_model_with_progress',
              {
                repo: this.config.modelRepo,
                filename: this.config.modelFile,
              }
            );
            console.log('Enhanced model download result:', result);
            return;
          } catch (enhancedError) {
            console.warn(
              'Enhanced download failed, falling back to legacy method:',
              enhancedError
            );
          }

          // Fallback to legacy download
          const result = await invoke<string>('download_model', {
            repo: this.config.modelRepo,
            model: this.config.modelFile,
          });

          console.log('Legacy model download result:', result);
        } catch (error) {
          console.error('Failed to download model:', error);
          throw new ModelInitializationError(
            'local',
            `Model download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
      'model download',
      { maxRetries: 5, baseDelay: 2000, maxDelay: 60000 } // More retries for downloads
    );
  }

  /**
   * Get detailed error information for debugging
   */
  getErrorDiagnostics(): {
    recentErrors: RetryAttempt[];
    circuitBreakerState: CircuitBreakerState;
    lastSuccessfulOperation?: Date;
    isHealthy: boolean;
  } {
    const now = new Date();
    const recentFailures = this.recentErrors.filter(
      error => now.getTime() - error.timestamp.getTime() < 300000 // Last 5 minutes
    );

    return {
      recentErrors: this.recentErrors,
      circuitBreakerState: this.circuitBreakerState,
      lastSuccessfulOperation: this.lastSuccessfulOperation,
      isHealthy:
        recentFailures.length === 0 && !this.circuitBreakerState.isOpen,
    };
  }

  /**
   * Get user-friendly error guidance
   */
  getErrorGuidance(): string[] {
    const diagnostics = this.getErrorDiagnostics();
    const guidance: string[] = [];

    if (diagnostics.circuitBreakerState.isOpen) {
      guidance.push(
        'The local AI model is temporarily unavailable due to repeated failures.'
      );
      guidance.push('The system will automatically retry in a few minutes.');
      guidance.push(
        'Consider switching to the cloud model for immediate assistance.'
      );
    } else if (diagnostics.recentErrors.length > 0) {
      const lastError =
        diagnostics.recentErrors[diagnostics.recentErrors.length - 1];
      const errorMessage = lastError.error.message.toLowerCase();

      if (
        errorMessage.includes('network') ||
        errorMessage.includes('download')
      ) {
        guidance.push('Network connectivity issues detected.');
        guidance.push('Check your internet connection and try again.');
      } else if (
        errorMessage.includes('memory') ||
        errorMessage.includes('resource')
      ) {
        guidance.push('System resource constraints detected.');
        guidance.push('Close other applications to free up memory.');
        guidance.push('Consider using the cloud model for better performance.');
      } else if (
        errorMessage.includes('model') ||
        errorMessage.includes('load')
      ) {
        guidance.push('Model loading issues detected.');
        guidance.push('Try restarting the application.');
        guidance.push('The model file may need to be re-downloaded.');
      } else {
        guidance.push('Temporary issues with the local AI model.');
        guidance.push('Try again in a few moments.');
        guidance.push('Switch to cloud model if issues persist.');
      }
    }

    if (guidance.length === 0) {
      guidance.push('Local AI model is operating normally.');
    }

    return guidance;
  }

  /**
   * Utility method for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isModelReady) {
        // Cleanup resources first
        await invoke('cleanup_resources');

        // Then cleanup the model
        await invoke('cleanup_model');
        console.log('Local model cleaned up successfully');
      }
    } catch (error) {
      console.error('Failed to cleanup local model:', error);
    } finally {
      this.isModelReady = false;
      this._modelPath = null;
      this.conversationHistory = [];

      // Reset error tracking
      this.recentErrors = [];
      this.circuitBreakerState = {
        isOpen: false,
        failureCount: 0,
      };
    }
  }
}

// Singleton instance
let localAIServiceInstance: LocalAIService | null = null;

/**
 * Get LocalAIService singleton instance
 */
export function getLocalAIService(): LocalAIService {
  if (!localAIServiceInstance) {
    localAIServiceInstance = new LocalAIService();
  }
  return localAIServiceInstance;
}

/**
 * Initialize LocalAIService with custom configuration
 */
export async function initializeLocalAIService(
  config?: Partial<LocalModelConfig>
): Promise<LocalAIService> {
  if (!localAIServiceInstance) {
    localAIServiceInstance = new LocalAIService(config);
  }

  await localAIServiceInstance.initialize();
  return localAIServiceInstance;
}
