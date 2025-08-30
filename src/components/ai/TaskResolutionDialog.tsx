// Task resolution dialog for handling ambiguous task references

import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Divider,
} from '@heroui/react';
import { Search, Clock, Tag, AlertCircle } from 'lucide-react';
import { Task, Priority, TaskStatus } from '../../types';
import {
  TaskMatchResult,
  TaskResolutionRequest,
  TaskResolutionResponse,
  UserIntent,
} from '../../types/taskMatching';

interface TaskResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: TaskResolutionRequest;
  onResolve: (response: TaskResolutionResponse) => void;
}

export const TaskResolutionDialog: React.FC<TaskResolutionDialogProps> = ({
  isOpen,
  onClose,
  request,
  onResolve,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState(request.originalQuery);

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id);
    setShowCreateNew(false);
  };

  const handleConfirm = () => {
    if (selectedTaskId) {
      const selectedTask = request.matches.find(
        m => m.task.id === selectedTaskId
      )?.task;
      if (selectedTask) {
        onResolve({
          selectedTask,
          cancelled: false,
        });
      }
    } else if (showCreateNew && newTaskTitle.trim()) {
      onResolve({
        cancelled: false,
        createNew: true,
        newTaskTitle: newTaskTitle.trim(),
      });
    }
    onClose();
  };

  const handleCancel = () => {
    onResolve({ cancelled: true });
    onClose();
  };

  const handleCreateNew = () => {
    setShowCreateNew(true);
    setSelectedTaskId(null);
  };

  const getPriorityColor = (
    priority: Priority
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (priority) {
      case Priority.URGENT:
        return 'danger';
      case Priority.HIGH:
        return 'warning';
      case Priority.MEDIUM:
        return 'primary';
      case Priority.LOW:
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: Priority): string => {
    switch (priority) {
      case Priority.URGENT:
        return 'Urgent';
      case Priority.HIGH:
        return 'High';
      case Priority.MEDIUM:
        return 'Medium';
      case Priority.LOW:
        return 'Low';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (
    status: TaskStatus
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'success';
      case TaskStatus.IN_PROGRESS:
        return 'primary';
      case TaskStatus.PENDING:
        return 'default';
      case TaskStatus.CANCELLED:
        return 'danger';
      default:
        return 'default';
    }
  };

  const getIntentDescription = (intent?: UserIntent): string => {
    switch (intent) {
      case UserIntent.COMPLETE_TASK:
        return 'complete';
      case UserIntent.START_TIMER:
        return 'start timer for';
      case UserIntent.EDIT_TASK:
        return 'edit';
      case UserIntent.DELETE_TASK:
        return 'delete';
      case UserIntent.SCHEDULE_TASK:
        return 'schedule';
      case UserIntent.VIEW_DETAILS:
        return 'view details of';
      default:
        return 'work with';
    }
  };

  const hasHighConfidenceMatch = request.matches.some(
    match => match.confidence >= 80
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='2xl'
      scrollBehavior='inside'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'py-6',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <Search className='w-5 h-5 text-primary' />
            <span>Which task did you mean?</span>
          </div>
          <p className='text-sm text-default-500 font-normal'>
            I found multiple tasks that might match "{request.originalQuery}".
            {request.context?.userIntent && (
              <span className='ml-1'>
                You want to {getIntentDescription(request.context.userIntent)}{' '}
                this task.
              </span>
            )}
          </p>
        </ModalHeader>

        <ModalBody>
          <div className='space-y-4'>
            {/* High confidence matches */}
            {hasHighConfidenceMatch && (
              <div>
                <h4 className='text-sm font-semibold text-default-700 mb-2'>
                  Best matches
                </h4>
                <div className='space-y-2'>
                  {request.matches
                    .filter(match => match.confidence >= 80)
                    .map(match => (
                      <TaskMatchCard
                        key={match.task.id}
                        match={match}
                        isSelected={selectedTaskId === match.task.id}
                        onSelect={() => handleSelectTask(match.task)}
                        getPriorityColor={getPriorityColor}
                        getPriorityLabel={getPriorityLabel}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Lower confidence matches */}
            {request.matches.some(match => match.confidence < 80) && (
              <div>
                <h4 className='text-sm font-semibold text-default-700 mb-2'>
                  Other possible matches
                </h4>
                <div className='space-y-2'>
                  {request.matches
                    .filter(match => match.confidence < 80)
                    .map(match => (
                      <TaskMatchCard
                        key={match.task.id}
                        match={match}
                        isSelected={selectedTaskId === match.task.id}
                        onSelect={() => handleSelectTask(match.task)}
                        getPriorityColor={getPriorityColor}
                        getPriorityLabel={getPriorityLabel}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                </div>
              </div>
            )}

            <Divider />

            {/* Create new task option */}
            <div>
              <h4 className='text-sm font-semibold text-default-700 mb-2'>
                Or create a new task
              </h4>
              <Card
                isPressable
                isHoverable
                className={`cursor-pointer transition-colors ${
                  showCreateNew
                    ? 'border-2 border-primary bg-primary-50'
                    : 'border border-default-200 hover:border-default-300'
                }`}
                onPress={handleCreateNew}
              >
                <CardBody className='p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='flex-shrink-0'>
                      <div className='w-8 h-8 rounded-full bg-success-100 flex items-center justify-center'>
                        <span className='text-success-600 text-lg'>+</span>
                      </div>
                    </div>
                    <div className='flex-1'>
                      <p className='font-medium text-default-900'>
                        Create new task
                      </p>
                      <p className='text-sm text-default-500'>
                        None of these match what you're looking for
                      </p>
                    </div>
                  </div>

                  {showCreateNew && (
                    <div className='mt-4'>
                      <Input
                        label='Task title'
                        placeholder='Enter task title'
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        variant='bordered'
                        size='sm'
                        autoFocus
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* No matches warning */}
            {request.matches.length === 0 && (
              <Card className='border border-warning-200 bg-warning-50'>
                <CardBody className='p-4'>
                  <div className='flex items-center gap-3'>
                    <AlertCircle className='w-5 h-5 text-warning-600 flex-shrink-0' />
                    <div>
                      <p className='font-medium text-warning-800'>
                        No matching tasks found
                      </p>
                      <p className='text-sm text-warning-700'>
                        I couldn't find any tasks matching "
                        {request.originalQuery}". You can create a new task
                        instead.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant='light' onPress={handleCancel}>
            Cancel
          </Button>
          <Button
            color='primary'
            onPress={handleConfirm}
            isDisabled={
              !selectedTaskId && (!showCreateNew || !newTaskTitle.trim())
            }
          >
            {showCreateNew ? 'Create Task' : 'Select Task'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

interface TaskMatchCardProps {
  match: TaskMatchResult;
  isSelected: boolean;
  onSelect: () => void;
  getPriorityColor: (
    priority: Priority
  ) => 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  getPriorityLabel: (priority: Priority) => string;
  getStatusColor: (
    status: TaskStatus
  ) => 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

const TaskMatchCard: React.FC<TaskMatchCardProps> = ({
  match,
  isSelected,
  onSelect,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
}) => {
  const { task, confidence, matchReason } = match;

  return (
    <Card
      isPressable
      isHoverable
      className={`cursor-pointer transition-colors ${
        isSelected
          ? 'border-2 border-primary bg-primary-50'
          : 'border border-default-200 hover:border-default-300'
      }`}
      onPress={onSelect}
    >
      <CardBody className='p-4'>
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0'>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                confidence >= 80
                  ? 'bg-success-100'
                  : confidence >= 60
                    ? 'bg-warning-100'
                    : 'bg-default-100'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  confidence >= 80
                    ? 'text-success-600'
                    : confidence >= 60
                      ? 'text-warning-600'
                      : 'text-default-600'
                }`}
              >
                {confidence}%
              </span>
            </div>
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between gap-2 mb-2'>
              <h3 className='font-semibold text-default-900 truncate'>
                {task.title}
              </h3>
              <div className='flex gap-1 flex-shrink-0'>
                <Chip
                  size='sm'
                  color={getPriorityColor(task.priority)}
                  variant='flat'
                >
                  {getPriorityLabel(task.priority)}
                </Chip>
                <Chip
                  size='sm'
                  color={getStatusColor(task.status)}
                  variant='flat'
                >
                  {task.status.replace('_', ' ')}
                </Chip>
              </div>
            </div>

            {task.description && (
              <p className='text-sm text-default-600 mb-2 line-clamp-2'>
                {task.description}
              </p>
            )}

            <div className='flex items-center gap-4 text-xs text-default-500 mb-2'>
              {task.timeEstimate > 0 && (
                <div className='flex items-center gap-1'>
                  <Clock className='w-3 h-3' />
                  <span>{task.timeEstimate}m</span>
                </div>
              )}

              {task.tags.length > 0 && (
                <div className='flex items-center gap-1'>
                  <Tag className='w-3 h-3' />
                  <span>{task.tags.slice(0, 2).join(', ')}</span>
                  {task.tags.length > 2 && <span>+{task.tags.length - 2}</span>}
                </div>
              )}
            </div>

            <p className='text-xs text-primary-600 font-medium'>
              {matchReason}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
