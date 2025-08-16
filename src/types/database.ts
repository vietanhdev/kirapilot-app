// Database row types for SQLite query results

export interface TaskDbRow extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  dependencies: string; // JSON string
  time_estimate: number;
  actual_time: number;
  due_date: string | null; // ISO string
  scheduled_date: string | null; // ISO string
  tags: string; // JSON string
  project_id: string | null;
  parent_task_id: string | null;
  subtasks: string; // JSON string
  completed_at: string | null; // ISO string
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface TimerSessionDbRow extends Record<string, unknown> {
  id: string;
  task_id: string;
  start_time: string; // ISO string
  end_time: string | null; // ISO string
  paused_time: number;
  is_active: number; // SQLite boolean (0 or 1)
  notes: string;
  breaks: string; // JSON string
  created_at: string; // ISO string
}

export interface FocusSessionDbRow extends Record<string, unknown> {
  id: string;
  task_id: string;
  planned_duration: number;
  actual_duration: number | null;
  focus_score: number | null;
  distraction_count: number;
  distraction_level: string;
  background_audio: string | null; // JSON string
  notes: string;
  breaks: string; // JSON string
  metrics: string; // JSON string
  created_at: string; // ISO string
  completed_at: string | null; // ISO string
}

export interface ProductivityPatternDbRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  pattern_type: string;
  time_slot: string;
  productivity_score: number;
  confidence_level: number;
  sample_size: number;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface UserPreferencesDbRow {
  id: string;
  working_hours: string; // JSON string
  break_preferences: string; // JSON string
  focus_preferences: string; // JSON string
  notifications: string; // JSON string
  theme: string;
  language: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface AISuggestionDbRow {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  actionable: number; // SQLite boolean (0 or 1)
  priority: number;
  estimated_impact: number;
  reasoning: string;
  actions: string; // JSON string
  created_at: string; // ISO string
  dismissed_at: string | null; // ISO string
  applied_at: string | null; // ISO string
}

// Aggregated query result types
export interface TaskTrendDbRow extends Record<string, unknown> {
  period: string;
  completed_tasks: number;
  efficiency: number;
}

export interface FocusTrendDbRow extends Record<string, unknown> {
  period: string;
  avg_focus_score: number;
  focus_sessions: number;
}

// Generic database result types
export type DbQueryResult<T = Record<string, unknown>> = T[];
export type DbExecuteResult = {
  changes: number;
  lastInsertRowid?: number;
};
