# TypeScript Interfaces

This document provides comprehensive documentation for all TypeScript interfaces, types, and enums used in KiraPilot.

_Generated on: 2025-08-24T14:14:12.207Z_

## Table of Contents

- [Enums](#enums)
- [Core Interfaces](#core-interfaces)
- [Task Management](#task-management)
- [Time Tracking](#time-tracking)
- [AI & Analytics](#ai--analytics)
- [Configuration](#configuration)
- [Types & Constants](#types--constants)

## Enums

### Priority

```typescript
enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  URGENT = 3,
}
```

### TaskStatus

```typescript
enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

### FocusLevel

```typescript
enum FocusLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  DEEP = 'deep',
}
```

### DistractionLevel

```typescript
enum DistractionLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  FULL = 'full',
}
```

## Core Interfaces

### TrendData

```typescript
interface TrendData {
  timestamp: Date;
  value: number;
  type: 'energy' | 'focus' | 'productivity' | 'tasks_completed';
}
```

### TimeSlot

```typescript
interface TimeSlot {
  start: string;
  end: string;
  dayOfWeek: number;
}
```

### WeeklyPlan

```typescript
interface WeeklyPlan {
  id: string;
  weekStart: Date;
  tasks: PlannedTask[];
  goals: WeeklyGoal[];
  totalPlannedHours: number;
  actualHours: number;
  completionRate: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### WeeklyGoal

```typescript
interface WeeklyGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  completed: boolean;
}
```

### AppContext

```typescript
interface AppContext {
  currentTask?: Task;
  activeSession?: TimerSession;
  activeFocusSession?: FocusSession;
  focusMode: boolean;
  timeOfDay: string;
  dayOfWeek: number;
  currentEnergy: number;
  recentActivity: ActivityEvent[];
  weeklyPlan?: WeeklyPlan;
  preferences: UserPreferences;
}
```

### ActivityEvent

```typescript
interface ActivityEvent {
  id: string;
  type:
    | 'task_created'
    | 'task_completed'
    | 'timer_started'
    | 'timer_stopped'
    | 'focus_started'
    | 'focus_ended';
  timestamp: Date;
  data: Record<string, unknown>;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  workingHours: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
  breakPreferences: {
    shortBreakDuration: number; // minutes
    longBreakDuration: number; // minutes
    breakInterval: number; // minutes
  };
  focusPreferences: {
    defaultDuration: number; // minutes
    distractionLevel: DistractionLevel;
    backgroundAudio: AudioConfig;
  };
  notifications: {
    breakReminders: boolean;
    taskDeadlines: boolean;
    dailySummary: boolean;
    weeklyReview: boolean;
  };
  aiSettings: {
    conversationHistory: boolean;
    autoSuggestions: boolean;
    toolPermissions: boolean;
    responseStyle: 'concise' | 'balanced' | 'detailed';
    suggestionFrequency: 'minimal' | 'moderate' | 'frequent';
    geminiApiKey?: string;
  };
  taskSettings: {
    defaultPriority: Priority;
    autoScheduling: boolean;
    smartDependencies: boolean;
    weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
    showCompletedTasks: boolean;
    compactView: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

## Task Management

### Task

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  timeEstimate: number;
  actualTime: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags: string[];
  projectId?: string;
  parentTaskId?: string;
  subtasks: string[];
  taskListId: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### TaskList

```typescript
interface TaskList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### TaskListSelection

```typescript
interface TaskListSelection {
  type: 'all' | 'specific';
  taskListId?: string;
  taskList?: TaskList;
}
```

### TaskListService

```typescript
interface TaskListService {}
```

### PlannedTask

```typescript
interface PlannedTask {
  taskId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  completed: boolean;
}
```

### TaskFilters

```typescript
interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  tags?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  projectId?: string;
  taskListId?: string;
  search?: string;
}
```

### TaskSortOptions

```typescript
interface TaskSortOptions {
  field: 'title' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
```

## Time Tracking

### TimerSession

```typescript
interface TimerSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  pausedTime: number;
  isActive: boolean;
  notes: string;
  breaks: TimerBreak[];
  createdAt: Date;
}
```

### TimerBreak

```typescript
interface TimerBreak {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}
```

### CompletedSession

```typescript
interface CompletedSession {
  id: string;
  taskId: string;
  duration: number;
  actualWork: number;
  breaks: TimerBreak[];
  notes: string;
  productivity: number;
  createdAt: Date;
}
```

### FocusSession

```typescript
interface FocusSession {
  id: string;
  taskId: string;
  plannedDuration: number;
  actualDuration?: number;
  focusScore?: number;
  distractionCount: number;
  distractionLevel: DistractionLevel;
  backgroundAudio?: AudioConfig;
  notes: string;
  breaks: FocusBreak[];
  metrics: FocusMetrics;
  createdAt: Date;
  completedAt?: Date;
}
```

### TaskTimerProps

```typescript
interface TaskTimerProps {
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerStop: () => void;
  activeTimerTaskId: string | null;
  isTimerRunning: boolean;
  elapsedTime: number;
}
```

### SessionStatistics

```typescript
interface SessionStatistics {
  totalSessions: number;
  totalTime: number;
  totalWorkTime: number;
  totalBreakTime: number;
  averageSessionLength: number;
  averageProductivity: number;
  mostProductiveHour: number;
  sessionsPerDay: Record<string, number>;
}
```

## AI & Analytics

### AISuggestion

```typescript
interface AISuggestion {
  id: string;
  type: 'task' | 'schedule' | 'break' | 'focus' | 'energy' | 'productivity';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  priority: Priority;
  estimatedImpact: number;
  reasoning: string;
  actions?: AIAction[];
  createdAt: Date;
  dismissedAt?: Date;
  appliedAt?: Date;
}
```

### AIAction

```typescript
interface AIAction {
  type:
    | 'CREATE_TASK'
    | 'UPDATE_TASK'
    | 'START_TIMER'
    | 'STOP_TIMER'
    | 'SCHEDULE_FOCUS'
    | 'TAKE_BREAK'
    | 'ANALYZE_PRODUCTIVITY'
    | 'SUGGEST_SCHEDULE';
  parameters: Record<string, unknown>;
  context: AppContext;
  confidence: number;
  reasoning?: string;
}
```

## Configuration

### FocusConfig

```typescript
interface FocusConfig {
  duration: number;
  taskId: string;
  distractionLevel: DistractionLevel;
  backgroundAudio?: AudioConfig;
  breakReminders: boolean;
  breakInterval?: number;
}
```

### AudioConfig

```typescript
interface AudioConfig {
  type: 'white_noise' | 'nature' | 'music' | 'silence';
  volume: number;
  url?: string;
}
```

## Types & Constants

### Constants

#### TASK_LIST_ALL

```typescript
const TASK_LIST_ALL: inferred = '__ALL__';
```

#### TASK_LIST_DEFAULT

```typescript
const TASK_LIST_DEFAULT: inferred = '__DEFAULT__';
```
