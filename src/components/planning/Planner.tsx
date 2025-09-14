import { useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus, TaskFilters, VirtualTask } from '../../types';
import { useDatabase } from '../../hooks/useDatabase';
import { getTaskRepository } from '../../services/database/repositories';
import { PeriodicTaskService } from '../../services/database/repositories/PeriodicTaskService';
import { VirtualPeriodicTaskService } from '../../services/database/repositories/VirtualPeriodicTaskService';
import { useTaskList } from '../../contexts/TaskListContext';
import { WeeklyPlan } from './WeeklyPlan';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskDashboard } from './TaskDashboard';
import { FocusView } from './FocusView';

interface PlanningScreenProps {
  viewMode?: 'week' | 'day' | 'dashboard' | 'focus';
}

export function Planner({ viewMode = 'dashboard' }: PlanningScreenProps) {
  const { isInitialized } = useDatabase();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [virtualTasks, setVirtualTasks] = useState<VirtualTask[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filters, setFilters] = useState<TaskFilters>({});
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Get task list context for filtering
  const { currentSelection, getSelectedTaskListId, isAllSelected } =
    useTaskList();

  // Combine real tasks and virtual tasks
  const allTasks = useMemo(() => {
    return [...tasks, ...virtualTasks];
  }, [tasks, virtualTasks]);

  // Filter tasks based on current task list selection and additional filters
  const filteredTasks = useMemo(() => {
    let filtered = allTasks;

    // First apply task list filtering
    if (!isAllSelected()) {
      const selectedTaskListId = getSelectedTaskListId();
      if (selectedTaskListId) {
        filtered = filtered.filter(
          task => task.taskListId === selectedTaskListId
        );
      }
    }

    // Then apply additional filters
    if (Object.keys(filters).length > 0) {
      const taskRepo = getTaskRepository();
      // Use the TaskService's client-side filtering logic
      filtered = taskRepo.applyClientSideFilters(filtered, filters);
    }

    return filtered;
  }, [
    allTasks,
    currentSelection,
    getSelectedTaskListId,
    isAllSelected,
    filters,
  ]);

  // Track window size changes
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for task updates and refresh tasks
  useEffect(() => {
    const handleTasksUpdate = async () => {
      if (isInitialized) {
        await refreshTasks();
      }
    };

    const handlePeriodicTasksUpdate = async () => {
      if (isInitialized) {
        try {
          // Generate any new periodic task instances
          const periodicService = new PeriodicTaskService();
          const result = await periodicService.checkAndGenerateInstances();

          if (result.totalGenerated > 0) {
            console.log(
              `Generated ${result.totalGenerated} new periodic task instances`
            );
          }

          // Refresh all tasks
          await refreshTasks();
        } catch (error) {
          console.warn(
            'Failed to refresh tasks after periodic task update:',
            error
          );
        }
      }
    };

    // Listen for both task updates and periodic task updates
    window.addEventListener('tasks-updated', handleTasksUpdate);
    window.addEventListener(
      'periodic-tasks-updated',
      handlePeriodicTasksUpdate
    );

    return () => {
      window.removeEventListener('tasks-updated', handleTasksUpdate);
      window.removeEventListener(
        'periodic-tasks-updated',
        handlePeriodicTasksUpdate
      );
    };
  }, [isInitialized, currentWeek, viewMode]);

  // Calculate dynamic column height based on window size
  const getColumnHeight = () => {
    const { width, height } = windowSize;
    const isSmallWindow = width < 1024 || height < 768; // lg breakpoint for width, reasonable height threshold

    // Reserve space for header (~120px) and padding (~48px)
    const reservedSpace = 168;
    const availableHeight = height - reservedSpace;

    if (isSmallWindow) {
      // Fill window on small screens (minimum 300px, maximum available height)
      return Math.max(300, Math.min(availableHeight, height * 0.9));
    } else {
      // Use 3/4 of available height on larger screens (minimum 400px)
      return Math.max(400, availableHeight * 0.75);
    }
  };

  // Load virtual tasks for the current view
  const loadVirtualTasks = async (realTasks: Task[]) => {
    try {
      if (!isInitialized) {
        setVirtualTasks([]);
        return;
      }

      const virtualService = new VirtualPeriodicTaskService();
      let virtualTasksToShow: VirtualTask[] = [];

      if (viewMode === 'week') {
        // Calculate week start (Monday)
        const weekStart = new Date(currentWeek);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);

        virtualTasksToShow = await virtualService.getVirtualTasksForWeek(
          weekStart,
          realTasks
        );
      } else {
        // Day view - show virtual tasks for the current week's selected day
        virtualTasksToShow = await virtualService.getVirtualTasksForDay(
          currentWeek,
          realTasks
        );
      }

      setVirtualTasks(virtualTasksToShow);
    } catch (error) {
      console.error('Failed to load virtual tasks:', error);
      setVirtualTasks([]);
    }
  };

  // Centralized task refresh function
  const refreshTasks = async () => {
    try {
      if (isInitialized) {
        // Load all tasks from database
        const taskRepo = getTaskRepository();
        const dbTasks = await taskRepo.findAll();

        // Debug: Log periodic task instances for troubleshooting
        const periodicInstances = dbTasks.filter(
          task => task.isPeriodicInstance
        );
        if (periodicInstances.length > 0) {
          console.log(
            `Loaded ${periodicInstances.length} periodic task instances`
          );
        }

        setTasks(dbTasks);

        // Load virtual tasks after real tasks are loaded
        await loadVirtualTasks(dbTasks);
      } else {
        // Clear and reinitialize sample data for testing
        localStorage.removeItem('kirapilot-mock-db');
        const sampleTasks: Task[] = [];
        setTasks(sampleTasks);
        setVirtualTasks([]);
      }
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
      // Clear and reinitialize sample data on error
      localStorage.removeItem('kirapilot-mock-db');
      const fallbackTasks: Task[] = [];
      setTasks(fallbackTasks);
      setVirtualTasks([]);
    }
  };

  // Load tasks from database on mount and generate periodic task instances
  useEffect(() => {
    const loadTasks = async () => {
      try {
        if (isInitialized) {
          // First, check and generate any pending periodic task instances
          try {
            const periodicService = new PeriodicTaskService();
            const result = await periodicService.checkAndGenerateInstances();
            if (result.totalGenerated > 0) {
              console.log(
                `Generated ${result.totalGenerated} periodic task instances`
              );
            }
          } catch (periodicError) {
            console.warn(
              'Failed to generate periodic task instances:',
              periodicError
            );
            // Don't fail the entire load process if periodic generation fails
          }

          // Then refresh all tasks
          await refreshTasks();
        } else {
          await refreshTasks();
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
        await refreshTasks();
      }
    };

    loadTasks();
  }, [isInitialized, currentWeek, viewMode]);

  const handleTaskMove = async (
    taskId: string,
    _fromColumn: string,
    toColumn: string,
    date?: Date
  ) => {
    // Check if this is a virtual task
    const virtualTask = virtualTasks.find(t => t.id === taskId);
    if (virtualTask) {
      // Materialize the virtual task first
      try {
        const virtualService = new VirtualPeriodicTaskService();
        const realTask =
          await virtualService.materializeVirtualTask(virtualTask);

        // Remove the virtual task and add the real task
        setVirtualTasks(prev => prev.filter(t => t.id !== taskId));
        setTasks(prev => [realTask, ...prev]);

        // Now handle the move with the real task
        await handleTaskMoveInternal(realTask, _fromColumn, toColumn, date);
        return;
      } catch (error) {
        console.error('Failed to materialize virtual task:', error);
        return;
      }
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

    await handleTaskMoveInternal(task, _fromColumn, toColumn, date);
  };

  const handleTaskMoveInternal = async (
    task: Task,
    _fromColumn: string,
    toColumn: string,
    date?: Date
  ) => {
    let newScheduledDate: Date | undefined;

    // Determine new scheduled date based on target column
    if (toColumn === 'backlog') {
      newScheduledDate = undefined; // No scheduled date for backlog
    } else if (toColumn === 'upcoming') {
      // Set to next week if no specific date provided
      newScheduledDate =
        date ||
        (() => {
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          return nextWeek;
        })();
    } else if (date) {
      // Use the provided date for daily columns
      newScheduledDate = new Date(date);
    } else {
      // Fallback: keep existing scheduled date
      newScheduledDate = task.scheduledDate;
    }

    const updatedTask = {
      ...task,
      scheduledDate: newScheduledDate,
      updatedAt: new Date(),
    };

    // Optimistically update local state first for immediate UI feedback
    setTasks(prev => prev.map(t => (t.id === task.id ? updatedTask : t)));

    try {
      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(task.id, {
          scheduledDate: newScheduledDate,
        });

        // Refresh virtual tasks to ensure consistency
        await loadVirtualTasks(
          tasks.map(t => (t.id === task.id ? updatedTask : t))
        );
      }
    } catch (error) {
      console.error('Failed to update task in database:', error);

      // Revert optimistic update on error
      setTasks(prev => prev.map(t => (t.id === task.id ? task : t)));

      // Show user-friendly error message
      alert(
        `Failed to move task: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );
    }
  };

  const handleTaskCreate = async (task: Task) => {
    try {
      // Optimistically add task to UI first
      const optimisticTask = {
        ...task,
        id: `temp-${Date.now()}`, // Temporary ID for optimistic update
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setTasks(prev => [optimisticTask, ...prev]);

      // Create in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        const createdTask = await taskRepo.create({
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          scheduledDate: task.scheduledDate,
          timeEstimate: task.timeEstimate,
          tags: task.tags || [],
          dependencies: task.dependencies || [],
          projectId: task.projectId,
          parentTaskId: task.parentTaskId,
          taskListId: task.taskListId, // Include task list ID
        });

        // Replace optimistic task with real task from database
        setTasks(prev =>
          prev.map(t => (t.id === optimisticTask.id ? createdTask : t))
        );

        // Refresh virtual tasks to ensure consistency
        await loadVirtualTasks([
          ...tasks.filter(t => t.id !== optimisticTask.id),
          createdTask,
        ]);
      }
    } catch (error) {
      console.error('Failed to create task in database:', error);

      // Remove optimistic task on error
      setTasks(prev => prev.filter(t => !t.id.startsWith('temp-')));

      // Re-throw the error so it can be handled by the calling component
      throw error;
    }
  };

  const handleTaskEdit = async (taskId: string, updates: Partial<Task>) => {
    // Check if this is a virtual task
    const virtualTask = virtualTasks.find(t => t.id === taskId);
    if (virtualTask) {
      // Materialize the virtual task first
      try {
        const virtualService = new VirtualPeriodicTaskService();
        const realTask =
          await virtualService.materializeVirtualTask(virtualTask);

        // Remove the virtual task and add the real task
        setVirtualTasks(prev => prev.filter(t => t.id !== taskId));
        setTasks(prev => [realTask, ...prev]);

        // Now handle the edit with the real task
        await handleTaskEditInternal(realTask.id, updates);
        return;
      } catch (error) {
        console.error('Failed to materialize virtual task:', error);
        throw error;
      }
    }

    await handleTaskEditInternal(taskId, updates);
  };

  const handleTaskEditInternal = async (
    taskId: string,
    updates: Partial<Task>
  ) => {
    // Store original task for potential rollback
    const originalTask = tasks.find(t => t.id === taskId);
    if (!originalTask) {
      throw new Error('Task not found');
    }

    // Optimistically update local state first for immediate UI feedback
    const updatedTask = { ...originalTask, ...updates, updatedAt: new Date() };
    setTasks(prev => prev.map(t => (t.id === taskId ? updatedTask : t)));

    try {
      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(taskId, updates);

        // Refresh virtual tasks to ensure consistency
        await loadVirtualTasks(
          tasks.map(t => (t.id === taskId ? updatedTask : t))
        );
      }
    } catch (error) {
      console.error('Failed to update task in database:', error);

      // Revert optimistic update on error
      setTasks(prev => prev.map(t => (t.id === taskId ? originalTask : t)));

      // Re-throw the error so calling components (like TaskModal) can handle it
      throw error;
    }
  };

  const handleTaskStatusChange = async (
    task: Task | VirtualTask,
    status: TaskStatus
  ) => {
    // Check if this is a virtual task
    if (VirtualPeriodicTaskService.isVirtualTask(task)) {
      // Materialize the virtual task first
      try {
        const virtualService = new VirtualPeriodicTaskService();
        const realTask = await virtualService.materializeVirtualTask(task);

        // Remove the virtual task and add the real task
        setVirtualTasks(prev => prev.filter(t => t.id !== task.id));
        setTasks(prev => [realTask, ...prev]);

        // Now handle the status change with the real task
        await handleTaskStatusChangeInternal(realTask, status);
        return;
      } catch (error) {
        console.error('Failed to materialize virtual task:', error);
        return;
      }
    }

    await handleTaskStatusChangeInternal(task, status);
  };

  const handleTaskStatusChangeInternal = async (
    task: Task,
    status: TaskStatus
  ) => {
    console.debug(
      'Starting task status change:',
      task.title,
      'from',
      task.status,
      'to',
      status
    );

    // Optimistically update local state first for immediate UI feedback
    const updatedTask = {
      ...task,
      status,
      updatedAt: new Date(),
      completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
    };
    setTasks(prev => prev.map(t => (t.id === task.id ? updatedTask : t)));

    // Then update database
    if (isInitialized) {
      try {
        console.debug('Updating task in database:', task.id);

        // Add a small delay to avoid transaction conflicts
        await new Promise(resolve => setTimeout(resolve, 50));

        const taskRepo = getTaskRepository();

        // Retry logic for transaction conflicts
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            await taskRepo.update(task.id, {
              status,
            });
            break; // Success, exit retry loop
          } catch (retryError: unknown) {
            retryCount++;
            const errorMessage =
              retryError instanceof Error
                ? retryError.message
                : String(retryError);
            console.warn(`Attempt ${retryCount} failed:`, errorMessage);

            if (
              errorMessage.includes('no transaction is active') &&
              retryCount < maxRetries
            ) {
              await new Promise(resolve =>
                setTimeout(resolve, retryCount * 100)
              );
              continue;
            }

            // If it's not a transaction error or we've exhausted retries, throw
            throw retryError;
          }
        }
      } catch (error: unknown) {
        console.error('Failed to update task status in database:', error);
        console.error('Error details:', error);
        console.error('Error type:', typeof error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error message:', errorMessage);
        console.error('Error stack:', errorStack);

        // Revert local state if database update failed
        setTasks(prev => prev.map(t => (t.id === task.id ? task : t)));

        // Show user-friendly error message
        alert(
          `Failed to update task status: ${errorMessage || 'Unknown error'}. Please try again.`
        );
      }
    }
  };

  const handleViewTimeHistory = (task: Task) => {
    // This would be handled by the WeeklyPlan component
    console.log('View time history for task:', task.title);
  };

  const getTaskTimerProps = (_task: Task) => {
    // This would be provided by the timer context
    return {};
  };

  const handleTaskDelete = async (task: Task | VirtualTask) => {
    // Check if this is a virtual task
    if (VirtualPeriodicTaskService.isVirtualTask(task)) {
      // For virtual tasks, just remove from virtual tasks list
      setVirtualTasks(prev => prev.filter(t => t.id !== task.id));
      return;
    }

    // Optimistically remove from local state first for immediate UI feedback
    setTasks(prev => prev.filter(t => t.id !== task.id));

    try {
      // Delete from database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.delete(task.id);

        // Refresh virtual tasks to ensure consistency
        await loadVirtualTasks(tasks.filter(t => t.id !== task.id));
      }
    } catch (error) {
      console.error('Failed to delete task from database:', error);

      // Restore task on error
      setTasks(prev => [task as Task, ...prev]);

      // Show user-friendly error message
      alert(
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );
    }
  };

  return (
    <div
      className={`${viewMode === 'focus' ? 'h-full' : 'p-6 min-h-full space-y-4'}`}
    >
      {/* Focus View */}
      {viewMode === 'focus' && (
        <div className='p-4 h-full'>
          <FocusView
            tasks={filteredTasks}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            onViewTimeHistory={handleViewTimeHistory}
            getTaskTimerProps={getTaskTimerProps}
          />
        </div>
      )}

      {/* Regular views */}
      {viewMode !== 'focus' && (
        <>
          {/* Task Filter Bar - Only show for week/day views */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <TaskFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              showPeriodicFilters={true}
            />
          )}

          {/* Dashboard View */}
          {viewMode === 'dashboard' && (
            <TaskDashboard
              tasks={filteredTasks}
              onTaskStatusChange={handleTaskStatusChange}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
              onViewTimeHistory={handleViewTimeHistory}
              getTaskTimerProps={getTaskTimerProps}
            />
          )}

          {/* Weekly/Daily Planning Interface */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <WeeklyPlan
              tasks={filteredTasks}
              currentWeek={currentWeek}
              onWeekChange={setCurrentWeek}
              onTaskMove={handleTaskMove}
              onTaskCreate={handleTaskCreate}
              onTaskEdit={handleTaskEdit}
              onTaskStatusChange={handleTaskStatusChange}
              onTaskDelete={handleTaskDelete}
              viewMode={viewMode}
              columnHeight={getColumnHeight()}
            />
          )}
        </>
      )}
    </div>
  );
}
