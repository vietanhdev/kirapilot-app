import {
  ErrorType,
  categorizeError,
  isErrorRecoverable,
} from '../../components/common/ErrorDisplay';
import { executeWithRetry, RETRY_PRESETS } from '../../utils/retryMechanism';
import {
  parseTaskListError,
  TaskListError,
  TaskListErrorType,
} from '../../utils/taskListErrorHandling';

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
  recoveryAction?: () => Promise<void>;
}

export interface EnhancedError extends Error {
  type: ErrorType;
  context: ErrorContext;
  recoveryStrategy: ErrorRecoveryStrategy;
  originalError: Error;
  retryCount?: number;
}

export class ErrorHandlingService {
  private errorHistory: EnhancedError[] = [];
  private maxHistorySize = 100;

  /**
   * Process and enhance an error with context and recovery strategies
   */
  processError(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const originalError = error instanceof Error ? error : new Error(error);
    const errorType = categorizeError(originalError);

    const fullContext: ErrorContext = {
      operation: 'unknown',
      timestamp: new Date(),
      ...context,
    };

    const recoveryStrategy = this.determineRecoveryStrategy(
      originalError,
      errorType
    );

    const enhancedError = Object.assign(originalError, {
      type: errorType,
      context: fullContext,
      recoveryStrategy,
      originalError,
    }) as EnhancedError;

    // Add to history
    this.addToHistory(enhancedError);

    return enhancedError;
  }

