import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PeriodicTaskList } from '../PeriodicTaskList';
import { PeriodicTaskTemplate, Priority, RecurrenceType } from '../../../types';

// Mock the PeriodicTaskService
jest.mock(
  '../../../services/database/repositories/PeriodicTaskService',
  () => ({
    PeriodicTaskService: jest.fn().mockImplementation(() => ({
      findAllTemplates: jest.fn(),
      countTemplateInstances: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
    })),
  })
);

// Mock the error handling service
jest.mock('../../../services/errorHandling/ErrorHandlingService', () => ({
  errorHandlingService: {
    executeDatabaseOperation: jest.fn(operation => operation()),
    processError: jest.fn(error => error),
    getUserMessage: jest.fn(error => error.message || 'An error occurred'),
  },
}));

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock HeroUI components
jest.mock('@heroui/react', () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  CardBody: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Button: ({
    children,
    onPress,
    isLoading,
    isDisabled,
    ...props
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    isLoading?: boolean;
    isDisabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onPress} disabled={isLoading || isDisabled} {...props}>
      {children}
    </button>
  ),
  Chip: ({
    children,
    startContent,
  }: {
    children: React.ReactNode;
    startContent?: React.ReactNode;
  }) => (
    <span>
      {startContent}
      {children}
    </span>
  ),
  Tooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: string;
  }) => <div title={content}>{children}</div>,
  Spinner: () => <div data-testid='spinner'>Loading...</div>,
  Dropdown: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownItem: ({
    children,
    onPress,
    startContent,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    startContent?: React.ReactNode;
  }) => (
    <button onClick={onPress}>
      {startContent}
      {children}
    </button>
  ),
}));

