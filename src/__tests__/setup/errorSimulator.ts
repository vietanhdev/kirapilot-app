// Error simulation framework for testing error handling scenarios

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  TIMER_ERROR = 'TIMER_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
}

export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  DISK_FULL = 'DISK_FULL',
  CORRUPTED_DATA = 'CORRUPTED_DATA',
}

export enum AIErrorType {
  API_KEY_INVALID = 'API_KEY_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESPONSE_PARSING_ERROR = 'RESPONSE_PARSING_ERROR',
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
}

export interface ErrorSimulationConfig {
  type: ErrorType;
  message?: string;
  delay?: number;
  retryable?: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface ErrorRecoveryExpectation {
  shouldRecover: boolean;
  recoveryTime?: number;
  fallbackBehavior?: string;
  userNotification?: boolean;
  retryAttempts?: number;
}

export interface ErrorRecoveryAssertion {
  checkRecovery: () => boolean;
  checkFallback: () => boolean;
  checkUserFeedback: () => boolean;
  checkRetryBehavior: () => boolean;
}

export class ErrorSimulator {
  private activeErrors: Map<string, ErrorSimulationConfig> = new Map();
  private errorHistory: Array<{
    timestamp: Date;
    error: ErrorSimulationConfig;
  }> = [];
  private errorHandlers: Map<ErrorType, Function[]> = new Map();

  // Network error simulation
  simulateNetworkError(delay = 0, statusCode = 500): void {
    const config: ErrorSimulationConfig = {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network request failed',
      delay,
      retryable: true,
      statusCode,
      details: { networkCondition: 'offline' },
    };

    this.activateError('network', config);
  }

  simulateSlowNetwork(delay = 5000): void {
    const config: ErrorSimulationConfig = {
      type: ErrorType.TIMEOUT_ERROR,
      message: 'Request timeout',
      delay,
      retryable: true,
      details: { networkCondition: 'slow' },
    };

    this.activateError('network-slow', config);
  }

  // Database error simulation
  simulateDatabaseError(
    type: DatabaseErrorType,
    details?: Record<string, unknown>
  ): void {
    const errorMessages = {
      [DatabaseErrorType.CONNECTION_FAILED]: 'Failed to connect to database',
      [DatabaseErrorType.QUERY_FAILED]: 'Database query failed',
      [DatabaseErrorType.CONSTRAINT_VIOLATION]: 'Database constraint violation',
      [DatabaseErrorType.TRANSACTION_FAILED]: 'Database transaction failed',
      [DatabaseErrorType.MIGRATION_FAILED]: 'Database migration failed',
      [DatabaseErrorType.DISK_FULL]: 'Database disk full',
      [DatabaseErrorType.CORRUPTED_DATA]: 'Database data corrupted',
    };

    const config: ErrorSimulationConfig = {
      type: ErrorType.DATABASE_ERROR,
      message: errorMessages[type],
      retryable: type !== DatabaseErrorType.CORRUPTED_DATA,
      details: { databaseErrorType: type, ...details },
    };

    this.activateError('database', config);
  }

  // AI service error simulation
  simulateAIServiceError(
    type: AIErrorType,
    details?: Record<string, unknown>
  ): void {
    const errorMessages = {
      [AIErrorType.API_KEY_INVALID]: 'Invalid API key',
      [AIErrorType.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
      [AIErrorType.SERVICE_UNAVAILABLE]: 'AI service unavailable',
      [AIErrorType.INVALID_REQUEST]: 'Invalid request format',
      [AIErrorType.RESPONSE_PARSING_ERROR]: 'Failed to parse AI response',
      [AIErrorType.CONTEXT_TOO_LARGE]: 'Context size exceeds limit',
    };

    const config: ErrorSimulationConfig = {
      type: ErrorType.AI_SERVICE_ERROR,
      message: errorMessages[type],
      retryable:
        type === AIErrorType.RATE_LIMIT_EXCEEDED ||
        type === AIErrorType.SERVICE_UNAVAILABLE,
      statusCode: this.getStatusCodeForAIError(type),
      details: { aiErrorType: type, ...details },
    };

    this.activateError('ai-service', config);
  }

  // Validation error simulation
  simulateValidationError(
    field: string,
    message: string,
    value?: unknown
  ): void {
    const config: ErrorSimulationConfig = {
      type: ErrorType.VALIDATION_ERROR,
      message: `Validation failed for field '${field}': ${message}`,
      retryable: false,
      details: { field, value, validationMessage: message },
    };

    this.activateError(`validation-${field}`, config);
  }

  // Permission error simulation
  simulatePermissionError(resource: string, action: string): void {
    const config: ErrorSimulationConfig = {
      type: ErrorType.PERMISSION_ERROR,
      message: `Permission denied for ${action} on ${resource}`,
      retryable: false,
      details: { resource, action },
    };

    this.activateError('permission', config);
  }

  // Notification error simulation
  simulateNotificationError(
    reason: 'permission_denied' | 'not_supported' | 'service_unavailable'
  ): void {
    const messages = {
      permission_denied: 'Notification permission denied',
      not_supported: 'Notifications not supported',
      service_unavailable: 'Notification service unavailable',
    };

    const config: ErrorSimulationConfig = {
      type: ErrorType.NOTIFICATION_ERROR,
      message: messages[reason],
      retryable: reason === 'service_unavailable',
      details: { reason },
    };

    this.activateError('notification', config);
  }

  // Timer error simulation
  simulateTimerError(
    reason: 'already_running' | 'not_running' | 'invalid_state'
  ): void {
    const messages = {
      already_running: 'Timer is already running',
      not_running: 'Timer is not running',
      invalid_state: 'Timer is in invalid state',
    };

    const config: ErrorSimulationConfig = {
      type: ErrorType.TIMER_ERROR,
      message: messages[reason],
      retryable: false,
      details: { reason },
    };

    this.activateError('timer', config);
  }

  // File system error simulation
  simulateFileSystemError(
    operation: 'read' | 'write' | 'delete',
    path: string
  ): void {
    const config: ErrorSimulationConfig = {
      type: ErrorType.FILE_SYSTEM_ERROR,
      message: `File system ${operation} operation failed for ${path}`,
      retryable: true,
      details: { operation, path },
    };

    this.activateError('filesystem', config);
  }

  // Error activation and management
  private activateError(key: string, config: ErrorSimulationConfig): void {
    this.activeErrors.set(key, config);
    this.errorHistory.push({ timestamp: new Date(), error: config });
    this.notifyErrorHandlers(config);
  }

  // Check if error should be thrown
  shouldThrowError(key: string): ErrorSimulationConfig | null {
    return this.activeErrors.get(key) || null;
  }

  // Create error instance
  createError(config: ErrorSimulationConfig): Error & {
    type: ErrorType;
    retryable?: boolean;
    statusCode?: number;
    details?: Record<string, unknown>;
  } {
    const error = new Error(config.message) as Error & {
      type: ErrorType;
      retryable?: boolean;
      statusCode?: number;
      details?: Record<string, unknown>;
    };
    error.type = config.type;
    error.retryable = config.retryable;
    error.statusCode = config.statusCode;
    error.details = config.details;
    return error;
  }

  // Throw error if configured
  async throwIfConfigured(key: string): Promise<void> {
    const config = this.shouldThrowError(key);
    if (config) {
      if (config.delay && config.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delay));
      }
      throw this.createError(config);
    }
  }

