import React, { useState } from 'react';
import { Play, Pause, Square, Clock, StickyNote, X } from 'lucide-react';
import { Task, CompletedSession } from '../../types';
import { useTimer } from '../../hooks/useTimer';

interface TimerProps {
  task?: Task;
  onSessionStart?: (session: any) => void;
  onSessionStop?: (completedSession: CompletedSession) => void;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({
  task,
  onSessionStart,
  onSessionStop,
  className = ''
}) => {
  const [sessionNotes, setSessionNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const {
    activeSession,
    elapsedTime,
    isRunning,
    isPaused,
    isLoading,
    error,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    addBreak,
    clearError,
    formatElapsedTime,
    canStart,
    canPause,
    canResume,
    canStop,
    canAddBreak
  } = useTimer({
    enableNotifications: true,
    onSessionStart,
    onSessionStop
  });

  const handleStart = async () => {
    if (!task) return;
    try {
      await startTimer(task, sessionNotes);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  const handlePause = async () => {
    try {
      await pauseTimer();
    } catch (err) {
      console.error('Failed to pause timer:', err);
    }
  };

  const handleResume = async () => {
    try {
      await resumeTimer();
    } catch (err) {
      console.error('Failed to resume timer:', err);
    }
  };

  const handleStop = async () => {
    try {
      await stopTimer(sessionNotes);
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  };

  const handleBreak = async (reason: string, duration: number) => {
    try {
      await addBreak(reason, duration);
    } catch (err) {
      console.error('Failed to add break:', err);
    }
  };

  const getTimerStatus = () => {
    if (isRunning) return 'Running';
    if (isPaused) return 'Paused';
    return 'Stopped';
  };

  const getStatusColor = () => {
    if (isRunning) return 'text-green-600 dark:text-green-400';
    if (isPaused) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
      rounded-lg p-3 shadow-sm transition-colors duration-200
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Timer
          </h3>
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getTimerStatus()}
          </span>
        </div>
      </div>

      {/* Task Info */}
      {task && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
            {task.title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Estimated: {task.timeEstimate}min
          </p>
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-mono font-bold text-gray-900 dark:text-gray-100">
          {formatElapsedTime(elapsedTime)}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-2">
        {/* Primary Controls */}
        <div className="flex space-x-2">
          {canStart && (
            <button
              onClick={handleStart}
              disabled={!task || isLoading}
              className={`
                flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded text-sm font-medium
                transition-all duration-200
                ${!task || isLoading
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
                }
              `}
            >
              <Play className="w-3 h-3" />
              <span>Start</span>
            </button>
          )}

          {canPause && (
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded text-sm font-medium
                bg-yellow-500 hover:bg-yellow-600 text-white
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          {canResume && (
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded text-sm font-medium
                bg-blue-500 hover:bg-blue-600 text-white
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
          )}

          {canStop && (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded text-sm font-medium
                bg-red-500 hover:bg-red-600 text-white
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Break Buttons */}
        {canAddBreak && (
          <div className="flex space-x-2">
            <button
              onClick={() => handleBreak('Short break', 5 * 60 * 1000)}
              className="flex-1 px-2 py-1 text-xs rounded
                bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                hover:bg-gray-200 dark:hover:bg-gray-600 
                transition-colors duration-200 border border-gray-200 dark:border-gray-600"
            >
              5min Break
            </button>
            <button
              onClick={() => handleBreak('Long break', 15 * 60 * 1000)}
              className="flex-1 px-2 py-1 text-xs rounded
                bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                hover:bg-gray-200 dark:hover:bg-gray-600 
                transition-colors duration-200 border border-gray-200 dark:border-gray-600"
            >
              15min Break
            </button>
          </div>
        )}

        {/* Notes Section */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400 
              hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <StickyNote className="w-3 h-3" />
            <span>Session Notes</span>
          </button>

          {showNotes && (
            <div className="mt-2">
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Add notes about this session..."
                className="w-full h-16 px-2 py-1 text-xs rounded resize-none
                  bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                  text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-colors duration-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timer; 