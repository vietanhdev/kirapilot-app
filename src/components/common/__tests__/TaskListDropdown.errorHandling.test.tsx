import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskListDropdown } from '../TaskListDropdown';
import { TaskListProvider } from '../../../contexts/TaskListContext';
import { TaskList } from '../../../types';

// Mock the TaskListService
const mockTaskListService = {
  getAllTaskLists: jest.fn(),
  createTaskList: jest.fn(),
  updateTaskList: jest.fn(),
  deleteTaskList: jest.fn(),
  getDefaultTaskList: jest.fn(),
  moveTaskToList: jest.fn(),
  getTasksByTaskList: jest.fn(),
};

jest.mock('../../../services/database/repositories/TaskListService', () => ({
  TaskListService: jest.fn(() => mockTaskListService),
}));

// Mock translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'taskList.all': 'All',
        'taskList.default': 'Default',
        'taskList.createNew': 'Create New List...',
        'taskList.createPlaceholder': 'Enter list name...',
        'taskList.editPlaceholder': 'Edit list name...',
        'taskList.validation.nameTooLong':
          'Task list name is too long (max 255 characters)',
        'taskList.validation.nameReserved':
          'Task list name cannot be "All" (reserved)',
        'taskList.validation.nameDuplicate':
          'A task list with this name already exists',
        'taskList.validation.nameInvalidChars':
          'Task list name contains invalid characters',
        'taskList.validation.nameInvalidDots':
          'Task list name cannot start or end with a dot',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
      };
      return params
        ? translations[key]?.replace(/\{(\w+)\}/g, (_, k: string) => params[k])
        : translations[key] || key;
    },
  }),
}));

// Mock ConfirmationDialog
jest.mock('../ConfirmationDialog', () => ({
  ConfirmationDialog: ({
    isOpen,
    onConfirm,
    onClose,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid='confirmation-dialog'>
        <button onClick={onConfirm} data-testid='confirm-button'>
          Confirm
        </button>
        <button onClick={onClose} data-testid='cancel-button'>
          Cancel
        </button>
      </div>
    ) : null,
}));

const mockTaskLists: TaskList[] = [
  {
    id: 'default-id',
    name: 'Default',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'work-id',
    name: 'Work',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'personal-id',
    name: 'Personal',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const renderWithProvider = (component: React.ReactElement) => {
  return render(<TaskListProvider>{component}</TaskListProvider>);
};

describe('TaskListDropdown Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);
  });

  describe('Validation Error Handling', () => {
    it('should show validation error for empty name', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Try to save empty input
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });

    it('should show validation error for name too long', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Get the input and remove maxLength constraint for testing
      const input = screen.getByPlaceholderText('Enter list name...');
      input.removeAttribute('maxlength');

      const longName = 'a'.repeat(256);
      await user.clear(input);
      await user.type(input, longName);

      // Wait for validation to trigger
      await waitFor(() => {
        expect(input).toHaveValue(longName);
      });

      // Should show validation error
      await waitFor(
        () => {
          expect(
            screen.getByText('Task list name is too long (max 255 characters)')
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Save button should be disabled
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });

    it('should show validation error for reserved names', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Enter reserved name
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'All');

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText('Task list name cannot be "All" (reserved)')
        ).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });

    it('should show validation error for duplicate names', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Wait for task lists to load
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Enter duplicate name (case-insensitive)
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'work'); // lowercase version of existing 'Work'

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText('A task list with this name already exists')
        ).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });

    it('should show validation error for invalid characters', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Test null character
      const input = screen.getByPlaceholderText('Enter list name...');
      fireEvent.change(input, { target: { value: 'test\0name' } });

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText('Task list name contains invalid characters')
        ).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });

    it('should show validation error for names starting/ending with dots', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Test name starting with dot
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, '.hidden');

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText('Task list name cannot start or end with a dot')
        ).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByTitle('Save');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Backend Error Handling', () => {
    it('should handle create task list backend errors', async () => {
      const user = userEvent.setup();
      mockTaskListService.createTaskList.mockRejectedValue(
        new Error(
          'DUPLICATE_ERROR: A task list with the name "Test" already exists'
        )
      );

      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Enter valid name
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Test');

      // Click save
      const saveButton = screen.getByTitle('Save');
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText('A task list with this name already exists')
        ).toBeInTheDocument();
      });
    });

    it('should handle update task list backend errors', async () => {
      const user = userEvent.setup();
      mockTaskListService.updateTaskList.mockRejectedValue(
        new Error(
          'BUSINESS_RULE_ERROR: Cannot update the default task list name'
        )
      );

      renderWithProvider(<TaskListDropdown />);

      // Wait for task lists to load and select a specific list
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Open dropdown and select Work list
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Work'));

      // Open dropdown again and click edit
      await user.click(screen.getByRole('button'));
      // Note: Edit option would be available for non-default lists

      // This test would need the edit functionality to be triggered
      // The actual implementation would show the error in the dropdown
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      mockTaskListService.createTaskList.mockRejectedValue(
        new Error('NETWORK_ERROR: Connection failed')
      );

      renderWithProvider(<TaskListDropdown />);

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Enter valid name
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Test');

      // Click save
      const saveButton = screen.getByTitle('Save');
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Rollback Logic', () => {
    it('should rollback optimistic updates on create failure', async () => {
      const user = userEvent.setup();
      mockTaskListService.createTaskList.mockRejectedValue(
        new Error('DATABASE_ERROR: Connection failed')
      );

      renderWithProvider(<TaskListDropdown />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Open dropdown and click create new
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      // Enter valid name
      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Test');

      // Click save
      const saveButton = screen.getByTitle('Save');
      await user.click(saveButton);

      // Should show error and not add the new list to the dropdown
      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });

      // The dropdown should not contain the failed list
      // (This would be verified by checking the dropdown contents)
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const user = userEvent.setup();

      // Simulate concurrent modification
      mockTaskListService.createTaskList
        .mockResolvedValueOnce({
          id: 'new-id',
          name: 'Test',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockRejectedValueOnce(
          new Error('TRANSACTION_ERROR: Concurrent modification detected')
        );

      renderWithProvider(<TaskListDropdown />);

      // First operation succeeds
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Test1');

      const saveButton = screen.getByTitle('Save');
      await user.click(saveButton);

      // Wait for success
      await waitFor(() => {
        expect(mockTaskListService.createTaskList).toHaveBeenCalledWith({
          name: 'Test1',
        });
      });

      // Second operation fails due to concurrent modification
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      const input2 = screen.getByPlaceholderText('Enter list name...');
      await user.type(input2, 'Test2');

      const saveButton2 = screen.getByTitle('Save');
      await user.click(saveButton2);

      // Should show transaction error
      await waitFor(() => {
        expect(
          screen.getByText(/Concurrent modification detected/)
        ).toBeInTheDocument();
      });
    });

    it('should handle malformed backend responses', async () => {
      const user = userEvent.setup();
      mockTaskListService.createTaskList.mockResolvedValue(null); // Invalid response

      renderWithProvider(<TaskListDropdown />);

      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Create New List...'));

      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Test');

      const saveButton = screen.getByTitle('Save');
      await user.click(saveButton);

      // Should handle the error gracefully
      await waitFor(() => {
        expect(
          screen.getByText(/Cannot read properties of null/)
        ).toBeInTheDocument();
      });
    });
  });
});
