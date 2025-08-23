// Priority selector component
import { Priority } from '../../types';
import { getPriorityColor } from '../../utils';
import { ChevronDown, Flag } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface PrioritySelectorProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
  className?: string;
}

const priorityIcons = {
  [Priority.LOW]: '🟢',
  [Priority.MEDIUM]: '🟡',
  [Priority.HIGH]: '🟠',
  [Priority.URGENT]: '🔴',
};

export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: PrioritySelectorProps) {
  const { t } = useTranslation();

  const priorityLabels = {
    [Priority.LOW]: t('common.prioritySelector.low'),
    [Priority.MEDIUM]: t('common.prioritySelector.medium'),
    [Priority.HIGH]: t('common.prioritySelector.high'),
    [Priority.URGENT]: t('common.prioritySelector.urgent'),
  };
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSelect = (priority: Priority) => {
    onChange(priority);
    setIsOpen(false);
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
          ${getPriorityColor(value)}
        `}
      >
        <div className='flex items-center space-x-2'>
          <span className='text-lg'>{priorityIcons[value]}</span>
          <span className='font-medium'>{priorityLabels[value]}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className='absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg'>
          {Object.entries(Priority).map(([key, priority]) => {
            if (typeof priority === 'number') {
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => handleSelect(priority)}
                  className={`
                    w-full flex items-center space-x-2 px-3 py-2 text-left
                    hover:bg-slate-50 dark:hover:bg-slate-700
                    transition-colors duration-200
                    ${value === priority ? 'bg-primary-50 dark:bg-primary-900' : ''}
                    ${priority === Priority.LOW ? 'rounded-t-lg' : ''}
                    ${priority === Priority.URGENT ? 'rounded-b-lg' : ''}
                  `}
                >
                  <span className='text-lg'>{priorityIcons[priority]}</span>
                  <span className='font-medium text-slate-900 dark:text-slate-100'>
                    {priorityLabels[priority]}
                  </span>
                  {value === priority && (
                    <Flag className='w-4 h-4 text-primary-500 ml-auto' />
                  )}
                </button>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
