import { useEffect } from 'react';
import { useUserPreferences } from './useUserPreferences';
import { Task } from '../types';

export const useNotifications = () => {
  const { breakReminders, taskDeadlines, dailySummary, weeklyReview } =
    useUserPreferences();

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const canShowNotifications = (): boolean => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  };

  const showBreakReminder = () => {
    if (!breakReminders || !canShowNotifications()) {
      return;
    }

    new Notification('Time for a break! 🧘', {
      body: "You've been working for a while. Consider taking a short break to recharge.",
      icon: '/favicon.ico',
      tag: 'break-reminder',
    });
  };

  const showTaskDeadlineReminder = (task: Task) => {
    if (!taskDeadlines || !canShowNotifications() || !task.dueDate) {
      return;
    }

    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const timeDiff = dueDate.getTime() - now.getTime();
    const hoursUntilDue = Math.floor(timeDiff / (1000 * 60 * 60));

    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      new Notification(`Task deadline approaching! ⏰`, {
        body: `"${task.title}" is due in ${hoursUntilDue} hours.`,
        icon: '/favicon.ico',
        tag: `deadline-${task.id}`,
      });
    }
  };

  const showDailySummary = (completedTasks: number, totalTime: number) => {
    if (!dailySummary || !canShowNotifications()) {
      return;
    }

    const hours = Math.floor(totalTime / (1000 * 60 * 60));
    const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));

    new Notification('Daily Summary 📊', {
      body: `You completed ${completedTasks} tasks and worked for ${hours}h ${minutes}m today. Great job!`,
      icon: '/favicon.ico',
      tag: 'daily-summary',
    });
  };

  const showWeeklyReview = (weeklyStats: {
    completedTasks: number;
    totalTime: number;
    productivity: number;
  }) => {
    if (!weeklyReview || !canShowNotifications()) {
      return;
    }

    const hours = Math.floor(weeklyStats.totalTime / (1000 * 60 * 60));

    new Notification('Weekly Review 📈', {
      body: `This week: ${weeklyStats.completedTasks} tasks completed, ${hours} hours worked. Productivity: ${weeklyStats.productivity}%`,
      icon: '/favicon.ico',
      tag: 'weekly-review',
    });
  };

  const showTaskCompleted = (task: Task) => {
    if (!canShowNotifications()) {
      return;
    }

    new Notification('Task Completed! ✅', {
      body: `Great job completing "${task.title}"!`,
      icon: '/favicon.ico',
      tag: `completed-${task.id}`,
    });
  };

  const showTimerStarted = (task: Task) => {
    if (!canShowNotifications()) {
      return;
    }

    new Notification('Timer Started ⏱️', {
      body: `Working on "${task.title}". Stay focused!`,
      icon: '/favicon.ico',
      tag: `timer-${task.id}`,
    });
  };

  return {
    breakReminders,
    taskDeadlines,
    dailySummary,
    weeklyReview,
    canShowNotifications,
    showBreakReminder,
    showTaskDeadlineReminder,
    showDailySummary,
    showWeeklyReview,
    showTaskCompleted,
    showTimerStarted,
  };
};
