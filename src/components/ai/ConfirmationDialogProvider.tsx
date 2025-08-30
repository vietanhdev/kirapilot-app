import React from 'react';
import { SmartConfirmationDialog } from './SmartConfirmationDialog';
import { useConfirmationDialog } from '../../hooks/useConfirmationDialog';
import { ConfirmationService } from '../../services/ai/ConfirmationService';

interface ConfirmationDialogProviderProps {
  children: React.ReactNode;
}

export const ConfirmationDialogProvider: React.FC<
  ConfirmationDialogProviderProps
> = ({ children }) => {
  const { isOpen, options, loading, onConfirm, onCancel, onClose } =
    useConfirmationDialog();

  if (!options) {
    return <>{children}</>;
  }

  const confirmationService = ConfirmationService.getInstance();
  const preview = confirmationService.createActionPreview(
    options.title,
    options.description,
    options.changes,
    options.reversible
  );

  return (
    <>
      {children}
      <SmartConfirmationDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        onCancel={onCancel}
        preview={preview}
        alternatives={options.alternatives}
        loading={loading}
      />
    </>
  );
};
