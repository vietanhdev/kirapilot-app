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
  HardDrive,
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../i18n';
import { DataManagement } from './DataManagement';
import { LoggingSettings } from './LoggingSettings';
import { useAI } from '../../contexts/AIContext';
import {
  LocalAIService,
  ResourceUsage,
} from '../../services/ai/LocalAIService';
import { ModelStatusCard } from './ModelStatusCard';
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
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(
    null
  );
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

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

  // Resource management functions
  const fetchResourceData = async () => {
    if (preferences.aiSettings.modelType !== 'local') {
      return;
    }

    setLoadingResources(true);
    try {
      const aiService = (window as unknown as { aiService?: LocalAIService })
        .aiService;
      if (aiService && aiService instanceof LocalAIService) {
        const [usage, recs] = await Promise.all([
          aiService.getResourceUsage(),
          aiService.getPerformanceRecommendations(),
        ]);

        setResourceUsage(usage);
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Failed to fetch resource data:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  // Fetch resource data when AI settings change or component mounts
  useEffect(() => {
    if (preferences.aiSettings.modelType === 'local') {
      fetchResourceData();

      // Set up periodic refresh
      const interval = setInterval(fetchResourceData, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }
  }, [preferences.aiSettings.modelType]);

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
                {/* Model Selection */}
                {/* Model Selection */}
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
                    <Bot className='w-5 h-5' />
                    {t('settings.ai.modelSelection')}
                  </h3>

                  <div className='space-y-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.ai.modelType')}
                      </label>
                      <Select
                        selectedKeys={[
                          preferences.aiSettings.modelType || 'gemini',
                        ]}
                        onSelectionChange={keys => {
                          const modelType = Array.from(keys)[0] as
                            | 'local'
                            | 'gemini';
                          handleNestedPreferenceChange(
                            'aiSettings',
                            'modelType',
                            modelType
                          );
                        }}
                        size='sm'
                        aria-label='AI model type selection'
                        placeholder='Select AI model type'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                          value: 'text-foreground',
                        }}
                      >
                        <SelectItem
                          key='gemini'
                          startContent={<Cloud className='w-4 h-4' />}
                        >
                          {t('ai.model.gemini')}
                        </SelectItem>
                        <SelectItem
                          key='local'
                          startContent={<HardDrive className='w-4 h-4' />}
                        >
                          {t('ai.model.local')}
                        </SelectItem>
                      </Select>
                      <p className='text-xs text-foreground-600 mt-1'>
                        {(preferences.aiSettings.modelType || 'gemini') ===
                        'local'
                          ? t('settings.ai.localModelDescription')
                          : t('settings.ai.geminiModelDescription')}
                      </p>
                    </div>

                    {/* Enhanced status display with error handling */}
                    <ModelStatusCard
                      modelType={preferences.aiSettings.modelType || 'gemini'}
                      onRecovery={() => {
                        // Trigger model recovery
                        reinitializeAI();
                      }}
                    />
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.apiConfiguration')}
                  </h3>

                  <div className='space-y-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        {t('settings.geminiApiKey')}
                      </label>
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
                          {t('settings.apiKeyConfigured')}
                        </p>
                      )}
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

                {/* Resource Management Section - Only show for local model */}
                {(preferences.aiSettings.modelType || 'gemini') === 'local' && (
                  <div>
                    <Divider className='my-6' />
                    <h3 className='text-lg font-semibold text-foreground mb-4'>
                      {t('settings.ai.resourceManagement')}
                    </h3>

                    <div className='space-y-4'>
                      {/* Resource Usage Display */}
                      <Card>
                        <CardBody className='p-4'>
                          <div className='flex items-center justify-between mb-3'>
                            <h4 className='text-sm font-medium text-foreground'>
                              {t('settings.ai.resourceUsage')}
                            </h4>
                            <Button
                              size='sm'
                              variant='light'
                              onPress={fetchResourceData}
                              isLoading={loadingResources}
                            >
                              {t('common.refresh')}
                            </Button>
                          </div>

                          {resourceUsage ? (
                            <div className='grid grid-cols-2 gap-4 text-sm'>
                              <div>
                                <span className='text-foreground-600'>
                                  {t('settings.ai.memoryUsage')}:
                                </span>
                                <span className='ml-2 font-medium'>
                                  {resourceUsage.memory_usage_mb} MB
                                </span>
                              </div>
                              <div>
                                <span className='text-foreground-600'>
                                  {t('settings.ai.cpuUsage')}:
                                </span>
                                <span className='ml-2 font-medium'>
                                  {resourceUsage.cpu_usage_percent.toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <span className='text-foreground-600'>
                                  {t('settings.ai.activeRequests')}:
                                </span>
                                <span className='ml-2 font-medium'>
                                  {resourceUsage.active_requests}
                                </span>
                              </div>
                              <div>
                                <span className='text-foreground-600'>
                                  {t('settings.ai.avgProcessingTime')}:
                                </span>
                                <span className='ml-2 font-medium'>
                                  {resourceUsage.avg_processing_time_ms}ms
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className='text-sm text-foreground-600'>
                              {loadingResources
                                ? t('common.loading')
                                : t('settings.ai.resourceDataUnavailable')}
                            </p>
                          )}
                        </CardBody>
                      </Card>

                      {/* Performance Recommendations */}
                      {recommendations.length > 0 && (
                        <Card>
                          <CardBody className='p-4'>
                            <h4 className='text-sm font-medium text-foreground mb-3'>
                              {t('settings.ai.performanceRecommendations')}
                            </h4>
                            <div className='space-y-2'>
                              {recommendations.map((rec, index) => (
                                <div
                                  key={index}
                                  className='text-sm text-foreground-600 bg-warning-50 dark:bg-warning-900/20 p-2 rounded-md'
                                >
                                  {rec}
                                </div>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                      {/* Resource Configuration */}
                      <Card>
                        <CardBody className='p-4'>
                          <h4 className='text-sm font-medium text-foreground mb-3'>
                            {t('settings.ai.resourceConfiguration')}
                          </h4>
                          <div className='space-y-3'>
                            <div>
                              <label className='text-sm font-medium text-foreground block mb-1'>
                                {t('settings.ai.threadCount')}
                              </label>
                              <Select
                                selectedKeys={[
                                  preferences.aiSettings.localModelConfig?.threads?.toString() ||
                                    '4',
                                ]}
                                onSelectionChange={keys => {
                                  const threads = parseInt(
                                    Array.from(keys)[0] as string
                                  );
                                  handleNestedPreferenceChange(
                                    'aiSettings',
                                    'localModelConfig',
                                    {
                                      ...preferences.aiSettings
                                        .localModelConfig,
                                      threads,
                                    }
                                  );
                                }}
                                size='sm'
                                classNames={{
                                  trigger:
                                    'bg-content2 border-divider data-[hover=true]:bg-content3',
                                  value: 'text-foreground',
                                }}
                              >
                                <SelectItem key='1'>
                                  1 {t('settings.ai.threadSingular')}
                                </SelectItem>
                                <SelectItem key='2'>
                                  2 {t('settings.ai.threadPlural')}
                                </SelectItem>
                                <SelectItem key='4'>
                                  4 {t('settings.ai.threadPlural')}
                                </SelectItem>
                                <SelectItem key='6'>
                                  6 {t('settings.ai.threadPlural')}
                                </SelectItem>
                                <SelectItem key='8'>
                                  8 {t('settings.ai.threadPlural')}
                                </SelectItem>
                              </Select>
                              <p className='text-xs text-foreground-600 mt-1'>
                                {t('settings.ai.threadCountDescription')}
                              </p>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  </div>
                )}

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
