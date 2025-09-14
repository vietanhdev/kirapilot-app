/**
 * WeekTransitionDetector service for detecting week transitions and managing migration prompts
 */

import { Task } from '../types';
import { TaskService } from './database/repositories/TaskService';
import {
  getWeekIdentifier,
  getWeekStartDate,
  getWeekRange,
} from '../utils/dateFormat';

export interface MigrationPreferences {
  enabled: boolean;
  dismissedWeeks: Set<string>;
  autoSuggestScheduling: boolean;
  showDependencyWarnings: boolean;
}

export interface DetectorError {
  type:
    | 'service_unavailable'
    | 'network_error'
    | 'validation_error'
    | 'timeout_error';
  message: string;
  recoverable: boolean;
  timestamp: Date;
}

export interface DetectorHealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  errors: DetectorError[];
  capabilities: {
    canDetectTransitions: boolean;
    canQueryTasks: boolean;
    canValidatePreferences: boolean;
  };
}

export class WeekTransitionDetector {
  private taskService: TaskService;
  private migrationPreferences: MigrationPreferences;
  private lastHealthCheck?: DetectorHealthStatus;
  private readonly healthCheckInterval = 5 * 60 * 1000; // 5 minutes

  constructor(taskService: TaskService) {
    this.taskService = taskService;
    this.migrationPreferences = {
      enabled: true,
      dismissedWeeks: new Set<string>(),
      autoSuggestScheduling: true,
      showDependencyWarnings: true,
    };
  }

  /**
   * Detect if there's a week transition between two dates
   * @param currentDate The current date being navigated to
   * @param previousDate The previous date (can be null for initial navigation)
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns true if there's a week transition, false otherwise
   */
  detectWeekTransition(
    currentDate: Date,
    previousDate: Date | null,
    weekStartDay: 0 | 1
  ): boolean {
    if (!previousDate) {
      return false; // No transition on initial navigation
    }

    const currentWeekId = getWeekIdentifier(currentDate, weekStartDay);
    const previousWeekId = getWeekIdentifier(previousDate, weekStartDay);

    return currentWeekId !== previousWeekId;
  }

  /**
   * Determine if migration prompt should be shown with error handling
   * @param currentWeek The current week date
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns true if prompt should be shown, false otherwise
   */
  async shouldShowMigrationPrompt(
    currentWeek: Date,
    weekStartDay: 0 | 1
  ): Promise<boolean> {
    try {
      // Check if migration is enabled
      if (!this.migrationPreferences.enabled) {
        return false;
      }

      // Get the current week identifier
      const currentWeekId = getWeekIdentifier(currentWeek, weekStartDay);

      // Check if this week was already dismissed
      if (this.migrationPreferences.dismissedWeeks.has(currentWeekId)) {
        return false;
      }

      // Check if there are incomplete tasks from the previous week
      const incompleteTasks =
        await this.getIncompleteTasksFromPreviousWeekWithRetry(
          currentWeek,
          weekStartDay
        );

      return incompleteTasks.length > 0;
    } catch (error) {
      console.error(
        'Failed to determine if migration prompt should be shown:',
        error
      );

      // Graceful degradation: if we can't determine, don't show prompt
      // This prevents blocking the user interface
      return false;
    }
  }

  /**
   * Get incomplete tasks from the previous week
   * @param currentWeek The current week date
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @param currentDate Optional current date for testing (defaults to now)
   * @returns Array of incomplete tasks from the previous week
   */
  async getIncompleteTasksFromPreviousWeek(
    currentWeek: Date,
    weekStartDay: 0 | 1,
    currentDate?: Date
  ): Promise<Task[]> {
    try {
      // Calculate the previous week date
      const previousWeekDate = new Date(currentWeek);
      previousWeekDate.setDate(previousWeekDate.getDate() - 7);

      // Get incomplete tasks from the previous week
      const incompleteTasks = await this.taskService.getIncompleteTasksFromWeek(
        previousWeekDate,
        weekStartDay
      );

      // Filter tasks based on periodic instance rules
      return this.filterPeriodicTasksForMigration(incompleteTasks, currentDate);
    } catch (error) {
      console.error(
        'Failed to get incomplete tasks from previous week:',
        error
      );
      return [];
    }
  }

