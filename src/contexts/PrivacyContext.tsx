import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export interface PrivacySettings {
  aiDataUsage: boolean;
  conversationRetention: boolean;
  analyticsCollection: boolean;
  crashReporting: boolean;
  performanceMetrics: boolean;
}

interface PrivacyContextType {
  settings: PrivacySettings;
  updateSettings: (newSettings: Partial<PrivacySettings>) => void;
  resetSettings: () => void;
  isDataCollectionAllowed: () => boolean;
  isAIDataUsageAllowed: () => boolean;
  shouldRetainConversations: () => boolean;
  shouldCollectAnalytics: () => boolean;
  shouldReportCrashes: () => boolean;
  shouldCollectPerformanceMetrics: () => boolean;
}

const defaultPrivacySettings: PrivacySettings = {
  aiDataUsage: true,
  conversationRetention: true,
  analyticsCollection: false,
  crashReporting: true,
  performanceMetrics: false,
};

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

interface PrivacyProviderProps {
  children: ReactNode;
}

export function PrivacyProvider({ children }: PrivacyProviderProps) {
  const [settings, setSettings] = useState<PrivacySettings>(
    defaultPrivacySettings
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('kirapilot-privacy-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultPrivacySettings, ...parsed });
      } catch (error) {
        console.error('Failed to load privacy settings:', error);
        setSettings(defaultPrivacySettings);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      'kirapilot-privacy-settings',
      JSON.stringify(settings)
    );
  }, [settings]);

  const updateSettings = (newSettings: Partial<PrivacySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(defaultPrivacySettings);
    localStorage.removeItem('kirapilot-privacy-settings');
  };

  // Helper functions for checking specific privacy settings
  const isDataCollectionAllowed = () => {
    return settings.analyticsCollection || settings.performanceMetrics;
  };

  const isAIDataUsageAllowed = () => {
    return settings.aiDataUsage;
  };

  const shouldRetainConversations = () => {
    return settings.conversationRetention;
  };

  const shouldCollectAnalytics = () => {
    return settings.analyticsCollection;
  };

  const shouldReportCrashes = () => {
    return settings.crashReporting;
  };

  const shouldCollectPerformanceMetrics = () => {
    return settings.performanceMetrics;
  };

  const value: PrivacyContextType = {
    settings,
    updateSettings,
    resetSettings,
    isDataCollectionAllowed,
    isAIDataUsageAllowed,
    shouldRetainConversations,
    shouldCollectAnalytics,
    shouldReportCrashes,
    shouldCollectPerformanceMetrics,
  };

  return (
    <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextType {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}

// Privacy-aware logging utility
export function logWithPrivacy(
  message: string,
  data?: unknown,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  // Get privacy settings from localStorage directly to avoid circular dependencies
  const stored = localStorage.getItem('kirapilot-privacy-settings');
  let settings = defaultPrivacySettings;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      settings = { ...defaultPrivacySettings, ...parsed };
    } catch {
      // Use defaults if parsing fails
    }
  }

  // Only log if crash reporting is enabled for errors, or performance metrics for other logs
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
}

// Privacy-aware analytics utility
export function trackEventWithPrivacy(
  eventName: string,
  properties?: Record<string, unknown>
) {
  const stored = localStorage.getItem('kirapilot-privacy-settings');
  let settings = defaultPrivacySettings;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      settings = { ...defaultPrivacySettings, ...parsed };
    } catch {
      // Use defaults if parsing fails
    }
  }

  if (settings.analyticsCollection) {
    // Here you would integrate with your analytics service
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', eventName, properties);
    }

    // In production, you would send to your analytics service:
    // analytics.track(eventName, properties);
  }
}

// Privacy-aware error reporting utility
export function reportErrorWithPrivacy(
  error: Error,
  context?: Record<string, unknown>
) {
  const stored = localStorage.getItem('kirapilot-privacy-settings');
  let settings = defaultPrivacySettings;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      settings = { ...defaultPrivacySettings, ...parsed };
    } catch {
      // Use defaults if parsing fails
    }
  }

  if (settings.crashReporting) {
    // Here you would integrate with your error reporting service
    // For now, we'll just log to console
    console.error('Error Report:', error.message, error.stack, context);

    // In production, you would send to your error reporting service:
    // errorReporting.captureException(error, { extra: context });
  }
}
