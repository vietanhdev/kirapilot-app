import { Task, TaskSortOptions, Priority } from '../types';

/**
 * Sorts an array of tasks based on the provided sort options
 */
export function sortTasks(tasks: Task[], sortOptions: TaskSortOptions): Task[] {
  const { field, direction } = sortOptions;

  return [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;

      case 'priority':
        // Higher priority values should come first when descending
        comparison = a.priority - b.priority;
        break;

      case 'dueDate':
        // Handle null/undefined due dates
        if (!a.dueDate && !b.dueDate) {
          comparison = 0;
        } else if (!a.dueDate) {
          comparison = 1; // Tasks without due date go to end
        } else if (!b.dueDate) {
          comparison = -1;
        } else {
          comparison =
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        break;

      case 'createdAt':
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;

      case 'updatedAt':
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;

      default:
        comparison = 0;
    }

    // Apply direction
    return direction === 'desc' ? -comparison : comparison;
  });
}

/**
 * Gets the default sort options
 */
export function getDefaultSortOptions(): TaskSortOptions {
  return {
    field: 'priority',
    direction: 'desc',
  };
}

/**
 * Priority display helper
 */
export function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case Priority.URGENT:
      return 'Urgent';
    case Priority.HIGH:
      return 'High';
    case Priority.MEDIUM:
      return 'Medium';
    case Priority.LOW:
      return 'Low';
    default:
      return 'Unknown';
  }
}

/**
 * Priority color helper for UI
 */
export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case Priority.URGENT:
      return 'text-red-600 dark:text-red-400';
    case Priority.HIGH:
      return 'text-orange-600 dark:text-orange-400';
    case Priority.MEDIUM:
      return 'text-yellow-600 dark:text-yellow-400';
    case Priority.LOW:
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-default-500';
  }
}
