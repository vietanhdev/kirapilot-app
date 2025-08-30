import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
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
} from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../i18n';
import { DataManagement } from './DataManagement';
import { LoggingSettings } from './LoggingSettings';
import { SoundSettings } from './SoundSettings';

import { AISettings } from './AISettings';
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
  const [activeTab, setActiveTab] = useState(initialTab);

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
              <div className='p-6'>
                <AISettings />
              </div>
            </Tab>

            <Tab
              key='logging'
              title={
                <div className='flex items-center space-x-2'>
                  <Info className='w-4 h-4' />
                  <span>Logging</span>
                </div>
              }
            >
              <div className='p-6'>
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
