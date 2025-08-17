// Compact task card component for planning interface
import { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Clock,
  Circle,
  CheckCircle,
  Edit3,
  Save,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Timer as TimerIcon,
  Pause,
  Trash2,
  History,
} from 'lucide-react';
import { TaskModal } from './TaskModal';

interface PlanningTaskCardProps {
  task: Task;
  onEdit?: (updatedTask: Partial<Task>) => void;
  onStatusChange?: (status: TaskStatus) => void;
  onTimerStart?: (task: Task) => void;
  onTimerPause?: (task: Task) => void;
  onTimerStop?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onViewTimeHistory?: (task: Task) => void;
  activeTimerTaskId?: string | null;
  isTimerRunning?: boolean;
  elapsedTime?: number;
  className?: string;
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onTimerStart,
  onTimerPause,
  onTimerStop,
  onDelete,
  onViewTimeHistory,
  activeTimerTaskId,
  isTimerRunning = false,
  elapsedTime = 0,
  className = '',
}: PlanningTaskCardProps) {
  const { t } = useTranslation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTimerOperationPending, setIsTimerOperationPending] = useState(false);
  const [isStatusChangePending, setIsStatusChangePending] = useState(false);
  const [notesText, setNotesText] = useState(task.description || '');

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange || isStatusChangePending) {
      return;
    }

    setIsStatusChangePending(true);
    try {
      if (task.status === TaskStatus.COMPLETED) {
        onStatusChange(TaskStatus.PENDING);
      } else {
        onStatusChange(TaskStatus.COMPLETED);
      }
    } finally {
      // Reset the pending state after a short delay to prevent rapid clicks
      setTimeout(() => setIsStatusChangePending(false), 300);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditModalOpen(true);
  };

  const handleSave = (updatedTask: Partial<Task>) => {
    if (onEdit) {
      onEdit(updatedTask);
    }
    setIsEditModalOpen(false);
  };

  const handleNotesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesText(task.description || '');
    setIsEditingNotes(true);
  };

  const handleNotesSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit({
        description: notesText,
      });
    }
    setIsEditingNotes(false);
  };

  const handleNotesCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingNotes(false);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerOperationPending) {
      return;
    } // Prevent rapid clicks
    setIsTimerOperationPending(true);
    if (isTimerActive && isTimerRunning) {
      // If timer is running, pause it
      onTimerPause?.(task);
    } else if (isTimerActive && !isTimerRunning) {
      // If timer is paused, resume it (handled by onTimerStart)
      onTimerStart?.(task);
    } else {
      // If no timer, start it
      onTimerStart?.(task);
    }
    setTimeout(() => setIsTimerOperationPending(false), 500); // Reset after 500ms
  };

  const handleTimerStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTimerStop) {
      onTimerStop(task);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      onDelete &&
      confirm(`Are you sure you want to delete "${task.title}"?`)
    ) {
      onDelete(task);
    }
  };

  const handleViewTimeHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewTimeHistory) {
      onViewTimeHistory(task);
    }
  };

  const formatElapsedTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== TaskStatus.COMPLETED;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const hasNotes = task.description && task.description.trim().length > 0;
  const isTimerActive = activeTimerTaskId === task.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        group relative bg-content1 dark:bg-content2 rounded-md shadow-sm
        border-l-1 transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5
        cursor-grab active:cursor-grabbing
        ${isOverdue ? 'border-l-rose-500' : ''}
        ${isDragging ? 'opacity-60 shadow-xl scale-105 z-50' : ''}
        ${isCompleted ? 'opacity-75 border-l-emerald-500' : ''}
        ${isEditModalOpen || isEditingNotes ? 'border-l-indigo-500 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}
        ${isTimerActive && isTimerRunning ? 'border-l-green-500 shadow-md ring-1 ring-green-200 dark:ring-green-800' : ''}
        ${isTimerActive && !isTimerRunning ? 'border-l-amber-500 ring-1 ring-amber-200 dark:ring-amber-800' : ''}
        ${!isOverdue && !isCompleted && !isTimerActive && !(isEditModalOpen || isEditingNotes) ? 'border-l-divider' : ''}
        ${className}
      `}
    >
      {/* Notes Editing Modal */}
      {isEditingNotes && (
        <div className='absolute inset-0 bg-content1 rounded-md border-l-3 border-l-primary shadow-lg ring-1 ring-primary/20 z-10 p-3'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <h4 className='text-xs font-semibold text-slate-900 dark:text-slate-100'>
                Notes
              </h4>
              <div className='flex space-x-1'>
                <button
                  onClick={handleNotesSave}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  className='px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-all duration-200'
                  title={t('common.save')}
                >
                  <Save className='w-3 h-3' />
                </button>
                <button
                  onClick={handleNotesCancel}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  className='px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-all duration-200'
                  title={t('common.cancel')}
                >
                  <X className='w-3 h-3' />
                </button>
              </div>
            </div>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              className='w-full h-20 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200'
              placeholder='Add notes for this task...'
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className='p-2.5'>
        {/* Normal Display Mode */}
        <>
          {/* Header */}
          <div className='mb-2'>
            <div className='flex items-start space-x-2'>
              <button
                onClick={handleStatusToggle}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                disabled={isStatusChangePending}
                className={`shrink-0 mt-0.5 transition-all duration-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  isStatusChangePending
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-110'
                }`}
                title={
                  isStatusChangePending
                    ? 'Updating status...'
                    : isCompleted
                      ? 'Click to mark incomplete'
                      : 'Click to mark complete'
                }
              >
                {isCompleted ? (
                  <CheckCircle className='w-4 h-4 text-emerald-600 dark:text-emerald-500' />
                ) : (
                  <Circle className='w-4 h-4 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300' />
                )}
              </button>
              <div className='flex-1 min-w-0'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1 min-w-0'>
                    <h4
                      className={`
                      font-medium text-sm leading-tight mb-0.5
                      ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}
                    `}
                    >
                      {task.title}
                    </h4>
                  </div>

                  {/* Expand button - Right side of title */}
                  {hasNotes && (
                    <button
                      onClick={handleToggleExpand}
                      onMouseDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                      className='shrink-0 ml-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200'
                      title={
                        isExpanded
                          ? 'Collapse description'
                          : 'Expand description'
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className='w-3 h-3' />
                      ) : (
                        <ChevronRight className='w-3 h-3' />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Description preview when expanded */}
            {isExpanded && hasNotes && (
              <div className='mt-1.5 ml-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed'>
                {/* Strip HTML tags and show plain text - limit to ~100 chars */}
                {task.description
                  ?.replace(/<[^>]*>/g, '')
                  .trim()
                  .substring(0, 100)}
                {task.description &&
                  task.description.replace(/<[^>]*>/g, '').trim().length >
                    100 &&
                  '...'}
              </div>
            )}
          </div>

          {/* Metadata and Actions */}
          <div className='space-y-1.5'>
            {/* First Row - Time Information */}
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                {task.timeEstimate > 0 && (
                  <div className='flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded'>
                    <Clock className='w-3 h-3' />
                    <span>{task.timeEstimate}min</span>
                  </div>
                )}

                {task.actualTime > 0 && (
                  <div className='flex items-center space-x-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded'>
                    <History className='w-3 h-3' />
                    <span>{task.actualTime}min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Second Row - Action Buttons */}
            <div className='flex items-center justify-between transition-all duration-200'>
              {/* Timer Controls - Left side */}
              <div className='flex items-center space-x-0.5'>
                {/* Start Timer Button - Always visible when not completed */}
                {onTimerStart && !isCompleted && (
                  <button
                    onClick={handleTimerClick}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    disabled={isTimerOperationPending}
                    className={`
                      transition-all duration-200 p-1.5 rounded
                      ${isTimerOperationPending ? 'opacity-50 cursor-not-allowed' : ''}
                      ${
                        isTimerActive && isTimerRunning
                          ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/40'
                          : isTimerActive && !isTimerRunning
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                            : 'hover:bg-green-50 dark:hover:bg-green-900/10 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                      }
                    `}
                    title={
                      isTimerOperationPending
                        ? 'Processing...'
                        : isTimerActive && isTimerRunning
                          ? 'Pause timer'
                          : isTimerActive && !isTimerRunning
                            ? 'Resume timer'
                            : 'Start timer for this task'
                    }
                  >
                    {isTimerOperationPending ? (
                      <div className='w-3 h-3 border border-current border-t-transparent rounded-full animate-spin' />
                    ) : isTimerActive && isTimerRunning ? (
                      <Pause className='w-3 h-3' />
                    ) : (
                      <Play className='w-3 h-3' />
                    )}
                  </button>
                )}

                {/* Stop Timer Button - Only show when timer is active */}
                {isTimerActive && onTimerStop && (
                  <button
                    onClick={handleTimerStop}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className='p-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all duration-200'
                    title='Stop timer'
                  >
                    <Square className='w-3 h-3' />
                  </button>
                )}

                {/* Active Timer Display - Only show when timer is active */}
                {isTimerActive && (
                  <div className='inline-flex items-center space-x-1 ml-1'>
                    <TimerIcon
                      className={`w-3 h-3 ${isTimerRunning ? 'text-green-600 animate-pulse' : 'text-amber-600'}`}
                    />
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isTimerRunning
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {elapsedTime > 0
                        ? formatElapsedTime(elapsedTime)
                        : isTimerRunning
                          ? 'Recording'
                          : 'Paused'}
                    </span>
                  </div>
                )}
              </div>

              {/* Secondary Actions - Right side */}
              <div className='flex items-center space-x-0.5'>
                {/* Notes Button */}
                <button
                  onClick={handleNotesClick}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  className={`p-1.5 rounded transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ${
                    hasNotes ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                  title={hasNotes ? 'View/Edit notes' : 'Add notes'}
                >
                  <FileText className='w-3 h-3' />
                </button>

                {/* Session Logs Button */}
                <button
                  onClick={handleViewTimeHistory}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  className={`p-1.5 rounded transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 ${
                    task.actualTime > 0
                      ? 'bg-purple-50 dark:bg-purple-900/10'
                      : ''
                  }`}
                  title={
                    task.actualTime > 0
                      ? `Session logs (${task.actualTime}min total)`
                      : 'Session logs'
                  }
                >
                  <History className='w-3 h-3' />
                </button>

                {/* Edit Button */}
                {onEdit && (
                  <button
                    onClick={handleEditClick}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className='p-1.5 rounded transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300'
                    title={t('tasks.edit')}
                  >
                    <Edit3 className='w-3 h-3' />
                  </button>
                )}

                {/* Delete Button - Always Accessible */}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className='p-1.5 rounded transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-60 hover:opacity-100'
                    title={t('tasks.delete')}
                  >
                    <Trash2 className='w-3 h-3' />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      </div>

      {/* Task Edit Modal */}
      <TaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdateTask={handleSave}
        task={task}
      />
    </div>
  );
}
