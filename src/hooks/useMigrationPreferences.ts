import { useCallback, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { migrationPreferencesService } from '../services/MigrationPreferencesService';
import { MigrationPreferences } from '../types';

/**
 * Hook to integrate MigrationPreferencesService with SettingsContext
 */
export const useMigrationPreferences = () => {
  const { preferences, updatePreferences } = useSettings();

  // Initialize the service with SettingsContext functions
  useEffect(() => {
    migrationPreferencesService.initialize(
      () => preferences,
      updatePreferences
    );
  }, [preferences, updatePreferences]);

  const getMigrationPreferences =
    useCallback(async (): Promise<MigrationPreferences> => {
      return migrationPreferencesService.getPreferences();
    }, []);

  const updateMigrationPreferences = useCallback(
    async (prefs: Partial<MigrationPreferences>): Promise<void> => {
      return migrationPreferencesService.updatePreferences(prefs);
    },
    []
  );

  const addDismissedWeek = useCallback(
    async (weekIdentifier: string): Promise<void> => {
      return migrationPreferencesService.addDismissedWeek(weekIdentifier);
    },
    []
  );

  const clearDismissedWeeks = useCallback(async (): Promise<void> => {
    return migrationPreferencesService.clearDismissedWeeks();
  }, []);

  const shouldShowMigrationPrompt = useCallback(
    async (weekIdentifier: string): Promise<boolean> => {
      return migrationPreferencesService.shouldShowMigrationPrompt(
        weekIdentifier
      );
    },
    []
  );

  const resetToDefaults = useCallback(async (): Promise<void> => {
    return migrationPreferencesService.resetToDefaults();
  }, []);

  return {
    migrationSettings: preferences.migrationSettings,
    getMigrationPreferences,
    updateMigrationPreferences,
    addDismissedWeek,
    clearDismissedWeeks,
    shouldShowMigrationPrompt,
    resetToDefaults,
  };
};
