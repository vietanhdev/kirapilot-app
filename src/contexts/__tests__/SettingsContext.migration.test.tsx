import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { UserPreferences } from '../../types';

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

// Test component to access settings context
const TestComponent: React.FC = () => {
  const { preferences, updatePreference, updateNestedPreference, isLoading } =
    useSettings();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid='migration-enabled'>
        {preferences.migrationSettings.enabled.toString()}
      </div>
      <div data-testid='migration-auto-suggest'>
        {preferences.migrationSettings.autoSuggestScheduling.toString()}
      </div>
      <div data-testid='migration-dependency-warnings'>
        {preferences.migrationSettings.showDependencyWarnings.toString()}
      </div>
      <div data-testid='migration-dismissed-weeks'>
        {preferences.migrationSettings.dismissedWeeks.length}
      </div>
      <button
        data-testid='update-migration-enabled'
        onClick={() =>
          updateNestedPreference('migrationSettings', 'enabled', false)
        }
      >
        Disable Migration
      </button>
      <button
        data-testid='update-migration-settings'
        onClick={() =>
          updatePreference('migrationSettings', {
            enabled: true,
            dismissedWeeks: ['2024-01-01', '2024-01-08'],
            autoSuggestScheduling: false,
            showDependencyWarnings: false,
          })
        }
      >
        Update Migration Settings
      </button>
    </div>
  );
};

describe('SettingsContext - Migration Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should provide default migration preferences', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'true'
    );
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('true');
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '0'
    );
  });

  it('should load migration preferences from localStorage', async () => {
    const storedPreferences: Partial<UserPreferences> = {
      migrationSettings: {
        enabled: false,
        dismissedWeeks: ['2024-01-01'],
        autoSuggestScheduling: false,
        showDependencyWarnings: false,
      },
    };

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPreferences));

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'false'
    );
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('false');
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '1'
    );
  });

  it('should merge migration preferences with defaults when partial data exists', async () => {
    const storedPreferences: Partial<UserPreferences> = {
      migrationSettings: {
        enabled: false,
        dismissedWeeks: [],
        autoSuggestScheduling: true,
        showDependencyWarnings: true,
      },
    };

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPreferences));

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'true'
    ); // Default
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('true'); // Default
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '0'
    ); // Default
  });

  it('should update nested migration preference', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');

    await act(async () => {
      screen.getByTestId('update-migration-enabled').click();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('false');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'kirapilot-preferences',
      expect.stringContaining('"enabled":false')
    );
  });

  it('should update entire migration settings object', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('update-migration-settings').click();
    });

    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'false'
    );
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('false');
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '2'
    );

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'kirapilot-preferences',
      expect.stringContaining('"dismissedWeeks":["2024-01-01","2024-01-08"]')
    );
  });

  it('should handle missing migration settings in stored preferences', async () => {
    const storedPreferences: Partial<UserPreferences> = {
      theme: 'dark',
      language: 'en',
      // No migrationSettings
    };

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPreferences));

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should use defaults
    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'true'
    );
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('true');
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '0'
    );
  });

  it('should handle corrupted localStorage data gracefully', async () => {
    mockLocalStorage.getItem.mockReturnValue('invalid json');

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should use defaults when localStorage is corrupted
    expect(screen.getByTestId('migration-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('migration-auto-suggest')).toHaveTextContent(
      'true'
    );
    expect(
      screen.getByTestId('migration-dependency-warnings')
    ).toHaveTextContent('true');
    expect(screen.getByTestId('migration-dismissed-weeks')).toHaveTextContent(
      '0'
    );
  });
});
