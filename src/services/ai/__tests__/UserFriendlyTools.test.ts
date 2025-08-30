// Test for user-friendly AI tools

import { UserFriendlyToolHelper } from '../tools';
import { IntelligentTaskMatcher } from '../IntelligentTaskMatcher';
import { UserIntent } from '../../../types/taskMatching';
import { Task, TaskStatus, Priority } from '../../../types';

// Mock the IntelligentTaskMatcher
jest.mock('../IntelligentTaskMatcher');
const MockIntelligentTaskMatcher = IntelligentTaskMatcher as jest.MockedClass<
  typeof IntelligentTaskMatcher
>;

describe('UserFriendlyToolHelper', () => {
  let helper: UserFriendlyToolHelper;
  let mockTaskMatcher: jest.Mocked<IntelligentTaskMatcher>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskMatcher =
      new MockIntelligentTaskMatcher() as jest.Mocked<IntelligentTaskMatcher>;
    helper = new UserFriendlyToolHelper();
    // Replace the private taskMatcher with our mock
    (helper as unknown as { taskMatcher: typeof mockTaskMatcher }).taskMatcher =
      mockTaskMatcher;
  });

  describe('findTask', () => {
    const mockTask: Task = {
      id: '1',
      title: 'Test Task',
      description: 'A test task',
      status: TaskStatus.PENDING,
      priority: Priority.MEDIUM,
      timeEstimate: 60,
      actualTime: 0,
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should find a task with high confidence', async () => {
      mockTaskMatcher.searchTasks.mockResolvedValue([
        {
          task: mockTask,
          confidence: 90,
          matchReason: 'Exact title match',
          matchType: 'exact_title' as const,
        },
      ]);

      const result = await helper.findTask(
        'Test Task',
        UserIntent.VIEW_DETAILS
      );

      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
      expect(result.message).toContain('Found task: "Test Task"');
      expect(result.reasoning).toContain('Exact title match (90% confidence)');
    });

    it('should handle no matches found', async () => {
      mockTaskMatcher.searchTasks.mockResolvedValue([]);

      const result = await helper.findTask('Nonexistent Task');

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        'I couldn\'t find any tasks matching "Nonexistent Task"'
      );
      expect(result.reasoning).toBe(
        'No tasks found matching the search criteria'
      );
    });

    it('should handle multiple matches with alternatives', async () => {
      const mockTask2: Task = {
        ...mockTask,
        id: '2',
        title: 'Another Test Task',
      };

      mockTaskMatcher.searchTasks.mockResolvedValue([
        {
          task: mockTask,
          confidence: 60,
          matchReason: 'Partial title match',
          matchType: 'fuzzy_title' as const,
        },
        {
          task: mockTask2,
          confidence: 55,
          matchReason: 'Similar title',
          matchType: 'fuzzy_title' as const,
        },
      ]);

      const result = await helper.findTask('Test');

      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
      expect(result.alternatives).toHaveLength(1);
      expect(result.needsResolution).toBe(true);
    });
  });

  describe('getPriorityLabel', () => {
    it('should return correct priority labels', () => {
      expect(helper.getPriorityLabel(Priority.LOW)).toBe('Low 🟢');
      expect(helper.getPriorityLabel(Priority.MEDIUM)).toBe('Medium 🟡');
      expect(helper.getPriorityLabel(Priority.HIGH)).toBe('High 🟠');
      expect(helper.getPriorityLabel(Priority.URGENT)).toBe('Urgent 🔴');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct status labels', () => {
      expect(helper.getStatusLabel(TaskStatus.PENDING)).toBe('Pending ⏳');
      expect(helper.getStatusLabel(TaskStatus.IN_PROGRESS)).toBe(
        'In Progress 🔄'
      );
      expect(helper.getStatusLabel(TaskStatus.COMPLETED)).toBe('Completed ✅');
      expect(helper.getStatusLabel(TaskStatus.CANCELLED)).toBe('Cancelled ❌');
    });
  });

  describe('formatTaskDetails', () => {
    it('should format task details correctly', () => {
      const mockTask: Task = {
        id: '1',
        title: 'Test Task',
        description: 'A detailed test task',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        timeEstimate: 120,
        actualTime: 3600, // 60 minutes
        tags: ['work', 'urgent'],
        dueDate: new Date('2024-12-31'),
        scheduledDate: new Date('2024-12-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const formatted = helper.formatTaskDetails(mockTask);

      expect(formatted).toContain('📋 **Test Task**');
      expect(formatted).toContain('📝 A detailed test task');
      expect(formatted).toContain('📊 Status: In Progress 🔄');
      expect(formatted).toContain('⭐ Priority: High 🟠');
      expect(formatted).toContain('⏱️ Estimated time: 120 minutes');
      expect(formatted).toContain('⏰ Time spent: 60 minutes');
      expect(formatted).toContain('🏷️ Tags: work, urgent');
    });
  });
});
