import { usePrivacy } from '../contexts/PrivacyContext';

/**
 * Hook to make components privacy-aware
 */
export function usePrivacyAware() {
  const { settings } = usePrivacy();

  // Privacy-aware logging
  const logWithPrivacy = (
    message: string,
    data?: unknown,
    level: 'info' | 'warn' | 'error' = 'info'
  ) => {
    const shouldLog =
      level === 'error' ? settings.crashReporting : settings.performanceMetrics;

    if (shouldLog) {
      const logFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      if (data) {
        logFn(message, data);
      } else {
        logFn(message);
      }
    }
  };

  // Privacy-aware analytics
  const trackEvent = (
    eventName: string,
    properties?: Record<string, unknown>
  ) => {
    if (settings.analyticsCollection) {
      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.log('Analytics Event:', eventName, properties);
      }
      // In production, you would send to your analytics service
    }
  };

  // Check if AI features should be enabled
  const isAIEnabled = () => settings.aiDataUsage;

  // Check if conversations should be retained
  const shouldRetainConversations = () => settings.conversationRetention;

  // Check if crash reporting is enabled
  const shouldReportCrashes = () => settings.crashReporting;

  return {
    settings,
    logWithPrivacy,
    trackEvent,
    isAIEnabled,
    shouldRetainConversations,
    shouldReportCrashes,
  };
}
