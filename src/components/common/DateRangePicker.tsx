import { useState } from 'react';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateInput } from './DateInput';
import { formatDate, DateFormat, isDateInRange } from '../../utils/dateFormat';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  label?: string;
  value?: DateRange;
  onChange: (range: DateRange) => void;
  dateFormat: DateFormat;
  size?: 'sm' | 'md' | 'lg';
  isDisabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: {
    start?: string;
    end?: string;
  };
  showCalendar?: boolean;
}

export function DateRangePicker({
  label,
  value = { start: null, end: null },
  onChange,
  dateFormat,
  size = 'sm',
  isDisabled = false,
  className = '',
  minDate,
  maxDate,
  placeholder,
  showCalendar = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);

  const handleStartDateChange = (date: Date | null) => {
    const newRange = { ...value, start: date };

    // If end date is before start date, clear it
    if (date && value.end && date > value.end) {
      newRange.end = null;
    }

    onChange(newRange);
  };

  const handleEndDateChange = (date: Date | null) => {
    const newRange = { ...value, end: date };

    // If start date is after end date, clear it
    if (date && value.start && date < value.start) {
      newRange.start = null;
    }

    onChange(newRange);
  };

  const handleCalendarDateSelect = (date: Date) => {
    if (!value.start || selectingEnd) {
      // Select end date
      handleEndDateChange(date);
      setSelectingEnd(false);
      if (value.start) {
        setIsOpen(false);
      }
    } else {
      // Select start date
      handleStartDateChange(date);
      setSelectingEnd(true);
    }
  };

  const isDateInCurrentRange = (date: Date): boolean => {
    if (!value.start || !value.end) {
      return false;
    }
    return date >= value.start && date <= value.end;
  };

  const isDateRangeStart = (date: Date): boolean => {
    return value.start ? date.getTime() === value.start.getTime() : false;
  };

  const isDateRangeEnd = (date: Date): boolean => {
    return value.end ? date.getTime() === value.end.getTime() : false;
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
      <div className='p-4 w-80'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={() => {
              const newDate = new Date(viewDate);
              newDate.setMonth(newDate.getMonth() - 1);
              setViewDate(newDate);
            }}
          >
            <ChevronLeft className='w-4 h-4' />
          </Button>

          <div className='text-sm font-medium text-foreground'>
            {monthNames[month]} {year}
          </div>

          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={() => {
              const newDate = new Date(viewDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setViewDate(newDate);
            }}
          >
            <ChevronRight className='w-4 h-4' />
          </Button>
        </div>

        {/* Selection status */}
        <div className='mb-3 text-xs text-foreground-600'>
          {!value.start
            ? 'Select start date'
            : !value.end
              ? 'Select end date'
              : `${formatDate(value.start, dateFormat)} - ${formatDate(value.end, dateFormat)}`}
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
        <div className='grid grid-cols-7 gap-1'>
          {days.map((date, index) => {
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.getTime() === today.getTime();
            const isInRange = isDateInCurrentRange(date);
            const isRangeStart = isDateRangeStart(date);
            const isRangeEnd = isDateRangeEnd(date);
            const disabled = !isDateInRange(date, minDate, maxDate);

            return (
              <Button
                key={index}
                size='sm'
                variant={
                  isRangeStart || isRangeEnd
                    ? 'solid'
                    : isInRange
                      ? 'flat'
                      : 'light'
                }
                color={
                  isRangeStart || isRangeEnd
                    ? 'primary'
                    : isInRange
                      ? 'primary'
                      : 'default'
                }
                onPress={() => !disabled && handleCalendarDateSelect(date)}
                isDisabled={disabled}
                className={`
                  h-8 w-8 p-0 text-xs
                  ${!isCurrentMonth ? 'text-foreground-400' : 'text-foreground'}
                  ${isToday && !isRangeStart && !isRangeEnd ? 'border-primary-500' : ''}
                  ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                  ${isInRange && !isRangeStart && !isRangeEnd ? 'bg-primary-100 dark:bg-primary-900/30' : ''}
                `}
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
            onPress={() => {
              const today = new Date();
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              onChange({ start: today, end: tomorrow });
              setIsOpen(false);
            }}
            className='text-xs'
          >
            Today - Tomorrow
          </Button>
          <Button
            size='sm'
            variant='light'
            onPress={() => {
              onChange({ start: null, end: null });
              setSelectingEnd(false);
            }}
            className='text-xs'
          >
            Clear
          </Button>
        </div>
      </div>
    );
  };

  const formatRangeDisplay = (): string => {
    if (!value.start && !value.end) {
      return '';
    }
    if (value.start && !value.end) {
      return `${formatDate(value.start, dateFormat)} - ...`;
    }
    if (!value.start && value.end) {
      return `... - ${formatDate(value.end, dateFormat)}`;
    }
    if (value.start && value.end) {
      return `${formatDate(value.start, dateFormat)} - ${formatDate(value.end, dateFormat)}`;
    }
    return '';
  };

  return (
    <div className={className}>
      {label && (
        <label className='text-sm font-medium text-foreground-600 mb-2 block'>
          {label}
        </label>
      )}

      <div className='flex gap-2 items-center'>
        <DateInput
          placeholder={placeholder?.start || 'Start date'}
          value={value.start}
          onChange={handleStartDateChange}
          dateFormat={dateFormat}
          size={size}
          isDisabled={isDisabled}
          minDate={minDate}
          maxDate={value.end || maxDate}
          className='flex-1'
        />

        <span className='text-foreground-600 px-2'>to</span>

        <DateInput
          placeholder={placeholder?.end || 'End date'}
          value={value.end}
          onChange={handleEndDateChange}
          dateFormat={dateFormat}
          size={size}
          isDisabled={isDisabled}
          minDate={value.start || minDate}
          maxDate={maxDate}
          className='flex-1'
        />

        {showCalendar && (
          <Popover
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            placement='bottom-start'
            showArrow
          >
            <PopoverTrigger>
              <Button
                isIconOnly
                variant='bordered'
                size={size}
                isDisabled={isDisabled}
              >
                <Calendar className='w-4 h-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent>{renderCalendar()}</PopoverContent>
          </Popover>
        )}
      </div>

      {formatRangeDisplay() && (
        <div className='mt-2 text-xs text-foreground-600'>
          Selected: {formatRangeDisplay()}
        </div>
      )}
    </div>
  );
}
