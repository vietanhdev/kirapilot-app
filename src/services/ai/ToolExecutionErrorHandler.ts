import {
  ToolExecutionResult,
  PermissionLevel,
  TranslationFunction,
} from './ToolExecutionEngine';
import { ToolRegistryError } from './ToolRegistry';
import { ToolExecutionBridgeError } from './ToolExecutionBridge';
import { AIServiceError } from './AIServiceInterface';

/**
 * Error categories for tool execution
 */
export enum ToolExecutionErrorType {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Tool execution error with detailed context
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public type: ToolExecutionErrorType,
    public toolName?: string,
    public originalError?: Error,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error recovery strategy configuration
 */
export interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  shouldRetry: (error: ToolExecutionError, attempt: number) => boolean;
  fallbackAction?: (error: ToolExecutionError) => Promise<ToolExecutionResult>;
}

/**
 * Error recovery context
 */
export interface ErrorRecoveryContext {
  toolName: string;
  arguments: Record<string, unknown>;
  permissions: PermissionLevel[];
  attempt: number;
  maxAttempts: number;
  previousErrors: ToolExecutionError[];
}

/**
 * Alternative tool suggestion
 */
export interface AlternativeToolSuggestion {
  toolName: string;
  description: string;
  confidence: number;
  requiredPermissions: PermissionLevel[];
}

/**
 * Comprehensive error handler for tool execution
 * Provides error recovery strategies, user guidance, and fallback mechanisms
 */
export class ToolExecutionErrorHandler {
  private recoveryStrategies: Map<
    ToolExecutionErrorType,
    ErrorRecoveryStrategy
  > = new Map();
  // @ts-ignore - Translation function kept for future internationalization
  private _translationFunction: TranslationFunction;

  constructor(translationFunction?: TranslationFunction) {
    // Default translation function that returns the key if no translation function is provided
    // Currently unused but kept for future internationalization
    this._translationFunction = translationFunction || ((key: string) => key);
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize error recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    // Tool not found - no retry, suggest alternatives
    this.recoveryStrategies.set(ToolExecutionErrorType.TOOL_NOT_FOUND, {
      maxRetries: 0,
      retryDelay: 0,
      backoffMultiplier: 1,
      shouldRetry: () => false,
      fallbackAction: async error =>
        this.suggestAlternativeTools(error.toolName || ''),
    });

    // Permission denied - no retry, request elevation
    this.recoveryStrategies.set(ToolExecutionErrorType.PERMISSION_DENIED, {
      maxRetries: 0,
      retryDelay: 0,
      backoffMultiplier: 1,
      shouldRetry: () => false,
      fallbackAction: async error => this.requestPermissionElevation(error),
    });

    // Validation error - no retry, provide guidance
    this.recoveryStrategies.set(ToolExecutionErrorType.VALIDATION_ERROR, {
      maxRetries: 0,
      retryDelay: 0,
      backoffMultiplier: 1,
      shouldRetry: () => false,
      fallbackAction: async error => this.provideValidationGuidance(error),
    });

    // Execution error - retry with exponential backoff
    this.recoveryStrategies.set(ToolExecutionErrorType.EXECUTION_ERROR, {
      maxRetries: 2,
      retryDelay: 1000,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) =>
        attempt < 3 && this.isRetryableExecutionError(error),
    });

    // Database error - retry with backoff
    this.recoveryStrategies.set(ToolExecutionErrorType.DATABASE_ERROR, {
      maxRetries: 3,
      retryDelay: 500,
      backoffMultiplier: 1.5,
      shouldRetry: (error, attempt) =>
        attempt < 4 && this.isRetryableDatabaseError(error),
      fallbackAction: async error => this.handleDatabaseErrorFallback(error),
    });

