import { useState } from 'react';
import { Button, Input } from '@heroui/react';
import { Plus, Calendar } from 'lucide-react';
import { Task } from '../../types';
import { useTaskList } from '../../contexts/TaskListContext';
import { useTaskOperations } from '../../hooks/useTaskOperations';

interface QuickTaskCreatorProps {
  defaultDate?: Date;
  placeholder?: string;
  onTaskCreated?: (task: Task) => void;
  compact?: boolean;
  className?: string;
}

export function QuickTaskCreator({
  defaultDate = new Date(),
  placeholder = 'Add a task for today...',
  onTaskCreated,
  compact = false,
  className = '',
}: QuickTaskCreatorProps) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { getSelectedTaskListId } = useTaskList();
  const { createTask } = useTaskOperations({
    onTasksChange: () => {
      // Tasks will be automatically refreshed by the parent component
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const taskListId = getSelectedTaskListId() || 'default-task-list';

      const newTask = await createTask({
        title: title.trim(),
        description: '',
        priority: 1,
        scheduledDate: selectedDate,
        timeEstimate: 0,
        tags: [],
        dependencies: [],
        taskListId,
      });

      // Clear form
      setTitle('');
      setSelectedDate(defaultDate);
      setShowDatePicker(false);

      // Notify parent
      onTaskCreated?.(newTask);
    } catch (error) {
      console.error('Failed to create task:', error);
      // Error is already handled by useTaskOperations
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) {
      return 'Today';
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`bg-content2 rounded-lg ${compact ? 'p-2' : 'p-3'} border border-divider ${className}`}
    >
      <form onSubmit={handleSubmit} className='flex items-center gap-2'>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          variant='flat'
          size={compact ? 'sm' : 'sm'}
          className='flex-1'
          disabled={isCreating}
        />

        {!compact && (
          <Button
            type='button'
            variant='flat'
            size='sm'
            isIconOnly
            onPress={() => setShowDatePicker(!showDatePicker)}
            className='min-w-unit-8'
            title={`Scheduled for ${formatDate(selectedDate)}`}
          >
            <Calendar className='w-4 h-4' />
          </Button>
        )}

        <Button
          type='submit'
          color='primary'
          size='sm'
          isIconOnly
          isLoading={isCreating}
          disabled={!title.trim() || isCreating}
          className='min-w-unit-8'
        >
          <Plus className='w-4 h-4' />
        </Button>
      </form>

      {!compact && showDatePicker && (
        <div className='mt-2 p-2 bg-content1 rounded border border-divider'>
          <div className='text-xs text-foreground-600 mb-2'>Schedule for:</div>
          <div className='flex flex-wrap gap-1'>
            {[0, 1, 2, 7].map(daysFromNow => {
              const date = new Date();
              date.setDate(date.getDate() + daysFromNow);
              const isSelected =
                selectedDate.toDateString() === date.toDateString();

              return (
                <Button
                  key={daysFromNow}
                  size='sm'
                  variant={isSelected ? 'solid' : 'flat'}
                  color={isSelected ? 'primary' : 'default'}
                  onClick={() => {
                    setSelectedDate(date);
                    setShowDatePicker(false);
                  }}
                  className='text-xs'
                >
                  {formatDate(date)}
                </Button>
              );
            })}

            <Button
              size='sm'
              variant='flat'
              onClick={() => {
                setSelectedDate(new Date()); // Reset to today
                setShowDatePicker(false);
              }}
              className='text-xs'
            >
              No date
            </Button>
          </div>
        </div>
      )}

      {!compact && selectedDate && (
        <div className='mt-1 text-xs text-foreground-500'>
          Will be scheduled for {formatDate(selectedDate)}
        </div>
      )}
    </div>
  );
}