  /**
   * Get incomplete tasks from previous week with retry logic
   * @param currentWeek The current week date
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @param currentDate Optional current date for testing (defaults to now)
   * @returns Array of incomplete tasks from the previous week
   */
  async getIncompleteTasksFromPreviousWeekWithRetry(
    currentWeek: Date,
    weekStartDay: 0 | 1,
    currentDate?: Date,
    maxRetries: number = 3
  ): Promise<Task[]> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getIncompleteTasksFromPreviousWeek(
          currentWeek,
          weekStartDay,
          currentDate
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(
      'Failed to get incomplete tasks after all retries:',
      lastError
    );
    return [];
  }

  /**
   * Filter periodic tasks according to migration rules
   * @param tasks Array of tasks to filter
   * @param currentDate Optional current date for testing (defaults to now)
   * @returns Filtered array of tasks suitable for migration
   */
  private async filterPeriodicTasksForMigration(
    tasks: Task[],
    currentDate?: Date
  ): Promise<Task[]> {
    const today = currentDate || new Date();
    today.setHours(0, 0, 0, 0);

    const filteredTasks: Task[] = [];

    for (const task of tasks) {
      // Always include regular (non-periodic) tasks
      if (!task.isPeriodicInstance) {
        filteredTasks.push(task);
        continue;
      }

      // For periodic instances, apply special rules
      if (await this.shouldIncludePeriodicTaskInMigration(task, today)) {
        filteredTasks.push(task);
      }
    }

    return filteredTasks;
  }

  /**
   * Determine if a periodic task instance should be included in migration
   * @param task The periodic task instance to evaluate
   * @param currentDate The current date for comparison
   * @returns true if the task should be included in migration
   */
  private async shouldIncludePeriodicTaskInMigration(
    task: Task,
    currentDate: Date
  ): Promise<boolean> {
    // Exclude periodic instances without template IDs (orphaned tasks)
    if (!task.periodicTemplateId) {
      return false;
    }

    // Only include overdue periodic instances
    if (!task.scheduledDate) {
      return false;
    }

    const scheduledDate = new Date(task.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);

    // Task must be overdue to be considered for migration
    const isOverdue = scheduledDate < currentDate;
    if (!isOverdue) {
      return false;
    }

    // Check if there are future instances already generated for this template
    const hasFutureInstances = await this.hasFuturePeriodicInstances(
      task.periodicTemplateId,
      currentDate
    );

    // If there are future instances, exclude this overdue one from migration
    // This prevents interference with the automatic generation system
    if (hasFutureInstances) {
      return false;
    }

    return true;
  }

  /**
   * Check if a periodic template has future instances already generated
   * @param templateId The periodic template ID
   * @param currentDate The current date for comparison
   * @returns true if future instances exist
   */
  private async hasFuturePeriodicInstances(
    templateId: string,
    currentDate: Date
  ): Promise<boolean> {
    try {
      // Get all tasks for this periodic template
      const templateTasks = await this.taskService.findAll({
        periodicTemplateId: templateId,
        periodicFilter: 'instances_only',
      });

      // Check if any instances are scheduled for future dates
      return templateTasks.some(task => {
        if (!task.scheduledDate) {
          return false;
        }

        const scheduledDate = new Date(task.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);

        return scheduledDate >= currentDate;
      });
    } catch (error) {
      console.error('Failed to check for future periodic instances:', error);
      // On error, be conservative and assume future instances exist
      return true;
    }
  }

  /**
   * Generate a consistent week identifier for tracking
   * @param date The date to generate identifier for
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns Week identifier string in YYYY-MM-DD format
   */
  generateWeekIdentifier(date: Date, weekStartDay: 0 | 1): string {
    return getWeekIdentifier(date, weekStartDay);
  }

  /**
   * Get migration preferences
   * @returns Current migration preferences
   */
  getMigrationPreferences(): MigrationPreferences {
    return { ...this.migrationPreferences };
  }

  /**
   * Update migration preferences
   * @param preferences New migration preferences
   */
  updateMigrationPreferences(preferences: Partial<MigrationPreferences>): void {
    this.migrationPreferences = {
      ...this.migrationPreferences,
      ...preferences,
    };
  }

  /**
   * Add a week to the dismissed weeks set
   * @param weekIdentifier The week identifier to dismiss
   */
  dismissWeek(weekIdentifier: string): void {
    this.migrationPreferences.dismissedWeeks.add(weekIdentifier);
  }

  /**
   * Clear all dismissed weeks
   */
  clearDismissedWeeks(): void {
    this.migrationPreferences.dismissedWeeks.clear();
  }

  /**
   * Disable migration prompts entirely
   */
  disableMigration(): void {
    this.migrationPreferences.enabled = false;
  }

