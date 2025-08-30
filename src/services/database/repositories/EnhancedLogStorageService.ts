// Enhanced AI Interaction Log storage service with comprehensive data capture
import {
  EnhancedInteractionLogEntry,
  EnhancedToolExecution,
  CreateEnhancedLogRequest,
  EmotionalContext,
  PerformanceMetrics,
  UserFeedback,
  InteractionQuality,
  LogFilter,
} from '../../../types/aiLogging';
import {
  StressIndicator,
  SupportType,
} from '../../../types/emotionalIntelligence';
import { LogStorageService } from './LogStorageService';
// Note: PrivacyFilter functionality is inherited from base LogStorageService

/**
 * Enhanced log storage service that extends the base LogStorageService
 * with comprehensive data capture and advanced querying capabilities
 */
export class EnhancedLogStorageService extends LogStorageService {
  constructor() {
    super();
  }

  /**
   * Create an enhanced AI interaction log with comprehensive data
   */
  async createEnhancedLog(
    request: CreateEnhancedLogRequest
  ): Promise<EnhancedInteractionLogEntry> {
    try {
      // First create the base interaction log
      const baseLog = await this.logInteraction({
        sessionId: request.sessionId,
        modelType: request.modelType,
        modelInfo: request.modelInfo,
        userMessage: request.userMessage,
        systemPrompt: request.systemPrompt,
        context: request.context,
        aiResponse: request.aiResponse,
        actions: request.actions,
        suggestions: request.suggestions,
        reasoning: request.reasoning,
        responseTime: request.responseTime,
        tokenCount: request.tokenCount,
        error: request.error,
        errorCode: request.errorCode,
        containsSensitiveData: request.containsSensitiveData,
        dataClassification: request.dataClassification,
      });

      // Store enhanced metadata separately (for now, we'll use the existing structure)
      // In a full implementation, this would involve database schema changes
      const enhancedLog: EnhancedInteractionLogEntry = {
        ...baseLog,
        emotionalContext: request.emotionalContext,
        userIntent: request.userIntent,
        conversationHistory: request.conversationHistory,
        reasoningChain: request.reasoningChain,
        confidenceScore: request.confidenceScore,
        toolExecutions: [], // Will be populated by separate tool execution logs
        performanceMetrics: request.performanceMetrics,
        errorContext: request.errorContext,
        userFeedback: request.userFeedback,
        interactionQuality: request.interactionQuality,
      };

      return enhancedLog;
    } catch (error) {
      console.error('Enhanced interaction log creation failed:', error);
      throw new Error(`Failed to create enhanced interaction log: ${error}`);
    }
  }

  /**
   * Get enhanced interaction logs with advanced filtering
   */
  async getEnhancedLogs(
    filters?: EnhancedLogFilter
  ): Promise<EnhancedInteractionLogEntry[]> {
    try {
      // Get base logs first
      const baseLogs = await this.getInteractionLogs(filters);

      // Enhance each log with additional metadata
      const enhancedLogs: EnhancedInteractionLogEntry[] = [];

      for (const baseLog of baseLogs) {
        const toolExecutions = await this.getEnhancedToolExecutions(baseLog.id);

        const enhancedLog: EnhancedInteractionLogEntry = {
          ...baseLog,
          emotionalContext: this.extractEmotionalContext(
            baseLog as unknown as Record<string, unknown>
          ),
          userIntent: this.extractUserIntent(baseLog.userMessage),
          conversationHistory: [], // Would be stored separately in full implementation
          reasoningChain: this.extractReasoningChain(baseLog.reasoning),
          confidenceScore: undefined, // Would be stored separately
          toolExecutions,
          performanceMetrics: this.createPerformanceMetrics(
            baseLog as unknown as Record<string, unknown>
          ),
          errorContext: baseLog.error
            ? { originalError: baseLog.error }
            : undefined,
          userFeedback: this.extractUserFeedback(baseLog.reasoning),
          interactionQuality: undefined, // Would be calculated
        };

        enhancedLogs.push(enhancedLog);
      }

      return enhancedLogs;
    } catch (error) {
      throw new Error(`Failed to get enhanced logs: ${error}`);
    }
  }

