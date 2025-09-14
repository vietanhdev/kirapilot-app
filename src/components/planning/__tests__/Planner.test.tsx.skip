import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Planner } from '../Planner';
import { Task, TaskStatus, Priority, TimePreset } from '../../../types';
import { TaskListProvider } from '../../../contexts/TaskListContext';
import { TimerProvider } from '../../../contexts/TimerContext';

// Mock the database hook
jest.mock('../../../hooks/useDatabase', () => ({
  useDatabase: () => ({
    isInitialized: true,
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

// Mock the task repository
const mockTaskRepository = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock the TimeTrackingService
const mockTimeTrackingService = {
  startSession: jest.fn(),
  stopSession: jest.fn(),
  getByDateRange: jest.fn(),
  getByTaskId: jest.fn(),
  deleteSession: jest.fn(),
};

jest.mock('../../../services/database/repositories', () => ({
  getTaskRepository: () => mockTaskRepository,
  getTimeTrackingRepository: () => mockTimeTrackingService,
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

// Mock the WeeklyPlan component
jest.mock('../WeeklyPlan', () => ({
  WeeklyPlan: ({ tasks }: { tasks: Task[] }) => (
    <div data-testid='weekly-plan'>
      <div data-testid='task-count'>{tasks.length}</div>
      {tasks.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.title} - {task.taskListId}
        </div>
      ))}
    </div>
  ),
}));

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Work Task 1',
    description: 'Work task description',
    status: TaskStatus.PENDING,
    priority: Priority.MEDIUM,
    order: 0,
    dependencies: [],
    timePreset: TimePreset.SIXTY_MIN,
    timeEstimate: 60,
    actualTime: 0,
    tags: [],
    subtasks: [],
    taskListId: 'work-list',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Personal Task 1',
    description: 'Personal task description',
    status: TaskStatus.PENDING,
    priority: Priority.HIGH,
    order: 0,
    dependencies: [],
    timePreset: TimePreset.THIRTY_MIN,
    timeEstimate: 30,
    actualTime: 0,
    tags: [],
    subtasks: [],
    taskListId: 'personal-list',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Work Task 2',
    description: 'Another work task',
    status: TaskStatus.COMPLETED,
    priority: Priority.LOW,
    order: 1,
    dependencies: [],
    timePreset: TimePreset.NOT_APPLICABLE,
    timeEstimate: 45,
    actualTime: 45,
    tags: [],
    subtasks: [],
    taskListId: 'work-list',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTaskLists = [
  {
    id: 'work-list',
    name: 'Work Tasks',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'personal-list',
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

describe('Planner Task List Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskRepository.findAll.mockResolvedValue(mockTasks);
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

    renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('3');
    });

    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('filters tasks by work list when work list is selected', async () => {
    // Mock the context to return work list selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: {
          type: 'specific',
          taskListId: 'work-list',
          taskList: mockTaskLists[0],
        },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => 'work-list',
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

    renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('2');
    });

    // Should only show work tasks
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.queryByTestId('task-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('filters tasks by personal list when personal list is selected', async () => {
    // Mock the context to return personal list selection
    jest
      .spyOn(require('../../../contexts/TaskListContext'), 'useTaskList')
      .mockReturnValue({
        taskLists: mockTaskLists,
        currentSelection: {
          type: 'specific',
          taskListId: 'personal-list',
          taskList: mockTaskLists[1],
        },
        isLoading: false,
        error: null,
        getSelectedTaskListId: () => 'personal-list',
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

    renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('1');
    });

    // Should only show personal tasks
    expect(screen.queryByTestId('task-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.queryByTestId('task-3')).not.toBeInTheDocument();
  });

  it('shows no tasks when selected task list has no tasks', async () => {
    // Mock the context to return empty list selection
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

    renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('0');
    });

    expect(screen.queryByTestId('task-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-3')).not.toBeInTheDocument();
  });

  it('falls back to all tasks when no specific task list is selected', async () => {
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

    renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('3');
    });

    // Should show all tasks as fallback
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('updates filtered tasks when task list selection changes', async () => {
    const mockUseTaskList = jest.spyOn(
      require('../../../contexts/TaskListContext'),
      'useTaskList'
    );

    // Start with "All" selected
    mockUseTaskList.mockReturnValue({
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

    const { rerender } = renderWithProviders(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('3');
    });

    // Change to work list selection
    mockUseTaskList.mockReturnValue({
      taskLists: mockTaskLists,
      currentSelection: {
        type: 'specific',
        taskListId: 'work-list',
        taskList: mockTaskLists[0],
      },
      isLoading: false,
      error: null,
      getSelectedTaskListId: () => 'work-list',
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

    rerender(<Planner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-count')).toHaveTextContent('2');
    });
  });
});
