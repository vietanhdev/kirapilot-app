import { useState, useEffect } from 'react';
import {
  PeriodicTaskTemplate,
  Priority,
  RecurrenceType,
  UpdatePeriodicTaskRequest,
} from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { PeriodicTaskService } from '../../services/database/repositories/PeriodicTaskService';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Tooltip,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import {
  Repeat,
  Play,
  Pause,
  Edit3,
  Trash2,
  MoreVertical,
  Calendar,
  Clock,
  Hash,
  Target,
  AlertCircle,
  CheckCircle2,
  Flame,
  Users,
  RefreshCw,
} from 'lucide-react';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import {
  ErrorDisplay,
  ErrorType,
  categorizeError,
  isErrorRecoverable as checkIfErrorRecoverable,
} from '../common/ErrorDisplay';
import { errorHandlingService } from '../../services/errorHandling/ErrorHandlingService';

interface PeriodicTaskListProps {
  onEditTemplate?: (template: PeriodicTaskTemplate) => void;
  onTemplateUpdated?: (template: PeriodicTaskTemplate) => void;
  onTemplateDeleted?: (templateId: string) => void;
  className?: string;
}

interface TemplateWithInstanceCount extends PeriodicTaskTemplate {
  instanceCount: number;
}

export function PeriodicTaskList({
  onEditTemplate,
  onTemplateUpdated,
  onTemplateDeleted,
  className = '',
}: PeriodicTaskListProps) {
  const { t: _ } = useTranslation(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const periodicTaskService = new PeriodicTaskService();

  const [templates, setTemplates] = useState<TemplateWithInstanceCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(ErrorType.UNKNOWN);
  const [isErrorRecoverable, setIsErrorRecoverable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    templateId: string;
    templateTitle: string;
    instanceCount: number;
  }>({
    isOpen: false,
    templateId: '',
    templateTitle: '',
    instanceCount: 0,
  });

  // Loading states for individual actions
  const [actionLoading, setActionLoading] = useState<{
    [templateId: string]: 'toggle' | 'delete' | null;
  }>({});

  const loadTemplates = async () => {
    try {
      setError(null);
      setErrorType(ErrorType.UNKNOWN);
      setIsErrorRecoverable(false);

      const allTemplates = await errorHandlingService.executeDatabaseOperation(
        () => periodicTaskService.findAllTemplates(),
        'get_all_periodic_task_templates',
        { component: 'PeriodicTaskList', operation: 'load_templates' }
      );

      // Load instance counts for each template
      const templatesWithCounts = await Promise.all(
        allTemplates.map(async template => {
          try {
            const instanceCount =
              await periodicTaskService.countTemplateInstances(template.id);
            return {
              ...template,
              instanceCount,
            };
          } catch (error) {
            console.warn(
              `Failed to load instance count for template ${template.id}:`,
              error
            );
            return {
              ...template,
              instanceCount: 0,
            };
          }
        })
      );

      setTemplates(templatesWithCounts);
    } catch (error) {
      console.error('Failed to load periodic task templates:', error);

      const enhancedError = errorHandlingService.processError(error as Error, {
        operation: 'get_all_periodic_task_templates',
        component: 'PeriodicTaskList',
      });

      const userMessage = errorHandlingService.getUserMessage(enhancedError);
      const errorCategory = categorizeError(enhancedError);
      const recoverable = checkIfErrorRecoverable(enhancedError);

      setError(userMessage);
      setErrorType(errorCategory);
      setIsErrorRecoverable(recoverable);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Listen for periodic tasks updates
  useEffect(() => {
    const handlePeriodicTasksUpdate = () => {
      loadTemplates();
    };

    window.addEventListener(
      'periodic-tasks-updated',
      handlePeriodicTasksUpdate
    );
    return () => {
      window.removeEventListener(
        'periodic-tasks-updated',
        handlePeriodicTasksUpdate
      );
    };
  }, []);

  const handleRetry = async () => {
    if (retryCount >= 3) {
      setError('Maximum retry attempts reached. Please try again later.');
      setIsErrorRecoverable(false);
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    await loadTemplates();
  };

  const handleDismissError = () => {
    setError(null);
    setErrorType(ErrorType.UNKNOWN);
    setIsErrorRecoverable(false);
    setRetryCount(0);
  };

  const handleToggleStatus = async (template: TemplateWithInstanceCount) => {
    setActionLoading(prev => ({ ...prev, [template.id]: 'toggle' }));

    try {
      const updateRequest: UpdatePeriodicTaskRequest = {
        isActive: !template.isActive,
      };

      const updatedTemplate =
        await errorHandlingService.executeDatabaseOperation(
          () => periodicTaskService.updateTemplate(template.id, updateRequest),
          'update_periodic_task_template',
          { component: 'PeriodicTaskList', operation: 'toggle_status' }
        );

      // Update local state
      setTemplates(prev =>
        prev.map(t =>
          t.id === template.id
            ? {
                ...t,
                isActive: updatedTemplate.isActive,
                updatedAt: updatedTemplate.updatedAt,
              }
            : t
        )
      );

      // Notify parent component
      if (onTemplateUpdated) {
        onTemplateUpdated(updatedTemplate);
      }

      // Notify planner to refresh tasks (instances may have been removed)
      window.dispatchEvent(new CustomEvent('periodic-tasks-updated'));
    } catch (error) {
      console.error('Failed to toggle template status:', error);
      // You could show a toast notification here
    } finally {
      setActionLoading(prev => ({ ...prev, [template.id]: null }));
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setActionLoading(prev => ({ ...prev, [templateId]: 'delete' }));

    try {
      await errorHandlingService.executeDatabaseOperation(
        () => periodicTaskService.deleteTemplate(templateId),
        'delete_periodic_task_template',
        { component: 'PeriodicTaskList', operation: 'delete_template' }
      );

      // Update local state
      setTemplates(prev => prev.filter(t => t.id !== templateId));

      // Notify parent component
      if (onTemplateDeleted) {
        onTemplateDeleted(templateId);
      }

      // Notify planner to refresh tasks (all instances have been removed)
      window.dispatchEvent(new CustomEvent('periodic-tasks-updated'));
    } catch (error) {
      console.error('Failed to delete template:', error);
      // You could show a toast notification here
    } finally {
      setActionLoading(prev => ({ ...prev, [templateId]: null }));
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const openDeleteConfirmation = (template: TemplateWithInstanceCount) => {
    setConfirmDialog({
      isOpen: true,
      templateId: template.id,
      templateTitle: template.title,
      instanceCount: template.instanceCount,
    });
  };

  const closeDeleteConfirmation = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return <CheckCircle2 className='w-4 h-4 text-success' />;
      case Priority.MEDIUM:
        return <Target className='w-4 h-4 text-primary' />;
      case Priority.HIGH:
        return <AlertCircle className='w-4 h-4 text-warning' />;
      case Priority.URGENT:
        return <Flame className='w-4 h-4 text-danger' />;
      default:
        return <Target className='w-4 h-4 text-primary' />;
    }
  };

  // Removed getPriorityColor function as it's not currently used

  const getRecurrenceLabel = (template: PeriodicTaskTemplate): string => {
    switch (template.recurrenceType) {
      case RecurrenceType.DAILY:
        return template.recurrenceInterval === 1
          ? 'Daily'
          : `Every ${template.recurrenceInterval} days`;
      case RecurrenceType.WEEKLY:
        return template.recurrenceInterval === 1
          ? 'Weekly'
          : `Every ${template.recurrenceInterval} weeks`;
      case RecurrenceType.BIWEEKLY:
        return 'Biweekly';
      case RecurrenceType.EVERY_THREE_WEEKS:
        return 'Every 3 weeks';
      case RecurrenceType.MONTHLY:
        return template.recurrenceInterval === 1
          ? 'Monthly'
          : `Every ${template.recurrenceInterval} months`;
      case RecurrenceType.CUSTOM:
        return `Every ${template.recurrenceInterval} ${template.recurrenceUnit}`;
      default:
        return 'Unknown';
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className='flex flex-col items-center gap-3'>
          <Spinner size='lg' color='primary' />
          <span className='text-sm text-foreground-500'>
            Loading periodic tasks...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <ErrorDisplay
          error={error}
          type={errorType}
          recoverable={isErrorRecoverable && retryCount < 3}
          onRetry={isErrorRecoverable ? handleRetry : undefined}
          onDismiss={handleDismissError}
          size='lg'
          variant='modal'
        />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      >
        <div className='flex flex-col items-center gap-4 max-w-md'>
          <div className='p-4 rounded-full bg-content2'>
            <Repeat className='w-8 h-8 text-foreground-400' />
          </div>
          <div className='space-y-2'>
            <h3 className='text-lg font-semibold text-foreground'>
              No Periodic Tasks
            </h3>
            <p className='text-sm text-foreground-500'>
              Create your first periodic task template to automatically generate
              recurring tasks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Repeat className='w-5 h-5 text-foreground-500' />
          <h2 className='text-lg font-semibold text-foreground'>
            Periodic Tasks
          </h2>
          <Chip size='sm' variant='flat' color='primary'>
            {templates.length}
          </Chip>
        </div>
        <Button
          size='sm'
          variant='flat'
          color='primary'
          startContent={<RefreshCw className='w-4 h-4' />}
          onPress={loadTemplates}
          isLoading={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Template List */}
      <div className='grid gap-3'>
        {templates.map(template => (
          <Card
            key={template.id}
            className='bg-content1 border border-divider hover:border-primary/50 transition-colors'
          >
            <CardBody className='p-4'>
              <div className='flex items-start justify-between gap-4'>
                {/* Main Content */}
                <div className='flex-1 space-y-3'>
                  {/* Title and Status */}
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h3 className='font-semibold text-foreground line-clamp-1'>
                          {template.title}
                        </h3>
                        <div className='flex items-center gap-1'>
                          {template.isActive ? (
                            <Chip
                              size='sm'
                              color='success'
                              variant='flat'
                              startContent={<Play className='w-3 h-3' />}
                            >
                              Active
                            </Chip>
                          ) : (
                            <Chip
                              size='sm'
                              color='warning'
                              variant='flat'
                              startContent={<Pause className='w-3 h-3' />}
                            >
                              Paused
                            </Chip>
                          )}
                        </div>
                      </div>
                      {template.description && (
                        <p className='text-sm text-foreground-600 line-clamp-2'>
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className='flex flex-wrap items-center gap-4 text-sm text-foreground-500'>
                    {/* Priority */}
                    <div className='flex items-center gap-1'>
                      {getPriorityIcon(template.priority)}
                      <span className='capitalize'>
                        {Priority[template.priority].toLowerCase()}
                      </span>
                    </div>

                    {/* Recurrence Pattern */}
                    <div className='flex items-center gap-1'>
                      <Repeat className='w-4 h-4' />
                      <span>{getRecurrenceLabel(template)}</span>
                    </div>

                    {/* Time Estimate */}
                    {template.timeEstimate > 0 && (
                      <div className='flex items-center gap-1'>
                        <Clock className='w-4 h-4' />
                        <span>{template.timeEstimate}m</span>
                      </div>
                    )}

                    {/* Instance Count */}
                    <div className='flex items-center gap-1'>
                      <Users className='w-4 h-4' />
                      <span>{template.instanceCount} instances</span>
                    </div>

                    {/* Next Generation */}
                    <div className='flex items-center gap-1'>
                      <Calendar className='w-4 h-4' />
                      <span>
                        Next: {formatDate(template.nextGenerationDate)}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className='flex flex-wrap gap-1'>
                      {template.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          size='sm'
                          variant='flat'
                          color='default'
                          startContent={<Hash className='w-3 h-3' />}
                        >
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className='flex items-center gap-2'>
                  {/* Quick Toggle */}
                  <Tooltip
                    content={
                      template.isActive ? 'Pause template' : 'Resume template'
                    }
                    placement='top'
                  >
                    <Button
                      size='sm'
                      variant='flat'
                      color={template.isActive ? 'warning' : 'success'}
                      isIconOnly
                      onPress={() => handleToggleStatus(template)}
                      isLoading={actionLoading[template.id] === 'toggle'}
                      isDisabled={!!actionLoading[template.id]}
                    >
                      {template.isActive ? (
                        <Pause className='w-4 h-4' />
                      ) : (
                        <Play className='w-4 h-4' />
                      )}
                    </Button>
                  </Tooltip>

                  {/* More Actions */}
                  <Dropdown placement='bottom-end'>
                    <DropdownTrigger>
                      <Button
                        size='sm'
                        variant='flat'
                        color='default'
                        isIconOnly
                        isDisabled={!!actionLoading[template.id]}
                      >
                        <MoreVertical className='w-4 h-4' />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label='Template actions'>
                      <DropdownItem
                        key='edit'
                        startContent={<Edit3 className='w-4 h-4' />}
                        onPress={() => onEditTemplate?.(template)}
                      >
                        Edit Template
                      </DropdownItem>
                      <DropdownItem
                        key='delete'
                        className='text-danger'
                        color='danger'
                        startContent={<Trash2 className='w-4 h-4' />}
                        onPress={() => openDeleteConfirmation(template)}
                      >
                        Delete Template
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={() => handleDeleteTemplate(confirmDialog.templateId)}
        title='Delete Periodic Task Template'
        message={
          confirmDialog.instanceCount > 0
            ? `Are you sure you want to delete "${confirmDialog.templateTitle}"? This will permanently delete the template and remove all ${confirmDialog.instanceCount} generated task instances from your planner.`
            : `Are you sure you want to delete "${confirmDialog.templateTitle}"? This action cannot be undone.`
        }
        confirmText='Delete Template'
        cancelText='Cancel'
        variant='danger'
        isLoading={actionLoading[confirmDialog.templateId] === 'delete'}
      />
    </div>
  );
}
