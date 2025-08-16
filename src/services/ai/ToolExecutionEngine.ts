// Tool execution engine with permission system

/**
 * Permission levels for tool execution
 */
export enum PermissionLevel {
  READ_ONLY = 'read_only',
  MODIFY_TASKS = 'modify_tasks',
  TIMER_CONTROL = 'timer_control',
  FULL_ACCESS = 'full_access',
}

/**
 * Tool execution result with formatting
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  userMessage: string;
  requiresConfirmation?: boolean;
  metadata?: {
    executionTime: number;
    toolName: string;
    permissions: PermissionLevel[];
  };
}

/**
 * Tool permission configuration
 */
export interface ToolPermission {
  toolName: string;
  requiredPermissions: PermissionLevel[];
  requiresConfirmation: boolean;
  description: string;
}

/**
 * User preferences for tool execution
 */
export interface ToolExecutionPreferences {
  autoApprove: string[]; // Tool names that don't require confirmation
  permissions: PermissionLevel[];
  confirmationTimeout: number; // seconds
}

/**
 * Tool execution engine with permission system and result formatting
 */
export class ToolExecutionEngine {
  private permissions: PermissionLevel[] = [PermissionLevel.READ_ONLY];
  private preferences: ToolExecutionPreferences;
  private toolPermissions: Map<string, ToolPermission> = new Map();

  constructor(
    permissions: PermissionLevel[] = [PermissionLevel.READ_ONLY],
    preferences?: Partial<ToolExecutionPreferences>
  ) {
    this.permissions = permissions;
    this.preferences = {
      autoApprove: [],
      permissions: permissions,
      confirmationTimeout: 30,
      ...preferences,
    };

    this.initializeToolPermissions();
  }

  /**
   * Initialize tool permission configurations
   */
  private initializeToolPermissions(): void {
    const toolConfigs: ToolPermission[] = [
      {
        toolName: 'get_tasks',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
        description: 'Retrieve and search tasks',
      },
      {
        toolName: 'get_time_data',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
        description: 'View time tracking data and statistics',
      },
      {
        toolName: 'analyze_productivity',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
        description: 'Generate productivity insights and recommendations',
      },
      {
        toolName: 'create_task',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
        description: 'Create new tasks in the system',
      },
      {
        toolName: 'update_task',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
        description: 'Modify existing tasks',
      },
      {
        toolName: 'start_timer',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
        description: 'Start time tracking for tasks',
      },
      {
        toolName: 'stop_timer',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
        description: 'Stop current time tracking session',
      },
    ];

    toolConfigs.forEach(config => {
      this.toolPermissions.set(config.toolName, config);
    });
  }

  /**
   * Check if user has permission to execute a tool
   */
  hasPermission(toolName: string): boolean {
    const toolConfig = this.toolPermissions.get(toolName);
    if (!toolConfig) {
      return false;
    }

    return toolConfig.requiredPermissions.every(
      required =>
        this.permissions.includes(required) ||
        this.permissions.includes(PermissionLevel.FULL_ACCESS)
    );
  }

  /**
   * Check if tool requires user confirmation
   */
  requiresConfirmation(toolName: string): boolean {
    const toolConfig = this.toolPermissions.get(toolName);
    if (!toolConfig) {
      return true; // Default to requiring confirmation for unknown tools
    }

    // Check if tool is in auto-approve list
    if (this.preferences.autoApprove.includes(toolName)) {
      return false;
    }

    return toolConfig.requiresConfirmation;
  }

