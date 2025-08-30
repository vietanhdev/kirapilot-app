import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Switch,
  Select,
  SelectItem,
  Input,
  Divider,
  Button,
} from '@heroui/react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bot,
  Clock,
  Info,
  Eye,
  EyeOff,
  Cloud,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../i18n';
import { DataManagement } from './DataManagement';
import { LoggingSettings } from './LoggingSettings';
import { SoundSettings } from './SoundSettings';
import { useAI } from '../../contexts/AIContext';
import { BuildInfo } from '../common';

// import { ModelSelectionCardSimple } from './ModelSelectionCardSimple';

interface SettingsProps {
  className?: string;
  initialTab?: string;
}

export const Settings: React.FC<SettingsProps> = ({
  className = '',
  initialTab = 'general',
}) => {
  const {
    preferences,
    updatePreference,
    updateNestedPreference,
    resetToDefaults: contextResetToDefaults,
    isLoading,
    error,
  } = useSettings();
  const { t } = useTranslation();
  const { reinitializeAI } = useAI();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValidationState, setApiKeyValidationState] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    error: string | null;
  }>({
    isValidating: false,
    isValid: null,
    error: null,
  });

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handlePreferenceChange = <K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K]
  ) => {
    updatePreference(key, value);
  };

  const handleNestedPreferenceChange = (
    parentKey: keyof typeof preferences,
    childKey: string,
    value: unknown
  ) => {
    updateNestedPreference(parentKey, childKey, value);
  };

  // API Key validation function
  const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    // Basic format validation for Gemini API keys
    const trimmedKey = apiKey.trim();

    // Gemini API keys typically start with 'AIza' and are 39 characters long
    if (!trimmedKey.startsWith('AIza') || trimmedKey.length !== 39) {
      return false;
    }

    // Additional validation could be added here to test the key with a simple API call
    return true;
  };

  const handleApiKeyChange = async (apiKey: string) => {
    const trimmedKey = apiKey.trim();

    // Reset validation state
    setApiKeyValidationState({
      isValidating: true,
      isValid: null,
      error: null,
    });

    try {
      // Update preferences first
      handleNestedPreferenceChange(
        'aiSettings',
        'geminiApiKey',
        trimmedKey || undefined
      );

      // Validate the API key if it's not empty
      if (trimmedKey) {
        const isValid = await validateApiKey(trimmedKey);

        if (isValid) {
          setApiKeyValidationState({
            isValidating: false,
            isValid: true,
            error: null,
          });

          // Reinitialize AI service to pick up the new API key
          setTimeout(() => {
            reinitializeAI();
          }, 100); // Small delay to ensure preferences are saved
        } else {
          setApiKeyValidationState({
            isValidating: false,
            isValid: false,
            error:
              'Invalid API key format. Gemini API keys should start with "AIza" and be 39 characters long.',
          });
        }
      } else {
        setApiKeyValidationState({
          isValidating: false,
          isValid: null,
          error: null,
        });
      }
    } catch (error) {
      console.error('Failed to update API key:', error);
      setApiKeyValidationState({
        isValidating: false,
        isValid: false,
        error: 'Failed to validate API key. Please try again.',
      });
    }
  };

  const resetToDefaults = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      contextResetToDefaults();
    }
  };

  if (isLoading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <div className='text-center'>
          <SettingsIcon className='w-8 h-8 text-foreground-600 mx-auto mb-2 animate-spin' />
          <p className='text-foreground-600'>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 max-w-4xl mx-auto min-h-full ${className}`}>
      <div className='mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-foreground mb-2'>
              {t('settings.title')}
            </h1>
            <p className='text-foreground-600'>{t('settings.subtitle')}</p>
          </div>
          <div className='flex items-center gap-3'>
            <Button
              onPress={resetToDefaults}
              variant='bordered'
              size='sm'
              isDisabled={isLoading}
            >
              {t('settings.resetToDefaults')}
            </Button>
          </div>
        </div>

        {error && (
          <div className='mt-4 p-3 bg-danger/20 border border-danger/30 rounded-lg'>
            <p className='text-danger text-sm'>{error}</p>
          </div>
        )}
      </div>

      <Card className='bg-content1 border-divider'>
        <CardBody className='p-0'>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={key => setActiveTab(key as string)}
            variant='underlined'
            classNames={{
              tabList:
                'gap-6 w-full relative rounded-none p-0 border-b border-divider bg-content1',
              cursor: 'w-full bg-primary-500',
              tab: 'max-w-fit px-4 py-3 h-12 data-[selected=true]:text-primary-600',
              tabContent:
                'group-data-[selected=true]:text-primary-600 text-foreground-600 font-medium',
            }}
          >
            <Tab
              key='general'
              title={
                <div className='flex items-center space-x-2'>
                  <User className='w-4 h-4' />
                  <span>{t('settings.general')}</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.appearance')}
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.general.theme')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.general.themeDescription')}
                        </p>
                      </div>
                      <Select
                        selectedKeys={[preferences.theme]}
                        onSelectionChange={keys => {
                          const theme = Array.from(keys)[0] as
                            | 'light'
                            | 'dark'
                            | 'auto';
                          handlePreferenceChange('theme', theme);
                        }}
                        className='w-32'
                        size='sm'
                        aria-label='Theme selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='light'>{t('theme.light')}</SelectItem>
                        <SelectItem key='dark'>{t('theme.dark')}</SelectItem>
                        <SelectItem key='auto'>{t('theme.auto')}</SelectItem>
                      </Select>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.general.language')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.general.languageDescription')}
                        </p>
                      </div>
                      <Select
                        selectedKeys={[preferences.language]}
                        onSelectionChange={keys => {
                          const language = Array.from(keys)[0] as string;
                          handlePreferenceChange('language', language);
                        }}
                        className='w-32'
                        size='sm'
                        aria-label='Language selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        {Object.entries(languages).map(([code, name]) => (
                          <SelectItem key={code}>{name}</SelectItem>
                        ))}
                      </Select>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.general.dateFormat')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.general.dateFormatDescription')}
                        </p>
                      </div>
                      <Select
                        selectedKeys={[preferences.dateFormat]}
                        onSelectionChange={keys => {
                          const dateFormat = Array.from(keys)[0] as
                            | 'DD/MM/YYYY'
                            | 'MM/DD/YYYY'
                            | 'YYYY-MM-DD';
                          handlePreferenceChange('dateFormat', dateFormat);
                        }}
                        className='w-40'
                        size='sm'
                        aria-label='Date format selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='DD/MM/YYYY'>DD/MM/YYYY</SelectItem>
                        <SelectItem key='MM/DD/YYYY'>MM/DD/YYYY</SelectItem>
                        <SelectItem key='YYYY-MM-DD'>YYYY-MM-DD</SelectItem>
                      </Select>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.general.workingHours')}
                  </h3>

                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.general.startTime')}
                      </label>
                      <Input
                        type='time'
                        value={preferences.workingHours.start}
                        onChange={e =>
                          handleNestedPreferenceChange(
                            'workingHours',
                            'start',
                            e.target.value
                          )
                        }
                        size='sm'
                        classNames={{
                          input: 'text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        }}
                      />
                    </div>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.general.endTime')}
                      </label>
                      <Input
                        type='time'
                        value={preferences.workingHours.end}
                        onChange={e =>
                          handleNestedPreferenceChange(
                            'workingHours',
                            'end',
                            e.target.value
                          )
                        }
                        size='sm'
                        classNames={{
                          input: 'text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <SoundSettings />
                </div>
              </div>
            </Tab>

            <Tab
              key='ai'
              title={
                <div className='flex items-center space-x-2'>
                  <Bot className='w-4 h-4' />
                  <span>{t('settings.ai')}</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                {/* Simplified Gemini Configuration */}
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
                    <Cloud className='w-5 h-5' />
                    AI Assistant Configuration
                  </h3>

                  <div className='space-y-4'>
                    {/* Gemini API Key Configuration */}
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.geminiApiKey')}
                      </label>

                      {/* Setup Instructions */}
                      {!preferences.aiSettings.geminiApiKey && (
                        <div className='bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg mb-4'>
                          <h4 className='text-sm font-medium text-primary-700 dark:text-primary-300 mb-2'>
                            🚀 Get Started with AI Assistant
                          </h4>
                          <ol className='text-xs text-primary-600 dark:text-primary-400 space-y-1 list-decimal list-inside'>
                            <li>
                              Visit{' '}
                              <a
                                href='https://aistudio.google.com/app/apikey'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-primary-500 hover:text-primary-600 underline font-medium'
                              >
                                Google AI Studio
                              </a>
                            </li>
                            <li>Sign in with your Google account</li>
                            <li>
                              Click "Create API Key" and copy the generated key
                            </li>
                            <li>Paste the key in the field below</li>
                          </ol>
                        </div>
                      )}

                      <p className='text-xs text-foreground-600 mb-3'>
                        {t('settings.geminiApiKeyDescription')}{' '}
                        <a
                          href='https://aistudio.google.com/app/apikey'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary-500 hover:text-primary-600 underline'
                        >
                          Google AI Studio
                        </a>
                      </p>

                      <div className='relative'>
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={preferences.aiSettings.geminiApiKey || ''}
                          onValueChange={handleApiKeyChange}
                          placeholder={t('settings.geminiApiKeyPlaceholder')}
                          size='sm'
                          isInvalid={apiKeyValidationState.isValid === false}
                          data-tour='api-key-input'
                          classNames={{
                            input:
                              'text-foreground placeholder:text-foreground-500',
                            inputWrapper: `bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2 ${
                              apiKeyValidationState.isValid === false
                                ? 'border-danger'
                                : apiKeyValidationState.isValid === true
                                  ? 'border-success'
                                  : ''
                            }`,
                          }}
                          endContent={
                            <div className='flex items-center gap-1'>
                              {apiKeyValidationState.isValidating && (
                                <RefreshCw className='w-4 h-4 animate-spin text-foreground-400' />
                              )}
                              {apiKeyValidationState.isValid === true && (
                                <CheckCircle className='w-4 h-4 text-success' />
                              )}
                              {apiKeyValidationState.isValid === false && (
                                <XCircle className='w-4 h-4 text-danger' />
                              )}
                              <Button
                                isIconOnly
                                variant='light'
                                size='sm'
                                onPress={() => setShowApiKey(!showApiKey)}
                              >
                                {showApiKey ? (
                                  <EyeOff className='w-4 h-4' />
                                ) : (
                                  <Eye className='w-4 h-4' />
                                )}
                              </Button>
                            </div>
                          }
                        />
                      </div>

                      {/* Validation Messages */}
                      {apiKeyValidationState.error && (
                        <p className='text-xs text-danger mt-2'>
                          {apiKeyValidationState.error}
                        </p>
                      )}
                      {apiKeyValidationState.isValid === true && (
                        <p className='text-xs text-success mt-2'>
                          ✓ API key is valid and ready to use
                        </p>
                      )}
                      {preferences.aiSettings.geminiApiKey &&
                        apiKeyValidationState.isValid !== false && (
                          <p className='text-xs text-success mt-2'>
                            {t('settings.apiKeyConfigured')}
                          </p>
                        )}
                    </div>

                    {/* Simplified Status Display */}
                    <div className='bg-content2 p-4 rounded-lg'>
                      <div className='flex items-center gap-3'>
                        <Cloud className='w-5 h-5 text-primary-500' />
                        <div>
                          <p className='text-sm font-medium text-foreground'>
                            Google Gemini AI
                          </p>
                          <p className='text-xs text-foreground-600'>
                            {preferences.aiSettings.geminiApiKey
                              ? 'Ready to assist you with intelligent task management'
                              : 'Configure your API key to enable AI features'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.aiBehavior')}
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.ai.conversationHistory')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.ai.conversationHistoryDescription')}
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.aiSettings.conversationHistory}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'conversationHistory',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.ai.autoSuggestions')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.ai.autoSuggestionsDescription')}
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.aiSettings.autoSuggestions}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'autoSuggestions',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          {t('settings.ai.toolPermissions')}
                        </label>
                        <p className='text-xs text-foreground-600'>
                          {t('settings.ai.toolPermissionsDescription')}
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.aiSettings.toolPermissions}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'toolPermissions',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Show AI Interaction Logs
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Show the AI Interaction Logs tab in navigation for
                          debugging and monitoring
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.aiSettings.showInteractionLogs}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'showInteractionLogs',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.ai.responseStyle')}
                      </label>
                      <Select
                        selectedKeys={[preferences.aiSettings.responseStyle]}
                        onSelectionChange={keys => {
                          const style = Array.from(keys)[0] as
                            | 'concise'
                            | 'balanced'
                            | 'detailed';
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'responseStyle',
                            style
                          );
                        }}
                        size='sm'
                        aria-label='AI response style selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='concise'>
                          {t('responseStyle.concise')}
                        </SelectItem>
                        <SelectItem key='balanced'>
                          {t('responseStyle.balanced')}
                        </SelectItem>
                        <SelectItem key='detailed'>
                          {t('responseStyle.detailed')}
                        </SelectItem>
                      </Select>
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.ai.suggestionFrequency')}
                      </label>
                      <Select
                        selectedKeys={[
                          preferences.aiSettings.suggestionFrequency,
                        ]}
                        onSelectionChange={keys => {
                          const frequency = Array.from(keys)[0] as
                            | 'minimal'
                            | 'moderate'
                            | 'frequent';
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'suggestionFrequency',
                            frequency
                          );
                        }}
                        size='sm'
                        aria-label='AI suggestion frequency selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='minimal'>
                          {t('suggestionFrequency.minimal')}
                        </SelectItem>
                        <SelectItem key='moderate'>
                          {t('suggestionFrequency.moderate')}
                        </SelectItem>
                        <SelectItem key='frequent'>
                          {t('suggestionFrequency.frequent')}
                        </SelectItem>
                      </Select>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                {/* AI Personality Settings */}
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
                    <User className='w-5 h-5' />
                    AI Personality & Emotional Intelligence
                  </h3>

                  <div className='space-y-6'>
                    {/* Personality Sliders */}
                    <div>
                      <h4 className='text-sm font-medium text-foreground mb-3'>
                        Personality Settings
                      </h4>
                      <p className='text-xs text-foreground-600 mb-4'>
                        Adjust how the AI communicates with you. These settings
                        affect the tone and style of responses.
                      </p>

                      <div
                        className='space-y-4'
                        data-tour='personality-sliders'
                      >
                        {/* Warmth Slider */}
                        <div>
                          <div className='flex items-center justify-between mb-2'>
                            <label className='text-sm text-foreground'>
                              Warmth:{' '}
                              {preferences.aiSettings.personalitySettings
                                ?.warmth || 6}
                              /10
                            </label>
                            <span className='text-xs text-foreground-600'>
                              {(preferences.aiSettings.personalitySettings
                                ?.warmth || 6) < 4
                                ? 'Direct'
                                : (preferences.aiSettings.personalitySettings
                                      ?.warmth || 6) > 7
                                  ? 'Very Caring'
                                  : 'Friendly'}
                            </span>
                          </div>
                          <input
                            type='range'
                            min='1'
                            max='10'
                            value={
                              preferences.aiSettings.personalitySettings
                                ?.warmth || 6
                            }
                            onChange={e => {
                              const currentSettings = preferences.aiSettings
                                .personalitySettings || {
                                warmth: 6,
                                enthusiasm: 5,
                                supportiveness: 7,
                                humor: 4,
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'personalitySettings',
                                {
                                  ...currentSettings,
                                  warmth: parseInt(e.target.value),
                                }
                              );
                            }}
                            className='w-full h-2 bg-content2 rounded-lg appearance-none cursor-pointer slider'
                          />
                        </div>

                        {/* Enthusiasm Slider */}
                        <div>
                          <div className='flex items-center justify-between mb-2'>
                            <label className='text-sm text-foreground'>
                              Enthusiasm:{' '}
                              {preferences.aiSettings.personalitySettings
                                ?.enthusiasm || 5}
                              /10
                            </label>
                            <span className='text-xs text-foreground-600'>
                              {(preferences.aiSettings.personalitySettings
                                ?.enthusiasm || 5) < 4
                                ? 'Calm'
                                : (preferences.aiSettings.personalitySettings
                                      ?.enthusiasm || 5) > 7
                                  ? 'Very Energetic'
                                  : 'Balanced'}
                            </span>
                          </div>
                          <input
                            type='range'
                            min='1'
                            max='10'
                            value={
                              preferences.aiSettings.personalitySettings
                                ?.enthusiasm || 5
                            }
                            onChange={e => {
                              const currentSettings = preferences.aiSettings
                                .personalitySettings || {
                                warmth: 6,
                                enthusiasm: 5,
                                supportiveness: 7,
                                humor: 4,
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'personalitySettings',
                                {
                                  ...currentSettings,
                                  enthusiasm: parseInt(e.target.value),
                                }
                              );
                            }}
                            className='w-full h-2 bg-content2 rounded-lg appearance-none cursor-pointer slider'
                          />
                        </div>

                        {/* Supportiveness Slider */}
                        <div>
                          <div className='flex items-center justify-between mb-2'>
                            <label className='text-sm text-foreground'>
                              Supportiveness:{' '}
                              {preferences.aiSettings.personalitySettings
                                ?.supportiveness || 7}
                              /10
                            </label>
                            <span className='text-xs text-foreground-600'>
                              {(preferences.aiSettings.personalitySettings
                                ?.supportiveness || 7) < 4
                                ? 'Task-Focused'
                                : (preferences.aiSettings.personalitySettings
                                      ?.supportiveness || 7) > 7
                                  ? 'Very Nurturing'
                                  : 'Encouraging'}
                            </span>
                          </div>
                          <input
                            type='range'
                            min='1'
                            max='10'
                            value={
                              preferences.aiSettings.personalitySettings
                                ?.supportiveness || 7
                            }
                            onChange={e => {
                              const currentSettings = preferences.aiSettings
                                .personalitySettings || {
                                warmth: 6,
                                enthusiasm: 5,
                                supportiveness: 7,
                                humor: 4,
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'personalitySettings',
                                {
                                  ...currentSettings,
                                  supportiveness: parseInt(e.target.value),
                                }
                              );
                            }}
                            className='w-full h-2 bg-content2 rounded-lg appearance-none cursor-pointer slider'
                          />
                        </div>

                        {/* Humor Slider */}
                        <div>
                          <div className='flex items-center justify-between mb-2'>
                            <label className='text-sm text-foreground'>
                              Humor:{' '}
                              {preferences.aiSettings.personalitySettings
                                ?.humor || 4}
                              /10
                            </label>
                            <span className='text-xs text-foreground-600'>
                              {(preferences.aiSettings.personalitySettings
                                ?.humor || 4) < 4
                                ? 'Serious'
                                : (preferences.aiSettings.personalitySettings
                                      ?.humor || 4) > 7
                                  ? 'Playful'
                                  : 'Light-hearted'}
                            </span>
                          </div>
                          <input
                            type='range'
                            min='1'
                            max='10'
                            value={
                              preferences.aiSettings.personalitySettings
                                ?.humor || 4
                            }
                            onChange={e => {
                              const currentSettings = preferences.aiSettings
                                .personalitySettings || {
                                warmth: 6,
                                enthusiasm: 5,
                                supportiveness: 7,
                                humor: 4,
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'personalitySettings',
                                {
                                  ...currentSettings,
                                  humor: parseInt(e.target.value),
                                }
                              );
                            }}
                            className='w-full h-2 bg-content2 rounded-lg appearance-none cursor-pointer slider'
                          />
                        </div>
                      </div>
                    </div>

                    {/* Interaction Style */}
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Interaction Style
                      </label>
                      <p className='text-xs text-foreground-600 mb-3'>
                        Choose how formal or casual you want the AI to be
                      </p>
                      <Select
                        selectedKeys={[
                          preferences.aiSettings.interactionStyle || 'friendly',
                        ]}
                        onSelectionChange={keys => {
                          const style = Array.from(keys)[0] as
                            | 'casual'
                            | 'professional'
                            | 'friendly';
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'interactionStyle',
                            style
                          );
                        }}
                        size='sm'
                        aria-label='Interaction style selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='casual'>
                          Casual - Relaxed and informal
                        </SelectItem>
                        <SelectItem key='friendly'>
                          Friendly - Warm but professional
                        </SelectItem>
                        <SelectItem key='professional'>
                          Professional - Formal and business-like
                        </SelectItem>
                      </Select>
                    </div>

                    {/* Emoji Usage */}
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Emoji Usage
                      </label>
                      <p className='text-xs text-foreground-600 mb-3'>
                        Control how often the AI uses emojis in responses
                      </p>
                      <Select
                        selectedKeys={[
                          preferences.aiSettings.emojiUsage || 'moderate',
                        ]}
                        onSelectionChange={keys => {
                          const usage = Array.from(keys)[0] as
                            | 'minimal'
                            | 'moderate'
                            | 'frequent';
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'emojiUsage',
                            usage
                          );
                        }}
                        size='sm'
                        aria-label='Emoji usage selection'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem key='minimal'>
                          Minimal - Rarely uses emojis
                        </SelectItem>
                        <SelectItem key='moderate'>
                          Moderate - Occasional emojis
                        </SelectItem>
                        <SelectItem key='frequent'>
                          Frequent - Uses emojis regularly
                        </SelectItem>
                      </Select>
                    </div>

                    {/* Emotional Features */}
                    <div>
                      <h4 className='text-sm font-medium text-foreground mb-3'>
                        Emotional Intelligence Features
                      </h4>
                      <p className='text-xs text-foreground-600 mb-4'>
                        Enable features that help the AI understand and respond
                        to your emotional state
                      </p>

                      <div className='space-y-4' data-tour='emotional-toggles'>
                        <div className='flex items-center justify-between'>
                          <div>
                            <label className='text-sm font-medium text-foreground'>
                              Daily Mood Tracking
                            </label>
                            <p className='text-xs text-foreground-600'>
                              AI will check in on your mood and energy levels
                            </p>
                          </div>
                          <Switch
                            isSelected={
                              preferences.aiSettings.emotionalFeatures
                                ?.dailyMoodTracking || false
                            }
                            onValueChange={checked => {
                              const currentFeatures = preferences.aiSettings
                                .emotionalFeatures || {
                                dailyMoodTracking: false,
                                stressDetection: true,
                                encouragementFrequency: 'medium',
                                celebrationStyle: 'enthusiastic',
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'emotionalFeatures',
                                {
                                  ...currentFeatures,
                                  dailyMoodTracking: checked,
                                }
                              );
                            }}
                            size='sm'
                          />
                        </div>

                        <div className='flex items-center justify-between'>
                          <div>
                            <label className='text-sm font-medium text-foreground'>
                              Stress Detection
                            </label>
                            <p className='text-xs text-foreground-600'>
                              AI will recognize signs of stress and offer
                              support
                            </p>
                          </div>
                          <Switch
                            isSelected={
                              preferences.aiSettings.emotionalFeatures
                                ?.stressDetection !== false
                            }
                            onValueChange={checked => {
                              const currentFeatures = preferences.aiSettings
                                .emotionalFeatures || {
                                dailyMoodTracking: false,
                                stressDetection: true,
                                encouragementFrequency: 'medium',
                                celebrationStyle: 'enthusiastic',
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'emotionalFeatures',
                                { ...currentFeatures, stressDetection: checked }
                              );
                            }}
                            size='sm'
                          />
                        </div>

                        <div>
                          <label className='text-sm font-medium text-foreground block mb-2'>
                            Encouragement Frequency
                          </label>
                          <p className='text-xs text-foreground-600 mb-3'>
                            How often should the AI provide motivational
                            support?
                          </p>
                          <Select
                            selectedKeys={[
                              preferences.aiSettings.emotionalFeatures
                                ?.encouragementFrequency || 'medium',
                            ]}
                            onSelectionChange={keys => {
                              const frequency = Array.from(keys)[0] as
                                | 'low'
                                | 'medium'
                                | 'high';
                              const currentFeatures = preferences.aiSettings
                                .emotionalFeatures || {
                                dailyMoodTracking: false,
                                stressDetection: true,
                                encouragementFrequency: 'medium',
                                celebrationStyle: 'enthusiastic',
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'emotionalFeatures',
                                {
                                  ...currentFeatures,
                                  encouragementFrequency: frequency,
                                }
                              );
                            }}
                            size='sm'
                            aria-label='Encouragement frequency selection'
                            classNames={{
                              trigger:
                                'bg-content2 border-divider data-[hover=true]:bg-content3',
                              value: 'text-foreground',
                            }}
                          >
                            <SelectItem key='low'>
                              Low - Minimal encouragement
                            </SelectItem>
                            <SelectItem key='medium'>
                              Medium - Balanced support
                            </SelectItem>
                            <SelectItem key='high'>
                              High - Frequent motivation
                            </SelectItem>
                          </Select>
                        </div>

                        <div>
                          <label className='text-sm font-medium text-foreground block mb-2'>
                            Celebration Style
                          </label>
                          <p className='text-xs text-foreground-600 mb-3'>
                            How should the AI celebrate your achievements?
                          </p>
                          <Select
                            selectedKeys={[
                              preferences.aiSettings.emotionalFeatures
                                ?.celebrationStyle || 'enthusiastic',
                            ]}
                            onSelectionChange={keys => {
                              const style = Array.from(keys)[0] as
                                | 'subtle'
                                | 'enthusiastic';
                              const currentFeatures = preferences.aiSettings
                                .emotionalFeatures || {
                                dailyMoodTracking: false,
                                stressDetection: true,
                                encouragementFrequency: 'medium',
                                celebrationStyle: 'enthusiastic',
                              };
                              handleNestedPreferenceChange(
                                'aiSettings',
                                'emotionalFeatures',
                                { ...currentFeatures, celebrationStyle: style }
                              );
                            }}
                            size='sm'
                            aria-label='Celebration style selection'
                            classNames={{
                              trigger:
                                'bg-content2 border-divider data-[hover=true]:bg-content3',
                              value: 'text-foreground',
                            }}
                          >
                            <SelectItem key='subtle'>
                              Subtle - Gentle acknowledgment
                            </SelectItem>
                            <SelectItem key='enthusiastic'>
                              Enthusiastic - Energetic celebration
                            </SelectItem>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Interaction Logging */}
                <Divider className='my-6' />
                <LoggingSettings />
              </div>
            </Tab>

            <Tab
              key='time'
              title={
                <div className='flex items-center space-x-2'>
                  <Clock className='w-4 h-4' />
                  <span>{t('settings.time')}</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.timerSettings')}
                  </h3>

                  <div className='space-y-6'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.defaultSessionLength')}:{' '}
                        {preferences.focusPreferences.defaultDuration}{' '}
                        {t('time.minutes')}
                      </label>
                      <Input
                        type='number'
                        value={preferences.focusPreferences.defaultDuration.toString()}
                        onChange={e => {
                          const value = parseInt(e.target.value) || 25;
                          handleNestedPreferenceChange(
                            'focusPreferences',
                            'defaultDuration',
                            Math.max(5, Math.min(120, value))
                          );
                        }}
                        min={5}
                        max={120}
                        size='sm'
                        className='w-24'
                        classNames={{
                          input: 'text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        }}
                      />
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.breakInterval')}:{' '}
                        {preferences.breakPreferences.breakInterval}{' '}
                        {t('time.minutes')}
                      </label>
                      <Input
                        type='number'
                        value={preferences.breakPreferences.breakInterval.toString()}
                        onChange={e => {
                          const value = parseInt(e.target.value) || 25;
                          handleNestedPreferenceChange(
                            'breakPreferences',
                            'breakInterval',
                            Math.max(15, Math.min(60, value))
                          );
                        }}
                        min={15}
                        max={60}
                        size='sm'
                        className='w-24'
                        classNames={{
                          input: 'text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Tab>

            <Tab
              key='privacy'
              title={
                <div className='flex items-center space-x-2'>
                  <Shield className='w-4 h-4' />
                  <span>{t('settings.privacy')}</span>
                </div>
              }
            >
              <div className='p-6'>
                <DataManagement />
              </div>
            </Tab>

            <Tab
              key='about'
              title={
                <div className='flex items-center space-x-2'>
                  <Info className='w-4 h-4' />
                  <span>{t('settings.about')}</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div className='text-center'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg'>
                    <Bot className='w-8 h-8 text-white' />
                  </div>
                  <h2 className='text-2xl font-bold text-foreground mb-2'>
                    {t('about.appName')}
                  </h2>
                  <p className='text-foreground-600 mb-4'>
                    {t('about.appDescription')}
                  </p>
                  <BuildInfo variant='compact' />
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('about.systemInformation')}
                  </h3>

                  <div className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>
                        {t('system.platform')}
                      </span>
                      <span className='text-foreground'>
                        {t('system.platformValue')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>
                        {t('system.database')}
                      </span>
                      <span className='text-foreground'>
                        {t('system.databaseValue')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>
                        {t('system.aiEngine')}
                      </span>
                      <span className='text-foreground'>
                        {(preferences.aiSettings.modelType || 'gemini') ===
                        'local'
                          ? t('ai.model.local')
                          : t('ai.model.gemini')}
                      </span>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Build Information
                  </h3>
                  <BuildInfo variant='detailed' />
                </div>

                <Divider className='bg-divider' />

                <div className='text-center'>
                  <p className='text-xs text-foreground-500'>
                    {t('about.copyright')}
                  </p>
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
};
