import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TaskListProvider, useTaskList } from '../TaskListContext';
import { SettingsProvider } from '../SettingsContext';
import { TaskList } from '../../types';
import { TaskListService } from '../../services/database/repositories/TaskListService';

// Mock the TaskListService
jest.mock('../../services/database/repositories/TaskListService');

const MockedTaskListService = TaskListService as jest.MockedClass<
  typeof TaskListService
>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test component that uses the context
const TestComponent: React.FC = () => {
  const {
    taskLists,
    currentSelection,
    isLoading,
    error,
    createTaskList,
    updateTaskList,
    deleteTaskList,
    switchToTaskList,
    switchToAll,
    refreshTaskLists,
    getSelectedTaskListId,
    isAllSelected,
    canEditCurrentList,
  } = useTaskList();

  const handleSwitchToTaskList = async (taskListId: string) => {
    try {
      await switchToTaskList(taskListId);
    } catch {
      // Error is handled by context
    }
  };

  return (
    <div>
      <div data-testid='loading'>{isLoading.toString()}</div>
      <div data-testid='error'>{error || 'null'}</div>
      <div data-testid='task-lists-count'>{taskLists.length}</div>
      <div data-testid='selection-type'>{currentSelection.type}</div>
      <div data-testid='selected-id'>{getSelectedTaskListId() || 'null'}</div>
      <div data-testid='is-all-selected'>{isAllSelected().toString()}</div>
      <div data-testid='can-edit'>{canEditCurrentList().toString()}</div>

      <button
        data-testid='create-list'
        onClick={async () => {
          try {
            await createTaskList({ name: 'New List' });
          } catch {
            // Error is handled by context
          }
        }}
      >
        Create List
      </button>

      <button
        data-testid='update-list'
        onClick={async () => {
          if (
            currentSelection.type === 'specific' &&
            currentSelection.taskListId
          ) {
            try {
              await updateTaskList(currentSelection.taskListId, {
                name: 'Updated List',
              });
            } catch {
              // Error is handled by context
            }
          }
        }}
      >
        Update List
      </button>

      <button
        data-testid='delete-list'
        onClick={async () => {
          if (
            currentSelection.type === 'specific' &&
            currentSelection.taskListId
          ) {
            try {
              await deleteTaskList(currentSelection.taskListId);
            } catch {
              // Error is handled by context
            }
          }
        }}
      >
        Delete List
      </button>

      <button data-testid='switch-to-all' onClick={() => switchToAll()}>
        Switch to All
      </button>

      <button
        data-testid='switch-to-work'
        onClick={() => handleSwitchToTaskList('work-list')}
      >
        Switch to Work
      </button>

      <button
        data-testid='switch-to-default'
        onClick={() => handleSwitchToTaskList('default-list')}
      >
        Switch to Default
      </button>

      <button
        data-testid='switch-to-nonexistent'
        onClick={() => handleSwitchToTaskList('non-existent')}
      >
        Switch to Non-existent
      </button>

      <button data-testid='refresh' onClick={() => refreshTaskLists()}>
        Refresh
      </button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <SettingsProvider>
      <TaskListProvider>
        <TestComponent />
      </TaskListProvider>
    </SettingsProvider>
  );
};