// Mock the ConfirmationDialog
jest.mock('../../common/ConfirmationDialog', () => ({
  ConfirmationDialog: ({
    isOpen,
    onConfirm,
    title,
    message,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
    message: string;
  }) =>
    isOpen ? (
      <div data-testid='confirmation-dialog'>
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
}));

// Mock the ErrorDisplay
jest.mock('../../common/ErrorDisplay', () => ({
  ErrorDisplay: ({
    error,
    onRetry,
  }: {
    error: string;
    onRetry?: () => void;
  }) => (
    <div data-testid='error-display'>
      <p>{error}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
  ErrorType: {
    UNKNOWN: 'unknown',
    VALIDATION: 'validation',
    NETWORK: 'network',
    DATABASE: 'database',
  },
  categorizeError: jest.fn(() => 'unknown'),
  isErrorRecoverable: jest.fn(() => true),
}));

const mockTemplate: PeriodicTaskTemplate = {
  id: 'template-1',
  title: 'Daily Standup',
  description: 'Daily team standup meeting',
  priority: Priority.MEDIUM,
  timeEstimate: 30,
  tags: ['meeting', 'team'],
  taskListId: 'list-1',
  recurrenceType: RecurrenceType.DAILY,
  recurrenceInterval: 1,
  startDate: new Date('2024-01-01'),
  nextGenerationDate: new Date('2024-01-02'),
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPeriodicTaskService = {
  findAllTemplates: jest.fn(),
  countTemplateInstances: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
};

describe('PeriodicTaskList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([mockTemplate]);
    mockPeriodicTaskService.countTemplateInstances.mockResolvedValue(5);
    mockPeriodicTaskService.updateTemplate.mockResolvedValue({
      ...mockTemplate,
      isActive: false,
    });
    mockPeriodicTaskService.deleteTemplate.mockResolvedValue(undefined);

    // Mock the service constructor
    const {
      PeriodicTaskService,
    } = require('../../../services/database/repositories/PeriodicTaskService');
    PeriodicTaskService.mockImplementation(() => mockPeriodicTaskService);
  });

  it('renders loading state initially', () => {
    render(<PeriodicTaskList />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading periodic tasks...')).toBeInTheDocument();
  });

  it('renders empty state when no templates exist', async () => {
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([]);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('No Periodic Tasks')).toBeInTheDocument();
      expect(
        screen.getByText(/Create your first periodic task template/)
      ).toBeInTheDocument();
    });
  });

  it('renders template list with correct information', async () => {
    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      expect(
        screen.getByText('Daily team standup meeting')
      ).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('5 instances')).toBeInTheDocument();
      expect(screen.getByText('meeting')).toBeInTheDocument();
      expect(screen.getByText('team')).toBeInTheDocument();
    });
  });

  it('shows paused status for inactive templates', async () => {
    const inactiveTemplate = { ...mockTemplate, isActive: false };
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([
      inactiveTemplate,
    ]);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });

  it('handles template status toggle', async () => {
    const onTemplateUpdated = jest.fn();
    render(<PeriodicTaskList onTemplateUpdated={onTemplateUpdated} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Find and click the pause button (should be a button with title "Pause template")
    const pauseButton = screen
      .getByTitle('Pause template')
      .querySelector('button');
    fireEvent.click(pauseButton!);

    await waitFor(() => {
      expect(mockPeriodicTaskService.updateTemplate).toHaveBeenCalledWith(
        'template-1',
        {
          isActive: false,
        }
      );
      expect(onTemplateUpdated).toHaveBeenCalled();
    });
  });

  it('handles template editing', async () => {
    const onEditTemplate = jest.fn();
    render(<PeriodicTaskList onEditTemplate={onEditTemplate} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Click the edit button in dropdown
    const editButton = screen.getByText('Edit Template');
    fireEvent.click(editButton);

    expect(onEditTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'template-1',
        title: 'Daily Standup',
      })
    );
  });

  it('shows delete confirmation dialog', async () => {
    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Click the delete button in dropdown
    const deleteButton = screen.getByText('Delete Template');
    fireEvent.click(deleteButton);

    expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Delete Periodic Task Template')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete "Daily Standup"/)
    ).toBeInTheDocument();
  });

  it('handles template deletion', async () => {
    const onTemplateDeleted = jest.fn();
    render(<PeriodicTaskList onTemplateDeleted={onTemplateDeleted} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Click delete button to open dialog
    const deleteButton = screen.getByText('Delete Template');
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockPeriodicTaskService.deleteTemplate).toHaveBeenCalledWith(
        'template-1'
      );
      expect(onTemplateDeleted).toHaveBeenCalledWith('template-1');
    });
  });

  it('shows different recurrence patterns correctly', async () => {
    const templates = [
      {
        ...mockTemplate,
        id: '1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 2,
      },
      { ...mockTemplate, id: '2', recurrenceType: RecurrenceType.WEEKLY },
      { ...mockTemplate, id: '3', recurrenceType: RecurrenceType.BIWEEKLY },
      {
        ...mockTemplate,
        id: '4',
        recurrenceType: RecurrenceType.MONTHLY,
        recurrenceInterval: 3,
      },
      {
        ...mockTemplate,
        id: '5',
        recurrenceType: RecurrenceType.CUSTOM,
        recurrenceInterval: 5,
        recurrenceUnit: 'days' as const,
      },
    ];
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue(templates);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Every 2 days')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Biweekly')).toBeInTheDocument();
      expect(screen.getByText('Every 3 months')).toBeInTheDocument();
      expect(screen.getByText('Every 5 days')).toBeInTheDocument();
    });
  });

  it('handles error state with retry functionality', async () => {
    const error = new Error('Database connection failed');
    mockPeriodicTaskService.findAllTemplates.mockRejectedValue(error);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
      expect(
        screen.getByText('Database connection failed')
      ).toBeInTheDocument();
    });

    // Test retry functionality
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([mockTemplate]);
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });
  });

  it('handles refresh functionality', async () => {
    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Clear the mock and set new data
    mockPeriodicTaskService.findAllTemplates.mockClear();
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([
      { ...mockTemplate, title: 'Updated Template' },
    ]);

    // Click refresh button
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockPeriodicTaskService.findAllTemplates).toHaveBeenCalledTimes(1);
    });
  });

  it('shows correct priority indicators', async () => {
    const templates = [
      { ...mockTemplate, id: '1', priority: Priority.LOW },
      { ...mockTemplate, id: '2', priority: Priority.HIGH },
      { ...mockTemplate, id: '3', priority: Priority.URGENT },
    ];
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue(templates);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('low')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });
  });

  it('handles templates without description and tags', async () => {
    const minimalTemplate = {
      ...mockTemplate,
      description: '',
      tags: [],
    };
    mockPeriodicTaskService.findAllTemplates.mockResolvedValue([
      minimalTemplate,
    ]);

    render(<PeriodicTaskList />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      // Description and tags should not be rendered
      expect(
        screen.queryByText('Daily team standup meeting')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('meeting')).not.toBeInTheDocument();
    });
  });
});
