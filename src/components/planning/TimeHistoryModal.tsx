// Modal component for viewing task time history
import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Coffee } from 'lucide-react';
import { Task, TimerSession } from '../../types';
import { TimeTrackingRepository } from '../../services/database/repositories/TimeTrackingRepository';

interface TimeHistoryModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TimeHistoryModal({ task, isOpen, onClose }: TimeHistoryModalProps) {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadTimeSessions();
    }
  }, [isOpen, task]);

  const loadTimeSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const timeTrackingRepo = new TimeTrackingRepository();
      const taskSessions = await timeTrackingRepo.getByTask(task.id);
      setSessions(taskSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time sessions');
    } finally {
      setIsLoading(false);
    }
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
    return session.endTime.getTime() - session.startTime.getTime() - session.pausedTime;
  };

  const completedSessions = sessions.filter(s => s.endTime);
  const totalWorkTime = completedSessions.reduce((total, session) => total + getSessionDuration(session), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Time History
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {task.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {completedSessions.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatDuration(totalWorkTime)}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Total Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {task.actualTime}min
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Recorded</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-slate-400 mt-2">Loading sessions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-slate-400">No time sessions found</p>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                Start a timer to track your work on this task
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {formatDate(session.startTime)}
                          </span>
                        </div>
                        
                        {session.endTime && (
                          <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                            {formatDuration(getSessionDuration(session))}
                          </div>
                        )}
                        
                        {!session.endTime && (
                          <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                            In Progress
                          </div>
                        )}
                      </div>
                      
                      {session.breaks.length > 0 && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400 mb-2">
                          <Coffee className="w-4 h-4" />
                          <span>
                            {session.breaks.length} break{session.breaks.length !== 1 ? 's' : ''} 
                            ({formatDuration(session.pausedTime)})
                          </span>
                        </div>
                      )}
                      
                      {session.notes && (
                        <div className="text-sm text-gray-700 dark:text-slate-300 mt-2">
                          {session.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}