// Weekly planning interface with day and week views
import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../../types';
import { WeekView } from './WeekView';
import { DayView } from './DayView';

import { TimeHistoryModal } from './TimeHistoryModal';
import { useTimerContext } from '../../contexts/TimerContext';

interface WeeklyPlanProps {
  tasks: Task[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTaskMove: (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => void;
  onTaskCreate: (task: Task) => void;
  onTaskEdit: (taskId: string, updates: Partial<Task>) => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
  onTaskDelete?: (task: Task) => void;
  viewMode?: 'week' | 'day';
  className?: string;
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
}: WeeklyPlanProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>(initialViewMode);

  const [timeHistoryTask, setTimeHistoryTask] = useState<Task | undefined>();
  const [showTimeHistory, setShowTimeHistory] = useState(false);

  // Get timer functionality from context
  const { getTaskTimerProps } = useTimerContext();

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
    console.log('Move task:', taskId, 'from', fromColumn, 'to', toColumn, date);
    onTaskMove(taskId, fromColumn, toColumn, date);
  };

  const handleTaskStatusChange = (task: Task, status: TaskStatus) => {
    if (onTaskStatusChange) {
      onTaskStatusChange(task, status);
    } else {
      console.log('Status change:', task.title, 'to', status);
    }
  };

  const handleTaskCreate = (task: Task) => {
    if (onTaskCreate) {
      onTaskCreate(task);
    } else {
      console.log('Task created:', task.title);
    }
  };

  // Convert inline edit callback to work with existing components
  const handleTaskEdit = (task: Task) => {
    // This is a wrapper for components that still expect the old interface
    console.log('Edit task (legacy):', task.title);
    // For now, we'll just call with empty updates - this won't be used with inline editing
    if (onTaskEdit) {
      onTaskEdit(task.id, {});
    }
  };

  // Handler for inline editing (called directly by PlanningTaskCard)
  const handleInlineEdit = (taskId: string, updates: Partial<Task>) => {
    console.log('Inline edit task:', taskId, updates);
    if (onTaskEdit) {
      onTaskEdit(taskId, updates);
    }
  };

  const handleTaskDelete = (task: Task) => {
    console.log('Delete task:', task.title);
    if (onTaskDelete) {
      onTaskDelete(task);
    }
  };

  const handleViewTimeHistory = (task: Task) => {
    console.log('View time history for:', task.title);
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
          tasks={tasks}
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
        />
      ) : (
        <DayView
          tasks={tasks}
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
