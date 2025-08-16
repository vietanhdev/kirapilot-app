import React, { useState } from 'react';
import { BarChart3, Settings, CheckCircle, Clock, Pause, Play, Square, History, X, Trash2 } from 'lucide-react';
import { useTimerContext } from '../../contexts/TimerContext';
import { SessionHistoryModal } from '../timer/SessionHistory';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange }) => {
  const { 
    elapsedTime, 
    isRunning, 
    hasActiveTimer,
    formatElapsedTime, 
    activeTask,
    handleTimerStart,
    handleTimerPause,
    handleTimerStop
  } = useTimerContext();
  
  const [showSessionLogs, setShowSessionLogs] = useState(false);

  const handleTimerControl = () => {
    if (!activeTask) return;
    
    try {
      if (isRunning) {
        handleTimerPause(activeTask);
      } else {
        handleTimerStart(activeTask);
      }
    } catch (error) {
      console.error('Timer control error:', error);
    }
  };

  const handleStopTimer = () => {
    if (!activeTask) return;
    
    try {
      handleTimerStop(activeTask);
    } catch (error) {
      console.error('Timer stop error:', error);
    }
  };

  const handleClearDatabase = async () => {
    if (!import.meta.env.DEV) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to clear all database data? This action cannot be undone.\n\n' +
      'This will clear:\n' +
      '- All tasks and projects\n' +
      '- Timer sessions and history\n' +
      '- User preferences\n' +
      '- All other application data'
    );
    
    if (confirmed) {
      try {
        // Import the reset function dynamically
        const { resetDatabase } = await import('../../utils/resetDatabase');
        resetDatabase();
      } catch (error) {
        console.error('Failed to clear database:', error);
        alert('Failed to clear database. Check console for details.');
      }
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 glass-effect">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-linear-to-br from-primary-500 to-accent-emerald rounded-lg flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-100">KiraPilot</h1>
        
        {/* Timer Display and Controls */}
        {hasActiveTimer && activeTask && (
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-gray-800/50 rounded-lg border border-gray-600/30">
            <div className="flex items-center gap-1">
              {isRunning ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Clock className="w-4 h-4 text-green-400" />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <Pause className="w-4 h-4 text-yellow-400" />
                </div>
              )}
            </div>
            <span className="text-sm font-mono text-gray-300">
              {formatElapsedTime(elapsedTime)}
            </span>
            <span className="text-xs text-gray-400 max-w-24 truncate">
              {activeTask.title}
            </span>
            
            {/* Timer Controls */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handleTimerControl}
                className={`p-1 rounded transition-colors ${
                  isRunning 
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20' 
                    : 'text-green-400 hover:text-green-300 hover:bg-green-500/20'
                }`}
                title={isRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isRunning ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
              </button>
              
              <button
                onClick={handleStopTimer}
                className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                title="Stop timer"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      <nav className="flex items-center gap-3">
        {/* Week/Day Toggle */}
        <div className="flex rounded-md border border-gray-600 overflow-hidden">
          <button
            onClick={() => onViewChange('week')}
            className={`px-2 py-1 text-xs font-medium transition-colors duration-200 ${
              currentView === 'week'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onViewChange('day')}
            className={`px-2 py-1 text-xs font-medium transition-colors duration-200 ${
              currentView === 'day'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
            }`}
          >
            Day
          </button>
        </div>

        {/* Session Logs Button */}
        <button
          onClick={() => setShowSessionLogs(true)}
          className="p-2 rounded-lg transition-colors text-gray-400 hover:text-gray-300 hover:bg-gray-700/30"
          title="Session History"
        >
          <History className="w-5 h-5" />
        </button>

        {/* Development Clear Database Button */}
        {import.meta.env.DEV && (
          <button
            onClick={handleClearDatabase}
            className="p-2 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-red-500/20"
            title="Clear Database (Dev Only)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        {/* Other Navigation Buttons */}
        {[
          { icon: BarChart3, label: 'Reports', id: 'reports' },
          { icon: Settings, label: 'Settings', id: 'settings' },
        ].map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`p-2 rounded-lg transition-colors ${
              currentView === id 
                ? 'bg-primary-500/20 text-primary-400' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>
      
      {/* Session History Modal */}
      <SessionHistoryModal
        isOpen={showSessionLogs}
        onClose={() => setShowSessionLogs(false)}
        limit={20}
        showTaskInfo={true}
      />
    </header>
  );
};