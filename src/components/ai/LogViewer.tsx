import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Input,
  Button,
  Chip,
  Spinner,
  Pagination,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from '@heroui/react';
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  Cpu,
  Zap,
  RefreshCw,
  Download,
} from 'lucide-react';
import { AIInteractionLog, LogFilter } from '../../types/aiLogging';
import { TruncatedMessage } from './TruncatedMessage';
import { ToolDetails } from './ToolDetails';
import { AdvancedLogSearch } from './AdvancedLogSearch';
interface LogViewerProps {
  logs: AIInteractionLog[];
  loading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onLoadMore: () => void;
  onFilterChange: (filters: LogFilter) => void;
  onLogSelect: (log: AIInteractionLog) => void;
  onLogDelete: (logId: string) => void;
  onRefresh: () => void;
  onExport?: () => void;
}

export function LogViewer({
  logs,
  loading,
  totalCount,
  currentPage,
  pageSize,
  onLoadMore,
  onFilterChange,
  onLogSelect,
  onRefresh,
  onExport,
}: LogViewerProps) {
  const [filters, setFilters] = useState<LogFilter>({});
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFilterChange({ ...filters, searchText: searchText || undefined });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  const handleFilterChange = (newFilters: LogFilter) => {
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchText('');
    onFilterChange({});
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getModelTypeColor = (modelType: string) => {
    switch (modelType) {
      case 'local':
        return 'primary';
      case 'gemini':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getDataClassificationColor = (classification: string) => {
    switch (classification) {
      case 'public':
        return 'success';
      case 'internal':
        return 'warning';
      case 'confidential':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-semibold'>AI Interaction Logs</h2>
          <p className='text-sm text-default-500'>{totalCount} total logs</p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='flat'
            size='sm'
            startContent={<RefreshCw className='w-4 h-4' />}
            onPress={onRefresh}
            isLoading={loading}
          >
            Refresh
          </Button>
          {onExport && (
            <Button
              variant='flat'
              size='sm'
              startContent={<Download className='w-4 h-4' />}
              onPress={onExport}
            >
              Export
            </Button>
          )}
          <Button
            variant='flat'
            size='sm'
            startContent={<Filter className='w-4 h-4' />}
            onPress={() => setShowFilters(!showFilters)}
            color={Object.keys(filters).length > 0 ? 'primary' : 'default'}
          >
            Filters
            {Object.keys(filters).length > 0 && (
              <Chip size='sm' color='primary' variant='flat'>
                {Object.keys(filters).length}
              </Chip>
            )}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder='Search logs...'
        value={searchText}
        onValueChange={setSearchText}
        startContent={<Search className='w-4 h-4' />}
        size='sm'
        className='max-w-md'
      />

      {/* Advanced Search Panel */}
      {showFilters && (
        <AdvancedLogSearch
          filters={filters}
          onFiltersChange={handleFilterChange}
          onClearFilters={clearFilters}
        />
      )}

      {/* Logs Table */}
      <div className='space-y-3'>
        {loading && logs.length === 0 ? (
          <div className='flex items-center justify-center py-8'>
            <Spinner size='lg' />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardBody className='text-center py-8'>
              <div className='space-y-3'>
                <div className='text-default-500'>
                  <AlertCircle className='w-12 h-12 mx-auto mb-2' />
                  <h3 className='text-lg font-medium'>
                    No AI interaction logs found
                  </h3>
                </div>
                <div className='text-sm text-default-400 space-y-1'>
                  <p>This could be because:</p>
                  <ul className='list-disc list-inside space-y-1 mt-2'>
                    <li>No AI interactions have been performed yet</li>
                    <li>AI logging is disabled in settings</li>
                    <li>Your current filters are too restrictive</li>
                    <li>Database connection issue</li>
                  </ul>
                </div>
                <div className='flex justify-center gap-2 mt-4'>
                  <Button
                    variant='flat'
                    size='sm'
                    onPress={onRefresh}
                    startContent={<RefreshCw className='w-4 h-4' />}
                  >
                    Refresh
                  </Button>
                  {Object.keys(filters).length > 0 && (
                    <Button
                      variant='flat'
                      size='sm'
                      onPress={() => handleFilterChange({})}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Table
            isStriped
            aria-label='AI Interaction Logs'
            classNames={{
              wrapper: 'min-h-[400px] w-full overflow-auto',
              table: 'min-w-full table-auto',
              th: 'bg-default-100 text-default-700 font-semibold',
              td: 'py-2 px-3',
            }}
            layout='auto'
          >
            <TableHeader>
              <TableColumn width='120'>Timestamp</TableColumn>
              <TableColumn width='100'>AI Service</TableColumn>
              <TableColumn width='250'>User Message</TableColumn>
              <TableColumn width='250'>AI Response</TableColumn>
              <TableColumn width='120'>Response Time</TableColumn>
              <TableColumn width='80'>Tools</TableColumn>
              <TableColumn width='100'>Status</TableColumn>
              <TableColumn width='120'>Classification</TableColumn>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow
                  key={log.id}
                  className='cursor-pointer hover:bg-default-50'
                  onClick={() => onLogSelect(log)}
                >
                  <TableCell>
                    <div className='text-xs'>
                      <div className='font-medium'>
                        {log.timestamp.toLocaleDateString()}
                      </div>
                      <div className='text-default-500'>
                        {log.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='sm'
                      color={getModelTypeColor(log.modelType)}
                      variant='flat'
                      startContent={
                        log.modelType === 'local' ? (
                          <Cpu className='w-3 h-3' />
                        ) : (
                          <Zap className='w-3 h-3' />
                        )
                      }
                    >
                      {log.modelType === 'local' ? 'Local AI' : 'Gemini'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <TruncatedMessage
                      content={log.userMessage || ''}
                      maxLength={80}
                      title='User Message'
                    />
                  </TableCell>
                  <TableCell>
                    <TruncatedMessage
                      content={log.aiResponse || ''}
                      maxLength={80}
                      title='AI Response'
                      className='text-default-500'
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-1 text-sm whitespace-nowrap'>
                      <Clock className='w-3 h-3' />
                      <span>{formatResponseTime(log.responseTime)}</span>
                      {log.tokenCount && (
                        <div className='text-xs text-default-400'>
                          ({log.tokenCount} tokens)
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ToolDetails toolCalls={log.toolCalls} />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      {log.error ? (
                        <>
                          <AlertCircle className='w-4 h-4 text-danger' />
                          <Chip size='sm' color='danger' variant='flat'>
                            Error
                          </Chip>
                        </>
                      ) : (
                        <>
                          <CheckCircle className='w-4 h-4 text-success' />
                          <Chip size='sm' color='success' variant='flat'>
                            Success
                          </Chip>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='sm'
                      color={getDataClassificationColor(log.dataClassification)}
                      variant='flat'
                    >
                      {log.dataClassification}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex justify-center'>
          <Pagination
            total={totalPages}
            page={currentPage}
            onChange={page => {
              handleFilterChange({
                ...filters,
                offset: (page - 1) * pageSize,
              });
            }}
            showControls
            showShadow
            size='sm'
          />
        </div>
      )}

      {/* Load More Button (alternative to pagination) */}
      {logs.length < totalCount && totalPages <= 1 && (
        <div className='flex justify-center'>
          <Button variant='flat' onPress={onLoadMore} isLoading={loading}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
