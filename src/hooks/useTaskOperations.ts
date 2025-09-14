import { useCallback } from 'react';
import { Task, TaskStatus, CreateTaskRequest, VirtualTask } from '../types';
import { useDatabase } from './useDatabase';
import { getTaskRepository } from '../services/database/repositories';
import { VirtualPeriodicTaskService } from '../services/database/repositories/VirtualPeriodicTaskService';

interface UseTaskOperationsProps {
  onTasksChange?: () => void;
  onError?: (error: string) => void;
}

export function useTaskOperations({
  onTasksChange,
  onError,
}: UseTaskOperationsProps = {}) {
  const { isInitialized } = useDatabase();

  const handleError = useCallback(
    (error: unknown, operation: string) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to ${operation}:`, error);

      if (onError) {
        onError(`Failed to ${operation}: ${message}`);
      }

      return message;
    },
    [onError]
  );

  const createTask = useCallback(
    async (taskData: CreateTaskRequest): Promise<Task> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const taskRepo = getTaskRepository();
        const createdTask = await taskRepo.create(taskData);

        // Notify about task changes
        onTasksChange?.();

        return createdTask;
      } catch (error) {
        handleError(error, 'create task');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>): Promise<Task> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const taskRepo = getTaskRepository();
        const updatedTask = await taskRepo.update(taskId, updates);

        // Notify about task changes
        onTasksChange?.();

        return updatedTask;
      } catch (error) {
        handleError(error, 'update task');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const taskRepo = getTaskRepository();
        await taskRepo.delete(taskId);

        // Notify about task changes
        onTasksChange?.();
      } catch (error) {
        handleError(error, 'delete task');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const moveTask = useCallback(
    async (taskId: string, newScheduledDate?: Date): Promise<Task> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const taskRepo = getTaskRepository();
        const updatedTask = await taskRepo.update(taskId, {
          scheduledDate: newScheduledDate,
        });

        // Notify about task changes
        onTasksChange?.();

        return updatedTask;
      } catch (error) {
        handleError(error, 'move task');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const changeTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus): Promise<Task> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const taskRepo = getTaskRepository();
        const updatedTask = await taskRepo.update(taskId, { status });

        // Notify about task changes
        onTasksChange?.();

        return updatedTask;
      } catch (error) {
        handleError(error, 'change task status');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const materializeVirtualTask = useCallback(
    async (virtualTask: VirtualTask): Promise<Task> => {
      try {
        if (!isInitialized) {
          throw new Error('Database not initialized');
        }

        const virtualService = new VirtualPeriodicTaskService();
        const realTask =
          await virtualService.materializeVirtualTask(virtualTask);

        // Notify about task changes
        onTasksChange?.();

        return realTask;
      } catch (error) {
        handleError(error, 'materialize virtual task');
        throw error;
      }
    },
    [isInitialized, onTasksChange, handleError]
  );

  const refreshTasks = useCallback(() => {
    // Dispatch event to trigger task refresh
    window.dispatchEvent(new CustomEvent('tasks-updated'));
  }, []);

  return {
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    changeTaskStatus,
    materializeVirtualTask,
    refreshTasks,
    isInitialized,
  };
}
