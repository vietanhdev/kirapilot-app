import { ExportService, ExportOptions } from '../ExportService';
import { LogStorageService } from '../../database/repositories/LogStorageService';
import { AIInteractionLog, ToolExecutionLog } from '../../../types/aiLogging';

// Mock the LogStorageService
jest.mock('../../database/repositories/LogStorageService');

// Mock Blob
class MockBlob {
  size: number;
  type: string;
  content: string;

  constructor(content: string[], options?: { type?: string }) {
    this.content = content[0] || '';
    this.size = this.content.length;
    this.type = options?.type || 'text/plain';
  }

  async text(): Promise<string> {
    return this.content;
  }
}

global.Blob = MockBlob as typeof Blob;

describe('ExportService', () => {
  let exportService: ExportService;
  let mockLogStorageService: jest.Mocked<LogStorageService>;

  const mockLog: AIInteractionLog = {
    id: 'log-1',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    sessionId: 'session-1',
    modelType: 'local',
    modelInfo: { name: 'Test Model', provider: 'local' },
    userMessage: 'Test user message',
    systemPrompt: 'Test system prompt',
    context: 'Test context',
    aiResponse: 'Test AI response',
    actions: 'Test actions',
    suggestions: 'Test suggestions',
    reasoning: 'Test reasoning',
    toolCalls: [],
    responseTime: 1000,
    tokenCount: 100,
    error: undefined,
    errorCode: undefined,
    containsSensitiveData: false,
    dataClassification: 'internal',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };

  const mockToolCall: ToolExecutionLog = {
    id: 'tool-1',
    interactionLogId: 'log-1',
    toolName: 'test-tool',
    arguments: 'test args',
    result: 'test result',
    executionTime: 500,
    success: true,
    error: undefined,
    createdAt: new Date('2024-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    exportService = new ExportService();
    mockLogStorageService =
      new LogStorageService() as jest.Mocked<LogStorageService>;

    // Access the private property for testing
    (
      exportService as unknown as {
        logStorageService: typeof mockLogStorageService;
      }
    ).logStorageService = mockLogStorageService;
  });

  describe('exportLogs', () => {
    it('should export logs in JSON format successfully', async () => {
      const options: ExportOptions = {
        format: 'json',
        filters: { modelType: 'local' },
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLog]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([
        mockToolCall,
      ]);

      const result = await exportService.exportLogs(options);

      expect(result.blob).toBeInstanceOf(MockBlob);
      expect(result.filename).toMatch(/ai-interaction-logs.*\.json$/);
      expect(result.totalLogs).toBe(1);
      expect(result.containsSensitiveData).toBe(false);
      expect(mockLogStorageService.getInteractionLogs).toHaveBeenCalledWith(
        options.filters
      );
    });

    it('should export logs in CSV format successfully', async () => {
      const options: ExportOptions = {
        format: 'csv',
        filters: { modelType: 'local' },
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLog]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

      const result = await exportService.exportLogs(options);

      expect(result.blob).toBeInstanceOf(MockBlob);
      expect(result.filename).toMatch(/ai-interaction-logs.*\.csv$/);
      expect(result.totalLogs).toBe(1);
      expect(result.blob.type).toBe('text/csv');
    });

    it('should handle sensitive data correctly', async () => {
      const sensitiveLog = {
        ...mockLog,
        containsSensitiveData: true,
      };

      const options: ExportOptions = {
        format: 'json',
        includeSensitiveData: false,
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([
        sensitiveLog,
      ]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

      const result = await exportService.exportLogs(options);

      expect(result.containsSensitiveData).toBe(true);

      // Check that sensitive data was redacted
      const blobText = await result.blob.text();
      const exportData = JSON.parse(blobText);
      expect(exportData.logs[0].userMessage).toBe(
        '[REDACTED - SENSITIVE DATA]'
      );
      expect(exportData.logs[0].aiResponse).toBe('[REDACTED - SENSITIVE DATA]');
    });

    it('should include tool calls when requested', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeToolCalls: true,
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLog]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([
        mockToolCall,
      ]);

      const result = await exportService.exportLogs(options);

      expect(mockLogStorageService.getToolExecutionLogs).toHaveBeenCalledWith(
        mockLog.id
      );

      const blobText = await result.blob.text();
      const exportData = JSON.parse(blobText);
      expect(exportData.logs[0].toolCalls).toHaveLength(1);
      expect(exportData.logs[0].toolCalls[0].toolName).toBe('test-tool');
    });

    it('should exclude tool calls when not requested', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeToolCalls: false,
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLog]);

      await exportService.exportLogs(options);

      expect(mockLogStorageService.getToolExecutionLogs).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      const options: ExportOptions = {
        format: 'json',
        maxRetries: 2,
        retryDelay: 100,
      };

      mockLogStorageService.getInteractionLogs
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([mockLog]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

      await exportService.exportLogs(options);

      expect(mockLogStorageService.getInteractionLogs).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const options: ExportOptions = {
        format: 'json',
        maxRetries: 2,
        retryDelay: 100,
      };

      mockLogStorageService.getInteractionLogs.mockRejectedValue(
        new Error('Database error')
      );

      await expect(exportService.exportLogs(options)).rejects.toThrow(
        'Export failed after 2 attempts: Database error'
      );
      expect(mockLogStorageService.getInteractionLogs).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no logs found', async () => {
      const options: ExportOptions = {
        format: 'json',
      };

      mockLogStorageService.getInteractionLogs.mockResolvedValue([]);

      await expect(exportService.exportLogs(options)).rejects.toThrow(
        'No logs found matching the specified criteria'
      );
    });

    it('should call progress callback', async () => {
      const options: ExportOptions = {
        format: 'json',
      };

      const progressCallback = jest.fn();
      mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLog]);
      mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

      await exportService.exportLogs(options, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'fetching',
        progress: 10,
        message: 'Fetching logs from database...',
      });
      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'complete',
        progress: 100,
        message: 'Export completed successfully',
      });
    });
  });

  describe('validateExportOptions', () => {
    it('should validate format correctly', () => {
      const validOptions: ExportOptions = { format: 'json' };
      const invalidOptions = { format: 'xml' as 'json' | 'csv' };

      expect(exportService.validateExportOptions(validOptions)).toEqual([]);
      expect(exportService.validateExportOptions(invalidOptions)).toContain(
        'Invalid export format. Must be "json" or "csv".'
      );
    });

    it('should validate retry options', () => {
      const invalidRetries: ExportOptions = { format: 'json', maxRetries: 0 };
      const invalidDelay: ExportOptions = { format: 'json', retryDelay: 50 };

      expect(exportService.validateExportOptions(invalidRetries)).toContain(
        'Max retries must be between 1 and 10.'
      );
      expect(exportService.validateExportOptions(invalidDelay)).toContain(
        'Retry delay must be between 100ms and 10 seconds.'
      );
    });

    it('should validate date range', () => {
      const invalidDateRange: ExportOptions = {
        format: 'json',
        filters: {
          startDate: new Date('2024-01-02'),
          endDate: new Date('2024-01-01'),
        },
      };

      expect(exportService.validateExportOptions(invalidDateRange)).toContain(
        'Start date must be before end date.'
      );
    });
  });

  describe('filename generation', () => {
    it('should generate filename with date range', () => {
      const service = exportService as unknown as {
        generateFilename: (
          format: string,
          filters?: Record<string, unknown>
        ) => string;
      };
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const filename = service.generateFilename('json', filters);
      expect(filename).toBe(
        'ai-interaction-logs_2024-01-01_to_2024-01-31.json'
      );
    });

    it('should generate filename with model type', () => {
      const service = exportService as unknown as {
        generateFilename: (
          format: string,
          filters?: Record<string, unknown>
        ) => string;
      };
      const filters = { modelType: 'local' };

      const filename = service.generateFilename('csv', filters);
      expect(filename).toMatch(
        /ai-interaction-logs_\d{4}-\d{2}-\d{2}_local\.csv/
      );
    });

    it('should generate filename with error filter', () => {
      const service = exportService as unknown as {
        generateFilename: (
          format: string,
          filters?: Record<string, unknown>
        ) => string;
      };
      const filters = { hasErrors: true };

      const filename = service.generateFilename('json', filters);
      expect(filename).toMatch(
        /ai-interaction-logs_\d{4}-\d{2}-\d{2}_errors-only\.json/
      );
    });
  });

  describe('CSV generation', () => {
    it('should escape CSV values correctly', () => {
      const service = exportService as unknown as {
        escapeCsvValue: (value: string) => string;
      };

      expect(service.escapeCsvValue('simple')).toBe('simple');
      expect(service.escapeCsvValue('with,comma')).toBe('"with,comma"');
      expect(service.escapeCsvValue('with"quote')).toBe('"with""quote"');
      expect(service.escapeCsvValue('with\nnewline')).toBe('"with\nnewline"');
      expect(service.escapeCsvValue('')).toBe('');
    });

    it('should generate valid CSV content', async () => {
      const service = exportService as unknown as {
        generateCsvExport: (logs: unknown[]) => Promise<string>;
      };
      const logs = [mockLog];

      const csvContent = await service.generateCsvExport(logs);
      const lines = csvContent.split('\n');

      expect(lines[0]).toContain('ID,Timestamp,Session ID');
      expect(lines[1]).toContain('log-1,2024-01-01T10:00:00.000Z,session-1');
    });
  });
});
