import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Progress } from '@heroui/react';
import {
  Sparkles,
  Heart,
  Brain,
  MessageCircle,
  Zap,
  Target,
  ChevronRight,
  X,
  CheckCircle,
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';

interface FeatureDiscoveryProps {
  className?: string;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'emotional' | 'smart-tools' | 'productivity' | 'communication';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  unlockCondition?: () => boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const FeatureDiscovery: React.FC<FeatureDiscoveryProps> = ({
  className = '',
}) => {
  const { preferences } = useSettings();
  const [discoveredFeatures, setDiscoveredFeatures] = useState<Set<string>>(
    new Set()
  );
  const [isVisible, setIsVisible] = useState(false);

  // Load discovered features from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('kirapilot-discovered-features');
    if (stored) {
      try {
        setDiscoveredFeatures(new Set(JSON.parse(stored)));
      } catch (error) {
        console.error('Failed to load discovered features:', error);
      }
    }

    // Show feature discovery if onboarding is completed but user hasn't explored much
    const hasCompletedOnboarding = preferences.aiSettings?.onboardingCompleted;
    const hasApiKey = preferences.aiSettings?.geminiApiKey;

    if (hasCompletedOnboarding && hasApiKey) {
      setIsVisible(true);
    }
  }, [preferences]);

  const markFeatureDiscovered = (featureId: string) => {
    const newDiscovered = new Set([...discoveredFeatures, featureId]);
    setDiscoveredFeatures(newDiscovered);
    localStorage.setItem(
      'kirapilot-discovered-features',
      JSON.stringify([...newDiscovered])
    );
  };

  const features: Feature[] = [
    {
      id: 'mood-tracking',
      title: 'Daily Mood Check-ins',
      description:
        "Start your day by sharing how you're feeling. The AI will adapt its responses to support you better.",
      icon: <Heart className='w-5 h-5 text-red-500' />,
      category: 'emotional',
      difficulty: 'beginner',
      action: {
        label: 'Try Mood Check-in',
        onClick: () => {
          // This would trigger opening the chat with a mood check-in prompt
          markFeatureDiscovered('mood-tracking');
        },
      },
    },
    {
      id: 'natural-task-commands',
      title: 'Natural Task Commands',
      description:
        'Say "complete my presentation task" instead of using technical IDs. The AI will find the right task.',
      icon: <MessageCircle className='w-5 h-5 text-blue-500' />,
      category: 'smart-tools',
      difficulty: 'beginner',
      action: {
        label: 'Try Natural Commands',
        onClick: () => {
          markFeatureDiscovered('natural-task-commands');
        },
      },
    },
    {
      id: 'smart-confirmations',
      title: 'Smart Confirmation Dialogs',
      description:
        'Before making changes, the AI shows you exactly what will happen with clear previews.',
      icon: <Brain className='w-5 h-5 text-purple-500' />,
      category: 'smart-tools',
      difficulty: 'intermediate',
    },
    {
      id: 'contextual-actions',
      title: 'Quick Action Buttons',
      description:
        'Look for action buttons in AI responses to quickly complete tasks, start timers, or create items.',
      icon: <Zap className='w-5 h-5 text-yellow-500' />,
      category: 'productivity',
      difficulty: 'beginner',
    },
    {
      id: 'stress-detection',
      title: 'Stress Detection & Support',
      description:
        'The AI recognizes when you might be overwhelmed and offers helpful suggestions and encouragement.',
      icon: <Target className='w-5 h-5 text-orange-500' />,
      category: 'emotional',
      difficulty: 'intermediate',
      unlockCondition: () => discoveredFeatures.has('mood-tracking'),
    },
    {
      id: 'productivity-insights',
      title: 'Personalized Productivity Insights',
      description:
        'Get insights about your work patterns and personalized recommendations to improve productivity.',
      icon: <Brain className='w-5 h-5 text-indigo-500' />,
      category: 'productivity',
      difficulty: 'advanced',
      unlockCondition: () => discoveredFeatures.size >= 3,
    },
    {
      id: 'personality-customization',
      title: 'AI Personality Customization',
      description:
        "Adjust the AI's warmth, enthusiasm, and communication style to match your preferences.",
      icon: <Sparkles className='w-5 h-5 text-pink-500' />,
      category: 'communication',
      difficulty: 'intermediate',
      action: {
        label: 'Customize Personality',
        onClick: () => {
          // This would open settings to the AI personality section
          markFeatureDiscovered('personality-customization');
        },
      },
    },
  ];

  const getAvailableFeatures = () => {
    return features.filter(feature => {
      // Check if feature is already discovered
      if (discoveredFeatures.has(feature.id)) {
        return false;
      }

      // Check unlock condition
      if (feature.unlockCondition && !feature.unlockCondition()) {
        return false;
      }

      return true;
    });
  };

  const getCategoryColor = (
    category: string
  ): 'warning' | 'success' | 'default' | 'primary' | 'secondary' | 'danger' => {
    const colors: Record<
      string,
      'warning' | 'success' | 'default' | 'primary' | 'secondary' | 'danger'
    > = {
      emotional: 'danger',
      'smart-tools': 'primary',
      productivity: 'success',
      communication: 'secondary',
    };
    return colors[category] || 'default';
  };

  const getDifficultyColor = (
    difficulty: string
  ): 'warning' | 'success' | 'default' | 'primary' | 'secondary' | 'danger' => {
    const colors: Record<
      string,
      'warning' | 'success' | 'default' | 'primary' | 'secondary' | 'danger'
    > = {
      beginner: 'success',
      intermediate: 'warning',
      advanced: 'danger',
    };
    return colors[difficulty] || 'default';
  };

  const availableFeatures = getAvailableFeatures();
  const totalFeatures = features.length;
  const discoveredCount = discoveredFeatures.size;
  const progressPercentage = (discoveredCount / totalFeatures) * 100;

  if (!isVisible || availableFeatures.length === 0) {
    return null;
  }

  return (
    <Card
      className={`bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-800 ${className}`}
    >
      <CardBody className='p-4'>
        <div className='flex items-start justify-between mb-4'>
          <div>
            <h3 className='text-lg font-semibold text-foreground flex items-center gap-2'>
              <Sparkles className='w-5 h-5 text-primary-500' />
              Discover New Features
            </h3>
            <p className='text-sm text-foreground-600'>
              Unlock the full potential of your AI assistant
            </p>
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            onPress={() => setIsVisible(false)}
          >
            <X className='w-4 h-4' />
          </Button>
        </div>

        {/* Progress */}
        <div className='mb-4'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-foreground'>
              Progress: {discoveredCount}/{totalFeatures} features
            </span>
            <Chip size='sm' color='primary' variant='flat'>
              {Math.round(progressPercentage)}%
            </Chip>
          </div>
          <Progress
            value={progressPercentage}
            color='primary'
            size='sm'
            className='mb-2'
          />
        </div>

        {/* Feature List */}
        <div className='space-y-3'>
          {availableFeatures.slice(0, 3).map(feature => (
            <Card key={feature.id} className='bg-content1 border-divider'>
              <CardBody className='p-3'>
                <div className='flex items-start gap-3'>
                  <div className='flex-shrink-0 mt-1'>{feature.icon}</div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2 mb-2'>
                      <h4 className='text-sm font-medium text-foreground'>
                        {feature.title}
                      </h4>
                      <div className='flex gap-1'>
                        <Chip
                          size='sm'
                          color={getCategoryColor(feature.category)}
                          variant='flat'
                          className='text-xs'
                        >
                          {feature.category}
                        </Chip>
                        <Chip
                          size='sm'
                          color={getDifficultyColor(feature.difficulty)}
                          variant='dot'
                          className='text-xs'
                        >
                          {feature.difficulty}
                        </Chip>
                      </div>
                    </div>
                    <p className='text-xs text-foreground-600 mb-3'>
                      {feature.description}
                    </p>
                    <div className='flex items-center justify-between'>
                      {feature.action ? (
                        <Button
                          size='sm'
                          color='primary'
                          variant='flat'
                          onPress={feature.action.onClick}
                          endContent={<ChevronRight className='w-3 h-3' />}
                        >
                          {feature.action.label}
                        </Button>
                      ) : (
                        <Button
                          size='sm'
                          variant='light'
                          onPress={() => markFeatureDiscovered(feature.id)}
                          endContent={<CheckCircle className='w-3 h-3' />}
                        >
                          Mark as Discovered
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {availableFeatures.length > 3 && (
          <div className='mt-3 text-center'>
            <p className='text-xs text-foreground-500'>
              +{availableFeatures.length - 3} more features to discover
            </p>
          </div>
        )}

        {discoveredCount >= totalFeatures && (
          <div className='mt-4 text-center'>
            <div className='flex items-center justify-center gap-2 text-success'>
              <CheckCircle className='w-5 h-5' />
              <span className='text-sm font-medium'>
                All features discovered!
              </span>
            </div>
            <p className='text-xs text-foreground-600 mt-1'>
              You've unlocked the full potential of your AI assistant
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
