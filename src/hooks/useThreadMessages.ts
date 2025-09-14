import { useState, useCallback, useEffect } from 'react';
import { ThreadService } from '../services/database/repositories/ThreadService';
import {
  ThreadMessage,
  CreateThreadMessageRequest,
  ThreadAssignment,
} from '../types/thread';
import {
  AIResponse,
  AppContext,
  ToolExecution,
  AIAction,
  Task,
} from '../types';
import { UserFeedback } from '../types/aiLogging';
import { useAI } from '../contexts/AIContext';
import { TaskService } from '../services/database/repositories/TaskService';
import {
  processKiraError,
  shouldAutoRetry,
  getRetryDelay,
  KiraError,
} from '../utils/kiraErrorHandling';

interface UseThreadMessagesState {
  messages: ThreadMessage[];
  isLoading: boolean;
  isSending: boolean;
  isSubmittingFeedback: boolean;
  isRegenerating: boolean;
  error: KiraError | null;
  retryCount: number;
}

interface UseThreadMessagesReturn extends UseThreadMessagesState {
  sendMessage: (
    message: string,
    threadAssignment?: ThreadAssignment
  ) => Promise<ThreadMessage | null>;
  loadMessages: (threadId: string) => Promise<void>;
  clearMessages: () => void;
  refreshMessages: (threadId: string) => Promise<void>;
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
  // Feedback functionality
  submitFeedback: (messageId: string, feedback: UserFeedback) => Promise<void>;
  // Regenerate response functionality
  regenerateResponse: (
    messageId: string,
    threadAssignment?: ThreadAssignment
  ) => Promise<ThreadMessage | null>;
}

/**
 * Hook for managing thread message operations
 * Handles sending messages, receiving AI responses, and message persistence
 */
