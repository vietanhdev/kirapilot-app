import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Tooltip } from '@heroui/react';
import { Lightbulb, X, Clock, Zap, Target, TrendingUp } from 'lucide-react';
import {
  useCurrentContextInsights,
  useWorkingStyleInsights,
} from '../../hooks';
import { Task, AISuggestion } from '../../types';

interface ProductivityAdviceWidgetProps {
  currentTask?: Task;
  recentPerformance?: 'high' | 'medium' | 'low';
  className?: string;
  onDismiss?: () => void;
  compact?: boolean;
}

export function ProductivityAdviceWidget({
  currentTask,
  recentPerformance = 'medium',
  className = '',
  onDismiss,
  compact = false,
}: ProductivityAdviceWidgetProps) {
  const [dismissedAdvice, setDismissedAdvice] = useState<Set<string>>(
    new Set()
  );

  const { advice, isLoading, error } = useCurrentContextInsights(
    currentTask,
    recentPerformance
  );

  const { getEnergyRecommendation } = useWorkingStyleInsights();

  // Filter out dismissed advice
  const visibleAdvice = advice.filter(item => !dismissedAdvice.has(item.id));
  const currentAdvice = visibleAdvice[0]; // Show only the top advice

  const currentHour = new Date().getHours();
  const energyRecommendation = getEnergyRecommendation(currentHour);

  const handleDismissAdvice = (adviceId: string) => {
    setDismissedAdvice(prev => new Set([...prev, adviceId]));
  };

  const handleDismissWidget = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  const getAdviceIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'schedule':
        return <Clock className='w-4 h-4' />;
      case 'energy':
        return <Zap className='w-4 h-4' />;
      case 'focus':
        return <Target className='w-4 h-4' />;
      case 'productivity':
        return <TrendingUp className='w-4 h-4' />;
      default:
        return <Lightbulb className='w-4 h-4' />;
    }
  };

  const getAdviceColor = (type: AISuggestion['type']) => {
    switch (type) {
      case 'schedule':
        return 'primary';
      case 'energy':
        return 'warning';
      case 'focus':
        return 'success';
      case 'productivity':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // Don't show widget if no advice or loading
  if (isLoading || error || (!currentAdvice && !energyRecommendation)) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {energyRecommendation && (
          <Tooltip content={energyRecommendation.message}>
            <Chip
              size='sm'
              color={
                energyRecommendation.type === 'high-energy'
                  ? 'success'
                  : energyRecommendation.type === 'low-energy'
                    ? 'warning'
                    : 'primary'
              }
              variant='flat'
              startContent={<Zap className='w-3 h-3' />}
            >
              {Math.round(energyRecommendation.energy)}% Energy
            </Chip>
          </Tooltip>
        )}

        {currentAdvice && (
          <Tooltip content={currentAdvice.description}>
            <Chip
              size='sm'
              color={getAdviceColor(currentAdvice.type)}
              variant='flat'
              startContent={getAdviceIcon(currentAdvice.type)}
            >
              {currentAdvice.title}
            </Chip>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <Card className={`max-w-md ${className}`}>
      <CardBody className='p-4'>
        <div className='flex justify-between items-start mb-3'>
          <div className='flex items-center gap-2'>
            <Lightbulb className='w-5 h-5 text-primary' />
            <h3 className='font-semibold text-sm'>Productivity Tip</h3>
          </div>
          {onDismiss && (
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={handleDismissWidget}
            >
              <X className='w-4 h-4' />
            </Button>
          )}
        </div>

        {/* Energy Status */}
        {energyRecommendation && (
          <div className='mb-3 p-2 bg-default-50 rounded-lg'>
            <div className='flex items-center gap-2 mb-1'>
              <Zap
                className={`w-4 h-4 ${
                  energyRecommendation.type === 'high-energy'
                    ? 'text-success'
                    : energyRecommendation.type === 'low-energy'
                      ? 'text-warning'
                      : 'text-primary'
                }`}
              />
              <span className='text-sm font-medium'>
                {Math.round(energyRecommendation.energy)}% Energy Level
              </span>
            </div>
            <p className='text-xs text-default-600'>
              {energyRecommendation.message}
            </p>
          </div>
        )}

        {/* Current Advice */}
        {currentAdvice && (
          <div className='space-y-2'>
            <div className='flex items-start gap-2'>
              <div
                className={`p-1 rounded-full bg-${getAdviceColor(currentAdvice.type)}-100`}
              >
                {getAdviceIcon(currentAdvice.type)}
              </div>
              <div className='flex-1'>
                <h4 className='font-medium text-sm'>{currentAdvice.title}</h4>
                <p className='text-xs text-default-600 mt-1'>
                  {currentAdvice.description}
                </p>
              </div>
            </div>

            <div className='flex justify-between items-center mt-3'>
              <div className='flex items-center gap-2'>
                <Chip size='sm' variant='flat' color='default'>
                  {currentAdvice.confidence}% confidence
                </Chip>
                <Chip
                  size='sm'
                  variant='flat'
                  color={
                    currentAdvice.priority === 1
                      ? 'danger'
                      : currentAdvice.priority === 2
                        ? 'warning'
                        : 'success'
                  }
                >
                  {currentAdvice.priority === 1
                    ? 'High'
                    : currentAdvice.priority === 2
                      ? 'Medium'
                      : 'Low'}{' '}
                  Priority
                </Chip>
              </div>

              <Button
                size='sm'
                variant='light'
                onPress={() => handleDismissAdvice(currentAdvice.id)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Show count of additional advice */}
        {visibleAdvice.length > 1 && (
          <div className='mt-3 pt-2 border-t border-default-200'>
            <p className='text-xs text-default-500 text-center'>
              +{visibleAdvice.length - 1} more tip
              {visibleAdvice.length > 2 ? 's' : ''} available
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Hook for managing widget visibility and state
export function useProductivityAdviceWidget() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastDismissed, setLastDismissed] = useState<Date | null>(null);

  // Auto-show widget after some time if dismissed
  useEffect(() => {
    if (!isVisible && lastDismissed) {
      const timer = setTimeout(
        () => {
          setIsVisible(true);
          setLastDismissed(null);
        },
        30 * 60 * 1000
      ); // Show again after 30 minutes

      return () => clearTimeout(timer);
    }
  }, [isVisible, lastDismissed]);

  const dismissWidget = () => {
    setIsVisible(false);
    setLastDismissed(new Date());
  };

  const showWidget = () => {
    setIsVisible(true);
    setLastDismissed(null);
  };

  return {
    isVisible,
    dismissWidget,
    showWidget,
  };
}
