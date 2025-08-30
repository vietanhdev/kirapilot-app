import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress,
  Card,
  CardBody,
  Chip,
} from '@heroui/react';
import {
  Sparkles,
  Heart,
  Brain,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Bot,
  Zap,
  Target,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialStep?: number;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  canSkip?: boolean;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialStep = 0,
}) => {
  const { preferences, updateNestedPreference } = useSettings();
  const [currentStep, setCurrentStep] = useState(initialStep);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Enhanced AI Experience',
      description:
        "Discover how KiraPilot's AI can become your supportive productivity companion",
      icon: <Sparkles className='w-6 h-6 text-primary-500' />,
      content: (
        <div className='text-center space-y-4'>
          <div className='w-20 h-20 mx-auto bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center'>
            <Bot className='w-10 h-10 text-white' />
          </div>
          <h3 className='text-xl font-semibold text-foreground'>
            Meet Your New AI Assistant
          </h3>
          <p className='text-foreground-600 max-w-md mx-auto'>
            Your AI assistant has been enhanced with emotional intelligence,
            smart task matching, and personalized insights to help you be more
            productive.
          </p>
          <div className='grid grid-cols-3 gap-4 mt-6'>
            <div className='text-center'>
              <Heart className='w-8 h-8 text-red-500 mx-auto mb-2' />
              <p className='text-sm text-foreground-600'>Emotional Support</p>
            </div>
            <div className='text-center'>
              <Brain className='w-8 h-8 text-blue-500 mx-auto mb-2' />
              <p className='text-sm text-foreground-600'>Smart Insights</p>
            </div>
            <div className='text-center'>
              <Zap className='w-8 h-8 text-yellow-500 mx-auto mb-2' />
              <p className='text-sm text-foreground-600'>Quick Actions</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'emotional-intelligence',
      title: 'Emotional Intelligence Features',
      description: 'Learn how AI can support your well-being and motivation',
      icon: <Heart className='w-6 h-6 text-red-500' />,
      content: (
        <div className='space-y-6'>
          <div className='text-center'>
            <Heart className='w-16 h-16 text-red-500 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              Emotional Intelligence & Well-being
            </h3>
            <p className='text-foreground-600 mb-6'>
              Your AI assistant now understands emotions and provides supportive
              responses
            </p>
          </div>

          <div className='space-y-4'>
            <Card className='bg-content2'>
              <CardBody className='p-4'>
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0'>
                    <MessageCircle className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                  </div>
                  <div>
                    <h4 className='font-medium text-foreground'>
                      Daily Mood Check-ins
                    </h4>
                    <p className='text-sm text-foreground-600'>
                      Start each day by sharing how you're feeling. The AI will
                      adapt its responses accordingly.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className='bg-content2'>
              <CardBody className='p-4'>
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0'>
                    <Target className='w-4 h-4 text-green-600 dark:text-green-400' />
                  </div>
                  <div>
                    <h4 className='font-medium text-foreground'>
                      Stress Detection
                    </h4>
                    <p className='text-sm text-foreground-600'>
                      The AI recognizes when you might be overwhelmed and offers
                      helpful suggestions.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className='bg-content2'>
              <CardBody className='p-4'>
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0'>
                    <Sparkles className='w-4 h-4 text-purple-600 dark:text-purple-400' />
                  </div>
                  <div>
                    <h4 className='font-medium text-foreground'>
                      Celebrations & Encouragement
                    </h4>
                    <p className='text-sm text-foreground-600'>
                      Get recognized for your achievements and receive
                      motivation when you need it most.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: 'smart-tools',
      title: 'Smart Task Management',
      description: 'Discover intuitive ways to interact with your tasks',
      icon: <Brain className='w-6 h-6 text-blue-500' />,
      content: (
        <div className='space-y-6'>
          <div className='text-center'>
            <Brain className='w-16 h-16 text-blue-500 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              Smart Task Management
            </h3>
            <p className='text-foreground-600 mb-6'>
              No more technical IDs or complex commands - just natural
              conversation
            </p>
          </div>

          <div className='space-y-4'>
            <div className='bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg'>
              <h4 className='font-medium text-foreground mb-2'>
                Natural Language Task References
              </h4>
              <div className='space-y-2 text-sm'>
                <div className='flex items-center gap-2'>
                  <Chip size='sm' color='primary' variant='flat'>
                    You say:
                  </Chip>
                  <span className='text-foreground-600'>
                    "Complete the presentation task"
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <Chip size='sm' color='success' variant='flat'>
                    AI finds:
                  </Chip>
                  <span className='text-foreground-600'>
                    📊 Prepare Q4 presentation
                  </span>
                </div>
              </div>
            </div>

            <div className='bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg'>
              <h4 className='font-medium text-foreground mb-2'>
                Smart Confirmation Dialogs
              </h4>
              <p className='text-sm text-foreground-600'>
                Before making changes, the AI shows you exactly what will happen
                with clear previews and options to cancel or modify.
              </p>
            </div>

            <div className='bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg'>
              <h4 className='font-medium text-foreground mb-2'>
                Contextual Action Buttons
              </h4>
              <p className='text-sm text-foreground-600'>
                Quick action buttons appear in chat for common tasks like
                completing items, starting timers, or creating new tasks.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'personality-setup',
      title: 'Customize AI Personality',
      description: 'Make the AI assistant feel right for you',
      icon: <MessageCircle className='w-6 h-6 text-green-500' />,
      content: (
        <div className='space-y-6'>
          <div className='text-center'>
            <MessageCircle className='w-16 h-16 text-green-500 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              Personalize Your AI Assistant
            </h3>
            <p className='text-foreground-600 mb-6'>
              Adjust the AI's personality to match your preferred communication
              style
            </p>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                Communication Style
              </label>
              <div className='grid grid-cols-3 gap-2'>
                {['casual', 'professional', 'friendly'].map(style => (
                  <Button
                    key={style}
                    variant={
                      preferences.aiSettings.interactionStyle === style
                        ? 'solid'
                        : 'bordered'
                    }
                    color={
                      preferences.aiSettings.interactionStyle === style
                        ? 'primary'
                        : 'default'
                    }
                    size='sm'
                    onPress={() =>
                      updateNestedPreference(
                        'aiSettings',
                        'interactionStyle',
                        style
                      )
                    }
                    className='capitalize'
                  >
                    {style}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                Warmth Level:{' '}
                {preferences.aiSettings.personalitySettings?.warmth || 6}/10
              </label>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-foreground-600'>Reserved</span>
                <input
                  type='range'
                  min='1'
                  max='10'
                  value={
                    preferences.aiSettings.personalitySettings?.warmth || 6
                  }
                  onChange={e =>
                    updateNestedPreference(
                      'aiSettings',
                      'personalitySettings',
                      {
                        ...preferences.aiSettings.personalitySettings,
                        warmth: parseInt(e.target.value),
                      }
                    )
                  }
                  className='flex-1'
                />
                <span className='text-xs text-foreground-600'>Warm</span>
              </div>
            </div>

            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                Enthusiasm Level:{' '}
                {preferences.aiSettings.personalitySettings?.enthusiasm || 6}/10
              </label>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-foreground-600'>Calm</span>
                <input
                  type='range'
                  min='1'
                  max='10'
                  value={
                    preferences.aiSettings.personalitySettings?.enthusiasm || 6
                  }
                  onChange={e =>
                    updateNestedPreference(
                      'aiSettings',
                      'personalitySettings',
                      {
                        ...preferences.aiSettings.personalitySettings,
                        enthusiasm: parseInt(e.target.value),
                      }
                    )
                  }
                  className='flex-1'
                />
                <span className='text-xs text-foreground-600'>Energetic</span>
              </div>
            </div>

            <div className='bg-content2 p-4 rounded-lg'>
              <h4 className='font-medium text-foreground mb-2'>Preview</h4>
              <p className='text-sm text-foreground-600 italic'>
                {getPersonalityPreview(preferences.aiSettings)}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'complete',
      title: "You're All Set!",
      description: 'Start enjoying your enhanced AI experience',
      icon: <CheckCircle className='w-6 h-6 text-success' />,
      content: (
        <div className='text-center space-y-6'>
          <div className='w-20 h-20 mx-auto bg-gradient-to-br from-success-400 to-success-600 rounded-full flex items-center justify-center'>
            <CheckCircle className='w-10 h-10 text-white' />
          </div>
          <div>
            <h3 className='text-xl font-semibold text-foreground mb-2'>
              Welcome to Your Enhanced AI Experience!
            </h3>
            <p className='text-foreground-600 max-w-md mx-auto'>
              Your AI assistant is now ready to provide emotional support, smart
              task management, and personalized insights to boost your
              productivity.
            </p>
          </div>

          <div className='bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 p-4 rounded-lg'>
            <h4 className='font-medium text-foreground mb-2'>
              Quick Tips to Get Started:
            </h4>
            <ul className='text-sm text-foreground-600 space-y-1 text-left'>
              <li>
                • Try saying "How are you feeling today?" to start a mood
                check-in
              </li>
              <li>
                • Ask "Complete my presentation task" to see smart task matching
              </li>
              <li>
                • Look for action buttons in AI responses for quick interactions
              </li>
              <li>
                • Check the details icon (ℹ️) next to messages to see how the AI
                works
              </li>
            </ul>
          </div>

          <p className='text-xs text-foreground-500'>
            You can always adjust these settings later in the AI section of
            Settings.
          </p>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as completed
    updateNestedPreference('aiSettings', 'onboardingCompleted', true);
    onComplete();
  };

  const handleSkip = () => {
    updateNestedPreference('aiSettings', 'onboardingCompleted', true);
    onClose();
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='2xl'
      classNames={{
        backdrop:
          'bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20',
        base: 'border-[#292f46] bg-content1 dark:bg-content1 text-foreground',
        header: 'border-b-[1px] border-divider',
        footer: 'border-t-[1px] border-divider',
        closeButton: 'hover:bg-white/5 active:bg-white/10',
      }}
      hideCloseButton={currentStep === 0}
      isDismissable={false}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <div className='flex items-center justify-between w-full'>
            <div className='flex items-center gap-3'>
              {currentStepData.icon}
              <div>
                <h2 className='text-lg font-semibold'>
                  {currentStepData.title}
                </h2>
                <p className='text-sm text-foreground-600'>
                  {currentStepData.description}
                </p>
              </div>
            </div>
            <div className='text-right'>
              <p className='text-xs text-foreground-500'>
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
          </div>
          <Progress
            value={progress}
            className='mt-3'
            color='primary'
            size='sm'
          />
        </ModalHeader>

        <ModalBody className='py-6'>{currentStepData.content}</ModalBody>

        <ModalFooter>
          <div className='flex items-center justify-between w-full'>
            <div>
              {currentStep > 0 && (
                <Button
                  variant='light'
                  onPress={handlePrevious}
                  startContent={<ChevronLeft className='w-4 h-4' />}
                >
                  Previous
                </Button>
              )}
            </div>

            <div className='flex items-center gap-2'>
              {currentStepData.canSkip !== false &&
                currentStep < steps.length - 1 && (
                  <Button variant='light' onPress={handleSkip} size='sm'>
                    Skip Tour
                  </Button>
                )}

              <Button
                color='primary'
                onPress={handleNext}
                endContent={
                  currentStep < steps.length - 1 ? (
                    <ChevronRight className='w-4 h-4' />
                  ) : (
                    <CheckCircle className='w-4 h-4' />
                  )
                }
              >
                {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

function getPersonalityPreview(aiSettings: {
  personalitySettings?: { warmth?: number; enthusiasm?: number };
  interactionStyle?: string;
}): string {
  const warmth = aiSettings.personalitySettings?.warmth || 6;
  const enthusiasm = aiSettings.personalitySettings?.enthusiasm || 6;
  const style = aiSettings.interactionStyle || 'friendly';

  if (style === 'professional') {
    if (warmth > 7) {
      return "I'm here to help you achieve your goals efficiently while maintaining a supportive approach.";
    } else {
      return "I'll assist you with your tasks in a structured and professional manner.";
    }
  } else if (style === 'casual') {
    if (enthusiasm > 7) {
      return "Hey! I'm super excited to help you crush your tasks today! 🚀";
    } else {
      return 'Hey there! Ready to tackle some tasks together?';
    }
  } else {
    // friendly
    if (warmth > 7 && enthusiasm > 7) {
      return "I'm so happy to be working with you! Let's make today amazing and get things done! ✨";
    } else if (warmth > 7) {
      return "I'm here to support you every step of the way. How can I help you today?";
    } else {
      return "I'm ready to help you with your tasks. What would you like to work on?";
    }
  }
}
