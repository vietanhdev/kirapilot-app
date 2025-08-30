import { v4 as uuidv4 } from 'uuid';
import { AIServiceInterface, ModelInfo } from './AIServiceInterface';
import { AIResponse, AppContext } from '../../types';
import { ToolExecutionResult } from './types';
import { LogStorageService } from '../database/repositories/LogStorageService';
import { LoggingConfigService } from '../database/repositories/LoggingConfigService';
import { PrivacyFilter } from './PrivacyFilter';
import {
  AIInteractionLog,
  CreateLogRequest,
  CreateToolExecutionLogRequest,
  LoggingConfig,
} from '../../types/aiLogging';

/**
 * Interface for request context during AI service calls
 */
export interface RequestContext {
  message: string;
  context: AppContext;
  sessionId: string;
  timestamp: Date;
  modelInfo: ModelInfo;
}

/**
 * Interface for response metadata
 */
export interface ResponseMetadata {
  responseTime: number;
  tokenCount?: number;
  modelInfo: ModelInfo;
  sessionId: string;
  timestamp: Date;
}

/**
 * Interface for privacy classification results
 */
export interface PrivacyClassification {
  containsSensitiveData: boolean;
  dataClassification: 'public' | 'internal' | 'confidential';
  detectedPatterns: string[];
  redactedContent?: string;
}

/**
 * Logging interceptor for AI services
 * Provides comprehensive logging of AI interactions with privacy filtering
 * and silent degradation on failures
 */
export class LoggingInterceptor {
  private logStorageService: LogStorageService;
  private configService: LoggingConfigService;
  private privacyFilter: PrivacyFilter;
  private currentSessionId: string;
  private pendingLogs: Map<string, Partial<AIInteractionLog>> = new Map();
  private isEnabled: boolean = true;
  private config: LoggingConfig | null = null;
  private statusCallback?: (
    type: 'capture' | 'error',
    message?: string
  ) => void;

  constructor(
    logStorageService: LogStorageService,
    configService: LoggingConfigService,
    statusCallback?: (type: 'capture' | 'error', message?: string) => void
  ) {
    this.logStorageService = logStorageService;
    this.configService = configService;
    this.privacyFilter = new PrivacyFilter();
    this.currentSessionId = this.generateSessionId();
    this.statusCallback = statusCallback;

    // Start with default enabled state, then update asynchronously
    this.isEnabled = true; // Assume enabled by default
    this.config = LoggingConfigService.getDefaultConfig();

    // Update with actual config asynchronously
    this.initializeConfig();
  }

