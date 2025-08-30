import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Select,
  SelectItem,
  Checkbox,
  CheckboxGroup,
  Input,
  Chip,
  Progress,
} from '@heroui/react';
import { Download, FileText, Database, Filter, X } from 'lucide-react';
import { LogFilter } from '../../types/aiLogging';
import { DatePicker } from '../common/DatePicker';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  totalLogs: number;
  currentFilters?: LogFilter;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  filters: LogFilter;
  includeFields: string[];
  filename?: string;
}

const EXPORT_FIELDS = [
  {
    key: 'basic',
    label: 'Basic Information',
    description: 'ID, timestamp, session ID',
  },
  {
    key: 'conversation',
    label: 'Conversation',
    description: 'User message, AI response',
  },
  {
    key: 'model',
    label: 'Model Information',
    description: 'Model type, provider, version',
  },
  {
    key: 'react_steps',
    label: 'ReAct Steps',
    description: 'Reasoning, actions, observations',
  },
  {
    key: 'tool_calls',
    label: 'Tool Executions',
    description: 'Tool calls and results',
  },
  {
    key: 'performance',
    label: 'Performance Metrics',
    description: 'Response time, token count',
  },
  {
    key: 'context',
    label: 'Context Data',
    description: 'System prompts, app context',
  },
  {
    key: 'errors',
    label: 'Error Information',
    description: 'Error messages and codes',
  },
  {
    key: 'privacy',
    label: 'Privacy Metadata',
    description: 'Data classification, sensitive flags',
  },
];

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  totalLogs,
  currentFilters,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [includeFields, setIncludeFields] = useState<string[]>([
    'basic',
    'conversation',
    'model',
    'react_steps',
    'tool_calls',
    'performance',
  ]);
  const [filters, setFilters] = useState<LogFilter>(currentFilters || {});
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const exportOptions: ExportOptions = {
        format,
        filters,
        includeFields,
        filename:
          filename || `ai-logs-${new Date().toISOString().split('T')[0]}`,
      };

      await onExport(exportOptions);

      clearInterval(progressInterval);
      setExportProgress(100);

      // Close dialog after a brief delay
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleFilterChange = (field: keyof LogFilter, value: unknown) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const estimatedLogs = Math.min(totalLogs, filters.limit || totalLogs);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='3xl'
      scrollBehavior='inside'
      isDismissable={!isExporting}
      hideCloseButton={isExporting}
    >
      <ModalContent>
        <ModalHeader className='flex items-center gap-2'>
          <Download className='w-5 h-5' />
          Export AI Interaction Logs
          {!isExporting && (
            <Button
              isIconOnly
              variant='light'
              size='sm'
              className='ml-auto'
              onPress={onClose}
            >
              <X className='w-4 h-4' />
            </Button>
          )}
        </ModalHeader>

        <ModalBody>
          {isExporting ? (
            <div className='space-y-4 py-8'>
              <div className='text-center'>
                <Download className='w-12 h-12 mx-auto mb-4 text-primary animate-pulse' />
                <h3 className='text-lg font-semibold mb-2'>
                  Exporting Logs...
                </h3>
                <p className='text-sm text-default-500 mb-4'>
                  Please wait while we prepare your export file
                </p>
              </div>
              <Progress
                value={exportProgress}
                color='primary'
                className='max-w-md mx-auto'
                showValueLabel
              />
            </div>
          ) : (
            <div className='space-y-6'>
              {/* Export Format */}
              <Card>
                <CardBody>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <FileText className='w-4 h-4' />
                      <h4 className='font-semibold'>Export Format</h4>
                    </div>
                    <Select
                      label='File Format'
                      selectedKeys={[format]}
                      onSelectionChange={keys => {
                        const value = Array.from(keys)[0] as 'json' | 'csv';
                        setFormat(value);
                      }}
                    >
                      <SelectItem key='json' textValue='JSON'>
                        <div className='flex flex-col'>
                          <span>JSON</span>
                          <span className='text-xs text-default-500'>
                            Complete data with nested structures
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem key='csv' textValue='CSV'>
                        <div className='flex flex-col'>
                          <span>CSV</span>
                          <span className='text-xs text-default-500'>
                            Tabular format for spreadsheet analysis
                          </span>
                        </div>
                      </SelectItem>
                    </Select>

                    <Input
                      label='Filename (optional)'
                      placeholder={`ai-logs-${new Date().toISOString().split('T')[0]}`}
                      value={filename}
                      onValueChange={setFilename}
                      description={`Will be saved as: ${filename || `ai-logs-${new Date().toISOString().split('T')[0]}`}.${format}`}
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Data Fields */}
              <Card>
                <CardBody>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Database className='w-4 h-4' />
                      <h4 className='font-semibold'>Data Fields to Include</h4>
                    </div>
                    <CheckboxGroup
                      value={includeFields}
                      onValueChange={setIncludeFields}
                      className='space-y-2'
                    >
                      {EXPORT_FIELDS.map(field => (
                        <Checkbox key={field.key} value={field.key}>
                          <div className='flex flex-col'>
                            <span className='font-medium'>{field.label}</span>
                            <span className='text-xs text-default-500'>
                              {field.description}
                            </span>
                          </div>
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </div>
                </CardBody>
              </Card>

              {/* Filters */}
              <Card>
                <CardBody>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Filter className='w-4 h-4' />
                      <h4 className='font-semibold'>Export Filters</h4>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      {/* Date Range */}
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          Date Range
                        </label>
                        <div className='space-y-2'>
                          <DatePicker
                            placeholder='Start date'
                            value={filters.startDate || null}
                            onChange={date =>
                              handleFilterChange('startDate', date)
                            }
                            dateFormat='YYYY-MM-DD'
                            size='sm'
                          />
                          <DatePicker
                            placeholder='End date'
                            value={filters.endDate || null}
                            onChange={date =>
                              handleFilterChange('endDate', date)
                            }
                            dateFormat='YYYY-MM-DD'
                            size='sm'
                          />
                        </div>
                      </div>

                      {/* Model Type */}
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          AI Service
                        </label>
                        <Select
                          placeholder='All services'
                          size='sm'
                          selectedKeys={
                            filters.modelType ? [filters.modelType] : []
                          }
                          onSelectionChange={keys => {
                            const value = Array.from(keys)[0] as
                              | 'local'
                              | 'gemini'
                              | undefined;
                            handleFilterChange('modelType', value);
                          }}
                        >
                          <SelectItem key='local'>Local AI</SelectItem>
                          <SelectItem key='gemini'>Gemini</SelectItem>
                        </Select>
                      </div>

                      {/* Search Text */}
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          Search Text
                        </label>
                        <Input
                          placeholder='Filter by content...'
                          size='sm'
                          value={filters.searchText || ''}
                          onValueChange={value =>
                            handleFilterChange('searchText', value || undefined)
                          }
                        />
                      </div>

                      {/* Limit */}
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Limit</label>
                        <Input
                          type='number'
                          placeholder='All logs'
                          size='sm'
                          value={filters.limit?.toString() || ''}
                          onValueChange={value => {
                            const num = value ? parseInt(value, 10) : undefined;
                            handleFilterChange('limit', num);
                          }}
                        />
                      </div>
                    </div>

                    {/* Filter Options */}
                    <div className='flex flex-wrap gap-2'>
                      <Checkbox
                        isSelected={filters.hasErrors}
                        onValueChange={value =>
                          handleFilterChange('hasErrors', value || undefined)
                        }
                      >
                        Errors only
                      </Checkbox>
                      <Checkbox
                        isSelected={filters.containsToolCalls}
                        onValueChange={value =>
                          handleFilterChange(
                            'containsToolCalls',
                            value || undefined
                          )
                        }
                      >
                        With tool calls
                      </Checkbox>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Export Summary */}
              <Card className='bg-primary-50 dark:bg-primary-950/20'>
                <CardBody>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='font-semibold text-primary'>
                        Export Summary
                      </h4>
                      <p className='text-sm text-primary-600 dark:text-primary-400'>
                        Approximately {estimatedLogs} logs will be exported
                      </p>
                    </div>
                    <div className='flex flex-wrap gap-1'>
                      <Chip size='sm' color='primary' variant='flat'>
                        {format.toUpperCase()}
                      </Chip>
                      <Chip size='sm' color='secondary' variant='flat'>
                        {includeFields.length} fields
                      </Chip>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </ModalBody>

        {!isExporting && (
          <ModalFooter>
            <Button variant='flat' onPress={onClose}>
              Cancel
            </Button>
            <Button
              color='primary'
              startContent={<Download className='w-4 h-4' />}
              onPress={handleExport}
              isDisabled={includeFields.length === 0}
            >
              Export {estimatedLogs} Logs
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
