import React, { useState, useEffect } from 'react';
import {
  PeriodicTaskTemplate,
  Priority,
  RecurrenceType,
  CreatePeriodicTaskRequest,
  UpdatePeriodicTaskRequest,
} from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useTaskList } from '../../contexts/TaskListContext';
import { useSettings } from '../../contexts/SettingsContext';
import { PeriodicTaskService } from '../../services/database/repositories/PeriodicTaskService';
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
  Switch,
  Card,
  CardBody,
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
  Edit3,
  PlusCircle,
  Repeat,
  Play,
  Pause,
} from 'lucide-react';
import { MinimalRichTextEditor } from '../common/MinimalRichTextEditor';
import { DatePicker } from '../common/DatePicker';
import { RecurrencePatternSelector } from './RecurrencePatternSelector';
import {
  ErrorDisplay,
  ErrorType,
  categorizeError,
  isErrorRecoverable as checkIfErrorRecoverable,
} from '../common/ErrorDisplay';
import { errorHandlingService } from '../../services/errorHandling/ErrorHandlingService';

interface PeriodicTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTemplate?: (template: PeriodicTaskTemplate) => Promise<void>;
  onUpdateTemplate?: (updatedTemplate: PeriodicTaskTemplate) => Promise<void>;
  template?: PeriodicTaskTemplate | null;
  className?: string;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  timeEstimate: number;
  tags: string[];
  taskListId: string;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceUnit?: 'days' | 'weeks' | 'months';
  startDate: Date;
  isActive: boolean;
}

