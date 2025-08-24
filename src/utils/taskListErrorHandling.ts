import { TranslationKey } from '../i18n';

/**
 * Task list error types for better error categorization
 */
export enum TaskListErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  DUPLICATE = 'DUPLICATE_ERROR',
  NOT_FOUND = 'RECORD_NOT_FOUND',
  BUSINESS_RULE = 'BUSINESS_RULE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  NETWORK = 'NETWORK_ERROR',
  TRANSACTION = 'TRANSACTION_ERROR',
  CONSISTENCY = 'CONSISTENCY_ERROR',
  DEPENDENCY = 'DEPENDENCY_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * Structured error information for task list operations
 */
export interface TaskListError {
  type: TaskListErrorType;
  message: string;
  translationKey: TranslationKey;
  originalError?: string;
  field?: string;
  value?: string;
}

/**
 * Parse backend error messages and categorize them
 */
export function parseTaskListError(
  error: string | Error | null | undefined
): TaskListError {
  // Handle null/undefined inputs
  if (!error) {
    return {
      type: TaskListErrorType.UNKNOWN,
      message: 'Unknown error occurred',
      translationKey: 'taskList.error.unknownError' as TranslationKey,
      originalError: String(error),
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Extract error type prefix if present
  const errorTypeMatch = errorMessage.match(/^([A-Z_]+_ERROR):\s*(.+)$/);
  const errorType = errorTypeMatch ? errorTypeMatch[1] : null;
  const cleanMessage = errorTypeMatch ? errorTypeMatch[2] : errorMessage;

  // Categorize errors based on type or content
  if (errorType === 'VALIDATION_ERROR' || errorMessage.includes('validation')) {
    return parseValidationError(cleanMessage, errorMessage);
  }

  if (
    errorType === 'DUPLICATE_ERROR' ||
    errorMessage.includes('already exists')
  ) {
    return {
      type: TaskListErrorType.DUPLICATE,
      message: cleanMessage,
      translationKey: 'taskList.validation.nameDuplicate' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (errorType === 'RECORD_NOT_FOUND' || errorMessage.includes('not found')) {
    return {
      type: TaskListErrorType.NOT_FOUND,
      message: cleanMessage,
      translationKey: 'taskList.error.notFound' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (
    errorType === 'BUSINESS_RULE_ERROR' ||
    errorMessage.includes('Cannot delete the default')
  ) {
    return {
      type: TaskListErrorType.BUSINESS_RULE,
      message: cleanMessage,
      translationKey: 'taskList.error.cannotDeleteDefault' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (errorType === 'DATABASE_ERROR' || errorMessage.includes('database')) {
    return {
      type: TaskListErrorType.DATABASE,
      message: cleanMessage,
      translationKey: 'taskList.error.databaseError' as TranslationKey,
      originalError: errorMessage,
    };
  }

  // Handle task operation errors
  if (errorMessage.includes('Failed to move task')) {
    return {
      type: TaskListErrorType.DATABASE,
      message: cleanMessage,
      translationKey: 'taskList.error.databaseError' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (
    errorType === 'NETWORK_ERROR' ||
    errorMessage.includes('network') ||
    errorMessage.includes('fetch')
  ) {
    return {
      type: TaskListErrorType.NETWORK,
      message: cleanMessage,
      translationKey: 'taskList.error.networkError' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (errorType === 'TRANSACTION_ERROR') {
    return {
      type: TaskListErrorType.TRANSACTION,
      message: cleanMessage,
      translationKey: 'taskList.error.operationFailed' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (errorType === 'CONSISTENCY_ERROR') {
    return {
      type: TaskListErrorType.CONSISTENCY,
      message: cleanMessage,
      translationKey: 'taskList.error.operationFailed' as TranslationKey,
      originalError: errorMessage,
    };
  }

  if (errorType === 'DEPENDENCY_ERROR') {
    return {
      type: TaskListErrorType.DEPENDENCY,
      message: cleanMessage,
      translationKey: 'taskList.error.operationFailed' as TranslationKey,
      originalError: errorMessage,
    };
  }

  // Default to unknown error
  return {
    type: TaskListErrorType.UNKNOWN,
    message: cleanMessage,
    translationKey: 'taskList.error.unknownError' as TranslationKey,
    originalError: errorMessage,
  };
}

/**
 * Parse validation errors with specific field information
 */
function parseValidationError(
  message: string,
  originalError: string
): TaskListError {
  if (message.includes('empty') || message.includes('whitespace')) {
    return {
      type: TaskListErrorType.VALIDATION,
      message,
      translationKey: 'taskList.validation.nameEmpty' as TranslationKey,
      originalError,
      field: 'name',
    };
  }

  if (message.includes('exceed') || message.includes('255 characters')) {
    return {
      type: TaskListErrorType.VALIDATION,
      message,
      translationKey: 'taskList.validation.nameTooLong' as TranslationKey,
      originalError,
      field: 'name',
    };
  }

  if (message.includes('reserved name') || message.includes('All')) {
    return {
      type: TaskListErrorType.VALIDATION,
      message,
      translationKey: 'taskList.validation.nameReserved' as TranslationKey,
      originalError,
      field: 'name',
    };
  }

  if (message.includes('null characters') || message.includes('dot')) {
    return {
      type: TaskListErrorType.VALIDATION,
      message,
      translationKey: 'taskList.validation.nameInvalidChars' as TranslationKey,
      originalError,
      field: 'name',
    };
  }

  // Generic validation error
  return {
    type: TaskListErrorType.VALIDATION,
    message,
    translationKey: 'taskList.validation.nameInvalidFormat' as TranslationKey,
    originalError,
    field: 'name',
  };
}

/**
 * Get user-friendly error message for display
 */
export function getTaskListErrorMessage(
  error: TaskListError,
  t: (key: TranslationKey) => string
): string {
  // Use translated message if available
  try {
    const translatedMessage = t(error.translationKey);
    if (translatedMessage && translatedMessage !== error.translationKey) {
      return translatedMessage;
    }
  } catch {
    // Fall back to original message if translation fails
  }

  // Fall back to the clean message
  return error.message || 'An error occurred';
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: TaskListError): boolean {
  switch (error.type) {
    case TaskListErrorType.NETWORK:
    case TaskListErrorType.DATABASE:
    case TaskListErrorType.TRANSACTION:
      return true;
    case TaskListErrorType.VALIDATION:
    case TaskListErrorType.DUPLICATE:
    case TaskListErrorType.NOT_FOUND:
    case TaskListErrorType.BUSINESS_RULE:
      return false;
    default:
      return false;
  }
}

/**
 * Check if an error requires user action (e.g., fix input)
 */
export function requiresUserAction(error: TaskListError): boolean {
  switch (error.type) {
    case TaskListErrorType.VALIDATION:
    case TaskListErrorType.DUPLICATE:
      return true;
    case TaskListErrorType.BUSINESS_RULE:
    case TaskListErrorType.NOT_FOUND:
      return false;
    default:
      return false;
  }
}

/**
 * Get suggested actions for error recovery
 */
export function getErrorRecoveryActions(error: TaskListError): string[] {
  const actions: string[] = [];

  switch (error.type) {
    case TaskListErrorType.VALIDATION:
      if (error.field === 'name') {
        actions.push('Check that the name is not empty');
        actions.push('Ensure the name is under 255 characters');
        actions.push('Avoid using reserved names like "All"');
      }
      break;
    case TaskListErrorType.DUPLICATE:
      actions.push('Choose a different name');
      actions.push('Check existing task lists');
      break;
    case TaskListErrorType.NETWORK:
      actions.push('Check your internet connection');
      actions.push('Try again in a moment');
      break;
    case TaskListErrorType.DATABASE:
      actions.push('Try again in a moment');
      actions.push('Restart the application if the problem persists');
      break;
    case TaskListErrorType.BUSINESS_RULE:
      actions.push('This operation is not allowed');
      break;
  }

  return actions;
}
