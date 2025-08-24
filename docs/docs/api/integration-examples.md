# API Integration Examples

This document provides practical examples of how to integrate with KiraPilot's API using the documented interfaces and commands.

## Task Management Integration

### Creating and Managing Tasks

```typescript
import { invoke } from '@tauri-apps/api/core';
import { Task, CreateTaskRequest, Priority, TaskStatus } from '../types';

class TaskManager {
  /**
   * Create a new task with proper error handling
   */
  async createTask(taskData: Partial<CreateTaskRequest>): Promise<Task> {
    try {
      const request: CreateTaskRequest = {
        title: taskData.title || 'Untitled Task',
        description: taskData.description,
        priority: taskData.priority || Priority.MEDIUM,
        timeEstimate: taskData.timeEstimate || 30,
        dueDate: taskData.dueDate,
        scheduledDate: taskData.scheduledDate,
        tags: taskData.tags || [],
        dependencies: taskData.dependencies || [],
        taskListId: taskData.taskListId,
      };

      const result = await invoke('create_task', { request });
      return result as Task;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw new Error(`Task creation failed: ${error}`);
    }
  }

  /**
   * Update task status with validation
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    try {
      const result = await invoke('update_task', {
        id: taskId,
        request: { status },
      });
      return result as Task;
    } catch (error) {
      console.error('Failed to update task status:', error);
      throw error;
    }
  }

  /**
   * Get tasks with filtering and error handling
   */
  async getTasks(filters?: {
    status?: TaskStatus[];
    priority?: Priority[];
    tags?: string[];
  }): Promise<Task[]> {
    try {
      const result = await invoke('get_all_tasks', {
        status: filters?.status?.[0],
        project_id: undefined,
      });
      return result as Task[];
    } catch (error) {
      console.error('Failed to get tasks:', error);
      return [];
    }
  }
}

// Usage example
const taskManager = new TaskManager();

// Create a high-priority task
const newTask = await taskManager.createTask({
  title: 'Complete API documentation',
  description: 'Write comprehensive API documentation with examples',
  priority: Priority.HIGH,
  timeEstimate: 120,
  dueDate: new Date('2024-12-31'),
  tags: ['documentation', 'api'],
});

console.log('Created task:', newTask);
```

### Task Dependencies Management

```typescript
/**
 * Manage task dependencies with proper validation
 */
class TaskDependencyManager {
  async addDependency(taskId: string, dependsOnId: string): Promise<void> {
    try {
      // Validate that both tasks exist
      const [task, dependency] = await Promise.all([
        invoke('get_task', { id: taskId }),
        invoke('get_task', { id: dependsOnId }),
      ]);

      if (!task || !dependency) {
        throw new Error('One or both tasks do not exist');
      }

      // Check for circular dependencies
      await this.validateNoCycles(taskId, dependsOnId);

      // Add the dependency
      await invoke('add_task_dependency', {
        task_id: taskId,
        depends_on_id: dependsOnId,
      });

      console.log(`Added dependency: ${taskId} depends on ${dependsOnId}`);
    } catch (error) {
      console.error('Failed to add dependency:', error);
      throw error;
    }
  }

  private async validateNoCycles(
    taskId: string,
    dependsOnId: string
  ): Promise<void> {
    // Get all dependencies of the dependency task
    const dependencies = (await invoke('get_task_dependencies', {
      task_id: dependsOnId,
    })) as Task[];

    // Check if our task is already a dependency
    if (dependencies.some(dep => dep.id === taskId)) {
      throw new Error(
        'Adding this dependency would create a circular reference'
      );
    }
  }
}
```

## Time Tracking Integration

### Session Management

```typescript
import { TimerSession, CreateTimeSessionRequest } from '../types';

class TimeTracker {
  private activeSession: TimerSession | null = null;

  /**
   * Start a time tracking session
   */
  async startSession(taskId: string): Promise<TimerSession> {
    try {
      // Stop any existing session first
      if (this.activeSession) {
        await this.stopSession(this.activeSession.id);
      }

      const request: CreateTimeSessionRequest = {
        task_id: taskId,
        start_time: new Date().toISOString(),
        notes: '',
      };

      const session = (await invoke('create_time_session', {
        request,
      })) as TimerSession;
      this.activeSession = session;

      console.log('Started time tracking session:', session.id);
      return session;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  /**
   * Stop the current session
   */
  async stopSession(sessionId: string, notes?: string): Promise<TimerSession> {
    try {
      const session = (await invoke('stop_time_session', {
        id: sessionId,
        notes: notes || '',
      })) as TimerSession;

      if (this.activeSession?.id === sessionId) {
        this.activeSession = null;
      }

      console.log('Stopped time tracking session:', sessionId);
      return session;
    } catch (error) {
      console.error('Failed to stop session:', error);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(startDate: Date, endDate: Date) {
    try {
      const stats = await invoke('get_time_stats', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      return stats;
    } catch (error) {
      console.error('Failed to get session stats:', error);
      throw error;
    }
  }
}

// Usage example
const timeTracker = new TimeTracker();

// Start tracking time for a task
const session = await timeTracker.startSession('task-123');

// Later, stop the session with notes
await timeTracker.stopSession(session.id, 'Completed the main implementation');
```

## AI Integration

### AI Interaction Management

