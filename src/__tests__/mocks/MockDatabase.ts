import {
  Task,
  TimerSession,
  FocusSession,
  UserPreferences,
  AISuggestion,
  ProductivityPattern,
  TaskFilters,
  TaskSortOptions,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompletedSession,
  TimerBreak,
  FocusConfig,
  ValidationResult,
  TaskStatus,
  Priority,
  DistractionLevel,
} from '../../types';
import { MockDatabaseConfig, AppTestState } from '../setup/testUtils';

export class MockDatabase {
  private data: AppTestState = {
    tasks: [],
    timerSessions: [],
    focusSessions: [],
    userPreferences: {} as UserPreferences,
    aiSuggestions: [],
    productivityPatterns: [],
  };

  private config: MockDatabaseConfig;
  private isConnected = false;
  private idCounter = 1;

  constructor(config: MockDatabaseConfig = {}) {
    this.config = {
      simulateErrors: false,
      responseDelay: 0,
      ...config,
    };
  }

  async connect(): Promise<void> {
    await this.simulateDelay();

    if (this.config.simulateErrors) {
      throw new Error('Mock database connection failed');
    }

    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this.simulateDelay();
    this.isConnected = false;
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  // Seed data for testing
  seedData(seedData: Partial<AppTestState>): void {
    this.data = {
      ...this.data,
      ...seedData,
    };
  }

  // Reset all data
  reset(): void {
    this.data = {
      tasks: [],
      timerSessions: [],
      focusSessions: [],
      userPreferences: {} as UserPreferences,
      aiSuggestions: [],
      productivityPatterns: [],
    };
    this.idCounter = 1;
  }

  // Generate unique ID
  private generateId(prefix: string = 'mock'): string {
    return `${prefix}-${this.idCounter++}-${Date.now()}`;
  }

  // Task operations
  async getTasks(
    filters?: TaskFilters,
    sort?: TaskSortOptions
  ): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    let tasks = [...this.data.tasks];

    // Apply filters
    if (filters) {
      if (filters.status) {
        tasks = tasks.filter(task => filters.status!.includes(task.status));
      }
      if (filters.priority) {
        tasks = tasks.filter(task => filters.priority!.includes(task.priority));
      }
      if (filters.tags && filters.tags.length > 0) {
        tasks = tasks.filter(task =>
          filters.tags!.some(tag => task.tags.includes(tag))
        );
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        tasks = tasks.filter(
          task =>
            task.title.toLowerCase().includes(searchLower) ||
            task.description.toLowerCase().includes(searchLower)
        );
      }
      if (filters.dueDate) {
        tasks = tasks.filter(task => {
          if (!task.dueDate) {
            return false;
          }
          const dueDate = task.dueDate;
          if (filters.dueDate!.from && dueDate < filters.dueDate!.from) {
            return false;
          }
          if (filters.dueDate!.to && dueDate > filters.dueDate!.to) {
            return false;
          }
          return true;
        });
      }
      if (filters.projectId) {
        tasks = tasks.filter(task => task.projectId === filters.projectId);
      }
    }

    // Apply sorting
    if (sort) {
      tasks.sort((a, b) => {
        let aValue: number | string = 0;
        let bValue: number | string = 0;

        // Get field values
        const aFieldValue = a[sort.field];
        const bFieldValue = b[sort.field];

        // Handle date fields
        if (aFieldValue instanceof Date) {
          aValue = aFieldValue.getTime();
        } else if (typeof aFieldValue === 'string') {
          aValue = aFieldValue;
        } else if (typeof aFieldValue === 'number') {
          aValue = aFieldValue;
        } else if (aFieldValue === undefined) {
          aValue = sort.direction === 'asc' ? Infinity : -Infinity;
        }

        if (bFieldValue instanceof Date) {
          bValue = bFieldValue.getTime();
        } else if (typeof bFieldValue === 'string') {
          bValue = bFieldValue;
        } else if (typeof bFieldValue === 'number') {
          bValue = bFieldValue;
        } else if (bFieldValue === undefined) {
          bValue = sort.direction === 'asc' ? Infinity : -Infinity;
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    }

    return tasks;
  }

  async getTaskById(id: string): Promise<Task | null> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.tasks.find(task => task.id === id) || null;
  }

  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    await this.simulateDelay();
    this.throwIfError();

    const newTask: Task = {
      id: this.generateId('task'),
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority || Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: taskData.dependencies || [],
      timeEstimate: taskData.timeEstimate || 0,
      actualTime: 0,
      dueDate: taskData.dueDate,
      scheduledDate: taskData.scheduledDate,
      tags: taskData.tags || [],
      projectId: taskData.projectId,
      parentTaskId: taskData.parentTaskId,
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.tasks.push(newTask);
    return newTask;
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<Task> {
    await this.simulateDelay();
    this.throwIfError();

    const taskIndex = this.data.tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const updatedTask = {
      ...this.data.tasks[taskIndex],
      ...updates,
      updatedAt: new Date(),
    };

    this.data.tasks[taskIndex] = updatedTask;
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const taskIndex = this.data.tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    this.data.tasks.splice(taskIndex, 1);
  }

  async findTaskWithDependencies(
    id: string
  ): Promise<{ task: Task; dependencies: Task[] } | null> {
    await this.simulateDelay();
    this.throwIfError();

    const task = await this.getTaskById(id);
    if (!task) {
      return null;
    }

    const dependencies = await Promise.all(
      task.dependencies.map(depId => this.getTaskById(depId))
    );

    return {
      task,
      dependencies: dependencies.filter(dep => dep !== null) as Task[],
    };
  }

  async findScheduledBetween(startDate: Date, endDate: Date): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      return task.scheduledDate >= startDate && task.scheduledDate <= endDate;
    });
  }

