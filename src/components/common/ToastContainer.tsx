import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, Button } from '@heroui/react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../hooks/useToast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onHideToast: (id: string) => void;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS = {
  success: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-200 dark:border-success-800',
    text: 'text-success-700 dark:text-success-300',
    icon: 'text-success-600 dark:text-success-400',
  },
  error: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    border: 'border-danger-200 dark:border-danger-800',
    text: 'text-danger-700 dark:text-danger-300',
    icon: 'text-danger-600 dark:text-danger-400',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    border: 'border-warning-200 dark:border-warning-800',
    text: 'text-warning-700 dark:text-warning-300',
    icon: 'text-warning-600 dark:text-warning-400',
  },
  info: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-200 dark:border-primary-800',
    text: 'text-primary-700 dark:text-primary-300',
    icon: 'text-primary-600 dark:text-primary-400',
  },
};

const POSITION_CLASSES = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
};

interface ToastItemProps {
  toast: ToastMessage;
  onHide: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onHide }) => {
  const IconComponent = TOAST_ICONS[toast.type];
  const colors = TOAST_COLORS[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className='mb-2'
    >
      <Card
        className={`
        ${colors.bg} ${colors.border} 
        border shadow-lg backdrop-blur-sm
        min-w-[320px] max-w-[400px]
      `}
      >
        <CardBody className='p-4'>
          <div className='flex items-start gap-3'>
            <IconComponent
              className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`}
            />

            <div className='flex-1 min-w-0'>
              <div className={`font-medium text-sm ${colors.text}`}>
                {toast.title}
              </div>

              {toast.message && (
                <div className={`text-xs mt-1 ${colors.text} opacity-80`}>
                  {toast.message}
                </div>
              )}

              {toast.action && (
                <div className='mt-2'>
                  <Button
                    size='sm'
                    variant='flat'
                    color={
                      toast.type === 'success'
                        ? 'success'
                        : toast.type === 'error'
                          ? 'danger'
                          : toast.type === 'warning'
                            ? 'warning'
                            : 'primary'
                    }
                    onPress={toast.action.onClick}
                    className='text-xs'
                  >
                    {toast.action.label}
                  </Button>
                </div>
              )}
            </div>

            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={() => onHide(toast.id)}
              className={`${colors.text} opacity-60 hover:opacity-100 transition-opacity`}
              aria-label='Close notification'
            >
              <X className='w-4 h-4' />
            </Button>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onHideToast,
  position = 'top-right',
}) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`
      fixed z-[9999] pointer-events-none
      ${POSITION_CLASSES[position]}
    `}
    >
      <div className='pointer-events-auto'>
        <AnimatePresence mode='popLayout'>
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onHide={onHideToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
