import { z } from 'zod';
import { Task, TaskStatus, Priority } from '../../../types';
import { IntelligentTaskMatcher } from '../IntelligentTaskMatcher';
import { ConfirmationService } from '../ConfirmationService';
import { UserIntent, TaskMatchContext } from '../../../types/taskMatching';
import { AlternativeAction } from '../../../types/aiConfirmation';
import { getTaskRepository } from '../../database/repositories';

// Schema for enhanced task tool parameters
const EnhancedTaskToolSchema = z.object({
  action: z
    .enum(['complete', 'delete', 'archive', 'update_priority', 'update_title'])
    .describe('The action to perform on the task'),
  query: z
    .string()
    .describe('Natural language description of the task to find'),
  newValue: z
    .string()
    .optional()
    .describe('New value for update actions (e.g., new title, new priority)'),
  skipConfirmation: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to skip confirmation dialog for low-impact actions'),
});

export type EnhancedTaskToolParams = z.infer<typeof EnhancedTaskToolSchema>;

export class EnhancedTaskTool {
  private matcher = new IntelligentTaskMatcher();
  private confirmationService = ConfirmationService.getInstance();
  private taskRepository = getTaskRepository();

  /**
   * Execute task action with smart confirmation
   */
  async execute(params: EnhancedTaskToolParams): Promise<{
    success: boolean;
    task?: Task;
    message: string;
    requiresConfirmation?: boolean;
    confirmationId?: string;
  }> {
    try {
      // Find the task first
      const taskResult = await this.findTask(params.query, params.action);

      if (!taskResult.success || !taskResult.task) {
        return {
          success: false,
          message: taskResult.message,
        };
      }

      const task = taskResult.task;

      // Execute the action with confirmation
      switch (params.action) {
        case 'complete':
          return await this.completeTaskWithConfirmation(
            task,
            params.skipConfirmation
          );
        case 'delete':
          return await this.deleteTaskWithConfirmation(
            task,
            params.skipConfirmation
          );
        case 'archive':
          return await this.archiveTaskWithConfirmation(
            task,
            params.skipConfirmation
          );
        case 'update_priority':
          return await this.updatePriorityWithConfirmation(
            task,
            params.newValue,
            params.skipConfirmation
          );
        case 'update_title':
          return await this.updateTitleWithConfirmation(
            task,
            params.newValue,
            params.skipConfirmation
          );
        default:
          return {
            success: false,
            message: `Unknown action: ${params.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error executing task action: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async findTask(
    query: string,
    action: string
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const userIntent = this.convertActionToIntent(action);
    const context: TaskMatchContext = { userIntent };

    const matches = await this.matcher.searchTasks(query, context);

    if (matches.length === 0) {
      return {
        success: false,
        message: `I couldn't find any tasks matching "${query}".`,
      };
    }

    if (matches.length === 1 && matches[0].confidence >= 80) {
      return {
        success: true,
        task: matches[0].task,
        message: `Found task: "${matches[0].task.title}"`,
      };
    }

    // For now, return the best match but in a real implementation
    // this would trigger the task resolution dialog
    return {
      success: true,
      task: matches[0].task,
      message: `Found task: "${matches[0].task.title}" (${matches[0].confidence}% confidence)`,
    };
  }

  private async completeTaskWithConfirmation(
    task: Task,
    skipConfirmation: boolean
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const changes = [
      this.confirmationService.createTaskChanges.complete(task.title),
    ];

    const confirmed =
      skipConfirmation ||
      (await this.confirmationService.requestConfirmation({
        title: 'Complete Task',
        description: `Mark "${task.title}" as completed?`,
        changes,
        onConfirm: async () => {
          await this.taskRepository.update(task.id, {
            status: TaskStatus.COMPLETED,
          });
        },
      }));

    if (!confirmed) {
      return {
        success: false,
        message: 'Task completion was cancelled.',
      };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      status: TaskStatus.COMPLETED,
    });

    return {
      success: true,
      task: updatedTask,
      message: `✅ Completed task: "${updatedTask.title}"`,
    };
  }

  private async deleteTaskWithConfirmation(
    task: Task,
    skipConfirmation: boolean
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const changes = [
      this.confirmationService.createTaskChanges.delete(task.title),
    ];

    const alternatives: AlternativeAction[] = [
      {
        id: 'archive',
        label: 'Archive Instead',
        description: `Archive "${task.title}" instead of deleting (can be restored later)`,
        action: async () => {
          await this.taskRepository.update(task.id, {
            status: TaskStatus.CANCELLED, // Using cancelled as archived status
          });
        },
      },
      {
        id: 'complete',
        label: 'Mark Complete',
        description: `Mark "${task.title}" as completed instead of deleting`,
        action: async () => {
          await this.taskRepository.update(task.id, {
            status: TaskStatus.COMPLETED,
          });
        },
      },
    ];

    const confirmed =
      skipConfirmation ||
      (await this.confirmationService.requestConfirmation({
        title: 'Delete Task',
        description: `Permanently delete "${task.title}"? This action cannot be undone.`,
        changes,
        reversible: false,
        alternatives,
        onConfirm: async () => {
          await this.taskRepository.delete(task.id);
        },
      }));

    if (!confirmed) {
      return {
        success: false,
        message: 'Task deletion was cancelled.',
      };
    }

    await this.taskRepository.delete(task.id);

    return {
      success: true,
      message: `🗑️ Deleted task: "${task.title}"`,
    };
  }

