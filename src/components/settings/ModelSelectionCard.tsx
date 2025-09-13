import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Progress,
  Chip,
  Spinner,
} from '@heroui/react';
import {
  Bot,
  Cloud,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader,
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

  const handleModelTypeChange = async (modelType: 'gemini') => {
    if (!modelManager) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Update preferences first
      await updateNestedPreference('aiSettings', 'modelType', modelType);

      // Only Gemini is supported now

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
                  const modelType = Array.from(keys)[0] as 'gemini';
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
                {t('settings.ai.geminiModelDescription')}
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
                {t('ai.model.gemini')}
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
      </CardBody>
    </Card>
  );
};
