import { useEffect } from 'react';
import { useUserPreferences } from './useUserPreferences';
import { useSimpleTimer } from './useSimpleTimer';
import { Task } from '../types';

interface UseTimerWithPreferencesOptions {
  onTimerStart?: (task: Task) => void;
  onTimerStop?: (task: Task, elapsedTime: number) => void;
  onBreakReminder?: () => void;
}

export const useTimerWithPreferences = (
  options: UseTimerWithPreferencesOptions = {}
) => {
  const { defaultSessionDuration, breakInterval, breakReminders } =
    useUserPreferences();

  const timer = useSimpleTimer({
    onTimerStart: options.onTimerStart,
    onTimerStop: options.onTimerStop,
    enableNotifications: breakReminders,
  });

  // Check for break reminders
  useEffect(() => {
    if (timer.isRunning && breakReminders && options.onBreakReminder) {
      const breakIntervalMs = breakInterval * 60 * 1000; // Convert minutes to milliseconds

      if (timer.elapsedTime > 0 && timer.elapsedTime % breakIntervalMs < 1000) {
        options.onBreakReminder();
      }
    }
  }, [
    timer.elapsedTime,
    timer.isRunning,
    breakInterval,
    breakReminders,
    options.onBreakReminder,
  ]);

  // Suggest session end based on default duration
  const shouldSuggestBreak = () => {
    const defaultDurationMs = defaultSessionDuration * 60 * 1000;
    return timer.elapsedTime >= defaultDurationMs;
  };

  const getSessionProgress = () => {
    const defaultDurationMs = defaultSessionDuration * 60 * 1000;
    return Math.min((timer.elapsedTime / defaultDurationMs) * 100, 100);
  };

  return {
    ...timer,
    defaultSessionDuration,
    breakInterval,
    shouldSuggestBreak,
    getSessionProgress,
  };
};
