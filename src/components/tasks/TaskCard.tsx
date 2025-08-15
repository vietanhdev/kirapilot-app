// Task card component for displaying tasks
import { Task, Priority, TaskStatus } from '../../types';
import { getPriorityColor, getStatusColor, formatDuration, formatRelativeTime } from '../../utils';
import { 
  Clock, 
  Calendar, 
  Hash, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle,
  Circle,
  AlertCircle,
  Link
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  onStartTimer?: (task: Task) => void;
  className?: string;
  showActions?: boolean;
  viewMode?: 'list' | 'grid' | 'compact';
  allTasks?: Task[];
  isActive?: boolean;
  currentTime?: string;
}

export function TaskCard({ 
  task, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  onStartTimer,
  className = '',
  showActions = true,
  viewMode = 'list',
  allTasks = [],
  isActive = false,
  currentTime
}: TaskCardProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const isInProgress = task.status === TaskStatus.IN_PROGRESS;

  // Get dependency information
  const dependencyTasks = allTasks.filter(t => task.dependencies.includes(t.id));
  const blockedByIncomplete = dependencyTasks.filter(t => t.status !== TaskStatus.COMPLETED);
  const dependentTasks = allTasks.filter(t => t.dependencies.includes(task.id));
  const isBlocked = blockedByIncomplete.length > 0;

  const handleStatusToggle = () => {
    if (!onStatusChange) return;
    
    if (isCompleted) {
      onStatusChange(task, TaskStatus.PENDING);
    } else {
      onStatusChange(task, TaskStatus.COMPLETED);
    }
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case TaskStatus.COMPLETED:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case TaskStatus.IN_PROGRESS:
        return <Play className="w-5 h-5 text-blue-500" />;
      case TaskStatus.CANCELLED:
        return <Circle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getPriorityBadge = () => {
    const badges = {
      [Priority.URGENT]: { text: 'U', color: 'bg-red-500 text-white' },
      [Priority.HIGH]: { text: 'H', color: 'bg-orange-500 text-white' },
      [Priority.MEDIUM]: { text: 'M', color: 'bg-yellow-500 text-white' },
      [Priority.LOW]: { text: 'L', color: 'bg-green-500 text-white' },
    };
    
    const badge = badges[task.priority];
    return (
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${badge.color}`}>
        {badge.text}
      </div>
    );
  };

  // Compact view - ultra minimal like the design
  if (viewMode === 'compact') {
    return (
      <div className={`
        group relative bg-slate-800/30 hover:bg-slate-700/40 rounded-md border border-slate-700/30 
        transition-all duration-200 hover:border-slate-600/50
        ${isActive ? 'bg-emerald-900/20 border-emerald-700/50' : ''}
        ${isCompleted ? 'opacity-60' : ''}
        ${className}
      `}>
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Status + Task name */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={handleStatusToggle}
              className="flex-shrink-0 hover:scale-105 transition-transform duration-200"
              title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {isCompleted ? (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-400 hover:border-slate-300" />
              )}
            </button>
            
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-sm font-normal text-slate-200 truncate
                ${isCompleted ? 'line-through text-slate-500' : ''}
              `}>
                {task.title}
              </h3>
            </div>
          </div>

          {/* Right side - Simple time display */}
          <div className="flex items-center space-x-3 text-sm">
            {/* Active timer display */}
            {isActive && currentTime ? (
              <div className="font-mono text-emerald-400 tabular-nums">
                {currentTime}
              </div>
            ) : task.timeEstimate > 0 ? (
              <div className="text-slate-400 tabular-nums">
                {task.timeEstimate}min
              </div>
            ) : (
              <div className="text-slate-500 tabular-nums">
                --
              </div>
            )}
            
            {/* Simple start button - only show if not completed and not active */}
            {!isCompleted && !isActive && onStartTimer && (
              <button
                onClick={() => onStartTimer(task)}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-slate-400 hover:text-emerald-400"
                title="Start timer"
              >
                <Play className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Original detailed view
  return (
    <div className={`
      bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
      shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1
      ${isOverdue ? 'border-red-300 dark:border-red-600 bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-slate-800 ring-2 ring-red-200 dark:ring-red-800' : ''}
      ${isBlocked ? 'border-orange-300 dark:border-orange-600 bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800 ring-2 ring-orange-200 dark:ring-orange-800' : ''}
      ${isCompleted ? 'opacity-75' : ''}
      hover:scale-[1.02]
      ${className}
    `}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3 flex-1">
            {/* Status Toggle */}
            <button
              onClick={handleStatusToggle}
              className="mt-0.5 hover:scale-110 transition-transform duration-200"
              title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {getStatusIcon()}
            </button>

            {/* Title and Description */}
            <div className="flex-1 min-w-0">
              <h3 className={`
                font-semibold text-slate-900 dark:text-slate-100 mb-1
                ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : ''}
              `}>
                {task.title}
              </h3>
              
              {task.description && (
                <div 
                  className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              )}
            </div>
          </div>

          {/* Priority Badge */}
          <div className={`
            flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-semibold border
            ${getPriorityColor(task.priority)}
          `}>
            <div className={`w-2 h-2 rounded-full ${
              task.priority === Priority.URGENT ? 'bg-red-500' :
              task.priority === Priority.HIGH ? 'bg-orange-500' :
              task.priority === Priority.MEDIUM ? 'bg-yellow-500' :
              'bg-green-500'
            }`} />
            <span>{Priority[task.priority]}</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
          {/* Time Estimate */}
          {task.timeEstimate > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(task.timeEstimate * 60 * 1000)}</span>
            </div>
          )}

          {/* Actual Time */}
          {task.actualTime > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">
                {formatDuration(task.actualTime * 60 * 1000)} spent
              </span>
            </div>
          )}

          {/* Due Date */}
          {task.dueDate && (
            <div className={`flex items-center space-x-1 ${
              isOverdue ? 'text-red-600 dark:text-red-400' : ''
            }`}>
              <Calendar className="w-4 h-4" />
              <span>
                {isOverdue && <AlertCircle className="w-3 h-3 inline mr-1" />}
                Due {formatRelativeTime(task.dueDate)}
              </span>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div className={`flex items-center space-x-1 ${
              isBlocked ? 'text-red-600 dark:text-red-400' : ''
            }`}>
              <Link className="w-4 h-4" />
              <span>
                {task.dependencies.length} dependencies
                {isBlocked && ` (${blockedByIncomplete.length} incomplete)`}
              </span>
            </div>
          )}

          {/* Dependent Tasks */}
          {dependentTasks.length > 0 && (
            <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
              <Link className="w-4 h-4 rotate-180" />
              <span>{dependentTasks.length} tasks depend on this</span>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-center space-x-1">
            <span>Created {formatRelativeTime(task.createdAt)}</span>
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full"
              >
                <Hash className="w-3 h-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Dependency Details */}
        {(dependencyTasks.length > 0 || dependentTasks.length > 0) && (
          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
            {/* Dependencies */}
            {dependencyTasks.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Dependencies:
                </h4>
                <div className="space-y-1">
                  {dependencyTasks.map((dep) => (
                    <div key={dep.id} className="flex items-center space-x-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${
                        dep.status === TaskStatus.COMPLETED 
                          ? 'bg-green-500' 
                          : 'bg-orange-500'
                      }`} />
                      <span className={`${
                        dep.status === TaskStatus.COMPLETED 
                          ? 'text-green-700 dark:text-green-400 line-through' 
                          : 'text-orange-700 dark:text-orange-400'
                      }`}>
                        {dep.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dependent Tasks */}
            {dependentTasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Blocks:
                </h4>
                <div className="space-y-1">
                  {dependentTasks.slice(0, 3).map((dep) => (
                    <div key={dep.id} className="flex items-center space-x-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-blue-700 dark:text-blue-400">
                        {dep.title}
                      </span>
                    </div>
                  ))}
                  {dependentTasks.length > 3 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      +{dependentTasks.length - 3} more tasks
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className={`
            px-2 py-1 rounded text-xs font-medium border
            ${getStatusColor(task.status)}
          `}>
            {task.status.replace('_', ' ').toUpperCase()}
            {task.completedAt && (
              <span className="ml-2 text-slate-500">
                • Completed {formatRelativeTime(task.completedAt)}
              </span>
            )}
          </div>

          {/* Blocked Indicator */}
          {isBlocked && (
            <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-medium rounded border border-orange-300 dark:border-orange-600">
              BLOCKED
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              {/* Start Timer */}
              {onStartTimer && !isCompleted && (
                <button
                  onClick={() => onStartTimer(task)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors duration-200"
                  title="Start timer"
                >
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </button>
              )}

              {/* Progress Indicator */}
              {isInProgress && (
                <div className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg">
                  <Pause className="w-4 h-4" />
                  <span>In Progress</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {/* Edit */}
              {onEdit && (
                <button
                  onClick={() => onEdit(task)}
                  className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200"
                  title="Edit task"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}

              {/* Delete */}
              {onDelete && (
                <button
                  onClick={() => onDelete(task)}
                  className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}