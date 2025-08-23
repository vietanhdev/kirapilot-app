import { MockNotificationConfig } from '../setup/testUtils';
import { TimerSession } from '../../types';

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export type NotificationTranslationFunction = (
  key: string,
  variables?: Record<string, string | number>
) => string;

export class MockNotificationService {
  private config: MockNotificationConfig;
  private notifications: MockNotification[] = [];
  private permission: NotificationPermission = 'default';
  private eventListeners: Map<string, Function[]> = new Map();
  private activeNotifications: Map<string, MockNotification> = new Map();
  private breakReminders: Map<string, NodeJS.Timeout> = new Map();
  private t: NotificationTranslationFunction;

  constructor(config: MockNotificationConfig = {}) {
    this.config = {
      enabled: true,
      simulatePermissionDenied: false,
      ...config,
    };

    // Set initial permission based on config
    this.permission = this.config.simulatePermissionDenied
      ? 'denied'
      : 'granted';

    // Default translation function that returns the key if no translation function is provided
    this.t = (key: string) => key;
  }

  /**
   * Set translation function for localized notifications
   */
  setTranslationFunction(
    translationFunction: NotificationTranslationFunction
  ): void {
    this.t = translationFunction;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (this.config.simulatePermissionDenied) {
      this.permission = 'denied';
    } else {
      this.permission = 'granted';
    }
    return this.permission;
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  async showNotification(
    options: NotificationOptions
  ): Promise<MockNotification | null> {
    if (!this.config.enabled) {
      return null; // Silently fail like real notifications
    }

    if (this.permission !== 'granted') {
      return null; // Silently fail like real notifications
    }

    const notification = new MockNotification(options);
    this.notifications.push(notification);

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

    // Emit show event
    this.emit('show', notification);

    return notification;
  }

  async showTimerNotification(
    title: string,
    body: string,
    actions: NotificationAction[] = []
  ): Promise<MockNotification> {
    const notification = await this.showNotification({
      title,
      body,
      icon: '/timer-icon.png',
      tag: 'timer',
      requireInteraction: true,
      actions,
    });

    if (!notification) {
      throw new Error('Failed to show timer notification');
    }

    return notification;
  }

  async showTaskNotification(
    title: string,
    body: string,
    taskId: string
  ): Promise<MockNotification> {
    const notification = await this.showNotification({
      title,
      body,
      icon: '/task-icon.png',
      tag: `task-${taskId}`,
      actions: [
        { action: 'complete', title: 'Mark Complete' },
        { action: 'snooze', title: 'Snooze' },
      ],
    });

    if (!notification) {
      throw new Error('Failed to show task notification');
    }

    return notification;
  }

  async showBreakReminder(duration: number): Promise<MockNotification> {
    const notification = await this.showNotification({
      title: 'Break Time!',
      body: `Time for a ${duration}-minute break`,
      icon: '/break-icon.png',
      tag: 'break-reminder',
      requireInteraction: true,
      actions: [
        { action: 'start-break', title: 'Start Break' },
        { action: 'skip-break', title: 'Skip' },
      ],
    });

    if (!notification) {
      throw new Error('Failed to show break reminder');
    }

    return notification;
  }

  async showFocusSessionComplete(
    taskTitle: string,
    duration: number,
    focusScore?: number
  ): Promise<MockNotification | null> {
    const body = focusScore
      ? `Completed ${duration}min focus session with ${focusScore}% focus score`
      : `Completed ${duration}min focus session`;

    return this.showNotification({
      title: `Focus Session Complete: ${taskTitle}`,
      body,
      icon: '/focus-icon.png',
      tag: 'focus-complete',
      actions: [
        { action: 'continue', title: 'Continue Working' },
        { action: 'take-break', title: 'Take Break' },
      ],
    });
  }

  // TimerNotifications interface methods
  async notifySessionStart(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: this.t('notifications.timer.started'),
      body: this.t('notifications.timer.workingOn', { taskTitle }),
      tag: 'session-start',
    });
  }

  async notifySessionPause(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: this.t('notifications.timer.paused'),
      body: this.t('notifications.timer.pausedWork', { taskTitle }),
      tag: 'session-pause',
    });
  }

  async notifySessionResume(
    _session: TimerSession,
    taskTitle: string
  ): Promise<void> {
    await this.showNotification({
      title: this.t('notifications.timer.resumed'),
      body: this.t('notifications.timer.resumedWork', { taskTitle }),
      tag: 'session-resume',
    });
  }

  async notifySessionStop(
    sessionId: string,
    taskTitle: string,
    duration: number
  ): Promise<void> {
    const formattedDuration = this.formatDuration(duration);

    await this.showNotification({
      title: this.t('notifications.session.completed'),
      body: this.t('notifications.session.completedTask', {
        taskTitle,
        duration: formattedDuration,
      }),
      tag: 'session-complete',
      requireInteraction: true,
      icon: '/tauri.svg',
    });

    // Clear any break reminders for this session
    this.clearBreakReminders(sessionId);
  }

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
        title: this.t('notifications.break.reminder'),
        body: this.t('notifications.break.reminderMessage', {
          taskTitle,
          minutes: intervalMinutes,
        }),
        tag: `break-reminder-${sessionId}`,
        requireInteraction: true,
        icon: '/tauri.svg',
      });
    }, intervalMs);

    this.breakReminders.set(sessionId, reminderInterval);
  }

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

  async notifyBreakTime(duration: number = 5): Promise<void> {
    await this.showNotification({
      title: this.t('notifications.break.time'),
      body: this.t('notifications.break.takeBreak', { duration }),
      tag: 'break-time',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  async notifyBreakEnd(): Promise<void> {
    await this.showNotification({
      title: this.t('notifications.break.over'),
      body: this.t('notifications.break.readyToWork'),
      tag: 'break-end',
      icon: '/tauri.svg',
    });
  }

  async notifyDailySummary(
    totalTime: number,
    sessionsCount: number,
    tasksCompleted: number
  ): Promise<void> {
    const formattedTime = this.formatDuration(totalTime);

    await this.showNotification({
      title: this.t('notifications.daily.summary'),
      body: this.t('notifications.daily.summaryMessage', {
        time: formattedTime,
        sessions: sessionsCount,
        tasks: tasksCompleted,
      }),
      tag: 'daily-summary',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  async notifyProductivityMilestone(
    milestone: string,
    achievement: string
  ): Promise<void> {
    await this.showNotification({
      title: `🎉 ${this.t('notifications.productivity.milestone', { milestone })}`,
      body: achievement,
      tag: 'productivity-milestone',
      requireInteraction: true,
      icon: '/tauri.svg',
    });
  }

  closeAllNotifications(): void {
    this.activeNotifications.forEach(notification => {
      notification.close();
    });
    this.activeNotifications.clear();
    this.notifications.forEach(notification => notification.close());
    this.notifications = [];
  }

  clearAllBreakReminders(): void {
    this.breakReminders.forEach(reminder => {
      clearInterval(reminder);
    });
    this.breakReminders.clear();
  }

  isSupported(): boolean {
    return true; // Mock always supports notifications
  }

  cleanup(): void {
    this.closeAllNotifications();
    this.clearAllBreakReminders();
  }

  private formatDuration(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Clear all notifications
  clearAll(): void {
    this.notifications.forEach(notification => notification.close());
    this.notifications = [];
  }

  // Clear notifications by tag
  clearByTag(tag: string): void {
    const toRemove = this.notifications.filter(n => n.tag === tag);
    toRemove.forEach(notification => {
      notification.close();
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    });
  }

  // Get all notifications for testing
  getNotifications(): MockNotification[] {
    return [...this.notifications];
  }

  // Get notifications by tag
  getNotificationsByTag(tag: string): MockNotification[] {
    return this.notifications.filter(n => n.tag === tag);
  }

  // Event handling
  addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // Configuration methods
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setPermission(permission: NotificationPermission): void {
    this.permission = permission;
  }

  reset(): void {
    this.cleanup();
    this.eventListeners.clear();
    this.permission = this.config.simulatePermissionDenied
      ? 'denied'
      : 'granted';
  }
}

export class MockNotification {
  public readonly title: string;
  public readonly body?: string;
  public readonly icon?: string;
  public readonly tag?: string;
  public readonly requireInteraction?: boolean;
  public readonly silent?: boolean;
  public readonly actions?: NotificationAction[];
  public readonly timestamp: Date;

  private isVisible = true;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(options: NotificationOptions) {
    this.title = options.title;
    this.body = options.body;
    this.icon = options.icon;
    this.tag = options.tag;
    this.requireInteraction = options.requireInteraction;
    this.silent = options.silent;
    this.actions = options.actions;
    this.timestamp = new Date();
  }

  close(): void {
    if (this.isVisible) {
      this.isVisible = false;
      this.emit('close');
    }
  }

  click(): void {
    if (this.isVisible) {
      this.emit('click');
    }
  }

  clickAction(actionId: string): void {
    if (this.isVisible && this.actions) {
      const action = this.actions.find(a => a.action === actionId);
      if (action) {
        this.emit('notificationclick', { action: actionId });
      }
    }
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  // Event handling
  addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}
