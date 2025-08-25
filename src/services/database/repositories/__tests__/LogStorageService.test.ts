// Tests for LogStorageService (SeaORM backend)
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the Tauri invoke function
const mockInvoke = jest.fn() as jest.MockedFunction<
  typeof import('@tauri-apps/api/core').invoke
>;
jest.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Mock the database initialization
jest.mock('../../index', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(void 0),
  getDatabaseErrorMessage: jest.fn((key: string) => key),
}));

// Mock Blob for Node.js test environment
interface MockBlobOptions {
  type: string;
}

class MockBlob {
  constructor(
    public content: string[],
    public options: MockBlobOptions
  ) {}
  get type() {
    return this.options.type;
  }
}

(global as { Blob: typeof MockBlob }).Blob = MockBlob;

import { LogStorageService } from '../LogStorageService';

describe('LogStorageService', () => {
  let service: LogStorageService;

  beforeEach(() => {
    service = new LogStorageService();
    mockInvoke.mockClear();
  });

  describe('logInteraction', () => {
    test('should create a new AI interaction log', async () => {
      const logRequest = {
        sessionId: 'session-123',
        modelType: 'local' as const,
        modelInfo: {
          name: 'llama-3.2',
          version: '3.2',
          provider: 'local',
        },
        userMessage: 'Hello, AI!',
        systemPrompt: 'You are a helpful assistant.',
        context: JSON.stringify({ currentTask: null }),
        aiResponse: 'Hello! How can I help you today?',
        actions: JSON.stringify([]),
        suggestions: JSON.stringify([]),
        reasoning: 'Simple greeting response',
        responseTime: 1500,
        tokenCount: 25,
        containsSensitiveData: false,
        dataClassification: 'public' as const,
      };

      const mockBackendLog = {
        id: 'log-123',
        timestamp: new Date().toISOString(),
        session_id: logRequest.sessionId,
        model_type: logRequest.modelType,
        model_info: JSON.stringify(logRequest.modelInfo),
        user_message: logRequest.userMessage,
        system_prompt: logRequest.systemPrompt,
        context: logRequest.context,
        ai_response: logRequest.aiResponse,
        actions: logRequest.actions,
        suggestions: logRequest.suggestions,
        reasoning: logRequest.reasoning,
        response_time: logRequest.responseTime,
        token_count: logRequest.tokenCount,
        error: null,
        error_code: null,
        contains_sensitive_data: logRequest.containsSensitiveData,
        data_classification: logRequest.dataClassification,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockBackendLog);

      const log = await service.logInteraction(logRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_ai_interaction_log', {
        request: {
          session_id: logRequest.sessionId,
          model_type: logRequest.modelType,
          model_info: logRequest.modelInfo,
          user_message: logRequest.userMessage,
          system_prompt: logRequest.systemPrompt,
          context: logRequest.context,
          ai_response: logRequest.aiResponse,
          actions: logRequest.actions,
          suggestions: logRequest.suggestions,
          reasoning: logRequest.reasoning,
          response_time: logRequest.responseTime,
          token_count: logRequest.tokenCount,
          error: undefined,
          error_code: undefined,
          contains_sensitive_data: logRequest.containsSensitiveData,
          data_classification: logRequest.dataClassification,
        },
      });

      expect(log.id).toBe('log-123');
      expect(log.sessionId).toBe(logRequest.sessionId);
      expect(log.modelType).toBe(logRequest.modelType);
      expect(log.userMessage).toBe(logRequest.userMessage);
      expect(log.aiResponse).toBe(logRequest.aiResponse);
      expect(log.responseTime).toBe(logRequest.responseTime);
      expect(log.tokenCount).toBe(logRequest.tokenCount);
      expect(log.containsSensitiveData).toBe(false);
      expect(log.dataClassification).toBe('public');
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.createdAt).toBeInstanceOf(Date);
      expect(log.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle creation errors', async () => {
      const logRequest = {
        sessionId: 'session-123',
        modelType: 'local' as const,
        modelInfo: { name: 'test-model', provider: 'local' },
        userMessage: 'Test message',
        context: '{}',
        aiResponse: 'Test response',
        actions: '[]',
        suggestions: '[]',
        responseTime: 1000,
      };

      mockInvoke.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.logInteraction(logRequest)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getInteractionLogs', () => {
    test('should return all logs without filters', async () => {
      const mockBackendLogs = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          session_id: 'session-1',
          model_type: 'local',
          model_info: JSON.stringify({ name: 'llama-3.2', provider: 'local' }),
          user_message: 'First message',
          system_prompt: null,
          context: '{}',
          ai_response: 'First response',
          actions: '[]',
          suggestions: '[]',
          reasoning: null,
          response_time: 1000,
          token_count: 20,
          error: null,
          error_code: null,
          contains_sensitive_data: false,
          data_classification: 'internal',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'log-2',
          timestamp: new Date().toISOString(),
          session_id: 'session-2',
          model_type: 'gemini',
          model_info: JSON.stringify({
            name: 'gemini-pro',
            provider: 'google',
          }),
          user_message: 'Second message',
          system_prompt: 'You are helpful',
          context: '{}',
          ai_response: 'Second response',
          actions: '[]',
          suggestions: '[]',
          reasoning: 'Simple response',
          response_time: 800,
          token_count: 15,
          error: null,
          error_code: null,
          contains_sensitive_data: true,
          data_classification: 'confidential',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendLogs);

      const logs = await service.getInteractionLogs();

      expect(mockInvoke).toHaveBeenCalledWith('get_ai_interaction_logs', {
        filters: {},
      });
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('log-1');
      expect(logs[0].modelType).toBe('local');
      expect(logs[1].id).toBe('log-2');
      expect(logs[1].modelType).toBe('gemini');
    });

    test('should filter logs by model type', async () => {
      const mockBackendLogs = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          session_id: 'session-1',
          model_type: 'local',
          model_info: JSON.stringify({ name: 'llama-3.2', provider: 'local' }),
          user_message: 'Local message',
          system_prompt: null,
          context: '{}',
          ai_response: 'Local response',
          actions: '[]',
          suggestions: '[]',
          reasoning: null,
          response_time: 1000,
          token_count: 20,
          error: null,
          error_code: null,
          contains_sensitive_data: false,
          data_classification: 'internal',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendLogs);

      const filters = { modelType: 'local' as const };
      const logs = await service.getInteractionLogs(filters);

      expect(mockInvoke).toHaveBeenCalledWith('get_ai_interaction_logs', {
        filters: {
          start_date: undefined,
          end_date: undefined,
          model_type: 'local',
          has_errors: undefined,
          contains_tool_calls: undefined,
          search_text: undefined,
          limit: undefined,
          offset: undefined,
        },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].modelType).toBe('local');
    });

    test('should filter logs by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockBackendLogs: Record<string, unknown>[] = [];

      mockInvoke.mockResolvedValue(mockBackendLogs);

      const filters = { startDate, endDate };
      await service.getInteractionLogs(filters);

      expect(mockInvoke).toHaveBeenCalledWith('get_ai_interaction_logs', {
        filters: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          model_type: undefined,
          has_errors: undefined,
          contains_tool_calls: undefined,
          search_text: undefined,
          limit: undefined,
          offset: undefined,
        },
      });
    });
  });

  describe('getInteractionLog', () => {
    test('should return specific log by ID', async () => {
      const mockBackendLog = {
        id: 'log-123',
        timestamp: new Date().toISOString(),
        session_id: 'session-123',
        model_type: 'local',
        model_info: JSON.stringify({ name: 'llama-3.2', provider: 'local' }),
        user_message: 'Test message',
        system_prompt: null,
        context: '{}',
        ai_response: 'Test response',
        actions: '[]',
        suggestions: '[]',
        reasoning: null,
        response_time: 1000,
        token_count: 20,
        error: null,
        error_code: null,
        contains_sensitive_data: false,
        data_classification: 'internal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockBackendLog);

      const log = await service.getInteractionLog('log-123');

      expect(mockInvoke).toHaveBeenCalledWith('get_ai_interaction_log', {
        id: 'log-123',
      });
      expect(log).not.toBeNull();
      expect(log!.id).toBe('log-123');
      expect(log!.userMessage).toBe('Test message');
    });

    test('should return null for non-existent log', async () => {
      mockInvoke.mockResolvedValue(null);

      const log = await service.getInteractionLog('non-existent');

      expect(log).toBeNull();
    });
  });

  describe('updateInteractionLog', () => {
    test('should update log properties', async () => {
      const mockUpdatedLog = {
        id: 'log-123',
        timestamp: new Date().toISOString(),
        session_id: 'session-123',
        model_type: 'local',
        model_info: JSON.stringify({ name: 'llama-3.2', provider: 'local' }),
        user_message: 'Original message',
        system_prompt: null,
        context: '{}',
        ai_response: 'Updated response',
        actions: JSON.stringify([{ type: 'CREATE_TASK' }]),
        suggestions: '[]',
        reasoning: 'Updated reasoning',
        response_time: 1200,
        token_count: 30,
        error: null,
        error_code: null,
        contains_sensitive_data: false,
        data_classification: 'internal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockUpdatedLog);

      const updateRequest = {
        aiResponse: 'Updated response',
        actions: JSON.stringify([{ type: 'CREATE_TASK' }]),
        reasoning: 'Updated reasoning',
        responseTime: 1200,
        tokenCount: 30,
      };

      const updatedLog = await service.updateInteractionLog(
        'log-123',
        updateRequest
      );

      expect(mockInvoke).toHaveBeenCalledWith('update_ai_interaction_log', {
        id: 'log-123',
        request: {
          ai_response: 'Updated response',
          actions: JSON.stringify([{ type: 'CREATE_TASK' }]),
          reasoning: 'Updated reasoning',
          response_time: 1200,
          token_count: 30,
        },
      });
      expect(updatedLog.aiResponse).toBe('Updated response');
      expect(updatedLog.reasoning).toBe('Updated reasoning');
      expect(updatedLog.responseTime).toBe(1200);
      expect(updatedLog.tokenCount).toBe(30);
    });
  });

  describe('deleteInteractionLog', () => {
    test('should delete log', async () => {
      mockInvoke.mockResolvedValue('Log deleted successfully');

      await service.deleteInteractionLog('log-123');

      expect(mockInvoke).toHaveBeenCalledWith('delete_ai_interaction_log', {
        id: 'log-123',
      });
    });
  });

  describe('clearAllLogs', () => {
    test('should clear all logs', async () => {
      mockInvoke.mockResolvedValue('All logs cleared successfully');

      await service.clearAllLogs();

      expect(mockInvoke).toHaveBeenCalledWith('clear_all_ai_interaction_logs');
    });
  });

  describe('exportLogs', () => {
    test('should export logs in JSON format', async () => {
      const mockExportData = JSON.stringify([
        { id: 'log-1', message: 'Test message 1' },
        { id: 'log-2', message: 'Test message 2' },
      ]);

      mockInvoke.mockResolvedValue(mockExportData);

      const blob = await service.exportLogs(undefined, 'json');

      expect(mockInvoke).toHaveBeenCalledWith('export_ai_interaction_logs', {
        filters: {},
        format: 'json',
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    test('should export logs in CSV format', async () => {
      const mockExportData =
        'id,message\nlog-1,Test message 1\nlog-2,Test message 2';

      mockInvoke.mockResolvedValue(mockExportData);

      const blob = await service.exportLogs(undefined, 'csv');

      expect(mockInvoke).toHaveBeenCalledWith('export_ai_interaction_logs', {
        filters: {},
        format: 'csv',
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });

    test('should export logs with filters', async () => {
      const mockExportData = '[]';
      const filters = {
        modelType: 'local' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      mockInvoke.mockResolvedValue(mockExportData);

      await service.exportLogs(filters, 'json');

      expect(mockInvoke).toHaveBeenCalledWith('export_ai_interaction_logs', {
        filters: {
          start_date: filters.startDate.toISOString(),
          end_date: filters.endDate.toISOString(),
          model_type: 'local',
          has_errors: undefined,
          contains_tool_calls: undefined,
          search_text: undefined,
          limit: undefined,
          offset: undefined,
        },
        format: 'json',
      });
    });
  });

  describe('cleanupOldLogs', () => {
    test('should cleanup old logs and return count', async () => {
      mockInvoke.mockResolvedValue(15);

      const deletedCount = await service.cleanupOldLogs();

      expect(mockInvoke).toHaveBeenCalledWith(
        'cleanup_old_ai_interaction_logs'
      );
      expect(deletedCount).toBe(15);
    });
  });

  describe('getStorageStats', () => {
    test('should return storage statistics', async () => {
      const mockStats = {
        total_logs: 100,
        total_size: 1048576, // 1MB
        oldest_log: new Date('2024-01-01').toISOString(),
        newest_log: new Date('2024-01-31').toISOString(),
        logs_by_model: {
          local: 60,
          gemini: 40,
        },
        average_response_time: 1250,
      };

      mockInvoke.mockResolvedValue(mockStats);

      const stats = await service.getStorageStats();

      expect(mockInvoke).toHaveBeenCalledWith('get_ai_interaction_log_stats');
      expect(stats.totalLogs).toBe(100);
      expect(stats.totalSize).toBe(1048576);
      expect(stats.oldestLog).toBeInstanceOf(Date);
      expect(stats.newestLog).toBeInstanceOf(Date);
      expect(stats.logsByModel.local).toBe(60);
      expect(stats.logsByModel.gemini).toBe(40);
      expect(stats.averageResponseTime).toBe(1250);
    });
  });

  describe('logToolExecution', () => {
    test('should create tool execution log', async () => {
      const toolLogRequest = {
        interactionLogId: 'log-123',
        toolName: 'create_task',
        arguments: JSON.stringify({ title: 'New Task' }),
        result: JSON.stringify({ success: true, taskId: 'task-456' }),
        executionTime: 250,
        success: true,
      };

      const mockBackendToolLog = {
        id: 'tool-log-123',
        interaction_log_id: toolLogRequest.interactionLogId,
        tool_name: toolLogRequest.toolName,
        arguments: toolLogRequest.arguments,
        result: toolLogRequest.result,
        execution_time: toolLogRequest.executionTime,
        success: toolLogRequest.success,
        error: null,
        created_at: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(mockBackendToolLog);

      const toolLog = await service.logToolExecution(toolLogRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_tool_execution_log', {
        request: {
          interaction_log_id: toolLogRequest.interactionLogId,
          tool_name: toolLogRequest.toolName,
          arguments: toolLogRequest.arguments,
          result: toolLogRequest.result,
          execution_time: toolLogRequest.executionTime,
          success: toolLogRequest.success,
          error: undefined,
        },
      });
      expect(toolLog.id).toBe('tool-log-123');
      expect(toolLog.interactionLogId).toBe(toolLogRequest.interactionLogId);
      expect(toolLog.toolName).toBe(toolLogRequest.toolName);
      expect(toolLog.success).toBe(true);
      expect(toolLog.executionTime).toBe(250);
    });
  });

  describe('getLoggingConfig', () => {
    test('should return logging configuration', async () => {
      const mockConfig = {
        enabled: true,
        log_level: 'standard',
        retention_days: 30,
        max_log_size: 10485760,
        include_system_prompts: true,
        include_tool_executions: true,
        include_performance_metrics: true,
        auto_cleanup: true,
        export_format: 'json',
      };

      mockInvoke.mockResolvedValue(mockConfig);

      const config = await service.getLoggingConfig();

      expect(mockInvoke).toHaveBeenCalledWith('get_logging_config');
      expect(config.enabled).toBe(true);
      expect(config.logLevel).toBe('standard');
      expect(config.retentionDays).toBe(30);
      expect(config.maxLogSize).toBe(10485760);
      expect(config.includeSystemPrompts).toBe(true);
      expect(config.includeToolExecutions).toBe(true);
      expect(config.includePerformanceMetrics).toBe(true);
      expect(config.autoCleanup).toBe(true);
      expect(config.exportFormat).toBe('json');
    });
  });

  describe('updateLoggingConfig', () => {
    test('should update logging configuration', async () => {
      const mockUpdatedConfig = {
        enabled: false,
        log_level: 'minimal',
        retention_days: 7,
        max_log_size: 5242880,
        include_system_prompts: false,
        include_tool_executions: true,
        include_performance_metrics: false,
        auto_cleanup: false,
        export_format: 'csv',
      };

      mockInvoke.mockResolvedValue(mockUpdatedConfig);

      const configUpdate = {
        enabled: false,
        logLevel: 'minimal' as const,
        retentionDays: 7,
        maxLogSize: 5242880,
        includeSystemPrompts: false,
        includePerformanceMetrics: false,
        autoCleanup: false,
        exportFormat: 'csv' as const,
      };

      const updatedConfig = await service.updateLoggingConfig(configUpdate);

      expect(mockInvoke).toHaveBeenCalledWith('update_logging_config', {
        config: {
          enabled: false,
          log_level: 'minimal',
          retention_days: 7,
          max_log_size: 5242880,
          include_system_prompts: false,
          include_performance_metrics: false,
          auto_cleanup: false,
          export_format: 'csv',
        },
      });
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.logLevel).toBe('minimal');
      expect(updatedConfig.retentionDays).toBe(7);
      expect(updatedConfig.exportFormat).toBe('csv');
    });
  });

  describe('anonymizeLogs', () => {
    test('should anonymize specified logs', async () => {
      mockInvoke.mockResolvedValue('Logs anonymized successfully');

      const logIds = ['log-1', 'log-2', 'log-3'];
      await service.anonymizeLogs(logIds);

      expect(mockInvoke).toHaveBeenCalledWith('anonymize_ai_interaction_logs', {
        log_ids: logIds,
      });
    });
  });

  describe('redactSensitiveData', () => {
    test('should redact sensitive data from log', async () => {
      mockInvoke.mockResolvedValue('Sensitive data redacted successfully');

      await service.redactSensitiveData('log-123');

      expect(mockInvoke).toHaveBeenCalledWith('redact_sensitive_data', {
        log_id: 'log-123',
      });
    });
  });
});
