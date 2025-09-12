// Virtual Periodic Task service for displaying future recurring tasks without generating actual instances
import { PeriodicTaskService } from './PeriodicTaskService';
import {
  Task,
  PeriodicTaskTemplate,
  TaskStatus,
  TimePreset,
  RecurrenceType,
} from '../../../types';

export interface VirtualTask extends Task {
  isVirtual: true;
  virtualId: string; // Unique identifier for virtual tasks
  originalTemplateId: string;
}

export class VirtualPeriodicTaskService {
  private periodicService: PeriodicTaskService;

  constructor() {
    this.periodicService = new PeriodicTaskService();
  }

  /**
   * Generate virtual tasks for a date range without creating actual database records
   */
  async generateVirtualTasks(
    startDate: Date,
    endDate: Date,
    existingTasks: Task[] = []
  ): Promise<VirtualTask[]> {
    try {
      // Get all active periodic task templates
      const templates = await this.periodicService.findActiveTemplates();

      if (templates.length === 0) {
        return [];
      }

      const virtualTasks: VirtualTask[] = [];

      // For each template, calculate which dates it should appear on
      for (const template of templates) {
        const templateVirtualTasks = this.generateVirtualTasksForTemplate(
          template,
          startDate,
          endDate,
          existingTasks
        );
        virtualTasks.push(...templateVirtualTasks);
      }

      return virtualTasks;
    } catch (error) {
      console.error('Failed to generate virtual periodic tasks:', error);
      return [];
    }
  }

  /**
   * Generate virtual tasks for a specific template within a date range
   */
  private generateVirtualTasksForTemplate(
    template: PeriodicTaskTemplate,
    startDate: Date,
    endDate: Date,
    existingTasks: Task[]
  ): VirtualTask[] {
    const virtualTasks: VirtualTask[] = [];

    // Get existing instances for this template to avoid duplicates
    const existingInstances = existingTasks.filter(
      task => task.periodicTemplateId === template.id
    );

    // Calculate all occurrence dates within the range
    const occurrenceDates = this.calculateOccurrenceDates(
      template,
      startDate,
      endDate
    );

    // Create virtual tasks for dates that don't have existing instances
    for (const occurrenceDate of occurrenceDates) {
      // Check if an instance already exists for this date
      const hasExistingInstance = existingInstances.some(task => {
        if (!task.scheduledDate) {
          return false;
        }

        const taskDate = new Date(task.scheduledDate);
        const occurrenceDateTime = new Date(occurrenceDate);

        // Compare dates (ignore time)
        return (
          taskDate.getFullYear() === occurrenceDateTime.getFullYear() &&
          taskDate.getMonth() === occurrenceDateTime.getMonth() &&
          taskDate.getDate() === occurrenceDateTime.getDate()
        );
      });

      if (!hasExistingInstance) {
        const virtualTask = this.createVirtualTaskFromTemplate(
          template,
          occurrenceDate
        );
        virtualTasks.push(virtualTask);
      }
    }

    return virtualTasks;
  }

  /**
   * Calculate all occurrence dates for a template within a date range
   */
  private calculateOccurrenceDates(
    template: PeriodicTaskTemplate,
    startDate: Date,
    endDate: Date
  ): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(template.startDate);

    // Ensure we start from the template's start date or the range start date, whichever is later
    if (currentDate < startDate) {
      currentDate = this.findNextOccurrenceAfter(template, startDate);
    }

    // Generate dates until we exceed the end date
    while (currentDate <= endDate) {
      // Only include dates that are within our range
      if (currentDate >= startDate) {
        dates.push(new Date(currentDate));
      }

      // Calculate next occurrence
      currentDate = this.calculateNextOccurrence(template, currentDate);

      // Safety check to prevent infinite loops
      if (dates.length > 1000) {
        console.warn(
          'Virtual task generation exceeded 1000 occurrences, stopping'
        );
        break;
      }
    }

