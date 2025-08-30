import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Card,
  CardBody,
  Chip,
} from '@heroui/react';
import {
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Zap,
  Heart,
  Brain,
  X,
} from 'lucide-react';

interface ContextualHelpProps {
  context: 'chat' | 'settings' | 'tasks' | 'timer' | 'general';
  trigger?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

interface HelpTip {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  context,
  trigger,
  placement = 'bottom',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

  // Load dismissed tips from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('kirapilot-dismissed-help-tips');
    if (stored) {
      try {
        setDismissedTips(new Set(JSON.parse(stored)));
      } catch (error) {
        console.error('Failed to load dismissed help tips:', error);
      }
    }
  }, []);

  const dismissTip = (tipId: string) => {
    const newDismissed = new Set([...dismissedTips, tipId]);
    setDismissedTips(newDismissed);
    localStorage.setItem(
      'kirapilot-dismissed-help-tips',
      JSON.stringify([...newDismissed])
    );
  };

  const getHelpTips = (): HelpTip[] => {
    const baseTips: Record<string, HelpTip[]> = {
      chat: [
        {
          id: 'natural-language',
          title: 'Natural Language Commands',
          description:
            'You can reference tasks naturally, like "complete my presentation task" instead of using technical IDs.',
          icon: <MessageCircle className='w-4 h-4 text-blue-500' />,
        },
        {
          id: 'action-buttons',
          title: 'Quick Action Buttons',
          description:
            'Look for action buttons in AI responses to quickly complete tasks, start timers, or create new items.',
          icon: <Zap className='w-4 h-4 text-yellow-500' />,
        },
        {
          id: 'interaction-details',
          title: 'Interaction Details',
          description:
            'Click the info icon (ℹ️) next to AI messages to see detailed logs of what the AI did.',
          icon: <Brain className='w-4 h-4 text-purple-500' />,
        },
        {
          id: 'mood-checkin',
          title: 'Daily Mood Check-ins',
          description:
            'Try asking "How are you feeling today?" to start a mood check-in and get personalized support.',
          icon: <Heart className='w-4 h-4 text-red-500' />,
        },
      ],
      settings: [
        {
          id: 'personality-settings',
          title: 'Customize AI Personality',
          description:
            'Adjust warmth, enthusiasm, and communication style to make the AI feel right for you.',
          icon: <MessageCircle className='w-4 h-4 text-green-500' />,
        },
        {
          id: 'emotional-features',
          title: 'Emotional Intelligence Features',
          description:
            'Enable mood tracking, stress detection, and celebration features for a more supportive experience.',
          icon: <Heart className='w-4 h-4 text-red-500' />,
        },
      ],
      tasks: [
        {
          id: 'ai-task-help',
          title: 'AI Task Assistance',
          description:
            'Ask the AI to help with task management using natural language. It can find, create, and modify tasks for you.',
          icon: <Brain className='w-4 h-4 text-blue-500' />,
        },
        {
          id: 'smart-suggestions',
          title: 'Smart Suggestions',
          description:
            'The AI provides contextual suggestions based on your task patterns and productivity insights.',
          icon: <Lightbulb className='w-4 h-4 text-yellow-500' />,
        },
      ],
      timer: [
        {
          id: 'ai-timer-control',
          title: 'Voice Timer Control',
          description:
            'Tell the AI to start, stop, or check your timer status using natural language commands.',
          icon: <MessageCircle className='w-4 h-4 text-blue-500' />,
        },
      ],
      general: [
        {
          id: 'getting-started',
          title: 'Getting Started',
          description:
            'Your AI assistant is enhanced with emotional intelligence and smart task management. Try having a conversation!',
          icon: <Lightbulb className='w-4 h-4 text-primary-500' />,
        },
      ],
    };

    return baseTips[context] || baseTips.general;
  };

  const availableTips = getHelpTips().filter(tip => !dismissedTips.has(tip.id));

  if (availableTips.length === 0) {
    return null;
  }

  const defaultTrigger = (
    <Button isIconOnly variant='light' size='sm' className={className}>
      <HelpCircle className='w-4 h-4 text-foreground-600' />
    </Button>
  );

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement={placement}
      showArrow
      classNames={{
        base: 'py-3 px-4 border border-divider bg-content1',
        arrow: 'bg-content1',
      }}
    >
      <PopoverTrigger>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent className='w-80'>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-foreground flex items-center gap-2'>
              <Lightbulb className='w-4 h-4 text-primary-500' />
              Helpful Tips
            </h3>
            <Chip size='sm' variant='flat' color='primary'>
              {availableTips.length} tip{availableTips.length !== 1 ? 's' : ''}
            </Chip>
          </div>

          <div className='space-y-2'>
            {availableTips.map(tip => (
              <Card key={tip.id} className='bg-content2'>
                <CardBody className='p-3'>
                  <div className='flex items-start gap-3'>
                    <div className='flex-shrink-0 mt-0.5'>{tip.icon}</div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <h4 className='text-sm font-medium text-foreground'>
                          {tip.title}
                        </h4>
                        <Button
                          isIconOnly
                          variant='light'
                          size='sm'
                          className='w-6 h-6 min-w-6'
                          onPress={() => dismissTip(tip.id)}
                        >
                          <X className='w-3 h-3' />
                        </Button>
                      </div>
                      <p className='text-xs text-foreground-600 mt-1'>
                        {tip.description}
                      </p>
                      {tip.action && (
                        <Button
                          size='sm'
                          variant='flat'
                          color='primary'
                          className='mt-2'
                          onPress={tip.action.onClick}
                        >
                          {tip.action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className='text-center'>
            <Button
              size='sm'
              variant='light'
              onPress={() => setIsOpen(false)}
              className='text-xs'
            >
              Close Tips
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Hook for showing contextual tips automatically
export const useContextualTips = (context: string) => {
  const [shouldShowTip, setShouldShowTip] = useState(false);

  useEffect(() => {
    // Check if we should show tips for this context
    const stored = localStorage.getItem('kirapilot-dismissed-help-tips');
    const dismissedTips = stored ? JSON.parse(stored) : [];

    // Show tip if user hasn't seen onboarding and hasn't dismissed context-specific tips
    const onboardingCompleted = localStorage.getItem('kirapilot-preferences');
    const preferences = onboardingCompleted
      ? JSON.parse(onboardingCompleted)
      : {};
    const hasSeenOnboarding = preferences.aiSettings?.onboardingCompleted;

    if (!hasSeenOnboarding) {
      // Show tips for new users
      setShouldShowTip(true);
    } else {
      // Check if context-specific tips have been dismissed
      const contextTipId = `${context}-intro`;
      if (!dismissedTips.includes(contextTipId)) {
        setShouldShowTip(true);
      }
    }
  }, [context]);

  return { shouldShowTip, setShouldShowTip };
};
