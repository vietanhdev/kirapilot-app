import { ToolExecutionResult } from './ToolExecutionEngine';

/**
 * Rich formatting options for tool results
 */
export interface FormattingOptions {
  includeMetadata: boolean;
  includeTimestamp: boolean;
  maxPreviewItems: number;
  useEmojis: boolean;
  includeActionButtons: boolean;
}

/**
 * Action button for interactive tool results
 */
export interface ActionButton {
  id: string;
  label: string;
  action: string;
  parameters?: Record<string, unknown>;
  style: 'primary' | 'secondary' | 'danger';
}

/**
 * Formatted tool result with rich content
 */
export interface FormattedToolResult extends ToolExecutionResult {
  formattedMessage: string;
  actionButtons?: ActionButton[];
  richContent?: {
    type: 'table' | 'chart' | 'list' | 'card';
    data: unknown;
  };
  notifications?: {
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  }[];
}

/**
 * Tool result formatter with rich content generation
 */
export class ToolResultFormatter {
  private options: FormattingOptions;

  constructor(options: Partial<FormattingOptions> = {}) {
    this.options = {
      includeMetadata: false,
      includeTimestamp: true,
      maxPreviewItems: 5,
      useEmojis: true,
      includeActionButtons: true,
      ...options,
    };
  }

  /**
   * Format tool execution result with rich content
   */
  format(
    toolName: string,
    result: ToolExecutionResult,
    rawData?: unknown
  ): FormattedToolResult {
    const formatted: FormattedToolResult = {
      ...result,
      formattedMessage: this.formatMessage(toolName, result, rawData),
    };

    // Add action buttons if enabled
    if (this.options.includeActionButtons) {
      formatted.actionButtons = this.generateActionButtons(toolName, result);
    }

    // Add rich content based on tool type
    formatted.richContent = this.generateRichContent(toolName, result);

    // Add notifications
    formatted.notifications = this.generateNotifications(toolName, result);

    return formatted;
  }

  /**
   * Format the main message with enhanced styling
   */
  private formatMessage(
    _toolName: string,
    result: ToolExecutionResult,
    _rawData?: unknown
  ): string {
    let message = result.userMessage;

    // Add timestamp if enabled
    if (this.options.includeTimestamp) {
      const timestamp = new Date().toLocaleTimeString();
      message = `[${timestamp}] ${message}`;
    }

    // Add metadata if enabled
    if (this.options.includeMetadata && result.metadata) {
      const executionTime = result.metadata.executionTime;
      message += `\n\n*Executed in ${executionTime}ms*`;
    }

    return message;
  }

  /**
   * Generate action buttons based on tool result
   */
  private generateActionButtons(
    toolName: string,
    result: ToolExecutionResult
  ): ActionButton[] {
    const buttons: ActionButton[] = [];

    if (!result.success) {
      buttons.push({
        id: 'retry',
        label: 'Retry',
        action: 'retry_tool',
        parameters: { toolName },
        style: 'primary',
      });
      return buttons;
    }

    switch (toolName) {
      case 'get_tasks':
        buttons.push(
          {
            id: 'create_task',
            label: '+ New Task',
            action: 'create_task',
            style: 'primary',
          },
          {
            id: 'refresh_tasks',
            label: '🔄 Refresh',
            action: 'get_tasks',
            style: 'secondary',
          }
        );
        break;

      case 'create_task':
        if (
          result.data &&
          typeof result.data === 'object' &&
          'task' in result.data
        ) {
          const task = (result.data as Record<string, unknown>).task as Record<
            string,
            unknown
          >;
          buttons.push(
            {
              id: 'start_timer',
              label: '▶️ Start Timer',
              action: 'start_timer',
              parameters: { taskId: task.id },
              style: 'primary',
            },
            {
              id: 'edit_task',
              label: '✏️ Edit',
              action: 'update_task',
              parameters: { taskId: task.id },
              style: 'secondary',
            }
          );
        }
        break;

      case 'start_timer':
        if (
          result.data &&
          typeof result.data === 'object' &&
          'session' in result.data
        ) {
          const session = (result.data as Record<string, unknown>)
            .session as Record<string, unknown>;
          buttons.push({
            id: 'stop_timer',
            label: '⏹️ Stop Timer',
            action: 'stop_timer',
            parameters: { sessionId: session.id },
            style: 'danger',
          });
        }
        break;

      case 'get_time_data':
        buttons.push(
          {
            id: 'analyze_productivity',
            label: '📊 Analyze',
            action: 'analyze_productivity',
            style: 'primary',
          },
          {
            id: 'export_data',
            label: '📤 Export',
            action: 'export_time_data',
            style: 'secondary',
          }
        );
        break;

      case 'analyze_productivity':
        buttons.push({
          id: 'view_detailed_report',
          label: '📋 Detailed Report',
          action: 'generate_report',
          style: 'primary',
        });
        break;
    }

    return buttons;
  }

  /**
   * Generate rich content based on tool result
   */
  private generateRichContent(
    toolName: string,
    result: ToolExecutionResult
  ): FormattedToolResult['richContent'] {
    if (!result.success || !result.data) {
      return undefined;
    }

    switch (toolName) {
      case 'get_tasks':
        return this.generateTaskListContent(result.data);
      case 'get_time_data':
        return this.generateTimeDataContent(result.data);
      case 'analyze_productivity':
        return this.generateProductivityContent(result.data);
      default:
        return undefined;
    }
  }

