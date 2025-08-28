import React, { createContext, useContext } from 'react';
import { Task } from '../types';
import { useTimerWithPreferences } from '../hooks/useTimerWithPreferences';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { getTimeTrackingRepository } from '../services/database/repositories';

interface TaskTimerProps {
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerStop: () => void;
  activeTimerTaskId: string | null;
  isTimerRunning: boolean;
  elapsedTime: number;
}

interface TimerContextType {
  // State
  isRunning: boolean;
  elapsedTime: number;
  activeTaskId: string | null;
  hasActiveTimer: boolean;
  activeTask?: Task;
  activeSessionId?: string;
  isInitialized: boolean;

  // Actions
  startTimer: (task: Task) => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  getTaskTimerProps: (task: Task) => TaskTimerProps;
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
  const [activeSessionId, setActiveSessionId] = React.useState<
    string | undefined
  >();
  const [isInitialized, setIsInitialized] = React.useState(false);
  const { breakReminders } = useUserPreferences();
  const timeRepo = getTimeTrackingRepository();

  // Session recovery and cleanup on startup
  React.useEffect(() => {
    const handleSessionRecovery = async () => {
      try {
        // Check for any active sessions in the database
        const activeSession = await timeRepo.getActiveSession();

        if (activeSession) {
          console.log('Found active session on startup:', activeSession.id);

          // Calculate how long ago this session was started
          const now = new Date();
          const sessionAge = now.getTime() - activeSession.startTime.getTime();
          const ageInHours = sessionAge / (1000 * 60 * 60);

          // If the session is more than 12 hours old, consider it orphaned and clean it up
          if (ageInHours > 12) {
            console.log(
              'Cleaning up orphaned session:',
              activeSession.id,
              'Age:',
              Math.round(ageInHours),
              'hours'
            );
            await timeRepo.stopSession(
              activeSession.id,
              'Auto-stopped: Session was orphaned from previous app session'
            );
          } else {
            // For recent sessions, we could potentially recover them
            // For now, we'll also clean them up but with a different note
            console.log(
              'Cleaning up recent active session:',
              activeSession.id,
              'Age:',
              Math.round(ageInHours),
              'hours'
            );
            await timeRepo.stopSession(
              activeSession.id,
              'Auto-stopped: App restarted with active session'
            );
          }
        }

        // Also clean up any other potential orphaned sessions
        const incompleteSessions = await timeRepo.getIncompleteSessions();
        for (const session of incompleteSessions) {
          const sessionAge = new Date().getTime() - session.startTime.getTime();
          const ageInHours = sessionAge / (1000 * 60 * 60);

          if (ageInHours > 12) {
            console.log('Cleaning up incomplete session:', session.id);
            await timeRepo.stopSession(
              session.id,
              'Auto-stopped: Incomplete session cleanup'
            );
          }
        }

        console.log('Session recovery and cleanup completed');
      } catch (error) {
        console.error('Error during session recovery:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    // Run session recovery on component mount
    handleSessionRecovery();
  }, [timeRepo]);

  const timer = useTimerWithPreferences({
    onTimerStart: task => {
      console.log('Timer started for:', task.title);
      setActiveTask(task);

      // Create a database session for this timer (fire and forget)
      timeRepo
        .startSession(task.id)
        .then(session => {
          setActiveSessionId(session.id);
          console.log('Database session created:', session.id);
        })
        .catch(error => {
          console.error('Failed to create database session:', error);
          // Continue with timer even if database fails
        });
    },
    onTimerStop: (task, elapsedTime) => {
      // Use the stored activeTask instead of the minimal task object from useSimpleTimer
      const taskToLog = activeTask || { title: 'Unknown Task', id: task.id };

      console.log(
        'Timer stopped for:',
        taskToLog.title,
        'Duration:',
        Math.floor(elapsedTime / 1000),
        'seconds'
      );

      // Save time to database if we have an active session (fire and forget)
      if (activeSessionId) {
        timeRepo
          .stopSession(activeSessionId)
          .then(completedSession => {
            console.log('Database session completed:', completedSession);
          })
          .catch(error => {
            console.error('Failed to save session to database:', error);
          });
      }

      // Clear state
      setActiveSessionId(undefined);
      setTimeout(() => setActiveTask(undefined), 2000);
    },
    onBreakReminder: () => {
      if (breakReminders && typeof window !== 'undefined') {
        // Show break reminder notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Time for a break!', {
            body: "You've been working for a while. Consider taking a short break.",
            icon: '/favicon.ico',
          });
        } else {
          // Fallback to console log or other notification method
          console.log('Break reminder: Time for a break!');
        }
      }
    },
  });

  // Custom pause timer function with database integration
  const pauseTimerWithDB = React.useCallback(() => {
    // Pause the UI timer
    timer.pauseTimer();

    // Pause the database session if we have one
    if (activeSessionId) {
      timeRepo
        .pauseSession(activeSessionId)
        .then(() => {
          console.log('Database session paused:', activeSessionId);
        })
        .catch(error => {
          console.error('Failed to pause database session:', error);
        });
    }
  }, [timer, activeSessionId, timeRepo]);

  // Custom start/resume timer function with database integration
  const startTimerWithDB = React.useCallback(
    (task: Task) => {
      // If we have an active session for this task, it's a resume operation
      if (activeSessionId && activeTask?.id === task.id) {
        // Resume the UI timer
        timer.startTimer(task);

        // Resume the database session
        timeRepo
          .resumeSession(activeSessionId)
          .then(() => {
            console.log('Database session resumed:', activeSessionId);
          })
          .catch(error => {
            console.error('Failed to resume database session:', error);
          });
      } else {
        // Start new timer (this will trigger the onTimerStart callback)
        timer.startTimer(task);
      }
    },
    [timer, activeSessionId, activeTask, timeRepo]
  );

  const contextValue: TimerContextType = {
    // State
    isRunning: timer.isRunning,
    elapsedTime: timer.elapsedTime,
    activeTaskId: timer.activeTaskId,
    hasActiveTimer: timer.hasActiveTimer,
    activeTask,
    activeSessionId,
    isInitialized,

    // Actions
    startTimer: startTimerWithDB,
    pauseTimer: pauseTimerWithDB,
    stopTimer: timer.stopTimer,
    getTaskTimerProps: timer.getTaskTimerProps,
    formatElapsedTime: timer.formatElapsedTime,

    // Legacy compatibility
    handleTimerStart: startTimerWithDB,
    handleTimerPause: () => pauseTimerWithDB(),
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
