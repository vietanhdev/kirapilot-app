// Data transformation utilities for KiraPilot
import {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TimerSession,
  FocusSession,
  Priority,
  TaskStatus,
  DistractionLevel,
} from '../types';
import { generateId } from './index';

/**
 * Transform CreateTaskRequest to Task entity
 */
export function createTaskRequestToTask(request: CreateTaskRequest): Task {
  const now = new Date();

  return {
    id: generateId(),
    title: request.title,
    description: request.description || '',
    priority: request.priority || Priority.MEDIUM,
    status: TaskStatus.PENDING,
    dependencies: request.dependencies || [],
    timeEstimate: request.timeEstimate || 0,
    actualTime: 0,
    dueDate: request.dueDate,
    scheduledDate: request.scheduledDate,
    tags: request.tags || [],
    projectId: request.projectId,
    parentTaskId: request.parentTaskId,
    subtasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply UpdateTaskRequest to existing Task
 */
export function applyTaskUpdate(task: Task, update: UpdateTaskRequest): Task {
  const updatedTask: Task = {
    ...task,
    updatedAt: new Date(),
  };

  // Apply updates only for defined fields
  if (update.title !== undefined) {
    updatedTask.title = update.title;
  }
  if (update.description !== undefined) {
    updatedTask.description = update.description;
  }
  if (update.priority !== undefined) {
    updatedTask.priority = update.priority;
  }
  if (update.status !== undefined) {
    updatedTask.status = update.status;
    // Set completion time when task is completed
    if (update.status === TaskStatus.COMPLETED && !task.completedAt) {
      updatedTask.completedAt = new Date();
    }
    // Clear completion time if task is uncompleted
    if (update.status !== TaskStatus.COMPLETED && task.completedAt) {
      updatedTask.completedAt = undefined;
    }
  }
  if (update.timeEstimate !== undefined) {
    updatedTask.timeEstimate = update.timeEstimate;
  }
  if (update.dueDate !== undefined) {
    updatedTask.dueDate = update.dueDate;
  }
  if (update.scheduledDate !== undefined) {
    updatedTask.scheduledDate = update.scheduledDate;
  }
  if (update.tags !== undefined) {
    updatedTask.tags = update.tags;
  }
  if (update.dependencies !== undefined) {
    updatedTask.dependencies = update.dependencies;
  }

  return updatedTask;
}

/**
 * Convert Task to database row format
 */
export function taskToDbRow(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dependencies: JSON.stringify(task.dependencies),
    time_estimate: task.timeEstimate,
    actual_time: task.actualTime,
    due_date: task.dueDate?.toISOString(),
    scheduled_date: task.scheduledDate?.toISOString(),
    tags: JSON.stringify(task.tags),
    project_id: task.projectId,
    parent_task_id: task.parentTaskId,
    subtasks: JSON.stringify(task.subtasks),
    completed_at: task.completedAt?.toISOString(),
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  };
}

/**
 * Safely parse JSON string with fallback
 */
function safeJsonParse<T = unknown>(
  jsonString: string | null | undefined,
  fallback: T = [] as T
): T {
  if (!jsonString || jsonString.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error);
    return fallback;
  }
}

/**
 * Convert database row to Task
 */
export function dbRowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    priority: row.priority as Priority,
    status: row.status as TaskStatus,
    dependencies: safeJsonParse<string[]>(row.dependencies as string, []),
    timeEstimate: (row.time_estimate as number) || 0,
    actualTime: (row.actual_time as number) || 0,
    dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
    scheduledDate: row.scheduled_date
      ? new Date(row.scheduled_date as string)
      : undefined,
    tags: safeJsonParse<string[]>(row.tags as string, []),
    projectId: row.project_id as string | undefined,
    parentTaskId: row.parent_task_id as string | undefined,
    subtasks: safeJsonParse<string[]>(row.subtasks as string, []),
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Convert TimerSession to database row format
 */
export function timerSessionToDbRow(
  session: TimerSession
): Record<string, unknown> {
  return {
    id: session.id,
    task_id: session.taskId,
    start_time: session.startTime.toISOString(),
    end_time: session.endTime?.toISOString(),
    paused_time: session.pausedTime,
    is_active: session.isActive ? 1 : 0, // Convert boolean to integer for SQLite
    notes: session.notes,
    breaks: JSON.stringify(session.breaks),
    created_at: session.createdAt.toISOString(),
  };
}

/**
 * Convert database row to TimerSession
 */
