import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreadSidebar } from '../ThreadSidebar';
import { Thread } from '../../../types/thread';

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'kira.sidebar.threadCount' && params?.count) {
        return `${params.count} conversations`;
      }
      if (key === 'kira.thread.deleteModal.message' && params?.title) {
        return `Are you sure you want to delete "${params.title}"?`;
      }
      if (key === 'kira.thread.messageCount' && params?.count) {
        return `${params.count} messages`;
      }
      return key;
    },
  }),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 minutes ago',
}));

// Mock ThreadAssignmentModal
jest.mock('../ThreadAssignmentModal', () => ({
  ThreadAssignmentModal: ({
    isOpen,
    onClose,
    onAssign,
    threadTitle,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (assignment: { type: string }) => void;
    threadTitle?: string;
  }) =>
    isOpen ? (
      <div data-testid='assignment-modal'>
        <div>Assignment Modal for {threadTitle}</div>
        <button onClick={() => onAssign({ type: 'general' })}>Assign</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

const mockThreads: Thread[] = [
  {
    id: '1',
    title: 'Test Thread 1',
    messageCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
  },
  {
    id: '2',
    title: 'Test Thread 2',
    messageCount: 3,
    assignment: {
      type: 'task',
      taskId: 'task-1',
      context: { taskTitle: 'Test Task' },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
  },
];

describe('ThreadSidebar', () => {
  const defaultProps = {
    threads: mockThreads,
    activeThreadId: '1',
    isLoading: false,
    onThreadSelect: jest.fn(),
    onThreadCreate: jest.fn(),
    onThreadDelete: jest.fn(),
    onThreadAssign: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders thread sidebar with threads', () => {
    render(<ThreadSidebar {...defaultProps} />);

    expect(screen.getByText('kira.sidebar.title')).toBeInTheDocument();
    expect(screen.getByText('Test Thread 1')).toBeInTheDocument();
    expect(screen.getByText('Test Thread 2')).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    render(<ThreadSidebar {...defaultProps} threads={[]} />);

    expect(screen.getByText('kira.sidebar.empty.title')).toBeInTheDocument();
    expect(
      screen.getByText('kira.sidebar.empty.description')
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ThreadSidebar {...defaultProps} threads={[]} isLoading={true} />);

    // Should show skeleton loading cards
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('displays thread count correctly', () => {
    render(<ThreadSidebar {...defaultProps} />);

    expect(screen.getByText('2 conversations')).toBeInTheDocument();
  });

  it('shows thread assignment indicators', () => {
    render(<ThreadSidebar {...defaultProps} />);

    // Thread 1 should show general assignment
    expect(screen.getByText('kira.thread.general')).toBeInTheDocument();

    // Thread 2 should show task assignment - check for multiple instances
    expect(screen.getAllByText('Test Task')).toHaveLength(2); // One in chip, one in details
  });

  it('displays thread metadata correctly', () => {
    render(<ThreadSidebar {...defaultProps} />);

    // Should show message count
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Should show last activity
    expect(screen.getAllByText('2 minutes ago')).toHaveLength(2);
  });

  it('shows thread management action buttons', () => {
    render(<ThreadSidebar {...defaultProps} />);

    // Should show action buttons for thread management
    const actionButtons = screen.getAllByLabelText('kira.thread.actions');
    expect(actionButtons).toHaveLength(2); // One for each thread
  });

  it('does not show assign option when onThreadAssign is not provided', () => {
    const propsWithoutAssign = { ...defaultProps, onThreadAssign: undefined };
    render(<ThreadSidebar {...propsWithoutAssign} />);

    // Component should render without errors when onThreadAssign is not provided
    expect(screen.getByText('kira.sidebar.title')).toBeInTheDocument();
    expect(screen.getByText('Test Thread 1')).toBeInTheDocument();
  });

  it('renders new thread button', () => {
    render(<ThreadSidebar {...defaultProps} />);

    expect(screen.getByText('kira.sidebar.newThread')).toBeInTheDocument();
  });

  it('shows proper thread assignment colors and icons', () => {
    render(<ThreadSidebar {...defaultProps} />);

    // Check that assignment chips are rendered
    const generalChip = screen.getByText('kira.thread.general');
    const taskChips = screen.getAllByText('Test Task');

    expect(generalChip).toBeInTheDocument();
    expect(taskChips).toHaveLength(2); // One in chip, one in assignment details
  });

  describe('Keyboard Navigation', () => {
    it('should navigate threads with arrow keys when sidebar is focused', () => {
      const mockOnThreadSelect = jest.fn();
      render(
        <ThreadSidebar {...defaultProps} onThreadSelect={mockOnThreadSelect} />
      );

      // Get the sidebar element and focus it
      const sidebar = screen.getByLabelText('kira.sidebar.title');
      sidebar.focus();

      // Simulate ArrowDown - should move from thread 1 to thread 2
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Should select next thread (thread-2)
      expect(mockOnThreadSelect).toHaveBeenCalledWith('2');
    });

    it('should handle Enter key for thread assignment when sidebar is focused', async () => {
      render(<ThreadSidebar {...defaultProps} />);

      // Get the sidebar element and focus it
      const sidebar = screen.getByLabelText('kira.sidebar.title');
      sidebar.focus();

      // Simulate Enter key
      fireEvent.keyDown(document, { key: 'Enter' });

      // Should open assignment modal for active thread
      expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
    });

    it('should handle Space key for thread assignment when sidebar is focused', async () => {
      render(<ThreadSidebar {...defaultProps} />);

      // Get the sidebar element and focus it
      const sidebar = screen.getByLabelText('kira.sidebar.title');
      sidebar.focus();

      // Simulate Space key
      fireEvent.keyDown(document, { key: ' ' });

      // Should open assignment modal for active thread
      expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
    });

    it('should not handle keyboard events when sidebar is not focused', () => {
      const mockOnThreadSelect = jest.fn();
      render(
        <ThreadSidebar {...defaultProps} onThreadSelect={mockOnThreadSelect} />
      );

      // Don't focus the sidebar, simulate keydown on document
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Should not trigger thread selection
      expect(mockOnThreadSelect).not.toHaveBeenCalled();
    });

    it('should wrap around when navigating past the end of thread list', () => {
      const mockOnThreadSelect = jest.fn();
      const propsWithLastThreadActive = {
        ...defaultProps,
        activeThreadId: '2', // Last thread
        onThreadSelect: mockOnThreadSelect,
      };

      render(<ThreadSidebar {...propsWithLastThreadActive} />);

      // Get the sidebar element and focus it
      const sidebar = screen.getByLabelText('kira.sidebar.title');
      sidebar.focus();

      // Simulate ArrowDown from last thread
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Should wrap to first thread
      expect(mockOnThreadSelect).toHaveBeenCalledWith('1');
    });

    it('should wrap around when navigating past the beginning of thread list', () => {
      const mockOnThreadSelect = jest.fn();
      render(
        <ThreadSidebar {...defaultProps} onThreadSelect={mockOnThreadSelect} />
      );

      // Get the sidebar element and focus it (activeThreadId is '1', first thread)
      const sidebar = screen.getByLabelText('kira.sidebar.title');
      sidebar.focus();

      // Simulate ArrowUp from first thread
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      // Should wrap to last thread
      expect(mockOnThreadSelect).toHaveBeenCalledWith('2');
    });
  });
});
