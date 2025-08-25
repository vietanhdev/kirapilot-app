import { describe, it, expect } from '@jest/globals';
import { ToolExecutionBridge } from '../ToolExecutionBridge';

describe('ToolExecutionBridge Basic Tests', () => {
  it('should create an instance', () => {
    const bridge = new ToolExecutionBridge();
    expect(bridge).toBeDefined();
  });

  it('should convert successful JSON string result', () => {
    const bridge = new ToolExecutionBridge();
    const langChainResult = JSON.stringify({
      success: true,
      task: { id: '123', title: 'Test Task' },
    });

    const result = bridge.convertLangChainResult(
      'create_task',
      langChainResult,
      100
    );

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Created task: **Test Task**');
    expect(result.metadata?.executionTime).toBe(100);
    expect(result.metadata?.toolName).toBe('create_task');
  });

  it('should parse TOOL_CALL format', () => {
    const bridge = new ToolExecutionBridge();
    const input = 'TOOL_CALL: create_task(title="Test Task", priority=2)';
    const toolCalls = bridge.parseToolCall(input);

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe('create_task');
    expect(toolCalls[0].args.title).toBe('Test Task');
    expect(toolCalls[0].args.priority).toBe(2);
  });

  it('should format tool call with arguments', () => {
    const bridge = new ToolExecutionBridge();
    const args = { title: 'Test Task', priority: 2 };
    const formatted = bridge.formatToolCall('create_task', args);

    expect(formatted).toBe('create_task({"title":"Test Task","priority":2})');
  });
});
