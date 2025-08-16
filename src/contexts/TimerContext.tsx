import React, { createContext, useContext } from 'react';
import { Task } from '../types';
import { useSimpleTimer } from '../hooks/useSimpleTimer';

interface TimerContextType {
  // State
  isRunning: boolean;
  elapsedTime: number;
  activeTaskId: string | null;
  hasActiveTimer: boolean;
  activeTask?: Task;

  // Actions
  startTimer: (task: Task) => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  getTaskTimerProps: (task: Task) => any;
  formatElapsedTime: (milliseconds?: number) => string;

  // Legacy compatibility
  handleTimerStart: (task: Task) => void;
  handleTimerPause: (task: Task) => void;
  handleTimerStop: (task: Task) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

interface TimerProviderProps {
  children: React.ReactNode;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({ children }) => {
  const [activeTask, setActiveTask] = React.useState<Task | undefined>();

  const timer = useSimpleTimer({
    onTimerStart: task => {
      console.log('Timer started for:', task.title);
      setActiveTask(task);
    },
    onTimerStop: (task, elapsedTime) => {
      console.log(
        'Timer stopped for:',
        task.title,
        'Duration:',
        Math.floor(elapsedTime / 1000),
        'seconds'
      );

      // TODO: Here you can add database persistence if needed
      // For now, we'll just clear the active task after a delay
      setTimeout(() => setActiveTask(undefined), 2000);
    },
    // Enable notifications in Tauri environment
    enableNotifications: typeof window !== 'undefined' && '__TAURI__' in window,
  });

  const contextValue: TimerContextType = {
    // State
    isRunning: timer.isRunning,
    elapsedTime: timer.elapsedTime,
    activeTaskId: timer.activeTaskId,
    hasActiveTimer: timer.hasActiveTimer,
    activeTask,

    // Actions
    startTimer: timer.startTimer,
    pauseTimer: timer.pauseTimer,
    stopTimer: timer.stopTimer,
    getTaskTimerProps: timer.getTaskTimerProps,
    formatElapsedTime: timer.formatElapsedTime,

    // Legacy compatibility
    handleTimerStart: timer.startTimer,
    handleTimerPause: () => timer.pauseTimer(),
    handleTimerStop: () => timer.stopTimer(),
  };

  return (
    <TimerContext.Provider value={contextValue}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimerContext = (): TimerContextType => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimerContext must be used within a TimerProvider');
  }
  return context;
};
