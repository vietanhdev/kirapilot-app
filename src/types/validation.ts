// Zod validation schemas for KiraPilot data types
import { z } from 'zod';
import { Priority, TaskStatus, DistractionLevel, FocusLevel } from './index';

// Enum schemas
export const PrioritySchema = z.nativeEnum(Priority);
export const TaskStatusSchema = z.nativeEnum(TaskStatus);
export const DistractionLevelSchema = z.nativeEnum(DistractionLevel);
export const FocusLevelSchema = z.nativeEnum(FocusLevel);

// Time format validation
export const TimeFormatSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');

// Core validation schemas
export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  priority: PrioritySchema.optional().default(Priority.MEDIUM),
  timeEstimate: z.number().min(1, 'Time estimate must be positive').max(1440, 'Time estimate too large').optional(),
  dueDate: z.date().optional(),
  scheduledDate: z.date().optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(10, 'Too many tags').optional().default([]),
  dependencies: z.array(z.string().uuid('Invalid dependency ID')).optional().default([]),
  projectId: z.string().uuid('Invalid project ID').optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
});

export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  priority: PrioritySchema.optional(),
  status: TaskStatusSchema.optional(),
  timeEstimate: z.number().min(1, 'Time estimate must be positive').max(1440, 'Time estimate too large').optional(),
  dueDate: z.date().optional(),
  scheduledDate: z.date().optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(10, 'Too many tags').optional(),
  dependencies: z.array(z.string().uuid('Invalid dependency ID')).optional(),
});

export const TaskSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long'),
  priority: PrioritySchema,
  status: TaskStatusSchema,
  dependencies: z.array(z.string().uuid('Invalid dependency ID')),
  timeEstimate: z.number().min(0, 'Time estimate cannot be negative'),
  actualTime: z.number().min(0, 'Actual time cannot be negative'),
  dueDate: z.date().optional(),
  tags: z.array(z.string().max(50, 'Tag too long')),
  projectId: z.string().uuid('Invalid project ID').optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
  subtasks: z.array(z.string().uuid('Invalid subtask ID')),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AudioConfigSchema = z.object({
  type: z.enum(['white_noise', 'nature', 'music', 'silence']),
  volume: z.number().min(0, 'Volume cannot be negative').max(100, 'Volume cannot exceed 100'),
  url: z.string().url('Invalid audio URL').optional(),
});

export const FocusConfigSchema = z.object({
  duration: z.number().min(1, 'Duration must be positive').max(480, 'Duration too long (max 8 hours)'),
  taskId: z.string().uuid('Invalid task ID'),
  distractionLevel: DistractionLevelSchema,
  backgroundAudio: AudioConfigSchema.optional(),
  breakReminders: z.boolean(),
  breakInterval: z.number().min(5, 'Break interval too short').max(120, 'Break interval too long').optional(),
});

export const TimeSlotSchema = z.object({
  start: TimeFormatSchema,
  end: TimeFormatSchema,
  dayOfWeek: z.number().min(0, 'Invalid day of week').max(6, 'Invalid day of week'),
}).refine(
  (data) => {
    const [startHour, startMin] = data.start.split(':').map(Number);
    const [endHour, endMin] = data.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return startMinutes < endMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['end'],
  }
);

export const TimerBreakSchema = z.object({
  id: z.string().uuid('Invalid break ID'),
  startTime: z.date(),
  endTime: z.date(),
  reason: z.string().max(200, 'Reason too long'),
}).refine(
  (data) => data.endTime > data.startTime,
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export const TimerSessionSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
  taskId: z.string().uuid('Invalid task ID'),
  startTime: z.date(),
  endTime: z.date().optional(),
  pausedTime: z.number().min(0, 'Paused time cannot be negative'),
  isActive: z.boolean(),
  notes: z.string().max(1000, 'Notes too long'),
  breaks: z.array(TimerBreakSchema),
  createdAt: z.date(),
});

export const FocusMetricsSchema = z.object({
  totalDistractions: z.number().min(0, 'Distractions cannot be negative'),
  longestFocusStreak: z.number().min(0, 'Focus streak cannot be negative'),
  averageFocusStreak: z.number().min(0, 'Focus streak cannot be negative'),
  productivityScore: z.number().min(0, 'Score cannot be negative').max(100, 'Score cannot exceed 100'),
  energyLevel: z.number().min(0, 'Energy level cannot be negative').max(100, 'Energy level cannot exceed 100'),
});

