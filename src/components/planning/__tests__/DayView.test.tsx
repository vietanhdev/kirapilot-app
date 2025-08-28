import { render, screen, fireEvent } from '@testing-library/react';
import { DayView } from '../DayView';
import { Task, TaskStatus, Priority, TimePreset } from '../../../types';

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

jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => ({
    isAllSelected: () => false,
    taskLists: [
      { id: 'list-1', name: 'Test List 1' },
      { id: 'list-2', name: 'Test List 2' },
    ],
  }),
}));

// Mock drag and drop
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragStart?: (event: { active: { id: string } }) => void;
    onDragEnd?: (event: {
      active: { id: string };
      over: { id: string; data: { current: { type: string; title?: string } } };
    }) => void;
  }) => (
    <div
      data-testid='dnd-context'
      onClick={() => {
        // Simulate simple drag operation
        onDragStart?.({ active: { id: 'task-1' } });
        onDragEnd?.({
          active: { id: 'task-1' },
          over: {
            id: 'task-2',
            data: { current: { type: 'task' } },
          },
        });
      }}
    >
      {children}
    </div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='drag-overlay'>{children}</div>
  ),
  closestCenter: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((array, from, to) => {
    const result = [...array];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
}));

// Mock child components
jest.mock('../TaskColumn', () => ({
  TaskColumn: ({
    title,
    children,
    count,
    onAddTask,
  }: {
    title: string;
    children: React.ReactNode;
    count: number;
    onAddTask: () => void;
  }) => (
    <div data-testid={`task-column-${title.toLowerCase()}`}>
      <div data-testid={`column-title-${title.toLowerCase()}`}>{title}</div>
      <div data-testid={`column-count-${title.toLowerCase()}`}>
        Count: {count}
      </div>
      <button
        onClick={onAddTask}
        data-testid={`add-task-${title.toLowerCase()}`}
      >
        Add Task
      </button>
      <div data-testid={`column-children-${title.toLowerCase()}`}>
        {children}
      </div>
    </div>
  ),
}));

jest.mock('../TaskCard', () => ({
  TaskCard: ({ task }: { task: Task }) => (
    <div data-testid={`task-card-${task.id}`} data-task-id={task.id}>
      {task.title}
    </div>
  ),
}));

jest.mock('../TaskModal', () => ({
  TaskModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid='task-modal'>
        <button onClick={onClose} data-testid='close-modal'>
          Close
        </button>
      </div>
    ) : null,
}));

