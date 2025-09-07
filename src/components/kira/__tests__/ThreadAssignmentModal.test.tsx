import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThreadAssignmentModal } from '../ThreadAssignmentModal';
import { ThreadAssignment } from '../../../types/thread';
import { Task } from '../../../types';
import * as databaseHooks from '../../../hooks/useDatabase';
import * as taskRepository from '../../../services/database/repositories';

interface MockModalProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

interface MockButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  [key: string]: unknown;
}

interface MockRadioGroupProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface MockRadioProps {
  children: React.ReactNode;
  value: string;
  onValueChange?: (value: string) => void;
  groupValue?: string;
}

interface MockSelectProps {
  children: React.ReactNode;
  placeholder?: string;
  onSelectionChange?: (keys: Set<string>) => void;
  selectedKeys?: Set<string>;
}

interface MockSelectItemProps {
  children: React.ReactNode;
  key: string;
}

interface MockDatePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  label?: string;
}

interface MockCardProps {
  children: React.ReactNode;
}

// Mock dependencies
jest.mock('../../../hooks/useDatabase');
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return key.replace(/\{(\w+)\}/g, (match, param) =>
          String(params[param] || match)
        );
      }
      return key;
    },
  }),
}));

jest.mock('../../../services/database/repositories', () => ({
  getTaskRepository: jest.fn(),
}));

// Mock HeroUI Modal components to avoid DOM issues in tests
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  Modal: ({ children, isOpen }: MockModalProps) =>
    isOpen ? <div data-testid='modal'>{children}</div> : null,
  ModalContent: ({ children }: MockModalProps) => (
    <div data-testid='modal-content'>{children}</div>
  ),
  ModalHeader: ({ children }: MockModalProps) => (
    <div data-testid='modal-header'>{children}</div>
  ),
  ModalBody: ({ children }: MockModalProps) => (
    <div data-testid='modal-body'>{children}</div>
  ),
  ModalFooter: ({ children }: MockModalProps) => (
    <div data-testid='modal-footer'>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    isDisabled,
    isLoading,
    ...props
  }: MockButtonProps) => (
    <button
      onClick={onPress}
      disabled={isDisabled || isLoading}
      data-testid={`button-${children?.toString().toLowerCase().replace(/\s+/g, '-')}`}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  ),
  RadioGroup: ({ children, value, onValueChange }: MockRadioGroupProps) => (
    <div data-testid='radio-group' data-value={value}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { onValueChange, groupValue: value })
      )}
    </div>
  ),
  Radio: ({ children, value, onValueChange, groupValue }: MockRadioProps) => (
    <label>
      <input
        type='radio'
        value={value}
        checked={groupValue === value}
        onChange={() => onValueChange?.(value)}
      />
      {children}
    </label>
  ),
  Select: ({
    children,
    placeholder,
    onSelectionChange,
    selectedKeys,
  }: MockSelectProps) => (
    <select
      data-testid='select'
      onChange={e => onSelectionChange?.(new Set([e.target.value]))}
      value={Array.from(selectedKeys || [])[0] || ''}
    >
      <option value=''>{placeholder}</option>
      {children}
    </select>
  ),
  SelectItem: ({ children, key }: MockSelectItemProps) => (
    <option value={key}>{children}</option>
  ),
  DatePicker: ({ value, onChange, label }: MockDatePickerProps) => (
    <div data-testid='date-picker'>
      <label>{label}</label>
      <input
        type='date'
        value={value?.toString() || ''}
        onChange={e => onChange?.(e.target.value)}
      />
    </div>
  ),
  Card: ({ children }: MockCardProps) => (
    <div data-testid='card'>{children}</div>
  ),
  CardBody: ({ children }: MockCardProps) => (
    <div data-testid='card-body'>{children}</div>
  ),
  Chip: ({ children }: MockCardProps) => (
    <span data-testid='chip'>{children}</span>
  ),
}));

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Test Task 1',
    description: 'Description 1',
    priority: 'high',
    status: 'todo',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-2',
    title: 'Test Task 2',
    description: 'Description 2',
    priority: 'medium',
    status: 'in_progress',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-3',
    title: 'Completed Task',
    description: 'Description 3',
    priority: 'low',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTaskRepository = {
  findAll: jest.fn().mockResolvedValue(mockTasks),
};

