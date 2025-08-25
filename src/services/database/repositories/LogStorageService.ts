// AI Interaction Log storage service that interfaces with Tauri commands (SeaORM backend)
import { invoke } from '@tauri-apps/api/core';
import {
  AIInteractionLog,
  ToolExecutionLog,
  LoggingConfig,
  CreateLogRequest,
  UpdateLogRequest,
  CreateToolExecutionLogRequest,
  LogFilter,
  LogStorageStats,
} from '../../../types/aiLogging';
import { getDatabaseErrorMessage } from '../index';
import { TranslationKey } from '../../../i18n';
import { PrivacyFilter } from '../../ai/PrivacyFilter';

export class LogStorageService {
  private privacyFilter: PrivacyFilter;

  constructor() {
    this.privacyFilter = new PrivacyFilter();
  }
  /**
   * Create a new AI interaction log
   */
  async logInteraction(request: CreateLogRequest): Promise<AIInteractionLog> {
    try {
      // Analyze privacy if not already provided
      let containsSensitiveData = request.containsSensitiveData;
      let dataClassification = request.dataClassification;

      if (
        containsSensitiveData === undefined ||
        dataClassification === undefined
      ) {
        // Create a mock log for privacy analysis
        const mockLog: AIInteractionLog = {
          id: 'temp',
          timestamp: new Date(),
          sessionId: request.sessionId,
          modelType: request.modelType,
          modelInfo: request.modelInfo,
          userMessage: request.userMessage,
          aiResponse: request.aiResponse,
          systemPrompt: request.systemPrompt,
          context: JSON.parse(request.context || '{}'),
          actions: JSON.parse(request.actions || '[]'),
          suggestions: JSON.parse(request.suggestions || '[]'),
          reasoning: request.reasoning,
          toolCalls: [],
          responseTime: request.responseTime,
          tokenCount: request.tokenCount,
          error: request.error,
          errorCode: request.errorCode,
          containsSensitiveData: false,
          dataClassification: 'public',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const privacyAnalysis =
          this.privacyFilter.analyzeInteractionLog(mockLog);
        containsSensitiveData =
          containsSensitiveData ?? privacyAnalysis.containsSensitiveData;
        dataClassification =
          dataClassification ?? privacyAnalysis.dataClassification;
      }

      // Map frontend camelCase to backend snake_case and serialize dates
      const serializedRequest = {
        session_id: request.sessionId,
        model_type: request.modelType,
        model_info: request.modelInfo,
        user_message: request.userMessage,
        system_prompt: request.systemPrompt,
        context: request.context,
        ai_response: request.aiResponse,
        actions: request.actions,
        suggestions: request.suggestions,
        reasoning: request.reasoning,
        response_time: request.responseTime,
        token_count: request.tokenCount,
        error: request.error,
        error_code: request.errorCode,
        contains_sensitive_data: containsSensitiveData,
        data_classification: dataClassification,
      };

      const result = await invoke<Record<string, unknown>>(
        'create_ai_interaction_log',
        {
          request: serializedRequest,
        }
      );
      return this.transformLogFromBackend(result);
    } catch (error) {
      console.error('AI interaction log creation failed with error:', error);

      let errorMessage = 'Failed to create AI interaction log';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      errorMessage = errorMessage.replace(
        /^Failed to create AI interaction log:\s*/,
        ''
      );
      errorMessage = errorMessage.replace(/^Database error:\s*/, '');

      throw new Error(errorMessage);
    }
  }

  /**
   * Get AI interaction logs with optional filtering
   */
  async getInteractionLogs(filters?: LogFilter): Promise<AIInteractionLog[]> {
    try {
      const serializedFilters = filters
        ? {
            start_date: filters.startDate?.toISOString(),
            end_date: filters.endDate?.toISOString(),
            model_type: filters.modelType,
            has_errors: filters.hasErrors,
            contains_tool_calls: filters.containsToolCalls,
            search_text: filters.searchText,
            limit: filters.limit,
            offset: filters.offset,
          }
        : {};

      const result = await invoke<Record<string, unknown>[]>(
        'get_ai_interaction_logs',
        {
          filters: serializedFilters,
        }
      );

      return result.map(log => this.transformLogFromBackend(log));
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.getLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Get a specific AI interaction log by ID
   */
  async getInteractionLog(id: string): Promise<AIInteractionLog | null> {
    try {
      const result = await invoke<Record<string, unknown> | null>(
        'get_ai_interaction_log',
        {
          id,
        }
      );
      return result ? this.transformLogFromBackend(result) : null;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.getLogFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Update an AI interaction log
   */
  async updateInteractionLog(
    id: string,
    request: UpdateLogRequest
  ): Promise<AIInteractionLog> {
    try {
      const serializedRequest: Record<string, unknown> = {};

      if (request.aiResponse !== undefined) {
        serializedRequest.ai_response = request.aiResponse;
      }
      if (request.actions !== undefined) {
        serializedRequest.actions = request.actions;
      }
      if (request.suggestions !== undefined) {
        serializedRequest.suggestions = request.suggestions;
      }
      if (request.reasoning !== undefined) {
        serializedRequest.reasoning = request.reasoning;
      }
      if (request.responseTime !== undefined) {
        serializedRequest.response_time = request.responseTime;
      }
      if (request.tokenCount !== undefined) {
        serializedRequest.token_count = request.tokenCount;
      }
      if (request.error !== undefined) {
        serializedRequest.error = request.error;
      }
      if (request.errorCode !== undefined) {
        serializedRequest.error_code = request.errorCode;
      }
      if (request.containsSensitiveData !== undefined) {
        serializedRequest.contains_sensitive_data =
          request.containsSensitiveData;
      }
      if (request.dataClassification !== undefined) {
        serializedRequest.data_classification = request.dataClassification;
      }

      const result = await invoke<Record<string, unknown>>(
        'update_ai_interaction_log',
        {
          id,
          request: serializedRequest,
        }
      );
      return this.transformLogFromBackend(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.updateLogFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Delete an AI interaction log
   */
  async deleteInteractionLog(id: string): Promise<void> {
    try {
      await invoke<string>('delete_ai_interaction_log', { id });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.deleteLogFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Clear all AI interaction logs
   */
  async clearAllLogs(): Promise<void> {
    try {
      await invoke<string>('clear_all_ai_interaction_logs');
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.clearLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Export logs in specified format
   */
  async exportLogs(
    filters?: LogFilter,
    format: 'json' | 'csv' = 'json'
  ): Promise<Blob> {
    try {
      const serializedFilters = filters
        ? {
            start_date: filters.startDate?.toISOString(),
            end_date: filters.endDate?.toISOString(),
            model_type: filters.modelType,
            has_errors: filters.hasErrors,
            contains_tool_calls: filters.containsToolCalls,
            search_text: filters.searchText,
            limit: filters.limit,
            offset: filters.offset,
          }
        : {};

      const result = await invoke<string>('export_ai_interaction_logs', {
        filters: serializedFilters,
        format,
      });

      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      return new Blob([result], { type: mimeType });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.exportLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Clean up old logs based on retention policy
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const result = await invoke<number>('cleanup_old_ai_interaction_logs');
      return result;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.cleanupLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<LogStorageStats> {
    try {
      const result = await invoke<{
        total_logs: number;
        total_size: number;
        oldest_log?: string;
        newest_log?: string;
        logs_by_model: Record<string, number>;
        average_response_time: number;
      }>('get_ai_interaction_log_stats');

      return {
        totalLogs: result.total_logs,
        totalSize: result.total_size,
        oldestLog: result.oldest_log ? new Date(result.oldest_log) : undefined,
        newestLog: result.newest_log ? new Date(result.newest_log) : undefined,
        logsByModel: result.logs_by_model,
        averageResponseTime: result.average_response_time,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.getStatsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Log tool execution
   */
  async logToolExecution(
    request: CreateToolExecutionLogRequest
  ): Promise<ToolExecutionLog> {
    try {
      const serializedRequest = {
        interaction_log_id: request.interactionLogId,
        tool_name: request.toolName,
        arguments: request.arguments,
        result: request.result,
        execution_time: request.executionTime,
        success: request.success,
        error: request.error,
      };

      const result = await invoke<Record<string, unknown>>(
        'create_tool_execution_log',
        {
          request: serializedRequest,
        }
      );
      return this.transformToolExecutionLogFromBackend(result);
    } catch (error) {
      console.error('Tool execution log creation failed with error:', error);

      let errorMessage = 'Failed to create tool execution log';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Get tool execution logs for an interaction
   */
  async getToolExecutionLogs(
    interactionLogId: string
  ): Promise<ToolExecutionLog[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_tool_execution_logs',
        {
          interaction_log_id: interactionLogId,
        }
      );

      return result.map(log => this.transformToolExecutionLogFromBackend(log));
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.getToolLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Get logging configuration
   */
  async getLoggingConfig(): Promise<LoggingConfig> {
    try {
      const result =
        await invoke<Record<string, unknown>>('get_logging_config');
      return this.transformLoggingConfigFromBackend(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.getConfigFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Update logging configuration
   */
  async updateLoggingConfig(
    config: Partial<LoggingConfig>
  ): Promise<LoggingConfig> {
    try {
      const serializedConfig: Record<string, unknown> = {};

      if (config.enabled !== undefined) {
        serializedConfig.enabled = config.enabled;
      }
      if (config.logLevel !== undefined) {
        serializedConfig.log_level = config.logLevel;
      }
      if (config.retentionDays !== undefined) {
        serializedConfig.retention_days = config.retentionDays;
      }
      if (config.maxLogSize !== undefined) {
        serializedConfig.max_log_size = config.maxLogSize;
      }
      if (config.maxLogCount !== undefined) {
        serializedConfig.max_log_count = config.maxLogCount;
      }
      if (config.includeSystemPrompts !== undefined) {
        serializedConfig.include_system_prompts = config.includeSystemPrompts;
      }
      if (config.includeToolExecutions !== undefined) {
        serializedConfig.include_tool_executions = config.includeToolExecutions;
      }
      if (config.includePerformanceMetrics !== undefined) {
        serializedConfig.include_performance_metrics =
          config.includePerformanceMetrics;
      }
      if (config.autoCleanup !== undefined) {
        serializedConfig.auto_cleanup = config.autoCleanup;
      }
      if (config.exportFormat !== undefined) {
        serializedConfig.export_format = config.exportFormat;
      }

      const result = await invoke<Record<string, unknown>>(
        'update_logging_config',
        {
          config: serializedConfig,
        }
      );
      return this.transformLoggingConfigFromBackend(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.updateConfigFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Anonymize logs by removing sensitive data
   */
  async anonymizeLogs(logIds: string[]): Promise<void> {
    try {
      await invoke<string>('anonymize_ai_interaction_logs', {
        log_ids: logIds,
      });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.anonymizeLogsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Redact sensitive data from a specific log
   */
  async redactSensitiveData(logId: string): Promise<void> {
    try {
      await invoke<string>('redact_sensitive_data', {
        log_id: logId,
      });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'logStorageService.error.redactDataFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Safely parse date values from backend with fallback
   */
  private parseDate(dateValue: unknown): Date {
    if (!dateValue) {
      return new Date(); // Return current date as fallback
    }
    const date = new Date(dateValue as string);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  /**
   * Safely parse number values from backend with fallback
   */
  private parseNumber(numValue: unknown, fallback: number = 0): number {
    if (numValue === null || numValue === undefined) {
      return fallback;
    }
    const num = Number(numValue);
    return isNaN(num) ? fallback : num;
  }

  /**
   * Transform AI interaction log data from backend format to frontend format
   */
  private transformLogFromBackend(
    backendLog: Record<string, unknown>
  ): AIInteractionLog {
    return {
      id: (backendLog.id as string) || 'unknown',
      timestamp: this.parseDate(backendLog.timestamp),
      sessionId: (backendLog.session_id as string) || 'unknown',
      modelType: (backendLog.model_type as 'local' | 'gemini') || 'local',
      modelInfo: this.parseJsonField(backendLog.model_info as string, {
        name: 'unknown',
        provider: 'unknown',
      }),
      userMessage: (backendLog.user_message as string) || '',
      systemPrompt: backendLog.system_prompt as string | undefined,
      context: (backendLog.context as string) || '{}',
      aiResponse: (backendLog.ai_response as string) || '',
      actions: (backendLog.actions as string) || '[]',
      suggestions: (backendLog.suggestions as string) || '[]',
      reasoning: backendLog.reasoning as string | undefined,
      toolCalls: [], // Will be populated separately if needed
      responseTime: this.parseNumber(backendLog.response_time),
      tokenCount: backendLog.token_count
        ? this.parseNumber(backendLog.token_count)
        : undefined,
      error: backendLog.error as string | undefined,
      errorCode: backendLog.error_code as string | undefined,
      containsSensitiveData:
        (backendLog.contains_sensitive_data as boolean) || false,
      dataClassification:
        (backendLog.data_classification as
          | 'public'
          | 'internal'
          | 'confidential') || 'public',
      createdAt: this.parseDate(backendLog.created_at),
      updatedAt: this.parseDate(backendLog.updated_at),
    };
  }

  /**
   * Transform tool execution log data from backend format to frontend format
   */
  private transformToolExecutionLogFromBackend(
    backendLog: Record<string, unknown>
  ): ToolExecutionLog {
    return {
      id: (backendLog.id as string) || 'unknown',
      interactionLogId: (backendLog.interaction_log_id as string) || 'unknown',
      toolName: (backendLog.tool_name as string) || 'unknown',
      arguments: (backendLog.arguments as string) || '{}',
      result: (backendLog.result as string) || '',
      executionTime: this.parseNumber(backendLog.execution_time),
      success: (backendLog.success as boolean) || false,
      error: backendLog.error as string | undefined,
      createdAt: this.parseDate(backendLog.created_at),
    };
  }

  /**
   * Transform logging config data from backend format to frontend format
   */
  private transformLoggingConfigFromBackend(
    backendConfig: Record<string, unknown>
  ): LoggingConfig {
    return {
      enabled: (backendConfig.enabled as boolean) || false,
      logLevel:
        (backendConfig.log_level as 'minimal' | 'standard' | 'detailed') ||
        'standard',
      retentionDays: this.parseNumber(backendConfig.retention_days, 30),
      maxLogSize: this.parseNumber(backendConfig.max_log_size, 1000000),
      maxLogCount: this.parseNumber(backendConfig.max_log_count, 1000),
      includeSystemPrompts:
        (backendConfig.include_system_prompts as boolean) || false,
      includeToolExecutions:
        (backendConfig.include_tool_executions as boolean) || false,
      includePerformanceMetrics:
        (backendConfig.include_performance_metrics as boolean) || false,
      autoCleanup: (backendConfig.auto_cleanup as boolean) || false,
      exportFormat: (backendConfig.export_format as 'json' | 'csv') || 'json',
    };
  }

  /**
   * Parse JSON field with fallback
   */
  private parseJsonField<T>(value: string | null, fallback: T): T {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
