// Simplified Daily kanban view for focused day planning
import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, TaskTimerProps } from '../../types';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

import { useResponsiveColumnWidth } from '../../hooks';
import { useTranslation } from '../../hooks/useTranslation';
import { useTaskList } from '../../contexts/TaskListContext';

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
  onTaskCreate: (task: Task) => Promise<void>;
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

  // Get task list context for indicators
  const { isAllSelected, taskLists } = useTaskList();

  // Helper function to find which column a task belongs to
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
        return { id: 'backlog', name: 'backlog' };
      }

      const taskDate = new Date(task.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedDay = new Date(selectedDate);
      selectedDay.setHours(0, 0, 0, 0);

      if (taskDate < today) {
        return { id: 'overdue', name: 'overdue' };
      } else if (taskDate.getTime() === selectedDay.getTime()) {
        return { id: 'today', name: 'today' };
      } else {
        return { id: 'next', name: 'next' };
      }
    },
    [tasks, selectedDate]
  );

  // Simplified handleDragOver
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!active || !over) {
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      const activeColumn = findTaskColumn(activeId);
      const overData = over.data.current;

      // If dragging over a column, we'll handle it in dragEnd
      if (overData?.type === 'column') {
        return;
      }

      // If dragging over another task, check if it's cross-column
      if (overData?.type === 'task') {
        const overColumn = findTaskColumn(overId);

        if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) {
          return; // Same column or invalid, let dragEnd handle reordering
        }

        // Cross-column drag - we could add some visual feedback here if needed
        return;
      }
    },
    [findTaskColumn]
  );

  // Simplified handleDragEnd
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

      const activeColumn = findTaskColumn(activeId);
      const overColumn = findTaskColumn(overId);

      // Handle cross-column moves
      if (overData?.type === 'column') {
        const toColumnName = overData.title;

        // Determine the new scheduled date based on the column
        let newDate: Date | undefined;

        if (toColumnName === 'backlog') {
          newDate = undefined;
        } else if (toColumnName === 'overdue') {
          newDate = new Date(selectedDate);
          newDate.setDate(newDate.getDate() - 1);
        } else if (toColumnName === 'today') {
          newDate = new Date(selectedDate);
        } else if (toColumnName === 'next tasks') {
          newDate = new Date(selectedDate);
          newDate.setDate(newDate.getDate() + 1);
        }

        onTaskMove(activeId, 'drag', toColumnName, newDate);
        return;
      }

      // Handle same-column reordering
      if (
        overData?.type === 'task' &&
        activeColumn &&
        overColumn &&
        activeColumn.id === overColumn.id
      ) {
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
    [findTaskColumn, tasks, selectedDate, onTaskMove, onInlineEdit]
  );

  // Improved sensors with better cursor tracking
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Require 3px movement before activating drag
      },
    }),
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

  // Calculate responsive column widths - 4 columns
  const totalColumns = 4;
  const { columnWidth } = useResponsiveColumnWidth(totalColumns, {
    minWidth: 260,
    maxWidth: 400,
  });

  // Organize tasks by category
  const taskCategories = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDay = new Date(selectedDate);
    selectedDay.setHours(0, 0, 0, 0);

    const backlog = tasks.filter(task => !task.scheduledDate);
    const overdue = tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      const taskDate = new Date(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate < today && task.status !== TaskStatus.COMPLETED;
    });
    const todayTasks = tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      const taskDate = new Date(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === selectedDay.getTime();
    });
    const next = tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      const taskDate = new Date(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate > selectedDay;
    });

    return {
      backlog,
      overdue,
      today: todayTasks,
      next,
    };
  }, [tasks, selectedDate]);

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return selectedDate.toLocaleDateString(undefined, options);
  };

  const handleAddTask = async (column: string, date?: Date) => {
    setTaskModalColumn(column);
    setTaskModalDate(date);
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
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() - 1);
                    onDateChange(newDate);
                  }}
                  className='p-1 hover:bg-content3 rounded transition-colors duration-200'
                  title={t('planning.previousDay')}
                >
                  <ChevronLeft className='w-4 h-4 text-foreground-600' />
                </button>

                <button
                  onClick={() => onDateChange(new Date())}
                  className='px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors duration-200'
                  title={t('planning.goToToday')}
                >
                  <Sun className='w-3 h-3 inline mr-1' />
                  {t('planning.today')}
                </button>

                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() + 1);
                    onDateChange(newDate);
                  }}
                  className='p-1 hover:bg-content3 rounded transition-colors duration-200'
                  title={t('planning.nextDay')}
                >
                  <ChevronRight className='w-4 h-4 text-foreground-600' />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Columns Container */}
        <div className='p-2'>
          <div
            id='day-columns-container'
            className='flex space-x-2 overflow-x-auto pb-2'
            style={{
              scrollbarGutter: 'stable',
            }}
          >
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
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
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
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
                  {...(getTaskTimerProps?.(task) || {})}
                />
              ))}
            </TaskColumn>

            {/* Today Column */}
            <TaskColumn
              title={t('planning.today')}
              icon={Clock}
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
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
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

        {/* Drag Overlay */}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {draggedTask ? (
            <div
              className='opacity-90 rotate-2 scale-105 cursor-grabbing'
              style={{
                transformOrigin: '0 0',
              }}
            >
              <TaskCard
                task={draggedTask}
                showTaskListIndicator={isAllSelected()}
                taskListName={
                  taskLists.find(list => list.id === draggedTask.taskListId)
                    ?.name
                }
                className='shadow-2xl border-2 border-primary-500 bg-white dark:bg-gray-800 ring-4 ring-primary-200 dark:ring-primary-800'
                {...(getTaskTimerProps?.(draggedTask) || {})}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
