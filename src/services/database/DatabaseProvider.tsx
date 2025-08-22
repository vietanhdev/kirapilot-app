// Database context provider for React (SeaORM backend)
import { createContext, useContext, ReactNode } from 'react';
import { useDatabase } from '../../hooks/useDatabase';

interface DatabaseContextType {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  health: {
    isHealthy: boolean;
    version: string;
    tableCount: number;
    lastMigration?: string;
  } | null;
  initialize: () => Promise<void>;
  checkHealth: () => Promise<{
    isHealthy: boolean;
    version: string;
    tableCount: number;
    lastMigration?: string;
  }>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined
);

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Database context provider component
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const databaseState = useDatabase();

  return (
    <DatabaseContext.Provider value={databaseState}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to use database context
 */
export function useDatabaseContext(): DatabaseContextType {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error(
      'useDatabaseContext must be used within a DatabaseProvider'
    );
  }
  return context;
}

/**
 * Database status component for debugging
 */
export function DatabaseStatus() {
  const { isInitialized, isLoading, error, health } = useDatabaseContext();

  if (isLoading) {
    return (
      <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
        <div className='flex items-center'>
          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2'></div>
          <span className='text-yellow-800'>Initializing database...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
        <div className='flex items-center'>
          <div className='w-4 h-4 bg-red-500 rounded-full mr-2'></div>
          <span className='text-red-800'>Database Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
        <div className='flex items-center'>
          <div className='w-4 h-4 bg-gray-500 rounded-full mr-2'></div>
          <span className='text-gray-800'>Database not initialized</span>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center'>
          <div className='w-4 h-4 bg-green-500 rounded-full mr-2'></div>
          <span className='text-green-800'>Database connected</span>
        </div>
        {health && (
          <div className='text-sm text-green-600'>
            SQLite {health.version} • {health.tableCount} tables
            {health.lastMigration && ` • Migration ${health.lastMigration}`}
          </div>
        )}
      </div>
    </div>
  );
}
