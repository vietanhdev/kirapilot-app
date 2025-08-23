import { TimerSession, TimerBreak } from '../../types';
import { MockTimerConfig } from '../setup/testUtils';

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  elapsedTime: number; // in milliseconds
  startTime?: Date;
  pausedTime: number; // total paused time in milliseconds
  currentSession?: TimerSession;
}

export class MockTimerService {
  private config: MockTimerConfig;
  private state: TimerState = {
    isRunning: false,
    isPaused: false,
    elapsedTime: 0,
    pausedTime: 0,
  };

  private intervalId?: NodeJS.Timeout;
  private eventListeners: Map<string, Function[]> = new Map();
  private mockTime = Date.now();

  constructor(config: MockTimerConfig = {}) {
    this.config = {
      autoAdvanceTime: false,
      timeMultiplier: 1,
      ...config,
    };
  }

  // Timer control methods
  async startTimer(taskId: string, notes = ''): Promise<TimerSession> {
    if (this.state.isRunning) {
      throw new Error('Timer is already running');
    }

    const session: TimerSession = {
      id: `mock-timer-${Date.now()}`,
      taskId,
      startTime: new Date(this.mockTime),
      endTime: undefined,
      pausedTime: 0,
      isActive: true,
      notes,
      breaks: [],
      createdAt: new Date(this.mockTime),
    };

    this.state = {
      isRunning: true,
      isPaused: false,
      elapsedTime: 0,
      startTime: session.startTime,
      pausedTime: 0,
      currentSession: session,
    };

    this.startTicking();
    this.emit('timerStarted', session);

    return session;
  }

  async pauseTimer(): Promise<void> {
    if (!this.state.isRunning || this.state.isPaused) {
      throw new Error('Timer is not running or already paused');
    }

    this.state.isPaused = true;
    this.stopTicking();
    this.emit('timerPaused', this.state.currentSession);
  }

  async resumeTimer(): Promise<void> {
    if (!this.state.isRunning || !this.state.isPaused) {
      throw new Error('Timer is not paused');
    }

    this.state.isPaused = false;
    this.startTicking();
    this.emit('timerResumed', this.state.currentSession);
  }

  async stopTimer(notes?: string): Promise<TimerSession> {
    if (!this.state.isRunning) {
      throw new Error('Timer is not running');
    }

    const endTime = new Date(this.mockTime);
    const completedSession: TimerSession = {
      ...this.state.currentSession!,
      endTime,
      isActive: false,
      notes: notes || this.state.currentSession!.notes,
      pausedTime: this.state.pausedTime,
    };

    this.state = {
      isRunning: false,
      isPaused: false,
      elapsedTime: 0,
      pausedTime: 0,
    };

    this.stopTicking();
    this.emit('timerStopped', completedSession);

    return completedSession;
  }

  async addBreak(reason: string, duration: number): Promise<TimerBreak> {
    if (!this.state.isRunning || !this.state.currentSession) {
      throw new Error('No active timer session');
    }

    const breakStart = new Date(this.mockTime);
    const breakEnd = new Date(this.mockTime + duration);

    const timerBreak: TimerBreak = {
      id: `mock-break-${Date.now()}`,
      startTime: breakStart,
      endTime: breakEnd,
      reason,
    };

    this.state.currentSession.breaks.push(timerBreak);
    this.state.pausedTime += duration;

    // Advance mock time by break duration
    this.mockTime += duration;

    this.emit('breakAdded', timerBreak);

    return timerBreak;
  }

  // State getters
  getTimerState(): TimerState {
    return { ...this.state };
  }

  getCurrentSession(): TimerSession | undefined {
    return this.state.currentSession
      ? { ...this.state.currentSession }
      : undefined;
  }

  getElapsedTime(): number {
    return this.state.elapsedTime;
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  // Time manipulation for testing
  advanceTime(milliseconds: number): void {
    this.mockTime += milliseconds;
    if (this.state.isRunning && !this.state.isPaused) {
      this.state.elapsedTime +=
        milliseconds * (this.config.timeMultiplier || 1);
      this.emit('tick', this.state.elapsedTime);
    }
  }

  setMockTime(timestamp: number): void {
    this.mockTime = timestamp;
  }

  getMockTime(): number {
    return this.mockTime;
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

  // Configuration methods
  setAutoAdvanceTime(enabled: boolean): void {
    this.config.autoAdvanceTime = enabled;
  }

  setTimeMultiplier(multiplier: number): void {
    this.config.timeMultiplier = multiplier;
  }

  reset(): void {
    this.stopTicking();
    this.state = {
      isRunning: false,
      isPaused: false,
      elapsedTime: 0,
      pausedTime: 0,
    };
    this.eventListeners.clear();
    this.mockTime = Date.now();
  }

  // Private methods
  private startTicking(): void {
    if (this.config.autoAdvanceTime) {
      this.intervalId = setInterval(() => {
        this.advanceTime(1000); // Advance by 1 second
      }, 100); // Update every 100ms for smooth testing
    }
  }

  private stopTicking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  protected emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}

// Mock focus timer service for focus sessions
export class MockFocusTimerService extends MockTimerService {
  private focusState = {
    distractionCount: 0,
    focusScore: 100,
    energyLevel: 80,
  };

  async startFocusSession(
    taskId: string,
    plannedDuration: number,
    options: {
      distractionLevel?: string;
      backgroundAudio?: { type: string; volume: number };
      breakReminders?: boolean;
    } = {}
  ): Promise<{
    sessionId: string;
    focusConfig: unknown;
    plannedDuration: number;
    focusScore: number;
    distractionCount: number;
  }> {
    const session = await this.startTimer(taskId, 'Focus session');

    // Initialize focus-specific state
    this.focusState = {
      distractionCount: 0,
      focusScore: 100,
      energyLevel: 80,
    };

    super.emit('focusSessionStarted', {
      session,
      plannedDuration,
      options,
    });

    return {
      sessionId: session.id,
      focusConfig: {
        plannedDuration,
        distractionLevel: options.distractionLevel,
        backgroundAudio: options.backgroundAudio,
        breakReminders: options.breakReminders,
      },
      plannedDuration,
      focusScore: this.focusState.focusScore,
      distractionCount: this.focusState.distractionCount,
    };
  }

  recordDistraction(type: string, duration: number): void {
    this.focusState.distractionCount++;
    this.focusState.focusScore = Math.max(0, this.focusState.focusScore - 10);

    super.emit('distractionRecorded', {
      type,
      duration,
      totalDistractions: this.focusState.distractionCount,
      newFocusScore: this.focusState.focusScore,
    });
  }

  getFocusMetrics(): {
    distractionCount: number;
    focusScore: number;
    energyLevel: number;
    elapsedTime: number;
  } {
    return {
      distractionCount: this.focusState.distractionCount,
      focusScore: this.focusState.focusScore,
      energyLevel: this.focusState.energyLevel,
      elapsedTime: this.getElapsedTime(),
    };
  }

  updateEnergyLevel(level: number): void {
    this.focusState.energyLevel = Math.max(0, Math.min(100, level));
    super.emit('energyLevelUpdated', this.focusState.energyLevel);
  }
}
