import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Card,
  CardBody,
  Chip,
  Progress,
  Divider,
} from '@heroui/react';
import {
  Download,
  Calendar,
  Filter,
  AlertTriangle,
  Shield,
  FileText,
  Database,
  Clock,
  XCircle,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { DatePicker } from '../common/DatePicker';
import { LogStorageService } from '../../services/database/repositories/LogStorageService';
import {
  ExportService,
  ExportOptions,
  ExportProgress,
} from '../../services/ai/ExportService';
import { LogFilter } from '../../types/aiLogging';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExportComplete?: (filename: string) => void;
}

interface ExportFilters {
  startDate?: Date;
  endDate?: Date;
  modelType?: 'local' | 'gemini';
  hasErrors?: boolean;
  containsToolCalls?: boolean;
  format: 'json' | 'csv';
  includeSensitiveData?: boolean;
  anonymizeData?: boolean;
}

interface ExportPreview {
  totalLogs: number;
  estimatedSize: string;
  dateRange: string;
  containsSensitiveData: boolean;
  modelBreakdown: Record<string, number>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExportComplete,
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ExportFilters>({
    format: 'json',
    includeSensitiveData: false,
    anonymizeData: false,
  });
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);

  const logStorageService = new LogStorageService();
  const exportService = new ExportService();

  // Load preview when filters change
  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [
    isOpen,
    filters.startDate,
    filters.endDate,
    filters.modelType,
    filters.hasErrors,
    filters.containsToolCalls,
  ]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setExportProgress(0);
      setShowPrivacyWarning(false);
    }
  }, [isOpen]);

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true);
      setError(null);

      const logFilter: LogFilter = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        modelType: filters.modelType,
        hasErrors: filters.hasErrors,
        containsToolCalls: filters.containsToolCalls,
      };

      // Get logs to calculate preview
      const logs = await logStorageService.getInteractionLogs(logFilter);
      const stats = await logStorageService.getStorageStats();

      // Calculate estimated size (rough approximation)
      const avgLogSize = stats.totalSize / Math.max(stats.totalLogs, 1);
      const estimatedBytes = logs.length * avgLogSize;

      // Check for sensitive data
      const containsSensitiveData = logs.some(log => log.containsSensitiveData);

      // Model breakdown
      const modelBreakdown: Record<string, number> = {};
      logs.forEach(log => {
        modelBreakdown[log.modelType] =
          (modelBreakdown[log.modelType] || 0) + 1;
      });

      // Date range
      const dates = logs
        .map(log => log.timestamp)
        .sort((a, b) => a.getTime() - b.getTime());
      const dateRange =
        dates.length > 0
          ? `${dates[0].toLocaleDateString()} - ${dates[dates.length - 1].toLocaleDateString()}`
          : t('settings.ai.logging.export.noData');

      setPreview({
        totalLogs: logs.length,
        estimatedSize: formatFileSize(estimatedBytes),
        dateRange,
        containsSensitiveData,
        modelBreakdown,
      });

      setShowPrivacyWarning(containsSensitiveData);
    } catch (err) {
      console.error('Failed to load export preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    if (!preview || preview.totalLogs === 0) {
      return;
    }

    try {
      setIsExporting(true);
      setError(null);
      setExportProgress(0);
      setExportStage('');

      const exportOptions: ExportOptions = {
        format: filters.format,
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          modelType: filters.modelType,
          hasErrors: filters.hasErrors,
          containsToolCalls: filters.containsToolCalls,
        },
        includeToolCalls: true,
        includeSensitiveData: filters.includeSensitiveData ?? false,
        anonymizeData: filters.anonymizeData ?? false,
        maxRetries: 3,
        retryDelay: 1000,
      };

      // Validate export options
      const validationErrors =
        exportService.validateExportOptions(exportOptions);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(' '));
      }

      const result = await exportService.exportLogs(
        exportOptions,
        (progress: ExportProgress) => {
          setExportProgress(progress.progress);
          setExportStage(progress.message);
        }
      );

      // Create download link
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onExportComplete?.(result.filename);
      onClose();
    } catch (err) {
      console.error('Failed to export logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to export logs');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStage('');
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

  const updateFilters = (updates: Partial<ExportFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='2xl'
      scrollBehavior='inside'
      classNames={{
        base: 'bg-content1',
        header: 'border-b border-divider',
        body: 'py-6',
        footer: 'border-t border-divider',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex items-center gap-2'>
          <Download className='w-5 h-5' />
          {t('settings.ai.logging.export.title')}
        </ModalHeader>

        <ModalBody>
          <div className='space-y-6'>
            {/* Error Display */}
            {error && (
              <Card>
                <CardBody className='p-4'>
                  <div className='flex items-center gap-3 text-danger'>
                    <AlertTriangle className='w-5 h-5' />
                    <span className='text-sm'>{error}</span>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Export Progress */}
            {isExporting && (
              <Card>
                <CardBody className='p-4'>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Database className='w-4 h-4 text-primary' />
                      <span className='text-sm font-medium'>
                        {t('settings.ai.logging.export.exporting')}
                      </span>
                    </div>
                    <Progress
                      value={exportProgress}
                      color='primary'
                      size='sm'
                      className='w-full'
                    />
                    <p className='text-xs text-foreground-600'>
                      {exportStage ||
                        (exportProgress < 100
                          ? t('settings.ai.logging.export.preparingData')
                          : t('settings.ai.logging.export.downloadStarting'))}
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Filters Section */}
            <Card>
              <CardBody className='p-4'>
                <h4 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
                  <Filter className='w-5 h-5' />
                  {t('settings.ai.logging.export.filters')}
                </h4>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* Date Range */}
                  <div className='space-y-3'>
                    <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                      <Calendar className='w-4 h-4' />
                      {t('settings.ai.logging.export.dateRange')}
                    </label>
                    <div className='space-y-2'>
                      <DatePicker
                        value={filters.startDate}
                        onChange={date =>
                          updateFilters({ startDate: date || undefined })
                        }
                        placeholder={t('settings.ai.logging.export.startDate')}
                        dateFormat='YYYY-MM-DD'
                      />
                      <DatePicker
                        value={filters.endDate}
                        onChange={date =>
                          updateFilters({ endDate: date || undefined })
                        }
                        placeholder={t('settings.ai.logging.export.endDate')}
                        dateFormat='YYYY-MM-DD'
                      />
                    </div>
                  </div>

                  {/* Model Type */}
                  <div className='space-y-3'>
                    <label className='text-sm font-medium text-foreground'>
                      {t('settings.ai.logging.export.modelType')}
                    </label>
                    <Select
                      selectedKeys={
                        filters.modelType ? [filters.modelType] : []
                      }
                      onSelectionChange={keys => {
                        const modelType = Array.from(keys)[0] as
                          | 'local'
                          | 'gemini'
                          | undefined;
                        updateFilters({ modelType });
                      }}
                      placeholder={t('settings.ai.logging.export.allModels')}
                      size='sm'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                      }}
                    >
                      <SelectItem key='local'>Local Model</SelectItem>
                      <SelectItem key='gemini'>
                        {t('settings.ai.logging.export.geminiModel')}
                      </SelectItem>
                    </Select>
                  </div>

                  {/* Error Filter */}
                  <div className='space-y-3'>
                    <label className='text-sm font-medium text-foreground'>
                      {t('settings.ai.logging.export.errorFilter')}
                    </label>
                    <Select
                      selectedKeys={
                        filters.hasErrors !== undefined
                          ? [filters.hasErrors.toString()]
                          : []
                      }
                      onSelectionChange={keys => {
                        const hasErrors = Array.from(keys)[0];
                        updateFilters({
                          hasErrors:
                            hasErrors === 'true'
                              ? true
                              : hasErrors === 'false'
                                ? false
                                : undefined,
                        });
                      }}
                      placeholder={t('settings.ai.logging.export.allLogs')}
                      size='sm'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                      }}
                    >
                      <SelectItem key='true'>
                        {t('settings.ai.logging.export.onlyErrors')}
                      </SelectItem>
                      <SelectItem key='false'>
                        {t('settings.ai.logging.export.onlySuccess')}
                      </SelectItem>
                    </Select>
                  </div>

                  {/* Tool Calls Filter */}
                  <div className='space-y-3'>
                    <label className='text-sm font-medium text-foreground'>
                      {t('settings.ai.logging.export.toolCallsFilter')}
                    </label>
                    <Select
                      selectedKeys={
                        filters.containsToolCalls !== undefined
                          ? [filters.containsToolCalls.toString()]
                          : []
                      }
                      onSelectionChange={keys => {
                        const containsToolCalls = Array.from(keys)[0];
                        updateFilters({
                          containsToolCalls:
                            containsToolCalls === 'true'
                              ? true
                              : containsToolCalls === 'false'
                                ? false
                                : undefined,
                        });
                      }}
                      placeholder={t('settings.ai.logging.export.allLogs')}
                      size='sm'
                      classNames={{
                        trigger:
                          'bg-content2 border-divider data-[hover=true]:bg-content3',
                        value: 'text-foreground',
                      }}
                    >
                      <SelectItem key='true'>
                        {t('settings.ai.logging.export.withToolCalls')}
                      </SelectItem>
                      <SelectItem key='false'>
                        {t('settings.ai.logging.export.withoutToolCalls')}
                      </SelectItem>
                    </Select>
                  </div>
                </div>

                <Divider className='my-4' />

                {/* Export Format */}
                <div className='space-y-3'>
                  <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                    <FileText className='w-4 h-4' />
                    {t('settings.ai.logging.export.format')}
                  </label>
                  <Select
                    selectedKeys={[filters.format]}
                    onSelectionChange={keys => {
                      const format = Array.from(keys)[0] as 'json' | 'csv';
                      updateFilters({ format });
                    }}
                    size='sm'
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
                  <p className='text-xs text-foreground-600'>
                    {filters.format === 'json'
                      ? t('settings.ai.logging.export.jsonDescription')
                      : t('settings.ai.logging.export.csvDescription')}
                  </p>
                </div>

                {/* Privacy Options */}
                <Divider className='my-4' />
                <div className='space-y-4'>
                  <h4 className='text-sm font-semibold text-foreground flex items-center gap-2'>
                    <Shield className='w-4 h-4' />
                    {t('settings.ai.logging.export.privacyOptions')}
                  </h4>

                  <div className='space-y-3'>
                    <label className='flex items-center gap-3 cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={filters.includeSensitiveData ?? false}
                        onChange={e => {
                          setFilters(prev => ({
                            ...prev,
                            includeSensitiveData: e.target.checked,
                            anonymizeData: e.target.checked
                              ? prev.anonymizeData
                              : false,
                          }));
                          if (e.target.checked) {
                            setShowPrivacyWarning(true);
                          }
                        }}
                        className='w-4 h-4 text-primary bg-background border-2 border-foreground-300 rounded focus:ring-primary focus:ring-2'
                      />
                      <div className='flex-1'>
                        <div className='text-sm font-medium text-foreground'>
                          {t('settings.ai.logging.export.includeSensitiveData')}
                        </div>
                        <div className='text-xs text-foreground-600'>
                          {t(
                            'settings.ai.logging.export.includeSensitiveDataDescription'
                          )}
                        </div>
                      </div>
                    </label>

                    {filters.includeSensitiveData && (
                      <label className='flex items-center gap-3 cursor-pointer ml-7'>
                        <input
                          type='checkbox'
                          checked={filters.anonymizeData ?? false}
                          onChange={e => {
                            setFilters(prev => ({
                              ...prev,
                              anonymizeData: e.target.checked,
                            }));
                          }}
                          className='w-4 h-4 text-primary bg-background border-2 border-foreground-300 rounded focus:ring-primary focus:ring-2'
                        />
                        <div className='flex-1'>
                          <div className='text-sm font-medium text-foreground'>
                            {t('settings.ai.logging.export.anonymizeData')}
                          </div>
                          <div className='text-xs text-foreground-600'>
                            {t(
                              'settings.ai.logging.export.anonymizeDataDescription'
                            )}
                          </div>
                        </div>
                      </label>
                    )}
                  </div>

                  {showPrivacyWarning && filters.includeSensitiveData && (
                    <Card className='border-warning-200 bg-warning-50'>
                      <CardBody className='p-3'>
                        <div className='flex items-start gap-2'>
                          <AlertTriangle className='w-4 h-4 text-warning-600 mt-0.5 flex-shrink-0' />
                          <div className='text-xs text-warning-700'>
                            <div className='font-medium mb-1'>
                              {t(
                                'settings.ai.logging.export.privacyWarningTitle'
                              )}
                            </div>
                            <div>
                              {t(
                                'settings.ai.logging.export.privacyWarningMessage'
                              )}
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardBody className='p-4'>
                <h4 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
                  <Database className='w-5 h-5' />
                  {t('settings.ai.logging.export.preview')}
                </h4>

                {isLoadingPreview ? (
                  <div className='flex items-center justify-center p-8'>
                    <Database className='w-6 h-6 text-foreground-600 animate-pulse' />
                    <span className='ml-2 text-foreground-600'>
                      {t('common.loading')}
                    </span>
                  </div>
                ) : preview ? (
                  <div className='space-y-4'>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                      <div className='text-center'>
                        <div className='text-2xl font-bold text-primary'>
                          {preview.totalLogs}
                        </div>
                        <div className='text-xs text-foreground-600'>
                          {t('settings.ai.logging.export.totalLogs')}
                        </div>
                      </div>
                      <div className='text-center'>
                        <div className='text-2xl font-bold text-secondary'>
                          {preview.estimatedSize}
                        </div>
                        <div className='text-xs text-foreground-600'>
                          {t('settings.ai.logging.export.estimatedSize')}
                        </div>
                      </div>
                      <div className='text-center col-span-2'>
                        <div className='text-sm font-medium text-foreground'>
                          {preview.dateRange}
                        </div>
                        <div className='text-xs text-foreground-600 flex items-center justify-center gap-1'>
                          <Clock className='w-3 h-3' />
                          {t('settings.ai.logging.export.dateRange')}
                        </div>
                      </div>
                    </div>

                    {/* Model Breakdown */}
                    {Object.keys(preview.modelBreakdown).length > 0 && (
                      <div>
                        <h5 className='text-sm font-medium text-foreground mb-2'>
                          {t('settings.ai.logging.export.modelBreakdown')}
                        </h5>
                        <div className='flex flex-wrap gap-2'>
                          {Object.entries(preview.modelBreakdown).map(
                            ([model, count]) => (
                              <Chip key={model} size='sm' variant='flat'>
                                {model}: {count}
                              </Chip>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Privacy Warning */}
                    {showPrivacyWarning && (
                      <Card className='border-warning bg-warning/10'>
                        <CardBody className='p-3'>
                          <div className='flex items-start gap-3'>
                            <Shield className='w-5 h-5 text-warning mt-0.5' />
                            <div>
                              <h5 className='text-sm font-medium text-warning mb-1'>
                                {t('settings.ai.logging.export.privacyWarning')}
                              </h5>
                              <p className='text-xs text-warning/80'>
                                {t(
                                  'settings.ai.logging.export.privacyWarningDescription'
                                )}
                              </p>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className='flex items-center justify-center p-8 text-foreground-600'>
                    <XCircle className='w-6 h-6 mr-2' />
                    {t('settings.ai.logging.export.noPreview')}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant='light' onPress={onClose} isDisabled={isExporting}>
            {t('common.cancel')}
          </Button>
          <Button
            color='primary'
            startContent={
              isExporting ? undefined : <Download className='w-4 h-4' />
            }
            onPress={handleExport}
            isLoading={isExporting}
            isDisabled={!preview || preview.totalLogs === 0 || isLoadingPreview}
          >
            {isExporting
              ? t('settings.ai.logging.export.exporting')
              : t('settings.ai.logging.export.export')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
