import { useState, useCallback, useEffect, useRef } from 'react';
import { ThreadService } from '../services/database/repositories/ThreadService';
import {
  Thread,
  ThreadAssignment,
  CreateThreadRequest,
  UpdateThreadRequest,
} from '../types/thread';
import {
  processKiraError,
  shouldAutoRetry,
  getRetryDelay,
  KiraError,
  globalDatabaseHealthChecker,
} from '../utils/kiraErrorHandling';

interface UseThreadsState {
  threads: Thread[];
  activeThread: Thread | null;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  error: KiraError | null;
  retryCount: number;
}

interface UseThreadsReturn extends UseThreadsState {
  createThread: (assignment?: ThreadAssignment) => Promise<Thread | null>;
  selectThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<boolean>;
  updateThread: (
    threadId: string,
    updates: UpdateThreadRequest
  ) => Promise<Thread | null>;
  assignThread: (
    threadId: string,
    assignment: ThreadAssignment
  ) => Promise<Thread | null>;
  refreshThreads: () => Promise<void>;
  clearError: () => void;
  clearActiveThread: () => void;
  retryLastOperation: () => Promise<void>;
}

/**
 * Hook for managing thread CRUD operations and state
 * Handles thread creation, selection, updates, deletion, and assignment
 */
export function useThreads(): UseThreadsReturn {
  const [state, setState] = useState<UseThreadsState>({
    threads: [],
    activeThread: null,
    isLoading: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    error: null,
    retryCount: 0,
  });

  const threadService = new ThreadService();
  const [lastOperation, setLastOperation] = useState<
    (() => Promise<void>) | null
  >(null);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setCreating = useCallback((creating: boolean) => {
    setState(prev => ({ ...prev, isCreating: creating }));
  }, []);

  const setDeleting = useCallback((deleting: boolean) => {
    setState(prev => ({ ...prev, isDeleting: deleting }));
  }, []);

  const setUpdating = useCallback((updating: boolean) => {
    setState(prev => ({ ...prev, isUpdating: updating }));
  }, []);

  const setError = useCallback((error: KiraError | null) => {
    setState(prev => ({
      ...prev,
      error,
      retryCount: error ? prev.retryCount + 1 : 0,
    }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setLastOperation(null);
  }, [setError]);

  const clearActiveThread = useCallback(() => {
    setState(prev => ({ ...prev, activeThread: null }));
  }, []);

  // Removed executeWithErrorHandling to prevent infinite re-render loops
  // Individual functions now handle their own error handling directly

  const retryLastOperation = useCallback(async () => {
    if (lastOperation && state.error) {
      // Check if we should auto-retry
      if (shouldAutoRetry(state.error, state.retryCount)) {
        const delay = getRetryDelay(state.retryCount);
        setTimeout(async () => {
          await lastOperation();
        }, delay);
      } else {
        await lastOperation();
      }
    }
  }, [lastOperation, state.error, state.retryCount]);

  /**
   * Load all threads from the database
   */
  const refreshThreads = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const threads = await threadService.findAll();
      setState(prev => ({ ...prev, threads, retryCount: 0 }));
    } catch (error) {
      const kiraError = processKiraError(error as Error, 'thread_load');
      setError(kiraError);
      console.error('Kira thread_load error:', error);
    } finally {
      setLoading(false);
    }
  }, [threadService, setLoading, setError]);

  /**
   * Create a new thread with optional assignment
   */
  const createThread = useCallback(
    async (assignment?: ThreadAssignment): Promise<Thread | null> => {
      try {
        setCreating(true);
        setError(null);

        const request: CreateThreadRequest = { assignment };
        const newThread = await threadService.create(request);

        setState(prev => ({
          ...prev,
          threads: [newThread, ...prev.threads],
          activeThread: newThread,
          retryCount: 0,
        }));

        return newThread;
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'thread_create');
        setError(kiraError);
        console.error('Kira thread_create error:', error);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [threadService, setCreating, setError]
  );

  /**
   * Select and load a thread by ID
   */
  const selectThread = useCallback(
    async (threadId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Check database health before attempting operation
        const isHealthy = await globalDatabaseHealthChecker.checkHealth();
        if (!isHealthy) {
          throw new Error(
            'Database connection is currently unavailable. Please check your connection and try again.'
          );
        }

        const thread = await threadService.findById(threadId);

        if (!thread) {
          // If thread not found, refresh the thread list to sync with database
          await refreshThreads();
          throw new Error('Thread not found');
        }

        setState(prev => ({ ...prev, activeThread: thread, retryCount: 0 }));
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'thread_load');
        setError(kiraError);
        console.error('Kira thread_load error:', error);
      } finally {
        setLoading(false);
      }
    },
    [threadService, refreshThreads]
  );

  /**
   * Delete a thread by ID
   */
  const deleteThread = useCallback(
    async (threadId: string): Promise<boolean> => {
      try {
        setDeleting(true);
        setError(null);

        // Check database health before attempting operation
        const isHealthy = await globalDatabaseHealthChecker.checkHealth();
        if (!isHealthy) {
          throw new Error(
            'Database connection is currently unavailable. Please check your connection and try again.'
          );
        }

        await threadService.delete(threadId);

        setState(prev => {
          const updatedThreads = prev.threads.filter(
            thread => thread.id !== threadId
          );
          const wasActiveThread = prev.activeThread?.id === threadId;

          return {
            ...prev,
            threads: updatedThreads,
            // If we deleted the active thread, select the first available thread or null
            activeThread: wasActiveThread
              ? updatedThreads.length > 0
                ? updatedThreads[0]
                : null
              : prev.activeThread,
            retryCount: 0,
          };
        });

        return true;
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'thread_delete');
        setError(kiraError);
        console.error('Kira thread_delete error:', error);
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [threadService]
  );

  /**
   * Update a thread with new data
   */
  const updateThread = useCallback(
    async (
      threadId: string,
      updates: UpdateThreadRequest
    ): Promise<Thread | null> => {
      try {
        setUpdating(true);
        setError(null);

        const updatedThread = await threadService.update(threadId, updates);

        setState(prev => ({
          ...prev,
          threads: prev.threads.map(thread =>
            thread.id === threadId ? updatedThread : thread
          ),
          activeThread:
            prev.activeThread?.id === threadId
              ? updatedThread
              : prev.activeThread,
          retryCount: 0,
        }));

        return updatedThread;
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'thread_update');
        setError(kiraError);
        console.error('Kira thread_update error:', error);
        return null;
      } finally {
        setUpdating(false);
      }
    },
    [threadService, setUpdating, setError]
  );

  /**
   * Assign a thread to a task or day
   */
  const assignThread = useCallback(
    async (
      threadId: string,
      assignment: ThreadAssignment
    ): Promise<Thread | null> => {
      try {
        setUpdating(true);
        setError(null);

        const updatedThread = await threadService.update(threadId, {
          assignment,
        });

        setState(prev => ({
          ...prev,
          threads: prev.threads.map(thread =>
            thread.id === threadId ? updatedThread : thread
          ),
          activeThread:
            prev.activeThread?.id === threadId
              ? updatedThread
              : prev.activeThread,
          retryCount: 0,
        }));

        return updatedThread;
      } catch (error) {
        const kiraError = processKiraError(error as Error, 'thread_assign');
        setError(kiraError);
        console.error('Kira thread_assign error:', error);
        return null;
      } finally {
        setUpdating(false);
      }
    },
    [threadService, setUpdating, setError]
  );

  // Load threads on mount - use ref to avoid dependency issues
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      refreshThreads();
    }
  }, []); // Empty dependency array to run only once

  return {
    threads: state.threads,
    activeThread: state.activeThread,
    isLoading: state.isLoading,
    isCreating: state.isCreating,
    isDeleting: state.isDeleting,
    isUpdating: state.isUpdating,
    error: state.error,
    retryCount: state.retryCount,
    createThread,
    selectThread,
    deleteThread,
    updateThread,
    assignThread,
    refreshThreads,
    clearError,
    clearActiveThread,
    retryLastOperation,
  };
}
