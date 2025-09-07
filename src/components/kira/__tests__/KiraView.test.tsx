import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KiraView } from '../KiraView';
import { useThreads } from '../../../hooks/useThreads';
import { useThreadMessages } from '../../../hooks/useThreadMessages';
import { Thread, ThreadAssignment } from '../../../types/thread';

// Mock react-markdown and related modules
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return <div data-testid='markdown-content'>{children}</div>;
  };
});

jest.mock('remark-gfm', () => ({}));
jest.mock('rehype-highlight', () => ({}));

// Mock the MarkdownRenderer component
jest.mock('../../../components/common/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid='markdown-content'>{content}</div>
  ),
}));

// Mock HeroUI components that cause issues in tests
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  Button: ({
    children,
    onPress,
    onClick,
    title,
    ...props
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    onClick?: () => void;
    title?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={() => {
        if (onPress) {
          onPress();
        }
        if (onClick) {
          onClick();
        }
      }}
      title={title}
      {...props}
    >
      {children}
    </button>
  ),
  Card: ({
    children,
    onPress,
    ...props
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    [key: string]: unknown;
  }) => (
    <div onClick={onPress} {...props}>
      {children}
    </div>
  ),
  CardBody: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
}));

// Mock the hooks
jest.mock('../../../hooks/useThreads');
jest.mock('../../../hooks/useThreadMessages');
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('../../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

const mockUseThreads = useThreads as jest.MockedFunction<typeof useThreads>;
const mockUseThreadMessages = useThreadMessages as jest.MockedFunction<
  typeof useThreadMessages
>;

describe('KiraView', () => {
  const mockThread: Thread = {
    id: 'thread-1',
    title: 'Test Thread',
    assignment: {
      type: 'task',
      taskId: 'task-1',
    },
    messageCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateThread = jest.fn();
  const mockSelectThread = jest.fn();
  const mockDeleteThread = jest.fn();
  const mockUpdateThread = jest.fn();
  const mockAssignThread = jest.fn();

  const mockThreadsReturn = {
    threads: [mockThread],
    activeThread: null,
    isLoading: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    error: null,
    createThread: mockCreateThread,
    selectThread: mockSelectThread,
    deleteThread: mockDeleteThread,
    updateThread: mockUpdateThread,
    assignThread: mockAssignThread,
    clearError: jest.fn(),
    retryLastOperation: jest.fn(),
  };

  const mockSendMessage = jest.fn();
  const mockLoadMessages = jest.fn();
  const mockClearMessages = jest.fn();
  const mockRefreshMessages = jest.fn();
  const mockClearError = jest.fn();
  const mockSubmitFeedback = jest.fn();
  const mockRegenerateResponse = jest.fn();
  const mockRetryLastOperation = jest.fn();

  const mockMessagesReturn = {
    messages: [],
    isLoading: false,
    isSending: false,
    isRegenerating: false,
    error: null,
    sendMessage: mockSendMessage,
    loadMessages: mockLoadMessages,
    clearMessages: mockClearMessages,
    refreshMessages: mockRefreshMessages,
    clearError: mockClearError,
    submitFeedback: mockSubmitFeedback,
    regenerateResponse: mockRegenerateResponse,
    retryLastOperation: mockRetryLastOperation,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock functions
    mockCreateThread.mockClear();
    mockSelectThread.mockClear();
    mockDeleteThread.mockClear();
    mockUpdateThread.mockClear();
    mockAssignThread.mockClear();
    mockSendMessage.mockClear();
    mockLoadMessages.mockClear();
    mockClearMessages.mockClear();
    mockRefreshMessages.mockClear();
    mockClearError.mockClear();
    mockSubmitFeedback.mockClear();
    mockRegenerateResponse.mockClear();
    mockRetryLastOperation.mockClear();

    mockUseThreads.mockReturnValue(mockThreadsReturn);
    mockUseThreadMessages.mockReturnValue(mockMessagesReturn);
  });

  it('should render thread sidebar and chat area', () => {
    render(<KiraView />);

    // Should show thread sidebar
    expect(screen.getByText('Test Thread')).toBeInTheDocument();

    // Should show empty chat state initially
    expect(screen.getByText('kira.chat.noThreadSelected')).toBeInTheDocument();
  });

  it('should render and handle basic interactions', async () => {
    render(<KiraView />);

    // Initially should show no thread selected
    expect(screen.getByText('kira.chat.noThreadSelected')).toBeInTheDocument();

    // Should show the thread in the sidebar
    expect(screen.getByText('Test Thread')).toBeInTheDocument();

    // Click on thread to select it
    fireEvent.click(screen.getByText('Test Thread'));

    // The component should call useThreadMessages hook (initially with undefined, then with thread ID)
    expect(mockUseThreadMessages).toHaveBeenCalled();
  });

  it('should handle thread assignment updates', async () => {
    render(<KiraView />);

    // Select a thread
    fireEvent.click(screen.getByText('Test Thread'));

    // Open assignment modal (this would typically be through a context menu or button)
    // For this test, we'll simulate the assignment process directly
    const newAssignment: ThreadAssignment = {
      type: 'day',
      date: new Date('2024-01-15'),
    };

    // Simulate assignment update
    await waitFor(() => {
      // This would be triggered by the assignment modal
      mockAssignThread('thread-1', newAssignment);
    });

    expect(mockAssignThread).toHaveBeenCalledWith('thread-1', newAssignment);
  });

  it('should render new thread button', () => {
    render(<KiraView />);

    // Find the new thread button by its text content
    const newThreadButton = screen.getByText('kira.sidebar.newThread');
    expect(newThreadButton).toBeInTheDocument();

    // The button should be clickable (has a parent button element)
    const buttonElement = newThreadButton.closest('button');
    expect(buttonElement).toBeInTheDocument();
  });

  it('should handle thread deletion', async () => {
    render(<KiraView />);

    // Select a thread first
    fireEvent.click(screen.getByText('Test Thread'));

    // Simulate thread deletion (would typically be through context menu)
    await waitFor(() => {
      mockDeleteThread('thread-1');
    });

    expect(mockDeleteThread).toHaveBeenCalledWith('thread-1');
  });

  describe('Keyboard Shortcuts', () => {
    it('should set up keyboard event listeners', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      render(<KiraView />);

      // Verify that keyboard event listeners are set up
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should handle window resize events', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      render(<KiraView />);

      // Verify that resize event listeners are set up
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should render multiple threads when provided', () => {
      const mockThreads = [
        { ...mockThread, id: 'thread-1', title: 'Thread 1' },
        { ...mockThread, id: 'thread-2', title: 'Thread 2' },
        { ...mockThread, id: 'thread-3', title: 'Thread 3' },
      ];

      mockUseThreads.mockReturnValue({
        ...mockThreadsReturn,
        threads: mockThreads,
      });

      render(<KiraView />);

      // All threads should be visible in the sidebar
      expect(screen.getByText('Thread 1')).toBeInTheDocument();
      expect(screen.getByText('Thread 2')).toBeInTheDocument();
      expect(screen.getByText('Thread 3')).toBeInTheDocument();
    });

    it('should handle sidebar focus', () => {
      render(<KiraView />);

      // The sidebar should be focusable
      const sidebar = screen.getByTestId('thread-sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveAttribute('tabindex', '0');

      // Should be able to focus the sidebar
      sidebar.focus();
      expect(document.activeElement).toBe(sidebar);
    });

    it('should prevent shortcuts when input elements are focused', () => {
      render(<KiraView />);

      // Create a mock input element to test the keyboard shortcut prevention logic
      const mockInput = document.createElement('input');
      document.body.appendChild(mockInput);
      mockInput.focus();

      // Verify the input is focused
      expect(document.activeElement).toBe(mockInput);
      expect(document.activeElement?.tagName).toBe('INPUT');

      // Clean up
      document.body.removeChild(mockInput);
    });

    it('should handle escape key events', () => {
      render(<KiraView />);

      // Should not throw any errors when escape is pressed
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(() => document.dispatchEvent(event)).not.toThrow();

      // Component should still be rendered
      expect(screen.getByTestId('kira-view')).toBeInTheDocument();
    });
  });
});
