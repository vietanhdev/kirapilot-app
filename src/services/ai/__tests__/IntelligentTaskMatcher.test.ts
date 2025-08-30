// Tests for IntelligentTaskMatcher service

import { IntelligentTaskMatcher } from '../IntelligentTaskMatcher';
import { Task, TaskStatus, Priority } from '../../../types';
import { UserIntent, MatchType } from '../../../types/taskMatching';

// Mock the task repository
const mockFindAll = jest.fn();
jest.mock('../../database/repositories', () => ({
  getTaskRepository: () => ({
    findAll: mockFindAll,
  }),
}));

// Mock PerformanceMonitor
jest.mock('../PerformanceMonitor', () => ({
  getPerformanceMonitor: () => ({
    startOperation: jest.fn(),
    endOperation: jest.fn(),
    recordMetric: jest.fn(),
  }),
}));

describe('IntelligentTaskMatcher', () => {
  let matcher: IntelligentTaskMatcher;
  let mockTasks: Task[];

  beforeEach(() => {
    matcher = new IntelligentTaskMatcher();

    // Create mock tasks for testing
    mockTasks = [
      {
        id: '1',
        title: 'Fix login bug',
        description: 'Fix the authentication issue in the login form',
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        order: 0,
        dependencies: [],
        timePreset: 0,
        timeEstimate: 60,
        actualTime: 0,
        tags: ['bug', 'frontend', 'urgent'],
        taskListId: 'default',
        subtasks: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        title: 'Update documentation',
        description: 'Update the API documentation with new endpoints',
        priority: Priority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        order: 1,
        dependencies: [],
        timePreset: 0,
        timeEstimate: 120,
        actualTime: 30,
        tags: ['documentation', 'api'],
        taskListId: 'default',
        subtasks: [],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
      {
        id: '3',
        title: 'Review pull request',
        description: 'Review the new feature implementation',
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        order: 2,
        dependencies: [],
        timePreset: 0,
        timeEstimate: 30,
        actualTime: 0,
        tags: ['review', 'code'],
        taskListId: 'default',
        subtasks: [],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
      },
    ];

    // Mock the repository
    mockFindAll.mockResolvedValue(mockTasks);
  });

  describe('extractTaskReference', () => {
    it('should extract task reference from complete task command', () => {
      const result = matcher.extractTaskReference(
        'complete the login bug task'
      );

      expect(result).toEqual({
        taskReference: 'login bug task',
        intent: UserIntent.COMPLETE_TASK,
        confidence: 0.9,
      });
    });

    it('should extract task reference from start timer command', () => {
      const result = matcher.extractTaskReference(
        'start working on documentation update'
      );

      expect(result).toEqual({
        taskReference: 'documentation update',
        intent: UserIntent.START_TIMER,
        confidence: 0.85,
      });
    });

    it('should extract task reference from quoted strings', () => {
      const result = matcher.extractTaskReference(
        'show me the task "Fix login bug"'
      );

      expect(result).toEqual({
        taskReference: 'Fix login bug',
        intent: UserIntent.VIEW_DETAILS,
        confidence: 0.75,
      });
    });

    it('should return null for non-matching input', () => {
      const result = matcher.extractTaskReference('hello world');
      expect(result).toBeNull();
    });
  });

  describe('findTasksByDescription', () => {
    it('should find exact title matches with high confidence', async () => {
      const results = await matcher.findTasksByDescription('Fix login bug');

      expect(results).toHaveLength(1);
      expect(results[0].task.id).toBe('1');
      expect(results[0].confidence).toBe(100);
      expect(results[0].matchType).toBe(MatchType.EXACT_TITLE);
    });

    it('should find fuzzy title matches', async () => {
      const results = await matcher.findTasksByDescription('login issue');

      expect(results.length).toBeGreaterThan(0);
      const loginTask = results.find(r => r.task.id === '1');
      expect(loginTask).toBeDefined();
      expect(loginTask!.confidence).toBeGreaterThan(30);
      expect(loginTask!.matchType).toBe(MatchType.FUZZY_TITLE);
    });

    it('should find description matches', async () => {
      const results = await matcher.findTasksByDescription(
        'authentication issue'
      );

      expect(results.length).toBeGreaterThan(0);
      const authTask = results.find(r => r.task.id === '1');
      expect(authTask).toBeDefined();
      expect(authTask!.matchType).toBe(MatchType.DESCRIPTION_MATCH);
    });

    it('should find tag matches', async () => {
      const results = await matcher.findTasksByDescription('bug');

      expect(results.length).toBeGreaterThan(0);
      const bugTask = results.find(r => r.task.id === '1');
      expect(bugTask).toBeDefined();
      expect(bugTask!.matchType).toBe(MatchType.TAG_MATCH);
    });

    it('should return empty array for no matches', async () => {
      const results = await matcher.findTasksByDescription(
        'nonexistent task xyz'
      );
      expect(results).toHaveLength(0);
    });

    it('should sort results by confidence', async () => {
      const results = await matcher.findTasksByDescription('fix');

      // Should have multiple matches, sorted by confidence
      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(
          results[i].confidence
        );
      }
    });
  });

  describe('searchTasks', () => {
    it('should use extracted task reference for focused search', async () => {
      const results = await matcher.searchTasks('complete the login bug');

      expect(results.length).toBeGreaterThan(0);
      const loginTask = results.find(r => r.task.id === '1');
      expect(loginTask).toBeDefined();
    });

    it('should fall back to general matching for non-pattern input', async () => {
      const results = await matcher.searchTasks('documentation');

      expect(results.length).toBeGreaterThan(0);
      const docTask = results.find(r => r.task.id === '2');
      expect(docTask).toBeDefined();
    });
  });

  describe('contextual matching', () => {
    it('should boost score for current task', async () => {
      const context = {
        currentTask: mockTasks[0], // Fix login bug
      };

      const results = await matcher.findTasksByDescription('bug', context);

      const currentTaskResult = results.find(r => r.task.id === '1');
      expect(currentTaskResult).toBeDefined();
      expect(currentTaskResult!.matchType).toBe(MatchType.CONTEXTUAL);
    });

    it('should boost score for recent tasks', async () => {
      const context = {
        recentTasks: [mockTasks[1]], // Update documentation
      };

      const results = await matcher.findTasksByDescription('update', context);

      const recentTaskResult = results.find(r => r.task.id === '2');
      expect(recentTaskResult).toBeDefined();
    });

    it('should apply filter context', async () => {
      const context = {
        activeFilters: {
          status: [TaskStatus.PENDING],
          priority: [Priority.HIGH],
          tags: ['urgent'],
        },
      };

      const results = await matcher.findTasksByDescription('fix', context);

      // Should boost tasks that match the active filters
      const highPriorityTask = results.find(r => r.task.id === '1');
      expect(highPriorityTask).toBeDefined();
    });
  });

  describe('fuzzy matching algorithm', () => {
    it('should handle exact matches', () => {
      const score = (
        matcher as unknown as {
          calculateFuzzyScore: (a: string, b: string) => number;
        }
      ).calculateFuzzyScore('hello', 'hello');
      expect(score).toBe(1.0);
    });

    it('should handle substring matches', () => {
      const score = (
        matcher as unknown as {
          calculateFuzzyScore: (a: string, b: string) => number;
        }
      ).calculateFuzzyScore('hello world', 'hello');
      expect(score).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle similar strings', () => {
      const score = (
        matcher as unknown as {
          calculateFuzzyScore: (a: string, b: string) => number;
        }
      ).calculateFuzzyScore('hello', 'helo');
      expect(score).toBeGreaterThan(0.7);
    });

    it('should handle completely different strings', () => {
      const score = (
        matcher as unknown as {
          calculateFuzzyScore: (a: string, b: string) => number;
        }
      ).calculateFuzzyScore('hello', 'xyz');
      expect(score).toBeLessThan(0.3);
    });

    it('should be case insensitive', () => {
      const score = (
        matcher as unknown as {
          calculateFuzzyScore: (a: string, b: string) => number;
        }
      ).calculateFuzzyScore('Hello', 'HELLO');
      expect(score).toBe(1.0);
    });
  });

  describe('alternatives', () => {
    it('should add alternatives for low confidence matches', async () => {
      const results = await matcher.findTasksByDescription('task');

      // Should have multiple matches with alternatives for low confidence ones
      const lowConfidenceMatch = results.find(r => r.confidence < 80);
      if (lowConfidenceMatch) {
        expect(lowConfidenceMatch.alternatives).toBeDefined();
        expect(lowConfidenceMatch.alternatives!.length).toBeGreaterThan(0);
      }
    });

    it('should not add alternatives for high confidence matches', async () => {
      const results = await matcher.findTasksByDescription('Fix login bug');

      const highConfidenceMatch = results.find(r => r.confidence >= 80);
      if (highConfidenceMatch) {
        expect(highConfidenceMatch.alternatives).toBeUndefined();
      }
    });
  });

  describe('weight customization', () => {
    it('should allow updating matching weights', () => {
      const newWeights = {
        exactTitle: 0.9,
        fuzzyTitle: 0.7,
        description: 0.5,
        tags: 0.6,
        recentActivity: 0.4,
        contextual: 0.3,
      };

      matcher.updateWeights(newWeights);
      const currentWeights = matcher.getWeights();

      expect(currentWeights).toEqual(newWeights);
    });

    it('should allow partial weight updates', () => {
      const originalWeights = matcher.getWeights();

      matcher.updateWeights({ exactTitle: 0.95 });
      const updatedWeights = matcher.getWeights();

      expect(updatedWeights.exactTitle).toBe(0.95);
      expect(updatedWeights.fuzzyTitle).toBe(originalWeights.fuzzyTitle);
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics for task matching', async () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the matcher
      (
        matcher as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      await matcher.findTasksByDescription('login bug');

      expect(performanceMonitorSpy.startOperation).toHaveBeenCalledWith(
        expect.stringContaining('task-match'),
        expect.objectContaining({
          type: 'task_matching',
          queryLength: 9,
          hasContext: false,
        })
      );

      expect(performanceMonitorSpy.endOperation).toHaveBeenCalledWith(
        expect.stringContaining('task-match'),
        expect.objectContaining({
          success: true,
          additionalMetrics: expect.objectContaining({
            tasks_processed: expect.any(Number),
            matches_found: expect.any(Number),
            highest_confidence: expect.any(Number),
          }),
        })
      );
    });

    it('should handle performance monitoring with context', async () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the matcher
      (
        matcher as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      const context = {
        currentTask: mockTasks[0],
        recentTasks: [mockTasks[1]],
        filterBy: { priority: Priority.HIGH },
      };

      await matcher.findTasksByDescription('bug fix', context);

      expect(performanceMonitorSpy.startOperation).toHaveBeenCalledWith(
        expect.stringContaining('task-match'),
        expect.objectContaining({
          type: 'task_matching',
          queryLength: 7,
          hasContext: true,
        })
      );
    });

    it('should handle performance monitoring for large task sets', async () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the matcher
      (
        matcher as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      // Create a large set of tasks
      const largeMockTasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        description: `Description for task ${i}`,
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [`tag-${i}`], // Add tags to prevent iteration error
      }));

      mockFindAll.mockResolvedValue(largeMockTasks);

      await matcher.findTasksByDescription('task 500');

      expect(performanceMonitorSpy.endOperation).toHaveBeenCalledWith(
        expect.stringContaining('task-match'),
        expect.objectContaining({
          success: true,
          additionalMetrics: expect.objectContaining({
            tasks_processed: expect.any(Number),
          }),
        })
      );
    });

    it('should handle performance monitoring for error cases', async () => {
      // Create a spy on the actual performance monitor instance
      const performanceMonitorSpy = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
      };

      // Replace the performance monitor in the matcher
      (
        matcher as unknown as {
          performanceMonitor: typeof performanceMonitorSpy;
        }
      ).performanceMonitor = performanceMonitorSpy;

      // Mock repository to throw error
      mockFindAll.mockRejectedValue(new Error('Database connection failed'));

      await expect(matcher.findTasksByDescription('test')).rejects.toThrow(
        'Database connection failed'
      );

      expect(performanceMonitorSpy.endOperation).toHaveBeenCalledWith(
        expect.stringContaining('task-match'),
        expect.objectContaining({
          success: false,
          error: 'Database connection failed',
        })
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete task matching workflow', async () => {
      // Test realistic user queries
      const queries = [
        'complete the login bug',
        'start timer for documentation',
        'show me high priority tasks',
        'what tasks are overdue?',
      ];

      for (const query of queries) {
        const results = await matcher.findTasksByDescription(query);

        // Should return results or empty array, never throw
        expect(Array.isArray(results)).toBe(true);

        // Results should be sorted by confidence
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].confidence).toBeGreaterThanOrEqual(
            results[i].confidence
          );
        }

        // All results should have required properties
        results.forEach(result => {
          expect(result.task).toBeDefined();
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
          expect(result.matchType).toBeDefined();
          expect(result.matchReason).toBeDefined();
        });
      }
    });

    it('should handle concurrent matching requests', async () => {
      const queries = [
        'login bug',
        'documentation task',
        'high priority',
        'testing feature',
      ];

      // Execute multiple queries concurrently
      const promises = queries.map(query =>
        matcher.findTasksByDescription(query)
      );
      const results = await Promise.all(promises);

      // All queries should complete successfully
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
