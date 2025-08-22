// React hook for database management (SeaORM backend)
import { useState, useEffect, useCallback } from 'react';
import { initializeDatabase, checkDatabaseHealth } from '../services/database';

interface DatabaseState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  health: {
    isHealthy: boolean;
    version: string;
    tableCount: number;
    lastMigration?: string;
  } | null;
}

/**
 * Hook for managing database connection and state
 */
export function useDatabase() {
  const [state, setState] = useState<DatabaseState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    health: null,
  });

  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await initializeDatabase();
      const health = await checkDatabaseHealth();

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        health,
      }));

      console.log('Database initialized successfully via SeaORM backend');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown database error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      console.error('Failed to initialize database:', error);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const health = await checkDatabaseHealth();
      setState(prev => ({ ...prev, health }));
      return health;
    } catch (error) {
      console.error('Database health check failed:', error);
      const unhealthyState = {
        isHealthy: false,
        version: 'unknown',
        tableCount: 0,
      };
      setState(prev => ({ ...prev, health: unhealthyState }));
      return unhealthyState;
    }
  }, []);

  const close = useCallback(async () => {
    try {
      // Database connection is managed by Rust backend, just reset state
      setState({
        isInitialized: false,
        isLoading: false,
        error: null,
        health: null,
      });
    } catch (error) {
      console.error('Failed to close database:', error);
    }
  }, []);

  // Initialize database on mount
  useEffect(() => {
    initialize();

    // Cleanup on unmount
    return () => {
      close();
    };
  }, [initialize, close]);

  // Periodic health checks
  useEffect(() => {
    if (!state.isInitialized) {
      return;
    }

    const healthCheckInterval = setInterval(() => {
      checkHealth();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [state.isInitialized, checkHealth]);

  return {
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    error: state.error,
    health: state.health,
    initialize,
    checkHealth,
  };
}

/**
 * Hook for database operations with error handling
 */
export function useDatabaseOperation<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (operation: () => Promise<T>): Promise<T | null> => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await operation();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Database operation failed';
        setError(errorMessage);
        console.error('Database operation error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    isLoading,
    error,
    clearError,
  };
}
