import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Timer } from '../Timer';
import { Task, Priority, TaskStatus } from '../../../types';
import * as useTimerModule from '../../../hooks/useTimer';

// Mock the useTimer hook
const mockUseTimer = {
  activeSession: null,
  elapsedTime: 0,
  isRunning: false,
  isPaused: false,
  isLoading: false,
  error: null,
  startTimer: jest.fn(),
  pauseTimer: jest.fn(),
  resumeTimer: jest.fn(),
  stopTimer: jest.fn(),
  addBreak: jest.fn(),
  clearError: jest.fn(),
  formatElapsedTime: jest.fn(() => '00:00'),
  canStart: true,
  canPause: false,
  canResume: false,
  canStop: false,
  canAddBreak: false
};

jest.mock('../../../hooks/useTimer', () => ({
  useTimer: jest.fn(() => mockUseTimer)
}));

// Mock notifications
jest.mock('../../../services/notifications/TimerNotifications', () => ({
  timerNotifications: {
    requestPermission: jest.fn(() => Promise.resolve('granted')),
    clearAllBreakReminders: jest.fn()
  }
}));

const mockTask: Task = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Test Task',
  description: 'A test task for timer',
  priority: Priority.MEDIUM,
  status: TaskStatus.PENDING,
  dependencies: [],
  timeEstimate: 60,
  actualTime: 0,
  tags: [],
  subtasks: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('Timer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to default state
    Object.assign(mockUseTimer, {
      activeSession: null,
      elapsedTime: 0,
      isRunning: false,
      isPaused: false,
      isLoading: false,
      error: null,
      canStart: true,
      canPause: false,
      canResume: false,
      canStop: false,
      canAddBreak: false
    });
  });

  it('renders timer component with task info', () => {
    render(<Timer task={mockTask} />);
    
    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText(/Estimated: 60min/)).toBeInTheDocument();
  });

  it('shows start button when no active session', () => {
    render(<Timer task={mockTask} />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).not.toBeDisabled();
  });

  it('disables start button when no task is provided', () => {
    render(<Timer />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeDisabled();
  });

  it('calls startTimer when start button is clicked', async () => {
    render(<Timer task={mockTask} />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockUseTimer.startTimer).toHaveBeenCalledWith(mockTask, '');
    });
  });

  it('shows pause and stop buttons when timer is running', () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: '550e8400-e29b-41d4-a716-446655440101', 
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true,
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      canAddBreak: true
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument();
  });

  it('shows resume button when timer is paused', () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: '550e8400-e29b-41d4-a716-446655440102', 
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        breaks: [],
        pausedTime: 0
      },
      isRunning: false,
      isPaused: true,
      canStart: false,
      canPause: false,
      canResume: true,
      canStop: true,
      canAddBreak: false
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows break buttons when timer is running', () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true,
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      canAddBreak: true
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByRole('button', { name: '5min Break' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15min Break' })).toBeInTheDocument();
  });

  it('calls pauseTimer when pause button is clicked', async () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true,
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      canAddBreak: true
    });

    render(<Timer task={mockTask} />);
    
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseButton);
    
    await waitFor(() => {
      expect(mockUseTimer.pauseTimer).toHaveBeenCalled();
    });
  });

  it('calls resumeTimer when resume button is clicked', async () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: false,
      isPaused: true,
      canStart: false,
      canPause: false,
      canResume: true,
      canStop: true,
      canAddBreak: false
    });

    render(<Timer task={mockTask} />);
    
    const resumeButton = screen.getByRole('button', { name: /resume/i });
    fireEvent.click(resumeButton);
    
    await waitFor(() => {
      expect(mockUseTimer.resumeTimer).toHaveBeenCalled();
    });
  });

  it('calls stopTimer when stop button is clicked', async () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true,
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      canAddBreak: true
    });

    render(<Timer task={mockTask} />);
    
    const stopButton = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(mockUseTimer.stopTimer).toHaveBeenCalledWith('');
    });
  });

  it('calls addBreak when break button is clicked', async () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true,
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      canAddBreak: true
    });

    render(<Timer task={mockTask} />);
    
    const shortBreakButton = screen.getAllByRole('button', { name: /5min break/i })[0];
    fireEvent.click(shortBreakButton);
    
    await waitFor(() => {
      expect(mockUseTimer.addBreak).toHaveBeenCalledWith('Short break', 5 * 60 * 1000);
    });
  });

  it('shows and hides notes section', () => {
    render(<Timer task={mockTask} />);
    
    const notesButton = screen.getByRole('button', { name: /session notes/i });
    expect(screen.queryByPlaceholderText(/add notes/i)).not.toBeInTheDocument();
    
    fireEvent.click(notesButton);
    expect(screen.getByPlaceholderText(/add notes/i)).toBeInTheDocument();
    
    fireEvent.click(notesButton);
    expect(screen.queryByPlaceholderText(/add notes/i)).not.toBeInTheDocument();
  });

  it('updates notes when typing in textarea', () => {
    render(<Timer task={mockTask} />);
    
    const notesButton = screen.getByRole('button', { name: /session notes/i });
    fireEvent.click(notesButton);
    
    const textarea = screen.getByPlaceholderText(/add notes/i);
    fireEvent.change(textarea, { target: { value: 'Test notes' } });
    
    expect(textarea).toHaveValue('Test notes');
  });

  it('displays error message when error occurs', () => {
    Object.assign(mockUseTimer, {
      error: 'Test error message'
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('clears error when close button is clicked', async () => {
    Object.assign(mockUseTimer, {
      error: 'Test error message'
    });

    render(<Timer task={mockTask} />);
    
    const closeButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(mockUseTimer.clearError).toHaveBeenCalled();
    });
  });

  it('shows running status indicator', () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isRunning: true
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows paused status indicator', () => {
    Object.assign(mockUseTimer, {
      activeSession: { 
        id: 'session-1', 
        taskId: 'task-1',
        breaks: [],
        pausedTime: 0
      },
      isPaused: true
    });

    render(<Timer task={mockTask} />);
    
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('displays formatted elapsed time', () => {
    mockUseTimer.formatElapsedTime.mockReturnValue('25:30');
    
    render(<Timer task={mockTask} />);
    
    expect(screen.getByText('25:30')).toBeInTheDocument();
  });

  it('calls onSessionStart callback when provided', async () => {
    const onSessionStart = jest.fn();
    mockUseTimer.startTimer.mockResolvedValue(true);
    
    render(<Timer task={mockTask} onSessionStart={onSessionStart} />);
    
    // The callback should be passed to useTimer hook
    expect(useTimerModule.useTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        onSessionStart
      })
    );
  });

  it('shows loading state on buttons when loading', () => {
    Object.assign(mockUseTimer, {
      isLoading: true
    });

    render(<Timer task={mockTask} />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeDisabled();
  });
});