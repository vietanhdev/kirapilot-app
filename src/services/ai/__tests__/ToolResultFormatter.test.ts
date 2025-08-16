import { ToolResultFormatter } from '../ToolResultFormatter';
import { ToolExecutionResult, PermissionLevel } from '../ToolExecutionEngine';

describe('ToolResultFormatter', () => {
  let formatter: ToolResultFormatter;
  let mockResult: ToolExecutionResult;

  beforeEach(() => {
    formatter = new ToolResultFormatter();
    mockResult = {
      success: true,
      userMessage: 'Operation completed successfully',
      metadata: {
        executionTime: 100,
        toolName: 'test_tool',
        permissions: [PermissionLevel.READ_ONLY],
      },
    };
  });

  describe('Basic Formatting', () => {
    test('should format basic result with timestamp', () => {
      const formatted = formatter.format('get_tasks', mockResult);

      expect(formatted.formattedMessage).toMatch(
        /\[\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?\]/
      );
      expect(formatted.formattedMessage).toContain(
        'Operation completed successfully'
      );
    });

    test('should include metadata when enabled', () => {
      const formatterWithMetadata = new ToolResultFormatter({
        includeMetadata: true,
      });

      const formatted = formatterWithMetadata.format('get_tasks', mockResult);

      expect(formatted.formattedMessage).toContain('Executed in 100ms');
    });

    test('should disable timestamp when configured', () => {
      const formatterNoTimestamp = new ToolResultFormatter({
        includeTimestamp: false,
      });

      const formatted = formatterNoTimestamp.format('get_tasks', mockResult);

      expect(formatted.formattedMessage).not.toMatch(
        /\[\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?\]/
      );
      expect(formatted.formattedMessage).toBe(
        'Operation completed successfully'
      );
    });
  });

  describe('Action Buttons', () => {
    test('should generate retry button for failed operations', () => {
      const failedResult: ToolExecutionResult = {
        success: false,
        error: 'Network error',
        userMessage: 'Operation failed',
      };

      const formatted = formatter.format('get_tasks', failedResult);

      expect(formatted.actionButtons).toHaveLength(1);
      expect(formatted.actionButtons?.[0].label).toBe('Retry');
      expect(formatted.actionButtons?.[0].action).toBe('retry_tool');
      expect(formatted.actionButtons?.[0].style).toBe('primary');
    });

    test('should generate task-specific buttons for get_tasks', () => {
      const formatted = formatter.format('get_tasks', mockResult);

      expect(formatted.actionButtons).toHaveLength(2);
      expect(formatted.actionButtons?.[0].label).toBe('+ New Task');
      expect(formatted.actionButtons?.[1].label).toBe('🔄 Refresh');
    });

    test('should generate timer button for created task', () => {
      const createTaskResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Task created',
        data: {
          task: {
            id: 'task-123',
            title: 'New Task',
          },
        },
      };

      const formatted = formatter.format('create_task', createTaskResult);

      expect(formatted.actionButtons).toHaveLength(2);
      expect(formatted.actionButtons?.[0].label).toBe('▶️ Start Timer');
      expect(formatted.actionButtons?.[0].parameters?.taskId).toBe('task-123');
    });

    test('should disable action buttons when configured', () => {
      const formatterNoButtons = new ToolResultFormatter({
        includeActionButtons: false,
      });

      const formatted = formatterNoButtons.format('get_tasks', mockResult);

      expect(formatted.actionButtons).toBeUndefined();
    });
  });

  describe('Rich Content Generation', () => {
    test('should generate table for task list', () => {
      const taskListResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Tasks retrieved',
        data: {
          tasks: [
            {
              title: 'Task 1',
              priority: 1,
              status: 'pending',
              dueDate: '2024-12-31',
            },
            {
              title: 'Task 2',
              priority: 2,
              status: 'in_progress',
            },
          ],
        },
      };

      const formatted = formatter.format('get_tasks', taskListResult);

      expect(formatted.richContent?.type).toBe('table');
      expect(formatted.richContent?.data).toHaveProperty('headers');
      expect(formatted.richContent?.data).toHaveProperty('rows');

      const data = formatted.richContent?.data as Record<string, unknown>;
      expect(data.headers).toEqual(['Task', 'Priority', 'Status', 'Due Date']);
      expect(data.rows as unknown[]).toHaveLength(2);
      expect((data.rows as unknown[][])[0]).toEqual([
        'Task 1',
        '🟡 Medium',
        '⏳ Pending',
        '12/31/2024',
      ]);
    });

    test('should generate chart for time data', () => {
      const timeDataResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Time data retrieved',
        data: {
          timeData: {
            sessions: [
              {
                startTime: '2024-01-01T10:00:00Z',
                duration: 1800000, // 30 minutes in ms
              },
              {
                startTime: '2024-01-02T14:00:00Z',
                duration: 3600000, // 60 minutes in ms
              },
            ],
          },
        },
      };

      const formatted = formatter.format('get_time_data', timeDataResult);

      expect(formatted.richContent?.type).toBe('chart');
      expect(formatted.richContent?.data).toHaveProperty('type', 'bar');
      expect(formatted.richContent?.data).toHaveProperty('title');

      const data = formatted.richContent?.data as Record<string, unknown>;
      expect(data.data as unknown[]).toHaveLength(2);
      expect((data.data as Record<string, unknown>[])[0].value).toBe(30); // 30 minutes
      expect((data.data as Record<string, unknown>[])[1].value).toBe(60); // 60 minutes
    });

    test('should generate card for productivity analysis', () => {
      const productivityResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Analysis complete',
        data: {
          analysis: {
            insights: {
              mostProductiveTime: { start: '09:00', end: '11:00' },
              completionRate: 0.85,
              focusEfficiency: 0.92,
            },
          },
        },
      };

      const formatted = formatter.format(
        'analyze_productivity',
        productivityResult
      );

      expect(formatted.richContent?.type).toBe('card');

      const data = formatted.richContent?.data as Record<string, unknown>;
      expect(data.title).toBe('Productivity Insights');
      expect(data.sections as unknown[]).toHaveLength(3);
      expect((data.sections as Record<string, unknown>[])[0].content).toBe(
        '09:00 - 11:00'
      );
      expect((data.sections as Record<string, unknown>[])[1].content).toBe(
        '85%'
      );
      expect((data.sections as Record<string, unknown>[])[2].content).toBe(
        '92%'
      );
    });
  });

  describe('Notifications', () => {
    test('should generate error notification for failed operations', () => {
      const failedResult: ToolExecutionResult = {
        success: false,
        error: 'Database connection failed',
        userMessage: 'Operation failed',
      };

      const formatted = formatter.format('get_tasks', failedResult);

      expect(formatted.notifications).toHaveLength(1);
      expect(formatted.notifications?.[0].type).toBe('error');
      expect(formatted.notifications?.[0].message).toBe(
        'Database connection failed'
      );
    });

    test('should generate success notification for task creation', () => {
      const formatted = formatter.format('create_task', mockResult);

      expect(formatted.notifications).toHaveLength(1);
      expect(formatted.notifications?.[0].type).toBe('success');
      expect(formatted.notifications?.[0].message).toContain(
        'Task created successfully'
      );
    });

    test('should generate info notification for timer start', () => {
      const formatted = formatter.format('start_timer', mockResult);

      expect(formatted.notifications).toHaveLength(1);
      expect(formatted.notifications?.[0].type).toBe('info');
      expect(formatted.notifications?.[0].message).toContain(
        'Timer is now running'
      );
    });
  });

  describe('Emoji and Styling', () => {
    test('should include emojis when enabled', () => {
      const taskListResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Tasks retrieved',
        data: {
          tasks: [
            {
              title: 'Task 1',
              priority: 1, // Medium
              status: 'pending',
            },
          ],
        },
      };

      const formatted = formatter.format('get_tasks', taskListResult);
      const data = formatted.richContent?.data as Record<string, unknown>;

      expect((data.rows as unknown[][])[0][1]).toContain('🟡'); // Medium priority emoji
      expect((data.rows as unknown[][])[0][2]).toContain('⏳'); // Pending status emoji
    });

    test('should disable emojis when configured', () => {
      const formatterNoEmojis = new ToolResultFormatter({
        useEmojis: false,
      });

      const taskListResult: ToolExecutionResult = {
        success: true,
        userMessage: 'Tasks retrieved',
        data: {
          tasks: [
            {
              title: 'Task 1',
              priority: 1,
              status: 'pending',
            },
          ],
        },
      };

      const formatted = formatterNoEmojis.format('get_tasks', taskListResult);
      const data = formatted.richContent?.data as Record<string, unknown>;

      expect((data.rows as unknown[][])[0][1]).toBe('Medium');
      expect((data.rows as unknown[][])[0][2]).toBe('Pending');
    });
  });

  describe('Configuration Updates', () => {
    test('should update formatting options', () => {
      formatter.updateOptions({
        includeTimestamp: false,
        maxPreviewItems: 10,
      });

      const formatted = formatter.format('get_tasks', mockResult);

      expect(formatted.formattedMessage).not.toMatch(
        /\[\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?\]/
      );
    });
  });
});
