import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from '../Settings';
import { SettingsProvider } from '../../../contexts/SettingsContext';

// Mock the AI service
jest.mock('../../../services/ai/ReactAIService', () => ({
  getReactAIService: () => ({
    setApiKey: jest.fn(),
  }),
}));

// Mock the AIContext
jest.mock('../../../contexts/AIContext', () => ({
  useAI: () => ({
    reinitializeAI: jest.fn(),
    isInitialized: false,
    isLoading: false,
    error: null,
    conversations: [],
    suggestions: [],
  }),
}));

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.title': 'Settings',
        'settings.subtitle': 'Customize your KiraPilot experience',
        'settings.resetToDefaults': 'Reset to Defaults',
        'settings.general': 'General',
        'settings.ai': 'AI Assistant',
        'settings.time': 'Time Tracking',
        'settings.privacy': 'Privacy & Data',
        'settings.about': 'About',
        'settings.appearance': 'Appearance',
        'settings.apiConfiguration': 'API Configuration',
        'settings.aiBehavior': 'AI Behavior',
        'settings.timerSettings': 'Timer Settings',
        'settings.geminiApiKey': 'Gemini API Key',
        'settings.geminiApiKeyDescription':
          'Enter your Google Gemini API key to enable AI features. Get your key from',
        'settings.geminiApiKeyPlaceholder': 'Enter your Gemini API key...',
        'settings.apiKeyConfigured': '✓ API key configured',
        'settings.defaultSessionLength': 'Default Session Length',
        'settings.breakInterval': 'Break Interval',
        'settings.general.theme': 'Theme',
        'settings.general.themeDescription':
          'Choose your preferred color scheme',
        'settings.general.language': 'Language',
        'settings.general.languageDescription':
          'Select your preferred language',
        'settings.general.workingHours': 'Working Hours',
        'settings.general.startTime': 'Start Time',
        'settings.general.endTime': 'End Time',
        'about.appName': 'KiraPilot',
        'about.appDescription': 'Intelligent Productivity Assistant',
        'about.version': 'Version 0.1.0',
        'about.systemInformation': 'System Information',
        'about.copyright': '© 2024 KiraPilot. All rights reserved.',
        'system.platform': 'Platform',
        'system.database': 'Database',
        'system.aiEngine': 'AI Engine',
        'system.platformValue': 'Desktop (Tauri)',
        'system.databaseValue': 'SQLite (Local)',
        'system.aiEngineValue': 'Google Gemini',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.auto': 'Auto',
        'time.minutes': 'minutes',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the i18n languages
jest.mock('../../../i18n', () => ({
  languages: {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  },
}));

// Mock DataManagement component
jest.mock('../DataManagement', () => ({
  DataManagement: () => (
    <div data-testid='data-management'>Data Management</div>
  ),
}));

const renderSettings = () => {
  return render(
    <SettingsProvider>
      <Settings />
    </SettingsProvider>
  );
};

describe('Settings Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('renders all main tabs', () => {
    renderSettings();

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Time Tracking')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('displays theme and language settings in General tab', () => {
    renderSettings();

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Working Hours')).toBeInTheDocument();
  });

  it('displays API key configuration in AI Assistant tab', async () => {
    renderSettings();

    // Click on AI Assistant tab
    fireEvent.click(screen.getByText('AI Assistant'));

    await waitFor(() => {
      expect(screen.getByText('API Configuration')).toBeInTheDocument();
      expect(screen.getByText('Gemini API Key')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter your Gemini API key...')
      ).toBeInTheDocument();
    });
  });

  it('handles API key input and shows confirmation', async () => {
    renderSettings();

    // Click on AI Assistant tab
    fireEvent.click(screen.getByText('AI Assistant'));

    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText(
        'Enter your Gemini API key...'
      );

      // Enter API key using the HeroUI onValueChange pattern
      fireEvent.change(apiKeyInput, { target: { value: 'test-api-key-123' } });

      // Should show confirmation
      expect(screen.getByText('✓ API key configured')).toBeInTheDocument();
    });
  });

  it('shows API key input field', async () => {
    renderSettings();

    // Click on AI Assistant tab
    fireEvent.click(screen.getByText('AI Assistant'));

    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText(
        'Enter your Gemini API key...'
      );

      // Initially should be password type
      expect(apiKeyInput).toHaveAttribute('type', 'password');
      expect(apiKeyInput).toBeInTheDocument();
    });
  });

  it('displays timer settings in Time Tracking tab', async () => {
    renderSettings();

    // Click on Time Tracking tab
    fireEvent.click(screen.getByText('Time Tracking'));

    await waitFor(() => {
      expect(screen.getByText('Timer Settings')).toBeInTheDocument();
      expect(screen.getByText(/Default Session Length/)).toBeInTheDocument();
      expect(screen.getByText(/Break Interval/)).toBeInTheDocument();
    });
  });

  it('displays app information in About tab', async () => {
    renderSettings();

    // Click on About tab
    fireEvent.click(screen.getByText('About'));

    await waitFor(() => {
      expect(screen.getByText('KiraPilot')).toBeInTheDocument();
      expect(
        screen.getByText('Intelligent Productivity Assistant')
      ).toBeInTheDocument();
      expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
      expect(screen.getByText('System Information')).toBeInTheDocument();
    });
  });

  it('shows reset to defaults button', () => {
    renderSettings();

    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('persists API key to localStorage', async () => {
    renderSettings();

    // Click on AI Assistant tab
    fireEvent.click(screen.getByText('AI Assistant'));

    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText(
        'Enter your Gemini API key...'
      );

      // Enter API key
      fireEvent.change(apiKeyInput, {
        target: { value: 'test-persistence-key' },
      });

      // Check if localStorage was updated
      const storedPreferences = localStorage.getItem('kirapilot-preferences');
      expect(storedPreferences).toBeTruthy();

      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences);
        expect(parsed.aiSettings.geminiApiKey).toBe('test-persistence-key');
      }
    });
  });

  it('opens AI Assistant tab when initialTab prop is set to "ai"', () => {
    render(
      <SettingsProvider>
        <Settings initialTab='ai' />
      </SettingsProvider>
    );

    // Should show AI Assistant tab content immediately
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
    expect(screen.getByText('Gemini API Key')).toBeInTheDocument();
  });
});
