// Example AI tool that uses intelligent task matching

import { z } from 'zod';
import { Task, TaskStatus } from '../../../types';
import { IntelligentTaskMatcher } from '../IntelligentTaskMatcher';
import { UserIntent, TaskMatchContext } from '../../../types/taskMatching';
import { getTaskRepository } from '../../database/repositories';

// Schema for task matching tool parameters
const TaskMatchingToolSchema = z.object({
  query: z
    .string()
    .describe('Natural language description of the task to find'),
  intent: z
    .enum(['complete', 'start_timer', 'edit', 'delete', 'schedule', 'view'])
    .optional()
    .describe('What the user wants to do with the task'),
  autoResolve: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to automatically resolve ambiguous matches'),
});

export type TaskMatchingToolParams = z.infer<typeof TaskMatchingToolSchema>;

export class TaskMatchingTool {
  private matcher = new IntelligentTaskMatcher();
  private taskRepository = getTaskRepository();

  /**
   * Find and optionally act on a task using natural language
   */
  async execute(params: TaskMatchingToolParams): Promise<{
    success: boolean;
    task?: Task;
    matches?: Array<{ task: Task; confidence: number; reason: string }>;
    message: string;
    needsResolution?: boolean;
  }> {
    try {
      // Convert intent to UserIntent enum
      const userIntent = this.convertIntent(params.intent);

      // Create context for matching
      const context: TaskMatchContext = {
        userIntent,
        // Could add more context like recent tasks, current filters, etc.
      };

      // Search for matching tasks
      const matches = await this.matcher.searchTasks(params.query, context);

      if (matches.length === 0) {
        return {
          success: false,
          message: `I couldn't find any tasks matching "${params.query}". Would you like me to create a new task?`,
        };
      }

      // If we have a single high-confidence match and auto-resolve is enabled
      if (
        matches.length === 1 &&
        matches[0].confidence >= 80 &&
        params.autoResolve
      ) {
        const task = matches[0].task;
        return {
          success: true,
          task,
          message: `Found task: "${task.title}" (${matches[0].confidence}% confidence - ${matches[0].matchReason})`,
        };
      }

      // If we have multiple matches or low confidence, return for user resolution
      if (matches.length > 1 || matches[0].confidence < 80) {
        return {
          success: true,
          matches: matches.map(m => ({
            task: m.task,
            confidence: m.confidence,
            reason: m.matchReason,
          })),
          message: `I found ${matches.length} possible matches for "${params.query}". Please select which task you meant:`,
          needsResolution: true,
        };
      }

      // Single match with good confidence
      const task = matches[0].task;
      return {
        success: true,
        task,
        message: `Found task: "${task.title}" (${matches[0].confidence}% confidence - ${matches[0].matchReason})`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error searching for tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Complete a task using natural language reference
   */
  async completeTask(query: string): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const result = await this.execute({
      query,
      intent: 'complete',
      autoResolve: true,
    });

    if (!result.success || !result.task) {
      return {
        success: false,
        message: result.message,
      };
    }

    try {
      // Update task status to completed
      const updatedTask = await this.taskRepository.update(result.task.id, {
        status: TaskStatus.COMPLETED,
      });

      return {
        success: true,
        task: updatedTask,
        message: `✅ Completed task: "${updatedTask.title}"`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Found the task but failed to mark it as complete: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get task details using natural language reference
   */
  async getTaskDetails(query: string): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const result = await this.execute({
      query,
      intent: 'view',
      autoResolve: true,
    });

    if (!result.success || !result.task) {
      return {
        success: false,
        message: result.message,
      };
    }

    const task = result.task;
    const details = [
      `📋 **${task.title}**`,
      task.description ? `📝 ${task.description}` : '',
      `📊 Status: ${task.status.replace('_', ' ')}`,
      `⭐ Priority: ${this.getPriorityLabel(task.priority)}`,
      task.timeEstimate > 0
        ? `⏱️ Estimated time: ${task.timeEstimate} minutes`
        : '',
      task.tags.length > 0 ? `🏷️ Tags: ${task.tags.join(', ')}` : '',
      task.dueDate ? `📅 Due: ${task.dueDate.toLocaleDateString()}` : '',
      task.scheduledDate
        ? `📆 Scheduled: ${task.scheduledDate.toLocaleDateString()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      task,
      message: details,
    };
  }

  private convertIntent(intent?: string): UserIntent | undefined {
    switch (intent) {
      case 'complete':
        return UserIntent.COMPLETE_TASK;
      case 'start_timer':
        return UserIntent.START_TIMER;
      case 'edit':
        return UserIntent.EDIT_TASK;
      case 'delete':
        return UserIntent.DELETE_TASK;
      case 'schedule':
        return UserIntent.SCHEDULE_TASK;
      case 'view':
        return UserIntent.VIEW_DETAILS;
      default:
        return undefined;
    }
  }

  private getPriorityLabel(priority: number): string {
    switch (priority) {
      case 3:
        return 'Urgent';
      case 2:
        return 'High';
      case 1:
        return 'Medium';
      case 0:
        return 'Low';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get the tool schema for AI integration
   */
  static getSchema() {
    return {
      name: 'find_task',
      description:
        'Find tasks using natural language descriptions instead of requiring exact IDs',
      parameters: TaskMatchingToolSchema,
    };
  }
}
