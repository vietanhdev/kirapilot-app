// Daily kanban view for focused day planning
import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task, TaskStatus, TaskTimerProps } from '../../types';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { useResponsiveColumnWidth } from '../../hooks';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  ArrowRight,
  Archive,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface DayViewProps {
  tasks: Task[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTaskMove: (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => void;
  onTaskEdit: (task: Task) => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
  onTaskCreate: (task: Task) => void;
  onInlineEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task) => void;
  onViewTimeHistory?: (task: Task) => void;
  getTaskTimerProps?: (task: Task) => TaskTimerProps;
  className?: string;
  columnHeight?: number;
}

export function DayView({
  tasks,
  selectedDate,
  onDateChange,
  onTaskMove,
  onTaskEdit: _onTaskEdit,
  onTaskStatusChange,
  onTaskCreate,
  onInlineEdit,
  onTaskDelete,
  onViewTimeHistory,
  getTaskTimerProps,
  className = '',
  columnHeight,
}: DayViewProps) {
  const { t } = useTranslation();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [, setTaskModalColumn] = useState<string>('');
  const [taskModalDate, setTaskModalDate] = useState<Date | undefined>();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  // Categorize tasks based on scheduled dates and status
  const taskCategories = useMemo(() => {
    const selectedDay = new Date(selectedDate);
    selectedDay.setHours(0, 0, 0, 0);

    const actualToday = new Date();
    actualToday.setHours(0, 0, 0, 0);

    console.log('DayView filtering:', {
      selectedDate: selectedDate.toISOString(),
      selectedDay: selectedDay.toISOString(),
      actualToday: actualToday.toISOString(),
      isViewingToday: selectedDay.getTime() === actualToday.getTime(),
      totalTasks: tasks.length,
    });

    const backlog: Task[] = [];
    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const next: Task[] = [];

    tasks.forEach(task => {
      // Tasks without scheduled date go to backlog
      if (!task.scheduledDate) {
        console.log(`Task "${task.title}" -> backlog (no scheduled date)`);
        backlog.push(task);
        return;
      }

      const scheduledDate = new Date(task.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);

      console.log(`Processing task "${task.title}":`, {
        scheduledDate: scheduledDate.toISOString(),
        selectedDay: selectedDay.toISOString(),
        actualToday: actualToday.toISOString(),
        isExactMatch: scheduledDate.getTime() === selectedDay.getTime(),
        isOverdue:
          scheduledDate < actualToday && task.status !== TaskStatus.COMPLETED,
        isFuture: scheduledDate > selectedDay,
        status: task.status,
      });

      // Tasks scheduled exactly on the selected day go to "today" column
      if (scheduledDate.getTime() === selectedDay.getTime()) {
        console.log(`Task "${task.title}" -> today (exact schedule match)`);
        todayTasks.push(task);
      }
      // Overdue tasks (scheduled before actual today and not completed)
      else if (
        scheduledDate < actualToday &&
        task.status !== TaskStatus.COMPLETED
      ) {
        console.log(
          `Task "${task.title}" -> overdue (past due and not completed)`
        );
        overdue.push(task);
      }
      // Future scheduled tasks (relative to selected day) go to "next" column
      else if (scheduledDate > selectedDay) {
        console.log(`Task "${task.title}" -> next (future schedule)`);
        next.push(task);
      }
      // Completed past tasks are ignored in day view
      else {
        console.log(
          `Task "${task.title}" -> ignored (completed or past scheduled date: ${scheduledDate.toISOString()})`
        );
      }
    });

    const result = {
      backlog: backlog.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      overdue: overdue.sort((a, b) => {
        // Sort overdue tasks by how overdue they are (oldest first)
        if (a.scheduledDate && b.scheduledDate) {
          return (
            new Date(a.scheduledDate).getTime() -
            new Date(b.scheduledDate).getTime()
          );
        }
        return (a.priority || 0) - (b.priority || 0);
      }),
      today: todayTasks.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      next: next.sort((a, b) => {
        if (a.scheduledDate && b.scheduledDate) {
          return (
            new Date(a.scheduledDate).getTime() -
            new Date(b.scheduledDate).getTime()
          );
        }
        return 0;
      }),
    };

    console.log('DayView categorization result:', {
      backlog: result.backlog.length,
      overdue: result.overdue.length,
      today: result.today.length,
      next: result.next.length,
      backlogTasks: result.backlog.map(t => t.title),
      overdueTasks: result.overdue.map(t => t.title),
      todayTasks: result.today.map(t => t.title),
      nextTasks: result.next.map(t => t.title),
    });

    return result;
  }, [tasks, selectedDate]);

  // Calculate day statistics
  const dayStats = useMemo(() => {
    const total = Object.values(taskCategories).reduce(
      (sum, categoryTasks) => sum + categoryTasks.length,
      0
    );
    const completed = Object.values(taskCategories).reduce(
      (sum, categoryTasks) =>
        sum +
        categoryTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      0
    );
    const inProgress = Object.values(taskCategories).reduce(
      (sum, categoryTasks) =>
        sum +
        categoryTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      0
    );
    const overdue = taskCategories.overdue?.length || 0;

    return { total, completed, inProgress, overdue };
  }, [taskCategories]);

  // Calculate responsive column widths - 4 columns total (Backlog, Overdue, Today, Tomorrow/Future)
  const totalColumns = 4;
  const { columnWidth } = useResponsiveColumnWidth(totalColumns, {
    minWidth: 280,
    maxWidth: 400,
    gap: 12, // gap-3 in Tailwind
    padding: 24, // p-3 * 2 sides
  });

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

    // Set appropriate default date based on column
    let defaultDate = date;
    if (!defaultDate) {
      if (column.toLowerCase() === 'overdue') {
        // For overdue column, default to yesterday
        defaultDate = new Date(selectedDate);
        defaultDate.setDate(defaultDate.getDate() - 1);
      } else if (column.toLowerCase() === 'next tasks') {
        // For next tasks column, default to tomorrow
        defaultDate = new Date(selectedDate);
        defaultDate.setDate(defaultDate.getDate() + 1);
      } else {
        // For other columns, use selected date
        defaultDate = selectedDate;
      }
    }

    setTaskModalDate(defaultDate);
    setShowTaskModal(true);
  };

  const handleTaskCreate = (task: Task) => {
    console.log('Creating task:', task);
    onTaskCreate(task);
    setShowTaskModal(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !draggedTask) {
      setDraggedTask(null);
      return;
    }

    const taskId = active.id as string;
    const droppedColumnData = over.data.current;

    if (droppedColumnData?.type === 'column') {
      const toColumn = droppedColumnData.title;

      // Determine the new scheduled date based on the column
      let newDate: Date | undefined;

      if (toColumn === 'backlog') {
        // Moving to backlog - remove scheduled date (backlog = no scheduled date)
        newDate = undefined;
      } else if (toColumn === 'overdue') {
        // Moving to overdue - set to yesterday (or keep existing if already overdue)
        newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 1);
      } else if (toColumn === 'today') {
        // Moving to today - set to selected date
        newDate = new Date(selectedDate);
      } else if (toColumn === 'next tasks') {
        // Moving to next tasks - set to tomorrow
        newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 1);
      }

      console.log('DayView drag end:', {
        taskId,
        toColumn,
        newDate,
        taskTitle: draggedTask.title,
      });

      // Call the move handler with the new date
      onTaskMove(taskId, 'drag', toColumn, newDate);
    }

    setDraggedTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={event => {
        const task = tasks.find(t => t.id === event.active.id);
        setDraggedTask(task || null);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className={`bg-content1 backdrop-blur-sm rounded-lg ${className}`}>
        {/* Header */}
        <div className='p-2 bg-content2 backdrop-blur-sm rounded-t-lg border-b border-divider'>
          <div className='flex items-center justify-between mb-1'>
            <div className='flex items-center space-x-2'>
              <span className='text-sm font-medium text-foreground'>
                {formatDate()}
                {isToday && (
                  <span className='ml-2 w-2 h-2 bg-primary-500 rounded-full inline-block animate-pulse'></span>
                )}
              </span>
            </div>

            <div className='flex items-center space-x-3'>
              {/* Date Navigation */}
              <div className='flex items-center space-x-1'>
                <button
                  onClick={() => navigateDay('prev')}
                  className='p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200'
                  title={t('planning.previousDay')}
                >
                  <ChevronLeft className='w-4 h-4 text-foreground-600' />
                </button>

                <button
                  onClick={() => onDateChange(new Date())}
                  className='px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors duration-200'
                  title={t('planning.goToToday')}
                >
                  {t('planning.today')}
                </button>

                <button
                  onClick={() => navigateDay('next')}
                  className='p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200'
                  title={t('planning.nextDay')}
                >
                  <ChevronRight className='w-4 h-4 text-foreground-600' />
                </button>
              </div>
            </div>
          </div>

          {/* Day Statistics */}
          <div className='flex items-center space-x-4 text-xs'>
            <div className='flex items-center space-x-1'>
              <Clock className='w-3 h-3 text-blue-500' />
              <span className='text-foreground-600'>
                {dayStats.total} total
              </span>
            </div>
            <div className='flex items-center space-x-1'>
              <div className='w-2 h-2 bg-green-500 rounded-full'></div>
              <span className='text-foreground-600'>
                {dayStats.completed} done
              </span>
            </div>
            <div className='flex items-center space-x-1'>
              <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
              <span className='text-foreground-600'>
                {dayStats.inProgress} active
              </span>
            </div>
            {dayStats.overdue > 0 && (
              <div className='flex items-center space-x-1'>
                <div className='w-2 h-2 bg-red-500 rounded-full'></div>
                <span className='text-foreground-600'>
                  {dayStats.overdue} overdue
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Kanban Columns */}
        <div className='p-3'>
          <div className='flex gap-3 overflow-x-auto pb-4'>
            {/* Backlog Column */}
            <TaskColumn
              title={t('planning.backlog')}
              icon={Archive}
              count={taskCategories.backlog.length}
              color='blue'
              onAddTask={() => handleAddTask('Backlog')}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {taskCategories.backlog.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>

            {/* Overdue Column */}
            <TaskColumn
              title={t('planning.overdue')}
              icon={AlertTriangle}
              count={taskCategories.overdue.length}
              color='red'
              onAddTask={() => handleAddTask('Overdue')}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {taskCategories.overdue.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>

            {/* Today Column */}
            <TaskColumn
              title={t('planning.today')}
              icon={Sun}
              count={taskCategories.today.length}
              color='gray'
              isToday={true}
              onAddTask={() => handleAddTask('Today', selectedDate)}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {taskCategories.today.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>

            {/* Next Tasks Column */}
            <TaskColumn
              title={t('planning.nextTasks')}
              icon={ArrowRight}
              count={taskCategories.next.length}
              color='purple'
              onAddTask={() => handleAddTask('Next Tasks')}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {taskCategories.next.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>
          </div>
        </div>

        {/* Task Creation Modal */}
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => {
            console.log('Closing task modal');
            setShowTaskModal(false);
          }}
          onCreateTask={handleTaskCreate}
          defaultDate={taskModalDate}
        />

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedTask ? (
            <TaskCard
              task={draggedTask}
              onEdit={() => {}}
              onStatusChange={() => {}}
              onDelete={() => {}}
              {...(getTaskTimerProps?.(draggedTask) || {})}
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
