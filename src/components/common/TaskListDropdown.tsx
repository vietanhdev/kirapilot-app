import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  List,
  Plus,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useTaskList } from '../../contexts/TaskListContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ConfirmationDialog } from './ConfirmationDialog';
import { TASK_LIST_ALL } from '../../types';

interface TaskListDropdownProps {
  className?: string;
}

type DropdownMode = 'view' | 'create' | 'edit';

export const TaskListDropdown: React.FC<TaskListDropdownProps> = ({
  className = '',
}) => {
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
  } = useTaskList();

  const { t } = useTranslation();

  // Component state
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DropdownMode>('view');
  const [inputValue, setInputValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoveredTaskListId, setHoveredTaskListId] = useState<string | null>(
    null
  );
  const [taskListToDelete, setTaskListToDelete] = useState<string | null>(null);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCloseDropdown = useCallback(() => {
    setIsOpen(false);
    setMode('view');
    setInputValue('');
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        handleCloseDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, handleCloseDropdown]);

  // Focus input when entering create/edit mode
  useEffect(() => {
    if ((mode === 'create' || mode === 'edit') && inputRef.current) {
      // Use multiple attempts to ensure focus works reliably
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (mode === 'edit') {
            inputRef.current.select(); // Select existing text for easy editing
          }
        }
      };

      // Immediate attempt
      focusInput();

      // Backup attempt after a short delay
      const timeoutId = setTimeout(focusInput, 10);

      return () => clearTimeout(timeoutId);
    }
  }, [mode]);

  const handleToggleDropdown = useCallback(() => {
    if (isLoading) {
      return;
    }
    setIsOpen(!isOpen);
  }, [isOpen, isLoading]);

  const handleSelectTaskList = useCallback(
    async (taskListId: string) => {
      if (isProcessing) {
        return;
      }

      try {
        setIsProcessing(true);
        if (taskListId === TASK_LIST_ALL) {
          switchToAll();
        } else {
          await switchToTaskList(taskListId);
        }
        handleCloseDropdown();
      } catch (err) {
        console.error('Failed to switch task list:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [switchToAll, switchToTaskList, isProcessing, handleCloseDropdown]
  );

  const handleCreateNew = useCallback(() => {
    setMode('create');
    setInputValue('');

    // Ensure focus happens after state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);
  }, []);

  const handleEditSpecific = useCallback(
    (taskListId: string, taskListName: string, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent task list selection
      setMode('edit');
      setInputValue(taskListName);

      // Switch to the task list we're editing
      switchToTaskList(taskListId).then(() => {
        // Ensure focus happens after state update
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 10);
      });
    },
    [switchToTaskList]
  );

  const handleDeleteSpecific = useCallback(
    (taskListId: string, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent task list selection
      setTaskListToDelete(taskListId);
      setShowDeleteConfirm(true);
    },
    []
  );

  const handleSaveInput = useCallback(async () => {
    if (isProcessing) {
      return;
    }

    const trimmedValue = inputValue.trim();

    // Enhanced frontend validation with specific error feedback
    if (!trimmedValue) {
      return; // Don't proceed with empty input
    }

    if (trimmedValue.length > 255) {
      return; // Don't proceed with too long input
    }

    // Check for reserved names
    if (['All', 'ALL', 'all'].includes(trimmedValue)) {
      return; // Don't proceed with reserved names
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = taskLists.some(
      list =>
        list.name.toLowerCase() === trimmedValue.toLowerCase() &&
        (mode === 'create' ||
          (mode === 'edit' && list.id !== currentSelection.taskList?.id))
    );

    if (isDuplicate) {
      return; // Don't proceed with duplicate names
    }

    // Check for invalid characters
    if (
      trimmedValue.includes('\0') ||
      trimmedValue.startsWith('.') ||
      trimmedValue.endsWith('.')
    ) {
      return; // Don't proceed with invalid characters
    }

    try {
      setIsProcessing(true);

      if (mode === 'create') {
        await createTaskList({ name: trimmedValue });
      } else if (mode === 'edit' && currentSelection.taskList) {
        await updateTaskList(currentSelection.taskList.id, {
          name: trimmedValue,
        });
      }

      handleCloseDropdown();
    } catch (err) {
      console.error(`Failed to ${mode} task list:`, err);
      // Error is already handled by the context and displayed in the dropdown
    } finally {
      setIsProcessing(false);
    }
  }, [
    mode,
    inputValue,
    createTaskList,
    updateTaskList,
    currentSelection,
    isProcessing,
    handleCloseDropdown,
    taskLists,
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          handleCloseDropdown();
          break;
        case 'Enter':
          if (mode === 'create' || mode === 'edit') {
            event.preventDefault();
            handleSaveInput();
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, mode, handleCloseDropdown, handleSaveInput]);

  const handleCancelInput = useCallback(() => {
    setMode('view');
    setInputValue('');
  }, []);

  // Enhanced validation helpers
  const getInputValidationClass = useCallback(() => {
    const trimmedValue = inputValue.trim();

    if (trimmedValue.length === 0) {
      return 'border-divider focus:ring-primary-500';
    }

    if (trimmedValue.length > 255) {
      return 'border-danger focus:ring-danger';
    }

    if (['All', 'ALL', 'all'].includes(trimmedValue)) {
      return 'border-warning focus:ring-warning';
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = taskLists.some(
      list =>
        list.name.toLowerCase() === trimmedValue.toLowerCase() &&
        (mode === 'create' ||
          (mode === 'edit' && list.id !== currentSelection.taskList?.id))
    );

    if (isDuplicate) {
      return 'border-warning focus:ring-warning';
    }

    // Check for invalid characters
    if (
      trimmedValue.includes('\0') ||
      trimmedValue.startsWith('.') ||
      trimmedValue.endsWith('.')
    ) {
      return 'border-danger focus:ring-danger';
    }

    return 'border-success focus:ring-success';
  }, [inputValue, taskLists, mode, currentSelection]);

  const getInputValidationDisabled = useCallback(() => {
    const trimmedValue = inputValue.trim();

    if (isProcessing || !trimmedValue || trimmedValue.length > 255) {
      return true;
    }

    if (['All', 'ALL', 'all'].includes(trimmedValue)) {
      return true;
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = taskLists.some(
      list =>
        list.name.toLowerCase() === trimmedValue.toLowerCase() &&
        (mode === 'create' ||
          (mode === 'edit' && list.id !== currentSelection.taskList?.id))
    );

    if (isDuplicate) {
      return true;
    }

    // Check for invalid characters
    if (
      trimmedValue.includes('\0') ||
      trimmedValue.startsWith('.') ||
      trimmedValue.endsWith('.')
    ) {
      return true;
    }

    return false;
  }, [inputValue, taskLists, mode, currentSelection, isProcessing]);

  const getValidationMessage = useCallback(() => {
    const trimmedValue = inputValue.trim();

    if (trimmedValue.length > 255) {
      return t('taskList.validation.nameTooLong');
    }

    if (['All', 'ALL', 'all'].includes(trimmedValue)) {
      return t('taskList.validation.nameReserved');
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = taskLists.some(
      list =>
        list.name.toLowerCase() === trimmedValue.toLowerCase() &&
        (mode === 'create' ||
          (mode === 'edit' && list.id !== currentSelection.taskList?.id))
    );

    if (isDuplicate) {
      return t('taskList.validation.nameDuplicate');
    }

    // Check for invalid characters
    if (trimmedValue.includes('\0')) {
      return t('taskList.validation.nameInvalidChars');
    }

    if (trimmedValue.startsWith('.') || trimmedValue.endsWith('.')) {
      return t('taskList.validation.nameInvalidDots');
    }

    return null;
  }, [inputValue, taskLists, mode, currentSelection, t]);

  const handleConfirmDelete = useCallback(async () => {
    if (isProcessing) {
      return;
    }

    // Determine which task list to delete
    let taskListIdToDelete: string | null = null;

    if (taskListToDelete) {
      // Deleting a specific task list
      taskListIdToDelete = taskListToDelete;
    } else if (
      currentSelection.type === 'specific' &&
      currentSelection.taskList
    ) {
      // Deleting the current task list
      taskListIdToDelete = currentSelection.taskList.id;
    }

    if (!taskListIdToDelete) {
      return;
    }

    try {
      setIsProcessing(true);
      await deleteTaskList(taskListIdToDelete);
      setShowDeleteConfirm(false);
      setTaskListToDelete(null);
      handleCloseDropdown();
    } catch (err) {
      console.error('Failed to delete task list:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [
    deleteTaskList,
    currentSelection,
    taskListToDelete,
    isProcessing,
    handleCloseDropdown,
  ]);

  // Get display text for current selection
  const getDisplayText = () => {
    if (currentSelection.type === 'all') {
      return t('taskList.all');
    }
    if (currentSelection.type === 'specific' && currentSelection.taskList) {
      return currentSelection.taskList.name;
    }
    return t('taskList.default');
  };

  // Get display icon for current selection
  const getDisplayIcon = () => {
    if (currentSelection.type === 'all') {
      return <List className='w-4 h-4' />;
    }
    return <List className='w-4 h-4' />;
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Dropdown Trigger */}
        <button
          onClick={handleToggleDropdown}
          disabled={isLoading}
          className={`
            flex items-center justify-between px-3 py-2 min-w-[140px]
            border border-divider rounded-lg bg-content2 text-foreground
            hover:bg-content3 hover:border-divider-hover
            focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-all duration-200
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? 'ring-2 ring-primary-500 border-transparent' : ''}
          `}
          aria-expanded={isOpen}
          aria-haspopup='listbox'
          aria-label={t('taskList.selectTaskList')}
        >
          <div className='flex items-center gap-2'>
            {getDisplayIcon()}
            <span className='font-medium text-sm truncate'>
              {isLoading ? t('common.loading') : getDisplayText()}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className='absolute z-50 w-80 mt-1 bg-content1 border border-divider rounded-lg shadow-lg max-h-80 overflow-y-auto'>
            {/* Error Display */}
            {error && (
              <div className='px-3 py-2 text-sm text-danger bg-danger-50 border-b border-divider'>
                <div className='flex items-center gap-2'>
                  <AlertTriangle className='w-4 h-4' />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Create New Input */}
            {mode === 'create' && (
              <div className='p-2 border-b border-divider'>
                <div className='flex items-center gap-2'>
                  <input
                    ref={inputRef}
                    type='text'
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onFocus={e => {
                      // Only select text if it's not empty (for create mode)
                      if (inputValue.trim()) {
                        e.target.select();
                      }
                    }}
                    placeholder={t('taskList.createPlaceholder')}
                    className={`flex-1 px-2 py-1 text-sm border rounded bg-content2 focus:ring-2 focus:border-transparent transition-colors ${getInputValidationClass()}`}
                    disabled={isProcessing}
                    maxLength={255}
                    autoFocus
                    autoComplete='off'
                    spellCheck={false}
                  />
                  <button
                    onClick={handleSaveInput}
                    disabled={getInputValidationDisabled()}
                    className='p-1 text-success hover:bg-success-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    title={t('common.save')}
                  >
                    <Check className='w-4 h-4' />
                  </button>
                  <button
                    onClick={handleCancelInput}
                    disabled={isProcessing}
                    className='p-1 text-default-500 hover:bg-default-100 rounded transition-colors'
                    title={t('common.cancel')}
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                {/* Enhanced validation feedback */}
                {getValidationMessage() && (
                  <div
                    className={`mt-1 text-xs ${
                      inputValue.trim().length > 255 ||
                      inputValue.trim().includes('\0') ||
                      inputValue.trim().startsWith('.') ||
                      inputValue.trim().endsWith('.')
                        ? 'text-danger'
                        : 'text-warning'
                    }`}
                  >
                    {getValidationMessage()}
                  </div>
                )}
              </div>
            )}

            {/* Edit Current Input */}
            {mode === 'edit' && (
              <div className='p-2 border-b border-divider'>
                <div className='flex items-center gap-2'>
                  <input
                    ref={inputRef}
                    type='text'
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onFocus={e => e.target.select()} // Select all text when focused
                    placeholder={t('taskList.editPlaceholder')}
                    className={`flex-1 px-2 py-1 text-sm border rounded bg-content2 focus:ring-2 focus:border-transparent transition-colors ${getInputValidationClass()}`}
                    disabled={isProcessing}
                    maxLength={255}
                    autoFocus
                    autoComplete='off'
                    spellCheck={false}
                  />
                  <button
                    onClick={handleSaveInput}
                    disabled={getInputValidationDisabled()}
                    className='p-1 text-success hover:bg-success-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    title={t('common.save')}
                  >
                    <Check className='w-4 h-4' />
                  </button>
                  <button
                    onClick={handleCancelInput}
                    disabled={isProcessing}
                    className='p-1 text-default-500 hover:bg-default-100 rounded transition-colors'
                    title={t('common.cancel')}
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                {/* Enhanced validation feedback */}
                {getValidationMessage() && (
                  <div
                    className={`mt-1 text-xs ${
                      inputValue.trim().length > 255 ||
                      inputValue.trim().includes('\0') ||
                      inputValue.trim().startsWith('.') ||
                      inputValue.trim().endsWith('.')
                        ? 'text-danger'
                        : 'text-warning'
                    }`}
                  >
                    {getValidationMessage()}
                  </div>
                )}
              </div>
            )}

            {/* Task List Options */}
            {mode === 'view' && (
              <>
                {/* "All" Option */}
                <div
                  className={`
                    flex items-center w-full transition-all duration-200 ease-in-out
                    hover:bg-content2/80 hover:backdrop-blur-sm
                    ${
                      currentSelection.type === 'all'
                        ? 'bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border-l-2 border-primary-500 shadow-sm'
                        : ''
                    }
                    ${isProcessing ? 'opacity-50' : ''}
                  `}
                >
                  <button
                    onClick={() => handleSelectTaskList(TASK_LIST_ALL)}
                    disabled={isProcessing}
                    className={`
                      flex-1 flex items-center gap-3 px-3 py-2 text-left text-sm
                      transition-colors duration-200
                      ${
                        currentSelection.type === 'all'
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-foreground'
                      }
                    `}
                  >
                    <List
                      className={`w-4 h-4 transition-colors duration-200 ${
                        currentSelection.type === 'all'
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-default-500'
                      }`}
                    />
                    <span className='font-medium'>{t('taskList.all')}</span>
                  </button>
                </div>

                {/* Separator */}
                {taskLists.length > 0 && (
                  <div className='border-t border-divider my-1' />
                )}

                {/* Task Lists */}
                {taskLists.map(taskList => (
                  <div
                    key={taskList.id}
                    className={`
                      group flex items-center w-full transition-all duration-200 ease-in-out
                      hover:bg-content2/80 hover:backdrop-blur-sm
                      ${
                        currentSelection.type === 'specific' &&
                        currentSelection.taskListId === taskList.id
                          ? 'bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border-l-2 border-primary-500 shadow-sm'
                          : ''
                      }
                      ${isProcessing ? 'opacity-50' : ''}
                    `}
                    onMouseEnter={() => setHoveredTaskListId(taskList.id)}
                    onMouseLeave={() => setHoveredTaskListId(null)}
                  >
                    <button
                      onClick={() => handleSelectTaskList(taskList.id)}
                      disabled={isProcessing}
                      className={`
                        flex-1 flex items-center gap-3 px-3 py-2 text-left text-sm
                        transition-colors duration-200
                        ${
                          currentSelection.type === 'specific' &&
                          currentSelection.taskListId === taskList.id
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-foreground'
                        }
                      `}
                    >
                      <List
                        className={`w-4 h-4 transition-colors duration-200 ${
                          currentSelection.type === 'specific' &&
                          currentSelection.taskListId === taskList.id
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-default-500'
                        }`}
                      />
                      <span className='font-medium truncate'>
                        {taskList.name}
                      </span>
                      {taskList.isDefault && (
                        <span className='text-xs text-default-400 ml-auto px-2 py-0.5 bg-default-100 dark:bg-default-800 rounded-full'>
                          {t('taskList.default')}
                        </span>
                      )}
                    </button>

                    {/* Inline Actions - Only show for non-default task lists */}
                    {!taskList.isDefault && (
                      <div
                        className={`flex items-center gap-0.5 pr-2 transition-opacity duration-200 ${hoveredTaskListId === taskList.id && !isProcessing ? 'opacity-100' : 'opacity-0'}`}
                      >
                        <button
                          onClick={e =>
                            handleEditSpecific(taskList.id, taskList.name, e)
                          }
                          className={`p-1 transition-all duration-150 rounded ${
                            currentSelection.type === 'specific' &&
                            currentSelection.taskListId === taskList.id
                              ? 'text-primary-600 hover:text-primary-700 hover:bg-primary-100 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-primary-900/30'
                              : 'text-default-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                          }`}
                          title={t('common.edit')}
                        >
                          <Edit3 className='w-3 h-3' />
                        </button>
                        <button
                          onClick={e => handleDeleteSpecific(taskList.id, e)}
                          className={`p-1 transition-all duration-150 rounded ${
                            currentSelection.type === 'specific' &&
                            currentSelection.taskListId === taskList.id
                              ? 'text-danger-600 hover:text-danger-700 hover:bg-danger-100 dark:text-danger-400 dark:hover:text-danger-300 dark:hover:bg-danger-900/30'
                              : 'text-default-400 hover:text-danger hover:bg-danger-50 dark:hover:bg-danger-900/20'
                          }`}
                          title={t('common.delete')}
                        >
                          <Trash2 className='w-3 h-3' />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Separator */}
                <div className='border-t border-divider my-1' />

                {/* Management Actions */}
                <div className='p-1'>
                  {/* Create New */}
                  <button
                    onClick={handleCreateNew}
                    disabled={isProcessing}
                    className={`
                      w-full flex items-center gap-3 px-2 py-2 text-left text-sm
                      text-foreground hover:bg-content2 rounded transition-colors
                      ${isProcessing ? 'opacity-50' : ''}
                    `}
                  >
                    <Plus className='w-4 h-4' />
                    <span>{t('taskList.createNew')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTaskListToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t('taskList.deleteConfirmTitle')}
        message={t('taskList.deleteConfirmMessage', {
          name: (() => {
            if (taskListToDelete) {
              const taskList = taskLists.find(tl => tl.id === taskListToDelete);
              return taskList?.name || '';
            }
            return currentSelection.type === 'specific' &&
              currentSelection.taskList
              ? currentSelection.taskList.name
              : '';
          })(),
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant='danger'
        isLoading={isProcessing}
      />
    </>
  );
};
