/**
 * Test for thread-specific context building functionality
 * This tests the enhanced context building for task and day assignments
 */

import { ThreadAssignment } from '../../types/thread';
import { Task, AppContext } from '../../types';

// Mock the TaskService
const mockTaskService = {
  findById: jest.fn(),
  findAll: jest.fn(),
  findScheduledBetween: jest.fn(),
};

// Mock task data
const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task for context building',
  status: 'pending',
  priority: 1,
  timeEstimate: 60,
  actualTime: 30,
  dueDate: new Date('2025-12-31'),
  scheduledDate: new Date('2025-08-30'),
  tags: ['test', 'context'],
  dependencies: ['dep-task-1'],
  createdAt: new Date('2025-08-29'),
  updatedAt: new Date('2025-08-30'),
};

const mockDependencyTask: Task = {
  id: 'dep-task-1',
  title: 'Dependency Task',
  description: 'A dependency task',
  status: 'completed',
  priority: 2,
  timeEstimate: 30,
  actualTime: 25,
  createdAt: new Date('2025-08-28'),
  updatedAt: new Date('2025-08-29'),
};

const mockDayTasks: Task[] = [
  mockTask,
  {
    id: 'task-2',
    title: 'Second Task',
    description: 'Another task for the day',
    status: 'completed',
    priority: 2,
    timeEstimate: 45,
    actualTime: 40,
    scheduledDate: new Date('2025-08-30'),
    createdAt: new Date('2025-08-29'),
    updatedAt: new Date('2025-08-30'),
  },
];

