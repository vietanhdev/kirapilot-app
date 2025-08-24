import {
  Task,
  TimerSession,
  FocusSession,
  UserPreferences,
  AISuggestion,
  ProductivityPattern,
  CreateTaskRequest,
  TaskStatus,
  Priority,
  DistractionLevel,
  TimerBreak,
  FocusBreak,
  FocusMetrics,
  WeeklyPlan,
  PlannedTask,
  WeeklyGoal,
} from '../../types';

export interface TestDataOptions {
  count?: number;
  startDate?: Date;
  endDate?: Date;
  taskIds?: string[];
  userIds?: string[];
}

export class TestDataFactory {
  private static idCounter = 1;

  private static generateId(prefix: string = 'test'): string {
    return `${prefix}-${this.idCounter++}`;
  }

  // Task generation
  static createCompletedTask(overrides: Partial<Task> = {}): Task {
    return this.createTask({
      status: TaskStatus.COMPLETED,
      actualTime: Math.floor(Math.random() * 120) + 30,
      completedAt: new Date(),
      ...overrides,
    });
  }

  static createHighPriorityTask(overrides: Partial<Task> = {}): Task {
    return this.createTask({
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
      ...overrides,
    });
  }

  static createTaskWithDependencies(
    dependencyCount: number,
    overrides: Partial<Task> = {}
  ): Task {
    const dependencies = Array.from({ length: dependencyCount }, () =>
      this.generateId('dep')
    );
    return this.createTask({
      dependencies,
      ...overrides,
    });
  }

  static createTask(overrides: Partial<Task> = {}): Task {
    const now = new Date();
    const titles = [
      'Complete project documentation',
      'Review code changes',
      'Implement new feature',
      'Fix critical bug',
      'Update dependencies',
      'Write unit tests',
      'Refactor legacy code',
      'Design user interface',
      'Optimize database queries',
      'Deploy to production',
    ];

    const descriptions = [
      'This task requires careful attention to detail and thorough testing.',
      'Important milestone for the project timeline.',
      'High priority item that needs immediate attention.',
      'Regular maintenance task to keep the system running smoothly.',
      'Enhancement that will improve user experience significantly.',
    ];

    const tags = [
      ['frontend', 'react'],
      ['backend', 'api'],
      ['database', 'optimization'],
      ['testing', 'quality'],
      ['documentation', 'maintenance'],
      ['security', 'critical'],
      ['performance', 'optimization'],
      ['ui', 'design'],
      ['deployment', 'devops'],
      ['refactoring', 'cleanup'],
    ];

    const randomTitle = titles[Math.floor(Math.random() * titles.length)];
    const randomDescription =
      descriptions[Math.floor(Math.random() * descriptions.length)];
    const randomTags = tags[Math.floor(Math.random() * tags.length)];

    return {
      id: this.generateId('task'),
      title: randomTitle,
      description: randomDescription,
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: Math.floor(Math.random() * 120) + 30, // 30-150 minutes
      actualTime: 0,
      dueDate:
        Math.random() > 0.5
          ? new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
          : undefined,
      scheduledDate:
        Math.random() > 0.3
          ? new Date(now.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000)
          : undefined,
      tags: randomTags,
      subtasks: [],
      taskListId: 'default-task-list',
      createdAt: new Date(
        now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ), // Within last 30 days
      updatedAt: now,
      ...overrides,
    };
  }

  static createTaskRequest(
    overrides: Partial<CreateTaskRequest> = {}
  ): CreateTaskRequest {
    const task = this.createTask();
    return {
      title: task.title,
      description: task.description,
      priority: task.priority,
      timeEstimate: task.timeEstimate,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate,
      tags: task.tags,
      dependencies: task.dependencies,
      ...overrides,
    };
  }