  /**
   * Get a single enhanced interaction log by ID
   */
  async getEnhancedLog(
    id: string
  ): Promise<EnhancedInteractionLogEntry | null> {
    try {
      // Get base log first
      const baseLog = await this.getInteractionLog(id);
      if (!baseLog) {
        return null;
      }

      // Get enhanced tool executions
      const toolExecutions = await this.getEnhancedToolExecutions(baseLog.id);

      // Create enhanced log entry
      const enhancedLog: EnhancedInteractionLogEntry = {
        id: baseLog.id,
        timestamp: baseLog.timestamp,
        sessionId: baseLog.sessionId,
        modelType: baseLog.modelType,
        modelInfo: baseLog.modelInfo,
        userMessage: baseLog.userMessage,
        systemPrompt: baseLog.systemPrompt,
        context: baseLog.context,
        emotionalContext: this.extractEmotionalContext(
          baseLog as unknown as Record<string, unknown>
        ),
        userIntent: this.extractUserIntent(baseLog.userMessage),
        conversationHistory: [], // Would need to be stored separately
        aiResponse: baseLog.aiResponse,
        actions: baseLog.actions,
        suggestions: baseLog.suggestions,
        reasoning: baseLog.reasoning,
        reasoningChain: baseLog.reasoning
          ? baseLog.reasoning
              .split(/\d+\.|Step \d+:|First,|Then,|Next,|Finally,/i)
              .map(step => step.trim())
              .filter(step => step.length > 0)
          : undefined,
        confidenceScore: undefined, // Would need to be stored separately
        toolExecutions,
        performanceMetrics: {
          requestStartTime: undefined,
          responseEndTime: undefined,
          totalDuration: baseLog.responseTime,
          processingSteps: [],
          memoryUsage: undefined,
          cpuUsage: undefined,
          networkLatency: undefined,
        },
        responseTime: baseLog.responseTime,
        tokenCount: baseLog.tokenCount,
        error: baseLog.error,
        errorCode: baseLog.errorCode,
        errorContext: undefined,
        containsSensitiveData: baseLog.containsSensitiveData,
        dataClassification: baseLog.dataClassification,
        userFeedback: this.extractUserFeedback(baseLog.reasoning),
        interactionQuality: undefined,
        createdAt: baseLog.createdAt,
        updatedAt: baseLog.updatedAt,
      };

      return enhancedLog;
    } catch (error) {
      throw new Error(`Failed to get enhanced log: ${error}`);
    }
  }

  /**
   * Get enhanced tool executions for an interaction
   */
  async getEnhancedToolExecutions(
    interactionLogId: string
  ): Promise<EnhancedToolExecution[]> {
    try {
      const baseLogs = await this.getToolExecutionLogs(interactionLogId);

      return baseLogs.map(baseLog => ({
        ...baseLog,
        reasoning: this.extractToolReasoning(
          baseLog as unknown as Record<string, unknown>
        ),
        userConfirmed: true, // Default assumption
        impactLevel: this.assessToolImpactLevel(
          baseLog.toolName,
          baseLog.arguments
        ),
        resourcesAccessed: this.extractResourcesFromTool(
          baseLog.arguments,
          baseLog.result
        ),
        permissions: [], // Would be stored separately
        performanceMetrics: {
          memoryUsage: undefined,
          cpuTime: baseLog.executionTime,
          networkRequests: undefined,
        },
      }));
    } catch (error) {
      throw new Error(`Failed to get enhanced tool executions: ${error}`);
    }
  }

  /**
   * Store user feedback for an interaction
   */
  async storeUserFeedback(
    interactionLogId: string,
    feedback: UserFeedback
  ): Promise<void> {
    try {
      // In a full implementation, this would store feedback in a separate table
      // For now, we'll update the interaction log with feedback data in the reasoning field
      const feedbackData = {
        rating: feedback.rating,
        comment: feedback.comment,
        categories: feedback.categories,
        timestamp: feedback.timestamp.toISOString(),
      };

      const feedbackJson = JSON.stringify(feedbackData);

      // Get current log to preserve existing reasoning
      const currentLog = await this.getInteractionLog(interactionLogId);
      const existingReasoning = currentLog?.reasoning || '';

      // Append feedback to reasoning field with a separator
      const updatedReasoning = existingReasoning
        ? `${existingReasoning}\n\n[USER_FEEDBACK]: ${feedbackJson}`
        : `[USER_FEEDBACK]: ${feedbackJson}`;

      await this.updateInteractionLog(interactionLogId, {
        reasoning: updatedReasoning,
      });
    } catch (error) {
      throw new Error(`Failed to store user feedback: ${error}`);
    }
  }

