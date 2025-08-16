// Simple, reliable timer implementation
import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '../types';

interface TimerState {
  isRunning: boolean;
  elapsedTime: number;
  activeTaskId: string | null;
  startTime: number | null;
}

interface UseSimpleTimerOptions {
  onTimerStart?: (task: Task) => void;
  onTimerStop?: (task: Task, elapsedTime: number) => void;
  enableNotifications?: boolean;
}

export function useSimpleTimer(options: UseSimpleTimerOptions = {}) {
  const { onTimerStart, onTimerStop, enableNotifications = false } = options;

  const [state, setState] = useState<TimerState>({
    isRunning: false,
    elapsedTime: 0,
    activeTaskId: null,
    startTime: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedTimeRef = useRef<number>(0);

  // Update elapsed time every second when running
  useEffect(() => {
    if (state.isRunning && state.startTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const currentSessionTime = now - state.startTime!;
        setState(prev => ({
          ...prev,
          elapsedTime: pausedTimeRef.current + currentSessionTime,
        }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, state.startTime]);

  const startTimer = useCallback(
    (task: Task) => {
      console.log('Starting timer for:', task.title);

      // If switching tasks, stop current timer first
      if (state.activeTaskId && state.activeTaskId !== task.id) {
        // Save current task's time before switching
        if (state.isRunning && onTimerStop) {
          onTimerStop({ id: state.activeTaskId } as Task, state.elapsedTime);
        }
      }

      const now = Date.now();

      if (state.activeTaskId === task.id) {
        // Resuming same task
        console.log('Resuming timer for same task');
        setState(prev => ({
          ...prev,
          isRunning: true,
          startTime: now,
        }));
      } else {
        // Starting new task
        console.log('Starting timer for new task');
        pausedTimeRef.current = 0;
        setState({
          isRunning: true,
          elapsedTime: 0,
          activeTaskId: task.id,
          startTime: now,
        });
      }

      onTimerStart?.(task);

      // Show notification if enabled
      if (enableNotifications) {
        try {
          if ('__TAURI__' in window) {
            // Tauri notification
            import('@tauri-apps/plugin-notification').then(
              ({ sendNotification }) => {
                sendNotification({
                  title: 'Timer Started',
                  body: `Working on: ${task.title}`,
                });
              }
            );
          } else {
            // Web notification
            if (
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification('Timer Started', {
                body: `Working on: ${task.title}`,
                icon: '/tauri.svg',
              });
            }
          }
        } catch (error) {
          console.log('Notification failed:', error);
        }
      }
    },
    [state, onTimerStart, onTimerStop, enableNotifications]
  );

  const pauseTimer = useCallback(() => {
    if (!state.isRunning) return;

    console.log('Pausing timer');

    // Save current elapsed time to pausedTimeRef
    if (state.startTime) {
      const now = Date.now();
      const currentSessionTime = now - state.startTime;
      pausedTimeRef.current = pausedTimeRef.current + currentSessionTime;
    }

    setState(prev => ({
      ...prev,
      isRunning: false,
      startTime: null,
      elapsedTime: pausedTimeRef.current,
    }));

    // Show notification if enabled
    if (enableNotifications) {
      try {
        if ('__TAURI__' in window) {
          import('@tauri-apps/plugin-notification').then(
            ({ sendNotification }) => {
              sendNotification({
                title: 'Timer Paused',
                body: 'Timer has been paused',
              });
            }
          );
        } else {
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('Timer Paused', {
              body: 'Timer has been paused',
              icon: '/tauri.svg',
            });
          }
        }
      } catch (error) {
        console.log('Notification failed:', error);
      }
    }
  }, [state, enableNotifications]);

  const stopTimer = useCallback(() => {
    if (!state.activeTaskId) return;

    console.log('Stopping timer');

    const finalElapsedTime = state.elapsedTime;
    const task = { id: state.activeTaskId } as Task;

    // Reset everything
    pausedTimeRef.current = 0;
    setState({
      isRunning: false,
      elapsedTime: 0,
      activeTaskId: null,
      startTime: null,
    });

    onTimerStop?.(task, finalElapsedTime);

    // Show notification if enabled
    if (enableNotifications) {
      try {
        const minutes = Math.floor(finalElapsedTime / (1000 * 60));
        const seconds = Math.floor((finalElapsedTime % (1000 * 60)) / 1000);
        const timeText = `${minutes}m ${seconds}s`;

        if ('__TAURI__' in window) {
          import('@tauri-apps/plugin-notification').then(
            ({ sendNotification }) => {
              sendNotification({
                title: 'Timer Stopped',
                body: `Session completed: ${timeText}`,
              });
            }
          );
        } else {
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('Timer Stopped', {
              body: `Session completed: ${timeText}`,
              icon: '/tauri.svg',
            });
          }
        }
      } catch (error) {
        console.log('Notification failed:', error);
      }
    }
  }, [state, onTimerStop, enableNotifications]);

  // Get timer props for a specific task
  const getTaskTimerProps = useCallback(
    (task: Task) => {
      const isActiveTask = state.activeTaskId === task.id;

      return {
        onTimerStart: () => startTimer(task),
        onTimerPause: pauseTimer,
        onTimerStop: stopTimer,
        activeTimerTaskId: state.activeTaskId,
        isTimerRunning: isActiveTask && state.isRunning,
        elapsedTime: isActiveTask ? state.elapsedTime : 0,
      };
    },
    [state, startTimer, pauseTimer, stopTimer]
  );

  const formatElapsedTime = useCallback(
    (milliseconds?: number): string => {
      const ms = milliseconds ?? state.elapsedTime;
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
    [state.elapsedTime]
  );

  return {
    // State
    isRunning: state.isRunning,
    elapsedTime: state.elapsedTime,
    activeTaskId: state.activeTaskId,
    hasActiveTimer: !!state.activeTaskId,

    // Actions
    startTimer,
    pauseTimer,
    stopTimer,
    getTaskTimerProps,
    formatElapsedTime,
  };
}
