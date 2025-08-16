// Task creation modal for planning interface
import { useState, useEffect } from 'react';
import { Task, Priority, TaskStatus, CreateTaskRequest } from '../../types';
import { generateId } from '../../utils';
import { 
  X, 
  Calendar, 
  Clock, 
  Flag, 
  Hash, 
  Plus
} from 'lucide-react';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: Task) => void;
  defaultDate?: Date;
  defaultColumn?: string;
  className?: string;
}

export function TaskCreationModal({
  isOpen,
  onClose,
  onCreateTask,
  defaultDate,
  defaultColumn
}: TaskCreationModalProps) {
  const [formData, setFormData] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    timeEstimate: 60,
    dueDate: undefined,
    scheduledDate: undefined,
    tags: [],
  });

  const [newTag, setNewTag] = useState('');

  // Update form data when defaultDate changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const shouldSetDueDate = defaultColumn && defaultColumn.toLowerCase() !== 'backlog' && defaultColumn.toLowerCase() !== 'upcoming';
      const shouldSetScheduledDate = defaultColumn && defaultColumn.toLowerCase() !== 'backlog';
      
      setFormData({
        title: '',
        description: '',
        priority: Priority.MEDIUM,
        timeEstimate: 60,
        dueDate: shouldSetDueDate ? defaultDate : undefined,
        scheduledDate: shouldSetScheduledDate ? defaultDate : undefined,
        tags: [],
      });
      setNewTag('');
    }
  }, [isOpen, defaultDate, defaultColumn]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;

    const newTask: Task = {
      id: generateId(),
      title: formData.title.trim(),
      description: formData.description || '',
      priority: formData.priority || Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: formData.timeEstimate || 60,
      actualTime: 0,
      dueDate: formData.dueDate,
      scheduledDate: formData.scheduledDate,
      tags: formData.tags || [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Creating task with data:', {
      title: newTask.title,
      dueDate: newTask.dueDate,
      column: defaultColumn
    });

    onCreateTask(newTask);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      priority: Priority.MEDIUM,
      timeEstimate: 60,
      dueDate: undefined,
      scheduledDate: undefined,
      tags: [],
    });
    setNewTag('');
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.HIGH:
        return 'text-red-600 bg-red-100 border-red-300';
      case Priority.MEDIUM:
        return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case Priority.LOW:
        return 'text-green-600 bg-green-100 border-green-300';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Create Task
            {defaultColumn && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                → {defaultColumn}
              </span>
            )}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title..."
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter description..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Priority & Time Estimate Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(Priority).filter(([key]) => isNaN(Number(key))).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: value as Priority }))}
                    className={`
                      px-2 py-1 rounded text-xs font-medium transition-all duration-200
                      ${formData.priority === value 
                        ? getPriorityColor(value as Priority)
                        : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }
                    `}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Estimate */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time (min)
              </label>
              <div className="relative">
                <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="number"
                  value={formData.timeEstimate}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeEstimate: parseInt(e.target.value) || 60 }))}
                  min="15"
                  step="15"
                  className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="date"
                  value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dueDate: e.target.value ? new Date(e.target.value) : undefined 
                  }))}
                  className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Scheduled
              </label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="date"
                  value={formData.scheduledDate ? formData.scheduledDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    scheduledDate: e.target.value ? new Date(e.target.value) : undefined 
                  }))}
                  className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Date Help Text */}
          <div className="text-xs text-slate-500 dark:text-slate-400 grid grid-cols-2 gap-3">
            <div>When task is due</div>
            <div>
              {defaultColumn && defaultColumn.toLowerCase() === 'backlog' 
                ? 'Leave empty for Backlog' 
                : 'When to work on it'
              }
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-2 py-1.5 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors duration-200"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded"
                  >
                    <Hash className="w-2 h-2 mr-1" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim()}
              className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}