export function PeriodicTaskModal({
  isOpen,
  onClose,
  onCreateTemplate,
  onUpdateTemplate,
  template,
}: PeriodicTaskModalProps) {
  const { t } = useTranslation();
  const { preferences } = useSettings();
  const isEditMode = !!template;
  const periodicTaskService = new PeriodicTaskService();

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    timeEstimate: 60,
    tags: [],
    taskListId: 'default-task-list',
    recurrenceType: RecurrenceType.WEEKLY,
    recurrenceInterval: 1,
    recurrenceUnit: undefined,
    startDate: new Date(),
    isActive: true,
  });

  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(ErrorType.UNKNOWN);
  const [isErrorRecoverable, setIsErrorRecoverable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Get task list context for current selection
  const {
    getSelectedTaskListId,
    isAllSelected,
    taskLists,
    error: taskListError,
  } = useTaskList();

  // Initialize form data when modal opens or template changes
  useEffect(() => {
    if (isOpen) {
      // Clear any previous submit errors
      setSubmitError(null);
      setErrorType(ErrorType.UNKNOWN);
      setIsErrorRecoverable(false);
      setRetryCount(0);

      if (isEditMode && template) {
        setFormData({
          title: template.title,
          description: template.description || '',
          priority: template.priority,
          timeEstimate: template.timeEstimate || 60,
          tags: template.tags || [],
          taskListId: template.taskListId,
          recurrenceType: template.recurrenceType,
          recurrenceInterval: template.recurrenceInterval || 1,
          recurrenceUnit: template.recurrenceUnit,
          startDate: template.startDate,
          isActive: template.isActive,
        });
      } else {
        // Creating new template - determine default task list
        let defaultTaskListId: string;
        if (isAllSelected()) {
          const defaultList = taskLists.find(list => list.isDefault);
          if (defaultList) {
            defaultTaskListId = defaultList.id;
          } else if (taskLists.length > 0) {
            defaultTaskListId = taskLists[0].id;
          } else {
            defaultTaskListId = '';
          }
        } else {
          const selectedId = getSelectedTaskListId();
          if (selectedId) {
            defaultTaskListId = selectedId;
          } else if (taskLists.length > 0) {
            const defaultList =
              taskLists.find(list => list.isDefault) || taskLists[0];
            defaultTaskListId = defaultList.id;
          } else {
            defaultTaskListId = '';
          }
        }

        setFormData({
          title: '',
          description: '',
          priority: Priority.MEDIUM,
          timeEstimate: 60,
          tags: [],
          taskListId: defaultTaskListId,
          recurrenceType: RecurrenceType.WEEKLY,
          recurrenceInterval: 1,
          recurrenceUnit: undefined,
          startDate: new Date(),
          isActive: true,
        });
      }
      setNewTag('');
    }
  }, [
    isOpen,
    template,
    isEditMode,
    isAllSelected,
    getSelectedTaskListId,
    taskLists,
  ]);

  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Task title is required';
    }

    if (!formData.taskListId || formData.taskListId.trim() === '') {
      return 'Please select a task list';
    }

    // Validate that the selected task list exists
    const selectedTaskList = taskLists.find(
      list => list.id === formData.taskListId
    );
    if (!selectedTaskList) {
      return 'The selected task list is no longer available. Please select a different task list.';
    }

    // Validate start date is not in the past (allow today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(formData.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return 'Start date cannot be in the past';
    }

    // Validate custom recurrence pattern
    if (formData.recurrenceType === RecurrenceType.CUSTOM) {
      if (!formData.recurrenceUnit) {
        return 'Please select a unit for custom recurrence';
      }
      if (formData.recurrenceInterval < 1) {
        return 'Recurrence interval must be at least 1';
      }
      if (formData.recurrenceInterval > 365) {
        return 'Recurrence interval cannot exceed 365';
      }
    }

    // Validate time estimate
    if (formData.timeEstimate < 0) {
      return 'Time estimate cannot be negative';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      setErrorType(ErrorType.VALIDATION);
      setIsErrorRecoverable(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setErrorType(ErrorType.UNKNOWN);
    setIsErrorRecoverable(false);

    const executeOperation = async () => {
      if (isEditMode && onUpdateTemplate && template) {
        // Edit existing template
        const updateRequest: UpdatePeriodicTaskRequest = {
          title: formData.title.trim(),
          description: formData.description || '',
          priority: formData.priority,
          timeEstimate: formData.timeEstimate,
          tags: formData.tags,
          taskListId: formData.taskListId,
          recurrenceType: formData.recurrenceType,
          recurrenceInterval: formData.recurrenceInterval,
          recurrenceUnit: formData.recurrenceUnit,
          isActive: formData.isActive,
        };

        const updatedTemplate =
          await errorHandlingService.executeDatabaseOperation(
            () =>
              periodicTaskService.updateTemplate(template.id, updateRequest),
            'update_periodic_task_template',
            { component: 'PeriodicTaskModal', operation: 'update_template' }
          );

        await onUpdateTemplate(updatedTemplate);
      } else if (onCreateTemplate) {
        // Create new template
        const createRequest: CreatePeriodicTaskRequest = {
          title: formData.title.trim(),
          description: formData.description || '',
          priority: formData.priority,
          timeEstimate: formData.timeEstimate,
          tags: formData.tags,
          taskListId: formData.taskListId,
          recurrenceType: formData.recurrenceType,
          recurrenceInterval: formData.recurrenceInterval,
          recurrenceUnit: formData.recurrenceUnit,
          startDate: formData.startDate,
        };

        const newTemplate = await errorHandlingService.executeDatabaseOperation(
          () => periodicTaskService.createTemplate(createRequest),
          'create_periodic_task_template',
          { component: 'PeriodicTaskModal', operation: 'create_template' }
        );

        // Generate instances for the next 30 days if the template is active
        if (newTemplate.isActive) {
          try {
            const result =
              await periodicTaskService.generateAdvancedInstances(30);
            console.log(
              `Generated ${result.totalGenerated} instances for periodic task: ${newTemplate.title}`
            );
          } catch (instanceError) {
            console.warn(
              'Failed to generate instances for periodic task:',
              instanceError
            );
            // Don't fail the entire creation process if instance generation fails
          }
        }

        await onCreateTemplate(newTemplate);
      }
    };

    try {
      await executeOperation();
      handleClose();
    } catch (error) {
      console.error('Failed to save periodic task template:', error);

      // Use enhanced error handling service
      const enhancedError = errorHandlingService.processError(error as Error, {
        operation: isEditMode
          ? 'update_periodic_task_template'
          : 'create_periodic_task_template',
        component: 'PeriodicTaskModal',
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

  const handleRecurrenceChange = (
    type: RecurrenceType,
    interval?: number,
    unit?: 'days' | 'weeks' | 'months'
  ) => {
    setFormData(prev => ({
      ...prev,
      recurrenceType: type,
      recurrenceInterval: interval || 1,
      recurrenceUnit: unit,
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

  const selectedPriority = priorityOptions.find(
    p => p.key === formData.priority
  );

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
                  ? t('periodicTask.modal.title.edit')
                  : t('periodicTask.modal.title.create')}
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
                    label={t('periodicTask.modal.label.title')}
                    placeholder={t('periodicTask.modal.placeholder.title')}
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
                    label={t('periodicTask.modal.label.taskList')}
                    placeholder={t('periodicTask.modal.placeholder.taskList')}
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
                    {t('periodicTask.modal.label.description')}
                  </label>
                  <div className='h-32'>
                    <MinimalRichTextEditor
                      content={formData.description}
                      onChange={content =>
                        setFormData(prev => ({ ...prev, description: content }))
                      }
                      placeholder={t(
                        'periodicTask.modal.placeholder.description'
                      )}
                      className='h-full'
                    />
                  </div>
                </div>
              </div>
              {/* Task Properties Section */}
              <div className='grid gap-3'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div className='flex flex-col gap-1'>
                    <Select
                      label={t('periodicTask.modal.label.priority')}
                      placeholder={t('periodicTask.modal.placeholder.priority')}
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
                    <Input
                      type='number'
                      label={t('periodicTask.modal.label.timeEstimate')}
                      placeholder={t(
                        'periodicTask.modal.placeholder.timeEstimate'
                      )}
                      value={formData.timeEstimate.toString()}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          timeEstimate: parseInt(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      step={1}
                      size='sm'
                      classNames={{
                        input: 'text-foreground',
                        inputWrapper:
                          'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        label: 'text-foreground-600 font-medium',
                      }}
                    />
                  </div>
                </div>

                <div className='flex flex-col gap-1'>
                  <DatePicker
                    label={t('periodicTask.modal.label.startDate')}
                    value={formData.startDate}
                    onChange={date =>
                      setFormData(prev => ({
                        ...prev,
                        startDate: date || new Date(),
                      }))
                    }
                    dateFormat={preferences.dateFormat}
                    size='sm'
                    startContent={<Calendar className='w-4 h-4' />}
                    isRequired
                  />
                </div>
              </div>

              {/* Recurrence Pattern Section */}
              <div className='grid gap-3'>
                <div className='flex items-center gap-2'>
                  <Repeat className='w-4 h-4 text-foreground-500' />
                  <span className='text-sm font-medium text-foreground-600'>
                    Recurrence Pattern
                  </span>
                </div>
                <RecurrencePatternSelector
                  recurrenceType={formData.recurrenceType}
                  recurrenceInterval={formData.recurrenceInterval}
                  recurrenceUnit={formData.recurrenceUnit}
                  startDate={formData.startDate}
                  onChange={handleRecurrenceChange}
                  size='sm'
                />
              </div>

              {/* Template Status Section */}
              {isEditMode && (
                <Card className='bg-content1 border border-divider'>
                  <CardBody className='p-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex flex-col gap-1'>
                        <div className='flex items-center gap-2'>
                          {formData.isActive ? (
                            <Play className='w-4 h-4 text-success' />
                          ) : (
                            <Pause className='w-4 h-4 text-warning' />
                          )}
                          <span className='text-sm font-medium text-foreground-600'>
                            {t('periodicTask.modal.label.status')}
                          </span>
                        </div>
                        <span className='text-xs text-foreground-500'>
                          {formData.isActive
                            ? t('periodicTask.modal.status.active.description')
                            : t('periodicTask.modal.status.paused.description')}
                        </span>
                      </div>
                      <Switch
                        isSelected={formData.isActive}
                        onValueChange={isActive =>
                          setFormData(prev => ({ ...prev, isActive }))
                        }
                        size='sm'
                        color='success'
                      />
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Tags Section */}
              <div className='grid gap-3'>
                <div className='flex flex-col gap-1'>
                  <div className='flex gap-2'>
                    <Input
                      placeholder={t('periodicTask.modal.placeholder.tag')}
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
                ? t('periodicTask.modal.button.saveChanges')
                : t('periodicTask.modal.button.createTemplate')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
