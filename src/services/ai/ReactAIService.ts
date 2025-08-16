import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { MessagesAnnotation, StateGraph } from '@langchain/langgraph/web';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { Annotation } from '@langchain/langgraph/web';
import {
  AIAction,
  AIResponse,
  AISuggestion,
  AppContext,
  PatternAnalysis,
  Priority,
  DistractionLevel,
} from '../../types';
import { getKiraPilotTools } from './tools';

// Configuration schema for the ReAct agent
export const KiraConfigurationSchema = Annotation.Root({
  /**
   * The system prompt template for Kira AI
   */
  systemPromptTemplate: Annotation<string>,

  /**
   * The model to use (Google Gemini)
   */
  model: Annotation<string>,

  /**
   * Current app context
   */
  appContext: Annotation<AppContext>,

  /**
   * API key for the model
   */
  apiKey: Annotation<string>,
});

// Default system prompt for Kira AI
const KIRA_SYSTEM_PROMPT = `You are Kira, an AI assistant for KiraPilot, a productivity application. You help users manage their tasks, track time, and improve productivity.

Your role is to:
1. Help users create, update, and organize tasks
2. Assist with time tracking and timer management
3. Provide productivity insights and suggestions
4. Support weekly planning and scheduling

Available tools:
- create_task: Create new tasks with details
- update_task: Modify existing tasks
- get_tasks: Retrieve and search tasks
- start_timer: Begin timing work on tasks
- stop_timer: End current timer sessions
- get_time_data: Analyze time tracking data
- analyze_productivity: Generate productivity insights

Guidelines:
- Always reason through problems step by step
- Use tools when users request specific actions
- Provide clear explanations for your reasoning
- Respect user privacy - all data stays local
- Be helpful, concise, and professional

Current context: {app_context}
System time: {system_time}

Think through each user request carefully and use the appropriate tools to help them achieve their productivity goals.`;

// Get the tools for the ReAct agent
const TOOLS = getKiraPilotTools();

/**
 * Load chat model for Google Gemini
 */
async function loadChatModel(apiKey: string): Promise<ChatGoogleGenerativeAI> {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    maxOutputTokens: 2048,
    apiKey: apiKey,
  });
}

/**
 * Ensure configuration has defaults
 */
function ensureConfiguration(
  config: RunnableConfig
): typeof KiraConfigurationSchema.State {
  const configurable = config.configurable ?? {};
  const now = new Date();

  // Default app context
  const defaultAppContext: AppContext = {
    currentTask: undefined,
    activeSession: undefined,
    activeFocusSession: undefined,
    focusMode: false,
    timeOfDay: now.toTimeString().slice(0, 5),
    dayOfWeek: now.getDay(),
    currentEnergy: 75,
    recentActivity: [],
    preferences: {
      workingHours: { start: '09:00', end: '17:00' },
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        breakInterval: 25,
      },
      focusPreferences: {
        defaultDuration: 25,
        distractionLevel: DistractionLevel.MINIMAL,
        backgroundAudio: { type: 'white_noise', volume: 50 },
      },
      notifications: {
        breakReminders: true,
        taskDeadlines: true,
        dailySummary: true,
        weeklyReview: true,
      },
      theme: 'auto',
      language: 'en',
    },
  };

  return {
    systemPromptTemplate:
      configurable.systemPromptTemplate ?? KIRA_SYSTEM_PROMPT,
    model: configurable.model ?? 'gemini-2.0-flash',
    appContext: configurable.appContext ?? defaultAppContext,
    apiKey: configurable.apiKey ?? '',
  };
}

// Define the function that calls the model
async function callModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = ensureConfiguration(config);

  if (!configuration.apiKey) {
    throw new Error('API key is required for the model');
  }

  // Load and bind tools to the model
  const model = (await loadChatModel(configuration.apiKey)).bindTools(TOOLS);

  const systemPrompt = configuration.systemPromptTemplate
    .replace('{app_context}', JSON.stringify(configuration.appContext, null, 2))
    .replace('{system_time}', new Date().toISOString());

  // In web environments, we need to pass config to nested Runnable calls
  const response = await model.invoke(
    [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...state.messages,
    ],
    config
  );

  // Return the response message
  return { messages: [response] };
}

// Define the function that determines whether to continue or not
function routeModelOutput(state: typeof MessagesAnnotation.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  // If the LLM is invoking tools, route to tools
  if ((lastMessage as AIMessage)?.tool_calls?.length || 0 > 0) {
    return 'tools';
  }
  // Otherwise end the graph
  else {
    return '__end__';
  }
}

// Define the ReAct graph workflow
const workflow = new StateGraph(MessagesAnnotation, KiraConfigurationSchema)
  // Define the two nodes we will cycle between
  .addNode('callModel', callModel)
  .addNode('tools', new ToolNode(TOOLS))
  // Set the entrypoint as `callModel`
  .addEdge('__start__', 'callModel')
  .addConditionalEdges('callModel', routeModelOutput)
  // After tools are called, go back to callModel
  .addEdge('tools', 'callModel');

