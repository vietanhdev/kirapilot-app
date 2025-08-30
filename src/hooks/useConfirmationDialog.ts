import { useState, useCallback, useEffect } from 'react';
import { ConfirmationService } from '../services/ai/ConfirmationService';
import {
  SmartConfirmationOptions,
  AlternativeAction,
} from '../types/aiConfirmation';

interface ConfirmationDialogState {
  isOpen: boolean;
  options: SmartConfirmationOptions | null;
  resolve: ((confirmed: boolean) => void) | null;
}

export const useConfirmationDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmationDialogState>({
    isOpen: false,
    options: null,
    resolve: null,
  });
  const [loading, setLoading] = useState(false);

  const showConfirmation = useCallback(
    (options: SmartConfirmationOptions): Promise<boolean> => {
      return new Promise(resolve => {
        setDialogState({
          isOpen: true,
          options,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!dialogState.options || !dialogState.resolve) {
      return;
    }

    setLoading(true);
    try {
      await dialogState.options.onConfirm();
      dialogState.resolve(true);
    } catch (error) {
      console.error('Error executing confirmed action:', error);
      dialogState.resolve(false);
    } finally {
      setLoading(false);
      setDialogState({
        isOpen: false,
        options: null,
        resolve: null,
      });
    }
  }, [dialogState]);

  const handleCancel = useCallback(() => {
    if (!dialogState.resolve) {
      return;
    }

    if (dialogState.options?.onCancel) {
      dialogState.options.onCancel();
    }

    dialogState.resolve(false);
    setDialogState({
      isOpen: false,
      options: null,
      resolve: null,
    });
  }, [dialogState]);

  const closeDialog = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  // Register the confirmation callback with the service
  useEffect(() => {
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setConfirmationCallback(showConfirmation);
  }, [showConfirmation]);

  return {
    isOpen: dialogState.isOpen,
    options: dialogState.options,
    loading,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onClose: closeDialog,
  };
};

export const useSmartConfirmation = () => {
  const confirmationService = ConfirmationService.getInstance();

  const requestConfirmation = useCallback(
    (options: SmartConfirmationOptions): Promise<boolean> => {
      return confirmationService.requestConfirmation(options);
    },
    [confirmationService]
  );

  const createTaskAlternatives = useCallback(
    (taskTitle: string): AlternativeAction[] => [
      {
        id: 'archive',
        label: 'Archive Instead',
        description: `Archive "${taskTitle}" instead of deleting (can be restored later)`,
        action: async () => {
          // This would be implemented by the calling component
          console.log(`Archiving task: ${taskTitle}`);
        },
      },
      {
        id: 'complete',
        label: 'Mark Complete',
        description: `Mark "${taskTitle}" as completed instead of deleting`,
        action: async () => {
          // This would be implemented by the calling component
          console.log(`Completing task: ${taskTitle}`);
        },
      },
    ],
    []
  );

  return {
    requestConfirmation,
    createTaskAlternatives,
    confirmationService,
  };
};
