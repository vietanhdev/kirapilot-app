import {
  parseTaskListError,
  getTaskListErrorMessage,
  isRecoverableError,
  requiresUserAction,
  getErrorRecoveryActions,
  TaskListErrorType,
} from '../taskListErrorHandling';
import { TranslationKey } from '../../i18n';

// Mock translation function
const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'taskList.validation.nameEmpty': 'Task list name cannot be empty',
    'taskList.validation.nameTooLong': 'Task list name is too long',
    'taskList.validation.nameReserved': 'Task list name cannot be "All"',
    'taskList.validation.nameDuplicate':
      'A task list with this name already exists',
    'taskList.error.notFound': 'Task list not found',
    'taskList.error.cannotDeleteDefault': 'Cannot delete the default task list',
    'taskList.error.databaseError': 'Database error occurred',
    'taskList.error.networkError': 'Network error occurred',
    'taskList.error.unknownError': 'An unknown error occurred',
  };
  return translations[key] || key;
};

describe('parseTaskListError', () => {
  it('should parse validation errors correctly', () => {
    const error = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot be empty'
    );

    expect(error.type).toBe(TaskListErrorType.VALIDATION);
    expect(error.message).toBe('Task list name cannot be empty');
    expect(error.translationKey).toBe('taskList.validation.nameEmpty');
    expect(error.field).toBe('name');
  });

  it('should parse duplicate errors correctly', () => {
    const error = parseTaskListError(
      'DUPLICATE_ERROR: A task list with the name "Test" already exists'
    );

    expect(error.type).toBe(TaskListErrorType.DUPLICATE);
    expect(error.translationKey).toBe('taskList.validation.nameDuplicate');
  });

  it('should parse not found errors correctly', () => {
    const error = parseTaskListError(
      'RECORD_NOT_FOUND: Task list with ID "123" not found'
    );

    expect(error.type).toBe(TaskListErrorType.NOT_FOUND);
    expect(error.translationKey).toBe('taskList.error.notFound');
  });

  it('should parse business rule errors correctly', () => {
    const error = parseTaskListError(
      'BUSINESS_RULE_ERROR: Cannot delete the default task list'
    );

    expect(error.type).toBe(TaskListErrorType.BUSINESS_RULE);
    expect(error.translationKey).toBe('taskList.error.cannotDeleteDefault');
  });

  it('should parse database errors correctly', () => {
    const error = parseTaskListError(
      'DATABASE_ERROR: Failed to connect to database'
    );

    expect(error.type).toBe(TaskListErrorType.DATABASE);
    expect(error.translationKey).toBe('taskList.error.databaseError');
  });

  it('should handle errors without type prefix', () => {
    const error = parseTaskListError('Something went wrong');

    expect(error.type).toBe(TaskListErrorType.UNKNOWN);
    expect(error.message).toBe('Something went wrong');
    expect(error.translationKey).toBe('taskList.error.unknownError');
  });

  it('should handle Error objects', () => {
    const error = parseTaskListError(
      new Error('VALIDATION_ERROR: Name too long')
    );

    expect(error.type).toBe(TaskListErrorType.VALIDATION);
    expect(error.message).toBe('Name too long');
  });

  it('should parse specific validation error types', () => {
    const lengthError = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot exceed 255 characters'
    );
    expect(lengthError.translationKey).toBe('taskList.validation.nameTooLong');

    const reservedError = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot be a reserved name'
    );
    expect(reservedError.translationKey).toBe(
      'taskList.validation.nameReserved'
    );

    const charError = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot contain null characters'
    );
    expect(charError.translationKey).toBe(
      'taskList.validation.nameInvalidChars'
    );
  });
});

