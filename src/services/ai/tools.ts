import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Priority, TaskStatus, UpdateTaskRequest } from '../../types';
import {
  getTaskRepository,
  getTimeTrackingRepository,
} from '../database/repositories';

// Tool response interfaces for better type safety
interface TaskResponse {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
}

interface SessionResponse {
  id: string;
  taskId: string;
  startTime: Date;
  isActive: boolean;
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

interface ProductivityInsights {
  mostProductiveTime: { start: string; end: string; dayOfWeek: number };
  leastProductiveTime: { start: string; end: string; dayOfWeek: number };
  averageTaskDuration: number;
  completionRate: number;
  focusEfficiency: number;
}

interface ProductivityAnalysis {
  insights: ProductivityInsights;
  recommendations: string[];
}

/**
 * Create a new task in the system
 */
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: number;
  timeEstimate?: number;
  dueDate?: string;
  tags?: string[];
}

const createTaskTool = tool(
  async (input: CreateTaskInput) => {
    const { title, description, priority, timeEstimate, dueDate, tags } = input;
    try {
      const taskRepo = getTaskRepository();
      const task = await taskRepo.create({
        title,
        description,
        priority: priority ?? Priority.MEDIUM,
        timeEstimate: timeEstimate ?? 60,
        dueDate: dueDate ? new Date(dueDate) : undefined,
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
      tags: z
        .array(z.string())
        .optional()
        .describe('Array of tags for categorization'),
    }),
  }
);

/**
 * Update an existing task
 */
interface UpdateTaskInput {
  taskId: string;
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
    const { taskId, updates } = input;
    try {
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
      const task = await taskRepo.update(taskId, processedUpdates);
      const response: { success: true; task: TaskResponse } = {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'update_task',
    description: 'Update an existing task with new information',
    schema: z.object({
      taskId: z.string().describe('ID of the task to update'),
      updates: z
        .object({
          title: z.string().optional().describe('New task title'),
          description: z.string().optional().describe('New task description'),
          priority: z.number().optional().describe('New priority level'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .optional()
            .describe('New task status'),
          scheduledDate: z
            .string()
            .optional()
            .describe('When the task is scheduled to be worked on'),
        })
        .describe('Object containing the updates to apply'),
    }),
  }
);

/**
 * Get tasks based on filters
 */
interface GetTasksInput {
  filters?: {
    status?: string[];
    priority?: number[];
    tags?: string[];
    search?: string;
  };
}

const getTasksTool = tool(
  async (input: GetTasksInput) => {
    const { filters } = input;
    try {
      const taskRepo = getTaskRepository();
      const processedFilters = filters
        ? {
            ...filters,
            status: filters.status?.map((s: string) => s as TaskStatus),
            priority: filters.priority,
            tags: filters.tags,
            search: filters.search,
          }
        : undefined;

      const tasks = await taskRepo.findAll(processedFilters, undefined);
      const response: {
        success: true;
        tasks: TaskListResponse[];
        count: number;
      } = {
        success: true,
        tasks: tasks.map(
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
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tasks',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'get_tasks',
    description:
      'Retrieve tasks from the system, optionally filtered by status, priority, tags, or search terms',
    schema: z.object({
      filters: z
        .object({
          status: z
            .array(z.string())
            .optional()
            .describe(
              'Filter by task status: pending, in_progress, completed, cancelled'
            ),
          priority: z
            .array(z.number())
            .optional()
            .describe('Filter by priority levels: 0-3'),
          tags: z
            .array(z.string())
            .optional()
            .describe('Filter by specific tags'),
          search: z
            .string()
            .optional()
            .describe('Search in task titles and descriptions'),
        })
        .optional()
        .describe('Filters to apply when retrieving tasks'),
    }),
  }
);

/**
 * Start a timer for a task
 */
interface StartTimerInput {
  taskId: string;
}

const startTimerTool = tool(
  async (input: StartTimerInput) => {
    const { taskId } = input;
    try {
      const timeRepo = getTimeTrackingRepository();
      const session = await timeRepo.startSession(taskId);
      const response: { success: true; session: SessionResponse } = {
        success: true,
        session: {
          id: session.id,
          taskId: session.taskId,
          startTime: session.startTime,
          isActive: session.isActive,
        },
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start timer',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'start_timer',
    description:
      'Start a timer session for tracking time spent on a specific task',
    schema: z.object({
      taskId: z.string().describe('ID of the task to start timing'),
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
 * Analyze productivity patterns
 */
const analyzeProductivityTool = tool(
  async () => {
    try {
      // Generate mock productivity analysis
      const analysis: ProductivityAnalysis = {
        insights: {
          mostProductiveTime: { start: '09:00', end: '11:00', dayOfWeek: 1 },
          leastProductiveTime: { start: '14:00', end: '16:00', dayOfWeek: 5 },
          averageTaskDuration: 45,
          completionRate: 0.75,
          focusEfficiency: 0.82,
        },
        recommendations: [
          'Schedule challenging tasks during your most productive hours (9-11 AM)',
          'Take breaks during low-energy periods to maintain focus',
          'Consider time-boxing tasks to improve completion rates',
        ],
      };

      const response: { success: true; analysis: ProductivityAnalysis } = {
        success: true,
        analysis,
      };
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse: { success: false; error: string } = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze productivity',
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'analyze_productivity',
    description:
      'Analyze productivity patterns and provide insights and recommendations',
    schema: z.object({}),
  }
);

/**
 * Export all KiraPilot tools for the ReAct agent
 */
export function getKiraPilotTools() {
  return [
    createTaskTool,
    updateTaskTool,
    getTasksTool,
    startTimerTool,
    stopTimerTool,
    getTimeDataTool,
    analyzeProductivityTool,
  ];
}
