import React, { useState, useEffect, useRef } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Target,
  CheckCircle,
} from 'lucide-react';

interface GuidedTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  tourId: string;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isActive,
  onComplete,
  onSkip,
  tourId,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const tours: Record<string, TourStep[]> = {
    'ai-chat': [
      {
        id: 'chat-input',
        title: 'Natural Language Input',
        description:
          'Type naturally here. Try "complete my presentation task" or "how are you feeling today?"',
        target: '[data-tour="chat-input"]',
        position: 'top',
      },
      {
        id: 'action-buttons',
        title: 'Quick Action Buttons',
        description:
          'Look for these buttons in AI responses for quick actions like completing tasks or starting timers.',
        target: '[data-tour="action-buttons"]',
        position: 'left',
      },
      {
        id: 'interaction-details',
        title: 'Interaction Details',
        description:
          'Click this icon to see detailed logs of what the AI did behind the scenes.',
        target: '[data-tour="interaction-details"]',
        position: 'left',
      },
      {
        id: 'feedback-buttons',
        title: 'Feedback System',
        description: 'Rate AI responses to help improve future interactions.',
        target: '[data-tour="feedback-buttons"]',
        position: 'top',
      },
    ],
    'ai-settings': [
      {
        id: 'api-key-setup',
        title: 'API Key Configuration',
        description: 'Enter your Gemini API key here to enable AI features.',
        target: '[data-tour="api-key-input"]',
        position: 'bottom',
      },
      {
        id: 'personality-settings',
        title: 'Personality Customization',
        description:
          'Adjust these sliders to customize how the AI communicates with you.',
        target: '[data-tour="personality-sliders"]',
        position: 'left',
      },
      {
        id: 'emotional-features',
        title: 'Emotional Intelligence',
        description:
          'Enable these features for mood tracking and emotional support.',
        target: '[data-tour="emotional-toggles"]',
        position: 'left',
      },
    ],
    'task-management': [
      {
        id: 'natural-commands',
        title: 'Natural Task Commands',
        description:
          'Ask the AI to help with tasks using natural language instead of technical commands.',
        target: '[data-tour="task-list"]',
        position: 'right',
      },
      {
        id: 'smart-suggestions',
        title: 'Smart Suggestions',
        description:
          'The AI provides contextual suggestions based on your task patterns.',
        target: '[data-tour="suggestions-panel"]',
        position: 'left',
      },
    ],
  };

  const currentTour = tours[tourId] || [];
  const currentStepData = currentTour[currentStep];

  useEffect(() => {
    if (!isActive || !currentStepData) {
      setTargetElement(null);
      return;
    }

    const findTarget = () => {
      const element = document.querySelector(
        currentStepData.target
      ) as HTMLElement;
      if (element) {
        setTargetElement(element);
        updateTooltipPosition(element);

        // Scroll element into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });

        // Add highlight class
        element.classList.add('tour-highlight');
      } else {
        // Retry after a short delay if element not found
        setTimeout(findTarget, 100);
      }
    };

    findTarget();

    return () => {
      // Remove highlight class from all elements
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    };
  }, [currentStep, currentStepData, isActive]);

  const updateTooltipPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const padding = 16;

    let x = 0;
    let y = 0;

    switch (currentStepData.position) {
      case 'top':
        x = rect.left + rect.width / 2 - tooltipWidth / 2;
        y = rect.top - tooltipHeight - padding;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2 - tooltipWidth / 2;
        y = rect.bottom + padding;
        break;
      case 'left':
        x = rect.left - tooltipWidth - padding;
        y = rect.top + rect.height / 2 - tooltipHeight / 2;
        break;
      case 'right':
        x = rect.right + padding;
        y = rect.top + rect.height / 2 - tooltipHeight / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    x = Math.max(
      padding,
      Math.min(x, window.innerWidth - tooltipWidth - padding)
    );
    y = Math.max(
      padding,
      Math.min(y, window.innerHeight - tooltipHeight - padding)
    );

    setTooltipPosition({ x, y });
  };

  const handleNext = () => {
    if (currentStepData.action) {
      currentStepData.action.onClick();
    }

    if (currentStep < currentTour.length - 1) {
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
    // Mark tour as completed
    const completedTours = JSON.parse(
      localStorage.getItem('kirapilot-completed-tours') || '[]'
    );
    if (!completedTours.includes(tourId)) {
      completedTours.push(tourId);
      localStorage.setItem(
        'kirapilot-completed-tours',
        JSON.stringify(completedTours)
      );
    }
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
    onSkip();
  };

  if (!isActive || !currentStepData || !targetElement) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className='fixed inset-0 bg-black/50 z-50 pointer-events-none'
        style={{
          background: `
            radial-gradient(
              circle at ${targetElement.getBoundingClientRect().left + targetElement.getBoundingClientRect().width / 2}px 
              ${targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2}px,
              transparent 0px,
              transparent ${Math.max(targetElement.getBoundingClientRect().width, targetElement.getBoundingClientRect().height) / 2 + 8}px,
              rgba(0, 0, 0, 0.7) ${Math.max(targetElement.getBoundingClientRect().width, targetElement.getBoundingClientRect().height) / 2 + 12}px
            )
          `,
        }}
      />

      {/* Tooltip */}
      <Card
        className='fixed z-50 w-80 pointer-events-auto shadow-2xl border-primary-200 dark:border-primary-800'
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
        }}
      >
        <CardBody className='p-4'>
          <div className='flex items-start justify-between mb-3'>
            <div className='flex items-center gap-2'>
              <Target className='w-5 h-5 text-primary-500' />
              <Chip size='sm' color='primary' variant='flat'>
                Step {currentStep + 1} of {currentTour.length}
              </Chip>
            </div>
            <Button isIconOnly variant='light' size='sm' onPress={handleSkip}>
              <X className='w-4 h-4' />
            </Button>
          </div>

          <h3 className='text-lg font-semibold text-foreground mb-2'>
            {currentStepData.title}
          </h3>

          <p className='text-sm text-foreground-600 mb-4'>
            {currentStepData.description}
          </p>

          <div className='flex items-center justify-between'>
            <div>
              {currentStep > 0 && (
                <Button
                  variant='light'
                  size='sm'
                  onPress={handlePrevious}
                  startContent={<ChevronLeft className='w-4 h-4' />}
                >
                  Previous
                </Button>
              )}
            </div>

            <div className='flex items-center gap-2'>
              <Button variant='light' size='sm' onPress={handleSkip}>
                Skip Tour
              </Button>

              <Button
                color='primary'
                size='sm'
                onPress={handleNext}
                endContent={
                  currentStep < currentTour.length - 1 ? (
                    <ChevronRight className='w-4 h-4' />
                  ) : (
                    <CheckCircle className='w-4 h-4' />
                  )
                }
              >
                {currentStep < currentTour.length - 1 ? 'Next' : 'Complete'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tour-specific styles */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 51;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        
        .tour-highlight::before {
          content: '';
          position: absolute;
          inset: -4px;
          border: 2px solid rgb(59, 130, 246);
          border-radius: 8px;
          pointer-events: none;
          animation: tour-pulse 2s infinite;
        }
        
        @keyframes tour-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.02);
          }
        }
      `}</style>
    </>
  );
};

// Hook to manage guided tours
export const useGuidedTour = () => {
  const [activeTour, setActiveTour] = useState<string | null>(null);

  const startTour = (tourId: string) => {
    const completedTours = JSON.parse(
      localStorage.getItem('kirapilot-completed-tours') || '[]'
    );
    if (!completedTours.includes(tourId)) {
      setActiveTour(tourId);
    }
  };

  const stopTour = () => {
    setActiveTour(null);
  };

  const isCompleted = (tourId: string) => {
    const completedTours = JSON.parse(
      localStorage.getItem('kirapilot-completed-tours') || '[]'
    );
    return completedTours.includes(tourId);
  };

  return {
    activeTour,
    startTour,
    stopTour,
    isCompleted,
  };
};
