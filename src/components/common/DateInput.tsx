import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@heroui/react';
import { Calendar, AlertCircle, X } from 'lucide-react';
import {
  formatDate,
  parseDate,
  getDatePlaceholder,
  DateFormat,
} from '../../utils/dateFormat';

interface DateInputProps {
  label?: string;
  placeholder?: string;
  value?: Date | null;
  onChange: (date: Date | null) => void;
  dateFormat: DateFormat;
  size?: 'sm' | 'md' | 'lg';
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  startContent?: React.ReactNode;
  minDate?: Date;
  maxDate?: Date;
  errorMessage?: string;
  description?: string;
  showValidation?: boolean;
  autoFormat?: boolean;
}

/**
 * Simple date input component without calendar popup
 * Provides smart formatting, validation, and auto-completion
 */
export function DateInput({
  label,
  placeholder,
  value,
  onChange,
  dateFormat,
  size = 'sm',
  isRequired = false,
  isDisabled = false,
  className = '',
  startContent = <Calendar className='w-4 h-4' />,
  minDate,
  maxDate,
  errorMessage,
  description,
  showValidation = true,
  autoFormat = true,
}: DateInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Smart input formatting helper
  const formatInputValue = useCallback(
    (input: string): string => {
      if (!autoFormat) {
        return input;
      }

      // Remove any non-numeric characters except separators
      const cleaned = input.replace(/[^\d\/\-]/g, '');

      // Auto-add separators based on format
      if (dateFormat === 'DD/MM/YYYY' || dateFormat === 'MM/DD/YYYY') {
        if (
          cleaned.length >= 2 &&
          cleaned.length <= 4 &&
          !cleaned.includes('/')
        ) {
          return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
        }
        if (cleaned.length >= 5 && cleaned.split('/').length === 2) {
          const parts = cleaned.split('/');
          return (
            parts[0] + '/' + parts[1].slice(0, 2) + '/' + parts[1].slice(2)
          );
        }
      } else if (dateFormat === 'YYYY-MM-DD') {
        if (
          cleaned.length >= 4 &&
          cleaned.length <= 6 &&
          !cleaned.includes('-')
        ) {
          return cleaned.slice(0, 4) + '-' + cleaned.slice(4);
        }
        if (cleaned.length >= 7 && cleaned.split('-').length === 2) {
          const parts = cleaned.split('-');
          return (
            parts[0] + '-' + parts[1].slice(0, 2) + '-' + parts[1].slice(2)
          );
        }
      }

      return cleaned;
    },
    [dateFormat, autoFormat]
  );

  const validateInput = useCallback(
    (inputValue: string): string | null => {
      if (!inputValue.trim()) {
        return isRequired ? 'Date is required' : null;
      }

      const parsedDate = parseDate(inputValue, dateFormat);
      if (!parsedDate) {
        return `Invalid date format. Expected: ${getDatePlaceholder(dateFormat)}`;
      }

      if (minDate && parsedDate < minDate) {
        return `Date must be after ${formatDate(minDate, dateFormat)}`;
      }

      if (maxDate && parsedDate > maxDate) {
        return `Date must be before ${formatDate(maxDate, dateFormat)}`;
      }

      return null;
    },
    [dateFormat, isRequired, minDate, maxDate]
  );

  // Update input value when value prop changes
  useEffect(() => {
    if (value) {
      setInputValue(formatDate(value, dateFormat));
      setValidationError(null);
    } else {
      setInputValue('');
    }
  }, [value, dateFormat]);

  const handleInputChange = (rawInput: string) => {
    // Apply smart formatting
    const formattedInput = formatInputValue(rawInput);
    setInputValue(formattedInput);

    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }

    // Clear the date if input is empty
    if (formattedInput === '') {
      onChange(null);
      if (showValidation && isRequired) {
        setValidationError('Date is required');
      }
      return;
    }

    // Try to parse the input
    const parsedDate = parseDate(formattedInput, dateFormat);
    if (parsedDate) {
      // Check date constraints
      const error = validateInput(formattedInput);
      if (error) {
        setValidationError(error);
        return;
      }

      onChange(parsedDate);
      setValidationError(null);
    }
    // If parsing fails, keep the input value but don't update the date
    // This allows users to type partial dates
  };

  const handleInputBlur = () => {
    if (showValidation && inputValue) {
      const error = validateInput(inputValue);
      setValidationError(error);
    }
  };

  const handleInputFocus = () => {
    // Focus handler for future use
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    setValidationError(null);
  };

  return (
    <div className={className}>
      <Input
        label={label}
        placeholder={placeholder || getDatePlaceholder(dateFormat)}
        value={inputValue}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        size={size}
        isRequired={isRequired}
        isDisabled={isDisabled}
        isInvalid={!!validationError || !!errorMessage}
        errorMessage={validationError || errorMessage}
        description={description}
        startContent={startContent}
        endContent={
          <div className='flex items-center gap-1'>
            {(validationError || errorMessage) && (
              <AlertCircle className='w-4 h-4 text-danger' />
            )}
            {inputValue && !isDisabled && (
              <button
                type='button'
                onClick={handleClear}
                className='text-foreground-400 hover:text-foreground-600 p-1 rounded transition-colors'
              >
                <X className='w-3 h-3' />
              </button>
            )}
          </div>
        }
        classNames={{
          input: 'text-foreground',
          inputWrapper: `
            bg-content2 border-divider data-[hover=true]:bg-content3 
            group-data-[focus=true]:bg-content2 transition-colors
            ${validationError || errorMessage ? 'border-danger data-[hover=true]:border-danger' : ''}
          `,
          label: 'text-foreground-600 font-medium',
          errorMessage: 'text-danger text-xs',
          description: 'text-foreground-500 text-xs',
        }}
      />
    </div>
  );
}