  private async archiveTaskWithConfirmation(
    task: Task,
    skipConfirmation: boolean
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    const changes = [
      this.confirmationService.createTaskChanges.archive(task.title),
    ];

    const confirmed =
      skipConfirmation ||
      (await this.confirmationService.requestConfirmation({
        title: 'Archive Task',
        description: `Archive "${task.title}"? You can restore it later if needed.`,
        changes,
        reversible: true,
        onConfirm: async () => {
          await this.taskRepository.update(task.id, {
            status: TaskStatus.CANCELLED, // Using cancelled as archived status
          });
        },
      }));

    if (!confirmed) {
      return {
        success: false,
        message: 'Task archiving was cancelled.',
      };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      status: TaskStatus.CANCELLED,
    });

    return {
      success: true,
      task: updatedTask,
      message: `📦 Archived task: "${updatedTask.title}"`,
    };
  }

  private async updatePriorityWithConfirmation(
    task: Task,
    newPriorityStr?: string,
    skipConfirmation?: boolean
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    if (!newPriorityStr) {
      return {
        success: false,
        message: 'New priority value is required for priority updates.',
      };
    }

    const newPriority = this.parsePriority(newPriorityStr);
    if (newPriority === null) {
      return {
        success: false,
        message: `Invalid priority: "${newPriorityStr}". Use: low, medium, high, or urgent.`,
      };
    }

    const oldPriorityStr = this.getPriorityLabel(task.priority);
    const changes = [
      this.confirmationService.createTaskChanges.updatePriority(
        task.title,
        oldPriorityStr,
        newPriorityStr
      ),
    ];

    const confirmed =
      skipConfirmation ||
      (await this.confirmationService.requestConfirmation({
        title: 'Update Task Priority',
        description: `Change priority of "${task.title}" from ${oldPriorityStr} to ${newPriorityStr}?`,
        changes,
        onConfirm: async () => {
          await this.taskRepository.update(task.id, {
            priority: newPriority,
          });
        },
      }));

    if (!confirmed) {
      return {
        success: false,
        message: 'Priority update was cancelled.',
      };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      priority: newPriority,
    });

    return {
      success: true,
      task: updatedTask,
      message: `📊 Updated priority of "${updatedTask.title}" to ${newPriorityStr}`,
    };
  }

  private async updateTitleWithConfirmation(
    task: Task,
    newTitle?: string,
    skipConfirmation?: boolean
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
  }> {
    if (!newTitle) {
      return {
        success: false,
        message: 'New title is required for title updates.',
      };
    }

    const changes = [
      this.confirmationService.createTaskChanges.updateTitle(
        task.title,
        newTitle
      ),
    ];

    const confirmed =
      skipConfirmation ||
      (await this.confirmationService.requestConfirmation({
        title: 'Update Task Title',
        description: `Rename task from "${task.title}" to "${newTitle}"?`,
        changes,
        onConfirm: async () => {
          await this.taskRepository.update(task.id, {
            title: newTitle,
          });
        },
      }));

    if (!confirmed) {
      return {
        success: false,
        message: 'Title update was cancelled.',
      };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      title: newTitle,
    });

    return {
      success: true,
      task: updatedTask,
      message: `✏️ Renamed task to "${updatedTask.title}"`,
    };
  }

  private convertActionToIntent(action: string): UserIntent | undefined {
    switch (action) {
      case 'complete':
        return UserIntent.COMPLETE_TASK;
      case 'delete':
        return UserIntent.DELETE_TASK;
      case 'archive':
        return UserIntent.DELETE_TASK; // Similar intent
      case 'update_priority':
      case 'update_title':
        return UserIntent.EDIT_TASK;
      default:
        return undefined;
    }
  }

  private parsePriority(priorityStr: string): Priority | null {
    const normalized = priorityStr.toLowerCase().trim();
    switch (normalized) {
      case 'low':
        return Priority.LOW;
      case 'medium':
      case 'med':
        return Priority.MEDIUM;
      case 'high':
        return Priority.HIGH;
      case 'urgent':
        return Priority.URGENT;
      default:
        return null;
    }
  }

  private getPriorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.URGENT:
        return 'urgent';
      case Priority.HIGH:
        return 'high';
      case Priority.MEDIUM:
        return 'medium';
      case Priority.LOW:
        return 'low';
      default:
        return 'unknown';
    }
  }

  /**
   * Get the tool schema for AI integration
   */
  static getSchema() {
    return {
      name: 'enhanced_task_action',
      description:
        'Perform actions on tasks with smart confirmation dialogs and user-friendly interfaces',
      parameters: EnhancedTaskToolSchema,
    };
  }
}
