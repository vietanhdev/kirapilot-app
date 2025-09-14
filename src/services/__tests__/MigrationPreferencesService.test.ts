import { MigrationPreferencesServiceImpl } from '../MigrationPreferencesService';
import {
  MigrationPreferences,
  UserPreferences,
  Priority,
  DistractionLevel,
} from '../../types';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  const mock = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Expose store for testing
    get store() {
      return store;
    },
    set store(newStore: Record<string, string>) {
      store = newStore;
      // Update the mock implementation to use the new store
      mock.getItem.mockImplementation((key: string) => store[key] || null);
    },
  };

  return mock;
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('MigrationPreferencesService', () => {
  let service: MigrationPreferencesServiceImpl;
  let mockUserPreferences: UserPreferences;
  let mockUpdateUserPreferences: jest.Mock;
  let mockGetUserPreferences: jest.Mock;

  const defaultUserPreferences: UserPreferences = {
    workingHours: { start: '09:00', end: '17:00' },
    breakPreferences: {
      shortBreakDuration: 5,
      longBreakDuration: 15,
      breakInterval: 25,
    },
    focusPreferences: {
      defaultDuration: 25,
      distractionLevel: DistractionLevel.MINIMAL,
      backgroundAudio: { type: 'white_noise', volume: 50 },
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
      showInteractionLogs: false,
      onboardingCompleted: false,
    },
    taskSettings: {
      defaultPriority: Priority.MEDIUM,
      autoScheduling: false,
      smartDependencies: true,
      weekStartDay: 1,
      showCompletedTasks: true,
      compactView: false,
    },
    migrationSettings: {
      enabled: true,
      dismissedWeeks: [],
      autoSuggestScheduling: true,
      showDependencyWarnings: true,
    },
    soundSettings: {
      hapticFeedback: true,
      completionSound: true,
      soundVolume: 50,
    },
    dateFormat: 'DD/MM/YYYY',
    theme: 'dark',
    language: 'en',
  };

  beforeEach(() => {
    service = new MigrationPreferencesServiceImpl();
    // Deep clone to avoid mutation between tests
    mockUserPreferences = JSON.parse(JSON.stringify(defaultUserPreferences));
    mockUpdateUserPreferences = jest.fn();
    mockGetUserPreferences = jest.fn(() => mockUserPreferences);

    // Initialize the service
    service.initialize(mockGetUserPreferences, mockUpdateUserPreferences);

    // Clear the store and reset all mocks
    mockLocalStorage.store = {};
    jest.clearAllMocks();

    // Reset console spies if any exist
    if (jest.isMockFunction(console.error)) {
      (
        console.error as jest.MockedFunction<typeof console.error>
      ).mockRestore();
    }
    if (jest.isMockFunction(console.warn)) {
      (console.warn as jest.MockedFunction<typeof console.warn>).mockRestore();
    }
  });

  describe('getPreferences', () => {
    it('should return preferences from UserPreferences', async () => {
      const preferences = await service.getPreferences();

      expect(preferences).toEqual({
        enabled: true,
        dismissedWeeks: new Set<string>(),
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      });
      expect(mockGetUserPreferences).toHaveBeenCalled();
    });

    it('should convert dismissed weeks array to Set', async () => {
      mockUserPreferences.migrationSettings.dismissedWeeks = [
        '2024-01-01',
        '2024-01-08',
      ];

      const preferences = await service.getPreferences();

      expect(preferences.dismissedWeeks).toEqual(
        new Set(['2024-01-01', '2024-01-08'])
      );
    });

    it('should handle empty dismissed weeks array', async () => {
      mockUserPreferences.migrationSettings.dismissedWeeks = [];

      const preferences = await service.getPreferences();

      expect(preferences.dismissedWeeks).toEqual(new Set<string>());
    });

    it('should throw error when service not initialized', async () => {
      const uninitializedService = new MigrationPreferencesServiceImpl();

      await expect(uninitializedService.getPreferences()).rejects.toThrow(
        'MigrationPreferencesService not initialized. Call initialize() first.'
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences through UserPreferences', async () => {
      const updates: Partial<MigrationPreferences> = {
        enabled: false,
        autoSuggestScheduling: false,
      };

      await service.updatePreferences(updates);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: false,
          dismissedWeeks: [],
          autoSuggestScheduling: false,
          showDependencyWarnings: true, // preserved
        },
      });
    });

    it('should merge with existing preferences', async () => {
      mockUserPreferences.migrationSettings = {
        enabled: true,
        dismissedWeeks: ['2024-01-01'],
        autoSuggestScheduling: true,
        showDependencyWarnings: false,
      };

      const updates: Partial<MigrationPreferences> = {
        enabled: false,
      };

      await service.updatePreferences(updates);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: false, // updated
          dismissedWeeks: ['2024-01-01'], // preserved
          autoSuggestScheduling: true, // preserved
          showDependencyWarnings: false, // preserved
        },
      });
    });

    it('should handle Set conversion for dismissedWeeks', async () => {
      const updates: Partial<MigrationPreferences> = {
        dismissedWeeks: new Set(['2024-01-01', '2024-01-08']),
      };

      await service.updatePreferences(updates);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: ['2024-01-01', '2024-01-08'],
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should throw error when UserPreferences update fails', async () => {
      mockUpdateUserPreferences.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        service.updatePreferences({ enabled: false })
      ).rejects.toThrow('Failed to save migration preferences');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update migration preferences:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when service not initialized', async () => {
      const uninitializedService = new MigrationPreferencesServiceImpl();

      await expect(
        uninitializedService.updatePreferences({ enabled: false })
      ).rejects.toThrow(
        'MigrationPreferencesService not initialized. Call initialize() first.'
      );
    });
  });

  describe('addDismissedWeek', () => {
    it('should add week identifier to dismissed weeks', async () => {
      const weekId = '2024-01-01';

      await service.addDismissedWeek(weekId);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: [weekId],
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should add to existing dismissed weeks', async () => {
      mockUserPreferences.migrationSettings.dismissedWeeks = ['2024-01-01'];

      await service.addDismissedWeek('2024-01-08');

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: ['2024-01-01', '2024-01-08'],
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should not add duplicate week identifiers', async () => {
      mockUserPreferences.migrationSettings.dismissedWeeks = ['2024-01-01'];

      await service.addDismissedWeek('2024-01-01');

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: ['2024-01-01'], // no duplicate
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should throw error when update fails', async () => {
      mockUpdateUserPreferences.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.addDismissedWeek('2024-01-01')).rejects.toThrow(
        'Failed to save dismissed week'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearDismissedWeeks', () => {
    it('should clear all dismissed weeks', async () => {
      mockUserPreferences.migrationSettings.dismissedWeeks = [
        '2024-01-01',
        '2024-01-08',
      ];

      await service.clearDismissedWeeks();

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: [], // cleared
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should throw error when update fails', async () => {
      mockUpdateUserPreferences.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.clearDismissedWeeks()).rejects.toThrow(
        'Failed to clear dismissed weeks'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset preferences to defaults', async () => {
      await service.resetToDefaults();

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        ...mockUserPreferences,
        migrationSettings: {
          enabled: true,
          dismissedWeeks: [],
          autoSuggestScheduling: true,
          showDependencyWarnings: true,
        },
      });
    });

    it('should throw error when update fails', async () => {
      mockUpdateUserPreferences.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.resetToDefaults()).rejects.toThrow(
        'Failed to reset migration preferences'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('shouldShowMigrationPrompt', () => {
    it('should return true when migration is enabled and week not dismissed', async () => {
      mockUserPreferences.migrationSettings = {
        enabled: true,
        dismissedWeeks: ['2024-01-01'],
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      };

      const result = await service.shouldShowMigrationPrompt('2024-01-08');

      expect(result).toBe(true);
    });

    it('should return false when migration is disabled', async () => {
      mockUserPreferences.migrationSettings = {
        enabled: false,
        dismissedWeeks: [],
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      };

      const result = await service.shouldShowMigrationPrompt('2024-01-08');

      expect(result).toBe(false);
    });

    it('should return false when week is dismissed', async () => {
      mockUserPreferences.migrationSettings = {
        enabled: true,
        dismissedWeeks: ['2024-01-08'],
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      };

      const result = await service.shouldShowMigrationPrompt('2024-01-08');

      expect(result).toBe(false);
    });

    it('should return true with default preferences', async () => {
      const result = await service.shouldShowMigrationPrompt('2024-01-08');

      expect(result).toBe(true); // defaults to enabled=true, no dismissed weeks
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: get -> update -> add dismissed -> clear', async () => {
      // Start with defaults
      let preferences = await service.getPreferences();
      expect(preferences.enabled).toBe(true);
      expect(preferences.dismissedWeeks.size).toBe(0);

      // Update some preferences
      await service.updatePreferences({
        enabled: false,
        autoSuggestScheduling: false,
      });

      // Simulate the updated preferences being reflected in mockUserPreferences
      mockUserPreferences.migrationSettings.enabled = false;
      mockUserPreferences.migrationSettings.autoSuggestScheduling = false;

      // Add dismissed weeks
      await service.addDismissedWeek('2024-01-01');
      mockUserPreferences.migrationSettings.dismissedWeeks = ['2024-01-01'];

      await service.addDismissedWeek('2024-01-08');
      mockUserPreferences.migrationSettings.dismissedWeeks = [
        '2024-01-01',
        '2024-01-08',
      ];

      // Verify state
      preferences = await service.getPreferences();
      expect(preferences.enabled).toBe(false);
      expect(preferences.autoSuggestScheduling).toBe(false);
      expect(preferences.dismissedWeeks).toEqual(
        new Set(['2024-01-01', '2024-01-08'])
      );

      // Clear dismissed weeks
      await service.clearDismissedWeeks();
      mockUserPreferences.migrationSettings.dismissedWeeks = [];

      // Verify cleared
      preferences = await service.getPreferences();
      expect(preferences.dismissedWeeks.size).toBe(0);
      expect(preferences.enabled).toBe(false); // other settings preserved
    });

    it('should handle service initialization properly', async () => {
      const newService = new MigrationPreferencesServiceImpl();

      // Should throw before initialization
      await expect(newService.getPreferences()).rejects.toThrow(
        'MigrationPreferencesService not initialized'
      );

      // Should work after initialization
      newService.initialize(mockGetUserPreferences, mockUpdateUserPreferences);
      const preferences = await newService.getPreferences();
      expect(preferences.enabled).toBe(true);
    });
  });
});