// Compile the graph
export const graph = workflow.compile({
  interruptBefore: [],
  interruptAfter: [],
});

/**
 * ReAct AI Service for KiraPilot using LangGraph
 * Implements the Reasoning + Acting pattern for better tool usage and decision making
 */
export class ReactAIService {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_GOOGLE_API_KEY || null;
  }

  /**
   * Process a user message using the ReAct pattern
   */
  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error(
          'AI model not initialized. Please provide a valid API key.'
        );
      }

      // Prepare the input for the graph
      const input = {
        messages: [
          {
            role: 'user' as const,
            content: message,
          },
        ],
      };

      // Configure the graph with current context and API key
      const config = {
        configurable: {
          appContext: context,
          apiKey: this.apiKey,
          systemPromptTemplate: KIRA_SYSTEM_PROMPT,
          model: 'gemini-2.0-flash',
        },
      };

      // Run the ReAct graph
      const result = await graph.invoke(input, config);

      // Extract the final response
      const messages = result.messages;
      const lastMessage = messages[messages.length - 1];

      let responseMessage = '';
      const actions: AIAction[] = [];

      // Handle the response content
      if (lastMessage.content) {
        if (Array.isArray(lastMessage.content)) {
          responseMessage = lastMessage.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('');
        } else if (typeof lastMessage.content === 'string') {
          responseMessage = lastMessage.content;
        } else {
          responseMessage = String(lastMessage.content);
        }
      }

      // Process tool executions from the conversation
      const toolExecutions = this.extractToolExecutions(messages);
      if (toolExecutions.length > 0) {
        // Create action records for executed tools
        toolExecutions.forEach(execution => {
          actions.push({
            type: execution.name.toUpperCase() as any,
            parameters: execution.args,
            context,
            confidence: 100,
          });
        });

        // If we have tool executions but no text response, generate one
        if (!responseMessage.trim()) {
          responseMessage = this.generateToolResponseSummary(
            toolExecutions,
            messages
          );
        }
      }

      // Generate suggestions
      const suggestions = await this.generateSuggestions(context);

      return {
        message: responseMessage || "I've processed your request.",
        actions,
        suggestions,
        context,
        reasoning: this.extractReasoning(responseMessage),
      };
    } catch (error) {
      console.error('ReAct AI Service Error:', error);
      return {
        message:
          "I'm sorry, I encountered an error processing your request. Please try again.",
        actions: [],
        suggestions: [],
        context,
        reasoning: 'Error occurred during processing',
      };
    }
  }

  /**
   * Extract tool executions from message history
   */
  private extractToolExecutions(messages: any[]): any[] {
    const executions: any[] = [];

    for (const message of messages) {
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          executions.push({
            name: toolCall.name,
            args: toolCall.args,
            id: toolCall.id,
          });
        }
      }
    }

    return executions;
  }

  /**
   * Generate a response summary based on tool executions and tool messages
   */
  private generateToolResponseSummary(
    executions: any[],
    messages: any[]
  ): string {
    // Look for tool messages (responses from tool executions)
    const toolMessages = messages.filter(
      msg =>
        msg.constructor.name === 'ToolMessage' || msg._getType?.() === 'tool'
    );

    let summary = '';

    for (let i = 0; i < executions.length; i++) {
      const execution = executions[i];
      const toolMessage = toolMessages[i];

      try {
        // Try to parse the tool result
        const result = toolMessage ? JSON.parse(toolMessage.content) : null;

        switch (execution.name) {
          case 'get_tasks':
            if (result?.success && result?.tasks) {
              summary += `I found ${result.tasks.length} tasks:\n\n`;
              result.tasks.slice(0, 5).forEach((task: any, index: number) => {
                const priority =
                  ['Low', 'Medium', 'High', 'Urgent'][task.priority] ||
                  'Medium';
                const status = task.status
                  .replace('_', ' ')
                  .replace(/\b\w/g, (l: string) => l.toUpperCase());
                summary += `${index + 1}. **${task.title}** (${priority} priority, ${status})\n`;
                if (task.dueDate) {
                  summary += `   Due: ${new Date(task.dueDate).toLocaleDateString()}\n`;
                }
                if (task.timeEstimate) {
                  summary += `   Estimated: ${task.timeEstimate} minutes\n`;
                }
              });
              if (result.tasks.length > 5) {
                summary += `\n...and ${result.tasks.length - 5} more tasks.\n`;
              }
            } else {
              summary += 'No tasks found matching your criteria.\n';
            }
            break;

          case 'create_task':
            if (result?.success && result?.task) {
              summary += `✅ Created task: **${result.task.title}**\n`;
              const priority =
                ['Low', 'Medium', 'High', 'Urgent'][result.task.priority] ||
                'Medium';
              summary += `Priority: ${priority}\n`;
            } else {
              summary += '❌ Failed to create task.\n';
            }
            break;

          case 'start_timer':
            if (result?.success) {
              summary +=
                "✅ Timer started! You're now tracking time for this task.\n";
            } else {
              summary += '❌ Failed to start timer.\n';
            }
            break;

          case 'stop_timer':
            if (result?.success && result?.session) {
              const duration = Math.round(
                result.session.duration / (1000 * 60)
              );
              summary += `✅ Timer stopped! You worked for ${duration} minutes.\n`;
            } else {
              summary += '❌ Failed to stop timer.\n';
            }
            break;

          case 'update_task':
            if (result?.success) {
              summary += '✅ Task updated successfully.\n';
            } else {
              summary += '❌ Failed to update task.\n';
            }
            break;

          case 'get_time_data':
            if (result?.success && result?.timeData) {
              const totalHours =
                Math.round(
                  (result.timeData.totalTime / (1000 * 60 * 60)) * 10
                ) / 10;
              summary += `📊 Time Summary:\n`;
              summary += `• Sessions: ${result.timeData.totalSessions}\n`;
              summary += `• Total time: ${totalHours} hours\n`;
            } else {
              summary += 'No time tracking data available.\n';
            }
            break;

          case 'analyze_productivity':
            if (result?.success) {
              summary += '📈 Productivity analysis completed.\n';
            } else {
              summary += '❌ Failed to analyze productivity.\n';
            }
            break;

          default:
            summary += `✅ Executed ${execution.name} successfully.\n`;
        }
      } catch (error) {
        summary += `❌ Error processing ${execution.name}: ${error}\n`;
      }

      summary += '\n';
    }

    return summary.trim();
  }

  /**
   * Generate suggestions based on context
   */
  async generateSuggestions(context: AppContext): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];
    const now = new Date();

    // Suggest taking a break if working for too long
    if (context.activeSession && context.activeSession.isActive) {
      const sessionDuration =
        now.getTime() - context.activeSession.startTime.getTime();
      const hoursWorked = sessionDuration / (1000 * 60 * 60);

      if (hoursWorked > 2) {
        suggestions.push({
          id: `break-${now.getTime()}`,
          type: 'break',
          title: 'Consider Taking a Break',
          description: `You've been working for ${Math.round(hoursWorked * 10) / 10} hours. Taking a break can improve focus and productivity.`,
          confidence: 85,
          actionable: true,
          priority: Priority.MEDIUM,
          estimatedImpact: 70,
          reasoning:
            'Long work sessions without breaks can lead to decreased productivity and mental fatigue.',
          createdAt: now,
        });
      }
    }

    return suggestions;
  }

  /**
   * Extract reasoning from response
   */
  private extractReasoning(response: string): string {
    const reasoningWords = [
      'because',
      'since',
      'due to',
      'this is',
      'the reason',
    ];

    for (const word of reasoningWords) {
      const index = response.toLowerCase().indexOf(word);
      if (index !== -1) {
        const sentence = response.substring(index);
        const endIndex =
          sentence.indexOf('.') !== -1
            ? sentence.indexOf('.') + 1
            : sentence.length;
        return sentence.substring(0, endIndex);
      }
    }

    return 'Analysis based on ReAct reasoning pattern and current context.';
  }

  /**
   * Set API key and reinitialize
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Clear conversation history (ReAct is stateless per invocation)
   */
  clearConversation(): void {
    // ReAct graph is stateless, so no need to clear anything
  }

  /**
   * Analyze productivity patterns
   */
  async analyzePatterns(): Promise<PatternAnalysis> {
    const now = new Date();

    return {
      userId: 'current-user',
      analysisDate: now,
      productivityPatterns: [],
      energyPatterns: [],
      recommendations: [],
      insights: {
        mostProductiveTime: { start: '09:00', end: '11:00', dayOfWeek: 1 },
        leastProductiveTime: { start: '14:00', end: '16:00', dayOfWeek: 5 },
        averageTaskDuration: 45,
        completionRate: 0.75,
        focusEfficiency: 0.82,
      },
    };
  }
}

// Singleton instance
let reactAIServiceInstance: ReactAIService | null = null;

/**
 * Get ReactAIService instance
 */
export function getReactAIService(): ReactAIService {
  if (!reactAIServiceInstance) {
    reactAIServiceInstance = new ReactAIService();
  }
  return reactAIServiceInstance;
}

/**
 * Initialize ReAct AI service with API key
 */
export function initializeReactAIService(apiKey: string): ReactAIService {
  if (!reactAIServiceInstance) {
    reactAIServiceInstance = new ReactAIService();
  }
  reactAIServiceInstance.setApiKey(apiKey);
  return reactAIServiceInstance;
}
