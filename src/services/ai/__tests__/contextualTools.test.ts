import { getKiraPilotTools } from '../tools';

describe('Smart Contextual Tools', () => {
  let tools: ReturnType<typeof getKiraPilotTools>;

  beforeEach(() => {
    tools = getKiraPilotTools();
  });

  it('should include all contextual tools', () => {
    const toolNames = tools.map(tool => tool.name);

    expect(toolNames).toContain('analyze_current_workflow');
    expect(toolNames).toContain('suggest_next_actions');
    expect(toolNames).toContain('optimize_task_sequence');
    expect(toolNames).toContain('predict_task_duration');
  });

  it('should have analyze_current_workflow tool with correct schema', () => {
    const tool = tools.find(t => t.name === 'analyze_current_workflow');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('workflow state');
    expect(tool?.description).toContain('focus level');
    expect(tool?.description).toContain('productivity phase');
  });

  it('should have suggest_next_actions tool with correct schema', () => {
    const tool = tools.find(t => t.name === 'suggest_next_actions');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('optimal next actions');
    expect(tool?.description).toContain('context');
    expect(tool?.description).toContain('patterns');
  });

  it('should have optimize_task_sequence tool with correct schema', () => {
    const tool = tools.find(t => t.name === 'optimize_task_sequence');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Reorder');
    expect(tool?.description).toContain('productivity flow');
    expect(tool?.description).toContain('priority');
  });

  it('should have predict_task_duration tool with correct schema', () => {
    const tool = tools.find(t => t.name === 'predict_task_duration');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Predict');
    expect(tool?.description).toContain('historical data');
    expect(tool?.description).toContain('current context');
  });
});
