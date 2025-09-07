import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  Priority,
  TaskStatus,
  UpdateTaskRequest,
  Task,
  RecurrenceType,
  CreatePeriodicTaskRequest,
  UpdatePeriodicTaskRequest,
} from '../../types';
import {
  getTaskRepository,
  getTimeTrackingRepository,
} from '../database/repositories';
import { PeriodicTaskService } from '../database/repositories/PeriodicTaskService';
import { IntelligentTaskMatcher } from './IntelligentTaskMatcher';
import { UserIntent, TaskMatchContext } from '../../types/taskMatching';

// Tool response interfaces for better type safety
interface TaskResponse {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
}

interface StoppedSessionResponse {
  id: string;
  duration: number;
  notes?: string;
}

interface TaskListResponse {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: Date;
  scheduledDate?: Date;
  timeEstimate: number;
  actualTime: number;
  tags: string[];
  description: string;
}

interface TimeDataSession {
  id: string;
  taskId: string;
  duration: number;
  startTime: Date;
  endTime?: Date;
  notes?: string;
}

interface TimeDataResponse {
  totalSessions: number;
  totalTime: number;
  averageSession: number;
  sessions: TimeDataSession[];
}

// Helper class for user-friendly tool operations
class UserFriendlyToolHelper {
  private taskMatcher = new IntelligentTaskMatcher();

  /**
   * Find a task using natural language with user-friendly error handling
   */
  async findTask(
    query: string,
    intent?: UserIntent,
    context?: TaskMatchContext
  ): Promise<{
    success: boolean;
    task?: Task;
    message: string;
    reasoning?: string;
    alternatives?: Array<{ task: Task; confidence: number; reason: string }>;
    needsResolution?: boolean;
  }> {
    try {
      const searchContext: TaskMatchContext = {
        ...context,
        userIntent: intent,
      };

      const matches = await this.taskMatcher.searchTasks(query, searchContext);

      if (matches.length === 0) {
        return {
          success: false,
          message: `I couldn't find any tasks matching "${query}". Would you like me to create a new task with this title?`,
          reasoning: 'No tasks found matching the search criteria',
        };
      }

      // If we have a single high-confidence match
      if (matches.length === 1 && matches[0].confidence >= 80) {
        const match = matches[0];
        return {
          success: true,
          task: match.task,
          message: `Found task: "${match.task.title}"`,
          reasoning: `${match.matchReason} (${match.confidence}% confidence)`,
        };
      }

      // If we have multiple matches or low confidence
      if (matches.length > 1 || matches[0].confidence < 80) {
        return {
          success: true,
          task: matches[0].task, // Return the best match
          message: `I found ${matches.length} possible matches for "${query}". Using the best match: "${matches[0].task.title}"`,
          reasoning: `Best match: ${matches[0].matchReason} (${matches[0].confidence}% confidence)`,
          alternatives: matches.slice(1, 4).map(m => ({
            task: m.task,
            confidence: m.confidence,
            reason: m.matchReason,
          })),
          needsResolution: matches[0].confidence < 70,
        };
      }

      // Single match with good confidence
      const match = matches[0];
      return {
        success: true,
        task: match.task,
        message: `Found task: "${match.task.title}"`,
        reasoning: `${match.matchReason} (${match.confidence}% confidence)`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error searching for tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoning: 'Task search failed due to system error',
      };
    }
  }

