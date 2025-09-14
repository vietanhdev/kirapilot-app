import { useCallback, useState } from 'react';
import { useTranslation } from './useTranslation';
import { useToast } from './useToast';
import { MigrationFeedback, MigrationFailureDetail } from '../types';
import {
  MigrationResult,
  TaskMigration,
} from '../services/TaskMigrationService';
import { MigrationFeedbackService } from '../services/MigrationFeedbackService';
import { TaskService } from '../services/database/repositories/TaskService';

export interface UseMigrationFeedbackReturn {
  showMigrationResult: (
    result: MigrationResult,
    originalMigrations: TaskMigration[],
    startTime: number
  ) => Promise<void>;
  retryFailedMigrations: (
    failures: MigrationFailureDetail[],
    retryMigrations: TaskMigration[]
  ) => Promise<void>;
  undoMigration: (undoId: string) => Promise<void>;
  isProcessing: boolean;
}

export function useMigrationFeedback(
  taskService: TaskService
): UseMigrationFeedbackReturn {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackService] = useState(
    () => new MigrationFeedbackService(taskService)
  );

  const showMigrationResult = useCallback(
    async (
      result: MigrationResult,
      originalMigrations: TaskMigration[],
      startTime: number
    ) => {
      try {
        const feedback = await feedbackService.processMigrationResult(
          result,
          originalMigrations,
          startTime
        );

        await showMigrationFeedback(feedback);
      } catch (error) {
        console.error('Failed to process migration result:', error);
        showToast({
          type: 'error',
          title: t('migration.result.failure.title'),
          message: t('migration.result.failure.message', {
            count: result.failed.length,
          }),
        });
      }
    },
    [feedbackService, showToast, t]
  );

  const showMigrationFeedback = useCallback(
    async (feedback: MigrationFeedback) => {
      const { summary, failures, canUndo, undoTimeLimit } = feedback;
      const summaryInfo = feedbackService.generateSummaryMessage(summary);

      // Determine toast type and content
      let toastType: 'success' | 'warning' | 'error';
      let title: string;
      let message: string;

      if (feedback.success) {
        toastType = 'success';
        title = t(summaryInfo.title as keyof typeof t);
        message = t(summaryInfo.message as keyof typeof t, {
          count: summary.successful,
        });
      } else if (summary.successful > 0) {
        toastType = 'warning';
        title = t(summaryInfo.title as keyof typeof t);
        message = t(summaryInfo.message as keyof typeof t, {
          successful: summary.successful,
          total: summary.totalTasks,
          failed: summary.failed,
        });
      } else {
        toastType = 'error';
        title = t(summaryInfo.title as keyof typeof t);
        message = t(summaryInfo.message as keyof typeof t, {
          count: summary.failed,
        });
      }

      // Add day breakdown to message if there are successful migrations
      if (summary.successful > 0 && summaryInfo.byDayBreakdown.length > 0) {
        const dayBreakdown = summaryInfo.byDayBreakdown
          .map(({ dayName, count }) =>
            t(`migration.result.summary.${dayName}` as keyof typeof t, {
              count,
            })
          )
          .join(', ');

        message += `\n${t('migration.result.summary.byDay')} ${dayBreakdown}`;
      }

      // Create action for undo if available
      let action;
      if (canUndo && undoTimeLimit) {
        const minutesRemaining = Math.ceil(undoTimeLimit / (60 * 1000));
        action = {
          label: t('migration.result.undo'),
          onClick: () => handleUndoMigration(),
        };

        // Add time limit info to message
        message += `\n${t('migration.result.undoTimeLimit', { minutes: minutesRemaining })}`;
      }

      // Show main result toast
      showToast({
        type: toastType,
        title,
        message,
        action,
        duration: toastType === 'error' ? 10000 : 8000, // Longer duration for errors
      });

      // Show detailed error information if there are failures
      if (failures.length > 0) {
        await showFailureDetails(failures);
      }
    },
    [feedbackService, showToast, t]
  );

  const showFailureDetails = useCallback(
    async (failures: MigrationFailureDetail[]) => {
      const recoverableFailures = failures.filter(f => f.recoverable);

      // Group failures by error type for better presentation
      const errorGroups = failures.reduce(
        (groups, failure) => {
          const key = failure.errorType;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(failure);
          return groups;
        },
        {} as Record<string, MigrationFailureDetail[]>
      );

      // Create detailed error message
      const errorMessages = Object.entries(errorGroups).map(
        ([errorType, groupFailures]) => {
          const taskTitles = groupFailures.map(f => f.taskTitle).join(', ');
          return t(`migration.result.errors.${errorType}` as keyof typeof t, {
            title: taskTitles,
          });
        }
      );

      const detailedMessage = errorMessages.join('\n');

      // Create retry action if there are recoverable failures
      let retryAction;
      if (recoverableFailures.length > 0) {
        retryAction = {
          label: t('migration.result.retry'),
          onClick: () => {
            // This would need to be implemented by the calling component
            console.log(
              'Retry action clicked for failures:',
              recoverableFailures
            );
          },
        };
      }

      showToast({
        type: 'error',
        title: t('migration.result.errors.title'),
        message: detailedMessage,
        action: retryAction,
        duration: 12000, // Longer duration for detailed errors
      });
    },
    [showToast, t]
  );

  const retryFailedMigrations = useCallback(
    async (
      failures: MigrationFailureDetail[],
      retryMigrations: TaskMigration[]
    ) => {
      setIsProcessing(true);
      try {
        const startTime = Date.now();
        const result = await feedbackService.retryFailedMigrations(
          failures,
          retryMigrations
        );

        // Show result of retry
        await showMigrationResult(result, retryMigrations, startTime);
      } catch (error) {
        console.error('Failed to retry migrations:', error);
        showToast({
          type: 'error',
          title: t('migration.result.failure.title'),
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [feedbackService, showMigrationResult, showToast, t]
  );

  const handleUndoMigration = useCallback(async () => {
    // Get the most recent undo operation
    const availableUndos = feedbackService.getAvailableUndoOperations();
    if (availableUndos.length === 0) {
      showToast({
        type: 'warning',
        title: t('migration.undo.failure.title'),
        message: t('migration.result.undoExpired'),
      });
      return;
    }

    const mostRecent = availableUndos[0];
    await undoMigration(mostRecent.id);
  }, [feedbackService, showToast, t]);

  const undoMigration = useCallback(
    async (undoId: string) => {
      setIsProcessing(true);
      try {
        const result = await feedbackService.undoMigration(undoId);

        if (result.success) {
          showToast({
            type: 'success',
            title: t('migration.undo.success.title'),
            message: t('migration.undo.success.message', {
              count: result.undoneCount,
            }),
          });

          // Trigger UI refresh
          window.dispatchEvent(new CustomEvent('tasks-updated'));
        } else {
          showToast({
            type: 'error',
            title: t('migration.undo.failure.title'),
            message: t('migration.undo.failure.message', {
              error: result.error || 'Unknown error',
            }),
          });
        }
      } catch (error) {
        console.error('Failed to undo migration:', error);
        showToast({
          type: 'error',
          title: t('migration.undo.failure.title'),
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [feedbackService, showToast, t]
  );

  return {
    showMigrationResult,
    retryFailedMigrations,
    undoMigration,
    isProcessing,
  };
}