describe('TaskListContext', () => {
  let mockTaskListService: jest.Mocked<TaskListService>;

  const mockTaskLists: TaskList[] = [
    {
      id: 'default-list',
      name: 'Default',
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'work-list',
      name: 'Work',
      isDefault: false,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    mockTaskListService = {
      getAllTaskLists: jest.fn(),
      createTaskList: jest.fn(),
      updateTaskList: jest.fn(),
      deleteTaskList: jest.fn(),
      getDefaultTaskList: jest.fn(),
      moveTaskToList: jest.fn(),
      getTasksByTaskList: jest.fn(),
    } as unknown as jest.Mocked<TaskListService>;

    MockedTaskListService.mockImplementation(() => mockTaskListService);
  });

  describe('Initial Loading', () => {
    it('should load task lists on mount', async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('task-lists-count')).toHaveTextContent('2');
      expect(mockTaskListService.getAllTaskLists).toHaveBeenCalledTimes(1);
    });

    it('should handle loading errors', async () => {
      const errorMessage = 'Failed to load task lists';
      mockTaskListService.getAllTaskLists.mockRejectedValue(
        new Error(errorMessage)
      );

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(errorMessage);
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('should default to "All" selection when no stored selection', async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent('all');
      });

      expect(screen.getByTestId('is-all-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('null');
    });
  });

  describe('Selection Persistence', () => {
    it('should restore "all" selection from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ type: 'all' }));
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent('all');
      });
    });

    it('should restore specific task list selection from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({
          type: 'specific',
          taskListId: 'work-list',
        })
      );
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent(
          'specific'
        );
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'work-list'
        );
      });
    });

    it('should fall back to default list if stored selection no longer exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({
          type: 'specific',
          taskListId: 'non-existent-list',
        })
      );
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent(
          'specific'
        );
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'default-list'
        );
      });
    });

    it('should persist selection changes to localStorage', async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      act(() => {
        screen.getByTestId('switch-to-all').click();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'kirapilot-selected-task-list',
        JSON.stringify({ type: 'all' })
      );
    });
  });

  describe('Task List Operations', () => {
    beforeEach(async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('should create a new task list', async () => {
      const newTaskList: TaskList = {
        id: 'new-list',
        name: 'New List',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTaskListService.createTaskList.mockResolvedValue(newTaskList);

      act(() => {
        screen.getByTestId('create-list').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('task-lists-count')).toHaveTextContent('3');
      });

      expect(mockTaskListService.createTaskList).toHaveBeenCalledWith({
        name: 'New List',
      });
      expect(screen.getByTestId('selected-id')).toHaveTextContent('new-list');
    });

    it('should handle create task list errors', async () => {
      const errorMessage = 'Failed to create task list';
      mockTaskListService.createTaskList.mockRejectedValue(
        new Error(errorMessage)
      );

      await act(async () => {
        screen.getByTestId('create-list').click();
      });

      await waitFor(() => {
        // The error handling system returns "An unknown error occurred" for unrecognized error formats
        expect(screen.getByTestId('error')).toHaveTextContent(
          'An unknown error occurred'
        );
      });
    });

    it('should update a task list', async () => {
      // Switch to work list
      act(() => {
        screen.getByTestId('switch-to-work').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'work-list'
        );
      });

      const updatedTaskList: TaskList = {
        ...mockTaskLists[1],
        name: 'Updated List',
        updatedAt: new Date(),
      };

      mockTaskListService.updateTaskList.mockResolvedValue(updatedTaskList);

      act(() => {
        screen.getByTestId('update-list').click();
      });

      await waitFor(() => {
        expect(mockTaskListService.updateTaskList).toHaveBeenCalledWith(
          'work-list',
          { name: 'Updated List' }
        );
      });
    });

    it('should delete a task list', async () => {
      mockTaskListService.deleteTaskList.mockResolvedValue();

      // Switch to work list first
      act(() => {
        screen.getByTestId('switch-to-work').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'work-list'
        );
      });

      act(() => {
        screen.getByTestId('delete-list').click();
      });

      await waitFor(() => {
        expect(mockTaskListService.deleteTaskList).toHaveBeenCalledWith(
          'work-list'
        );
      });

      expect(screen.getByTestId('task-lists-count')).toHaveTextContent('1');
    });

    it('should prevent deleting default task list', async () => {
      // Switch to default list
      act(() => {
        screen.getByTestId('switch-to-default').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'default-list'
        );
      });

      await act(async () => {
        screen.getByTestId('delete-list').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Cannot delete the default task list'
        );
      });

      expect(mockTaskListService.deleteTaskList).not.toHaveBeenCalled();
    });

    it('should refresh task lists', async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue([...mockTaskLists]);

      act(() => {
        screen.getByTestId('refresh').click();
      });

      await waitFor(() => {
        expect(mockTaskListService.getAllTaskLists).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Selection Management', () => {
    beforeEach(async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('should switch to "All" view', () => {
      act(() => {
        screen.getByTestId('switch-to-all').click();
      });

      expect(screen.getByTestId('selection-type')).toHaveTextContent('all');
      expect(screen.getByTestId('is-all-selected')).toHaveTextContent('true');
    });

    it('should switch to specific task list', async () => {
      act(() => {
        screen.getByTestId('switch-to-work').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent(
          'specific'
        );
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'work-list'
        );
      });
    });

    it('should handle switching to non-existent task list', async () => {
      act(() => {
        screen.getByTestId('switch-to-nonexistent').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Task list with id non-existent not found'
        );
      });
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('should return correct values for "All" selection', () => {
      act(() => {
        screen.getByTestId('switch-to-all').click();
      });

      expect(screen.getByTestId('is-all-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('null');
    });

    it('should return correct values for default task list selection', async () => {
      act(() => {
        screen.getByTestId('switch-to-default').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-all-selected')).toHaveTextContent(
          'false'
        );
        expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'default-list'
        );
      });
    });

    it('should return correct values for non-default task list selection', async () => {
      act(() => {
        screen.getByTestId('switch-to-work').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-all-selected')).toHaveTextContent(
          'false'
        );
        expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
        expect(screen.getByTestId('selected-id')).toHaveTextContent(
          'work-list'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('selection-type')).toHaveTextContent('all');
      });
    });

    it('should handle localStorage setItem errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage setItem error');
      });
      mockTaskListService.getAllTaskLists.mockResolvedValue(mockTaskLists);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // This should not throw an error
      act(() => {
        screen.getByTestId('switch-to-all').click();
      });
    });
  });

  describe('Context Hook Error', () => {
    it('should throw error when used outside provider', () => {
      const TestComponentWithoutProvider = () => {
        useTaskList();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useTaskList must be used within a TaskListProvider');
    });
  });
});
