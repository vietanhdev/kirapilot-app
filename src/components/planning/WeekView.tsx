// Weekly kanban view with day columns
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, TaskTimerProps, VirtualTask } from '../../types';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
// Removed complex placeholder and keyboard navigation utilities

import { useTranslation } from '../../hooks/useTranslation';
import { useResponsiveColumnWidth } from '../../hooks';
import { useTaskList } from '../../contexts/TaskListContext';

import {
  ChevronLeft,
  ChevronRight,
  Archive,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface WeekViewProps {
  tasks: (Task | VirtualTask)[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTaskMove: (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => void;
  onTaskEdit: (task: Task) => void;
  onTaskStatusChange: (task: Task | VirtualTask, status: TaskStatus) => void;
  onTaskCreate: (task: Task) => Promise<void>;
  onInlineEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task | VirtualTask) => void;
  onViewTimeHistory?: (task: Task) => void;
  getTaskTimerProps?: (task: Task) => TaskTimerProps;
  columnHeight?: number;
}

export function WeekView({
  tasks,
  currentWeek,
  onWeekChange,
  onTaskMove,
  onTaskEdit: _onTaskEdit,
  onTaskStatusChange,
  onTaskCreate,
  onInlineEdit,
  onTaskDelete,
  onViewTimeHistory,
  getTaskTimerProps,
  columnHeight,
}: WeekViewProps) {
  const { t } = useTranslation();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState<Date | undefined>();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Get task list context for indicators
  const { isAllSelected, taskLists } = useTaskList();

  // Calculate week boundaries
  const weekStart = useMemo(() => {
    const date = new Date(currentWeek);
    const day = date.getDay();
    const diff = date.getDate() - day; // Sunday = 0
    return new Date(date.setDate(diff));
  }, [currentWeek]);

  const weekEnd = useMemo(() => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + 6);
    date.setHours(23, 59, 59, 999);
    return date;
  }, [weekStart]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Define weekDays before it's used in handleDragEnd
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        name: date.toLocaleDateString('en-US', { weekday: 'long' }),
        shortName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        isToday: isToday(date),
      });
    }
    return days;
  }, [weekStart]);

  // Helper function to find which column a task belongs to (similar to example)
  const findTaskColumn = useCallback(
    (taskId: string | null) => {
      if (!taskId) {
        return null;
      }

      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        return null;
      }

      // Determine column based on task's scheduled date
      if (!task.scheduledDate) {
        return { id: 'backlog', name: 'backlog', date: undefined };
      }

      const taskDate = new Date(task.scheduledDate);

      // Check if it matches any of the week days
      const matchingDay = weekDays.find(
        day => taskDate.toDateString() === day.date.toDateString()
      );

      if (matchingDay) {
        return {
          id: matchingDay.shortName.toLowerCase(),
          name: matchingDay.shortName.toLowerCase(),
          date: matchingDay.date,
        };
      }

      // Check if it's upcoming (future dates not in current week)
      if (taskDate > weekEnd) {
        return { id: 'upcoming', name: 'upcoming', date: undefined };
      }

      return { id: 'backlog', name: 'backlog', date: undefined };
    },
    [tasks, weekDays, weekEnd]
  );

  // Simplified handleDragOver - just for visual feedback
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Keep this minimal - just for visual feedback
    // All actual logic will be in handleDragEnd
  }, []);

  // Unified handleDragEnd - handles both cross-column and same-column moves
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Clean up drag state
      setDraggedTask(null);

      if (!over || !active) {
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);
      const overData = over.data.current;

      // Get source and target columns
      const activeColumn = findTaskColumn(activeId);

      let targetColumn: { id: string; name: string; date?: Date } | null = null;
      let targetDate: Date | undefined;

      // Determine target column and date
      if (overData?.type === 'column') {
        // Dropped on column header/empty area
        const columnName = overData.title;

        if (columnName === 'backlog') {
          targetColumn = { id: 'backlog', name: 'backlog' };
          targetDate = undefined;
        } else if (columnName === 'upcoming') {
          targetColumn = { id: 'upcoming', name: 'upcoming' };
          targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + 7);
        } else {
          // Day column
          const dayColumn = weekDays.find(
            day => day.shortName.toLowerCase() === columnName
          );
          if (dayColumn) {
            targetColumn = {
              id: dayColumn.shortName.toLowerCase(),
              name: dayColumn.shortName.toLowerCase(),
              date: dayColumn.date,
            };
            targetDate = new Date(dayColumn.date);
          }
        }
      } else if (overData?.type === 'task') {
        // Dropped on another task
        const overColumn = findTaskColumn(overId);
        if (overColumn) {
          targetColumn = overColumn;
          targetDate = overColumn.date;
        }
      }

      if (!activeColumn || !targetColumn) {
        return;
      }

      // If moving to a different column, handle cross-column move
      if (activeColumn.id !== targetColumn.id) {
        onTaskMove(activeId, 'drag', targetColumn.name, targetDate);
        return;
      }

      // Same column reordering - only if dropped on another task
      if (overData?.type === 'task' && activeId !== overId) {
        // Get tasks in this column, sorted by current order
        const columnTasks = tasks
          .filter(task => {
            const taskColumn = findTaskColumn(task.id);
            return taskColumn?.id === activeColumn.id;
          })
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        const activeIndex = columnTasks.findIndex(task => task.id === activeId);
        const overIndex = columnTasks.findIndex(task => task.id === overId);

        if (
          activeIndex !== -1 &&
          overIndex !== -1 &&
          activeIndex !== overIndex
        ) {
          // Reorder the tasks using arrayMove
          const reorderedTasks = arrayMove(columnTasks, activeIndex, overIndex);

          // Update all tasks in the column with new order values
          reorderedTasks.forEach((task, index) => {
            if (onInlineEdit) {
              onInlineEdit(task.id, { order: index });
            }
          });
        }
      }
    },
    [findTaskColumn, tasks, weekDays, onTaskMove, onInlineEdit]
  );

  // Removed complex keyboard navigation and placeholder management code

  // Auto-scroll to today's column
  useEffect(() => {
    const scrollToToday = () => {
      const container = document.getElementById('week-columns-container');
      const todayColumn = document.querySelector('.today-column');

      if (container && todayColumn) {
        const containerRect = container.getBoundingClientRect();
        const columnRect = todayColumn.getBoundingClientRect();
        const scrollLeft =
          columnRect.left -
          containerRect.left +
          container.scrollLeft -
          containerRect.width / 2 +
          columnRect.width / 2;

        container.scrollTo({
          left: Math.max(0, scrollLeft),
          behavior: 'smooth',
        });
      }
    };

    // Small delay to ensure DOM is rendered
    const timeoutId = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timeoutId);
  }, [currentWeek]); // Re-run when week changes

  // Optimized sensors for better performance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require more movement to prevent accidental drags
        delay: 100, // Small delay to prevent conflicts with clicks
        tolerance: 5, // Allow some tolerance for pointer movement
      },
    })
  );

  // Calculate responsive column widths - 7 day columns + 1 backlog + 1 upcoming = 9 columns total
  const totalColumns = 9;
  const { columnWidth } = useResponsiveColumnWidth(totalColumns, {
    minWidth: 260,
    maxWidth: 360,
    gap: 8, // gap-2 in Tailwind
    padding: 16, // p-2 * 2 sides
  });

  // Get tasks for specific day (that day + overdue scheduled tasks if it's today)
  const getTasksForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      const scheduledDate = new Date(task.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);

      // Tasks scheduled exactly on this day
      if (scheduledDate.getTime() === dayStart.getTime()) {
        return true;
      }

      return false;
    });

    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Get backlog tasks (tasks without scheduled date)
  const backlogTasks = useMemo(() => {
    const filtered = tasks.filter(task => {
      // Only tasks with no scheduled date go to backlog
      return !task.scheduledDate;
    });
    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [tasks]);

  // Get upcoming tasks (STRICTLY after this week)
  const upcomingTasks = useMemo(() => {
    const filtered = tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      const scheduledDate = new Date(task.scheduledDate);
      return scheduledDate > weekEnd;
    });
    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [tasks, weekEnd]);

  const formatWeekRange = () => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };
    const start = weekStart.toLocaleDateString('en-US', options);
    const end = new Date(weekEnd).toLocaleDateString('en-US', options);
    return `${start} - ${end}, ${weekStart.getFullYear()}`;
  };

  const handleAddTask = (column: string, date?: Date) => {
    // Set appropriate default date based on column
    let defaultDate = date;
    if (!defaultDate && column.toLowerCase() === 'upcoming') {
      // For upcoming column, default to next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      defaultDate = nextWeek;
    }

    setTaskModalDate(defaultDate);
    setShowTaskModal(true);
  };

  const handleTaskCreate = async (task: Task) => {
    try {
      await onTaskCreate(task);
      setShowTaskModal(false);
    } catch (error) {
      // Let the error bubble up to be handled by the TaskModal
      throw error;
    }
  };

  // Old complex drag over handler removed - using simplified version above

  // Calculate week statistics
  const weekStats = useMemo(() => {
    const allWeekTasks = [...backlogTasks, ...upcomingTasks];
    weekDays.forEach(day => {
      allWeekTasks.push(...getTasksForDay(day.date));
    });

    const total = allWeekTasks.length;
    const completed = allWeekTasks.filter(
      t => t.status === TaskStatus.COMPLETED
    ).length;
    const inProgress = allWeekTasks.filter(
      t => t.status === TaskStatus.IN_PROGRESS
    ).length;

    return { total, completed, inProgress };
  }, [backlogTasks, upcomingTasks, weekDays, tasks]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={event => {
        const task = tasks.find(t => t.id === event.active.id);
        setDraggedTask(task || null);
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`bg-content1 backdrop-blur-sm rounded-lg border border-divider`}
      >
        {/* Header */}
        <div className='p-2 bg-content2 backdrop-blur-sm rounded-t-lg border-b border-divider'>
          <div className='flex items-center justify-between mb-1'>
            <div className='flex items-center space-x-2'>
              <span className='text-sm font-medium text-foreground'>
                {formatWeekRange()}
              </span>
            </div>

            <div className='flex items-center space-x-3'>
              {/* Week Navigation */}
              <div className='flex items-center space-x-1'>
                <button
                  onClick={() => {
                    const newDate = new Date(currentWeek);
                    newDate.setDate(newDate.getDate() - 7);
                    onWeekChange(newDate);
                  }}
                  className='p-1 hover:bg-content3 rounded transition-colors duration-200'
                  title={t('planning.previousWeek') || 'Previous week'}
                >
                  <ChevronLeft className='w-4 h-4 text-foreground-600' />
                </button>

                <button
                  onClick={() => onWeekChange(new Date())}
                  className='px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors duration-200'
                  title={t('planning.goToCurrentWeek')}
                >
                  {t('planning.thisWeek')}
                </button>

                <button
                  onClick={() => {
                    const newDate = new Date(currentWeek);
                    newDate.setDate(newDate.getDate() + 7);
                    onWeekChange(newDate);
                  }}
                  className='p-1 hover:bg-content3 rounded transition-colors duration-200'
                  title={t('planning.nextWeek') || 'Next week'}
                >
                  <ChevronRight className='w-4 h-4 text-foreground-600' />
                </button>
              </div>
            </div>
          </div>

          {/* Week Statistics */}
          <div className='flex items-center space-x-4 text-xs'>
            <div className='flex items-center space-x-1'>
              <TrendingUp className='w-3 h-3 text-blue-500' />
              <span className='text-foreground-600'>
                {weekStats.total} {t('planning.total')}
              </span>
            </div>
            <div className='flex items-center space-x-1'>
              <div className='w-2 h-2 bg-green-500 rounded-full'></div>
              <span className='text-foreground-600'>
                {weekStats.completed} {t('planning.done')}
              </span>
            </div>
            <div className='flex items-center space-x-1'>
              <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
              <span className='text-foreground-600'>
                {weekStats.inProgress} {t('planning.active')}
              </span>
            </div>
          </div>
        </div>

        {/* Kanban Columns - Single Row with Auto-Scroll */}
        <div className='p-2'>
          <div
            id='week-columns-container'
            className='flex gap-2 overflow-x-auto pb-4 scroll-smooth week-scroller'
          >
            {/* Backlog Column */}
            <TaskColumn
              title='Backlog'
              icon={Archive}
              count={backlogTasks.length}
              color='blue'
              onAddTask={() => handleAddTask('Backlog')}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {backlogTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>

            {/* Daily Columns */}
            {weekDays.map(day => {
              const dayTasks = getTasksForDay(day.date);
              return (
                <TaskColumn
                  key={day.date.toISOString()}
                  title={day.shortName}
                  subtitle={`${day.dayNumber}`}
                  count={dayTasks.length}
                  color={day.isToday ? 'blue' : 'gray'}
                  isToday={day.isToday}
                  onAddTask={() => handleAddTask(day.shortName, day.date)}
                  className={day.isToday ? 'today-column' : ''}
                  columnHeight={columnHeight}
                  columnWidth={columnWidth}
                >
                  {dayTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={updates => onInlineEdit?.(task.id, updates)}
                      onStatusChange={status =>
                        onTaskStatusChange(task, status)
                      }
                      onDelete={onTaskDelete}
                      onViewTimeHistory={onViewTimeHistory}
                      showTaskListIndicator={isAllSelected()}
                      taskListName={
                        taskLists.find(list => list.id === task.taskListId)
                          ?.name
                      }
                      {...(getTaskTimerProps?.(task) || {})}
                    />
                  ))}
                </TaskColumn>
              );
            })}

            {/* Upcoming Tasks Column */}
            <TaskColumn
              title='Upcoming'
              icon={Clock}
              count={upcomingTasks.length}
              color='purple'
              onAddTask={() => handleAddTask('Upcoming')}
              columnHeight={columnHeight}
              columnWidth={columnWidth}
            >
              {upcomingTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onInlineEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
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
            setShowTaskModal(false);
          }}
          onCreateTask={handleTaskCreate}
          defaultDate={taskModalDate}
        />

        {/* Simplified Drag Overlay */}
        <DragOverlay
          dropAnimation={{
            duration: 150,
            easing: 'ease-out',
          }}
        >
          {draggedTask ? (
            <div className='opacity-80 scale-105 cursor-grabbing'>
              <TaskCard
                task={draggedTask}
                showTaskListIndicator={false} // Simplify overlay
                className='shadow-xl border border-primary-400 bg-white dark:bg-gray-800'
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
