import { useState, useEffect, useCallback } from 'react';
import { LogViewer } from './LogViewer';
import { LogDetailView } from './LogDetailView';
import { AIInteractionLog, LogFilter } from '../../types/aiLogging';
import { LogStorageService } from '../../services/database/repositories/LogStorageService';
interface LogViewerContainerProps {
  className?: string;
}

const PAGE_SIZE = 20;

export function LogViewerContainer({ className }: LogViewerContainerProps) {
  const showNotification = (_notification: {
    type: string;
    title: string;
    message: string;
  }) => {
    // Notification would be shown in UI
  };
  const [logs, setLogs] = useState<AIInteractionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<LogFilter>({});
  const [selectedLog, setSelectedLog] = useState<AIInteractionLog | null>(null);
  const [logStorageService] = useState(() => new LogStorageService());

  // Load logs with current filters
  const loadLogs = useCallback(
    async (newFilters?: LogFilter, append = false) => {
      try {
        setLoading(true);

        const filterToUse = newFilters || filters;
        const logsToLoad = await logStorageService.getInteractionLogs({
          ...filterToUse,
          limit: PAGE_SIZE,
          offset: append ? logs.length : 0,
        });

        // Get total count for pagination (simplified - in real implementation,
        // you might want a separate count endpoint)
        const allLogs = await logStorageService.getInteractionLogs(filterToUse);
        setTotalCount(allLogs.length);

        if (append) {
          setLogs(prev => [...prev, ...logsToLoad]);
        } else {
          setLogs(logsToLoad);
          setCurrentPage(1);
        }
      } catch (error) {
        console.error('Failed to load logs:', error);
        showNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load AI interaction logs',
        });
      } finally {
        setLoading(false);
      }
    },
    [filters, logs.length, logStorageService]
  );

  // Initial load - separate function to avoid dependency issues
  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);

      const logsToLoad = await logStorageService.getInteractionLogs({
        limit: PAGE_SIZE,
        offset: 0,
      });

      const allLogs = await logStorageService.getInteractionLogs({});

      setTotalCount(allLogs.length);
      setLogs(logsToLoad);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to load logs:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        message:
          'Failed to load AI interaction logs. Please check if the database is accessible.',
      });
    } finally {
      setLoading(false);
    }
  }, [logStorageService]);

  // Initial load
  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: LogFilter) => {
      setFilters(newFilters);
      loadLogs(newFilters, false);
    },
    [loadLogs]
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    loadLogs(filters, true);
  }, [loadLogs, filters]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadLogs(filters, false);
  }, [loadLogs, filters]);

  // Handle log selection
  const handleLogSelect = useCallback(
    async (log: AIInteractionLog) => {
      try {
        // Load full log details including tool calls
        const fullLog = await logStorageService.getInteractionLog(log.id);
        if (fullLog) {
          // Load tool execution logs
          const toolCalls = await logStorageService.getToolExecutionLogs(
            log.id
          );
          fullLog.toolCalls = toolCalls;
          setSelectedLog(fullLog);
        }
      } catch (error) {
        console.error('Failed to load log details:', error);
        showNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load log details',
        });
      }
    },
    [logStorageService, showNotification]
  );

  // Handle log deletion
  const handleLogDelete = useCallback(
    async (logId: string) => {
      try {
        await logStorageService.deleteInteractionLog(logId);

        // Remove from current logs
        setLogs(prev => prev.filter(log => log.id !== logId));
        setTotalCount(prev => prev - 1);

        // Close detail view if this log was selected
        if (selectedLog?.id === logId) {
          setSelectedLog(null);
        }

        showNotification({
          type: 'success',
          title: 'Success',
          message: 'Log deleted successfully',
        });
      } catch (error) {
        console.error('Failed to delete log:', error);
        showNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete log',
        });
      }
    },
    [logStorageService, selectedLog, showNotification]
  );

  // Handle log export
  const handleLogExport = useCallback(
    async (log: AIInteractionLog) => {
      try {
        // Export single log
        const blob = await logStorageService.exportLogs(
          {
            searchText: log.id, // Use ID to filter to just this log
          },
          'json'
        );

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-log-${log.id}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification({
          type: 'success',
          title: 'Success',
          message: 'Log exported successfully',
        });
      } catch (error) {
        console.error('Failed to export log:', error);
        showNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to export log',
        });
      }
    },
    [logStorageService, showNotification]
  );

  // Handle sensitive data redaction
  const handleRedactSensitiveData = useCallback(
    async (log: AIInteractionLog) => {
      try {
        await logStorageService.redactSensitiveData(log.id);

        // Refresh the log details
        const updatedLog = await logStorageService.getInteractionLog(log.id);
        if (updatedLog) {
          const toolCalls = await logStorageService.getToolExecutionLogs(
            log.id
          );
          updatedLog.toolCalls = toolCalls;
          setSelectedLog(updatedLog);

          // Update in the logs list as well
          setLogs(prev => prev.map(l => (l.id === log.id ? updatedLog : l)));
        }

        showNotification({
          type: 'success',
          title: 'Success',
          message: 'Sensitive data redacted successfully',
        });
      } catch (error) {
        console.error('Failed to redact sensitive data:', error);
        showNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to redact sensitive data',
        });
      }
    },
    [logStorageService, showNotification]
  );

  return (
    <div className={className}>
      <LogViewer
        logs={logs}
        loading={loading}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        onLoadMore={handleLoadMore}
        onFilterChange={handleFilterChange}
        onLogSelect={handleLogSelect}
        onLogDelete={handleLogDelete}
        onRefresh={handleRefresh}
      />

      {selectedLog && (
        <LogDetailView
          log={selectedLog}
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={() => handleLogDelete(selectedLog.id)}
          onExport={() => handleLogExport(selectedLog)}
          onRedactSensitiveData={() => handleRedactSensitiveData(selectedLog)}
        />
      )}
    </div>
  );
}
