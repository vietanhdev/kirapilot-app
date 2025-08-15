// Tests for TaskList component
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskList } from '../TaskList';
import { Task, TaskStatus, Priority } from '../../../types';

// Mock the drag and drop library
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((array, oldIndex, newIndex) => {
    const result = [...array];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
}));

// Mock SortableTaskCard
jest.mock('../SortableTaskCard', () => ({
  SortableTaskCard: ({ task, onEdit, onDelete, onStatusChange, onStartTimer }: any) => (
    <div data-testid={`sortable-task-${task.id}`}>
      <button onClick={() => onEdit?.(task)}>Edit {task.title}</button>
      <button onClick={() => onDelete?.(task)}>Delete {task.title}</button>
      <button onClick={() => onStatusChange?.(task, TaskStatus.COMPLETED)}>Complete {task.title}</button>
      <button onClick={() => onStartTimer?.(task)}>Start Timer {task.title}</button>
    </div>
  ),
}));

// Mock TaskCard
jest.mock('../TaskCard', () => ({
  TaskCard: ({ task, onEdit, onDelete, onStatusChange, onStartTimer }: any) => (
    <div data-testid={`task-${task.id}`}>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <span data-testid={`status-${task.id}`}>{task.status}</span>
      <span data-testid={`priority-${task.id}`}>{task.priority}</span>
      <button onClick={() => onEdit?.(task)}>Edit {task.title}</button>
      <button onClick={() => onDelete?.(task)}>Delete {task.title}</button>
      <button onClick={() => onStatusChange?.(task, TaskStatus.COMPLETED)}>Complete {task.title}</button>
      <button onClick={() => onStartTimer?.(task)}>Start Timer {task.title}</button>
    </div>
  ),
}));

// Mock TaskFiltersComponent
jest.mock('../TaskFilters', () => ({
  TaskFiltersComponent: ({ filters, onFiltersChange, onClearFilters }: any) => (
    <div data-testid="task-filters">
      <input
        data-testid="search-input"
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        placeholder="Search tasks..."
      />
      <button onClick={onClearFilters}>Clear Filters</button>
    </div>
  ),
}));

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Task 1',
    description: 'Description 1',
    priority: Priority.HIGH,
    status: TaskStatus.PENDING,
    dependencies: [],
    timeEstimate: 60,
    actualTime: 0,
    tags: ['work'],
    subtasks: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    title: 'Task 2',
    description: 'Description 2',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    dependencies: ['1'],
    timeEstimate: 30,
    actualTime: 15,
    tags: ['personal'],
    subtasks: [],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: '3',
    title: 'Task 3',
    description: 'Description 3',
    priority: Priority.LOW,
    status: TaskStatus.COMPLETED,
    dependencies: [],
    timeEstimate: 45,
    actualTime: 50,
    tags: ['work', 'urgent'],
    subtasks: [],
    completedAt: new Date('2024-01-03'),
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

describe('TaskList', () => {
  const defaultProps = {
    tasks: mockTasks,
    onTaskEdit: jest.fn(),
    onTaskDelete: jest.fn(),
    onTaskStatusChange: jest.fn(),
    onTaskStartTimer: jest.fn(),
    onTaskReorder: jest.fn(),
    onCreateTask: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task list with tasks', () => {
    render(<TaskList {...defaultProps} />);
    
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-3')).toBeInTheDocument();
  });

  it('displays task statistics correctly', () => {
    render(<TaskList {...defaultProps} />);
    
    // Check the stats in the header text
    expect(screen.getByText(/3 tasks • 1 completed • 1 in progress/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TaskList {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(<TaskList {...defaultProps} tasks={[]} />);
    
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first task.')).toBeInTheDocument();
  });

  it('calls onCreateTask when create button is clicked', () => {
    render(<TaskList {...defaultProps} />);
    
    const createButton = screen.getByText('New Task');
    fireEvent.click(createButton);
    
    expect(defaultProps.onCreateTask).toHaveBeenCalledTimes(1);
  });

  it('toggles between list and grid view', () => {
    render(<TaskList {...defaultProps} />);
    
    const gridButton = screen.getByTitle('Grid view');
    fireEvent.click(gridButton);
    
    // Should still show tasks but in grid layout
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('shows and hides filters', () => {
    render(<TaskList {...defaultProps} />);
    
    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);
    
    expect(screen.getByTestId('task-filters')).toBeInTheDocument();
  });

  it('filters tasks by search term', async () => {
    render(<TaskList {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);
    
    // Search for "Task 1"
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Task 1' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('sortable-task-1')).toBeInTheDocument();
      expect(screen.queryByTestId('sortable-task-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sortable-task-3')).not.toBeInTheDocument();
    });
  });

  it('shows no results when search has no matches', async () => {
    render(<TaskList {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);
    
    // Search for non-existent task
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Non-existent task' } });
    
    await waitFor(() => {
      expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
      // Use getAllByText to handle multiple "Clear Filters" buttons
      expect(screen.getAllByText('Clear Filters').length).toBeGreaterThan(0);
    });
  });

  it('calls task action handlers', () => {
    render(<TaskList {...defaultProps} />);
    
    // Test edit
    const editButton = screen.getByText('Edit Task 1');
    fireEvent.click(editButton);
    expect(defaultProps.onTaskEdit).toHaveBeenCalledWith(mockTasks[0]);
    
    // Test delete
    const deleteButton = screen.getByText('Delete Task 1');
    fireEvent.click(deleteButton);
    expect(defaultProps.onTaskDelete).toHaveBeenCalledWith(mockTasks[0]);
    
    // Test status change
    const completeButton = screen.getByText('Complete Task 1');
    fireEvent.click(completeButton);
    expect(defaultProps.onTaskStatusChange).toHaveBeenCalledWith(mockTasks[0], TaskStatus.COMPLETED);
    
    // Test start timer
    const timerButton = screen.getByText('Start Timer Task 1');
    fireEvent.click(timerButton);
    expect(defaultProps.onTaskStartTimer).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('uses sortable cards when drag and drop is enabled in list view', () => {
    render(<TaskList {...defaultProps} enableDragAndDrop={true} />);
    
    expect(screen.getByTestId('sortable-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-3')).toBeInTheDocument();
  });

  it('uses regular cards when drag and drop is disabled', () => {
    render(<TaskList {...defaultProps} enableDragAndDrop={false} />);
    
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('uses regular cards in grid view even with drag and drop enabled', () => {
    render(<TaskList {...defaultProps} enableDragAndDrop={true} />);
    
    // Switch to grid view
    const gridButton = screen.getByTitle('Grid view');
    fireEvent.click(gridButton);
    
    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-3')).toBeInTheDocument();
  });

  it('shows reorder indicator when drag and drop is enabled in list view', () => {
    render(<TaskList {...defaultProps} enableDragAndDrop={true} />);
    
    expect(screen.getByTitle('Drag and drop enabled')).toBeInTheDocument();
    expect(screen.getByText('Reorder')).toBeInTheDocument();
  });

  it('does not show reorder indicator in grid view', () => {
    render(<TaskList {...defaultProps} enableDragAndDrop={true} />);
    
    // Switch to grid view
    const gridButton = screen.getByTitle('Grid view');
    fireEvent.click(gridButton);
    
    expect(screen.queryByTitle('Drag and drop enabled')).not.toBeInTheDocument();
  });
});