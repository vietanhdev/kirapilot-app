import React from 'react';
import {
  BarChart3,
  Settings,
  Clock,
  Pause,
  Play,
  Square,
  FileText,
  Repeat,
  Focus,
  Expand,
} from 'lucide-react';
import { WindowStateManager } from '../../utils/windowStateManager';
import { useTimerContext } from '../../contexts/TimerContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../contexts/SettingsContext';
import { AppLogo } from './AppLogo';
import { TaskListDropdown } from './TaskListDropdown';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string, params?: Record<string, unknown>) => void;
  isFocusMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  isFocusMode = false,
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
  const { preferences } = useSettings();

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

  const handleFocusMode = async () => {
    try {
      console.log('🎯 Entering focus mode...');

      // Get current state for debugging
      const currentState = await WindowStateManager.getCurrentWindowState();
      console.log('Current window state before focus:', currentState);

      // Save current window state before entering focus mode
      const savedState = await WindowStateManager.saveCurrentWindowState();
      if (savedState) {
        console.log('✅ Window state saved successfully');
      } else {
        console.log('⚠️ Failed to save window state');
      }

      // Set focus mode dimensions
      await WindowStateManager.setFocusMode();

      // Verify focus mode was set correctly
      setTimeout(async () => {
        const focusState = await WindowStateManager.getCurrentWindowState();
        console.log('🔍 Focus mode state verification:', focusState);
      }, 200);

      // Switch to focus view
      onViewChange('focus');
    } catch (error) {
      console.error('❌ Error entering focus mode:', error);
    }
  };

  const handleExpandWindow = async () => {
    try {
      console.log('🔄 Expanding window from focus mode...');

      // Always maximize the window when expanding from focus mode
      await WindowStateManager.maximizeWindow();
      console.log('✅ Window maximized successfully');

      // Clear any stored state since we're always maximizing
      WindowStateManager.clearWindowState();

      // Switch back to dashboard view
      onViewChange('dashboard');
    } catch (error) {
      console.error('❌ Error expanding window:', error);

      // Even if maximization fails, still switch back to dashboard
      onViewChange('dashboard');
    }
  };

  return (
    <header className='flex items-center justify-between px-4 sm:px-6 py-4 border-b border-divider bg-content1 shadow-sm'>
      <div className='flex items-center gap-2 sm:gap-3 min-w-0 flex-1'>
        <AppLogo
          size={isFocusMode ? 28 : 36}
          onClick={() => !isFocusMode && onViewChange('week')}
        />

        {/* Task List Dropdown - Hidden in Focus mode */}
        {!isFocusMode && <TaskListDropdown className='flex-shrink-0' />}

        {/* Timer Display and Controls */}
        {hasActiveTimer && activeTask && (
          <div className='flex items-center gap-2 ml-2 sm:ml-4 px-2 sm:px-3 py-2 bg-content2 rounded-lg border border-divider shadow-sm flex-shrink-0'>
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
            <span className='text-xs text-foreground-600 max-w-16 sm:max-w-24 truncate hidden sm:block'>
              {activeTask.title}
            </span>

            {/* Timer Controls */}
            <div className='flex items-center gap-1 ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-divider'>
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

      {/* Focus Mode Expand Button */}
      {isFocusMode && (
        <button
          onClick={handleExpandWindow}
          className='px-3 py-2 text-sm font-medium transition-all duration-200 bg-content2 text-foreground border border-divider hover:bg-content3 hover:border-foreground-300 flex items-center gap-1.5 rounded-lg'
        >
          <Expand className='w-4 h-4' />
          Expand
        </button>
      )}

      {/* Navigation - Hidden in Focus mode */}
      {!isFocusMode && (
        <nav className='flex items-center gap-2 sm:gap-3 flex-shrink-0'>
          {/* Focus Button - Separate from view toggle */}
          <button
            onClick={handleFocusMode}
            className='p-2 rounded-lg transition-all duration-200 border border-divider bg-content2 text-foreground-600 hover:text-foreground hover:bg-content3 hover:border-foreground-300 flex items-center gap-1.5'
            title='Enter Focus Mode'
          >
            <Focus className='w-4 h-4' />
            <span className='hidden sm:inline text-sm'>Focus</span>
          </button>

          {/* Dashboard/Week/Day/Kira View Toggle */}
          <div className='flex rounded-lg border border-divider overflow-hidden bg-content2 shadow-sm'>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 ${
                currentView === 'dashboard'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-foreground-700 hover:text-foreground hover:bg-content3'
              }`}
            >
              Today
            </button>
            <div className='w-px bg-divider' />
            <button
              onClick={() => onViewChange('week')}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 ${
                currentView === 'week'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-foreground-700 hover:text-foreground hover:bg-content3'
              }`}
            >
              {t('nav.week')}
            </button>
            <div className='w-px bg-divider' />
            <button
              onClick={() => onViewChange('day')}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 ${
                currentView === 'day'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-foreground-700 hover:text-foreground hover:bg-content3'
              }`}
            >
              {t('nav.day')}
            </button>
            <div className='w-px bg-divider' />
            <button
              onClick={() => onViewChange('kira')}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 ${
                currentView === 'kira'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-foreground-700 hover:text-foreground hover:bg-content3'
              }`}
            >
              Kira
            </button>
          </div>

          {/* Recurring Tasks Button */}
          <button
            onClick={() => onViewChange('recurring')}
            className={`p-2.5 rounded-lg transition-all duration-200 border ${
              currentView === 'recurring'
                ? 'bg-primary-500/10 text-primary-600 border-primary-500/20'
                : 'text-foreground-600 hover:text-foreground hover:bg-content2 border-transparent hover:border-divider'
            }`}
            title={t('nav.recurring') || 'Recurring Tasks'}
          >
            <Repeat className='w-5 h-5' />
          </button>

          {/* Other Navigation Buttons */}
          {[
            { icon: BarChart3, label: t('nav.reports'), id: 'reports' },
            ...(preferences.aiSettings.showInteractionLogs
              ? [{ icon: FileText, label: t('nav.logs'), id: 'logs' }]
              : []),
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
      )}
    </header>
  );
};
