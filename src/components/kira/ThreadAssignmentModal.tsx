import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  RadioGroup,
  Radio,
  Card,
  CardBody,
  Chip,
} from '@heroui/react';
import { Calendar, CheckSquare, Hash, Clock } from 'lucide-react';
import { ThreadAssignment } from '../../types/thread';
import { useTranslation } from '../../hooks/useTranslation';
import { useDatabase } from '../../hooks/useDatabase';
import { getTaskRepository } from '../../services/database/repositories';
import { Task } from '../../types';
import { DatePicker } from '../common/DatePicker';

interface ThreadAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (assignment: ThreadAssignment) => void;
  currentAssignment?: ThreadAssignment;
  threadTitle?: string;
}

export const ThreadAssignmentModal: React.FC<ThreadAssignmentModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  currentAssignment,
  threadTitle,
}) => {
  const { t } = useTranslation();
  const { isInitialized } = useDatabase();
  const [tasks, setTasks] = useState<Task[]>([]);

  const [assignmentType, setAssignmentType] = useState<
    'general' | 'task' | 'day'
  >('general');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Load tasks when component mounts
  useEffect(() => {
    const loadTasks = async () => {
      if (!isInitialized) {
        return;
      }

      try {
        const taskRepository = getTaskRepository();
        const allTasks = await taskRepository.findAll();
        setTasks(allTasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    };

    loadTasks();
  }, [isInitialized]);

  // Initialize form with current assignment
  useEffect(() => {
    if (currentAssignment) {
      setAssignmentType(currentAssignment.type);
      if (currentAssignment.type === 'task' && currentAssignment.taskId) {
        setSelectedTaskId(currentAssignment.taskId);
      }
      if (currentAssignment.type === 'day' && currentAssignment.date) {
        try {
          const date = new Date(currentAssignment.date);
          setSelectedDate(date);
        } catch (error) {
          console.error('Error parsing assignment date:', error);
          setSelectedDate(new Date());
        }
      }
    } else {
      // Reset to defaults when no current assignment
      setAssignmentType('general');
      setSelectedTaskId('');
      setSelectedDate(new Date());
    }
  }, [currentAssignment, isOpen]);

  const handleAssign = async () => {
    setIsLoading(true);

    try {
      let assignment: ThreadAssignment;

      switch (assignmentType) {
        case 'task':
          if (!selectedTaskId) {
            setIsLoading(false);
            return; // Should not happen due to validation
          }
          const selectedTask = tasks.find(
            (task: Task) => task.id === selectedTaskId
          );
          if (!selectedTask) {
            console.error('Selected task not found');
            setIsLoading(false);
            return;
          }
          assignment = {
            type: 'task',
            taskId: selectedTaskId,
            context: {
              taskTitle: selectedTask.title,
              taskDescription: selectedTask.description,
              taskPriority: selectedTask.priority,
              taskStatus: selectedTask.status,
            },
          };
          break;

        case 'day':
          assignment = {
            type: 'day',
            date: selectedDate,
            context: {
              dateString: selectedDate.toISOString(),
              formattedDate: selectedDate.toLocaleDateString(),
            },
          };
          break;

        default:
          assignment = {
            type: 'general',
          };
          break;
      }

      onAssign(assignment);
      onClose();
    } catch (error) {
      console.error('Failed to assign thread:', error);
      // TODO: Show error toast notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const getAssignmentIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare className='w-4 h-4' />;
      case 'day':
        return <Calendar className='w-4 h-4' />;
      default:
        return <Hash className='w-4 h-4' />;
    }
  };

  const isFormValid = () => {
    if (assignmentType === 'task') {
      return selectedTaskId !== '';
    }
    return true; // General and day assignments are always valid
  };

  // Get active tasks for selection
  const activeTasks = tasks.filter((task: Task) => task.status !== 'completed');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      size='lg'
      scrollBehavior='inside'
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <h2 className='text-xl font-semibold'>
            {t('kira.assignment.modal.title')}
          </h2>
          {threadTitle && (
            <p className='text-sm text-foreground-600 font-normal'>
              {t('kira.assignment.modal.subtitle', { title: threadTitle })}
            </p>
          )}
        </ModalHeader>

        <ModalBody className='gap-6'>
          {/* Assignment Type Selection */}
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-foreground'>
              {t('kira.assignment.type.title')}
            </h3>

            <RadioGroup
              value={assignmentType}
              onValueChange={value =>
                setAssignmentType(value as 'general' | 'task' | 'day')
              }
              className='gap-3'
            >
              <Card className='p-0'>
                <CardBody className='p-3'>
                  <Radio value='general' className='w-full'>
                    <div className='flex items-start gap-3 w-full'>
                      <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-default-100'>
                        <Hash className='w-4 h-4 text-default-600' />
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-medium text-foreground'>
                            {t('kira.assignment.general.title')}
                          </span>
                          <Chip size='sm' variant='flat' color='default'>
                            {t('kira.assignment.general.badge')}
                          </Chip>
                        </div>
                        <p className='text-sm text-foreground-600'>
                          {t('kira.assignment.general.description')}
                        </p>
                      </div>
                    </div>
                  </Radio>
                </CardBody>
              </Card>

              <Card className='p-0'>
                <CardBody className='p-3'>
                  <Radio value='task' className='w-full'>
                    <div className='flex items-start gap-3 w-full'>
                      <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100'>
                        <CheckSquare className='w-4 h-4 text-primary-600' />
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-medium text-foreground'>
                            {t('kira.assignment.task.title')}
                          </span>
                          <Chip size='sm' variant='flat' color='primary'>
                            {t('kira.assignment.task.badge')}
                          </Chip>
                        </div>
                        <p className='text-sm text-foreground-600'>
                          {t('kira.assignment.task.description')}
                        </p>
                      </div>
                    </div>
                  </Radio>
                </CardBody>
              </Card>

              <Card className='p-0'>
                <CardBody className='p-3'>
                  <Radio value='day' className='w-full'>
                    <div className='flex items-start gap-3 w-full'>
                      <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-100'>
                        <Calendar className='w-4 h-4 text-secondary-600' />
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-medium text-foreground'>
                            {t('kira.assignment.day.title')}
                          </span>
                          <Chip size='sm' variant='flat' color='secondary'>
                            {t('kira.assignment.day.badge')}
                          </Chip>
                        </div>
                        <p className='text-sm text-foreground-600'>
                          {t('kira.assignment.day.description')}
                        </p>
                      </div>
                    </div>
                  </Radio>
                </CardBody>
              </Card>
            </RadioGroup>
          </div>

          {/* Task Selection */}
          {assignmentType === 'task' && (
            <div className='space-y-3'>
              <h3 className='text-sm font-medium text-foreground'>
                {t('kira.assignment.task.selectTitle')}
              </h3>

              {activeTasks.length === 0 ? (
                <Card>
                  <CardBody className='text-center py-6'>
                    <CheckSquare className='w-8 h-8 mx-auto mb-2 text-foreground-400' />
                    <p className='text-foreground-600 mb-2'>
                      {t('kira.assignment.task.noTasks')}
                    </p>
                    <p className='text-sm text-foreground-500'>
                      {t('kira.assignment.task.createFirst')}
                    </p>
                  </CardBody>
                </Card>
              ) : (
                <Select
                  placeholder={t('kira.assignment.task.selectPlaceholder')}
                  selectedKeys={selectedTaskId ? [selectedTaskId] : []}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as string;
                    setSelectedTaskId(key || '');
                  }}
                  startContent={
                    <CheckSquare className='w-4 h-4 text-foreground-500' />
                  }
                >
                  {activeTasks.map((task: Task) => (
                    <SelectItem key={task.id}>
                      <div className='flex items-center gap-2'>
                        <span className='flex-1 truncate'>{task.title}</span>
                        <Chip size='sm' variant='flat' color='default'>
                          {task.priority}
                        </Chip>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              )}
            </div>
          )}

          {/* Date Selection */}
          {assignmentType === 'day' && (
            <div className='space-y-3'>
              <h3 className='text-sm font-medium text-foreground'>
                {t('kira.assignment.day.selectTitle')}
              </h3>

              <DatePicker
                value={selectedDate}
                onChange={(date: Date | null) => date && setSelectedDate(date)}
                label={t('kira.assignment.day.selectLabel')}
                dateFormat='DD/MM/YYYY'
                startContent={
                  <Calendar className='w-4 h-4 text-foreground-500' />
                }
              />

              <div className='flex items-center gap-2 text-sm text-foreground-600'>
                <Clock className='w-4 h-4' />
                <span>{t('kira.assignment.day.contextInfo')}</span>
              </div>
            </div>
          )}

          {/* Current Assignment Info */}
          {currentAssignment && (
            <Card className='bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'>
              <CardBody className='p-3'>
                <div className='flex items-center gap-2 mb-1'>
                  <span className='text-sm font-medium text-warning-700 dark:text-warning-300'>
                    {t('kira.assignment.current.title')}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  {getAssignmentIcon(currentAssignment.type)}
                  <span className='text-sm text-warning-600 dark:text-warning-400'>
                    {String(
                      (() => {
                        if (
                          currentAssignment.type === 'task' &&
                          currentAssignment.context?.taskTitle
                        ) {
                          return currentAssignment.context.taskTitle;
                        }
                        if (
                          currentAssignment.type === 'day' &&
                          currentAssignment.date
                        ) {
                          return new Date(
                            currentAssignment.date
                          ).toLocaleDateString();
                        }
                        return t('kira.assignment.general.title');
                      })()
                    )}
                  </span>
                </div>
              </CardBody>
            </Card>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant='light' onPress={handleCancel} isDisabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            color='primary'
            onPress={handleAssign}
            isLoading={isLoading}
            isDisabled={!isFormValid()}
          >
            {currentAssignment
              ? t('kira.assignment.modal.update')
              : t('kira.assignment.modal.assign')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