  static createTaskBatch(count: number, options: TestDataOptions = {}): Task[] {
    const tasks: Task[] = [];
    const { startDate, endDate } = options;

    for (let i = 0; i < count; i++) {
      const task = this.createTask();

      // Adjust dates if range specified
      if (startDate && endDate) {
        const timeRange = endDate.getTime() - startDate.getTime();
        const randomTime = startDate.getTime() + Math.random() * timeRange;
        task.createdAt = new Date(randomTime);
        task.updatedAt = new Date(
          randomTime + Math.random() * 24 * 60 * 60 * 1000
        );
      }

      // Create some variety in status
      if (i % 4 === 0) {
        task.status = TaskStatus.COMPLETED;
      } else if (i % 4 === 1) {
        task.status = TaskStatus.IN_PROGRESS;
      } else if (i % 4 === 2) {
        task.status = TaskStatus.PENDING;
      } else {
        task.status = TaskStatus.CANCELLED;
      }

      // Create some variety in priority
      if (i % 5 === 0) {
        task.priority = Priority.URGENT;
      } else if (i % 5 === 1) {
        task.priority = Priority.HIGH;
      } else if (i % 5 === 2) {
        task.priority = Priority.MEDIUM;
      } else {
        task.priority = Priority.LOW;
      }

      tasks.push(task);
    }

    return tasks;
  }

  // Timer session generation
  static createTimerSession(
    overrides: Partial<TimerSession> = {}
  ): TimerSession {
    const now = new Date();
    const startTime = new Date(
      now.getTime() - Math.random() * 4 * 60 * 60 * 1000
    ); // Within last 4 hours
    const duration = Math.random() * 2 * 60 * 60 * 1000; // Up to 2 hours
    const endTime =
      Math.random() > 0.3
        ? new Date(startTime.getTime() + duration)
        : undefined;
    const pausedTime = Math.random() * 15 * 60 * 1000; // Up to 15 minutes paused

    const breaks: TimerBreak[] = [];
    if (Math.random() > 0.5) {
      const breakCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < breakCount; i++) {
        const breakStart = new Date(
          startTime.getTime() + (i + 1) * (duration / (breakCount + 1))
        );
        const breakDuration = Math.random() * 10 * 60 * 1000; // Up to 10 minutes
        breaks.push({
          id: this.generateId('break'),
          startTime: breakStart,
          endTime: new Date(breakStart.getTime() + breakDuration),
          reason: [
            'Coffee break',
            'Bathroom break',
            'Phone call',
            'Distraction',
          ][Math.floor(Math.random() * 4)],
        });
      }
    }

