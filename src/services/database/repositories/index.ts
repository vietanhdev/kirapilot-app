// SeaORM-based service exports and singleton instances
import { TaskService } from './TaskService';
import { TimeTrackingService } from './TimeTrackingService';
import { FocusService } from './FocusService';
import { PatternService } from './PatternService';
import { TaskListService } from './TaskListService';
import { LogStorageService } from './LogStorageService';

// Singleton instances
let taskService: TaskService | null = null;
let timeTrackingService: TimeTrackingService | null = null;
let focusService: FocusService | null = null;
let patternService: PatternService | null = null;
let taskListService: TaskListService | null = null;
let logStorageService: LogStorageService | null = null;

// Export services
export { TaskService } from './TaskService';
export { TimeTrackingService } from './TimeTrackingService';
export { FocusService } from './FocusService';
export { PatternService } from './PatternService';
export { TaskListService } from './TaskListService';
export { LogStorageService } from './LogStorageService';

/**
 * Get TaskService instance (replaces TaskRepository)
 */
export function getTaskRepository(): TaskService {
  if (!taskService) {
    taskService = new TaskService();
  }
  return taskService;
}

/**
 * Get TimeTrackingService instance (replaces TimeTrackingRepository)
 */
export function getTimeTrackingRepository(): TimeTrackingService {
  if (!timeTrackingService) {
    timeTrackingService = new TimeTrackingService();
  }
  return timeTrackingService;
}

/**
 * Get FocusService instance (replaces FocusRepository)
 */
export function getFocusRepository(): FocusService {
  if (!focusService) {
    focusService = new FocusService();
  }
  return focusService;
}

/**
 * Get PatternService instance (replaces PatternRepository)
 */
export function getPatternRepository(): PatternService {
  if (!patternService) {
    patternService = new PatternService();
  }
  return patternService;
}

/**
 * Get TaskListService instance
 */
export function getTaskListRepository(): TaskListService {
  if (!taskListService) {
    taskListService = new TaskListService();
  }
  return taskListService;
}

/**
 * Get LogStorageService instance
 */
export function getLogStorageRepository(): LogStorageService {
  if (!logStorageService) {
    logStorageService = new LogStorageService();
  }
  return logStorageService;
}
