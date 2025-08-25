import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { LoggingConfigService } from '../services/database/repositories/LoggingConfigService';
import { LoggingConfig } from '../types/aiLogging';

export interface LoggingOperation {
  id: string;
  type: 'capture' | 'export' | 'clear' | 'cleanup';
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: Date;
  progress?: number;
}

export interface LoggingStatusContextType {
  // Configuration state
  config: LoggingConfig | null;
  isLoading: boolean;
  error: string | null;

  // Real-time operation tracking
  activeOperations: LoggingOperation[];
  recentOperations: LoggingOperation[];

  // Status indicators
  isLoggingEnabled: boolean;
  isCapturing: boolean;
  lastCaptureTime: Date | null;
  captureCount: number;

  // Actions
  refreshConfig: () => Promise<void>;
  startOperation: (type: LoggingOperation['type'], message?: string) => string;
  updateOperation: (id: string, updates: Partial<LoggingOperation>) => void;
  completeOperation: (
    id: string,
    status: 'success' | 'error',
    message?: string
  ) => void;
  clearRecentOperations: () => void;

  // Capture tracking
  recordCapture: () => void;
  recordCaptureError: (error: string) => void;
}

const LoggingStatusContext = createContext<
  LoggingStatusContextType | undefined
>(undefined);

interface LoggingStatusProviderProps {
  children: ReactNode;
}

export function LoggingStatusProvider({
  children,
}: LoggingStatusProviderProps) {
  const [config, setConfig] = useState<LoggingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOperations, setActiveOperations] = useState<LoggingOperation[]>(
    []
  );
  const [recentOperations, setRecentOperations] = useState<LoggingOperation[]>(
    []
  );
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);
  const [captureCount, setCaptureCount] = useState(0);

  const loggingConfigService = new LoggingConfigService();

  // Load initial configuration
  useEffect(() => {
    loadConfig();

    // Set up periodic refresh
    const interval = setInterval(loadConfig, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Clean up old operations periodically
  useEffect(() => {
    const cleanup = () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      setRecentOperations(prev => prev.filter(op => op.timestamp > cutoff));
    };

    const interval = setInterval(cleanup, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const configData = await loggingConfigService.getConfig();
      setConfig(configData);
      setError(null);
    } catch (err) {
      console.error('Failed to load logging config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConfig = async () => {
    await loadConfig();
  };

  const startOperation = (
    type: LoggingOperation['type'],
    message?: string
  ): string => {
    const operation: LoggingOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending',
      message,
      timestamp: new Date(),
    };

    setActiveOperations(prev => [...prev, operation]);
    return operation.id;
  };

  const updateOperation = (id: string, updates: Partial<LoggingOperation>) => {
    setActiveOperations(prev =>
      prev.map(op => (op.id === id ? { ...op, ...updates } : op))
    );
  };

  const completeOperation = (
    id: string,
    status: 'success' | 'error',
    message?: string
  ) => {
    setActiveOperations(prev => {
      const operation = prev.find(op => op.id === id);
      if (operation) {
        const completedOperation = {
          ...operation,
          status,
          message: message || operation.message,
          timestamp: new Date(),
        };

        // Move to recent operations
        setRecentOperations(prevRecent => [
          completedOperation,
          ...prevRecent.slice(0, 9),
        ]);
      }

      return prev.filter(op => op.id !== id);
    });
  };

  const clearRecentOperations = () => {
    setRecentOperations([]);
  };

  const recordCapture = () => {
    setLastCaptureTime(new Date());
    setCaptureCount(prev => prev + 1);
  };

  const recordCaptureError = (errorMessage: string) => {
    const operationId = startOperation('capture', 'Capturing AI interaction');
    completeOperation(operationId, 'error', errorMessage);
  };

  // Derived state
  const isLoggingEnabled = config?.enabled ?? false;
  const isCapturing = activeOperations.some(
    op => op.type === 'capture' && op.status === 'pending'
  );

  const value: LoggingStatusContextType = {
    // Configuration state
    config,
    isLoading,
    error,

    // Real-time operation tracking
    activeOperations,
    recentOperations,

    // Status indicators
    isLoggingEnabled,
    isCapturing,
    lastCaptureTime,
    captureCount,

    // Actions
    refreshConfig,
    startOperation,
    updateOperation,
    completeOperation,
    clearRecentOperations,

    // Capture tracking
    recordCapture,
    recordCaptureError,
  };

  return (
    <LoggingStatusContext.Provider value={value}>
      {children}
    </LoggingStatusContext.Provider>
  );
}

export function useLoggingStatus(): LoggingStatusContextType {
  const context = useContext(LoggingStatusContext);
  if (context === undefined) {
    throw new Error(
      'useLoggingStatus must be used within a LoggingStatusProvider'
    );
  }
  return context;
}
