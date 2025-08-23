// Modern task card component with enhanced note editing
import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskStatus } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from '../../hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Circle,
  CheckCircle,
  Edit3,
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
  Type,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import { TaskModal } from './TaskModal';
import { ConfirmationDialog } from '../common';
import { MinimalRichTextEditor } from '../common/MinimalRichTextEditor';

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

type EditMode = 'none' | 'inline' | 'expanded' | 'modal';

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
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
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTimerOperationPending, setIsTimerOperationPending] = useState(false);
  const [isStatusChangePending, setIsStatusChangePending] = useState(false);
  const [notesContent, setNotesContent] = useState(task.description || '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: editMode !== 'none', // Disable dragging when editing
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // Auto-save functionality
  const performAutoSave = useCallback(
    async (content: string) => {
      if (!onEdit || content === task.description) {
        return;
      }

      setAutoSaveState(prev => ({ ...prev, isSaving: true }));

      try {
        onEdit({ description: content });
        setAutoSaveState({
          isSaving: false,
          lastSaved: new Date(),
          hasUnsavedChanges: false,
        });
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveState(prev => ({ ...prev, isSaving: false }));
      }
    },
    [onEdit, task.description]
  );

  // Debounced auto-save
  const debouncedAutoSave = useCallback(
    (content: string) => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: true }));

      autoSaveTimeoutRef.current = setTimeout(() => {
        performAutoSave(content);
      }, 1500); // Auto-save after 1.5 seconds of inactivity
    },
    [performAutoSave]
  );

  // Update notes content when task changes
  useEffect(() => {
    setNotesContent(task.description || '');
    setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: false }));
  }, [task.description]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMode === 'none') {
        return;
      }

      // Escape to cancel editing
      if (e.key === 'Escape') {
        handleCancelEdit();
      }
      // Cmd/Ctrl + Enter to save and exit
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSaveAndExit();
      }
      // Cmd/Ctrl + S to save
      else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        performAutoSave(notesContent);
      }
    };

    if (editMode !== 'none') {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [editMode, notesContent, performAutoSave]);

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

  // Enhanced note editing handlers
  const handleNotesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode === 'none') {
      setEditMode('inline');
      setIsExpanded(true);
    }
  };

  const handleExpandedEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditMode('expanded');
    setIsExpanded(true);
  };

  const handleSaveAndExit = () => {
    if (autoSaveState.hasUnsavedChanges) {
      performAutoSave(notesContent);
    }
    setEditMode('none');
    setIsExpanded(false);
  };

  const handleCancelEdit = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    setNotesContent(task.description || '');
    setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: false }));
    setEditMode('none');
    setIsExpanded(false);
  };

  const handleNotesContentChange = (content: string) => {
    setNotesContent(content);
    debouncedAutoSave(content);
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
    e.preventDefault();

    if (!onDelete) {
      console.warn('No onDelete handler provided for task:', task.title);
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      console.log('Deleting task:', task.title);
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
  const isEditing = editMode !== 'none';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...(editMode === 'none' ? listeners : {})}
      {...(editMode === 'none' ? attributes : {})}
      layout
      initial={false}
      animate={{
        scale: isDragging ? 1.05 : 1,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`
        group relative bg-content1 dark:bg-content2 rounded-lg shadow-sm
        border-l-4 transition-all duration-300 ease-out
        ${editMode === 'none' ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}
        ${isOverdue ? 'border-l-rose-500' : ''}
        ${isDragging ? 'shadow-xl z-50' : ''}
        ${isCompleted ? 'opacity-75 border-l-emerald-500' : ''}
        ${isEditing ? 'border-l-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-800' : ''}
        ${isTimerActive && isTimerRunning ? 'border-l-green-500 shadow-md ring-2 ring-green-200 dark:ring-green-800' : ''}
        ${isTimerActive && !isTimerRunning ? 'border-l-amber-500 ring-2 ring-amber-200 dark:ring-amber-800' : ''}
        ${!isOverdue && !isCompleted && !isTimerActive && !isEditing ? 'border-l-slate-200 dark:border-l-slate-700' : ''}
        ${editMode === 'expanded' ? 'col-span-full' : ''}
        ${className}
      `}
      onMouseDown={e => {
        if (editMode !== 'none') {
          return;
        }
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
          e.stopPropagation();
        }
      }}
    >
      {/* Main Content */}
      <div className={`${isEditing ? 'pb-2.5' : 'p-2.5'}`}>
        {/* Header */}
        <div className={`mb-2 ${isEditing ? 'px-2.5 pt-2.5' : ''}`}>
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
                    ? t('tasks.updatingStatus')
                    : isCompleted
                      ? t('tasks.markIncomplete')
                      : t('tasks.markComplete')
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
                  {hasNotes && !isEditing && (
                    <button
                      onClick={handleToggleExpand}
                      onMouseDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                      className='shrink-0 ml-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200'
                      title={
                        isExpanded
                          ? t('tasks.collapseDescription')
                          : t('tasks.expandDescription')
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

            {/* Description preview when expanded and not editing */}
            <AnimatePresence>
              {isExpanded && hasNotes && !isEditing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className='mt-1.5 ml-6 leading-relaxed overflow-hidden'
                >
                  <div
                    className='prose prose-xs prose-slate dark:prose-invert max-w-none text-xs [&_p]:my-0.5 [&_p]:leading-relaxed [&_p]:text-xs [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_li]:text-xs [&_strong]:text-xs [&_em]:text-xs'
                    dangerouslySetInnerHTML={{
                      __html: task.description || '',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Full Width Notes Editor */}
            <AnimatePresence>
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className={`
                    mt-2 ${editMode === 'expanded' ? 'fixed inset-4 z-50 bg-content1 dark:bg-content2 rounded-lg shadow-2xl border border-indigo-300 dark:border-indigo-600 p-4' : 'w-full'}
                  `}
                >
                  {/* Minimal Header */}
                  <div className='flex items-center justify-between mb-2'>
                    {/* Auto-save indicator - minimal */}
                    <div className='flex items-center space-x-2'>
                      {autoSaveState.isSaving && (
                        <div className='w-2 h-2 border border-amber-500 border-t-transparent rounded-full animate-spin' />
                      )}
                      {autoSaveState.hasUnsavedChanges &&
                        !autoSaveState.isSaving && (
                          <div className='w-2 h-2 bg-orange-400 rounded-full' />
                        )}
                      {autoSaveState.lastSaved &&
                        !autoSaveState.hasUnsavedChanges &&
                        !autoSaveState.isSaving && (
                          <div className='w-2 h-2 bg-green-400 rounded-full' />
                        )}
                    </div>

                    {/* Minimal action buttons */}
                    <div className='flex items-center space-x-1'>
                      {/* Expand toggle - icon only */}
                      {editMode === 'inline' && (
                        <button
                          onClick={handleExpandedEdit}
                          onMouseDown={e => e.stopPropagation()}
                          className='p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
                          title={t('tasks.expandEditor')}
                        >
                          <Maximize2 className='w-3 h-3' />
                        </button>
                      )}
                      {editMode === 'expanded' && (
                        <button
                          onClick={() => setEditMode('inline')}
                          onMouseDown={e => e.stopPropagation()}
                          className='p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
                          title={t('tasks.collapseEditor')}
                        >
                          <Minimize2 className='w-3 h-3' />
                        </button>
                      )}

                      {/* Done button - minimal */}
                      <button
                        onClick={handleSaveAndExit}
                        onMouseDown={e => e.stopPropagation()}
                        disabled={autoSaveState.isSaving}
                        className='p-1 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors'
                        title={`${t('common.done')} (⌘+Enter)`}
                      >
                        <Check className='w-3 h-3' />
                      </button>

                      {/* Cancel button - minimal */}
                      <button
                        onClick={handleCancelEdit}
                        onMouseDown={e => e.stopPropagation()}
                        className='p-1 rounded bg-slate-400 hover:bg-slate-500 text-white transition-colors'
                        title={`${t('common.cancel')} (Esc)`}
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </div>
                  </div>

                  {/* Rich Text Editor with proper height and card-matching colors */}
                  <div
                    ref={editorContainerRef}
                    className={`
                      ${editMode === 'expanded' ? 'h-96' : 'h-32'}
                      transition-all duration-200
                    `}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <MinimalRichTextEditor
                      content={notesContent}
                      onChange={handleNotesContentChange}
                      placeholder={t('tasks.addNotesPlaceholder')}
                      className='h-full'
                    />
                  </div>

                  {/* Minimal shortcuts hint */}
                  <div className='mt-1 text-xs text-slate-400 dark:text-slate-500 text-center'>
                    ⌘+Enter to save • Esc to cancel
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                        ? t('timer.processing')
                        : isTimerActive && isTimerRunning
                          ? t('timer.pauseTimer')
                          : isTimerActive && !isTimerRunning
                            ? t('timer.resumeTimer')
                            : t('timer.startTimer')
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
                    title={t('timer.stopTimer')}
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
                          ? t('timer.recording')
                          : t('timer.paused')}
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
                    hasNotes || isEditing
                      ? 'bg-blue-50 dark:bg-blue-900/10'
                      : ''
                  } ${isEditing ? 'ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}
                  title={
                    isEditing
                      ? t('tasks.editingNotes')
                      : hasNotes
                        ? t('tasks.viewEditNotes')
                        : t('tasks.addNotes')
                  }
                >
                  {isEditing ? (
                    <Type className='w-3 h-3' />
                  ) : (
                    <FileText className='w-3 h-3' />
                  )}
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
                      ? t('tasks.sessionLogsWithTime', {
                          time: task.actualTime,
                        })
                      : t('tasks.sessionLogs')
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
                    onMouseDown={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerDown={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={e => {
                      e.stopPropagation();
                    }}
                    className='p-1.5 rounded transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-60 hover:opacity-100 cursor-pointer'
                    title={t('tasks.delete')}
                    type='button'
                  >
                    <Trash2 className='w-3 h-3' />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Edit Modal */}
      <TaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdateTask={handleSave}
        task={task}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('tasks.deleteConfirmTitle')}
        message={t('tasks.deleteConfirmMessage', { title: task.title })}
        confirmText={t('tasks.deleteConfirmButton')}
        cancelText={t('tasks.cancelButton')}
        variant='danger'
      />
    </motion.div>
  );
}
