import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskListDropdown } from '../TaskListDropdown';
import { TaskList, TaskListSelection } from '../../../types';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'taskList.all': 'All Tasks',
        'taskList.default': 'Default',
        'taskList.selectTaskList': 'Select task list',
        'taskList.createNew': 'Create New List...',
        'taskList.createPlaceholder': 'Enter list name...',
        'taskList.editCurrent': 'Edit Current List',
        'taskList.editPlaceholder': 'Edit list name...',

        'taskList.deleteConfirmTitle': 'Delete Task List',
        'taskList.deleteConfirmMessage': `Are you sure you want to delete "${params?.name}"? All tasks in this list will be moved to the Default list.`,
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock data
const mockTaskLists: TaskList[] = [
  {
    id: 'default-id',
    name: 'Default',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'work-id',
    name: 'Work Projects',
    isDefault: false,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'personal-id',
    name: 'Personal Tasks',
    isDefault: false,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

// Mock the useTaskList hook
const mockUseTaskList = jest.fn();

jest.mock('../../../contexts/TaskListContext', () => ({
  useTaskList: () => mockUseTaskList(),
}));

// Helper function to setup mock context
const setupMockContext = (options?: {
  initialSelection?: TaskListSelection;
  mockError?: string | null;
  isLoading?: boolean;
  mockFunctions?: Partial<ReturnType<typeof mockUseTaskList>>;
}) => {
  const {
    initialSelection = { type: 'all' as const },
    mockError = null,
    isLoading = false,
    mockFunctions = {},
  } = options || {};

  const defaultMockValue = {
    taskLists: mockTaskLists,
    currentSelection: initialSelection,
    isLoading,
    error: mockError,
    createTaskList: jest.fn(),
    updateTaskList: jest.fn(),
    deleteTaskList: jest.fn(),
    switchToTaskList: jest.fn(),
    switchToAll: jest.fn(),
    moveTaskToList: jest.fn(),
    refreshTaskLists: jest.fn(),
    getSelectedTaskListId: jest.fn(),
    isAllSelected: jest.fn(() => initialSelection?.type === 'all'),
    canEditCurrentList: jest.fn(
      () => initialSelection?.type === 'specific' && !!initialSelection.taskList
    ),

    ...mockFunctions,
  };

  mockUseTaskList.mockReturnValue(defaultMockValue);
  return defaultMockValue;
};

describe('TaskListDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with "All Tasks" selected by default', () => {
      setupMockContext();
      render(<TaskListDropdown />);

      expect(
        screen.getByRole('button', { name: /select task list/i })
      ).toBeInTheDocument();
      expect(screen.getByText('All Tasks')).toBeInTheDocument();
    });

    it('renders with specific task list selected', () => {
      const selection: TaskListSelection = {
        type: 'specific',
        taskListId: 'work-id',
        taskList: mockTaskLists[1],
      };

      setupMockContext({ initialSelection: selection });
      render(<TaskListDropdown />);

      expect(screen.getByText('Work Projects')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      setupMockContext({ isLoading: true });
      render(<TaskListDropdown />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens and closes dropdown on button click', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });

      // Initially closed
      expect(screen.queryByText('Create New List...')).not.toBeInTheDocument();

      // Open dropdown
      await user.click(button);
      expect(screen.getByText('Create New List...')).toBeInTheDocument();

      // Close dropdown
      await user.click(button);
      expect(screen.queryByText('Create New List...')).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });

      // Open dropdown
      await user.click(button);
      expect(screen.getByText('Create New List...')).toBeInTheDocument();

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(
          screen.queryByText('Create New List...')
        ).not.toBeInTheDocument();
      });
    });

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });

      // Open dropdown
      await user.click(button);
      expect(screen.getByText('Create New List...')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          screen.queryByText('Create New List...')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Task List Selection', () => {
    it('displays all available task lists', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      // Use getAllByText since "All Tasks" appears in both the button and dropdown
      expect(screen.getAllByText('All Tasks')).toHaveLength(2);
      // "Default" appears twice - once as the task list name and once as the label
      expect(screen.getAllByText('Default')).toHaveLength(2);
      expect(screen.getByText('Work Projects')).toBeInTheDocument();
      expect(screen.getByText('Personal Tasks')).toBeInTheDocument();
    });

    it('shows check mark for currently selected task list', async () => {
      const user = userEvent.setup();
      const selection: TaskListSelection = {
        type: 'specific',
        taskListId: 'work-id',
        taskList: mockTaskLists[1],
      };

      setupMockContext({ initialSelection: selection });
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      // Check that the selected item has a check mark (we can't easily test for the icon, but we can test the selection state)
      const workProjectsButton = screen.getByRole('button', {
        name: /work projects/i,
      });
      expect(workProjectsButton).toHaveClass('text-primary-700');
    });
  });

  describe('Create New Task List', () => {
    it('enters create mode when clicking "Create New List"', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      const createButton = screen.getByText('Create New List...');
      await user.click(createButton);

      expect(
        screen.getByPlaceholderText('Enter list name...')
      ).toBeInTheDocument();
    });

    it('creates new task list on Enter key', async () => {
      const user = userEvent.setup();
      const mockCreateTaskList = jest.fn().mockResolvedValue(mockTaskLists[1]);

      setupMockContext({
        mockFunctions: { createTaskList: mockCreateTaskList },
      });
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      const createButton = screen.getByText('Create New List...');
      await user.click(createButton);

      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'New Project');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCreateTaskList).toHaveBeenCalledWith({
          name: 'New Project',
        });
      });
    });

    it('cancels create mode on X button click', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      const createButton = screen.getByText('Create New List...');
      await user.click(createButton);

      const input = screen.getByPlaceholderText('Enter list name...');
      expect(input).toBeInTheDocument();

      const cancelButton = screen.getByTitle('Cancel');
      await user.click(cancelButton);

      expect(
        screen.queryByPlaceholderText('Enter list name...')
      ).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when present', async () => {
      const user = userEvent.setup();
      setupMockContext({ mockError: 'Failed to load task lists' });
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      expect(screen.getByText('Failed to load task lists')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('focuses input when entering create mode', async () => {
      const user = userEvent.setup();
      setupMockContext();
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      const createButton = screen.getByText('Create New List...');
      await user.click(createButton);

      const input = screen.getByPlaceholderText('Enter list name...');
      expect(input).toHaveFocus();
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles Enter key in create mode', async () => {
      const user = userEvent.setup();
      const mockCreateTaskList = jest.fn().mockResolvedValue(mockTaskLists[1]);

      setupMockContext({
        mockFunctions: { createTaskList: mockCreateTaskList },
      });
      render(<TaskListDropdown />);

      const button = screen.getByRole('button', { name: /select task list/i });
      await user.click(button);

      const createButton = screen.getByText('Create New List...');
      await user.click(createButton);

      const input = screen.getByPlaceholderText('Enter list name...');
      await user.type(input, 'Keyboard Test');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCreateTaskList).toHaveBeenCalledWith({
          name: 'Keyboard Test',
        });
      });
    });
  });
});
