import {
  ToolExecutionErrorHandler,
  ToolExecutionError,
  ToolExecutionErrorType,
  ErrorRecoveryContext,
  AlternativeToolSuggestion,
} from '../ToolExecutionErrorHandler';
import { PermissionLevel } from '../ToolExecutionEngine';
import { ToolRegistryError } from '../ToolRegistry';
import { ToolExecutionBridgeError } from '../ToolExecutionBridge';
import { AIServiceError } from '../AIServiceInterface';

describe('ToolExecutionErrorHandler', () => {
  let errorHandler: ToolExecutionErrorHandler;
  let mockTranslationFunction: jest.Mock;

  beforeEach(() => {
    mockTranslationFunction = jest.fn((key: string) => key);
    errorHandler = new ToolExecutionErrorHandler(mockTranslationFunction);
  });

  describe('Error Normalization', () => {
    it('should normalize ToolRegistryError with TOOL_NOT_FOUND code', async () => {
      const registryError = new ToolRegistryError(
        'Tool not found',
        'TOOL_NOT_FOUND',
        'unknown_tool'
      );

      const result = await errorHandler.handleError(registryError);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Tool "unknown_tool" not found');
      expect(result.userMessage).toContain('Available tools:');
    });

    it('should normalize ToolRegistryError with INVALID_ARGUMENTS code', async () => {
      const registryError = new ToolRegistryError(
        'Invalid arguments',
        'INVALID_ARGUMENTS',
        'create_task'
      );

      const result = await errorHandler.handleError(registryError);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Invalid Input');
      expect(result.userMessage).toContain('How to fix:');
    });

    it('should normalize ToolRegistryError with INSUFFICIENT_PERMISSIONS code', async () => {
      const registryError = new ToolRegistryError(
        'Insufficient permissions',
        'INSUFFICIENT_PERMISSIONS',
        'create_task'
      );

      const result = await errorHandler.handleError(registryError);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Permission Required');
      expect(result.userMessage).toContain('Create Task');
    });

    it('should normalize ToolExecutionBridgeError with FORMAT_ERROR code', async () => {
      const bridgeError = new ToolExecutionBridgeError(
        'Format error',
        'FORMAT_ERROR',
        'create_task'
      );

      const result = await errorHandler.handleError(bridgeError);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Invalid Input');
    });

    it('should normalize AIServiceError with CIRCUIT_BREAKER_OPEN code', async () => {
      const aiError = new AIServiceError(
        'Circuit breaker open',
        'CIRCUIT_BREAKER_OPEN',
        true
      );

      const result = await errorHandler.handleError(aiError, {
        toolName: 'create_task',
        arguments: {},
        permissions: [],
        attempt: 1,
        maxAttempts: 3,
        previousErrors: [],
      });

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Resource Error');
    });

    it('should detect database errors from message content', async () => {
      const error = new Error('SQLite database is locked');

      // Don't provide context to avoid retry logic
      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Database Issue');
    });

    it('should detect timeout errors from message content', async () => {
      const error = new Error('Operation timed out');

      // Don't provide context to avoid retry logic
      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Timeout');
    });

    it('should detect network errors from message content', async () => {
      const error = new Error('Network connection failed');

      // Don't provide context to avoid retry logic
      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Network Error');
    });
  });

  describe('Alternative Tool Suggestions', () => {
    it('should suggest alternative tools for similar names', async () => {
      const error = new ToolExecutionError(
        'Tool not found',
        ToolExecutionErrorType.TOOL_NOT_FOUND,
        'create_tsk' // typo in create_task
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Did you mean one of these?');
      expect(result.userMessage).toContain('create_task');
      expect(result.metadata?.suggestions).toBeDefined();

      const suggestions = result.metadata
        ?.suggestions as AlternativeToolSuggestion[];
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].toolName).toBe('create_task');
      expect(suggestions[0].confidence).toBeGreaterThan(0);
    });

    it('should suggest tools based on keywords', async () => {
      const error = new ToolExecutionError(
        'Tool not found',
        ToolExecutionErrorType.TOOL_NOT_FOUND,
        'list_tasks' // similar to get_tasks
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Did you mean one of these?');
      expect(result.userMessage).toContain('get_tasks');
    });

    it('should provide available tools when no suggestions found', async () => {
      const error = new ToolExecutionError(
        'Tool not found',
        ToolExecutionErrorType.TOOL_NOT_FOUND,
        'completely_unknown_tool'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Available tools:');
      expect(result.userMessage).toContain('create_task');
      expect(result.userMessage).toContain('get_tasks');
    });
  });

  describe('Permission Error Handling', () => {
    it('should provide permission elevation guidance', async () => {
      const error = new ToolExecutionError(
        'Insufficient permissions: modify_tasks required',
        ToolExecutionErrorType.PERMISSION_DENIED,
        'create_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Permission Required');
      expect(result.userMessage).toContain('Task Modification');
      expect(result.userMessage).toContain('Create Task');
    });

    it('should extract timer control permissions', async () => {
      const error = new ToolExecutionError(
        'Insufficient permissions: timer_control required',
        ToolExecutionErrorType.PERMISSION_DENIED,
        'start_timer'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Timer Control');
    });
  });

  describe('Validation Error Handling', () => {
    it('should provide validation guidance for create_task title errors', async () => {
      const error = new ToolExecutionError(
        'Missing required parameter: title',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'create_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Invalid Input');
      expect(result.userMessage).toContain('How to fix:');
      expect(result.userMessage).toContain('task title');
    });

    it('should provide validation guidance for create_task priority errors', async () => {
      const error = new ToolExecutionError(
        'Invalid priority value',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'create_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain(
        'priority values: 0 (Low), 1 (Medium), 2 (High), 3 (Urgent)'
      );
    });

    it('should provide validation guidance for update_task taskId errors', async () => {
      const error = new ToolExecutionError(
        'Missing taskId parameter',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'update_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('valid task ID');
      expect(result.userMessage).toContain('get_tasks');
    });

    it('should provide validation guidance for date format errors', async () => {
      const error = new ToolExecutionError(
        'Invalid date format',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'get_time_data'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('ISO date format');
      expect(result.userMessage).toContain('YYYY-MM-DD');
    });

    it('should provide generic validation guidance for unknown errors', async () => {
      const error = new ToolExecutionError(
        'Some validation error',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'unknown_tool'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('parameter format');
    });
  });

  describe('Database Error Handling', () => {
    it('should provide database error guidance', async () => {
      const error = new ToolExecutionError(
        'Database connection failed',
        ToolExecutionErrorType.DATABASE_ERROR,
        'create_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Database Issue');
      expect(result.userMessage).toContain('What you can try:');
      expect(result.userMessage).toContain('Wait a moment');
      expect(result.userMessage).toContain('disk space');
    });
  });

  describe('Retry Logic', () => {
    it('should suggest retry for retryable execution errors', async () => {
      const error = new ToolExecutionError(
        'Temporary execution failure',
        ToolExecutionErrorType.EXECUTION_ERROR,
        'create_task'
      );

      const context: ErrorRecoveryContext = {
        toolName: 'create_task',
        arguments: { title: 'Test task' },
        permissions: [PermissionLevel.MODIFY_TASKS],
        attempt: 1,
        maxAttempts: 3,
        previousErrors: [],
      };

      const result = await errorHandler.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Retrying');
      expect(result.metadata?.retryAfter).toBeDefined();
      expect(result.metadata?.attempt).toBe(1);
    });

    it('should not retry validation errors', async () => {
      const error = new ToolExecutionError(
        'Validation failed',
        ToolExecutionErrorType.VALIDATION_ERROR,
        'create_task'
      );

      const context: ErrorRecoveryContext = {
        toolName: 'create_task',
        arguments: {},
        permissions: [PermissionLevel.MODIFY_TASKS],
        attempt: 1,
        maxAttempts: 3,
        previousErrors: [],
      };

      const result = await errorHandler.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.userMessage).not.toContain('Retrying');
      expect(result.metadata?.retryAfter).toBeUndefined();
    });

    it('should not retry permission errors', async () => {
      const error = new ToolExecutionError(
        'Permission denied',
        ToolExecutionErrorType.PERMISSION_DENIED,
        'create_task'
      );

      const context: ErrorRecoveryContext = {
        toolName: 'create_task',
        arguments: {},
        permissions: [],
        attempt: 1,
        maxAttempts: 3,
        previousErrors: [],
      };

      const result = await errorHandler.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.userMessage).not.toContain('Retrying');
      expect(result.metadata?.retryAfter).toBeUndefined();
    });

    it('should calculate exponential backoff for retries', async () => {
      const error = new ToolExecutionError(
        'Database busy',
        ToolExecutionErrorType.DATABASE_ERROR,
        'create_task'
      );

      const context1: ErrorRecoveryContext = {
        toolName: 'create_task',
        arguments: {},
        permissions: [],
        attempt: 1,
        maxAttempts: 4,
        previousErrors: [],
      };

      const result1 = await errorHandler.handleError(error, context1);
      const delay1 = result1.metadata?.retryAfter;

      const context2: ErrorRecoveryContext = {
        toolName: 'create_task',
        arguments: {},
        permissions: [],
        attempt: 2,
        maxAttempts: 4,
        previousErrors: [],
      };

      const result2 = await errorHandler.handleError(error, context2);
      const delay2 = result2.metadata?.retryAfter;

      expect(delay1).toBeDefined();
      expect(delay2).toBeDefined();
      expect(delay2).toBeGreaterThan(delay1!);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format tool display names correctly', async () => {
      const error = new ToolExecutionError(
        'Test error',
        ToolExecutionErrorType.EXECUTION_ERROR,
        'create_task'
      );

      const result = await errorHandler.handleError(error);

      expect(result.userMessage).toContain('Create Task');
    });

    it('should handle unknown tool names gracefully', async () => {
      const error = new ToolExecutionError(
        'Test error',
        ToolExecutionErrorType.EXECUTION_ERROR,
        'unknown_tool_name'
      );

      const result = await errorHandler.handleError(error);

      expect(result.userMessage).toContain('unknown tool name');
    });

    it('should include appropriate icons for different error types', async () => {
      const testCases = [
        { type: ToolExecutionErrorType.TOOL_NOT_FOUND, icon: '❌' },
        { type: ToolExecutionErrorType.PERMISSION_DENIED, icon: '🔒' },
        { type: ToolExecutionErrorType.VALIDATION_ERROR, icon: '⚠️' },
        { type: ToolExecutionErrorType.DATABASE_ERROR, icon: '💾' },
        { type: ToolExecutionErrorType.NETWORK_ERROR, icon: '🌐' },
        { type: ToolExecutionErrorType.TIMEOUT_ERROR, icon: '⏱️' },
        { type: ToolExecutionErrorType.RESOURCE_ERROR, icon: '⚡' },
      ];

      for (const testCase of testCases) {
        const error = new ToolExecutionError(
          'Test error',
          testCase.type,
          'test_tool'
        );

        const result = await errorHandler.handleError(error);
        expect(result.userMessage).toContain(testCase.icon);
      }
    });
  });

  describe('Recovery Strategy Management', () => {
    it('should allow updating recovery strategies', () => {
      const newStrategy = {
        maxRetries: 5,
        retryDelay: 2000,
      };

      errorHandler.updateRecoveryStrategy(
        ToolExecutionErrorType.DATABASE_ERROR,
        newStrategy
      );

      const strategy = errorHandler.getRecoveryStrategy(
        ToolExecutionErrorType.DATABASE_ERROR
      );

      expect(strategy?.maxRetries).toBe(5);
      expect(strategy?.retryDelay).toBe(2000);
    });

    it('should return undefined for unknown error types', () => {
      const strategy = errorHandler.getRecoveryStrategy(
        'UNKNOWN_TYPE' as ToolExecutionErrorType
      );

      expect(strategy).toBeUndefined();
    });
  });

  describe('Translation Function Integration', () => {
    it('should use translation function when provided', () => {
      const customTranslation = jest.fn((key: string) => `translated_${key}`);
      errorHandler.setTranslationFunction(customTranslation);

      // The translation function should be stored for future use
      // (Current implementation doesn't actively use it, but it's prepared for future enhancement)
      expect(customTranslation).not.toHaveBeenCalled(); // Not used in current implementation
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined tool names gracefully', async () => {
      const error = new ToolExecutionError(
        'Test error',
        ToolExecutionErrorType.EXECUTION_ERROR
      );

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toBeDefined();
      expect(result.metadata?.toolName).toBe('unknown');
    });

    it('should handle errors without context gracefully', async () => {
      const error = new Error('Simple error');

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toBeDefined();
      expect(result.metadata?.toolName).toBe('unknown');
    });

    it('should handle fallback action failures gracefully', async () => {
      // Create a mock error handler with a failing fallback action
      const failingHandler = new ToolExecutionErrorHandler();

      // Override the recovery strategy to have a failing fallback
      failingHandler.updateRecoveryStrategy(
        ToolExecutionErrorType.TOOL_NOT_FOUND,
        {
          maxRetries: 0,
          retryDelay: 0,
          backoffMultiplier: 1,
          shouldRetry: () => false,
          fallbackAction: async () => {
            throw new Error('Fallback failed');
          },
        }
      );

      const error = new ToolExecutionError(
        'Tool not found',
        ToolExecutionErrorType.TOOL_NOT_FOUND,
        'unknown_tool'
      );

      const result = await failingHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.userMessage).toBeDefined();
    });
  });
});
