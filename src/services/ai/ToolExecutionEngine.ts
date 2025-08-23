// Tool execution engine with permission system
import { TranslationKey } from '../../i18n';

/**
 * Translation function type for the tool execution engine
 */
export type TranslationFunction = (
  key: TranslationKey,
  variables?: Record<string, string | number>
) => string;

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
  private t: TranslationFunction;

  constructor(
    permissions: PermissionLevel[] = [PermissionLevel.READ_ONLY],
    preferences?: Partial<ToolExecutionPreferences>,
    translationFunction?: TranslationFunction
  ) {
    this.permissions = permissions;
    this.preferences = {
      autoApprove: [],
      permissions: permissions,
      confirmationTimeout: 30,
      ...preferences,
    };

    // Default translation function that returns the key if no translation function is provided
    this.t = translationFunction || ((key: TranslationKey) => key);

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
        description: this.t('ai.tools.get_tasks.description' as TranslationKey),
      },
      {
        toolName: 'get_time_data',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
        description: this.t(
          'ai.tools.get_time_data.description' as TranslationKey
        ),
      },
      {
        toolName: 'analyze_productivity',
        requiredPermissions: [PermissionLevel.READ_ONLY],
        requiresConfirmation: false,
        description: this.t(
          'ai.tools.analyze_productivity.description' as TranslationKey
        ),
      },
      {
        toolName: 'create_task',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
        description: this.t(
          'ai.tools.create_task.description' as TranslationKey
        ),
      },
      {
        toolName: 'update_task',
        requiredPermissions: [PermissionLevel.MODIFY_TASKS],
        requiresConfirmation: true,
        description: this.t(
          'ai.tools.update_task.description' as TranslationKey
        ),
      },
      {
        toolName: 'start_timer',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
        description: this.t(
          'ai.tools.start_timer.description' as TranslationKey
        ),
      },
      {
        toolName: 'stop_timer',
        requiredPermissions: [PermissionLevel.TIMER_CONTROL],
        requiresConfirmation: false,
        description: this.t(
          'ai.tools.stop_timer.description' as TranslationKey
        ),
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
        error: this.t('ai.error.invalidResponse' as TranslationKey),
        userMessage: `❌ ${this.t('ai.error.toolFailed' as TranslationKey, {
          toolName: this.getToolDisplayName(toolName),
          error: this.t('ai.error.invalidResponse' as TranslationKey),
        })}`,
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
      return `❌ ${this.t('ai.error.toolFailed' as TranslationKey, {
        toolName: this.getToolDisplayName(toolName),
        error: (result.error as string) || 'Unknown error',
      })}`;
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
        return `✅ ${this.t('ai.success.toolExecuted' as TranslationKey, {
          toolName: this.getToolDisplayName(toolName),
        })}`;
    }
  }

  /**
   * Format task list result message
   */
  private formatTaskListMessage(result: Record<string, unknown>): string {
    const tasks = result.tasks as Record<string, unknown>[] | undefined;
    if (!tasks || tasks.length === 0) {
      return `📝 ${this.t('ai.taskList.noTasks' as TranslationKey)}`;
    }

    const count = tasks.length;
    const preview = tasks.slice(0, 3);
    const plural = count === 1 ? '' : 's';

    let message = `📝 ${this.t('ai.taskList.foundTasks' as TranslationKey, { count, plural })}\n\n`;

    preview.forEach((task: Record<string, unknown>, index: number) => {
      const priority = this.formatPriority(task.priority as number);
      const status = this.formatStatus(task.status as string);
      message += `${index + 1}. **${task.title}** (${priority}, ${status})\n`;

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate as string).toLocaleDateString();
        message += `   📅 ${this.t('ai.taskList.dueDate' as TranslationKey, { date: dueDate })}\n`;
      }

      if (task.timeEstimate) {
        message += `   ⏱️ ${this.t('ai.taskList.timeEstimate' as TranslationKey, { minutes: task.timeEstimate as number })}\n`;
      }
    });

    if (count > 3) {
      const remainingCount = count - 3;
      const remainingPlural = remainingCount === 1 ? '' : 's';
      message += `\n${this.t('ai.taskList.andMore' as TranslationKey, { count: remainingCount, plural: remainingPlural })}`;
    }

    return message;
  }

  /**
   * Format task created message
   */
  private formatTaskCreatedMessage(result: Record<string, unknown>): string {
    const task = result.task as Record<string, unknown>;
    const priority = this.formatPriority(task.priority as number);
    return `✅ ${this.t('ai.tools.create_task.success' as TranslationKey, { title: `**${task.title}** (${priority} priority)` })}`;
  }

  /**
   * Format task updated message
   */
  private formatTaskUpdatedMessage(result: Record<string, unknown>): string {
    const task = result.task as Record<string, unknown>;
    return `✅ ${this.t('ai.tools.update_task.success' as TranslationKey, { title: `**${task.title}**` })}`;
  }

  /**
   * Format timer started message
   */
  private formatTimerStartedMessage(_result: Record<string, unknown>): string {
    return `⏱️ ${this.t('ai.timer.started' as TranslationKey)}`;
  }

  /**
   * Format timer stopped message
   */
  private formatTimerStoppedMessage(result: Record<string, unknown>): string {
    const session = result.session as Record<string, unknown>;
    const duration = Math.round((session.duration as number) / (1000 * 60));
    const plural = duration === 1 ? '' : 's';
    return `⏹️ ${this.t('ai.timer.stopped' as TranslationKey, { duration, plural })}`;
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
      `📊 ${this.t('ai.timeData.summary' as TranslationKey)}\n` +
      `• ${this.t('ai.timeData.sessions' as TranslationKey, { count: timeData.totalSessions as number })}\n` +
      `• ${this.t('ai.timeData.totalTime' as TranslationKey, { hours: totalHours })}\n` +
      `• ${this.t('ai.timeData.averageSession' as TranslationKey, { minutes: avgMinutes })}`
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
    let message = `📈 ${this.t('ai.productivity.analysis' as TranslationKey)}\n\n`;
    message += `🎯 **${this.t('ai.productivity.keyInsights' as TranslationKey)}**\n`;
    message += `• ${this.t('ai.productivity.mostProductive' as TranslationKey, {
      start: mostProductiveTime.start as string,
      end: mostProductiveTime.end as string,
    })}\n`;
    message += `• ${this.t('ai.productivity.completionRate' as TranslationKey, {
      rate: Math.round((insights.completionRate as number) * 100),
    })}\n`;
    message += `• ${this.t(
      'ai.productivity.focusEfficiency' as TranslationKey,
      {
        efficiency: Math.round((insights.focusEfficiency as number) * 100),
      }
    )}\n\n`;

    if (
      analysis.recommendations &&
      Array.isArray(analysis.recommendations) &&
      analysis.recommendations.length > 0
    ) {
      message += `💡 **${this.t('ai.productivity.recommendations' as TranslationKey)}**\n`;
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
    const displayNameKey = `ai.tools.displayName.${toolName}` as TranslationKey;
    const displayName = this.t(displayNameKey);

    // If translation returns the key (meaning no translation found), use fallback
    if (displayName === displayNameKey) {
      return toolName.replace('_', ' ');
    }

    return displayName;
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
   * Update translation function
   */
  setTranslationFunction(translationFunction: TranslationFunction): void {
    this.t = translationFunction;
    // Reinitialize tool permissions with new translations
    this.initializeToolPermissions();
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
        reason: this.t('ai.error.unknownTool' as TranslationKey, { toolName }),
        requiresConfirmation: false,
      };
    }

    // Check permissions
    if (!this.hasPermission(toolName)) {
      const toolConfig = this.toolPermissions.get(toolName)!;
      return {
        allowed: false,
        reason: this.t('ai.error.insufficientPermissions' as TranslationKey, {
          permissions: toolConfig.requiredPermissions.join(', '),
        }),
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
  preferences?: Partial<ToolExecutionPreferences>,
  translationFunction?: TranslationFunction
): ToolExecutionEngine {
  defaultEngine = new ToolExecutionEngine(
    permissions,
    preferences,
    translationFunction
  );
  return defaultEngine;
}
