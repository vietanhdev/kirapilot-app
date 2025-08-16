// Date picker component
import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  disabled = false,
  className = '',
  minDate,
  maxDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDateSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) {
      return true;
    }
    if (maxDate && date > maxDate) {
      return true;
    }
    return false;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type='button'
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 
          border border-slate-300 dark:border-slate-600 rounded-lg
          bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
          focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all duration-200
          ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer'
          }
        `}
      >
        <div className='flex items-center space-x-2'>
          <Calendar className='w-4 h-4 text-slate-500 dark:text-slate-400' />
          <span
            className={
              value
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {value ? formatDate(value) : placeholder}
          </span>
        </div>
        {value && !disabled && (
          <button
            type='button'
            onClick={handleClear}
            className='p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors duration-200'
            title='Clear date'
          >
            <X className='w-4 h-4 text-slate-500 dark:text-slate-400' />
          </button>
        )}
      </button>

      {isOpen && !disabled && (
        <div className='absolute z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg p-4'>
          <CalendarGrid
            currentMonth={currentMonth}
            selectedDate={value}
            onDateSelect={handleDateSelect}
            onMonthChange={setCurrentMonth}
            isDateDisabled={isDateDisabled}
          />
        </div>
      )}
    </div>
  );
}

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  isDateDisabled: (date: Date) => boolean;
}

function CalendarGrid({
  currentMonth,
  selectedDate,
  onDateSelect,
  onMonthChange,
  isDateDisabled,
}: CalendarGridProps) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  // Generate calendar days
  const calendarDays = [];

  // Previous month's trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date),
    });
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    calendarDays.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date),
    });
  }

  // Next month's leading days
  const remainingDays = 42 - calendarDays.length; // 6 rows × 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date),
    });
  }

  return (
    <div className='w-64'>
      {/* Header */}
      <div className='flex items-center justify-between mb-4'>
        <button
          type='button'
          onClick={previousMonth}
          className='p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors duration-200'
        >
          <svg
            className='w-4 h-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 19l-7-7 7-7'
            />
          </svg>
        </button>

        <h3 className='font-semibold text-slate-900 dark:text-slate-100'>
          {monthNames[month]} {year}
        </h3>

        <button
          type='button'
          onClick={nextMonth}
          className='p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors duration-200'
        >
          <svg
            className='w-4 h-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 5l7 7-7 7'
            />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className='grid grid-cols-7 gap-1 mb-2'>
        {dayNames.map(day => (
          <div
            key={day}
            className='text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1'
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className='grid grid-cols-7 gap-1'>
        {calendarDays.map((day, index) => (
          <button
            key={index}
            type='button'
            onClick={() => !day.isDisabled && onDateSelect(day.date)}
            disabled={day.isDisabled}
            className={`
              w-8 h-8 text-sm rounded transition-colors duration-200
              ${
                day.isCurrentMonth
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 dark:text-slate-600'
              }
              ${
                day.isSelected
                  ? 'bg-primary-500 text-white'
                  : day.isToday
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }
              ${
                day.isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }
            `}
          >
            {day.date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
