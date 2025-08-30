// Task matching types for intelligent task identification

import { Task } from './index';

export interface TaskMatchResult {
  task: Task;
  confidence: number; // 0-100 confidence score
  matchReason: string; // Human-readable explanation of why this task matched
  matchType: MatchType;
  alternatives?: Task[]; // Alternative matches if confidence is low
}

export enum MatchType {
  EXACT_TITLE = 'exact_title',
  FUZZY_TITLE = 'fuzzy_title',
  DESCRIPTION_MATCH = 'description_match',
  TAG_MATCH = 'tag_match',
  CONTEXTUAL = 'contextual',
  RECENT_ACTIVITY = 'recent_activity',
}

export interface TaskMatchQuery {
  query: string;
  context?: TaskMatchContext;
  maxResults?: number;
  minConfidence?: number;
}

export interface TaskMatchContext {
  currentTask?: Task;
  recentTasks?: Task[];
  activeFilters?: {
    status?: string[];
    priority?: number[];
    tags?: string[];
  };
  userIntent?: UserIntent;
}

export enum UserIntent {
  COMPLETE_TASK = 'complete_task',
  START_TIMER = 'start_timer',
  EDIT_TASK = 'edit_task',
  DELETE_TASK = 'delete_task',
  VIEW_DETAILS = 'view_details',
  SCHEDULE_TASK = 'schedule_task',
}

export interface FuzzyMatchOptions {
  threshold: number; // Minimum similarity score (0-1)
  includeScore: boolean;
  includeMatches: boolean;
  minMatchCharLength: number;
  maxPatternLength: number;
}

export interface TaskResolutionRequest {
  originalQuery: string;
  matches: TaskMatchResult[];
  context?: TaskMatchContext;
  userIntent?: UserIntent;
}

export interface TaskResolutionResponse {
  selectedTask?: Task;
  cancelled: boolean;
  createNew?: boolean;
  newTaskTitle?: string;
}

// Scoring weights for different match types
export interface MatchingWeights {
  exactTitle: number;
  fuzzyTitle: number;
  description: number;
  tags: number;
  recentActivity: number;
  contextual: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  exactTitle: 1.0,
  fuzzyTitle: 0.8,
  description: 0.6,
  tags: 0.7,
  recentActivity: 0.5,
  contextual: 0.4,
};

// Natural language patterns for task identification
export interface TaskIdentificationPattern {
  pattern: RegExp;
  intent: UserIntent;
  confidence: number;
  extractTaskReference: (match: RegExpMatchArray) => string;
}

export const TASK_IDENTIFICATION_PATTERNS: TaskIdentificationPattern[] = [
  {
    pattern:
      /(?:complete|finish|done with|mark as done)\s+(?:the\s+)?(?:task\s+)?["']?([^"']+)["']?/i,
    intent: UserIntent.COMPLETE_TASK,
    confidence: 0.9,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern:
      /(?:start|begin|work on)\s+(?:working on\s+)?(?:the\s+)?(?:task\s+)?["']?([^"']+?)["']?$/i,
    intent: UserIntent.START_TIMER,
    confidence: 0.85,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern:
      /(?:edit|modify|update|change)\s+(?:the\s+)?(?:task\s+)?["']?([^"']+)["']?/i,
    intent: UserIntent.EDIT_TASK,
    confidence: 0.8,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern: /(?:delete|remove)\s+(?:the\s+)?(?:task\s+)?["']?([^"']+)["']?/i,
    intent: UserIntent.DELETE_TASK,
    confidence: 0.85,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern: /(?:schedule|plan)\s+(?:the\s+)?(?:task\s+)?["']?([^"']+)["']?/i,
    intent: UserIntent.SCHEDULE_TASK,
    confidence: 0.8,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern:
      /(?:show|view|details of|info about)\s+(?:me\s+)?(?:the\s+)?(?:task\s+)?["']([^"']+)["']/i,
    intent: UserIntent.VIEW_DETAILS,
    confidence: 0.75,
    extractTaskReference: match => match[1].trim(),
  },
  // Generic task reference patterns
  {
    pattern: /(?:task\s+)?["']([^"']+)["']/i,
    intent: UserIntent.VIEW_DETAILS,
    confidence: 0.6,
    extractTaskReference: match => match[1].trim(),
  },
  {
    pattern: /(?:the\s+)?task\s+(?:called\s+|named\s+)?([^\s]+(?:\s+[^\s]+)*)/i,
    intent: UserIntent.VIEW_DETAILS,
    confidence: 0.5,
    extractTaskReference: match => match[1].trim(),
  },
];
