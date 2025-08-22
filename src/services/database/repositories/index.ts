// SeaORM-based service exports and singleton instances
import { TaskService } from './TaskService';
import { TimeTrackingService } from './TimeTrackingService';
import { FocusService } from './FocusService';
import { PatternService } from './PatternService';

// Singleton instances
let taskService: TaskService | null = null;
let timeTrackingService: TimeTrackingService | null = null;
let focusService: FocusService | null = null;
let patternService: PatternService | null = null;

// Export services
export { TaskService } from './TaskService';
export { TimeTrackingService } from './TimeTrackingService';
export { FocusService } from './FocusService';
export { PatternService } from './PatternService';

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
