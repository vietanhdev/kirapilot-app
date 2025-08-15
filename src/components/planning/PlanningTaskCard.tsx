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
  ChevronRight
} from 'lucide-react';

interface PlanningTaskCardProps {
  task: Task;
  onEdit?: (updatedTask: Partial<Task>) => void;
  onStatusChange?: (status: TaskStatus) => void;
  className?: string;
}

export function PlanningTaskCard({
  task,
  onEdit,
  onStatusChange,
  className = ''
}: PlanningTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const hasNotes = task.description && task.description.trim().length > 0;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 
        transition-all duration-200 hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500
        ${isOverdue ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20' : ''}
        ${isDragging ? 'opacity-50 shadow-lg z-50' : ''}
        ${isCompleted ? 'opacity-80 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-600' : ''}
        ${(isEditing || isEditingNotes) ? 'border-indigo-500 shadow-lg' : ''}
        ${className}
      `}
    >
      {/* Top Right Controls - Drag Handle Only */}
      {!isEditing && !isEditingNotes && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag Handle */}
          <div 
            {...listeners}
            {...attributes}
            className="p-1 cursor-grab active:cursor-grabbing text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Drag to move"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Notes Editing Modal */}
      {isEditingNotes && (
        <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg border-2 border-indigo-500 z-10 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Notes</h4>
              <div className="flex space-x-1">
                <button
                  onClick={handleNotesSave}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
                  title="Save notes"
                >
                  <Save className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNotesCancel}
                  className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="w-full h-24 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              placeholder="Add notes for this task..."
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-3">
        {isEditing ? (
          /* Inline Edit Mode */
          <div className="space-y-2">
            {/* Title Input */}
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-2 py-1 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Task name"
              autoFocus
            />
            
            {/* Priority & Time Row */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm(prev => ({ ...prev, priority: parseInt(e.target.value) as Priority }))}
                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
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
                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                placeholder="mins"
                min="0"
              />
              
              <div className="flex space-x-1">
                <button
                  onClick={handleSave}
                  className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
                  title="Save"
                >
                  <Save className="w-3 h-3 mx-auto" />
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-colors"
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleStatusToggle}
                  className="flex-shrink-0 hover:scale-110 transition-all duration-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                  title={isCompleted ? 'Click to mark incomplete' : 'Click to mark complete'}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300" />
                  )}
                </button>
                <h4 className={`
                  font-medium text-sm leading-tight flex-1
                  ${isCompleted ? 'line-through text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}
                `}>
                  {task.title}
                </h4>
              </div>
              
              {/* Description preview when expanded */}
              {isExpanded && hasNotes && (
                <div className="mt-1 ml-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {/* Strip HTML tags and show plain text - limit to ~100 chars */}
                  {task.description?.replace(/<[^>]*>/g, '').trim().substring(0, 100)}
                  {task.description && task.description.replace(/<[^>]*>/g, '').trim().length > 100 && '...'}
                </div>
              )}
            </div>

            {/* Metadata and Actions */}
            <div className="flex items-center justify-between text-xs">
              {/* Left Side - Time Estimate and Actions */}
              <div className="flex items-center space-x-2">
                {task.timeEstimate ? (
                  <div className="flex items-center space-x-1 font-medium text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span>{task.timeEstimate}min</span>
                  </div>
                ) : (
                  <div></div>
                )}

                {/* Notes Indicator */}
                {hasNotes && (
                  <button
                    onClick={handleNotesClick}
                    className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    title="View/Edit notes"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                )}

                {/* Notes button (when no notes exist) */}
                {!hasNotes && (
                  <button
                    onClick={handleNotesClick}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    title="Add notes"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                )}

                {/* Edit Button */}
                {onEdit && (
                  <button
                    onClick={handleEditClick}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    title="Edit task"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Bottom Right Actions */}
              <div className="flex items-center space-x-1">
                {/* Expand button - only show if there's description */}
                {hasNotes && (
                  <button
                    onClick={handleToggleExpand}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}