  /**
   * Generate task list rich content
   */
  private generateTaskListContent(
    data: unknown
  ): FormattedToolResult['richContent'] {
    if (typeof data !== 'object' || !data || !('tasks' in data)) {
      return undefined;
    }

    const taskData = data as { tasks: Record<string, unknown>[] };
    const tasks = taskData.tasks.slice(0, this.options.maxPreviewItems);

    return {
      type: 'table',
      data: {
        headers: ['Task', 'Priority', 'Status', 'Due Date'],
        rows: tasks.map(task => [
          task.title,
          this.formatPriority(task.priority as number),
          this.formatStatus(task.status as string),
          task.dueDate
            ? new Date(task.dueDate as string).toLocaleDateString()
            : '-',
        ]),
      },
    };
  }

  /**
   * Generate time data rich content
   */
  private generateTimeDataContent(
    data: unknown
  ): FormattedToolResult['richContent'] {
    if (typeof data !== 'object' || !data || !('timeData' in data)) {
      return undefined;
    }

    const timeData = data as { timeData: Record<string, unknown> };
    const sessions =
      (timeData.timeData.sessions as Record<string, unknown>[]) || [];

    return {
      type: 'chart',
      data: {
        type: 'bar',
        title: 'Time Tracking Sessions',
        data: sessions.slice(0, 10).map((session: Record<string, unknown>) => ({
          label: new Date(session.startTime as string).toLocaleDateString(),
          value: Math.round((session.duration as number) / (1000 * 60)), // Convert to minutes
        })),
      },
    };
  }

  /**
   * Generate productivity analysis rich content
   */
  private generateProductivityContent(
    data: unknown
  ): FormattedToolResult['richContent'] {
    if (typeof data !== 'object' || !data || !('analysis' in data)) {
      return undefined;
    }

    const analysis = data as { analysis: Record<string, unknown> };
    const insights = (analysis.analysis as Record<string, unknown>)
      .insights as Record<string, unknown>;

    return {
      type: 'card',
      data: {
        title: 'Productivity Insights',
        sections: [
          {
            title: 'Peak Performance',
            content: `${(insights.mostProductiveTime as Record<string, unknown>).start} - ${(insights.mostProductiveTime as Record<string, unknown>).end}`,
            icon: '🎯',
          },
          {
            title: 'Completion Rate',
            content: `${Math.round((insights.completionRate as number) * 100)}%`,
            icon: '✅',
          },
          {
            title: 'Focus Efficiency',
            content: `${Math.round((insights.focusEfficiency as number) * 100)}%`,
            icon: '🎯',
          },
        ],
      },
    };
  }

  /**
   * Generate notifications based on tool result
   */
  private generateNotifications(
    toolName: string,
    result: ToolExecutionResult
  ): FormattedToolResult['notifications'] {
    const notifications: FormattedToolResult['notifications'] = [];

    // Error notifications
    if (!result.success) {
      notifications?.push({
        type: 'error',
        message: result.error || 'Tool execution failed',
      });
      return notifications;
    }

    // Success notifications with context-specific messages
    switch (toolName) {
      case 'create_task':
        notifications?.push({
          type: 'success',
          message:
            'Task created successfully! You can now start tracking time or add more details.',
        });
        break;

      case 'start_timer':
        notifications?.push({
          type: 'info',
          message:
            'Timer is now running. Stay focused and remember to take breaks!',
        });
        break;

      case 'stop_timer':
        notifications?.push({
          type: 'success',
          message:
            'Great work! Your time has been recorded for productivity analysis.',
        });
        break;

      case 'analyze_productivity':
        notifications?.push({
          type: 'info',
          message:
            'Use these insights to optimize your work schedule and improve productivity.',
        });
        break;
    }

    return notifications;
  }

  /**
   * Format priority for display
   */
  private formatPriority(priority: number): string {
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const emoji = ['🟢', '🟡', '🟠', '🔴'];

    if (this.options.useEmojis) {
      return `${emoji[priority] || '🟡'} ${priorities[priority] || 'Medium'}`;
    }

    return priorities[priority] || 'Medium';
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      cancelled: '❌',
    };

    const formatted = status
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    if (this.options.useEmojis) {
      return `${statusEmoji[status] || '⏳'} ${formatted}`;
    }

    return formatted;
  }

  /**
   * Update formatting options
   */
  updateOptions(options: Partial<FormattingOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Default formatter instance
 */
let defaultFormatter: ToolResultFormatter | null = null;

/**
 * Get default tool result formatter
 */
export function getToolResultFormatter(): ToolResultFormatter {
  if (!defaultFormatter) {
    defaultFormatter = new ToolResultFormatter();
  }
  return defaultFormatter;
}

/**
 * Initialize tool result formatter with options
 */
export function initializeToolResultFormatter(
  options: Partial<FormattingOptions>
): ToolResultFormatter {
  defaultFormatter = new ToolResultFormatter(options);
  return defaultFormatter;
}
