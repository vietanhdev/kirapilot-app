// Modern task card component with enhanced note editing and completion effects
import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskStatus, TimePreset, Priority } from '../../types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../contexts/SettingsContext';

// import { formatDate } from '../../utils/dateFormat';

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
  // Calendar,
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
  showTaskListIndicator?: boolean;
  taskListName?: string;
  className?: string;
}

type EditMode = 'none' | 'inline' | 'expanded' | 'modal';

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

interface CompletionEffects {
  showGlow: boolean;
  showCheckmark: boolean;
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
  showTaskListIndicator = false,
  taskListName,
  className = '',
}: PlanningTaskCardProps) {
  const { t } = useTranslation();
  const { preferences } = useSettings();
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
  const [completionEffects, setCompletionEffects] = useState<CompletionEffects>(
    {
      showGlow: false,
      showCheckmark: false,
    }
  );

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: task.id,
      disabled: editMode !== 'none', // Disable dragging when editing
      data: {
        type: 'task',
        task: task,
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

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

  // Trigger simple completion effects
  const triggerCompletionEffects = useCallback(() => {
    setCompletionEffects({
      showGlow: true,
      showCheckmark: true,
    });

    // Simple haptic feedback for mobile devices (respects user preference)
    if (preferences.soundSettings.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50); // Single short pulse
    }

    // Simple success sound (respects user preference)
    if (preferences.soundSettings.completionSound) {
      try {
        // @ts-ignore - webkit audio context fallback
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Single pleasant tone
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5
        oscillator.type = 'sine';

        // Apply user volume setting
        const volume = preferences.soundSettings.soundVolume / 100;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(
          volume * 0.1,
          audioContext.currentTime + 0.01
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.3
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        // Silently fail if Web Audio API is not supported
        console.debug('Web Audio API not supported:', error);
      }
    }

    // Reset effects after animation
    setTimeout(() => {
      setCompletionEffects({
        showGlow: false,
        showCheckmark: false,
      });
    }, 1000);
  }, [preferences.soundSettings]);

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

  // Disable inline editing when modal is open
  useEffect(() => {
    if (isEditModalOpen && editMode !== 'none') {
      // Save any pending changes before closing inline editor
      if (autoSaveState.hasUnsavedChanges) {
        performAutoSave(notesContent);
      }
      setEditMode('none');
      setIsExpanded(false);
    }
  }, [
    isEditModalOpen,
    editMode,
    autoSaveState.hasUnsavedChanges,
    notesContent,
    performAutoSave,
  ]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMode === 'none') {
        return;
      }

      // Check if a modal is open by looking for modal elements or if this card's modal is open
      const modalOpen =
        document.querySelector('[role="dialog"]') ||
        document.querySelector('.modal') ||
        document.querySelector('[data-modal]') ||
        isEditModalOpen;

      // Don't handle shortcuts if a modal is open
      if (modalOpen) {
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
  }, [editMode, notesContent, performAutoSave, isEditModalOpen]);

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
        // Trigger completion effects before status change
        triggerCompletionEffects();
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

  const handleSave = async (updatedTask: Partial<Task>) => {
    try {
      if (onEdit) {
        onEdit(updatedTask);
      }
      setIsEditModalOpen(false);
    } catch (error) {
      // Let the TaskModal handle the error display
      // We don't close the modal so user can retry
      console.error('Failed to update task:', error);
      throw error;
    }
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

  // Get urgency indicator based on priority
  const getUrgencyIndicator = () => {
    switch (task.priority) {
      case Priority.URGENT:
        return {
          dots: 3,
          color: 'bg-red-500',
          title: 'Urgent Priority',
        };
      case Priority.HIGH:
        return {
          dots: 2,
          color: 'bg-orange-500',
          title: 'High Priority',
        };
      case Priority.MEDIUM:
        return {
          dots: 1,
          color: 'bg-yellow-500',
          title: 'Medium Priority',
        };
      case Priority.LOW:
      default:
        return null; // No indicator for low priority
    }
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
    <div
      ref={setNodeRef}
      style={style}
      {...(editMode === 'none' ? listeners : {})}
      {...(editMode === 'none' ? attributes : {})}
      className={`
        group relative bg-content1 dark:bg-content2 rounded-lg shadow-sm
        border-l-4 transition-all duration-300 ease-out
        ${editMode === 'none' ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-default'}
        ${isOverdue ? 'border-l-rose-500' : ''}
        ${isDragging ? 'opacity-30 scale-95' : 'opacity-100 hover:shadow-md'}
        ${isCompleted ? 'opacity-75 border-l-emerald-500' : ''}
        ${isEditing ? 'border-l-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-800' : ''}
        ${isTimerActive && isTimerRunning ? 'border-l-green-500 shadow-md ring-2 ring-green-200 dark:ring-green-800' : ''}
        ${isTimerActive && !isTimerRunning ? 'border-l-amber-500 ring-2 ring-amber-200 dark:ring-amber-800' : ''}
        ${!isOverdue && !isCompleted && !isTimerActive && !isEditing ? 'border-l-slate-200 dark:border-l-slate-700' : ''}
        ${editMode === 'expanded' ? 'col-span-full' : ''}
        ${completionEffects.showGlow ? 'ring-2 ring-emerald-300 dark:ring-emerald-600 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-800/50' : ''}
        ${className}
      `}
    >
      {/* Main Content */}
      <div className={`${isEditing ? 'pb-2' : 'p-2'}`}>
        {/* Header */}
        <div className={`${isEditing ? 'px-2 pt-2' : ''}`}>
          <div className='mb-1.5'>
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

                  {/* Minimal indicators on the right - always visible */}
                  <div className='flex items-center space-x-1 shrink-0 ml-2'>
                    {/* Urgency indicator dots */}
                    {(() => {
                      const urgencyIndicator = getUrgencyIndicator();
                      if (!urgencyIndicator) {
                        return null;
                      }

                      return (
                        <div
                          className='flex items-center space-x-0.5'
                          title={urgencyIndicator.title}
                        >
                          {Array.from({ length: urgencyIndicator.dots }).map(
                            (_, index) => (
                              <div
                                key={index}
                                className={`w-1.5 h-1.5 rounded-full ${urgencyIndicator.color}`}
                              />
                            )
                          )}
                        </div>
                      );
                    })()}

                    {/* Active timer indicator */}
                    {isTimerActive && (
                      <div
                        className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}
                      />
                    )}

                    {/* Expand button - Always visible when has notes and not editing */}
                    {hasNotes && !isEditing && (
                      <button
                        onClick={handleToggleExpand}
                        onMouseDown={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        className='p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200'
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
            </div>

            {/* Description preview when expanded and not editing */}
            {isExpanded && hasNotes && !isEditing && (
              <div className='mt-1.5 ml-6 leading-relaxed overflow-hidden transition-all duration-300 ease-in-out'>
                <div
                  className='prose prose-xs prose-slate dark:prose-invert max-w-none text-xs [&_p]:my-0.5 [&_p]:leading-relaxed [&_p]:text-xs [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_li]:text-xs [&_strong]:text-xs [&_em]:text-xs'
                  dangerouslySetInnerHTML={{
                    __html: task.description || '',
                  }}
                />
              </div>
            )}

            {/* Full Width Notes Editor */}
            {isEditing && (
              <div
                className={`
                  mt-2 transition-all duration-200 ease-in-out
                  ${editMode === 'expanded' ? 'fixed inset-4 z-50 bg-content1 dark:bg-content2 rounded-lg shadow-2xl border border-indigo-300 dark:border-indigo-600 p-4' : 'w-full'}
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
              </div>
            )}
          </div>

          {/* Always Visible Time Information and Task List */}
          <div className='mt-1 flex items-center justify-between'>
            <div className='flex items-center space-x-1.5'>
              {/* Task List Indicator - Only show when "All" view is active */}
              {showTaskListIndicator && taskListName && (
                <div className='flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 px-1.5 py-0.5 rounded'>
                  <span>{taskListName}</span>
                </div>
              )}

              {/* Time display: show used/estimated or just used time when available */}
              {(task.actualTime > 0 ||
                (task.timePreset !== TimePreset.NOT_APPLICABLE &&
                  task.timeEstimate > 0)) && (
                <div className='flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 px-1.5 py-0.5 rounded'>
                  <Clock className='w-3 h-3' />
                  <span>
                    {task.actualTime > 0 &&
                    task.timePreset !== TimePreset.NOT_APPLICABLE &&
                    task.timeEstimate > 0
                      ? `${task.actualTime}/${task.timeEstimate}min`
                      : task.actualTime > 0
                        ? `${task.actualTime}min`
                        : `${task.timeEstimate}min`}
                  </span>
                </div>
              )}

              {/* Active Timer Display - Always visible when active */}
              {isTimerActive && (
                <div className='inline-flex items-center space-x-1'>
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
          </div>

          {/* Action Buttons - Always visible in gray, colored on hover */}
          <div className='mt-1.5'>
            <div
              className={`transition-all duration-300 ease-out opacity-100 translate-y-0`}
            >
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
                            : 'text-slate-400 dark:text-slate-500 hover:bg-green-50 dark:hover:bg-green-900/10 hover:text-green-600 dark:hover:text-green-400'
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
                      className='p-1.5 rounded text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200'
                      title={t('timer.stopTimer')}
                    >
                      <Square className='w-3 h-3' />
                    </button>
                  )}
                </div>

                {/* Secondary Actions - Right side */}
                <div className='flex items-center space-x-0.5'>
                  {/* Notes Button */}
                  <button
                    onClick={handleNotesClick}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className={`p-1.5 rounded transition-all duration-200 ${
                      hasNotes || isEditing
                        ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    } hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 ${isEditing ? 'ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}
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
                    className={`p-1.5 rounded transition-all duration-200 ${
                      task.actualTime > 0
                        ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400'
                        : 'text-slate-400 dark:text-slate-500'
                    } hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400`}
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
                      className='p-1.5 rounded transition-all duration-200 text-slate-400 dark:text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400'
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
                      className='p-1.5 rounded transition-all duration-200 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 cursor-pointer'
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

      {/* Simple Completion Effect */}
      {completionEffects.showCheckmark && (
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='animate-bounce'>
            <CheckCircle className='w-8 h-8 text-emerald-500 drop-shadow-lg' />
          </div>
        </div>
      )}
    </div>
  );
}
