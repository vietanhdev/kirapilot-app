// Core data types for KiraPilot

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  timeEstimate: number;
  actualTime: number;
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

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

export interface TimerSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  pausedTime: number;
  isActive: boolean;
  notes: string;
}

export interface FocusSession {
  id: string;
  taskId: string;
  duration: number;
  actualDuration?: number;
  focusScore?: number;
  distractionCount: number;
  notes: string;
  createdAt: Date;
}

export interface EnergyMetrics {
  currentLevel: number;
  focusScore: number;
  productivityTrend: TrendData[];
  optimalTimes: TimeSlot[];
}

export interface TrendData {
  timestamp: Date;
  value: number;
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  dayOfWeek: number; // 0-6, Sunday = 0
}

export interface AISuggestion {
  id: string;
  type: 'task' | 'schedule' | 'break' | 'focus';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  createdAt: Date;
}

export interface AppContext {
  currentTask?: Task;
  activeSession?: TimerSession;
  focusMode: boolean;
  timeOfDay: string;
  dayOfWeek: number;
  recentActivity: string[];
}

export interface AIAction {
  type: 'CREATE_TASK' | 'START_TIMER' | 'SCHEDULE_FOCUS' | 'ANALYZE_PRODUCTIVITY';
  parameters: Record<string, any>;
  context: AppContext;
}

export interface AIResponse {
  message: string;
  actions: AIAction[];
  suggestions: AISuggestion[];
}