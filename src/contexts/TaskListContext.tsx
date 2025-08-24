import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  TaskList,
  TaskListSelection,
  CreateTaskListRequest,
  UpdateTaskListRequest,
  Task,
} from '../types';
import { TaskListService } from '../services/database/repositories/TaskListService';
import {
  parseTaskListError,
  getTaskListErrorMessage,
  isRecoverableError,
  TaskListError,
} from '../utils/taskListErrorHandling';
import { useTranslation } from '../hooks/useTranslation';
import { TranslationKey } from '../i18n';

interface EnhancedTaskListError extends Error {
  taskListError: TaskListError;
  isRecoverable: boolean;
}

const createEnhancedError = (
  err: unknown,
  t: (key: TranslationKey) => string
): EnhancedTaskListError => {
  const parsedError = parseTaskListError(err as string);
  const userFriendlyMessage = getTaskListErrorMessage(parsedError, t);

  const enhancedError = new Error(userFriendlyMessage) as EnhancedTaskListError;
  enhancedError.taskListError = parsedError;
  enhancedError.isRecoverable = isRecoverableError(parsedError);

  return enhancedError;
};

interface TaskListContextType {
  // State
  taskLists: TaskList[];
  currentSelection: TaskListSelection;
  isLoading: boolean;
  error: string | null;

  // Operations
  createTaskList: (request: CreateTaskListRequest) => Promise<TaskList>;
  updateTaskList: (
    id: string,
    request: UpdateTaskListRequest
  ) => Promise<TaskList>;
  deleteTaskList: (id: string) => Promise<void>;
  switchToTaskList: (taskListId: string) => Promise<void>;
  switchToAll: () => void;
  moveTaskToList: (taskId: string, taskListId: string) => Promise<Task>;
  refreshTaskLists: () => Promise<void>;
  recoverFromError: () => Promise<void>;

  // Utilities
  getSelectedTaskListId: () => string | null;
  isAllSelected: () => boolean;
  canEditCurrentList: () => boolean;
}

const TaskListContext = createContext<TaskListContextType | undefined>(
  undefined
);

interface TaskListProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'kirapilot-selected-task-list';

