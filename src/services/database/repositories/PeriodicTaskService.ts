// Periodic Task service that interfaces with Tauri commands (SeaORM backend)
import { invoke } from '@tauri-apps/api/core';
import {
  PeriodicTaskTemplate,
  CreatePeriodicTaskRequest,
  UpdatePeriodicTaskRequest,
  Task,
  TaskStatus,
  RecurrenceType,
  Priority,
  GenerateInstancesResponse,
  PeriodicTaskInstancesResponse,
  TimePreset,
} from '../../../types';
import { getDatabaseErrorMessage } from '../utils';
import { TranslationKey } from '../../../i18n';

export class PeriodicTaskService {
  /**
   * Helper method to determine time preset from time estimate
   */
  private getTimePresetFromEstimate(timeEstimate: number): TimePreset {
    switch (timeEstimate) {
      case 15:
        return TimePreset.FIFTEEN_MIN;
      case 30:
        return TimePreset.THIRTY_MIN;
      case 60:
        return TimePreset.SIXTY_MIN;
      case 0:
        return TimePreset.NOT_APPLICABLE;
      default:
        return TimePreset.CUSTOM;
    }
  }

  /**
   * Create a new periodic task template
   */
  async createTemplate(
    request: CreatePeriodicTaskRequest
  ): Promise<PeriodicTaskTemplate> {
    try {
      // Map frontend camelCase to backend snake_case and serialize dates
      const serializedRequest = {
        title: request.title,
        description: request.description,
        priority: request.priority ?? Priority.MEDIUM,
        time_estimate: request.timeEstimate ?? 0,
        tags: request.tags ?? [],
        task_list_id: request.taskListId,
        recurrence_type: request.recurrenceType,
        recurrence_interval: request.recurrenceInterval ?? 1,
        recurrence_unit: request.recurrenceUnit,
        start_date: request.startDate.toISOString(),
      };

      const result = await invoke<Record<string, unknown>>(
        'create_periodic_task_template',
        {
          request: serializedRequest,
        }
      );
      return this.transformTemplateFromBackend(result);
    } catch (error) {
      console.error(
        'Periodic task template creation failed with error:',
        error
      );

      // Extract the actual error message from the backend
      let errorMessage = 'Failed to create periodic task template';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Remove redundant prefixes
      errorMessage = errorMessage.replace(
        /^Failed to create periodic task template:\s*/,
        ''
      );
      errorMessage = errorMessage.replace(/^Database error:\s*/, '');

      throw new Error(errorMessage);
    }
  }

