// Utility functions for KiraPilot

import { Priority, TaskStatus } from '../types';

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get priority color class for Tailwind
 */
export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case Priority.LOW:
      return 'text-green-600 bg-green-50 border-green-200';
    case Priority.MEDIUM:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case Priority.HIGH:
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case Priority.URGENT:
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get status color class for Tailwind
 */
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case TaskStatus.IN_PROGRESS:
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case TaskStatus.COMPLETED:
      return 'text-green-600 bg-green-50 border-green-200';
    case TaskStatus.CANCELLED:
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Generate unique ID (UUID v4 format)
 */
export function generateId(): string {
  // Generate a UUID v4 compatible string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format date to relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return dateObj.toLocaleDateString();
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
