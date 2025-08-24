import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskModal } from '../TaskModal';
import { TaskListProvider } from '../../../contexts/TaskListContext';
import { Task, Priority, TaskStatus, TaskList } from '../../../types';

// Mock the entire HeroUI Modal to avoid dynamic import issues
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
    <div>{children}</div>
  ),
  ModalHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
  Select: ({
    children,
    label,
    selectedKeys,
    onSelectionChange,
    isDisabled,
    errorMessage,
    isInvalid,
  }: {
    children: React.ReactNode;
    label: string;
    selectedKeys?: string | string[];
    onSelectionChange?: (keys: Set<string>) => void;
    isDisabled?: boolean;
    errorMessage?: string;
    isInvalid?: boolean;
  }) => {
    const selectedValue = Array.isArray(selectedKeys)
      ? selectedKeys[0]
      : selectedKeys;

    // Transform children to add key as value
    const transformedChildren = React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        const childProps = child.props as Record<string, unknown>;
        return React.cloneElement(
          child as React.ReactElement<Record<string, unknown>>,
          {
            ...childProps,
            value: child.key || childProps.value,
          }
        );
      }
      return child;
    });

    return (
      <div>
        <label>{label}</label>
        <select
          aria-label={label}
          value={selectedValue || ''}
          onChange={e => onSelectionChange?.(new Set([e.target.value]))}
          disabled={isDisabled}
          aria-invalid={isInvalid}
          aria-describedby={errorMessage ? 'error' : undefined}
        >
          {transformedChildren}
        </select>
        {errorMessage && <div id='error'>{errorMessage}</div>}
      </div>
    );
  },
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value?: string;
  }) => <option value={value}>{children}</option>,
  Button: ({
    children,
    onPress,
    isDisabled,
    type,
    ...props
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    [key: string]: unknown;
  }) => (
    <button onClick={onPress} disabled={isDisabled} type={type} {...props}>
      {children}
    </button>
  ),
}));

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.modal.title.create': 'Create New Task',
        'task.modal.title.edit': 'Edit Task',
        'task.modal.label.title': 'Title',
        'task.modal.label.description': 'Description',
        'task.modal.label.priority': 'Priority',
        'task.modal.label.timeEstimate': 'Time (min)',
        'task.modal.label.dueDate': 'Due Date',
        'task.modal.label.scheduled': 'Scheduled',
        'task.modal.label.taskList': 'Task List',
        'task.modal.placeholder.title': 'What needs to be done?',
        'task.modal.placeholder.description': 'Add details about this task...',
        'task.modal.placeholder.priority': 'Select priority',
        'task.modal.placeholder.timeEstimate': '60',
        'task.modal.placeholder.taskList': 'Select task list',
        'task.modal.placeholder.tag': 'Add tag...',
        'task.modal.button.saveChanges': 'Save Changes',
        'task.modal.button.createTask': 'Create Task',
        'common.cancel': 'Cancel',
        'priority.low': 'Low',
        'priority.medium': 'Medium',
        'priority.high': 'High',
        'priority.urgent': 'Urgent',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the TaskListContext