  /**
   * Format tool execution result for user display
   */
  formatResult(
    toolName: string,
    rawResult: string,
    executionTime: number
  ): ToolExecutionResult {
    try {
      const parsed = JSON.parse(rawResult);
      const userMessage = this.generateUserMessage(toolName, parsed);

      return {
        success: parsed.success || false,
        data: parsed,
        userMessage,
        metadata: {
          executionTime,
          toolName,
          permissions: this.permissions,
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse tool result',
        userMessage: `❌ Error executing ${toolName}: Invalid response format`,
        metadata: {
          executionTime,
          toolName,
          permissions: this.permissions,
        },
      };
    }
  }

  /**
   * Generate user-friendly message from tool result
   */
  private generateUserMessage(
    toolName: string,
    result: Record<string, unknown>
  ): string {
    if (!result.success) {
      return `❌ ${this.getToolDisplayName(toolName)} failed: ${result.error || 'Unknown error'}`;
    }

    switch (toolName) {
      case 'get_tasks':
        return this.formatTaskListMessage(result);
      case 'create_task':
        return this.formatTaskCreatedMessage(result);
      case 'update_task':
        return this.formatTaskUpdatedMessage(result);
      case 'start_timer':
        return this.formatTimerStartedMessage(result);
      case 'stop_timer':
        return this.formatTimerStoppedMessage(result);
      case 'get_time_data':
        return this.formatTimeDataMessage(result);
      case 'analyze_productivity':
        return this.formatProductivityMessage(result);
      default:
        return `✅ ${this.getToolDisplayName(toolName)} completed successfully`;
    }
  }

  /**
   * Format task list result message
   */
  private formatTaskListMessage(result: Record<string, unknown>): string {
    const tasks = result.tasks as Record<string, unknown>[] | undefined;
    if (!tasks || tasks.length === 0) {
      return '📝 No tasks found matching your criteria';
    }

    const count = tasks.length;
    const preview = tasks.slice(0, 3);

    let message = `📝 Found ${count} task${count === 1 ? '' : 's'}:\n\n`;

    preview.forEach((task: Record<string, unknown>, index: number) => {
      const priority = this.formatPriority(task.priority as number);
      const status = this.formatStatus(task.status as string);
      message += `${index + 1}. **${task.title}** (${priority}, ${status})\n`;

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate as string).toLocaleDateString();
        message += `   📅 Due: ${dueDate}\n`;
      }

      if (task.timeEstimate) {
        message += `   ⏱️ Estimated: ${task.timeEstimate} minutes\n`;
      }
    });

    if (count > 3) {
      message += `\n...and ${count - 3} more task${count - 3 === 1 ? '' : 's'}`;
    }

