import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  Chip,
  Divider,
  Select,
  SelectItem,
  Tooltip,
} from '@heroui/react';
import {
  Calendar,
  CheckCircle2,
  Target,
  AlertCircle,
  Flame,
  Clock,
  ArrowRight,
  CheckSquare,
  Square,
  MoveRight,
  Sparkles,
  Zap,
  Users,
  BarChart3,
  Link,
  AlertTriangle,
  Info,
  Plus,
} from 'lucide-react';
import { Task, Priority } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../contexts/SettingsContext';
import {
  TaskMigrationService,
  TaskSchedulingSuggestion,
  DependencyValidationResult,
} from '../../services/TaskMigrationService';
// import { useDatabase } from '../../hooks/useDatabase'; // Not currently used
import { getTaskRepository } from '../../services/database/repositories';

import { formatDate } from '../../utils/dateFormat';

export interface TaskMigration {
  taskId: string;
  newScheduledDate: Date;
}

interface TaskMigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incompleteTasks: Task[];
  currentWeek: Date;
  weekStartDay: 0 | 1;
  onMigrateTasks: (migrations: TaskMigration[]) => Promise<void>;
  onDismissWeek: () => void;
  onDisableMigration: () => void;
}

export function TaskMigrationDialog({
  isOpen,
  onClose,
  incompleteTasks,
  currentWeek,
  weekStartDay,
  onMigrateTasks,
  onDismissWeek,
  onDisableMigration,
}: TaskMigrationDialogProps) {
  const { t } = useTranslation();
  const { preferences } = useSettings();
  // const { isInitialized } = useDatabase(); // Not currently used
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [taskScheduling, setTaskScheduling] = useState<Map<string, Date>>(
    new Map()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSchedulingSuggestion[]>(
    []
  );
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [dependencyInfo, setDependencyInfo] = useState<
    Map<
      string,
      {
        dependencies: Task[];
        dependents: Task[];
        hasDependencyRelationships: boolean;
      }
    >
  >(new Map());
  const [dependencyConflicts, setDependencyConflicts] =
    useState<DependencyValidationResult>({
      hasConflicts: false,
      conflicts: [],
      suggestedMigrations: [],
    });
  const [showDependencyWarnings, setShowDependencyWarnings] = useState(true);
  const [suggestedDependentTasks, setSuggestedDependentTasks] = useState<
    TaskMigration[]
  >([]);

  // Calculate week dates for the current week
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const weekStart = new Date(currentWeek);

    // Adjust to week start day
    const dayOfWeek = weekStart.getDay();
    const daysToSubtract = weekStartDay === 0 ? dayOfWeek : (dayOfWeek + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysToSubtract);

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }

    return dates;
  }, [currentWeek, weekStartDay]);

  // Initialize selected tasks and load suggestions
  useEffect(() => {
    if (isOpen && incompleteTasks.length > 0) {
      // Select all tasks by default immediately
      const allTaskIds = new Set(incompleteTasks.map(task => task.id));
      setSelectedTasks(allTaskIds);

      // Set initial scheduling to first day of week
      const initialScheduling = new Map<string, Date>();
      incompleteTasks.forEach(task => {
        initialScheduling.set(task.id, weekDates[0]);
      });
      setTaskScheduling(initialScheduling);

      // Load suggestions and dependency info asynchronously
      const loadSuggestionsAndDependencies = async () => {
        setIsLoadingSuggestions(true);
        try {
          const taskRepo = getTaskRepository();
          const migrationService = new TaskMigrationService(taskRepo);

          // Load scheduling suggestions
          const taskSuggestions =
            await migrationService.suggestSchedulingForTasks(
              incompleteTasks,
              currentWeek
            );
          setSuggestions(taskSuggestions);

          // Load dependency information
          const taskIds = incompleteTasks.map(task => task.id);
          const depInfo =
            await migrationService.getTasksWithDependencyInfo(taskIds);
          setDependencyInfo(depInfo);

          // Update scheduling with suggestions
          const updatedScheduling = new Map<string, Date>();
          incompleteTasks.forEach(task => {
            const suggestion = taskSuggestions.find(s => s.taskId === task.id);
            const defaultDate = suggestion?.suggestedDate || weekDates[0];
            updatedScheduling.set(task.id, defaultDate);
          });
          setTaskScheduling(updatedScheduling);

          // Load suggested dependent tasks
          const initialMigrations: TaskMigration[] = incompleteTasks.map(
            task => ({
              taskId: task.id,
              newScheduledDate: updatedScheduling.get(task.id) || weekDates[0],
            })
          );

          const dependentSuggestions =
            await migrationService.suggestDependentTaskMigrations(
              initialMigrations,
              currentWeek
            );
          setSuggestedDependentTasks(dependentSuggestions);
        } catch (error) {
          console.error(
            'Failed to load scheduling suggestions and dependencies:',
            error
          );
          setSuggestions([]);
          setDependencyInfo(new Map());
        } finally {
          setIsLoadingSuggestions(false);
        }
      };

      loadSuggestionsAndDependencies();
    } else if (!isOpen) {
      // Reset state when dialog closes
      setSelectedTasks(new Set());
      setTaskScheduling(new Map());
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setDependencyInfo(new Map());
      setDependencyConflicts({
        hasConflicts: false,
        conflicts: [],
        suggestedMigrations: [],
      });
      setSuggestedDependentTasks([]);
    }
  }, [isOpen, incompleteTasks, weekDates, currentWeek]);

  // Validate dependency conflicts when selections or scheduling changes
  useEffect(() => {
    const validateConflicts = async () => {
      if (
        selectedTasks.size === 0 ||
        !preferences.migrationSettings.showDependencyWarnings
      ) {
        setDependencyConflicts({
          hasConflicts: false,
          conflicts: [],
          suggestedMigrations: [],
        });
        return;
      }

      try {
        const taskRepo = getTaskRepository();
        const migrationService = new TaskMigrationService(taskRepo);

        const migrations: TaskMigration[] = Array.from(selectedTasks).map(
          taskId => ({
            taskId,
            newScheduledDate: taskScheduling.get(taskId) || weekDates[0],
          })
        );

        const conflicts =
          await migrationService.validateDependencyConflicts(migrations);
        setDependencyConflicts(conflicts);
      } catch (error) {
        console.error('Failed to validate dependency conflicts:', error);
      }
    };

    validateConflicts();
  }, [
    selectedTasks,
    taskScheduling,
    weekDates,
    preferences.migrationSettings.showDependencyWarnings,
  ]);

  const handleTaskSelection = (taskId: string, selected: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (selected) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    const allTaskIds = new Set(incompleteTasks.map(task => task.id));
    setSelectedTasks(allTaskIds);
  };

  const handleClearAll = () => {
    setSelectedTasks(new Set());
  };

  const handleTaskScheduling = (taskId: string, date: Date) => {
    const newScheduling = new Map(taskScheduling);
    newScheduling.set(taskId, date);
    setTaskScheduling(newScheduling);
  };

  const handleMigrate = async () => {
    if (selectedTasks.size === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const migrations: TaskMigration[] = Array.from(selectedTasks).map(
        taskId => ({
          taskId,
          newScheduledDate: taskScheduling.get(taskId) || weekDates[0],
        })
      );

      await onMigrateTasks(migrations);
      onClose();
    } catch (error) {
      console.error('Failed to migrate tasks:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipWeek = () => {
    onDismissWeek();
    onClose();
  };

  const handleDontAskAgain = () => {
    onDisableMigration();
    onClose();
  };

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return <CheckCircle2 className='w-4 h-4 text-success' />;
      case Priority.MEDIUM:
        return <Target className='w-4 h-4 text-warning' />;
      case Priority.HIGH:
        return <AlertCircle className='w-4 h-4 text-danger' />;
      case Priority.URGENT:
        return <Flame className='w-4 h-4 text-danger' />;
      default:
        return <Target className='w-4 h-4 text-warning' />;
    }
  };

  const getPriorityColor = (
    priority: Priority
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (priority) {
      case Priority.LOW:
        return 'success';
      case Priority.MEDIUM:
        return 'warning';
      case Priority.HIGH:
        return 'danger';
      case Priority.URGENT:
        return 'danger';
      default:
        return 'warning';
    }
  };

  const getDayName = (date: Date): string => {
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return dayNames[date.getDay()];
  };

  const getSuggestionIcon = (reason: TaskSchedulingSuggestion['reason']) => {
    switch (reason) {
      case 'priority':
        return <Flame className='w-3 h-3 text-danger' />;
      case 'time_estimate':
        return <Clock className='w-3 h-3 text-warning' />;
      case 'dependencies':
        return <Users className='w-3 h-3 text-primary' />;
      case 'workload_balance':
        return <BarChart3 className='w-3 h-3 text-success' />;
      default:
        return <Sparkles className='w-3 h-3 text-secondary' />;
    }
  };

  const getSuggestionReasonText = (
    reason: TaskSchedulingSuggestion['reason']
  ) => {
    switch (reason) {
      case 'priority':
        return t('migration.suggestion.reason.priority');
      case 'time_estimate':
        return t('migration.suggestion.reason.timeEstimate');
      case 'dependencies':
        return t('migration.suggestion.reason.dependencies');
      case 'workload_balance':
        return t('migration.suggestion.reason.workloadBalance');
      default:
        return t('migration.suggestion.reason.general');
    }
  };

  const getConfidenceColor = (
    confidence: number
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    if (confidence >= 0.9) {
      return 'success';
    }
    if (confidence >= 0.7) {
      return 'primary';
    }
    if (confidence >= 0.5) {
      return 'warning';
    }
    return 'danger';
  };

  const handleAcceptAllSuggestions = () => {
    const newScheduling = new Map(taskScheduling);
    suggestions.forEach(suggestion => {
      newScheduling.set(suggestion.taskId, suggestion.suggestedDate);
    });
    setTaskScheduling(newScheduling);
  };

  const handleAcceptSuggestion = (taskId: string) => {
    const suggestion = suggestions.find(s => s.taskId === taskId);
    if (suggestion) {
      handleTaskScheduling(taskId, suggestion.suggestedDate);
    }
  };

  const handleAddDependentTask = async (dependentTaskId: string) => {
    try {
      const taskRepo = getTaskRepository();
      const dependentTask = await taskRepo.findById(dependentTaskId);
      if (!dependentTask) {
        return;
      }

      // Add to selected tasks
      const newSelected = new Set(selectedTasks);
      newSelected.add(dependentTaskId);
      setSelectedTasks(newSelected);

      // Find suggested scheduling for this dependent task
      const suggestion = suggestedDependentTasks.find(
        s => s.taskId === dependentTaskId
      );
      if (suggestion) {
        const newScheduling = new Map(taskScheduling);
        newScheduling.set(dependentTaskId, suggestion.newScheduledDate);
        setTaskScheduling(newScheduling);
      }
    } catch (error) {
      console.error('Failed to add dependent task:', error);
    }
  };

  const handleAcceptConflictSuggestion = (taskId: string) => {
    const suggestion = dependencyConflicts.suggestedMigrations.find(
      s => s.taskId === taskId
    );
    if (suggestion) {
      handleTaskScheduling(taskId, suggestion.newScheduledDate);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='2xl'
      scrollBehavior='inside'
      backdrop='blur'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'max-h-[60vh] overflow-y-auto',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <MoveRight className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>
              {t('migration.dialog.title')}
            </h2>
          </div>
          <p className='text-sm text-foreground-600 font-normal'>
            {t('migration.dialog.description', {
              count: incompleteTasks.length,
            })}
          </p>
        </ModalHeader>

        <ModalBody>
          <div className='space-y-4'>
            {/* Bulk Actions */}
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='flat'
                  onPress={handleSelectAll}
                  startContent={<CheckSquare className='w-4 h-4' />}
                >
                  {t('migration.actions.selectAll')}
                </Button>
                <Button
                  size='sm'
                  variant='flat'
                  onPress={handleClearAll}
                  startContent={<Square className='w-4 h-4' />}
                >
                  {t('migration.actions.clearAll')}
                </Button>
                {suggestions.length > 0 && (
                  <Button
                    size='sm'
                    variant='flat'
                    color='primary'
                    onPress={handleAcceptAllSuggestions}
                    startContent={<Zap className='w-4 h-4' />}
                    isLoading={isLoadingSuggestions}
                  >
                    {t('migration.actions.acceptAllSuggestions')}
                  </Button>
                )}
              </div>
              <div className='text-sm text-foreground-600'>
                {selectedTasks.size} of {incompleteTasks.length} selected
              </div>
            </div>

            <Divider />

            {/* Task List */}
            <div className='space-y-3'>
              {incompleteTasks.map(task => {
                const isSelected = selectedTasks.has(task.id);
                const scheduledDate =
                  taskScheduling.get(task.id) || weekDates[0];
                const suggestion = suggestions.find(s => s.taskId === task.id);
                const hasSuggestion = suggestion && suggestion.confidence > 0.5;
                const isSuggestionSelected =
                  suggestion &&
                  scheduledDate.toDateString() ===
                    suggestion.suggestedDate.toDateString();

                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-divider bg-content2'
                    }`}
                  >
                    <div className='flex items-start gap-3'>
                      <Checkbox
                        isSelected={isSelected}
                        onValueChange={selected =>
                          handleTaskSelection(task.id, selected)
                        }
                        className='mt-1'
                      />

                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 mb-2'>
                          {getPriorityIcon(task.priority)}
                          <h3 className='font-medium text-foreground truncate'>
                            {task.title}
                          </h3>
                          <Chip
                            size='sm'
                            variant='flat'
                            color={getPriorityColor(task.priority)}
                          >
                            {Priority[task.priority]}
                          </Chip>
                          {hasSuggestion && (
                            <Tooltip
                              content={
                                <div className='p-2'>
                                  <div className='flex items-center gap-1 mb-1'>
                                    {getSuggestionIcon(suggestion.reason)}
                                    <span className='text-xs font-medium'>
                                      {getSuggestionReasonText(
                                        suggestion.reason
                                      )}
                                    </span>
                                  </div>
                                  <div className='text-xs text-foreground-600'>
                                    {t('migration.suggestion.confidence', {
                                      confidence: Math.round(
                                        suggestion.confidence * 100
                                      ),
                                    })}
                                  </div>
                                </div>
                              }
                            >
                              <Chip
                                size='sm'
                                variant='flat'
                                color={getConfidenceColor(
                                  suggestion.confidence
                                )}
                                startContent={<Sparkles className='w-3 h-3' />}
                              >
                                {t('migration.suggestion.label')}
                              </Chip>
                            </Tooltip>
                          )}
                        </div>

                        <div className='flex items-center gap-4 text-sm text-foreground-600'>
                          <div className='flex items-center gap-1'>
                            <Calendar className='w-3 h-3' />
                            <span>
                              {t('migration.task.originalDate', {
                                date: task.scheduledDate
                                  ? formatDate(
                                      task.scheduledDate,
                                      preferences.dateFormat
                                    )
                                  : 'No date',
                              })}
                            </span>
                          </div>

                          {task.timeEstimate > 0 && (
                            <div className='flex items-center gap-1'>
                              <Clock className='w-3 h-3' />
                              <span>{task.timeEstimate}m</span>
                            </div>
                          )}
                        </div>

                        {/* Dependency Information */}
                        {dependencyInfo.get(task.id)
                          ?.hasDependencyRelationships && (
                          <div className='mt-2 p-2 rounded-md bg-content1 border border-divider'>
                            <div className='flex items-center gap-2 text-sm text-foreground-600'>
                              <Link className='w-3 h-3' />
                              <span className='font-medium'>
                                {t('migration.dependencies.label')}
                              </span>
                            </div>

                            {(dependencyInfo.get(task.id)?.dependencies
                              .length ?? 0) > 0 && (
                              <div className='mt-1 text-xs text-foreground-500'>
                                {t('migration.dependencies.dependsOn')}:{' '}
                                {dependencyInfo
                                  .get(task.id)
                                  ?.dependencies.map(dep => dep.title)
                                  .join(', ')}
                              </div>
                            )}

                            {(dependencyInfo.get(task.id)?.dependents.length ??
                              0) > 0 && (
                              <div className='mt-1 text-xs text-foreground-500'>
                                {t('migration.dependencies.requiredBy')}:{' '}
                                {dependencyInfo
                                  .get(task.id)
                                  ?.dependents.map(dep => dep.title)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Scheduling Selection */}
                        {isSelected && (
                          <div className='mt-3 pt-3 border-t border-divider'>
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center gap-2'>
                                <ArrowRight className='w-4 h-4 text-primary' />
                                <span className='text-sm font-medium'>
                                  {t('migration.task.newDate')}
                                </span>
                              </div>
                              {hasSuggestion && !isSuggestionSelected && (
                                <Button
                                  size='sm'
                                  variant='flat'
                                  color='primary'
                                  onPress={() =>
                                    handleAcceptSuggestion(task.id)
                                  }
                                  startContent={<Zap className='w-3 h-3' />}
                                >
                                  {t('migration.actions.acceptSuggestion')}
                                </Button>
                              )}
                            </div>

                            {/* Show suggestion info if available */}
                            {hasSuggestion && (
                              <div
                                className={`mt-2 p-2 rounded-md border ${
                                  isSuggestionSelected
                                    ? 'border-success bg-success/10'
                                    : 'border-primary bg-primary/10'
                                }`}
                              >
                                <div className='flex items-center gap-2 text-sm'>
                                  {getSuggestionIcon(suggestion.reason)}
                                  <span className='font-medium'>
                                    {t('migration.suggestion.recommended')}:
                                  </span>
                                  <span>
                                    {getDayName(suggestion.suggestedDate)} -{' '}
                                    {formatDate(
                                      suggestion.suggestedDate,
                                      preferences.dateFormat
                                    )}
                                  </span>
                                  {isSuggestionSelected && (
                                    <CheckCircle2 className='w-4 h-4 text-success ml-auto' />
                                  )}
                                </div>
                                <div className='text-xs text-foreground-600 mt-1'>
                                  {getSuggestionReasonText(suggestion.reason)} •{' '}
                                  {t('migration.suggestion.confidence', {
                                    confidence: Math.round(
                                      suggestion.confidence * 100
                                    ),
                                  })}
                                </div>
                              </div>
                            )}

                            <div className='mt-2'>
                              <Select
                                size='sm'
                                selectedKeys={[scheduledDate.toISOString()]}
                                onSelectionChange={keys => {
                                  const dateString = Array.from(
                                    keys
                                  )[0] as string;
                                  const date = new Date(dateString);
                                  handleTaskScheduling(task.id, date);
                                }}
                                classNames={{
                                  trigger: 'bg-content1 border-divider',
                                }}
                              >
                                {weekDates.map(date => {
                                  const isSuggestedDate =
                                    suggestion &&
                                    date.toDateString() ===
                                      suggestion.suggestedDate.toDateString();

                                  return (
                                    <SelectItem
                                      key={date.toISOString()}
                                      startContent={
                                        isSuggestedDate && (
                                          <Sparkles className='w-3 h-3 text-primary' />
                                        )
                                      }
                                    >
                                      {getDayName(date)} -{' '}
                                      {formatDate(date, preferences.dateFormat)}
                                      {isSuggestedDate &&
                                        ` (${t('migration.suggestion.recommended')})`}
                                    </SelectItem>
                                  );
                                })}
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dependency Conflicts Warning */}
            {showDependencyWarnings && dependencyConflicts.hasConflicts && (
              <div className='mt-4 p-3 rounded-lg border border-warning bg-warning/10'>
                <div className='flex items-center gap-2 mb-2'>
                  <AlertTriangle className='w-4 h-4 text-warning' />
                  <h4 className='font-medium text-warning'>
                    {t('migration.conflicts.title')}
                  </h4>
                </div>

                <div className='space-y-2'>
                  {dependencyConflicts.conflicts.map((conflict, index) => (
                    <div key={index} className='text-sm'>
                      <div className='flex items-start gap-2'>
                        <AlertCircle className='w-3 h-3 text-warning mt-0.5 flex-shrink-0' />
                        <div className='flex-1'>
                          <div className='text-foreground-700'>
                            <strong>{conflict.taskTitle}</strong>{' '}
                            {conflict.conflictType === 'dependency_after'
                              ? t('migration.conflicts.dependencyAfter', {
                                  dependency: conflict.conflictingTaskTitle,
                                  date:
                                    conflict.conflictingTaskDate?.toDateString() ||
                                    '',
                                })
                              : t('migration.conflicts.dependentBefore', {
                                  dependent: conflict.conflictingTaskTitle,
                                  date:
                                    conflict.conflictingTaskDate?.toDateString() ||
                                    '',
                                })}
                          </div>
                          {conflict.suggestion && (
                            <div className='text-xs text-foreground-600 mt-1'>
                              {conflict.suggestion}
                            </div>
                          )}
                          {dependencyConflicts.suggestedMigrations.find(
                            s => s.taskId === conflict.taskId
                          ) && (
                            <Button
                              size='sm'
                              variant='flat'
                              color='warning'
                              className='mt-1'
                              onPress={() =>
                                handleAcceptConflictSuggestion(conflict.taskId)
                              }
                              startContent={<Zap className='w-3 h-3' />}
                            >
                              {t('migration.conflicts.acceptSuggestion')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size='sm'
                  variant='light'
                  className='mt-2'
                  onPress={() => setShowDependencyWarnings(false)}
                  startContent={<Info className='w-3 h-3' />}
                >
                  {t('migration.conflicts.dismiss')}
                </Button>
              </div>
            )}

            {/* Suggested Dependent Tasks */}
            {suggestedDependentTasks.length > 0 && (
              <div className='mt-4 p-3 rounded-lg border border-primary bg-primary/10'>
                <div className='flex items-center gap-2 mb-2'>
                  <Users className='w-4 h-4 text-primary' />
                  <h4 className='font-medium text-primary'>
                    {t('migration.dependents.title')}
                  </h4>
                </div>

                <p className='text-sm text-foreground-600 mb-3'>
                  {t('migration.dependents.description')}
                </p>

                <div className='space-y-2'>
                  {suggestedDependentTasks.map(suggestion => {
                    const dependentTask =
                      incompleteTasks.find(t => t.id === suggestion.taskId) ||
                      Array.from(dependencyInfo.values())
                        .flatMap(info => [
                          ...info.dependencies,
                          ...info.dependents,
                        ])
                        .find(t => t.id === suggestion.taskId);

                    if (!dependentTask) {
                      return null;
                    }

                    const isAlreadySelected = selectedTasks.has(
                      suggestion.taskId
                    );

                    return (
                      <div
                        key={suggestion.taskId}
                        className='flex items-center justify-between p-2 rounded border border-divider bg-content1'
                      >
                        <div className='flex-1'>
                          <div className='font-medium text-sm'>
                            {dependentTask.title}
                          </div>
                          <div className='text-xs text-foreground-600'>
                            {t('migration.dependents.suggestedDate', {
                              date: formatDate(
                                suggestion.newScheduledDate,
                                preferences.dateFormat
                              ),
                            })}
                          </div>
                        </div>

                        {!isAlreadySelected && (
                          <Button
                            size='sm'
                            variant='flat'
                            color='primary'
                            onPress={() =>
                              handleAddDependentTask(suggestion.taskId)
                            }
                            startContent={<Plus className='w-3 h-3' />}
                          >
                            {t('migration.dependents.add')}
                          </Button>
                        )}

                        {isAlreadySelected && (
                          <Chip size='sm' color='success' variant='flat'>
                            {t('migration.dependents.added')}
                          </Chip>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <div className='flex items-center justify-between w-full'>
            <Button
              variant='light'
              onPress={handleDontAskAgain}
              size='sm'
              isDisabled={isSubmitting}
            >
              {t('migration.actions.dontAskAgain')}
            </Button>

            <div className='flex items-center gap-2'>
              <Button
                variant='flat'
                onPress={handleSkipWeek}
                size='sm'
                isDisabled={isSubmitting}
              >
                {t('migration.actions.skipWeek')}
              </Button>
              <Button
                color='primary'
                onPress={handleMigrate}
                size='sm'
                isLoading={isSubmitting}
                isDisabled={selectedTasks.size === 0}
                startContent={
                  !isSubmitting && <MoveRight className='w-4 h-4' />
                }
              >
                {t('migration.actions.migrateSelected', {
                  count: selectedTasks.size,
                })}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
