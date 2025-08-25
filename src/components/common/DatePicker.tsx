import React, { useState, useEffect } from 'react';
import { Input } from '@heroui/react';
import { Calendar } from 'lucide-react';
import {
  formatDate,
  parseDate,
  getDatePlaceholder,
  DateFormat,
} from '../../utils/dateFormat';

interface DatePickerProps {
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
}

export function DatePicker({
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
}: DatePickerProps) {
  const [inputValue, setInputValue] = useState('');

  // Update input value when value prop changes
  useEffect(() => {
    if (value) {
      setInputValue(formatDate(value, dateFormat));
    } else {
      setInputValue('');
    }
  }, [value, dateFormat]);

  // Convert Date to HTML date input format (YYYY-MM-DD)
  const dateToInputValue = (date: Date | null): string => {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert HTML date input value to Date
  const inputValueToDate = (value: string): Date | null => {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  const handleChange = (value: string) => {
    setInputValue(value);

    // Try to parse the input
    const parsedDate = parseDate(value, dateFormat);
    if (parsedDate) {
      onChange(parsedDate);
    } else if (value === '') {
      onChange(null);
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = inputValueToDate(e.target.value);
    if (date) {
      setInputValue(formatDate(date, dateFormat));
      onChange(date);
    } else if (e.target.value === '') {
      setInputValue('');
      onChange(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Visual Input for Display */}
      <Input
        label={label}
        placeholder={placeholder || getDatePlaceholder(dateFormat)}
        value={inputValue}
        onChange={e => handleChange(e.target.value)}
        size={size}
        isRequired={isRequired}
        isDisabled={isDisabled}
        startContent={startContent}
        classNames={{
          input: 'text-foreground',
          inputWrapper:
            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
          label: 'text-foreground-600 font-medium',
        }}
      />

      {/* Hidden HTML5 Date Input */}
      <input
        type='date'
        value={dateToInputValue(value || null)}
        onChange={handleDateInputChange}
        disabled={isDisabled}
        className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
        style={{
          zIndex: 1,
          pointerEvents: isDisabled ? 'none' : 'auto',
        }}
      />
    </div>
  );
}
