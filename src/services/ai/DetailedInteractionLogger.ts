import { v4 as uuidv4 } from 'uuid';
import { AIServiceInterface, ModelInfo } from './AIServiceInterface';
import { AIResponse, AppContext } from '../../types';
import { ToolExecutionResult } from './ToolExecutionEngine';
import { LogStorageService } from '../database/repositories/LogStorageService';
import { LoggingConfigService } from '../database/repositories/LoggingConfigService';
import { PrivacyFilter } from './PrivacyFilter';
import {
  EnhancedInteractionLogEntry,
  CreateEnhancedLogRequest,
  EmotionalContext,
  PerformanceMetrics,
  LoggingConfig,
} from '../../types/aiLogging';
import {
  StressIndicator,
  Achievement,
  SupportType,
} from '../../types/emotionalIntelligence';

/**
 * Interface for enhanced request context during AI service calls
 */
export interface EnhancedRequestContext {
  message: string;
  context: AppContext;
  sessionId: string;
  timestamp: Date;
  modelInfo: ModelInfo;
  emotionalContext?: EmotionalContext;
  userIntent?: string;
  conversationHistory?: string[];
}

/**
 * Interface for enhanced response metadata
 */
export interface EnhancedResponseMetadata {
  responseTime: number;
  tokenCount?: number;
  modelInfo: ModelInfo;
  sessionId: string;
  timestamp: Date;
  processingSteps: ProcessingStep[];
  confidenceScore?: number;
  reasoningChain?: string[];
}

/**
 * Interface for processing step tracking
 */
export interface ProcessingStep {
  step: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced logging interceptor for AI services with comprehensive data capture
 * Provides detailed interaction logging, tool execution tracking, and performance monitoring
 */
export class DetailedInteractionLogger {
  private logStorageService: LogStorageService;
  private configService: LoggingConfigService;
  private privacyFilter: PrivacyFilter;
  private currentSessionId: string;
  private pendingLogs: Map<string, Partial<EnhancedInteractionLogEntry>> =
    new Map();
  private isEnabled: boolean = true;
  private config: LoggingConfig | null = null;
  private statusCallback?: (
    type: 'capture' | 'error',
    message?: string
  ) => void;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    logStorageService: LogStorageService,
    configService: LoggingConfigService,
    statusCallback?: (type: 'capture' | 'error', message?: string) => void
  ) {
    this.logStorageService = logStorageService;
    this.configService = configService;
    this.privacyFilter = new PrivacyFilter();
    this.currentSessionId = this.generateSessionId();
    this.statusCallback = statusCallback;
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize configuration
    this.initializeConfig();
  }

  /**
   * Initialize logging configuration
   */
  private async initializeConfig(): Promise<void> {
    try {
      this.config = await this.configService.getConfig();
      this.isEnabled = this.config?.enabled ?? true;
    } catch (error) {
      console.warn(
        'Failed to initialize enhanced logging config, using defaults:',
        error
      );
      this.isEnabled = true;
      this.config = LoggingConfigService.getDefaultConfig();
    }
  }

  /**
   * Generate a new session ID with enhanced metadata
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const randomId = uuidv4().slice(0, 8);
    return `enhanced_session_${timestamp}_${randomId}`;
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Start a new session with optional context
   */
  public startNewSession(context?: {
    userId?: string;
    deviceId?: string;
  }): string {
    this.currentSessionId = this.generateSessionId();

    // Log session start if enabled
    if (this.isEnabled && this.config?.includePerformanceMetrics) {
      this.performanceMonitor.logSessionStart(this.currentSessionId, context);
    }

    return this.currentSessionId;
  }

