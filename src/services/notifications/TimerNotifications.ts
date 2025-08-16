// Timer notification service for break reminders and session alerts
import { TimerSession } from '../../types';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export class TimerNotifications {
  private static instance: TimerNotifications;
  private permission: NotificationPermission = 'default';
  private activeNotifications: Map<string, Notification> = new Map();
  private breakReminders: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.checkPermission();
  }

  static getInstance(): TimerNotifications {
    if (!TimerNotifications.instance) {
      TimerNotifications.instance = new TimerNotifications();
    }
    return TimerNotifications.instance;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission;
  }

  /**
   * Check current notification permission
   */
  private checkPermission(): void {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Show a notification
   */
  async showNotification(
    options: NotificationOptions
  ): Promise<Notification | null> {
    // Try Tauri notifications first
    try {
      // Check if we're in Tauri environment
      if ('__TAURI__' in window) {
        const { sendNotification } = await import(
          '@tauri-apps/plugin-notification'
        );
        await sendNotification({
          title: options.title,
          body: options.body,
          icon: options.icon || '/tauri.svg',
        });
        return null; // Tauri notifications don't return Notification objects
      }
    } catch (error) {
      console.log(
        'Tauri notifications not available, falling back to web notifications'
      );
    }

    // Fallback to web notifications
    // Only try to request permission if not already denied
    if (this.permission === 'default') {
      await this.requestPermission();
    }

    if (this.permission !== 'granted') {
      // Silently fail if permission not granted - don't warn every time
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/tauri.svg',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        // Note: actions are not supported in all browsers
      });

      if (options.tag) {
        // Close any existing notification with the same tag
        const existing = this.activeNotifications.get(options.tag);
        if (existing) {
          existing.close();
        }
        this.activeNotifications.set(options.tag, notification);
      }

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
          if (options.tag) {
            this.activeNotifications.delete(options.tag);
          }
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Show notification when session starts
   */
  async notifySessionStart(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: 'Timer Started',
      body: `Working on: ${taskTitle}`,
      tag: 'session-start',
    });
  }

  /**
   * Show notification when session is paused
   */
  async notifySessionPause(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: 'Timer Paused',
      body: `Paused work on: ${taskTitle}`,
      tag: 'session-pause',
    });
  }

  /**
   * Show notification when session is resumed
   */
  async notifySessionResume(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: 'Timer Resumed',
      body: `Resumed work on: ${taskTitle}`,
      tag: 'session-resume',
    });
  }

  /**
   * Notify when session stops
   */
  async notifySessionStop(
    sessionId: string,
    taskTitle: string,
    duration: number
  ): Promise<void> {
    const formattedDuration = this.formatDuration(duration);

    await this.showNotification({
      title: 'Session Completed',
      body: `Completed ${taskTitle} in ${formattedDuration}`,
      tag: 'session-complete',
      requireInteraction: true,
      icon: '/tauri.svg',
    });

    // Clear any break reminders for this session
    this.clearBreakReminders(sessionId);
  }

  /**
   * Set up break reminders for a session
   */
  setupBreakReminders(
    sessionId: string,
    intervalMinutes: number = 25,
    taskTitle: string
  ): void {
    // Clear any existing reminders for this session
    this.clearBreakReminders(sessionId);

    const intervalMs = intervalMinutes * 60 * 1000;

    const reminderInterval = setInterval(async () => {
      await this.showNotification({
        title: 'Break Reminder',
        body: `You've been working on "${taskTitle}" for ${intervalMinutes} minutes. Consider taking a break!`,
        tag: `break-reminder-${sessionId}`,
        requireInteraction: true,
        icon: '/tauri.svg',
      });
    }, intervalMs);

    this.breakReminders.set(sessionId, reminderInterval);
  }

  /**
   * Clear break reminders for a session
   */
  clearBreakReminders(sessionId: string): void {
    const reminder = this.breakReminders.get(sessionId);
    if (reminder) {
      clearInterval(reminder);
      this.breakReminders.delete(sessionId);
    }

    // Close any active break reminder notification
    const notification = this.activeNotifications.get(
      `break-reminder-${sessionId}`
    );
    if (notification) {
      notification.close();
      this.activeNotifications.delete(`break-reminder-${sessionId}`);
    }
  }

  /**
   * Notify about break time
   */
  async notifyBreakTime(duration: number = 5): Promise<void> {
    await this.showNotification({
      title: 'Break Time!',
      body: `Take a ${duration} minute break to recharge`,
      tag: 'break-time',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  /**
   * Notify when break ends
   */
  async notifyBreakEnd(): Promise<void> {
    await this.showNotification({
      title: 'Break Over',
      body: 'Ready to get back to work?',
      tag: 'break-end',
      icon: '/tauri.svg',
    });
  }

  /**
   * Show daily summary notification
   */
  async notifyDailySummary(
    totalTime: number,
    sessionsCount: number,
    tasksCompleted: number
  ): Promise<void> {
    const formattedTime = this.formatDuration(totalTime);

    await this.showNotification({
      title: 'Daily Summary',
      body: `Today: ${formattedTime} across ${sessionsCount} sessions, ${tasksCompleted} tasks completed`,
      tag: 'daily-summary',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  /**
   * Show productivity milestone notification
   */
  async notifyProductivityMilestone(
    milestone: string,
    achievement: string
  ): Promise<void> {
    await this.showNotification({
      title: `🎉 ${milestone}`,
      body: achievement,
      tag: 'productivity-milestone',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  /**
   * Close all active notifications
   */
  closeAllNotifications(): void {
    this.activeNotifications.forEach(notification => {
      notification.close();
    });
    this.activeNotifications.clear();
  }

  /**
   * Clear all break reminders
   */
  clearAllBreakReminders(): void {
    this.breakReminders.forEach(reminder => {
      clearInterval(reminder);
    });
    this.breakReminders.clear();
  }

  /**
   * Format duration in milliseconds to human readable string
   */
  private formatDuration(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.closeAllNotifications();
    this.clearAllBreakReminders();
  }
}

// Export singleton instance
export const timerNotifications = TimerNotifications.getInstance();
