import { renderHook, act, waitFor } from '@testing-library/react';
import { useThreadMessages } from '../useThreadMessages';
import { ThreadService } from '../../services/database/repositories/ThreadService';
import { useAI } from '../../contexts/AIContext';
import { TaskService } from '../../services/database/repositories/TaskService';
import { ThreadMessage, ThreadAssignment } from '../../types/thread';
import { AIResponse, AppContext } from '../../types';

// Mock the dependencies
jest.mock('../../services/database/repositories/ThreadService');
jest.mock('../../services/database/repositories/TaskService');
jest.mock('../../contexts/AIContext');

const mockThreadService = ThreadService as jest.MockedClass<
  typeof ThreadService
>;
const mockTaskService = TaskService as jest.MockedClass<typeof TaskService>;
const mockUseAI = useAI as jest.MockedFunction<typeof useAI>;

describe('useThreadMessages', () => {
  const mockThreadId = 'thread-123';
  const mockTaskId = 'task-456';

  const mockThreadServiceInstance = {
    findMessages: jest.fn(),
    createMessage: jest.fn(),
  };

  const mockAIContext = {
    sendMessage: jest.fn(),
    isLoading: false,
    modelManager: null,
    aiService: null,
    currentModelType: 'gemini' as const,
    isInitialized: true,
    error: null,
    conversations: [],
    suggestions: [],
    switchModel: jest.fn(),
    clearConversation: jest.fn(),
    dismissSuggestion: jest.fn(),
    applySuggestion: jest.fn(),
    analyzePatterns: jest.fn(),
    initializeWithApiKey: jest.fn(),
    reinitializeAI: jest.fn(),
    getModelStatus: jest.fn(),
    getAvailableModels: jest.fn(),
    initializeService: jest.fn(),
    getServiceStatus: jest.fn(),
    getAllServiceStatuses: jest.fn(),
    isServiceAvailable: jest.fn(),
    cleanup: jest.fn(),
    getInteractionDetails: jest.fn(),
    submitFeedback: jest.fn(),
    getFeedbackSummary: jest.fn(),
  };

  const mockTaskServiceInstance = {
    findById: jest.fn(),
    findScheduledBetween: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockThreadService.mockImplementation(
      () => mockThreadServiceInstance as unknown as ThreadService
    );
    mockTaskService.mockImplementation(
      () => mockTaskServiceInstance as unknown as TaskService
    );
    mockUseAI.mockReturnValue(mockAIContext as ReturnType<typeof useAI>);
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useThreadMessages());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load messages when threadId is provided', async () => {
      const mockMessages: ThreadMessage[] = [
        {
          id: 'msg-1',
          threadId: mockThreadId,
          type: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
      ];

      mockThreadServiceInstance.findMessages.mockResolvedValue(mockMessages);

      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      await waitFor(() => {
        expect(result.current.messages).toEqual(mockMessages);
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockThreadServiceInstance.findMessages).toHaveBeenCalledWith(
        mockThreadId
      );
    });
  });

  describe('sendMessage', () => {
    const mockUserMessage: ThreadMessage = {
      id: 'msg-user',
      threadId: mockThreadId,
      type: 'user',
      content: 'Test message',
      timestamp: new Date(),
    };

    const mockAIMessage: ThreadMessage = {
      id: 'msg-ai',
      threadId: mockThreadId,
      type: 'assistant',
      content: 'AI response',
      timestamp: new Date(),
    };

    const mockAIResponse: AIResponse = {
      message: 'AI response',
      actions: [],
      suggestions: [],
      context: {} as AppContext,
      reasoning: 'Test reasoning',
    };

    beforeEach(() => {
      mockThreadServiceInstance.createMessage
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAIMessage);
      mockAIContext.sendMessage.mockResolvedValue(mockAIResponse);
    });

    it('should send a message and get AI response', async () => {
      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      let aiMessage: ThreadMessage | null = null;
      await act(async () => {
        aiMessage = await result.current.sendMessage('Test message');
      });

      expect(aiMessage).toEqual(mockAIMessage);
      expect(result.current.messages).toContain(mockUserMessage);
      expect(result.current.messages).toContain(mockAIMessage);
      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle task assignment context', async () => {
      const mockTask = {
        id: mockTaskId,
        title: 'Test Task',
        description: 'Task description',
        priority: 1,
        status: 'pending',
        order: 0,
        dependencies: [],
        timePreset: 30,
        timeEstimate: 30,
        actualTime: 0,
        tags: [],
        taskListId: 'list-1',
        subtasks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTaskServiceInstance.findById.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      const assignment: ThreadAssignment = {
        type: 'task',
        taskId: mockTaskId,
      };

      await act(async () => {
        await result.current.sendMessage('Test message', assignment);
      });

      expect(mockTaskServiceInstance.findById).toHaveBeenCalledWith(mockTaskId);
      expect(mockAIContext.sendMessage).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          currentTask: mockTask,
        })
      );
    });

    it('should handle errors when no thread is selected', async () => {
      const { result } = renderHook(() => useThreadMessages());

      let aiMessage: ThreadMessage | null = null;
      await act(async () => {
        aiMessage = await result.current.sendMessage('Test message');
      });

      expect(aiMessage).toBeNull();
      expect(result.current.error?.message).toBe('No thread selected');
    });

    it('should handle AI service errors', async () => {
      mockAIContext.sendMessage.mockResolvedValue(null);

      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      let aiMessage: ThreadMessage | null = null;
      await act(async () => {
        aiMessage = await result.current.sendMessage('Test message');
      });

      expect(aiMessage).toBeNull();
      expect(result.current.error?.message).toBe('Failed to get AI response');
    });
  });

  describe('utility functions', () => {
    it('should clear messages', () => {
      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it('should clear errors', async () => {
      mockThreadServiceInstance.findMessages.mockRejectedValue(
        new Error('Test error')
      );

      const { result } = renderHook(() => useThreadMessages(mockThreadId));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
