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
import { PersonalityService } from './PersonalityService';
import { ResponseTemplates } from './ResponseTemplates';
import { EmotionalIntelligenceService } from './EmotionalIntelligenceService';
import {
  getPerformanceMonitor,
  PerformanceMonitor,
} from './PerformanceMonitor';
import type { UserPreferences, EmotionalTone } from '../../types';

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
5. Manage recurring tasks and automation

Available tools:
- create_task: Create new tasks with details
- update_task: Modify existing tasks
- get_tasks: Retrieve and search tasks
- start_timer: Begin timing work on tasks
- stop_timer: End current timer sessions
- get_time_data: Analyze time tracking data
- analyze_productivity: Generate productivity insights
- create_periodic_task: Set up recurring task templates
- get_periodic_tasks: View and manage periodic task templates
- update_periodic_task: Modify recurring task patterns
- generate_periodic_instances: Create new instances from templates
- suggest_recurrence: Recommend recurrence patterns for tasks

Periodic Tasks Features:
- Help users create recurring tasks for habits, routines, and regular responsibilities
- Support various recurrence patterns: daily, weekly, biweekly, monthly, or custom intervals
- Automatically generate new task instances based on schedules
- Manage template activation/deactivation and pattern modifications
- Provide intelligent suggestions for recurrence patterns based on task descriptions

Natural Language Understanding for Periodic Tasks:
- "Set up a daily workout reminder" → create_periodic_task with daily recurrence
- "Create a weekly team meeting task" → create_periodic_task with weekly recurrence
- "I need to review reports every month" → create_periodic_task with monthly recurrence
- "Show me my recurring tasks" → get_periodic_tasks
- "Generate pending recurring tasks" → generate_periodic_instances
- "What recurrence pattern should I use for [task]?" → suggest_recurrence

