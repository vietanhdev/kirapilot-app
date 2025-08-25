import { useState } from 'react';
import { TaskSortOptions } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskSortControlsProps {
  sortOptions: TaskSortOptions;
  onSortChange: (sortOptions: TaskSortOptions) => void;
  className?: string;
}

const SORT_FIELDS = [
  { key: 'title', label: 'tasks.sort.title' },
  { key: 'priority', label: 'tasks.sort.priority' },
  { key: 'dueDate', label: 'tasks.sort.dueDate' },
  { key: 'createdAt', label: 'tasks.sort.createdAt' },
  { key: 'updatedAt', label: 'tasks.sort.updatedAt' },
] as const;

export function TaskSortControls({
  sortOptions,
  onSortChange,
  className = '',
}: TaskSortControlsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentField = SORT_FIELDS.find(
    field => field.key === sortOptions.field
  );

  const handleFieldChange = (field: TaskSortOptions['field']) => {
    onSortChange({ ...sortOptions, field });
    setIsOpen(false);
  };

  const handleDirectionToggle = () => {
    onSortChange({
      ...sortOptions,
      direction: sortOptions.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const DirectionIcon = sortOptions.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <div className={`relative ${className}`}>
      <div className='flex items-center space-x-1'>
        {/* Sort Field Dropdown */}
        <div className='relative'>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className='flex items-center space-x-2 px-3 py-1.5 text-sm bg-content1 dark:bg-content2 border border-divider rounded-lg hover:bg-content2 dark:hover:bg-content3 transition-colors'
          >
            <ArrowUpDown className='w-4 h-4 text-default-500' />
            <span className='text-default-700 dark:text-default-300'>
              {currentField ? t(currentField.label) : t('tasks.sort.title')}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-default-500 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className='absolute top-full left-0 mt-1 w-48 bg-content1 dark:bg-content2 border border-divider rounded-lg shadow-lg z-50'
              >
                <div className='py-1'>
                  {SORT_FIELDS.map(field => (
                    <button
                      key={field.key}
                      onClick={() => handleFieldChange(field.key)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-content2 dark:hover:bg-content3 transition-colors ${
                        sortOptions.field === field.key
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'text-default-700 dark:text-default-300'
                      }`}
                    >
                      {t(field.label)}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sort Direction Toggle */}
        <button
          onClick={handleDirectionToggle}
          className='p-1.5 bg-content1 dark:bg-content2 border border-divider rounded-lg hover:bg-content2 dark:hover:bg-content3 transition-colors'
          title={
            sortOptions.direction === 'asc'
              ? t('tasks.sort.ascending')
              : t('tasks.sort.descending')
          }
        >
          <DirectionIcon className='w-4 h-4 text-default-500' />
        </button>
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div className='fixed inset-0 z-40' onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