  // Clear specific error
  clearError(key: string): void {
    this.activeErrors.delete(key);
  }

  // Clear all errors
  clearAllErrors(): void {
    this.activeErrors.clear();
  }

  // Get active errors
  getActiveErrors(): Map<string, ErrorSimulationConfig> {
    return new Map(this.activeErrors);
  }

  // Get error history
  getErrorHistory(): Array<{ timestamp: Date; error: ErrorSimulationConfig }> {
    return [...this.errorHistory];
  }

  // Error handler registration
  onError(type: ErrorType, handler: Function): void {
    if (!this.errorHandlers.has(type)) {
      this.errorHandlers.set(type, []);
    }
    this.errorHandlers.get(type)!.push(handler);
  }

  private notifyErrorHandlers(config: ErrorSimulationConfig): void {
    const handlers = this.errorHandlers.get(config.type);
    if (handlers) {
      handlers.forEach(handler => handler(config));
    }
  }

  // Utility methods
  private getStatusCodeForAIError(type: AIErrorType): number {
    switch (type) {
      case AIErrorType.API_KEY_INVALID:
        return 401;
      case AIErrorType.RATE_LIMIT_EXCEEDED:
        return 429;
      case AIErrorType.SERVICE_UNAVAILABLE:
        return 503;
      case AIErrorType.INVALID_REQUEST:
        return 400;
      case AIErrorType.CONTEXT_TOO_LARGE:
        return 413;
      default:
        return 500;
    }
  }

  // Reset simulator
  reset(): void {
    this.activeErrors.clear();
    this.errorHistory = [];
    this.errorHandlers.clear();
  }
}

// Test error handler for capturing and asserting errors
export class TestErrorHandler {
  private capturedErrors: Error[] = [];
  private expectedErrors: Array<{ type?: string; message?: string }> = [];

  captureErrors(): Error[] {
    return [...this.capturedErrors];
  }

  captureError(error: Error): void {
    this.capturedErrors.push(error);
  }

  expectError(errorType?: string, message?: string): void {
    this.expectedErrors.push({ type: errorType, message });
  }

  expectNoErrors(): void {
    if (this.capturedErrors.length > 0) {
      throw new Error(
        `Expected no errors, but captured ${this.capturedErrors.length} errors: ${this.capturedErrors.map(e => e.message).join(', ')}`
      );
    }
  }

  assertExpectedErrors(): void {
    if (this.expectedErrors.length !== this.capturedErrors.length) {
      throw new Error(
        `Expected ${this.expectedErrors.length} errors, but captured ${this.capturedErrors.length}`
      );
    }

    this.expectedErrors.forEach((expected, index) => {
      const captured = this.capturedErrors[index];

      if (
        expected.type &&
        (captured as Error & { type?: string }).type !== expected.type
      ) {
        throw new Error(
          `Expected error type '${expected.type}', but got '${(captured as Error & { type?: string }).type}'`
        );
      }

      if (expected.message && !captured.message.includes(expected.message)) {
        throw new Error(
          `Expected error message to contain '${expected.message}', but got '${captured.message}'`
        );
      }
    });
  }

  clearErrors(): void {
    this.capturedErrors = [];
    this.expectedErrors = [];
  }

  getErrorCount(): number {
    return this.capturedErrors.length;
  }

  hasErrorOfType(type: string): boolean {
    return this.capturedErrors.some(
      error => (error as Error & { type?: string }).type === type
    );
  }

  getErrorsOfType(type: string): Error[] {
    return this.capturedErrors.filter(
      error => (error as Error & { type?: string }).type === type
    );
  }
}

// Global error simulator instance for tests
export const globalErrorSimulator = new ErrorSimulator();
