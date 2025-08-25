import { render, screen } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import { Task, TaskStatus, Priority, TimePreset } from '../../../types';

// Mock the hooks
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the settings context
jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    preferences: {
      dateFormat: 'DD/MM/YYYY' as const,
      timeFormat: '24h' as const,
      theme: 'system' as const,
      language: 'en' as const,
    },
  }),
}));

// Mock the drag and drop
jest.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

// Mock the modal components
jest.mock('../TaskModal', () => ({
  TaskModal: () => <div data-testid='task-modal' />,
}));

jest.mock('../../common/ConfirmationDialog', () => ({
  ConfirmationDialog: () => <div data-testid='confirmation-dialog' />,
}));

jest.mock('../../common/MinimalRichTextEditor', () => ({
  MinimalRichTextEditor: () => <div data-testid='rich-text-editor' />,
}));

// Mock the common components that have complex dependencies
jest.mock('../../common', () => ({
  ConfirmationDialog: () => <div data-testid='confirmation-dialog' />,
}));

const mockTask: Task = {
  id: '1',
  title: 'Test Task',
  description: 'Test Description',
  status: TaskStatus.PENDING,
  priority: Priority.MEDIUM,
  order: 0,
  dependencies: [],
  timePreset: TimePreset.SIXTY_MIN,
  timeEstimate: 60,
  actualTime: 0,
  tags: ['test'],
  subtasks: [],
  taskListId: 'list-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultProps = {
  task: mockTask,
  onEdit: jest.fn(),
  onStatusChange: jest.fn(),
  onDelete: jest.fn(),
};

describe('TaskCard Time Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows both used time and estimated time when both are available and estimate is not N/A', () => {
    const taskWithBothTimes = {
      ...mockTask,
      timePreset: TimePreset.SIXTY_MIN,
      timeEstimate: 60,
      actualTime: 45,
    };

    render(<TaskCard {...defaultProps} task={taskWithBothTimes} />);

    expect(screen.getByText('45/60min')).toBeInTheDocument();
  });

  it('shows only used time when available but estimated time is N/A', () => {
    const taskWithUsedTimeOnly = {
      ...mockTask,
      timePreset: TimePreset.NOT_APPLICABLE,
      timeEstimate: 0,
      actualTime: 30,
    };

    render(<TaskCard {...defaultProps} task={taskWithUsedTimeOnly} />);

    expect(screen.getByText('30min')).toBeInTheDocument();
    expect(screen.queryByText('30/0min')).not.toBeInTheDocument();
  });

  it('shows only estimated time when no used time but estimate is available', () => {
    const taskWithEstimateOnly = {
      ...mockTask,
      timePreset: TimePreset.THIRTY_MIN,
      timeEstimate: 30,
      actualTime: 0,
    };

    render(<TaskCard {...defaultProps} task={taskWithEstimateOnly} />);

    expect(screen.getByText('30min')).toBeInTheDocument();
  });

  it('shows no time display when both times are zero/N/A', () => {
    const taskWithNoTime = {
      ...mockTask,
      timePreset: TimePreset.NOT_APPLICABLE,
      timeEstimate: 0,
      actualTime: 0,
    };

    render(<TaskCard {...defaultProps} task={taskWithNoTime} />);

    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('shows used time only when estimate is zero but preset is not N/A', () => {
    const taskWithUsedTimeAndZeroEstimate = {
      ...mockTask,
      timePreset: TimePreset.CUSTOM,
      timeEstimate: 0,
      actualTime: 25,
    };

    render(
      <TaskCard {...defaultProps} task={taskWithUsedTimeAndZeroEstimate} />
    );

    expect(screen.getByText('25min')).toBeInTheDocument();
    expect(screen.queryByText('25/0min')).not.toBeInTheDocument();
  });
});

describe('TaskCard Task List Indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not show task list indicator when showTaskListIndicator is false', () => {
    render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={false}
        taskListName='Work Tasks'
      />
    );

    expect(screen.queryByText('Work Tasks')).not.toBeInTheDocument();
  });

  it('does not show task list indicator when showTaskListIndicator is true but no taskListName', () => {
    render(<TaskCard {...defaultProps} showTaskListIndicator={true} />);

    // Should not show any task list indicator
    expect(screen.queryByText(/Tasks/)).not.toBeInTheDocument();
  });

  it('shows task list indicator when showTaskListIndicator is true and taskListName is provided', () => {
    render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Work Tasks'
      />
    );

    expect(screen.getByText('Work Tasks')).toBeInTheDocument();
  });

  it('shows task list indicator with correct styling', () => {
    render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Personal Tasks'
      />
    );

    const indicatorText = screen.getByText('Personal Tasks');
    const indicator = indicatorText.parentElement;
    expect(indicator).toHaveClass('text-xs');
    expect(indicator).toHaveClass('text-slate-600');
    expect(indicator).toHaveClass('bg-slate-50');
    expect(indicator).toHaveClass('px-1.5');
    expect(indicator).toHaveClass('py-0.5');
    expect(indicator).toHaveClass('rounded');
  });

  it('shows different task list names correctly', () => {
    const { rerender } = render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Project Alpha'
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();

    rerender(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Shopping List'
      />
    );

    expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Shopping List')).toBeInTheDocument();
  });

  it('shows task list indicator for completed tasks', () => {
    const completedTask = {
      ...mockTask,
      status: TaskStatus.COMPLETED,
    };

    render(
      <TaskCard
        task={completedTask}
        onEdit={jest.fn()}
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        showTaskListIndicator={true}
        taskListName='Completed Tasks'
      />
    );

    expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
  });

  it('shows task list indicator with long names', () => {
    render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Very Long Task List Name That Might Wrap'
      />
    );

    expect(
      screen.getByText('Very Long Task List Name That Might Wrap')
    ).toBeInTheDocument();
  });

  it('shows task list indicator for default task list', () => {
    render(
      <TaskCard
        {...defaultProps}
        showTaskListIndicator={true}
        taskListName='Default'
      />
    );

    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
