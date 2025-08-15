// Daily kanban view for focused day planning
import { useState, useMemo } from 'react';
import { Task, TaskStatus } from '../../types';
import { PlanningColumn } from './PlanningColumn';
import { PlanningTaskCard } from './PlanningTaskCard';
import { TaskCreationModal } from './TaskCreationModal';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  ArrowRight,
  Archive,
  Clock
} from 'lucide-react';

interface DayViewProps {
  tasks: Task[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTaskMove: (taskId: string, fromColumn: string, toColumn: string, date?: Date) => void;
  onTaskEdit: (task: Task) => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
  onTaskCreate: (task: Task) => void;
  onInlineEdit?: (taskId: string, updates: Partial<Task>) => void;
  className?: string;
}

export function DayView({
  tasks,
  selectedDate,
  onDateChange,
  onTaskMove,
  onTaskEdit,
  onTaskStatusChange,
  onTaskCreate,
  onInlineEdit,
  className = ''
}: DayViewProps) {
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalColumn, setTaskModalColumn] = useState<string>('');
  const [taskModalDate, setTaskModalDate] = useState<Date | undefined>();

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  // Categorize tasks based on due dates and status
  const taskCategories = useMemo(() => {
    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const backlog: Task[] = [];
    const todayTasks: Task[] = [];
    const next: Task[] = [];

    tasks.forEach(task => {
      if (!task.dueDate) {
        backlog.push(task);
        return;
      }

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today && task.status !== TaskStatus.COMPLETED) {
        backlog.push(task);
      } else if (dueDate.getTime() === today.getTime()) {
        todayTasks.push(task);
      } else if (dueDate > today) {
        next.push(task);
      }
    });

    return {
      backlog: backlog.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      today: todayTasks.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      next: next.sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      })
    };
  }, [tasks, selectedDate]);

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return selectedDate.toLocaleDateString('en-US', options);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    onDateChange(newDate);
  };

  const handleAddTask = (column: string, date?: Date) => {
    console.log('Add task clicked for column:', column, 'date:', date);
    setTaskModalColumn(column);
    setTaskModalDate(date || selectedDate);
    setShowTaskModal(true);
  };

  const handleTaskCreate = (task: Task) => {
    console.log('Creating task:', task);
    onTaskCreate(task);
    setShowTaskModal(false);
  };

  // Calculate day statistics
  const dayStats = useMemo(() => {
    const total = Object.values(taskCategories).reduce((sum, categoryTasks) => sum + categoryTasks.length, 0);
    const completed = Object.values(taskCategories).reduce((sum, categoryTasks) => 
      sum + categoryTasks.filter(t => t.status === TaskStatus.COMPLETED).length, 0
    );
    const inProgress = Object.values(taskCategories).reduce((sum, categoryTasks) => 
      sum + categoryTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length, 0
    );
    
    return { total, completed, inProgress };
  }, [taskCategories]);

  return (
    <div className={`bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-2 bg-gray-200 dark:bg-gray-700/50 backdrop-blur-sm rounded-t-lg border-b border-gray-300 dark:border-gray-700/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatDate()}
              {isToday && (
                <span className="ml-2 w-2 h-2 bg-primary-500 rounded-full inline-block animate-pulse"></span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Date Navigation */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigateDay('prev')}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              
              <button
                onClick={() => onDateChange(new Date())}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors duration-200"
                title="Go to today"
              >
                Today
              </button>
              
              <button
                onClick={() => navigateDay('next')}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Day Statistics */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {dayStats.total} total
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">
              {dayStats.completed} done
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">
              {dayStats.inProgress} active
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="p-3">
        <div className="flex gap-3 overflow-x-auto pb-4">
          {/* Backlog Column */}
          <PlanningColumn
            title="Backlog"
            icon={Archive}
            count={taskCategories.backlog.length}
            color="slate"
            onAddTask={() => handleAddTask('Backlog')}
          >
            {taskCategories.backlog.map(task => (
              <PlanningTaskCard
                key={task.id}
                task={task}
                onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                onStatusChange={(status) => onTaskStatusChange(task, status)}
              />
            ))}
          </PlanningColumn>

          {/* Today Column */}
          <PlanningColumn
            title="Today"
            icon={Sun}
            count={taskCategories.today.length}
            color="blue"
            isToday={true}
            onAddTask={() => handleAddTask('Today', selectedDate)}
          >
            {taskCategories.today.map(task => (
              <PlanningTaskCard
                key={task.id}
                task={task}
                onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                onStatusChange={(status) => onTaskStatusChange(task, status)}
              />
            ))}
          </PlanningColumn>

          {/* Next Tasks Column */}
          <PlanningColumn
            title="Next Tasks"
            icon={ArrowRight}
            count={taskCategories.next.length}
            color="purple"
            onAddTask={() => handleAddTask('Next Tasks')}
          >
            {taskCategories.next.map(task => (
              <PlanningTaskCard
                key={task.id}
                task={task}
                onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                onStatusChange={(status) => onTaskStatusChange(task, status)}
              />
            ))}
          </PlanningColumn>
        </div>
      </div>

      {/* Task Creation Modal */}
      <TaskCreationModal
        isOpen={showTaskModal}
        onClose={() => {
          console.log('Closing task modal');
          setShowTaskModal(false);
        }}
        onCreateTask={handleTaskCreate}
        defaultDate={taskModalDate}
        defaultColumn={taskModalColumn}
      />
    </div>
  );
}