import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { UserPreferences, DistractionLevel, Priority } from '../types';

interface SettingsContextType {
  preferences: UserPreferences;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => Promise<void>;
  updateNestedPreference: <K extends keyof UserPreferences>(
    parentKey: K,
    childKey: string,
    value: unknown
  ) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const defaultPreferences: UserPreferences = {
  workingHours: {
    start: '09:00',
    end: '17:00',
  },
  breakPreferences: {
    shortBreakDuration: 5,
    longBreakDuration: 15,
    breakInterval: 25,
  },
  focusPreferences: {
    defaultDuration: 25,
    distractionLevel: DistractionLevel.MINIMAL,
    backgroundAudio: {
      type: 'white_noise',
      volume: 50,
    },
  },
  notifications: {
    breakReminders: true,
    taskDeadlines: true,
    dailySummary: false,
    weeklyReview: true,
  },
  aiSettings: {
    conversationHistory: true,
    autoSuggestions: true,
    toolPermissions: true,
    responseStyle: 'balanced',
    suggestionFrequency: 'moderate',
  },
  taskSettings: {
    defaultPriority: Priority.MEDIUM,
    autoScheduling: false,
    smartDependencies: true,
    weekStartDay: 1, // Monday
    showCompletedTasks: true,
    compactView: false,
  },
  theme: 'dark',
  language: 'en',
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to load from localStorage
      const stored = localStorage.getItem('kirapilot-preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        const mergedPreferences = { ...defaultPreferences, ...parsed };
        setPreferences(mergedPreferences);
      }

      // TODO: Load from database when preferences table is implemented
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Failed to load settings');
      setPreferences(defaultPreferences);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePreferences = (prefs: UserPreferences): boolean => {
    try {
      // Validate working hours
      const startTime = new Date(`1970-01-01T${prefs.workingHours.start}:00`);
      const endTime = new Date(`1970-01-01T${prefs.workingHours.end}:00`);
      if (startTime >= endTime) {
        throw new Error('End time must be after start time');
      }

      // Validate break preferences
      if (
        prefs.breakPreferences.shortBreakDuration < 1 ||
        prefs.breakPreferences.shortBreakDuration > 30
      ) {
        throw new Error(
          'Short break duration must be between 1 and 30 minutes'
        );
      }
      if (
        prefs.breakPreferences.longBreakDuration < 5 ||
        prefs.breakPreferences.longBreakDuration > 60
      ) {
        throw new Error('Long break duration must be between 5 and 60 minutes');
      }
      if (
        prefs.breakPreferences.breakInterval < 10 ||
        prefs.breakPreferences.breakInterval > 120
      ) {
        throw new Error('Break interval must be between 10 and 120 minutes');
      }

      // Validate focus preferences
      if (
        prefs.focusPreferences.defaultDuration < 5 ||
        prefs.focusPreferences.defaultDuration > 180
      ) {
        throw new Error(
          'Default session duration must be between 5 and 180 minutes'
        );
      }
      if (
        prefs.focusPreferences.backgroundAudio.volume < 0 ||
        prefs.focusPreferences.backgroundAudio.volume > 100
      ) {
        throw new Error('Volume must be between 0 and 100');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid settings');
      return false;
    }
  };

  const updatePreferences = async (newPreferences: UserPreferences) => {
    try {
      setError(null);

      if (!validatePreferences(newPreferences)) {
        return;
      }

      // Save to localStorage
      localStorage.setItem(
        'kirapilot-preferences',
        JSON.stringify(newPreferences)
      );

      // TODO: Save to database when preferences table is implemented

      setPreferences(newPreferences);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    await updatePreferences(newPreferences);
  };

  const updateNestedPreference = async <K extends keyof UserPreferences>(
    parentKey: K,
    childKey: string,
    value: unknown
  ) => {
    const parentValue = preferences[parentKey];
    if (parentValue && typeof parentValue === 'object') {
      const newPreferences = {
        ...preferences,
        [parentKey]: {
          ...parentValue,
          [childKey]: value,
        },
      };
      await updatePreferences(newPreferences);
    }
  };

  const resetToDefaults = async () => {
    await updatePreferences(defaultPreferences);
  };

  const value: SettingsContextType = {
    preferences,
    updatePreferences,
    updatePreference,
    updateNestedPreference,
    resetToDefaults,
    isLoading,
    error,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
