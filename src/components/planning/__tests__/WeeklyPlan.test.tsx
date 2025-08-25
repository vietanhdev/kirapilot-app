import React from 'react';
import { render, screen } from '@testing-library/react';
import { WeeklyPlan } from '../WeeklyPlan';
import { Task, TaskStatus, Priority, TimePreset } from '../../../types';
import { TaskListProvider } from '../../../contexts/TaskListContext';
import { TimerProvider } from '../../../contexts/TimerContext';

// Mock the hooks
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../hooks/useResponsiveColumnWidth', () => ({
  useResponsiveColumnWidth: () => ({
    columnWidth: 300,
  }),
}));

// Mock the user preferences hook
jest.mock('../../../hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: {
      theme: 'light',
      language: 'en',
      workingHours: { start: '09:00', end: '17:00' },
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        breakInterval: 25,
      },
      focusPreferences: {
        defaultDuration: 25,
        distractionLevel: 'minimal',
        backgroundAudio: { type: 'silence', volume: 50 },
      },
      notifications: {
        breakReminders: true,
        taskDeadlines: true,
        dailySummary: false,
        weeklyReview: false,
      },
      aiSettings: {
        conversationHistory: true,
        autoSuggestions: true,
        toolPermissions: true,
        responseStyle: 'balanced',
        suggestionFrequency: 'moderate',
      },
      taskSettings: {
        defaultPriority: 1,
        autoScheduling: false,
        smartDependencies: false,
        weekStartDay: 1,
        showCompletedTasks: true,
        compactView: false,
      },
    },
    updatePreferences: jest.fn(),
  }),
}));

// Mock the TaskListService
const mockTaskListService = {
  getAllTaskLists: jest.fn(),
  createTaskList: jest.fn(),
  updateTaskList: jest.fn(),
  deleteTaskList: jest.fn(),
  getDefaultTaskList: jest.fn(),
  moveTaskToList: jest.fn(),
};

jest.mock('../../../services/database/repositories/TaskListService', () => ({
  TaskListService: jest.fn(() => mockTaskListService),
}));

// Mock components that have complex dependencies
jest.mock('../WeekView', () => ({
  WeekView: ({ tasks }: { tasks: Task[] }) => (
    <div data-testid='week-view'>
      {tasks.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../DayView', () => ({
  DayView: ({ tasks }: { tasks: Task[] }) => (
    <div data-testid='day-view'>
      {tasks.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.title}
        </div>
      ))}
    </div>
  ),
}));

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Task 1',
    description: 'Description 1',
    status: TaskStatus.PENDING,
    priority: Priority.MEDIUM,
    order: 0,
    dependencies: [],
    timePreset: TimePreset.SIXTY_MIN,
    timeEstimate: 60,
    actualTime: 0,
    tags: [],
    subtasks: [],
    taskListId: 'list-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Task 2',
    description: 'Description 2',
    status: TaskStatus.PENDING,
    priority: Priority.HIGH,
    order: 0,
    dependencies: [],
    timePreset: TimePreset.THIRTY_MIN,
    timeEstimate: 30,
    actualTime: 0,
    tags: [],
    subtasks: [],
    taskListId: 'list-2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Task 3',
    description: 'Description 3',
    status: TaskStatus.COMPLETED,
    priority: Priority.LOW,
    order: 1,
    dependencies: [],
    timePreset: TimePreset.NOT_APPLICABLE,
    timeEstimate: 45,
    actualTime: 45,
    tags: [],
    subtasks: [],
    taskListId: 'list-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTaskLists = [
  {
    id: 'list-1',
    name: 'Work Tasks',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'list-2',
    name: 'Personal Tasks',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'default-list',
    name: 'Default',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultProps = {
  tasks: mockTasks,
  currentWeek: new Date(),
  onWeekChange: jest.fn(),
  onTaskMove: jest.fn(),
  onTaskCreate: jest.fn(),
  onTaskEdit: jest.fn(),
  onTaskStatusChange: jest.fn(),
  onTaskDelete: jest.fn(),
};

// Mock the SettingsProvider
const MockSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-mock-settings-provider>{children}</div>;
};

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MockSettingsProvider>
      <TimerProvider>
        <TaskListProvider>{children}</TaskListProvider>
      </TimerProvider>
    </MockSettingsProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

describe('WeeklyPlan Task List Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);
    mockTaskListService.getDefaultTaskList.mockResolvedValue(mockTaskLists[2]);
  });

  it('shows all tasks when "All" is selected', async () => {
    // Mock the context to return "All" selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: { type: 'all' },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => null,
        isAllSelected: () => true,
        canEditCurrentList: () => false,

        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        switchToTaskList: jest.fn(),
        switchToAll: jest.fn(),
        moveTaskToList: jest.fn(),
        refreshTaskLists: jest.fn(),
      });

    renderWithProviders(<WeeklyPlan {...defaultProps} viewMode='week' />);

    // Should show all tasks
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('filters tasks by selected task list', async () => {
    // Mock the context to return specific task list selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: {
          type: 'specific',
          taskListId: 'list-1',
          taskList: mockTaskLists[0],
        },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => 'list-1',
        isAllSelected: () => false,
        canEditCurrentList: () => true,

        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        switchToTaskList: jest.fn(),
        switchToAll: jest.fn(),
        moveTaskToList: jest.fn(),
        refreshTaskLists: jest.fn(),
      });

    renderWithProviders(<WeeklyPlan {...defaultProps} viewMode='week' />);

    // Should only show tasks from list-1
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.queryByTestId('task-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('shows no tasks when selected task list has no tasks', async () => {
    // Mock the context to return task list with no tasks
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: {
          type: 'specific',
          taskListId: 'empty-list',
          taskList: {
            id: 'empty-list',
            name: 'Empty List',
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => 'empty-list',
        isAllSelected: () => false,
        canEditCurrentList: () => true,

        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        switchToTaskList: jest.fn(),
        switchToAll: jest.fn(),
        moveTaskToList: jest.fn(),
        refreshTaskLists: jest.fn(),
      });

    renderWithProviders(<WeeklyPlan {...defaultProps} viewMode='week' />);

    // Should show no tasks
    expect(screen.queryByTestId('task-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-3')).not.toBeInTheDocument();
  });

  it('works in day view mode', async () => {
    // Mock the context to return specific task list selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: {
          type: 'specific',
          taskListId: 'list-2',
          taskList: mockTaskLists[1],
        },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => 'list-2',
        isAllSelected: () => false,
        canEditCurrentList: () => true,

        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        switchToTaskList: jest.fn(),
        switchToAll: jest.fn(),
        moveTaskToList: jest.fn(),
        refreshTaskLists: jest.fn(),
      });

    renderWithProviders(<WeeklyPlan {...defaultProps} viewMode='day' />);

    // Should show day view with filtered tasks
    expect(screen.getByTestId('day-view')).toBeInTheDocument();
    expect(screen.queryByTestId('task-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.queryByTestId('task-3')).not.toBeInTheDocument();
  });

  it('falls back to all tasks when no task list is selected', async () => {
    // Mock the context to return no selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: { type: 'specific' }, // No taskListId
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => null,
        isAllSelected: () => false,
        canEditCurrentList: () => false,

        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        switchToTaskList: jest.fn(),
        switchToAll: jest.fn(),
        moveTaskToList: jest.fn(),
        refreshTaskLists: jest.fn(),
      });

    renderWithProviders(<WeeklyPlan {...defaultProps} viewMode='week' />);

    // Should show all tasks as fallback
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });
});