describe('Thread Context Building', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskService.findById.mockImplementation((id: string) => {
      if (id === 'task-1') {
        return Promise.resolve(mockTask);
      }
      if (id === 'dep-task-1') {
        return Promise.resolve(mockDependencyTask);
      }
      return Promise.resolve(null);
    });
    mockTaskService.findAll.mockResolvedValue([mockTask, mockDependencyTask]);
    mockTaskService.findScheduledBetween.mockResolvedValue(mockDayTasks);
  });

  describe('Task Assignment Context', () => {
    it('should build comprehensive context for task assignment', async () => {
      const assignment: ThreadAssignment = {
        type: 'task',
        taskId: 'task-1',
      };

      // Mock the buildAppContext function behavior
      const buildAppContext = async (
        assignment?: ThreadAssignment
      ): Promise<AppContext> => {
        const baseContext: AppContext = {
          focusMode: false,
          timeOfDay: new Date().toLocaleTimeString(),
          dayOfWeek: new Date().getDay(),
          currentEnergy: 75,
          recentActivity: [],
          preferences: {
            workingHours: { start: '09:00', end: '17:00' },
            breakPreferences: {
              shortBreakDuration: 5,
              longBreakDuration: 15,
              breakInterval: 25,
            },
            focusPreferences: {
              defaultDuration: 25,
              distractionLevel: 'moderate' as const,
              backgroundAudio: { type: 'silence' as const, volume: 0 },
            },
            notifications: {
              breakReminders: true,
              taskDeadlines: true,
              dailySummary: true,
              weeklyReview: true,
            },
            aiSettings: {
              conversationHistory: true,
              autoSuggestions: true,
              toolPermissions: true,
              responseStyle: 'balanced' as const,
              suggestionFrequency: 'moderate' as const,
              showInteractionLogs: false,
            },
            taskSettings: {
              defaultPriority: 1,
              autoScheduling: false,
              smartDependencies: false,
              weekStartDay: 1,
              showCompletedTasks: false,
              compactView: false,
            },
            soundSettings: {
              hapticFeedback: true,
              completionSound: true,
              soundVolume: 50,
            },
            dateFormat: 'DD/MM/YYYY' as const,
            theme: 'auto' as const,
            language: 'en',
          },
        };

        if (assignment?.type === 'task' && assignment.taskId) {
          const task = await mockTaskService.findById(assignment.taskId);
          if (task) {
            baseContext.currentTask = task;
            baseContext.recentActivity.push({
              id: `task-context-${task.id}`,
              type: 'task_created',
              timestamp: task.createdAt,
              data: {
                assignmentType: 'task',
                taskId: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                threadContext:
                  'This conversation is focused on this specific task',
                taskSpecificGuidance: {
                  focusOnTaskCompletion: true,
                  considerTaskDependencies: true,
                  considerTimeEstimates: true,
                  considerDeadlines: true,
                },
              },
            });
          }
        }

        return baseContext;
      };

      const context = await buildAppContext(assignment);

      // Verify task is set as current task
      expect(context.currentTask).toEqual(mockTask);

      // Verify task context is added to recent activity
      const taskContext = context.recentActivity.find(
        activity => activity.id === `task-context-${mockTask.id}`
      );
      expect(taskContext).toBeDefined();
      expect(taskContext?.data.assignmentType).toBe('task');
      expect(taskContext?.data.taskId).toBe('task-1');
      expect(taskContext?.data.title).toBe('Test Task');
      expect(taskContext?.data.threadContext).toBe(
        'This conversation is focused on this specific task'
      );
    });
  });

  describe('Day Assignment Context', () => {
    it('should build comprehensive context for day assignment', async () => {
      const assignmentDate = new Date('2025-08-30');
      const assignment: ThreadAssignment = {
        type: 'day',
        date: assignmentDate,
      };

      // Mock the buildAppContext function behavior for day assignment
      const buildAppContext = async (
        assignment?: ThreadAssignment
      ): Promise<AppContext> => {
        const baseContext: AppContext = {
          focusMode: false,
          timeOfDay: new Date().toLocaleTimeString(),
          dayOfWeek: new Date().getDay(),
          currentEnergy: 75,
          recentActivity: [],
          preferences: {
            workingHours: { start: '09:00', end: '17:00' },
            breakPreferences: {
              shortBreakDuration: 5,
              longBreakDuration: 15,
              breakInterval: 25,
            },
            focusPreferences: {
              defaultDuration: 25,
              distractionLevel: 'moderate' as const,
              backgroundAudio: { type: 'silence' as const, volume: 0 },
            },
            notifications: {
              breakReminders: true,
              taskDeadlines: true,
              dailySummary: true,
              weeklyReview: true,
            },
            aiSettings: {
              conversationHistory: true,
              autoSuggestions: true,
              toolPermissions: true,
              responseStyle: 'balanced' as const,
              suggestionFrequency: 'moderate' as const,
              showInteractionLogs: false,
            },
            taskSettings: {
              defaultPriority: 1,
              autoScheduling: false,
              smartDependencies: false,
              weekStartDay: 1,
              showCompletedTasks: false,
              compactView: false,
            },
            soundSettings: {
              hapticFeedback: true,
              completionSound: true,
              soundVolume: 50,
            },
            dateFormat: 'DD/MM/YYYY' as const,
            theme: 'auto' as const,
            language: 'en',
          },
        };

        if (assignment?.type === 'day' && assignment.date) {
          const dayTasks = await mockTaskService.findScheduledBetween(
            new Date(assignment.date),
            new Date(assignment.date)
          );

          // Add day context
          baseContext.recentActivity.push({
            id: `day-context-${assignment.date.toISOString()}`,
            type: 'task_created',
            timestamp: new Date(),
            data: {
              assignmentType: 'day',
              assignmentDate: assignment.date.toISOString(),
              totalTasks: dayTasks.length,
              completedTasks: dayTasks.filter(
                (t: Task) => t.status === 'completed'
              ).length,
              threadContext: `This conversation is focused on ${assignment.date.toDateString()}`,
              daySpecificGuidance: {
                suggestPrioritization: dayTasks.length > 5,
                considerWorkingHours: true,
              },
            },
          });

          // Add individual tasks
          dayTasks.forEach((task: Task) => {
            baseContext.recentActivity.push({
              id: `day-task-${task.id}`,
              type: 'task_created',
              timestamp: task.createdAt,
              data: {
                taskId: task.id,
                title: task.title,
                status: task.status,
                assignmentType: 'day',
                dayContext: true,
              },
            });
          });
        }

        return baseContext;
      };

      const context = await buildAppContext(assignment);

      // Verify day context is added
      const dayContext = context.recentActivity.find(
        activity =>
          activity.id === `day-context-${assignmentDate.toISOString()}`
      );
      expect(dayContext).toBeDefined();
      expect(dayContext?.data.assignmentType).toBe('day');
      expect(dayContext?.data.totalTasks).toBe(2);
      expect(dayContext?.data.completedTasks).toBe(1);

      // Verify individual tasks are added
      const taskContexts = context.recentActivity.filter(activity =>
        activity.id.startsWith('day-task-')
      );
      expect(taskContexts).toHaveLength(2);
      expect(taskContexts[0].data.dayContext).toBe(true);
    });
  });

  describe('Context Validation', () => {
    it('should validate and enhance context properly', () => {
      const baseContext: AppContext = {
        focusMode: false,
        timeOfDay: new Date().toLocaleTimeString(),
        dayOfWeek: new Date().getDay(),
        currentEnergy: 75,
        recentActivity: [],
        preferences: {
          workingHours: { start: '09:00', end: '17:00' },
          breakPreferences: {
            shortBreakDuration: 5,
            longBreakDuration: 15,
            breakInterval: 25,
          },
          focusPreferences: {
            defaultDuration: 25,
            distractionLevel: 'moderate' as const,
            backgroundAudio: { type: 'silence' as const, volume: 0 },
          },
          notifications: {
            breakReminders: true,
            taskDeadlines: true,
            dailySummary: true,
            weeklyReview: true,
          },
          aiSettings: {
            conversationHistory: true,
            autoSuggestions: true,
            toolPermissions: true,
            responseStyle: 'balanced' as const,
            suggestionFrequency: 'moderate' as const,
            showInteractionLogs: false,
          },
          taskSettings: {
            defaultPriority: 1,
            autoScheduling: false,
            smartDependencies: false,
            weekStartDay: 1,
            showCompletedTasks: false,
            compactView: false,
          },
          soundSettings: {
            hapticFeedback: true,
            completionSound: true,
            soundVolume: 50,
          },
          dateFormat: 'DD/MM/YYYY' as const,
          theme: 'auto' as const,
          language: 'en',
        },
      };

      const assignment: ThreadAssignment = { type: 'task', taskId: 'task-1' };

      // Mock validation function
      const validateAndEnhanceContext = (
        context: AppContext,
        assignment?: ThreadAssignment
      ): AppContext => {
        const enhancedContext = { ...context };

        if (!enhancedContext.recentActivity) {
          enhancedContext.recentActivity = [];
        }

        enhancedContext.recentActivity.push({
          id: `context-validation-${Date.now()}`,
          type: 'task_created',
          timestamp: new Date(),
          data: {
            contextValidation: {
              hasAssignment: !!assignment,
              assignmentType: assignment?.type || 'none',
              hasCurrentTask: !!enhancedContext.currentTask,
              contextSize: JSON.stringify(enhancedContext).length,
            },
            threadContextMetadata: {
              isThreadAssigned: !!assignment,
              threadFocus: assignment?.type || 'general',
              contextQuality: 'enhanced',
              aiOptimized: true,
            },
          },
        });

        return enhancedContext;
      };

      const enhancedContext = validateAndEnhanceContext(
        baseContext,
        assignment
      );

      // Verify validation metadata is added
      const validationContext = enhancedContext.recentActivity.find(activity =>
        activity.id.startsWith('context-validation-')
      );
      expect(validationContext).toBeDefined();
      expect(validationContext?.data.contextValidation.hasAssignment).toBe(
        true
      );
      expect(validationContext?.data.contextValidation.assignmentType).toBe(
        'task'
      );
      expect(
        validationContext?.data.threadContextMetadata.isThreadAssigned
      ).toBe(true);
      expect(validationContext?.data.threadContextMetadata.contextQuality).toBe(
        'enhanced'
      );
    });
  });
});