Guidelines:
- Always reason through problems step by step
- Use tools when users request specific actions
- Provide clear explanations for your reasoning
- Respect user privacy - all data stays local
- Be helpful, concise, and professional
- For recurring tasks, suggest appropriate recurrence patterns based on task type
- Explain the benefits of automation for repetitive tasks

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
  private personalityService: PersonalityService | null = null;
  private emotionalIntelligenceService: EmotionalIntelligenceService | null =
    null;
  private performanceMonitor: PerformanceMonitor;

  constructor(apiKey?: string, translationFunction?: TranslationFunction) {
    this.apiKey = apiKey || this.getEnvironmentApiKey() || null;
    this.translationFunction = translationFunction || null;
    this.toolExecutionEngine = getToolExecutionEngine();
    this.resultFormatter = getToolResultFormatter();
    this.performanceMonitor = getPerformanceMonitor();

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

    // Initialize personality services
    this.initializePersonalityServices();
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
    const operationId = `ai-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Start performance monitoring
    this.performanceMonitor.startOperation(operationId, {
      type: 'ai_request',
      messageLength: message.length,
      contextSize: JSON.stringify(context).length,
    });

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

      // Apply personality and emotional intelligence to the response
      const enhancedMessage = await this.applyPersonalityToResponse(
        responseMessage || "I've processed your request.",
        message,
        context
      );

      const response: AIResponse = {
        message: enhancedMessage,
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

      // End performance monitoring - success
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        additionalMetrics: {
          response_length: response.message.length,
          actions_count: response.actions?.length || 0,
          suggestions_count: response.suggestions?.length || 0,
        },
      });

      return response;
    } catch (error) {
      console.error('ReAct AI Service Error:', error);

      // End performance monitoring - error
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

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

  /**
   * Initialize personality services with current user preferences
   */
  private initializePersonalityServices(): void {
    try {
      // Get user preferences from localStorage
      const preferences = this.getUserPreferences();

      // Initialize personality service
      this.personalityService = new PersonalityService(preferences.aiSettings);

      // Initialize emotional intelligence service
      const emotionalConfig = {
        enabled: true,
        dailyMoodTracking:
          preferences.aiSettings.emotionalFeatures?.dailyMoodTracking || false,
        stressDetection:
          preferences.aiSettings.emotionalFeatures?.stressDetection !== false,
        encouragementFrequency:
          preferences.aiSettings.emotionalFeatures?.encouragementFrequency ||
          'medium',
        celebrationStyle:
          preferences.aiSettings.emotionalFeatures?.celebrationStyle ||
          'enthusiastic',
        personalitySettings: preferences.aiSettings.personalitySettings || {
          warmth: 6,
          enthusiasm: 5,
          supportiveness: 7,
          humor: 4,
        },
        interactionStyle: preferences.aiSettings.interactionStyle || 'friendly',
        emojiUsage: preferences.aiSettings.emojiUsage || 'moderate',
      };

      this.emotionalIntelligenceService = new EmotionalIntelligenceService(
        emotionalConfig
      );
    } catch (error) {
      console.warn('Failed to initialize personality services:', error);
      // Continue without personality features
    }
  }

  /**
   * Get user preferences from localStorage
   */
  private getUserPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem('kirapilot-preferences');
      if (stored) {
        const prefs = JSON.parse(stored);
        return prefs as UserPreferences;
      }
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
    }

    // Return default preferences
    return {
      workingHours: { start: '09:00', end: '17:00' },
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        breakInterval: 25,
      },
      focusPreferences: {
        defaultDuration: 25,
        distractionLevel: DistractionLevel.MODERATE,
        backgroundAudio: { enabled: false, volume: 50, type: 'nature' },
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
        personalitySettings: {
          warmth: 6,
          enthusiasm: 5,
          supportiveness: 7,
          humor: 4,
        },
        interactionStyle: 'friendly',
        emojiUsage: 'moderate',
        emotionalFeatures: {
          dailyMoodTracking: false,
          stressDetection: true,
          encouragementFrequency: 'medium',
          celebrationStyle: 'enthusiastic',
        },
      },
      taskSettings: {
        defaultPriority: Priority.MEDIUM,
        autoScheduling: false,
        smartDependencies: false,
        weekStartDay: 1,
        showCompletedTasks: false,
        compactView: false,
      },
      soundSettings: {
        hapticFeedback: true,
        completionSound: true,
        soundVolume: 70,
      },
      theme: 'auto',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
    } as UserPreferences;
  }

  /**
   * Apply personality and emotional intelligence to AI response
   */
  private async applyPersonalityToResponse(
    originalResponse: string,
    userMessage: string,
    context: AppContext
  ): Promise<string> {
    if (!this.personalityService || !this.emotionalIntelligenceService) {
      return originalResponse;
    }

    try {
      // Detect user mood from message and context
      const moodDetection =
        this.emotionalIntelligenceService.detectMoodFromInteraction(
          userMessage,
          context,
          [] // Recent activity would come from context in a real implementation
        );

      // Generate emotional context
      const emotionalContext =
        this.emotionalIntelligenceService.generateEmotionalContext(
          moodDetection.detectedMood,
          [], // Recent activity
          context
        );

      // Calculate appropriate emotional tone
      const tone = this.personalityService.calculateEmotionalTone(
        moodDetection.detectedMood,
        emotionalContext
      );

      // Check if we need to provide additional support
      const stressTriggers = this.personalityService.detectStressTriggers(
        userMessage,
        [], // Recent activity
        moodDetection.detectedMood
      );

      // Generate supportive response if needed
      if (
        stressTriggers.triggers.length > 0 ||
        moodDetection.detectedMood.stress > 6
      ) {
        const supportResponse =
          this.personalityService.generateSupportiveResponse(
            emotionalContext,
            userMessage,
            tone
          );

        // Combine original response with supportive elements
        let enhancedResponse = originalResponse;

        // Add supportive message if it provides value
        if (
          supportResponse.message &&
          !originalResponse.toLowerCase().includes('stress') &&
          !originalResponse.toLowerCase().includes('overwhelm')
        ) {
          enhancedResponse = `${supportResponse.message}\n\n${originalResponse}`;
        }

        // Add suggested actions if relevant
        if (supportResponse.suggestedActions.length > 0) {
          enhancedResponse +=
            '\n\n💡 Here are some suggestions that might help:';
          supportResponse.suggestedActions.slice(0, 3).forEach(action => {
            enhancedResponse += `\n• ${action}`;
          });
        }

        return enhancedResponse;
      }

      // For positive interactions, add celebration or encouragement
      if (emotionalContext.recentAchievements.length > 0) {
        const celebrationTemplates = ResponseTemplates.getCelebrationTemplates(
          'task_completion',
          tone
        );
        const celebration =
          ResponseTemplates.getRandomTemplate(celebrationTemplates);

        return `${celebration}\n\n${originalResponse}`;
      }

      // Add contextual greetings for conversation starters
      if (this.isConversationStarter(userMessage)) {
        const timeOfDay = this.getTimeOfDay();
        const greetingTemplates = ResponseTemplates.getGreetingTemplates(
          timeOfDay,
          tone
        );
        const greeting = ResponseTemplates.getRandomTemplate(greetingTemplates);

        return `${greeting}\n\n${originalResponse}`;
      }

      // Add casual conversation elements for friendly interactions
      if (tone.warmth > 6 && tone.formality < 5) {
        const casualTemplates =
          ResponseTemplates.getCasualConversationTemplates('small_talk', tone);

        // Occasionally add casual conversation starter (20% chance)
        if (Math.random() > 0.8 && originalResponse.length < 100) {
          const casual = ResponseTemplates.getRandomTemplate(casualTemplates);
          return `${casual}\n\n${originalResponse}`;
        }
      }

      // Apply general personality tone adjustments
      return this.adjustResponseTone(originalResponse, tone);
    } catch (error) {
      console.warn('Failed to apply personality to response:', error);
      return originalResponse;
    }
  }

  /**
   * Adjust response tone based on personality settings
   */
  private adjustResponseTone(response: string, tone: EmotionalTone): string {
    let adjusted = response;

    // Apply comprehensive tone adjustments using ResponseTemplates
    const templates = [adjusted];
    const adjustedTemplates = ResponseTemplates.adjustTemplatesForTone(
      templates,
      tone
    );
    adjusted = adjustedTemplates[0];

    // Add conversational elements based on tone
    if (tone.warmth > 6 && tone.formality < 5) {
      // Add conversational connectors
      const connectors = [
        'By the way, ',
        'Also, ',
        'Oh, and ',
        'Just so you know, ',
        'I should mention, ',
      ];

      // Occasionally add conversational elements (20% chance)
      if (
        Math.random() > 0.8 &&
        !adjusted.toLowerCase().startsWith('by the way') &&
        !adjusted.toLowerCase().startsWith('also') &&
        !adjusted.toLowerCase().startsWith('oh')
      ) {
        const connector =
          connectors[Math.floor(Math.random() * connectors.length)];
        adjusted =
          connector + adjusted.toLowerCase().charAt(0) + adjusted.slice(1);
      }
    }

    // Add personality-driven response variations
    if (tone.enthusiasm > 7) {
      // High enthusiasm: add energy and excitement
      adjusted = adjusted.replace(/\bGood\b/g, 'Fantastic');
      adjusted = adjusted.replace(/\bOkay\b/g, 'Perfect');
      adjusted = adjusted.replace(/\bYes\b/g, 'Absolutely');

      // Add energetic endings occasionally
      if (
        Math.random() > 0.7 &&
        !adjusted.endsWith('!') &&
        !adjusted.endsWith('!!')
      ) {
        const energeticEndings = [
          " Let's do this!",
          " I'm excited to see what you accomplish!",
          " You've got this!",
          ' This is going to be great!',
        ];
        const ending =
          energeticEndings[Math.floor(Math.random() * energeticEndings.length)];
        adjusted += ending;
      }
    } else if (tone.enthusiasm < 4) {
      // Low enthusiasm: more measured and calm
      adjusted = adjusted.replace(/!/g, '.');
      adjusted = adjusted.replace(/\bFantastic\b/g, 'Good');
      adjusted = adjusted.replace(/\bAmazing\b/g, 'Fine');
      adjusted = adjusted.replace(/\bAbsolutely\b/g, 'Yes');
    }

    // Adjust warmth and personal connection
    if (tone.warmth > 7) {
      // High warmth: add personal touches and caring language
      const personalTouches = [
        'I genuinely want to help you succeed with this.',
        "I'm here to support you through this.",
        'I care about your progress and well-being.',
        'Your success matters to me.',
      ];

      // Occasionally add personal touches (15% chance)
      if (Math.random() > 0.85 && adjusted.length < 200) {
        const touch =
          personalTouches[Math.floor(Math.random() * personalTouches.length)];
        adjusted += ` ${touch}`;
      }
    }

    // Adjust supportiveness with encouraging language
    if (tone.supportiveness > 7) {
      // Replace potentially discouraging words with supportive alternatives
      const supportiveReplacements = {
        difficult: 'challenging',
        hard: 'tough (but manageable)',
        impossible: 'challenging',
        "can't": "haven't yet",
        failed: 'learned',
        wrong: 'different from expected',
      };

      Object.entries(supportiveReplacements).forEach(([word, replacement]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        adjusted = adjusted.replace(regex, replacement);
      });

      // Add encouraging endings occasionally
      if (Math.random() > 0.8 && adjusted.length < 150) {
        const encouragements = [
          " You're making progress!",
          ' Keep going!',
          " You're doing well!",
          ' I believe in you!',
        ];
        const encouragement =
          encouragements[Math.floor(Math.random() * encouragements.length)];
        adjusted += encouragement;
      }
    }

    // Add appropriate emoji based on settings and context
    const preferences = this.getUserPreferences();
    const emojiUsage = preferences.aiSettings.emojiUsage || 'moderate';

    if (emojiUsage !== 'minimal' && !this.hasEmoji(adjusted)) {
      const emoji = this.selectContextualEmoji(adjusted, tone, emojiUsage);
      if (emoji) {
        adjusted += ` ${emoji}`;
      }
    }

    return adjusted.trim();
  }

  /**
   * Check if text contains emoji
   */
  private hasEmoji(text: string): boolean {
    return /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
      text
    );
  }

  /**
   * Select contextual emoji based on response content and tone
   */
  private selectContextualEmoji(
    response: string,
    tone: EmotionalTone,
    usage: 'minimal' | 'moderate' | 'frequent'
  ): string {
    const lowerResponse = response.toLowerCase();

    // Don't add emoji if usage is minimal or response is very long
    if (usage === 'minimal' || response.length > 200) {
      return '';
    }

    // Determine emoji based on content and tone
    if (
      lowerResponse.includes('congratulations') ||
      lowerResponse.includes('achievement') ||
      lowerResponse.includes('completed')
    ) {
      return tone.enthusiasm > 6 ? '🎉' : '👏';
    }

    if (
      lowerResponse.includes('stress') ||
      lowerResponse.includes('overwhelm') ||
      lowerResponse.includes('difficult')
    ) {
      return tone.supportiveness > 6 ? '🤗' : '💙';
    }

    if (
      lowerResponse.includes('great') ||
      lowerResponse.includes('fantastic') ||
      lowerResponse.includes('amazing')
    ) {
      return tone.enthusiasm > 7 ? '✨' : '😊';
    }

    if (lowerResponse.includes('help') || lowerResponse.includes('support')) {
      return tone.warmth > 6 ? '💪' : '👍';
    }

    // Default emoji based on tone and usage frequency
    if (usage === 'frequent') {
      if (tone.enthusiasm > 6) {
        return '✨';
      }
      if (tone.warmth > 6) {
        return '😊';
      }
      if (tone.supportiveness > 6) {
        return '💙';
      }
    }

    return ''; // No emoji for moderate usage with neutral content
  }

  /**
   * Check if user message is a conversation starter
   */
  private isConversationStarter(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    const conversationStarters = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'how are you',
      "what's up",
      "how's it going",
      'greetings',
    ];

    return conversationStarters.some(
      starter => lowerMessage.startsWith(starter) || lowerMessage === starter
    );
  }

  /**
   * Get current time of day for contextual responses
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'morning';
    } else if (hour < 17) {
      return 'afternoon';
    } else {
      return 'evening';
    }
  }

  /**
   * Update personality services when preferences change
   */
  updatePersonalityPreferences(
    preferences: UserPreferences['aiSettings']
  ): void {
    if (this.personalityService) {
      this.personalityService.updatePreferences(preferences);
    }

    if (this.emotionalIntelligenceService) {
      const emotionalConfig = {
        enabled: true,
        dailyMoodTracking:
          preferences.emotionalFeatures?.dailyMoodTracking || false,
        stressDetection:
          preferences.emotionalFeatures?.stressDetection !== false,
        encouragementFrequency:
          preferences.emotionalFeatures?.encouragementFrequency || 'medium',
        celebrationStyle:
          preferences.emotionalFeatures?.celebrationStyle || 'enthusiastic',
        personalitySettings: preferences.personalitySettings || {
          warmth: 6,
          enthusiasm: 5,
          supportiveness: 7,
          humor: 4,
        },
        interactionStyle: preferences.interactionStyle || 'friendly',
        emojiUsage: preferences.emojiUsage || 'moderate',
      };

      this.emotionalIntelligenceService.updateConfig(emotionalConfig);
    }
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