  /**
   * Enable migration prompts
   */
  enableMigration(): void {
    this.migrationPreferences.enabled = true;
  }

  /**
   * Check if a specific week transition should trigger a prompt
   * @param fromDate The date being navigated from
   * @param toDate The date being navigated to
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns true if this transition should show a prompt
   */
  async shouldTriggerMigrationPrompt(
    fromDate: Date | null,
    toDate: Date,
    weekStartDay: 0 | 1
  ): Promise<boolean> {
    // Must be a week transition
    if (!this.detectWeekTransition(toDate, fromDate, weekStartDay)) {
      return false;
    }

    // Must pass other migration prompt checks
    return this.shouldShowMigrationPrompt(toDate, weekStartDay);
  }

  /**
   * Get the week range for a given date
   * @param date The date to get the week range for
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns Object with weekStart and weekEnd dates
   */
  getWeekRange(
    date: Date,
    weekStartDay: 0 | 1
  ): { weekStart: Date; weekEnd: Date } {
    return getWeekRange(date, weekStartDay);
  }

  /**
   * Get the start of the week for a given date
   * @param date The date to get the week start for
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns Date object representing the start of the week
   */
  getWeekStartDate(date: Date, weekStartDay: 0 | 1): Date {
    return getWeekStartDate(date, weekStartDay);
  }

