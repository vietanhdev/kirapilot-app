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
import {
  ToolExecutionEngine,
  PermissionLevel,
  getToolExecutionEngine,
  TranslationFunction,
} from './ToolExecutionEngine';
import {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
  ModelProcessingError,
} from './AIServiceInterface';
import { TranslationKey } from '../../i18n';
import {
  ToolResultFormatter,
  FormattedToolResult,
  getToolResultFormatter,
} from './ToolResultFormatter';
import {
  LoggingInterceptor,
  getLoggingInterceptor,
} from './LoggingInterceptor';

// Internal types for AI service
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
}

interface ToolExecution {
  name: string;
  args: Record<string, unknown>;
  id: string;
}

// TaskSummary interface removed as it's no longer used
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
      aiSettings: {
        conversationHistory: true,
        autoSuggestions: true,
        toolPermissions: true,
        responseStyle: 'balanced',
        suggestionFrequency: 'moderate',
        showInteractionLogs: false,
      },
      taskSettings: {
        defaultPriority: Priority.MEDIUM,
        autoScheduling: false,
        smartDependencies: true,
        weekStartDay: 1,
        showCompletedTasks: true,
        compactView: false,
      },
      soundSettings: {
        hapticFeedback: true,
        completionSound: true,
        soundVolume: 50,
      },
      theme: 'auto',
      language: 'en',
      dateFormat: 'DD/MM/YYYY' as const,
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
 * Implements AIServiceInterface for compatibility with ModelManager
 */
export class ReactAIService implements AIServiceInterface {
  private apiKey: string | null = null;
  private toolExecutionEngine: ToolExecutionEngine;
  private resultFormatter: ToolResultFormatter;
  private translationFunction: TranslationFunction | null = null;
  private loggingInterceptor: LoggingInterceptor | null = null;

  constructor(apiKey?: string, translationFunction?: TranslationFunction) {
    this.apiKey = apiKey || this.getEnvironmentApiKey() || null;
    this.translationFunction = translationFunction || null;
    this.toolExecutionEngine = getToolExecutionEngine();
    this.resultFormatter = getToolResultFormatter();

    // Initialize logging interceptor if available
    try {
      this.loggingInterceptor = getLoggingInterceptor();
    } catch {
      // Logging interceptor not initialized yet, will be set later
      this.loggingInterceptor = null;
    }

    // Set translation function if provided
    if (this.translationFunction) {
      this.toolExecutionEngine.setTranslationFunction(this.translationFunction);
    }
  }

