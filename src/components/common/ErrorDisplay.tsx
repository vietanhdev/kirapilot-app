import { Button } from '@heroui/react';
import {
  AlertCircle,
  RefreshCw,
  Wifi,
  Database,
  AlertTriangle,
} from 'lucide-react';

export enum ErrorType {
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export interface ErrorDisplayProps {
  error: string | null;
  type?: ErrorType;
  recoverable?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'modal' | 'toast';
}

const ERROR_ICONS = {
  [ErrorType.VALIDATION]: AlertTriangle,
  [ErrorType.DATABASE]: Database,
  [ErrorType.NETWORK]: Wifi,
  [ErrorType.UNKNOWN]: AlertCircle,
};

const ERROR_COLORS = {
  [ErrorType.VALIDATION]: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    text: 'text-warning-700',
    icon: 'text-warning-600',
  },
  [ErrorType.DATABASE]: {
    bg: 'bg-danger-50',
    border: 'border-danger-200',
    text: 'text-danger-700',
    icon: 'text-danger-600',
  },
  [ErrorType.NETWORK]: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    text: 'text-primary-700',
    icon: 'text-primary-600',
  },
  [ErrorType.UNKNOWN]: {
    bg: 'bg-danger-50',
    border: 'border-danger-200',
    text: 'text-danger-700',
    icon: 'text-danger-600',
  },
};

const SIZE_CLASSES = {
  sm: {
    container: 'p-2',
    text: 'text-xs',
    icon: 'w-3 h-3',
    button: 'text-xs px-2 py-1',
  },
  md: {
    container: 'p-3',
    text: 'text-sm',
    icon: 'w-4 h-4',
    button: 'text-sm px-3 py-1.5',
  },
  lg: {
    container: 'p-4',
    text: 'text-base',
    icon: 'w-5 h-5',
    button: 'text-sm px-4 py-2',
  },
};

export function ErrorDisplay({
  error,
  type = ErrorType.UNKNOWN,
  recoverable = false,
  onRetry,
  onDismiss,
  className = '',
  size = 'md',
  variant = 'inline',
}: ErrorDisplayProps) {
  if (!error) {
    return null;
  }

  const IconComponent = ERROR_ICONS[type];
  const colors = ERROR_COLORS[type];
  const sizeClasses = SIZE_CLASSES[size];

  const baseClasses = `
    rounded-lg border flex items-start gap-2
    ${colors.bg} ${colors.border}
    ${sizeClasses.container}
    ${className}
  `.trim();

  const getVariantClasses = () => {
    switch (variant) {
      case 'modal':
        return 'shadow-md';
      case 'toast':
        return 'shadow-lg';
      case 'inline':
      default:
        return '';
    }
  };

  return (
    <div className={`${baseClasses} ${getVariantClasses()}`}>
      <IconComponent
        className={`${sizeClasses.icon} ${colors.icon} flex-shrink-0 mt-0.5`}
      />

      <div className='flex-1 min-w-0'>
        <div className={`${sizeClasses.text} ${colors.text} font-medium`}>
          {error}
        </div>

        {(recoverable || onDismiss) && (
          <div className='flex items-center gap-2 mt-2'>
            {recoverable && onRetry && (
              <Button
                size='sm'
                variant='flat'
                color={type === ErrorType.VALIDATION ? 'warning' : 'danger'}
                onPress={onRetry}
                startContent={<RefreshCw className='w-3 h-3' />}
                className={sizeClasses.button}
              >
                Retry
              </Button>
            )}

            {onDismiss && (
              <Button
                size='sm'
                variant='light'
                color='default'
                onPress={onDismiss}
                className={sizeClasses.button}
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Utility function to categorize errors
export function categorizeError(error: string | Error): ErrorType {
  const errorMessage = error instanceof Error ? error.message : error;
  const lowerMessage = errorMessage.toLowerCase();

  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('empty') ||
    lowerMessage.includes('format')
  ) {
    return ErrorType.VALIDATION;
  }

  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('sql') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('transaction')
  ) {
    return ErrorType.DATABASE;
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('offline')
  ) {
    return ErrorType.NETWORK;
  }

  return ErrorType.UNKNOWN;
}

// Utility function to determine if error is recoverable
export function isErrorRecoverable(error: string | Error): boolean {
  const errorMessage = error instanceof Error ? error.message : error;
  const lowerMessage = errorMessage.toLowerCase();

  // Network and database errors are typically recoverable
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('database')
  ) {
    return true;
  }

  // Validation errors are not recoverable through retry
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('invalid')
  ) {
    return false;
  }

  // Default to not recoverable for safety
  return false;
}
