import { ToolExecutionEngine, PermissionLevel } from '../ToolExecutionEngine';

describe('ToolExecutionEngine', () => {
  let engine: ToolExecutionEngine;

  beforeEach(() => {
    engine = new ToolExecutionEngine([
      PermissionLevel.READ_ONLY,
      PermissionLevel.MODIFY_TASKS,
      PermissionLevel.TIMER_CONTROL,
    ]);
  });

  describe('Permission System', () => {
    test('should allow read-only tools with read-only permission', () => {
      const readOnlyEngine = new ToolExecutionEngine([
        PermissionLevel.READ_ONLY,
      ]);

      expect(readOnlyEngine.hasPermission('get_tasks')).toBe(true);
      expect(readOnlyEngine.hasPermission('get_time_data')).toBe(true);
      expect(readOnlyEngine.hasPermission('analyze_productivity')).toBe(true);
    });

    test('should deny modify tools without modify permission', () => {
      const readOnlyEngine = new ToolExecutionEngine([
        PermissionLevel.READ_ONLY,
      ]);

      expect(readOnlyEngine.hasPermission('create_task')).toBe(false);
      expect(readOnlyEngine.hasPermission('update_task')).toBe(false);
    });

    test('should allow timer tools with timer permission', () => {
      expect(engine.hasPermission('start_timer')).toBe(true);
      expect(engine.hasPermission('stop_timer')).toBe(true);
    });

    test('should allow all tools with full access', () => {
      const fullAccessEngine = new ToolExecutionEngine([
        PermissionLevel.FULL_ACCESS,
      ]);

      expect(fullAccessEngine.hasPermission('get_tasks')).toBe(true);
      expect(fullAccessEngine.hasPermission('create_task')).toBe(true);
      expect(fullAccessEngine.hasPermission('start_timer')).toBe(true);
    });
  });

  describe('Confirmation Requirements', () => {
    test('should require confirmation for task modification by default', () => {
      expect(engine.requiresConfirmation('create_task')).toBe(true);
      expect(engine.requiresConfirmation('update_task')).toBe(true);
    });

    test('should not require confirmation for read-only operations', () => {
      expect(engine.requiresConfirmation('get_tasks')).toBe(false);
      expect(engine.requiresConfirmation('get_time_data')).toBe(false);
    });

    test('should respect auto-approve preferences', () => {
      engine.updatePreferences({
        autoApprove: ['create_task'],
      });

      expect(engine.requiresConfirmation('create_task')).toBe(false);
      expect(engine.requiresConfirmation('update_task')).toBe(true);
    });
  });

  describe('Tool Validation', () => {
    test('should validate tool execution requests', () => {
      const validation = engine.validateExecution('get_tasks', {});

      expect(validation.allowed).toBe(true);
      expect(validation.requiresConfirmation).toBe(false);
    });

    test('should reject unknown tools', () => {
      const validation = engine.validateExecution('unknown_tool', {});

      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('Unknown tool');
    });

    test('should reject tools without sufficient permissions', () => {
      const readOnlyEngine = new ToolExecutionEngine([
        PermissionLevel.READ_ONLY,
      ]);
      const validation = readOnlyEngine.validateExecution('create_task', {});

      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('Insufficient permissions');
    });
  });

  describe('Result Formatting', () => {
    test('should format successful task creation result', () => {
      const rawResult = JSON.stringify({
        success: true,
        task: {
          id: 'task-123',
          title: 'Test Task',
          priority: 1,
          status: 'pending',
        },
      });

      const result = engine.formatResult('create_task', rawResult, 100);

      expect(result.success).toBe(true);
      expect(result.userMessage).toContain('Created task: **Test Task**');
      expect(result.userMessage).toContain('Medium priority');
      expect(result.metadata?.toolName).toBe('create_task');
      expect(result.metadata?.executionTime).toBe(100);
    });

    test('should format task list result', () => {
      const rawResult = JSON.stringify({
        success: true,
        tasks: [
          {
            id: 'task-1',
            title: 'First Task',
            priority: 2,
            status: 'in_progress',
            dueDate: '2024-12-31',
            timeEstimate: 60,
          },
          {
            id: 'task-2',
            title: 'Second Task',
            priority: 0,
            status: 'pending',
          },
        ],
        count: 2,
      });

      const result = engine.formatResult('get_tasks', rawResult, 50);

      expect(result.success).toBe(true);
      expect(result.userMessage).toContain('Found 2 tasks');
      expect(result.userMessage).toContain('First Task');
      expect(result.userMessage).toContain('High');
      expect(result.userMessage).toContain('In Progress');
      expect(result.userMessage).toContain('Due: 12/31/2024');
      expect(result.userMessage).toContain('Estimated: 60 minutes');
    });

    test('should format timer results', () => {
      const startResult = JSON.stringify({
        success: true,
        session: {
          id: 'session-123',
          taskId: 'task-123',
          startTime: new Date(),
          isActive: true,
        },
      });

      const result = engine.formatResult('start_timer', startResult, 25);

      expect(result.success).toBe(true);
      expect(result.userMessage).toContain('Timer started');
    });

    test('should format error results', () => {
      const errorResult = JSON.stringify({
        success: false,
        error: 'Task not found',
      });

      const result = engine.formatResult('update_task', errorResult, 10);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Task Update failed');
      expect(result.userMessage).toContain('Task not found');
    });

    test('should handle invalid JSON gracefully', () => {
      const invalidResult = 'invalid json';

      const result = engine.formatResult('get_tasks', invalidResult, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to parse tool result');
      expect(result.userMessage).toContain('Error executing get_tasks');
    });
  });

  describe('Available Tools', () => {
    test('should return available tools based on permissions', () => {
      const readOnlyEngine = new ToolExecutionEngine([
        PermissionLevel.READ_ONLY,
      ]);
      const availableTools = readOnlyEngine.getAvailableTools();

      expect(availableTools).toContain('get_tasks');
      expect(availableTools).toContain('get_time_data');
      expect(availableTools).toContain('analyze_productivity');
      expect(availableTools).not.toContain('create_task');
      expect(availableTools).not.toContain('start_timer');
    });

    test('should return all tools with full access', () => {
      const fullAccessEngine = new ToolExecutionEngine([
        PermissionLevel.FULL_ACCESS,
      ]);
      const availableTools = fullAccessEngine.getAvailableTools();

      expect(availableTools.length).toBeGreaterThan(5);
      expect(availableTools).toContain('get_tasks');
      expect(availableTools).toContain('create_task');
      expect(availableTools).toContain('start_timer');
    });
  });

  describe('Tool Information', () => {
    test('should provide tool information', () => {
      const toolInfo = engine.getToolInfo('create_task');

      expect(toolInfo).toBeDefined();
      expect(toolInfo?.toolName).toBe('create_task');
      expect(toolInfo?.description).toContain('Create new tasks');
      expect(toolInfo?.requiredPermissions).toContain(
        PermissionLevel.MODIFY_TASKS
      );
      expect(toolInfo?.requiresConfirmation).toBe(true);
    });

    test('should return undefined for unknown tools', () => {
      const toolInfo = engine.getToolInfo('unknown_tool');
      expect(toolInfo).toBeUndefined();
    });
  });

  describe('Permission Updates', () => {
    test('should update permissions dynamically', () => {
      expect(engine.hasPermission('create_task')).toBe(true);

      engine.setPermissions([PermissionLevel.READ_ONLY]);

      expect(engine.hasPermission('create_task')).toBe(false);
      expect(engine.hasPermission('get_tasks')).toBe(true);
    });
  });
});