describe('getTaskListErrorMessage', () => {
  it('should return translated message when available', () => {
    const error = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot be empty'
    );
    const message = getTaskListErrorMessage(error, mockT);

    expect(message).toBe('Task list name cannot be empty');
  });

  it('should fall back to original message when translation fails', () => {
    const error = parseTaskListError('Some unknown error');
    const message = getTaskListErrorMessage(error, () => {
      throw new Error('Translation failed');
    });

    expect(message).toBe('Some unknown error');
  });

  it('should handle missing message gracefully', () => {
    // Create an error with empty message and a translation key that returns the translated message
    const error = {
      type: TaskListErrorType.UNKNOWN,
      message: '',
      translationKey: 'taskList.error.unknownError' as TranslationKey,
      originalError: '',
    };
    const message = getTaskListErrorMessage(error, mockT);

    // Since the translation exists, it should return the translated message
    expect(message).toBe('An unknown error occurred');
  });
});

describe('isRecoverableError', () => {
  it('should identify recoverable errors', () => {
    expect(
      isRecoverableError(parseTaskListError('NETWORK_ERROR: Connection failed'))
    ).toBe(true);
    expect(
      isRecoverableError(parseTaskListError('DATABASE_ERROR: Timeout'))
    ).toBe(true);
    expect(
      isRecoverableError(parseTaskListError('TRANSACTION_ERROR: Rollback'))
    ).toBe(true);
  });

  it('should identify non-recoverable errors', () => {
    expect(
      isRecoverableError(parseTaskListError('VALIDATION_ERROR: Invalid name'))
    ).toBe(false);
    expect(
      isRecoverableError(parseTaskListError('DUPLICATE_ERROR: Name exists'))
    ).toBe(false);
    expect(
      isRecoverableError(
        parseTaskListError('BUSINESS_RULE_ERROR: Cannot delete')
      )
    ).toBe(false);
    expect(
      isRecoverableError(parseTaskListError('RECORD_NOT_FOUND: Not found'))
    ).toBe(false);
  });
});

describe('requiresUserAction', () => {
  it('should identify errors requiring user action', () => {
    expect(
      requiresUserAction(parseTaskListError('VALIDATION_ERROR: Invalid name'))
    ).toBe(true);
    expect(
      requiresUserAction(parseTaskListError('DUPLICATE_ERROR: Name exists'))
    ).toBe(true);
  });

  it('should identify errors not requiring user action', () => {
    expect(
      requiresUserAction(
        parseTaskListError('BUSINESS_RULE_ERROR: Cannot delete')
      )
    ).toBe(false);
    expect(
      requiresUserAction(parseTaskListError('RECORD_NOT_FOUND: Not found'))
    ).toBe(false);
    expect(
      requiresUserAction(
        parseTaskListError('DATABASE_ERROR: Connection failed')
      )
    ).toBe(false);
  });
});

describe('getErrorRecoveryActions', () => {
  it('should provide validation error recovery actions', () => {
    const error = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot be empty'
    );
    const actions = getErrorRecoveryActions(error);

    expect(actions).toContain('Check that the name is not empty');
    expect(actions).toContain('Ensure the name is under 255 characters');
    expect(actions).toContain('Avoid using reserved names like "All"');
  });

  it('should provide duplicate error recovery actions', () => {
    const error = parseTaskListError('DUPLICATE_ERROR: Name already exists');
    const actions = getErrorRecoveryActions(error);

    expect(actions).toContain('Choose a different name');
    expect(actions).toContain('Check existing task lists');
  });

  it('should provide network error recovery actions', () => {
    const error = parseTaskListError('NETWORK_ERROR: Connection failed');
    const actions = getErrorRecoveryActions(error);

    expect(actions).toContain('Check your internet connection');
    expect(actions).toContain('Try again in a moment');
  });

  it('should provide database error recovery actions', () => {
    const error = parseTaskListError('DATABASE_ERROR: Query failed');
    const actions = getErrorRecoveryActions(error);

    expect(actions).toContain('Try again in a moment');
    expect(actions).toContain(
      'Restart the application if the problem persists'
    );
  });

  it('should provide business rule error actions', () => {
    const error = parseTaskListError(
      'BUSINESS_RULE_ERROR: Cannot delete default'
    );
    const actions = getErrorRecoveryActions(error);

    expect(actions).toContain('This operation is not allowed');
  });

  it('should return empty array for unknown errors', () => {
    const error = parseTaskListError('UNKNOWN_ERROR: Something happened');
    const actions = getErrorRecoveryActions(error);

    expect(actions).toEqual([]);
  });
});

