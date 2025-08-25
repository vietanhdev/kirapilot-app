import { render, screen } from '@testing-library/react';
import { TaskColumn } from '../TaskColumn';
import { Archive } from 'lucide-react';
// Mock the DnD Kit components
jest.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    isOver: false,
    setNodeRef: jest.fn(),
  }),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: {},
}));

// Mock translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('TaskColumn', () => {
  const defaultProps = {
    title: 'Test Column',
    subtitle: 'Test Subtitle',
    count: 2,
    color: 'blue' as const,
    icon: Archive,
    onAddTask: jest.fn(),
  };

  it('renders column title and count', () => {
    render(
      <TaskColumn {...defaultProps}>
        <div>Task 1</div>
        <div>Task 2</div>
      </TaskColumn>
    );

    expect(screen.getByText('Test Column')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    render(
      <TaskColumn {...defaultProps}>
        <div>Task 1</div>
        <div>Task 2</div>
      </TaskColumn>
    );

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('calls onAddTask when add button is clicked', () => {
    const onAddTask = jest.fn();
    render(
      <TaskColumn {...defaultProps} onAddTask={onAddTask}>
        <div>Task 1</div>
      </TaskColumn>
    );

    const addButton = screen.getByTitle('planning.addTask');
    addButton.click();

    expect(onAddTask).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no tasks', () => {
    render(
      <TaskColumn {...defaultProps} count={0}>
        <div></div>
      </TaskColumn>
    );

    expect(screen.getByText('planning.noTasks')).toBeInTheDocument();
    expect(screen.getByText('planning.dragTasksHere')).toBeInTheDocument();
  });

  it('applies today styling when isToday is true', () => {
    render(
      <TaskColumn {...defaultProps} isToday={true}>
        <div>Task 1</div>
      </TaskColumn>
    );

    const titleElement = screen.getByText('Test Column');
    expect(titleElement).toBeInTheDocument();
  });

  it('uses custom column width when provided', () => {
    const { container } = render(
      <TaskColumn {...defaultProps} columnWidth={300}>
        <div>Task 1</div>
      </TaskColumn>
    );

    const columnElement = container.firstChild as HTMLElement;
    expect(columnElement).toHaveStyle('width: 300px');
  });

  it('uses custom column height when provided', () => {
    render(
      <TaskColumn {...defaultProps} columnHeight={500}>
        <div>Task 1</div>
      </TaskColumn>
    );

    // The height is applied to the drop zone div
    const dropZone = screen.getByText('Task 1').closest('[style*="height"]');
    expect(dropZone).toHaveStyle('height: 500px');
  });
});
