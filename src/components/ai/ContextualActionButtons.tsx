import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  Check,
  Plus,
  Calendar,
  Target,
  Zap,
} from 'lucide-react';
import { ActionButton } from './ActionButton';
import { useTimerContext } from '../../contexts/TimerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useResponsiveActions } from '../../hooks/useResponsiveActions';
import { getTaskRepository } from '../../services/database/repositories';
import { Task, TaskStatus } from '../../types';

export interface ContextualActionButtonsProps {
  /** The current conversation context */
  context?: {
    mentionedTasks?: Task[];
    suggestedActions?: string[];
    currentTask?: Task;
  };
  /** Whether to show in compact mode for smaller screens */
  compact?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Callback when an action is performed */
  onActionPerformed?: (action: string, data?: unknown) => void;
}

export const ContextualActionButtons: React.FC<
  ContextualActionButtonsProps
> = ({
  context,
  compact: forcedCompact,
  className = '',
  onActionPerformed,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const { t } = useTranslation();
  const responsiveConfig = useResponsiveActions();

  // Use forced compact mode or responsive config
  const compact = forcedCompact ?? responsiveConfig.compact;

  const setActionLoading = (actionId: string, loading: boolean) => {
    setLoadingActions(prev => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(actionId);
      } else {
        newSet.delete(actionId);
      }
      return newSet;
    });
  };

  const {
    isRunning,
    activeTask,
    activeTaskId,
    startTimer,
    pauseTimer,
    stopTimer,
  } = useTimerContext();

  const { navigateTo } = useNavigation();
  const taskRepository = getTaskRepository();

  // Determine which actions to show based on context
  const getAvailableActions = () => {
    const actions = [];

    // Timer actions
    if (activeTask && isRunning) {
      actions.push({
        id: 'pause-timer',
        icon: Pause,
        label: compact ? t('timer.pause') : t('timer.pauseTimer'),
        tooltip: t('timer.pauseCurrentTimer'),
        variant: 'warning' as const,
        onClick: () => {
          pauseTimer();
          onActionPerformed?.('pause-timer', { taskId: activeTaskId });
        },
      });

      actions.push({
        id: 'stop-timer',
        icon: Square,
        label: compact ? t('timer.stop') : t('timer.stopTimer'),
        tooltip: t('timer.stopCurrentTimer'),
        variant: 'danger' as const,
        onClick: () => {
          stopTimer();
          onActionPerformed?.('stop-timer', { taskId: activeTaskId });
        },
      });
    } else if (context?.currentTask) {
      actions.push({
        id: 'start-timer',
        icon: Play,
        label: compact ? t('timer.start') : t('timer.startTimer'),
        tooltip: t('timer.startTimerForTask', {
          task: context.currentTask.title,
        }),
        variant: 'success' as const,
        onClick: () => {
          startTimer(context.currentTask!);
          onActionPerformed?.('start-timer', {
            taskId: context.currentTask!.id,
          });
        },
      });
    }

    // Task completion actions
    if (
      context?.currentTask &&
      context.currentTask.status !== TaskStatus.COMPLETED
    ) {
      actions.push({
        id: 'complete-task',
        icon: Check,
        label: compact ? t('task.complete') : t('task.markComplete'),
        tooltip: t('task.markTaskComplete'),
        variant: 'success' as const,
        onClick: async () => {
          setActionLoading('complete-task', true);
          try {
            await taskRepository.update(context.currentTask!.id, {
              status: TaskStatus.COMPLETED,
            });
            onActionPerformed?.('complete-task', {
              taskId: context.currentTask!.id,
            });
          } catch (error) {
            console.error('Failed to complete task:', error);
            // Could show a toast notification here
          } finally {
            setActionLoading('complete-task', false);
          }
        },
      });
    }

    // Quick task creation
    actions.push({
      id: 'create-task',
      icon: Plus,
      label: compact ? t('task.new') : t('task.createNew'),
      tooltip: t('task.createNewTask'),
      variant: 'primary' as const,
      onClick: () => {
        navigateTo('planning');
        onActionPerformed?.('create-task');
      },
    });

    // Focus session
    if (context?.currentTask) {
      actions.push({
        id: 'start-focus',
        icon: Zap,
        label: compact ? t('focus.start') : t('focus.startSession'),
        tooltip: t('focus.startFocusSession'),
        variant: 'primary' as const,
        onClick: () => {
          // This would integrate with focus session functionality
          onActionPerformed?.('start-focus', {
            taskId: context.currentTask!.id,
          });
        },
      });
    }

    // Schedule task
    if (context?.currentTask && !context.currentTask.scheduledDate) {
      actions.push({
        id: 'schedule-task',
        icon: Calendar,
        label: compact ? t('task.schedule') : t('task.scheduleTask'),
        tooltip: t('task.scheduleTaskForLater'),
        variant: 'secondary' as const,
        onClick: () => {
          // This would open a scheduling dialog
          onActionPerformed?.('schedule-task', {
            taskId: context.currentTask!.id,
          });
        },
      });
    }

    return actions;
  };

  const actions = getAvailableActions();
  const maxVisible = compact
    ? Math.min(responsiveConfig.maxVisibleActions, 3)
    : responsiveConfig.maxVisibleActions;
  const visibleActions = actions.slice(0, maxVisible);
  const hiddenActions = actions.slice(maxVisible);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <AnimatePresence>
        {visibleActions.map(action => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <ActionButton
              icon={action.icon}
              label={action.label}
              tooltip={action.tooltip}
              onClick={action.onClick}
              variant={action.variant}
              size={compact ? 'sm' : responsiveConfig.buttonSize}
              isLoading={loadingActions.has(action.id)}
            />
          </motion.div>
        ))}

        {hiddenActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <ActionButton
              icon={Target}
              label={
                isExpanded ? t('common.showLess') : `+${hiddenActions.length}`
              }
              tooltip={
                isExpanded ? t('common.showLess') : t('common.showMoreActions')
              }
              onClick={() => setIsExpanded(!isExpanded)}
              variant='secondary'
              size={compact ? 'sm' : responsiveConfig.buttonSize}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded actions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className='flex flex-wrap gap-2 w-full mt-2'
          >
            {hiddenActions.map(action => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.1 }}
              >
                <ActionButton
                  icon={action.icon}
                  label={action.label}
                  tooltip={action.tooltip}
                  onClick={action.onClick}
                  variant={action.variant}
                  size={compact ? 'sm' : responsiveConfig.buttonSize}
                  isLoading={loadingActions.has(action.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