export function dbRowToTimerSession(
  row: Record<string, unknown>
): TimerSession {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    startTime: new Date(row.start_time as string),
    endTime: row.end_time ? new Date(row.end_time as string) : undefined,
    pausedTime: (row.paused_time as number) || 0,
    isActive: Boolean(row.is_active),
    notes: (row.notes as string) || '',
    breaks: JSON.parse((row.breaks as string) || '[]'),
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Convert FocusSession to database row format
 */
export function focusSessionToDbRow(
  session: FocusSession
): Record<string, unknown> {
  return {
    id: session.id,
    task_id: session.taskId,
    planned_duration: session.plannedDuration,
    actual_duration: session.actualDuration,
    focus_score: session.focusScore,
    distraction_count: session.distractionCount,
    distraction_level: session.distractionLevel,
    background_audio: session.backgroundAudio
      ? JSON.stringify(session.backgroundAudio)
      : null,
    notes: session.notes,
    breaks: JSON.stringify(session.breaks),
    metrics: JSON.stringify(session.metrics),
    created_at: session.createdAt.toISOString(),
    completed_at: session.completedAt?.toISOString(),
  };
}

/**
 * Convert database row to FocusSession
 */
export function dbRowToFocusSession(
  row: Record<string, unknown>
): FocusSession {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    plannedDuration: row.planned_duration as number,
    actualDuration: row.actual_duration as number | undefined,
    focusScore: row.focus_score as number | undefined,
    distractionCount: (row.distraction_count as number) || 0,
    distractionLevel:
      (row.distraction_level as DistractionLevel) || DistractionLevel.MODERATE,
    backgroundAudio: row.background_audio
      ? JSON.parse(row.background_audio as string)
      : undefined,
    notes: (row.notes as string) || '',
    breaks: JSON.parse((row.breaks as string) || '[]'),
    metrics: JSON.parse((row.metrics as string) || '{}'),
    createdAt: new Date(row.created_at as string),
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : undefined,
  };
}

/**
 * Calculate task completion percentage based on subtasks
 */
export function calculateTaskCompletion(task: Task, allTasks: Task[]): number {
  if (task.subtasks.length === 0) {
    return task.status === TaskStatus.COMPLETED ? 100 : 0;
  }

  const subtasks = allTasks.filter(t => task.subtasks.includes(t.id));
  const completedSubtasks = subtasks.filter(
    t => t.status === TaskStatus.COMPLETED
  );

  return subtasks.length > 0
    ? (completedSubtasks.length / subtasks.length) * 100
    : 0;
}

/**
 * Check if task has circular dependencies
 */
export function hasCircularDependency(
  taskId: string,
  dependencies: string[],
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(currentTaskId: string): boolean {
    if (recursionStack.has(currentTaskId)) {
      return true; // Circular dependency found
    }
    if (visited.has(currentTaskId)) {
      return false; // Already processed
    }

    visited.add(currentTaskId);
    recursionStack.add(currentTaskId);

    const currentTask = allTasks.find(t => t.id === currentTaskId);
    if (currentTask) {
      for (const depId of currentTask.dependencies) {
        if (dfs(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(currentTaskId);
    return false;
  }

  // Check if adding these dependencies would create a cycle
  const tempTask: Task = {
    id: taskId,
    dependencies,
    // ... other required fields (simplified for dependency checking)
  } as Task;

  // Create temporary task list with updated dependencies
  const updatedTasks = allTasks.filter(t => t.id !== taskId);
  updatedTasks.push(tempTask);

  return dfs(taskId);
}

/**
 * Get task priority weight for sorting
 */
export function getPriorityWeight(priority: Priority): number {
  switch (priority) {
    case Priority.LOW:
      return 1;
    case Priority.MEDIUM:
      return 2;
    case Priority.HIGH:
      return 3;
    case Priority.URGENT:
      return 4;
    default:
      return 0;
  }
}

/**
 * Calculate estimated completion time based on dependencies
 */
export function calculateEstimatedCompletionTime(
  task: Task,
  allTasks: Task[]
): number {
  const visited = new Set<string>();

  function calculateTime(taskId: string): number {
    if (visited.has(taskId)) {
      return 0; // Avoid infinite loops
    }
    visited.add(taskId);

    const currentTask = allTasks.find(t => t.id === taskId);
    if (!currentTask || currentTask.status === TaskStatus.COMPLETED) {
      return 0;
    }

    let maxDependencyTime = 0;
    for (const depId of currentTask.dependencies) {
      const depTime = calculateTime(depId);
      maxDependencyTime = Math.max(maxDependencyTime, depTime);
    }

    return maxDependencyTime + currentTask.timeEstimate;
  }

  return calculateTime(task.id);
}

/**
 * Format task for display in UI
 */
export function formatTaskForDisplay(task: Task, allTasks: Task[]) {
  const completion = calculateTaskCompletion(task, allTasks);
  const estimatedTime = calculateEstimatedCompletionTime(task, allTasks);
  const isOverdue =
    task.dueDate &&
    task.dueDate < new Date() &&
    task.status !== TaskStatus.COMPLETED;

  return {
    ...task,
    completion,
    estimatedTime,
    isOverdue,
    dependencyCount: task.dependencies.length,
    subtaskCount: task.subtasks.length,
  };
}
