import React, { useState, useEffect } from 'react';
import { Clock, Calendar, FileText, Trash2, BarChart3 } from 'lucide-react';
import { TimerSession, Task } from '../../types';
import { TimeTrackingRepository } from '../../services/database/repositories/TimeTrackingRepository';
import { useDatabaseOperation } from '../../hooks/useDatabase';

interface SessionHistoryProps {
  taskId?: string;
  limit?: number;
  showTaskInfo?: boolean;
  className?: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  taskId,
  limit = 10,
  showTaskInfo = true,
  className = ''
}) => {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [statistics, setStatistics] = useState<any>(null);
  
  const { execute, isLoading, error } = useDatabaseOperation();
  const timeTrackingRepo = new TimeTrackingRepository();

  // Load sessions and statistics
  useEffect(() => {
    const loadData = async () => {
      let sessionsData: TimerSession[] = [];
      
      if (taskId) {
        sessionsData = await timeTrackingRepo.getByTask(taskId);
      } else {
        const endDate = new Date();
        let startDate = new Date();
        
        switch (selectedPeriod) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'all':
            startDate = new Date(0); // Beginning of time
            break;
        }
        
        sessionsData = await timeTrackingRepo.getByDateRange(startDate, endDate);
      }
      
      // Limit results
      const limitedSessions = sessionsData.slice(0, limit);
      setSessions(limitedSessions);
      
      // Load statistics
      if (!taskId) {
        const stats = await timeTrackingRepo.getStatistics();
        setStatistics(stats);
      }
      
      // Load task information if needed
      if (showTaskInfo && limitedSessions.length > 0) {
        // This would need to be implemented with TaskRepository
        // For now, we'll skip loading task details
      }
    };
    
    execute(loadData);
  }, [taskId, selectedPeriod, limit, showTaskInfo, execute]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }
    
    await execute(async () => {
      await timeTrackingRepo.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    });
  };

  const formatDuration = (milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSessionDuration = (session: TimerSession): number => {
    if (!session.endTime) return 0;
    const startTime = typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime;
    const endTime = typeof session.endTime === 'string' ? new Date(session.endTime) : session.endTime;
    return endTime.getTime() - startTime.getTime() - session.pausedTime;
  };

  const getProductivityScore = (session: TimerSession): number => {
    const startTime = typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime;
    const endTime = session.endTime ? (typeof session.endTime === 'string' ? new Date(session.endTime) : session.endTime) : null;
    const totalDuration = endTime ? endTime.getTime() - startTime.getTime() : 0;
    if (totalDuration === 0) return 0;
    
    const workTime = totalDuration - session.pausedTime;
    return Math.round((workTime / totalDuration) * 100);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {taskId ? 'Task Sessions' : 'Session History'}
            </h3>
          </div>
          
          {!taskId && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          )}
        </div>

        {/* Statistics Summary */}
        {statistics && !taskId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {statistics.totalSessions}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Sessions</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatDuration(statistics.totalWorkTime)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Work Time</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {Math.round(statistics.averageProductivity)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Productivity</div>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {statistics.mostProductiveHour}:00
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Peak Hour</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">No timer sessions found</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Start a timer to track your work sessions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-gray-200 dark:border-gray-600 rounded p-3 
                  hover:shadow-md dark:hover:bg-gray-700/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime)}
                        </span>
                      </div>
                      
                      {session.endTime && (
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {getProductivityScore(session)}% productive
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 mb-2">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {session.endTime ? 
                          formatDuration(getSessionDuration(session)) : 
                          'In Progress'
                        }
                      </div>
                      
                      {session.breaks.length > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {session.breaks.length} break{session.breaks.length !== 1 ? 's' : ''} 
                          ({formatDuration(session.pausedTime)})
                        </div>
                      )}
                    </div>
                    
                    {session.notes && (
                      <div className="flex items-start space-x-2 mt-2">
                        <FileText className="w-3 h-3 text-gray-500 dark:text-gray-400 mt-0.5" />
                        <p className="text-xs text-gray-700 dark:text-gray-300">{session.notes}</p>
                      </div>
                    )}
                    
                    {session.breaks.length > 0 && (
                      <div className="mt-2">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                            View breaks ({session.breaks.length})
                          </summary>
                          <div className="mt-1 space-y-1 pl-3">
                            {session.breaks.map((breakItem, index) => {
                              const startTime = typeof breakItem.startTime === 'string' ? new Date(breakItem.startTime) : breakItem.startTime;
                              const endTime = typeof breakItem.endTime === 'string' ? new Date(breakItem.endTime) : breakItem.endTime;
                              const duration = endTime && startTime ? endTime.getTime() - startTime.getTime() : 0;
                              
                              return (
                                <div key={breakItem.id} className="text-xs text-gray-600 dark:text-gray-400">
                                  Break {index + 1}: {breakItem.reason} - {formatDuration(duration)}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionHistory;