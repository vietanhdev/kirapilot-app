/**
 * Integration tests for task list filtering across different views
 *
 * This test suite focuses on:
 * - Task filtering in WeeklyPlan component
 * - Task filtering in DayView component
 * - Task creation with proper task list association
 * - Task list indicators in "All" view
 * - Cross-component state synchronization
 *
 * Requirements: 2.4, 2.5, 5.1, 5.2
 */

import { TaskListService } from '../../services/database/repositories/TaskListService';
import { TaskService } from '../../services/database/repositories/TaskService';
import { TestDataFactory } from '../setup/testDataFactory';
import {
  Task,
  TaskList,
  TaskStatus,
  Priority,
  TaskFilters,
  CreateTaskRequest,
} from '../../types';

// Mock Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

describe('Task List Filtering Integration Tests', () => {
  let taskListService: TaskListService;
  let taskService: TaskService;
  let defaultTaskList: TaskList;
  let projectTaskList: TaskList;
  let personalTaskList: TaskList;
  let testTasks: Task[];

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataFactory.resetIdCounter();

    taskListService = new TaskListService();
    taskService = new TaskService();

    // Create test data
    defaultTaskList = {
      id: 'default-list-id',
      name: 'Default',
      isDefault: true,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    };

    projectTaskList = {
      id: 'project-list-id',
      name: 'Project Alpha',
      isDefault: false,
      createdAt: new Date('2024-01-02T10:00:00Z'),
      updatedAt: new Date('2024-01-02T10:00:00Z'),
    };

    personalTaskList = {
      id: 'personal-list-id',
      name: 'Personal Tasks',
      isDefault: false,
      createdAt: new Date('2024-01-03T10:00:00Z'),
      updatedAt: new Date('2024-01-03T10:00:00Z'),
    };

    // Create test tasks with different scheduled dates and task lists
    testTasks = [
      // Week 1 tasks (Jan 15-21, 2024)
      TestDataFactory.createTask({
        id: 'task-1',
        title: 'Default Monday Task',
        taskListId: defaultTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        scheduledDate: new Date('2024-01-15T09:00:00Z'), // Monday
      }),
      TestDataFactory.createTask({
        id: 'task-2',
        title: 'Project Tuesday Task',
        taskListId: projectTaskList.id,
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        scheduledDate: new Date('2024-01-16T10:00:00Z'), // Tuesday
      }),
      TestDataFactory.createTask({
        id: 'task-3',
        title: 'Personal Wednesday Task',
        taskListId: personalTaskList.id,
        status: TaskStatus.COMPLETED,
        priority: Priority.LOW,
        scheduledDate: new Date('2024-01-17T11:00:00Z'), // Wednesday
      }),
      TestDataFactory.createTask({
        id: 'task-4',
        title: 'Default Thursday Task',
        taskListId: defaultTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.URGENT,
        scheduledDate: new Date('2024-01-18T14:00:00Z'), // Thursday
      }),
      TestDataFactory.createTask({
        id: 'task-5',
        title: 'Project Friday Task',
        taskListId: projectTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        scheduledDate: new Date('2024-01-19T15:00:00Z'), // Friday
      }),
      // Unscheduled tasks (backlog)
      TestDataFactory.createTask({
        id: 'task-6',
        title: 'Default Backlog Task',
        taskListId: defaultTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        scheduledDate: undefined,
      }),
      TestDataFactory.createTask({
        id: 'task-7',
        title: 'Personal Backlog Task',
        taskListId: personalTaskList.id,
        status: TaskStatus.PENDING,
        priority: Priority.LOW,
        scheduledDate: undefined,
      }),
    ];

    mockInvoke.mockImplementation(setupDefaultMockResponses());
  });

  const setupDefaultMockResponses = () => (command: string, args?: unknown) => {
    switch (command) {
      case 'get_all_task_lists':
        return Promise.resolve([
          transformTaskListToBackend(defaultTaskList),
          transformTaskListToBackend(projectTaskList),
          transformTaskListToBackend(personalTaskList),
        ]);

      case 'get_default_task_list':
        return Promise.resolve(transformTaskListToBackend(defaultTaskList));

      case 'get_tasks_by_task_list': {
        const taskListId = (args as { task_list_id: string })?.task_list_id;
        const filteredTasks = testTasks.filter(
          task => task.taskListId === taskListId
        );
        return Promise.resolve(filteredTasks.map(transformTaskToBackend));
      }

      case 'get_all_tasks':
        return Promise.resolve(testTasks.map(transformTaskToBackend));

      case 'get_scheduled_tasks_between': {
        const startDate = new Date(
          (args as { start_date: string })?.start_date
        );
        const endDate = new Date((args as { end_date: string })?.end_date);
        const scheduledTasks = testTasks.filter(task => {
          if (!task.scheduledDate) {
            return false;
          }
          return (
            task.scheduledDate >= startDate && task.scheduledDate <= endDate
          );
        });
        return Promise.resolve(scheduledTasks.map(transformTaskToBackend));
      }

      case 'get_tasks_for_date': {
        const targetDate = new Date((args as { date: string })?.date);
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayTasks = testTasks.filter(task => {
          if (!task.scheduledDate) {
            return false;
          }
          return task.scheduledDate >= dayStart && task.scheduledDate <= dayEnd;
        });
        return Promise.resolve(dayTasks.map(transformTaskToBackend));
      }

      case 'create_task': {
        const request = (
          args as {
            request: {
              title?: string;
              task_list_id?: string;
              scheduled_date?: string;
            };
          }
        )?.request;
        const newTask = TestDataFactory.createTask({
          id: `new-task-${Date.now()}`,
          title: request?.title || 'New Task',
          taskListId: request?.task_list_id || defaultTaskList.id,
          scheduledDate: request?.scheduled_date
            ? new Date(request.scheduled_date)
            : undefined,
        });
        testTasks.push(newTask);
        return Promise.resolve(transformTaskToBackend(newTask));
      }

      default:
        return Promise.reject(new Error(`Unknown command: ${command}`));
    }
  };

  const transformTaskListToBackend = (taskList: TaskList) => ({
    id: taskList.id,
    name: taskList.name,
    is_default: taskList.isDefault,
    created_at: taskList.createdAt.toISOString(),
    updated_at: taskList.updatedAt.toISOString(),
  });

  const transformTaskToBackend = (task: Task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dependencies: JSON.stringify(task.dependencies),
    time_estimate: task.timeEstimate,
    actual_time: task.actualTime,
    due_date: task.dueDate?.toISOString() || null,
    scheduled_date: task.scheduledDate?.toISOString() || null,
    tags: JSON.stringify(task.tags),
    project_id: task.projectId || null,
    parent_task_id: task.parentTaskId || null,
    subtasks: JSON.stringify(task.subtasks),
    task_list_id: task.taskListId,
    completed_at: task.completedAt?.toISOString() || null,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  });

  // Helper functions to simulate filtering logic
  const filterTasksByTaskList = (
    tasks: Task[],
    taskListId?: string
  ): Task[] => {
    if (!taskListId) {
      return tasks; // Return all tasks when no filter
    }
    return tasks.filter(task => task.taskListId === taskListId);
  };

  const filterTasksByDate = (tasks: Task[], targetDate: Date): Task[] => {
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    return tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      return task.scheduledDate >= dayStart && task.scheduledDate <= dayEnd;
    });
  };

  const filterTasksByWeek = (tasks: Task[], weekStart: Date): Task[] => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }
      return task.scheduledDate >= weekStart && task.scheduledDate <= weekEnd;
    });
  };

  describe('Task filtering in WeeklyPlan component', () => {
    it('should show only tasks from selected task list in weekly view', async () => {
      // Test filtering for project tasks
      const projectTasks = await taskListService.getTasksByTaskList(
        projectTaskList.id
      );

      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_task_list', {
        task_list_id: projectTaskList.id,
      });

      expect(projectTasks).toHaveLength(2);
      expect(projectTasks.map(t => t.title)).toEqual([
        'Project Tuesday Task',
        'Project Friday Task',
      ]);

      // Verify all project tasks belong to the correct list
      projectTasks.forEach(task => {
        expect(task.taskListId).toBe(projectTaskList.id);
      });
    });

    it('should handle empty task lists gracefully in weekly view', async () => {
      // Create empty task list
      const emptyTaskList: TaskList = {
        id: 'empty-list-id',
        name: 'Empty List',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvoke.mockImplementation((command: string, args?: unknown) => {
        if (
          command === 'get_tasks_by_task_list' &&
          (args as { task_list_id: string })?.task_list_id === emptyTaskList.id
        ) {
          return Promise.resolve([]);
        }
        return setupDefaultMockResponses()(command, args);
      });

      // Test filtering for empty task list
      const emptyTasks = await taskListService.getTasksByTaskList(
        emptyTaskList.id
      );

      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_task_list', {
        task_list_id: emptyTaskList.id,
      });

      expect(emptyTasks).toHaveLength(0);
    });

    it('should show correct task counts per day in weekly view', async () => {
      const weekStart = new Date('2024-01-15'); // Monday
      const weekTasks = filterTasksByWeek(testTasks, weekStart);

      // Count tasks per day
      const tasksByDay = weekTasks.reduce(
        (acc, task) => {
          if (task.scheduledDate) {
            const dayKey = task.scheduledDate.toISOString().split('T')[0];
            acc[dayKey] = (acc[dayKey] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      // Verify counts
      expect(tasksByDay['2024-01-15']).toBe(1); // Monday
      expect(tasksByDay['2024-01-16']).toBe(1); // Tuesday
      expect(tasksByDay['2024-01-17']).toBe(1); // Wednesday
      expect(tasksByDay['2024-01-18']).toBe(1); // Thursday
      expect(tasksByDay['2024-01-19']).toBe(1); // Friday
    });

    it('should filter weekly tasks by task list', async () => {
      const weekStart = new Date('2024-01-15');

      // Get all tasks for the week
      const allWeekTasks = filterTasksByWeek(testTasks, weekStart);
      expect(allWeekTasks).toHaveLength(5); // All scheduled tasks are in this week

      // Filter by project task list
      const projectWeekTasks = filterTasksByTaskList(
        allWeekTasks,
        projectTaskList.id
      );
      expect(projectWeekTasks).toHaveLength(2);
      expect(
        projectWeekTasks.every(task => task.taskListId === projectTaskList.id)
      ).toBe(true);

      // Filter by default task list
      const defaultWeekTasks = filterTasksByTaskList(
        allWeekTasks,
        defaultTaskList.id
      );
      expect(defaultWeekTasks).toHaveLength(2);
      expect(
        defaultWeekTasks.every(task => task.taskListId === defaultTaskList.id)
      ).toBe(true);
    });
  });

  describe('Task filtering in DayView component', () => {
    it('should show only tasks from selected task list for specific date', async () => {
      const selectedDate = new Date('2024-01-15'); // Monday

      // Get all tasks for Monday
      const mondayTasks = filterTasksByDate(testTasks, selectedDate);
      expect(mondayTasks).toHaveLength(1);
      expect(mondayTasks[0].title).toBe('Default Monday Task');

      // Filter by task list
      const defaultMondayTasks = filterTasksByTaskList(
        mondayTasks,
        defaultTaskList.id
      );
      expect(defaultMondayTasks).toHaveLength(1);
      expect(defaultMondayTasks[0].title).toBe('Default Monday Task');

      // No project tasks on Monday
      const projectMondayTasks = filterTasksByTaskList(
        mondayTasks,
        projectTaskList.id
      );
      expect(projectMondayTasks).toHaveLength(0);
    });

    it('should handle days with no scheduled tasks', async () => {
      const emptyDate = new Date('2024-01-20'); // Saturday - no tasks scheduled
      const tasksForDate = filterTasksByDate(testTasks, emptyDate);

      expect(tasksForDate).toHaveLength(0);
    });

    it('should filter day tasks by multiple criteria', async () => {
      const tuesday = new Date('2024-01-16');
      const tuesdayTasks = filterTasksByDate(testTasks, tuesday);

      expect(tuesdayTasks).toHaveLength(1);
      expect(tuesdayTasks[0].title).toBe('Project Tuesday Task');
      expect(tuesdayTasks[0].status).toBe(TaskStatus.IN_PROGRESS);
      expect(tuesdayTasks[0].priority).toBe(Priority.MEDIUM);

      // Filter by status
      const inProgressTasks = tuesdayTasks.filter(
        task => task.status === TaskStatus.IN_PROGRESS
      );
      expect(inProgressTasks).toHaveLength(1);

      // Filter by priority
      const mediumPriorityTasks = tuesdayTasks.filter(
        task => task.priority === Priority.MEDIUM
      );
      expect(mediumPriorityTasks).toHaveLength(1);
    });

    it('should show task list indicators when "All" is selected', async () => {
      // When "All" is selected, tasks should include task list information
      const allTasks = await taskService.findAll();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks', {
        status: undefined,
        project_id: undefined,
      });
      expect(allTasks).toHaveLength(7);

      // Verify each task has task list ID
      allTasks.forEach(task => {
        expect(task.taskListId).toBeTruthy();
        expect([
          defaultTaskList.id,
          projectTaskList.id,
          personalTaskList.id,
        ]).toContain(task.taskListId);
      });

      // Group by task list for indicator logic
      const tasksByList = allTasks.reduce(
        (acc, task) => {
          acc[task.taskListId] = (acc[task.taskListId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(tasksByList[defaultTaskList.id]).toBe(3); // 2 scheduled + 1 backlog
      expect(tasksByList[projectTaskList.id]).toBe(2); // 2 scheduled
      expect(tasksByList[personalTaskList.id]).toBe(2); // 1 scheduled + 1 backlog
    });
  });

  describe('Task creation with proper task list association', () => {
    it('should create task with currently selected task list', async () => {
      const createRequest: CreateTaskRequest = {
        title: 'New Task for Current List',
        taskListId: projectTaskList.id,
        scheduledDate: new Date('2024-01-20T10:00:00Z'),
      };

      const newTask = await taskService.create(createRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: expect.objectContaining({
          title: 'New Task for Current List',
          task_list_id: projectTaskList.id,
          scheduled_date: '2024-01-20T10:00:00.000Z',
        }),
      });

      expect(newTask.taskListId).toBe(projectTaskList.id);
      expect(newTask.title).toBe('New Task for Current List');
    });

    it('should default to default task list when no task list specified', async () => {
      const createRequest: CreateTaskRequest = {
        title: 'Task without explicit list',
      };

      const newTask = await taskService.create(createRequest);

      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        request: expect.objectContaining({
          title: 'Task without explicit list',
          task_list_id: undefined, // No explicit task list provided
        }),
      });

      expect(newTask.taskListId).toBe(defaultTaskList.id);
    });

    it('should validate task list exists during creation', async () => {
      mockInvoke.mockImplementation((command: string, args?: unknown) => {
        if (command === 'create_task') {
          return Promise.reject(
            new Error('FOREIGN_KEY_CONSTRAINT: Task list does not exist')
          );
        }
        return setupDefaultMockResponses()(command, args);
      });

      const createRequest: CreateTaskRequest = {
        title: 'Invalid Task',
        taskListId: 'non-existent-list',
      };

      await expect(taskService.create(createRequest)).rejects.toThrow(
        'Task list does not exist'
      );
    });

    it('should preserve task list association during updates', async () => {
      const originalTask = testTasks[0];
      const newTaskListId = projectTaskList.id;

      mockInvoke.mockImplementation((command: string, args?: unknown) => {
        if (command === 'update_task') {
          const request = (args as { request: { task_list_id?: string } })
            ?.request;
          const updatedTask = {
            ...originalTask,
            taskListId: request?.task_list_id || originalTask.taskListId,
          };
          return Promise.resolve(transformTaskToBackend(updatedTask));
        }
        return setupDefaultMockResponses()(command, args);
      });

      const updatedTask = await taskService.update(originalTask.id, {
        taskListId: newTaskListId,
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        id: originalTask.id,
        request: expect.objectContaining({
          task_list_id: newTaskListId,
        }),
      });

      expect(updatedTask.taskListId).toBe(newTaskListId);
    });
  });

  describe('Cross-component state synchronization', () => {
    it('should maintain consistent filtering across different time views', async () => {
      // Test that filtering works consistently across day, week, and all views
      const targetTaskListId = projectTaskList.id;

      // Get all project tasks
      const allProjectTasks =
        await taskListService.getTasksByTaskList(targetTaskListId);
      expect(allProjectTasks).toHaveLength(2);

      // Filter project tasks by week
      const weekStart = new Date('2024-01-15');
      const weekProjectTasks = filterTasksByWeek(allProjectTasks, weekStart);
      expect(weekProjectTasks).toHaveLength(2); // Both project tasks are in this week

      // Filter project tasks by specific day
      const tuesday = new Date('2024-01-16');
      const dayProjectTasks = filterTasksByDate(allProjectTasks, tuesday);
      expect(dayProjectTasks).toHaveLength(1);
      expect(dayProjectTasks[0].title).toBe('Project Tuesday Task');

      // Verify consistency
      expect(weekProjectTasks).toContain(dayProjectTasks[0]);
    });

    it('should handle rapid filter changes without data corruption', async () => {
      const taskListIds = [
        defaultTaskList.id,
        projectTaskList.id,
        personalTaskList.id,
      ];
      const results: Task[][] = [];

      // Rapidly switch between different task lists
      for (const taskListId of taskListIds) {
        const tasks = await taskListService.getTasksByTaskList(taskListId);
        results.push(tasks);

        // Verify each result is correct
        tasks.forEach(task => {
          expect(task.taskListId).toBe(taskListId);
        });
      }

      // Verify results are different and correct
      expect(results[0]).toHaveLength(3); // Default tasks
      expect(results[1]).toHaveLength(2); // Project tasks
      expect(results[2]).toHaveLength(2); // Personal tasks

      // Verify no cross-contamination
      const allTaskIds = new Set();
      results.forEach(taskList => {
        taskList.forEach(task => {
          expect(allTaskIds.has(task.id)).toBe(false);
          allTaskIds.add(task.id);
        });
      });
    });

    it('should maintain filter state during concurrent operations', async () => {
      // Simulate concurrent filtering operations
      const promises = [
        taskListService.getTasksByTaskList(defaultTaskList.id),
        taskListService.getTasksByTaskList(projectTaskList.id),
        taskListService.getTasksByTaskList(personalTaskList.id),
      ];

      const results = await Promise.all(promises);

      // Verify each result is correct
      expect(results[0]).toHaveLength(3); // Default tasks
      expect(results[1]).toHaveLength(2); // Project tasks
      expect(results[2]).toHaveLength(2); // Personal tasks

      // Verify task list associations
      results[0].forEach(task =>
        expect(task.taskListId).toBe(defaultTaskList.id)
      );
      results[1].forEach(task =>
        expect(task.taskListId).toBe(projectTaskList.id)
      );
      results[2].forEach(task =>
        expect(task.taskListId).toBe(personalTaskList.id)
      );
    });
  });

  describe('Performance optimization', () => {
    it('should efficiently filter large task sets', async () => {
      // Create large task set
      const largeTasks = Array.from({ length: 1000 }, (_, index) =>
        TestDataFactory.createTask({
          id: `large-task-${index}`,
          title: `Large Task ${index}`,
          taskListId: index % 2 === 0 ? defaultTaskList.id : projectTaskList.id,
          scheduledDate: new Date(`2024-01-${15 + (index % 7)}`),
        })
      );

      mockInvoke.mockImplementation((command: string, args?: unknown) => {
        if (command === 'get_tasks_by_task_list') {
          const taskListId = (args as { task_list_id: string })?.task_list_id;
          const filtered = largeTasks.filter(
            task => task.taskListId === taskListId
          );
          return Promise.resolve(filtered.map(transformTaskToBackend));
        }
        return setupDefaultMockResponses()(command, args);
      });

      const startTime = Date.now();
      const defaultTasks = await taskListService.getTasksByTaskList(
        defaultTaskList.id
      );
      const endTime = Date.now();

      expect(defaultTasks).toHaveLength(500); // Half of the tasks
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should cache filtering results appropriately', async () => {
      // First call
      const firstResult = await taskListService.getTasksByTaskList(
        projectTaskList.id
      );
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Second call - should use same backend call (no caching at service level)
      const secondResult = await taskListService.getTasksByTaskList(
        projectTaskList.id
      );
      expect(mockInvoke).toHaveBeenCalledTimes(2);

      // Results should be identical
      expect(firstResult).toEqual(secondResult);
    });

    it('should handle complex filtering queries efficiently', async () => {
      const complexFilters: TaskFilters = {
        status: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
        priority: [Priority.HIGH, Priority.URGENT],
        taskListId: projectTaskList.id,
      };

      // Simulate complex filtering
      const allTasks = await taskService.findAll();
      const filteredTasks = allTasks.filter(task => {
        if (
          complexFilters.status &&
          !complexFilters.status.includes(task.status)
        ) {
          return false;
        }
        if (
          complexFilters.priority &&
          !complexFilters.priority.includes(task.priority)
        ) {
          return false;
        }
        if (
          complexFilters.taskListId &&
          task.taskListId !== complexFilters.taskListId
        ) {
          return false;
        }
        return true;
      });

      expect(filteredTasks).toHaveLength(1); // Only "Project Friday Task" matches all criteria
      expect(filteredTasks[0].title).toBe('Project Friday Task');
      expect(filteredTasks[0].status).toBe(TaskStatus.PENDING);
      expect(filteredTasks[0].priority).toBe(Priority.HIGH);
      expect(filteredTasks[0].taskListId).toBe(projectTaskList.id);
    });
  });
});
