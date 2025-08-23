import React, { useState } from 'react';
import {
  BarChart3,
  Settings,
  Clock,
  Pause,
  Play,
  Square,
  History,
} from 'lucide-react';
import { useTimerContext } from '../../contexts/TimerContext';
import { useTranslation } from '../../hooks/useTranslation';
import { SessionHistoryModal } from '../timer/SessionHistory';
import { AppLogo } from './AppLogo';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string, params?: Record<string, unknown>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
}) => {
  const {
    elapsedTime,
    isRunning,
    hasActiveTimer,
    formatElapsedTime,
    activeTask,
    handleTimerStart,
    handleTimerPause,
    handleTimerStop,
  } = useTimerContext();
  const { t } = useTranslation();

  const [showSessionLogs, setShowSessionLogs] = useState(false);

  const handleTimerControl = () => {
    if (!activeTask) {
      return;
    }

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
    if (!activeTask) {
      return;
    }

    try {
      handleTimerStop(activeTask);
    } catch (error) {
      console.error('Timer stop error:', error);
    }
  };

  return (
    <header className='flex items-center justify-between px-6 py-4 border-b border-divider bg-content1 shadow-sm'>
      <div className='flex items-center gap-3'>
        <AppLogo size={32} />
        <h1 className='text-xl font-bold text-foreground'>KiraPilot</h1>

        {/* Timer Display and Controls */}
        {hasActiveTimer && activeTask && (
          <div className='flex items-center gap-2 ml-4 px-3 py-2 bg-content2 rounded-lg border border-divider shadow-sm'>
            <div className='flex items-center gap-1'>
              {isRunning ? (
                <div className='flex items-center gap-1'>
                  <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                  <Clock className='w-4 h-4 text-green-500' />
                </div>
              ) : (
                <div className='flex items-center gap-1'>
                  <div className='w-2 h-2 bg-orange-500 rounded-full' />
                  <Pause className='w-4 h-4 text-orange-500' />
                </div>
              )}
            </div>
            <span className='text-sm font-mono text-foreground font-medium'>
              {formatElapsedTime(elapsedTime)}
            </span>
            <span className='text-xs text-foreground-600 max-w-24 truncate'>
              {activeTask.title}
            </span>

            {/* Timer Controls */}
            <div className='flex items-center gap-1 ml-2 pl-2 border-l border-divider'>
              <button
                onClick={handleTimerControl}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  isRunning
                    ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-500/10'
                    : 'text-green-500 hover:text-green-600 hover:bg-green-500/10'
                }`}
                title={isRunning ? t('timer.pause') : t('timer.start')}
              >
                {isRunning ? (
                  <Pause className='w-3.5 h-3.5' />
                ) : (
                  <Play className='w-3.5 h-3.5' />
                )}
              </button>

              <button
                onClick={handleStopTimer}
                className='p-1.5 rounded-md text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-all duration-200'
                title={t('timer.stop')}
              >
                <Square className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className='flex items-center gap-3'>
        {/* Week/Day Toggle */}
        <div className='flex rounded-lg border border-divider overflow-hidden bg-content2 shadow-sm'>
          <button
            onClick={() => onViewChange('week')}
            className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
              currentView === 'week'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-foreground-700 hover:text-foreground hover:bg-content3'
            }`}
          >
            {t('nav.week')}
          </button>
          <button
            onClick={() => onViewChange('day')}
            className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
              currentView === 'day'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-foreground-700 hover:text-foreground hover:bg-content3'
            }`}
          >
            {t('nav.day')}
          </button>
        </div>

        {/* Session Logs Button */}
        <button
          onClick={() => setShowSessionLogs(true)}
          className='p-2.5 rounded-lg transition-all duration-200 text-foreground-600 hover:text-foreground hover:bg-content2 border border-transparent hover:border-divider'
          title={t('timer.sessionHistory') || 'Session History'}
        >
          <History className='w-5 h-5' />
        </button>

        {/* Other Navigation Buttons */}
        {[
          { icon: BarChart3, label: t('nav.reports'), id: 'reports' },
          { icon: Settings, label: t('nav.settings'), id: 'settings' },
        ].map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`p-2.5 rounded-lg transition-all duration-200 border ${
              currentView === id
                ? 'bg-primary-500/10 text-primary-600 border-primary-500/20'
                : 'text-foreground-600 hover:text-foreground hover:bg-content2 border-transparent hover:border-divider'
            }`}
            title={label}
          >
            <Icon className='w-5 h-5' />
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
