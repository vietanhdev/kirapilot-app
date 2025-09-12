import { render, screen, fireEvent } from '@testing-library/react';
import { MessageList } from '../MessageList';
import { ThreadMessage, ThreadAssignment } from '../../../types/thread';
import { TestWrapper } from '../../../__tests__/setup/testWrapper';

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Date.prototype.toLocaleTimeString to return consistent format
const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
beforeAll(() => {
  Date.prototype.toLocaleTimeString = jest.fn().mockImplementation(function (
    this: Date
  ) {
    // Mock specific timestamps for consistent testing
    if (this.getTime() === new Date('2024-01-01T10:00:00Z').getTime()) {
      return '5:00:00 PM';
    }
    if (this.getTime() === new Date('2024-01-01T10:01:00Z').getTime()) {
      return '5:01:00 PM';
    }
    // Fallback to original implementation for other dates
    return originalToLocaleTimeString.call(this);
  });
});

afterAll(() => {
  Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
});

// Mock the auto-scroll hook
jest.mock('../../../hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({
    scrollRef: { current: null },
    scrollToBottom: jest.fn(),
  }),
}));

// Mock the MarkdownRenderer component
jest.mock('../../common/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid='markdown-content'>{content}</div>
  ),
}));

// Mock HeroUI components that cause issues in tests
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  Tooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: string;
  }) => <div title={content}>{children}</div>,
  Button: ({
    children,
    onPress,
    title,
    ...props
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    title?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onPress} title={title} {...props}>
      {children}
    </button>
  ),
}));

// Mock the MessageSkeleton component
jest.mock('../../common/MessageSkeleton', () => ({
  MessageSkeleton: () => (
    <div className='animate-pulse' data-testid='message-skeleton'>
      Loading...
    </div>
  ),
}));

// Mock the ContextualActionButtons component
jest.mock('../../ai/ContextualActionButtons', () => ({
  ContextualActionButtons: ({
    onActionPerformed,
  }: {
    onActionPerformed: (action: string, data?: unknown) => void;
  }) => (
    <div data-testid='contextual-action-buttons'>
      <button
        onClick={() => onActionPerformed('test-action', { test: 'data' })}
      >
        Test Action
      </button>
    </div>
  ),
}));

const mockUserMessage: ThreadMessage = {
  id: 'msg-1',
  threadId: 'thread-1',
  type: 'user',
  content: 'Hello, can you help me with my tasks?',
  timestamp: new Date('2024-01-01T10:00:00Z'),
};

const mockAssistantMessage: ThreadMessage = {
  id: 'msg-2',
  threadId: 'thread-1',
  type: 'assistant',
  content: 'Of course! I can help you manage your tasks.',
  reasoning: 'The user is asking for help with task management.',
  actions: [
    {
      type: 'CREATE_TASK',
      parameters: { title: 'New Task' },
      context: {},
      confidence: 85,
      reasoning: 'User might want to create a new task',
    },
  ],
  toolExecutions: [
    {
      toolName: 'task_manager',
      parameters: { action: 'list' },
      reasoning: 'Listing current tasks',
      result: 'Found 3 tasks',
      executionTime: 150,
      userConfirmed: true,
      impactLevel: 'low',
      resourcesAccessed: ['tasks'],
      permissions: ['read'],
    },
  ],
  timestamp: new Date('2024-01-01T10:01:00Z'),
};

const mockThreadAssignment: ThreadAssignment = {
  type: 'task',
  taskId: 'task-123',
};

describe('MessageList', () => {
  it('renders empty state when no messages', () => {
    render(
      <TestWrapper>
        <MessageList messages={[]} isLoading={false} />
      </TestWrapper>
    );

    expect(screen.getByText('kira.chat.noMessages')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading', () => {
    render(
      <TestWrapper>
        <MessageList messages={[]} isLoading={true} />
      </TestWrapper>
    );

    // Should show loading skeletons
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders user message correctly', () => {
    render(
      <TestWrapper>
        <MessageList messages={[mockUserMessage]} isLoading={false} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Hello, can you help me with my tasks?')
    ).toBeInTheDocument();
    expect(screen.getByText('5:00:00 PM')).toBeInTheDocument();
  });

  it('renders assistant message with all components', () => {
    render(
      <TestWrapper>
        <MessageList messages={[mockAssistantMessage]} isLoading={false} />
      </TestWrapper>
    );

    // Main content
    expect(
      screen.getByText('Of course! I can help you manage your tasks.')
    ).toBeInTheDocument();

    // Reasoning section
    expect(
      screen.getByText('The user is asking for help with task management.')
    ).toBeInTheDocument();

    // Actions section
    expect(screen.getByText(/action: create task/i)).toBeInTheDocument();
    expect(screen.getByText('85% confidence')).toBeInTheDocument();

    // Tool executions section
    expect(screen.getByText('Tool: task_manager')).toBeInTheDocument();
    expect(screen.getByText('Found 3 tasks')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();

    // Contextual action buttons
    expect(screen.getByTestId('contextual-action-buttons')).toBeInTheDocument();
  });

  it('shows message details when details button is clicked', () => {
    render(
      <TestWrapper>
        <MessageList messages={[mockAssistantMessage]} isLoading={false} />
      </TestWrapper>
    );

    // Click the details button
    const detailsButton = screen.getByTitle('common.viewDetails');
    fireEvent.click(detailsButton);

    // Should show message ID and metadata
    expect(screen.getByText(/ID: msg-2/)).toBeInTheDocument();
    expect(screen.getByText('Has reasoning')).toBeInTheDocument();
    expect(screen.getByText('1 actions')).toBeInTheDocument();
    expect(screen.getByText('1 tools')).toBeInTheDocument();
  });

  it('shows thread assignment in details when assigned', () => {
    render(
      <TestWrapper>
        <MessageList
          messages={[mockAssistantMessage]}
          isLoading={false}
          threadAssignment={mockThreadAssignment}
        />
      </TestWrapper>
    );

    // Click the details button
    const detailsButton = screen.getByTitle('common.viewDetails');
    fireEvent.click(detailsButton);

    // Should show assignment info
    expect(screen.getByText('Assigned to task')).toBeInTheDocument();
  });

  it('handles contextual action button clicks', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    render(
      <TestWrapper>
        <MessageList messages={[mockAssistantMessage]} isLoading={false} />
      </TestWrapper>
    );

    // Click the test action button
    const actionButton = screen.getByText('Test Action');
    fireEvent.click(actionButton);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Action performed in thread:',
      'test-action',
      { test: 'data' }
    );

    consoleSpy.mockRestore();
  });

  it('only shows contextual action buttons for assistant messages', () => {
    render(
      <TestWrapper>
        <MessageList
          messages={[mockUserMessage, mockAssistantMessage]}
          isLoading={false}
        />
      </TestWrapper>
    );

    // Should only have one set of contextual action buttons (for assistant message)
    expect(screen.getAllByTestId('contextual-action-buttons')).toHaveLength(1);
  });
});
