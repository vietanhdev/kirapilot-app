import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconColor: 'text-red-500',
          confirmColor: 'danger' as const,
        };
      case 'warning':
        return {
          iconColor: 'text-amber-500',
          confirmColor: 'warning' as const,
        };
      default:
        return {
          iconColor: 'text-blue-500',
          confirmColor: 'primary' as const,
        };
    }
  };

  const { iconColor, confirmColor } = getVariantStyles();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='sm'
      backdrop='blur'
      classNames={{
        backdrop: 'bg-black/50',
        base: 'border border-divider',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex items-center gap-3 pb-2'>
          <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
          <span className='text-lg font-semibold'>{title}</span>
        </ModalHeader>
        <ModalBody className='py-4'>
          <p className='text-default-600 leading-relaxed'>{message}</p>
        </ModalBody>
        <ModalFooter className='pt-2'>
          <Button
            variant='light'
            onPress={onClose}
            disabled={isLoading}
            className='font-medium'
          >
            {cancelText}
          </Button>
          <Button
            color={confirmColor}
            onPress={handleConfirm}
            isLoading={isLoading}
            className='font-medium'
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