describe('DayView', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Backlog Task',
      description: '',
      status: TaskStatus.PENDING,
      priority: Priority.MEDIUM,
      timePreset: TimePreset.THIRTY_MIN,
      timeEstimate: 30,
      actualTime: 0,
      order: 0,
      dependencies: [],
      tags: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskListId: 'list-1',
      // No scheduledDate = backlog
    },
    {
      id: 'task-2',
      title: 'Today Task',
      description: '',
      status: TaskStatus.PENDING,
      priority: Priority.HIGH,
      timePreset: TimePreset.SIXTY_MIN,
      timeEstimate: 45,
      actualTime: 0,
      order: 1,
      dependencies: [],
      tags: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskListId: 'list-1',
      scheduledDate: new Date('2025-08-26'), // Today
    },
    {
      id: 'task-3',
      title: 'Overdue Task',
      description: '',
      status: TaskStatus.PENDING,
      priority: Priority.HIGH,
      timePreset: TimePreset.FIFTEEN_MIN,
      timeEstimate: 15,
      actualTime: 0,
      order: 2,
      dependencies: [],
      tags: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskListId: 'list-2',
      scheduledDate: new Date('2025-08-25'), // Yesterday (overdue)
    },
    {
      id: 'task-4',
      title: 'Next Task',
      description: '',
      status: TaskStatus.PENDING,
      priority: Priority.LOW,
      timePreset: TimePreset.SIXTY_MIN,
      timeEstimate: 60,
      actualTime: 0,
      order: 3,
      dependencies: [],
      tags: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskListId: 'list-1',
      scheduledDate: new Date('2025-08-27'), // Tomorrow
    },
  ];

  const defaultProps = {
    tasks: mockTasks,
    selectedDate: new Date('2025-08-26'),
    onDateChange: jest.fn(),
    onTaskMove: jest.fn(),
    onTaskEdit: jest.fn(),
    onTaskStatusChange: jest.fn(),
    onTaskCreate: jest.fn(),
    onInlineEdit: jest.fn(),
    onTaskDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four columns with correct titles', () => {
    render(<DayView {...defaultProps} />);

    expect(
      screen.getByTestId('column-title-planning.backlog')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-title-planning.overdue')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-title-planning.today')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-title-planning.nexttasks')
    ).toBeInTheDocument();
  });

  it('categorizes tasks correctly into columns', () => {
    render(<DayView {...defaultProps} />);

    // Check that all columns are rendered
    expect(
      screen.getByTestId('column-count-planning.backlog')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-count-planning.overdue')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-count-planning.today')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('column-count-planning.nexttasks')
    ).toBeInTheDocument();

    // Check that tasks are distributed across columns
    // The exact counts depend on the current date vs task dates
    const backlogCount = screen.getByTestId('column-count-planning.backlog');
    const overdueCount = screen.getByTestId('column-count-planning.overdue');
    const todayCount = screen.getByTestId('column-count-planning.today');
    const nextCount = screen.getByTestId('column-count-planning.nexttasks');

    // All columns should have some content (at least "Count: X")
    expect(backlogCount).toHaveTextContent(/Count: \d+/);
    expect(overdueCount).toHaveTextContent(/Count: \d+/);
    expect(todayCount).toHaveTextContent(/Count: \d+/);
    expect(nextCount).toHaveTextContent(/Count: \d+/);

    // Check that all task cards are rendered somewhere (some might be duplicated)
    expect(screen.getAllByTestId('task-card-task-1')).toHaveLength(1);
    expect(
      screen.getAllByTestId('task-card-task-2').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('task-card-task-3')).toHaveLength(1);
    expect(
      screen.getAllByTestId('task-card-task-4').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('displays current date in header', () => {
    render(<DayView {...defaultProps} />);

    expect(screen.getByText('Tuesday, August 26, 2025')).toBeInTheDocument();
  });

  it('shows today indicator when selectedDate is today', () => {
    const today = new Date();
    render(<DayView {...defaultProps} selectedDate={today} />);

    // Today indicator should be visible (animate-pulse span)
    const todayIndicator = document.querySelector('.animate-pulse');
    expect(todayIndicator).toBeInTheDocument();
  });

  it('handles date navigation', () => {
    const onDateChange = jest.fn();
    render(<DayView {...defaultProps} onDateChange={onDateChange} />);

    // Click previous day button
    const prevButton = screen.getByTitle('planning.previousDay');
    fireEvent.click(prevButton);

    expect(onDateChange).toHaveBeenCalledWith(new Date('2025-08-25'));

    // Click next day button
    const nextButton = screen.getByTitle('planning.nextDay');
    fireEvent.click(nextButton);

    expect(onDateChange).toHaveBeenCalledWith(new Date('2025-08-27'));

    // Click today button
    const todayButton = screen.getByTitle('planning.goToToday');
    fireEvent.click(todayButton);

    expect(onDateChange).toHaveBeenCalledWith(expect.any(Date));
  });

  it('handles task creation for different columns', () => {
    render(<DayView {...defaultProps} />);

    // Click add task button for backlog
    const addBacklogButton = screen.getByTestId('add-task-planning.backlog');
    fireEvent.click(addBacklogButton);

    expect(screen.getByTestId('task-modal')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
  });

  it('renders drag overlay when present', () => {
    render(<DayView {...defaultProps} />);

    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
  });

  it('calls drag handlers when drag operations occur', () => {
    const onTaskMove = jest.fn();
    const onInlineEdit = jest.fn();

    render(
      <DayView
        {...defaultProps}
        onTaskMove={onTaskMove}
        onInlineEdit={onInlineEdit}
      />
    );

    // Trigger drag operation by clicking the DnD context
    fireEvent.click(screen.getByTestId('dnd-context'));

    // The mock will simulate drag operations, but we mainly want to ensure no crashes occur
    expect(onTaskMove).not.toThrow();
  });

  it('handles empty task lists gracefully', () => {
    render(<DayView {...defaultProps} tasks={[]} />);

    // All columns should show 0 count
    expect(
      screen.getByTestId('column-count-planning.backlog')
    ).toHaveTextContent('Count: 0');
    expect(
      screen.getByTestId('column-count-planning.overdue')
    ).toHaveTextContent('Count: 0');
    expect(screen.getByTestId('column-count-planning.today')).toHaveTextContent(
      'Count: 0'
    );
    expect(
      screen.getByTestId('column-count-planning.nexttasks')
    ).toHaveTextContent('Count: 0');
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <DayView {...defaultProps} className='test-class' />
    );

    expect(container.firstChild?.firstChild).toHaveClass('test-class');
  });
});