    return message;
  }

  /**
   * Format task created message
   */
  private formatTaskCreatedMessage(result: Record<string, unknown>): string {
    const task = result.task as Record<string, unknown>;
    const priority = this.formatPriority(task.priority as number);
    return `✅ Created task: **${task.title}** (${priority} priority)`;
  }

  /**
   * Format task updated message
   */
  private formatTaskUpdatedMessage(result: Record<string, unknown>): string {
    const task = result.task as Record<string, unknown>;
    return `✅ Updated task: **${task.title}**`;
  }

  /**
   * Format timer started message
   */
  private formatTimerStartedMessage(_result: Record<string, unknown>): string {
    return `⏱️ Timer started! Now tracking time for your task.`;
  }

  /**
   * Format timer stopped message
   */
  private formatTimerStoppedMessage(result: Record<string, unknown>): string {
    const session = result.session as Record<string, unknown>;
    const duration = Math.round((session.duration as number) / (1000 * 60));
    return `⏹️ Timer stopped! You worked for ${duration} minute${duration === 1 ? '' : 's'}.`;
  }

  /**
   * Format time data message
   */
  private formatTimeDataMessage(result: Record<string, unknown>): string {
    const timeData = result.timeData as Record<string, unknown>;
    const totalHours =
      Math.round(((timeData.totalTime as number) / (1000 * 60 * 60)) * 10) / 10;
    const avgMinutes = Math.round(
      (timeData.averageSession as number) / (1000 * 60)
    );

    return (
      `📊 Time Summary:\n` +
      `• Sessions: ${timeData.totalSessions}\n` +
      `• Total time: ${totalHours} hours\n` +
      `• Average session: ${avgMinutes} minutes`
    );
  }

  /**
   * Format productivity analysis message
   */
  private formatProductivityMessage(result: Record<string, unknown>): string {
    const analysis = result.analysis as Record<string, unknown>;
    const insights = analysis.insights as Record<string, unknown>;

    const mostProductiveTime = insights.mostProductiveTime as Record<
      string,
      unknown
    >;
    let message = `📈 Productivity Analysis:\n\n`;
    message += `🎯 **Key Insights:**\n`;
    message += `• Most productive: ${mostProductiveTime.start}-${mostProductiveTime.end}\n`;
    message += `• Completion rate: ${Math.round((insights.completionRate as number) * 100)}%\n`;
    message += `• Focus efficiency: ${Math.round((insights.focusEfficiency as number) * 100)}%\n\n`;

    if (
      analysis.recommendations &&
      Array.isArray(analysis.recommendations) &&
      analysis.recommendations.length > 0
    ) {
      message += `💡 **Recommendations:**\n`;
      (analysis.recommendations as string[])
        .slice(0, 3)
        .forEach((rec: string, index: number) => {
          message += `${index + 1}. ${rec}\n`;
        });
    }

    return message;
  }

  /**
   * Format priority for display
   */
  private formatPriority(priority: number): string {
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    return priorities[priority] || 'Medium';
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get display name for tool
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      get_tasks: 'Task Search',
      create_task: 'Task Creation',
      update_task: 'Task Update',
      start_timer: 'Timer Start',
      stop_timer: 'Timer Stop',
      get_time_data: 'Time Analysis',
      analyze_productivity: 'Productivity Analysis',
    };

    return displayNames[toolName] || toolName.replace('_', ' ');
  }

  /**
   * Update user permissions
   */
  setPermissions(permissions: PermissionLevel[]): void {
    this.permissions = permissions;
    this.preferences.permissions = permissions;
  }

  /**
   * Update tool execution preferences
   */
  updatePreferences(preferences: Partial<ToolExecutionPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Get available tools based on current permissions
   */
  getAvailableTools(): string[] {
    return Array.from(this.toolPermissions.keys()).filter(toolName =>
      this.hasPermission(toolName)
    );
  }

  /**
   * Get tool permission info
   */
  getToolInfo(toolName: string): ToolPermission | undefined {
    return this.toolPermissions.get(toolName);
  }

  /**
   * Validate tool execution request
   */
  validateExecution(
    toolName: string,
    _args: Record<string, unknown>
  ): {
    allowed: boolean;
    reason?: string;
    requiresConfirmation: boolean;
  } {
    // Check if tool exists
    if (!this.toolPermissions.has(toolName)) {
      return {
        allowed: false,
        reason: `Unknown tool: ${toolName}`,
        requiresConfirmation: false,
      };
    }

    // Check permissions
    if (!this.hasPermission(toolName)) {
      const toolConfig = this.toolPermissions.get(toolName)!;
      return {
        allowed: false,
        reason: `Insufficient permissions. Required: ${toolConfig.requiredPermissions.join(', ')}`,
        requiresConfirmation: false,
      };
    }

    return {
      allowed: true,
      requiresConfirmation: this.requiresConfirmation(toolName),
    };
  }
}

/**
 * Default tool execution engine instance
 */
let defaultEngine: ToolExecutionEngine | null = null;

/**
 * Get default tool execution engine
 */
export function getToolExecutionEngine(): ToolExecutionEngine {
  if (!defaultEngine) {
    defaultEngine = new ToolExecutionEngine([
      PermissionLevel.READ_ONLY,
      PermissionLevel.MODIFY_TASKS,
      PermissionLevel.TIMER_CONTROL,
    ]);
  }
  return defaultEngine;
}

/**
 * Initialize tool execution engine with specific permissions
 */
export function initializeToolExecutionEngine(
  permissions: PermissionLevel[],
  preferences?: Partial<ToolExecutionPreferences>
): ToolExecutionEngine {
  defaultEngine = new ToolExecutionEngine(permissions, preferences);
  return defaultEngine;
}