```typescript
import { CreateAiInteractionRequest, AISuggestion } from '../types';

class AIAssistant {
  /**
   * Create an AI interaction record
   */
  async recordInteraction(
    message: string,
    response: string,
    actionTaken?: string,
    toolsUsed?: string[]
  ): Promise<void> {
    try {
      const request: CreateAiInteractionRequest = {
        message,
        response,
        action_taken: actionTaken,
        reasoning: 'User requested assistance',
        tools_used: toolsUsed ? JSON.stringify(toolsUsed) : undefined,
        confidence: 0.85,
      };

      await invoke('create_ai_interaction', { request });
      console.log('AI interaction recorded');
    } catch (error) {
      console.error('Failed to record AI interaction:', error);
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(limit: number = 10) {
    try {
      const history = await invoke('get_conversation_history', { limit });
      return history;
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * Clear old interactions for privacy
   */
  async clearOldInteractions(olderThanDays: number = 30): Promise<number> {
    try {
      const deletedCount = (await invoke('clear_old_ai_interactions', {
        older_than_days: olderThanDays,
      })) as number;

      console.log(`Cleared ${deletedCount} old AI interactions`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to clear old interactions:', error);
      return 0;
    }
  }
}
```

## Database Management

### Health Monitoring and Maintenance

```typescript
import { DatabaseHealth } from '../types';

class DatabaseManager {
  /**
   * Check database health
   */
  async checkHealth(): Promise<DatabaseHealth> {
    try {
      const health = (await invoke('get_database_health')) as DatabaseHealth;

      if (!health.is_healthy) {
        console.warn('Database health issues detected:', health.issues);
      }

      return health;
    } catch (error) {
      console.error('Failed to check database health:', error);
      throw error;
    }
  }

  /**
   * Initialize database if needed
   */
  async ensureInitialized(): Promise<void> {
    try {
      const health = await this.checkHealth();

      if (!health.is_healthy) {
        console.log('Initializing database...');
        await invoke('init_database');
        console.log('Database initialized successfully');
      }
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Backup data with error handling
   */
  async backupData(): Promise<string> {
    try {
      // This would use a backup command if available
      const backupPath = (await invoke('create_backup')) as string;
      console.log('Data backed up to:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }
}
```

## Error Handling Best Practices

### Comprehensive Error Handling

```typescript
/**
 * Centralized error handling for API calls
 */
class APIErrorHandler {
  static async handleAPICall<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = this.parseError(error);
      console.error(`${context} failed:`, errorMessage);

      // Log error for debugging
      this.logError(context, error);

      // Re-throw with context
      throw new Error(`${context}: ${errorMessage}`);
    }
  }

  private static parseError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error occurred';
  }

  private static logError(context: string, error: unknown): void {
    // In a real application, you might send this to a logging service
    console.error('Error details:', {
      context,
      error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }
}

// Usage example
const result = await APIErrorHandler.handleAPICall(
  () => invoke('create_task', { request: taskData }),
  'Task creation'
);
```

## Performance Optimization

### Batch Operations

```typescript
/**
 * Batch operations for better performance
 */
class BatchOperations {
  /**
   * Create multiple tasks efficiently
   */
  async createTasksBatch(tasks: CreateTaskRequest[]): Promise<Task[]> {
    const results: Task[] = [];
    const errors: string[] = [];

    // Process in batches to avoid overwhelming the backend
    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      const batchPromises = batch.map(async (taskRequest, index) => {
        try {
          const task = await invoke('create_task', { request: taskRequest });
          return { success: true, task, index: i + index };
        } catch (error) {
          return { success: false, error: error.toString(), index: i + index };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(result => {
        if (result.success) {
          results.push(result.task);
        } else {
          errors.push(`Task ${result.index}: ${result.error}`);
        }
      });
    }

    if (errors.length > 0) {
      console.warn('Some tasks failed to create:', errors);
    }

    return results;
  }
}
```

## Testing API Integration

### Unit Tests for API Calls

```typescript
import { jest } from '@jest/globals';

describe('Task API Integration', () => {
  // Mock the invoke function
  const mockInvoke = jest.fn();

  beforeEach(() => {
    mockInvoke.mockClear();
  });

  test('should create task with proper error handling', async () => {
    const mockTask = {
      id: 'test-task-id',
      title: 'Test Task',
      status: 'pending',
      // ... other task properties
    };

    mockInvoke.mockResolvedValue(mockTask);

    const taskManager = new TaskManager();
    const result = await taskManager.createTask({
      title: 'Test Task',
      priority: Priority.HIGH,
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_task', {
      request: expect.objectContaining({
        title: 'Test Task',
        priority: Priority.HIGH,
      }),
    });

    expect(result).toEqual(mockTask);
  });

  test('should handle task creation errors', async () => {
    mockInvoke.mockRejectedValue(new Error('Database connection failed'));

    const taskManager = new TaskManager();

    await expect(
      taskManager.createTask({
        title: 'Test Task',
      })
    ).rejects.toThrow('Task creation failed');
  });
});
```

## Summary

These examples demonstrate:

1. **Proper error handling** for all API calls
2. **Type safety** using the generated TypeScript interfaces
3. **Batch operations** for performance
4. **Validation** before making API calls
5. **Comprehensive testing** strategies
6. **Real-world usage patterns** for common operations

For more detailed API reference, see:

- [TypeScript Interfaces](./typescript-interfaces.md)
- [Database Schema](./database-schema.md)
- [Database ERD](./database-erd.md)
