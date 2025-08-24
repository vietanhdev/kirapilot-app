// Task service that interfaces with Tauri commands (SeaORM backend)
import { invoke } from '@tauri-apps/api/core';
import {
  Task,
  TaskStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters,
  TaskSortOptions,
  ValidationResult,
} from '../../../types';
import { getDatabaseErrorMessage } from '../index';
import { TranslationKey } from '../../../i18n';

export class TaskService {
  /**
   * Create a new task
   */
  async create(request: CreateTaskRequest): Promise<Task> {
    try {
      // Map frontend camelCase to backend snake_case and serialize dates
      const serializedRequest = {
        title: request.title,
        description: request.description,
        priority: request.priority ?? 1,
        time_estimate: request.timeEstimate,
        due_date: request.dueDate?.toISOString(),
        scheduled_date: request.scheduledDate?.toISOString(),
        tags: request.tags,
        dependencies: request.dependencies,
        project_id: request.projectId,
        parent_task_id: request.parentTaskId,
        task_list_id: request.taskListId,
      };

      console.log('Creating task with request:', serializedRequest);

      const result = await invoke<Record<string, unknown>>('create_task', {
        request: serializedRequest,
      });
      return this.transformTaskFromBackend(result);
    } catch (error) {
      console.error('Task creation failed with error:', error);

      // Extract the actual error message from the backend
      let errorMessage = 'Failed to create task';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Remove redundant prefixes
      errorMessage = errorMessage.replace(/^Failed to create task:\s*/, '');
      errorMessage = errorMessage.replace(/^Database error:\s*/, '');

      throw new Error(errorMessage);
    }
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    try {
      const result = await invoke<Record<string, unknown> | null>('get_task', {
        id,
      });
      return result ? this.transformTaskFromBackend(result) : null;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find task by ID with dependencies
   */
  async findWithDependencies(
    id: string
  ): Promise<{ task: Task; dependencies: Task[] } | null> {
    try {
      const result = await invoke<{
        task: Record<string, unknown>;
        dependencies: Record<string, unknown>[];
      } | null>('get_task_with_dependencies', { id });

      if (!result) {
        return null;
      }

      return {
        task: this.transformTaskFromBackend(result.task),
        dependencies: result.dependencies.map(dep =>
          this.transformTaskFromBackend(dep)
        ),
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findWithDependenciesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find all tasks with optional filtering and sorting
   */
  async findAll(
    filters?: TaskFilters,
    sort?: TaskSortOptions
  ): Promise<Task[]> {
    try {
      // For now, use basic filtering - can be enhanced later
      const status = filters?.status?.[0];
      const projectId = filters?.projectId;

      const result = await invoke<Record<string, unknown>[]>('get_all_tasks', {
        status,
        project_id: projectId,
      });

      let tasks = result.map(task => this.transformTaskFromBackend(task));

      // Apply client-side filtering for complex filters
      if (filters) {
        tasks = this.applyClientSideFilters(tasks, filters);
      }

      // Apply client-side sorting
      if (sort) {
        tasks = this.applyClientSideSorting(tasks, sort);
      }

      return tasks;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findAllFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find tasks scheduled between dates
   */
  async findScheduledBetween(startDate: Date, endDate: Date): Promise<Task[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_scheduled_tasks',
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      );

      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findScheduledFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find backlog tasks (no scheduled date)
   */
  async findBacklog(): Promise<Task[]> {
    try {
      const result =
        await invoke<Record<string, unknown>[]>('get_backlog_tasks');
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findBacklogFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find tasks by task list ID
   */
  async findByTaskList(taskListId: string): Promise<Task[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_tasks_by_task_list',
        {
          task_list_id: taskListId,
        }
      );
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.findByTaskListFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Update task
   */
  async update(id: string, request: UpdateTaskRequest): Promise<Task> {
    try {
      // Map frontend camelCase to backend snake_case and serialize dates
      const serializedRequest: Record<string, unknown> = {};

      if (request.title !== undefined) {
        serializedRequest.title = request.title;
      }
      if (request.description !== undefined) {
        serializedRequest.description = request.description;
      }
      if (request.priority !== undefined) {
        serializedRequest.priority = request.priority;
      }
      if (request.status !== undefined) {
        serializedRequest.status = request.status;
      }
      if (request.timeEstimate !== undefined) {
        serializedRequest.time_estimate = request.timeEstimate;
      }
      if (request.dueDate !== undefined) {
        serializedRequest.due_date = request.dueDate?.toISOString();
      }
      if (request.scheduledDate !== undefined) {
        serializedRequest.scheduled_date = request.scheduledDate?.toISOString();
      }
      if (request.tags !== undefined) {
        serializedRequest.tags = request.tags;
      }
      if (request.dependencies !== undefined) {
        serializedRequest.dependencies = request.dependencies;
      }
      if (request.taskListId !== undefined) {
        serializedRequest.task_list_id = request.taskListId;
      }

      const result = await invoke<Record<string, unknown>>('update_task', {
        id,
        request: serializedRequest,
      });
      return this.transformTaskFromBackend(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.updateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<void> {
    try {
      await invoke<string>('delete_task', { id });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'taskService.error.deleteFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Add task dependency
   */
  async addDependency(taskId: string, dependsOnId: string): Promise<void> {
    try {
      await invoke('add_task_dependency', {
        task_id: taskId,
        depends_on_id: dependsOnId,
      });
    } catch (error) {
      throw new Error(`Failed to add dependency: ${error}`);
    }
  }

  /**
   * Remove task dependency
   */
  async removeDependency(taskId: string, dependsOnId: string): Promise<void> {
    try {
      await invoke('remove_task_dependency', {
        task_id: taskId,
        depends_on_id: dependsOnId,
      });
    } catch (error) {
      throw new Error(`Failed to remove dependency: ${error}`);
    }
  }

  /**
   * Get task dependencies
   */
  async getDependencies(taskId: string): Promise<Task[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_task_dependencies',
        {
          task_id: taskId,
        }
      );
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      throw new Error(`Failed to get dependencies: ${error}`);
    }
  }

  /**
   * Get tasks that depend on this task
   */
  async getDependents(taskId: string): Promise<Task[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_task_dependents',
        {
          task_id: taskId,
        }
      );
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      throw new Error(`Failed to get dependents: ${error}`);
    }
  }

  /**
   * Search tasks
   */
  async search(query: string): Promise<Task[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>('search_tasks', {
        query,
      });
      return result.map(task => this.transformTaskFromBackend(task));
    } catch (error) {
      throw new Error(`Failed to search tasks: ${error}`);
    }
  }

  /**
   * Get task statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completedToday: number;
    averageCompletionTime: number;
  }> {
    try {
      const result = await invoke<{
        total: number;
        completed: number;
        in_progress: number;
        pending: number;
      }>('get_task_stats');

      // Transform backend stats to frontend format
      return {
        total: result.total,
        byStatus: {
          completed: result.completed,
          in_progress: result.in_progress,
          pending: result.pending,
        },
        byPriority: {}, // TODO: Add priority stats to backend
        overdue: 0, // TODO: Add overdue stats to backend
        completedToday: 0, // TODO: Add completed today stats to backend
        averageCompletionTime: 0, // TODO: Add average completion time to backend
      };
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error}`);
    }
  }

  /**
   * Validate task dependencies
   */
  async validateDependencies(taskId: string): Promise<ValidationResult> {
    // For now, implement basic validation - can be enhanced with backend support
    try {
      const task = await this.findById(taskId);
      if (!task) {
        return {
          isValid: false,
          errors: [`Task with id ${taskId} not found`],
          warnings: [],
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if all dependencies exist
      for (const depId of task.dependencies) {
        const dependency = await this.findById(depId);
        if (!dependency) {
          errors.push(`Dependency task ${depId} not found`);
        } else if (dependency.status === 'cancelled') {
          warnings.push(`Dependency task ${depId} is cancelled`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings: [],
      };
    }
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
      dependencies: this.parseJsonField(
        backendTask.dependencies as string | null,
        []
      ),
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
   * Apply client-side filters
   */
  private applyClientSideFilters(tasks: Task[], filters: TaskFilters): Task[] {
    let filtered = tasks;

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status!.includes(task.status));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(task =>
        filters.priority!.includes(task.priority)
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task =>
        filters.tags!.some(tag => task.tags.includes(tag))
      );
    }

    if (filters.dueDate) {
      if (filters.dueDate.from) {
        filtered = filtered.filter(
          task => task.dueDate && task.dueDate >= filters.dueDate!.from!
        );
      }
      if (filters.dueDate.to) {
        filtered = filtered.filter(
          task => task.dueDate && task.dueDate <= filters.dueDate!.to!
        );
      }
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        task =>
          task.title.toLowerCase().includes(searchLower) ||
          task.description.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }

  /**
   * Apply client-side sorting
   */
  private applyClientSideSorting(tasks: Task[], sort: TaskSortOptions): Task[] {
    return tasks.sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      switch (sort.field) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'priority':
          aValue = a.priority;
          bValue = b.priority;
          break;
        case 'dueDate':
          aValue = a.dueDate?.getTime() || 0;
          bValue = b.dueDate?.getTime() || 0;
          break;
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
      }

      if ((aValue as number | string) < (bValue as number | string)) {
        return sort.direction === 'asc' ? -1 : 1;
      }
      if ((aValue as number | string) > (bValue as number | string)) {
        return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
}
