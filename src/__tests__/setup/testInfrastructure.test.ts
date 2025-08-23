// Test to verify the test infrastructure is working correctly

import {
  renderWithProviders,
  renderHookWithProviders,
  TestDataFactory,
  MockDatabase,
  MockAIService,
  MockNotificationService,
  MockTimerService,
  ErrorSimulator,
  TestErrorHandler,
  ErrorType,
  DatabaseErrorType,
  AIErrorType,
  waitForAsyncUpdates,
} from './index';
import { Priority, TaskStatus, AppContext } from '../../types';
import React from 'react';

// Simple test component for testing infrastructure
const TestComponent: React.FC<{ message?: string }> = ({
  message = 'Hello Test',
}) => {
  return React.createElement(
    'div',
    { 'data-testid': 'test-component' },
    message
  );
};

// Simple test hook for testing infrastructure
const useTestHook = (initialValue: string) => {
  const [value, setValue] = React.useState(initialValue);
  return { value, setValue };
};

describe('Test Infrastructure', () => {
  beforeEach(() => {
    TestDataFactory.resetIdCounter();
  });

  describe('Test Utilities', () => {
    it('should render components with providers', () => {
      const { getByTestId } = renderWithProviders(
        React.createElement(TestComponent)
      );
      expect(getByTestId('test-component')).toBeInTheDocument();
      expect(getByTestId('test-component')).toHaveTextContent('Hello Test');
    });

    it('should render hooks with providers', () => {
      const { result } = renderHookWithProviders(() => useTestHook('initial'));
      expect(result.current.value).toBe('initial');
    });

    it('should support custom initial state', () => {
      const initialState = {
        tasks: [TestDataFactory.createTask({ title: 'Test Task' })],
        userPreferences: TestDataFactory.createUserPreferences(),
      };

      const { mockServices } = renderWithProviders(
        React.createElement(TestComponent),
        {
          initialState,
          mockServices: {
            database: { seedData: initialState },
          },
        }
      );

      expect(mockServices.database?.seedData).toEqual(initialState);
    });
  });

  describe('Test Data Factory', () => {
    it('should create valid task data', () => {
      const task = TestDataFactory.createTask();

      expect(task).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        priority: expect.any(Number),
        status: expect.any(String),
        dependencies: expect.any(Array),
        timeEstimate: expect.any(Number),
        actualTime: expect.any(Number),
        tags: expect.any(Array),
        subtasks: expect.any(Array),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should create task with overrides', () => {
      const task = TestDataFactory.createTask({
        title: 'Custom Task',
        priority: Priority.HIGH,
        status: TaskStatus.COMPLETED,
      });

      expect(task.title).toBe('Custom Task');
      expect(task.priority).toBe(Priority.HIGH);
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should create completed task', () => {
      const task = TestDataFactory.createCompletedTask();

      expect(task.status).toBe(TaskStatus.COMPLETED);
      expect(task.actualTime).toBeGreaterThan(0);
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it('should create high priority task', () => {
      const task = TestDataFactory.createHighPriorityTask();

      expect(task.priority).toBe(Priority.HIGH);
      expect(task.dueDate).toBeInstanceOf(Date);
    });

    it('should create task with dependencies', () => {
      const task = TestDataFactory.createTaskWithDependencies(3);

      expect(task.dependencies).toHaveLength(3);
      task.dependencies.forEach(dep => {
        expect(typeof dep).toBe('string');
      });
    });

    it('should create timer session', () => {
      const session = TestDataFactory.createTimerSession();

      expect(session).toMatchObject({
        id: expect.any(String),
        taskId: expect.any(String),
        startTime: expect.any(Date),
        pausedTime: expect.any(Number),
        isActive: expect.any(Boolean),
        notes: expect.any(String),
        breaks: expect.any(Array),
        createdAt: expect.any(Date),
      });
    });

    it('should create focus session', () => {
      const session = TestDataFactory.createFocusSession();

      expect(session).toMatchObject({
        id: expect.any(String),
        taskId: expect.any(String),
        plannedDuration: expect.any(Number),
        distractionCount: expect.any(Number),
        notes: expect.any(String),
        breaks: expect.any(Array),
        metrics: expect.any(Object),
        createdAt: expect.any(Date),
      });
    });

    it('should create user preferences', () => {
      const preferences = TestDataFactory.createUserPreferences();

      expect(preferences).toMatchObject({
        workingHours: expect.any(Object),
        breakPreferences: expect.any(Object),
        focusPreferences: expect.any(Object),
        notifications: expect.any(Object),
        aiSettings: expect.any(Object),
        taskSettings: expect.any(Object),
        theme: expect.any(String),
        language: expect.any(String),
      });
    });

    it('should create batch data', () => {
      const tasks = TestDataFactory.createTaskBatch(5);

      expect(tasks).toHaveLength(5);
      tasks.forEach(task => {
        expect(task).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
        });
      });
    });

    it('should generate realistic workflow data', () => {
      const workflow = TestDataFactory.generateRealisticWorkflow();

      expect(workflow.tasks).toHaveLength(4);
      expect(workflow.timerSessions).toHaveLength(2);
      expect(workflow.focusSessions).toHaveLength(2);
      expect(workflow.userPreferences).toBeDefined();
    });

    it('should reset ID counter', () => {
      TestDataFactory.createTask();
      TestDataFactory.resetIdCounter();
      const task2 = TestDataFactory.createTask();

      // After reset, IDs should start from 1 again
      expect(task2.id).toBe('task-1');
    });
  });

  describe('Mock Database', () => {
    let mockDb: MockDatabase;

    beforeEach(() => {
      mockDb = new MockDatabase();
    });

    it('should connect and disconnect', async () => {
      await mockDb.connect();
      expect(mockDb.isConnectedToDatabase()).toBe(true);

      await mockDb.disconnect();
      expect(mockDb.isConnectedToDatabase()).toBe(false);
    });

    it('should seed and retrieve data', async () => {
      const tasks = [TestDataFactory.createTask()];
      mockDb.seedData({ tasks });

      await mockDb.connect();
      const retrievedTasks = await mockDb.getTasks();

      expect(retrievedTasks).toHaveLength(1);
      expect(retrievedTasks[0]).toMatchObject(tasks[0]);
    });

    it('should create and retrieve tasks', async () => {
      await mockDb.connect();

      const taskData = TestDataFactory.createTaskRequest();
      const createdTask = await mockDb.createTask(taskData);

      expect(createdTask.title).toBe(taskData.title);
      expect(createdTask.id).toBeDefined();

      const retrievedTask = await mockDb.getTaskById(createdTask.id);
      expect(retrievedTask).toMatchObject(createdTask);
    });

    it('should filter tasks', async () => {
      const tasks = [
        TestDataFactory.createTask({
          status: TaskStatus.PENDING,
          priority: Priority.HIGH,
        }),
        TestDataFactory.createTask({
          status: TaskStatus.COMPLETED,
          priority: Priority.LOW,
        }),
        TestDataFactory.createTask({
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
        }),
      ];

      mockDb.seedData({ tasks });
      await mockDb.connect();

      const highPriorityTasks = await mockDb.getTasks({
        priority: [Priority.HIGH],
      });
      expect(highPriorityTasks).toHaveLength(2);

      const completedTasks = await mockDb.getTasks({
        status: [TaskStatus.COMPLETED],
      });
      expect(completedTasks).toHaveLength(1);
    });

    it('should simulate errors when configured', async () => {
      const errorDb = new MockDatabase({ simulateErrors: true });

      await expect(errorDb.connect()).rejects.toThrow(
        'Mock database connection failed'
      );
    });

    it('should simulate delays when configured', async () => {
      const delayDb = new MockDatabase({ responseDelay: 100 });
      await delayDb.connect();

      const start = Date.now();
      await delayDb.getTasks();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Mock AI Service', () => {
    let mockAI: MockAIService;

    beforeEach(() => {
      mockAI = new MockAIService();
    });

    it('should respond to messages', async () => {
      const response = await mockAI.sendMessage('hello');

      expect(response).toMatchObject({
        message: expect.any(String),
        actions: expect.any(Array),
        suggestions: expect.any(Array),
        context: expect.any(Object),
      });
    });

    it('should use custom responses', async () => {
      const customResponse = {
        message: 'Custom response',
        actions: [],
        suggestions: [],
        context: {} as AppContext,
      };

      mockAI.setResponse('test message', customResponse);
      const response = await mockAI.sendMessage('test message');

      expect(response.message).toBe(customResponse.message);
      expect(response.actions).toEqual(customResponse.actions);
      expect(response.suggestions).toEqual(customResponse.suggestions);
    });

    it('should execute actions', async () => {
      const action = {
        type: 'CREATE_TASK' as const,
        parameters: { title: 'New Task' },
        context: {} as AppContext,
        confidence: 90,
      };

      const result = (await mockAI.executeAction(action)) as {
        success: boolean;
        taskId: string;
      };

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('should provide suggestions', async () => {
      const suggestions = await mockAI.getSuggestions();

      expect(suggestions).toHaveLength(2);
      suggestions.forEach(suggestion => {
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          type: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          confidence: expect.any(Number),
        });
      });
    });

    it('should simulate delays when configured', async () => {
      mockAI.setSimulateDelay(100);

      const start = Date.now();
      await mockAI.sendMessage('test');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    it('should simulate errors when configured', async () => {
      mockAI.simulateError(true);

      await expect(mockAI.sendMessage('test')).rejects.toThrow(
        'Mock AI service error'
      );
    });
  });

  describe('Mock Notification Service', () => {
    let mockNotifications: MockNotificationService;

    beforeEach(() => {
      mockNotifications = new MockNotificationService();
    });

    afterEach(() => {
      // Clean up any active notifications and timers
      mockNotifications.cleanup();
    });

    it('should request and check permissions', async () => {
      const permission = await mockNotifications.requestPermission();
      expect(permission).toBe('granted');
      expect(mockNotifications.getPermission()).toBe('granted');
    });

    it('should show notifications', async () => {
      const notification = await mockNotifications.showNotification({
        title: 'Test Notification',
        body: 'Test body',
      });

      expect(notification).not.toBeNull();
      expect(notification!.title).toBe('Test Notification');
      expect(notification!.body).toBe('Test body');
      expect(notification!.isOpen()).toBe(true);
    });

    it('should show timer notifications', async () => {
      const notification = await mockNotifications.showTimerNotification(
        'Timer Complete',
        'Your 25-minute session is complete'
      );

      expect(notification.title).toBe('Timer Complete');
      expect(notification.tag).toBe('timer');
      expect(notification.requireInteraction).toBe(true);
    });

    it('should clear notifications', async () => {
      await mockNotifications.showNotification({ title: 'Test 1' });
      await mockNotifications.showNotification({ title: 'Test 2' });

      expect(mockNotifications.getNotifications()).toHaveLength(2);

      mockNotifications.clearAll();
      expect(mockNotifications.getNotifications()).toHaveLength(0);
    });

    it('should simulate permission denied', async () => {
      const deniedService = new MockNotificationService({
        simulatePermissionDenied: true,
      });

      const permission = await deniedService.requestPermission();
      expect(permission).toBe('denied');

      const result = await deniedService.showNotification({ title: 'Test' });
      expect(result).toBeNull(); // Should return null when permission denied
    });
  });

  describe('Mock Timer Service', () => {
    let mockTimer: MockTimerService;

    beforeEach(() => {
      mockTimer = new MockTimerService();
    });

    afterEach(() => {
      // Clean up any running timers
      mockTimer.reset();
    });

    it('should start and stop timer', async () => {
      const session = await mockTimer.startTimer('task-1');

      expect(session.taskId).toBe('task-1');
      expect(session.isActive).toBe(true);
      expect(mockTimer.isRunning()).toBe(true);

      const completedSession = await mockTimer.stopTimer();
      expect(completedSession.isActive).toBe(false);
      expect(mockTimer.isRunning()).toBe(false);
    });

    it('should pause and resume timer', async () => {
      await mockTimer.startTimer('task-1');

      await mockTimer.pauseTimer();
      expect(mockTimer.isPaused()).toBe(true);

      await mockTimer.resumeTimer();
      expect(mockTimer.isPaused()).toBe(false);
    });

    it('should add breaks', async () => {
      await mockTimer.startTimer('task-1');

      const timerBreak = await mockTimer.addBreak(
        'Coffee break',
        5 * 60 * 1000
      );

      expect(timerBreak.reason).toBe('Coffee break');
      expect(
        timerBreak.endTime.getTime() - timerBreak.startTime.getTime()
      ).toBe(5 * 60 * 1000);
    });

    it('should advance time for testing', () => {
      mockTimer.advanceTime(60000); // 1 minute
      expect(mockTimer.getMockTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should auto-advance time when configured', async () => {
      const autoTimer = new MockTimerService({ autoAdvanceTime: true });
      await autoTimer.startTimer('task-1');

      // Wait a bit for auto-advancement
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(autoTimer.getElapsedTime()).toBeGreaterThan(0);

      // Clean up the timer to prevent hanging
      await autoTimer.stopTimer();
      autoTimer.reset();
    });
  });

  describe('Error Simulator', () => {
    let errorSimulator: ErrorSimulator;
    beforeEach(() => {
      errorSimulator = new ErrorSimulator();
    });

    it('should simulate network errors', async () => {
      errorSimulator.simulateNetworkError(100, 500);

      const errorConfig = errorSimulator.shouldThrowError('network');
      expect(errorConfig).toBeDefined();
      expect(errorConfig?.type).toBe(ErrorType.NETWORK_ERROR);
      expect(errorConfig?.statusCode).toBe(500);

      await expect(errorSimulator.throwIfConfigured('network')).rejects.toThrow(
        'Network request failed'
      );
    });

    it('should simulate database errors', () => {
      errorSimulator.simulateDatabaseError(DatabaseErrorType.CONNECTION_FAILED);

      const errorConfig = errorSimulator.shouldThrowError('database');
      expect(errorConfig?.type).toBe(ErrorType.DATABASE_ERROR);
      expect(errorConfig?.details?.databaseErrorType).toBe(
        DatabaseErrorType.CONNECTION_FAILED
      );
    });

    it('should simulate AI service errors', () => {
      errorSimulator.simulateAIServiceError(AIErrorType.RATE_LIMIT_EXCEEDED);

      const errorConfig = errorSimulator.shouldThrowError('ai-service');
      expect(errorConfig?.type).toBe(ErrorType.AI_SERVICE_ERROR);
      expect(errorConfig?.statusCode).toBe(429);
      expect(errorConfig?.retryable).toBe(true);
    });

    it('should simulate validation errors', () => {
      errorSimulator.simulateValidationError(
        'email',
        'Invalid email format',
        'invalid-email'
      );

      const errorConfig = errorSimulator.shouldThrowError('validation-email');
      expect(errorConfig?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errorConfig?.details?.field).toBe('email');
      expect(errorConfig?.details?.value).toBe('invalid-email');
    });

    it('should track error history', () => {
      errorSimulator.simulateNetworkError();
      errorSimulator.simulateDatabaseError(DatabaseErrorType.QUERY_FAILED);

      const history = errorSimulator.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(history[1].error.type).toBe(ErrorType.DATABASE_ERROR);
    });

    it('should clear errors', () => {
      errorSimulator.simulateNetworkError();
      errorSimulator.simulateDatabaseError(DatabaseErrorType.QUERY_FAILED);

      expect(errorSimulator.getActiveErrors().size).toBe(2);

      errorSimulator.clearError('network');
      expect(errorSimulator.getActiveErrors().size).toBe(1);

      errorSimulator.clearAllErrors();
      expect(errorSimulator.getActiveErrors().size).toBe(0);
    });
  });

  describe('Test Error Handler', () => {
    let errorHandler: TestErrorHandler;

    beforeEach(() => {
      errorHandler = new TestErrorHandler();
    });

    it('should capture errors', () => {
      const error1 = new Error('Test error 1');
      const error2 = new Error('Test error 2');

      errorHandler.captureError(error1);
      errorHandler.captureError(error2);

      const capturedErrors = errorHandler.captureErrors();
      expect(capturedErrors).toHaveLength(2);
      expect(capturedErrors[0]).toBe(error1);
      expect(capturedErrors[1]).toBe(error2);
    });

    it('should expect specific errors', () => {
      const error = new Error('Network error') as Error & { type: ErrorType };
      error.type = ErrorType.NETWORK_ERROR;

      errorHandler.expectError(ErrorType.NETWORK_ERROR, 'Network error');
      errorHandler.captureError(error);

      expect(() => errorHandler.assertExpectedErrors()).not.toThrow();
    });

    it('should expect no errors', () => {
      expect(() => errorHandler.expectNoErrors()).not.toThrow();

      errorHandler.captureError(new Error('Unexpected error'));
      expect(() => errorHandler.expectNoErrors()).toThrow();
    });

    it('should check error types', () => {
      const networkError = new Error('Network error') as Error & {
        type: ErrorType;
      };
      networkError.type = ErrorType.NETWORK_ERROR;

      const dbError = new Error('Database error') as Error & {
        type: ErrorType;
      };
      dbError.type = ErrorType.DATABASE_ERROR;

      errorHandler.captureError(networkError);
      errorHandler.captureError(dbError);

      expect(errorHandler.hasErrorOfType(ErrorType.NETWORK_ERROR)).toBe(true);
      expect(errorHandler.hasErrorOfType(ErrorType.AI_SERVICE_ERROR)).toBe(
        false
      );

      const networkErrors = errorHandler.getErrorsOfType(
        ErrorType.NETWORK_ERROR
      );
      expect(networkErrors).toHaveLength(1);
      expect(networkErrors[0]).toBe(networkError);
    });
  });

  describe('Async Utilities', () => {
    it('should wait for async updates', async () => {
      let asyncValue = 'initial';

      setTimeout(() => {
        asyncValue = 'updated';
      }, 0);

      await waitForAsyncUpdates();
      expect(asyncValue).toBe('updated');
    });
  });
});
