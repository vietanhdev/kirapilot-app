// AI Service Types
// This file contains types that were previously part of the tool execution system

/**
 * Translation function type for AI services
 */
export type TranslationFunction = (
  key: string,
  variables?: Record<string, string | number>
) => string;

/**
 * Permission levels for AI operations
 */
export enum PermissionLevel {
  READ_ONLY = 'read_only',
  MODIFY_TASKS = 'modify_tasks',
  TIMER_CONTROL = 'timer_control',
  FULL_ACCESS = 'full_access',
}

/**
 * Tool execution result interface
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  userMessage: string;
  requiresConfirmation?: boolean;
  metadata?: {
    executionTime: number;
    toolName: string;
    permissions: PermissionLevel[];
    retryAfter?: number;
    attempt?: number;
    maxAttempts?: number;
    suggestions?: unknown[];
    requiredPermissions?: PermissionLevel[];
  };
}
