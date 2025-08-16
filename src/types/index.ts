// Core data types for KiraPilot

// Enums
export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  URGENT = 3,
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum FocusLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  DEEP = 'deep',
}

export enum DistractionLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  FULL = 'full',
}

// Core Interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  timeEstimate: number; // in minutes
  actualTime: number; // in minutes
  dueDate?: Date;
  scheduledDate?: Date; // When the task is scheduled to be worked on (for day view planning)
  tags: string[];
  projectId?: string;
  parentTaskId?: string;
  subtasks: string[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  timeEstimate?: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags?: string[];
  dependencies?: string[];
  projectId?: string;
  parentTaskId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  timeEstimate?: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags?: string[];
  dependencies?: string[];
}

export interface TimerSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  pausedTime: number; // in milliseconds
  isActive: boolean;
  notes: string;
  breaks: TimerBreak[];
  createdAt: Date;
}

export interface TimerBreak {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

export interface CompletedSession {
  id: string;
  taskId: string;
  duration: number; // in milliseconds
  actualWork: number; // in milliseconds (excluding breaks)
  breaks: TimerBreak[];
  notes: string;
  productivity: number; // 0-100 score
  createdAt: Date;
}

export interface FocusSession {
  id: string;
  taskId: string;
  plannedDuration: number; // in minutes
  actualDuration?: number; // in minutes
  focusScore?: number; // 0-100
  distractionCount: number;
  distractionLevel: DistractionLevel;
  backgroundAudio?: AudioConfig;
  notes: string;
  breaks: FocusBreak[];
  metrics: FocusMetrics;
  createdAt: Date;
  completedAt?: Date;
}

export interface FocusConfig {
  duration: number; // in minutes
  taskId: string;
  distractionLevel: DistractionLevel;
  backgroundAudio?: AudioConfig;
  breakReminders: boolean;
  breakInterval?: number; // in minutes
}

export interface AudioConfig {
  type: 'white_noise' | 'nature' | 'music' | 'silence';
  volume: number; // 0-100
  url?: string;
}

export interface FocusBreak {
  id: string;
  startTime: Date;
  endTime: Date;
  type: 'planned' | 'distraction';
  reason?: string;
}

export interface FocusMetrics {
  totalDistractions: number;
  longestFocusStreak: number; // in minutes
  averageFocusStreak: number; // in minutes
  productivityScore: number; // 0-100
  energyLevel: number; // 0-100
}

export interface EnergyMetrics {
  currentLevel: number; // 0-100
  focusScore: number; // 0-100
  productivityTrend: TrendData[];
  optimalTimes: TimeSlot[];
  energyPattern: EnergyPattern[];
}

export interface EnergyPattern {
  timeSlot: TimeSlot;
  averageEnergy: number;
  confidence: number;
  sampleSize: number;
}

export interface TrendData {
  timestamp: Date;
  value: number;
  type: 'energy' | 'focus' | 'productivity' | 'tasks_completed';
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
  dayOfWeek: number; // 0-6, Sunday = 0
}

export interface ProductivityPattern {
  id: string;
  userId: string;
  patternType: 'daily' | 'weekly' | 'task_based' | 'energy_based';
  timeSlots: TimeSlot[];
  productivity: number; // 0-100
  confidence: number; // 0-100
  sampleSize: number;
  lastUpdated: Date;
}

export interface WeeklyPlan {
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

export interface PlannedTask {
  taskId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  completed: boolean;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  completed: boolean;
}

export interface AISuggestion {
  id: string;
  type: 'task' | 'schedule' | 'break' | 'focus' | 'energy' | 'productivity';
  title: string;
  description: string;
  confidence: number; // 0-100
  actionable: boolean;
  priority: Priority;
  estimatedImpact: number; // 0-100
  reasoning: string;
  actions?: AIAction[];
  createdAt: Date;
  dismissedAt?: Date;
  appliedAt?: Date;
}

export interface AppContext {
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

export interface ActivityEvent {
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

export interface UserPreferences {
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
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

export interface AIAction {
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
  reasoning?: string; // LLM's reasoning for choosing this action
}

export interface AIResponse {
  message: string;
  actions: AIAction[];
  suggestions: AISuggestion[];
  context: AppContext;
  reasoning?: string;
}

export interface PatternAnalysis {
  userId: string;
  analysisDate: Date;
  productivityPatterns: ProductivityPattern[];
  energyPatterns: EnergyPattern[];
  recommendations: AISuggestion[];
  insights: {
    mostProductiveTime: TimeSlot;
    leastProductiveTime: TimeSlot;
    averageTaskDuration: number;
    completionRate: number;
    focusEfficiency: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  tags?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  projectId?: string;
  search?: string;
}

export interface TaskSortOptions {
  field: 'title' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
// Timer-related types
export interface TaskTimerProps {
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerStop: () => void;
  activeTimerTaskId: string | null;
  isTimerRunning: boolean;
  elapsedTime: number;
}

// Statistics types
export interface SessionStatistics {
  totalSessions: number;
  totalTime: number;
  totalWorkTime: number;
  totalBreakTime: number;
  averageSessionLength: number;
  averageProductivity: number;
  mostProductiveHour: number;
  sessionsPerDay: Record<string, number>;
}
