// Compact task card component for planning interface
import { useState } from 'react';
import { Task, TaskStatus, Priority } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { 
  Clock, 
  Circle,
  CheckCircle,
  Edit3,
  GripVertical,
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
  History
} from 'lucide-react';

interface PlanningTaskCardProps {
  task: Task;
  onEdit?: (updatedTask: Partial<Task>) => void;
  onStatusChange?: (status: TaskStatus) => void;
  onTimerStart?: (task: Task) => void;
  onTimerPause?: (task: Task) => void;
  onTimerStop?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onViewTimeHistory?: (task: Task) => void;
  activeTimerTaskId?: string;
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
  className = ''
}: PlanningTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTimerOperationPending, setIsTimerOperationPending] = useState(false);
  const [editForm, setEditForm] = useState({
    title: task.title,
    priority: task.priority,
    timeEstimate: task.timeEstimate || 0
  });
  const [notesText, setNotesText] = useState(task.description || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    
    if (task.status === TaskStatus.COMPLETED) {
      onStatusChange(TaskStatus.PENDING);
    } else {
      onStatusChange(TaskStatus.COMPLETED);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({
      title: task.title,
      priority: task.priority,
      timeEstimate: task.timeEstimate || 0
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit({
        title: editForm.title,
        priority: editForm.priority,
        timeEstimate: editForm.timeEstimate
      });
    }
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
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
        description: notesText
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
    if (isTimerOperationPending) return; // Prevent rapid clicks
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
    if (onDelete && confirm(`Are you sure you want to delete "${task.title}"?`)) {
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

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const hasNotes = task.description && task.description.trim().length > 0;
  const isTimerActive = activeTimerTaskId === task.id;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-gray-50 dark:bg-gray-600/50 rounded-lg shadow-sm
        border-l-3 transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5
        ${isOverdue ? 'border-l-rose-500' : ''}
        ${isDragging ? 'opacity-60 shadow-xl scale-105 z-50' : ''}
        ${isCompleted ? 'opacity-75 border-l-emerald-500' : ''}
        ${(isEditing || isEditingNotes) ? 'border-l-indigo-500 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}
        ${isTimerActive && isTimerRunning ? 'border-l-green-500 shadow-md ring-1 ring-green-200 dark:ring-green-800' : ''}
        ${isTimerActive && !isTimerRunning ? 'border-l-amber-500 ring-1 ring-amber-200 dark:ring-amber-800' : ''}
        ${!isOverdue && !isCompleted && !isTimerActive && !(isEditing || isEditingNotes) ? 'border-l-slate-300 dark:border-l-slate-600' : ''}
        ${className}
      `}
    >
      {/* Top Right Controls - Drag Handle Only */}
      {!isEditing && !isEditingNotes && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
          {/* Drag Handle */}
          <div 
            {...listeners}
            {...attributes}
            className="p-1 cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
            title="Drag to move"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Notes Editing Modal */}
      {isEditingNotes && (
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800/90 rounded-lg border-l-3 border-l-indigo-500 shadow-lg ring-1 ring-indigo-200 dark:ring-indigo-800 z-10 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Notes</h4>
              <div className="flex space-x-1">
                <button
                  onClick={handleNotesSave}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-all duration-200"
                  title="Save notes"
                >
                  <Save className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNotesCancel}
                  className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-all duration-200"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="w-full h-20 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200"
              placeholder="Add notes for this task..."
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-2.5">
        {isEditing ? (
          /* Inline Edit Mode */
          <div className="space-y-2">
            {/* Title Input */}
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              placeholder="Task name"
              autoFocus
            />
            
            {/* Priority & Time Row */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm(prev => ({ ...prev, priority: parseInt(e.target.value) as Priority }))}
                className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              >
                <option value={Priority.LOW}>Low</option>
                <option value={Priority.MEDIUM}>Med</option>
                <option value={Priority.HIGH}>High</option>
                <option value={Priority.URGENT}>Urgent</option>
              </select>
              
              <input
                type="number"
                value={editForm.timeEstimate}
                onChange={(e) => setEditForm(prev => ({ ...prev, timeEstimate: parseInt(e.target.value) || 0 }))}
                className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                placeholder="min"
                min="0"
              />
              
              <div className="flex space-x-1">
                <button
                  onClick={handleSave}
                  className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-all duration-200"
                  title="Save"
                >
                  <Save className="w-3 h-3 mx-auto" />
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-2 py-1.5 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-all duration-200"
                  title="Cancel"
                >
                  <X className="w-3 h-3 mx-auto" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Display Mode */
          <>
            {/* Header */}
            <div className="mb-2">
              <div className="flex items-start space-x-2">
                <button
                  onClick={handleStatusToggle}
                  className="flex-shrink-0 mt-0.5 hover:scale-110 transition-all duration-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                  title={isCompleted ? 'Click to mark incomplete' : 'Click to mark complete'}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className={`
                    font-medium text-sm leading-tight mb-0.5
                    ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}
                  `}>
                    {task.title}
                  </h4>
                  {isTimerActive && (
                    <div className="inline-flex items-center space-x-1.5 mt-0.5">
                      <TimerIcon className={`w-3 h-3 ${isTimerRunning ? 'text-green-600 animate-pulse' : 'text-amber-600'}`} />
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isTimerRunning 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {isTimerRunning ? 'Recording' : 'Paused'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Timer elapsed time display */}
              {isTimerActive && elapsedTime > 0 && (
                <div className="mt-1.5 ml-6 flex items-center space-x-2">
                  <div className="text-xs font-mono text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                    ⏱️ {formatElapsedTime(elapsedTime)}
                  </div>
                  {isTimerRunning && (
                    <div className="text-xs text-green-600 dark:text-green-400 animate-pulse font-medium">
                      Active
                    </div>
                  )}
                </div>
              )}
              
              {/* Description preview when expanded */}
              {isExpanded && hasNotes && (
                <div className="mt-1.5 ml-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                  {/* Strip HTML tags and show plain text - limit to ~100 chars */}
                  {task.description?.replace(/<[^>]*>/g, '').trim().substring(0, 100)}
                  {task.description && task.description.replace(/<[^>]*>/g, '').trim().length > 100 && '...'}
                </div>
              )}
            </div>

            {/* Metadata and Actions */}
            <div className="flex items-center justify-between text-xs">
              {/* Left Side - Time Information and Actions */}
              <div className="flex items-center space-x-2">
                {/* Time Information */}
                <div className="flex items-center space-x-2">
                  {task.timeEstimate > 0 && (
                    <div className="flex items-center space-x-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                      <Clock className="w-3 h-3" />
                      <span>{task.timeEstimate}min</span>
                    </div>
                  )}
                  
                  {task.actualTime > 0 && (
                    <div className="flex items-center space-x-1 font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                      <History className="w-3 h-3" />
                      <span>{task.actualTime}min</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-0.5">
                  {/* Timer Controls */}
                  {onTimerStart && !isCompleted && (
                    <div className="flex items-center space-x-0.5">
                      <button
                        onClick={handleTimerClick}
                        disabled={isTimerOperationPending}
                        className={`
                          transition-all duration-200 p-1.5 rounded border
                          ${isTimerOperationPending ? 'opacity-50 cursor-not-allowed' : ''}
                          ${isTimerActive 
                            ? isTimerRunning
                              ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/40'
                              : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/40'
                            : 'opacity-0 group-hover:opacity-100 hover:bg-green-50 dark:hover:bg-green-900/10 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 border-transparent hover:border-green-300 dark:hover:border-green-600'
                          }
                        `}
                        title={
                          isTimerOperationPending ? 'Processing...' :
                          isTimerActive && isTimerRunning ? 'Pause timer' :
                          isTimerActive && !isTimerRunning ? 'Resume timer' :
                          'Start timer for this task'
                        }
                      >
                        {isTimerOperationPending ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : isTimerActive && isTimerRunning ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                      
                      {/* Stop Timer Button - only show when timer is active */}
                      {isTimerActive && onTimerStop && (
                        <button
                          onClick={handleTimerStop}
                          className="p-1.5 rounded border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all duration-200"
                          title="Stop timer"
                        >
                          <Square className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Secondary Actions */}
                  <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {/* Notes Button */}
                    <button
                      onClick={handleNotesClick}
                      className={`p-1.5 rounded transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ${
                        hasNotes ? 'opacity-100 bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                      title={hasNotes ? "View/Edit notes" : "Add notes"}
                    >
                      <FileText className="w-3 h-3" />
                    </button>

                    {/* Session Logs Button */}
                    <button
                      onClick={handleViewTimeHistory}
                      className={`p-1.5 rounded transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 ${
                        task.actualTime > 0 ? 'opacity-100 bg-purple-50 dark:bg-purple-900/10' : ''
                      }`}
                      title={task.actualTime > 0 ? `Session logs (${task.actualTime}min total)` : 'Session logs'}
                    >
                      <History className="w-3 h-3" />
                    </button>

                    {/* Edit Button */}
                    {onEdit && (
                      <button
                        onClick={handleEditClick}
                        className="p-1.5 rounded transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        title="Edit task"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Delete Button - Always Accessible */}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-1.5 rounded transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-60 hover:opacity-100"
                      title="Delete task"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side - Expand button */}
              {hasNotes && (
                <button
                  onClick={handleToggleExpand}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200"
                  title={isExpanded ? 'Collapse description' : 'Expand description'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}