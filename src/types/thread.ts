// Thread-related types for the Kira chat view

export interface Thread {
  id: string;
  title: string; // Auto-generated from first message
  assignment?: ThreadAssignment;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreadAssignment {
  type: 'task' | 'day' | 'general';
  taskId?: string;
  date?: Date;
  context?: Record<string, unknown>;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  actions?: AIAction[];
  suggestions?: AISuggestion[];
  toolExecutions?: ToolExecution[];
  timestamp: Date;
  userFeedback?: UserFeedback;
}

export interface CreateThreadRequest {
  assignment?: ThreadAssignment;
}

export interface UpdateThreadRequest {
  title?: string;
  assignment?: ThreadAssignment;
}

export interface CreateThreadMessageRequest {
  threadId: string;
  type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  actions?: AIAction[];
  suggestions?: AISuggestion[];
  toolExecutions?: ToolExecution[];
}

// Import types from main types file to avoid circular dependencies
import type {
  AIAction,
  AISuggestion,
  UserFeedback,
  ToolExecution,
} from './index';