    return dates;
  }

  /**
   * Find the next occurrence of a template after a given date
   */
  private findNextOccurrenceAfter(
    template: PeriodicTaskTemplate,
    afterDate: Date
  ): Date {
    let currentDate = new Date(template.startDate);

    // If the start date is already after the target date, return it
    if (currentDate >= afterDate) {
      return currentDate;
    }

    // Calculate how many intervals we need to skip
    const timeDiff = afterDate.getTime() - currentDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    let intervalsToSkip = 0;

    switch (template.recurrenceType) {
      case RecurrenceType.DAILY:
        intervalsToSkip = Math.floor(
          daysDiff / (template.recurrenceInterval || 1)
        );
        break;
      case RecurrenceType.WEEKLY:
        intervalsToSkip = Math.floor(
          daysDiff / (7 * (template.recurrenceInterval || 1))
        );
        break;
      case RecurrenceType.BIWEEKLY:
        intervalsToSkip = Math.floor(daysDiff / 14);
        break;
      case RecurrenceType.EVERY_THREE_WEEKS:
        intervalsToSkip = Math.floor(daysDiff / 21);
        break;
      case RecurrenceType.MONTHLY:
        intervalsToSkip = Math.floor(daysDiff / 30); // Approximate
        break;
      default:
        intervalsToSkip = Math.floor(daysDiff / 7); // Default to weekly
    }

    // Skip the calculated intervals
    for (let i = 0; i < intervalsToSkip; i++) {
      currentDate = this.calculateNextOccurrence(template, currentDate);
    }

    // If we're still before the target date, advance one more time
    while (currentDate < afterDate) {
      currentDate = this.calculateNextOccurrence(template, currentDate);
    }

    return currentDate;
  }

  /**
   * Calculate the next occurrence date based on recurrence pattern
   */
  private calculateNextOccurrence(
    template: PeriodicTaskTemplate,
    currentDate: Date
  ): Date {
    const nextDate = new Date(currentDate);

    switch (template.recurrenceType) {
      case RecurrenceType.DAILY:
        nextDate.setDate(
          nextDate.getDate() + (template.recurrenceInterval || 1)
        );
        break;
      case RecurrenceType.WEEKLY:
        nextDate.setDate(
          nextDate.getDate() + 7 * (template.recurrenceInterval || 1)
        );
        break;
      case RecurrenceType.BIWEEKLY:
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case RecurrenceType.EVERY_THREE_WEEKS:
        nextDate.setDate(nextDate.getDate() + 21);
        break;
      case RecurrenceType.MONTHLY:
        nextDate.setMonth(
          nextDate.getMonth() + (template.recurrenceInterval || 1)
        );
        break;
      case RecurrenceType.CUSTOM:
        if (template.recurrenceUnit === 'days') {
          nextDate.setDate(
            nextDate.getDate() + (template.recurrenceInterval || 1)
          );
        } else if (template.recurrenceUnit === 'weeks') {
          nextDate.setDate(
            nextDate.getDate() + 7 * (template.recurrenceInterval || 1)
          );
        } else if (template.recurrenceUnit === 'months') {
          nextDate.setMonth(
            nextDate.getMonth() + (template.recurrenceInterval || 1)
          );
        }
        break;
      default:
        // Default to weekly if unknown
        nextDate.setDate(nextDate.getDate() + 7);
    }

    return nextDate;
  }

  /**
   * Create a virtual task from a template for a specific date
   */
  private createVirtualTaskFromTemplate(
    template: PeriodicTaskTemplate,
    scheduledDate: Date
  ): VirtualTask {
    const virtualId = `virtual-${template.id}-${scheduledDate.getTime()}`;

    return {
      id: virtualId,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      status: TaskStatus.PENDING,
      order: 0,
      dependencies: [],
      timePreset: this.getTimePresetFromEstimate(template.timeEstimate),
      timeEstimate: template.timeEstimate,
      actualTime: 0,
      dueDate: undefined,
      scheduledDate: new Date(scheduledDate),
      tags: template.tags || [],
      projectId: undefined,
      parentTaskId: undefined,
      subtasks: [],
      taskListId: template.taskListId,
      periodicTemplateId: template.id,
      isPeriodicInstance: false, // Virtual tasks are not actual instances
      generationDate: undefined,
      completedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Virtual task specific properties
      isVirtual: true,
      virtualId,
      originalTemplateId: template.id,
    };
  }

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
   * Convert a virtual task to a real task instance
   * This is called when the user interacts with a virtual task
   */
  async materializeVirtualTask(virtualTask: VirtualTask): Promise<Task> {
    try {
      // Generate a real instance from the template for the specific date
      const template = await this.periodicService.findTemplateById(
        virtualTask.originalTemplateId
      );

      if (!template) {
        throw new Error('Template not found for virtual task');
      }

      // Create a real task instance
      const realTask = await this.periodicService.generateInstanceFromTemplate(
        template.id
      );

      // Update the scheduled date to match the virtual task's date
      const taskService = await import('./TaskService').then(
        m => new m.TaskService()
      );
      const updatedTask = await taskService.update(realTask.id, {
        scheduledDate: virtualTask.scheduledDate,
      });

      return updatedTask;
    } catch (error) {
      console.error('Failed to materialize virtual task:', error);
      throw error;
    }
  }

  /**
   * Check if a task is a virtual task
   */
  static isVirtualTask(task: Task | VirtualTask): task is VirtualTask {
    return 'isVirtual' in task && task.isVirtual === true;
  }

  /**
   * Get virtual tasks for the current week
   */
  async getVirtualTasksForWeek(
    weekStart: Date,
    existingTasks: Task[] = []
  ): Promise<VirtualTask[]> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return this.generateVirtualTasks(weekStart, weekEnd, existingTasks);
  }

  /**
   * Get virtual tasks for a specific day
   */
  async getVirtualTasksForDay(
    date: Date,
    existingTasks: Task[] = []
  ): Promise<VirtualTask[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return this.generateVirtualTasks(dayStart, dayEnd, existingTasks);
  }
}