    return {
      id: this.generateId('session'),
      taskId: this.generateId('task'),
      startTime,
      endTime,
      pausedTime,
      isActive: !endTime,
      notes: Math.random() > 0.5 ? 'Good progress made on this task' : '',
      breaks,
      createdAt: startTime,
      ...overrides,
    };
  }

  static createTimerSessionBatch(
    count: number,
    options: TestDataOptions = {}
  ): TimerSession[] {
    const sessions: TimerSession[] = [];
    const { startDate, endDate, taskIds } = options;

    for (let i = 0; i < count; i++) {
      const session = this.createTimerSession();

      // Use provided task IDs if available
      if (taskIds && taskIds.length > 0) {
        session.taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
      }

      // Adjust dates if range specified
      if (startDate && endDate) {
        const timeRange = endDate.getTime() - startDate.getTime();
        const randomTime = startDate.getTime() + Math.random() * timeRange;
        session.startTime = new Date(randomTime);
        session.createdAt = session.startTime;

        if (session.endTime) {
          const duration =
            session.endTime.getTime() - session.startTime.getTime();
          session.endTime = new Date(session.startTime.getTime() + duration);
        }
      }

      // Only one active session at a time
      if (i > 0) {
        session.isActive = false;
        if (!session.endTime) {
          session.endTime = new Date(
            session.startTime.getTime() + Math.random() * 2 * 60 * 60 * 1000
          );
        }
      }

      sessions.push(session);
    }

    return sessions;
  }

  // Focus session generation
  static createFocusSession(
    overrides: Partial<FocusSession> = {}
  ): FocusSession {
    const now = new Date();
    const plannedDuration = [15, 25, 30, 45, 60][Math.floor(Math.random() * 5)];
    const actualDuration =
      Math.random() > 0.2
        ? plannedDuration + Math.floor(Math.random() * 10) - 5
        : undefined;
    const distractionCount = Math.floor(Math.random() * 5);
    const focusScore = Math.max(
      0,
      100 - distractionCount * 15 + Math.floor(Math.random() * 20) - 10
    );

    const breaks: FocusBreak[] = [];
    if (distractionCount > 0) {
      for (let i = 0; i < distractionCount; i++) {
        const breakStart = new Date(
          now.getTime() - Math.random() * plannedDuration * 60 * 1000
        );
        breaks.push({
          id: this.generateId('focus-break'),
          startTime: breakStart,
          endTime: new Date(
            breakStart.getTime() + Math.random() * 2 * 60 * 1000
          ), // Up to 2 minutes
          type: Math.random() > 0.3 ? 'distraction' : 'planned',
          reason: [
            'Phone notification',
            'Email',
            'Colleague interruption',
            'Planned break',
          ][Math.floor(Math.random() * 4)],
        });
      }
    }

    const metrics: FocusMetrics = {
      totalDistractions: distractionCount,
      longestFocusStreak: Math.floor(Math.random() * plannedDuration),
      averageFocusStreak: Math.floor(Math.random() * plannedDuration * 0.7),
      productivityScore: focusScore,
      energyLevel: Math.floor(Math.random() * 40) + 60, // 60-100
    };

    return {
      id: this.generateId('focus'),
      taskId: this.generateId('task'),
      plannedDuration,
      actualDuration,
      focusScore: actualDuration ? focusScore : undefined,
      distractionCount,
      distractionLevel:
        distractionCount === 0
          ? DistractionLevel.NONE
          : distractionCount <= 2
            ? DistractionLevel.MINIMAL
            : distractionCount <= 4
              ? DistractionLevel.MODERATE
              : DistractionLevel.FULL,
      backgroundAudio:
        Math.random() > 0.5
          ? {
              type: ['white_noise', 'nature', 'music'][
                Math.floor(Math.random() * 3)
              ] as 'white_noise' | 'nature' | 'music',
              volume: Math.floor(Math.random() * 50) + 25, // 25-75
            }
          : undefined,
      notes:
        Math.random() > 0.6
          ? 'Felt focused and productive during this session'
          : '',
      breaks,
      metrics,
      createdAt: new Date(
        now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ), // Within last week
      completedAt: actualDuration
        ? new Date(now.getTime() - Math.random() * 6 * 24 * 60 * 60 * 1000)
        : undefined,
      ...overrides,
    };
  }

  static createFocusSessionBatch(
    count: number,
    options: TestDataOptions = {}
  ): FocusSession[] {
    const sessions: FocusSession[] = [];
    const { startDate, endDate, taskIds } = options;

    for (let i = 0; i < count; i++) {
      const session = this.createFocusSession();

      // Use provided task IDs if available
      if (taskIds && taskIds.length > 0) {
        session.taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
      }

      // Adjust dates if range specified
      if (startDate && endDate) {
        const timeRange = endDate.getTime() - startDate.getTime();
        const randomTime = startDate.getTime() + Math.random() * timeRange;
        session.createdAt = new Date(randomTime);

        if (session.completedAt) {
          session.completedAt = new Date(
            session.createdAt.getTime() + session.plannedDuration * 60 * 1000
          );
        }
      }

      sessions.push(session);
    }

    return sessions;
  }

  // User preferences generation
  static createUserPreferences(
    overrides: Partial<UserPreferences> = {}
  ): UserPreferences {
    return {
      workingHours: {
        start: '09:00',
        end: '17:00',
      },
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        breakInterval: 25,
      },
      focusPreferences: {
        defaultDuration: 25,
        distractionLevel: DistractionLevel.MINIMAL,
        backgroundAudio: {
          type: 'white_noise',
          volume: 50,
        },
      },
      notifications: {
        breakReminders: true,
        taskDeadlines: true,
        dailySummary: true,
        weeklyReview: true,
      },
      aiSettings: {
        conversationHistory: true,
        autoSuggestions: true,
        toolPermissions: true,
        responseStyle: 'balanced',
        suggestionFrequency: 'moderate',
      },
      taskSettings: {
        defaultPriority: Priority.MEDIUM,
        autoScheduling: false,
        smartDependencies: true,
        weekStartDay: 1,
        showCompletedTasks: true,
        compactView: false,
      },
      theme: 'auto',
      language: 'en',
      ...overrides,
    };
  }

  // AI suggestion generation
  static createAISuggestion(
    overrides: Partial<AISuggestion> = {}
  ): AISuggestion {
    const types = [
      'task',
      'schedule',
      'break',
      'focus',
      'energy',
      'productivity',
    ] as const;
    const titles = [
      'Take a break',
      'Schedule high-priority task',
      'Start focus session',
      'Review completed tasks',
      "Plan tomorrow's work",
      'Optimize work schedule',
    ];
    const descriptions = [
      "You've been working for a while. Consider taking a short break.",
      'Based on your patterns, this would be a good time for focused work.',
      'Your energy levels suggest this is optimal for deep work.',
      'Review your accomplishments and plan next steps.',
      'Prepare for tomorrow by organizing your task list.',
      'Adjust your schedule based on productivity patterns.',
    ];

    const type = types[Math.floor(Math.random() * types.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const description =
      descriptions[Math.floor(Math.random() * descriptions.length)];

    return {
      id: this.generateId('suggestion'),
      type,
      title,
      description,
      confidence: Math.floor(Math.random() * 40) + 60, // 60-100
      actionable: Math.random() > 0.2,
      priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH][
        Math.floor(Math.random() * 3)
      ],
      estimatedImpact: Math.floor(Math.random() * 50) + 50, // 50-100
      reasoning:
        'Based on your recent activity patterns and productivity data.',
      createdAt: new Date(),
      ...overrides,
    };
  }

  // Productivity pattern generation
  static createProductivityPattern(
    overrides: Partial<ProductivityPattern> = {}
  ): ProductivityPattern {
    const patternTypes = [
      'daily',
      'weekly',
      'task_based',
      'energy_based',
    ] as const;
    const type = patternTypes[Math.floor(Math.random() * patternTypes.length)];

    const timeSlots = [];
    const slotCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < slotCount; i++) {
      const startHour = Math.floor(Math.random() * 16) + 8; // 8 AM to 11 PM
      const endHour = startHour + Math.floor(Math.random() * 3) + 1; // 1-4 hours later
      timeSlots.push({
        start: `${startHour.toString().padStart(2, '0')}:00`,
        end: `${Math.min(endHour, 23).toString().padStart(2, '0')}:00`,
        dayOfWeek: Math.floor(Math.random() * 7),
      });
    }

    return {
      id: this.generateId('pattern'),
      userId: 'test-user',
      patternType: type,
      timeSlots,
      productivity: Math.floor(Math.random() * 40) + 60, // 60-100
      confidence: Math.floor(Math.random() * 30) + 70, // 70-100
      sampleSize: Math.floor(Math.random() * 50) + 10, // 10-60
      lastUpdated: new Date(),
      ...overrides,
    };
  }

  // Weekly plan generation
  static createWeeklyPlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
    weekStart.setHours(0, 0, 0, 0);

    const tasks: PlannedTask[] = [];
    const taskCount = Math.floor(Math.random() * 10) + 5; // 5-15 tasks

    for (let i = 0; i < taskCount; i++) {
      const dayOffset = Math.floor(Math.random() * 7);
      const hour = Math.floor(Math.random() * 9) + 9; // 9 AM to 5 PM
      const duration = Math.floor(Math.random() * 3) + 1; // 1-4 hours

      const scheduledStart = new Date(weekStart);
      scheduledStart.setDate(weekStart.getDate() + dayOffset);
      scheduledStart.setHours(hour, 0, 0, 0);

      const scheduledEnd = new Date(scheduledStart);
      scheduledEnd.setHours(scheduledStart.getHours() + duration);

      tasks.push({
        taskId: this.generateId('task'),
        scheduledStart,
        scheduledEnd,
        actualStart: Math.random() > 0.3 ? scheduledStart : undefined,
        actualEnd: Math.random() > 0.5 ? scheduledEnd : undefined,
        completed: Math.random() > 0.4,
      });
    }

    const goals: WeeklyGoal[] = [
      {
        id: this.generateId('goal'),
        title: 'Complete 10 tasks',
        description: 'Finish at least 10 tasks this week',
        targetValue: 10,
        currentValue: Math.floor(Math.random() * 12),
        unit: 'tasks',
        completed: false,
      },
      {
        id: this.generateId('goal'),
        title: 'Focus for 20 hours',
        description: 'Accumulate 20 hours of focused work time',
        targetValue: 20,
        currentValue: Math.floor(Math.random() * 25),
        unit: 'hours',
        completed: false,
      },
    ];

    const totalPlannedHours = tasks.reduce((total, task) => {
      const duration =
        task.scheduledEnd.getTime() - task.scheduledStart.getTime();
      return total + duration / (1000 * 60 * 60);
    }, 0);

    const actualHours = tasks.reduce((total, task) => {
      if (task.actualStart && task.actualEnd) {
        const duration = task.actualEnd.getTime() - task.actualStart.getTime();
        return total + duration / (1000 * 60 * 60);
      }
      return total;
    }, 0);

    const completedTasks = tasks.filter(task => task.completed).length;
    const completionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;

    return {
      id: this.generateId('plan'),
      weekStart,
      tasks,
      goals,
      totalPlannedHours,
      actualHours,
      completionRate,
      createdAt: weekStart,
      updatedAt: now,
      ...overrides,
    };
  }

  // Realistic workflow data generation
  static generateRealisticWorkflow(): {
    tasks: Task[];
    timerSessions: TimerSession[];
    focusSessions: FocusSession[];
    userPreferences: UserPreferences;
    suggestions: AISuggestion[];
    patterns: ProductivityPattern[];
  } {
    // Create a smaller set of related tasks for testing
    const tasks = this.createTaskBatch(4);
    const taskIds = tasks.map(task => task.id);

    // Create timer sessions for some tasks
    const timerSessions = this.createTimerSessionBatch(2, { taskIds });

    // Create focus sessions for some tasks
    const focusSessions = this.createFocusSessionBatch(2, { taskIds });

    // Create user preferences
    const userPreferences = this.createUserPreferences();

    // Create relevant suggestions
    const suggestions = [
      this.createAISuggestion({
        type: 'break',
        title: 'Take a break',
        description:
          "You've been working for 2 hours. Consider taking a 10-minute break.",
      }),
      this.createAISuggestion({
        type: 'schedule',
        title: 'Schedule high-priority task',
        description:
          'Your most productive time is approaching. Schedule your urgent task now.',
      }),
    ];

    // Create productivity patterns
    const patterns = [
      this.createProductivityPattern({
        patternType: 'daily',
        timeSlots: [{ start: '09:00', end: '11:00', dayOfWeek: 1 }],
        productivity: 85,
      }),
    ];

    return {
      tasks,
      timerSessions,
      focusSessions,
      userPreferences,
      suggestions,
      patterns,
    };
  }

  // Reset ID counter for consistent testing
  static resetIdCounter(): void {
    this.idCounter = 1;
  }
}
