import { useUserPreferences } from './useUserPreferences';
import { Task, Priority, TaskStatus } from '../types';

export const useTaskWithPreferences = () => {
  const {
    defaultPriority,
    autoScheduling,
    weekStartDay,
    showCompletedTasks,
    compactView,
    preferences,
  } = useUserPreferences();

  const smartDependencies = preferences.taskSettings.smartDependencies;

  const createTaskWithDefaults = (
    taskData: Partial<Task>
  ): Omit<Task, 'id'> => {
    const now = new Date();

    return {
      title: taskData.title || '',
      description: taskData.description || '',
      priority: taskData.priority ?? defaultPriority,
      status: taskData.status || TaskStatus.PENDING,
      dependencies: taskData.dependencies || [],
      subtasks: taskData.subtasks || [],
      timeEstimate: taskData.timeEstimate || 0,
      actualTime: taskData.actualTime || 0,
      dueDate: taskData.dueDate,
      scheduledDate:
        taskData.scheduledDate ||
        (autoScheduling
          ? getAutoScheduledDate(taskData.priority ?? defaultPriority)
          : undefined),
      tags: taskData.tags || [],
      createdAt: taskData.createdAt || now,
      updatedAt: taskData.updatedAt || now,
    };
  };

  const getAutoScheduledDate = (priority: Priority): Date => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Schedule based on priority
    switch (priority) {
      case Priority.URGENT:
        return today; // Schedule for today
      case Priority.HIGH:
        return new Date(today.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      case Priority.MEDIUM:
        return new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000); // Day after tomorrow
      case Priority.LOW:
        return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
      default:
        return new Date(today.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
    }
  };

  const getWeekStartDate = (date: Date = new Date()): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + weekStartDay;
    return new Date(d.setDate(diff));
  };

  const shouldShowTask = (task: Task): boolean => {
    if (task.status === TaskStatus.COMPLETED && !showCompletedTasks) {
      return false;
    }
    return true;
  };

  const getTaskDisplayMode = () => {
    return compactView ? 'compact' : 'normal';
  };

  const suggestDependencies = (task: Task, allTasks: Task[]): Task[] => {
    if (!smartDependencies) {
      return [];
    }

    // Simple dependency suggestion based on task titles and tags
    return allTasks.filter(otherTask => {
      if (otherTask.id === task.id) {
        return false;
      }
      if (otherTask.status === TaskStatus.COMPLETED) {
        return false;
      }

      // Check for common keywords in titles
      const taskWords = task.title.toLowerCase().split(' ');
      const otherWords = otherTask.title.toLowerCase().split(' ');
      const commonWords = taskWords.filter(
        word => word.length > 3 && otherWords.includes(word)
      );

      // Check for common tags
      const commonTags = task.tags.filter(tag => otherTask.tags.includes(tag));

      return commonWords.length > 0 || commonTags.length > 0;
    });
  };

  return {
    defaultPriority,
    autoScheduling,
    smartDependencies,
    weekStartDay,
    showCompletedTasks,
    compactView,
    createTaskWithDefaults,
    getAutoScheduledDate,
    getWeekStartDate,
    shouldShowTask,
    getTaskDisplayMode,
    suggestDependencies,
  };
};