  private getEnvironmentApiKey(): string | null {
    try {
      // Handle both browser and test environments
      const windowWithImport = window as typeof window & {
        import?: { meta?: { env?: { VITE_GOOGLE_API_KEY?: string } } };
      };

      if (typeof window !== 'undefined' && windowWithImport.import?.meta?.env) {
        return windowWithImport.import.meta.env.VITE_GOOGLE_API_KEY || null;
      }

      // In browser environment with Vite
      const globalWithImport = globalThis as typeof globalThis & {
        import?: { meta?: { env?: { VITE_GOOGLE_API_KEY?: string } } };
      };

      if (
        typeof globalThis !== 'undefined' &&
        globalWithImport.import?.meta?.env
      ) {
        return globalWithImport.import.meta.env.VITE_GOOGLE_API_KEY || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Process a user message using the ReAct pattern
   */
  async processMessage(
    message: string,
    context: AppContext
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let requestId: string | null = null;

    try {
      if (!this.apiKey) {
        const errorMessage = this.translationFunction
          ? this.translationFunction(
              'ai.error.apiKeyRequired' as TranslationKey
            )
          : 'AI model not initialized. Please provide a valid API key.';
        throw new Error(errorMessage);
      }

      // Intercept request for logging
      if (this.loggingInterceptor) {
        try {
          requestId = await this.loggingInterceptor.interceptRequest(
            this,
            message,
            context
          );
        } catch (error) {
          console.warn('Failed to intercept request for logging:', error);
        }
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
            .filter(item => 'type' in item && item.type === 'text')
            .map(item => ('text' in item ? item.text : ''))
            .join('');
        } else if (typeof lastMessage.content === 'string') {
          responseMessage = lastMessage.content;
        } else {
          responseMessage = String(lastMessage.content);
        }
      }

      // Process tool executions from the conversation
      const toolExecutions = this.extractToolExecutions(messages);
      const formattedResults: FormattedToolResult[] = [];

      if (toolExecutions.length > 0) {
        // Validate and format tool executions
        for (const execution of toolExecutions) {
          const validation = this.toolExecutionEngine.validateExecution(
            execution.name,
            execution.args
          );

          if (!validation.allowed) {
            formattedResults.push({
              success: false,
              error: validation.reason,
              userMessage: `❌ ${execution.name} failed: ${validation.reason}`,
              formattedMessage: `❌ ${execution.name} failed: ${validation.reason}`,
            });
            continue;
          }

          // Find corresponding tool result in messages
          const toolResult = this.findToolResult(messages, execution.id);
          if (toolResult) {
            const executionResult = this.toolExecutionEngine.formatResult(
              execution.name,
              toolResult,
              0 // execution time not available from LangGraph
            );

            const formattedResult = this.resultFormatter.format(
              execution.name,
              executionResult,
              JSON.parse(toolResult)
            );

            formattedResults.push(formattedResult);

            // Create action record
            actions.push({
              type: execution.name.toUpperCase() as AIAction['type'],
              parameters: execution.args,
              context,
              confidence: formattedResult.success ? 100 : 0,
              reasoning: `Selected ${execution.name} tool based on user request analysis and current context`,
            });
          }
        }

        // If we have tool executions but no text response, generate one from formatted results
        if (!responseMessage.trim()) {
          responseMessage = formattedResults
            .map(result => result.formattedMessage)
            .join('\n\n');
        }
      }

      // Generate suggestions
      const suggestions = await this.generateSuggestions(context);

      const response: AIResponse = {
        message: responseMessage || "I've processed your request.",
        actions,
        suggestions,
        context,
        reasoning: this.extractReasoning(responseMessage),
      };

      // Intercept response for logging
      if (this.loggingInterceptor && requestId) {
        try {
          const responseTime = Date.now() - startTime;
          await this.loggingInterceptor.interceptResponse(requestId, response, {
            responseTime,
            tokenCount: undefined, // Token count not available from LangGraph
            modelInfo: this.getModelInfo(),
            sessionId: this.loggingInterceptor.getCurrentSessionId(),
            timestamp: new Date(),
          });
        } catch (error) {
          console.warn('Failed to intercept response for logging:', error);
        }
      }

      return response;
    } catch (error) {
      console.error('ReAct AI Service Error:', error);

      // Intercept error for logging
      if (this.loggingInterceptor && requestId) {
        try {
          await this.loggingInterceptor.interceptError(
            requestId,
            error as Error,
            {
              message,
              context,
              sessionId: this.loggingInterceptor.getCurrentSessionId(),
              timestamp: new Date(startTime),
              modelInfo: this.getModelInfo(),
            }
          );
        } catch (logError) {
          console.warn('Failed to intercept error for logging:', logError);
        }
      }

      // Throw a ModelProcessingError for better error handling by ModelManager
      throw new ModelProcessingError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Find tool result message by execution ID
   */
  private findToolResult(
    messages: unknown[],
    executionId: string
  ): string | null {
    for (const message of messages) {
      if (
        message &&
        typeof message === 'object' &&
        'tool_call_id' in message &&
        (message as { tool_call_id: string }).tool_call_id === executionId &&
        'content' in message &&
        typeof (message as { content: string }).content === 'string'
      ) {
        return (message as { content: string }).content;
      }
    }
    return null;
  }

  /**
   * Extract tool executions from message history
   */
  private extractToolExecutions(messages: unknown[]): ToolExecution[] {
    const executions: ToolExecution[] = [];

    for (const message of messages) {
      if (
        message &&
        typeof message === 'object' &&
        'tool_calls' in message &&
        Array.isArray((message as { tool_calls: unknown[] }).tool_calls)
      ) {
        const toolCalls = (message as { tool_calls: ToolCall[] }).tool_calls;
        for (const toolCall of toolCalls) {
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

    return '';
  }

  /**
   * Set API key and reinitialize
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set translation function for localized messages
   */
  setTranslationFunction(translationFunction: TranslationFunction): void {
    this.translationFunction = translationFunction;
    this.toolExecutionEngine.setTranslationFunction(translationFunction);
  }

  /**
   * Set logging interceptor for AI interaction logging
   */
  setLoggingInterceptor(interceptor: LoggingInterceptor): void {
    this.loggingInterceptor = interceptor;
  }

  /**
   * Configure tool execution permissions
   */
  setToolPermissions(permissions: PermissionLevel[]): void {
    this.toolExecutionEngine.setPermissions(permissions);
  }

  /**
   * Get available tools based on current permissions
   */
  getAvailableTools(): string[] {
    return this.toolExecutionEngine.getAvailableTools();
  }

  /**
   * Check if a tool requires confirmation
   */
  toolRequiresConfirmation(toolName: string): boolean {
    return this.toolExecutionEngine.requiresConfirmation(toolName);
  }

  /**
   * Get tool information including permissions and description
   */
  getToolInfo(toolName: string) {
    return this.toolExecutionEngine.getToolInfo(toolName);
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    return {
      name: 'Gemini 2.0 Flash',
      type: 'cloud',
      status: this.isInitialized() ? 'ready' : 'not_initialized',
      capabilities: [
        'text_generation',
        'tool_calling',
        'reasoning',
        'task_management',
        'time_tracking',
        'productivity_analysis',
      ],
      version: '2.0',
      contextSize: 2048,
    };
  }

  /**
   * Get current service status
   */
  getStatus(): ModelStatus {
    return {
      type: 'gemini',
      isReady: this.isInitialized(),
      isLoading: false,
      error: this.isInitialized() ? undefined : 'API key not configured',
      modelInfo: this.getModelInfo(),
    };
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
export function initializeReactAIService(
  apiKey: string,
  translationFunction?: TranslationFunction
): ReactAIService {
  if (!reactAIServiceInstance) {
    reactAIServiceInstance = new ReactAIService();
  }
  reactAIServiceInstance.setApiKey(apiKey);
  if (translationFunction) {
    reactAIServiceInstance.setTranslationFunction(translationFunction);
  }
  return reactAIServiceInstance;
}
