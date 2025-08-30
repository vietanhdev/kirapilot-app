import React, { useState, useEffect } from 'react';
import { OnboardingFlow } from './OnboardingFlow';
import { GuidedTour, useGuidedTour } from './GuidedTour';
import { WelcomeBanner } from './WelcomeBanner';
import { FeatureDiscovery } from './FeatureDiscovery';

import { useSettings } from '../../contexts/SettingsContext';

interface OnboardingManagerProps {
  children: React.ReactNode;
  currentPage?: 'chat' | 'settings' | 'tasks' | 'timer' | 'general';
}

export const OnboardingManager: React.FC<OnboardingManagerProps> = ({
  children,
  currentPage = 'general',
}) => {
  const { preferences } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const { activeTour, startTour, stopTour } = useGuidedTour();

  // Check if user needs onboarding
  useEffect(() => {
    const hasCompletedOnboarding = preferences.aiSettings?.onboardingCompleted;

    // Show onboarding for new users or users without API key
    if (!hasCompletedOnboarding) {
      setShowOnboarding(false); // Don't auto-show, let user trigger it
      setShowWelcomeBanner(true);
    } else {
      setShowWelcomeBanner(false);
    }
  }, [preferences]);

  const handleStartOnboarding = () => {
    setShowOnboarding(true);
    setShowWelcomeBanner(false);
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    setShowWelcomeBanner(false);

    // Optionally start a tour after onboarding
    if (currentPage === 'chat') {
      setTimeout(() => startTour('ai-chat'), 1000);
    }
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    setShowWelcomeBanner(false);
  };

  const handleStartTour = (tourId: string) => {
    setShowWelcomeBanner(false);
    startTour(tourId);
  };

  return (
    <>
      {children}

      {/* Welcome Banner */}
      {showWelcomeBanner && (
        <div className='fixed top-4 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4'>
          <WelcomeBanner
            onStartOnboarding={handleStartOnboarding}
            onStartTour={handleStartTour}
          />
        </div>
      )}

      {/* Feature Discovery Panel */}
      {!showWelcomeBanner && preferences.aiSettings?.onboardingCompleted && (
        <div className='fixed bottom-4 right-4 z-30 w-80'>
          <FeatureDiscovery />
        </div>
      )}

      {/* Onboarding Flow Modal */}
      <OnboardingFlow
        isOpen={showOnboarding}
        onClose={handleSkipOnboarding}
        onComplete={handleCompleteOnboarding}
      />

      {/* Guided Tour */}
      {activeTour && (
        <GuidedTour
          isActive={true}
          tourId={activeTour}
          onComplete={stopTour}
          onSkip={stopTour}
        />
      )}
    </>
  );
};

// Hook to provide onboarding utilities to components
export const useOnboarding = () => {
  const { preferences, updateNestedPreference } = useSettings();
  const { startTour, isCompleted: isTourCompleted } = useGuidedTour();

  const isOnboardingCompleted =
    preferences.aiSettings?.onboardingCompleted || false;

  const markOnboardingCompleted = () => {
    updateNestedPreference('aiSettings', 'onboardingCompleted', true);
  };

  const resetOnboarding = () => {
    updateNestedPreference('aiSettings', 'onboardingCompleted', false);
    localStorage.removeItem('kirapilot-dismissed-banners');
    localStorage.removeItem('kirapilot-completed-tours');
    localStorage.removeItem('kirapilot-discovered-features');
    localStorage.removeItem('kirapilot-dismissed-help-tips');
  };

  const shouldShowHelp = (context: string) => {
    // Show contextual help if onboarding is completed but user hasn't seen specific context
    return isOnboardingCompleted && !isTourCompleted(`${context}-tour`);
  };

  return {
    isOnboardingCompleted,
    markOnboardingCompleted,
    resetOnboarding,
    startTour,
    isTourCompleted,
    shouldShowHelp,
  };
};
