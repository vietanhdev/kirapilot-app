/**
 * Error logging and debugging utility for AI services
 */

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  operation: string;
  message: string;
  error?: Error;
  context?: Record<string, unknown>;
  duration?: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByService: Record<string, number>;
  averageRecoveryTime: number;
  successRate: number;
  lastError?: LogEntry;
}

/**
 * Centralized error logging and debugging for AI services
 */
export class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private startTime = Date.now();
  private totalOperations = 0;
  private successfulOperations = 0;

  /**
   * Log a debug message
   */
  debug(
    service: string,
    operation: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.addLog('debug', service, operation, message, undefined, context);
  }

  /**
   * Log an info message
   */
  info(
    service: string,
    operation: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.addLog('info', service, operation, message, undefined, context);
  }

  /**
   * Log a warning
   */
  warn(
    service: string,
    operation: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.addLog('warn', service, operation, message, undefined, context);
  }

  /**
   * Log an error
   */
  error(
    service: string,
    operation: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.addLog('error', service, operation, message, error, context);
  }

  /**
   * Log operation start
   */
  startOperation(
    service: string,
    operation: string,
    context?: Record<string, unknown>
  ): string {
    const operationId = `${service}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.debug(service, operation, `Operation started: ${operationId}`, {
      ...context,
      operationId,
    });
    this.totalOperations++;
    return operationId;
  }

  /**
   * Log operation success
   */
  endOperation(
    service: string,
    operation: string,
    operationId: string,
    duration: number,
    context?: Record<string, unknown>
  ): void {
    this.info(service, operation, `Operation completed: ${operationId}`, {
      ...context,
      operationId,
      duration,
    });
    this.successfulOperations++;
  }

  /**
   * Log operation failure
   */
  failOperation(
    service: string,
    operation: string,
    operationId: string,
    duration: number,
    error: Error,
    context?: Record<string, unknown>
  ): void {
    this.error(service, operation, `Operation failed: ${operationId}`, error, {
      ...context,
      operationId,
      duration,
    });
  }

  /**
   * Add a log entry
   */
  private addLog(
    level: LogEntry['level'],
    service: string,
    operation: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    duration?: number
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      service,
      operation,
      message,
      error,
      context,
      duration,
    };

    this.logs.push(entry);

    // Keep logs within limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const logMessage = `[${entry.timestamp.toISOString()}] ${level.toUpperCase()} ${service}:${operation} - ${message}`;

      switch (level) {
        case 'debug':
          console.debug(logMessage, context);
          break;
        case 'info':
          console.info(logMessage, context);
          break;
        case 'warn':
          console.warn(logMessage, context, error);
          break;
        case 'error':
          console.error(logMessage, context, error);
          break;
      }
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count = 50, level?: LogEntry['level']): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }

    return filteredLogs.slice(-count);
  }

  /**
   * Get logs for a specific service
   */
  getServiceLogs(service: string, count = 50): LogEntry[] {
    return this.logs.filter(log => log.service === service).slice(-count);
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const errors = this.logs.filter(log => log.level === 'error');
    const errorsByType: Record<string, number> = {};
    const errorsByService: Record<string, number> = {};

    errors.forEach(error => {
      const errorType = error.error?.constructor.name || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      errorsByService[error.service] =
        (errorsByService[error.service] || 0) + 1;
    });

    const successRate =
      this.totalOperations > 0
        ? (this.successfulOperations / this.totalOperations) * 100
        : 100;

    // Calculate average recovery time (time between error and next success)
    let totalRecoveryTime = 0;
    let recoveryCount = 0;

    for (let i = 0; i < this.logs.length - 1; i++) {
      const current = this.logs[i];
      const next = this.logs[i + 1];

      if (
        current.level === 'error' &&
        next.level === 'info' &&
        next.message.includes('completed')
      ) {
        totalRecoveryTime +=
          next.timestamp.getTime() - current.timestamp.getTime();
        recoveryCount++;
      }
    }

    const averageRecoveryTime =
      recoveryCount > 0 ? totalRecoveryTime / recoveryCount : 0;

    return {
      totalErrors: errors.length,
      errorsByType,
      errorsByService,
      averageRecoveryTime,
      successRate,
      lastError: errors[errors.length - 1],
    };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    const metrics = this.getErrorMetrics();
    const recentErrors = this.getRecentLogs(20, 'error');

    const report = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics,
      recentErrors: recentErrors.map(log => ({
        timestamp: log.timestamp.toISOString(),
        service: log.service,
        operation: log.operation,
        message: log.message,
        error: log.error?.message,
        context: log.context,
      })),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.totalOperations = 0;
    this.successfulOperations = 0;
    this.startTime = Date.now();
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getErrorMetrics();
    const recentErrors = this.getRecentLogs(10, 'error');
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check error rate
    if (metrics.successRate < 90) {
      issues.push(`Low success rate: ${metrics.successRate.toFixed(1)}%`);
      recommendations.push('Check system resources and network connectivity');
    }

    // Check for recent errors
    const recentErrorsInLastMinute = recentErrors.filter(
      error => Date.now() - error.timestamp.getTime() < 60000
    );

    if (recentErrorsInLastMinute.length > 3) {
      issues.push(
        `High error rate: ${recentErrorsInLastMinute.length} errors in the last minute`
      );
      recommendations.push('Consider switching to fallback service');
    }

    // Check for specific error patterns
    const commonErrors = Object.entries(metrics.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    commonErrors.forEach(([errorType, count]) => {
      if (count > 5) {
        issues.push(`Frequent ${errorType} errors: ${count} occurrences`);

        if (errorType.includes('Network') || errorType.includes('Download')) {
          recommendations.push(
            'Check internet connection and firewall settings'
          );
        } else if (
          errorType.includes('Memory') ||
          errorType.includes('Resource')
        ) {
          recommendations.push(
            'Close other applications to free up system resources'
          );
        } else if (
          errorType.includes('Model') ||
          errorType.includes('Loading')
        ) {
          recommendations.push(
            'Try restarting the application or re-downloading the model'
          );
        }
      }
    });

    const isHealthy = issues.length === 0 && metrics.successRate > 95;

    return {
      isHealthy,
      issues,
      recommendations,
    };
  }
}

// Singleton instance
let errorLoggerInstance: ErrorLogger | null = null;

/**
 * Get ErrorLogger singleton instance
 */
export function getErrorLogger(): ErrorLogger {
  if (!errorLoggerInstance) {
    errorLoggerInstance = new ErrorLogger();
  }
  return errorLoggerInstance;
}

/**
 * Decorator for automatic operation logging
 */
export function logOperation(service: string, operation: string) {
  return function (
    _target: object,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const logger = getErrorLogger();
      const operationId = logger.startOperation(service, operation, {
        args: args.length,
      });
      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        logger.endOperation(service, operation, operationId, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.failOperation(
          service,
          operation,
          operationId,
          duration,
          error as Error
        );
        throw error;
      }
    };

    return descriptor;
  };
}
