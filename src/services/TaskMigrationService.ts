import { Task, ValidationResult } from '../types';
import { TaskService } from './database/repositories/TaskService';

// Re-export TaskMigration interface from dialog component for consistency
export interface TaskMigration {
  taskId: string;
  newScheduledDate: Date;
}

export interface MigrationResult {
  successful: TaskMigration[];
  failed: { migration: TaskMigration; error: string }[];
  summary: {
    totalMigrated: number;
    byDay: Record<string, number>;
  };
}

export interface TaskSchedulingSuggestion {
  taskId: string;
  suggestedDate: Date;
  reason: 'priority' | 'time_estimate' | 'dependencies' | 'workload_balance';
  confidence: number;
}

export enum MigrationErrorType {
  TASK_NOT_FOUND = 'task_not_found',
  INVALID_DATE = 'invalid_date',
  DATABASE_ERROR = 'database_error',
  DEPENDENCY_CONFLICT = 'dependency_conflict',
  PERMISSION_DENIED = 'permission_denied',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  CONCURRENT_MODIFICATION = 'concurrent_modification',
  STORAGE_FULL = 'storage_full',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT_ERROR = 'timeout_error',
  PERIODIC_TASK_CONFLICT = 'periodic_task_conflict',
}

export interface MigrationError {
  type: MigrationErrorType;
  taskId?: string;
  message: string;
  recoverable: boolean;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  originalError?: Error;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: MigrationErrorType[];
}

export interface MigrationRecoveryOptions {
  enableRetry: boolean;
  enablePartialSuccess: boolean;
  enableGracefulDegradation: boolean;
  retryConfig: RetryConfig;
  fallbackBehavior: 'fail' | 'skip' | 'defer';
}

export interface MigrationAttempt {
  migration: TaskMigration;
  attempts: number;
  lastError?: MigrationError;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  startTime: Date;
  endTime?: Date;
}

export interface DependencyConflict {
  taskId: string;
  taskTitle: string;
  conflictType: 'dependency_after' | 'dependent_before' | 'circular_dependency';
  conflictingTaskId: string;
  conflictingTaskTitle: string;
  conflictingTaskDate?: Date;
  severity: 'warning' | 'error';
  suggestion?: string;
}

export interface DependencyValidationResult {
  hasConflicts: boolean;
  conflicts: DependencyConflict[];
  suggestedMigrations: TaskMigration[];
}