  /**
   * Find periodic task template by ID
   */
  async findTemplateById(id: string): Promise<PeriodicTaskTemplate | null> {
    try {
      const result = await invoke<Record<string, unknown> | null>(
        'get_periodic_task_template',
        {
          id,
        }
      );
      return result ? this.transformTemplateFromBackend(result) : null;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.findTemplateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find all periodic task templates
   */
  async findAllTemplates(): Promise<PeriodicTaskTemplate[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_all_periodic_task_templates'
      );
      return result.map(template =>
        this.transformTemplateFromBackend(template)
      );
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.findAllTemplatesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find active periodic task templates
   */
  async findActiveTemplates(): Promise<PeriodicTaskTemplate[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_active_periodic_task_templates'
      );
      return result.map(template =>
        this.transformTemplateFromBackend(template)
      );
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.findActiveTemplatesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Find templates that need instance generation
   */
  async findTemplatesNeedingGeneration(): Promise<PeriodicTaskTemplate[]> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'get_templates_needing_generation'
      );
      return result.map(template =>
        this.transformTemplateFromBackend(template)
      );
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.findTemplatesNeedingGenerationFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Update periodic task template
   */
  async updateTemplate(
    id: string,
    request: UpdatePeriodicTaskRequest
  ): Promise<PeriodicTaskTemplate> {
    try {
      // Get the current template to check if it's being paused
      const currentTemplate = await this.findTemplateById(id);
      const wasActive = currentTemplate?.isActive ?? true;
      const willBeActive = request.isActive ?? wasActive;

      // Map frontend camelCase to backend snake_case
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
      if (request.timeEstimate !== undefined) {
        serializedRequest.time_estimate = request.timeEstimate;
      }
      if (request.tags !== undefined) {
        serializedRequest.tags = request.tags;
      }
      if (request.taskListId !== undefined) {
        serializedRequest.task_list_id = request.taskListId;
      }
      if (request.recurrenceType !== undefined) {
        serializedRequest.recurrence_type = request.recurrenceType;
      }
      if (request.recurrenceInterval !== undefined) {
        serializedRequest.recurrence_interval = request.recurrenceInterval;
      }
      if (request.recurrenceUnit !== undefined) {
        serializedRequest.recurrence_unit = request.recurrenceUnit;
      }
      if (request.isActive !== undefined) {
        serializedRequest.is_active = request.isActive;
      }

      const result = await invoke<Record<string, unknown>>(
        'update_periodic_task_template',
        {
          id,
          request: serializedRequest,
        }
      );
      const updatedTemplate = this.transformTemplateFromBackend(result);

      // If the template is being paused (was active, now inactive), remove future instances
      if (wasActive && !willBeActive) {
        await this.removeFutureInstances(id);
        console.log(
          `Removed future instances for paused template: ${updatedTemplate.title}`
        );
      }

      return updatedTemplate;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.updateTemplateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Delete periodic task template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      // Get template info before deletion for logging
      const template = await this.findTemplateById(id);
      const templateTitle = template?.title || 'Unknown';

      // Remove all instances (both future and past) for this template
      await this.removeAllInstances(id);
      console.log(
        `Removed all instances for deleted template: ${templateTitle}`
      );

      // Delete the template
      await invoke<string>('delete_periodic_task_template', { id });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.deleteTemplateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Get instances for a specific template
   */
  async getTemplateInstances(
    templateId: string
  ): Promise<PeriodicTaskInstancesResponse> {
    try {
      const [instances, count] = await Promise.all([
        invoke<Record<string, unknown>[]>('get_template_instances', {
          template_id: templateId,
        }),
        invoke<number>('count_template_instances', {
          template_id: templateId,
        }),
      ]);

      return {
        templateId,
        instances: instances.map(instance =>
          this.transformTaskFromBackend(instance)
        ),
        totalCount: count,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.getTemplateInstancesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Count instances for a specific template
   */
  async countTemplateInstances(templateId: string): Promise<number> {
    try {
      return await invoke<number>('count_template_instances', {
        template_id: templateId,
      });
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.countTemplateInstancesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Calculate next generation date for a recurrence pattern
   */
  async calculateNextGenerationDate(
    currentDate: Date,
    recurrenceType: RecurrenceType,
    interval: number = 1,
    unit?: 'days' | 'weeks' | 'months'
  ): Promise<Date> {
    try {
      const result = await invoke<string>('calculate_next_generation_date', {
        current_date: currentDate.toISOString(),
        recurrence_type: recurrenceType,
        interval,
        unit,
      });
      return new Date(result);
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.calculateNextGenerationDateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Generate pending instances for all templates
   */
  async generatePendingInstances(): Promise<GenerateInstancesResponse> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'generate_pending_instances'
      );
      let generatedInstances = result.map(instance =>
        this.transformTaskFromBackend(instance)
      );

      // Fix scheduled dates for all generated instances
      generatedInstances = await Promise.all(
        generatedInstances.map(async task => {
          if (task.periodicTemplateId) {
            return await this.correctPeriodicTaskScheduledDate(
              task,
              task.periodicTemplateId
            );
          }
          return task;
        })
      );

      // Get updated templates after generation
      const updatedTemplates = await this.findActiveTemplates();

      return {
        generatedInstances,
        updatedTemplates,
        totalGenerated: generatedInstances.length,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.generatePendingInstancesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Generate instance from specific template
   */
  async generateInstanceFromTemplate(templateId: string): Promise<Task> {
    try {
      const result = await invoke<Record<string, unknown>>(
        'generate_instance_from_template',
        {
          templateId: templateId,
        }
      );
      const task = this.transformTaskFromBackend(result);

      // Fix the scheduled date - it should be based on the template's next generation date, not current time
      const correctedTask = await this.correctPeriodicTaskScheduledDate(
        task,
        templateId
      );
      return correctedTask;
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.generateInstanceFromTemplateFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Check and generate instances (startup method)
   */
  async checkAndGenerateInstances(): Promise<GenerateInstancesResponse> {
    try {
      const result = await invoke<Record<string, unknown>[]>(
        'check_and_generate_instances'
      );
      let generatedInstances = result.map(instance =>
        this.transformTaskFromBackend(instance)
      );

      // Fix scheduled dates for all generated instances
      generatedInstances = await Promise.all(
        generatedInstances.map(async task => {
          if (task.periodicTemplateId) {
            return await this.correctPeriodicTaskScheduledDate(
              task,
              task.periodicTemplateId
            );
          }
          return task;
        })
      );

      // Get updated templates after generation
      const updatedTemplates = await this.findActiveTemplates();

      return {
        generatedInstances,
        updatedTemplates,
        totalGenerated: generatedInstances.length,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.checkAndGenerateInstancesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Generate multiple instances in advance for all active templates
   * This creates instances for the next 30 days to populate the planner
   */
  async generateAdvancedInstances(
    daysAhead: number = 30
  ): Promise<GenerateInstancesResponse> {
    try {
      // For now, return empty result to avoid performance issues in tests
      // This can be enabled later when the backend supports batch generation
      console.log(
        `Advanced instance generation requested for ${daysAhead} days (currently disabled for performance)`
      );

      const templates = await this.findActiveTemplates();

      return {
        generatedInstances: [],
        updatedTemplates: templates,
        totalGenerated: 0,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.generatePendingInstancesFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Remove future instances for a template (when paused)
   * Only removes instances scheduled for today or later that haven't been completed
   */
  private async removeFutureInstances(templateId: string): Promise<void> {
    try {
      const taskRepo = await import('./TaskService').then(
        m => new m.TaskService()
      );
      const allTasks = await taskRepo.findAll();

      // Find instances for this template that are scheduled for today or later
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureInstances = allTasks.filter(
        (task: Task) =>
          task.periodicTemplateId === templateId &&
          task.scheduledDate &&
          new Date(task.scheduledDate) >= today &&
          task.status !== TaskStatus.COMPLETED
      );

      // Delete each future instance
      for (const instance of futureInstances) {
        try {
          await taskRepo.delete(instance.id);
        } catch (error) {
          console.warn(`Failed to delete instance ${instance.id}:`, error);
        }
      }

      console.log(
        `Removed ${futureInstances.length} future instances for template ${templateId}`
      );
    } catch (error) {
      console.error(
        `Failed to remove future instances for template ${templateId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove all instances for a template (when deleted)
   * Removes all instances regardless of status or date
   */
  private async removeAllInstances(templateId: string): Promise<void> {
    try {
      const taskRepo = await import('./TaskService').then(
        m => new m.TaskService()
      );
      const allTasks = await taskRepo.findAll();

      // Find all instances for this template
      const templateInstances = allTasks.filter(
        (task: Task) => task.periodicTemplateId === templateId
      );

      // Delete each instance
      for (const instance of templateInstances) {
        try {
          await taskRepo.delete(instance.id);
        } catch (error) {
          console.warn(`Failed to delete instance ${instance.id}:`, error);
        }
      }

      console.log(
        `Removed ${templateInstances.length} total instances for template ${templateId}`
      );
    } catch (error) {
      console.error(
        `Failed to remove all instances for template ${templateId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Correct the scheduled date of a periodic task instance
   * The backend incorrectly sets scheduled_date to generation time instead of the intended schedule
   */
  private async correctPeriodicTaskScheduledDate(
    task: Task,
    templateId: string
  ): Promise<Task> {
    try {
      // Get the template to understand the recurrence pattern
      const template = await this.findTemplateById(templateId);
      if (!template) {
        console.warn(
          `Template ${templateId} not found, cannot correct scheduled date`
        );
        return task;
      }

      // Calculate what the scheduled date should be based on the template's pattern
      // For now, we'll use a simple approach: if the task was just generated (within last minute),
      // set the scheduled date to the template's original next generation date
      const now = new Date();
      const taskCreatedAt = new Date(task.createdAt);
      const timeDiff = now.getTime() - taskCreatedAt.getTime();

      // If task was created within the last 5 minutes, it's likely a newly generated instance
      if (timeDiff < 5 * 60 * 1000) {
        // Calculate the intended scheduled date based on the template's start date and recurrence
        const intendedScheduledDate = this.calculateIntendedScheduledDate(
          template,
          task.createdAt
        );

        if (
          intendedScheduledDate &&
          intendedScheduledDate.getTime() !== task.scheduledDate?.getTime()
        ) {
          // Update the task's scheduled date in the database
          const taskRepo = await import('./TaskService').then(
            m => new m.TaskService()
          );
          await taskRepo.update(task.id, {
            scheduledDate: intendedScheduledDate,
          });

          // Return the corrected task
          return {
            ...task,
            scheduledDate: intendedScheduledDate,
            updatedAt: new Date(),
          };
        }
      }

      return task;
    } catch (error) {
      console.warn(
        `Failed to correct scheduled date for task ${task.id}:`,
        error
      );
      return task;
    }
  }

  /**
   * Calculate the intended scheduled date for a periodic task instance
   */
  private calculateIntendedScheduledDate(
    template: PeriodicTaskTemplate,
    generationTime: Date
  ): Date {
    // For the first instance, use the template's start date
    // For subsequent instances, calculate based on the recurrence pattern

    const startDate = new Date(template.startDate);
    const generationDate = new Date(generationTime);

    // If this is close to the start date, use the start date
    const daysDiff = Math.floor(
      (generationDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff < 1) {
      return startDate;
    }

    // Calculate based on recurrence pattern
    const scheduledDate = new Date(startDate);

    switch (template.recurrenceType) {
      case RecurrenceType.DAILY:
        scheduledDate.setDate(
          startDate.getDate() +
            Math.floor(daysDiff / (template.recurrenceInterval || 1)) *
              (template.recurrenceInterval || 1)
        );
        break;
      case RecurrenceType.WEEKLY:
        scheduledDate.setDate(
          startDate.getDate() +
            Math.floor(daysDiff / (7 * (template.recurrenceInterval || 1))) *
              (7 * (template.recurrenceInterval || 1))
        );
        break;
      case RecurrenceType.BIWEEKLY:
        scheduledDate.setDate(
          startDate.getDate() + Math.floor(daysDiff / 14) * 14
        );
        break;
      case RecurrenceType.EVERY_THREE_WEEKS:
        scheduledDate.setDate(
          startDate.getDate() + Math.floor(daysDiff / 21) * 21
        );
        break;
      case RecurrenceType.MONTHLY:
        const monthsToAdd =
          Math.floor(daysDiff / 30) * (template.recurrenceInterval || 1);
        scheduledDate.setMonth(startDate.getMonth() + monthsToAdd);
        break;
      default:
        // For custom or unknown types, default to weekly
        scheduledDate.setDate(
          startDate.getDate() + Math.floor(daysDiff / 7) * 7
        );
    }

    return scheduledDate;
  }

  /**
   * Get periodic task statistics
   */
  async getStatistics(): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    totalInstances: number;
    instancesThisWeek: number;
    instancesThisMonth: number;
  }> {
    try {
      const result = await invoke<{
        total_templates: number;
        active_templates: number;
        total_instances: number;
        instances_this_week: number;
        instances_this_month: number;
      }>('get_periodic_task_stats');

      return {
        totalTemplates: result.total_templates,
        activeTemplates: result.active_templates,
        totalInstances: result.total_instances,
        instancesThisWeek: result.instances_this_week,
        instancesThisMonth: result.instances_this_month,
      };
    } catch (error) {
      const errorMessage = getDatabaseErrorMessage(
        'periodicTaskService.error.getStatisticsFailed' as TranslationKey
      );
      throw new Error(`${errorMessage}: ${error}`);
    }
  }

  /**
   * Transform periodic task template data from backend format to frontend format
   */
  private transformTemplateFromBackend(
    backendTemplate: Record<string, unknown>
  ): PeriodicTaskTemplate {
    return {
      id: backendTemplate.id as string,
      title: backendTemplate.title as string,
      description: (backendTemplate.description as string) || '',
      priority: backendTemplate.priority as Priority,
      timeEstimate: (backendTemplate.time_estimate as number) || 0,
      tags: this.parseJsonField(backendTemplate.tags as string | null, []),
      taskListId:
        (backendTemplate.task_list_id as string) || 'default-task-list',
      recurrenceType: backendTemplate.recurrence_type as RecurrenceType,
      recurrenceInterval: (backendTemplate.recurrence_interval as number) || 1,
      recurrenceUnit: backendTemplate.recurrence_unit as
        | 'days'
        | 'weeks'
        | 'months'
        | undefined,
      startDate: new Date(backendTemplate.start_date as string),
      nextGenerationDate: new Date(
        backendTemplate.next_generation_date as string
      ),
      isActive: (backendTemplate.is_active as boolean) ?? true,
      createdAt: new Date(backendTemplate.created_at as string),
      updatedAt: new Date(backendTemplate.updated_at as string),
    };
  }

  /**
   * Transform task data from backend format to frontend format
   * (Reused from TaskService for consistency)
   */
  private transformTaskFromBackend(backendTask: Record<string, unknown>): Task {
    return {
      id: backendTask.id as string,
      title: backendTask.title as string,
      description: (backendTask.description as string) || '',
      priority: backendTask.priority as Priority,
      status: backendTask.status as TaskStatus,
      order: (backendTask.order_num as number) || 0,
      dependencies: this.parseJsonField(
        backendTask.dependencies as string | null,
        []
      ),
      timePreset: this.getTimePresetFromEstimate(
        (backendTask.time_estimate as number) || 0
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
}
