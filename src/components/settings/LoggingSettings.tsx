import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Switch,
  Select,
  SelectItem,
  Button,
  Progress,
  Divider,
  Chip,
} from '@heroui/react';
import {
  Database,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HardDrive,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { ExportDialog } from './ExportDialog';
import { LoggingConfigService } from '../../services/database/repositories/LoggingConfigService';
import { LogStorageService } from '../../services/database/repositories/LogStorageService';
import {
  LogRetentionManager,
  StorageWarning,
  CleanupProgress,
} from '../../services/ai/LogRetentionManager';
import { LoggingConfig, LogStorageStats } from '../../types/aiLogging';

interface LoggingSettingsProps {
  className?: string;
}

export const LoggingSettings: React.FC<LoggingSettingsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<LoggingConfig | null>(null);
  const [stats, setStats] = useState<LogStorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [storageWarnings, setStorageWarnings] = useState<StorageWarning[]>([]);
  const [cleanupProgress, setCleanupProgress] =
    useState<CleanupProgress | null>(null);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  const loggingConfigService = new LoggingConfigService();
  const logStorageService = new LogStorageService();
  const retentionManager = new LogRetentionManager(
    logStorageService,
    loggingConfigService
  );

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [configData, statsData] = await Promise.all([
        loggingConfigService.getConfig(),
        logStorageService.getStorageStats(),
      ]);

      setConfig(configData);
      setStats(statsData);

      // Load storage warnings
      try {
        const warnings = await retentionManager.getStorageWarnings();
        setStorageWarnings(warnings);
      } catch (warningError) {
        console.warn('Failed to load storage warnings:', warningError);
      }
    } catch (err) {
      console.error('Failed to load logging data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load logging data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<LoggingConfig>) => {
    if (!config) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const updatedConfig = await loggingConfigService.updateConfig(updates);
      setConfig(updatedConfig);
    } catch (err) {
      console.error('Failed to update logging config:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to update configuration'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      setIsClearing(true);
      setError(null);

      await logStorageService.clearAllLogs();

      // Reload stats after clearing
      const newStats = await logStorageService.getStorageStats();
      setStats(newStats);

      setShowClearDialog(false);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportComplete = (filename: string) => {
    setExportSuccess(t('settings.ai.logging.export.success', { filename }));
    // Clear success message after 5 seconds
    setTimeout(() => setExportSuccess(null), 5000);
  };

  const handleManualCleanup = async () => {
    try {
      setIsRunningCleanup(true);
      setError(null);
      setCleanupProgress(null);

      const progress = await retentionManager.performManualCleanup(progress => {
        setCleanupProgress(progress);
      });

      setCleanupProgress(progress);

      // Reload data after cleanup
      await loadData();

      // Show success message
      setExportSuccess(
        t('settings.ai.logging.cleanup.success', {
          deletedCount: progress.deletedLogs,
          freedSpace: formatFileSize(progress.freedSpace),
        })
      );
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to run cleanup:', err);
      setError(err instanceof Error ? err.message : 'Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
      setCleanupProgress(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageUsagePercentage = (): number => {
    if (!config || !stats) {
      return 0;
    }
    return Math.min((stats.totalSize / config.maxLogSize) * 100, 100);
  };

  const getLoggingStatusColor = (): 'success' | 'warning' | 'danger' => {
    if (!config) {
      return 'warning';
    }
    if (!config.enabled) {
      return 'warning';
    }
    if (error) {
      return 'danger';
    }
    return 'success';
  };

  const getLoggingStatusText = (): string => {
    if (!config) {
      return t('settings.ai.logging.statusLoading');
    }
    if (!config.enabled) {
      return t('settings.ai.logging.statusDisabled');
    }
    if (error) {
      return t('settings.ai.logging.statusError');
    }
    return t('settings.ai.logging.statusActive');
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className='flex items-center justify-center p-8'>
          <Database className='w-6 h-6 text-foreground-600 animate-pulse' />
          <span className='ml-2 text-foreground-600'>
            {t('common.loading')}
          </span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardBody className='p-4'>
            <div className='flex items-center justify-center p-8'>
              <XCircle className='w-6 h-6 text-danger mr-2' />
              <span className='text-danger'>
                {t('settings.ai.logging.configLoadError')}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Display */}
      {error && (
        <Card>
          <CardBody className='p-4'>
            <div className='flex items-center gap-3 text-danger'>
              <AlertTriangle className='w-5 h-5' />
              <span className='text-sm'>{error}</span>
              <Button
                size='sm'
                variant='light'
                onPress={() => setError(null)}
                className='ml-auto'
              >
                {t('common.dismiss')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Success Display */}
      {exportSuccess && (
        <Card>
          <CardBody className='p-4'>
            <div className='flex items-center gap-3 text-success'>
              <CheckCircle className='w-5 h-5' />
              <span className='text-sm'>{exportSuccess}</span>
              <Button
                size='sm'
                variant='light'
                onPress={() => setExportSuccess(null)}
                className='ml-auto'
              >
                {t('common.dismiss')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Logging Status */}
      <Card>
        <CardBody className='p-4'>
          <div className='flex items-center justify-between mb-4'>
            <h4 className='text-lg font-semibold text-foreground flex items-center gap-2'>
              <Database className='w-5 h-5' />
              {t('settings.ai.logging.title')}
            </h4>
            <Chip
              color={getLoggingStatusColor()}
              variant='flat'
              startContent={
                config.enabled ? (
                  <CheckCircle className='w-4 h-4' />
                ) : (
                  <XCircle className='w-4 h-4' />
                )
              }
            >
              {getLoggingStatusText()}
            </Chip>
          </div>

          <div className='space-y-4'>
            {/* Enable/Disable Toggle */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.enabled')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.logging.enabledDescription')}
                </p>
              </div>
              <Switch
                isSelected={config.enabled}
                onValueChange={enabled => updateConfig({ enabled })}
                isDisabled={isSaving}
                size='sm'
              />
            </div>

            {/* Log Level */}
            <div>
              <label className='text-sm font-medium text-foreground block mb-2'>
                {t('settings.ai.logging.logLevel')}
              </label>
              <Select
                selectedKeys={[config.logLevel]}
                onSelectionChange={keys => {
                  const logLevel = Array.from(keys)[0] as
                    | 'minimal'
                    | 'standard'
                    | 'detailed';
                  updateConfig({ logLevel });
                }}
                size='sm'
                isDisabled={!config.enabled || isSaving}
                aria-label='Log level selection'
                classNames={{
                  trigger:
                    'bg-content2 border-divider data-[hover=true]:bg-content3',
                  value: 'text-foreground',
                }}
              >
                <SelectItem key='minimal'>
                  {t('settings.ai.logging.logLevel.minimal')}
                </SelectItem>
                <SelectItem key='standard'>
                  {t('settings.ai.logging.logLevel.standard')}
                </SelectItem>
                <SelectItem key='detailed'>
                  {t('settings.ai.logging.logLevel.detailed')}
                </SelectItem>
              </Select>
              <p className='text-xs text-foreground-600 mt-1'>
                {t(
                  `settings.ai.logging.logLevel.${config.logLevel}Description`
                )}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Storage Management */}
      <Card>
        <CardBody className='p-4'>
          <h4 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
            <HardDrive className='w-5 h-5' />
            {t('settings.ai.logging.storageManagement')}
          </h4>

          <div className='space-y-4'>
            {/* Storage Usage */}
            {stats && (
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    {t('settings.ai.logging.storageUsage')}
                  </span>
                  <span className='text-sm text-foreground-600'>
                    {formatFileSize(stats.totalSize)} /{' '}
                    {formatFileSize(config.maxLogSize)}
                  </span>
                </div>
                <Progress
                  value={getStorageUsagePercentage()}
                  color={
                    getStorageUsagePercentage() > 80 ? 'danger' : 'primary'
                  }
                  size='sm'
                  className='mb-2'
                />
                <div className='grid grid-cols-2 gap-4 text-xs text-foreground-600'>
                  <div>
                    <span>{t('settings.ai.logging.totalLogs')}: </span>
                    <span className='font-medium'>{stats.totalLogs}</span>
                  </div>
                  <div>
                    <span>
                      {t('settings.ai.logging.averageResponseTime')}:{' '}
                    </span>
                    <span className='font-medium'>
                      {stats.averageResponseTime.toFixed(0)}ms
                    </span>
                  </div>
                  {stats.oldestLog && (
                    <div>
                      <span>{t('settings.ai.logging.oldestLog')}: </span>
                      <span className='font-medium'>
                        {stats.oldestLog.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {stats.newestLog && (
                    <div>
                      <span>{t('settings.ai.logging.newestLog')}: </span>
                      <span className='font-medium'>
                        {stats.newestLog.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Divider />

            {/* Retention Settings */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium text-foreground block mb-2'>
                  {t('settings.ai.logging.retentionPeriod')}
                </label>
                <Select
                  selectedKeys={[config.retentionDays.toString()]}
                  onSelectionChange={keys => {
                    const retentionDays = parseInt(
                      Array.from(keys)[0] as string
                    );
                    updateConfig({ retentionDays });
                  }}
                  size='sm'
                  isDisabled={!config.enabled || isSaving}
                  aria-label='Log retention period selection'
                  classNames={{
                    trigger:
                      'bg-content2 border-divider data-[hover=true]:bg-content3',
                    value: 'text-foreground',
                  }}
                >
                  <SelectItem key='7'>
                    {t('settings.ai.logging.retention.7days')}
                  </SelectItem>
                  <SelectItem key='14'>
                    {t('settings.ai.logging.retention.14days')}
                  </SelectItem>
                  <SelectItem key='30'>
                    {t('settings.ai.logging.retention.30days')}
                  </SelectItem>
                  <SelectItem key='60'>
                    {t('settings.ai.logging.retention.60days')}
                  </SelectItem>
                  <SelectItem key='90'>
                    {t('settings.ai.logging.retention.90days')}
                  </SelectItem>
                  <SelectItem key='365'>
                    {t('settings.ai.logging.retention.1year')}
                  </SelectItem>
                </Select>
                <p className='text-xs text-foreground-600 mt-1'>
                  {t('settings.ai.logging.retentionDescription')}
                </p>
              </div>

              <div>
                <label className='text-sm font-medium text-foreground block mb-2'>
                  {t('settings.ai.logging.maxLogCount')}
                </label>
                <Select
                  selectedKeys={[config.maxLogCount?.toString() || '10000']}
                  onSelectionChange={keys => {
                    const maxLogCount = parseInt(Array.from(keys)[0] as string);
                    updateConfig({ maxLogCount });
                  }}
                  size='sm'
                  isDisabled={!config.enabled || isSaving}
                  aria-label='Maximum log count selection'
                  classNames={{
                    trigger:
                      'bg-content2 border-divider data-[hover=true]:bg-content3',
                    value: 'text-foreground',
                  }}
                >
                  <SelectItem key='1000'>
                    {t('settings.ai.logging.maxCount.1000')}
                  </SelectItem>
                  <SelectItem key='5000'>
                    {t('settings.ai.logging.maxCount.5000')}
                  </SelectItem>
                  <SelectItem key='10000'>
                    {t('settings.ai.logging.maxCount.10000')}
                  </SelectItem>
                  <SelectItem key='25000'>
                    {t('settings.ai.logging.maxCount.25000')}
                  </SelectItem>
                  <SelectItem key='50000'>
                    {t('settings.ai.logging.maxCount.50000')}
                  </SelectItem>
                </Select>
                <p className='text-xs text-foreground-600 mt-1'>
                  {t('settings.ai.logging.maxLogCountDescription')}
                </p>
              </div>
            </div>

            {/* Auto Cleanup */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.autoCleanup')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.logging.autoCleanupDescription')}
                </p>
              </div>
              <Switch
                isSelected={config.autoCleanup}
                onValueChange={autoCleanup => updateConfig({ autoCleanup })}
                isDisabled={!config.enabled || isSaving}
                size='sm'
              />
            </div>

            {/* Storage Warnings */}
            {storageWarnings.length > 0 && (
              <div className='space-y-2'>
                <h5 className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.storageWarnings')}
                </h5>
                {storageWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      warning.severity === 'critical'
                        ? 'bg-danger-50 border-danger-200 text-danger-800'
                        : warning.severity === 'warning'
                          ? 'bg-warning-50 border-warning-200 text-warning-800'
                          : 'bg-primary-50 border-primary-200 text-primary-800'
                    }`}
                  >
                    <div className='flex items-center gap-2'>
                      <AlertTriangle className='w-4 h-4' />
                      <span className='text-sm font-medium'>
                        {warning.type === 'age' &&
                          t('settings.ai.logging.warning.age')}
                        {warning.type === 'count' &&
                          t('settings.ai.logging.warning.count')}
                        {warning.type === 'size' &&
                          t('settings.ai.logging.warning.size')}
                      </span>
                    </div>
                    <p className='text-xs mt-1'>{warning.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Cleanup */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.manualCleanup')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.logging.manualCleanupDescription')}
                </p>
              </div>
              <Button
                size='sm'
                variant='bordered'
                onPress={handleManualCleanup}
                isDisabled={
                  !config.enabled ||
                  isRunningCleanup ||
                  !stats ||
                  stats.totalLogs === 0
                }
                isLoading={isRunningCleanup}
                startContent={
                  !isRunningCleanup && <Trash2 className='w-4 h-4' />
                }
              >
                {isRunningCleanup
                  ? t('settings.ai.logging.cleanupRunning')
                  : t('settings.ai.logging.runCleanup')}
              </Button>
            </div>

            {/* Cleanup Progress */}
            {cleanupProgress && (
              <div className='p-3 bg-content2 rounded-lg'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    {t('settings.ai.logging.cleanupProgress')}
                  </span>
                  <span className='text-xs text-foreground-600'>
                    {cleanupProgress.isComplete ? 'Complete' : 'Processing'}
                  </span>
                </div>
                <div className='grid grid-cols-2 gap-4 text-xs text-foreground-600'>
                  <div>
                    <span>{t('settings.ai.logging.deletedLogs')}: </span>
                    <span className='font-medium'>
                      {cleanupProgress.deletedLogs}
                    </span>
                  </div>
                  <div>
                    <span>{t('settings.ai.logging.freedSpace')}: </span>
                    <span className='font-medium'>
                      {formatFileSize(cleanupProgress.freedSpace)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <Card>
        <CardBody className='p-4'>
          <h4 className='text-lg font-semibold text-foreground mb-4'>
            {t('settings.ai.logging.actions')}
          </h4>

          <div className='flex flex-wrap gap-3'>
            {/* Export Logs */}
            <Button
              startContent={<Download className='w-4 h-4' />}
              onPress={() => setShowExportDialog(true)}
              isDisabled={!config.enabled || !stats || stats.totalLogs === 0}
              variant='bordered'
              size='sm'
            >
              {t('settings.ai.logging.exportLogs')}
            </Button>

            {/* Clear All Logs */}
            <Button
              startContent={<Trash2 className='w-4 h-4' />}
              onPress={() => setShowClearDialog(true)}
              isDisabled={!stats || stats.totalLogs === 0 || isClearing}
              color='danger'
              variant='bordered'
              size='sm'
            >
              {t('settings.ai.logging.clearAllLogs')}
            </Button>
          </div>

          {/* Export Format */}
          <div className='mt-4'>
            <label className='text-sm font-medium text-foreground block mb-2'>
              {t('settings.ai.logging.exportFormat')}
            </label>
            <Select
              selectedKeys={[config.exportFormat]}
              onSelectionChange={keys => {
                const exportFormat = Array.from(keys)[0] as 'json' | 'csv';
                updateConfig({ exportFormat });
              }}
              size='sm'
              isDisabled={isSaving}
              aria-label='Export format selection'
              className='w-32'
              classNames={{
                trigger:
                  'bg-content2 border-divider data-[hover=true]:bg-content3',
                value: 'text-foreground',
              }}
            >
              <SelectItem key='json'>JSON</SelectItem>
              <SelectItem key='csv'>CSV</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardBody className='p-4'>
          <h4 className='text-lg font-semibold text-foreground mb-4'>
            {t('settings.ai.logging.advancedSettings')}
          </h4>

          <div className='space-y-4'>
            {/* Include System Prompts */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.includeSystemPrompts')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.logging.includeSystemPromptsDescription')}
                </p>
              </div>
              <Switch
                isSelected={config.includeSystemPrompts}
                onValueChange={includeSystemPrompts =>
                  updateConfig({ includeSystemPrompts })
                }
                isDisabled={!config.enabled || isSaving}
                size='sm'
              />
            </div>

            {/* Include Tool Executions */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.includeToolExecutions')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t('settings.ai.logging.includeToolExecutionsDescription')}
                </p>
              </div>
              <Switch
                isSelected={config.includeToolExecutions}
                onValueChange={includeToolExecutions =>
                  updateConfig({ includeToolExecutions })
                }
                isDisabled={!config.enabled || isSaving}
                size='sm'
              />
            </div>

            {/* Include Performance Metrics */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  {t('settings.ai.logging.includePerformanceMetrics')}
                </label>
                <p className='text-xs text-foreground-600'>
                  {t(
                    'settings.ai.logging.includePerformanceMetricsDescription'
                  )}
                </p>
              </div>
              <Switch
                isSelected={config.includePerformanceMetrics}
                onValueChange={includePerformanceMetrics =>
                  updateConfig({ includePerformanceMetrics })
                }
                isDisabled={!config.enabled || isSaving}
                size='sm'
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExportComplete={handleExportComplete}
      />

      {/* Clear Logs Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearLogs}
        title={t('settings.ai.logging.clearLogsConfirmTitle')}
        message={t('settings.ai.logging.clearLogsConfirmMessage')}
        confirmText={t('settings.ai.logging.clearLogsConfirm')}
        cancelText={t('common.cancel')}
        variant='danger'
        isLoading={isClearing}
      />
    </div>
  );
};
