import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Spinner,
  Divider,
} from '@heroui/react';
import { Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { Task } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../contexts/SettingsContext';
import { WeekTransitionDetector } from '../../services/WeekTransitionDetector';
import { getTaskRepository } from '../../services/database/repositories';
import { TaskMigrationDialog, TaskMigration } from './TaskMigrationDialog';

interface ManualMigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: Date;
  onMigrateTasks: (migrations: TaskMigration[]) => Promise<void>;
}

export function ManualMigrationDialog({
  isOpen,
  onClose,
  currentWeek,
  onMigrateTasks,
}: ManualMigrationDialogProps) {
  const { t } = useTranslation();
  const { preferences } = useSettings();
  const [availableWeeks, setAvailableWeeks] = useState<Date[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>([]);
  const [isLoadingWeeks, setIsLoadingWeeks] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStartDay = preferences.taskSettings.weekStartDay;

  // Load available weeks when dialog opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadAvailableWeeks = async () => {
      setIsLoadingWeeks(true);
      setError(null);

      try {
        const taskService = getTaskRepository();
        const weekTransitionDetector = new WeekTransitionDetector(taskService);

        const weeks =
          await weekTransitionDetector.getAvailableWeeksForMigration(
            currentWeek,
            weekStartDay
          );

        setAvailableWeeks(weeks);

        if (weeks.length === 0) {
          setError(t('migration.manual.noTasksFound'));
        }
      } catch (err) {
        console.error('Failed to load available weeks:', err);
        setError('Failed to load available weeks');
      } finally {
        setIsLoadingWeeks(false);
      }
    };

    loadAvailableWeeks();
  }, [isOpen, currentWeek, weekStartDay, t]);

  // Load tasks when a week is selected
  useEffect(() => {
    if (!selectedWeek) {
      setIncompleteTasks([]);
      return;
    }

    const loadTasks = async () => {
      setIsLoadingTasks(true);
      setError(null);

      try {
        const taskService = getTaskRepository();
        const weekTransitionDetector = new WeekTransitionDetector(taskService);

        const tasks = await weekTransitionDetector.getIncompleteTasksFromWeek(
          selectedWeek,
          weekStartDay
        );

        setIncompleteTasks(tasks);

        if (tasks.length === 0) {
          setError(t('migration.manual.noTasksFound'));
        }
      } catch (err) {
        console.error('Failed to load tasks for week:', err);
        setError('Failed to load tasks');
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, [selectedWeek, weekStartDay, t]);

  // Format week options for the select dropdown
  const weekOptions = useMemo(() => {
    const taskService = getTaskRepository();
    const weekTransitionDetector = new WeekTransitionDetector(taskService);

    return availableWeeks.map(week => ({
      key: week.toISOString(),
      label: weekTransitionDetector.formatWeekForDisplay(week, weekStartDay),
      value: week,
    }));
  }, [availableWeeks, weekStartDay]);

  const handleWeekSelect = (weekKey: string) => {
    const week = availableWeeks.find(w => w.toISOString() === weekKey);
    setSelectedWeek(week || null);
  };

  const handleProceedToMigration = () => {
    if (incompleteTasks.length > 0) {
      setShowMigrationDialog(true);
    }
  };

  const handleMigrationComplete = async (migrations: TaskMigration[]) => {
    try {
      await onMigrateTasks(migrations);
      setShowMigrationDialog(false);
      onClose();
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  };

  const handleClose = () => {
    setSelectedWeek(null);
    setIncompleteTasks([]);
    setError(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showMigrationDialog}
        onClose={handleClose}
        size='lg'
        scrollBehavior='inside'
      >
        <ModalContent>
          <ModalHeader className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <Calendar className='w-5 h-5 text-primary' />
              <span>{t('migration.manual.dialog.title')}</span>
            </div>
            <p className='text-sm text-foreground-600 font-normal'>
              {t('migration.manual.dialog.description')}
            </p>
          </ModalHeader>

          <ModalBody>
            <div className='space-y-4'>
              {/* Week Selection */}
              <div>
                <label className='block text-sm font-medium text-foreground-700 mb-2'>
                  {t('migration.manual.selectWeek')}
                </label>

                {isLoadingWeeks ? (
                  <div className='flex items-center justify-center py-4'>
                    <Spinner size='sm' />
                    <span className='ml-2 text-sm text-foreground-600'>
                      Loading weeks...
                    </span>
                  </div>
                ) : weekOptions.length > 0 ? (
                  <Select
                    placeholder='Select a week with incomplete tasks'
                    selectedKeys={
                      selectedWeek ? [selectedWeek.toISOString()] : []
                    }
                    onSelectionChange={keys => {
                      const key = Array.from(keys)[0] as string;
                      if (key) {
                        handleWeekSelect(key);
                      }
                    }}
                  >
                    {weekOptions.map(option => (
                      <SelectItem key={option.key}>{option.label}</SelectItem>
                    ))}
                  </Select>
                ) : (
                  <div className='flex items-center gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg'>
                    <AlertCircle className='w-4 h-4 text-warning-600' />
                    <span className='text-sm text-warning-700 dark:text-warning-300'>
                      No weeks with incomplete tasks found
                    </span>
                  </div>
                )}
              </div>

              {/* Task Preview */}
              {selectedWeek && (
                <>
                  <Divider />
                  <div>
                    <h4 className='text-sm font-medium text-foreground-700 mb-2'>
                      Tasks from selected week
                    </h4>

                    {isLoadingTasks ? (
                      <div className='flex items-center justify-center py-4'>
                        <Spinner size='sm' />
                        <span className='ml-2 text-sm text-foreground-600'>
                          {t('migration.manual.loadingTasks')}
                        </span>
                      </div>
                    ) : incompleteTasks.length > 0 ? (
                      <div className='space-y-2 max-h-48 overflow-y-auto'>
                        {incompleteTasks.map(task => (
                          <div
                            key={task.id}
                            className='flex items-center gap-3 p-2 bg-content2 rounded-lg'
                          >
                            <div className='flex-1'>
                              <div className='font-medium text-sm'>
                                {task.title}
                              </div>
                              {task.scheduledDate && (
                                <div className='text-xs text-foreground-600'>
                                  Originally:{' '}
                                  {new Date(
                                    task.scheduledDate
                                  ).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className='text-xs text-foreground-500'>
                              {task.priority}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className='flex items-center gap-2 p-3 bg-default-100 rounded-lg'>
                        <AlertCircle className='w-4 h-4 text-default-600' />
                        <span className='text-sm text-default-700'>
                          {t('migration.manual.noTasksFound')}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Error Display */}
              {error && (
                <div className='flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg'>
                  <AlertCircle className='w-4 h-4 text-danger-600' />
                  <span className='text-sm text-danger-700 dark:text-danger-300'>
                    {error}
                  </span>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant='light' onPress={handleClose}>
              Cancel
            </Button>
            <Button
              color='primary'
              onPress={handleProceedToMigration}
              isDisabled={
                !selectedWeek || incompleteTasks.length === 0 || isLoadingTasks
              }
              startContent={<ArrowRight className='w-4 h-4' />}
            >
              Proceed to Migration
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Migration Dialog */}
      {showMigrationDialog && (
        <TaskMigrationDialog
          isOpen={showMigrationDialog}
          onClose={() => setShowMigrationDialog(false)}
          incompleteTasks={incompleteTasks}
          currentWeek={currentWeek}
          weekStartDay={weekStartDay}
          onMigrateTasks={handleMigrationComplete}
          onDismissWeek={() => {
            // For manual migration, we don't need to dismiss weeks
            setShowMigrationDialog(false);
          }}
          onDisableMigration={() => {
            // For manual migration, we don't need to disable migration
            setShowMigrationDialog(false);
          }}
        />
      )}
    </>
  );
}
