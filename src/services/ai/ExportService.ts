import { LogStorageService } from '../database/repositories/LogStorageService';
import { LogFilter, AIInteractionLog } from '../../types/aiLogging';
import { PrivacyFilter } from './PrivacyFilter';

export interface ExportOptions {
  format: 'json' | 'csv';
  filters?: LogFilter;
  includeToolCalls?: boolean;
  includeSensitiveData?: boolean;
  anonymizeData?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  totalLogs: number;
  fileSize: number;
  containsSensitiveData: boolean;
}

export interface ExportProgress {
  stage: 'fetching' | 'processing' | 'generating' | 'complete';
  progress: number;
  message: string;
}

export class ExportService {
  private logStorageService: LogStorageService;
  private privacyFilter: PrivacyFilter;

  constructor() {
    this.logStorageService = new LogStorageService();
    this.privacyFilter = new PrivacyFilter();
  }

  /**
   * Export logs with comprehensive error handling and retry logic
   */
  async exportLogs(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const {
      format,
      filters,
      includeToolCalls = true,
      includeSensitiveData = true,
      anonymizeData = false,
      maxRetries = 3,
      retryDelay = 1000,
    } = options;

    let lastError: Error | null = null;
    let currentRetryDelay = retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        onProgress?.({
          stage: 'fetching',
          progress: 10,
          message: 'Fetching logs from database...',
        });

        // Fetch logs with filters
        const logs = await this.logStorageService.getInteractionLogs(filters);

        if (logs.length === 0) {
          throw new Error('No logs found matching the specified criteria');
        }

        onProgress?.({
          stage: 'processing',
          progress: 30,
          message: 'Processing log data...',
        });

        // Process logs based on options
        const processedLogs = await this.processLogs(logs, {
          includeToolCalls,
          includeSensitiveData,
          anonymizeData,
        });

        onProgress?.({
          stage: 'generating',
          progress: 70,
          message: 'Generating export file...',
        });

        // Generate export data
        const exportData =
          format === 'json'
            ? await this.generateJsonExport(processedLogs)
            : await this.generateCsvExport(processedLogs);

        const blob = new Blob([exportData], {
          type: format === 'json' ? 'application/json' : 'text/csv',
        });

        // Generate filename
        const filename = this.generateFilename(format, filters);

        // Check for sensitive data in original logs (before processing)
        const containsSensitiveData = logs.some(
          log => log.containsSensitiveData
        );

        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'Export completed successfully',
        });

        return {
          blob,
          filename,
          totalLogs: processedLogs.length,
          fileSize: blob.size,
          containsSensitiveData,
        };
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error('Unknown export error');

        if (attempt < maxRetries) {
          console.warn(
            `Export attempt ${attempt} failed, retrying in ${currentRetryDelay}ms:`,
            lastError.message
          );
          await this.delay(currentRetryDelay);
          currentRetryDelay *= 2; // Exponential backoff
        }
      }
    }

    throw new Error(
      `Export failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Process logs based on export options
   */
  private async processLogs(
    logs: AIInteractionLog[],
    options: {
      includeToolCalls: boolean;
      includeSensitiveData: boolean;
      anonymizeData: boolean;
    }
  ): Promise<AIInteractionLog[]> {
    let processedLogs = [...logs];

    // Apply privacy filtering based on options
    if (options.anonymizeData) {
      // Anonymize all logs
      processedLogs = processedLogs.map(log =>
        this.privacyFilter.anonymizeInteractionLog(log)
      );
    } else if (!options.includeSensitiveData) {
      // Redact sensitive data from logs instead of filtering them out
      processedLogs = processedLogs.map(log => {
        if (
          log.containsSensitiveData ||
          log.dataClassification === 'confidential'
        ) {
          return this.privacyFilter.redactInteractionLog(log);
        }
        return log;
      });
    }

    // Load tool calls if requested
    if (options.includeToolCalls) {
      for (const log of processedLogs) {
        try {
          const toolCalls = await this.logStorageService.getToolExecutionLogs(
            log.id
          );
          log.toolCalls = toolCalls;
        } catch (error) {
          console.warn(`Failed to load tool calls for log ${log.id}:`, error);
          log.toolCalls = [];
        }
      }
    }

    return processedLogs;
  }

  /**
   * Generate JSON export data
   */
  private async generateJsonExport(logs: AIInteractionLog[]): Promise<string> {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        totalLogs: logs.length,
        format: 'json',
      },
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        sessionId: log.sessionId,
        modelType: log.modelType,
        modelInfo: log.modelInfo,
        userMessage: log.userMessage,
        systemPrompt: log.systemPrompt,
        context: log.context,
        aiResponse: log.aiResponse,
        actions: log.actions,
        suggestions: log.suggestions,
        reasoning: log.reasoning,
        toolCalls:
          log.toolCalls?.map(tc => ({
            id: tc.id,
            toolName: tc.toolName,
            arguments: tc.arguments,
            result: tc.result,
            executionTime: tc.executionTime,
            success: tc.success,
            error: tc.error,
            createdAt: tc.createdAt.toISOString(),
          })) || [],
        responseTime: log.responseTime,
        tokenCount: log.tokenCount,
        error: log.error,
        errorCode: log.errorCode,
        containsSensitiveData: log.containsSensitiveData,
        dataClassification: log.dataClassification,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate CSV export data
   */
  private async generateCsvExport(logs: AIInteractionLog[]): Promise<string> {
    const headers = [
      'ID',
      'Timestamp',
      'Session ID',
      'Model Type',
      'Model Name',
      'User Message',
      'AI Response',
      'Response Time (ms)',
      'Token Count',
      'Tool Calls Count',
      'Has Error',
      'Error Message',
      'Contains Sensitive Data',
      'Data Classification',
      'Created At',
    ];

    const rows = logs.map(log => [
      this.escapeCsvValue(log.id),
      this.escapeCsvValue(log.timestamp.toISOString()),
      this.escapeCsvValue(log.sessionId),
      this.escapeCsvValue(log.modelType),
      this.escapeCsvValue(log.modelInfo?.name || 'Unknown'),
      this.escapeCsvValue(log.userMessage),
      this.escapeCsvValue(log.aiResponse),
      log.responseTime.toString(),
      (log.tokenCount || 0).toString(),
      (log.toolCalls?.length || 0).toString(),
      (!!log.error).toString(),
      this.escapeCsvValue(log.error || ''),
      log.containsSensitiveData.toString(),
      this.escapeCsvValue(log.dataClassification),
      this.escapeCsvValue(log.createdAt.toISOString()),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
    return csvContent;
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private escapeCsvValue(value: string): string {
    if (!value) {
      return '';
    }

    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Generate filename based on export options
   */
  private generateFilename(
    format: 'json' | 'csv',
    filters?: LogFilter
  ): string {
    const timestamp = new Date().toISOString().split('T')[0];

    let filename = 'ai-interaction-logs';

    // Add date range if specified
    if (filters?.startDate && filters?.endDate) {
      const startDate = filters.startDate.toISOString().split('T')[0];
      const endDate = filters.endDate.toISOString().split('T')[0];
      filename += `_${startDate}_to_${endDate}`;
    } else {
      filename += `_${timestamp}`;
    }

    // Add model type if specified
    if (filters?.modelType) {
      filename += `_${filters.modelType}`;
    }

    // Add error filter if specified
    if (filters?.hasErrors === true) {
      filename += '_errors-only';
    } else if (filters?.hasErrors === false) {
      filename += '_success-only';
    }

    // Add tool calls filter if specified
    if (filters?.containsToolCalls === true) {
      filename += '_with-tools';
    } else if (filters?.containsToolCalls === false) {
      filename += '_no-tools';
    }

    return `${filename}.${format}`;
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): string[] {
    const errors: string[] = [];

    if (!['json', 'csv'].includes(options.format)) {
      errors.push('Invalid export format. Must be "json" or "csv".');
    }

    if (
      options.maxRetries !== undefined &&
      (options.maxRetries < 1 || options.maxRetries > 10)
    ) {
      errors.push('Max retries must be between 1 and 10.');
    }

    if (
      options.retryDelay !== undefined &&
      (options.retryDelay < 100 || options.retryDelay > 10000)
    ) {
      errors.push('Retry delay must be between 100ms and 10 seconds.');
    }

    if (options.filters?.startDate && options.filters?.endDate) {
      if (options.filters.startDate > options.filters.endDate) {
        errors.push('Start date must be before end date.');
      }
    }

    return errors;
  }
}
