// Task List service that interfaces with Tauri commands (SeaORM backend)
import { invoke } from '@tauri-apps/api/core';
import {
  TaskList,
  CreateTaskListRequest,
  UpdateTaskListRequest,
  TaskListService as ITaskListService,
  Task,
  TaskStatus,
  TimePreset,
} from '../../../types';
import { getDatabaseErrorMessage } from '../utils';
import { TranslationKey } from '../../../i18n';
import {
  parseTaskListError,
  TaskListError,
} from '../../../utils/taskListErrorHandling';
import {
  validateCreateTaskListRequest,
  validateUpdateTaskListRequest,
} from '../../../types/validation';

export class TaskListService implements ITaskListService {
  /**
   * Get all task lists with comprehensive error handling
   */
  async getAllTaskLists(): Promise<TaskList[]> {
    try {
      const result =
        await invoke<Record<string, unknown>[]>('get_all_task_lists');
      return result.map(taskList =>
        this.transformTaskListFromBackend(taskList)
      );
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.getAllFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Create a new task list with validation and error handling
   */
  async createTaskList(request: CreateTaskListRequest): Promise<TaskList> {
    // Frontend validation
    const validation = validateCreateTaskListRequest(request);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
    }

    try {
      const result = await invoke<Record<string, unknown>>('create_task_list', {
        request: {
          name: request.name.trim(),
        },
      });
      return this.transformTaskListFromBackend(result);
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.createFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Update task list with validation and error handling
   */
  async updateTaskList(
    id: string,
    request: UpdateTaskListRequest
  ): Promise<TaskList> {
    // Frontend validation
    if (!id || id.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Task list ID is required');
    }

    const validation = validateUpdateTaskListRequest(request);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
    }

    try {
      const result = await invoke<Record<string, unknown>>('update_task_list', {
        id: id.trim(),
        request: {
          name: request.name.trim(),
        },
      });
      return this.transformTaskListFromBackend(result);
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.updateFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Delete task list with validation and error handling
   */
  async deleteTaskList(id: string): Promise<void> {
    // Frontend validation
    if (!id || id.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Task list ID is required');
    }

    try {
      await invoke<string>('delete_task_list', { id: id.trim() });
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.deleteFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Get default task list with error handling
   */
  async getDefaultTaskList(): Promise<TaskList> {
    try {
      const result = await invoke<Record<string, unknown>>(
        'get_default_task_list'
      );
      return this.transformTaskListFromBackend(result);
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.getDefaultFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Move task to different list with validation and error handling
   */
  async moveTaskToList(taskId: string, taskListId: string): Promise<Task> {
    // Frontend validation
    if (!taskId || taskId.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Task ID is required');
    }
    if (!taskListId || taskListId.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Task list ID is required');
    }

    try {
      const result = await invoke<Record<string, unknown>>(
        'move_task_to_list',
        {
          taskId: taskId.trim(),
          taskListId: taskListId.trim(),
        }
      );
      return this.transformTaskFromBackend(result);
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.moveTaskFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Get tasks by task list ID with validation and error handling
   */
  async getTasksByTaskList(taskListId: string): Promise<Task[]> {
    // Frontend validation
    if (!taskListId || taskListId.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Task list ID is required');
    }

    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_tasks_by_task_list',
        {
          task_list_id: taskListId.trim(),
        }
      );
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      const parsedError = parseTaskListError(error as string);
      const errorMessage = getDatabaseErrorMessage(
        'taskListService.error.getTasksFailed' as TranslationKey
      );
      throw this.createEnhancedError(errorMessage, parsedError);
    }
  }

  /**
   * Transform task list data from backend format to frontend format
   */
  private transformTaskListFromBackend(
    backendTaskList: Record<string, unknown>
  ): TaskList {
    return {
      id: backendTaskList.id as string,
      name: backendTaskList.name as string,
      isDefault: backendTaskList.is_default as boolean,
      createdAt: new Date(backendTaskList.created_at as string),
      updatedAt: new Date(backendTaskList.updated_at as string),
    };
  }

  /**
   * Transform task data from backend format to frontend format
   */
  private transformTaskFromBackend(backendTask: Record<string, unknown>): Task {
    return {
      id: backendTask.id as string,
      title: backendTask.title as string,
      description: (backendTask.description as string) || '',
      priority: backendTask.priority as number,
      status: backendTask.status as TaskStatus,
      order: (backendTask.order_num as number) || 0,
      dependencies: this.parseJsonField(
        backendTask.dependencies as string | null,
        []
      ),
      timePreset:
        (backendTask.time_preset as TimePreset) || TimePreset.NOT_APPLICABLE,
      timeEstimate: (backendTask.time_estimate as number) || 0,
      actualTime: (backendTask.actual_time as number) || 0,
      dueDate: backendTask.due_date
        ? new Date(backendTask.due_date as string)
        : undefined,
      scheduledDate: backendTask.scheduled_date
        ? new Date(backendTask.scheduled_date as string)
        : undefined,
      tags: this.parseJsonField(backendTask.tags as string | null, []),
      projectId: backendTask.project_id as string | undefined,
      parentTaskId: backendTask.parent_task_id as string | undefined,
      subtasks: this.parseJsonField(backendTask.subtasks as string | null, []),
      taskListId: (backendTask.task_list_id as string) || 'default-task-list',
      // Periodic task properties
      periodicTemplateId: backendTask.periodic_template_id as
        | string
        | undefined,
      isPeriodicInstance:
        (backendTask.is_periodic_instance as boolean) || false,
      generationDate: backendTask.generation_date
        ? new Date(backendTask.generation_date as string)
        : undefined,
      completedAt: backendTask.completed_at
        ? new Date(backendTask.completed_at as string)
        : undefined,
      createdAt: new Date(backendTask.created_at as string),
      updatedAt: new Date(backendTask.updated_at as string),
    };
  }

  /**
   * Parse JSON field with fallback
   */
  private parseJsonField<T>(value: string | null, fallback: T): T {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Create enhanced error with structured information
   */
  private createEnhancedError(
    baseMessage: string,
    parsedError: TaskListError
  ): Error & { taskListError: TaskListError } {
    const error = new Error(
      `${baseMessage}: ${parsedError.message}`
    ) as Error & { taskListError: TaskListError };
    // Attach structured error information for better handling
    error.taskListError = parsedError;
    return error;
  }
}
