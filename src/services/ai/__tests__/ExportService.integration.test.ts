import { ExportService } from '../ExportService';
import { LogStorageService } from '../../database/repositories/LogStorageService';
import { AIInteractionLog } from '../../../types/aiLogging';

// Mock the LogStorageService
jest.mock('../../database/repositories/LogStorageService');

// Mock Blob for integration tests
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

describe('ExportService Integration', () => {
  let exportService: ExportService;
  let mockLogStorageService: jest.Mocked<LogStorageService>;

  const mockLogs: AIInteractionLog[] = [
    {
      id: 'log-1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sessionId: 'session-1',
      modelType: 'local',
      modelInfo: { name: 'Test Model', provider: 'local' },
      userMessage: 'Hello, how are you?',
      systemPrompt: 'You are a helpful assistant',
      context: 'Test context',
      aiResponse: 'I am doing well, thank you!',
      actions: 'No actions',
      suggestions: 'No suggestions',
      reasoning: 'Simple greeting response',
      toolCalls: [],
      responseTime: 1500,
      tokenCount: 25,
      error: undefined,
      errorCode: undefined,
      containsSensitiveData: false,
      dataClassification: 'internal',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'log-2',
      timestamp: new Date('2024-01-01T11:00:00Z'),
      sessionId: 'session-2',
      modelType: 'gemini',
      modelInfo: { name: 'Gemini Pro', provider: 'google' },
      userMessage: 'What is my API key?',
      systemPrompt: 'You are a helpful assistant',
      context: 'Test context',
      aiResponse: 'I cannot access your API key for security reasons.',
      actions: 'No actions',
      suggestions: 'No suggestions',
      reasoning: 'Security-focused response',
      toolCalls: [],
      responseTime: 800,
      tokenCount: 18,
      error: undefined,
      errorCode: undefined,
      containsSensitiveData: true,
      dataClassification: 'confidential',
      createdAt: new Date('2024-01-01T11:00:00Z'),
      updatedAt: new Date('2024-01-01T11:00:00Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    exportService = new ExportService();
    mockLogStorageService =
      new LogStorageService() as jest.Mocked<LogStorageService>;

    // Access the private property for testing
    (
      exportService as { logStorageService: typeof mockLogStorageService }
    ).logStorageService = mockLogStorageService;
  });

  it('should export filtered logs with privacy warnings', async () => {
    const options = {
      format: 'json' as const,
      filters: {
        modelType: 'local' as const,
      },
    };

    // Mock only local model logs
    mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLogs[0]]);
    mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

    const result = await exportService.exportLogs(options);

    expect(result.totalLogs).toBe(1);
    expect(result.containsSensitiveData).toBe(false);
    expect(result.filename).toMatch(/ai-interaction-logs.*_local\.json$/);

    // Verify the exported content
    const exportedContent = await result.blob.text();
    const exportData = JSON.parse(exportedContent);

    expect(exportData.metadata.totalLogs).toBe(1);
    expect(exportData.logs).toHaveLength(1);
    expect(exportData.logs[0].modelType).toBe('local');
    expect(exportData.logs[0].userMessage).toBe('Hello, how are you?');
  });

  it('should handle sensitive data export with warnings', async () => {
    const options = {
      format: 'json' as const,
      includeSensitiveData: false,
    };

    mockLogStorageService.getInteractionLogs.mockResolvedValue(mockLogs);
    mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

    const result = await exportService.exportLogs(options);

    expect(result.totalLogs).toBe(2);
    expect(result.containsSensitiveData).toBe(true);

    // Verify sensitive data was redacted
    const exportedContent = await result.blob.text();
    const exportData = JSON.parse(exportedContent);

    const sensitiveLog = exportData.logs.find(
      (log: { id: string }) => log.id === 'log-2'
    );
    expect(sensitiveLog.userMessage).toBe('[REDACTED - SENSITIVE DATA]');
    expect(sensitiveLog.aiResponse).toBe('[REDACTED - SENSITIVE DATA]');
  });

  it('should export CSV format correctly', async () => {
    const options = {
      format: 'csv' as const,
    };

    mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLogs[0]]);

    const result = await exportService.exportLogs(options);

    expect(result.blob.type).toBe('text/csv');
    expect(result.filename).toMatch(/\.csv$/);

    const csvContent = await result.blob.text();
    const lines = csvContent.split('\n');

    // Check headers
    expect(lines[0]).toContain('ID,Timestamp,Session ID');

    // Check data row
    expect(lines[1]).toContain('log-1,2024-01-01T10:00:00.000Z,session-1');
    expect(lines[1]).toContain('local');
    expect(lines[1]).toContain('Hello, how are you?');
  });

  it('should generate appropriate filenames for different filters', async () => {
    mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLogs[0]]);
    mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

    // Test with date range
    const dateRangeOptions = {
      format: 'json' as const,
      filters: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
    };

    const dateRangeResult = await exportService.exportLogs(dateRangeOptions);
    expect(dateRangeResult.filename).toBe(
      'ai-interaction-logs_2024-01-01_to_2024-01-31.json'
    );

    // Test with model type
    const modelTypeOptions = {
      format: 'csv' as const,
      filters: {
        modelType: 'gemini' as const,
      },
    };

    const modelTypeResult = await exportService.exportLogs(modelTypeOptions);
    expect(modelTypeResult.filename).toMatch(
      /ai-interaction-logs_\d{4}-\d{2}-\d{2}_gemini\.csv/
    );
  });

  it('should provide progress updates during export', async () => {
    const options = {
      format: 'json' as const,
    };

    mockLogStorageService.getInteractionLogs.mockResolvedValue([mockLogs[0]]);
    mockLogStorageService.getToolExecutionLogs.mockResolvedValue([]);

    const progressUpdates: Array<{
      phase: string;
      progress: number;
      message: string;
    }> = [];
    const progressCallback = jest.fn(progress => {
      progressUpdates.push(progress);
    });

    await exportService.exportLogs(options, progressCallback);

    expect(progressCallback).toHaveBeenCalledTimes(4);
    expect(progressUpdates[0]).toEqual({
      stage: 'fetching',
      progress: 10,
      message: 'Fetching logs from database...',
    });
    expect(progressUpdates[3]).toEqual({
      stage: 'complete',
      progress: 100,
      message: 'Export completed successfully',
    });
  });
});