export function useThreadMessages(threadId?: string): UseThreadMessagesReturn {
  const [state, setState] = useState<UseThreadMessagesState>({
    messages: [],
    isLoading: false,
    isSending: false,
    isSubmittingFeedback: false,
    isRegenerating: false,
    error: null,
    retryCount: 0,
  });

  const threadService = new ThreadService();
  const taskService = new TaskService();
  const {
    sendMessage: sendAIMessage,
    isLoading: aiLoading,
    submitFeedback: submitAIFeedback,
  } = useAI();

  const [lastOperation, setLastOperation] = useState<
    (() => Promise<void>) | null
  >(null);

  /**
   * Helper function to create context summary for AI understanding
   */
  const createContextSummary = useCallback(
    (assignment: ThreadAssignment, data: Record<string, unknown>) => {
      const summary = {
        assignmentType: assignment.type,
        contextScope:
          assignment.type === 'task'
            ? 'single-task'
            : assignment.type === 'day'
              ? 'daily-planning'
              : 'general',
        focusArea:
          assignment.type === 'task'
            ? 'task-specific assistance'
            : assignment.type === 'day'
              ? 'day planning and scheduling'
              : 'general productivity',
        aiGuidance: {
          shouldFocusOnTask: assignment.type === 'task',
          shouldConsiderDayPlanning: assignment.type === 'day',
          shouldIncludeRelatedTasks:
            assignment.type === 'task' || assignment.type === 'day',
          shouldConsiderTimeConstraints: true,
          shouldConsiderPriorities: true,
          shouldConsiderDependencies: assignment.type === 'task',
        },
        ...data,
      };
      return summary;
    },
    []
  );

  /**
   * Helper function to calculate task statistics for context
   */
  const calculateTaskStats = useCallback((tasks: Task[]) => {
    const completed = tasks.filter(t => t.status === 'completed');
    const pending = tasks.filter(t => t.status === 'pending');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const highPriority = tasks.filter(t => t.priority === 1);
    const overdue = tasks.filter(
      t => t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
    );

    const totalEstimated = tasks.reduce(
      (sum, t) => sum + (t.timeEstimate || 0),
      0
    );
    const totalActual = tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);

    return {
      total: tasks.length,
      completed: completed.length,
      pending: pending.length,
      inProgress: inProgress.length,
      highPriority: highPriority.length,
      overdue: overdue.length,
      completionRate:
        tasks.length > 0
          ? Math.round((completed.length / tasks.length) * 100)
          : 0,
      totalEstimatedTime: totalEstimated,
      totalActualTime: totalActual,
      timeEfficiency:
        totalEstimated > 0
          ? Math.round((totalActual / totalEstimated) * 100)
          : 0,
      workloadLevel:
        tasks.length > 8 ? 'heavy' : tasks.length > 4 ? 'moderate' : 'light',
    };
  }, []);

  /**
   * Validate and enhance context before sending to AI
   * Ensures context is properly structured and contains all necessary information
   */
  const validateAndEnhanceContext = useCallback(
    (context: AppContext, assignment?: ThreadAssignment): AppContext => {
      // Create a copy to avoid mutations
      const enhancedContext = { ...context };

      // Ensure recentActivity is properly structured
      if (!enhancedContext.recentActivity) {
        enhancedContext.recentActivity = [];
      }

      // Add context validation metadata
      enhancedContext.recentActivity.push({
        id: `context-validation-${Date.now()}`,
        type: 'task_created',
        timestamp: new Date(),
        data: {
          contextValidation: {
            hasAssignment: !!assignment,
            assignmentType: assignment?.type || 'none',
            hasCurrentTask: !!enhancedContext.currentTask,
            hasActiveSession: !!enhancedContext.activeSession,
            hasWeeklyPlan: !!enhancedContext.weeklyPlan,
            activityCount: enhancedContext.recentActivity.length,
            contextSize: JSON.stringify(enhancedContext).length,
            timestamp: new Date().toISOString(),
          },
          threadContextMetadata: {
            isThreadAssigned: !!assignment,
            threadFocus: assignment?.type || 'general',
            contextQuality: 'enhanced',
            aiOptimized: true,
          },
        },
      });

      return enhancedContext;
    },
    []
  );

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setSending = useCallback((sending: boolean) => {
    setState(prev => ({ ...prev, isSending: sending }));
  }, []);

  const setSubmittingFeedback = useCallback((submitting: boolean) => {
    setState(prev => ({ ...prev, isSubmittingFeedback: submitting }));
  }, []);

  const setRegenerating = useCallback((regenerating: boolean) => {
    setState(prev => ({ ...prev, isRegenerating: regenerating }));
  }, []);

  const setError = useCallback((error: KiraError | null) => {
    setState(prev => ({
      ...prev,
      error,
      retryCount: error ? prev.retryCount + 1 : 0,
    }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setLastOperation(null);
  }, [setError]);

  // Removed executeWithErrorHandling to prevent infinite re-render loops
  // Individual functions now handle their own error handling directly

  const retryLastOperation = useCallback(async () => {
    if (lastOperation && state.error) {
      // Check if we should auto-retry
      if (shouldAutoRetry(state.error, state.retryCount)) {
        const delay = getRetryDelay(state.retryCount);
        setTimeout(async () => {
          await lastOperation();
        }, delay);
      } else {
        await lastOperation();
      }
    }
  }, [lastOperation, state.error, state.retryCount]);

  /**
   * Build app context for AI based on thread assignment
   * This function creates comprehensive context that includes:
   * - Task details when thread is assigned to a task (Requirement 3.2)
   * - Day schedule when thread is assigned to a day (Requirement 3.3)
   * - Enhanced context for better AI assistance (Requirement 5.1)
   */
  const buildAppContext = useCallback(
    async (assignment?: ThreadAssignment): Promise<AppContext> => {
      // Get user preferences from localStorage or use defaults
      const getStoredPreferences = () => {
        try {
          const stored = localStorage.getItem('kirapilot-preferences');
          if (stored) {
            const prefs = JSON.parse(stored);
            return prefs;
          }
        } catch (error) {
          console.warn('Failed to load user preferences:', error);
        }
        return null;
      };

      const storedPrefs = getStoredPreferences();
      const now = new Date();

      const baseContext: AppContext = {
        focusMode: false,
        timeOfDay: now.toLocaleTimeString(),
        dayOfWeek: now.getDay(),
        currentEnergy: 75, // Default energy level
        recentActivity: [],
        preferences: {
          workingHours: {
            start: storedPrefs?.workingHours?.start || '09:00',
            end: storedPrefs?.workingHours?.end || '17:00',
          },
          breakPreferences: {
            shortBreakDuration:
              storedPrefs?.breakPreferences?.shortBreakDuration || 5,
            longBreakDuration:
              storedPrefs?.breakPreferences?.longBreakDuration || 15,
            breakInterval: storedPrefs?.breakPreferences?.breakInterval || 25,
          },
          focusPreferences: {
            defaultDuration:
              storedPrefs?.focusPreferences?.defaultDuration || 25,
            distractionLevel:
              storedPrefs?.focusPreferences?.distractionLevel ||
              ('moderate' as import('../types').DistractionLevel),
            backgroundAudio: storedPrefs?.focusPreferences?.backgroundAudio || {
              type: 'silence' as const,
              volume: 0,
            },
          },
          notifications: {
            breakReminders: storedPrefs?.notifications?.breakReminders ?? true,
            taskDeadlines: storedPrefs?.notifications?.taskDeadlines ?? true,
            dailySummary: storedPrefs?.notifications?.dailySummary ?? true,
            weeklyReview: storedPrefs?.notifications?.weeklyReview ?? true,
          },
          aiSettings: {
            conversationHistory:
              storedPrefs?.aiSettings?.conversationHistory ?? true,
            autoSuggestions: storedPrefs?.aiSettings?.autoSuggestions ?? true,
            toolPermissions: storedPrefs?.aiSettings?.toolPermissions ?? true,
            responseStyle:
              storedPrefs?.aiSettings?.responseStyle || ('balanced' as const),
            suggestionFrequency:
              storedPrefs?.aiSettings?.suggestionFrequency ||
              ('moderate' as const),
            showInteractionLogs:
              storedPrefs?.aiSettings?.showInteractionLogs ?? false,
          },
          taskSettings: {
            defaultPriority: storedPrefs?.taskSettings?.defaultPriority || 1,
            autoScheduling: storedPrefs?.taskSettings?.autoScheduling ?? false,
            smartDependencies:
              storedPrefs?.taskSettings?.smartDependencies ?? false,
            weekStartDay: storedPrefs?.taskSettings?.weekStartDay || 1,
            showCompletedTasks:
              storedPrefs?.taskSettings?.showCompletedTasks ?? false,
            compactView: storedPrefs?.taskSettings?.compactView ?? false,
          },
          migrationSettings: {
            enabled: storedPrefs?.migrationSettings?.enabled ?? true,
            dismissedWeeks:
              storedPrefs?.migrationSettings?.dismissedWeeks || [],
            autoSuggestScheduling:
              storedPrefs?.migrationSettings?.autoSuggestScheduling ?? true,
            showDependencyWarnings:
              storedPrefs?.migrationSettings?.showDependencyWarnings ?? true,
          },
          soundSettings: {
            hapticFeedback: storedPrefs?.soundSettings?.hapticFeedback ?? true,
            completionSound:
              storedPrefs?.soundSettings?.completionSound ?? true,
            soundVolume: storedPrefs?.soundSettings?.soundVolume || 50,
          },
          dateFormat: storedPrefs?.dateFormat || ('DD/MM/YYYY' as const),
          theme: storedPrefs?.theme || ('auto' as const),
          language: storedPrefs?.language || 'en',
        },
      };

      // Add assignment-specific context with enhanced details
      if (assignment) {
        // Task Assignment Context (Requirement 3.2)
        if (assignment.type === 'task' && assignment.taskId) {
          try {
            const task = await taskService.findById(assignment.taskId);
            if (task) {
              // Set the current task in context for AI awareness
              baseContext.currentTask = task;

              // Add comprehensive task context to recent activity for AI processing
              const taskContextData = createContextSummary(assignment, {
                taskId: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                timeEstimate: task.timeEstimate,
                actualTime: task.actualTime,
                dueDate: task.dueDate?.toISOString(),
                scheduledDate: task.scheduledDate?.toISOString(),
                tags: task.tags,
                dependencies: task.dependencies,
                threadContext:
                  'This conversation is focused on this specific task',
                // Enhanced context for AI understanding
                taskProgress:
                  task.actualTime && task.timeEstimate
                    ? Math.round((task.actualTime / task.timeEstimate) * 100)
                    : 0,
                isOverdue: task.dueDate ? new Date() > task.dueDate : false,
                isScheduledToday: task.scheduledDate
                  ? task.scheduledDate.toDateString() ===
                    new Date().toDateString()
                  : false,
                priorityLevel:
                  task.priority === 1
                    ? 'high'
                    : task.priority === 2
                      ? 'medium'
                      : 'low',
                // Task-specific AI instructions
                taskSpecificGuidance: {
                  focusOnTaskCompletion: true,
                  considerTaskDependencies:
                    task.dependencies && task.dependencies.length > 0,
                  considerTimeEstimates: task.timeEstimate !== undefined,
                  considerDeadlines: task.dueDate !== undefined,
                  suggestBreakdown: task.timeEstimate && task.timeEstimate > 60, // Suggest breakdown for tasks > 1 hour
                  suggestScheduling: !task.scheduledDate,
                },
              });

              baseContext.recentActivity.push({
                id: `task-context-${task.id}`,
                type: 'task_created',
                timestamp: task.createdAt,
                data: taskContextData,
              });

              // Load and include task dependencies for comprehensive context
              if (task.dependencies && task.dependencies.length > 0) {
                try {
                  for (const depId of task.dependencies) {
                    const depTask = await taskService.findById(depId);
                    if (depTask) {
                      baseContext.recentActivity.push({
                        id: `dependency-${depTask.id}`,
                        type: 'task_created',
                        timestamp: depTask.createdAt,
                        data: {
                          taskId: depTask.id,
                          title: depTask.title,
                          description: depTask.description,
                          status: depTask.status,
                          priority: depTask.priority,
                          relationshipType: 'dependency',
                          parentTaskId: task.id,
                          // Enhanced dependency context
                          isBlocking: depTask.status !== 'completed',
                          dependencyType: 'prerequisite',
                          contextualNote: `This task must be completed before the main task can proceed`,
                        },
                      });
                    }
                  }
                } catch (error) {
                  console.warn('Failed to load task dependencies:', error);
                }
              }

              // Load related tasks (tasks that depend on this one)
              try {
                const allTasks = await taskService.findAll();
                const dependentTasks = allTasks.filter(
                  t => t.dependencies && t.dependencies.includes(task.id)
                );

                dependentTasks.forEach(depTask => {
                  baseContext.recentActivity.push({
                    id: `dependent-${depTask.id}`,
                    type: 'task_created',
                    timestamp: depTask.createdAt,
                    data: {
                      taskId: depTask.id,
                      title: depTask.title,
                      status: depTask.status,
                      priority: depTask.priority,
                      relationshipType: 'dependent',
                      parentTaskId: task.id,
                      contextualNote: `This task depends on the completion of the main task`,
                    },
                  });
                });
              } catch (error) {
                console.warn('Failed to load dependent tasks:', error);
              }
            }
          } catch (error) {
            console.warn('Failed to load task context:', error);
            // Add error context for AI awareness
            baseContext.recentActivity.push({
              id: `task-context-error-${Date.now()}`,
              type: 'task_created',
              timestamp: new Date(),
              data: {
                assignmentType: 'task',
                taskId: assignment.taskId,
                error: 'Failed to load task details',
                threadContext:
                  'Task assignment exists but details could not be loaded',
              },
            });
          }
        }
        // Day Assignment Context (Requirement 3.3)
        else if (assignment.type === 'day' && assignment.date) {
          try {
            // Load tasks for the specific day with comprehensive details
            const assignmentDate = new Date(assignment.date);
            const startOfDay = new Date(assignmentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(assignmentDate);
            endOfDay.setHours(23, 59, 59, 999);

            const dayTasks = await taskService.findScheduledBetween(
              startOfDay,
              endOfDay
            );

            // Calculate day statistics for AI context
            const dayStats = calculateTaskStats(dayTasks);

            // Add comprehensive day context summary
            const dayContextData = createContextSummary(assignment, {
              assignmentDate: assignmentDate.toISOString(),
              dayOfWeek: assignmentDate.getDay(),
              dayName: assignmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
              }),
              isToday:
                assignmentDate.toDateString() === new Date().toDateString(),
              isWeekend:
                assignmentDate.getDay() === 0 || assignmentDate.getDay() === 6,
              // Task statistics from helper
              ...dayStats,
              // Context for AI
              threadContext: `This conversation is focused on ${assignmentDate.toDateString()}`,
              priorityDistribution: {
                high: dayTasks.filter((t: Task) => t.priority === 1).length,
                medium: dayTasks.filter((t: Task) => t.priority === 2).length,
                low: dayTasks.filter((t: Task) => t.priority === 3).length,
              },
              // Day-specific AI guidance
              daySpecificGuidance: {
                suggestPrioritization: dayStats.total > 5,
                suggestTimeBlocking: dayStats.totalEstimatedTime > 240, // > 4 hours
                suggestBreaks: dayStats.total > 3,
                considerWorkingHours: true,
                considerEnergyLevels:
                  assignmentDate.toDateString() === new Date().toDateString(),
                suggestRescheduling: dayStats.overdue > 0,
                balanceWorkload: dayStats.workloadLevel === 'heavy',
              },
            });

            baseContext.recentActivity.push({
              id: `day-context-${assignmentDate.toISOString()}`,
              type: 'task_created',
              timestamp: new Date(),
              data: dayContextData,
            });

            // Add individual tasks for the day with enhanced context
            dayTasks.forEach((task: import('../types').Task) => {
              baseContext.recentActivity.push({
                id: `day-task-${task.id}`,
                type: 'task_created',
                timestamp: task.createdAt,
                data: {
                  taskId: task.id,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  timeEstimate: task.timeEstimate,
                  actualTime: task.actualTime,
                  scheduledDate: task.scheduledDate?.toISOString(),
                  dueDate: task.dueDate?.toISOString(),
                  tags: task.tags,
                  dependencies: task.dependencies,
                  assignmentType: 'day',
                  assignmentDate: assignmentDate.toISOString(),
                  dayContext: true,
                  // Enhanced task context for day planning
                  isOverdue: task.dueDate ? new Date() > task.dueDate : false,
                  timeProgress:
                    task.actualTime && task.timeEstimate
                      ? Math.round((task.actualTime / task.timeEstimate) * 100)
                      : 0,
                  priorityLevel:
                    task.priority === 1
                      ? 'high'
                      : task.priority === 2
                        ? 'medium'
                        : 'low',
                  hasBlockingDependencies:
                    task.dependencies && task.dependencies.length > 0,
                },
              });
            });

            // Add weekly context if available
            try {
              const weekStart = new Date(assignmentDate);
              weekStart.setDate(
                assignmentDate.getDate() - assignmentDate.getDay()
              );
              weekStart.setHours(0, 0, 0, 0);

              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekEnd.setHours(23, 59, 59, 999);

              const weekTasks = await taskService.findScheduledBetween(
                weekStart,
                weekEnd
              );

              baseContext.recentActivity.push({
                id: `week-context-${weekStart.toISOString()}`,
                type: 'task_created',
                timestamp: new Date(),
                data: {
                  assignmentType: 'week',
                  weekStart: weekStart.toISOString(),
                  weekEnd: weekEnd.toISOString(),
                  totalWeekTasks: weekTasks.length,
                  weekCompletionRate:
                    weekTasks.length > 0
                      ? Math.round(
                          (weekTasks.filter(
                            (t: import('../types').Task) =>
                              t.status === 'completed'
                          ).length /
                            weekTasks.length) *
                            100
                        )
                      : 0,
                  contextualNote:
                    'Weekly context for better day planning perspective',
                },
              });
            } catch (error) {
              console.warn('Failed to load weekly context:', error);
            }
          } catch (error) {
            console.warn('Failed to load day context:', error);
            // Add error context for AI awareness
            baseContext.recentActivity.push({
              id: `day-context-error-${Date.now()}`,
              type: 'task_created',
              timestamp: new Date(),
              data: {
                assignmentType: 'day',
                assignmentDate: assignment.date?.toISOString(),
                error: 'Failed to load day schedule',
                threadContext:
                  'Day assignment exists but schedule could not be loaded',
              },
            });
          }
        }

        // Add assignment metadata to context for AI awareness
        if (assignment.context) {
          baseContext.recentActivity.push({
            id: `assignment-context-${Date.now()}`,
            type: 'task_created',
            timestamp: new Date(),
            data: {
              assignmentType: assignment.type,
              assignmentContext: assignment.context,
              threadAssignment: true,
              contextDescription:
                'Additional context provided for this thread assignment',
            },
          });
        }

        // Add thread assignment summary for AI context (Enhanced for Requirement 5.1)
        baseContext.recentActivity.push({
          id: `thread-assignment-${Date.now()}`,
          type: 'task_created',
          timestamp: new Date(),
          data: {
            threadAssignmentType: assignment.type,
            threadAssignmentId:
              assignment.taskId || assignment.date?.toISOString(),
            contextualHelp:
              assignment.type === 'task'
                ? 'This conversation is focused on helping with a specific task'
                : assignment.type === 'day'
                  ? 'This conversation is focused on helping with tasks and planning for a specific day'
                  : 'This is a general conversation thread',
            aiInstructions:
              assignment.type === 'task'
                ? 'Focus responses on the assigned task. Provide specific, actionable advice related to this task. Consider task dependencies, progress, and deadlines.'
                : assignment.type === 'day'
                  ? 'Focus responses on the assigned day. Help with planning, prioritization, and task management for this specific day. Consider workload, priorities, and time constraints.'
                  : 'Provide general productivity and task management assistance.',
            // Enhanced AI guidance
            contextScope: assignment.type,
            responseGuidance: {
              taskFocused: assignment.type === 'task',
              dayFocused: assignment.type === 'day',
              includeRelatedTasks: assignment.type === 'task',
              includeDayPlanning: assignment.type === 'day',
              considerDependencies: true,
              considerTimeConstraints: true,
              considerPriorities: true,
            },
          },
        });
      } else {
        // Add general thread context when no assignment
        baseContext.recentActivity.push({
          id: `general-thread-${Date.now()}`,
          type: 'task_created',
          timestamp: new Date(),
          data: {
            threadAssignmentType: 'general',
            contextualHelp:
              'This is a general conversation thread for productivity assistance',
            aiInstructions:
              'Provide general productivity and task management assistance. Help with planning, organization, and workflow optimization.',
            responseGuidance: {
              taskFocused: false,
              dayFocused: false,
              includeRelatedTasks: false,
              includeDayPlanning: false,
              considerDependencies: false,
              considerTimeConstraints: false,
              considerPriorities: false,
            },
          },
        });
      }

      return baseContext;
    },
    []
  );

  /**
   * Map AI action to tool execution result
   */
  const mapActionToResult = useCallback((action: AIAction): unknown => {
    switch (action.type) {
      case 'CREATE_TASK':
        return {
          success: true,
          taskId: action.parameters.id || 'generated-id',
          title: action.parameters.title,
          message: `Created task: ${action.parameters.title}`,
        };
      case 'UPDATE_TASK':
        return {
          success: true,
          taskId: action.parameters.id,
          changes: action.parameters,
          message: `Updated task with ID: ${action.parameters.id}`,
        };
      case 'START_TIMER':
        return {
          success: true,
          taskId: action.parameters.taskId,
          message: `Started timer for task: ${action.parameters.taskId}`,
        };
      case 'STOP_TIMER':
        return {
          success: true,
          taskId: action.parameters.taskId,
          duration: action.parameters.duration || 0,
          message: `Stopped timer for task: ${action.parameters.taskId}`,
        };
      case 'SCHEDULE_FOCUS':
        return {
          success: true,
          duration: action.parameters.duration,
          taskId: action.parameters.taskId,
          message: `Scheduled focus session for ${action.parameters.duration} minutes`,
        };
      case 'TAKE_BREAK':
        return {
          success: true,
          duration: action.parameters.duration || 5,
          message: `Scheduled break for ${action.parameters.duration || 5} minutes`,
        };
      case 'ANALYZE_PRODUCTIVITY':
        return {
          success: true,
          period: action.parameters.period || 'week',
          message: `Analyzed productivity for the past ${action.parameters.period || 'week'}`,
        };
      case 'SUGGEST_SCHEDULE':
        return {
          success: true,
          suggestions: action.parameters.suggestions || [],
          message: `Generated schedule suggestions`,
        };
      default:
        return {
          success: true,
          action: action.type,
          parameters: action.parameters,
          message: `Executed ${String(action.type).replace(/_/g, ' ').toLowerCase()}`,
        };
    }
  }, []);

  /**
   * Determine impact level based on action type
   */
  const determineImpactLevel = useCallback(
    (actionType: string): 'low' | 'medium' | 'high' => {
      switch (actionType) {
        case 'CREATE_TASK':
        case 'UPDATE_TASK':
        case 'SCHEDULE_FOCUS':
          return 'medium';
        case 'START_TIMER':
        case 'STOP_TIMER':
        case 'TAKE_BREAK':
          return 'low';
        case 'ANALYZE_PRODUCTIVITY':
        case 'SUGGEST_SCHEDULE':
          return 'high';
        default:
          return 'medium';
      }
    },
    []
  );

  /**
   * Get resources accessed by action type
   */
  const getResourcesForAction = useCallback((actionType: string): string[] => {
    switch (actionType) {
      case 'CREATE_TASK':
      case 'UPDATE_TASK':
        return ['tasks', 'database'];
      case 'START_TIMER':
      case 'STOP_TIMER':
        return ['timer', 'tasks'];
      case 'SCHEDULE_FOCUS':
      case 'TAKE_BREAK':
        return ['schedule', 'timer'];
      case 'ANALYZE_PRODUCTIVITY':
        return ['analytics', 'tasks', 'timer_sessions'];
      case 'SUGGEST_SCHEDULE':
        return ['tasks', 'schedule', 'analytics'];
      default:
        return ['general'];
    }
  }, []);

  /**
   * Get permissions required for action type
   */
  const getPermissionsForAction = useCallback(
    (actionType: string): string[] => {
      switch (actionType) {
        case 'CREATE_TASK':
          return ['create_tasks'];
        case 'UPDATE_TASK':
          return ['modify_tasks'];
        case 'START_TIMER':
        case 'STOP_TIMER':
          return ['control_timer'];
        case 'SCHEDULE_FOCUS':
        case 'TAKE_BREAK':
          return ['manage_schedule'];
        case 'ANALYZE_PRODUCTIVITY':
          return ['read_analytics'];
        case 'SUGGEST_SCHEDULE':
          return ['read_tasks', 'read_analytics'];
        default:
          return ['general_access'];
      }
    },
    []
  );

  /**
   * Load messages for a specific thread
   */
  const loadMessages = useCallback(
    async (targetThreadId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const messages = await threadService.findMessages(targetThreadId);
        setState(prev => ({ ...prev, messages, retryCount: 0 }));
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'message_load');
        setError(kiraError);
        console.error('Kira message_load error:', error);
      } finally {
        setLoading(false);
      }
    },
    [threadService, setLoading, setError]
  );

  /**
   * Refresh messages for the current thread
   */
  const refreshMessages = useCallback(
    async (targetThreadId: string): Promise<void> => {
      await loadMessages(targetThreadId);
    },
    [loadMessages]
  );

  /**
   * Clear all messages from state
   */
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
    }));
  }, []);

  /**
   * Send a message and get AI response with thread assignment context
   */
  const sendMessage = useCallback(
    async (
      message: string,
      threadAssignment?: ThreadAssignment
    ): Promise<ThreadMessage | null> => {
      if (!threadId) {
        const error = processKiraError(
          new Error('No thread selected'),
          'message_send'
        );
        setError(error);
        return null;
      }

      try {
        setSending(true);
        setError(null);

        // Create user message
        const userMessageRequest: CreateThreadMessageRequest = {
          threadId,
          type: 'user',
          content: message,
        };

        const userMessage =
          await threadService.createMessage(userMessageRequest);

        // Add user message to state immediately
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, userMessage],
        }));

        // Build context for AI based on thread assignment
        const baseAppContext = await buildAppContext(threadAssignment);

        // Validate and enhance context before sending to AI
        const enhancedAppContext = validateAndEnhanceContext(
          baseAppContext,
          threadAssignment
        );

        // Send message to AI service with enhanced context
        const aiResponse: AIResponse | null = await sendAIMessage(
          message,
          enhancedAppContext
        );

        if (aiResponse) {
          // Extract tool executions from AI response
          // The AI service handles tool execution internally and may include results in the response
          const toolExecutions: ToolExecution[] = [];

          // If the AI response includes actions, those represent tool executions
          if (aiResponse.actions && aiResponse.actions.length > 0) {
            aiResponse.actions.forEach(action => {
              // Map AI actions to tool executions with proper metadata
              const toolExecution: ToolExecution = {
                toolName: action.type.toLowerCase().replace(/_/g, '-'),
                parameters: action.parameters,
                reasoning:
                  action.reasoning ||
                  `Executed ${action.type.replace(/_/g, ' ').toLowerCase()} based on user request`,
                result: mapActionToResult(action),
                executionTime: 0, // Not tracked at this level - could be enhanced
                userConfirmed: true, // Actions from AI service are pre-confirmed
                impactLevel: determineImpactLevel(action.type),
                resourcesAccessed: getResourcesForAction(action.type),
                permissions: getPermissionsForAction(action.type),
              };
              toolExecutions.push(toolExecution);
            });
          }

          // Create AI response message with tool executions
          const aiMessageRequest: CreateThreadMessageRequest = {
            threadId,
            type: 'assistant',
            content: aiResponse.message,
            reasoning: aiResponse.reasoning,
            actions: aiResponse.actions,
            suggestions: aiResponse.suggestions,
            toolExecutions,
          };

          const aiMessage = await threadService.createMessage(aiMessageRequest);

          // Add AI message to state
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, aiMessage],
            retryCount: 0,
          }));

          return aiMessage;
        } else {
          throw new Error('Failed to get AI response');
        }
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'message_send');
        setError(kiraError);
        console.error('Kira message_send error:', error);
        return null;
      } finally {
        setSending(false);
      }
    },
    [
      threadId,
      threadService,
      sendAIMessage,
      buildAppContext,
      setSending,
      setError,
    ]
  );

  /**
   * Submit feedback for a specific message
   */
  const submitFeedback = useCallback(
    async (messageId: string, feedback: UserFeedback): Promise<void> => {
      try {
        setSubmittingFeedback(true);
        setError(null);

        // Find the message in our state
        const message = state.messages.find(m => m.id === messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        // For thread messages, we need to create a conversation ID that matches the AI context
        // We'll use the message timestamp and content to create a unique identifier
        const conversationId = `thread-${message.threadId}-${message.timestamp.getTime()}`;

        // Submit feedback through AI context
        await submitAIFeedback(conversationId, feedback);

        // Update the message in our local state to include feedback
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, userFeedback: feedback } : m
          ),
          retryCount: 0,
        }));

        // Also update the message in the database
        await threadService.updateMessage(messageId, {
          userFeedback: feedback,
        });
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'message_feedback');
        setError(kiraError);
        console.error('Kira message_feedback error:', error);
      } finally {
        setSubmittingFeedback(false);
      }
    },
    [
      state.messages,
      submitAIFeedback,
      threadService,
      setSubmittingFeedback,
      setError,
    ]
  );

  /**
   * Regenerate AI response for a specific message
   */
  const regenerateResponse = useCallback(
    async (
      messageId: string,
      threadAssignment?: ThreadAssignment
    ): Promise<ThreadMessage | null> => {
      if (!threadId) {
        const error = processKiraError(
          new Error('No thread selected'),
          'message_regenerate'
        );
        setError(error);
        return null;
      }

      try {
        setRegenerating(true);
        setError(null);

        // Find the message and the preceding user message
        const messageIndex = state.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
          throw new Error('Message not found');
        }

        const message = state.messages[messageIndex];
        if (message.type !== 'assistant') {
          throw new Error('Can only regenerate assistant messages');
        }

        // Find the user message that prompted this response
        let userMessage: ThreadMessage | null = null;
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (state.messages[i].type === 'user') {
            userMessage = state.messages[i];
            break;
          }
        }

        if (!userMessage) {
          throw new Error('No user message found to regenerate from');
        }

        // Remove the old AI message from state temporarily
        setState(prev => ({
          ...prev,
          messages: prev.messages.filter(m => m.id !== messageId),
        }));

        // Build context for AI based on thread assignment
        const baseAppContext = await buildAppContext(threadAssignment);

        // Validate and enhance context before sending to AI
        const enhancedAppContext = validateAndEnhanceContext(
          baseAppContext,
          threadAssignment
        );

        // Send the original user message to AI service again
        const aiResponse: AIResponse | null = await sendAIMessage(
          userMessage.content,
          enhancedAppContext
        );

        if (aiResponse) {
          // Extract tool executions from AI response
          const toolExecutions: ToolExecution[] = [];

          if (aiResponse.actions && aiResponse.actions.length > 0) {
            aiResponse.actions.forEach(action => {
              const toolExecution: ToolExecution = {
                toolName: action.type.toLowerCase().replace(/_/g, '-'),
                parameters: action.parameters,
                reasoning:
                  action.reasoning ||
                  `Executed ${action.type.replace(/_/g, ' ').toLowerCase()} based on user request`,
                result: mapActionToResult(action),
                executionTime: 0,
                userConfirmed: true,
                impactLevel: determineImpactLevel(action.type),
                resourcesAccessed: getResourcesForAction(action.type),
                permissions: getPermissionsForAction(action.type),
              };
              toolExecutions.push(toolExecution);
            });
          }

          // Delete the old message from database
          await threadService.deleteMessage(messageId);

          // Create new AI response message
          const aiMessageRequest: CreateThreadMessageRequest = {
            threadId,
            type: 'assistant',
            content: aiResponse.message,
            reasoning: aiResponse.reasoning,
            actions: aiResponse.actions,
            suggestions: aiResponse.suggestions,
            toolExecutions,
          };

          const newAiMessage =
            await threadService.createMessage(aiMessageRequest);

          // Add new AI message to state
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, newAiMessage],
            retryCount: 0,
          }));

          return newAiMessage;
        } else {
          // If regeneration failed, restore the original message
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, message].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            ),
          }));

          throw new Error('Failed to regenerate AI response');
        }
      } catch (error) {
        const kiraError = processKiraError(
          error as Error,
          'message_regenerate'
        );
        setError(kiraError);
        console.error('Kira message_regenerate error:', error);
        return null;
      } finally {
        setRegenerating(false);
      }
    },
    [
      threadId,
      state.messages,
      threadService,
      sendAIMessage,
      buildAppContext,
      setRegenerating,
      setError,
    ]
  );

  // Load messages when threadId changes
  useEffect(() => {
    if (threadId) {
      loadMessages(threadId);
    } else {
      clearMessages();
    }
  }, [threadId]); // Only depend on threadId to avoid infinite loops

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    isSending: state.isSending || aiLoading,
    isSubmittingFeedback: state.isSubmittingFeedback,
    isRegenerating: state.isRegenerating,
    error: state.error,
    retryCount: state.retryCount,
    sendMessage,
    loadMessages,
    clearMessages,
    refreshMessages,
    clearError,
    retryLastOperation,
    // Enhanced AI integration
    submitFeedback,
    regenerateResponse,
  };
}
