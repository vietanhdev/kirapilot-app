// Repository exports
export { TaskRepository } from './TaskRepository';
export { TimeTrackingRepository } from './TimeTrackingRepository';
export { FocusRepository } from './FocusRepository';
export { PatternRepository } from './PatternRepository';

// Import types for singletons
import { TaskRepository } from './TaskRepository';
import { TimeTrackingRepository } from './TimeTrackingRepository';
import { FocusRepository } from './FocusRepository';
import { PatternRepository } from './PatternRepository';

// Repository instances (singletons)
let taskRepository: TaskRepository | null = null;
let timeTrackingRepository: TimeTrackingRepository | null = null;
let focusRepository: FocusRepository | null = null;
let patternRepository: PatternRepository | null = null;

/**
 * Get TaskRepository instance
 */
export function getTaskRepository(): TaskRepository {
  if (!taskRepository) {
    taskRepository = new TaskRepository();
  }
  return taskRepository;
}

/**
 * Get TimeTrackingRepository instance
 */
export function getTimeTrackingRepository(): TimeTrackingRepository {
  if (!timeTrackingRepository) {
    timeTrackingRepository = new TimeTrackingRepository();
  }
  return timeTrackingRepository;
}

/**
 * Get FocusRepository instance
 */
export function getFocusRepository(): FocusRepository {
  if (!focusRepository) {
    focusRepository = new FocusRepository();
  }
  return focusRepository;
}

/**
 * Get PatternRepository instance
 */
export function getPatternRepository(): PatternRepository {
  if (!patternRepository) {
    patternRepository = new PatternRepository();
  }
  return patternRepository;
}