  /**
   * Store interaction quality assessment
   */
  async storeInteractionQuality(
    interactionLogId: string,
    quality: InteractionQuality
  ): Promise<void> {
    try {
      // In a full implementation, this would be stored in a separate table
      console.log(`Interaction quality for ${interactionLogId}:`, quality);
    } catch (error) {
      throw new Error(`Failed to store interaction quality: ${error}`);
    }
  }

  /**
   * Get performance analytics for a session or time period
   */
  async getPerformanceAnalytics(filters: {
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    modelType?: 'local' | 'gemini';
  }): Promise<PerformanceAnalytics> {
    try {
      const logs = await this.getInteractionLogs({
        startDate: filters.startDate,
        endDate: filters.endDate,
        modelType: filters.modelType,
      });

      const analytics: PerformanceAnalytics = {
        totalInteractions: logs.length,
        averageResponseTime:
          logs.reduce((sum, log) => sum + log.responseTime, 0) / logs.length ||
          0,
        successRate: logs.filter(log => !log.error).length / logs.length || 0,
        mostUsedTools: this.calculateMostUsedTools(
          logs as unknown as Array<Record<string, unknown>>
        ),
        emotionalTrends: this.calculateEmotionalTrends(
          logs as unknown as Array<Record<string, unknown>>
        ),
        performanceTrends: this.calculatePerformanceTrends(
          logs as unknown as Array<Record<string, unknown>>
        ),
        userSatisfactionScore: this.calculateUserSatisfactionScore(
          logs as unknown as Array<Record<string, unknown>>
        ),
      };

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get performance analytics: ${error}`);
    }
  }

  /**
   * Search logs with advanced text search and semantic matching
   */
  async searchLogs(query: {
    text?: string;
    emotionalState?: string;
    userIntent?: string;
    toolsUsed?: string[];
    performanceThreshold?: number;
    limit?: number;
  }): Promise<EnhancedInteractionLogEntry[]> {
    try {
      // Build search filters
      const filters: LogFilter = {
        searchText: query.text,
        limit: query.limit || 50,
      };

      // Get base results
      const logs = await this.getEnhancedLogs(filters);

      // Apply advanced filtering
      let filteredLogs = logs;

      if (query.emotionalState) {
        filteredLogs = filteredLogs.filter(
          log =>
            log.emotionalContext?.stressIndicators.some(indicator =>
              typeof indicator === 'string'
                ? indicator === query.emotionalState
                : indicator.type === query.emotionalState
            ) ||
            log.userMessage
              .toLowerCase()
              .includes(query.emotionalState!.toLowerCase())
        );
      }

      if (query.userIntent) {
        filteredLogs = filteredLogs.filter(
          log => log.userIntent === query.userIntent
        );
      }

      if (query.toolsUsed && query.toolsUsed.length > 0) {
        filteredLogs = filteredLogs.filter(log =>
          log.toolExecutions.some(tool =>
            query.toolsUsed!.includes(tool.toolName)
          )
        );
      }

      if (query.performanceThreshold) {
        filteredLogs = filteredLogs.filter(
          log => log.responseTime <= query.performanceThreshold!
        );
      }

      return filteredLogs;
    } catch (error) {
      throw new Error(`Failed to search logs: ${error}`);
    }
  }

  // Helper methods for data extraction and analysis

  private extractEmotionalContext(
    log: Record<string, unknown>
  ): EmotionalContext | undefined {
    // Simple emotional context extraction from message content
    const message = ((log.userMessage as string) || '').toLowerCase();
    const stressIndicators: StressIndicator[] = [];
    const now = new Date();

    if (message.includes('urgent') || message.includes('asap')) {
      stressIndicators.push({
        type: 'time_pressure',
        severity: 6,
        description: 'Urgency language detected',
        detectedAt: now,
      });
    }
    if (message.includes('frustrated') || message.includes('annoyed')) {
      stressIndicators.push({
        type: 'fatigue',
        severity: 5,
        description: 'Frustration language detected',
        detectedAt: now,
      });
    }
    if (message.includes('overwhelmed') || message.includes('too much')) {
      stressIndicators.push({
        type: 'task_overload',
        severity: 7,
        description: 'Overwhelm expression detected',
        detectedAt: now,
      });
    }

    if (stressIndicators.length === 0) {
      return undefined;
    }

    const supportNeeds: SupportType[] = [];
    const hasOverwhelm = stressIndicators.some(
      indicator => indicator.type === 'task_overload'
    );

    if (hasOverwhelm) {
      supportNeeds.push({
        type: 'task_prioritization',
        priority: 8,
        message: 'User needs help with task prioritization',
        actionable: true,
        suggestedActions: ['Help prioritize tasks', 'Break down large tasks'],
      });
    }

    return {
      currentMood: {
        energy: 5,
        focus: 5,
        motivation: 5,
        stress: stressIndicators.length * 2,
        timestamp: log.timestamp as Date,
      },
      stressIndicators,
      recentAchievements: [],
      supportNeeds,
    };
  }

  private extractUserIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('create') || lowerMessage.includes('add')) {
      return 'create_task';
    }
    if (lowerMessage.includes('complete') || lowerMessage.includes('finish')) {
      return 'complete_task';
    }
    if (lowerMessage.includes('update') || lowerMessage.includes('edit')) {
      return 'update_task';
    }
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return 'get_help';
    }

    return 'general_interaction';
  }

  private extractReasoningChain(reasoning?: string): string[] {
    if (!reasoning) {
      return [];
    }

    return reasoning
      .split(/\d+\.|Step \d+:|First,|Then,|Next,|Finally,/i)
      .map(step => step.trim())
      .filter(step => step.length > 0);
  }

  private createPerformanceMetrics(
    log: Record<string, unknown>
  ): PerformanceMetrics {
    const responseTime = (log.responseTime as number) || 0;
    const timestamp = (log.timestamp as Date) || new Date();

    return {
      totalDuration: responseTime,
      processingSteps: [
        {
          step: 'request_processing',
          timestamp: timestamp,
          duration: responseTime * 0.3,
        },
        {
          step: 'ai_inference',
          timestamp: new Date(timestamp.getTime() + responseTime * 0.3),
          duration: responseTime * 0.5,
        },
        {
          step: 'response_formatting',
          timestamp: new Date(timestamp.getTime() + responseTime * 0.8),
          duration: responseTime * 0.2,
        },
      ],
    };
  }

  private extractToolReasoning(toolLog: Record<string, unknown>): string {
    return `Executed ${toolLog.toolName} to process user request`;
  }

  private assessToolImpactLevel(
    toolName: string,
    _args: string
  ): 'low' | 'medium' | 'high' {
    if (toolName.includes('delete') || toolName.includes('remove')) {
      return 'high';
    }
    if (toolName.includes('update') || toolName.includes('modify')) {
      return 'medium';
    }
    return 'low';
  }

  private extractResourcesFromTool(args: string, _result: string): string[] {
    const resources: string[] = [];

    try {
      const parsedArgs = JSON.parse(args);
      Object.keys(parsedArgs).forEach(key => {
        if (
          key.includes('file') ||
          key.includes('path') ||
          key.includes('id')
        ) {
          resources.push(`${key}: ${parsedArgs[key]}`);
        }
      });
    } catch {
      // Ignore parsing errors
    }

    return resources;
  }

  private calculateMostUsedTools(
    logs: Array<Record<string, unknown>>
  ): Array<{ toolName: string; count: number }> {
    const toolCounts: Record<string, number> = {};

    logs.forEach(log => {
      const toolCalls = log.toolCalls as
        | Array<{ toolName: string }>
        | undefined;
      toolCalls?.forEach(tool => {
        toolCounts[tool.toolName] = (toolCounts[tool.toolName] || 0) + 1;
      });
    });

    return Object.entries(toolCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateEmotionalTrends(
    logs: Array<Record<string, unknown>>
  ): EmotionalTrends {
    // Simple emotional trend calculation
    const stressLevels = logs.map(log => {
      const message = ((log.userMessage as string) || '').toLowerCase();
      let stress = 3; // baseline

      if (message.includes('urgent') || message.includes('stressed')) {
        stress += 2;
      }
      if (message.includes('calm') || message.includes('relaxed')) {
        stress -= 1;
      }

      return Math.max(1, Math.min(10, stress));
    });

    return {
      averageStressLevel:
        stressLevels.reduce((sum, level) => sum + level, 0) /
          stressLevels.length || 3,
      stressProgression: stressLevels,
      supportNeedsFrequency: {
        guidance: logs.filter(log =>
          ((log.userMessage as string) || '').toLowerCase().includes('help')
        ).length,
        motivation: logs.filter(log =>
          ((log.userMessage as string) || '')
            .toLowerCase()
            .includes('motivation')
        ).length,
        task_prioritization: logs.filter(log =>
          ((log.userMessage as string) || '')
            .toLowerCase()
            .includes('overwhelmed')
        ).length,
      },
    };
  }

  private calculatePerformanceTrends(
    logs: Array<Record<string, unknown>>
  ): PerformanceTrends {
    const responseTimes = logs.map(log => (log.responseTime as number) || 0);

    return {
      averageResponseTime:
        responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length || 0,
      responseTimeProgression: responseTimes,
      errorRate: logs.filter(log => log.error).length / logs.length || 0,
      throughputTrend: logs.length, // Simple count for now
    };
  }

  private calculateUserSatisfactionScore(
    logs: Array<Record<string, unknown>>
  ): number {
    // Simple satisfaction calculation based on error rate and response time
    const errorRate = logs.filter(log => log.error).length / logs.length || 0;
    const avgResponseTime =
      logs.reduce((sum, log) => sum + ((log.responseTime as number) || 0), 0) /
        logs.length || 0;

    // Score from 0-10 based on low error rate and reasonable response time
    const errorScore = (1 - errorRate) * 5; // 0-5 points for low errors
    const speedScore = Math.max(0, 5 - avgResponseTime / 1000); // 0-5 points for speed

    return Math.min(10, errorScore + speedScore);
  }

  /**
   * Extract user feedback from reasoning field
   */
  private extractUserFeedback(reasoning?: string): UserFeedback | undefined {
    if (!reasoning) {
      return undefined;
    }

    try {
      // Look for feedback data in the reasoning field
      const feedbackMatch = reasoning.match(/\[USER_FEEDBACK\]:\s*({.*?})/s);
      if (!feedbackMatch) {
        return undefined;
      }

      const feedbackData = JSON.parse(feedbackMatch[1]);

      return {
        rating: feedbackData.rating,
        comment: feedbackData.comment,
        categories: feedbackData.categories || [],
        timestamp: new Date(feedbackData.timestamp),
      };
    } catch (error) {
      console.warn('Failed to extract user feedback from reasoning:', error);
      return undefined;
    }
  }
}

// Extended filter interface for enhanced logs
export interface EnhancedLogFilter extends LogFilter {
  emotionalState?: string;
  userIntent?: string;
  toolsUsed?: string[];
  performanceThreshold?: number;
  confidenceThreshold?: number;
  impactLevel?: 'low' | 'medium' | 'high';
}

// Performance analytics interface
export interface PerformanceAnalytics {
  totalInteractions: number;
  averageResponseTime: number;
  successRate: number;
  mostUsedTools: Array<{ toolName: string; count: number }>;
  emotionalTrends: EmotionalTrends;
  performanceTrends: PerformanceTrends;
  userSatisfactionScore: number;
}

export interface EmotionalTrends {
  averageStressLevel: number;
  stressProgression: number[];
  supportNeedsFrequency: Record<string, number>;
}

export interface PerformanceTrends {
  averageResponseTime: number;
  responseTimeProgression: number[];
  errorRate: number;
  throughputTrend: number;
}

// Singleton instance
let enhancedLogStorageServiceInstance: EnhancedLogStorageService | null = null;

/**
 * Get EnhancedLogStorageService singleton instance
 */
export function getEnhancedLogStorageService(): EnhancedLogStorageService {
  if (!enhancedLogStorageServiceInstance) {
    enhancedLogStorageServiceInstance = new EnhancedLogStorageService();
  }
  return enhancedLogStorageServiceInstance;
}
