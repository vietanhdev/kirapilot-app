import { UserPreferences, DistractionLevel, Priority } from '../types';

/**
 * Create default user preferences for testing
 */
export function createTestUserPreferences(
  overrides?: Partial<UserPreferences>
): UserPreferences {
  const defaults: UserPreferences = {
    workingHours: { start: '09:00', end: '17:00' },
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
      modelType: 'gemini',
      geminiApiKey: undefined,
      localModelConfig: {
        threads: 4,
        contextSize: 4096,
        temperature: 0.7,
        maxTokens: 512,
      },
    },
    taskSettings: {
      defaultPriority: Priority.MEDIUM,
      autoScheduling: false,
      smartDependencies: true,
      weekStartDay: 1,
      showCompletedTasks: true,
      compactView: false,
    },
    dateFormat: 'DD/MM/YYYY',
    theme: 'dark',
    language: 'en',
  };

  return { ...defaults, ...overrides };
}
