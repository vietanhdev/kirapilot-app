import React, { useState } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Switch,
  Select,
  SelectItem,
  Input,
  Slider,
  Divider,
} from '@heroui/react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bot,
  Clock,
  CheckSquare,
  Info,
} from 'lucide-react';
import { DistractionLevel, Priority } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../i18n';
import { DataManagement } from './DataManagement';

interface SettingsProps {
  className?: string;
}

export const Settings: React.FC<SettingsProps> = ({ className = '' }) => {
  const {
    preferences,
    updatePreference,
    updateNestedPreference,
    resetToDefaults: contextResetToDefaults,
    isLoading,
    error,
  } = useSettings();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');

  const getNotificationLabel = (key: string): string => {
    const notificationLabels: Record<string, string> = {
      breakReminders: t('notifications.breakReminders'),
      taskDeadlines: t('notifications.taskDeadlines'),
      dailySummary: t('notifications.dailySummary'),
      weeklyReview: t('notifications.weeklyReview'),
    };
    return (
      notificationLabels[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase()
    );
  };

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
            <button
              onClick={resetToDefaults}
              className='px-4 py-2 text-sm bg-content3 hover:bg-danger/10 text-foreground hover:text-danger border border-divider hover:border-danger/30 rounded-lg transition-all duration-200 font-medium'
              disabled={isLoading}
            >
              {t('settings.resetToDefaults')}
            </button>
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
                    {t('settings.general.appPreferences')}
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
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
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
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
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
                        className='w-full'
                        classNames={{
                          input: 'bg-content2 text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 data-[focus=true]:bg-content3 data-[focus=true]:border-primary-500',
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
                        className='w-full'
                        classNames={{
                          input: 'bg-content2 text-foreground',
                          inputWrapper:
                            'bg-content2 border-divider data-[hover=true]:bg-content3 data-[focus=true]:bg-content3 data-[focus=true]:border-primary-500',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    {t('settings.general.notifications')}
                  </h3>

                  <div className='space-y-3'>
                    {Object.entries(preferences.notifications).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className='flex items-center justify-between'
                        >
                          <div>
                            <label className='text-sm font-medium text-foreground'>
                              {getNotificationLabel(key)}
                            </label>
                          </div>
                          <Switch
                            isSelected={value}
                            onValueChange={checked =>
                              handleNestedPreferenceChange(
                                'notifications',
                                key,
                                checked
                              )
                            }
                            size='sm'
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </Tab>

            <Tab
              key='privacy'
              title={
                <div className='flex items-center space-x-2'>
                  <Shield className='w-4 h-4' />
                  <span>Privacy & Security</span>
                </div>
              }
            >
              <div className='p-6'>
                <DataManagement />
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
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Kira AI Settings
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Conversation History
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Keep chat history for context
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
                          Auto-suggestions
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Receive proactive productivity suggestions
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
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Response Preferences
                  </h3>

                  <div className='space-y-4'>
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
                        className='w-full'
                        size='sm'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
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
                        className='w-full'
                        size='sm'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
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
                    Timer Preferences
                  </h3>

                  <div className='space-y-6'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Default Session Length:{' '}
                        {preferences.focusPreferences.defaultDuration} minutes
                      </label>
                      <Slider
                        value={[preferences.focusPreferences.defaultDuration]}
                        onChange={(value: number | number[]) => {
                          const numValue = Array.isArray(value)
                            ? value[0]
                            : value;
                          handleNestedPreferenceChange(
                            'focusPreferences',
                            'defaultDuration',
                            numValue
                          );
                        }}
                        minValue={5}
                        maxValue={120}
                        step={5}
                        className='w-full'
                        classNames={{
                          track: 'bg-content3',
                          filler: 'bg-primary-500',
                          thumb: 'bg-primary-500 border-primary-500',
                        }}
                      />
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Break Interval:{' '}
                        {preferences.breakPreferences.breakInterval} minutes
                      </label>
                      <Slider
                        value={[preferences.breakPreferences.breakInterval]}
                        onChange={(value: number | number[]) => {
                          const numValue = Array.isArray(value)
                            ? value[0]
                            : value;
                          handleNestedPreferenceChange(
                            'breakPreferences',
                            'breakInterval',
                            numValue
                          );
                        }}
                        minValue={15}
                        maxValue={60}
                        step={5}
                        className='w-full'
                        classNames={{
                          track: 'bg-content3',
                          filler: 'bg-primary-500',
                          thumb: 'bg-primary-500 border-primary-500',
                        }}
                      />
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Short Break Duration:{' '}
                        {preferences.breakPreferences.shortBreakDuration}{' '}
                        minutes
                      </label>
                      <Slider
                        value={[
                          preferences.breakPreferences.shortBreakDuration,
                        ]}
                        onChange={(value: number | number[]) => {
                          const numValue = Array.isArray(value)
                            ? value[0]
                            : value;
                          handleNestedPreferenceChange(
                            'breakPreferences',
                            'shortBreakDuration',
                            numValue
                          );
                        }}
                        minValue={3}
                        maxValue={15}
                        step={1}
                        className='w-full'
                        classNames={{
                          track: 'bg-content3',
                          filler: 'bg-primary-500',
                          thumb: 'bg-primary-500 border-primary-500',
                        }}
                      />
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Long Break Duration:{' '}
                        {preferences.breakPreferences.longBreakDuration} minutes
                      </label>
                      <Slider
                        value={[preferences.breakPreferences.longBreakDuration]}
                        onChange={(value: number | number[]) => {
                          const numValue = Array.isArray(value)
                            ? value[0]
                            : value;
                          handleNestedPreferenceChange(
                            'breakPreferences',
                            'longBreakDuration',
                            numValue
                          );
                        }}
                        minValue={10}
                        maxValue={30}
                        step={5}
                        className='w-full'
                        classNames={{
                          track: 'bg-content3',
                          filler: 'bg-primary-500',
                          thumb: 'bg-primary-500 border-primary-500',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Focus Settings
                  </h3>

                  <div className='space-y-4'>
                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Distraction Level
                      </label>
                      <Select
                        selectedKeys={[
                          preferences.focusPreferences.distractionLevel,
                        ]}
                        onSelectionChange={keys => {
                          const level = Array.from(keys)[0] as DistractionLevel;
                          handleNestedPreferenceChange(
                            'focusPreferences',
                            'distractionLevel',
                            level
                          );
                        }}
                        className='w-full'
                        size='sm'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                        }}
                      >
                        <SelectItem key={DistractionLevel.NONE}>
                          None
                        </SelectItem>
                        <SelectItem key={DistractionLevel.MINIMAL}>
                          Minimal
                        </SelectItem>
                        <SelectItem key={DistractionLevel.MODERATE}>
                          Moderate
                        </SelectItem>
                        <SelectItem key={DistractionLevel.FULL}>
                          Full
                        </SelectItem>
                      </Select>
                    </div>

                    <div>
                      <label className='text-sm font-medium text-foreground block mb-2'>
                        Background Audio Volume:{' '}
                        {preferences.focusPreferences.backgroundAudio.volume}%
                      </label>
                      <Slider
                        value={[
                          preferences.focusPreferences.backgroundAudio.volume,
                        ]}
                        onChange={(value: number | number[]) => {
                          const numValue = Array.isArray(value)
                            ? value[0]
                            : value;
                          handleNestedPreferenceChange(
                            'focusPreferences',
                            'backgroundAudio',
                            {
                              ...preferences.focusPreferences.backgroundAudio,
                              volume: numValue,
                            }
                          );
                        }}
                        minValue={0}
                        maxValue={100}
                        step={5}
                        className='w-full'
                        classNames={{
                          track: 'bg-content3',
                          filler: 'bg-primary-500',
                          thumb: 'bg-primary-500 border-primary-500',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Tab>

            <Tab
              key='tasks'
              title={
                <div className='flex items-center space-x-2'>
                  <CheckSquare className='w-4 h-4' />
                  <span>Task Management</span>
                </div>
              }
            >
              <div className='p-6 space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Default Settings
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Default Priority
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Priority level for new tasks
                        </p>
                      </div>
                      <Select
                        selectedKeys={[
                          preferences.taskSettings.defaultPriority.toString(),
                        ]}
                        onSelectionChange={keys => {
                          const priority = parseInt(
                            Array.from(keys)[0] as string
                          ) as Priority;
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'defaultPriority',
                            priority
                          );
                        }}
                        className='w-32'
                        size='sm'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                        }}
                      >
                        <SelectItem key={Priority.LOW.toString()}>
                          Low
                        </SelectItem>
                        <SelectItem key={Priority.MEDIUM.toString()}>
                          Medium
                        </SelectItem>
                        <SelectItem key={Priority.HIGH.toString()}>
                          High
                        </SelectItem>
                        <SelectItem key={Priority.URGENT.toString()}>
                          Urgent
                        </SelectItem>
                      </Select>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Auto-scheduling
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Automatically schedule tasks based on priority
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.taskSettings.autoScheduling}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'autoScheduling',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Smart Dependencies
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Suggest task dependencies automatically
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.taskSettings.smartDependencies}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'smartDependencies',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Planning Preferences
                  </h3>

                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Week Start Day
                        </label>
                        <p className='text-xs text-foreground-600'>
                          First day of the week in planning view
                        </p>
                      </div>
                      <Select
                        selectedKeys={[
                          preferences.taskSettings.weekStartDay.toString(),
                        ]}
                        onSelectionChange={keys => {
                          const day = parseInt(
                            Array.from(keys)[0] as string
                          ) as 0 | 1;
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'weekStartDay',
                            day
                          );
                        }}
                        className='w-32'
                        size='sm'
                        classNames={{
                          trigger:
                            'bg-content2 border-divider data-[hover=true]:bg-content3',
                        }}
                      >
                        <SelectItem key='0'>Sunday</SelectItem>
                        <SelectItem key='1'>Monday</SelectItem>
                      </Select>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Show Completed Tasks
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Display completed tasks in planning view
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.taskSettings.showCompletedTasks}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'showCompletedTasks',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <label className='text-sm font-medium text-foreground'>
                          Compact View
                        </label>
                        <p className='text-xs text-foreground-600'>
                          Use compact layout for task cards
                        </p>
                      </div>
                      <Switch
                        isSelected={preferences.taskSettings.compactView}
                        onValueChange={checked =>
                          handleNestedPreferenceChange(
                            'taskSettings',
                            'compactView',
                            checked
                          )
                        }
                        size='sm'
                      />
                    </div>
                  </div>
                </div>
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
                    <CheckSquare className='w-8 h-8 text-white' />
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
                    <div className='flex justify-between'>
                      <span className='text-foreground-600'>Build</span>
                      <span className='text-foreground'>Development</span>
                    </div>
                  </div>
                </div>

                <Divider className='bg-divider' />

                <div>
                  <h3 className='text-lg font-semibold text-foreground mb-4'>
                    Credits
                  </h3>

                  <div className='space-y-2 text-sm'>
                    <p className='text-foreground-600'>
                      Built with React, TypeScript, and Tauri
                    </p>
                    <p className='text-foreground-600'>
                      UI components by HeroUI
                    </p>
                    <p className='text-foreground-600'>Icons by Lucide React</p>
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