  /**
   * Intercept AI service request with enhanced data capture
   */
  public async interceptRequest(
    service: AIServiceInterface,
    message: string,
    context: AppContext,
    enhancedContext?: Partial<EnhancedRequestContext>
  ): Promise<string> {
    const requestId = uuidv4();
    const startTime = performance.now();

    if (!this.isEnabled || !this.config) {
      return requestId;
    }

    try {
      const timestamp = new Date();
      const modelInfo = service.getModelInfo();

      // Analyze privacy and emotional context
      const privacyAnalysis = this.privacyFilter.analyzeText(message);
      const emotionalContext = this.analyzeEmotionalContext(message, context);

      // Extract user intent using simple heuristics
      const userIntent = this.extractUserIntent(message);

      // Create enhanced log entry
      const partialLog: Partial<EnhancedInteractionLogEntry> = {
        id: requestId,
        timestamp,
        sessionId: this.currentSessionId,
        modelType: modelInfo.type === 'local' ? 'local' : 'gemini',
        modelInfo: {
          name: modelInfo.name,
          version: modelInfo.version,
          provider: modelInfo.type === 'local' ? 'local' : 'google',
          parameters: {
            contextSize: modelInfo.contextSize,
            capabilities: modelInfo.capabilities,
          },
        },
        userMessage: privacyAnalysis.containsSensitiveData
          ? this.privacyFilter.redactText(message)
          : message,
        systemPrompt: this.config.includeSystemPrompts
          ? this.extractSystemPrompt(context)
          : undefined,
        context: JSON.stringify(this.sanitizeContext(context)),
        emotionalContext,
        userIntent,
        conversationHistory: enhancedContext?.conversationHistory || [],
        containsSensitiveData: privacyAnalysis.containsSensitiveData,
        dataClassification: privacyAnalysis.dataClassification,
        performanceMetrics: {
          requestStartTime: startTime,
          processingSteps: [],
          totalDuration: 0, // Will be updated when response is received
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Store partial log for completion later
      this.pendingLogs.set(requestId, partialLog);

      // Track performance metrics
      if (this.config.includePerformanceMetrics) {
        this.performanceMonitor.trackRequest(requestId, {
          modelType: partialLog.modelType!,
          messageLength: message.length,
          contextSize: JSON.stringify(context).length,
        });
      }
    } catch (error) {
      console.warn('Failed to intercept enhanced AI request:', error);
      if (this.statusCallback) {
        this.statusCallback('error', 'Failed to capture request details');
      }
    }

    return requestId;
  }

  /**
   * Intercept AI service response with enhanced metadata
   */
  public async interceptResponse(
    requestId: string,
    response: AIResponse,
    metadata: EnhancedResponseMetadata
  ): Promise<void> {
    if (!this.isEnabled || !this.config) {
      this.pendingLogs.delete(requestId);
      return;
    }

    try {
      const partialLog = this.pendingLogs.get(requestId);
      if (!partialLog) {
        console.warn(`No pending enhanced log found for request ${requestId}`);
        return;
      }

      // Analyze response privacy
      const responsePrivacy = this.privacyFilter.analyzeText(response.message);

      // Extract reasoning chain from response
      const reasoningChain = this.extractReasoningChain(response);

      // Complete the enhanced log entry
      const completeLog: CreateEnhancedLogRequest = {
        sessionId: partialLog.sessionId!,
        modelType: partialLog.modelType!,
        modelInfo: partialLog.modelInfo!,
        userMessage: partialLog.userMessage!,
        systemPrompt: partialLog.systemPrompt,
        context: partialLog.context!,
        emotionalContext: partialLog.emotionalContext,
        userIntent: partialLog.userIntent,
        conversationHistory: partialLog.conversationHistory || [],
        aiResponse: responsePrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(response.message)
          : response.message,
        actions: JSON.stringify(response.actions || []),
        suggestions: JSON.stringify(response.suggestions || []),
        reasoning: response.reasoning,
        reasoningChain,
        responseTime: metadata.responseTime,
        tokenCount: metadata.tokenCount,
        confidenceScore: metadata.confidenceScore,
        processingSteps: metadata.processingSteps,
        containsSensitiveData:
          partialLog.containsSensitiveData ||
          responsePrivacy.containsSensitiveData,
        dataClassification: this.getHighestClassification(
          partialLog.dataClassification!,
          responsePrivacy.dataClassification
        ),
        performanceMetrics: {
          ...partialLog.performanceMetrics!,
          responseEndTime: performance.now(),
          totalDuration: metadata.responseTime,
          processingSteps: metadata.processingSteps,
        },
      };

      // Store the complete log using existing storage service
      const logResult = await this.logStorageService.logInteraction({
        sessionId: completeLog.sessionId,
        modelType: completeLog.modelType,
        modelInfo: completeLog.modelInfo,
        userMessage: completeLog.userMessage,
        systemPrompt: completeLog.systemPrompt,
        context: completeLog.context,
        aiResponse: completeLog.aiResponse,
        actions: completeLog.actions,
        suggestions: completeLog.suggestions,
        reasoning: completeLog.reasoning,
        responseTime: completeLog.responseTime,
        tokenCount: completeLog.tokenCount,
        containsSensitiveData: completeLog.containsSensitiveData,
        dataClassification: completeLog.dataClassification,
      });

      const logId = logResult.id;

      // Log enhanced tool executions if enabled
      if (
        this.config.includeToolExecutions &&
        response.actions &&
        response.actions.length > 0
      ) {
        await this.logEnhancedToolExecutions(
          logId,
          response.actions,
          metadata.responseTime,
          completeLog.performanceMetrics
        );
      }

      // Update performance monitoring
      if (this.config.includePerformanceMetrics) {
        this.performanceMonitor.completeRequest(requestId, {
          success: true,
          responseTime: metadata.responseTime,
          tokenCount: metadata.tokenCount,
          toolsUsed: response.actions?.length || 0,
        });
      }

      // Notify status callback of successful capture
      if (this.statusCallback) {
        this.statusCallback('capture');
      }

      // Clean up pending log
      this.pendingLogs.delete(requestId);
    } catch (error) {
      console.warn('Failed to intercept enhanced AI response:', error);
      if (this.statusCallback) {
        this.statusCallback(
          'error',
          error instanceof Error
            ? error.message
            : 'Failed to log enhanced interaction'
        );
      }
      this.pendingLogs.delete(requestId);
    }
  }

  /**
   * Log enhanced tool execution with detailed metadata
   */
  public async logEnhancedToolExecution(
    interactionLogId: string,
    toolName: string,
    args: Record<string, unknown>,
    result: ToolExecutionResult,
    executionTime: number,
    reasoning?: string,
    userConfirmed?: boolean
  ): Promise<void> {
    if (!this.isEnabled || !this.config?.includeToolExecutions) {
      return;
    }

    try {
      // Analyze privacy of tool arguments and results
      const argsText = JSON.stringify(args);
      const resultText = JSON.stringify(result);
      const argsPrivacy = this.privacyFilter.analyzeText(argsText);
      const resultPrivacy = this.privacyFilter.analyzeText(resultText);

      // Create enhanced tool execution log
      const enhancedToolLog = {
        interactionLogId,
        toolName,
        arguments: argsPrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(argsText)
          : argsText,
        result: resultPrivacy.containsSensitiveData
          ? this.privacyFilter.redactText(resultText)
          : resultText,
        executionTime,
        success: result.success,
        error: result.error,
        reasoning,
        userConfirmed: userConfirmed ?? false,
        metadata: {
          permissions: result.metadata?.permissions || [],
          resourcesAccessed: this.extractResourcesAccessed(args, result),
          impactLevel: this.assessImpactLevel(toolName, args, result),
        },
      };

      // Use existing storage service with enhanced data
      await this.logStorageService.logToolExecution({
        interactionLogId: enhancedToolLog.interactionLogId,
        toolName: enhancedToolLog.toolName,
        arguments: enhancedToolLog.arguments,
        result: enhancedToolLog.result,
        executionTime: enhancedToolLog.executionTime,
        success: enhancedToolLog.success,
        error: enhancedToolLog.error,
      });
    } catch (error) {
      console.warn('Failed to log enhanced tool execution:', error);
    }
  }

  /**
   * Analyze emotional context from user message and app context
   */
  private analyzeEmotionalContext(
    message: string,
    context: AppContext
  ): EmotionalContext {
    // Simple emotional analysis based on keywords and context
    const stressIndicators = this.detectStressIndicators(message, context);
    const mood = this.estimateMood(message, context);
    const supportNeeds = this.identifySupportNeeds(message, context);

    return {
      currentMood: mood,
      stressIndicators,
      recentAchievements: this.extractRecentAchievements(context),
      supportNeeds,
    };
  }

  /**
   * Extract user intent from message using simple heuristics
   */
  private extractUserIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Task management intents
    if (
      lowerMessage.includes('create') ||
      lowerMessage.includes('add') ||
      lowerMessage.includes('new')
    ) {
      return 'create_task';
    }
    if (
      lowerMessage.includes('complete') ||
      lowerMessage.includes('finish') ||
      lowerMessage.includes('done')
    ) {
      return 'complete_task';
    }
    if (
      lowerMessage.includes('update') ||
      lowerMessage.includes('edit') ||
      lowerMessage.includes('change')
    ) {
      return 'update_task';
    }
    if (lowerMessage.includes('delete') || lowerMessage.includes('remove')) {
      return 'delete_task';
    }

    // Timer intents
    if (
      lowerMessage.includes('start timer') ||
      lowerMessage.includes('begin session')
    ) {
      return 'start_timer';
    }
    if (
      lowerMessage.includes('stop timer') ||
      lowerMessage.includes('end session')
    ) {
      return 'stop_timer';
    }

    // Information seeking
    if (
      lowerMessage.includes('show') ||
      lowerMessage.includes('list') ||
      lowerMessage.includes('what')
    ) {
      return 'get_information';
    }
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return 'get_help';
    }

    return 'general_interaction';
  }

