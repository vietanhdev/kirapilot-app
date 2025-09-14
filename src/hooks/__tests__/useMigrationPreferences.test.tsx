import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { useMigrationPreferences } from '../useMigrationPreferences';
import { MigrationPreferences } from '../../types';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test component to use the hook
const TestComponent: React.FC = () => {
  const {
    migrationSettings,
    getMigrationPreferences,
    updateMigrationPreferences,
    addDismissedWeek,
    clearDismissedWeeks,
    shouldShowMigrationPrompt,
    resetToDefaults,
  } = useMigrationPreferences();

  const [preferences, setPreferences] =
    React.useState<MigrationPreferences | null>(null);
  const [shouldShow, setShouldShow] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleGetPreferences = async () => {
    try {
      const prefs = await getMigrationPreferences();
      setPreferences(prefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      await updateMigrationPreferences({
        enabled: false,
        autoSuggestScheduling: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleAddDismissedWeek = async () => {
    try {
      await addDismissedWeek('2024-01-01');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleClearDismissedWeeks = async () => {
    try {
      await clearDismissedWeeks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleShouldShowPrompt = async () => {
    try {
      const result = await shouldShowMigrationPrompt('2024-01-01');
      setShouldShow(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleResetToDefaults = async () => {
    try {
      await resetToDefaults();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <div data-testid='migration-enabled'>
        {migrationSettings.enabled.toString()}
      </div>
      <div data-testid='migration-dismissed-count'>
        {migrationSettings.dismissedWeeks.length}
      </div>
      <div data-testid='migration-auto-suggest'>
        {migrationSettings.autoSuggestScheduling.toString()}
      </div>
      <div data-testid='migration-dependency-warnings'>
        {migrationSettings.showDependencyWarnings.toString()}
      </div>

      {preferences && (
        <div data-testid='preferences-enabled'>
          {preferences.enabled.toString()}
        </div>
      )}

      {shouldShow !== null && (
        <div data-testid='should-show-prompt'>{shouldShow.toString()}</div>
      )}

      {error && <div data-testid='error'>{error}</div>}

      <button data-testid='get-preferences' onClick={handleGetPreferences}>
        Get Preferences
      </button>
      <button
        data-testid='update-preferences'
        onClick={handleUpdatePreferences}
      >
        Update Preferences
      </button>
      <button data-testid='add-dismissed-week' onClick={handleAddDismissedWeek}>
        Add Dismissed Week
      </button>
      <button
        data-testid='clear-dismissed-weeks'
        onClick={handleClearDismissedWeeks}
      >
        Clear Dismissed Weeks
      </button>
      <button
        data-testid='should-show-prompt-btn'
        onClick={handleShouldShowPrompt}
      >
        Should Show Prompt
      </button>
      <button data-testid='reset-to-defaults' onClick={handleResetToDefaults}>
        Reset to Defaults
      </button>
    </div>
  );
};

describe('useMigrationPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should provide migration settings from SettingsContext', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '0'
      );
      expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
        'true'
      );
      expect(
        screen.getByTestId('migration-dependency-warnings')
      ).toHaveTextContent('true');
    });
  });

  it('should get migration preferences with Set conversion', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await act(async () => {
      screen.getByTestId('get-preferences').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('preferences-enabled')).toHaveTextContent(
        'true'
      );
    });
  });

  it('should update migration preferences', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByTestId('update-preferences').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent(
        'false'
      );
      expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
        'false'
      );
    });
  });

  it('should add dismissed week', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '0'
      );
    });

    await act(async () => {
      screen.getByTestId('add-dismissed-week').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '1'
      );
    });
  });

  it('should clear dismissed weeks', async () => {
    // First add a dismissed week
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await act(async () => {
      screen.getByTestId('add-dismissed-week').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '1'
      );
    });

    await act(async () => {
      screen.getByTestId('clear-dismissed-weeks').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '0'
      );
    });
  });

  it('should check if migration prompt should be shown', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Should show prompt when enabled and week not dismissed
    await act(async () => {
      screen.getByTestId('should-show-prompt-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('should-show-prompt')).toHaveTextContent(
        'true'
      );
    });

    // Add dismissed week
    await act(async () => {
      screen.getByTestId('add-dismissed-week').click();
    });

    // Should not show prompt for dismissed week
    await act(async () => {
      screen.getByTestId('should-show-prompt-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('should-show-prompt')).toHaveTextContent(
        'false'
      );
    });
  });

  it('should reset to defaults', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // First modify preferences
    await act(async () => {
      screen.getByTestId('update-preferences').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent(
        'false'
      );
    });

    // Reset to defaults
    await act(async () => {
      screen.getByTestId('reset-to-defaults').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
        'true'
      );
      expect(
        screen.getByTestId('migration-dependency-warnings')
      ).toHaveTextContent('true');
      expect(screen.getByTestId('migration-dismissed-count')).toHaveTextContent(
        '0'
      );
    });
  });

  it('should handle disabled migration in shouldShowMigrationPrompt', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Disable migration
    await act(async () => {
      screen.getByTestId('update-preferences').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('migration-enabled')).toHaveTextContent(
        'false'
      );
    });

    // Should not show prompt when disabled
    await act(async () => {
      screen.getByTestId('should-show-prompt-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('should-show-prompt')).toHaveTextContent(
        'false'
      );
    });
  });
});