export const TaskListProvider: React.FC<TaskListProviderProps> = ({
  children,
}) => {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [currentSelection, setCurrentSelection] = useState<TaskListSelection>({
    type: 'all',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taskListService = new TaskListService();
  const { t } = useTranslation();

  // Load task lists and restore selection on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Persist selection changes
  useEffect(() => {
    persistSelection();
  }, [currentSelection]);

  const loadTaskLists = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const lists = await taskListService.getAllTaskLists();
      setTaskLists(lists);

      // Restore previous selection
      await restoreSelection(lists);
    } catch (err) {
      console.error('Failed to load task lists:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load task lists'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const restoreSelection = async (lists: TaskList[]) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Default to "All" if no previous selection
        setCurrentSelection({ type: 'all' });
        return;
      }

      const parsed = JSON.parse(stored) as TaskListSelection;

      if (parsed.type === 'all') {
        setCurrentSelection({ type: 'all' });
      } else if (parsed.type === 'specific' && parsed.taskListId) {
        // Check if the previously selected task list still exists
        const taskList = lists.find(list => list.id === parsed.taskListId);
        if (taskList) {
          setCurrentSelection({
            type: 'specific',
            taskListId: taskList.id,
            taskList,
          });
        } else {
          // Fall back to default task list if previous selection no longer exists
          const defaultList = lists.find(list => list.isDefault);
          if (defaultList) {
            setCurrentSelection({
              type: 'specific',
              taskListId: defaultList.id,
              taskList: defaultList,
            });
          } else {
            setCurrentSelection({ type: 'all' });
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore task list selection:', err);
      setCurrentSelection({ type: 'all' });
    }
  };

  const persistSelection = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSelection));
    } catch (err) {
      console.error('Failed to persist task list selection:', err);
    }
  };

  const createTaskList = useCallback(
    async (request: CreateTaskListRequest): Promise<TaskList> => {
      const previousTaskLists = [...taskLists];
      const previousSelection = { ...currentSelection };

      try {
        setError(null);
        const newTaskList = await taskListService.createTaskList(request);

        // Update local state optimistically
        setTaskLists(prev => [...prev, newTaskList]);

        // Switch to the newly created task list
        setCurrentSelection({
          type: 'specific',
          taskListId: newTaskList.id,
          taskList: newTaskList,
        });

        return newTaskList;
      } catch (err) {
        // Rollback optimistic updates
        setTaskLists(previousTaskLists);
        setCurrentSelection(previousSelection);

        const enhancedError = createEnhancedError(err, t);
        setError(enhancedError.message);
        throw enhancedError;
      }
    },
    [taskListService, taskLists, currentSelection, t]
  );

  const updateTaskList = useCallback(
    async (id: string, request: UpdateTaskListRequest): Promise<TaskList> => {
      const previousTaskLists = [...taskLists];
      const previousSelection = { ...currentSelection };

      try {
        setError(null);
        const updatedTaskList = await taskListService.updateTaskList(
          id,
          request
        );

        // Update local state optimistically
        setTaskLists(prev =>
          prev.map(list => (list.id === id ? updatedTaskList : list))
        );

        // Update current selection if it's the updated list
        if (
          currentSelection.type === 'specific' &&
          currentSelection.taskListId === id
        ) {
          setCurrentSelection({
            type: 'specific',
            taskListId: updatedTaskList.id,
            taskList: updatedTaskList,
          });
        }

        return updatedTaskList;
      } catch (err) {
        // Rollback optimistic updates
        setTaskLists(previousTaskLists);
        setCurrentSelection(previousSelection);

        const enhancedError = createEnhancedError(err, t);
        setError(enhancedError.message);
        throw enhancedError;
      }
    },
    [taskListService, taskLists, currentSelection, t]
  );

  const deleteTaskList = useCallback(
    async (id: string): Promise<void> => {
      const previousTaskLists = [...taskLists];
      const previousSelection = { ...currentSelection };

      try {
        setError(null);

        // Find the task list to check if it's default
        const taskListToDelete = taskLists.find(list => list.id === id);
        if (!taskListToDelete) {
          throw new Error('RECORD_NOT_FOUND: Task list not found');
        }

        if (taskListToDelete.isDefault) {
          throw new Error(
            'BUSINESS_RULE_ERROR: Cannot delete the default task list'
          );
        }

        // Optimistically update local state
        const updatedTaskLists = taskLists.filter(list => list.id !== id);
        setTaskLists(updatedTaskLists);

        // If the deleted list was currently selected, switch to default
        let newSelection = currentSelection;
        if (
          currentSelection.type === 'specific' &&
          currentSelection.taskListId === id
        ) {
          const defaultList = updatedTaskLists.find(list => list.isDefault);
          if (defaultList) {
            newSelection = {
              type: 'specific',
              taskListId: defaultList.id,
              taskList: defaultList,
            };
          } else {
            newSelection = { type: 'all' };
          }
          setCurrentSelection(newSelection);
        }

        // Perform the actual deletion
        await taskListService.deleteTaskList(id);
      } catch (err) {
        // Rollback optimistic updates
        setTaskLists(previousTaskLists);
        setCurrentSelection(previousSelection);

        const enhancedError = createEnhancedError(err, t);
        setError(enhancedError.message);
        throw enhancedError;
      }
    },
    [taskListService, taskLists, currentSelection, t]
  );

  const switchToTaskList = useCallback(
    async (taskListId: string): Promise<void> => {
      try {
        setError(null);

        const taskList = taskLists.find(list => list.id === taskListId);
        if (!taskList) {
          throw new Error(`Task list with id ${taskListId} not found`);
        }

        setCurrentSelection({
          type: 'specific',
          taskListId: taskList.id,
          taskList,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to switch task list';
        setError(errorMessage);
        throw err;
      }
    },
    [taskLists]
  );

  const switchToAll = useCallback(() => {
    setCurrentSelection({ type: 'all' });
  }, []);

  const moveTaskToList = useCallback(
    async (taskId: string, taskListId: string): Promise<Task> => {
      try {
        setError(null);
        return await taskListService.moveTaskToList(taskId, taskListId);
      } catch (err) {
        const enhancedError = createEnhancedError(err, t);
        setError(enhancedError.message);
        throw enhancedError;
      }
    },
    [taskListService, t]
  );

  const refreshTaskLists = useCallback(async (): Promise<void> => {
    await loadTaskLists();
  }, []);

  // Recovery mechanism for inconsistent state
  const recoverFromError = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      // Reload task lists from backend
      const lists = await taskListService.getAllTaskLists();
      setTaskLists(lists);

      // Validate current selection
      if (currentSelection.type === 'specific' && currentSelection.taskListId) {
        const selectedList = lists.find(
          list => list.id === currentSelection.taskListId
        );
        if (!selectedList) {
          // Current selection is invalid, fall back to default
          const defaultList = lists.find(list => list.isDefault);
          if (defaultList) {
            setCurrentSelection({
              type: 'specific',
              taskListId: defaultList.id,
              taskList: defaultList,
            });
          } else {
            setCurrentSelection({ type: 'all' });
          }
        } else {
          // Update the task list object in selection
          setCurrentSelection({
            type: 'specific',
            taskListId: selectedList.id,
            taskList: selectedList,
          });
        }
      }
    } catch (err) {
      console.error('Failed to recover from error:', err);
      // Fall back to safe state
      setCurrentSelection({ type: 'all' });
      setError('Failed to recover from error. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [taskListService, currentSelection]);

  // Utility functions
  const getSelectedTaskListId = useCallback((): string | null => {
    return currentSelection.type === 'specific'
      ? currentSelection.taskListId || null
      : null;
  }, [currentSelection]);

  const isAllSelected = useCallback((): boolean => {
    return currentSelection.type === 'all';
  }, [currentSelection]);

  const canEditCurrentList = useCallback((): boolean => {
    return currentSelection.type === 'specific' && !!currentSelection.taskList;
  }, [currentSelection]);

  const value: TaskListContextType = {
    // State
    taskLists,
    currentSelection,
    isLoading,
    error,

    // Operations
    createTaskList,
    updateTaskList,
    deleteTaskList,
    switchToTaskList,
    switchToAll,
    moveTaskToList,
    refreshTaskLists,
    recoverFromError,

    // Utilities
    getSelectedTaskListId,
    isAllSelected,
    canEditCurrentList,
  };

  return (
    <TaskListContext.Provider value={value}>
      {children}
    </TaskListContext.Provider>
  );
};

export const useTaskList = (): TaskListContextType => {
  const context = useContext(TaskListContext);
  if (context === undefined) {
    throw new Error('useTaskList must be used within a TaskListProvider');
  }
  return context;
};
