import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeriodicTaskModal } from '../PeriodicTaskModal';
import { Priority, RecurrenceType, PeriodicTaskTemplate } from '../../../types';

// Mock the PeriodicTaskService
jest.mock('../../../services/database/repositories/PeriodicTaskService');

// Mock the error handling service
jest.mock('../../../services/errorHandling/ErrorHandlingService', () => ({
  errorHandlingService: {
    executeDatabaseOperation: jest.fn(operation => operation()),
    processError: jest.fn(error => error),
    getUserMessage: jest.fn(error => error.message || 'An error occurred'),
  },
}));

// Mock the contexts
jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    preferences: {
      dateFormat: 'DD/MM/YYYY',
    },
  }),
}));

jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => ({
    getSelectedTaskListId: () => 'default-task-list',
    isAllSelected: () => false,
    taskLists: [
      { id: 'default-task-list', name: 'Default', isDefault: true },
      { id: 'work-list', name: 'Work', isDefault: false },
    ],
    error: null,
  }),
}));

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key, // Return the key as the translation
  }),
}));

// Mock HeroUI Modal components to avoid DOM issues in tests
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  Modal: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid='modal'>{children}</div> : null),
  ModalContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-content'>{children}</div>
  ),
  ModalHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-header'>{children}</div>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-body'>{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-footer'>{children}</div>
  ),
}));

const mockTemplate: PeriodicTaskTemplate = {
  id: 'test-template-1',
  title: 'Test Periodic Task',
  description: 'Test description',
  priority: Priority.MEDIUM,
  timeEstimate: 60,
  tags: ['test', 'periodic'],
  taskListId: 'default-task-list',
  recurrenceType: RecurrenceType.WEEKLY,
  recurrenceInterval: 1,
  recurrenceUnit: undefined,
  startDate: new Date('2024-01-01'),
  nextGenerationDate: new Date('2024-01-08'),
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('PeriodicTaskModal', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateTemplate = jest.fn();
  const mockOnUpdateTemplate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create modal correctly', () => {
    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    expect(
      screen.getByText('periodicTask.modal.title.create')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('periodicTask.modal.label.title')
    ).toBeInTheDocument();
    expect(
      screen.getByText('periodicTask.modal.button.createTemplate')
    ).toBeInTheDocument();
  });

  it('renders edit modal correctly', () => {
    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onUpdateTemplate={mockOnUpdateTemplate}
        template={mockTemplate}
      />
    );

    expect(
      screen.getByText('periodicTask.modal.title.edit')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Periodic Task')).toBeInTheDocument();
    expect(
      screen.getByText('periodicTask.modal.button.saveChanges')
    ).toBeInTheDocument();
  });

  it('populates form with template data in edit mode', () => {
    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onUpdateTemplate={mockOnUpdateTemplate}
        template={mockTemplate}
      />
    );

    expect(screen.getByDisplayValue('Test Periodic Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('periodic')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();

    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    const submitButton = screen.getByText(
      'periodicTask.modal.button.createTemplate'
    );
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Task title is required')).toBeInTheDocument();
    });
  });

  it('adds and removes tags correctly', async () => {
    const user = userEvent.setup();

    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    const tagInput = screen.getByPlaceholderText(
      'periodicTask.modal.placeholder.tag'
    );
    const addButton = screen.getByRole('button', { name: '' }); // Icon-only button

    // Add a tag
    await user.type(tagInput, 'test-tag');
    await user.click(addButton);

    expect(screen.getByText('test-tag')).toBeInTheDocument();

    // Remove the tag
    const removeButton = screen.getByRole('button', { name: 'test-tag' });
    await user.click(removeButton);

    expect(screen.queryByText('test-tag')).not.toBeInTheDocument();
  });

  it('shows template status toggle in edit mode', () => {
    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onUpdateTemplate={mockOnUpdateTemplate}
        template={mockTemplate}
      />
    );

    expect(
      screen.getByText('periodicTask.modal.label.status')
    ).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('does not show template status toggle in create mode', () => {
    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    expect(
      screen.queryByText('periodicTask.modal.label.status')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    const cancelButton = screen.getByText('common.cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onCreateTemplate when form is submitted in create mode', async () => {
    const user = userEvent.setup();
    mockOnCreateTemplate.mockResolvedValue(undefined);

    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    const titleInput = screen.getByLabelText('periodicTask.modal.label.title');
    await user.type(titleInput, 'New Periodic Task');

    const submitButton = screen.getByText(
      'periodicTask.modal.button.createTemplate'
    );
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnCreateTemplate).toHaveBeenCalled();
    });
  });

  it('calls onUpdateTemplate when form is submitted in edit mode', async () => {
    const user = userEvent.setup();
    mockOnUpdateTemplate.mockResolvedValue(undefined);

    render(
      <PeriodicTaskModal
        isOpen={true}
        onClose={mockOnClose}
        onUpdateTemplate={mockOnUpdateTemplate}
        template={mockTemplate}
      />
    );

    const titleInput = screen.getByDisplayValue('Test Periodic Task');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Periodic Task');

    const submitButton = screen.getByText(
      'periodicTask.modal.button.saveChanges'
    );
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnUpdateTemplate).toHaveBeenCalled();
    });
  });
});
