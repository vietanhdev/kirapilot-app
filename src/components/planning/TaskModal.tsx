import React, { useState, useEffect } from 'react';
import { Task, Priority, TaskStatus, TimePreset } from '../../types';
import { generateId } from '../../utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useTaskList } from '../../contexts/TaskListContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
} from '@heroui/react';
import {
  Calendar,
  Hash,
  Plus,
  Save,
  Target,
  AlertCircle,
  CheckCircle2,
  Flame,
  Timer,
  Edit3,
  PlusCircle,
} from 'lucide-react';
import { MinimalRichTextEditor } from '../common/MinimalRichTextEditor';
import { DatePicker } from '../common/DatePicker';
import {
  ErrorDisplay,
  ErrorType,
  categorizeError,
  isErrorRecoverable as checkIfErrorRecoverable,
} from '../common/ErrorDisplay';
import { errorHandlingService } from '../../services/errorHandling/ErrorHandlingService';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask?: (task: Task) => Promise<void>;
  onUpdateTask?: (updatedTask: Partial<Task>) => Promise<void>;
  task?: Task | null; // If provided, we're editing; if null/undefined, we're creating
  defaultDate?: Date;
  className?: string;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  timePreset: TimePreset;
  timeEstimate: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags: string[];
  taskListId: string;
}

