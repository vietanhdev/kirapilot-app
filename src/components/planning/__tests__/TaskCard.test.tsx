import { render, screen } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import { Task, TaskStatus, Priority } from '../../../types';

// Mock the hooks
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
  dependencies: [],
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

    const indicator = screen.getByText('Personal Tasks');
    expect(indicator).toHaveClass('text-xs');
    expect(indicator).toHaveClass('text-slate-500');
    expect(indicator).toHaveClass('bg-slate-100');
    expect(indicator).toHaveClass('px-1.5');
    expect(indicator).toHaveClass('py-0.5');
    expect(indicator).toHaveClass('rounded-sm');
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