  /**
   * Extract reasoning chain from AI response
   */
  private extractReasoningChain(response: AIResponse): string[] {
    const reasoningChain: string[] = [];

    if (response.reasoning) {
      // Split reasoning into logical steps
      const steps = response.reasoning
        .split(/\d+\.|Step \d+:|First,|Then,|Next,|Finally,/i)
        .map(step => step.trim())
        .filter(step => step.length > 0);

      reasoningChain.push(...steps);
    }

    // Add action-based reasoning
    if (response.actions && response.actions.length > 0) {
      response.actions.forEach((action: unknown) => {
        if (action && typeof action === 'object' && 'type' in action) {
          const typedAction = action as { type: string };
          reasoningChain.push(`Decided to use ${typedAction.type} tool`);
        }
      });
    }

    return reasoningChain;
  }

  /**
   * Log multiple enhanced tool executions
   */
  private async logEnhancedToolExecutions(
    interactionLogId: string,
    actions: unknown[],
    totalResponseTime: number,
    _performanceMetrics: PerformanceMetrics
  ): Promise<void> {
    const estimatedTimePerTool =
      totalResponseTime / Math.max(actions.length, 1);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      if (
        action &&
        typeof action === 'object' &&
        'type' in action &&
        'parameters' in action &&
        typeof (action as Record<string, unknown>).type === 'string' &&
        typeof (action as Record<string, unknown>).parameters === 'object'
      ) {
        const typedAction = action as {
          type: string;
          parameters: Record<string, unknown>;
        };

        const mockResult: ToolExecutionResult = {
          success: true,
          data: typedAction.parameters,
          userMessage: `Executed ${typedAction.type}`,
          metadata: {
            executionTime: estimatedTimePerTool,
            toolName: typedAction.type.toLowerCase(),
            permissions: [],
          },
        };

        await this.logEnhancedToolExecution(
          interactionLogId,
          typedAction.type.toLowerCase(),
          typedAction.parameters,
          mockResult,
          estimatedTimePerTool,
          `Tool ${i + 1} of ${actions.length} in response chain`,
          true // Assume confirmed since it was executed
        );
      }
    }
  }

  // Helper methods for emotional analysis
  private detectStressIndicators(
    message: string,
    context: AppContext
  ): StressIndicator[] {
    const indicators: StressIndicator[] = [];
    const lowerMessage = message.toLowerCase();
    const now = new Date();

    if (
      lowerMessage.includes('urgent') ||
      lowerMessage.includes('asap') ||
      lowerMessage.includes('immediately')
    ) {
      indicators.push({
        type: 'time_pressure',
        severity: 7,
        description: 'Urgency language detected in message',
        detectedAt: now,
      });
    }
    if (
      lowerMessage.includes('overwhelmed') ||
      lowerMessage.includes('too much') ||
      lowerMessage.includes("can't handle")
    ) {
      indicators.push({
        type: 'task_overload',
        severity: 8,
        description: 'Overwhelm expression detected',
        detectedAt: now,
      });
    }
    if (
      lowerMessage.includes('frustrated') ||
      lowerMessage.includes('annoyed') ||
      lowerMessage.includes('irritated')
    ) {
      indicators.push({
        type: 'fatigue',
        severity: 6,
        description: 'Frustration language detected',
        detectedAt: now,
      });
    }

    // Context-based indicators
    if (context.currentEnergy && context.currentEnergy < 3) {
      indicators.push({
        type: 'fatigue',
        severity: 7,
        description: 'Low energy level detected from context',
        detectedAt: now,
      });
    }

    return indicators;
  }

  private estimateMood(
    message: string,
    context: AppContext
  ): {
    energy: number;
    focus: number;
    motivation: number;
    stress: number;
    timestamp: Date;
  } {
    const lowerMessage = message.toLowerCase();
    let energy = 5,
      focus = 5,
      motivation = 5,
      stress = 3;

    // Positive indicators
    if (
      lowerMessage.includes('excited') ||
      lowerMessage.includes('great') ||
      lowerMessage.includes('awesome')
    ) {
      energy += 2;
      motivation += 2;
    }

    // Negative indicators
    if (lowerMessage.includes('tired') || lowerMessage.includes('exhausted')) {
      energy -= 2;
    }
    if (lowerMessage.includes('confused') || lowerMessage.includes('lost')) {
      focus -= 2;
    }
    if (
      lowerMessage.includes('stressed') ||
      lowerMessage.includes('pressure')
    ) {
      stress += 2;
    }

    // Use context energy if available
    if (context.currentEnergy) {
      energy = Math.max(1, Math.min(10, context.currentEnergy));
    }

    return {
      energy: Math.max(1, Math.min(10, energy)),
      focus: Math.max(1, Math.min(10, focus)),
      motivation: Math.max(1, Math.min(10, motivation)),
      stress: Math.max(1, Math.min(10, stress)),
      timestamp: new Date(),
    };
  }

  private identifySupportNeeds(
    message: string,
    _context: AppContext
  ): SupportType[] {
    const needs: SupportType[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('help') || lowerMessage.includes("don't know")) {
      needs.push({
        type: 'encouragement',
        priority: 5,
        message: 'User needs guidance and support',
        actionable: true,
        suggestedActions: ['Provide step-by-step guidance', 'Offer examples'],
      });
    }
    if (
      lowerMessage.includes('overwhelmed') ||
      lowerMessage.includes('too much')
    ) {
      needs.push({
        type: 'task_prioritization',
        priority: 8,
        message: 'User feels overwhelmed and needs help prioritizing',
        actionable: true,
        suggestedActions: [
          'Help prioritize tasks',
          'Suggest breaking down large tasks',
        ],
      });
    }
    if (
      lowerMessage.includes('motivation') ||
      lowerMessage.includes('procrastinating')
    ) {
      needs.push({
        type: 'encouragement',
        priority: 7,
        message: 'User needs motivation boost',
        actionable: true,
        suggestedActions: ['Provide encouragement', 'Suggest small wins'],
      });
    }

    return needs;
  }

  private extractRecentAchievements(context: AppContext): Achievement[] {
    const achievements: Achievement[] = [];

    // Check if user completed tasks recently
    if (context.recentActivity) {
      context.recentActivity.forEach(activity => {
        if (activity.type === 'task_completed') {
          achievements.push({
            id: uuidv4(),
            type: 'task_completion',
            title: 'Task Completed',
            description: `Completed: ${(activity as { description?: string }).description || 'Unknown task'}`,
            significance: 5,
            achievedAt: activity.timestamp,
          });
        }
      });
    }

    return achievements;
  }

  private extractResourcesAccessed(
    args: Record<string, unknown>,
    _result: ToolExecutionResult
  ): string[] {
    const resources: string[] = [];

    // Extract from arguments
    Object.keys(args).forEach(key => {
      if (key.includes('file') || key.includes('path') || key.includes('url')) {
        resources.push(`${key}: ${args[key]}`);
      }
    });

    // Extract from result metadata (if available in future)
    // Note: resourcesAccessed is not currently part of the ToolExecutionResult metadata

    return resources;
  }

  private assessImpactLevel(
    toolName: string,
    args: Record<string, unknown>,
    _result: ToolExecutionResult
  ): 'low' | 'medium' | 'high' {
    // High impact tools
    if (
      toolName.includes('delete') ||
      toolName.includes('remove') ||
      toolName.includes('clear')
    ) {
      return 'high';
    }

    // Medium impact tools
    if (
      toolName.includes('update') ||
      toolName.includes('modify') ||
      toolName.includes('edit')
    ) {
      return 'medium';
    }

    // Check for bulk operations
    if (args.count && typeof args.count === 'number' && args.count > 10) {
      return 'high';
    }

    return 'low';
  }

  // Utility methods from base class
  private getHighestClassification(
    class1: 'public' | 'internal' | 'confidential',
    class2: 'public' | 'internal' | 'confidential'
  ): 'public' | 'internal' | 'confidential' {
    const levels = { public: 0, internal: 1, confidential: 2 };
    return levels[class1] >= levels[class2] ? class1 : class2;
  }

  private extractSystemPrompt(_context: AppContext): string | undefined {
    return undefined; // Service-specific implementation needed
  }

  private sanitizeContext(context: AppContext): Partial<AppContext> {
    return {
      currentTask: context.currentTask
        ? { ...context.currentTask, description: '[TASK_DESCRIPTION]' }
        : undefined,
      activeSession: context.activeSession
        ? { ...context.activeSession, notes: '[SESSION_NOTES]' }
        : undefined,
      focusMode: context.focusMode,
      timeOfDay: context.timeOfDay,
      dayOfWeek: context.dayOfWeek,
      currentEnergy: context.currentEnergy,
      recentActivity: [],
      preferences: { ...context.preferences },
    };
  }

  /**
   * Update logging configuration
   */
  public async updateConfig(config: Partial<LoggingConfig>): Promise<void> {
    try {
      await this.configService.updateConfig(config);
      this.config = await this.configService.getConfig();
      this.isEnabled = this.config?.enabled ?? false;
    } catch (error) {
      console.warn('Failed to update enhanced logging config:', error);
    }
  }

  /**
   * Check if logging is currently enabled
   */
  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current logging configuration
   */
  public getConfig(): LoggingConfig | null {
    return this.config;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.pendingLogs.clear();
    this.performanceMonitor.cleanup();
  }
}