export function TaskModal({
  isOpen,
  onClose,
  onCreateTask,
  onUpdateTask,
  task,
  defaultDate,
}: TaskModalProps) {
  const { t } = useTranslation();
  const { preferences } = useSettings();
  const isEditMode = !!task;
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    timePreset: TimePreset.SIXTY_MIN,
    timeEstimate: 60,
    dueDate: undefined, // Never set a default due date
    scheduledDate: defaultDate,
    tags: [],
    taskListId: 'default-task-list',
  });
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(ErrorType.UNKNOWN);
  const [isErrorRecoverable, setIsErrorRecoverable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Helper function to determine time preset from time estimate
  const getTimePresetFromEstimate = (timeEstimate: number): TimePreset => {
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
  };

  // Get task list context for current selection
  const {
    getSelectedTaskListId,
    isAllSelected,
    taskLists,
    moveTaskToList,
    error: taskListError,
  } = useTaskList();

  // Initialize form data when modal opens or task changes
  useEffect(() => {
    if (isOpen) {
      // Clear any previous submit errors
      setSubmitError(null);
      setErrorType(ErrorType.UNKNOWN);
      setIsErrorRecoverable(false);
      setRetryCount(0);
      if (isEditMode && task) {
        const timeEstimate = task.timeEstimate || 60;
        setFormData({
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          timePreset:
            task.timePreset || getTimePresetFromEstimate(timeEstimate),
          timeEstimate: timeEstimate,
          dueDate: task.dueDate,
          scheduledDate: task.scheduledDate,
          tags: task.tags || [],
          taskListId: task.taskListId,
        });
      } else {
        // Creating new task - determine default task list
        let defaultTaskListId: string;
        if (isAllSelected()) {
          // When "All" is selected, use the default task list
          const defaultList = taskLists.find(list => list.isDefault);
          if (defaultList) {
            defaultTaskListId = defaultList.id;
          } else if (taskLists.length > 0) {
            // Fallback to first available task list
            defaultTaskListId = taskLists[0].id;
          } else {
            // No task lists available - this will cause an error, but we'll handle it in submit
            defaultTaskListId = '';
          }
        } else {
          // Use the currently selected task list
          const selectedId = getSelectedTaskListId();
          if (selectedId) {
            defaultTaskListId = selectedId;
          } else if (taskLists.length > 0) {
            // Fallback to first available task list
            const defaultList =
              taskLists.find(list => list.isDefault) || taskLists[0];
            defaultTaskListId = defaultList.id;
          } else {
            // No task lists available
            defaultTaskListId = '';
          }
        }

        setFormData({
          title: '',
          description: '',
          priority: Priority.MEDIUM,
          timePreset: TimePreset.SIXTY_MIN,
          timeEstimate: 60,
          dueDate: undefined, // Always start with no due date - user must set it explicitly
          scheduledDate: defaultDate,
          tags: [],
          taskListId: defaultTaskListId,
        });
      }
      setNewTag('');
    }
  }, [
    isOpen,
    task,
    isEditMode,
    defaultDate,
    isAllSelected,
    getSelectedTaskListId,
    taskLists,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      return;
    }

    // Validate that a task list is selected
    if (!formData.taskListId || formData.taskListId.trim() === '') {
      setSubmitError('Please select a task list');
      setErrorType(ErrorType.VALIDATION);
      setIsErrorRecoverable(false);
      return;
    }

    // Validate that the selected task list exists
    const selectedTaskList = taskLists.find(
      list => list.id === formData.taskListId
    );
    if (!selectedTaskList) {
      setSubmitError(
        'The selected task list is no longer available. Please select a different task list.'
      );
      setErrorType(ErrorType.VALIDATION);
      setIsErrorRecoverable(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setErrorType(ErrorType.UNKNOWN);
    setIsErrorRecoverable(false);

    const executeOperation = async () => {
      if (isEditMode && onUpdateTask && task) {
        // Check if task list has changed and handle task movement
        const taskListChanged = task.taskListId !== formData.taskListId;

        if (taskListChanged) {
          // Validate the target task list exists
          const targetTaskList = taskLists.find(
            tl => tl.id === formData.taskListId
          );
          if (!targetTaskList) {
            throw new Error(
              `Target task list '${formData.taskListId}' not found in available task lists: ${taskLists.map(tl => tl.id).join(', ')}`
            );
          }

          // Move task to new list first using enhanced error handling
          await errorHandlingService.executeDatabaseOperation(
            () => moveTaskToList(task.id, formData.taskListId),
            'move_task_to_list',
            { component: 'TaskModal', operation: 'update_task' }
          );
        }

        // Edit existing task - always include taskListId for local state consistency
        const updatedFields: Partial<Task> = {
          title: formData.title.trim(),
          description: formData.description || '',
          priority: formData.priority,
          timePreset: formData.timePreset,
          timeEstimate: formData.timeEstimate,
          dueDate: formData.dueDate,
          scheduledDate: formData.scheduledDate,
          tags: formData.tags,
          taskListId: formData.taskListId, // Always include for local state consistency
          updatedAt: new Date(),
        };

        // Wrap onUpdateTask call with error handling since it now re-throws database errors
        await errorHandlingService.executeDatabaseOperation(
          () => onUpdateTask(updatedFields),
          'update_task',
          { component: 'TaskModal', operation: 'update_task_fields' }
        );
      } else if (onCreateTask) {
        // Create new task with selected task list
        const newTask: Task = {
          id: generateId(),
          title: formData.title.trim(),
          description: formData.description || '',
          status: TaskStatus.PENDING,
          priority: formData.priority,
          order: 0,
          timePreset: formData.timePreset,
          timeEstimate: formData.timeEstimate,
          actualTime: 0,
          dependencies: [],
          subtasks: [],
          dueDate: formData.dueDate,
          scheduledDate: formData.scheduledDate,
          taskListId: formData.taskListId,
          tags: formData.tags,
          completedAt: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await errorHandlingService.executeDatabaseOperation(
          () => onCreateTask(newTask),
          'create_task',
          { component: 'TaskModal', operation: 'create_task' }
        );
      }
    };

    try {
      await executeOperation();
      handleClose();
    } catch (error) {
      console.error('Failed to save task:', error);

      // Use enhanced error handling service
      const enhancedError = errorHandlingService.processError(error as Error, {
        operation: isEditMode ? 'update_task' : 'create_task',
        component: 'TaskModal',
      });

      const userMessage = errorHandlingService.getUserMessage(enhancedError);
      const errorCategory = categorizeError(enhancedError);
      const recoverable = checkIfErrorRecoverable(enhancedError);

      setSubmitError(userMessage);
      setErrorType(errorCategory);
      setIsErrorRecoverable(recoverable);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitting(false);
    onClose();
  };

  const handleRetry = async () => {
    if (retryCount >= 3) {
      setSubmitError('Maximum retry attempts reached. Please try again later.');
      setIsErrorRecoverable(false);
      return;
    }

    setRetryCount(prev => prev + 1);
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleDismissError = () => {
    setSubmitError(null);
    setErrorType(ErrorType.UNKNOWN);
    setIsErrorRecoverable(false);
    setRetryCount(0);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const priorityOptions = [
    {
      key: Priority.LOW,
      label: t('priority.low'),
      icon: <CheckCircle2 className='w-4 h-4' />,
    },
    {
      key: Priority.MEDIUM,
      label: t('priority.medium'),
      icon: <Target className='w-4 h-4' />,
    },
    {
      key: Priority.HIGH,
      label: t('priority.high'),
      icon: <AlertCircle className='w-4 h-4' />,
    },
    {
      key: Priority.URGENT,
      label: t('priority.urgent'),
      icon: <Flame className='w-4 h-4' />,
    },
  ];

  const timePresetOptions = [
    {
      key: TimePreset.FIFTEEN_MIN,
      label: t('timePreset.fifteenMin'),
      value: 15,
    },
    {
      key: TimePreset.THIRTY_MIN,
      label: t('timePreset.thirtyMin'),
      value: 30,
    },
    {
      key: TimePreset.SIXTY_MIN,
      label: t('timePreset.sixtyMin'),
      value: 60,
    },
    {
      key: TimePreset.CUSTOM,
      label: t('timePreset.custom'),
      value: -1,
    },
    {
      key: TimePreset.NOT_APPLICABLE,
      label: t('timePreset.notApplicable'),
      value: 0,
    },
  ];

  const selectedPriority = priorityOptions.find(
    p => p.key === formData.priority
  );

  const selectedTimePreset = timePresetOptions.find(
    p => p.key === formData.timePreset
  );

  const handleTimePresetChange = (preset: TimePreset) => {
    const presetOption = timePresetOptions.find(p => p.key === preset);
    if (presetOption) {
      setFormData(prev => ({
        ...prev,
        timePreset: preset,
        timeEstimate:
          presetOption.value >= 0 ? presetOption.value : prev.timeEstimate,
      }));
    }
  };

  // Prevent drag and drop events from propagating when modal is open
  const handlePreventDragEvents = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePreventPointerEvents = (e: React.PointerEvent) => {
    // Stop pointer events that might trigger drag operations
    if (e.type === 'pointerdown' && e.button === 0) {
      e.stopPropagation();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size='lg'
      scrollBehavior='inside'
      backdrop='blur'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'max-h-[60vh] overflow-y-auto',
      }}
    >
      <ModalContent
        onDragStart={handlePreventDragEvents}
        onDragEnd={handlePreventDragEvents}
        onDragOver={handlePreventDragEvents}
        onDrop={handlePreventDragEvents}
        onPointerDown={handlePreventPointerEvents}
      >
        <form onSubmit={handleSubmit}>
          <ModalHeader className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              {isEditMode ? (
                <Edit3 className='w-4 h-4' />
              ) : (
                <PlusCircle className='w-4 h-4' />
              )}
              <h2 className='text-lg font-semibold'>
                {isEditMode
                  ? t('task.modal.title.edit')
                  : t('task.modal.title.create')}
              </h2>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className='grid grid-cols-1 gap-4'>
              {/* Basic Information Section */}
              <div className='grid gap-3'>
                <div className='flex flex-col gap-1'>
                  <Input
                    autoFocus
                    label={t('task.modal.label.title')}
                    placeholder={t('task.modal.placeholder.title')}
                    value={formData.title}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, title: e.target.value }))
                    }
                    isRequired
                    size='sm'
                    autoComplete='off'
                    autoCorrect='off'
                    autoCapitalize='off'
                    classNames={{
                      input: 'text-foreground',
                      inputWrapper:
                        'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                      label: 'text-foreground-600 font-medium',
                    }}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <Select
                    label={t('task.modal.label.taskList')}
                    placeholder={t('task.modal.placeholder.taskList')}
                    selectedKeys={[formData.taskListId]}
                    onSelectionChange={keys => {
                      const taskListId = Array.from(keys)[0] as string;
                      setFormData(prev => ({
                        ...prev,
                        taskListId,
                      }));
                    }}
                    size='sm'
                    classNames={{
                      trigger:
                        'bg-content2 border-divider data-[hover=true]:bg-content3',
                      value: 'text-foreground',
                      label: 'text-foreground-600 font-medium',
                    }}
                    isDisabled={taskLists.length === 0}
                    errorMessage={taskListError}
                    isInvalid={!!taskListError}
                  >
                    {taskLists.map(taskList => (
                      <SelectItem key={taskList.id}>{taskList.name}</SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Enhanced Error Display */}
                {submitError && (
                  <ErrorDisplay
                    error={submitError}
                    type={errorType}
                    recoverable={isErrorRecoverable && retryCount < 3}
                    onRetry={isErrorRecoverable ? handleRetry : undefined}
                    onDismiss={handleDismissError}
                    size='md'
                    variant='inline'
                  />
                )}

                <div className='flex flex-col gap-1'>
                  <label className='text-sm font-medium text-foreground-600'>
                    {t('task.modal.label.description')}
                  </label>
                  <div className='h-32'>
                    <MinimalRichTextEditor
                      content={formData.description}
                      onChange={content =>
                        setFormData(prev => ({ ...prev, description: content }))
                      }
                      placeholder={t('task.modal.placeholder.description')}
                      className='h-full'
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling Section */}
              <div className='grid gap-3'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div className='flex flex-col gap-1'>
                    <Select
                      label={t('task.modal.label.priority')}
                      placeholder={t('task.modal.placeholder.priority')}
                      selectedKeys={[formData.priority.toString()]}
                      onSelectionChange={keys => {
                        const priority = Array.from(keys)[0] as string;
                        setFormData(prev => ({
                          ...prev,
                          priority: parseInt(priority) as Priority,
                        }));
                      }}
                      size='sm'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                        label: 'text-foreground-600 font-medium',
                      }}
                      renderValue={() =>
                        selectedPriority && (
                          <div className='flex items-center gap-2'>
                            {selectedPriority.icon}
                            <span>{selectedPriority.label}</span>
                          </div>
                        )
                      }
                    >
                      {priorityOptions.map(priority => (
                        <SelectItem
                          key={priority.key}
                          startContent={priority.icon}
                        >
                          {priority.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className='flex flex-col gap-1'>
                    <Select
                      label={t('task.modal.label.timePreset')}
                      placeholder={t('task.modal.placeholder.timePreset')}
                      selectedKeys={[formData.timePreset.toString()]}
                      onSelectionChange={keys => {
                        const preset = Array.from(keys)[0] as string;
                        handleTimePresetChange(parseInt(preset) as TimePreset);
                      }}
                      size='sm'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                        label: 'text-foreground-600 font-medium',
                      }}
                      renderValue={() =>
                        selectedTimePreset && (
                          <div className='flex items-center gap-2'>
                            <Timer className='w-4 h-4' />
                            <span>{selectedTimePreset.label}</span>
                          </div>
                        )
                      }
                    >
                      {timePresetOptions.map(preset => (
                        <SelectItem
                          key={preset.key}
                          startContent={<Timer className='w-4 h-4' />}
                        >
                          {preset.label}
                        </SelectItem>
                      ))}
                    </Select>

                    {/* Custom time input - only show when Custom is selected */}
                    {formData.timePreset === TimePreset.CUSTOM && (
                      <Input
                        type='number'
                        label={t('task.modal.label.customTime')}
                        placeholder={t('task.modal.placeholder.customTime')}
                        value={formData.timeEstimate.toString()}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            timeEstimate: parseInt(e.target.value) || 60,
                          }))
                        }
                        min={1}
                        step={1}
                        size='sm'
                        startContent={<Timer className='w-4 h-4' />}
                        classNames={{
                          input: 'text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                          label: 'text-foreground-600 font-medium',
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <DatePicker
                    label={t('task.modal.label.dueDate')}
                    value={formData.dueDate || null}
                    onChange={date =>
                      setFormData(prev => ({
                        ...prev,
                        dueDate: date || undefined,
                      }))
                    }
                    dateFormat={preferences.dateFormat}
                    size='sm'
                    startContent={<Calendar className='w-4 h-4' />}
                  />

                  <DatePicker
                    label={t('task.modal.label.scheduled')}
                    value={formData.scheduledDate || null}
                    onChange={date =>
                      setFormData(prev => ({
                        ...prev,
                        scheduledDate: date || undefined,
                      }))
                    }
                    dateFormat={preferences.dateFormat}
                    size='sm'
                    startContent={<Calendar className='w-4 h-4' />}
                  />
                </div>
              </div>

              {/* Tags Section */}
              <div className='grid gap-3'>
                <div className='flex flex-col gap-1'>
                  <div className='flex gap-2'>
                    <Input
                      placeholder={t('task.modal.placeholder.tag')}
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e =>
                        e.key === 'Enter' && (e.preventDefault(), addTag())
                      }
                      size='sm'
                      startContent={<Hash className='w-4 h-4' />}
                      className='flex-1'
                      classNames={{
                        input: 'text-foreground',
                        inputWrapper:
                          'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        label: 'text-foreground-600 font-medium',
                      }}
                    />
                    <Button
                      type='button'
                      onPress={addTag}
                      color='primary'
                      variant='flat'
                      size='sm'
                      isIconOnly
                      isDisabled={
                        !newTag.trim() || formData.tags.includes(newTag.trim())
                      }
                    >
                      <Plus className='w-4 h-4' />
                    </Button>
                  </div>

                  {formData.tags.length > 0 && (
                    <div className='flex flex-wrap gap-1 mt-2'>
                      {formData.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          onClose={() => removeTag(tag)}
                          variant='flat'
                          color='primary'
                          size='sm'
                        >
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              color='danger'
              variant='light'
              onPress={handleClose}
              size='sm'
              isDisabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type='submit'
              isDisabled={!formData.title.trim() || isSubmitting}
              isLoading={isSubmitting}
              size='sm'
              style={{
                backgroundColor: '#059669',
                color: '#ffffff',
                fontWeight: '500',
              }}
              className='shadow-md hover:opacity-90 transition-opacity'
              startContent={
                !isSubmitting &&
                (isEditMode ? (
                  <Save className='w-4 h-4' />
                ) : (
                  <Plus className='w-4 h-4' />
                ))
              }
            >
              {isEditMode
                ? t('task.modal.button.saveChanges')
                : t('task.modal.button.createTask')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
