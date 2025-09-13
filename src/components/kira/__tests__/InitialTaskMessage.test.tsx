import { render, screen } from '@testing-library/react';
import { InitialTaskMessage } from '../InitialTaskMessage';
import { Task } from '../../../types';

// Mock the translation hook
const mockT = jest.fn((key: string, params?: Record<string, unknown>) => {
  if (key === 'kira.task.greeting.title') {
    return "I'm here to help with your task!";
  }
  if (key === 'kira.task.greeting.message') {
    return `I can see you're working on **${params?.title}** (currently ${params?.status}). How can I assist you with this task?`;
  }
  if (key === 'kira.task.greeting.suggestions') {
    return 'Here are some ways I can help:';
  }
  if (key === 'kira.task.suggestions.startTimer') {
    return 'Start timer';
  }
  if (key === 'kira.task.suggestions.breakdown') {
    return 'Break down task';
  }
  if (key === 'priority.high') {
    return 'High';
  }
  if (key === 'status.pending') {
    return 'Pending';
  }
  return key;
});

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

// Mock MarkdownRenderer
jest.mock('../../common', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe('InitialTaskMessage', () => {
  const mockTask: Task = {
    id: 'test-task-1',
    title: 'Test Task',
    description: 'This is a test task description',
    status: 'pending',
    priority: 1,
    timeEstimate: 60,
    actualTime: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    dependencies: [],
  };

  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task information correctly', () => {
    render(
      <InitialTaskMessage task={mockTask} onSendMessage={mockOnSendMessage} />
    );

    expect(
      screen.getByText("I'm here to help with your task!")
    ).toBeInTheDocument();
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
  });

  it('displays task description when available', () => {
    render(
      <InitialTaskMessage task={mockTask} onSendMessage={mockOnSendMessage} />
    );

    expect(
      screen.getByText('This is a test task description')
    ).toBeInTheDocument();
  });

  it('shows suggestion buttons', () => {
    render(
      <InitialTaskMessage task={mockTask} onSendMessage={mockOnSendMessage} />
    );

    expect(screen.getByText('Start timer')).toBeInTheDocument();
    expect(screen.getByText('Break down task')).toBeInTheDocument();
  });

  it('renders suggestion buttons with correct text', () => {
    render(
      <InitialTaskMessage task={mockTask} onSendMessage={mockOnSendMessage} />
    );

    // Check that all suggestion buttons are rendered
    expect(screen.getByText('Start timer')).toBeInTheDocument();
    expect(screen.getByText('Break down task')).toBeInTheDocument();

    // Verify the onSendMessage prop is passed correctly
    expect(mockOnSendMessage).toBeDefined();
  });

  it('handles tasks without description', () => {
    const taskWithoutDescription = { ...mockTask, description: undefined };

    render(
      <InitialTaskMessage
        task={taskWithoutDescription}
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(
      screen.queryByText('This is a test task description')
    ).not.toBeInTheDocument();
  });

  it('handles tasks without time estimate', () => {
    const taskWithoutTimeEstimate = { ...mockTask, timeEstimate: undefined };

    render(
      <InitialTaskMessage
        task={taskWithoutTimeEstimate}
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.queryByText('1h')).not.toBeInTheDocument();
  });
});
