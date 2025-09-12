import { TaskFilters, TaskStatus, Priority } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Select,
  SelectItem,
  Button,
  Chip,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@heroui/react';
import {
  Filter,
  X,
  Search,
  Repeat,
  Calendar,
  Flag,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  showPeriodicFilters?: boolean;
  className?: string;
}

export function TaskFilterBar({
  filters,
  onFiltersChange,
  showPeriodicFilters = true,
  className = '',
}: TaskFilterBarProps) {
  const { t } = useTranslation();

  const handleFilterChange = (key: keyof TaskFilters, value: unknown) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof TaskFilters];
    return (
      value !== undefined &&
      value !== null &&
      (Array.isArray(value) ? value.length > 0 : true)
    );
  });

  const statusOptions = [
    {
      key: TaskStatus.PENDING,
      label: t('status.pending'),
      icon: <Clock className='w-4 h-4' />,
    },
    {
      key: TaskStatus.IN_PROGRESS,
      label: t('status.inProgress'),
      icon: <AlertCircle className='w-4 h-4' />,
    },
    {
      key: TaskStatus.COMPLETED,
      label: t('status.completed'),
      icon: <CheckCircle className='w-4 h-4' />,
    },
    {
      key: TaskStatus.CANCELLED,
      label: t('status.cancelled'),
      icon: <X className='w-4 h-4' />,
    },
  ];

  const priorityOptions = [
    { key: Priority.LOW, label: t('priority.low'), color: 'default' },
    { key: Priority.MEDIUM, label: t('priority.medium'), color: 'warning' },
    { key: Priority.HIGH, label: t('priority.high'), color: 'danger' },
    { key: Priority.URGENT, label: t('priority.urgent'), color: 'danger' },
  ];

  const periodicFilterOptions = [
    {
      key: 'all',
      label: t('filters.periodic.all'),
      icon: <Filter className='w-4 h-4' />,
    },
    {
      key: 'instances_only',
      label: t('filters.periodic.instancesOnly'),
      icon: <Repeat className='w-4 h-4' />,
    },
    {
      key: 'regular_only',
      label: t('filters.periodic.regularOnly'),
      icon: <Calendar className='w-4 h-4' />,
    },
  ];

  return (
    <div
      className={`bg-content1 rounded-lg border border-divider ${className}`}
    >
      {/* Compact Header Row */}
      <div className='flex items-center gap-2 p-2'>
        {/* Search - Always visible */}
        <div className='flex-1 min-w-[180px]'>
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={filters.search || ''}
            onChange={e =>
              handleFilterChange('search', e.target.value || undefined)
            }
            startContent={<Search className='w-4 h-4 text-default-400' />}
            size='sm'
            classNames={{
              input: 'text-foreground',
              inputWrapper:
                'bg-content2 border-divider data-[hover=true]:bg-content3 h-8',
            }}
          />
        </div>

        {/* Filter Toggle Button */}
        <Popover placement='bottom-end'>
          <PopoverTrigger>
            <Button
              size='sm'
              variant='flat'
              startContent={<Filter className='w-4 h-4' />}
              endContent={<ChevronDown className='w-3 h-3' />}
              className='h-8 px-3'
            >
              {hasActiveFilters && (
                <Chip
                  size='sm'
                  variant='solid'
                  color='primary'
                  className='ml-1'
                >
                  {
                    Object.keys(filters).filter(key => {
                      const value = filters[key as keyof TaskFilters];
                      return (
                        value !== undefined &&
                        value !== null &&
                        (Array.isArray(value) ? value.length > 0 : true)
                      );
                    }).length
                  }
                </Chip>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-96 p-3'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-medium'>
                  {t('logViewer.filters')}
                </h4>
                {hasActiveFilters && (
                  <Button
                    size='sm'
                    variant='light'
                    color='danger'
                    onPress={handleClearFilters}
                    startContent={<X className='w-3 h-3' />}
                  >
                    {t('filters.clear')}
                  </Button>
                )}
              </div>

              {/* Compact Horizontal Layout */}
              <div className='flex flex-wrap gap-2'>
                {/* Status Filter */}
                <div className='flex-1 min-w-[120px]'>
                  <label className='text-xs text-default-500 mb-1 block'>
                    {t('filters.status')}
                  </label>
                  <Select
                    placeholder={t('filters.status')}
                    selectedKeys={filters.status?.map(s => s.toString()) || []}
                    onSelectionChange={keys => {
                      const statusArray = Array.from(keys).map(
                        key => key as TaskStatus
                      );
                      handleFilterChange(
                        'status',
                        statusArray.length > 0 ? statusArray : undefined
                      );
                    }}
                    selectionMode='multiple'
                    size='sm'
                    classNames={{
                      trigger:
                        'bg-content2 border-divider data-[hover=true]:bg-content3',
                      value: 'text-foreground',
                    }}
                    renderValue={items => (
                      <div className='flex flex-wrap gap-1'>
                        {items.map(item => (
                          <Chip key={item.key} size='sm' variant='flat'>
                            {item.textValue}
                          </Chip>
                        ))}
                      </div>
                    )}
                  >
                    {statusOptions.map(status => (
                      <SelectItem key={status.key} startContent={status.icon}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Priority Filter */}
                <div className='flex-1 min-w-[120px]'>
                  <label className='text-xs text-default-500 mb-1 block'>
                    {t('filters.priority')}
                  </label>
                  <Select
                    placeholder={t('filters.priority')}
                    selectedKeys={
                      filters.priority?.map(p => p.toString()) || []
                    }
                    onSelectionChange={keys => {
                      const priorityArray = Array.from(keys).map(
                        key => parseInt(key as string) as Priority
                      );
                      handleFilterChange(
                        'priority',
                        priorityArray.length > 0 ? priorityArray : undefined
                      );
                    }}
                    selectionMode='multiple'
                    size='sm'
                    classNames={{
                      trigger:
                        'bg-content2 border-divider data-[hover=true]:bg-content3',
                      value: 'text-foreground',
                    }}
                    renderValue={items => (
                      <div className='flex flex-wrap gap-1'>
                        {items.map(item => (
                          <Chip
                            key={item.key}
                            size='sm'
                            variant='flat'
                            color={
                              (priorityOptions.find(
                                p => p.key.toString() === item.key
                              )?.color as
                                | 'default'
                                | 'primary'
                                | 'secondary'
                                | 'success'
                                | 'warning'
                                | 'danger') || 'default'
                            }
                          >
                            {item.textValue}
                          </Chip>
                        ))}
                      </div>
                    )}
                  >
                    {priorityOptions.map(priority => (
                      <SelectItem
                        key={priority.key}
                        startContent={<Flag className='w-4 h-4' />}
                      >
                        {priority.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Periodic Task Filter - Full Width Row */}
              {showPeriodicFilters && (
                <div>
                  <label className='text-xs text-default-500 mb-1 block'>
                    {t('filters.periodic.label')}
                  </label>
                  <Select
                    placeholder={t('filters.periodic.label')}
                    selectedKeys={
                      filters.periodicFilter ? [filters.periodicFilter] : []
                    }
                    onSelectionChange={keys => {
                      const selected = Array.from(keys)[0] as string;
                      handleFilterChange(
                        'periodicFilter',
                        selected === 'all' ? undefined : selected
                      );
                    }}
                    size='sm'
                    classNames={{
                      trigger:
                        'bg-content2 border-divider data-[hover=true]:bg-content3',
                      value: 'text-foreground',
                    }}
                  >
                    {periodicFilterOptions.map(option => (
                      <SelectItem key={option.key} startContent={option.icon}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className='px-2 pb-2'>
          <div className='flex flex-wrap gap-1'>
            {filters.status?.map(status => (
              <Chip
                key={`status-${status}`}
                size='sm'
                variant='flat'
                color='primary'
                onClose={() => {
                  const newStatus = filters.status?.filter(s => s !== status);
                  handleFilterChange(
                    'status',
                    newStatus?.length ? newStatus : undefined
                  );
                }}
              >
                {statusOptions.find(s => s.key === status)?.label}
              </Chip>
            ))}
            {filters.priority?.map(priority => (
              <Chip
                key={`priority-${priority}`}
                size='sm'
                variant='flat'
                color='warning'
                onClose={() => {
                  const newPriority = filters.priority?.filter(
                    p => p !== priority
                  );
                  handleFilterChange(
                    'priority',
                    newPriority?.length ? newPriority : undefined
                  );
                }}
              >
                {priorityOptions.find(p => p.key === priority)?.label}
              </Chip>
            ))}
            {filters.periodicFilter && (
              <Chip
                size='sm'
                variant='flat'
                color='secondary'
                onClose={() => handleFilterChange('periodicFilter', undefined)}
              >
                {
                  periodicFilterOptions.find(
                    o => o.key === filters.periodicFilter
                  )?.label
                }
              </Chip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
