import {
  MigrationPreferences,
  MigrationPreferencesService,
  UserPreferences,
} from '../types';

/**
 * Service for managing task migration preferences integrated with UserPreferences
 */
export class MigrationPreferencesServiceImpl
  implements MigrationPreferencesService
{
  private updateUserPreferences?: (
    preferences: UserPreferences
  ) => Promise<void>;
  private getUserPreferences?: () => UserPreferences;

  /**
   * Initialize the service with SettingsContext functions
   */
  initialize(
    getUserPreferences: () => UserPreferences,
    updateUserPreferences: (preferences: UserPreferences) => Promise<void>
  ) {
    this.getUserPreferences = getUserPreferences;
    this.updateUserPreferences = updateUserPreferences;
  }

  /**
   * Get migration preferences from UserPreferences
   */
  async getPreferences(): Promise<MigrationPreferences> {
    if (!this.getUserPreferences) {
      throw new Error(
        'MigrationPreferencesService not initialized. Call initialize() first.'
      );
    }

    const userPreferences = this.getUserPreferences();
    const migrationSettings = userPreferences.migrationSettings;

    // Convert dismissed weeks array to Set
    const dismissedWeeks = new Set<string>(
      migrationSettings.dismissedWeeks || []
    );

    return {
      enabled: migrationSettings.enabled,
      dismissedWeeks,
      autoSuggestScheduling: migrationSettings.autoSuggestScheduling,
      showDependencyWarnings: migrationSettings.showDependencyWarnings,
    };
  }

  /**
   * Update migration preferences in UserPreferences
   */
  async updatePreferences(
    preferences: Partial<MigrationPreferences>
  ): Promise<void> {
    if (!this.getUserPreferences || !this.updateUserPreferences) {
      throw new Error(
        'MigrationPreferencesService not initialized. Call initialize() first.'
      );
    }

    try {
      const current = await this.getPreferences();
      const updated: MigrationPreferences = {
        ...current,
        ...preferences,
      };

      const userPreferences = this.getUserPreferences();
      const updatedUserPreferences: UserPreferences = {
        ...userPreferences,
        migrationSettings: {
          enabled: updated.enabled,
          dismissedWeeks: Array.from(updated.dismissedWeeks),
          autoSuggestScheduling: updated.autoSuggestScheduling,
          showDependencyWarnings: updated.showDependencyWarnings,
        },
      };

      await this.updateUserPreferences(updatedUserPreferences);
    } catch (error) {
      console.error('Failed to update migration preferences:', error);
      throw new Error('Failed to save migration preferences');
    }
  }

  /**
   * Add a week identifier to the dismissed weeks set
   */
  async addDismissedWeek(weekIdentifier: string): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updatedDismissedWeeks = new Set(current.dismissedWeeks);
      updatedDismissedWeeks.add(weekIdentifier);

      await this.updatePreferences({
        dismissedWeeks: updatedDismissedWeeks,
      });
    } catch (error) {
      console.error('Failed to add dismissed week:', error);
      throw new Error('Failed to save dismissed week');
    }
  }

  /**
   * Clear all dismissed weeks from preferences
   */
  async clearDismissedWeeks(): Promise<void> {
    try {
      await this.updatePreferences({
        dismissedWeeks: new Set<string>(),
      });
    } catch (error) {
      console.error('Failed to clear dismissed weeks:', error);
      throw new Error('Failed to clear dismissed weeks');
    }
  }

  /**
   * Reset preferences to default values
   */
  async resetToDefaults(): Promise<void> {
    try {
      await this.updatePreferences({
        enabled: true,
        dismissedWeeks: new Set<string>(),
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      });
    } catch (error) {
      console.error('Failed to reset migration preferences:', error);
      throw new Error('Failed to reset migration preferences');
    }
  }

  /**
   * Check if migration is enabled and week hasn't been dismissed
   */
  async shouldShowMigrationPrompt(weekIdentifier: string): Promise<boolean> {
    const preferences = await this.getPreferences();
    return (
      preferences.enabled && !preferences.dismissedWeeks.has(weekIdentifier)
    );
  }
}

// Export singleton instance
export const migrationPreferencesService =
  new MigrationPreferencesServiceImpl();