    // Network error - retry with longer delays
    this.recoveryStrategies.set(ToolExecutionErrorType.NETWORK_ERROR, {
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) =>
        attempt < 4 && this.isRetryableNetworkError(error),
    });

    // Timeout error - retry with increased timeout
    this.recoveryStrategies.set(ToolExecutionErrorType.TIMEOUT_ERROR, {
      maxRetries: 2,
      retryDelay: 1000,
      backoffMultiplier: 1.5,
      shouldRetry: (_error, attempt) => attempt < 3,
    });

    // Resource error - retry after delay
    this.recoveryStrategies.set(ToolExecutionErrorType.RESOURCE_ERROR, {
      maxRetries: 2,
      retryDelay: 3000,
      backoffMultiplier: 1.5,
      shouldRetry: (error, attempt) =>
        attempt < 3 && this.isRetryableResourceError(error),
    });

    // Unknown error - single retry
    this.recoveryStrategies.set(ToolExecutionErrorType.UNKNOWN_ERROR, {
      maxRetries: 1,
      retryDelay: 1000,
      backoffMultiplier: 1,
      shouldRetry: (_error, attempt) => attempt < 2,
    });
  }

  /**
   * Handle tool execution error with recovery strategies
   */
  async handleError(
    error: Error | ToolExecutionError,
    context?: ErrorRecoveryContext
  ): Promise<ToolExecutionResult> {
    const toolError = this.normalizeError(error, context?.toolName);
    const errorType = toolError.type;

    try {
      // Get recovery strategy for this error type
      const strategy = this.recoveryStrategies.get(errorType);
      if (!strategy) {
        return this.createGenericErrorResult(toolError, context);
      }

      // Check if we should retry
      if (context && strategy.shouldRetry(toolError, context.attempt)) {
        return this.createRetryResult(toolError, strategy, context);
      }

      // Try fallback action if available
      if (strategy.fallbackAction) {
        try {
          return await strategy.fallbackAction(toolError);
        } catch (fallbackError) {
          console.error('Fallback action failed:', fallbackError);
          // Continue to create error result
        }
      }

      // Create appropriate error result based on type
      return this.createErrorResult(toolError, context);
    } catch (handlingError) {
      console.error('Error in error handler:', handlingError);
      return this.createGenericErrorResult(toolError, context);
    }
  }

  /**
   * Normalize different error types to ToolExecutionError
   */
  private normalizeError(
    error: Error | ToolExecutionError,
    toolName?: string
  ): ToolExecutionError {
    if (error instanceof ToolExecutionError) {
      return error;
    }

    // Map specific error types
    if (error instanceof ToolRegistryError) {
      switch (error.code) {
        case 'TOOL_NOT_FOUND':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.TOOL_NOT_FOUND,
            error.toolName || toolName,
            error
          );
        case 'INVALID_ARGUMENTS':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.VALIDATION_ERROR,
            error.toolName || toolName,
            error
          );
        case 'INSUFFICIENT_PERMISSIONS':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.PERMISSION_DENIED,
            error.toolName || toolName,
            error
          );
        default:
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.EXECUTION_ERROR,
            error.toolName || toolName,
            error
          );
      }
    }

    if (error instanceof ToolExecutionBridgeError) {
      switch (error.code) {
        case 'FORMAT_ERROR':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.VALIDATION_ERROR,
            error.toolName || toolName,
            error
          );
        default:
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.EXECUTION_ERROR,
            error.toolName || toolName,
            error
          );
      }
    }

    if (error instanceof AIServiceError) {
      switch (error.code) {
        case 'CIRCUIT_BREAKER_OPEN':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.RESOURCE_ERROR,
            toolName,
            error
          );
        case 'MODEL_NOT_AVAILABLE':
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.RESOURCE_ERROR,
            toolName,
            error
          );
        default:
          return new ToolExecutionError(
            error.message,
            ToolExecutionErrorType.EXECUTION_ERROR,
            toolName,
            error
          );
      }
    }

    // Check error message for common patterns
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return new ToolExecutionError(
        error.message,
        ToolExecutionErrorType.TIMEOUT_ERROR,
        toolName,
        error
      );
    }

    if (
      message.includes('database') ||
      message.includes('sql') ||
      message.includes('sqlite')
    ) {
      return new ToolExecutionError(
        error.message,
        ToolExecutionErrorType.DATABASE_ERROR,
        toolName,
        error
      );
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('fetch')
    ) {
      return new ToolExecutionError(
        error.message,
        ToolExecutionErrorType.NETWORK_ERROR,
        toolName,
        error
      );
    }

    if (
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return new ToolExecutionError(
        error.message,
        ToolExecutionErrorType.PERMISSION_DENIED,
        toolName,
        error
      );
    }

    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return new ToolExecutionError(
        error.message,
        ToolExecutionErrorType.VALIDATION_ERROR,
        toolName,
        error
      );
    }

    // Default to unknown error
    return new ToolExecutionError(
      error.message,
      ToolExecutionErrorType.UNKNOWN_ERROR,
      toolName,
      error
    );
  }

  /**
   * Create error result based on error type
   */
  private createErrorResult(
    error: ToolExecutionError,
    context?: ErrorRecoveryContext
  ): ToolExecutionResult {
    const toolName = error.toolName || context?.toolName || 'unknown';

    switch (error.type) {
      case ToolExecutionErrorType.TOOL_NOT_FOUND:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatToolNotFoundMessage(toolName),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.PERMISSION_DENIED:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatPermissionDeniedMessage(toolName, error),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.VALIDATION_ERROR:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatValidationErrorMessage(toolName, error),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.DATABASE_ERROR:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatDatabaseErrorMessage(toolName),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.NETWORK_ERROR:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatNetworkErrorMessage(toolName),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.TIMEOUT_ERROR:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatTimeoutErrorMessage(toolName),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      case ToolExecutionErrorType.RESOURCE_ERROR:
        return {
          success: false,
          error: error.message,
          userMessage: this.formatResourceErrorMessage(toolName),
          metadata: {
            executionTime: 0,
            toolName,
            permissions: context?.permissions || [],
          },
        };

      default:
        return this.createGenericErrorResult(error, context);
    }
  }

  /**
   * Create retry result with delay information
   */
  private createRetryResult(
    error: ToolExecutionError,
    strategy: ErrorRecoveryStrategy,
    context: ErrorRecoveryContext
  ): ToolExecutionResult {
    const delay =
      strategy.retryDelay *
      Math.pow(strategy.backoffMultiplier, context.attempt - 1);
    const toolName = error.toolName || context.toolName;

    return {
      success: false,
      error: error.message,
      userMessage: this.formatRetryMessage(toolName, context.attempt, delay),
      requiresConfirmation: false,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: context.permissions,
        retryAfter: delay,
        attempt: context.attempt,
        maxAttempts: context.maxAttempts,
      },
    };
  }

  /**
   * Create generic error result for unknown errors
   */
  private createGenericErrorResult(
    error: ToolExecutionError,
    context?: ErrorRecoveryContext
  ): ToolExecutionResult {
    const toolName = error.toolName || context?.toolName || 'unknown';

    return {
      success: false,
      error: error.message,
      userMessage: `❌ ${this.getToolDisplayName(toolName)} failed: ${error.message}`,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: context?.permissions || [],
      },
    };
  }

  /**
   * Suggest alternative tools when tool is not found
   */
  private async suggestAlternativeTools(
    toolName: string
  ): Promise<ToolExecutionResult> {
    const suggestions = this.getAlternativeToolSuggestions(toolName);

    let message = `❌ Tool "${toolName}" not found.\n\n`;

    if (suggestions.length > 0) {
      message += `💡 **Did you mean one of these?**\n`;
      suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. **${suggestion.toolName}** - ${suggestion.description}\n`;
      });
    } else {
      message += `💡 **Available tools:** create_task, update_task, get_tasks, start_timer, stop_timer, get_time_data, analyze_productivity`;
    }

    return {
      success: false,
      error: `Tool "${toolName}" not found`,
      userMessage: message,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: [],
        suggestions,
      },
    };
  }

  /**
   * Request permission elevation
   */
  private async requestPermissionElevation(
    error: ToolExecutionError
  ): Promise<ToolExecutionResult> {
    const toolName = error.toolName || 'unknown';
    const message =
      `🔒 **Permission Required**\n\n` +
      `The tool "${this.getToolDisplayName(toolName)}" requires additional permissions.\n\n` +
      `**Required permissions:** ${this.formatPermissions(this.extractRequiredPermissions(error))}\n\n` +
      `Please check your settings or contact an administrator to grant the necessary permissions.`;

    return {
      success: false,
      error: error.message,
      userMessage: message,
      requiresConfirmation: false,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: [],
        requiredPermissions: this.extractRequiredPermissions(error),
      },
    };
  }

  /**
   * Provide validation guidance
   */
  private async provideValidationGuidance(
    error: ToolExecutionError
  ): Promise<ToolExecutionResult> {
    const toolName = error.toolName || 'unknown';
    const guidance = this.generateValidationGuidance(toolName, error.message);

    const message =
      `⚠️ **Invalid Input**\n\n` +
      `${error.message}\n\n` +
      `**How to fix:**\n${guidance}`;

    return {
      success: false,
      error: error.message,
      userMessage: message,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: [],
      },
    };
  }

  /**
   * Handle database error fallback
   */
  private async handleDatabaseErrorFallback(
    error: ToolExecutionError
  ): Promise<ToolExecutionResult> {
    const toolName = error.toolName || 'unknown';

    const message =
      `💾 **Database Issue**\n\n` +
      `There was a problem accessing the database. This might be temporary.\n\n` +
      `**What you can try:**\n` +
      `• Wait a moment and try again\n` +
      `• Check if the application has sufficient disk space\n` +
      `• Restart the application if the problem persists`;

    return {
      success: false,
      error: error.message,
      userMessage: message,
      metadata: {
        executionTime: 0,
        toolName,
        permissions: [],
      },
    };
  }

  /**
   * Get alternative tool suggestions based on similarity
   */
  private getAlternativeToolSuggestions(
    toolName: string
  ): AlternativeToolSuggestion[] {
    const availableTools = [
      {
        name: 'create_task',
        keywords: ['create', 'add', 'new', 'make', 'task'],
      },
      {
        name: 'update_task',
        keywords: ['update', 'edit', 'modify', 'change', 'task'],
      },
      { name: 'get_tasks', keywords: ['get', 'list', 'show', 'find', 'tasks'] },
      { name: 'start_timer', keywords: ['start', 'begin', 'timer', 'time'] },
      { name: 'stop_timer', keywords: ['stop', 'end', 'finish', 'timer'] },
      { name: 'get_time_data', keywords: ['time', 'data', 'stats', 'report'] },
      {
        name: 'analyze_productivity',
        keywords: ['analyze', 'analysis', 'productivity', 'insights'],
      },
    ];

    const suggestions: AlternativeToolSuggestion[] = [];
    const lowerToolName = toolName.toLowerCase();

    for (const tool of availableTools) {
      let confidence = 0;

      // Check for exact matches in keywords
      for (const keyword of tool.keywords) {
        if (
          lowerToolName.includes(keyword) ||
          keyword.includes(lowerToolName)
        ) {
          confidence += 20;
        }
      }

      // Check for similar tool name structure
      if (
        tool.name.includes(lowerToolName) ||
        lowerToolName.includes(tool.name.split('_')[0])
      ) {
        confidence += 30;
      }

      if (confidence > 0) {
        suggestions.push({
          toolName: tool.name,
          description: this.getToolDescription(tool.name),
          confidence,
          requiredPermissions: this.getToolPermissions(tool.name),
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Generate validation guidance based on tool and error
   */
  private generateValidationGuidance(
    toolName: string,
    errorMessage: string
  ): string {
    const lowerError = errorMessage.toLowerCase();

    // Tool-specific guidance
    switch (toolName) {
      case 'create_task':
        if (lowerError.includes('title')) {
          return '• Provide a task title (e.g., "Review project proposal")\n• Make sure the title is not empty';
        }
        if (lowerError.includes('priority')) {
          return '• Use priority values: 0 (Low), 1 (Medium), 2 (High), 3 (Urgent)';
        }
        break;

      case 'update_task':
        if (lowerError.includes('taskid')) {
          return '• Provide a valid task ID\n• You can get task IDs using the get_tasks tool';
        }
        break;

      case 'start_timer':
        if (lowerError.includes('taskid')) {
          return '• Provide a valid task ID to start timing\n• Use get_tasks to find the task ID';
        }
        break;

      case 'get_time_data':
        if (lowerError.includes('date')) {
          return '• Use ISO date format (YYYY-MM-DD)\n• Example: "2024-01-15"';
        }
        break;
    }

    // Generic guidance based on error patterns
    if (lowerError.includes('required')) {
      return '• Check that all required parameters are provided\n• Make sure parameter names are spelled correctly';
    }

    if (lowerError.includes('type') || lowerError.includes('format')) {
      return '• Check parameter types (string, number, boolean)\n• Ensure dates are in correct format';
    }

    return '• Check the parameter format and try again\n• Refer to the tool documentation for correct usage';
  }

  /**
   * Extract required permissions from error message
   */
  private extractRequiredPermissions(
    error: ToolExecutionError
  ): PermissionLevel[] {
    const message = error.message.toLowerCase();

    if (message.includes('modify_tasks')) {
      return [PermissionLevel.MODIFY_TASKS];
    }
    if (message.includes('timer_control')) {
      return [PermissionLevel.TIMER_CONTROL];
    }
    if (message.includes('full_access')) {
      return [PermissionLevel.FULL_ACCESS];
    }

    return [PermissionLevel.READ_ONLY];
  }

  private formatPermissions(permissions: PermissionLevel[]): string {
    const permissionNames = permissions.map(permission => {
      switch (permission) {
        case PermissionLevel.READ_ONLY:
          return 'Read Only';
        case PermissionLevel.MODIFY_TASKS:
          return 'Task Modification';
        case PermissionLevel.TIMER_CONTROL:
          return 'Timer Control';
        case PermissionLevel.FULL_ACCESS:
          return 'Full Access';
        default:
          return 'Unknown Permission';
      }
    });
    return permissionNames.join(', ');
  }

  /**
   * Format error messages for different error types
   */
  private formatToolNotFoundMessage(toolName: string): string {
    return `❌ **Tool Not Found**\n\nThe tool "${toolName}" doesn't exist. Check the spelling or use one of the available tools.`;
  }

  private formatPermissionDeniedMessage(
    toolName: string,
    error: ToolExecutionError
  ): string {
    return `🔒 **Permission Denied**\n\n${this.getToolDisplayName(toolName)} requires additional permissions: ${this.formatPermissions(this.extractRequiredPermissions(error))}`;
  }

  private formatValidationErrorMessage(
    toolName: string,
    error: ToolExecutionError
  ): string {
    return `⚠️ **Invalid Input**\n\n${this.getToolDisplayName(toolName)}: ${error.message}`;
  }

  private formatDatabaseErrorMessage(toolName: string): string {
    return `💾 **Database Error**\n\n${this.getToolDisplayName(toolName)} couldn't access the database. Please try again.`;
  }

  private formatNetworkErrorMessage(toolName: string): string {
    return `🌐 **Network Error**\n\n${this.getToolDisplayName(toolName)} couldn't connect. Check your internet connection.`;
  }

  private formatTimeoutErrorMessage(toolName: string): string {
    return `⏱️ **Timeout**\n\n${this.getToolDisplayName(toolName)} took too long to respond. Please try again.`;
  }

  private formatResourceErrorMessage(toolName: string): string {
    return `⚡ **Resource Error**\n\n${this.getToolDisplayName(toolName)} couldn't access required resources. Please try again later.`;
  }

  private formatRetryMessage(
    toolName: string,
    attempt: number,
    delay: number
  ): string {
    const seconds = Math.round(delay / 1000);
    return `🔄 **Retrying ${this.getToolDisplayName(toolName)}**\n\nAttempt ${attempt}, retrying in ${seconds} second${seconds === 1 ? '' : 's'}...`;
  }

  /**
   * Utility methods for error checking
   */
  private isRetryableExecutionError(error: ToolExecutionError): boolean {
    const message = error.message.toLowerCase();
    // Don't retry validation or permission errors
    return (
      !message.includes('validation') &&
      !message.includes('permission') &&
      !message.includes('unauthorized') &&
      !message.includes('forbidden')
    );
  }

  private isRetryableDatabaseError(error: ToolExecutionError): boolean {
    const message = error.message.toLowerCase();
    // Retry on temporary database issues
    return (
      message.includes('locked') ||
      message.includes('busy') ||
      message.includes('timeout') ||
      message.includes('connection')
    );
  }

  private isRetryableNetworkError(error: ToolExecutionError): boolean {
    const message = error.message.toLowerCase();
    // Retry on temporary network issues
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      (!message.includes('404') && !message.includes('401'))
    );
  }

  private isRetryableResourceError(error: ToolExecutionError): boolean {
    const message = error.message.toLowerCase();
    // Retry on temporary resource issues
    return (
      message.includes('busy') ||
      message.includes('unavailable') ||
      message.includes('overload')
    );
  }

  /**
   * Utility methods for tool information
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      create_task: 'Create Task',
      update_task: 'Update Task',
      get_tasks: 'Get Tasks',
      start_timer: 'Start Timer',
      stop_timer: 'Stop Timer',
      get_time_data: 'Get Time Data',
      analyze_productivity: 'Analyze Productivity',
    };

    return displayNames[toolName] || toolName.replace(/_/g, ' ');
  }

  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      create_task: 'Create a new task with title, description, and priority',
      update_task: "Update an existing task's properties",
      get_tasks: 'Retrieve tasks with optional filtering',
      start_timer: 'Start a timer for a specific task',
      stop_timer: 'Stop the currently running timer',
      get_time_data: 'Get time tracking data and statistics',
      analyze_productivity: 'Analyze productivity patterns and insights',
    };

    return descriptions[toolName] || 'No description available';
  }

  private getToolPermissions(toolName: string): PermissionLevel[] {
    const permissions: Record<string, PermissionLevel[]> = {
      create_task: [PermissionLevel.MODIFY_TASKS],
      update_task: [PermissionLevel.MODIFY_TASKS],
      get_tasks: [PermissionLevel.READ_ONLY],
      start_timer: [PermissionLevel.TIMER_CONTROL],
      stop_timer: [PermissionLevel.TIMER_CONTROL],
      get_time_data: [PermissionLevel.READ_ONLY],
      analyze_productivity: [PermissionLevel.READ_ONLY],
    };

    return permissions[toolName] || [PermissionLevel.FULL_ACCESS];
  }

  /**
   * Set translation function
   */
  setTranslationFunction(translationFunction: TranslationFunction): void {
    this._translationFunction = translationFunction || ((key: string) => key);
  }

  /**
   * Get error recovery strategy for error type
   */
  getRecoveryStrategy(
    errorType: ToolExecutionErrorType
  ): ErrorRecoveryStrategy | undefined {
    return this.recoveryStrategies.get(errorType);
  }

  /**
   * Update recovery strategy for specific error type
   */
  updateRecoveryStrategy(
    errorType: ToolExecutionErrorType,
    strategy: Partial<ErrorRecoveryStrategy>
  ): void {
    const existing = this.recoveryStrategies.get(errorType);
    if (existing) {
      this.recoveryStrategies.set(errorType, { ...existing, ...strategy });
    }
  }
}

/**
 * Default error handler instance
 */
let defaultErrorHandler: ToolExecutionErrorHandler | null = null;

/**
 * Get default tool execution error handler
 */
export function getToolExecutionErrorHandler(): ToolExecutionErrorHandler {
  if (!defaultErrorHandler) {
    defaultErrorHandler = new ToolExecutionErrorHandler();
  }
  return defaultErrorHandler;
}

/**
 * Initialize tool execution error handler with translation function
 */
export function initializeToolExecutionErrorHandler(
  translationFunction?: TranslationFunction
): ToolExecutionErrorHandler {
  defaultErrorHandler = new ToolExecutionErrorHandler(translationFunction);
  return defaultErrorHandler;
}
