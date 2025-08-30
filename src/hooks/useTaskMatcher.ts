// Hook for intelligent task matching functionality

import { useState, useCallback, useMemo } from 'react';
import { Task } from '../types';
import {
  TaskMatchResult,
  TaskMatchContext,
  TaskResolutionRequest,
  TaskResolutionResponse,
  UserIntent,
} from '../types/taskMatching';
import { IntelligentTaskMatcher } from '../services/ai/IntelligentTaskMatcher';
// Note: This hook will need to be integrated with task data when available

export interface UseTaskMatcherReturn {
  // Core matching functions
  findTasksByDescription: (
    query: string,
    context?: TaskMatchContext
  ) => Promise<TaskMatchResult[]>;
  searchTasks: (
    query: string,
    context?: TaskMatchContext
  ) => Promise<TaskMatchResult[]>;
  extractTaskReference: (
    input: string
  ) => { taskReference: string; intent: UserIntent; confidence: number } | null;

  // Resolution dialog state
  resolutionRequest: TaskResolutionRequest | null;
  showResolutionDialog: boolean;
  openResolutionDialog: (request: TaskResolutionRequest) => void;
  closeResolutionDialog: () => void;
  resolveTask: (response: TaskResolutionResponse) => void;

  // Context helpers
  getCurrentContext: () => TaskMatchContext;

  // Loading state
  isMatching: boolean;
}

export const useTaskMatcher = (): UseTaskMatcherReturn => {
  const [isMatching, setIsMatching] = useState(false);
  const [resolutionRequest, setResolutionRequest] =
    useState<TaskResolutionRequest | null>(null);
  const [resolutionCallback, setResolutionCallback] = useState<
    ((response: TaskResolutionResponse) => void) | null
  >(null);

  // Create matcher instance (memoized)
  const matcher = useMemo(() => new IntelligentTaskMatcher(), []);

  // Get current context for task matching
  const getCurrentContext = useCallback((): TaskMatchContext => {
    // For now, return minimal context
    // This can be enhanced when task data is available
    return {
      // Could add more context when available
    };
  }, []);

  // Find tasks by description
  const findTasksByDescription = useCallback(
    async (
      query: string,
      context?: TaskMatchContext
    ): Promise<TaskMatchResult[]> => {
      setIsMatching(true);
      try {
        const searchContext = context || getCurrentContext();
        return await matcher.findTasksByDescription(query, searchContext);
      } finally {
        setIsMatching(false);
      }
    },
    [matcher, getCurrentContext]
  );

  // Search tasks with natural language
  const searchTasks = useCallback(
    async (
      query: string,
      context?: TaskMatchContext
    ): Promise<TaskMatchResult[]> => {
      setIsMatching(true);
      try {
        const searchContext = context || getCurrentContext();
        return await matcher.searchTasks(query, searchContext);
      } finally {
        setIsMatching(false);
      }
    },
    [matcher, getCurrentContext]
  );

  // Extract task reference from natural language
  const extractTaskReference = useCallback(
    (input: string) => {
      return matcher.extractTaskReference(input);
    },
    [matcher]
  );

  // Open resolution dialog
  const openResolutionDialog = useCallback((request: TaskResolutionRequest) => {
    setResolutionRequest(request);
  }, []);

  // Close resolution dialog
  const closeResolutionDialog = useCallback(() => {
    setResolutionRequest(null);
    setResolutionCallback(null);
  }, []);

  // Resolve task selection
  const resolveTask = useCallback(
    (response: TaskResolutionResponse) => {
      if (resolutionCallback) {
        resolutionCallback(response);
      }
      closeResolutionDialog();
    },
    [resolutionCallback, closeResolutionDialog]
  );

  return {
    // Core matching functions
    findTasksByDescription,
    searchTasks,
    extractTaskReference,

    // Resolution dialog state
    resolutionRequest,
    showResolutionDialog: resolutionRequest !== null,
    openResolutionDialog,
    closeResolutionDialog,
    resolveTask,

    // Context helpers
    getCurrentContext,

    // Loading state
    isMatching,
  };
};

// Helper hook for AI tools to use task matching
export const useAITaskMatcher = () => {
  const taskMatcher = useTaskMatcher();

  // Find single task with automatic resolution
  const findSingleTask = useCallback(
    async (
      query: string,
      context?: TaskMatchContext,
      options?: {
        autoResolve?: boolean;
        minConfidence?: number;
      }
    ): Promise<Task | null> => {
      const matches = await taskMatcher.searchTasks(query, context);

      if (matches.length === 0) {
        return null;
      }

      // If we have a high-confidence single match, return it
      const highConfidenceMatches = matches.filter(
        m => m.confidence >= (options?.minConfidence || 80)
      );
      if (
        highConfidenceMatches.length === 1 &&
        options?.autoResolve !== false
      ) {
        return highConfidenceMatches[0].task;
      }

      // If we have multiple matches or low confidence, we need user resolution
      if (!options?.autoResolve) {
        return new Promise(resolve => {
          // This would typically trigger a dialog, but for now return the best match
          if (matches.length > 0) {
            resolve(matches[0].task);
          } else {
            resolve(null);
          }
        });
      }

      // Auto-resolve to best match if allowed
      return matches.length > 0 ? matches[0].task : null;
    },
    [taskMatcher]
  );

  return {
    ...taskMatcher,
    findSingleTask,
  };
};