  /**
   * Initialize logging configuration
   */
  private async initializeConfig(): Promise<void> {
    try {
      this.config = await this.configService.getConfig();
      this.isEnabled = this.config?.enabled ?? true; // Default to true if config is missing
    } catch (error) {
      console.warn(
        'Failed to initialize logging config, using defaults:',
        error
      );
      this.isEnabled = true; // Default to enabled
      this.config = LoggingConfigService.getDefaultConfig();
    }
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Start a new session
   */
  public startNewSession(): string {
    this.currentSessionId = this.generateSessionId();
    return this.currentSessionId;
  }

  /**
   * Intercept AI service request
   */
  public async interceptRequest(
    service: AIServiceInterface,
    message: string,
    context: AppContext
  ): Promise<string> {
    // Always return a request ID for tracking, even if logging is disabled
    const requestId = uuidv4();

    if (!this.isEnabled || !this.config) {
      return requestId;
    }

    try {
      const timestamp = new Date();
      const modelInfo = service.getModelInfo();

      // Analyze privacy of the request
      const privacyAnalysis = this.privacyFilter.analyzeText(message);

      // Create partial log entry
      const partialLog: Partial<AIInteractionLog> = {
        id: requestId,
        timestamp,
        sessionId: this.currentSessionId,
        modelType: modelInfo.type === 'local' ? 'local' : 'gemini',
        modelInfo: {
          name: modelInfo.name,
          version: modelInfo.version,
          provider: modelInfo.type === 'local' ? 'local' : 'google',
          parameters: {
            contextSize: modelInfo.contextSize,
            capabilities: modelInfo.capabilities,
          },
        },
        userMessage: privacyAnalysis.containsSensitiveData
          ? this.privacyFilter.redactText(message)
          : message,
        systemPrompt: this.config.includeSystemPrompts
          ? this.extractSystemPrompt(context)
          : undefined,
        context: JSON.stringify(this.sanitizeContext(context)),
        containsSensitiveData: privacyAnalysis.containsSensitiveData,
        dataClassification: privacyAnalysis.dataClassification,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Store partial log for completion later
      this.pendingLogs.set(requestId, partialLog);
    } catch (error) {
      // Silent degradation - log error but don't throw
      console.warn('🔍 Debug: Failed to intercept AI request:', error);
    }

    return requestId;
  }

  /**
   * Intercept AI service response
   */
  public async interceptResponse(
    requestId: string,
    response: AIResponse,
    metadata: ResponseMetadata
  ): Promise<void> {
    if (!this.isEnabled || !this.config) {
      // Clean up pending log even if logging is disabled
      this.pendingLogs.delete(requestId);
      return;
    }

    try {
      const partialLog = this.pendingLogs.get(requestId);
      if (!partialLog) {
        console.warn(`No pending log found for request ${requestId}`);
        return;
      }

      // Analyze privacy of the response
      const responsePrivacy = this.privacyFilter.analyzeText(response.message);

      // Complete the log entry
      const completeLog: CreateLogRequest = {
        sessionId: partialLog.sessionId!,
        modelType: partialLog.modelType!,
        modelInfo: partialLog.modelInfo!,
        userMessage: partialLog.userMessage!,
        systemPrompt: partialLog.systemPrompt,
        context: partialLog.context!,
        aiResponse: responsePrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(response.message)
          : response.message,
        actions: JSON.stringify(response.actions || []),
        suggestions: JSON.stringify(response.suggestions || []),
        reasoning: response.reasoning,
        responseTime: metadata.responseTime,
        tokenCount: metadata.tokenCount,
        containsSensitiveData:
          partialLog.containsSensitiveData ||
          responsePrivacy.containsSensitiveData,
        dataClassification: this.getHighestClassification(
          partialLog.dataClassification!,
          responsePrivacy.dataClassification
        ),
      };

      // Store the complete log
      const logResult =
        await this.logStorageService.logInteraction(completeLog);
      const logId = logResult.id;

      // Log tool executions if enabled
      if (
        this.config.includeToolExecutions &&
        response.actions &&
        response.actions.length > 0
      ) {
        await this.logToolExecutions(
          logId,
          response.actions,
          metadata.responseTime
        );
      }

      // Notify status callback of successful capture
      if (this.statusCallback) {
        this.statusCallback('capture');
      }

      // Clean up pending log
      this.pendingLogs.delete(requestId);
    } catch (error) {
      // Silent degradation - log error but don't throw
      console.warn('Failed to intercept AI response:', error);

      // Notify status callback of error
      if (this.statusCallback) {
        this.statusCallback(
          'error',
          error instanceof Error ? error.message : 'Failed to log interaction'
        );
      }

      this.pendingLogs.delete(requestId);
    }
  }

  /**
   * Intercept AI service error
   */
  public async interceptError(
    requestId: string,
    error: Error,
    context: RequestContext
  ): Promise<void> {
    if (!this.isEnabled || !this.config) {
      // Clean up pending log even if logging is disabled
      this.pendingLogs.delete(requestId);
      return;
    }

    try {
      const partialLog = this.pendingLogs.get(requestId);
      if (!partialLog) {
        console.warn(`No pending log found for request ${requestId}`);
        return;
      }

      // Complete the log entry with error information
      const errorLog: CreateLogRequest = {
        sessionId: partialLog.sessionId!,
        modelType: partialLog.modelType!,
        modelInfo: partialLog.modelInfo!,
        userMessage: partialLog.userMessage!,
        systemPrompt: partialLog.systemPrompt,
        context: partialLog.context!,
        aiResponse: '',
        actions: JSON.stringify([]),
        suggestions: JSON.stringify([]),
        responseTime: Date.now() - context.timestamp.getTime(),
        error: error.message,
        errorCode: this.extractErrorCode(error),
        containsSensitiveData: partialLog.containsSensitiveData || false,
        dataClassification: partialLog.dataClassification || 'internal',
      };

      // Store the error log
      await this.logStorageService.logInteraction(errorLog);

      // Notify status callback of error capture
      if (this.statusCallback) {
        this.statusCallback('error', error.message);
      }

      // Clean up pending log
      this.pendingLogs.delete(requestId);
    } catch (logError) {
      // Silent degradation - log error but don't throw
      console.warn('Failed to intercept AI error:', logError);

      // Notify status callback of logging error
      if (this.statusCallback) {
        this.statusCallback(
          'error',
          logError instanceof Error ? logError.message : 'Failed to log error'
        );
      }

      this.pendingLogs.delete(requestId);
    }
  }

  /**
   * Log tool execution
   */
  public async logToolExecution(
    interactionLogId: string,
    toolName: string,
    args: Record<string, unknown>,
    result: ToolExecutionResult,
    executionTime: number
  ): Promise<void> {
    if (!this.isEnabled || !this.config?.includeToolExecutions) {
      return;
    }

    try {
      // Analyze privacy of tool arguments and results
      const argsText = JSON.stringify(args);
      const resultText = JSON.stringify(result);
      const argsPrivacy = this.privacyFilter.analyzeText(argsText);
      const resultPrivacy = this.privacyFilter.analyzeText(resultText);

      const toolLog: CreateToolExecutionLogRequest = {
        interactionLogId,
        toolName,
        arguments: argsPrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(argsText)
          : argsText,
        result: resultPrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(resultText)
          : resultText,
        executionTime,
        success: result.success,
        error: result.error,
      };

      await this.logStorageService.logToolExecution(toolLog);
    } catch (error) {
      // Silent degradation - log error but don't throw
      console.warn('Failed to log tool execution:', error);
    }
  }

  /**
   * Log multiple tool executions from AI actions
   */
  private async logToolExecutions(
    interactionLogId: string,
    actions: unknown[],
    totalResponseTime: number
  ): Promise<void> {
    const estimatedTimePerTool =
      totalResponseTime / Math.max(actions.length, 1);

    for (const action of actions) {
      // Type guard to check if action has the expected structure
      if (
        action &&
        typeof action === 'object' &&
        'type' in action &&
        'parameters' in action &&
        typeof (action as Record<string, unknown>).type === 'string' &&
        typeof (action as Record<string, unknown>).parameters === 'object'
      ) {
        const typedAction = action as {
          type: string;
          parameters: Record<string, unknown>;
        };

        const mockResult: ToolExecutionResult = {
          success: true,
          data: typedAction.parameters,
          userMessage: `Executed ${typedAction.type}`,
          metadata: {
            executionTime: estimatedTimePerTool,
            toolName: typedAction.type.toLowerCase(),
            permissions: [],
          },
        };

        await this.logToolExecution(
          interactionLogId,
          typedAction.type.toLowerCase(),
          typedAction.parameters,
          mockResult,
          estimatedTimePerTool
        );
      }
    }
  }

  /**
   * Get the highest classification level between two classifications
   */
  private getHighestClassification(
    class1: 'public' | 'internal' | 'confidential',
    class2: 'public' | 'internal' | 'confidential'
  ): 'public' | 'internal' | 'confidential' {
    const levels = { public: 0, internal: 1, confidential: 2 };
    return levels[class1] >= levels[class2] ? class1 : class2;
  }

  /**
   * Extract system prompt from context (simplified)
   */
  private extractSystemPrompt(_context: AppContext): string | undefined {
    // This would typically extract the system prompt used by the AI service
    // For now, return undefined as system prompts are service-specific
    return undefined;
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: AppContext): Partial<AppContext> {
    // Create a sanitized copy of the context
    return {
      currentTask: context.currentTask
        ? {
            ...context.currentTask,
            // Remove potentially sensitive task details
            description: '[TASK_DESCRIPTION]',
          }
        : undefined,
      activeSession: context.activeSession
        ? {
            ...context.activeSession,
            notes: '[SESSION_NOTES]',
          }
        : undefined,
      focusMode: context.focusMode,
      timeOfDay: context.timeOfDay,
      dayOfWeek: context.dayOfWeek,
      currentEnergy: context.currentEnergy,
      // Remove recent activity as it might contain sensitive information
      recentActivity: [],
      preferences: {
        ...context.preferences,
        // Keep preferences but sanitize any potential sensitive data
      },
    };
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: Error): string | undefined {
    // Check if error has a code property
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    // Extract code from error name or message
    if (error.name !== 'Error') {
      return error.name;
    }

    // Try to extract from message
    const codeMatch = error.message.match(/code:\s*([A-Z_]+)/i);
    if (codeMatch) {
      return codeMatch[1];
    }

    return undefined;
  }

  /**
   * Update logging configuration
   */
  public async updateConfig(config: Partial<LoggingConfig>): Promise<void> {
    try {
      await this.configService.updateConfig(config);
      this.config = await this.configService.getConfig();
      this.isEnabled = this.config?.enabled ?? false;
    } catch (error) {
      console.warn('Failed to update logging config:', error);
    }
  }

  /**
   * Check if logging is currently enabled
   */
  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current logging configuration
   */
  public getConfig(): LoggingConfig | null {
    return this.config;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.pendingLogs.clear();
  }
}

// Singleton instance
let loggingInterceptorInstance: LoggingInterceptor | null = null;

/**
 * Get LoggingInterceptor singleton instance
 */
export function getLoggingInterceptor(): LoggingInterceptor {
  if (!loggingInterceptorInstance) {
    // This will be properly initialized when the database services are available
    throw new Error(
      'LoggingInterceptor not initialized. Call initializeLoggingInterceptor first.'
    );
  }
  return loggingInterceptorInstance;
}

/**
 * Initialize LoggingInterceptor with required services
 */
export function initializeLoggingInterceptor(
  logStorageService: LogStorageService,
  configService: LoggingConfigService,
  statusCallback?: (type: 'capture' | 'error', message?: string) => void
): LoggingInterceptor {
  loggingInterceptorInstance = new LoggingInterceptor(
    logStorageService,
    configService,
    statusCallback
  );
  return loggingInterceptorInstance;
}
