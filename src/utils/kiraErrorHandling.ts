import {
  ErrorType,
  categorizeError,
  isErrorRecoverable,
} from '../components/common/ErrorDisplay';

export interface KiraError {
  type: ErrorType;
  message: string;
  originalError: Error | string;
  context: string;
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
}

/**
 * Enhanced error processing specifically for Kira chat operations
 */
export function processKiraError(
  error: Error | string,
  context: string
): KiraError {
  const originalError = error instanceof Error ? error : new Error(error);
  const errorType = categorizeError(originalError);
  const recoverable = isErrorRecoverable(originalError);

  const kiraError: KiraError = {
    type: errorType,
    message: originalError.message,
    originalError: error,
    context,
    recoverable,
    retryable: recoverable,
    userMessage: getUserFriendlyMessage(originalError, context),
    technicalMessage: originalError.message,
    suggestedActions: getSuggestedActions(originalError, context, errorType),
  };

  return kiraError;
}

/**
 * Get user-friendly error messages for Kira operations
 */
function getUserFriendlyMessage(error: Error, context: string): string {
  const message = error.message.toLowerCase();

  // Database connection errors
  if (message.includes('database') || message.includes('connection')) {
    switch (context) {
      case 'thread_create':
        return 'Unable to create thread. Please check your connection and try again.';
      case 'thread_load':
        return 'Unable to load threads. Please refresh and try again.';
      case 'message_send':
        return 'Unable to save message. Please try sending again.';
      case 'message_load':
        return 'Unable to load conversation history. Please refresh and try again.';
      default:
        return 'Database connection issue. Please try again.';
    }
  }

  // AI service errors
  if (
    message.includes('ai') ||
    message.includes('model') ||
    message.includes('response')
  ) {
    switch (context) {
      case 'message_send':
        return 'AI service is temporarily unavailable. Please try again in a moment.';
      case 'message_regenerate':
        return 'Unable to regenerate response. Please try again.';
      default:
        return 'AI service error. Please try again.';
    }
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('required') ||
    message.includes('invalid')
  ) {
    switch (context) {
      case 'thread_create':
        return 'Invalid thread data. Please check your input.';
      case 'message_send':
        return 'Message cannot be empty. Please enter a message.';
      case 'thread_assign':
        return 'Invalid assignment. Please select a valid task or date.';
      default:
        return 'Invalid input. Please check your data and try again.';
    }
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return 'Network error. Please check your connection and try again.';
  }

  // Generic fallback based on context
  switch (context) {
    case 'thread_create':
      return 'Unable to create thread. Please try again.';
    case 'thread_load':
      return 'Unable to load threads. Please refresh the page.';
    case 'thread_delete':
      return 'Unable to delete thread. Please try again.';
    case 'thread_assign':
      return 'Unable to assign thread. Please try again.';
    case 'message_send':
      return 'Unable to send message. Please try again.';
    case 'message_load':
      return 'Unable to load messages. Please refresh the conversation.';
    case 'message_feedback':
      return 'Unable to submit feedback. Please try again.';
    case 'message_regenerate':
      return 'Unable to regenerate response. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Get suggested actions for different error types and contexts
 */
function getSuggestedActions(
  error: Error,
  context: string,
  errorType: ErrorType
): string[] {
  const message = error.message.toLowerCase();

  // Database errors
  if (errorType === ErrorType.DATABASE || message.includes('database')) {
    const baseActions = [
      'Check your internet connection',
      'Try refreshing the page',
    ];

    switch (context) {
      case 'thread_create':
        return [...baseActions, 'Try creating the thread again'];
      case 'thread_load':
        return [
          ...baseActions,
          'Restart the application if the problem persists',
        ];
      case 'message_send':
        return [
          ...baseActions,
          'Try sending the message again',
          'Your message content is preserved',
        ];
      default:
        return [...baseActions, 'Try the operation again'];
    }
  }

  // Network errors
  if (
    errorType === ErrorType.NETWORK ||
    message.includes('network') ||
    message.includes('timeout')
  ) {
    return [
      'Check your internet connection',
      'Try again in a few moments',
      'Ensure the application has network access',
      'Contact support if the problem persists',
    ];
  }

  // AI service errors
  if (
    message.includes('ai') ||
    message.includes('model') ||
    message.includes('response')
  ) {
    const baseActions = [
      'Try again in a moment',
      'Check if the AI service is available',
    ];

    switch (context) {
      case 'message_send':
        return [
          ...baseActions,
          'Your message is saved and will be processed when the service is available',
        ];
      case 'message_regenerate':
        return [...baseActions, 'Try regenerating the response later'];
      default:
        return [...baseActions, 'Contact support if the issue continues'];
    }
  }

  // Validation errors
  if (errorType === ErrorType.VALIDATION) {
    switch (context) {
      case 'thread_create':
        return [
          'Ensure all required fields are filled',
          'Check that the assignment is valid',
        ];
      case 'message_send':
        return [
          'Enter a message before sending',
          'Check that your message is not too long',
        ];
      case 'thread_assign':
        return [
          'Select a valid task or date',
          'Ensure the assignment type is correct',
        ];
      default:
        return [
          'Check your input and try again',
          'Ensure all required fields are filled',
        ];
    }
  }

  // Generic actions based on context
  switch (context) {
    case 'thread_create':
      return [
        'Try creating the thread again',
        'Check your input and try again',
        'Refresh the page if the problem persists',
      ];
    case 'thread_load':
      return [
        'Refresh the page',
        'Check your internet connection',
        'Restart the application if needed',
      ];
    case 'thread_delete':
      return [
        'Try deleting the thread again',
        'Refresh the page and try again',
        'Ensure you have permission to delete this thread',
      ];
    case 'message_send':
      return [
        'Try sending the message again',
        'Check your internet connection',
        'Ensure your message is not empty',
      ];
    case 'message_load':
      return [
        'Refresh the conversation',
        'Try selecting the thread again',
        'Check your internet connection',
      ];
    default:
      return [
        'Try the operation again',
        'Refresh the page if the problem persists',
        'Contact support if the issue continues',
      ];
  }
}

/**
 * Determine if an operation should be retried automatically
 */
export function shouldAutoRetry(
  error: KiraError,
  attemptCount: number
): boolean {
  // Don't auto-retry validation errors
  if (error.type === ErrorType.VALIDATION) {
    return false;
  }

  // Don't retry more than 3 times
  if (attemptCount >= 3) {
    return false;
  }

  // Auto-retry network and database errors
  if (error.type === ErrorType.NETWORK || error.type === ErrorType.DATABASE) {
    return true;
  }

  // Auto-retry AI service errors for certain contexts
  if (
    error.message.toLowerCase().includes('ai') ||
    error.message.toLowerCase().includes('model')
  ) {
    // Only retry AI errors for message operations, not for feedback or other operations
    if (
      error.context === 'message_send' ||
      error.context === 'message_regenerate'
    ) {
      return true;
    }
  }

  // Auto-retry timeout errors
  if (
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('timed out')
  ) {
    return true;
  }

  return false;
}

/**
 * Get retry delay based on attempt count (exponential backoff)
 */
export function getRetryDelay(attemptCount: number): number {
  return Math.min(1000 * Math.pow(2, attemptCount), 10000); // Max 10 seconds
}

/**
 * Create a retry action for recoverable errors
 */
export function createRetryAction(
  operation: () => Promise<void>,
  context: string,
  onSuccess?: () => void,
  onError?: (error: KiraError) => void
) {
  return {
    label: 'Retry',
    onClick: async () => {
      try {
        await operation();
        onSuccess?.();
      } catch (error) {
        const kiraError = processKiraError(error as Error, context);
        onError?.(kiraError);
      }
    },
  };
}

/**
 * Enhanced retry mechanism with exponential backoff and circuit breaker pattern
 */
export class RetryManager {
  private failureCount = new Map<string, number>();
  private lastFailureTime = new Map<string, number>();
  private circuitBreakerTimeout = 30000; // 30 seconds

  /**
   * Execute operation with retry logic and circuit breaker
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    const operationKey = `${context}-${operation.name || 'anonymous'}`;

    // Check circuit breaker
    if (this.isCircuitOpen(operationKey)) {
      throw new Error(
        `Circuit breaker is open for ${context}. Please try again later.`
      );
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        // Reset failure count on success
        this.failureCount.delete(operationKey);
        this.lastFailureTime.delete(operationKey);

        return result;
      } catch (error) {
        lastError = error as Error;
        const kiraError = processKiraError(lastError, context);

        // Don't retry validation errors or if we've reached max attempts
        if (!shouldAutoRetry(kiraError, attempt) || attempt === maxRetries) {
          this.recordFailure(operationKey);
          throw lastError;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.recordFailure(operationKey);
    throw (
      lastError || new Error(`Operation failed after ${maxRetries} retries`)
    );
  }

  /**
   * Check if circuit breaker is open for an operation
   */
  private isCircuitOpen(operationKey: string): boolean {
    const failures = this.failureCount.get(operationKey) || 0;
    const lastFailure = this.lastFailureTime.get(operationKey) || 0;

    // Open circuit if too many failures and not enough time has passed
    if (
      failures >= 5 &&
      Date.now() - lastFailure < this.circuitBreakerTimeout
    ) {
      return true;
    }

    // Reset if timeout has passed
    if (
      failures >= 5 &&
      Date.now() - lastFailure >= this.circuitBreakerTimeout
    ) {
      this.failureCount.delete(operationKey);
      this.lastFailureTime.delete(operationKey);
    }

    return false;
  }

  /**
   * Record a failure for circuit breaker tracking
   */
  private recordFailure(operationKey: string): void {
    const currentFailures = this.failureCount.get(operationKey) || 0;
    this.failureCount.set(operationKey, currentFailures + 1);
    this.lastFailureTime.set(operationKey, Date.now());
  }

  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operationKey: string): void {
    this.failureCount.delete(operationKey);
    this.lastFailureTime.delete(operationKey);
  }
}

/**
 * Global retry manager instance
 */
export const globalRetryManager = new RetryManager();

/**
 * Database connection health checker
 */
export class DatabaseHealthChecker {
  private isHealthy = true;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds

  /**
   * Check if database is healthy
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }

    try {
      // Simple health check - try to invoke a basic database operation
      await import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke('get_thread_statistics')
      );

      this.isHealthy = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error) {
      console.warn('Database health check failed:', error);
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Get current health status without checking
   */
  getCurrentHealth(): boolean {
    return this.isHealthy;
  }

  /**
   * Force a health check
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastHealthCheck = 0;
    return this.checkHealth();
  }
}

/**
 * Global database health checker instance
 */
export const globalDatabaseHealthChecker = new DatabaseHealthChecker();

/**
 * AI service health checker
 */
export class AIServiceHealthChecker {
  private isHealthy = true;
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1 minute
  private consecutiveFailures = 0;

  /**
   * Check if AI service is healthy
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }

    try {
      // Simple health check - this would need to be implemented based on your AI service
      // For now, we'll assume it's healthy if no recent failures
      if (this.consecutiveFailures < 3) {
        this.isHealthy = true;
      }

      this.lastHealthCheck = now;
      return this.isHealthy;
    } catch (error) {
      console.warn('AI service health check failed:', error);
      this.consecutiveFailures++;
      this.isHealthy = this.consecutiveFailures < 3;
      this.lastHealthCheck = now;
      return this.isHealthy;
    }
  }

  /**
   * Record AI service failure
   */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.isHealthy = this.consecutiveFailures < 3;
  }

  /**
   * Record AI service success
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isHealthy = true;
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): boolean {
    return this.isHealthy;
  }
}

/**
 * Global AI service health checker instance
 */
export const globalAIServiceHealthChecker = new AIServiceHealthChecker();
