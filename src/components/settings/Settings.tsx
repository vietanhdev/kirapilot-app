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
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../i18n';
import { DataManagement } from './DataManagement';
import { useAI } from '../../contexts/AIContext';

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

  const handleApiKeyChange = async (apiKey: string) => {
    const trimmedKey = apiKey.trim();

    try {
      // Update preferences first
      handleNestedPreferenceChange(
        'aiSettings',
        'geminiApiKey',
        trimmedKey || undefined
      );

      // Reinitialize AI service to pick up the new API key
      setTimeout(() => {
        reinitializeAI();
      }, 100); // Small delay to ensure preferences are saved
    } catch (error) {
      console.error('Failed to update API key:', error);
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
                  <span>General</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Appearance
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Theme
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Choose your preferred color scheme
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
                        <SelectItem key='light'>Light</SelectItem>
                        <SelectItem key='dark'>Dark</SelectItem>
                        <SelectItem key='auto'>Auto</SelectItem>
                      </Select>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Language
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Select your preferred language
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
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Working Hours
                  </h3>

                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Start Time
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
                        End Time
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
              </div>
            </Tab>

            <Tab
              key='ai'
              title={
                <div className='flex items-center space-x-2'>
                  <Bot className='w-4 h-4' />
                  <span>AI Assistant</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    API Configuration
                  </h3>

                  <div className='space-y-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Gemini API Key
                      </label>
                      <p className='text-xs text-foreground-600 mb-3'>
                        Enter your Google Gemini API key to enable AI features.
                        Get your key from{' '}
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
                          placeholder='Enter your Gemini API key...'
                          size='sm'
                          classNames={{
                            input:
                              'text-foreground placeholder:text-foreground-500',
                            inputWrapper:
                              'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                          }}
                          endContent={
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
                          }
                        />
                      </div>
                      {preferences.aiSettings.geminiApiKey && (
                        <p className='text-xs text-success mt-2'>
                          ✓ API key configured
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    AI Behavior
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Conversation History
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Keep chat history for better context
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
                          Auto Suggestions
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Show AI suggestions automatically
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
                          Tool Permissions
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Allow AI to modify tasks and timers
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

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Response Style
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
                        <SelectItem key='concise'>Concise</SelectItem>
                        <SelectItem key='balanced'>Balanced</SelectItem>
                        <SelectItem key='detailed'>Detailed</SelectItem>
                      </Select>
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Suggestion Frequency
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
                        <SelectItem key='minimal'>Minimal</SelectItem>
                        <SelectItem key='moderate'>Moderate</SelectItem>
                        <SelectItem key='frequent'>Frequent</SelectItem>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </Tab>

            <Tab
              key='time'
              title={
                <div className='flex items-center space-x-2'>
                  <Clock className='w-4 h-4' />
                  <span>Time Tracking</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Timer Settings
                  </h3>

                  <div className='space-y-6'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Default Session Length:{' '}
                        {preferences.focusPreferences.defaultDuration} minutes
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
                        Break Interval:{' '}
                        {preferences.breakPreferences.breakInterval} minutes
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
                  <span>Privacy & Data</span>
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
                  <span>About</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div className='text-center'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg'>
                    <Bot className='w-8 h-8 text-white' />
                  </div>
                  <h2 className='text-2xl font-bold text-foreground mb-2'>
                    KiraPilot
                  </h2>
                  <p className='text-foreground-600 mb-4'>
                    Intelligent Productivity Assistant
                  </p>
                  <div className='inline-flex items-center px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm'>
                    Version 0.1.0
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    System Information
                  </h3>

                  <div className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>Platform</span>
                      <span className='text-foreground'>Desktop (Tauri)</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>Database</span>
                      <span className='text-foreground'>SQLite (Local)</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>AI Engine</span>
                      <span className='text-foreground'>Google Gemini</span>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div className='text-center'>
                  <p className='text-xs text-foreground-500'>
                    © 2024 KiraPilot. All rights reserved.
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
