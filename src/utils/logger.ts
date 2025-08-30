/**
 * Centralized logging utility for AI interactions
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(message: string, data?: any) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`🔍 [DEBUG] ${message}`, data || '');
    }
  }

  info(message: string, data?: any) {
    if (this.level <= LogLevel.INFO) {
      console.log(`ℹ️ [INFO] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`⚠️ [WARN] ${message}`, data || '');
    }
  }

  error(message: string, data?: any) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`❌ [ERROR] ${message}`, data || '');
    }
  }

  // AI-specific logging methods
  aiRequest(service: string, message: string, context?: any) {
    this.info(`🤖 [${service}] Request`, {
      messageLength: message.length,
      message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
      context: context ? this.sanitizeContext(context) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  aiResponse(
    service: string,
    response: string,
    duration?: number,
    metadata?: any
  ) {
    this.info(`✅ [${service}] Response`, {
      responseLength: response.length,
      response:
        response.substring(0, 300) + (response.length > 300 ? '...' : ''),
      duration: duration ? `${duration}ms` : undefined,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  aiError(service: string, error: Error | string, duration?: number) {
    this.error(`❌ [${service}] Error`, {
      error: error instanceof Error ? error.message : error,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  aiFallback(fromService: string, toService: string, reason: string) {
    this.warn(`🔄 [AIService] Fallback`, {
      from: fromService,
      to: toService,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  private sanitizeContext(context: any): any {
    // Remove sensitive data and limit size for logging
    return {
      hasCurrentTask: !!context.currentTask,
      hasActiveSession: !!context.activeSession,
      focusMode: context.focusMode,
      recentActivityCount: context.recentActivity?.length || 0,
      timeOfDay: context.timeOfDay,
      dayOfWeek: context.dayOfWeek,
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience function to set log level from environment or localStorage
export function initializeLogger() {
  // Check for log level in localStorage (for development)
  const storedLevel = localStorage.getItem('ai-log-level');
  if (storedLevel && storedLevel in LogLevel) {
    logger.setLevel(LogLevel[storedLevel as keyof typeof LogLevel]);
  }

  // Check for log level in environment
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLevel && envLevel in LogLevel) {
    logger.setLevel(LogLevel[envLevel as keyof typeof LogLevel]);
  }

  logger.info('Logger initialized', { level: LogLevel[logger.getLevel()] });
}

// Global functions for easy access
export const logAIRequest = (service: string, message: string, context?: any) =>
  logger.aiRequest(service, message, context);

export const logAIResponse = (
  service: string,
  response: string,
  duration?: number,
  metadata?: any
) => logger.aiResponse(service, response, duration, metadata);

export const logAIError = (
  service: string,
  error: Error | string,
  duration?: number
) => logger.aiError(service, error, duration);

export const logAIFallback = (
  fromService: string,
  toService: string,
  reason: string
) => logger.aiFallback(fromService, toService, reason);
