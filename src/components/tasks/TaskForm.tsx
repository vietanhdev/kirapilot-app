// Task creation and editing form component
import { useState, useEffect } from 'react';
import { Task, CreateTaskRequest, UpdateTaskRequest, Priority } from '../../types';
import { validateCreateTaskRequest, validateUpdateTaskRequest } from '../../types/validation';
import { RichTextEditor } from '../common/RichTextEditor';
import { PrioritySelector } from '../common/PrioritySelector';
import { TagInput } from '../common/TagInput';
import { DatePicker } from '../common/DatePicker';
import { Save, X, Clock, Calendar, Flag, Hash, FileText } from 'lucide-react';

interface TaskFormProps {
  task?: Task; // If provided, form is in edit mode
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  timeEstimate: number;
  dueDate?: Date;
  tags: string[];
  dependencies: string[];
}

export function TaskForm({ 
  task, 
  onSubmit, 
  onCancel, 
  isLoading = false, 
  className = '' 
}: TaskFormProps) {
  const isEditMode = !!task;
  
  const [formData, setFormData] = useState<FormData>({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || Priority.MEDIUM,
    timeEstimate: task?.timeEstimate || 0,
    dueDate: task?.dueDate,
    tags: task?.tags || [],
    dependencies: task?.dependencies || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Mark form as dirty when data changes
  useEffect(() => {
    if (isEditMode) {
      const hasChanges = 
        formData.title !== task.title ||
        formData.description !== task.description ||
        formData.priority !== task.priority ||
        formData.timeEstimate !== task.timeEstimate ||
        formData.dueDate?.getTime() !== task.dueDate?.getTime() ||
        JSON.stringify(formData.tags) !== JSON.stringify(task.tags) ||
        JSON.stringify(formData.dependencies) !== JSON.stringify(task.dependencies);
      
      setIsDirty(hasChanges);
    } else {
      const hasData = 
        formData.title.trim() !== '' ||
        formData.description.trim() !== '' ||
        formData.timeEstimate > 0 ||
        formData.dueDate !== undefined ||
        formData.tags.length > 0;
      
      setIsDirty(hasData);
    }
  }, [formData, task, isEditMode]);

  const validateForm = () => {
    const validation = isEditMode 
      ? validateUpdateTaskRequest(formData)
      : validateCreateTaskRequest(formData);

    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to submit task:', error);
      // Handle submission error
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg ${className}`}>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <FileText className="w-4 h-4 mr-2" />
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Enter task title..."
            disabled={isLoading}
            className={`
              w-full px-3 py-2 border rounded-lg
              bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
              placeholder-slate-500 dark:placeholder-slate-400
              focus:ring-2 focus:ring-primary-500 focus:border-transparent
              transition-all duration-200
              ${errors.title 
                ? 'border-red-300 dark:border-red-600' 
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <FileText className="w-4 h-4 mr-2" />
            Description
          </label>
          <RichTextEditor
            content={formData.description}
            onChange={(content) => updateField('description', content)}
            placeholder="Add a detailed description..."
            disabled={isLoading}
            className={errors.description ? 'border-red-300 dark:border-red-600' : ''}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
          )}
        </div>

        {/* Priority and Time Estimate Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Flag className="w-4 h-4 mr-2" />
              Priority
            </label>
            <PrioritySelector
              value={formData.priority}
              onChange={(priority) => updateField('priority', priority)}
              disabled={isLoading}
            />
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.priority}</p>
            )}
          </div>

          {/* Time Estimate */}
          <div>
            <label htmlFor="timeEstimate" className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Clock className="w-4 h-4 mr-2" />
              Time Estimate (minutes)
            </label>
            <input
              id="timeEstimate"
              type="number"
              min="0"
              max="1440"
              value={formData.timeEstimate || ''}
              onChange={(e) => updateField('timeEstimate', parseInt(e.target.value) || 0)}
              placeholder="0"
              disabled={isLoading}
              className={`
                w-full px-3 py-2 border rounded-lg
                bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                placeholder-slate-500 dark:placeholder-slate-400
                focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-all duration-200
                ${errors.timeEstimate 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />
            {errors.timeEstimate && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.timeEstimate}</p>
            )}
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <Calendar className="w-4 h-4 mr-2" />
            Due Date
          </label>
          <DatePicker
            value={formData.dueDate}
            onChange={(date) => updateField('dueDate', date)}
            placeholder="Select due date..."
            disabled={isLoading}
            minDate={new Date()}
          />
          {errors.dueDate && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dueDate}</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <Hash className="w-4 h-4 mr-2" />
            Tags
          </label>
          <TagInput
            tags={formData.tags}
            onChange={(tags) => updateField('tags', tags)}
            placeholder="Add tags (press Enter or comma to add)..."
            disabled={isLoading}
            maxTags={10}
          />
          {errors.tags && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tags}</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isDirty && !isEditMode && 'Unsaved changes'}
            {isDirty && isEditMode && 'You have unsaved changes'}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !isDirty}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg font-medium
                transition-all duration-200
                ${isLoading || !isDirty
                  ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md'
                }
              `}
            >
              <Save className="w-4 h-4" />
              <span>{isLoading ? 'Saving...' : isEditMode ? 'Update Task' : 'Create Task'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}