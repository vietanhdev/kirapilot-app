import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartConfirmationDialog } from '../SmartConfirmationDialog';
import {
  AIActionPreview,
  AlternativeAction,
} from '../../../types/aiConfirmation';

// Mock HeroUI components
jest.mock('@heroui/react', () => ({
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
    <div data-testid='modal-header'>{children}</div>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-body'>{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='modal-footer'>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    disabled,
    isLoading,
    ...props
  }: React.PropsWithChildren<
    {
      onPress?: () => void;
      disabled?: boolean;
      isLoading?: boolean;
      'data-testid'?: string;
    } & Record<string, unknown>
  >) => (
    <button
      onClick={onPress}
      disabled={disabled || isLoading}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  ),
  Card: ({
    children,
    onPress,
    isPressable,
  }: React.PropsWithChildren<{
    onPress?: () => void;
    isPressable?: boolean;
  }>) => (
    <div onClick={isPressable ? onPress : undefined} data-testid='card'>
      {children}
    </div>
  ),
  CardBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Chip: ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span data-testid='chip' data-color={color}>
      {children}
    </span>
  ),
  Divider: () => <hr data-testid='divider' />,
  Accordion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='accordion'>{children}</div>
  ),
  AccordionItem: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div data-testid='accordion-item'>
      <div data-testid='accordion-title'>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

describe('SmartConfirmationDialog', () => {
  const mockPreview: AIActionPreview = {
    title: 'Delete Task',
    description: 'This will permanently delete the selected task',
    changes: [
      {
        type: 'delete',
        target: 'Task: Test Task',
        description: 'Delete test task permanently',
      },
    ],
    impact: 'high',
    reversible: false,
  };

  const mockAlternatives: AlternativeAction[] = [
    {
      id: 'archive',
      label: 'Archive Instead',
      description: 'Archive the task instead of deleting',
      action: jest.fn(),
    },
    {
      id: 'complete',
      label: 'Mark Complete',
      description: 'Mark the task as completed',
      action: jest.fn(),
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    preview: mockPreview,
    alternatives: [],
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the dialog when open', () => {
    render(<SmartConfirmationDialog {...defaultProps} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Delete Task')).toBeInTheDocument();
    expect(
      screen.getByText('This will permanently delete the selected task')
    ).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<SmartConfirmationDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should display impact level with correct color', () => {
    render(<SmartConfirmationDialog {...defaultProps} />);

    const chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('High Impact');
    expect(chip).toHaveAttribute('data-color', 'danger');
  });

  it('should display changes preview', () => {
    render(<SmartConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Proposed Changes (1)')).toBeInTheDocument();
    expect(
      screen.getByText('Delete test task permanently')
    ).toBeInTheDocument();
    expect(screen.getByText('Task: Test Task')).toBeInTheDocument();
  });

  it('should show reversibility information', () => {
    render(<SmartConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Permanent Action')).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone. Please review carefully.')
    ).toBeInTheDocument();
  });

  it('should show reversible action info when reversible', () => {
    const reversiblePreview = { ...mockPreview, reversible: true };
    render(
      <SmartConfirmationDialog {...defaultProps} preview={reversiblePreview} />
    );

    expect(screen.getByText('Reversible Action')).toBeInTheDocument();
    expect(
      screen.getByText('This action can be undone if needed.')
    ).toBeInTheDocument();
  });

  it('should display alternatives when provided', () => {
    render(
      <SmartConfirmationDialog
        {...defaultProps}
        alternatives={mockAlternatives}
      />
    );

    expect(screen.getByText('Alternative Actions (2)')).toBeInTheDocument();
    expect(screen.getByText('Archive Instead')).toBeInTheDocument();
    expect(screen.getByText('Mark Complete')).toBeInTheDocument();
  });

  it('should handle confirm action', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <SmartConfirmationDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    const confirmButton = screen.getByText('Confirm Action');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should handle cancel action', () => {
    const onCancel = jest.fn();
    const onClose = jest.fn();

    render(
      <SmartConfirmationDialog
        {...defaultProps}
        onCancel={onCancel}
        onClose={onClose}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should handle alternative selection', async () => {
    const mockAlternativeAction = jest.fn().mockResolvedValue(undefined);
    const alternativesWithAction = [
      {
        ...mockAlternatives[0],
        action: mockAlternativeAction,
      },
    ];
    const onClose = jest.fn();

    render(
      <SmartConfirmationDialog
        {...defaultProps}
        alternatives={alternativesWithAction}
        onClose={onClose}
      />
    );

    // Select alternative - need to find the right card (not the reversibility card)
    const alternativeCards = screen.getAllByTestId('card');
    const alternativeCard = alternativeCards.find(card =>
      card.textContent?.includes('Archive Instead')
    );
    expect(alternativeCard).toBeTruthy();
    fireEvent.click(alternativeCard!);

    // Confirm with alternative - use getAllByText and find the button
    const confirmButtons = screen.getAllByText('Archive Instead');
    const confirmButton = confirmButtons.find(
      button => button.tagName === 'BUTTON'
    );
    expect(confirmButton).toBeTruthy();
    fireEvent.click(confirmButton!);

    await waitFor(() => {
      expect(mockAlternativeAction).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should show loading state', () => {
    render(<SmartConfirmationDialog {...defaultProps} loading={true} />);

    const confirmButton = screen.getByText('Loading...');
    expect(confirmButton).toBeDisabled();

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
  });

  it('should display different impact levels correctly', () => {
    const lowImpactPreview = { ...mockPreview, impact: 'low' as const };
    const { rerender } = render(
      <SmartConfirmationDialog {...defaultProps} preview={lowImpactPreview} />
    );

    let chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('Low Impact');
    expect(chip).toHaveAttribute('data-color', 'success');

    const mediumImpactPreview = { ...mockPreview, impact: 'medium' as const };
    rerender(
      <SmartConfirmationDialog
        {...defaultProps}
        preview={mediumImpactPreview}
      />
    );

    chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('Medium Impact');
    expect(chip).toHaveAttribute('data-color', 'warning');

    const criticalImpactPreview = {
      ...mockPreview,
      impact: 'critical' as const,
    };
    rerender(
      <SmartConfirmationDialog
        {...defaultProps}
        preview={criticalImpactPreview}
      />
    );

    chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('Critical Impact');
    expect(chip).toHaveAttribute('data-color', 'danger');
  });

  it('should display field changes with old and new values', () => {
    const previewWithFieldChange: AIActionPreview = {
      ...mockPreview,
      changes: [
        {
          type: 'update',
          target: 'Task: Test Task',
          field: 'priority',
          oldValue: 'low',
          newValue: 'high',
          description: 'Update task priority',
        },
      ],
    };

    render(
      <SmartConfirmationDialog
        {...defaultProps}
        preview={previewWithFieldChange}
      />
    );

    expect(screen.getByText('priority:')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });
});
