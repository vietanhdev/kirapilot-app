import React from 'react';
import {
  Chip,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Card,
  CardBody,
} from '@heroui/react';
import {
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Clock,
  Loader2,
  AlertCircle as AlertIcon,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTranslation } from '../../hooks/useTranslation';
import { useLoggingStatus } from '../../contexts/LoggingStatusContext';

interface LoggingStatusIndicatorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showOperations?: boolean;
  variant?: 'minimal' | 'detailed';
}

export const LoggingStatusIndicator: React.FC<LoggingStatusIndicatorProps> = ({
  className = '',
  size = 'sm',
  showText = false,
  showOperations = false,
  variant = 'minimal',
}) => {
  const { t } = useTranslation();
  const {
    config,
    isLoading,
    error,
    activeOperations,
    recentOperations,
    isLoggingEnabled,
    isCapturing,
    lastCaptureTime,
    captureCount,
  } = useLoggingStatus();

  const getStatusInfo = () => {
    if (isLoading) {
      return {
        color: 'default' as const,
        icon: <Database className='w-3 h-3 animate-pulse' />,
        text: t('settings.ai.logging.statusLoading'),
        tooltip: t('settings.ai.logging.statusLoading'),
      };
    }

    if (error || !config) {
      return {
        color: 'danger' as const,
        icon: <AlertTriangle className='w-3 h-3' />,
        text: t('settings.ai.logging.statusError'),
        tooltip: error || t('settings.ai.logging.configLoadError'),
      };
    }

    // Show capturing state if actively capturing
    if (isCapturing) {
      return {
        color: 'primary' as const,
        icon: <Loader2 className='w-3 h-3 animate-spin' />,
        text: t('ai.logging.statusCapturing'),
        tooltip: t('ai.logging.statusCapturing'),
      };
    }

    if (!isLoggingEnabled) {
      return {
        color: 'warning' as const,
        icon: <XCircle className='w-3 h-3' />,
        text: t('settings.ai.logging.statusDisabled'),
        tooltip: t('settings.ai.logging.statusDisabled'),
      };
    }

    return {
      color: 'success' as const,
      icon: <CheckCircle className='w-3 h-3' />,
      text: t('settings.ai.logging.statusActive'),
      tooltip: `${t('settings.ai.logging.statusActive')} (${t(`settings.ai.logging.logLevel.${config.logLevel}`)})`,
    };
  };

  const statusInfo = getStatusInfo();
  const hasActiveOperations = activeOperations.length > 0;
  const hasRecentErrors = recentOperations.some(op => op.status === 'error');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return t('ai.logging.justNow');
    }
    if (minutes < 60) {
      return t('ai.logging.minutesAgo', { count: minutes });
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return t('ai.logging.hoursAgo', { count: hours });
    }

    return formatTime(date);
  };

  const getOperationIcon = (
    operation: (typeof activeOperations)[0] | (typeof recentOperations)[0]
  ) => {
    if (operation.status === 'pending') {
      return <Loader2 className='w-3 h-3 animate-spin text-primary-500' />;
    }
    if (operation.status === 'error') {
      return <AlertIcon className='w-3 h-3 text-danger-500' />;
    }
    return <CheckCircle2 className='w-3 h-3 text-success-500' />;
  };

  const getOperationTypeText = (type: string) => {
    switch (type) {
      case 'capture':
        return t('ai.logging.operationCapture');
      case 'export':
        return t('ai.logging.operationExport');
      case 'clear':
        return t('ai.logging.operationClear');
      case 'cleanup':
        return t('ai.logging.operationCleanup');
      default:
        return type;
    }
  };

  // Enhanced indicator with activity pulse for active operations
  const indicator = (
    <div className='relative'>
      <Chip
        color={statusInfo.color}
        variant='flat'
        size={size}
        startContent={statusInfo.icon}
        className={`${className} ${hasActiveOperations ? 'animate-pulse' : ''}`}
      >
        {showText ? statusInfo.text : null}
      </Chip>

      {/* Activity indicator for active operations */}
      <AnimatePresence>
        {hasActiveOperations && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className='absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-background'
          >
            <div className='w-full h-full bg-primary-500 rounded-full animate-ping' />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error indicator for recent errors */}
      <AnimatePresence>
        {hasRecentErrors && !hasActiveOperations && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className='absolute -top-1 -right-1 w-3 h-3 bg-danger-500 rounded-full border-2 border-background'
          />
        )}
      </AnimatePresence>
    </div>
  );

  if (variant === 'minimal' && !showOperations) {
    return (
      <Tooltip content={statusInfo.tooltip} size='sm'>
        {indicator}
      </Tooltip>
    );
  }

  // Detailed variant with popover showing operations
  return (
    <Popover placement='bottom-end' showArrow>
      <PopoverTrigger>
        <div className='cursor-pointer'>
          <Tooltip content={statusInfo.tooltip} size='sm'>
            {indicator}
          </Tooltip>
        </div>
      </PopoverTrigger>
      <PopoverContent className='p-0 max-w-sm'>
        <Card shadow='none' className='border-none'>
          <CardBody className='p-4'>
            <div className='space-y-3'>
              {/* Status Header */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  {statusInfo.icon}
                  <span className='font-medium text-sm'>{statusInfo.text}</span>
                </div>
                {isLoggingEnabled && (
                  <div className='flex items-center gap-1 text-xs text-foreground-600'>
                    <Activity className='w-3 h-3' />
                    <span>{captureCount}</span>
                  </div>
                )}
              </div>

              {/* Last Capture Time */}
              {isLoggingEnabled && lastCaptureTime && (
                <div className='flex items-center gap-2 text-xs text-foreground-600'>
                  <Clock className='w-3 h-3' />
                  <span>
                    {t('ai.logging.lastCapture')}:{' '}
                    {formatRelativeTime(lastCaptureTime)}
                  </span>
                </div>
              )}

              {/* Active Operations */}
              {activeOperations.length > 0 && (
                <div className='space-y-2'>
                  <div className='text-xs font-medium text-foreground-700'>
                    {t('ai.logging.activeOperations')}
                  </div>
                  {activeOperations.map(operation => (
                    <motion.div
                      key={operation.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className='flex items-center gap-2 text-xs'
                    >
                      {getOperationIcon(operation)}
                      <span className='flex-1'>
                        {getOperationTypeText(operation.type)}
                      </span>
                      {operation.progress !== undefined && (
                        <span className='text-foreground-600'>
                          {operation.progress}%
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Recent Operations */}
              {recentOperations.length > 0 && (
                <div className='space-y-2'>
                  <div className='text-xs font-medium text-foreground-700'>
                    {t('ai.logging.recentOperations')}
                  </div>
                  {recentOperations.slice(0, 3).map(operation => (
                    <motion.div
                      key={operation.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className='flex items-center gap-2 text-xs'
                    >
                      {getOperationIcon(operation)}
                      <span className='flex-1'>
                        {getOperationTypeText(operation.type)}
                      </span>
                      <span className='text-foreground-500 text-xs'>
                        {formatRelativeTime(operation.timestamp)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Error Messages */}
              {error && (
                <div className='p-2 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800'>
                  <div className='flex items-start gap-2'>
                    <AlertTriangle className='w-3 h-3 text-danger-500 mt-0.5 flex-shrink-0' />
                    <span className='text-xs text-danger-700 dark:text-danger-300'>
                      {error}
                    </span>
                  </div>
                </div>
              )}

              {/* Disabled State Message */}
              {!isLoggingEnabled && !error && (
                <div className='p-2 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800'>
                  <div className='flex items-start gap-2'>
                    <XCircle className='w-3 h-3 text-warning-500 mt-0.5 flex-shrink-0' />
                    <span className='text-xs text-warning-700 dark:text-warning-300'>
                      {t('ai.logging.disabledMessage')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
