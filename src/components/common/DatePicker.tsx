import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Input,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@heroui/react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';
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
  minDate?: Date;
  maxDate?: Date;
  errorMessage?: string;
  description?: string;
  showValidation?: boolean;
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
  minDate,
  maxDate,
  errorMessage,
  description,
  showValidation = true,
}: DatePickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Smart input formatting helper
  const formatInputValue = useCallback(
    (input: string): string => {
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
    [dateFormat]
  );

  // Update input value when value prop changes
  useEffect(() => {
    if (value) {
      setInputValue(formatDate(value, dateFormat));
      setViewDate(value);
      setValidationError(null);
    } else {
      setInputValue('');
    }
  }, [value, dateFormat]);

  // Set initial focus when calendar opens
  useEffect(() => {
    if (isOpen) {
      const initialFocus = value || new Date();
      setFocusedDate(initialFocus);
      setViewDate(initialFocus);
    } else {
      setFocusedDate(null);
    }
  }, [isOpen, value]);

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
      setViewDate(parsedDate);
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
    if (!isDisabled) {
      setIsOpen(true);
    }
  };

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && date < minDate) {
        return true;
      }
      if (maxDate && date > maxDate) {
        return true;
      }
      return false;
    },
    [minDate, maxDate]
  );

  const handleDateSelect = useCallback(
    (date: Date) => {
      onChange(date);
      setInputValue(formatDate(date, dateFormat));
      setIsOpen(false);
      setFocusedDate(null);
    },
    [onChange, dateFormat]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      const currentFocus = focusedDate || value || new Date();
      let newFocusDate = new Date(currentFocus);

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newFocusDate.setDate(newFocusDate.getDate() - 1);
          setFocusedDate(newFocusDate);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newFocusDate.setDate(newFocusDate.getDate() + 1);
          setFocusedDate(newFocusDate);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newFocusDate.setDate(newFocusDate.getDate() - 7);
          setFocusedDate(newFocusDate);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newFocusDate.setDate(newFocusDate.getDate() + 7);
          setFocusedDate(newFocusDate);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isDateDisabled(currentFocus)) {
            handleDateSelect(currentFocus);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setFocusedDate(null);
          if (inputRef.current) {
            inputRef.current.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          newFocusDate = new Date(
            newFocusDate.getFullYear(),
            newFocusDate.getMonth(),
            1
          );
          setFocusedDate(newFocusDate);
          break;
        case 'End':
          e.preventDefault();
          newFocusDate = new Date(
            newFocusDate.getFullYear(),
            newFocusDate.getMonth() + 1,
            0
          );
          setFocusedDate(newFocusDate);
          break;
        case 'PageUp':
          e.preventDefault();
          if (e.shiftKey) {
            newFocusDate.setFullYear(newFocusDate.getFullYear() - 1);
          } else {
            newFocusDate.setMonth(newFocusDate.getMonth() - 1);
          }
          setFocusedDate(newFocusDate);
          break;
        case 'PageDown':
          e.preventDefault();
          if (e.shiftKey) {
            newFocusDate.setFullYear(newFocusDate.getFullYear() + 1);
          } else {
            newFocusDate.setMonth(newFocusDate.getMonth() + 1);
          }
          setFocusedDate(newFocusDate);
          break;
      }

      // Update view date if focused date moves to different month
      if (focusedDate && newFocusDate.getMonth() !== viewDate.getMonth()) {
        setViewDate(newFocusDate);
      }
    },
    [isOpen, focusedDate, value, isDateDisabled, handleDateSelect, viewDate]
  );

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setViewDate(newDate);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    if (direction === 'prev') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setViewDate(newDate);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get first day of month and calculate starting date for calendar
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Generate calendar days
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
      <div
        className='p-4 w-80'
        ref={calendarRef}
        role='dialog'
        aria-label='Date picker'
      >
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={() => navigateYear('prev')}
              className='text-foreground-600 hover:text-foreground'
            >
              <ChevronLeft className='w-3 h-3' />
            </Button>
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={() => navigateMonth('prev')}
              className='text-foreground-600 hover:text-foreground'
            >
              <ChevronLeft className='w-4 h-4' />
            </Button>
          </div>

          <div className='text-sm font-medium text-foreground'>
            {monthNames[month]} {year}
          </div>

          <div className='flex items-center gap-2'>
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={() => navigateMonth('next')}
              className='text-foreground-600 hover:text-foreground'
            >
              <ChevronRight className='w-4 h-4' />
            </Button>
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={() => navigateYear('next')}
              className='text-foreground-600 hover:text-foreground'
            >
              <ChevronRight className='w-3 h-3' />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className='grid grid-cols-7 gap-1 mb-2'>
          {dayNames.map(day => (
            <div
              key={day}
              className='text-xs font-medium text-foreground-600 text-center p-2'
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className='grid grid-cols-7 gap-1' onKeyDown={handleKeyDown}>
          {days.map((date, index) => {
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.getTime() === today.getTime();
            const isSelected =
              value &&
              date.getTime() ===
                new Date(
                  value.getFullYear(),
                  value.getMonth(),
                  value.getDate()
                ).getTime();
            const isFocused =
              focusedDate &&
              date.getTime() ===
                new Date(
                  focusedDate.getFullYear(),
                  focusedDate.getMonth(),
                  focusedDate.getDate()
                ).getTime();
            const disabled = isDateDisabled(date);

            return (
              <Button
                key={index}
                size='sm'
                variant={isSelected ? 'solid' : isToday ? 'bordered' : 'light'}
                color={isSelected ? 'primary' : 'default'}
                onPress={() => !disabled && handleDateSelect(date)}
                isDisabled={disabled}
                tabIndex={isFocused ? 0 : -1}
                className={`
                  h-8 w-8 p-0 text-xs
                  ${!isCurrentMonth ? 'text-foreground-400' : 'text-foreground'}
                  ${isToday && !isSelected ? 'border-primary-500' : ''}
                  ${isFocused ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
                  ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                onFocus={() => setFocusedDate(date)}
              >
                {date.getDate()}
              </Button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className='flex justify-between items-center mt-4 pt-3 border-t border-divider'>
          <Button
            size='sm'
            variant='light'
            onPress={() => handleDateSelect(new Date())}
            className='text-xs'
          >
            Today
          </Button>
          <Button
            size='sm'
            variant='light'
            onPress={() => {
              onChange(null);
              setInputValue('');
              setIsOpen(false);
            }}
            className='text-xs'
          >
            Clear
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <Popover
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement='bottom-start'
        showArrow
        classNames={{
          content: 'p-0 bg-content1 border border-divider shadow-lg',
        }}
      >
        <PopoverTrigger>
          <div className='relative'>
            <Input
              ref={inputRef}
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
                    <Button
                      isIconOnly
                      size='sm'
                      variant='light'
                      onPress={handleClear}
                      className='text-foreground-400 hover:text-foreground-600 min-w-unit-6 w-6 h-6'
                    >
                      <X className='w-3 h-3' />
                    </Button>
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
        </PopoverTrigger>
        <PopoverContent>{renderCalendar()}</PopoverContent>
      </Popover>
    </div>
  );
}
