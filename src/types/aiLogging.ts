// AI Interaction Logging Types

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

  // ReAct processing steps
  reactSteps: ReActStep[];

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

export interface ReActStep {
  id: string;
  stepType: ReActStepType;
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestamp: Date;
  executionTime?: number;
  iteration: number;
}

export enum ReActStepType {
  Thought = 'thought',
  Action = 'action',
  Observation = 'observation',
  FinalAnswer = 'final_answer',
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  message: string;
  executionTime: number;
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
  reactSteps?: ReActStep[];
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
