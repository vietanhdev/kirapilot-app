// Planning column component for kanban-style layout
import { ReactNode, Children, isValidElement } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, LucideIcon } from 'lucide-react';
import { Task } from '../../types';

interface TaskColumnProps {
  title: string;
  subtitle?: string;
  count: number;
  color: 'gray' | 'slate' | 'blue' | 'green' | 'purple' | 'orange' | 'red';
  icon?: LucideIcon;
  isToday?: boolean;
  onAddTask: () => void;
  children: ReactNode;
  className?: string;
}

export function TaskColumn({
  title,
  subtitle,
  count,
  color,
  icon: Icon,
  isToday = false,
  onAddTask,
  children,
  className = '',
}: TaskColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: title.toLowerCase(),
    data: {
      type: 'column',
      title: title.toLowerCase(),
    },
  });

  // Extract task IDs from children for SortableContext
  const taskIds = Children.toArray(children)
    .filter(child => isValidElement(child))
    .map(child => {
      if (
        child.props &&
        typeof child.props === 'object' &&
        'task' in child.props &&
        child.props.task &&
        typeof child.props.task === 'object' &&
        'id' in child.props.task
      ) {
        return (child.props.task as Task).id;
      }
      return null;
    })
    .filter(Boolean) as string[];

  const getColorClasses = () => {
    const colors = {
      gray: {
        header: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
        border: 'border-gray-200 dark:border-gray-600',
        count: 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300',
        accent: 'border-gray-300 dark:border-gray-500',
      },
      slate: {
        header:
          'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
        border: 'border-slate-200 dark:border-slate-600',
        count:
          'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300',
        accent: 'border-slate-300 dark:border-slate-500',
      },
      blue: {
        header:
          'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
        border: 'border-blue-200 dark:border-blue-700',
        count: 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200',
        accent: 'border-blue-400 dark:border-blue-500',
      },
      green: {
        header:
          'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200',
        border: 'border-green-200 dark:border-green-700',
        count:
          'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200',
        accent: 'border-green-400 dark:border-green-500',
      },
      purple: {
        header:
          'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
        border: 'border-purple-200 dark:border-purple-700',
        count:
          'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200',
        accent: 'border-purple-400 dark:border-purple-500',
      },
      orange: {
        header:
          'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
        border: 'border-orange-200 dark:border-orange-700',
        count:
          'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200',
        accent: 'border-orange-400 dark:border-orange-500',
      },
      red: {
        header: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200',
        border: 'border-red-200 dark:border-red-700',
        count: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200',
        accent: 'border-red-400 dark:border-red-500',
      },
    };
    return colors[color];
  };

  const colorClasses = getColorClasses();

  return (
    <div
      className={`
        shrink-0 w-64 bg-white dark:bg-gray-800/30 rounded-lg border transition-all duration-200
        ${isOver ? 'border-primary-400 bg-primary-500/10 scale-[1.02]' : colorClasses.border}
        ${isToday ? 'border-primary-500/50 shadow-lg shadow-primary-500/10' : ''}
        hover:shadow-md backdrop-blur-sm
        ${className}
      `}
    >
      {/* Column Header */}
      <div className={`p-2.5 border-b ${colorClasses.header} rounded-t-lg`}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2 min-w-0 flex-1'>
            {Icon && <Icon className='w-4 h-4 shrink-0' />}
            <div className='min-w-0 flex-1'>
              <div className='flex items-center space-x-1'>
                <h3
                  className={`font-semibold text-base truncate ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {title}
                  {subtitle && (
                    <span
                      className={`ml-1 text-sm font-normal ${isToday ? 'text-primary-500 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      {subtitle}
                    </span>
                  )}
                </h3>
                {isToday && (
                  <div className='w-2 h-2 bg-primary-500 rounded-full animate-pulse'></div>
                )}
              </div>
            </div>
          </div>

          <div className='flex items-center space-x-1.5 shrink-0'>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                isToday
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-200 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400'
              }`}
            >
              {count}
            </span>
            <button
              onClick={onAddTask}
              className={`p-1 rounded-md transition-all duration-200 ${
                isToday
                  ? 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/30'
              }`}
              title='Add task'
            >
              <Plus className='w-3.5 h-3.5' />
            </button>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`
          min-h-[400px] max-h-[500px] overflow-y-auto p-2 space-y-2 transition-all duration-300
          scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 
          scrollbar-track-gray-100 dark:scrollbar-track-gray-800
          hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-500
          ${isOver ? 'bg-primary-50 dark:bg-primary-900/20 scale-[0.98]' : ''}
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>

        {/* Drop Indicator */}
        {isOver && (
          <div className='border-2 border-dashed border-primary-400 rounded-lg p-4 text-center bg-primary-500/10 animate-in fade-in slide-in-from-top-2 duration-200'>
            <div className='animate-bounce'>
              <Plus className='w-6 h-6 mx-auto mb-1 text-primary-400' />
              <p className='text-xs text-primary-400 font-medium'>
                Drop task here
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {count === 0 && !isOver && (
          <div className='text-center py-6 border-2 border-dashed border-gray-600 rounded-lg'>
            <div className='text-xs text-gray-500 text-center'>
              {isOver ? 'Drop task here' : 'No tasks'}
            </div>
            <p className='text-xs text-gray-600 mt-1'>
              Drag tasks here or click + to add
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