  async findBacklog(): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.tasks.filter(task => !task.scheduledDate);
  }

  async addTaskDependency(taskId: string, dependsOnId: string): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    const dependsOnTask = await this.getTaskById(dependsOnId);
    if (!dependsOnTask) {
      throw new Error(`Dependency task with id ${dependsOnId} not found`);
    }

    if (!task.dependencies.includes(dependsOnId)) {
      task.dependencies.push(dependsOnId);
      task.updatedAt = new Date();
    }
  }

  async removeTaskDependency(
    taskId: string,
    dependsOnId: string
  ): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    const dependencyIndex = task.dependencies.indexOf(dependsOnId);
    if (dependencyIndex > -1) {
      task.dependencies.splice(dependencyIndex, 1);
      task.updatedAt = new Date();
    }
  }

  async getTaskDependencies(taskId: string): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    const task = await this.getTaskById(taskId);
    if (!task) {
      return [];
    }

    const dependencies = await Promise.all(
      task.dependencies.map(depId => this.getTaskById(depId))
    );

    return dependencies.filter(dep => dep !== null) as Task[];
  }

  async getTaskDependents(taskId: string): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.tasks.filter(task => task.dependencies.includes(taskId));
  }

  async searchTasks(query: string): Promise<Task[]> {
    await this.simulateDelay();
    this.throwIfError();

    const searchLower = query.toLowerCase();
    return this.data.tasks.filter(
      task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  async getTaskStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completedToday: number;
    averageCompletionTime: number;
  }> {
    await this.simulateDelay();
    this.throwIfError();

    const tasks = this.data.tasks;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    let overdue = 0;
    let completedToday = 0;
    let totalCompletionTime = 0;
    let completedTasksCount = 0;

    for (const task of tasks) {
      // Count by status
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      // Count by priority
      byPriority[task.priority.toString()] =
        (byPriority[task.priority.toString()] || 0) + 1;

      // Count overdue
      if (
        task.dueDate &&
        task.dueDate < now &&
        task.status !== TaskStatus.COMPLETED
      ) {
        overdue++;
      }

      // Count completed today
      if (
        task.status === TaskStatus.COMPLETED &&
        task.completedAt &&
        task.completedAt >= today &&
        task.completedAt < tomorrow
      ) {
        completedToday++;
      }

      // Calculate average completion time
      if (task.status === TaskStatus.COMPLETED && task.completedAt) {
        const completionTime =
          task.completedAt.getTime() - task.createdAt.getTime();
        totalCompletionTime += completionTime;
        completedTasksCount++;
      }
    }

    return {
      total: tasks.length,
      byStatus,
      byPriority,
      overdue,
      completedToday,
      averageCompletionTime:
        completedTasksCount > 0 ? totalCompletionTime / completedTasksCount : 0,
    };
  }

  async validateTaskDependencies(taskId: string): Promise<ValidationResult> {
    await this.simulateDelay();
    this.throwIfError();

    const task = await this.getTaskById(taskId);
    if (!task) {
      return {
        isValid: false,
        errors: [`Task with id ${taskId} not found`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if all dependencies exist
    for (const depId of task.dependencies) {
      const dependency = await this.getTaskById(depId);
      if (!dependency) {
        errors.push(`Dependency task ${depId} not found`);
      } else if (dependency.status === TaskStatus.CANCELLED) {
        warnings.push(`Dependency task ${depId} is cancelled`);
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCircularDependency = (currentTaskId: string): boolean => {
      if (recursionStack.has(currentTaskId)) {
        return true;
      }
      if (visited.has(currentTaskId)) {
        return false;
      }

      visited.add(currentTaskId);
      recursionStack.add(currentTaskId);

      const currentTask = this.data.tasks.find(t => t.id === currentTaskId);
      if (currentTask) {
        for (const depId of currentTask.dependencies) {
          if (hasCircularDependency(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentTaskId);
      return false;
    };

    if (hasCircularDependency(taskId)) {
      errors.push('Circular dependency detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Timer session operations
  async getTimerSessions(taskId?: string): Promise<TimerSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    let sessions = [...this.data.timerSessions];
    if (taskId) {
      sessions = sessions.filter(session => session.taskId === taskId);
    }
    return sessions;
  }

  async getActiveTimerSession(): Promise<TimerSession | null> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.timerSessions.find(session => session.isActive) || null;
  }

  async createTimerSession(
    sessionData: Partial<TimerSession>
  ): Promise<TimerSession> {
    await this.simulateDelay();
    this.throwIfError();

    // Deactivate any existing active sessions
    this.data.timerSessions.forEach(session => {
      if (session.isActive) {
        session.isActive = false;
      }
    });

    const newSession: TimerSession = {
      id: this.generateId('session'),
      taskId: sessionData.taskId!,
      startTime: sessionData.startTime || new Date(),
      endTime: sessionData.endTime,
      pausedTime: sessionData.pausedTime || 0,
      isActive:
        sessionData.isActive !== undefined ? sessionData.isActive : true,
      notes: sessionData.notes || '',
      breaks: sessionData.breaks || [],
      createdAt: new Date(),
    };

    this.data.timerSessions.push(newSession);
    return newSession;
  }

  async updateTimerSession(
    id: string,
    updates: Partial<TimerSession>
  ): Promise<TimerSession> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.timerSessions.findIndex(
      session => session.id === id
    );
    if (sessionIndex === -1) {
      throw new Error(`Timer session with id ${id} not found`);
    }

    const updatedSession = {
      ...this.data.timerSessions[sessionIndex],
      ...updates,
    };

    this.data.timerSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async startTimerSession(
    taskId: string,
    notes?: string
  ): Promise<TimerSession> {
    return this.createTimerSession({
      taskId,
      notes,
      isActive: true,
      startTime: new Date(),
    });
  }

  async createHistoricalTimerSession(
    taskId: string,
    startTime: Date,
    endTime: Date,
    notes?: string,
    pausedTime?: number
  ): Promise<TimerSession> {
    return this.createTimerSession({
      taskId,
      startTime,
      endTime,
      notes,
      pausedTime: pausedTime || 0,
      isActive: false,
    });
  }

  async pauseTimerSession(sessionId: string): Promise<TimerSession> {
    const session = this.data.timerSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Timer session with id ${sessionId} not found`);
    }

    return this.updateTimerSession(sessionId, {
      isActive: false,
    });
  }

  async resumeTimerSession(sessionId: string): Promise<TimerSession> {
    const session = this.data.timerSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Timer session with id ${sessionId} not found`);
    }

    return this.updateTimerSession(sessionId, {
      isActive: true,
    });
  }

  async stopTimerSession(
    sessionId: string,
    notes?: string
  ): Promise<CompletedSession> {
    const session = this.data.timerSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Timer session with id ${sessionId} not found`);
    }

    const endTime = new Date();
    const updatedSession = await this.updateTimerSession(sessionId, {
      endTime,
      isActive: false,
      notes: notes || session.notes,
    });

    const totalDuration = endTime.getTime() - session.startTime.getTime();
    const actualWork = totalDuration - session.pausedTime;

    return {
      id: session.id,
      taskId: session.taskId,
      duration: totalDuration,
      actualWork,
      breaks: session.breaks,
      notes: updatedSession.notes,
      productivity: this.calculateProductivityScore(
        totalDuration,
        actualWork,
        session.breaks.length
      ),
      createdAt: session.createdAt,
    };
  }

  async addBreakToSession(
    sessionId: string,
    reason: string,
    duration: number
  ): Promise<TimerSession> {
    const session = this.data.timerSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Timer session with id ${sessionId} not found`);
    }

    const now = new Date();
    const breakItem: TimerBreak = {
      id: this.generateId('break'),
      startTime: new Date(now.getTime() - duration),
      endTime: now,
      reason,
    };

    const updatedBreaks = [...session.breaks, breakItem];
    const updatedPausedTime = session.pausedTime + duration;

    return this.updateTimerSession(sessionId, {
      breaks: updatedBreaks,
      pausedTime: updatedPausedTime,
    });
  }

  async getTimerSessionById(id: string): Promise<TimerSession | null> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.timerSessions.find(session => session.id === id) || null;
  }

  async getTimerSessionsByTask(taskId: string): Promise<TimerSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.timerSessions.filter(session => session.taskId === taskId);
  }

  async getTimerSessionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<TimerSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.timerSessions.filter(session => {
      const sessionDate = session.startTime;
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  async getTodayTimerSessions(): Promise<TimerSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getTimerSessionsByDateRange(today, tomorrow);
  }

  async getTimerStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSessions: number;
    totalTime: number;
    totalWorkTime: number;
    totalBreakTime: number;
    averageSessionLength: number;
    averageProductivity: number;
    mostProductiveHour: number;
    sessionsPerDay: Record<string, number>;
  }> {
    await this.simulateDelay();
    this.throwIfError();

    let sessions = this.data.timerSessions;

    if (startDate || endDate) {
      const start = startDate || new Date(0);
      const end = endDate || new Date();
      sessions = sessions.filter(session => {
        const sessionDate = session.startTime;
        return sessionDate >= start && sessionDate <= end;
      });
    }

    const completedSessions = sessions.filter(s => s.endTime);

    if (completedSessions.length === 0) {
      return {
        totalSessions: 0,
        totalTime: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        averageSessionLength: 0,
        averageProductivity: 0,
        mostProductiveHour: 9,
        sessionsPerDay: {},
      };
    }

    let totalTime = 0;
    let totalBreakTime = 0;
    let totalProductivity = 0;
    const hourCounts: Record<number, number> = {};
    const sessionsPerDay: Record<string, number> = {};

    for (const session of completedSessions) {
      if (session.endTime) {
        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        totalTime += duration;
        totalBreakTime += session.pausedTime;

        const hour = session.startTime.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        const dayKey = session.startTime.toISOString().split('T')[0];
        sessionsPerDay[dayKey] = (sessionsPerDay[dayKey] || 0) + 1;

        const actualWork = duration - session.pausedTime;
        totalProductivity += this.calculateProductivityScore(
          duration,
          actualWork,
          session.breaks.length
        );
      }
    }

    const mostProductiveHour = Object.entries(hourCounts).reduce(
      (max, [hour, count]) =>
        count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 9, count: 0 }
    ).hour;

    return {
      totalSessions: completedSessions.length,
      totalTime,
      totalWorkTime: totalTime - totalBreakTime,
      totalBreakTime,
      averageSessionLength: totalTime / completedSessions.length,
      averageProductivity: totalProductivity / completedSessions.length,
      mostProductiveHour,
      sessionsPerDay,
    };
  }

  async deleteTimerSession(id: string): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.timerSessions.findIndex(
      session => session.id === id
    );
    if (sessionIndex === -1) {
      throw new Error(`Timer session with id ${id} not found`);
    }

    this.data.timerSessions.splice(sessionIndex, 1);
  }

  async getIncompleteTimerSessions(): Promise<TimerSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.timerSessions.filter(session => !session.endTime);
  }

  async getTimeSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalHours: number;
    workingHours: number;
    breakHours: number;
    sessionsCount: number;
    tasksWorkedOn: number;
    averageFocusTime: number;
    productivityScore: number;
  }> {
    const sessions = await this.getTimerSessionsByDateRange(startDate, endDate);
    const completedSessions = sessions.filter(s => s.endTime);

    if (completedSessions.length === 0) {
      return {
        totalHours: 0,
        workingHours: 0,
        breakHours: 0,
        sessionsCount: 0,
        tasksWorkedOn: 0,
        averageFocusTime: 0,
        productivityScore: 0,
      };
    }

    let totalTime = 0;
    let totalBreakTime = 0;
    const uniqueTasks = new Set<string>();

    for (const session of completedSessions) {
      if (session.endTime) {
        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        totalTime += duration;
        totalBreakTime += session.pausedTime;
        uniqueTasks.add(session.taskId);
      }
    }

    const workingTime = totalTime - totalBreakTime;
    const averageFocusTime = workingTime / completedSessions.length;
    const productivityScore =
      totalTime > 0 ? (workingTime / totalTime) * 100 : 0;

    return {
      totalHours: totalTime / (1000 * 60 * 60),
      workingHours: workingTime / (1000 * 60 * 60),
      breakHours: totalBreakTime / (1000 * 60 * 60),
      sessionsCount: completedSessions.length,
      tasksWorkedOn: uniqueTasks.size,
      averageFocusTime: averageFocusTime / (1000 * 60), // in minutes
      productivityScore,
    };
  }

  private calculateProductivityScore(
    totalDuration: number,
    actualWork: number,
    breakCount: number
  ): number {
    if (totalDuration === 0) {
      return 0;
    }

    const workRatio = actualWork / totalDuration;
    const breakPenalty = Math.min(breakCount * 0.05, 0.3); // Max 30% penalty for breaks

    return Math.max(0, Math.min(100, workRatio * 100 - breakPenalty * 100));
  }

  // Focus session operations
  async getFocusSessions(taskId?: string): Promise<FocusSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    let sessions = [...this.data.focusSessions];
    if (taskId) {
      sessions = sessions.filter(session => session.taskId === taskId);
    }
    return sessions;
  }

  async createFocusSession(
    sessionData: Partial<FocusSession>
  ): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    const newSession: FocusSession = {
      id: this.generateId('focus'),
      taskId: sessionData.taskId!,
      plannedDuration: sessionData.plannedDuration || 25,
      actualDuration: sessionData.actualDuration,
      focusScore: sessionData.focusScore,
      distractionCount: sessionData.distractionCount || 0,
      distractionLevel: sessionData.distractionLevel || DistractionLevel.NONE,
      backgroundAudio: sessionData.backgroundAudio,
      notes: sessionData.notes || '',
      breaks: sessionData.breaks || [],
      metrics: sessionData.metrics || {
        totalDistractions: 0,
        longestFocusStreak: 0,
        averageFocusStreak: 0,
        productivityScore: 0,
        energyLevel: 0,
      },
      createdAt: new Date(),
      completedAt: sessionData.completedAt,
    };

    this.data.focusSessions.push(newSession);
    return newSession;
  }

  async startFocusSession(config: FocusConfig): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    return this.createFocusSession({
      taskId: config.taskId,
      plannedDuration: config.duration,
      distractionLevel: config.distractionLevel,
      backgroundAudio: config.backgroundAudio,
      createdAt: new Date(),
    });
  }

  async completeFocusSession(
    sessionId: string,
    notes?: string
  ): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.focusSessions.findIndex(
      session => session.id === sessionId
    );
    if (sessionIndex === -1) {
      throw new Error(`Focus session with id ${sessionId} not found`);
    }

    const session = this.data.focusSessions[sessionIndex];
    const completedAt = new Date();
    const actualDuration = Math.round(
      (completedAt.getTime() - session.createdAt.getTime()) / (1000 * 60)
    );

    const updatedSession: FocusSession = {
      ...session,
      actualDuration,
      focusScore: this.calculateFocusScore(
        session.distractionCount,
        actualDuration
      ),
      notes: notes || session.notes,
      completedAt,
      metrics: {
        ...session.metrics,
        productivityScore: this.calculateFocusScore(
          session.distractionCount,
          actualDuration
        ),
        energyLevel: Math.max(0, 100 - session.distractionCount * 10),
      },
    };

    this.data.focusSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async addDistractionToFocusSession(
    sessionId: string,
    reason?: string
  ): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.focusSessions.findIndex(
      session => session.id === sessionId
    );
    if (sessionIndex === -1) {
      throw new Error(`Focus session with id ${sessionId} not found`);
    }

    const session = this.data.focusSessions[sessionIndex];
    const updatedSession: FocusSession = {
      ...session,
      distractionCount: session.distractionCount + 1,
      metrics: {
        ...session.metrics,
        totalDistractions: session.metrics.totalDistractions + 1,
      },
    };

    // Add distraction as a break
    const distractionBreak = {
      id: this.generateId('distraction'),
      startTime: new Date(),
      endTime: new Date(Date.now() + 30000), // 30 second distraction
      type: 'distraction' as const,
      reason: reason || 'Distraction',
    };

    updatedSession.breaks.push(distractionBreak);

    this.data.focusSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async addPlannedBreakToFocusSession(
    sessionId: string,
    duration: number,
    reason?: string
  ): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.focusSessions.findIndex(
      session => session.id === sessionId
    );
    if (sessionIndex === -1) {
      throw new Error(`Focus session with id ${sessionId} not found`);
    }

    const session = this.data.focusSessions[sessionIndex];
    const now = new Date();
    const plannedBreak = {
      id: this.generateId('break'),
      startTime: now,
      endTime: new Date(now.getTime() + duration * 60 * 1000),
      type: 'planned' as const,
      reason: reason || 'Planned break',
    };

    const updatedSession: FocusSession = {
      ...session,
      breaks: [...session.breaks, plannedBreak],
    };

    this.data.focusSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async updateFocusSessionEnergyLevel(
    sessionId: string,
    energyLevel: number
  ): Promise<FocusSession> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.focusSessions.findIndex(
      session => session.id === sessionId
    );
    if (sessionIndex === -1) {
      throw new Error(`Focus session with id ${sessionId} not found`);
    }

    const session = this.data.focusSessions[sessionIndex];
    const updatedSession: FocusSession = {
      ...session,
      metrics: {
        ...session.metrics,
        energyLevel: Math.max(0, Math.min(100, energyLevel)),
      },
    };

    this.data.focusSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async getActiveFocusSession(): Promise<FocusSession | null> {
    await this.simulateDelay();
    this.throwIfError();

    return (
      this.data.focusSessions.find(session => !session.completedAt) || null
    );
  }

  async getFocusSessionById(id: string): Promise<FocusSession | null> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.focusSessions.find(session => session.id === id) || null;
  }

  async getFocusSessionsByTask(taskId: string): Promise<FocusSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.focusSessions.filter(session => session.taskId === taskId);
  }

  async getFocusSessionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<FocusSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.focusSessions.filter(session => {
      const sessionDate = session.createdAt;
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  async getTodayFocusSessions(): Promise<FocusSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getFocusSessionsByDateRange(today, tomorrow);
  }

  async getFocusStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalFocusTime: number;
    averageFocusScore: number;
    averageDistractions: number;
    bestFocusStreak: number;
    mostProductiveTime: string;
    distractionTypes: Record<string, number>;
  }> {
    await this.simulateDelay();
    this.throwIfError();

    let sessions = this.data.focusSessions;

    if (startDate || endDate) {
      const start = startDate || new Date(0);
      const end = endDate || new Date();
      sessions = sessions.filter(session => {
        const sessionDate = session.createdAt;
        return sessionDate >= start && sessionDate <= end;
      });
    }

    const completedSessions = sessions.filter(s => s.completedAt);

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalFocusTime: 0,
        averageFocusScore: 0,
        averageDistractions: 0,
        bestFocusStreak: 0,
        mostProductiveTime: '09:00',
        distractionTypes: {},
      };
    }

    let totalFocusTime = 0;
    let totalFocusScore = 0;
    let totalDistractions = 0;
    let bestFocusStreak = 0;
    const hourCounts: Record<number, number> = {};
    const distractionTypes: Record<string, number> = {};

    for (const session of completedSessions) {
      if (session.actualDuration) {
        totalFocusTime += session.actualDuration;
      }
      if (session.focusScore) {
        totalFocusScore += session.focusScore;
      }
      totalDistractions += session.distractionCount;

      if (session.metrics.longestFocusStreak > bestFocusStreak) {
        bestFocusStreak = session.metrics.longestFocusStreak;
      }

      const hour = session.createdAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      // Count distraction types from breaks
      for (const breakItem of session.breaks) {
        if (breakItem.type === 'distraction' && breakItem.reason) {
          distractionTypes[breakItem.reason] =
            (distractionTypes[breakItem.reason] || 0) + 1;
        }
      }
    }

    const mostProductiveHour = Object.entries(hourCounts).reduce(
      (max, [hour, count]) =>
        count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 9, count: 0 }
    ).hour;

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalFocusTime,
      averageFocusScore:
        completedSessions.length > 0
          ? totalFocusScore / completedSessions.length
          : 0,
      averageDistractions:
        sessions.length > 0 ? totalDistractions / sessions.length : 0,
      bestFocusStreak,
      mostProductiveTime: `${mostProductiveHour.toString().padStart(2, '0')}:00`,
      distractionTypes,
    };
  }

  async deleteFocusSession(id: string): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const sessionIndex = this.data.focusSessions.findIndex(
      session => session.id === id
    );
    if (sessionIndex === -1) {
      throw new Error(`Focus session with id ${id} not found`);
    }

    this.data.focusSessions.splice(sessionIndex, 1);
  }

  async getIncompleteFocusSessions(): Promise<FocusSession[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.focusSessions.filter(session => !session.completedAt);
  }

  async getFocusSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalFocusHours: number;
    averageSessionLength: number;
    averageFocusScore: number;
    totalDistractions: number;
    mostCommonDistraction: string;
    focusEfficiency: number;
  }> {
    const sessions = await this.getFocusSessionsByDateRange(startDate, endDate);
    const completedSessions = sessions.filter(s => s.completedAt);

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalFocusHours: 0,
        averageSessionLength: 0,
        averageFocusScore: 0,
        totalDistractions: 0,
        mostCommonDistraction: 'None',
        focusEfficiency: 0,
      };
    }

    let totalFocusTime = 0;
    let totalFocusScore = 0;
    let totalDistractions = 0;
    const distractionTypes: Record<string, number> = {};

    for (const session of completedSessions) {
      if (session.actualDuration) {
        totalFocusTime += session.actualDuration;
      }
      if (session.focusScore) {
        totalFocusScore += session.focusScore;
      }
      totalDistractions += session.distractionCount;

      // Count distraction types
      for (const breakItem of session.breaks) {
        if (breakItem.type === 'distraction' && breakItem.reason) {
          distractionTypes[breakItem.reason] =
            (distractionTypes[breakItem.reason] || 0) + 1;
        }
      }
    }

    const mostCommonDistraction = Object.entries(distractionTypes).reduce(
      (max, [type, count]) => (count > max.count ? { type, count } : max),
      { type: 'None', count: 0 }
    ).type;

    const averageSessionLength =
      completedSessions.length > 0
        ? totalFocusTime / completedSessions.length
        : 0;
    const averageFocusScore =
      completedSessions.length > 0
        ? totalFocusScore / completedSessions.length
        : 0;
    const focusEfficiency = averageFocusScore; // Simplified calculation

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalFocusHours: totalFocusTime / 60,
      averageSessionLength,
      averageFocusScore,
      totalDistractions,
      mostCommonDistraction,
      focusEfficiency,
    };
  }

  private calculateFocusScore(
    distractionCount: number,
    actualDuration: number
  ): number {
    if (actualDuration === 0) {
      return 0;
    }

    const baseScore = 100;
    const distractionPenalty = distractionCount * 10;
    const durationBonus = Math.min(actualDuration / 25, 1) * 10; // Bonus for completing planned duration

    return Math.max(
      0,
      Math.min(100, baseScore - distractionPenalty + durationBonus)
    );
  }

  // User preferences operations
  async getUserPreferences(): Promise<UserPreferences> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.userPreferences;
  }

  async updateUserPreferences(
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    await this.simulateDelay();
    this.throwIfError();

    this.data.userPreferences = {
      ...this.data.userPreferences,
      ...preferences,
    };

    return this.data.userPreferences;
  }

  // AI suggestions operations
  async getAISuggestions(): Promise<AISuggestion[]> {
    await this.simulateDelay();
    this.throwIfError();

    // Return mock suggestions
    return [];
  }

  async createAISuggestion(
    suggestion: Partial<AISuggestion>
  ): Promise<AISuggestion> {
    await this.simulateDelay();
    this.throwIfError();

    const newSuggestion: AISuggestion = {
      id: `mock-suggestion-${Date.now()}`,
      type: suggestion.type || 'task',
      title: suggestion.title || 'Mock Suggestion',
      description: suggestion.description || 'Mock suggestion description',
      confidence: suggestion.confidence || 80,
      actionable: suggestion.actionable || true,
      priority: suggestion.priority || 1,
      estimatedImpact: suggestion.estimatedImpact || 70,
      reasoning: suggestion.reasoning || 'Mock reasoning',
      actions: suggestion.actions || [],
      createdAt: new Date(),
    };

    return newSuggestion;
  }

  // Productivity patterns operations
  async getProductivityPatterns(): Promise<ProductivityPattern[]> {
    await this.simulateDelay();
    this.throwIfError();

    return [...this.data.productivityPatterns];
  }

  async createProductivityPattern(
    patternData: Partial<ProductivityPattern>
  ): Promise<ProductivityPattern> {
    await this.simulateDelay();
    this.throwIfError();

    const newPattern: ProductivityPattern = {
      id: this.generateId('pattern'),
      userId: patternData.userId || 'mock-user',
      patternType: patternData.patternType || 'daily',
      timeSlots: patternData.timeSlots || [],
      productivity: patternData.productivity || 50,
      confidence: patternData.confidence || 50,
      sampleSize: patternData.sampleSize || 1,
      lastUpdated: new Date(),
    };

    this.data.productivityPatterns.push(newPattern);
    return newPattern;
  }

  async updateProductivityPattern(
    id: string,
    updates: Partial<ProductivityPattern>
  ): Promise<ProductivityPattern> {
    await this.simulateDelay();
    this.throwIfError();

    const patternIndex = this.data.productivityPatterns.findIndex(
      pattern => pattern.id === id
    );
    if (patternIndex === -1) {
      throw new Error(`Productivity pattern with id ${id} not found`);
    }

    const updatedPattern = {
      ...this.data.productivityPatterns[patternIndex],
      ...updates,
      lastUpdated: new Date(),
    };

    this.data.productivityPatterns[patternIndex] = updatedPattern;
    return updatedPattern;
  }

  async deleteProductivityPattern(id: string): Promise<void> {
    await this.simulateDelay();
    this.throwIfError();

    const patternIndex = this.data.productivityPatterns.findIndex(
      pattern => pattern.id === id
    );
    if (patternIndex === -1) {
      throw new Error(`Productivity pattern with id ${id} not found`);
    }

    this.data.productivityPatterns.splice(patternIndex, 1);
  }

  async getProductivityPatternsByType(
    patternType: string
  ): Promise<ProductivityPattern[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.productivityPatterns.filter(
      pattern => pattern.patternType === patternType
    );
  }

  async getProductivityPatternsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ProductivityPattern[]> {
    await this.simulateDelay();
    this.throwIfError();

    return this.data.productivityPatterns.filter(pattern => {
      const patternDate = pattern.lastUpdated;
      return patternDate >= startDate && patternDate <= endDate;
    });
  }

  async getPatternStatistics(userId: string): Promise<{
    totalPatterns: number;
    patternsByType: Record<string, number>;
    averageConfidence: number;
    trendDirection: 'improving' | 'declining' | 'stable';
  }> {
    await this.simulateDelay();
    this.throwIfError();

    const userPatterns = this.data.productivityPatterns.filter(
      pattern => pattern.userId === userId
    );

    if (userPatterns.length === 0) {
      return {
        totalPatterns: 0,
        patternsByType: {},
        averageConfidence: 0,
        trendDirection: 'stable',
      };
    }

    const patternsByType: Record<string, number> = {};
    let totalConfidence = 0;

    for (const pattern of userPatterns) {
      patternsByType[pattern.patternType] =
        (patternsByType[pattern.patternType] || 0) + 1;
      totalConfidence += pattern.confidence;
    }

    // Simple trend calculation based on recent patterns
    const recentPatterns = userPatterns
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, 5);

    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentPatterns.length >= 2) {
      const recentAvg =
        recentPatterns.slice(0, 2).reduce((sum, p) => sum + p.productivity, 0) /
        2;
      const olderAvg =
        recentPatterns.slice(2).reduce((sum, p) => sum + p.productivity, 0) /
        (recentPatterns.length - 2);

      if (recentAvg > olderAvg + 5) {
        trendDirection = 'improving';
      } else if (recentAvg < olderAvg - 5) {
        trendDirection = 'declining';
      }
    }

    return {
      totalPatterns: userPatterns.length,
      patternsByType,
      averageConfidence: totalConfidence / userPatterns.length,
      trendDirection,
    };
  }

  async clearOldProductivityPatterns(olderThanDays: number): Promise<number> {
    await this.simulateDelay();
    this.throwIfError();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const initialCount = this.data.productivityPatterns.length;
    this.data.productivityPatterns = this.data.productivityPatterns.filter(
      pattern => pattern.lastUpdated >= cutoffDate
    );

    return initialCount - this.data.productivityPatterns.length;
  }

  // Utility methods
  private async simulateDelay(): Promise<void> {
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, this.config.responseDelay)
      );
    }
  }

  private throwIfError(): void {
    if (this.config.simulateErrors) {
      throw new Error('Mock database operation failed');
    }
  }

  // Get current data for testing
  getCurrentData(): AppTestState {
    return { ...this.data };
  }
}