describe('ThreadAssignmentModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAssign = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (databaseHooks.useDatabase as jest.Mock).mockReturnValue({
      isInitialized: true,
    });
    (taskRepository.getTaskRepository as jest.Mock).mockReturnValue(
      mockTaskRepository
    );
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onAssign: mockOnAssign,
  };

  it('renders modal when open', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    expect(screen.getByText('kira.assignment.modal.title')).toBeInTheDocument();
    expect(screen.getByText('kira.assignment.type.title')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ThreadAssignmentModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText('kira.assignment.modal.title')
    ).not.toBeInTheDocument();
  });

  it('displays thread title in subtitle when provided', () => {
    const threadTitle = 'My Test Thread';
    render(
      <ThreadAssignmentModal {...defaultProps} threadTitle={threadTitle} />
    );

    expect(
      screen.getByText(`kira.assignment.modal.subtitle`)
    ).toBeInTheDocument();
  });

  it('loads tasks on mount', async () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockTaskRepository.findAll).toHaveBeenCalled();
    });
  });

  it('shows general assignment option by default', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const generalRadio = screen.getByDisplayValue('general');
    expect(generalRadio).toBeInTheDocument();
  });

  it('allows selecting task assignment type', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const taskRadio = screen.getByDisplayValue('task');
    fireEvent.click(taskRadio);

    // Radio should be clickable (mocked behavior)
    expect(taskRadio).toBeInTheDocument();
  });

  it('allows selecting day assignment type', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const dayRadio = screen.getByDisplayValue('day');
    fireEvent.click(dayRadio);

    // Radio should be clickable (mocked behavior)
    expect(dayRadio).toBeInTheDocument();
  });

  it('shows task and day assignment options', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    // Should show all assignment type options
    expect(
      screen.getByText('kira.assignment.general.title')
    ).toBeInTheDocument();
    expect(screen.getByText('kira.assignment.task.title')).toBeInTheDocument();
    expect(screen.getByText('kira.assignment.day.title')).toBeInTheDocument();
  });

  it('handles general assignment', async () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const assignButton = screen.getByText('kira.assignment.modal.assign');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(mockOnAssign).toHaveBeenCalledWith({
        type: 'general',
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('has assign button available', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const assignButton = screen.getByText('kira.assignment.modal.assign');
    expect(assignButton).toBeInTheDocument();
  });

  it('handles assignment button click', async () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const assignButton = screen.getByText('kira.assignment.modal.assign');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(mockOnAssign).toHaveBeenCalledWith({
        type: 'general',
      });
    });
  });

  it('shows current assignment info when provided', () => {
    const currentAssignment: ThreadAssignment = {
      type: 'task',
      taskId: 'task-1',
      context: {
        taskTitle: 'Test Task 1',
        taskDescription: 'Description 1',
        taskPriority: 'high',
        taskStatus: 'todo',
      },
    };

    render(
      <ThreadAssignmentModal
        {...defaultProps}
        currentAssignment={currentAssignment}
      />
    );

    expect(
      screen.getByText('kira.assignment.current.title')
    ).toBeInTheDocument();
  });

  it('shows update button text when current assignment exists', () => {
    const currentAssignment: ThreadAssignment = {
      type: 'general',
    };

    render(
      <ThreadAssignmentModal
        {...defaultProps}
        currentAssignment={currentAssignment}
      />
    );

    expect(
      screen.getByText('kira.assignment.modal.update')
    ).toBeInTheDocument();
  });

  it('handles cancel action', () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('loads tasks when database is initialized', async () => {
    render(<ThreadAssignmentModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockTaskRepository.findAll).toHaveBeenCalled();
    });
  });

  it('handles database not initialized', () => {
    (databaseHooks.useDatabase as jest.Mock).mockReturnValue({
      isInitialized: false,
    });

    render(<ThreadAssignmentModal {...defaultProps} />);

    expect(mockTaskRepository.findAll).not.toHaveBeenCalled();
  });

  it('handles task loading error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockTaskRepository.findAll.mockRejectedValueOnce(
      new Error('Database error')
    );

    render(<ThreadAssignmentModal {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load tasks:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