/**
 * Performance monitoring utility class
 */
class PerformanceMonitor {
  private activeRequests: Map<
    string,
    { startTime: number; metadata: Record<string, unknown> }
  > = new Map();
  private sessionMetrics: Map<
    string,
    { startTime: number; requestCount: number; totalResponseTime: number }
  > = new Map();

  trackRequest(requestId: string, metadata: Record<string, unknown>): void {
    this.activeRequests.set(requestId, {
      startTime: performance.now(),
      metadata,
    });
  }

  completeRequest(
    requestId: string,
    result: {
      success: boolean;
      responseTime: number;
      tokenCount?: number;
      toolsUsed: number;
    }
  ): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      // Log performance metrics
      console.debug('Request completed:', {
        requestId,
        duration: performance.now() - request.startTime,
        ...result,
      });

      this.activeRequests.delete(requestId);
    }
  }

  logSessionStart(sessionId: string, _context?: Record<string, unknown>): void {
    this.sessionMetrics.set(sessionId, {
      startTime: performance.now(),
      requestCount: 0,
      totalResponseTime: 0,
    });
  }

  cleanup(): void {
    this.activeRequests.clear();
    this.sessionMetrics.clear();
  }
}

// Singleton instance
let detailedInteractionLoggerInstance: DetailedInteractionLogger | null = null;

/**
 * Get DetailedInteractionLogger singleton instance
 */
export function getDetailedInteractionLogger(): DetailedInteractionLogger {
  if (!detailedInteractionLoggerInstance) {
    throw new Error(
      'DetailedInteractionLogger not initialized. Call initializeDetailedInteractionLogger first.'
    );
  }
  return detailedInteractionLoggerInstance;
}

/**
 * Initialize DetailedInteractionLogger with required services
 */
export function initializeDetailedInteractionLogger(
  logStorageService: LogStorageService,
  configService: LoggingConfigService,
  statusCallback?: (type: 'capture' | 'error', message?: string) => void
): DetailedInteractionLogger {
  detailedInteractionLoggerInstance = new DetailedInteractionLogger(
    logStorageService,
    configService,
    statusCallback
  );
  return detailedInteractionLoggerInstance;
}