export class TaskMigrationService {
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      MigrationErrorType.DATABASE_ERROR,
      MigrationErrorType.NETWORK_ERROR,
      MigrationErrorType.TIMEOUT_ERROR,
      MigrationErrorType.CONCURRENT_MODIFICATION,
      MigrationErrorType.SERVICE_UNAVAILABLE,
    ],
  };

  private readonly defaultRecoveryOptions: MigrationRecoveryOptions = {
    enableRetry: true,
    enablePartialSuccess: true,
    enableGracefulDegradation: true,
    retryConfig: this.defaultRetryConfig,
    fallbackBehavior: 'skip',
  };

  constructor(private taskService: TaskService) {}

  /**
   * Migrate tasks to new scheduled dates with comprehensive error handling and recovery
   */
  async migrateTasksToWeek(
    migrations: TaskMigration[],
    recoveryOptions?: Partial<MigrationRecoveryOptions>
  ): Promise<MigrationResult> {
    const options = { ...this.defaultRecoveryOptions, ...recoveryOptions };
    const attempts = new Map<string, MigrationAttempt>();

    // Initialize migration attempts
    migrations.forEach(migration => {
      attempts.set(migration.taskId, {
        migration,
        attempts: 0,
        status: 'pending',
        startTime: new Date(),
      });
    });

    // Pre-validate all migrations if service is available
    let validationResults: ValidationResult[] = [];
    try {
      validationResults = await this.validateMigrations(migrations);
    } catch (error) {
      if (options.enableGracefulDegradation) {
        console.warn(
          'Migration validation failed, proceeding with basic validation:',
          error
        );
        validationResults = migrations.map(() => ({
          isValid: true,
          errors: [],
          warnings: [],
        }));
      } else {
        throw this.createMigrationError(
          MigrationErrorType.SERVICE_UNAVAILABLE,
          'Migration validation service unavailable',
          error instanceof Error ? error : undefined
        );
      }
    }

    // Process migrations with retry logic
    const results = await this.processMigrationsWithRetry(
      migrations,
      validationResults,
      attempts,
      options
    );

    return this.compileMigrationResults(results, attempts);
  }

  /**
   * Process migrations with retry logic and error recovery
   */
  private async processMigrationsWithRetry(
    migrations: TaskMigration[],
    validationResults: ValidationResult[],
    attempts: Map<string, MigrationAttempt>,
    options: MigrationRecoveryOptions
  ): Promise<Map<string, { success: boolean; error?: MigrationError }>> {
    const results = new Map<
      string,
      { success: boolean; error?: MigrationError }
    >();

    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      const validation = validationResults[i];
      const attempt = attempts.get(migration.taskId)!;

      // Skip if validation failed and partial success is not enabled
      if (!validation.isValid && !options.enablePartialSuccess) {
        const error = this.createMigrationError(
          MigrationErrorType.VALIDATION_ERROR,
          validation.errors.join('; '),
          undefined,
          migration.taskId
        );
        results.set(migration.taskId, { success: false, error });
        attempt.status = 'failed';
        attempt.lastError = error;
        attempt.endTime = new Date();
        continue;
      }

      // Attempt migration with retry logic
      const result = await this.attemptMigrationWithRetry(
        migration,
        attempt,
        options
      );
      results.set(migration.taskId, result);
    }

    return results;
  }

  /**
   * Attempt a single migration with retry logic
   */
  private async attemptMigrationWithRetry(
    migration: TaskMigration,
    attempt: MigrationAttempt,
    options: MigrationRecoveryOptions
  ): Promise<{ success: boolean; error?: MigrationError }> {
    let lastError: MigrationError | undefined;

    while (attempt.attempts <= options.retryConfig.maxRetries) {
      attempt.attempts++;
      attempt.status = attempt.attempts === 1 ? 'pending' : 'retrying';

      try {
        await this.executeSingleMigration(migration);
        attempt.status = 'success';
        attempt.endTime = new Date();
        return { success: true };
      } catch (error) {
        const migrationError = this.categorizeMigrationError(
          error,
          migration.taskId
        );
        lastError = migrationError;
        attempt.lastError = migrationError;

        // Check if error is retryable
        if (
          !options.enableRetry ||
          !this.isRetryableError(migrationError, options.retryConfig) ||
          attempt.attempts >= options.retryConfig.maxRetries
        ) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = this.calculateRetryDelay(
          attempt.attempts,
          options.retryConfig
        );
        await this.sleep(delay);
      }
    }

    // Handle final failure
    attempt.status = 'failed';
    attempt.endTime = new Date();

    return {
      success: false,
      error:
        lastError ||
        this.createMigrationError(
          MigrationErrorType.DATABASE_ERROR,
          'Migration failed after all retry attempts',
          undefined,
          migration.taskId
        ),
    };
  }

  /**
   * Execute a single migration operation
   */
  private async executeSingleMigration(
    migration: TaskMigration
  ): Promise<void> {
    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Migration operation timed out'));
      }, 30000); // 30 second timeout
    });

    const migrationPromise = this.performMigrationOperation(migration);

    try {
      await Promise.race([migrationPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        throw this.createMigrationError(
          MigrationErrorType.TIMEOUT_ERROR,
          'Migration operation timed out',
          error,
          migration.taskId
        );
      }
      throw error;
    }
  }

  /**
   * Perform the actual migration operation
   */
  private async performMigrationOperation(
    migration: TaskMigration
  ): Promise<void> {
    // Get the task to check if it's a periodic instance
    const task = await this.taskService.findById(migration.taskId);
    if (!task) {
      throw this.createMigrationError(
        MigrationErrorType.TASK_NOT_FOUND,
        `Task with ID ${migration.taskId} not found`,
        undefined,
        migration.taskId
      );
    }

    // Check for concurrent modifications
    const currentTask = await this.taskService.findById(migration.taskId);
    if (
      !currentTask ||
      currentTask.updatedAt.getTime() !== task.updatedAt.getTime()
    ) {
      throw this.createMigrationError(
        MigrationErrorType.CONCURRENT_MODIFICATION,
        `Task ${migration.taskId} was modified by another process`,
        undefined,
        migration.taskId
      );
    }

    // Update the task's scheduled date while preserving periodic properties
    const updateData: Record<string, unknown> = {
      scheduledDate: migration.newScheduledDate,
    };

    // For periodic instances, ensure template connection is preserved
    if (task.isPeriodicInstance && task.periodicTemplateId) {
      updateData.periodicTemplateId = task.periodicTemplateId;
      updateData.isPeriodicInstance = true;

      // Preserve generation date if it exists
      if (task.generationDate) {
        updateData.generationDate = task.generationDate;
      }

      // Validate periodic task migration
      await this.validatePeriodicTaskMigrationSafety(
        task,
        migration.newScheduledDate
      );
    }

    await this.taskService.update(migration.taskId, updateData);
  }

  /**
   * Validate that periodic task migration won't cause conflicts
   */
  private async validatePeriodicTaskMigrationSafety(
    task: Task,
    newDate: Date
  ): Promise<void> {
    if (!task.periodicTemplateId) {
      return;
    }

    try {
      // Check for existing instances on the target date
      const existingInstances = await this.taskService.findAll({
        periodicTemplateId: task.periodicTemplateId,
        periodicFilter: 'instances_only',
      });

      const conflictingInstance = existingInstances.find(instance => {
        if (!instance.scheduledDate || instance.id === task.id) {
          return false;
        }

        const instanceDate = new Date(instance.scheduledDate);
        instanceDate.setHours(0, 0, 0, 0);

        const targetDate = new Date(newDate);
        targetDate.setHours(0, 0, 0, 0);

        return instanceDate.getTime() === targetDate.getTime();
      });

      if (conflictingInstance) {
        throw this.createMigrationError(
          MigrationErrorType.PERIODIC_TASK_CONFLICT,
          `Periodic task instance already exists for ${newDate.toDateString()}`,
          undefined,
          task.id
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('PERIODIC_TASK_CONFLICT')
      ) {
        throw error;
      }
      // If we can't validate, log warning but don't fail the migration
      console.warn('Could not validate periodic task migration safety:', error);
    }
  }

  /**
   * Compile final migration results from attempts
   */
  private compileMigrationResults(
    results: Map<string, { success: boolean; error?: MigrationError }>,
    attempts: Map<string, MigrationAttempt>
  ): MigrationResult {
    const successful: TaskMigration[] = [];
    const failed: { migration: TaskMigration; error: string }[] = [];
    const dayCount: Record<string, number> = {};

    for (const [taskId, result] of results) {
      const attempt = attempts.get(taskId)!;

      if (result.success) {
        successful.push(attempt.migration);

        // Count migrations by day for summary
        const dayKey = attempt.migration.newScheduledDate
          .toISOString()
          .split('T')[0];
        dayCount[dayKey] = (dayCount[dayKey] || 0) + 1;
      } else {
        failed.push({
          migration: attempt.migration,
          error: result.error?.message || 'Unknown error occurred',
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        totalMigrated: successful.length,
        byDay: dayCount,
      },
    };
  }

  /**
   * Validate migration requests
   */
  async validateMigrations(
    migrations: TaskMigration[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const migration of migrations) {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate task exists
      try {
        const task = await this.taskService.findById(migration.taskId);
        if (!task) {
          errors.push(`Task with ID ${migration.taskId} not found`);
        } else {
          // Check if task is already completed or cancelled
          if (task.status === 'completed') {
            warnings.push(`Task "${task.title}" is already completed`);
          } else if (task.status === 'cancelled') {
            errors.push(
              `Task "${task.title}" is cancelled and cannot be migrated`
            );
          }

          // Validate periodic task migration
          const periodicValidation = await this.validatePeriodicTaskMigration(
            task,
            migration.newScheduledDate
          );
          errors.push(...periodicValidation.errors);
          warnings.push(...periodicValidation.warnings);

          // Check for dependency conflicts
          if (task.dependencies.length > 0) {
            const dependencyWarnings = await this.checkDependencyConflicts(
              task,
              migration.newScheduledDate
            );
            warnings.push(...dependencyWarnings);
          }
        }
      } catch (error) {
        errors.push(
          `Failed to validate task ${migration.taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Validate date
      if (
        !migration.newScheduledDate ||
        isNaN(migration.newScheduledDate.getTime())
      ) {
        errors.push('Invalid scheduled date provided');
      } else {
        // Check if date is in the past (more than 1 day ago to allow for timezone differences)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        if (migration.newScheduledDate < oneDayAgo) {
          warnings.push('Scheduled date is in the past');
        }
      }

      results.push({
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    }

    return results;
  }

  /**
   * Validate periodic task migration to ensure template connections are maintained
   */
  private async validatePeriodicTaskMigration(
    task: Task,
    newScheduledDate: Date
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!task.isPeriodicInstance) {
      return { errors, warnings };
    }

    // Ensure periodic instance has template ID
    if (!task.periodicTemplateId) {
      errors.push(
        `Periodic task instance "${task.title}" is missing template ID and cannot be migrated safely`
      );
      return { errors, warnings };
    }

    // Warn about potential interference with automatic generation
    warnings.push(
      `Migrating periodic task "${task.title}" may affect its template's generation schedule`
    );

    // Check if there are future instances that might conflict
    try {
      const futureInstances = await this.taskService.findAll({
        periodicTemplateId: task.periodicTemplateId,
        periodicFilter: 'instances_only',
      });

      const conflictingInstances = futureInstances.filter(instance => {
        if (!instance.scheduledDate || instance.id === task.id) {
          return false;
        }

        const instanceDate = new Date(instance.scheduledDate);
        instanceDate.setHours(0, 0, 0, 0);

        const migrationDate = new Date(newScheduledDate);
        migrationDate.setHours(0, 0, 0, 0);

        return instanceDate.getTime() === migrationDate.getTime();
      });

      if (conflictingInstances.length > 0) {
        warnings.push(
          `Migrating to ${newScheduledDate.toDateString()} may conflict with existing periodic instances`
        );
      }
    } catch {
      warnings.push('Could not validate periodic task conflicts');
    }

    return { errors, warnings };
  }

  /**
   * Check for dependency conflicts when migrating a task
   */
  private async checkDependencyConflicts(
    task: Task,
    newScheduledDate: Date
  ): Promise<string[]> {
    const warnings: string[] = [];

    try {
      // Check each dependency
      for (const depId of task.dependencies) {
        const dependency = await this.taskService.findById(depId);
        if (dependency && dependency.scheduledDate) {
          // If dependency is scheduled after the new date, warn about potential conflict
          if (dependency.scheduledDate > newScheduledDate) {
            warnings.push(
              `Dependency "${dependency.title}" is scheduled after the new date`
            );
          }
        }
      }
    } catch {
      warnings.push('Could not validate all task dependencies');
    }

    return warnings;
  }

  /**
   * Validate dependencies for multiple tasks being migrated together
   */
  async validateDependencyConflicts(
    migrations: TaskMigration[]
  ): Promise<DependencyValidationResult> {
    const conflicts: DependencyConflict[] = [];
    const suggestedMigrations: TaskMigration[] = [];
    const migrationMap = new Map(
      migrations.map(m => [m.taskId, m.newScheduledDate])
    );

    try {
      // Get all tasks being migrated
      const tasks = await Promise.all(
        migrations.map(m => this.taskService.findById(m.taskId))
      );
      const validTasks = tasks.filter((task): task is Task => task !== null);

      for (const task of validTasks) {
        const newDate = migrationMap.get(task.id);
        if (!newDate) {
          continue;
        }

        // Check dependencies (tasks this task depends on)
        const dependencyConflicts = await this.checkDependencyConflictsForTask(
          task,
          newDate,
          migrationMap
        );
        conflicts.push(...dependencyConflicts);

        // Check dependents (tasks that depend on this task)
        const dependentConflicts = await this.checkDependentConflictsForTask(
          task,
          newDate,
          migrationMap
        );
        conflicts.push(...dependentConflicts);
      }

      // Generate suggested migrations to resolve conflicts
      const suggestions = await this.generateConflictResolutionSuggestions(
        conflicts,
        migrations
      );
      suggestedMigrations.push(...suggestions);
    } catch (error) {
      console.error('Failed to validate dependency conflicts:', error);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      suggestedMigrations,
    };
  }

  /**
   * Check dependency conflicts for a single task
   */
  private async checkDependencyConflictsForTask(
    task: Task,
    newDate: Date,
    migrationMap: Map<string, Date>
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    try {
      // Get all dependencies
      const dependencies = await this.taskService.getDependencies(task.id);

      for (const dependency of dependencies) {
        let dependencyDate = dependency.scheduledDate;

        // If dependency is also being migrated, use its new date
        if (migrationMap.has(dependency.id)) {
          dependencyDate = migrationMap.get(dependency.id)!;
        }

        if (dependencyDate && dependencyDate > newDate) {
          conflicts.push({
            taskId: task.id,
            taskTitle: task.title,
            conflictType: 'dependency_after',
            conflictingTaskId: dependency.id,
            conflictingTaskTitle: dependency.title,
            conflictingTaskDate: dependencyDate,
            severity: 'warning',
            suggestion: `Consider scheduling "${task.title}" after ${dependencyDate.toDateString()}`,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to check dependencies for task ${task.id}:`, error);
    }

    return conflicts;
  }

  /**
   * Check dependent conflicts for a single task
   */
  private async checkDependentConflictsForTask(
    task: Task,
    newDate: Date,
    migrationMap: Map<string, Date>
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    try {
      // Get all dependents (tasks that depend on this task)
      const dependents = await this.taskService.getDependents(task.id);

      for (const dependent of dependents) {
        let dependentDate = dependent.scheduledDate;

        // If dependent is also being migrated, use its new date
        if (migrationMap.has(dependent.id)) {
          dependentDate = migrationMap.get(dependent.id)!;
        }

        if (dependentDate && dependentDate < newDate) {
          conflicts.push({
            taskId: task.id,
            taskTitle: task.title,
            conflictType: 'dependent_before',
            conflictingTaskId: dependent.id,
            conflictingTaskTitle: dependent.title,
            conflictingTaskDate: dependentDate,
            severity: 'warning',
            suggestion: `Consider scheduling "${task.title}" before ${dependentDate.toDateString()}`,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to check dependents for task ${task.id}:`, error);
    }

    return conflicts;
  }

  /**
   * Generate suggestions to resolve dependency conflicts
   */
  private async generateConflictResolutionSuggestions(
    conflicts: DependencyConflict[],
    originalMigrations: TaskMigration[]
  ): Promise<TaskMigration[]> {
    const suggestions: TaskMigration[] = [];
    const migrationMap = new Map(originalMigrations.map(m => [m.taskId, m]));

    for (const conflict of conflicts) {
      if (conflict.severity === 'warning' && conflict.conflictingTaskDate) {
        const originalMigration = migrationMap.get(conflict.taskId);
        if (!originalMigration) {
          continue;
        }

        let suggestedDate: Date;

        if (conflict.conflictType === 'dependency_after') {
          // Schedule after the dependency
          suggestedDate = new Date(conflict.conflictingTaskDate);
          suggestedDate.setDate(suggestedDate.getDate() + 1);
        } else if (conflict.conflictType === 'dependent_before') {
          // Schedule before the dependent
          suggestedDate = new Date(conflict.conflictingTaskDate);
          suggestedDate.setDate(suggestedDate.getDate() - 1);
        } else {
          continue;
        }

        // Only suggest if it's different from the original migration
        if (
          suggestedDate.getTime() !==
          originalMigration.newScheduledDate.getTime()
        ) {
          suggestions.push({
            taskId: conflict.taskId,
            newScheduledDate: suggestedDate,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get tasks with dependency relationships for migration dialog
   */
  async getTasksWithDependencyInfo(taskIds: string[]): Promise<
    Map<
      string,
      {
        dependencies: Task[];
        dependents: Task[];
        hasDependencyRelationships: boolean;
      }
    >
  > {
    const dependencyInfo = new Map<
      string,
      {
        dependencies: Task[];
        dependents: Task[];
        hasDependencyRelationships: boolean;
      }
    >();

    try {
      for (const taskId of taskIds) {
        const [dependencies, dependents] = await Promise.all([
          this.taskService.getDependencies(taskId),
          this.taskService.getDependents(taskId),
        ]);

        dependencyInfo.set(taskId, {
          dependencies,
          dependents,
          hasDependencyRelationships:
            dependencies.length > 0 || dependents.length > 0,
        });
      }
    } catch (error) {
      console.error('Failed to get dependency info:', error);
    }

    return dependencyInfo;
  }

  /**
   * Suggest migrating dependent tasks together
   */
  async suggestDependentTaskMigrations(
    primaryMigrations: TaskMigration[],
    targetWeek: Date
  ): Promise<TaskMigration[]> {
    const suggestions: TaskMigration[] = [];
    const { getWeekRange } = await import('../utils/dateFormat');
    const { weekStart, weekEnd } = getWeekRange(targetWeek, 1);

    try {
      for (const migration of primaryMigrations) {
        // Get all dependents of this task
        const dependents = await this.taskService.getDependents(
          migration.taskId
        );

        for (const dependent of dependents) {
          // Only suggest if dependent is not already being migrated and is incomplete
          const isAlreadyMigrating = primaryMigrations.some(
            m => m.taskId === dependent.id
          );
          const isIncomplete =
            dependent.status === 'pending' ||
            dependent.status === 'in_progress';

          if (!isAlreadyMigrating && isIncomplete) {
            // Suggest scheduling dependent after the primary task
            const suggestedDate = new Date(migration.newScheduledDate);
            suggestedDate.setDate(suggestedDate.getDate() + 1);

            // Ensure suggested date is within the target week
            if (suggestedDate >= weekStart && suggestedDate <= weekEnd) {
              suggestions.push({
                taskId: dependent.id,
                newScheduledDate: suggestedDate,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to suggest dependent task migrations:', error);
    }

    return suggestions;
  }

  /**
   * Suggest optimal scheduling for tasks based on various factors
   */
  async suggestSchedulingForTasks(
    tasks: Task[],
    targetWeek: Date
  ): Promise<TaskSchedulingSuggestion[]> {
    const suggestions: TaskSchedulingSuggestion[] = [];

    // Import date utilities
    const { getWeekRange } = await import('../utils/dateFormat');
    const { weekStart, weekEnd } = getWeekRange(targetWeek, 1); // Assume Monday start for suggestions

    // Get existing tasks for the target week to check workload
    const existingTasks = await this.taskService.getTasksForWeek(targetWeek, 1);
    const workloadByDay = this.calculateWorkloadByDay(
      existingTasks,
      weekStart,
      weekEnd
    );

    for (const task of tasks) {
      const suggestion = await this.generateTaskSuggestion(
        task,
        weekStart,
        weekEnd,
        workloadByDay
      );
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Calculate workload (total time estimates) by day
   */
  private calculateWorkloadByDay(
    tasks: Task[],
    weekStart: Date,
    weekEnd: Date
  ): Record<string, number> {
    const workload: Record<string, number> = {};

    // Initialize all days in the week
    const currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      const dayKey = currentDate.toISOString().split('T')[0];
      workload[dayKey] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sum up time estimates for each day
    if (tasks && Array.isArray(tasks)) {
      for (const task of tasks) {
        if (task.scheduledDate) {
          const dayKey = task.scheduledDate.toISOString().split('T')[0];
          if (workload[dayKey] !== undefined) {
            workload[dayKey] += task.timeEstimate || 0;
          }
        }
      }
    }

    return workload;
  }

  /**
   * Generate scheduling suggestion for a single task
   */
  private async generateTaskSuggestion(
    task: Task,
    weekStart: Date,
    weekEnd: Date,
    workloadByDay: Record<string, number>
  ): Promise<TaskSchedulingSuggestion> {
    let suggestedDate = new Date(weekStart);
    let reason: TaskSchedulingSuggestion['reason'] = 'workload_balance';
    let confidence = 0.7; // Base confidence

    // Check for dependencies first (highest priority)
    if (task.dependencies.length > 0) {
      try {
        const dependencyDates = await this.getLatestDependencyDate(
          task.dependencies
        );
        if (dependencyDates && dependencyDates >= weekStart) {
          // Schedule after the latest dependency
          const dayAfterDependency = new Date(dependencyDates);
          dayAfterDependency.setDate(dayAfterDependency.getDate() + 1);

          if (dayAfterDependency <= weekEnd) {
            suggestedDate = dayAfterDependency;
            reason = 'dependencies';
            confidence = 0.95; // High confidence for dependency-based scheduling

            // Adjust confidence based on time estimate
            if (task.timeEstimate > 0) {
              if (task.timeEstimate <= 30) {
                confidence = Math.min(1.0, confidence + 0.05);
              } else if (task.timeEstimate >= 120) {
                confidence = Math.max(0.1, confidence - 0.05);
              }
            }

            return {
              taskId: task.id,
              suggestedDate,
              reason,
              confidence,
            };
          }
        }
      } catch {
        // If we can't check dependencies, lower confidence
        confidence -= 0.2;
      }
    }

    // Priority-based scheduling: high priority tasks get earlier slots
    if (task.priority >= 2) {
      // HIGH or URGENT
      suggestedDate = new Date(weekStart);
      reason = 'priority';
      confidence = 0.9;
    } else {
      // Find day with lowest workload
      let minWorkload = Infinity;
      let bestDay = weekStart;

      const currentDate = new Date(weekStart);
      while (currentDate <= weekEnd) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const dayWorkload = workloadByDay[dayKey] || 0;

        if (dayWorkload < minWorkload) {
          minWorkload = dayWorkload;
          bestDay = new Date(currentDate);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      suggestedDate = bestDay;
      reason = 'workload_balance';
    }

    // Adjust confidence based on time estimate
    if (task.timeEstimate > 0) {
      if (task.timeEstimate <= 30) {
        confidence += 0.1; // Short tasks are easier to schedule
      } else if (task.timeEstimate >= 120) {
        confidence -= 0.1; // Long tasks are harder to fit
      }

      // Only change reason to time_estimate if we're not using priority-based scheduling
      if (reason !== 'priority') {
        reason = 'time_estimate';
      }
    }

    // Ensure confidence stays within bounds
    confidence = Math.max(0.1, Math.min(1.0, confidence));

    return {
      taskId: task.id,
      suggestedDate,
      reason,
      confidence,
    };
  }

  /**
   * Get the latest scheduled date among task dependencies
   */
  private async getLatestDependencyDate(
    dependencyIds: string[]
  ): Promise<Date | null> {
    let latestDate: Date | null = null;

    for (const depId of dependencyIds) {
      try {
        const dependency = await this.taskService.findById(depId);
        if (dependency && dependency.scheduledDate) {
          if (!latestDate || dependency.scheduledDate > latestDate) {
            latestDate = dependency.scheduledDate;
          }
        }
      } catch {
        // Skip this dependency if we can't fetch it
        continue;
      }
    }

    return latestDate;
  }

  /**
   * Categorize errors for proper handling and recovery
   */
  private categorizeMigrationError(
    error: unknown,
    taskId?: string
  ): MigrationError {
    if (error instanceof Error) {
      // Check for specific error patterns
      if (
        error.message.includes('not found') ||
        error.message.includes('does not exist')
      ) {
        return this.createMigrationError(
          MigrationErrorType.TASK_NOT_FOUND,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('invalid date') ||
        error.message.includes('date')
      ) {
        return this.createMigrationError(
          MigrationErrorType.INVALID_DATE,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('permission') ||
        error.message.includes('unauthorized')
      ) {
        return this.createMigrationError(
          MigrationErrorType.PERMISSION_DENIED,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('network') ||
        error.message.includes('connection')
      ) {
        return this.createMigrationError(
          MigrationErrorType.NETWORK_ERROR,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('timeout') ||
        error.message.includes('timed out')
      ) {
        return this.createMigrationError(
          MigrationErrorType.TIMEOUT_ERROR,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('concurrent') ||
        error.message.includes('modified')
      ) {
        return this.createMigrationError(
          MigrationErrorType.CONCURRENT_MODIFICATION,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('storage') ||
        error.message.includes('disk full')
      ) {
        return this.createMigrationError(
          MigrationErrorType.STORAGE_FULL,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('service unavailable') ||
        error.message.includes('unavailable')
      ) {
        return this.createMigrationError(
          MigrationErrorType.SERVICE_UNAVAILABLE,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('dependency') ||
        error.message.includes('conflict')
      ) {
        return this.createMigrationError(
          MigrationErrorType.DEPENDENCY_CONFLICT,
          error.message,
          error,
          taskId
        );
      }

      if (
        error.message.includes('periodic') ||
        error.message.includes('template')
      ) {
        return this.createMigrationError(
          MigrationErrorType.PERIODIC_TASK_CONFLICT,
          error.message,
          error,
          taskId
        );
      }
    }

    // Default to database error for unknown errors
    return this.createMigrationError(
      MigrationErrorType.DATABASE_ERROR,
      error instanceof Error ? error.message : 'Unknown database error',
      error instanceof Error ? error : undefined,
      taskId
    );
  }

  /**
   * Create a standardized migration error
   */
  private createMigrationError(
    type: MigrationErrorType,
    message: string,
    originalError?: Error,
    taskId?: string,
    context?: Record<string, unknown>
  ): MigrationError {
    return {
      type,
      message,
      taskId,
      recoverable: this.isRecoverableError(type),
      retryable: this.defaultRetryConfig.retryableErrors.includes(type),
      originalError,
      timestamp: new Date(),
      context,
    };
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverableError(errorType: MigrationErrorType): boolean {
    const recoverableErrors = [
      MigrationErrorType.DATABASE_ERROR,
      MigrationErrorType.NETWORK_ERROR,
      MigrationErrorType.TIMEOUT_ERROR,
      MigrationErrorType.CONCURRENT_MODIFICATION,
      MigrationErrorType.SERVICE_UNAVAILABLE,
    ];

    return recoverableErrors.includes(errorType);
  }

  /**
   * Determine if an error is retryable based on configuration
   */
  private isRetryableError(
    error: MigrationError,
    retryConfig: RetryConfig
  ): boolean {
    return error.retryable && retryConfig.retryableErrors.includes(error.type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attemptNumber: number,
    retryConfig: RetryConfig
  ): number {
    const delay =
      retryConfig.baseDelay *
      Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1);
    return Math.min(delay, retryConfig.maxDelay);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get migration health status
   */
  async getMigrationServiceHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    errors: string[];
    capabilities: {
      canValidate: boolean;
      canMigrate: boolean;
      canRetry: boolean;
    };
  }> {
    const errors: string[] = [];
    let canValidate = true;
    let canMigrate = true;
    const canRetry = true;

    try {
      // Test basic task service connectivity
      await this.taskService.findAll({});
    } catch {
      canMigrate = false;
      canValidate = false;
      errors.push('Task service unavailable');
    }

    try {
      // Test validation capabilities
      await this.validateMigrations([]);
    } catch {
      canValidate = false;
      errors.push('Validation service unavailable');
    }

    return {
      isHealthy: errors.length === 0,
      lastCheck: new Date(),
      errors,
      capabilities: {
        canValidate,
        canMigrate,
        canRetry,
      },
    };
  }

  /**
   * Attempt to recover from service failures
   */
  async attemptServiceRecovery(): Promise<boolean> {
    try {
      // Test if services are back online
      const health = await this.getMigrationServiceHealth();
      return health.isHealthy;
    } catch {
      return false;
    }
  }

  /**
   * Handle post-migration updates for periodic tasks
   * This method should be called after successful migration to update template schedules if needed
   */
  async handlePeriodicTaskPostMigration(migratedTasks: Task[]): Promise<void> {
    const periodicTasks = migratedTasks.filter(
      task => task.isPeriodicInstance && task.periodicTemplateId
    );

    if (periodicTasks.length === 0) {
      return;
    }

    // Group by template ID to avoid duplicate processing
    const templateIds = new Set(
      periodicTasks.map(task => task.periodicTemplateId!)
    );

    for (const templateId of templateIds) {
      try {
        // Note: In a full implementation, we would update the periodic template's
        // next generation date here. For now, we just log the action.
        console.log(
          `Periodic task migration completed for template ${templateId}`
        );

        // Future enhancement: Call periodic task service to update generation schedule
        // await this.periodicTaskService.updateGenerationSchedule(templateId);
      } catch {
        console.error(
          `Failed to update periodic template ${templateId} after migration`
        );
      }
    }
  }

  /**
   * Check if migrating periodic tasks will interfere with automatic generation
   */
  async validatePeriodicTaskInterference(tasks: Task[]): Promise<{
    hasInterference: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let hasInterference = false;

    const periodicTasks = tasks.filter(task => task.isPeriodicInstance);

    for (const task of periodicTasks) {
      if (!task.periodicTemplateId) {
        warnings.push(`Periodic task "${task.title}" is missing template ID`);
        hasInterference = true;
        continue;
      }

      // Check if there are future instances that might be affected
      try {
        const futureInstances = await this.taskService.findAll({
          periodicTemplateId: task.periodicTemplateId,
          periodicFilter: 'instances_only',
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureInstancesCount = futureInstances.filter(instance => {
          if (!instance.scheduledDate || instance.id === task.id) {
            return false;
          }

          const scheduledDate = new Date(instance.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);

          return scheduledDate >= today;
        }).length;

        if (futureInstancesCount > 0) {
          warnings.push(
            `Template for "${task.title}" has ${futureInstancesCount} future instances that may be affected`
          );
        }
      } catch {
        warnings.push(
          `Could not validate future instances for "${task.title}"`
        );
      }
    }

    return { hasInterference, warnings };
  }
}
