import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Input,
  Button,
  Chip,
  Progress,
  Switch,
  Divider,
  Tooltip,
  Spinner,
} from '@heroui/react';
import {
  Bot,
  Cloud,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
} from 'lucide-react';

import { useAI } from '../../contexts/AIContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ModelStatus } from '../../services/ai/AIServiceInterface';
import { LocalModelSelector } from './LocalModelSelector';

interface AISettingsProps {
  className?: string;
}

export const AISettings: React.FC<AISettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { preferences, updateNestedPreference } = useSettings();
  const {
    currentModelType,
    switchModel,
    isLoading: aiLoading,
    error: aiError,
    reinitializeAI,
    getModelStatus,
  } = useAI();

  // Local state
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [switchingModel, setSwitchingModel] = useState(false);

  // Update model status periodically
  useEffect(() => {
    const updateStatus = () => {
      try {
        const status = getModelStatus();
        setModelStatus(status);
      } catch (error) {
        console.error('Failed to get model status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 3000);
    return () => clearInterval(interval);
  }, [getModelStatus]);

  // Handle model type change
  const handleModelTypeChange = async (modelType: 'local' | 'gemini') => {
    if (switchingModel || modelType === currentModelType) {
      return;
    }

    setSwitchingModel(true);
    try {
      await switchModel(modelType);
      // Update preferences to persist the selection
      await updateNestedPreference('aiSettings', 'modelType', modelType);
    } catch (error) {
      console.error('Failed to switch model:', error);
    } finally {
      setSwitchingModel(false);
    }
  };

  // Handle API key change
  const handleApiKeyChange = async (apiKey: string) => {
    const trimmedKey = apiKey.trim();
    await updateNestedPreference(
      'aiSettings',
      'geminiApiKey',
      trimmedKey || undefined
    );

    // If we're currently using Gemini, reinitialize to pick up the new key
    if (currentModelType === 'gemini') {
      setTimeout(() => {
        reinitializeAI();
      }, 100);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      reinitializeAI();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Handle local model change
  const handleLocalModelChange = async (modelId: string) => {
    if (switchingModel) {
      return;
    }

    setSwitchingModel(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // First switch the model at llama service level
      const result = await invoke<string>('switch_local_model', { modelId });
      console.log('Model switched successfully:', result);

      // Reload the AI service to pick up the new model
      const reloadResult = await invoke<string>('reload_ai_service');
      console.log('AI service reloaded:', reloadResult);

      // Small delay to ensure everything is settled
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Model switch and AI reload completed');
    } catch (error) {
      console.error('Failed to switch local model:', error);
    } finally {
      setSwitchingModel(false);
    }
  };

  // Get status display info
  const getStatusDisplay = () => {
    if (!modelStatus) {
      return {
        color: 'default' as const,
        icon: <Spinner size='sm' />,
        text: 'Loading...',
      };
    }

    if (modelStatus.isLoading) {
      return {
        color: 'warning' as const,
        icon: <RefreshCw className='w-4 h-4 animate-spin' />,
        text: 'Initializing...',
      };
    }

    if (modelStatus.error) {
      return {
        color: 'danger' as const,
        icon: <XCircle className='w-4 h-4' />,
        text: 'Error',
      };
    }

    if (modelStatus.isReady) {
      return {
        color: 'success' as const,
        icon: <CheckCircle className='w-4 h-4' />,
        text: 'Ready',
      };
    }

    return {
      color: 'warning' as const,
      icon: <AlertTriangle className='w-4 h-4' />,
      text: 'Not Ready',
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Model Selection */}
      <Card>
        <CardBody className='p-6'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                  <Bot className='w-5 h-5' />
                  {t('settings.ai.modelSelection')}
                </h3>
                <p className='text-sm text-foreground-600 mt-1'>
                  Choose between local AI model or cloud-based Gemini
                </p>
              </div>
              <Tooltip content='Refresh status'>
                <Button
                  isIconOnly
                  size='sm'
                  variant='light'
                  onPress={handleRefresh}
                  isLoading={isRefreshing}
                >
                  <RefreshCw className='w-4 h-4' />
                </Button>
              </Tooltip>
            </div>

            {/* Model Type Selector */}
            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                AI Model Type
              </label>
              <Select
                selectedKeys={[currentModelType]}
                onSelectionChange={keys => {
                  const modelType = Array.from(keys)[0] as 'local' | 'gemini';
                  handleModelTypeChange(modelType);
                }}
                isDisabled={switchingModel || aiLoading}
                size='sm'
                classNames={{
                  trigger:
                    'bg-content2 border-divider data-[hover=true]:bg-content3',
                  value: 'text-foreground',
                }}
              >
                <SelectItem
                  key='local'
                  startContent={<HardDrive className='w-4 h-4' />}
                >
                  Local Model - Privacy-focused, runs on your device
                </SelectItem>
                <SelectItem
                  key='gemini'
                  startContent={<Cloud className='w-4 h-4' />}
                >
                  Gemini API - Cloud-based, requires API key
                </SelectItem>
              </Select>
            </div>

            {/* Status Display */}
            <div className='flex items-center justify-between p-3 bg-content2 rounded-lg'>
              <div className='flex items-center gap-3'>
                {statusDisplay.icon}
                <div>
                  <p className='text-sm font-medium text-foreground'>
                    {currentModelType === 'local'
                      ? 'Local Model'
                      : 'Gemini API'}{' '}
                    Status
                  </p>
                  <p className='text-xs text-foreground-600'>
                    {statusDisplay.text}
                    {switchingModel && ' - Switching...'}
                  </p>
                </div>
              </div>
              <Chip
                size='sm'
                color={statusDisplay.color}
                variant='flat'
                startContent={
                  currentModelType === 'local' ? (
                    <HardDrive className='w-3 h-3' />
                  ) : (
                    <Cloud className='w-3 h-3' />
                  )
                }
              >
                {currentModelType === 'local' ? 'Local' : 'Cloud'}
              </Chip>
            </div>

            {/* Error Display */}
            {(aiError || modelStatus?.error) && (
              <div className='p-3 bg-danger/20 border border-danger/30 rounded-lg'>
                <div className='flex items-start gap-2'>
                  <XCircle className='w-4 h-4 text-danger mt-0.5 flex-shrink-0' />
                  <div>
                    <p className='text-sm font-medium text-danger'>
                      Model Error
                    </p>
                    <p className='text-xs text-danger/80 mt-1'>
                      {aiError || modelStatus?.error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Download Progress for Local Model */}
            {currentModelType === 'local' &&
              modelStatus?.isLoading &&
              modelStatus.downloadProgress !== undefined && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-foreground'>
                      Downloading local model...
                    </span>
                    <span className='text-sm text-foreground-600'>
                      {Math.round(modelStatus.downloadProgress)}%
                    </span>
                  </div>
                  <Progress
                    value={modelStatus.downloadProgress}
                    color='primary'
                    size='sm'
                  />
                </div>
              )}
          </div>
        </CardBody>
      </Card>

      {/* Local Model Selection */}
      {currentModelType === 'local' && (
        <LocalModelSelector
          onModelChange={modelId => handleLocalModelChange(modelId)}
          isLoading={switchingModel}
        />
      )}

      {/* Gemini API Configuration */}
      {currentModelType === 'gemini' && (
        <Card>
          <CardBody className='p-6'>
            <div className='space-y-4'>
              <div>
                <h4 className='text-md font-semibold text-foreground mb-2'>
                  Gemini API Configuration
                </h4>
                <p className='text-sm text-foreground-600'>
                  Get your free API key from{' '}
                  <a
                    href='https://aistudio.google.com/app/apikey'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary-500 hover:text-primary-600 underline'
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div>
                <label className='text-sm font-medium text-foreground block mb-2'>
                  API Key
                </label>
                <div className='relative'>
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={preferences.aiSettings.geminiApiKey || ''}
                    onValueChange={handleApiKeyChange}
                    placeholder='Enter your Gemini API key'
                    size='sm'
                    classNames={{
                      input: 'text-foreground placeholder:text-foreground-500',
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
          </CardBody>
        </Card>
      )}

      {/* Local Model Configuration */}
      {currentModelType === 'local' && (
        <Card>
          <CardBody className='p-6'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-md font-semibold text-foreground flex items-center gap-2'>
                    <SettingsIcon className='w-4 h-4' />
                    Local Model Configuration
                  </h4>
                  <p className='text-sm text-foreground-600 mt-1'>
                    Advanced settings for local AI model performance
                  </p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium text-foreground block mb-2'>
                    CPU Threads:{' '}
                    {preferences.aiSettings.localModelConfig?.threads || 4}
                  </label>
                  <Input
                    type='number'
                    value={(
                      preferences.aiSettings.localModelConfig?.threads || 4
                    ).toString()}
                    onChange={e => {
                      const value = parseInt(e.target.value) || 4;
                      updateNestedPreference('aiSettings', 'localModelConfig', {
                        ...preferences.aiSettings.localModelConfig,
                        threads: Math.max(1, Math.min(16, value)),
                      });
                    }}
                    min={1}
                    max={16}
                    size='sm'
                    className='w-full'
                  />
                </div>

                <div>
                  <label className='text-sm font-medium text-foreground block mb-2'>
                    Temperature:{' '}
                    {preferences.aiSettings.localModelConfig?.temperature ||
                      0.7}
                  </label>
                  <Input
                    type='number'
                    value={(
                      preferences.aiSettings.localModelConfig?.temperature ||
                      0.7
                    ).toString()}
                    onChange={e => {
                      const value = parseFloat(e.target.value) || 0.7;
                      updateNestedPreference('aiSettings', 'localModelConfig', {
                        ...preferences.aiSettings.localModelConfig,
                        temperature: Math.max(0.1, Math.min(2.0, value)),
                      });
                    }}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    size='sm'
                    className='w-full'
                  />
                </div>
              </div>

              <div className='text-xs text-foreground-600 bg-content2 p-3 rounded-lg'>
                <p>
                  <strong>Threads:</strong> More threads can improve performance
                  but use more CPU
                </p>
                <p>
                  <strong>Temperature:</strong> Lower values (0.1-0.5) for
                  focused responses, higher (0.8-1.5) for creative responses
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Divider className='bg-divider' />

      {/* AI Behavior Settings */}
      <Card>
        <CardBody className='p-6'>
          <div className='space-y-4'>
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
                    Remember previous messages in the conversation
                  </p>
                </div>
                <Switch
                  isSelected={preferences.aiSettings.conversationHistory}
                  onValueChange={checked =>
                    updateNestedPreference(
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
                    Automatically suggest helpful actions
                  </p>
                </div>
                <Switch
                  isSelected={preferences.aiSettings.autoSuggestions}
                  onValueChange={checked =>
                    updateNestedPreference(
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
                    Allow AI to create and modify tasks
                  </p>
                </div>
                <Switch
                  isSelected={preferences.aiSettings.toolPermissions}
                  onValueChange={checked =>
                    updateNestedPreference(
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
                    Display debugging information in navigation
                  </p>
                </div>
                <Switch
                  isSelected={preferences.aiSettings.showInteractionLogs}
                  onValueChange={checked =>
                    updateNestedPreference(
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
                  Response Style
                </label>
                <Select
                  selectedKeys={[preferences.aiSettings.responseStyle]}
                  onSelectionChange={keys => {
                    const style = Array.from(keys)[0] as
                      | 'concise'
                      | 'balanced'
                      | 'detailed';
                    updateNestedPreference(
                      'aiSettings',
                      'responseStyle',
                      style
                    );
                  }}
                  size='sm'
                  classNames={{
                    trigger:
                      'bg-content2 border-divider data-[hover=true]:bg-content3',
                    value: 'text-foreground',
                  }}
                >
                  <SelectItem key='concise'>
                    Concise - Brief, direct responses
                  </SelectItem>
                  <SelectItem key='balanced'>
                    Balanced - Moderate detail level
                  </SelectItem>
                  <SelectItem key='detailed'>
                    Detailed - Comprehensive explanations
                  </SelectItem>
                </Select>
              </div>

              <div>
                <label className='text-sm font-medium text-foreground block mb-2'>
                  Suggestion Frequency
                </label>
                <Select
                  selectedKeys={[preferences.aiSettings.suggestionFrequency]}
                  onSelectionChange={keys => {
                    const frequency = Array.from(keys)[0] as
                      | 'minimal'
                      | 'moderate'
                      | 'frequent';
                    updateNestedPreference(
                      'aiSettings',
                      'suggestionFrequency',
                      frequency
                    );
                  }}
                  size='sm'
                  classNames={{
                    trigger:
                      'bg-content2 border-divider data-[hover=true]:bg-content3',
                    value: 'text-foreground',
                  }}
                >
                  <SelectItem key='minimal'>
                    Minimal - Only when requested
                  </SelectItem>
                  <SelectItem key='moderate'>
                    Moderate - Helpful suggestions
                  </SelectItem>
                  <SelectItem key='frequent'>
                    Frequent - Proactive assistance
                  </SelectItem>
                </Select>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
