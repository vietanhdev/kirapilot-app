import { useSettings } from '../contexts/SettingsContext';

/**
 * Hook to access user preferences throughout the application
 * This is a convenience hook that provides easy access to settings
 */
export const useUserPreferences = () => {
  const { preferences, updatePreference, updateNestedPreference } =
    useSettings();

  return {
    // Direct access to all preferences
    preferences,

    // Convenience getters for commonly used settings
    theme: preferences.theme,
    language: preferences.language,
    workingHours: preferences.workingHours,
    defaultPriority: preferences.taskSettings.defaultPriority,
    autoScheduling: preferences.taskSettings.autoScheduling,
    weekStartDay: preferences.taskSettings.weekStartDay,
    showCompletedTasks: preferences.taskSettings.showCompletedTasks,
    compactView: preferences.taskSettings.compactView,

    // Timer and focus settings
    defaultSessionDuration: preferences.focusPreferences.defaultDuration,
    breakInterval: preferences.breakPreferences.breakInterval,
    shortBreakDuration: preferences.breakPreferences.shortBreakDuration,
    longBreakDuration: preferences.breakPreferences.longBreakDuration,

    // AI settings
    aiConversationHistory: preferences.aiSettings.conversationHistory,
    aiAutoSuggestions: preferences.aiSettings.autoSuggestions,
    aiToolPermissions: preferences.aiSettings.toolPermissions,
    aiResponseStyle: preferences.aiSettings.responseStyle,
    aiSuggestionFrequency: preferences.aiSettings.suggestionFrequency,

    // Notification settings
    breakReminders: preferences.notifications.breakReminders,
    taskDeadlines: preferences.notifications.taskDeadlines,
    dailySummary: preferences.notifications.dailySummary,
    weeklyReview: preferences.notifications.weeklyReview,

    // Update functions
    updatePreference,
    updateNestedPreference,
  };
};
