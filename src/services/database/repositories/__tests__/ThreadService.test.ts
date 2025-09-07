import { ThreadService } from '../ThreadService';
import { invoke } from '@tauri-apps/api/core';
import {
  CreateThreadRequest,
  UpdateThreadRequest,
  CreateThreadMessageRequest,
} from '../../../../types';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('ThreadService', () => {
  let threadService: ThreadService;

  beforeEach(() => {
    threadService = new ThreadService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a thread successfully', async () => {
      const request: CreateThreadRequest = {
        assignment: {
          type: 'task',
          taskId: 'task-1',
          context: { priority: 'high' },
        },
      };

      const mockBackendResponse = {
        id: 'thread-1',
        title: 'Task Discussion',
        assignment_type: 'task',
        assignment_task_id: 'task-1',
        assignment_context: '{"priority":"high"}',
        message_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.create(request);

      expect(mockInvoke).toHaveBeenCalledWith('create_thread', {
        request: {
          assignment_type: 'task',
          assignment_task_id: 'task-1',
          assignment_date: undefined,
          assignment_context: { priority: 'high' },
        },
      });

      expect(result).toEqual({
        id: 'thread-1',
        title: 'Task Discussion',
        assignment: {
          type: 'task',
          taskId: 'task-1',
          date: undefined,
          context: { priority: 'high' },
        },
        messageCount: 0,
        lastMessageAt: undefined,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
    });

    it('should handle creation errors', async () => {
      const request: CreateThreadRequest = {};
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(threadService.create(request)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findById', () => {
    it('should find a thread by ID', async () => {
      const mockBackendResponse = {
        id: 'thread-1',
        title: 'Test Thread',
        assignment_type: 'general',
        message_count: 5,
        last_message_at: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.findById('thread-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_thread', { id: 'thread-1' });
      expect(result).toEqual({
        id: 'thread-1',
        title: 'Test Thread',
        assignment: {
          type: 'general',
          taskId: undefined,
          date: undefined,
          context: {},
        },
        messageCount: 5,
        lastMessageAt: new Date('2024-01-01T12:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
    });

    it('should return null when thread not found', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await threadService.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all threads', async () => {
      const mockBackendResponse = [
        {
          id: 'thread-1',
          title: 'Thread 1',
          assignment_type: 'task',
          assignment_task_id: 'task-1',
          message_count: 3,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'thread-2',
          title: 'Thread 2',
          assignment_type: 'day',
          assignment_date: '2024-01-01',
          message_count: 1,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.findAll();

      expect(mockInvoke).toHaveBeenCalledWith('get_all_threads');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('thread-1');
      expect(result[1].id).toBe('thread-2');
    });
  });

  describe('findByTaskId', () => {
    it('should find threads by task ID', async () => {
      const mockBackendResponse = [
        {
          id: 'thread-1',
          title: 'Task Thread',
          assignment_type: 'task',
          assignment_task_id: 'task-1',
          message_count: 2,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.findByTaskId('task-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_threads_by_task', {
        task_id: 'task-1',
      });
      expect(result).toHaveLength(1);
      expect(result[0].assignment?.taskId).toBe('task-1');
    });
  });

  describe('findByDate', () => {
    it('should find threads by date', async () => {
      const date = new Date('2024-01-01');
      const mockBackendResponse = [
        {
          id: 'thread-1',
          title: 'Day Thread',
          assignment_type: 'day',
          assignment_date: '2024-01-01',
          message_count: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.findByDate(date);

      expect(mockInvoke).toHaveBeenCalledWith('get_threads_by_date', {
        date: '2024-01-01',
      });
      expect(result).toHaveLength(1);
      expect(result[0].assignment?.date).toEqual(new Date('2024-01-01'));
    });
  });

  describe('update', () => {
    it('should update a thread', async () => {
      const request: UpdateThreadRequest = {
        title: 'Updated Thread',
        assignment: {
          type: 'general',
        },
      };

      const mockBackendResponse = {
        id: 'thread-1',
        title: 'Updated Thread',
        assignment_type: 'general',
        message_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.update('thread-1', request);

      expect(mockInvoke).toHaveBeenCalledWith('update_thread', {
        id: 'thread-1',
        request: {
          title: 'Updated Thread',
          assignment_type: 'general',
          assignment_task_id: undefined,
          assignment_date: undefined,
          assignment_context: undefined,
        },
      });

      expect(result.title).toBe('Updated Thread');
      expect(result.assignment?.type).toBe('general');
    });
  });

  describe('delete', () => {
    it('should delete a thread', async () => {
      mockInvoke.mockResolvedValue('Thread deleted successfully');

      await threadService.delete('thread-1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_thread', {
        id: 'thread-1',
      });
    });
  });

  describe('createMessage', () => {
    it('should create a thread message', async () => {
      const request: CreateThreadMessageRequest = {
        threadId: 'thread-1',
        type: 'user',
        content: 'Hello, AI!',
        reasoning: undefined,
        actions: [],
        suggestions: [],
        toolExecutions: [],
      };

      const mockBackendResponse = {
        id: 'message-1',
        thread_id: 'thread-1',
        type: 'user',
        content: 'Hello, AI!',
        timestamp: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.createMessage(request);

      expect(mockInvoke).toHaveBeenCalledWith('create_thread_message', {
        request: expect.objectContaining({
          thread_id: 'thread-1',
          type: 'user',
          content: 'Hello, AI!',
          reasoning: undefined,
          actions: [],
          suggestions: [],
          tool_executions: [],
        }),
      });

      expect(result).toEqual({
        id: 'message-1',
        threadId: 'thread-1',
        type: 'user',
        content: 'Hello, AI!',
        reasoning: undefined,
        actions: [],
        suggestions: [],
        toolExecutions: [],
        timestamp: new Date('2024-01-01T12:00:00Z'),
        userFeedback: undefined,
      });
    });

    it('should auto-generate thread title from first user message', async () => {
      const request: CreateThreadMessageRequest = {
        threadId: 'thread-1',
        type: 'user',
        content: 'Help me plan my day and organize my tasks',
        reasoning: undefined,
        actions: [],
        suggestions: [],
        toolExecutions: [],
      };

      const mockMessageResponse = {
        id: 'message-1',
        thread_id: 'thread-1',
        type: 'user',
        content: 'Help me plan my day and organize my tasks',
        timestamp: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
      };

      // Mock the thread with auto-generated title
      const mockThreadResponse = {
        id: 'thread-1',
        title: 'New Thread', // Auto-generated title that should be updated
        assignment_type: 'general',
        message_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Mock the messages response (empty for first message)
      const mockMessagesResponse: unknown[] = [];

      // Mock the updated thread response
      const mockUpdatedThreadResponse = {
        id: 'thread-1',
        title: 'Help me plan my day and organize my tasks',
        assignment_type: 'general',
        message_count: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      };

      // Set up the mock calls in order
      mockInvoke
        .mockResolvedValueOnce(mockMessageResponse) // create_thread_message
        .mockResolvedValueOnce(mockThreadResponse) // get_thread (for title update check)
        .mockResolvedValueOnce(mockMessagesResponse) // get_thread_messages (for message count check)
        .mockResolvedValueOnce(mockUpdatedThreadResponse); // update_thread (title update)

      const result = await threadService.createMessage(request);

      // Verify message creation
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'create_thread_message', {
        request: expect.objectContaining({
          thread_id: 'thread-1',
          type: 'user',
          content: 'Help me plan my day and organize my tasks',
        }),
      });

      // Verify thread title update was attempted
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'get_thread', {
        id: 'thread-1',
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(3, 'get_thread_messages', {
        threadId: 'thread-1',
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(4, 'update_thread', {
        id: 'thread-1',
        request: {
          title: 'Help me plan my day and organize my tasks',
        },
      });

      expect(result.content).toBe('Help me plan my day and organize my tasks');
    });

    it('should not update title for assistant messages', async () => {
      const request: CreateThreadMessageRequest = {
        threadId: 'thread-1',
        type: 'assistant',
        content: 'I can help you with that!',
        reasoning: undefined,
        actions: [],
        suggestions: [],
        toolExecutions: [],
      };

      const mockBackendResponse = {
        id: 'message-1',
        thread_id: 'thread-1',
        type: 'assistant',
        content: 'I can help you with that!',
        timestamp: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      await threadService.createMessage(request);

      // Should only call create_thread_message, not any title update calls
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('create_thread_message', {
        request: expect.objectContaining({
          thread_id: 'thread-1',
          type: 'assistant',
          content: 'I can help you with that!',
        }),
      });
    });

    it('should not update title if thread already has a custom title', async () => {
      const request: CreateThreadMessageRequest = {
        threadId: 'thread-1',
        type: 'user',
        content: 'This is a second message',
        reasoning: undefined,
        actions: [],
        suggestions: [],
        toolExecutions: [],
      };

      const mockMessageResponse = {
        id: 'message-2',
        thread_id: 'thread-1',
        type: 'user',
        content: 'This is a second message',
        timestamp: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
      };

      // Mock thread with custom title
      const mockThreadResponse = {
        id: 'thread-1',
        title: 'My Custom Thread Title', // Custom title, not auto-generated
        assignment_type: 'general',
        message_count: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Mock existing messages (more than 1 user message)
      const mockMessagesResponse = [
        {
          id: 'message-1',
          thread_id: 'thread-1',
          type: 'user',
          content: 'First message',
          timestamp: '2024-01-01T11:00:00Z',
          created_at: '2024-01-01T11:00:00Z',
        },
      ];

      mockInvoke
        .mockResolvedValueOnce(mockMessageResponse) // create_thread_message
        .mockResolvedValueOnce(mockThreadResponse) // get_thread
        .mockResolvedValueOnce(mockMessagesResponse); // get_thread_messages

      await threadService.createMessage(request);

      // Should not call update_thread since it's not the first message and title is custom
      expect(mockInvoke).toHaveBeenCalledTimes(3);
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'update_thread',
        expect.anything()
      );
    });
  });

  describe('findMessages', () => {
    it('should find messages for a thread', async () => {
      const mockBackendResponse = [
        {
          id: 'message-1',
          thread_id: 'thread-1',
          type: 'user',
          content: 'Hello',
          timestamp: '2024-01-01T12:00:00Z',
          created_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'message-2',
          thread_id: 'thread-1',
          type: 'assistant',
          content: 'Hi there!',
          timestamp: '2024-01-01T12:01:00Z',
          created_at: '2024-01-01T12:01:00Z',
        },
      ];

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.findMessages('thread-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_thread_messages', {
        threadId: 'thread-1',
      });
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('user');
      expect(result[1].type).toBe('assistant');
    });
  });

  describe('getStatistics', () => {
    it('should get thread statistics', async () => {
      const mockBackendResponse = {
        total_threads: 10,
        total_messages: 50,
        task_threads: 5,
        day_threads: 3,
        general_threads: 2,
      };

      mockInvoke.mockResolvedValue(mockBackendResponse);

      const result = await threadService.getStatistics();

      expect(mockInvoke).toHaveBeenCalledWith('get_thread_statistics');
      expect(result).toEqual({
        totalThreads: 10,
        totalMessages: 50,
        taskThreads: 5,
        dayThreads: 3,
        generalThreads: 2,
      });
    });
  });
});
