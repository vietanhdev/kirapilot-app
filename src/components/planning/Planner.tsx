// Demo component for weekly planning interface
import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../../types';
import { useDatabase } from '../../hooks/useDatabase';
import { getTaskRepository } from '../../services/database/repositories';
import { getSampleTasks } from '../../services/database/mockDatabase';
import { WeeklyPlan } from './WeeklyPlan';

interface PlanningScreenProps {
  viewMode?: 'week' | 'day';
}

export function Planner({ viewMode = 'week' }: PlanningScreenProps) {
  const { isInitialized } = useDatabase();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Load tasks from database on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        if (isInitialized) {
          const taskRepo = getTaskRepository();
          const dbTasks = await taskRepo.findAll();
          console.log('Loaded tasks from database:', dbTasks.length, dbTasks);
          setTasks(dbTasks);
        } else {
          // Clear and reinitialize sample data for testing
          localStorage.removeItem('kirapilot-mock-db');
          const sampleTasks = getSampleTasks();
          setTasks(sampleTasks);
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
        // Clear and reinitialize sample data on error
        localStorage.removeItem('kirapilot-mock-db');
        const fallbackTasks = getSampleTasks();
        setTasks(fallbackTasks);
      }
    };

    loadTasks();
  }, [isInitialized]);

  const handleTaskMove = async (
    taskId: string,
    fromColumn: string,
    toColumn: string,
    date?: Date
  ) => {
    console.log('Moving task:', { taskId, fromColumn, toColumn, date });

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

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
        console.log('Task updated in database:', taskId);
      }

      // Update local state
      setTasks(prev => prev.map(t => (t.id === taskId ? updatedTask : t)));

      console.log('Updated task:', {
        title: task.title,
        oldScheduledDate: task.scheduledDate,
        newScheduledDate,
        toColumn,
      });
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
        });

        // Update local state with the task from database
        setTasks(prev => [createdTask, ...prev]);
        console.log('New task created in database:', createdTask.title);
      } else {
        // Fallback: just update local state
        setTasks(prev => [task, ...prev]);
        console.log('New task created (local only):', task.title);
      }
    } catch (error) {
      console.error('Failed to create task in database:', error);
      // Fallback: still add to local state
      setTasks(prev => [task, ...prev]);
    }
  };

  const handleTaskEdit = async (taskId: string, updates: Partial<Task>) => {
    console.log('Edit task:', taskId, updates);

    try {
      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(taskId, updates);
        console.log('Task updated in database:', updates);
      }

      // Update local state
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
        )
      );
    } catch (error) {
      console.error('Failed to update task in database:', error);
      // Still update local state as fallback
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
        )
      );
    }
  };

  const handleTaskStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const updatedTask = {
        ...task,
        status,
        updatedAt: new Date(),
        completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
      };

      // Update in database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.update(task.id, {
          status,
        });
        console.log(
          'Task status updated in database:',
          task.title,
          'to',
          status
        );
      }

      // Update local state
      setTasks(prev => prev.map(t => (t.id === task.id ? updatedTask : t)));
    } catch (error) {
      console.error('Failed to update task status in database:', error);
      // Fallback: still update local state
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? {
                ...t,
                status,
                updatedAt: new Date(),
                completedAt:
                  status === TaskStatus.COMPLETED ? new Date() : undefined,
              }
            : t
        )
      );
    }
  };

  const handleTaskDelete = async (task: Task) => {
    try {
      // Delete from database
      if (isInitialized) {
        const taskRepo = getTaskRepository();
        await taskRepo.delete(task.id);
        console.log('Task deleted from database:', task.title);
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
    <div className='flex-1 p-6'>
      {/* Weekly Planning Interface */}
      <WeeklyPlan
        tasks={tasks}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        onTaskMove={handleTaskMove}
        onTaskCreate={handleTaskCreate}
        onTaskEdit={handleTaskEdit}
        onTaskStatusChange={handleTaskStatusChange}
        onTaskDelete={handleTaskDelete}
        viewMode={viewMode}
      />
    </div>
  );
}
