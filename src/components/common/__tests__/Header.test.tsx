import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { TaskList, TaskListSelection } from '../../../types';

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useSettings hook
jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    preferences: {
      aiSettings: {
        showInteractionLogs: false,
      },
    },
  }),
}));

// Mock the SessionHistory component
jest.mock('../../timer/SessionHistory', () => ({
  SessionHistoryModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div data-testid='session-history-modal'>Session History Modal</div>
    ) : null,
}));

// Mock the useTimerContext hook
const mockUseTimerContext = jest.fn();
jest.mock('../../../contexts/TimerContext', () => ({
  useTimerContext: () => mockUseTimerContext(),
}));

// Mock the useTaskList hook
const mockUseTaskList = jest.fn();
jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => mockUseTaskList(),
}));

// Mock data
const mockTaskLists: TaskList[] = [
  {
    id: 'default-id',
    name: 'Default',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

describe('Header', () => {
  const mockOnViewChange = jest.fn();

  const setupMockTimerContext = (options?: {
    hasActiveTimer?: boolean;
    activeTask?: { id: string; title: string };
    elapsedTime?: number;
    isRunning?: boolean;
  }) => {
    const {
      hasActiveTimer = false,
      activeTask = null,
      elapsedTime = 0,
      isRunning = false,
    } = options || {};

    const defaultMockValue = {
      elapsedTime,
      isRunning,
      hasActiveTimer,
      formatElapsedTime: jest.fn((time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }),
      activeTask,
      handleTimerStart: jest.fn(),
      handleTimerPause: jest.fn(),
      handleTimerStop: jest.fn(),
    };

    mockUseTimerContext.mockReturnValue(defaultMockValue);
    return defaultMockValue;
  };

  const setupMockTaskListContext = (options?: {
    initialSelection?: TaskListSelection;
  }) => {
    const { initialSelection = { type: 'all' as const } } = options || {};

    const defaultMockValue = {
      taskLists: mockTaskLists,
      currentSelection: initialSelection,
      isLoading: false,
      error: null,
      createTaskList: jest.fn(),
      updateTaskList: jest.fn(),
      deleteTaskList: jest.fn(),
      switchToTaskList: jest.fn(),
      switchToAll: jest.fn(),
      moveTaskToList: jest.fn(),
      refreshTaskLists: jest.fn(),
      getSelectedTaskListId: jest.fn(),
      isAllSelected: jest.fn(() => initialSelection?.type === 'all'),
      canEditCurrentList: jest.fn(() => false),
    };

    mockUseTaskList.mockReturnValue(defaultMockValue);
    return defaultMockValue;
  };

  const renderHeader = (currentView = 'week') => {
    setupMockTimerContext();
    setupMockTaskListContext();

    return render(
      <Header currentView={currentView} onViewChange={mockOnViewChange} />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the app logo', () => {
    renderHeader();

    // Check for the logo icon and task list dropdown
    const taskListButton = screen.getByRole('button', {
      name: 'taskList.selectTaskList',
    });
    expect(taskListButton).toBeInTheDocument();
  });

  it('renders the TaskListDropdown component', () => {
    renderHeader();

    // The TaskListDropdown should be rendered
    // We can verify this by checking for the dropdown trigger button
    const dropdownTrigger = screen.getByRole('button', {
      name: /taskList.selectTaskList/i,
    });
    expect(dropdownTrigger).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    renderHeader();

    expect(screen.getByText('nav.week')).toBeInTheDocument();
    expect(screen.getByText('nav.day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kira' })).toBeInTheDocument();
    expect(screen.getByTitle('nav.recurring')).toBeInTheDocument();
    expect(screen.getByTitle('nav.reports')).toBeInTheDocument();
    expect(screen.getByTitle('nav.settings')).toBeInTheDocument();
  });

  it('applies correct responsive classes', () => {
    renderHeader();

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('px-4', 'sm:px-6');

    const leftSection = header.querySelector(
      '.flex.items-center.gap-2.sm\\:gap-3'
    );
    expect(leftSection).toBeInTheDocument();
  });

  it('shows timer display when active timer exists', () => {
    setupMockTimerContext({
      hasActiveTimer: true,
      activeTask: { id: '1', title: 'Test Task' },
      elapsedTime: 300, // 5 minutes
      isRunning: true,
    });
    setupMockTaskListContext();

    render(<Header currentView='week' onViewChange={mockOnViewChange} />);

    // Timer display should be visible
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('hides timer display when no active timer', () => {
    renderHeader();

    // Timer display should not be visible
    expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  it('renders Kira chat button and handles navigation', () => {
    renderHeader();

    const kiraButton = screen.getByRole('button', { name: 'Kira' });
    expect(kiraButton).toBeInTheDocument();

    // Button should not be active when current view is not 'kira'
    expect(kiraButton).not.toHaveClass('bg-primary-500');
  });

  it('highlights Kira button when in kira view', () => {
    renderHeader('kira');

    const kiraButton = screen.getByRole('button', { name: 'Kira' });
    expect(kiraButton).toHaveClass('bg-primary-500', 'text-white', 'shadow-sm');
  });
});
