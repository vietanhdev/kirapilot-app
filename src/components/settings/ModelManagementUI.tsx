import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Progress,
  Select,
  SelectItem,
  Switch,
  Divider,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Accordion,
  AccordionItem,
} from '@heroui/react';
import {
  Cloud,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Settings as SettingsIcon,
  Activity,
  Zap,
  Info,
  Trash2,
  Plus,
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../contexts/SettingsContext';
import {
  BackendServiceStatus,
  BackendProviderStatus,
  BackendPerformanceMetrics,
} from '../../types/backendAI';
import {
  ModelManagementService,
  LocalModelInfo,
} from '../../services/ai/ModelManagementService';

interface ModelManagementUIProps {
  className?: string;
}

interface ModelDownloadProgress {
  modelId: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'downloading' | 'completed' | 'error' | 'paused';
}

export const ModelManagementUI: React.FC<ModelManagementUIProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { preferences, updateNestedPreference } = useSettings();
  const {
    currentModelType,
    switchModel,
    isLoading: aiLoading,
    error: aiError,
    reinitializeAI,
  } = useAI();

  // State management
  const [serviceStatus, setServiceStatus] =
    useState<BackendServiceStatus | null>(null);
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<
    ModelDownloadProgress[]
  >([]);
  const [performanceMetrics, setPerformanceMetrics] =
    useState<BackendPerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelForDownload, setSelectedModelForDownload] =
    useState<string>('');

  // Modal controls
  const {
    isOpen: isDownloadModalOpen,
    onOpen: onDownloadModalOpen,
    onClose: onDownloadModalClose,
  } = useDisclosure();
  const {
    isOpen: isConfigModalOpen,
    onOpen: onConfigModalOpen,
    onClose: onConfigModalClose,
  } = useDisclosure();

  // Fetch service status and model information
  const fetchServiceStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const status = await ModelManagementService.getServiceStatus();
      setServiceStatus(status);

      // Fetch local models if local provider is available
      if (status.providers.local) {
        const models = await ModelManagementService.getAvailableLocalModels();
        setLocalModels(models);
      }

      // Fetch performance metrics if service is ready
      if (status.service_ready) {
        try {
          const metrics = await ModelManagementService.getPerformanceMetrics();
          setPerformanceMetrics(metrics);
        } catch (metricsError) {
          console.warn('Failed to fetch performance metrics:', metricsError);
        }
      }
    } catch (err) {
      console.error('Failed to fetch service status:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch service status'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle model switching
  const handleModelSwitch = async (modelType: 'local' | 'gemini') => {
    try {
      setError(null);
      await switchModel(modelType);

      // Update preferences
      updateNestedPreference('aiSettings', 'modelType', modelType);

      // Refresh status after switching
      setTimeout(fetchServiceStatus, 1000);
    } catch (err) {
      console.error('Failed to switch model:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch model');
    }
  };

  // Download a local model
  const handleModelDownload = async (modelId: string) => {
    try {
      setError(null);

      // Start download
      await ModelManagementService.downloadLocalModel(modelId);

      // Add to download progress tracking
      setDownloadProgress(prev => [
        ...prev.filter(p => p.modelId !== modelId),
        {
          modelId,
          progress: 0,
          speed: '0 MB/s',
          eta: 'Calculating...',
          status: 'downloading',
        },
      ]);

      onDownloadModalClose();
    } catch (err) {
      console.error('Failed to start model download:', err);
      setError(err instanceof Error ? err.message : 'Failed to start download');
    }
  };

  // Delete a local model
  const handleModelDelete = async (modelId: string) => {
    if (!window.confirm(t('settings.ai.confirmDeleteModel'))) {
      return;
    }

    try {
      setError(null);
      await ModelManagementService.deleteLocalModel(modelId);

      // Refresh models list
      fetchServiceStatus();
    } catch (err) {
      console.error('Failed to delete model:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  // Force service recovery
  const handleServiceRecovery = async () => {
    try {
      setError(null);
      await ModelManagementService.forceServiceRecovery();

      // Reinitialize AI context
      reinitializeAI();

      // Refresh status
      setTimeout(fetchServiceStatus, 2000);
    } catch (err) {
      console.error('Failed to recover service:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to recover service'
      );
    }
  };

  // Get provider status display
  const getProviderStatusDisplay = (status: BackendProviderStatus) => {
    if ('Ready' in status) {
      return {
        color: 'success' as const,
        icon: <CheckCircle className='w-4 h-4' />,
        text: 'Ready',
      };
    } else if ('Loading' in status) {
      return {
        color: 'warning' as const,
        icon: <RefreshCw className='w-4 h-4 animate-spin' />,
        text: 'Loading',
      };
    } else if ('Error' in status) {
      return {
        color: 'danger' as const,
        icon: <XCircle className='w-4 h-4' />,
        text: 'Error',
      };
    } else {
      return {
        color: 'default' as const,
        icon: <AlertTriangle className='w-4 h-4' />,
        text: 'Not Initialized',
      };
    }
  };

  // Auto-refresh status
  useEffect(() => {
    fetchServiceStatus();

    const interval = setInterval(fetchServiceStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Mock download progress updates (in real implementation, this would come from backend events)
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloadProgress(prev =>
        prev.map(p => {
          if (p.status === 'downloading' && p.progress < 100) {
            const newProgress = Math.min(p.progress + Math.random() * 5, 100);
            return {
              ...p,
              progress: newProgress,
              speed: `${(Math.random() * 10 + 5).toFixed(1)} MB/s`,
              eta:
                newProgress >= 100
                  ? 'Complete'
                  : `${Math.ceil((100 - newProgress) / 2)} min`,
              status: newProgress >= 100 ? 'completed' : 'downloading',
            };
          }
          return p;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold text-foreground flex items-center gap-2'>
            <SettingsIcon className='w-5 h-5' />
            {t('settings.ai.modelManagement')}
          </h3>
          <p className='text-sm text-foreground-600 mt-1'>
            {t('settings.ai.modelManagementDescription')}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Tooltip content={t('common.refresh')}>
            <Button
              isIconOnly
              size='sm'
              variant='light'
              onPress={fetchServiceStatus}
              isLoading={loading}
            >
              <RefreshCw className='w-4 h-4' />
            </Button>
          </Tooltip>
          <Button
            size='sm'
            variant='flat'
            onPress={onConfigModalOpen}
            startContent={<SettingsIcon className='w-4 h-4' />}
          >
            {t('settings.ai.advancedConfig')}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {(error || aiError) && (
        <Card className='border-danger-200 bg-danger-50 dark:bg-danger-900/20'>
          <CardBody className='p-4'>
            <div className='flex items-center gap-2 text-danger'>
              <XCircle className='w-4 h-4' />
              <span className='text-sm font-medium'>{error || aiError}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Current Model Status */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between w-full'>
            <h4 className='text-md font-semibold'>
              {t('settings.ai.currentModel')}
            </h4>
            <Chip
              size='sm'
              color={currentModelType === 'local' ? 'primary' : 'secondary'}
              variant='flat'
              startContent={
                currentModelType === 'local' ? (
                  <HardDrive className='w-3 h-3' />
                ) : (
                  <Cloud className='w-3 h-3' />
                )
              }
            >
              {currentModelType === 'local'
                ? t('ai.model.local')
                : t('ai.model.gemini')}
            </Chip>
          </div>
        </CardHeader>
        <CardBody className='pt-0'>
          <div className='space-y-4'>
            {/* Model Selection */}
            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                {t('settings.ai.selectModel')}
              </label>
              <Select
                selectedKeys={[currentModelType]}
                onSelectionChange={keys => {
                  const modelType = Array.from(keys)[0] as 'local' | 'gemini';
                  handleModelSwitch(modelType);
                }}
                isDisabled={aiLoading}
                size='sm'
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
                  {t('ai.model.gemini')} - {t('settings.ai.cloudModel')}
                </SelectItem>
                <SelectItem
                  key='local'
                  startContent={<HardDrive className='w-4 h-4' />}
                >
                  {t('ai.model.local')} - {t('settings.ai.localModel')}
                </SelectItem>
              </Select>
            </div>

            {/* Service Status */}
            {serviceStatus && (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>
                    {t('settings.ai.serviceStatus')}
                  </span>
                  <Chip
                    size='sm'
                    color={serviceStatus.service_ready ? 'success' : 'danger'}
                    variant='flat'
                  >
                    {serviceStatus.service_ready
                      ? t('common.ready')
                      : t('common.notReady')}
                  </Chip>
                </div>

                {/* Provider Status */}
                <div className='space-y-2'>
                  {Object.entries(serviceStatus.providers).map(
                    ([provider, status]) => {
                      const statusDisplay = getProviderStatusDisplay(status);
                      return (
                        <div
                          key={provider}
                          className='flex items-center justify-between p-2 bg-content2 rounded-lg'
                        >
                          <div className='flex items-center gap-2'>
                            {provider === 'local' ? (
                              <HardDrive className='w-4 h-4' />
                            ) : (
                              <Cloud className='w-4 h-4' />
                            )}
                            <span className='text-sm capitalize'>
                              {provider}
                            </span>
                          </div>
                          <div className='flex items-center gap-2'>
                            {statusDisplay.icon}
                            <Chip
                              size='sm'
                              color={statusDisplay.color}
                              variant='flat'
                            >
                              {statusDisplay.text}
                            </Chip>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {performanceMetrics && (
              <div className='space-y-2'>
                <span className='text-sm font-medium flex items-center gap-2'>
                  <Activity className='w-4 h-4' />
                  {t('settings.ai.performance')}
                </span>
                <div className='grid grid-cols-2 gap-3 text-xs'>
                  <div className='bg-content2 p-2 rounded'>
                    <div className='text-foreground-600'>
                      {t('settings.ai.responseTime')}
                    </div>
                    <div className='font-medium'>
                      {performanceMetrics.total_time_ms}ms
                    </div>
                  </div>
                  <div className='bg-content2 p-2 rounded'>
                    <div className='text-foreground-600'>
                      {t('settings.ai.llmTime')}
                    </div>
                    <div className='font-medium'>
                      {performanceMetrics.llm_time_ms}ms
                    </div>
                  </div>
                  {performanceMetrics.memory_usage_mb && (
                    <div className='bg-content2 p-2 rounded'>
                      <div className='text-foreground-600'>
                        {t('settings.ai.memoryUsage')}
                      </div>
                      <div className='font-medium'>
                        {performanceMetrics.memory_usage_mb}MB
                      </div>
                    </div>
                  )}
                  {performanceMetrics.input_tokens && (
                    <div className='bg-content2 p-2 rounded'>
                      <div className='text-foreground-600'>
                        {t('settings.ai.tokens')}
                      </div>
                      <div className='font-medium'>
                        {performanceMetrics.input_tokens}/
                        {performanceMetrics.output_tokens}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Local Models Management */}
      {currentModelType === 'local' && (
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between w-full'>
              <h4 className='text-md font-semibold flex items-center gap-2'>
                <HardDrive className='w-4 h-4' />
                {t('settings.ai.localModels')}
              </h4>
              <Button
                size='sm'
                color='primary'
                onPress={onDownloadModalOpen}
                startContent={<Plus className='w-4 h-4' />}
              >
                {t('settings.ai.downloadModel')}
              </Button>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <div className='space-y-3'>
              {/* Downloaded Models */}
              {localModels.length > 0 ? (
                localModels.map(model => (
                  <div key={model.id} className='p-3 bg-content2 rounded-lg'>
                    <div className='flex items-center justify-between mb-2'>
                      <div>
                        <h5 className='text-sm font-medium'>{model.name}</h5>
                        <p className='text-xs text-foreground-600'>
                          {model.size} • {model.capabilities.join(', ')}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Chip
                          size='sm'
                          color={
                            model.status === 'available' ? 'success' : 'warning'
                          }
                          variant='flat'
                        >
                          {model.status}
                        </Chip>
                        {model.status === 'available' && (
                          <Tooltip content={t('settings.ai.deleteModel')}>
                            <Button
                              isIconOnly
                              size='sm'
                              variant='light'
                              color='danger'
                              onPress={() => handleModelDelete(model.id)}
                            >
                              <Trash2 className='w-3 h-3' />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {model.status === 'downloading' &&
                      model.downloadProgress && (
                        <div className='space-y-1'>
                          <div className='flex justify-between text-xs'>
                            <span>{t('common.downloading')}</span>
                            <span>{model.downloadProgress}%</span>
                          </div>
                          <Progress
                            value={model.downloadProgress}
                            color='primary'
                            size='sm'
                          />
                        </div>
                      )}
                  </div>
                ))
              ) : (
                <div className='text-center py-6 text-foreground-600'>
                  <HardDrive className='w-8 h-8 mx-auto mb-2 opacity-50' />
                  <p className='text-sm'>{t('settings.ai.noLocalModels')}</p>
                  <Button
                    size='sm'
                    variant='flat'
                    onPress={onDownloadModalOpen}
                    className='mt-2'
                  >
                    {t('settings.ai.downloadFirstModel')}
                  </Button>
                </div>
              )}

              {/* Active Downloads */}
              {downloadProgress.length > 0 && (
                <div className='space-y-2'>
                  <Divider />
                  <h5 className='text-sm font-medium flex items-center gap-2'>
                    <Download className='w-4 h-4' />
                    {t('settings.ai.activeDownloads')}
                  </h5>
                  {downloadProgress.map(progress => (
                    <div
                      key={progress.modelId}
                      className='p-3 bg-content2 rounded-lg'
                    >
                      <div className='flex justify-between items-center mb-2'>
                        <span className='text-sm font-medium'>
                          {progress.modelId}
                        </span>
                        <Chip
                          size='sm'
                          color={
                            progress.status === 'completed'
                              ? 'success'
                              : 'primary'
                          }
                          variant='flat'
                        >
                          {progress.status}
                        </Chip>
                      </div>
                      <div className='space-y-1'>
                        <div className='flex justify-between text-xs text-foreground-600'>
                          <span>{progress.speed}</span>
                          <span>{progress.eta}</span>
                        </div>
                        <Progress
                          value={progress.progress}
                          color={
                            progress.status === 'completed'
                              ? 'success'
                              : 'primary'
                          }
                          size='sm'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Service Recovery */}
      {serviceStatus && !serviceStatus.service_ready && (
        <Card className='border-warning-200 bg-warning-50 dark:bg-warning-900/20'>
          <CardBody className='p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4 text-warning' />
                <div>
                  <p className='text-sm font-medium text-warning'>
                    {t('settings.ai.serviceNotReady')}
                  </p>
                  <p className='text-xs text-warning-700 dark:text-warning-300'>
                    {t('settings.ai.serviceRecoveryDescription')}
                  </p>
                </div>
              </div>
              <Button
                size='sm'
                color='warning'
                variant='flat'
                onPress={handleServiceRecovery}
                startContent={<Zap className='w-4 h-4' />}
              >
                {t('settings.ai.forceRecovery')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Download Model Modal */}
      <Modal isOpen={isDownloadModalOpen} onClose={onDownloadModalClose}>
        <ModalContent>
          <ModalHeader>{t('settings.ai.downloadModel')}</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <p className='text-sm text-foreground-600'>
                {t('settings.ai.downloadModelDescription')}
              </p>

              <Select
                label={t('settings.ai.selectModelToDownload')}
                placeholder={t('settings.ai.chooseModel')}
                selectedKeys={
                  selectedModelForDownload ? [selectedModelForDownload] : []
                }
                onSelectionChange={keys => {
                  setSelectedModelForDownload(Array.from(keys)[0] as string);
                }}
              >
                <SelectItem key='llama-3.2-3b'>
                  Llama 3.2 3B (2.0 GB)
                </SelectItem>
                <SelectItem key='llama-3.2-1b'>
                  Llama 3.2 1B (1.3 GB)
                </SelectItem>
                <SelectItem key='phi-3-mini'>Phi-3 Mini (2.3 GB)</SelectItem>
                <SelectItem key='gemma-2b'>Gemma 2B (1.4 GB)</SelectItem>
              </Select>

              <div className='p-3 bg-content2 rounded-lg'>
                <div className='flex items-center gap-2 mb-2'>
                  <Info className='w-4 h-4 text-primary' />
                  <span className='text-sm font-medium'>
                    {t('common.note')}
                  </span>
                </div>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.downloadNote')}
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onDownloadModalClose}>
              {t('common.cancel')}
            </Button>
            <Button
              color='primary'
              onPress={() => handleModelDownload(selectedModelForDownload)}
              isDisabled={!selectedModelForDownload}
            >
              {t('common.download')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Advanced Configuration Modal */}
      <Modal isOpen={isConfigModalOpen} onClose={onConfigModalClose} size='2xl'>
        <ModalContent>
          <ModalHeader>{t('settings.ai.advancedConfig')}</ModalHeader>
          <ModalBody>
            <Accordion variant='light'>
              <AccordionItem
                key='performance'
                title={t('settings.ai.performanceSettings')}
                startContent={<Activity className='w-4 h-4' />}
              >
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <label className='text-sm font-medium'>
                        {t('settings.ai.enablePerformanceMonitoring')}
                      </label>
                      <p className='text-xs text-foreground-600'>
                        {t('settings.ai.performanceMonitoringDescription')}
                      </p>
                    </div>
                    <Switch
                      isSelected={preferences.aiSettings.performanceMonitoring}
                      onValueChange={checked =>
                        updateNestedPreference(
                          'aiSettings',
                          'performanceMonitoring',
                          checked
                        )
                      }
                      size='sm'
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <div>
                      <label className='text-sm font-medium'>
                        {t('settings.ai.autoOptimization')}
                      </label>
                      <p className='text-xs text-foreground-600'>
                        {t('settings.ai.autoOptimizationDescription')}
                      </p>
                    </div>
                    <Switch
                      isSelected={preferences.aiSettings.autoOptimization}
                      onValueChange={checked =>
                        updateNestedPreference(
                          'aiSettings',
                          'autoOptimization',
                          checked
                        )
                      }
                      size='sm'
                    />
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                key='fallback'
                title={t('settings.ai.fallbackSettings')}
                startContent={<RefreshCw className='w-4 h-4' />}
              >
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <label className='text-sm font-medium'>
                        {t('settings.ai.enableAutoFallback')}
                      </label>
                      <p className='text-xs text-foreground-600'>
                        {t('settings.ai.autoFallbackDescription')}
                      </p>
                    </div>
                    <Switch
                      isSelected={preferences.aiSettings.autoFallback}
                      onValueChange={checked =>
                        updateNestedPreference(
                          'aiSettings',
                          'autoFallback',
                          checked
                        )
                      }
                      size='sm'
                    />
                  </div>

                  <Select
                    label={t('settings.ai.fallbackModel')}
                    selectedKeys={[
                      preferences.aiSettings.fallbackModel || 'gemini',
                    ]}
                    onSelectionChange={keys => {
                      const fallbackModel = Array.from(keys)[0] as string;
                      updateNestedPreference(
                        'aiSettings',
                        'fallbackModel',
                        fallbackModel
                      );
                    }}
                    size='sm'
                  >
                    <SelectItem key='gemini'>Gemini (Cloud)</SelectItem>
                    <SelectItem key='local'>Local Model</SelectItem>
                  </Select>
                </div>
              </AccordionItem>
            </Accordion>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onConfigModalClose}>
              {t('common.close')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
