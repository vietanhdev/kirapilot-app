import { renderHook, act } from '@testing-library/react';
import { useThreads } from '../useThreads';
import { Thread, ThreadAssignment } from '../../types/thread';

// Create mock instance methods
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

// Mock the ThreadService module
jest.mock('../../services/database/repositories/ThreadService', () => {
  return {
    ThreadService: jest.fn().mockImplementation(() => ({
      findAll: mockFindAll,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    })),
  };
});

// Mock the database health checker and error handling
jest.mock('../../utils/kiraErrorHandling', () => ({
  processKiraError: jest.fn(error => error),
  shouldAutoRetry: jest.fn(() => false),
  getRetryDelay: jest.fn(() => 1000),
  globalDatabaseHealthChecker: {
    checkHealth: jest.fn(() => Promise.resolve(true)),
  },
}));

describe('useThreads', () => {
  const mockThread: Thread = {
    id: 'test-thread-1',
    title: 'Test Thread',
    messageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    mockFindAll.mockResolvedValue([]);
    mockFindById.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockThread);
    mockUpdate.mockResolvedValue(mockThread);
    mockDelete.mockResolvedValue(true);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useThreads());

    expect(result.current.threads).toEqual([]);
    expect(result.current.activeThread).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should create a new thread', async () => {
    mockCreate.mockResolvedValue(mockThread);

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      const thread = await result.current.createThread();
      expect(thread).toEqual(mockThread);
    });

    expect(mockCreate).toHaveBeenCalledWith({ assignment: undefined });
    expect(result.current.threads).toContain(mockThread);
    expect(result.current.activeThread).toEqual(mockThread);
  });

  it('should create a thread with assignment', async () => {
    const assignment: ThreadAssignment = {
      type: 'task',
      taskId: 'task-1',
    };

    mockCreate.mockResolvedValue(mockThread);

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      await result.current.createThread(assignment);
    });

    expect(mockCreate).toHaveBeenCalledWith({ assignment });
  });

  it('should select a thread', async () => {
    mockFindById.mockResolvedValue(mockThread);

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      await result.current.selectThread('test-thread-1');
    });

    expect(mockFindById).toHaveBeenCalledWith('test-thread-1');
    expect(result.current.activeThread).toEqual(mockThread);
  });

  it('should delete a thread', async () => {
    mockDelete.mockResolvedValue(undefined);
    mockFindAll.mockResolvedValue([mockThread]);

    const { result } = renderHook(() => useThreads());

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteThread('test-thread-1');
    });

    expect(success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('test-thread-1');
    expect(result.current.threads).not.toContain(mockThread);
  });

  it('should handle errors gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('Database error'));

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      const thread = await result.current.createThread();
      expect(thread).toBeNull();
    });

    expect(result.current.error?.message).toBe('Database error');
  });

  it('should clear errors', async () => {
    mockCreate.mockRejectedValue(new Error('Database error'));

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      await result.current.createThread();
    });

    expect(result.current.error?.message).toBe('Database error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should clear active thread', async () => {
    mockFindById.mockResolvedValue(mockThread);

    const { result } = renderHook(() => useThreads());

    // First select a thread
    await act(async () => {
      await result.current.selectThread('test-thread-1');
    });

    expect(result.current.activeThread).toEqual(mockThread);

    // Then clear it
    act(() => {
      result.current.clearActiveThread();
    });

    expect(result.current.activeThread).toBeNull();
  });

  it('should select first thread when deleting active thread', async () => {
    const mockThread2: Thread = {
      id: 'test-thread-2',
      title: 'Test Thread 2',
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDelete.mockResolvedValue(undefined);
    mockFindAll.mockResolvedValue([mockThread, mockThread2]);

    const { result } = renderHook(() => useThreads());

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Set active thread to the first one
    await act(async () => {
      // First we need to mock findById to return the thread
      mockFindById.mockResolvedValue(mockThread);
      await result.current.selectThread('test-thread-1');
    });

    // Delete the active thread
    await act(async () => {
      await result.current.deleteThread('test-thread-1');
    });

    expect(mockDelete).toHaveBeenCalledWith('test-thread-1');
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0]).toEqual(mockThread2);
    expect(result.current.activeThread).toEqual(mockThread2);
  });

  it('should handle thread not found during selection', async () => {
    mockFindById.mockResolvedValue(null);

    const { result } = renderHook(() => useThreads());

    await act(async () => {
      await result.current.selectThread('non-existent-thread');
    });

    expect(mockFindById).toHaveBeenCalledWith('non-existent-thread');
    expect(mockFindAll).toHaveBeenCalledTimes(2); // Once on mount, once on error
    expect(result.current.error?.message).toBe('Thread not found');
    expect(result.current.activeThread).toBeNull();
  });
});