  /**
   * Get user-friendly priority label
   */
  getPriorityLabel(priority: number): string {
    switch (priority) {
      case 3:
        return 'Urgent 🔴';
      case 2:
        return 'High 🟠';
      case 1:
        return 'Medium 🟡';
      case 0:
        return 'Low 🟢';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get user-friendly status label
   */
  getStatusLabel(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.PENDING: {
        return 'Pending ⏳';
      }
      case TaskStatus.IN_PROGRESS: {
        return 'In Progress 🔄';
      }
      case TaskStatus.COMPLETED: {
        return 'Completed ✅';
      }
      case TaskStatus.CANCELLED: {
        return 'Cancelled ❌';
      }
      default: {
        return String(status).replace('_', ' ');
      }
    }
  }

  /**
   * Format task details in a user-friendly way
   */
  formatTaskDetails(task: Task): string {
    const details = [
      `📋 **${task.title}**`,
      task.description ? `📝 ${task.description}` : '',
      `📊 Status: ${this.getStatusLabel(task.status)}`,
      `⭐ Priority: ${this.getPriorityLabel(task.priority)}`,
      task.timeEstimate > 0
        ? `⏱️ Estimated time: ${task.timeEstimate} minutes`
        : '',
      task.actualTime > 0
        ? `⏰ Time spent: ${Math.round(task.actualTime / 60)} minutes`
        : '',
      task.tags.length > 0 ? `🏷️ Tags: ${task.tags.join(', ')}` : '',
      task.dueDate
        ? `📅 Due: ${new Date(task.dueDate).toLocaleDateString()}`
        : '',
      task.scheduledDate
        ? `📆 Scheduled: ${new Date(task.scheduledDate).toLocaleDateString()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return details;
  }
}

const toolHelper = new UserFriendlyToolHelper();

/**
 * Create a new task in the system
 */
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: number;
  timeEstimate?: number;
  dueDate?: string;
  scheduledDate?: string;
  tags?: string[];
}

const createTaskTool = tool(
  async (input: CreateTaskInput) => {
    const {
      title,
      description,
      priority,
      timeEstimate,
      dueDate,
      scheduledDate,
      tags,
    } = input;
    try {
      const taskRepo = getTaskRepository();
      const task = await taskRepo.create({
        title,
        description,
        priority: priority ?? Priority.MEDIUM,
        timeEstimate: timeEstimate ?? 60,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        tags: tags ?? [],
      });
      const response: { success: true; task: TaskResponse } = {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          priority: task.priority,
          status: task.status,
        },
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'create_task',
    description:
      'Create a new task in the productivity system with title, description, priority, and other details',
    schema: z.object({
      title: z.string().describe('Task title (required)'),
      description: z.string().optional().describe('Detailed task description'),
      priority: z
        .number()
        .optional()
        .describe('Task priority: 0=Low, 1=Medium, 2=High, 3=Urgent'),
      timeEstimate: z
        .number()
        .optional()
        .describe('Estimated time to complete in minutes'),
      dueDate: z
        .string()
        .optional()
        .describe('Due date in ISO format (YYYY-MM-DD)'),
      scheduledDate: z
        .string()
        .optional()
        .describe(
          'Scheduled date when task should be worked on in ISO format (YYYY-MM-DD)'
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe('Array of tags for categorization'),
    }),
  }
);

/**
 * Update an existing task using natural language to find it
 */
interface UpdateTaskInput {
  taskReference: string;
  updates: {
    title?: string;
    description?: string;
    priority?: number;
    status?: string;
    scheduledDate?: string;
  };
}

const updateTaskTool = tool(
  async (input: UpdateTaskInput) => {
    const { taskReference, updates } = input;
    try {
      // Find the task using natural language
      const findResult = await toolHelper.findTask(
        taskReference,
        UserIntent.EDIT_TASK
      );

      if (!findResult.success || !findResult.task) {
        const errorResponse = {
          success: false,
          error: findResult.message,
          reasoning: findResult.reasoning,
          suggestion:
            'Try being more specific about which task you want to update, or check if the task exists.',
        };
        return JSON.stringify(errorResponse);
      }

      const taskRepo = getTaskRepository();
      const processedUpdates: UpdateTaskRequest = {
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        status: updates.status ? (updates.status as TaskStatus) : undefined,
        scheduledDate: updates.scheduledDate
          ? new Date(updates.scheduledDate)
          : undefined,
      };

      const task = await taskRepo.update(findResult.task.id, processedUpdates);

      // Create user-friendly response
      const changedFields = Object.keys(updates).filter(
        key => updates[key as keyof typeof updates] !== undefined
      );
      const changeDescription = changedFields
        .map(field => {
          switch (field) {
            case 'title':
              return `title to "${updates.title}"`;
            case 'description':
              return `description`;
            case 'priority':
              return `priority to ${toolHelper.getPriorityLabel(updates.priority!)}`;
            case 'status':
              return `status to ${toolHelper.getStatusLabel(updates.status as TaskStatus)}`;
            case 'scheduledDate':
              return `scheduled date to ${new Date(updates.scheduledDate!).toLocaleDateString()}`;
            default:
              return field;
          }
        })
        .join(', ');

      const response = {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
        message: `✅ Updated task "${task.title}" - changed ${changeDescription}`,
        reasoning: findResult.reasoning,
        taskDetails: toolHelper.formatTaskDetails(task),
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
        suggestion: 'Please try again or check if the task exists.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'update_task',
    description:
      'Update an existing task by finding it with natural language description instead of requiring exact task ID. You can change title, description, priority, status, or scheduled date.',
    schema: z.object({
      taskReference: z
        .string()
        .describe(
          'Natural language description of the task to update (e.g., "the email task", "project planning", "buy groceries")'
        ),
      updates: z
        .object({
          title: z.string().optional().describe('New task title'),
          description: z.string().optional().describe('New task description'),
          priority: z
            .number()
            .min(0)
            .max(3)
            .optional()
            .describe('New priority level: 0=Low, 1=Medium, 2=High, 3=Urgent'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .optional()
            .describe('New task status'),
          scheduledDate: z
            .string()
            .optional()
            .describe(
              'When the task is scheduled to be worked on (YYYY-MM-DD format)'
            ),
        })
        .describe('Object containing the updates to apply'),
    }),
  }
);

/**
 * Get tasks with smart filtering and user-friendly descriptions
 */
interface GetTasksInput {
  query?: string;
  filters?: {
    status?: string[];
    priority?: string[];
    tags?: string[];
    dueToday?: boolean;
    scheduledToday?: boolean;
    overdue?: boolean;
  };
  limit?: number;
}

const getTasksTool = tool(
  async (input: GetTasksInput) => {
    const { query, filters, limit = 20 } = input;
    try {
      const taskRepo = getTaskRepository();

      // Convert user-friendly priority names to numbers
      const priorityNumbers = filters?.priority?.map(p => {
        switch (p.toLowerCase()) {
          case 'urgent': {
            return 3;
          }
          case 'high': {
            return 2;
          }
          case 'medium': {
            return 1;
          }
          case 'low': {
            return 0;
          }
          default: {
            return parseInt(p) || 1;
          }
        }
      });

      // Build smart filters
      const processedFilters: {
        status?: TaskStatus[];
        priority?: number[];
        tags?: string[];
        search?: string;
      } = {};

      if (filters?.status) {
        processedFilters.status = filters.status.map(
          (s: string) => s as TaskStatus
        );
      }

      if (priorityNumbers) {
        processedFilters.priority = priorityNumbers;
      }

      if (filters?.tags) {
        processedFilters.tags = filters.tags;
      }

      if (query) {
        processedFilters.search = query;
      }

      let tasks = await taskRepo.findAll(processedFilters, undefined);

      // Apply contextual filters
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (filters?.dueToday) {
        tasks = tasks.filter(task => {
          if (!task.dueDate) {
            return false;
          }
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        });
      }

      if (filters?.scheduledToday) {
        tasks = tasks.filter(task => {
          if (!task.scheduledDate) {
            return false;
          }
          const scheduledDate = new Date(task.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);
          return scheduledDate.getTime() === today.getTime();
        });
      }

      if (filters?.overdue) {
        tasks = tasks.filter(task => {
          if (!task.dueDate || task.status === TaskStatus.COMPLETED) {
            return false;
          }
          return new Date(task.dueDate) < today;
        });
      }

      // Limit results
      const limitedTasks = tasks.slice(0, limit);

      // Create user-friendly summary
      let summary = `Found ${tasks.length} tasks`;
      if (query) {
        summary += ` matching "${query}"`;
      }
      if (filters?.status) {
        summary += ` with status: ${filters.status.join(', ')}`;
      }
      if (filters?.priority) {
        summary += ` with priority: ${filters.priority.join(', ')}`;
      }
      if (filters?.dueToday) {
        summary += ` due today`;
      }
      if (filters?.scheduledToday) {
        summary += ` scheduled for today`;
      }
      if (filters?.overdue) {
        summary += ` that are overdue`;
      }

      const response = {
        success: true,
        tasks: limitedTasks.map(
          (task): TaskListResponse => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            scheduledDate: task.scheduledDate,
            timeEstimate: task.timeEstimate,
            actualTime: task.actualTime,
            tags: task.tags,
            description: task.description,
          })
        ),
        count: tasks.length,
        showing: limitedTasks.length,
        message: summary,
        reasoning: `Retrieved tasks based on your criteria${limit < tasks.length ? ` (showing first ${limit})` : ''}`,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tasks',
        suggestion: 'Please try again with different search criteria.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'get_tasks',
    description:
      "Retrieve and search tasks with smart filtering. Can find tasks by text search, status, priority, due dates, and more. Provides contextual results based on what you're looking for.",
    schema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'Search text to find in task titles and descriptions (e.g., "email", "project", "meeting")'
        ),
      filters: z
        .object({
          status: z
            .array(z.enum(['pending', 'in_progress', 'completed', 'cancelled']))
            .optional()
            .describe('Filter by task status'),
          priority: z
            .array(z.enum(['low', 'medium', 'high', 'urgent']))
            .optional()
            .describe('Filter by priority level using friendly names'),
          tags: z
            .array(z.string())
            .optional()
            .describe('Filter by specific tags'),
          dueToday: z
            .boolean()
            .optional()
            .describe('Show only tasks due today'),
          scheduledToday: z
            .boolean()
            .optional()
            .describe('Show only tasks scheduled for today'),
          overdue: z.boolean().optional().describe('Show only overdue tasks'),
        })
        .optional()
        .describe('Optional filters to narrow down results'),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of tasks to return (default: 20)'),
    }),
  }
);

/**
 * Start a timer for a task using natural language to find it
 */
interface StartTimerInput {
  taskReference: string;
}

const startTimerTool = tool(
  async (input: StartTimerInput) => {
    const { taskReference } = input;
    try {
      // Find the task using natural language
      const findResult = await toolHelper.findTask(
        taskReference,
        UserIntent.START_TIMER
      );

      if (!findResult.success || !findResult.task) {
        const errorResponse = {
          success: false,
          error: findResult.message,
          reasoning: findResult.reasoning,
          suggestion:
            'Try being more specific about which task you want to time, or check if the task exists.',
        };
        return JSON.stringify(errorResponse);
      }

      const timeRepo = getTimeTrackingRepository();
      const session = await timeRepo.startSession(findResult.task.id);

      const response = {
        success: true,
        session: {
          id: session.id,
          taskId: session.taskId,
          startTime: session.startTime,
          isActive: session.isActive,
        },
        message: `⏱️ Started timer for task: "${findResult.task.title}"`,
        reasoning: findResult.reasoning,
        taskDetails: toolHelper.formatTaskDetails(findResult.task),
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start timer',
        suggestion: 'Please try again or check if the task exists.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'start_timer',
    description:
      'Start a timer session for tracking time spent on a task. Find the task using natural language description instead of requiring exact task ID.',
    schema: z.object({
      taskReference: z
        .string()
        .describe(
          'Natural language description of the task to start timing (e.g., "the email task", "project planning", "buy groceries")'
        ),
    }),
  }
);

/**
 * Complete a task using natural language to find it
 */
interface CompleteTaskInput {
  taskReference: string;
  notes?: string;
}

const completeTaskTool = tool(
  async (input: CompleteTaskInput) => {
    const { taskReference, notes } = input;
    try {
      // Find the task using natural language
      const findResult = await toolHelper.findTask(
        taskReference,
        UserIntent.COMPLETE_TASK
      );

      if (!findResult.success || !findResult.task) {
        const errorResponse = {
          success: false,
          error: findResult.message,
          reasoning: findResult.reasoning,
          suggestion:
            'Try being more specific about which task you want to complete, or check if the task exists.',
        };
        return JSON.stringify(errorResponse);
      }

      const taskRepo = getTaskRepository();
      const updates: UpdateTaskRequest = {
        status: TaskStatus.COMPLETED,
      };

      // Add notes to description if provided
      if (notes) {
        const currentDescription = findResult.task.description || '';
        updates.description =
          currentDescription +
          (currentDescription ? '\n\n' : '') +
          `Completion notes: ${notes}`;
      }

      const task = await taskRepo.update(findResult.task.id, updates);

      const response = {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
        message: `🎉 Completed task: "${task.title}"${notes ? ` with notes: "${notes}"` : ''}`,
        reasoning: findResult.reasoning,
        celebration: '🎊 Great job! Another task completed!',
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to complete task',
        suggestion: 'Please try again or check if the task exists.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'complete_task',
    description:
      'Mark a task as completed by finding it with natural language description. Optionally add completion notes.',
    schema: z.object({
      taskReference: z
        .string()
        .describe(
          'Natural language description of the task to complete (e.g., "the email task", "project planning", "buy groceries")'
        ),
      notes: z
        .string()
        .optional()
        .describe('Optional notes about the task completion'),
    }),
  }
);

/**
 * Get task details using natural language to find it
 */
interface GetTaskDetailsInput {
  taskReference: string;
}

const getTaskDetailsTool = tool(
  async (input: GetTaskDetailsInput) => {
    const { taskReference } = input;
    try {
      // Find the task using natural language
      const findResult = await toolHelper.findTask(
        taskReference,
        UserIntent.VIEW_DETAILS
      );

      if (!findResult.success || !findResult.task) {
        const errorResponse = {
          success: false,
          error: findResult.message,
          reasoning: findResult.reasoning,
          suggestion:
            'Try being more specific about which task you want to view, or check if the task exists.',
        };
        return JSON.stringify(errorResponse);
      }

      const task = findResult.task;
      const response = {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          description: task.description,
          tags: task.tags,
          timeEstimate: task.timeEstimate,
          actualTime: task.actualTime,
          dueDate: task.dueDate,
          scheduledDate: task.scheduledDate,
        },
        message: `📋 Task details for: "${task.title}"`,
        reasoning: findResult.reasoning,
        taskDetails: toolHelper.formatTaskDetails(task),
        alternatives: findResult.alternatives,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get task details',
        suggestion: 'Please try again or check if the task exists.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'get_task_details',
    description:
      'Get detailed information about a task by finding it with natural language description instead of requiring exact task ID.',
    schema: z.object({
      taskReference: z
        .string()
        .describe(
          'Natural language description of the task to view (e.g., "the email task", "project planning", "buy groceries")'
        ),
    }),
  }
);

/**
 * Stop the current timer
 */
interface StopTimerInput {
  sessionId: string;
  notes?: string;
}

const stopTimerTool = tool(
  async (input: StopTimerInput) => {
    const { sessionId, notes } = input;
    try {
      const timeRepo = getTimeTrackingRepository();
      const session = await timeRepo.stopSession(sessionId, notes);
      const response: { success: true; session: StoppedSessionResponse } = {
        success: true,
        session: {
          id: session.id,
          duration: session.duration,
          notes: session.notes,
        },
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop timer',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'stop_timer',
    description: 'Stop the current timer session and optionally add notes',
    schema: z.object({
      sessionId: z.string().describe('ID of the session to stop'),
      notes: z
        .string()
        .optional()
        .describe('Optional notes about the work session'),
    }),
  }
);

/**
 * Get time tracking data for analysis
 */
interface GetTimeDataInput {
  startDate: string;
  endDate: string;
}

const getTimeDataTool = tool(
  async (input: GetTimeDataInput) => {
    const { startDate, endDate } = input;
    try {
      const timeRepo = getTimeTrackingRepository();
      const sessions = await timeRepo.getByDateRange(
        new Date(startDate),
        new Date(endDate)
      );

      interface SessionData {
        id: string;
        taskId: string;
        startTime: Date;
        endTime?: Date;
        notes?: string;
      }

      const totalTime = sessions.reduce((sum: number, session: SessionData) => {
        if (session.endTime) {
          return (
            sum + (session.endTime.getTime() - session.startTime.getTime())
          );
        }
        return sum;
      }, 0);

      const avgSession = sessions.length > 0 ? totalTime / sessions.length : 0;

      const response: { success: true; timeData: TimeDataResponse } = {
        success: true,
        timeData: {
          totalSessions: sessions.length,
          totalTime: totalTime,
          averageSession: avgSession,
          sessions: sessions.map(
            (s: SessionData): TimeDataSession => ({
              id: s.id,
              taskId: s.taskId,
              duration: s.endTime
                ? s.endTime.getTime() - s.startTime.getTime()
                : 0,
              startTime: s.startTime,
              endTime: s.endTime,
              notes: s.notes,
            })
          ),
        },
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get time data',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'get_time_data',
    description:
      'Retrieve time tracking data and statistics for a specific date range',
    schema: z.object({
      startDate: z
        .string()
        .describe('Start date for the time data range (ISO format)'),
      endDate: z
        .string()
        .describe('End date for the time data range (ISO format)'),
    }),
  }
);

/**
 * Analyze productivity patterns with personalized insights
 */
interface AnalyzeProductivityInput {
  timeframe?: string;
  focusArea?: string;
}

const analyzeProductivityTool = tool(
  async (input: AnalyzeProductivityInput) => {
    const { timeframe = 'week', focusArea } = input;
    try {
      // Get actual task and time data for analysis
      const taskRepo = getTaskRepository();
      const timeRepo = getTimeTrackingRepository();

      // Calculate date range based on timeframe
      const endDate = new Date();
      const startDate = new Date();
      switch (timeframe) {
        case 'day': {
          startDate.setDate(startDate.getDate() - 1);
          break;
        }
        case 'week': {
          startDate.setDate(startDate.getDate() - 7);
          break;
        }
        case 'month': {
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        }
        default: {
          startDate.setDate(startDate.getDate() - 7);
        }
      }

      // Get tasks and sessions for analysis
      const allTasks = await taskRepo.findAll();
      const sessions = await timeRepo.getByDateRange(startDate, endDate);

      // Calculate completion rate
      const completedTasks = allTasks.filter(
        t => t.status === TaskStatus.COMPLETED
      );
      const completionRate =
        allTasks.length > 0 ? completedTasks.length / allTasks.length : 0;

      // Calculate average task duration from sessions
      const totalTime = sessions.reduce(
        (sum: number, session: { endTime?: Date; startTime: Date }) => {
          if (session.endTime) {
            return (
              sum +
              (new Date(session.endTime).getTime() -
                new Date(session.startTime).getTime())
            );
          }
          return sum;
        },
        0
      );
      const averageSessionMinutes =
        sessions.length > 0
          ? Math.round(totalTime / (sessions.length * 60000))
          : 0;

      // Generate insights based on focus area
      let focusInsights: string[] = [];
      let recommendations: string[] = [];

      if (focusArea === 'time_management') {
        focusInsights = [
          `⏰ You've completed ${completedTasks.length} tasks in the last ${timeframe}`,
          `📊 Your average work session is ${averageSessionMinutes} minutes`,
          `✅ Task completion rate: ${Math.round(completionRate * 100)}%`,
        ];
        recommendations = [
          'Try the Pomodoro technique with 25-minute focused sessions',
          'Schedule your most important tasks during your peak energy hours',
          'Break large tasks into smaller, manageable chunks',
        ];
      } else if (focusArea === 'task_completion') {
        focusInsights = [
          `🎯 You completed ${completedTasks.length} out of ${allTasks.length} tasks`,
          `📈 Completion rate: ${Math.round(completionRate * 100)}%`,
          `⚡ Most productive with ${averageSessionMinutes}-minute sessions`,
        ];
        recommendations = [
          completionRate < 0.7
            ? 'Consider setting more realistic task estimates'
            : 'Great job on task completion!',
          'Review and prioritize your task list regularly',
          'Celebrate small wins to maintain motivation',
        ];
      } else {
        // General analysis
        focusInsights = [
          `📋 ${allTasks.length} total tasks, ${completedTasks.length} completed`,
          `⏱️ ${sessions.length} work sessions tracked`,
          `📊 ${Math.round(completionRate * 100)}% completion rate`,
          `⚡ Average session: ${averageSessionMinutes} minutes`,
        ];
        recommendations = [
          completionRate > 0.8
            ? '🎉 Excellent productivity! Keep up the great work!'
            : '💪 Room for improvement - try breaking tasks into smaller pieces',
          averageSessionMinutes > 60
            ? '🧠 Consider shorter, more focused work sessions'
            : '⚡ Your session length looks good for maintaining focus',
          '📅 Schedule regular reviews to adjust your approach',
        ];
      }

      const analysis = {
        timeframe,
        focusArea: focusArea || 'general',
        insights: focusInsights,
        recommendations,
        stats: {
          totalTasks: allTasks.length,
          completedTasks: completedTasks.length,
          completionRate: Math.round(completionRate * 100),
          totalSessions: sessions.length,
          averageSessionMinutes,
        },
      };

      const response = {
        success: true,
        analysis,
        message: `📊 Productivity analysis for the last ${timeframe}${focusArea ? ` (focusing on ${focusArea.replace('_', ' ')})` : ''}`,
        reasoning: `Analyzed ${allTasks.length} tasks and ${sessions.length} work sessions to provide personalized insights`,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze productivity',
        suggestion:
          'Please try again or check if you have any tasks and time tracking data.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'analyze_productivity',
    description:
      'Analyze your productivity patterns and get personalized insights and recommendations based on your actual task and time tracking data.',
    schema: z.object({
      timeframe: z
        .enum(['day', 'week', 'month'])
        .optional()
        .default('week')
        .describe('Time period to analyze (default: week)'),
      focusArea: z
        .enum(['time_management', 'task_completion', 'general'])
        .optional()
        .describe('Specific area to focus the analysis on'),
    }),
  }
);

/**
 * Create a periodic task template for recurring tasks
 */
interface CreatePeriodicTaskInput {
  title: string;
  description?: string;
  priority?: number;
  timeEstimate?: number;
  tags?: string[];
  recurrenceType: string;
  recurrenceInterval?: number;
  recurrenceUnit?: string;
  startDate: string;
}

const createPeriodicTaskTool = tool(
  async (input: CreatePeriodicTaskInput) => {
    const {
      title,
      description,
      priority,
      timeEstimate,
      tags,
      recurrenceType,
      recurrenceInterval,
      recurrenceUnit,
      startDate,
    } = input;
    try {
      const periodicService = new PeriodicTaskService();

      // Validate and convert recurrence type
      const validRecurrenceTypes = Object.values(RecurrenceType);
      if (!validRecurrenceTypes.includes(recurrenceType as RecurrenceType)) {
        throw new Error(
          `Invalid recurrence type. Must be one of: ${validRecurrenceTypes.join(', ')}`
        );
      }

      const request: CreatePeriodicTaskRequest = {
        title,
        description,
        priority: priority ?? Priority.MEDIUM,
        timeEstimate: timeEstimate ?? 60,
        tags: tags ?? [],
        recurrenceType: recurrenceType as RecurrenceType,
        recurrenceInterval: recurrenceInterval ?? 1,
        recurrenceUnit: recurrenceUnit as
          | 'days'
          | 'weeks'
          | 'months'
          | undefined,
        startDate: new Date(startDate),
      };

      const template = await periodicService.createTemplate(request);

      // Calculate user-friendly recurrence description
      let recurrenceDescription = '';
      switch (template.recurrenceType) {
        case RecurrenceType.DAILY:
          recurrenceDescription =
            template.recurrenceInterval === 1
              ? 'daily'
              : `every ${template.recurrenceInterval} days`;
          break;
        case RecurrenceType.WEEKLY:
          recurrenceDescription =
            template.recurrenceInterval === 1
              ? 'weekly'
              : `every ${template.recurrenceInterval} weeks`;
          break;
        case RecurrenceType.BIWEEKLY:
          recurrenceDescription = 'every 2 weeks';
          break;
        case RecurrenceType.EVERY_THREE_WEEKS:
          recurrenceDescription = 'every 3 weeks';
          break;
        case RecurrenceType.MONTHLY:
          recurrenceDescription =
            template.recurrenceInterval === 1
              ? 'monthly'
              : `every ${template.recurrenceInterval} months`;
          break;
        case RecurrenceType.CUSTOM:
          recurrenceDescription = `every ${template.recurrenceInterval} ${template.recurrenceUnit}`;
          break;
      }

      const response = {
        success: true,
        template: {
          id: template.id,
          title: template.title,
          recurrenceType: template.recurrenceType,
          recurrenceDescription,
          nextGenerationDate: template.nextGenerationDate,
          isActive: template.isActive,
        },
        message: `🔄 Created periodic task template: "${template.title}" (${recurrenceDescription})`,
        reasoning: `Set up recurring task that will generate new instances ${recurrenceDescription}`,
        nextInstance: `Next task will be generated on ${template.nextGenerationDate.toLocaleDateString()}`,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create periodic task',
        suggestion:
          'Check the recurrence pattern and start date. Valid recurrence types are: daily, weekly, biweekly, every_three_weeks, monthly, custom',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'create_periodic_task',
    description:
      'Create a recurring task template that automatically generates new task instances based on a schedule. Perfect for habits, routines, and regular responsibilities.',
    schema: z.object({
      title: z.string().describe('Title for the recurring task'),
      description: z
        .string()
        .optional()
        .describe('Detailed description of the recurring task'),
      priority: z
        .number()
        .min(0)
        .max(3)
        .optional()
        .describe('Task priority: 0=Low, 1=Medium, 2=High, 3=Urgent'),
      timeEstimate: z
        .number()
        .optional()
        .describe('Estimated time to complete each instance in minutes'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Array of tags for categorization'),
      recurrenceType: z
        .enum([
          'daily',
          'weekly',
          'biweekly',
          'every_three_weeks',
          'monthly',
          'custom',
        ])
        .describe('How often the task should repeat'),
      recurrenceInterval: z
        .number()
        .optional()
        .describe(
          'For custom recurrence: how many units between repetitions (e.g., 2 for every 2 weeks)'
        ),
      recurrenceUnit: z
        .enum(['days', 'weeks', 'months'])
        .optional()
        .describe(
          'For custom recurrence: the unit of time (days, weeks, or months)'
        ),
      startDate: z
        .string()
        .describe(
          'When to start generating instances (ISO date format: YYYY-MM-DD)'
        ),
    }),
  }
);

/**
 * Get periodic task templates and their status
 */
interface GetPeriodicTasksInput {
  activeOnly?: boolean;
  includeInstances?: boolean;
}

const getPeriodicTasksTool = tool(
  async (input: GetPeriodicTasksInput) => {
    const { activeOnly = false, includeInstances = false } = input;
    try {
      const periodicService = new PeriodicTaskService();

      const templates = activeOnly
        ? await periodicService.findActiveTemplates()
        : await periodicService.findAllTemplates();

      const templatesWithDetails = await Promise.all(
        templates.map(async template => {
          let instanceCount = 0;
          let recentInstances: Task[] = [];

          if (includeInstances) {
            const instancesResponse =
              await periodicService.getTemplateInstances(template.id);
            instanceCount = instancesResponse.totalCount;
            recentInstances = instancesResponse.instances.slice(0, 3); // Show last 3 instances
          } else {
            instanceCount = await periodicService.countTemplateInstances(
              template.id
            );
          }

          // Calculate user-friendly recurrence description
          let recurrenceDescription = '';
          switch (template.recurrenceType) {
            case RecurrenceType.DAILY:
              recurrenceDescription =
                template.recurrenceInterval === 1
                  ? 'daily'
                  : `every ${template.recurrenceInterval} days`;
              break;
            case RecurrenceType.WEEKLY:
              recurrenceDescription =
                template.recurrenceInterval === 1
                  ? 'weekly'
                  : `every ${template.recurrenceInterval} weeks`;
              break;
            case RecurrenceType.BIWEEKLY:
              recurrenceDescription = 'every 2 weeks';
              break;
            case RecurrenceType.EVERY_THREE_WEEKS:
              recurrenceDescription = 'every 3 weeks';
              break;
            case RecurrenceType.MONTHLY:
              recurrenceDescription =
                template.recurrenceInterval === 1
                  ? 'monthly'
                  : `every ${template.recurrenceInterval} months`;
              break;
            case RecurrenceType.CUSTOM:
              recurrenceDescription = `every ${template.recurrenceInterval} ${template.recurrenceUnit}`;
              break;
          }

          return {
            id: template.id,
            title: template.title,
            description: template.description,
            priority: toolHelper.getPriorityLabel(template.priority),
            recurrenceType: template.recurrenceType,
            recurrenceDescription,
            nextGenerationDate: template.nextGenerationDate,
            isActive: template.isActive,
            instanceCount,
            recentInstances: includeInstances
              ? recentInstances.map(instance => ({
                  id: instance.id,
                  title: instance.title,
                  status: instance.status,
                  generationDate: instance.generationDate,
                  completedAt: instance.completedAt,
                }))
              : undefined,
          };
        })
      );

      const activeCount = templatesWithDetails.filter(t => t.isActive).length;
      const totalInstances = templatesWithDetails.reduce(
        (sum, t) => sum + t.instanceCount,
        0
      );

      const response = {
        success: true,
        templates: templatesWithDetails,
        summary: {
          totalTemplates: templatesWithDetails.length,
          activeTemplates: activeCount,
          totalInstances,
        },
        message: `🔄 Found ${templatesWithDetails.length} periodic task templates (${activeCount} active)`,
        reasoning: `Retrieved ${activeOnly ? 'active' : 'all'} periodic task templates${includeInstances ? ' with instance details' : ''}`,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get periodic tasks',
        suggestion:
          'Please try again or check if you have any periodic tasks set up.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'get_periodic_tasks',
    description:
      'Get all periodic task templates and their status. Shows recurring task patterns, next generation dates, and instance counts.',
    schema: z.object({
      activeOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe('Show only active templates (default: false, shows all)'),
      includeInstances: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Include recent task instances for each template (default: false)'
        ),
    }),
  }
);

/**
 * Update a periodic task template
 */
interface UpdatePeriodicTaskInput {
  templateReference: string;
  updates: {
    title?: string;
    description?: string;
    priority?: number;
    recurrenceType?: string;
    recurrenceInterval?: number;
    recurrenceUnit?: string;
    isActive?: boolean;
  };
}

const updatePeriodicTaskTool = tool(
  async (input: UpdatePeriodicTaskInput) => {
    const { templateReference, updates } = input;
    try {
      const periodicService = new PeriodicTaskService();

      // Find template by title or ID
      const templates = await periodicService.findAllTemplates();
      const template = templates.find(
        t =>
          t.id === templateReference ||
          t.title.toLowerCase().includes(templateReference.toLowerCase())
      );

      if (!template) {
        const errorResponse = {
          success: false,
          error: `Could not find periodic task template matching "${templateReference}"`,
          suggestion:
            'Try being more specific about which periodic task you want to update, or use the exact template title.',
          availableTemplates: templates.map(t => ({
            id: t.id,
            title: t.title,
          })),
        };
        return JSON.stringify(errorResponse);
      }

      // Validate recurrence type if provided
      if (updates.recurrenceType) {
        const validRecurrenceTypes = Object.values(RecurrenceType);
        if (
          !validRecurrenceTypes.includes(
            updates.recurrenceType as RecurrenceType
          )
        ) {
          throw new Error(
            `Invalid recurrence type. Must be one of: ${validRecurrenceTypes.join(', ')}`
          );
        }
      }

      const updateRequest: UpdatePeriodicTaskRequest = {
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        recurrenceType: updates.recurrenceType as RecurrenceType | undefined,
        recurrenceInterval: updates.recurrenceInterval,
        recurrenceUnit: updates.recurrenceUnit as
          | 'days'
          | 'weeks'
          | 'months'
          | undefined,
        isActive: updates.isActive,
      };

      const updatedTemplate = await periodicService.updateTemplate(
        template.id,
        updateRequest
      );

      // Create user-friendly response
      const changedFields = Object.keys(updates).filter(
        key => updates[key as keyof typeof updates] !== undefined
      );
      const changeDescription = changedFields
        .map(field => {
          switch (field) {
            case 'title':
              return `title to "${updates.title}"`;
            case 'description':
              return 'description';
            case 'priority':
              return `priority to ${toolHelper.getPriorityLabel(updates.priority!)}`;
            case 'recurrenceType':
              return `recurrence to ${updates.recurrenceType}`;
            case 'isActive':
              return updates.isActive ? 'activated' : 'paused';
            default:
              return field;
          }
        })
        .join(', ');

      const response = {
        success: true,
        template: {
          id: updatedTemplate.id,
          title: updatedTemplate.title,
          recurrenceType: updatedTemplate.recurrenceType,
          isActive: updatedTemplate.isActive,
          nextGenerationDate: updatedTemplate.nextGenerationDate,
        },
        message: `✅ Updated periodic task template "${updatedTemplate.title}" - changed ${changeDescription}`,
        reasoning: `Successfully modified the recurring task template`,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update periodic task',
        suggestion:
          'Please check the template reference and update parameters.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'update_periodic_task',
    description:
      'Update an existing periodic task template. You can change the title, description, priority, recurrence pattern, or pause/resume the template.',
    schema: z.object({
      templateReference: z
        .string()
        .describe(
          'Natural language description or exact title of the periodic task template to update'
        ),
      updates: z
        .object({
          title: z.string().optional().describe('New title for the template'),
          description: z.string().optional().describe('New description'),
          priority: z
            .number()
            .min(0)
            .max(3)
            .optional()
            .describe('New priority level: 0=Low, 1=Medium, 2=High, 3=Urgent'),
          recurrenceType: z
            .enum([
              'daily',
              'weekly',
              'biweekly',
              'every_three_weeks',
              'monthly',
              'custom',
            ])
            .optional()
            .describe('New recurrence pattern'),
          recurrenceInterval: z
            .number()
            .optional()
            .describe(
              'For custom recurrence: new interval between repetitions'
            ),
          recurrenceUnit: z
            .enum(['days', 'weeks', 'months'])
            .optional()
            .describe('For custom recurrence: new unit of time'),
          isActive: z
            .boolean()
            .optional()
            .describe(
              'Whether the template should be active (true) or paused (false)'
            ),
        })
        .describe('Object containing the updates to apply'),
    }),
  }
);

/**
 * Generate instances from periodic task templates
 */
interface GeneratePeriodicInstancesInput {
  templateReference?: string;
  checkAll?: boolean;
}

const generatePeriodicInstancesTool = tool(
  async (input: GeneratePeriodicInstancesInput) => {
    const { templateReference, checkAll = false } = input;
    try {
      const periodicService = new PeriodicTaskService();

      if (templateReference && !checkAll) {
        // Generate from specific template
        const templates = await periodicService.findAllTemplates();
        const template = templates.find(
          t =>
            t.id === templateReference ||
            t.title.toLowerCase().includes(templateReference.toLowerCase())
        );

        if (!template) {
          const errorResponse = {
            success: false,
            error: `Could not find periodic task template matching "${templateReference}"`,
            suggestion:
              'Try being more specific about which periodic task template you want to generate from.',
            availableTemplates: templates.map(t => ({
              id: t.id,
              title: t.title,
            })),
          };
          return JSON.stringify(errorResponse);
        }

        const generatedTask =
          await periodicService.generateInstanceFromTemplate(template.id);

        const response = {
          success: true,
          generatedInstances: [generatedTask],
          message: `✨ Generated new task instance: "${generatedTask.title}" from template "${template.title}"`,
          reasoning: `Created a new task instance from the periodic task template`,
          taskDetails: toolHelper.formatTaskDetails(generatedTask),
        };
        return JSON.stringify(response);
      } else {
        // Check and generate all pending instances
        const result = checkAll
          ? await periodicService.checkAndGenerateInstances()
          : await periodicService.generatePendingInstances();

        const response = {
          success: true,
          generatedInstances: result.generatedInstances,
          totalGenerated: result.totalGenerated,
          updatedTemplates: result.updatedTemplates.length,
          message:
            result.totalGenerated > 0
              ? `✨ Generated ${result.totalGenerated} new task instances from periodic templates`
              : '✅ No new task instances needed at this time',
          reasoning: `Checked all active periodic task templates and generated instances as needed`,
          instanceTitles: result.generatedInstances.map(task => task.title),
        };
        return JSON.stringify(response);
      }
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate periodic task instances',
        suggestion:
          'Please try again or check if you have active periodic task templates.',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'generate_periodic_instances',
    description:
      'Generate new task instances from periodic task templates. Can generate from a specific template or check all templates for pending instances.',
    schema: z.object({
      templateReference: z
        .string()
        .optional()
        .describe(
          'Specific periodic task template to generate from (by title or ID)'
        ),
      checkAll: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Check all templates and generate any pending instances (default: false)'
        ),
    }),
  }
);

/**
 * Suggest recurrence patterns based on natural language input
 */
interface SuggestRecurrenceInput {
  description: string;
}

const suggestRecurrenceTool = tool(
  async (input: SuggestRecurrenceInput) => {
    const { description } = input;
    try {
      const lowerDesc = description.toLowerCase();

      // Pattern matching for common recurrence descriptions
      const suggestions: Array<{
        recurrenceType: RecurrenceType;
        recurrenceInterval?: number;
        recurrenceUnit?: 'days' | 'weeks' | 'months';
        description: string;
        confidence: number;
        reasoning: string;
      }> = [];

      // Daily patterns
      if (
        lowerDesc.includes('every day') ||
        lowerDesc.includes('daily') ||
        lowerDesc.includes('each day')
      ) {
        suggestions.push({
          recurrenceType: RecurrenceType.DAILY,
          description: 'Daily (every day)',
          confidence: 95,
          reasoning: 'Detected daily frequency keywords',
        });
      }

      // Weekly patterns
      if (
        lowerDesc.includes('every week') ||
        lowerDesc.includes('weekly') ||
        lowerDesc.includes('each week')
      ) {
        suggestions.push({
          recurrenceType: RecurrenceType.WEEKLY,
          description: 'Weekly (every 7 days)',
          confidence: 95,
          reasoning: 'Detected weekly frequency keywords',
        });
      }

      // Biweekly patterns
      if (
        lowerDesc.includes('biweekly') ||
        lowerDesc.includes('bi-weekly') ||
        lowerDesc.includes('every two weeks') ||
        lowerDesc.includes('every 2 weeks')
      ) {
        suggestions.push({
          recurrenceType: RecurrenceType.BIWEEKLY,
          description: 'Biweekly (every 2 weeks)',
          confidence: 95,
          reasoning: 'Detected biweekly frequency keywords',
        });
      }

      // Every 3 weeks
      if (
        lowerDesc.includes('every three weeks') ||
        lowerDesc.includes('every 3 weeks')
      ) {
        suggestions.push({
          recurrenceType: RecurrenceType.EVERY_THREE_WEEKS,
          description: 'Every 3 weeks',
          confidence: 95,
          reasoning: 'Detected three-week frequency keywords',
        });
      }

      // Monthly patterns
      if (
        lowerDesc.includes('monthly') ||
        lowerDesc.includes('every month') ||
        lowerDesc.includes('each month')
      ) {
        suggestions.push({
          recurrenceType: RecurrenceType.MONTHLY,
          description: 'Monthly (every month)',
          confidence: 95,
          reasoning: 'Detected monthly frequency keywords',
        });
      }

      // Custom patterns with numbers
      const numberMatches = lowerDesc.match(/every (\d+) (day|week|month)s?/);
      if (numberMatches) {
        const interval = parseInt(numberMatches[1]);
        const unit = (numberMatches[2] + 's') as 'days' | 'weeks' | 'months';
        suggestions.push({
          recurrenceType: RecurrenceType.CUSTOM,
          recurrenceInterval: interval,
          recurrenceUnit: unit,
          description: `Every ${interval} ${unit}`,
          confidence: 90,
          reasoning: `Detected custom interval: ${interval} ${unit}`,
        });
      }

      // Contextual suggestions based on task type
      if (
        lowerDesc.includes('workout') ||
        lowerDesc.includes('exercise') ||
        lowerDesc.includes('gym')
      ) {
        if (!suggestions.some(s => s.recurrenceType === RecurrenceType.DAILY)) {
          suggestions.push({
            recurrenceType: RecurrenceType.CUSTOM,
            recurrenceInterval: 3,
            recurrenceUnit: 'days',
            description: 'Every 3 days (common for workouts)',
            confidence: 70,
            reasoning:
              'Exercise tasks often benefit from rest days between sessions',
          });
        }
      }

      if (
        lowerDesc.includes('review') ||
        lowerDesc.includes('check') ||
        lowerDesc.includes('report')
      ) {
        if (
          !suggestions.some(s => s.recurrenceType === RecurrenceType.WEEKLY)
        ) {
          suggestions.push({
            recurrenceType: RecurrenceType.WEEKLY,
            description: 'Weekly (good for reviews and reports)',
            confidence: 75,
            reasoning: 'Review and reporting tasks are commonly done weekly',
          });
        }
      }

      if (
        lowerDesc.includes('clean') ||
        lowerDesc.includes('maintenance') ||
        lowerDesc.includes('backup')
      ) {
        if (
          !suggestions.some(s => s.recurrenceType === RecurrenceType.WEEKLY)
        ) {
          suggestions.push({
            recurrenceType: RecurrenceType.WEEKLY,
            description: 'Weekly (good for maintenance tasks)',
            confidence: 75,
            reasoning: 'Cleaning and maintenance tasks are often done weekly',
          });
        }
      }

      // Default suggestions if no patterns found
      if (suggestions.length === 0) {
        suggestions.push(
          {
            recurrenceType: RecurrenceType.DAILY,
            description: 'Daily (every day)',
            confidence: 50,
            reasoning: 'Default suggestion for habit-forming tasks',
          },
          {
            recurrenceType: RecurrenceType.WEEKLY,
            description: 'Weekly (every 7 days)',
            confidence: 60,
            reasoning: 'Most common recurrence pattern for regular tasks',
          },
          {
            recurrenceType: RecurrenceType.MONTHLY,
            description: 'Monthly (every month)',
            confidence: 40,
            reasoning: 'Good for less frequent recurring tasks',
          }
        );
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      const response = {
        success: true,
        suggestions: suggestions.slice(0, 5), // Top 5 suggestions
        message: `🔄 Found ${suggestions.length} recurrence pattern suggestions for: "${description}"`,
        reasoning:
          'Analyzed the task description and provided recurrence pattern recommendations',
        topSuggestion: suggestions[0],
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to suggest recurrence patterns',
        suggestion:
          'Try describing when you want the task to repeat (e.g., "every day", "weekly", "monthly")',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'suggest_recurrence',
    description:
      'Analyze a task description and suggest appropriate recurrence patterns for creating periodic tasks. Helps users choose the right schedule for recurring tasks.',
    schema: z.object({
      description: z
        .string()
        .describe(
          'Description of the task or how often it should repeat (e.g., "daily workout", "weekly team meeting", "monthly report")'
        ),
    }),
  }
);

/**
 * Get help and explanations about available AI tools and features
 */
interface GetHelpInput {
  topic?: string;
}

const getHelpTool = tool(
  async (input: GetHelpInput) => {
    const { topic } = input;

    const helpTopics = {
      tasks: {
        title: '📋 Task Management Help',
        content: [
          '**Creating Tasks**: Just say "create a task called [name]" or "add [task name] to my list"',
          '**Finding Tasks**: Use natural language like "show me the email task" or "find project planning"',
          '**Updating Tasks**: Say "update the [task name]" and specify what to change',
          '**Completing Tasks**: Simply say "complete [task name]" or "mark [task] as done"',
          '**Task Details**: Ask "show me details for [task name]" to see full information',
        ],
      },
      periodic: {
        title: '🔄 Periodic Tasks Help',
        content: [
          '**Creating Recurring Tasks**: Say "create a periodic task for [description]" or "set up a recurring [task]"',
          '**Recurrence Patterns**: Use daily, weekly, biweekly, monthly, or custom intervals like "every 3 days"',
          '**Managing Templates**: View with "show periodic tasks", update with "update periodic task [name]"',
          '**Generating Instances**: Say "generate periodic instances" to create pending tasks',
          '**Pattern Suggestions**: Ask "suggest recurrence for [description]" for smart recommendations',
        ],
      },
      timer: {
        title: '⏱️ Time Tracking Help',
        content: [
          '**Starting Timer**: Say "start timer for [task name]" - I\'ll find the task automatically',
          '**Stopping Timer**: Use "stop timer" or "stop the current session"',
          '**Adding Notes**: When stopping, you can add notes about what you accomplished',
          '**Time Reports**: Ask for "time data" or "productivity analysis" to see your patterns',
        ],
      },
      search: {
        title: '🔍 Finding Things Help',
        content: [
          '**Smart Search**: I can find tasks even with partial names or descriptions',
          '**Filters**: Ask for "urgent tasks", "tasks due today", or "completed tasks"',
          '**Tags**: Search by tags like "show me work tasks" or "personal tasks"',
          '**Status**: Find tasks by status: "pending tasks", "in progress tasks"',
        ],
      },
      productivity: {
        title: '📊 Productivity Features Help',
        content: [
          '**Analysis**: Ask for "productivity analysis" to see your patterns',
          '**Insights**: Get personalized recommendations based on your work habits',
          '**Time Tracking**: See how long tasks actually take vs. estimates',
          "**Completion Rates**: Track how well you're completing your planned tasks",
        ],
      },
      general: {
        title: '🤖 AI Assistant Help',
        content: [
          '**Natural Language**: Talk to me naturally - no need for exact commands',
          "**Context Aware**: I remember what we're working on and can make smart suggestions",
          "**Helpful Errors**: If I can't find something, I'll suggest alternatives",
          "**Explanations**: I always explain what I'm doing and why",
          "**Confirmation**: For important actions, I'll ask for confirmation first",
        ],
      },
    };

    if (topic && helpTopics[topic as keyof typeof helpTopics]) {
      const helpInfo = helpTopics[topic as keyof typeof helpTopics];
      const response = {
        success: true,
        message: helpInfo.title,
        content: helpInfo.content.join('\n\n'),
        reasoning: `Provided help information for ${topic}`,
      };
      return JSON.stringify(response);
    }

    // General help
    const allTopics = Object.keys(helpTopics);
    const response = {
      success: true,
      message: '🤖 KiraPilot AI Assistant Help',
      content: [
        '**Available Help Topics:**',
        '• `tasks` - Task management and operations',
        '• `periodic` - Recurring task templates and automation',
        '• `timer` - Time tracking and sessions',
        '• `search` - Finding and filtering tasks',
        '• `productivity` - Analytics and insights',
        '• `general` - AI assistant features',
        '',
        '**Quick Tips:**',
        '• Use natural language - no need for exact commands',
        '• I can find tasks by partial names or descriptions',
        '• Ask for help on specific topics: "help with periodic tasks"',
        "• I always explain what I'm doing and provide reasoning",
        '',
        '**Examples:**',
        '• "Create a task to review the quarterly report"',
        '• "Set up a daily workout reminder"',
        '• "Start timer for the email task"',
        '• "Show me urgent tasks due today"',
        '• "Generate periodic task instances"',
        '• "How productive was I this week?"',
      ].join('\n'),
      availableTopics: allTopics,
      reasoning:
        'Provided general help and overview of AI assistant capabilities',
    };
    return JSON.stringify(response);
  },
  {
    name: 'get_help',
    description:
      'Get help and explanations about AI assistant features, task management, periodic tasks, time tracking, and how to use natural language commands effectively.',
    schema: z.object({
      topic: z
        .enum([
          'tasks',
          'periodic',
          'timer',
          'search',
          'productivity',
          'general',
        ])
        .optional()
        .describe('Specific help topic to get information about'),
    }),
  }
);

/**
 * Export all KiraPilot tools for the ReAct agent
 * These tools are designed to be user-friendly with natural language task matching,
 * contextual parameter inference, and helpful explanations.
 */
export function getKiraPilotTools() {
  return [
    createTaskTool,
    updateTaskTool,
    completeTaskTool,
    getTaskDetailsTool,
    getTasksTool,
    startTimerTool,
    stopTimerTool,
    getTimeDataTool,
    analyzeProductivityTool,
    createPeriodicTaskTool,
    getPeriodicTasksTool,
    updatePeriodicTaskTool,
    generatePeriodicInstancesTool,
    suggestRecurrenceTool,
    getHelpTool,
  ];
}

// Export the helper for use in other parts of the application
export { UserFriendlyToolHelper, toolHelper };
