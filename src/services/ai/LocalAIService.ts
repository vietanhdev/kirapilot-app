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
import { ToolRegistry, getToolRegistry } from './ToolRegistry';
import {
  ToolExecutionBridge,
  getToolExecutionBridge,
} from './ToolExecutionBridge';
import {
  ToolExecutionErrorHandler,
  ErrorRecoveryContext,
  getToolExecutionErrorHandler,
} from './ToolExecutionErrorHandler';
import {
  LoggingInterceptor,
  initializeLoggingInterceptor,
  RequestContext,
  ResponseMetadata,
} from './LoggingInterceptor';
import { getLogStorageRepository } from '../database/repositories';
import { LoggingConfigService } from '../database/repositories/LoggingConfigService';

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
  private downloadProgress: number | undefined = undefined;
  private initializationStatus: string = 'not_started';
  private toolExecutionEngine: ToolExecutionEngine;
  private resultFormatter: ToolResultFormatter;
  private toolRegistry: ToolRegistry;
  private toolExecutionBridge: ToolExecutionBridge;
  private errorHandler: ToolExecutionErrorHandler;
  private loggingInterceptor: LoggingInterceptor | null = null;
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
    contextSize: 8192, // Matches the Rust service context size
    maxTokens: 1024,
    temperature: 0.7,
    threads: 4,
  };

  constructor(config?: Partial<LocalModelConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.toolExecutionEngine = getToolExecutionEngine();
    this.resultFormatter = getToolResultFormatter();
    this.toolRegistry = getToolRegistry();
    this.toolExecutionBridge = getToolExecutionBridge();
    this.errorHandler = getToolExecutionErrorHandler();

    // Initialize logging interceptor
    this.initializeLogging();
  }

  /**
   * Initialize logging interceptor with database services
   */
  private initializeLogging(): void {
    try {
      const logStorageService = getLogStorageRepository();
      const configService = new LoggingConfigService();
      this.loggingInterceptor = initializeLoggingInterceptor(
        logStorageService,
        configService
      );
    } catch (error) {
      console.warn('Failed to initialize logging interceptor:', error);
      // Continue without logging - silent degradation
      this.loggingInterceptor = null;
    }
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
          this.initializationStatus = 'checking_availability';

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
            this.initializationStatus = 'ready';

            // Configure optimal resources and start monitoring
            await this.setupResourceManagement();
            this.recordSuccess();
            return;
          }

          // Download and initialize the model
          this.initializationStatus = 'downloading';
          await this.downloadModelWithRetry();

          // Initialize the model
          this.initializationStatus = 'initializing';
          await invoke<string>('initialize_local_model');

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
          this.initializationStatus = 'ready';
          this.downloadProgress = undefined; // Clear progress when complete

          // Configure optimal resources and start monitoring
          await this.setupResourceManagement();
          this.recordSuccess();
        } catch (error) {
          console.error('Failed to initialize local model:', error);
          this.isModelReady = false;
          this.initializationStatus = 'failed';
          this.downloadProgress = undefined;
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

    const startTime = Date.now();
    let requestId: string | null = null;

    try {
      // Intercept request for logging
      if (this.loggingInterceptor) {
        requestId = await this.loggingInterceptor.interceptRequest(
          this,
          message,
          context
        );
      }

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

      // Calculate performance metrics
      const responseTime = Date.now() - startTime;
      const tokenCount = this.estimateTokenCount(rawResponse);

      // Intercept response for logging
      if (this.loggingInterceptor && requestId) {
        const responseMetadata: ResponseMetadata = {
          responseTime,
          tokenCount,
          modelInfo: this.getModelInfo(),
          sessionId: this.loggingInterceptor.getCurrentSessionId(),
          timestamp: new Date(),
        };

        await this.loggingInterceptor.interceptResponse(
          requestId,
          parsedResponse,
          responseMetadata
        );
      }

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: parsedResponse.message }
      );

      // Keep conversation history manageable
      this.autoTruncateHistory();

      return parsedResponse;
    } catch (error) {
      console.error('Local model processing error:', error);

      // Intercept error for logging
      if (this.loggingInterceptor && requestId) {
        const requestContext: RequestContext = {
          message,
          context,
          sessionId: this.loggingInterceptor.getCurrentSessionId(),
          timestamp: new Date(startTime),
          modelInfo: this.getModelInfo(),
        };

        await this.loggingInterceptor.interceptError(
          requestId,
          error instanceof Error ? error : new Error(String(error)),
          requestContext
        );
      }

      // Provide better error handling for prompt length issues
      if (
        error instanceof Error &&
        error.message.includes('Prompt is too long')
      ) {
        throw new ModelProcessingError(
          'The conversation has grown too long for the local model. Try starting a new conversation or clearing the chat history for better performance.'
        );
      }

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

    // Build conversation context with dynamic truncation
    let conversationContext = '';
    if (this.conversationHistory.length > 0) {
      // Start with fewer history items and expand if space allows
      const historyToUse = Math.min(this.conversationHistory.length, 6);

      conversationContext = this.conversationHistory
        .slice(-historyToUse)
        .map(
          entry => `<start_of_turn>${entry.role}\n${entry.content}<end_of_turn>`
        )
        .join('\n');
    }

    // Format using Gemma chat template
    let prompt = `<bos><start_of_turn>system
${systemPrompt}<end_of_turn>
${conversationContext}
<start_of_turn>user
${message}<end_of_turn>
<start_of_turn>model
`;

    // Check and truncate if prompt is too long
    // Rough token estimation: ~4 characters per token for English text
    const estimatedTokens = Math.ceil(prompt.length / 4);
    const maxPromptTokens =
      this.config.contextSize - this.config.maxTokens - 100; // Reserve space for response + safety margin

    if (estimatedTokens > maxPromptTokens) {
      console.warn(
        `Prompt too long (${estimatedTokens} estimated tokens), truncating...`
      );

      // Try with less conversation history first
      if (this.conversationHistory.length > 2) {
        conversationContext = this.conversationHistory
          .slice(-2) // Keep only last 2 exchanges
          .map(
            entry =>
              `<start_of_turn>${entry.role}\n${entry.content}<end_of_turn>`
          )
          .join('\n');

        prompt = `<bos><start_of_turn>system
${systemPrompt}<end_of_turn>
${conversationContext}
<start_of_turn>user
${message}<end_of_turn>
<start_of_turn>model
`;
      }

      // If still too long, use minimal system prompt
      const reestimatedTokens = Math.ceil(prompt.length / 4);
      if (reestimatedTokens > maxPromptTokens) {
        const minimalSystemPrompt = this.getMinimalSystemPrompt(context);

        prompt = `<bos><start_of_turn>system
${minimalSystemPrompt}<end_of_turn>
<start_of_turn>user
${message}<end_of_turn>
<start_of_turn>model
`;
      }
    }

    return prompt;
  }

  /**
   * Get system prompt with current context
   */
  private getSystemPrompt(context: AppContext): string {
    const availableTools = this.toolRegistry.getAvailableTools();

    // Get detailed tool information from registry schemas
    const toolDescriptions = availableTools
      .map(toolName => {
        const toolInfo = this.toolRegistry.getToolInfo(toolName);
        if (toolInfo) {
          // Include parameter information for better tool usage
          const paramInfo = Object.entries(toolInfo.parameters)
            .map(([name, param]) => `${name}: ${param.description}`)
            .join(', ');
          return `- ${toolName}: ${toolInfo.description}${paramInfo ? ` (${paramInfo})` : ''}`;
        }
        return `- ${toolName}: No description available`;
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

CRITICAL: You MUST use tools for any task management actions. When you need to use a tool, format it EXACTLY as shown:

TOOL_CALL: tool_name(arg1="value1", arg2="value2")

REQUIRED EXAMPLES - Use these exact formats:
- Create task: TOOL_CALL: create_task(title="Review project proposal", priority=2)
- Get tasks: TOOL_CALL: get_tasks(filters={"status": ["pending", "in_progress"]})
- Update task: TOOL_CALL: update_task(taskId="task-123", updates={"status": "completed"})
- Start timer: TOOL_CALL: start_timer(taskId="task-123")
- Stop timer: TOOL_CALL: stop_timer(sessionId="session-456", notes="Completed review")

ALWAYS use tools for:
- Creating, updating, or retrieving tasks
- Starting or stopping timers
- Getting time data or productivity analysis

Format: First explain what you'll do, then use the TOOL_CALL on a new line.

ALWAYS use tools for:
- Creating, updating, or retrieving tasks
- Starting or stopping timers
- Getting time data or productivity analysis

Format: First explain what you'll do, then use the TOOL_CALL on a new line.`;
  }

  /**
   * Get minimal system prompt for when full prompt is too long
   */
  private getMinimalSystemPrompt(context: AppContext): string {
    const availableTools = this.toolRegistry.getAvailableTools().slice(0, 5); // Limit to first 5 tools

    const toolList = availableTools.join(', ');

    return `You are Kira, an AI assistant for KiraPilot productivity app.

Available tools: ${toolList}

Current context:
- Task: ${context.currentTask ? context.currentTask.title : 'None'}
- Focus: ${context.focusMode ? 'On' : 'Off'}

MUST use TOOL_CALL: tool_name(args) format for any task/timer actions.
Example: TOOL_CALL: create_task(title="New task", priority=1)
Be helpful and always use tools for task management.`;
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
        let parsedData: Record<string, unknown>;
        try {
          if (typeof executionResult.data === 'string') {
            parsedData = JSON.parse(executionResult.data || '{}');
          } else {
            parsedData =
              (executionResult.data as Record<string, unknown>) || {};
          }
        } catch {
          parsedData = {};
        }

        const formattedResult = this.resultFormatter.format(
          toolCall.name,
          executionResult,
          parsedData
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
    const availableTools = this.toolRegistry.getAvailableTools();

    while ((match = functionCallRegex.exec(response)) !== null) {
      const toolName = match[1];
      const argsString = match[2];
      const originalText = match[0];

      // Only process if it's a known tool in the registry
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
   * Execute a tool using the tool registry with enhanced error handling
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Use the tool registry to execute the actual tool
      const result = await this.toolRegistry.executeTool(toolName, args);

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Update execution time in metadata
      if (result.metadata) {
        result.metadata.executionTime = executionTime;
      }

      // Log tool execution if logging is enabled
      if (this.loggingInterceptor) {
        // Note: We don't have the interaction log ID here, so we'll log it separately
        // This will be handled by the LoggingInterceptor when processing the full response
        try {
          await this.loggingInterceptor.logToolExecution(
            'pending', // Will be updated when the full interaction is logged
            toolName,
            args,
            result,
            executionTime
          );
        } catch (logError) {
          // Silent degradation for logging errors
          console.warn('Failed to log tool execution:', logError);
        }
      }

      return result;
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);

      // Create error recovery context
      const context: ErrorRecoveryContext = {
        toolName,
        arguments: args,
        permissions: [], // Will be populated by the error handler
        attempt: 1,
        maxAttempts: 3,
        previousErrors: [],
      };

      // Use the error handler to process the error and provide recovery strategies
      const result = await this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );

      // Log failed tool execution if logging is enabled
      if (this.loggingInterceptor) {
        const executionTime = Date.now() - startTime;
        try {
          await this.loggingInterceptor.logToolExecution(
            'pending', // Will be updated when the full interaction is logged
            toolName,
            args,
            result,
            executionTime
          );
        } catch (logError) {
          // Silent degradation for logging errors
          console.warn('Failed to log failed tool execution:', logError);
        }
      }

      return result;
    }
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is a simplified approach - actual tokenization would be more accurate
    return Math.ceil(text.length / 4);
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
    let error: string | undefined;

    if (!this.isModelReady && !this.isInitializing) {
      if (this.initializationStatus === 'failed') {
        error = 'Model initialization failed';
      } else {
        error = 'Model not initialized';
      }
    } else if (this.isInitializing) {
      error = undefined; // No error when initializing
    }

    return {
      type: 'local',
      isReady: this.isModelReady,
      isLoading: this.isInitializing,
      error,
      modelInfo: this.getModelInfo(),
      downloadProgress: this.downloadProgress,
    };
  }

  /**
   * Set translation function for localized messages
   */
  setTranslationFunction(fn: TranslationFunction): void {
    this._translationFunction = fn;
    this.toolExecutionEngine.setTranslationFunction(fn);
    this.toolRegistry.setTranslationFunction(fn);
    this.toolExecutionBridge.setTranslationFunction(fn);
    this.errorHandler.setTranslationFunction(fn);
  }

  /**
   * Set logging interceptor for AI interaction logging
   */
  setLoggingInterceptor(interceptor: LoggingInterceptor): void {
    this.loggingInterceptor = interceptor;
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Auto-truncate conversation history when it gets too long
   */
  private autoTruncateHistory(): void {
    const maxHistoryItems = 10;
    if (this.conversationHistory.length > maxHistoryItems) {
      this.conversationHistory =
        this.conversationHistory.slice(-maxHistoryItems);
    }
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

      // Start resource monitoring
      await invoke<string>('start_resource_monitoring');
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
   * Download model with retry logic and progress tracking
   */
  private async downloadModelWithRetry(): Promise<void> {
    return this.executeWithRetry(
      async () => {
        try {
          // Check if model is already downloaded
          const cachedModels = await this.getCachedModels();
          const targetModel = cachedModels.find(
            model =>
              model.repo === this.config.modelRepo &&
              model.filename === this.config.modelFile
          );

          if (targetModel) {
            this.downloadProgress = 100;
            return;
          }

          // Start download with progress tracking
          this.downloadProgress = 0;

          // Start a progress monitoring interval
          const progressInterval = setInterval(async () => {
            try {
              // Try to get download progress from backend
              const progress = await this.getDownloadProgress();
              if (progress) {
                this.downloadProgress = progress.percentage;
              }
            } catch {
              // Ignore progress errors
            }
          }, 1000);

          try {
            // Try enhanced download first
            try {
              await invoke<string>('download_model_with_progress', {
                repo: this.config.modelRepo,
                filename: this.config.modelFile,
              });
              this.downloadProgress = 100;
              return;
            } catch (enhancedError) {
              console.warn(
                'Enhanced download failed, falling back to legacy method:',
                enhancedError
              );
            }

            // Fallback to legacy download
            await invoke<string>('download_model', {
              repo: this.config.modelRepo,
              model: this.config.modelFile,
            });
            this.downloadProgress = 100;
          } finally {
            clearInterval(progressInterval);
          }
        } catch (error) {
          console.error('Failed to download model:', error);
          this.downloadProgress = undefined; // Clear progress on failure
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
   * Get download progress from backend
   */
  private async getDownloadProgress(): Promise<DownloadProgress | null> {
    try {
      return await invoke<DownloadProgress>('get_download_progress');
    } catch {
      // Progress tracking is optional, don't throw
      return null;
    }
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