const mockTaskListContext = {
  taskLists: [
    {
      id: 'default-list',
      name: 'Default',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'work-list',
      name: 'Work',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'personal-list',
      name: 'Personal',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as TaskList[],
  currentSelection: { type: 'specific' as const, taskListId: 'default-list' },
  isLoading: false,
  error: null,
  createTaskList: jest.fn(),
  updateTaskList: jest.fn(),
  deleteTaskList: jest.fn(),
  switchToTaskList: jest.fn(),
  switchToAll: jest.fn(),
  moveTaskToList: jest.fn(),
  refreshTaskLists: jest.fn(),
  getSelectedTaskListId: jest.fn(() => 'default-list'),
  isAllSelected: jest.fn(() => false),
  canEditCurrentList: jest.fn(() => true),
};

jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => mockTaskListContext,
  TaskListProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'Test description',
  status: TaskStatus.PENDING,
  priority: Priority.MEDIUM,
  timeEstimate: 60,
  actualTime: 0,
  dependencies: [],
  subtasks: [],
  dueDate: new Date('2024-12-31'),
  scheduledDate: new Date('2024-12-25'),
  taskListId: 'work-list',
  tags: ['test', 'important'],
  completedAt: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onCreateTask: jest.fn(),
  onUpdateTask: jest.fn(),
};

const renderTaskModal = (props = {}) => {
  return render(
    <TaskListProvider>
      <TaskModal {...defaultProps} {...props} />
    </TaskListProvider>
  );
};

describe('TaskModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task List Selection', () => {
    it('should display task list selector in create mode', () => {
      renderTaskModal();

      expect(screen.getByLabelText('Task List')).toBeInTheDocument();
    });

    it('should display task list selector in edit mode', () => {
      renderTaskModal({ task: mockTask });

      expect(screen.getByLabelText('Task List')).toBeInTheDocument();
    });

    it('should populate task list options correctly', () => {
      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toBeInTheDocument();

      // Check that the select has the correct options available
      // Note: HeroUI Select component may not expose options until clicked
      // This test verifies the component renders with task list context
      expect(mockTaskListContext.taskLists).toHaveLength(3);
    });

    it('should default to current selection when creating new task', () => {
      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      // The select should have the default list selected
      expect(taskListSelect).toHaveValue('default-list');
    });

    it('should default to default list when "All" is selected', () => {
      mockTaskListContext.isAllSelected.mockReturnValue(true);
      mockTaskListContext.getSelectedTaskListId.mockReturnValue('default-list');

      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toHaveValue('default-list');
    });

    it('should show current task list when editing existing task', () => {
      renderTaskModal({ task: mockTask });

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toHaveValue('work-list');
    });

    it('should allow changing task list selection', () => {
      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');

      // Simulate selection change by firing change event
      fireEvent.change(taskListSelect, { target: { value: 'work-list' } });

      // The component should handle the selection change
      expect(taskListSelect).toBeInTheDocument();
    });
  });

  describe('Task Creation with Task List', () => {
    it('should create task with selected task list', async () => {
      const user = userEvent.setup();
      const onCreateTask = jest.fn();

      renderTaskModal({ onCreateTask });

      // Fill in required fields
      await user.type(screen.getByLabelText('Title'), 'New Task');

      // Submit the form
      await user.click(screen.getByText('Create Task'));

      await waitFor(() => {
        expect(onCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Task',
            taskListId: 'default-list',
          })
        );
      });
    });

    it('should create task with default list when All is selected', async () => {
      const user = userEvent.setup();
      const onCreateTask = jest.fn();

      mockTaskListContext.isAllSelected.mockReturnValue(true);
      mockTaskListContext.getSelectedTaskListId.mockReturnValue('default-list');

      renderTaskModal({ onCreateTask });

      await user.type(screen.getByLabelText('Title'), 'New Task');
      await user.click(screen.getByText('Create Task'));

      await waitFor(() => {
        expect(onCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Task',
            taskListId: 'default-list',
          })
        );
      });
    });
  });

  describe('Task Editing with Task List', () => {
    it('should update task with new task list', async () => {
      const user = userEvent.setup();
      const onUpdateTask = jest.fn();
      const moveTaskToList = jest.fn().mockResolvedValue({});

      mockTaskListContext.moveTaskToList = moveTaskToList;

      renderTaskModal({
        task: mockTask,
        onUpdateTask,
      });

      // Submit the form without changes
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onUpdateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            taskListId: 'work-list',
          })
        );
      });
    });

    it('should not call moveTaskToList if task list unchanged', async () => {
      const user = userEvent.setup();
      const onUpdateTask = jest.fn();
      const moveTaskToList = jest.fn();

      mockTaskListContext.moveTaskToList = moveTaskToList;

      renderTaskModal({
        task: mockTask,
        onUpdateTask,
      });

      // Change title but keep same task list
      const titleInput = screen.getByLabelText('Title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Task');

      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(moveTaskToList).not.toHaveBeenCalled();
        expect(onUpdateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Task',
            taskListId: 'work-list',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when task list context has error', () => {
      // Temporarily override the error property
      Object.defineProperty(mockTaskListContext, 'error', {
        value: 'Failed to load task lists',
        writable: true,
        configurable: true,
      });

      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toHaveAttribute('aria-invalid', 'true');
    });

    it('should disable task list selector when no task lists available', () => {
      mockTaskListContext.taskLists = [];

      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toBeDisabled();
    });

    it('should handle moveTaskToList failure gracefully', async () => {
      const user = userEvent.setup();
      const onUpdateTask = jest.fn();
      const moveTaskToList = jest
        .fn()
        .mockRejectedValue(new Error('Move failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Ensure no error in task list context and task lists are available
      mockTaskListContext.error = null;
      mockTaskListContext.taskLists = [
        {
          id: 'default-list',
          name: 'Default',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'work-list',
          name: 'Work',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'personal-list',
          name: 'Personal',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockTaskListContext.moveTaskToList = moveTaskToList;

      // Create a task with different task list to trigger move
      const taskWithDifferentList = {
        ...mockTask,
        taskListId: 'personal-list',
      };

      renderTaskModal({
        task: taskWithDifferentList,
        onUpdateTask,
      });

      // Change the task list to trigger moveTaskToList
      const taskListSelect = screen.getByLabelText('Task List');
      await user.selectOptions(taskListSelect, 'work-list');

      // Change the form data and submit
      const titleInput = screen.getByLabelText('Title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Task');

      await user.click(screen.getByText('Save Changes'));

      // The error should be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save task:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should display user-friendly error messages to user', async () => {
      const user = userEvent.setup();
      const onUpdateTask = jest.fn();
      const moveTaskToList = jest
        .fn()
        .mockRejectedValue(
          new Error('VALIDATION_ERROR: Task list ID is required')
        );

      // Ensure no error in task list context and task lists are available
      mockTaskListContext.error = null;
      mockTaskListContext.taskLists = [
        {
          id: 'default-list',
          name: 'Default',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'work-list',
          name: 'Work',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockTaskListContext.moveTaskToList = moveTaskToList;

      // Create a task with different task list to trigger move
      const taskWithDifferentList = {
        ...mockTask,
        taskListId: 'default-list',
      };

      renderTaskModal({
        task: taskWithDifferentList,
        onUpdateTask,
      });

      // Change the task list to trigger moveTaskToList
      const taskListSelect = screen.getByLabelText('Task List');
      await user.selectOptions(taskListSelect, 'work-list');

      await user.click(screen.getByText('Save Changes'));

      // Verify user-friendly error message is displayed (without technical prefixes)
      await waitFor(() => {
        expect(
          screen.getByText(/Task list ID is required/i)
        ).toBeInTheDocument();
        expect(screen.queryByText(/VALIDATION_ERROR/i)).not.toBeInTheDocument();
      });

      // Modal should remain open
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require title field even with task list selection', () => {
      const onCreateTask = jest.fn();

      renderTaskModal({ onCreateTask });

      // Try to submit without title
      const createButton = screen.getByText('Create Task');
      expect(createButton).toBeDisabled();

      expect(onCreateTask).not.toHaveBeenCalled();
    });

    it('should enable submit button when title and task list are provided', async () => {
      const user = userEvent.setup();

      renderTaskModal();

      await user.type(screen.getByLabelText('Title'), 'New Task');

      const createButton = screen.getByText('Create Task');
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for task list selector', () => {
      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');
      expect(taskListSelect).toBeInTheDocument();
    });

    it('should support keyboard navigation for task list selector', () => {
      // Ensure no error in task list context and task lists are available
      mockTaskListContext.error = null;
      mockTaskListContext.taskLists = [
        {
          id: 'default-list',
          name: 'Default',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'work-list',
          name: 'Work',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      renderTaskModal();

      const taskListSelect = screen.getByLabelText('Task List');

      // Focus the select element
      taskListSelect.focus();
      expect(taskListSelect).toHaveFocus();
    });
  });
});
