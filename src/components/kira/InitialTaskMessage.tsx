import { Card, CardBody, Button, Chip } from '@heroui/react';
import {
  Bot,
  CheckSquare,
  Clock,
  Target,
  Lightbulb,
  Play,
  Calendar,
} from 'lucide-react';
import { Task } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { MarkdownRenderer } from '../common';

interface InitialTaskMessageProps {
  task: Task;
  onSendMessage: (message: string) => void;
  className?: string;
}

/**
 * Initial bot message component for task-assigned threads
 * Displays task information and offers helpful suggestions
 */
export function InitialTaskMessage({
  task,
  onSendMessage,
  className = '',
}: InitialTaskMessageProps) {
  const { t } = useTranslation();

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return 'danger';
      case 2:
        return 'warning';
      case 3:
        return 'primary';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1:
        return t('priority.high');
      case 2:
        return t('priority.medium');
      case 3:
        return t('priority.low');
      default:
        return t('priority.low');
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) {
      return null;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const isOverdue = task.dueDate && new Date() > new Date(task.dueDate);
  const isDueToday =
    task.dueDate &&
    new Date(task.dueDate).toDateString() === new Date().toDateString();

  const suggestions = [
    {
      icon: <Play className='w-4 h-4' />,
      text: t('kira.task.suggestions.startTimer'),
      message: t('kira.task.messages.startTimer', { title: task.title }),
    },
    {
      icon: <Target className='w-4 h-4' />,
      text: t('kira.task.suggestions.breakdown'),
      message: t('kira.task.messages.breakdown', { title: task.title }),
    },
    {
      icon: <Calendar className='w-4 h-4' />,
      text: t('kira.task.suggestions.schedule'),
      message: t('kira.task.messages.schedule', { title: task.title }),
    },
    {
      icon: <Lightbulb className='w-4 h-4' />,
      text: t('kira.task.suggestions.tips'),
      message: t('kira.task.messages.tips', { title: task.title }),
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Bot Avatar and Greeting */}
      <div className='flex items-start gap-3'>
        <div className='w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0'>
          <Bot className='w-5 h-5 text-white' />
        </div>
        <div className='flex-1'>
          <div className='bg-content2 rounded-lg p-4 border border-divider'>
            <h3 className='text-lg font-semibold text-foreground mb-3'>
              {t('kira.task.greeting.title')}
            </h3>

            {/* Task Information Card */}
            <Card className='mb-4'>
              <CardBody className='p-4'>
                <div className='flex items-start gap-3 mb-3'>
                  <CheckSquare className='w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <h4 className='font-semibold text-foreground mb-2'>
                      {task.title}
                    </h4>

                    {/* Task metadata */}
                    <div className='flex flex-wrap gap-2 mb-3'>
                      <Chip
                        size='sm'
                        color={getPriorityColor(task.priority)}
                        variant='flat'
                      >
                        {getPriorityLabel(task.priority)}
                      </Chip>

                      {task.status && (
                        <Chip size='sm' variant='flat' color='default'>
                          {t(
                            `status.${task.status === 'in_progress' ? 'inProgress' : task.status}`
                          )}
                        </Chip>
                      )}

                      {task.timeEstimate && (
                        <Chip
                          size='sm'
                          variant='flat'
                          color='secondary'
                          startContent={<Clock className='w-3 h-3' />}
                        >
                          {formatDuration(task.timeEstimate)}
                        </Chip>
                      )}

                      {isOverdue && (
                        <Chip size='sm' color='danger' variant='flat'>
                          Overdue
                        </Chip>
                      )}

                      {isDueToday && !isOverdue && (
                        <Chip size='sm' color='warning' variant='flat'>
                          Due Today
                        </Chip>
                      )}
                    </div>

                    {/* Task description */}
                    {task.description && (
                      <div className='text-sm text-foreground-600'>
                        <MarkdownRenderer content={task.description} />
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Bot message */}
            <div className='text-foreground-700 mb-4'>
              <MarkdownRenderer
                content={t('kira.task.greeting.message', {
                  title: task.title,
                  status: task.status
                    ? t(
                        `status.${task.status === 'in_progress' ? 'inProgress' : task.status}`
                      )
                    : 'pending',
                })}
              />
            </div>

            {/* Suggestions */}
            <div className='space-y-2'>
              <p className='text-sm font-medium text-foreground-700 mb-3'>
                {t('kira.task.greeting.suggestions')}
              </p>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant='flat'
                    color='primary'
                    size='sm'
                    startContent={suggestion.icon}
                    onPress={() => onSendMessage(suggestion.message)}
                    className='justify-start h-auto py-2 px-3'
                  >
                    <span className='text-left text-xs'>{suggestion.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