describe('Enhanced error parsing edge cases', () => {
  it('should parse transaction errors correctly', () => {
    const error = parseTaskListError(
      'TRANSACTION_ERROR: Concurrent modification detected'
    );

    expect(error.type).toBe(TaskListErrorType.TRANSACTION);
    expect(error.translationKey).toBe('taskList.error.operationFailed');
  });

  it('should parse consistency errors correctly', () => {
    const error = parseTaskListError(
      'CONSISTENCY_ERROR: Data integrity violation'
    );

    expect(error.type).toBe(TaskListErrorType.CONSISTENCY);
    expect(error.translationKey).toBe('taskList.error.operationFailed');
  });

  it('should handle complex validation messages', () => {
    const dotError = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot start or end with a dot'
    );
    expect(dotError.translationKey).toBe(
      'taskList.validation.nameInvalidChars'
    );

    const nullError = parseTaskListError(
      'VALIDATION_ERROR: Task list name cannot contain null characters'
    );
    expect(nullError.translationKey).toBe(
      'taskList.validation.nameInvalidChars'
    );
  });

  it('should handle malformed error messages gracefully', () => {
    const malformedErrors = [
      '',
      null,
      undefined,
      'ERROR_WITHOUT_TYPE: message',
      'INVALID_TYPE_ERROR: message',
    ];

    malformedErrors.forEach(errorMsg => {
      const error = parseTaskListError(errorMsg as string | null | undefined);
      expect(error.type).toBe(TaskListErrorType.UNKNOWN);
      expect(error.translationKey).toBe('taskList.error.unknownError');
    });
  });

  it('should preserve original error information', () => {
    const originalError = 'VALIDATION_ERROR: Task list name cannot be empty';
    const error = parseTaskListError(originalError);

    expect(error.originalError).toBe(originalError);
    expect(error.message).toBe('Task list name cannot be empty');
  });
});

describe('Error recovery and user action helpers', () => {
  it('should correctly identify errors requiring immediate user action', () => {
    expect(
      requiresUserAction(parseTaskListError('VALIDATION_ERROR: Invalid name'))
    ).toBe(true);
    expect(
      requiresUserAction(parseTaskListError('DUPLICATE_ERROR: Name exists'))
    ).toBe(true);
    expect(
      requiresUserAction(parseTaskListError('NETWORK_ERROR: Connection failed'))
    ).toBe(false);
    expect(
      requiresUserAction(parseTaskListError('DATABASE_ERROR: Query failed'))
    ).toBe(false);
  });

  it('should correctly identify recoverable vs non-recoverable errors', () => {
    // Recoverable errors (can retry)
    expect(
      isRecoverableError(parseTaskListError('NETWORK_ERROR: Timeout'))
    ).toBe(true);
    expect(
      isRecoverableError(parseTaskListError('DATABASE_ERROR: Connection lost'))
    ).toBe(true);
    expect(
      isRecoverableError(parseTaskListError('TRANSACTION_ERROR: Deadlock'))
    ).toBe(true);

    // Non-recoverable errors (need user intervention)
    expect(
      isRecoverableError(parseTaskListError('VALIDATION_ERROR: Invalid format'))
    ).toBe(false);
    expect(
      isRecoverableError(parseTaskListError('BUSINESS_RULE_ERROR: Not allowed'))
    ).toBe(false);
    expect(
      isRecoverableError(parseTaskListError('DUPLICATE_ERROR: Already exists'))
    ).toBe(false);
  });
});
