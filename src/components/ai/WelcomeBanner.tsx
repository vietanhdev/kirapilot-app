import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import {
  Sparkles,
  Heart,
  Brain,
  MessageCircle,
  ChevronRight,
  X,
  Play,
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';

interface WelcomeBannerProps {
  onStartOnboarding: () => void;
  onStartTour: (tourId: string) => void;
  className?: string;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  onStartOnboarding,
  onStartTour,
  className = '',
}) => {
  const { preferences } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [bannerType, setBannerType] = useState<
    'onboarding' | 'tour' | 'features' | null
  >(null);

  useEffect(() => {
    const hasCompletedOnboarding = preferences.aiSettings?.onboardingCompleted;
    const hasApiKey = preferences.aiSettings?.geminiApiKey;
    const dismissedBanners = JSON.parse(
      localStorage.getItem('kirapilot-dismissed-banners') || '[]'
    );

    if (!hasCompletedOnboarding && !dismissedBanners.includes('onboarding')) {
      setBannerType('onboarding');
      setIsVisible(true);
    } else if (
      hasCompletedOnboarding &&
      hasApiKey &&
      !dismissedBanners.includes('tour')
    ) {
      setBannerType('tour');
      setIsVisible(true);
    } else if (
      hasCompletedOnboarding &&
      hasApiKey &&
      !dismissedBanners.includes('features')
    ) {
      setBannerType('features');
      setIsVisible(true);
    }
  }, [preferences]);

  const dismissBanner = () => {
    if (bannerType) {
      const dismissedBanners = JSON.parse(
        localStorage.getItem('kirapilot-dismissed-banners') || '[]'
      );
      dismissedBanners.push(bannerType);
      localStorage.setItem(
        'kirapilot-dismissed-banners',
        JSON.stringify(dismissedBanners)
      );
    }
    setIsVisible(false);
  };

  const handleStartOnboarding = () => {
    dismissBanner();
    onStartOnboarding();
  };

  const handleStartTour = (tourId: string) => {
    dismissBanner();
    onStartTour(tourId);
  };

  if (!isVisible || !bannerType) {
    return null;
  }

  const bannerContent = {
    onboarding: {
      title: 'Welcome to Enhanced AI Experience! ✨',
      description:
        'Your AI assistant has been upgraded with emotional intelligence, smart task management, and personalized insights.',
      icon: <Sparkles className='w-6 h-6 text-primary-500' />,
      gradient:
        'from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20',
      border: 'border-primary-200 dark:border-primary-800',
      actions: [
        {
          label: 'Take the Tour',
          onClick: handleStartOnboarding,
          variant: 'solid' as const,
          color: 'primary' as const,
          icon: <Play className='w-4 h-4' />,
        },
        {
          label: 'Skip for Now',
          onClick: dismissBanner,
          variant: 'light' as const,
        },
      ],
      features: [
        {
          icon: <Heart className='w-4 h-4 text-red-500' />,
          label: 'Emotional Support',
        },
        {
          icon: <Brain className='w-4 h-4 text-blue-500' />,
          label: 'Smart Task Matching',
        },
        {
          icon: <MessageCircle className='w-4 h-4 text-green-500' />,
          label: 'Natural Conversations',
        },
      ],
    },
    tour: {
      title: 'Ready to Explore? 🚀',
      description:
        'Take a quick tour to discover all the new AI features and learn how to use them effectively.',
      icon: <Brain className='w-6 h-6 text-blue-500' />,
      gradient:
        'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      actions: [
        {
          label: 'Start Chat Tour',
          onClick: () => handleStartTour('ai-chat'),
          variant: 'solid' as const,
          color: 'primary' as const,
          icon: <MessageCircle className='w-4 h-4' />,
        },
        {
          label: 'Settings Tour',
          onClick: () => handleStartTour('ai-settings'),
          variant: 'bordered' as const,
          color: 'primary' as const,
        },
        {
          label: 'Maybe Later',
          onClick: dismissBanner,
          variant: 'light' as const,
        },
      ],
    },
    features: {
      title: 'Discover New Features 🎯',
      description:
        'Unlock advanced AI capabilities as you use the app. Each feature is designed to make you more productive.',
      icon: <Sparkles className='w-6 h-6 text-purple-500' />,
      gradient:
        'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      actions: [
        {
          label: 'Explore Features',
          onClick: dismissBanner,
          variant: 'solid' as const,
          color: 'secondary' as const,
          icon: <ChevronRight className='w-4 h-4' />,
        },
        {
          label: 'Hide This',
          onClick: dismissBanner,
          variant: 'light' as const,
        },
      ],
    },
  };

  const content = bannerContent[bannerType];

  return (
    <Card
      className={`bg-gradient-to-r ${content.gradient} ${content.border} ${className}`}
    >
      <CardBody className='p-4'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <div className='flex items-center gap-3 mb-3'>
              {content.icon}
              <div>
                <h3 className='text-lg font-semibold text-foreground'>
                  {content.title}
                </h3>
                <p className='text-sm text-foreground-600'>
                  {content.description}
                </p>
              </div>
            </div>

            {'features' in content && content.features && (
              <div className='flex items-center gap-4 mb-4'>
                {content.features.map(
                  (
                    feature: { icon: React.ReactNode; label: string },
                    index: number
                  ) => (
                    <div key={index} className='flex items-center gap-2'>
                      {feature.icon}
                      <span className='text-xs text-foreground-600'>
                        {feature.label}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            <div className='flex items-center gap-2 flex-wrap'>
              {content.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant}
                  color={action.color || 'default'}
                  size='sm'
                  onPress={action.onClick}
                  startContent={action.icon}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            isIconOnly
            variant='light'
            size='sm'
            onPress={dismissBanner}
            className='ml-2'
          >
            <X className='w-4 h-4' />
          </Button>
        </div>

        {bannerType === 'onboarding' && (
          <div className='mt-4 pt-4 border-t border-divider'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Chip size='sm' color='success' variant='dot'>
                  New
                </Chip>
                <span className='text-xs text-foreground-600'>
                  Enhanced with emotional intelligence and smart features
                </span>
              </div>
              <span className='text-xs text-foreground-500'>
                Takes ~3 minutes
              </span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
