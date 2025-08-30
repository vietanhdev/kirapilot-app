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

export enum TimePreset {
  FIFTEEN_MIN = 15,
  THIRTY_MIN = 30,
  SIXTY_MIN = 60,
  CUSTOM = -1,
  NOT_APPLICABLE = 0,
}

// Core Interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  order: number; // Sort order within the same column/context (0-based)
  dependencies: string[];
  timePreset: TimePreset; // Preset timing option
  timeEstimate: number; // in minutes - for custom values or calculated from preset
  actualTime: number; // in minutes
  dueDate?: Date;
  scheduledDate?: Date; // When the task is scheduled to be worked on (for day view planning)
  tags: string[];
  projectId?: string;
  parentTaskId?: string;
  subtasks: string[];
  taskListId: string; // Foreign key to task list
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  order?: number; // Sort order within the same column/context
  timePreset?: TimePreset;
  timeEstimate?: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags?: string[];
  dependencies?: string[];
  projectId?: string;
  parentTaskId?: string;
  taskListId?: string; // Optional - defaults to current selection or default list
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  order?: number; // Sort order within the same column/context
  timePreset?: TimePreset;
  timeEstimate?: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags?: string[];
  dependencies?: string[];
  taskListId?: string; // Allow moving tasks between lists
}

// Task List Types
export interface TaskList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskListRequest {
  name: string;
}

export interface UpdateTaskListRequest {
  name: string;
}

// Special task list identifiers
export const TASK_LIST_ALL = '__ALL__';
export const TASK_LIST_DEFAULT = '__DEFAULT__';

// Task list selection state
export interface TaskListSelection {
  type: 'all' | 'specific';
  taskListId?: string;
  taskList?: TaskList;
}

// Task list service interface for frontend-backend communication
export interface TaskListService {
  getAllTaskLists(): Promise<TaskList[]>;
  createTaskList(request: CreateTaskListRequest): Promise<TaskList>;
  updateTaskList(id: string, request: UpdateTaskListRequest): Promise<TaskList>;
  deleteTaskList(id: string): Promise<void>;
  getDefaultTaskList(): Promise<TaskList>;
  moveTaskToList(taskId: string, taskListId: string): Promise<Task>;
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
  aiSettings: {
    conversationHistory: boolean;
    autoSuggestions: boolean;
    toolPermissions: boolean;
    responseStyle: 'concise' | 'balanced' | 'detailed';
    suggestionFrequency: 'minimal' | 'moderate' | 'frequent';
    showInteractionLogs: boolean;
    modelType?: 'local' | 'gemini';
    geminiApiKey?: string;
    localModelConfig?: {
      threads?: number;
      contextSize?: number;
      temperature?: number;
      maxTokens?: number;
    };
    logging?: {
      enabled: boolean;
      logLevel: 'minimal' | 'standard' | 'detailed';
      retentionDays: number;
      maxLogSize: number;
      includeSystemPrompts: boolean;
      includeToolExecutions: boolean;
      includePerformanceMetrics: boolean;
      autoCleanup: boolean;
      exportFormat: 'json' | 'csv';
    };
    // Personality and emotional intelligence settings
    personalitySettings?: {
      warmth: number; // 1-10 scale
      enthusiasm: number; // 1-10 scale
      supportiveness: number; // 1-10 scale
      humor: number; // 1-10 scale
    };
    interactionStyle?: 'casual' | 'professional' | 'friendly';
    emojiUsage?: 'minimal' | 'moderate' | 'frequent';
    emotionalFeatures?: {
      dailyMoodTracking: boolean;
      stressDetection: boolean;
      encouragementFrequency: 'low' | 'medium' | 'high';
      celebrationStyle: 'subtle' | 'enthusiastic';
    };
    onboardingCompleted?: boolean;
  };
  taskSettings: {
    defaultPriority: Priority;
    autoScheduling: boolean;
    smartDependencies: boolean;
    weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
    showCompletedTasks: boolean;
    compactView: boolean;
  };
  soundSettings: {
    hapticFeedback: boolean;
    completionSound: boolean;
    soundVolume: number; // 0-100
  };
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
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
  taskListId?: string; // Filter by task list
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

// Re-export AI logging types
export * from './aiLogging';

// Re-export task matching types
export * from './taskMatching';

// Re-export AI confirmation types
export * from './aiConfirmation';

// Re-export emotional intelligence types
export * from './emotionalIntelligence';
