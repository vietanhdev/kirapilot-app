import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Input,
  Button,
  Progress,
  Chip,
  Divider,
  Spinner,
} from '@heroui/react';
import {
  Bot,
  Cloud,
  HardDrive,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  Loader,
  Cpu,
  MemoryStick,
  Thermometer,
  Hash,
} from 'lucide-react';

import { useAI } from '../../contexts/AIContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ModelStatus } from '../../services/ai/AIServiceInterface';

interface ModelSelectionCardProps {
  className?: string;
}

export const ModelSelectionCard: React.FC<ModelSelectionCardProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { preferences, updateNestedPreference } = useSettings();
  const { modelManager, reinitializeAI } = useAI();

  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback(() => {
    if (modelManager) {
      const status = modelManager.getModelStatus();
      setModelStatus(prevStatus => {
        // Only update if status actually changed to prevent unnecessary re-renders
        if (
          !prevStatus ||
          prevStatus.type !== status.type ||
          prevStatus.isReady !== status.isReady ||
          prevStatus.isLoading !== status.isLoading ||
          prevStatus.error !== status.error ||
          prevStatus.downloadProgress !== status.downloadProgress
        ) {
          return status;
        }
        return prevStatus;
      });
    }
  }, [modelManager]);

  // Initial status update and setup polling
  useEffect(() => {
    updateStatus();

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only start polling if we have a model manager
    if (modelManager) {
      intervalRef.current = setInterval(updateStatus, 2000); // Reduced frequency
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [modelManager, updateStatus]);

  const handleModelTypeChange = async (modelType: 'local' | 'gemini') => {
    if (!modelManager) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Update preferences first
      await updateNestedPreference('aiSettings', 'modelType', modelType);

      // If switching to local model, start auto-loading immediately
      if (modelType === 'local') {
        // Start auto-loading in background (non-blocking)
        // Auto-load functionality removed for Gemini-only setup
        // TODO: Remove this component when local model support is fully removed
        console.log('Auto-load not available in Gemini-only mode');

        // Update the UI immediately to show we're switching
        setIsLoading(false);

        // Reinitialize AI context to pick up the preference change
        await reinitializeAI();

        return;
      }

      // For Gemini or other models, switch normally
      await modelManager.switchModel(modelType, {
        type: modelType,
        apiKey: preferences.aiSettings.geminiApiKey,
      });

      // Reinitialize AI context
      await reinitializeAI();
    } catch (err) {
      console.error('Failed to switch model:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalConfigChange = async (key: string, value: number) => {
    const currentConfig = preferences.aiSettings.localModelConfig || {};
    const newConfig = { ...currentConfig, [key]: value };
    await updateNestedPreference('aiSettings', 'localModelConfig', newConfig);
  };

  const getStatusIcon = (status: ModelStatus | null) => {
    if (!status) {
      return <Loader className='w-4 h-4 animate-spin' />;
    }

    if (status.isLoading) {
      return <Spinner size='sm' />;
    }

    if (status.error) {
      return <AlertCircle className='w-4 h-4 text-danger' />;
    }

    if (status.isReady) {
      return <CheckCircle className='w-4 h-4 text-success' />;
    }

    return <AlertCircle className='w-4 h-4 text-warning' />;
  };

  const getStatusText = (status: ModelStatus | null) => {
    if (!status) {
      return t('ai.model.status.unknown');
    }

    if (status.isLoading) {
      if (status.downloadProgress !== undefined) {
        return t('ai.model.status.downloading', {
          progress: Math.round(status.downloadProgress),
        });
      }
      return t('ai.model.status.loading');
    }

    if (status.error) {
      return t('ai.model.status.error');
    }

    if (status.isReady) {
      return t('ai.model.status.ready');
    }

    return t('ai.model.status.notReady');
  };

  const getStatusColor = (status: ModelStatus | null) => {
    if (!status || status.isLoading) {
      return 'default';
    }
    if (status.error) {
      return 'danger';
    }
    if (status.isReady) {
      return 'success';
    }
    return 'warning';
  };

  const currentModelType = preferences.aiSettings.modelType || 'gemini';
  const localConfig = preferences.aiSettings.localModelConfig || {};

  // Prevent rendering if essential dependencies are missing
  if (!preferences || !updateNestedPreference) {
    return null;
  }

  return (
    <Card className={`bg-content1 border-divider ${className}`}>
      <CardBody className='p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
            <Bot className='w-5 h-5' />
            {t('settings.ai.modelSelection')}
          </h3>

          <div className='space-y-4'>
            {/* Model Type Selection */}
            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                {t('settings.ai.modelType')}
              </label>
              <Select
                selectedKeys={[currentModelType]}
                onSelectionChange={keys => {
                  const modelType = Array.from(keys)[0] as 'local' | 'gemini';
                  handleModelTypeChange(modelType);
                }}
                size='sm'
                isDisabled={isLoading}
                aria-label='AI model type selection'
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
                {currentModelType === 'local'
                  ? t('settings.ai.localModelDescription')
                  : t('settings.ai.geminiModelDescription')}
              </p>
            </div>

            {/* Model Status */}
            <div className='flex items-center justify-between p-3 bg-content2 rounded-lg'>
              <div className='flex items-center gap-3'>
                {getStatusIcon(modelStatus)}
                <div>
                  <p className='text-sm font-medium text-foreground'>
                    {t('ai.model.status.title')}
                  </p>
                  <p className='text-xs text-foreground-600'>
                    {getStatusText(modelStatus)}
                  </p>
                </div>
              </div>
              <Chip
                size='sm'
                color={getStatusColor(modelStatus)}
                variant='flat'
              >
                {modelStatus?.type === 'local'
                  ? t('ai.model.local')
                  : t('ai.model.gemini')}
              </Chip>
            </div>

            {/* Download Progress */}
            {modelStatus?.isLoading &&
              modelStatus.downloadProgress !== undefined && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-foreground'>
                      {t('ai.model.downloading')}
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

            {/* Error Display */}
            {error && (
              <div className='p-3 bg-danger/20 border border-danger/30 rounded-lg'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='w-4 h-4 text-danger mt-0.5 flex-shrink-0' />
                  <div>
                    <p className='text-sm font-medium text-danger'>
                      {t('ai.model.error.title')}
                    </p>
                    <p className='text-xs text-danger/80 mt-1'>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Model Status Error */}
            {modelStatus?.error && (
              <div className='p-3 bg-danger/20 border border-danger/30 rounded-lg'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='w-4 h-4 text-danger mt-0.5 flex-shrink-0' />
                  <div>
                    <p className='text-sm font-medium text-danger'>
                      {t('ai.model.error.modelError')}
                    </p>
                    <p className='text-xs text-danger/80 mt-1'>
                      {modelStatus.error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Local Model Configuration */}
        {currentModelType === 'local' && (
          <>
            <Divider className='bg-divider' />

            <div>
              <div className='flex items-center justify-between mb-4'>
                <h4 className='text-md font-medium text-foreground flex items-center gap-2'>
                  <SettingsIcon className='w-4 h-4' />
                  {t('settings.ai.localModelConfig')}
                </h4>
                <Button
                  variant='light'
                  size='sm'
                  onPress={() => setShowAdvancedConfig(!showAdvancedConfig)}
                >
                  {showAdvancedConfig ? t('common.hide') : t('common.show')}
                </Button>
              </div>

              {showAdvancedConfig && (
                <div className='space-y-4'>
                  {/* Thread Count */}
                  <div>
                    <label className='text-sm font-medium text-foreground block mb-2 flex items-center gap-2'>
                      <Cpu className='w-4 h-4' />
                      {t('settings.ai.threads')}: {localConfig.threads || 4}
                    </label>
                    <Input
                      type='number'
                      value={(localConfig.threads || 4).toString()}
                      onChange={e => {
                        const value = parseInt(e.target.value) || 4;
                        handleLocalConfigChange(
                          'threads',
                          Math.max(1, Math.min(16, value))
                        );
                      }}
                      min={1}
                      max={16}
                      size='sm'
                      className='w-24'
                      classNames={{
                        input: 'text-foreground',
                        inputWrapper:
                          'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                      }}
                    />
                    <p className='text-xs text-foreground-600 mt-1'>
                      {t('settings.ai.threadsDescription')}
                    </p>
                  </div>

                  {/* Context Size */}
                  <div>
                    <label className='text-sm font-medium text-foreground block mb-2 flex items-center gap-2'>
                      <MemoryStick className='w-4 h-4' />
                      {t('settings.ai.contextSize')}:{' '}
                      {localConfig.contextSize || 2048}
                    </label>
                    <Select
                      selectedKeys={[
                        (localConfig.contextSize || 2048).toString(),
                      ]}
                      onSelectionChange={keys => {
                        const value = parseInt(Array.from(keys)[0] as string);
                        handleLocalConfigChange('contextSize', value);
                      }}
                      size='sm'
                      aria-label='Context size selection'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                      }}
                    >
                      <SelectItem key='1024'>1024</SelectItem>
                      <SelectItem key='2048'>2048</SelectItem>
                      <SelectItem key='4096'>4096</SelectItem>
                      <SelectItem key='8192'>8192</SelectItem>
                    </Select>
                    <p className='text-xs text-foreground-600 mt-1'>
                      {t('settings.ai.contextSizeDescription')}
                    </p>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className='text-sm font-medium text-foreground block mb-2 flex items-center gap-2'>
                      <Thermometer className='w-4 h-4' />
                      {t('settings.ai.temperature')}:{' '}
                      {localConfig.temperature || 0.7}
                    </label>
                    <Input
                      type='number'
                      value={(localConfig.temperature || 0.7).toString()}
                      onChange={e => {
                        const value = parseFloat(e.target.value) || 0.7;
                        handleLocalConfigChange(
                          'temperature',
                          Math.max(0.1, Math.min(2.0, value))
                        );
                      }}
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      size='sm'
                      className='w-24'
                      classNames={{
                        input: 'text-foreground',
                        inputWrapper:
                          'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
                      }}
                    />
                    <p className='text-xs text-foreground-600 mt-1'>
                      {t('settings.ai.temperatureDescription')}
                    </p>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className='text-sm font-medium text-foreground block mb-2 flex items-center gap-2'>
                      <Hash className='w-4 h-4' />
                      {t('settings.ai.maxTokens')}:{' '}
                      {localConfig.maxTokens || 512}
                    </label>
                    <Select
                      selectedKeys={[(localConfig.maxTokens || 512).toString()]}
                      onSelectionChange={keys => {
                        const value = parseInt(Array.from(keys)[0] as string);
                        handleLocalConfigChange('maxTokens', value);
                      }}
                      size='sm'
                      aria-label='Max tokens selection'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                      }}
                    >
                      <SelectItem key='256'>256</SelectItem>
                      <SelectItem key='512'>512</SelectItem>
                      <SelectItem key='1024'>1024</SelectItem>
                      <SelectItem key='2048'>2048</SelectItem>
                    </Select>
                    <p className='text-xs text-foreground-600 mt-1'>
                      {t('settings.ai.maxTokensDescription')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Model Information */}
        {modelStatus?.modelInfo && (
          <>
            <Divider className='bg-divider' />

            <div>
              <h4 className='text-md font-medium text-foreground mb-3'>
                {t('ai.model.information')}
              </h4>

              <div className='space-y-2 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-foreground-600'>
                    {t('ai.model.name')}
                  </span>
                  <span className='text-foreground'>
                    {modelStatus.modelInfo.name}
                  </span>
                </div>

                {modelStatus.modelInfo.version && (
                  <div className='flex justify-between'>
                    <span className='text-foreground-600'>
                      {t('ai.model.version')}
                    </span>
                    <span className='text-foreground'>
                      {modelStatus.modelInfo.version}
                    </span>
                  </div>
                )}

                {modelStatus.modelInfo.size && (
                  <div className='flex justify-between'>
                    <span className='text-foreground-600'>
                      {t('ai.model.size')}
                    </span>
                    <span className='text-foreground'>
                      {modelStatus.modelInfo.size}
                    </span>
                  </div>
                )}

                {modelStatus.modelInfo.contextSize && (
                  <div className='flex justify-between'>
                    <span className='text-foreground-600'>
                      {t('ai.model.contextWindow')}
                    </span>
                    <span className='text-foreground'>
                      {modelStatus.modelInfo.contextSize}
                    </span>
                  </div>
                )}

                <div className='flex justify-between'>
                  <span className='text-foreground-600'>
                    {t('ai.model.type')}
                  </span>
                  <span className='text-foreground capitalize'>
                    {modelStatus.modelInfo.type}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};
