import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PeriodicTaskModal } from '../PeriodicTaskModal';

// Mock everything to prevent any complex interactions
jest.mock('../../../services/database/repositories/PeriodicTaskService');
jest.mock('../../../services/errorHandling/ErrorHandlingService');
jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ preferences: { dateFormat: 'DD/MM/YYYY' } }),
}));
jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => ({
    getSelectedTaskListId: () => 'test-list',
    isAllSelected: () => false,
    taskLists: [{ id: 'test-list', name: 'Test', isDefault: true }],
    error: null,
  }),
}));
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../common/MinimalRichTextEditor', () => ({
  MinimalRichTextEditor: () => null,
}));
jest.mock('../../common/DatePicker', () => ({
  DatePicker: () => null,
}));
jest.mock('../RecurrencePatternSelector', () => ({
  RecurrencePatternSelector: () => null,
}));
jest.mock('../../common/ErrorDisplay', () => ({
  ErrorDisplay: () => null,
  ErrorType: { UNKNOWN: 'UNKNOWN' },
  categorizeError: () => 'UNKNOWN',
  isErrorRecoverable: () => false,
}));

describe('PeriodicTaskModal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <PeriodicTaskModal
        isOpen={false}
        onClose={() => {}}
        onCreateTemplate={() => Promise.resolve()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
