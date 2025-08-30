// AI Interaction Logging Types
import type {
  StressIndicator,
  Achievement,
  SupportType,
} from './emotionalIntelligence';

// Enhanced interaction log entry with comprehensive data capture
export interface EnhancedInteractionLogEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  modelType: 'local' | 'gemini';
  modelInfo: ModelInfo;

  // Request data with enhanced context
  userMessage: string;
  systemPrompt?: string;
  context: string; // JSON serialized AppContext
  emotionalContext?: EmotionalContext;
  userIntent?: string;
  conversationHistory: string[];

  // Response data with reasoning chain
  aiResponse: string;
  actions: string; // JSON serialized AIAction[]
  suggestions: string; // JSON serialized AISuggestion[]
  reasoning?: string;
  reasoningChain?: string[];
  confidenceScore?: number;

  // Enhanced tool execution data
  toolExecutions: EnhancedToolExecution[];

  // Performance metrics with detailed tracking
  performanceMetrics: PerformanceMetrics;
  responseTime: number;
  tokenCount?: number;

  // Error information with context
  error?: string;
  errorCode?: string;
  errorContext?: Record<string, unknown>;

  // Privacy and security
  containsSensitiveData: boolean;
  dataClassification: 'public' | 'internal' | 'confidential';

  // User feedback and interaction quality
  userFeedback?: UserFeedback;
  interactionQuality?: InteractionQuality;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced tool execution with detailed metadata
export interface EnhancedToolExecution {
  id: string;
  interactionLogId: string;
  toolName: string;
  arguments: string; // JSON serialized arguments
  result: string; // JSON serialized ToolExecutionResult
  executionTime: number;
  success: boolean;
  error?: string;

  // Enhanced metadata
  reasoning?: string;
  userConfirmed: boolean;
  impactLevel: 'low' | 'medium' | 'high';
  resourcesAccessed: string[];
  permissions: string[];

  // Performance tracking
  performanceMetrics?: {
    memoryUsage?: number;
    cpuTime?: number;
    networkRequests?: number;
  };

  createdAt: Date;
}

// Emotional context tracking
export interface EmotionalContext {
  currentMood: MoodLevel;
  stressIndicators: StressIndicator[];
  recentAchievements: Achievement[];
  supportNeeds: SupportType[];
}

export interface MoodLevel {
  energy: number; // 1-10 scale
  focus: number; // 1-10 scale
  motivation: number; // 1-10 scale
  stress: number; // 1-10 scale
  timestamp: Date;
}

// Performance metrics with detailed tracking
export interface PerformanceMetrics {
  requestStartTime?: number;
  responseEndTime?: number;
  totalDuration: number;
  processingSteps: ProcessingStep[];
  memoryUsage?: number;
  cpuUsage?: number;
  networkLatency?: number;
}

export interface ProcessingStep {
  step: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

// User feedback system
export interface UserFeedback {
  rating: number; // 1-5 scale
  comment?: string;
  categories: FeedbackCategory[];
  timestamp: Date;
}

export interface FeedbackCategory {
  category: 'helpfulness' | 'accuracy' | 'clarity' | 'speed' | 'personality';
  rating: number; // 1-5 scale
}

// Interaction quality assessment
export interface InteractionQuality {
  responseRelevance: number; // 0-1 scale
  taskCompletionSuccess: boolean;
  userSatisfactionIndicators: string[];
  improvementSuggestions: string[];
  timestamp: Date;
}

// Enhanced create request for detailed logging
export interface CreateEnhancedLogRequest {
  sessionId: string;
  modelType: 'local' | 'gemini';
  modelInfo: ModelInfo;
  userMessage: string;
  systemPrompt?: string;
  context: string;
  emotionalContext?: EmotionalContext;
  userIntent?: string;
  conversationHistory: string[];
  aiResponse: string;
  actions: string;
  suggestions: string;
  reasoning?: string;
  reasoningChain?: string[];
  confidenceScore?: number;
  responseTime: number;
  tokenCount?: number;
  processingSteps: ProcessingStep[];
  error?: string;
  errorCode?: string;
  errorContext?: Record<string, unknown>;
  containsSensitiveData?: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential';
  performanceMetrics: PerformanceMetrics;
  userFeedback?: UserFeedback;
  interactionQuality?: InteractionQuality;
}

// Tool execution with enhanced context
export interface ToolExecution {
  toolName: string;
  parameters: Record<string, unknown>;
  reasoning: string;
  result: unknown;
  executionTime: number;
  userConfirmed: boolean;
  impactLevel: 'low' | 'medium' | 'high';
  resourcesAccessed: string[];
  permissions: string[];
}

export interface AIInteractionLog {
  id: string;
  timestamp: Date;
  sessionId: string;
  modelType: 'local' | 'gemini';
  modelInfo: ModelInfo;

  // Request data
  userMessage: string;
  systemPrompt?: string;
  context: string; // JSON serialized AppContext

  // Response data
  aiResponse: string;
  actions: string; // JSON serialized AIAction[]
  suggestions: string; // JSON serialized AISuggestion[]
  reasoning?: string;

  // Tool execution data
  toolCalls: ToolExecutionLog[];

  // Performance metrics
  responseTime: number;
  tokenCount?: number;

  // Error information
  error?: string;
  errorCode?: string;

  // Privacy flags
  containsSensitiveData: boolean;
  dataClassification: 'public' | 'internal' | 'confidential';

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolExecutionLog {
  id: string;
  interactionLogId: string;
  toolName: string;
  arguments: string; // JSON serialized arguments
  result: string; // JSON serialized ToolExecutionResult
  executionTime: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}

export interface ModelInfo {
  name: string;
  version?: string;
  provider: string;
  parameters?: Record<string, unknown>;
}

export type DataClassification = 'public' | 'internal' | 'confidential';

export interface LoggingConfig {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed';
  retentionDays: number;
  maxLogSize: number;
  maxLogCount?: number;
  includeSystemPrompts: boolean;
  includeToolExecutions: boolean;
  includePerformanceMetrics: boolean;
  autoCleanup: boolean;
  exportFormat: 'json' | 'csv';
}

export interface LogFilter {
  startDate?: Date;
  endDate?: Date;
  modelType?: 'local' | 'gemini';
  hasErrors?: boolean;
  containsToolCalls?: boolean;
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface LogStorageStats {
  totalLogs: number;
  totalSize: number;
  oldestLog?: Date;
  newestLog?: Date;
  logsByModel: Record<string, number>;
  averageResponseTime: number;
}

export interface CreateLogRequest {
  sessionId: string;
  modelType: 'local' | 'gemini';
  modelInfo: ModelInfo;
  userMessage: string;
  systemPrompt?: string;
  context: string;
  aiResponse: string;
  actions: string;
  suggestions: string;
  reasoning?: string;
  responseTime: number;
  tokenCount?: number;
  error?: string;
  errorCode?: string;
  containsSensitiveData?: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential';
}

export interface UpdateLogRequest {
  aiResponse?: string;
  actions?: string;
  suggestions?: string;
  reasoning?: string;
  responseTime?: number;
  tokenCount?: number;
  error?: string;
  errorCode?: string;
  containsSensitiveData?: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential';
}

export interface CreateToolExecutionLogRequest {
  interactionLogId: string;
  toolName: string;
  arguments: string;
  result: string;
  executionTime: number;
  success: boolean;
  error?: string;
}