export const FocusBreakSchema = z.object({
  id: z.string().uuid('Invalid break ID'),
  startTime: z.date(),
  endTime: z.date(),
  type: z.enum(['planned', 'distraction']),
  reason: z.string().max(200, 'Reason too long').optional(),
}).refine(
  (data) => data.endTime > data.startTime,
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export const FocusSessionSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
  taskId: z.string().uuid('Invalid task ID'),
  plannedDuration: z.number().min(1, 'Duration must be positive'),
  actualDuration: z.number().min(0, 'Duration cannot be negative').optional(),
  focusScore: z.number().min(0, 'Score cannot be negative').max(100, 'Score cannot exceed 100').optional(),
  distractionCount: z.number().min(0, 'Distractions cannot be negative'),
  distractionLevel: DistractionLevelSchema,
  backgroundAudio: AudioConfigSchema.optional(),
  notes: z.string().max(1000, 'Notes too long'),
  breaks: z.array(FocusBreakSchema),
  metrics: FocusMetricsSchema,
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

export const UserPreferencesSchema = z.object({
  workingHours: z.object({
    start: TimeFormatSchema,
    end: TimeFormatSchema,
  }).refine(
    (data) => {
      const [startHour, startMin] = data.start.split(':').map(Number);
      const [endHour, endMin] = data.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return startMinutes < endMinutes;
    },
    {
      message: 'End time must be after start time',
      path: ['end'],
    }
  ),
  breakPreferences: z.object({
    shortBreakDuration: z.number().min(1, 'Break duration too short').max(30, 'Break duration too long'),
    longBreakDuration: z.number().min(15, 'Break duration too short').max(120, 'Break duration too long'),
    breakInterval: z.number().min(15, 'Break interval too short').max(240, 'Break interval too long'),
  }),
  focusPreferences: z.object({
    defaultDuration: z.number().min(15, 'Duration too short').max(240, 'Duration too long'),
    distractionLevel: DistractionLevelSchema,
    backgroundAudio: AudioConfigSchema,
  }),
  notifications: z.object({
    breakReminders: z.boolean(),
    taskDeadlines: z.boolean(),
    dailySummary: z.boolean(),
    weeklyReview: z.boolean(),
  }),
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.string().min(2, 'Invalid language code').max(5, 'Invalid language code'),
});

export const AISuggestionSchema = z.object({
  id: z.string().uuid('Invalid suggestion ID'),
  type: z.enum(['task', 'schedule', 'break', 'focus', 'energy', 'productivity']),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long'),
  confidence: z.number().min(0, 'Confidence cannot be negative').max(100, 'Confidence cannot exceed 100'),
  actionable: z.boolean(),
  priority: PrioritySchema,
  estimatedImpact: z.number().min(0, 'Impact cannot be negative').max(100, 'Impact cannot exceed 100'),
  reasoning: z.string().max(1000, 'Reasoning too long'),
  createdAt: z.date(),
  dismissedAt: z.date().optional(),
  appliedAt: z.date().optional(),
});

export const TaskFiltersSchema = z.object({
  status: z.array(TaskStatusSchema).optional(),
  priority: z.array(PrioritySchema).optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).optional(),
  dueDate: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  projectId: z.string().uuid('Invalid project ID').optional(),
  search: z.string().max(100, 'Search query too long').optional(),
});

export const TaskSortOptionsSchema = z.object({
  field: z.enum(['title', 'priority', 'dueDate', 'createdAt', 'updatedAt']),
  direction: z.enum(['asc', 'desc']),
});

// Validation helper functions
export function validateCreateTaskRequest(data: unknown) {
  return CreateTaskRequestSchema.safeParse(data);
}

export function validateUpdateTaskRequest(data: unknown) {
  return UpdateTaskRequestSchema.safeParse(data);
}

export function validateTask(data: unknown) {
  return TaskSchema.safeParse(data);
}

export function validateFocusConfig(data: unknown) {
  return FocusConfigSchema.safeParse(data);
}

export function validateTimerSession(data: unknown) {
  return TimerSessionSchema.safeParse(data);
}

export function validateFocusSession(data: unknown) {
  return FocusSessionSchema.safeParse(data);
}

export function validateUserPreferences(data: unknown) {
  return UserPreferencesSchema.safeParse(data);
}

export function validateAISuggestion(data: unknown) {
  return AISuggestionSchema.safeParse(data);
}

export function validateTaskFilters(data: unknown) {
  return TaskFiltersSchema.safeParse(data);
}

export function validateTaskSortOptions(data: unknown) {
  return TaskSortOptionsSchema.safeParse(data);
}