  /**
   * Execute database operation with enhanced error handling and retry logic
   */
  async executeDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    try {
      return await executeWithRetry(
        operation,
        operationName,
        RETRY_PRESETS.DATABASE
      );
    } catch (error) {
      const enhancedError = this.processError(error as Error, {
        operation: operationName,
        component: 'database',
        ...context,
      });

      throw enhancedError;
    }
  }

  /**
   * Execute network operation with enhanced error handling and retry logic
   */
  async executeNetworkOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    try {
      return await executeWithRetry(
        operation,
        operationName,
        RETRY_PRESETS.NETWORK
      );
    } catch (error) {
      const enhancedError = this.processError(error as Error, {
        operation: operationName,
        component: 'network',
        ...context,
      });

      throw enhancedError;
    }
  }

  /**
   * Handle task list specific errors with enhanced context
   */
  processTaskListError(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const originalError = error instanceof Error ? error : new Error(error);
    const taskListError = parseTaskListError(originalError);

    const errorType = this.mapTaskListErrorType(taskListError.type);
    const recoveryStrategy = this.createTaskListRecoveryStrategy(taskListError);

    const fullContext: ErrorContext = {
      operation: 'task_list_operation',
      component: 'TaskListService',
      timestamp: new Date(),
      metadata: {
        taskListErrorType: taskListError.type,
        field: taskListError.field,
        value: taskListError.value,
      },
      ...context,
    };

    const enhancedError = Object.assign(originalError, {
      type: errorType,
      context: fullContext,
      recoveryStrategy,
      originalError,
      taskListError,
    }) as EnhancedError & { taskListError: TaskListError };

    this.addToHistory(enhancedError);
    return enhancedError;
  }

  /**
   * Get user-friendly error message for display
   */
  getUserMessage(error: EnhancedError): string {
    return error.recoveryStrategy.userMessage;
  }

  /**
   * Get technical error message for debugging
   */
  getTechnicalMessage(error: EnhancedError): string {
    return error.recoveryStrategy.technicalMessage;
  }

  /**
   * Get suggested recovery actions
   */
  getRecoveryActions(error: EnhancedError): string[] {
    return error.recoveryStrategy.suggestedActions;
  }

  /**
   * Check if error can be recovered automatically
   */
  canRecover(error: EnhancedError): boolean {
    return error.recoveryStrategy.canRecover;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: EnhancedError): boolean {
    return error.recoveryStrategy.retryable;
  }

  /**
   * Execute recovery action if available
   */
  async executeRecovery(error: EnhancedError): Promise<void> {
    if (error.recoveryStrategy.recoveryAction) {
      await error.recoveryStrategy.recoveryAction();
    }
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): EnhancedError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    byComponent: Record<string, number>;
    recentErrors: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const byType = this.errorHistory.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorType, number>
    );

    const byComponent = this.errorHistory.reduce(
      (acc, error) => {
        const component = error.context.component || 'unknown';
        acc[component] = (acc[component] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentErrors = this.errorHistory.filter(
      error => error.context.timestamp.getTime() > oneHourAgo
    ).length;

    return {
      total: this.errorHistory.length,
      byType,
      byComponent,
      recentErrors,
    };
  }

  private determineRecoveryStrategy(
    error: Error,
    errorType: ErrorType
  ): ErrorRecoveryStrategy {
    const message = error.message;
    const isRecoverable = isErrorRecoverable(error);

    switch (errorType) {
      case ErrorType.VALIDATION:
        return {
          canRecover: false,
          retryable: false,
          userMessage: this.cleanErrorMessage(message),
          technicalMessage: message,
          suggestedActions: [
            'Check your input and try again',
            'Ensure all required fields are filled',
            'Verify the format of your data',
          ],
        };

      case ErrorType.DATABASE:
        return {
          canRecover: isRecoverable,
          retryable: isRecoverable,
          userMessage: 'A database error occurred. Please try again.',
          technicalMessage: message,
          suggestedActions: isRecoverable
            ? [
                'Try the operation again',
                'Check your internet connection',
                'Restart the application if the problem persists',
              ]
            : [
                'Contact support if the problem persists',
                'Check the application logs for more details',
              ],
        };

      case ErrorType.NETWORK:
        return {
          canRecover: true,
          retryable: true,
          userMessage:
            'Network error. Please check your connection and try again.',
          technicalMessage: message,
          suggestedActions: [
            'Check your internet connection',
            'Try again in a moment',
            'Ensure the service is available',
          ],
        };

      case ErrorType.UNKNOWN:
      default:
        return {
          canRecover: false,
          retryable: false,
          userMessage: 'An unexpected error occurred. Please try again.',
          technicalMessage: message,
          suggestedActions: [
            'Try the operation again',
            'Restart the application if the problem persists',
            'Contact support if the issue continues',
          ],
        };
    }
  }

  private createTaskListRecoveryStrategy(
    taskListError: TaskListError
  ): ErrorRecoveryStrategy {
    const isRecoverable =
      taskListError.type === TaskListErrorType.DATABASE ||
      taskListError.type === TaskListErrorType.NETWORK ||
      taskListError.type === TaskListErrorType.TRANSACTION;

    const baseStrategy = {
      canRecover: isRecoverable,
      retryable: isRecoverable,
      userMessage: taskListError.message,
      technicalMessage: taskListError.originalError || taskListError.message,
    };

    switch (taskListError.type) {
      case TaskListErrorType.VALIDATION:
        return {
          ...baseStrategy,
          suggestedActions: [
            'Check that the name is not empty',
            'Ensure the name is under 255 characters',
            'Avoid using reserved names',
          ],
        };

      case TaskListErrorType.DUPLICATE:
        return {
          ...baseStrategy,
          suggestedActions: [
            'Choose a different name',
            'Check existing task lists',
          ],
        };

      case TaskListErrorType.NOT_FOUND:
        return {
          ...baseStrategy,
          suggestedActions: [
            'Refresh the page to reload data',
            'Select a different task list',
          ],
        };

      case TaskListErrorType.BUSINESS_RULE:
        return {
          ...baseStrategy,
          suggestedActions: [
            'This operation is not allowed',
            'Check the task list requirements',
          ],
        };

      default:
        return {
          ...baseStrategy,
          suggestedActions: [
            'Try the operation again',
            'Contact support if the problem persists',
          ],
        };
    }
  }

  private mapTaskListErrorType(
    taskListErrorType: TaskListErrorType
  ): ErrorType {
    switch (taskListErrorType) {
      case TaskListErrorType.VALIDATION:
      case TaskListErrorType.DUPLICATE:
        return ErrorType.VALIDATION;
      case TaskListErrorType.DATABASE:
      case TaskListErrorType.TRANSACTION:
      case TaskListErrorType.CONSISTENCY:
        return ErrorType.DATABASE;
      case TaskListErrorType.NETWORK:
        return ErrorType.NETWORK;
      default:
        return ErrorType.UNKNOWN;
    }
  }

  private cleanErrorMessage(message: string): string {
    // Remove technical prefixes
    return message
      .replace(/^Error:\s*/, '')
      .replace(/^[A-Z_]+_ERROR:\s*/, '')
      .replace(/^Database error:\s*/i, '')
      .replace(/^Network error:\s*/i, '')
      .trim();
  }

  private addToHistory(error: EnhancedError): void {
    this.errorHistory.push(error);

    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }
}

// Global error handling service instance
export const errorHandlingService = new ErrorHandlingService();
