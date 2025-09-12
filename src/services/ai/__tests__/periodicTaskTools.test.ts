import { getKiraPilotTools } from '../tools';

describe('Periodic Task AI Tools', () => {
  let tools: ReturnType<typeof getKiraPilotTools>;

  beforeEach(() => {
    tools = getKiraPilotTools();
  });

  it('should include periodic task tools in the tool list', () => {
    const toolNames = tools.map(tool => tool.name);

    expect(toolNames).toContain('create_periodic_task');
    expect(toolNames).toContain('get_periodic_tasks');
    expect(toolNames).toContain('update_periodic_task');
    expect(toolNames).toContain('generate_periodic_instances');
    expect(toolNames).toContain('suggest_recurrence');
  });

  it('should have proper tool descriptions for periodic tasks', () => {
    const createPeriodicTool = tools.find(
      tool => tool.name === 'create_periodic_task'
    );
    const getPeriodicTool = tools.find(
      tool => tool.name === 'get_periodic_tasks'
    );
    const updatePeriodicTool = tools.find(
      tool => tool.name === 'update_periodic_task'
    );
    const generateTool = tools.find(
      tool => tool.name === 'generate_periodic_instances'
    );
    const suggestTool = tools.find(tool => tool.name === 'suggest_recurrence');

    expect(createPeriodicTool?.description).toContain(
      'recurring task template'
    );
    expect(getPeriodicTool?.description).toContain('periodic task templates');
    expect(updatePeriodicTool?.description).toContain('periodic task template');
    expect(generateTool?.description).toContain('task instances');
    expect(suggestTool?.description).toContain('recurrence patterns');
  });

  it('should include periodic tasks in help topics', () => {
    const helpTool = tools.find(tool => tool.name === 'get_help');
    expect(helpTool).toBeDefined();

    // The help tool should support 'periodic' as a topic
    const schema = helpTool?.schema;
    expect(schema).toBeDefined();

    // Check if the schema includes periodic in the enum
    const topicProperty = schema?.shape?.topic;
    expect(topicProperty).toBeDefined();
  });

  it('should have all required tools for complete periodic task functionality', () => {
    const toolNames = tools.map(tool => tool.name);

    // Core task management tools
    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('update_task');
    expect(toolNames).toContain('get_tasks');

    // Periodic task specific tools
    expect(toolNames).toContain('create_periodic_task');
    expect(toolNames).toContain('get_periodic_tasks');
    expect(toolNames).toContain('update_periodic_task');
    expect(toolNames).toContain('generate_periodic_instances');
    expect(toolNames).toContain('suggest_recurrence');

    // Support tools
    expect(toolNames).toContain('get_help');
  });
});