  /**
   * Validate that periodic task instances maintain their template connections during migration
   * @param tasks Array of tasks being migrated
   * @returns Validation result with any issues found
   */
  validatePeriodicTaskMigration(tasks: Task[]): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const task of tasks) {
      if (task.isPeriodicInstance) {
        // Ensure periodic instances have template IDs
        if (!task.periodicTemplateId) {
          errors.push(
            `Periodic task instance "${task.title}" is missing template ID`
          );
        }

        // Ensure generation date is preserved
        if (!task.generationDate) {
          warnings.push(
            `Periodic task instance "${task.title}" is missing generation date`
          );
        }

        // Warn about potential interference with automatic generation
        warnings.push(
          `Migrating periodic task "${task.title}" may affect its template's generation schedule`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Get migration-safe periodic tasks that won't interfere with automatic generation
   * @param tasks Array of tasks to filter
   * @param currentDate Optional current date for testing
   * @returns Array of tasks safe for migration
   */
  async getMigrationSafePeriodicTasks(
    tasks: Task[],
    currentDate?: Date
  ): Promise<Task[]> {
    const safeTasks: Task[] = [];

    for (const task of tasks) {
      if (!task.isPeriodicInstance) {
        safeTasks.push(task);
        continue;
      }

      // Only include periodic tasks that are safe to migrate
      if (
        await this.shouldIncludePeriodicTaskInMigration(
          task,
          currentDate || new Date()
        )
      ) {
        safeTasks.push(task);
      }
    }

    return safeTasks;
  }

  /**
   * Get incomplete tasks from any specified week (for manual migration)
   * @param weekDate The week date to get tasks from
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @param currentDate Optional current date for testing (defaults to now)
   * @returns Array of incomplete tasks from the specified week
   */
  async getIncompleteTasksFromWeek(
    weekDate: Date,
    weekStartDay: 0 | 1,
    currentDate?: Date
  ): Promise<Task[]> {
    try {
      // Get incomplete tasks from the specified week
      const incompleteTasks = await this.taskService.getIncompleteTasksFromWeek(
        weekDate,
        weekStartDay
      );

      // Filter tasks based on periodic instance rules
      return this.filterPeriodicTasksForMigration(incompleteTasks, currentDate);
    } catch (error) {
      console.error('Failed to get incomplete tasks from week:', error);
      return [];
    }
  }

  /**
   * Get available weeks with incomplete tasks for manual migration
   * @param currentWeek The current week to exclude from results
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @param maxWeeksBack Maximum number of weeks to look back (default: 8)
   * @returns Array of week dates that have incomplete tasks
   */
  async getAvailableWeeksForMigration(
    currentWeek: Date,
    weekStartDay: 0 | 1,
    maxWeeksBack: number = 8
  ): Promise<Date[]> {
    const availableWeeks: Date[] = [];

    try {
      for (let i = 1; i <= maxWeeksBack; i++) {
        const weekDate = new Date(currentWeek);
        weekDate.setDate(weekDate.getDate() - 7 * i);

        const incompleteTasks = await this.getIncompleteTasksFromWeek(
          weekDate,
          weekStartDay
        );

        if (incompleteTasks.length > 0) {
          availableWeeks.push(weekDate);
        }
      }
    } catch (error) {
      console.error('Failed to get available weeks for migration:', error);
    }

    return availableWeeks;
  }

  /**
   * Format week date for display in manual migration UI
   * @param weekDate The week date to format
   * @param weekStartDay 0 for Sunday, 1 for Monday
   * @returns Formatted week string
   */
  formatWeekForDisplay(weekDate: Date, weekStartDay: 0 | 1): string {
    const weekStart = this.getWeekStartDate(weekDate, weekStartDay);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };

    const startStr = weekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);

    return `${startStr} - ${endStr}, ${weekStart.getFullYear()}`;
  }

  /**
   * Check the health of the detector service
   */
  async checkHealth(): Promise<DetectorHealthStatus> {
    const errors: DetectorError[] = [];
    let canDetectTransitions = true;
    let canQueryTasks = true;
    let canValidatePreferences = true;

    // Test task service connectivity
    try {
      await this.taskService.findAll({});
    } catch {
      canQueryTasks = false;
      canDetectTransitions = false;
      errors.push({
        type: 'service_unavailable',
        message: 'Task service is unavailable',
        recoverable: true,
        timestamp: new Date(),
      });
    }

    // Test week calculation utilities
    try {
      const testDate = new Date();
      getWeekIdentifier(testDate, 1);
      getWeekStartDate(testDate, 1);
      getWeekRange(testDate, 1);
    } catch {
      canDetectTransitions = false;
      errors.push({
        type: 'validation_error',
        message: 'Week calculation utilities failed',
        recoverable: false,
        timestamp: new Date(),
      });
    }

    // Test preferences access
    try {
      // Simple preference validation
      if (typeof this.migrationPreferences.enabled !== 'boolean') {
        throw new Error('Invalid preferences state');
      }
    } catch {
      canValidatePreferences = false;
      errors.push({
        type: 'validation_error',
        message: 'Migration preferences are corrupted',
        recoverable: true,
        timestamp: new Date(),
      });
    }

    const healthStatus: DetectorHealthStatus = {
      isHealthy: errors.length === 0,
      lastCheck: new Date(),
      errors,
      capabilities: {
        canDetectTransitions,
        canQueryTasks,
        canValidatePreferences,
      },
    };

    this.lastHealthCheck = healthStatus;
    return healthStatus;
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): DetectorHealthStatus | undefined {
    return this.lastHealthCheck;
  }

  /**
   * Determine if a health check is needed
   */
  needsHealthCheck(): boolean {
    if (!this.lastHealthCheck) {
      return true;
    }

    const timeSinceLastCheck =
      Date.now() - this.lastHealthCheck.lastCheck.getTime();
    return timeSinceLastCheck > this.healthCheckInterval;
  }

  /**
   * Attempt to recover from service failures
   */
  async attemptRecovery(): Promise<boolean> {
    try {
      const health = await this.checkHealth();

      if (health.isHealthy) {
        return true;
      }

      // Attempt to recover from specific errors
      for (const error of health.errors) {
        if (error.recoverable) {
          switch (error.type) {
            case 'service_unavailable':
              // Wait and retry service connection
              await new Promise(resolve => setTimeout(resolve, 2000));
              break;
            case 'validation_error':
              // Reset preferences if corrupted
              if (error.message.includes('preferences')) {
                this.resetPreferences();
              }
              break;
          }
        }
      }

      // Check health again after recovery attempts
      const recoveryHealth = await this.checkHealth();
      return recoveryHealth.isHealthy;
    } catch {
      return false;
    }
  }

  /**
   * Reset preferences to default state
   */
  private resetPreferences(): void {
    this.migrationPreferences = {
      enabled: true,
      dismissedWeeks: new Set<string>(),
      autoSuggestScheduling: true,
      showDependencyWarnings: true,
    };
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): {
    isOperational: boolean;
    lastHealthCheck?: Date;
    errorCount: number;
    capabilities: string[];
  } {
    const health = this.lastHealthCheck;
    const capabilities: string[] = [];

    if (health?.capabilities.canDetectTransitions) {
      capabilities.push('week-transition-detection');
    }
    if (health?.capabilities.canQueryTasks) {
      capabilities.push('task-querying');
    }
    if (health?.capabilities.canValidatePreferences) {
      capabilities.push('preference-validation');
    }

    return {
      isOperational: health?.isHealthy ?? false,
      lastHealthCheck: health?.lastCheck,
      errorCount: health?.errors.length ?? 0,
      capabilities,
    };
  }
}
