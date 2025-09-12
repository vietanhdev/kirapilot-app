// Weekly planning interface with day and week views
import { useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus, VirtualTask } from '../../types';
import { WeekView } from './WeekView';
import { DayView } from './DayView';

import { TimeHistoryModal } from './TimeHistoryModal';
import { useTimerContext } from '../../contexts/TimerContext';
import { useTaskList } from '../../contexts/TaskListContext';

interface WeeklyPlanProps {
  tasks: (Task | VirtualTask)[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTaskMove: (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => void;
  onTaskCreate: (task: Task) => Promise<void>;
  onTaskEdit: (taskId: string, updates: Partial<Task>) => void;
  onTaskStatusChange: (task: Task | VirtualTask, status: TaskStatus) => void;
  onTaskDelete?: (task: Task | VirtualTask) => void;
  viewMode?: 'week' | 'day';
  className?: string;
  columnHeight?: number;
}

export function WeeklyPlan({
  tasks,
  currentWeek,
  onWeekChange,
  onTaskMove,
  onTaskCreate,
  onTaskEdit,
  onTaskStatusChange,
  onTaskDelete,
  viewMode: initialViewMode = 'week',
  className = '',
  columnHeight,
}: WeeklyPlanProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>(initialViewMode);

  const [timeHistoryTask, setTimeHistoryTask] = useState<Task | undefined>();
  const [showTimeHistory, setShowTimeHistory] = useState(false);

  // Get timer functionality from context
  const { getTaskTimerProps } = useTimerContext();

  // Get task list context for filtering
  const { currentSelection, getSelectedTaskListId, isAllSelected } =
    useTaskList();

  // Filter tasks based on current task list selection
  const filteredTasks = useMemo(() => {
    if (isAllSelected()) {
      // Show all tasks when "All" is selected
      return tasks;
    }

    const selectedTaskListId = getSelectedTaskListId();
    if (!selectedTaskListId) {
      // Fallback to all tasks if no specific selection
      return tasks;
    }

    // Filter tasks by selected task list
    return tasks.filter(task => task.taskListId === selectedTaskListId);
  }, [tasks, currentSelection, getSelectedTaskListId, isAllSelected]);

  // Sync viewMode state when prop changes
  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const handleTaskMove = (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => {
    // Handle task movement between columns
    onTaskMove(taskId, fromColumn, toColumn, date);
  };

  const handleTaskStatusChange = (
    task: Task | VirtualTask,
    status: TaskStatus
  ) => {
    if (onTaskStatusChange) {
      onTaskStatusChange(task, status);
    }
  };

  const handleTaskCreate = async (task: Task) => {
    if (onTaskCreate) {
      await onTaskCreate(task);
    }
  };

  // Convert inline edit callback to work with existing components
  const handleTaskEdit = (task: Task) => {
    // This is a wrapper for components that still expect the old interface
    // For now, we'll just call with empty updates - this won't be used with inline editing
    if (onTaskEdit) {
      onTaskEdit(task.id, {});
    }
  };

  // Handler for inline editing (called directly by PlanningTaskCard)
  const handleInlineEdit = (taskId: string, updates: Partial<Task>) => {
    if (onTaskEdit) {
      onTaskEdit(taskId, updates);
    }
  };

  const handleTaskDelete = (task: Task | VirtualTask) => {
    if (onTaskDelete) {
      onTaskDelete(task);
    }
  };

  const handleViewTimeHistory = (task: Task) => {
    setTimeHistoryTask(task);
    setShowTimeHistory(true);
  };

  const handleCloseTimeHistory = () => {
    setShowTimeHistory(false);
    setTimeHistoryTask(undefined);
  };

  return (
    <div className={className}>
      {/* Main View */}
      {viewMode === 'week' ? (
        <WeekView
          tasks={filteredTasks}
          currentWeek={currentWeek}
          onWeekChange={onWeekChange}
          onTaskMove={handleTaskMove}
          onTaskEdit={handleTaskEdit}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskCreate={handleTaskCreate}
          onInlineEdit={handleInlineEdit}
          onTaskDelete={handleTaskDelete}
          onViewTimeHistory={handleViewTimeHistory}
          getTaskTimerProps={getTaskTimerProps}
          columnHeight={columnHeight}
        />
      ) : (
        <DayView
          tasks={filteredTasks}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onTaskMove={handleTaskMove}
          onTaskEdit={handleTaskEdit}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskCreate={handleTaskCreate}
          onInlineEdit={handleInlineEdit}
          onTaskDelete={handleTaskDelete}
          onViewTimeHistory={handleViewTimeHistory}
          getTaskTimerProps={getTaskTimerProps}
          columnHeight={columnHeight}
        />
      )}

      {/* Time History Modal */}
      {timeHistoryTask && (
        <TimeHistoryModal
          task={timeHistoryTask}
          isOpen={showTimeHistory}
          onClose={handleCloseTimeHistory}
        />
      )}
    </div>
  );
}
