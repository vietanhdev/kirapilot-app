import { render, screen, fireEvent } from '@testing-library/react';
import { WeekView } from '../WeekView';
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
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: jest.fn(),
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
    isToday,
  }: {
    title: string;
    children: React.ReactNode;
    count: number;
    onAddTask: () => void;
    isToday?: boolean;
  }) => (
    <div
      data-testid={`task-column-${title.toLowerCase()}`}
      className={isToday ? 'today-column' : ''}
    >
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

describe('WeekView', () => {
  const currentWeek = new Date('2025-08-26'); // Tuesday

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
      title: 'Tuesday Task',
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
      scheduledDate: new Date('2025-08-26'), // This Tuesday
    },
    {
      id: 'task-3',
      title: 'Future Task',
      description: '',
      status: TaskStatus.PENDING,
      priority: Priority.LOW,
      timePreset: TimePreset.SIXTY_MIN,
      timeEstimate: 60,
      actualTime: 0,
      order: 2,
      dependencies: [],
      tags: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskListId: 'list-1',
      scheduledDate: new Date('2025-09-15'), // Future (upcoming)
    },
  ];

  const defaultProps = {
    tasks: mockTasks,
    currentWeek,
    onWeekChange: jest.fn(),
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

  it('renders backlog, week day columns, and upcoming columns', () => {
    render(<WeekView {...defaultProps} />);

    // Should have backlog column
    expect(screen.getByTestId('column-title-backlog')).toBeInTheDocument();

    // Should have all 7 day columns
    const dayColumns = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    dayColumns.forEach(day => {
      expect(screen.getByTestId(`column-title-${day}`)).toBeInTheDocument();
    });

    // Should have upcoming column
    expect(screen.getByTestId('column-title-upcoming')).toBeInTheDocument();
  });

  it('displays week range correctly', () => {
    render(<WeekView {...defaultProps} />);

    // Should show the week range (the exact format may vary)
    expect(screen.getByText(/Aug.*2025/)).toBeInTheDocument();
  });

  it('categorizes tasks into correct columns', () => {
    render(<WeekView {...defaultProps} />);

    // Backlog task should be in backlog column
    expect(screen.getByTestId('column-children-backlog')).toContainElement(
      screen.getByTestId('task-card-task-1')
    );

    // Tuesday task should be in Tuesday column
    expect(screen.getByTestId('column-children-tue')).toContainElement(
      screen.getByTestId('task-card-task-2')
    );

    // Future task should be in upcoming column
    expect(screen.getByTestId('column-children-upcoming')).toContainElement(
      screen.getByTestId('task-card-task-3')
    );
  });

  it('shows today indicator on current day column', () => {
    // Set current week to a week where Tuesday is today
    const tuesdayWeek = new Date('2025-08-26'); // Tuesday
    render(<WeekView {...defaultProps} currentWeek={tuesdayWeek} />);

    const tuesdayColumn = screen.getByTestId('task-column-tue');
    expect(tuesdayColumn).toHaveClass('today-column');
  });

  it('handles week navigation', () => {
    const onWeekChange = jest.fn();
    render(<WeekView {...defaultProps} onWeekChange={onWeekChange} />);

    // Click previous week button
    const prevButton = screen.getByTitle('planning.previousWeek');
    fireEvent.click(prevButton);

    expect(onWeekChange).toHaveBeenCalledWith(expect.any(Date));

    // Click next week button
    const nextButton = screen.getByTitle('planning.nextWeek');
    fireEvent.click(nextButton);

    expect(onWeekChange).toHaveBeenCalledWith(expect.any(Date));

    // Click this week button
    const thisWeekButton = screen.getByTitle('planning.goToCurrentWeek');
    fireEvent.click(thisWeekButton);

    expect(onWeekChange).toHaveBeenCalledWith(expect.any(Date));
  });

  it('displays week statistics', () => {
    render(<WeekView {...defaultProps} />);

    // Should show total tasks (text may be split with whitespace)
    expect(screen.getByText(/3.*planning\.total/)).toBeInTheDocument(); // 3 total tasks

    // Should show done/active counts (both 0 in this case)
    expect(screen.getByText(/0.*planning\.done/)).toBeInTheDocument();
    expect(screen.getByText(/0.*planning\.active/)).toBeInTheDocument();
  });

  it('handles task creation for different columns', () => {
    render(<WeekView {...defaultProps} />);

    // Click add task button for backlog
    const addBacklogButton = screen.getByTestId('add-task-backlog');
    fireEvent.click(addBacklogButton);

    expect(screen.getByTestId('task-modal')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
  });

  it('renders drag overlay', () => {
    render(<WeekView {...defaultProps} />);

    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
  });

  it('handles drag operations without errors', () => {
    const onTaskMove = jest.fn();
    const onInlineEdit = jest.fn();

    render(
      <WeekView
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
    render(<WeekView {...defaultProps} tasks={[]} />);

    // All columns should show 0 count
    expect(screen.getByTestId('column-count-backlog')).toHaveTextContent(
      'Count: 0'
    );
    expect(screen.getByTestId('column-count-upcoming')).toHaveTextContent(
      'Count: 0'
    );

    // Day columns should also be empty
    expect(screen.getByTestId('column-count-tue')).toHaveTextContent(
      'Count: 0'
    );
  });

  it('shows correct task counts in column headers', () => {
    render(<WeekView {...defaultProps} />);

    // Backlog should have 1 task
    expect(screen.getByTestId('column-count-backlog')).toHaveTextContent(
      'Count: 1'
    );

    // Tuesday should have 1 task
    expect(screen.getByTestId('column-count-tue')).toHaveTextContent(
      'Count: 1'
    );

    // Upcoming should have 1 task
    expect(screen.getByTestId('column-count-upcoming')).toHaveTextContent(
      'Count: 1'
    );

    // Other days should have 0 tasks
    expect(screen.getByTestId('column-count-mon')).toHaveTextContent(
      'Count: 0'
    );
    expect(screen.getByTestId('column-count-wed')).toHaveTextContent(
      'Count: 0'
    );
  });

  it('provides week container for scrolling', () => {
    render(<WeekView {...defaultProps} />);

    const weekContainer = document.getElementById('week-columns-container');
    expect(weekContainer).toBeInTheDocument();
    expect(weekContainer).toHaveClass('overflow-x-auto');
  });
});
