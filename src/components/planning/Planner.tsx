import { useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus, TaskFilters } from '../../types';
import { useDatabase } from '../../hooks/useDatabase';
import { getTaskRepository } from '../../services/database/repositories';
import { PeriodicTaskService } from '../../services/database/repositories/PeriodicTaskService';
import { useTaskList } from '../../contexts/TaskListContext';
import { WeeklyPlan } from './WeeklyPlan';
import { TaskFilterBar } from './TaskFilterBar';

interface PlanningScreenProps {
  viewMode?: 'week' | 'day';
}

export function Planner({ viewMode = 'week' }: PlanningScreenProps) {
  const { isInitialized } = useDatabase();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filters, setFilters] = useState<TaskFilters>({});
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Get task list context for filtering
  const { currentSelection, getSelectedTaskListId, isAllSelected } =
    useTaskList();

  // Filter tasks based on current task list selection and additional filters
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

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
  }, [tasks, currentSelection, getSelectedTaskListId, isAllSelected, filters]);

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

  // Listen for periodic task updates and refresh tasks
  useEffect(() => {
    const handlePeriodicTasksUpdate = async () => {
      if (isInitialized) {
        try {
          // Generate any new periodic task instances
          const periodicService = new PeriodicTaskService();

          // Generate both overdue and upcoming instances
          const standardResult =
            await periodicService.checkAndGenerateInstances();
          const advancedResult =
            await periodicService.generateAdvancedInstances(30);

          // Reload all tasks to include new instances
          const taskRepo = getTaskRepository();
          const dbTasks = await taskRepo.findAll();

          const totalGenerated =
            standardResult.totalGenerated + advancedResult.totalGenerated;
          if (totalGenerated > 0) {
            console.log(
              `Generated ${totalGenerated} new periodic task instances`
            );
          }

          setTasks(dbTasks);
        } catch (error) {
          console.warn(
            'Failed to refresh tasks after periodic task update:',
            error
          );
        }
      }
    };

    window.addEventListener(
      'periodic-tasks-updated',
      handlePeriodicTasksUpdate
    );
    return () => {
      window.removeEventListener(
        'periodic-tasks-updated',
        handlePeriodicTasksUpdate
      );
    };
  }, [isInitialized]);

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

  // Load tasks from database on mount and generate periodic task instances
  useEffect(() => {
    const loadTasks = async () => {
      try {
        if (isInitialized) {
          // First, check and generate any pending periodic task instances
          try {
            const periodicService = new PeriodicTaskService();

            // First try the standard generation for overdue tasks
            const standardResult =
              await periodicService.checkAndGenerateInstances();

            // Then generate advanced instances for the next 30 days
            const advancedResult =
              await periodicService.generateAdvancedInstances(30);

            const totalGenerated =
              standardResult.totalGenerated + advancedResult.totalGenerated;
            if (totalGenerated > 0) {
              console.log(
                `Generated ${totalGenerated} periodic task instances (${standardResult.totalGenerated} overdue, ${advancedResult.totalGenerated} upcoming)`
              );
            }
          } catch (periodicError) {
            console.warn(
              'Failed to generate periodic task instances:',
              periodicError
            );
            // Don't fail the entire load process if periodic generation fails
          }

          // Then load all tasks
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
        } else {
          // Clear and reinitialize sample data for testing
          localStorage.removeItem('kirapilot-mock-db');
          const sampleTasks: Task[] = [];
          setTasks(sampleTasks);
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
        // Clear and reinitialize sample data on error
        localStorage.removeItem('kirapilot-mock-db');
        const fallbackTasks: Task[] = [];
        setTasks(fallbackTasks);
      }
    };

    loadTasks();
  }, [isInitialized]);

  const handleTaskMove = async (
    taskId: string,
    _fromColumn: string,
    toColumn: string,
    date?: Date
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

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

    try {
      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(taskId, {
          scheduledDate: newScheduledDate,
        });
      }

      // Update local state
      setTasks(prev => prev.map(t => (t.id === taskId ? updatedTask : t)));
    } catch (error) {
      console.error('Failed to update task in database:', error);
      // Still update local state as fallback
      setTasks(prev => prev.map(t => (t.id === taskId ? updatedTask : t)));
    }
  };

  const handleTaskCreate = async (task: Task) => {
    try {
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

        // Update local state with the task from database
        setTasks(prev => [createdTask, ...prev]);
      } else {
        // Fallback: just update local state
        setTasks(prev => [task, ...prev]);
      }
    } catch (error) {
      console.error('Failed to create task in database:', error);

      // Re-throw the error so it can be handled by the calling component
      throw error;
    }
  };

  const handleTaskEdit = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(taskId, updates);
      }

      // Update local state only if database update succeeded
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
        )
      );
    } catch (error) {
      console.error('Failed to update task in database:', error);

      // Re-throw the error so calling components (like TaskModal) can handle it
      throw error;
    }
  };

  const handleTaskStatusChange = async (task: Task, status: TaskStatus) => {
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

  const handleTaskDelete = async (task: Task) => {
    try {
      // Delete from database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.delete(task.id);
      }

      // Remove from local state
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (error) {
      console.error('Failed to delete task from database:', error);
      // Fallback: still remove from local state
      setTasks(prev => prev.filter(t => t.id !== task.id));
    }
  };

  return (
    <div className='p-6 min-h-full space-y-4'>
      {/* Task Filter Bar */}
      <TaskFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        showPeriodicFilters={true}
      />

      {/* Weekly Planning Interface */}
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
    </div>
  );
}
