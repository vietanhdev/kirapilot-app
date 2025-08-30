import React from 'react';
import { Button, Tooltip } from '@heroui/react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  tooltip,
  onClick,
  variant = 'primary',
  size = 'sm',
  isLoading = false,
  isDisabled = false,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-success-500 hover:bg-success-600 text-white';
      case 'warning':
        return 'bg-warning-500 hover:bg-warning-600 text-white';
      case 'danger':
        return 'bg-danger-500 hover:bg-danger-600 text-white';
      case 'secondary':
        return 'bg-content3 hover:bg-content4 text-foreground border border-divider';
      case 'primary':
      default:
        return 'bg-primary-500 hover:bg-primary-600 text-white';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'lg':
        return 'px-4 py-2 text-sm min-h-10';
      case 'md':
        return 'px-3 py-1.5 text-sm min-h-8';
      case 'sm':
      default:
        return 'px-2 py-1 text-xs min-h-6';
    }
  };

  const button = (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className='inline-block'
    >
      <Button
        size={size}
        onPress={onClick}
        isLoading={isLoading}
        isDisabled={isDisabled}
        className={`
          ${getVariantStyles()}
          ${getSizeStyles()}
          font-medium rounded-lg shadow-sm transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-1.5
          ${className}
        `}
        startContent={!isLoading ? <Icon className='w-3 h-3' /> : undefined}
      >
        {label}
      </Button>
    </motion.div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement='top' delay={500}>
        {button}
      </Tooltip>
    );
  }

  return button;
};
