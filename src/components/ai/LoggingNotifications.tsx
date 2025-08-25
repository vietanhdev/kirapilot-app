import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, Button } from '@heroui/react';
import { CheckCircle2, AlertTriangle, X, HelpCircle } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { useLoggingStatus } from '../../contexts/LoggingStatusContext';
import { useNavigation } from '../../contexts/NavigationContext';

interface LoggingNotificationsProps {
  className?: string;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const LoggingNotifications: React.FC<LoggingNotificationsProps> = ({
  className = '',
  position = 'top-right',
  autoHide = true,
  autoHideDelay = 5000,
}) => {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { recentOperations, clearRecentOperations } = useLoggingStatus();

  // Auto-hide successful operations
  useEffect(() => {
    if (!autoHide) {
      return;
    }

    const successOperations = recentOperations.filter(
      op => op.status === 'success'
    );
    if (successOperations.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      clearRecentOperations();
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [recentOperations, autoHide, autoHideDelay, clearRecentOperations]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  const getNotificationIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className='w-4 h-4 text-success-500' />;
      case 'error':
        return <AlertTriangle className='w-4 h-4 text-danger-500' />;
      default:
        return null;
    }
  };

  const getNotificationColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-success-200 bg-success-50 dark:bg-success-900/20 dark:border-success-800';
      case 'error':
        return 'border-danger-200 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-800';
      default:
        return 'border-default-200 bg-default-50 dark:bg-default-900/20 dark:border-default-800';
    }
  };

  const handleTroubleshooting = () => {
    navigateTo('settings', { tab: 'ai', section: 'logging' });
  };

  const dismissNotification = (_operationId: string) => {
    // Remove specific operation from recent operations
    // This would need to be implemented in the context
    clearRecentOperations();
  };

  // Only show recent operations that should be displayed as notifications
  const notificationOperations = recentOperations.filter(
    op => op.status === 'success' || op.status === 'error'
  );

  if (notificationOperations.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed ${getPositionClasses()} z-50 space-y-2 max-w-sm ${className}`}
    >
      <AnimatePresence>
        {notificationOperations.map(operation => (
          <motion.div
            key={operation.id}
            initial={{
              opacity: 0,
              x: position.includes('right') ? 100 : -100,
              scale: 0.95,
            }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: position.includes('right') ? 100 : -100,
              scale: 0.95,
            }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className={`shadow-lg border ${getNotificationColor(operation.status)}`}
            >
              <CardBody className='p-3'>
                <div className='flex items-start gap-3'>
                  {getNotificationIcon(operation.status)}

                  <div className='flex-1 min-w-0'>
                    <div className='text-sm font-medium text-foreground'>
                      {operation.status === 'success'
                        ? t('ai.logging.captureSuccess')
                        : t('ai.logging.captureError', {
                            error: operation.message || 'Unknown error',
                          })}
                    </div>

                    {operation.status === 'error' && (
                      <div className='mt-1 text-xs text-foreground-600'>
                        {t('ai.logging.troubleshootingTips')}
                      </div>
                    )}

                    <div className='text-xs text-foreground-500 mt-1'>
                      {operation.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className='flex items-center gap-1'>
                    {operation.status === 'error' && (
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={handleTroubleshooting}
                        className='text-foreground-600 hover:text-foreground'
                      >
                        <HelpCircle className='w-3 h-3' />
                      </Button>
                    )}

                    <Button
                      isIconOnly
                      size='sm'
                      variant='light'
                      onPress={() => dismissNotification(operation.id)}
                      className='text-foreground-600 hover:text-foreground'
                    >
                      <X className='w-3 h-3' />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
