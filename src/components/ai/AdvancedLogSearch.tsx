import { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Checkbox,
  CheckboxGroup,
  Button,
  Chip,
  Divider,
} from '@heroui/react';
import {
  Search,
  Filter,
  X,
  Calendar,
  Cpu,
  Zap,
  AlertCircle,
  Wrench,
  Brain,
} from 'lucide-react';
import { LogFilter } from '../../types/aiLogging';
import { DatePicker } from '../common/DatePicker';

interface AdvancedLogSearchProps {
  filters: LogFilter;
  onFiltersChange: (filters: LogFilter) => void;
  onClearFilters: () => void;
  className?: string;
}

const SEARCH_FIELDS = [
  {
    key: 'userMessage',
    label: 'User Messages',
    icon: <Search className='w-4 h-4' />,
  },
  {
    key: 'aiResponse',
    label: 'AI Responses',
    icon: <Brain className='w-4 h-4' />,
  },
  {
    key: 'reasoning',
    label: 'AI Reasoning',
    icon: <Brain className='w-4 h-4' />,
  },
  {
    key: 'toolCalls',
    label: 'Tool Calls',
    icon: <Wrench className='w-4 h-4' />,
  },
  {
    key: 'errors',
    label: 'Error Messages',
    icon: <AlertCircle className='w-4 h-4' />,
  },
];

const QUICK_FILTERS = [
  {
    key: 'today',
    label: 'Today',
    getValue: () => ({ startDate: new Date(new Date().setHours(0, 0, 0, 0)) }),
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);
      return { startDate: yesterday, endDate: endOfYesterday };
    },
  },
  {
    key: 'thisWeek',
    label: 'This Week',
    getValue: () => {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startOfWeek.setHours(0, 0, 0, 0);
      return { startDate: startOfWeek };
    },
  },
  {
    key: 'lastWeek',
    label: 'Last Week',
    getValue: () => {
      const now = new Date();
      const startOfLastWeek = new Date(
        now.setDate(now.getDate() - now.getDay() - 7)
      );
      startOfLastWeek.setHours(0, 0, 0, 0);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { startDate: startOfLastWeek, endDate: endOfLastWeek };
    },
  },
  {
    key: 'thisMonth',
    label: 'This Month',
    getValue: () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: startOfMonth };
    },
  },
];

export function AdvancedLogSearch({
  filters,
  onFiltersChange,
  onClearFilters,
  className,
}: AdvancedLogSearchProps) {
  const [searchFields, setSearchFields] = useState<string[]>([
    'userMessage',
    'aiResponse',
  ]);
  const [searchText, setSearchText] = useState(filters.searchText || '');

  const handleFilterChange = (field: keyof LogFilter, value: unknown) => {
    const newFilters = {
      ...filters,
      [field]: value,
    };
    onFiltersChange(newFilters);
  };

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    handleFilterChange('searchText', text || undefined);
  };

  const handleQuickFilter = (quickFilter: (typeof QUICK_FILTERS)[0]) => {
    const filterValues = quickFilter.getValue();
    const newFilters = {
      ...filters,
      ...filterValues,
    };
    onFiltersChange(newFilters);
  };

  const handleDateRangeChange = (
    field: 'startDate' | 'endDate',
    date: Date | null
  ) => {
    handleFilterChange(field, date);
  };

  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof LogFilter];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return (
    <Card className={className}>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            <Filter className='w-5 h-5' />
            <h3 className='font-semibold'>Advanced Search & Filters</h3>
            {activeFiltersCount > 0 && (
              <Chip size='sm' color='primary' variant='flat'>
                {activeFiltersCount} active
              </Chip>
            )}
          </div>
          <Button
            variant='light'
            size='sm'
            startContent={<X className='w-4 h-4' />}
            onPress={onClearFilters}
            isDisabled={activeFiltersCount === 0}
          >
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardBody className='space-y-6'>
        {/* Search Text */}
        <div className='space-y-3'>
          <div className='flex items-center gap-2'>
            <Search className='w-4 h-4' />
            <label className='font-medium'>Search Content</label>
          </div>
          <Input
            placeholder='Search in logs...'
            value={searchText}
            onValueChange={handleSearchTextChange}
            startContent={<Search className='w-4 h-4' />}
            description='Search across selected fields using keywords or phrases'
          />
          <div className='space-y-2'>
            <label className='text-sm font-medium text-default-600'>
              Search in fields:
            </label>
            <CheckboxGroup
              value={searchFields}
              onValueChange={setSearchFields}
              orientation='horizontal'
              className='flex flex-wrap gap-2'
            >
              {SEARCH_FIELDS.map(field => (
                <Checkbox key={field.key} value={field.key}>
                  <div className='flex items-center gap-1'>
                    {field.icon}
                    <span className='text-sm'>{field.label}</span>
                  </div>
                </Checkbox>
              ))}
            </CheckboxGroup>
          </div>
        </div>

        <Divider />

        {/* Quick Date Filters */}
        <div className='space-y-3'>
          <div className='flex items-center gap-2'>
            <Calendar className='w-4 h-4' />
            <label className='font-medium'>Quick Date Filters</label>
          </div>
          <div className='flex flex-wrap gap-2'>
            {QUICK_FILTERS.map(quickFilter => (
              <Button
                key={quickFilter.key}
                variant='flat'
                size='sm'
                onPress={() => handleQuickFilter(quickFilter)}
              >
                {quickFilter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div className='space-y-3'>
          <label className='font-medium'>Custom Date Range</label>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <DatePicker
              label='Start Date'
              value={filters.startDate || null}
              onChange={date => handleDateRangeChange('startDate', date)}
              dateFormat='YYYY-MM-DD'
              size='sm'
            />
            <DatePicker
              label='End Date'
              value={filters.endDate || null}
              onChange={date => handleDateRangeChange('endDate', date)}
              dateFormat='YYYY-MM-DD'
              size='sm'
            />
          </div>
        </div>

        <Divider />

        {/* AI Service Filter */}
        <div className='space-y-3'>
          <label className='font-medium'>AI Service</label>
          <Select
            placeholder='All services'
            selectedKeys={filters.modelType ? [filters.modelType] : []}
            onSelectionChange={keys => {
              const value = Array.from(keys)[0] as
                | 'local'
                | 'gemini'
                | undefined;
              handleFilterChange('modelType', value);
            }}
            startContent={
              filters.modelType === 'local' ? (
                <Cpu className='w-4 h-4' />
              ) : filters.modelType === 'gemini' ? (
                <Zap className='w-4 h-4' />
              ) : (
                <Filter className='w-4 h-4' />
              )
            }
          >
            <SelectItem key='local' textValue='Local AI'>
              <div className='flex items-center gap-2'>
                <Cpu className='w-4 h-4' />
                Local AI
              </div>
            </SelectItem>
            <SelectItem key='gemini' textValue='Gemini'>
              <div className='flex items-center gap-2'>
                <Zap className='w-4 h-4' />
                Gemini
              </div>
            </SelectItem>
          </Select>
        </div>

        {/* Content Type Filters */}
        <div className='space-y-3'>
          <label className='font-medium'>Content Type</label>
          <div className='flex flex-wrap gap-2'>
            <Checkbox
              isSelected={filters.hasErrors}
              onValueChange={value =>
                handleFilterChange('hasErrors', value || undefined)
              }
            >
              <div className='flex items-center gap-1'>
                <AlertCircle className='w-4 h-4 text-danger' />
                <span>Has Errors</span>
              </div>
            </Checkbox>
            <Checkbox
              isSelected={filters.containsToolCalls}
              onValueChange={value =>
                handleFilterChange('containsToolCalls', value || undefined)
              }
            >
              <div className='flex items-center gap-1'>
                <Wrench className='w-4 h-4 text-secondary' />
                <span>With Tool Calls</span>
              </div>
            </Checkbox>
          </div>
        </div>

        {/* Results Limit */}
        <div className='space-y-3'>
          <label className='font-medium'>Results Limit</label>
          <Select
            placeholder='All results'
            selectedKeys={filters.limit ? [filters.limit.toString()] : []}
            onSelectionChange={keys => {
              const value = Array.from(keys)[0];
              const limit = value ? parseInt(value as string, 10) : undefined;
              handleFilterChange('limit', limit);
            }}
          >
            <SelectItem key='10'>10 results</SelectItem>
            <SelectItem key='25'>25 results</SelectItem>
            <SelectItem key='50'>50 results</SelectItem>
            <SelectItem key='100'>100 results</SelectItem>
            <SelectItem key='250'>250 results</SelectItem>
            <SelectItem key='500'>500 results</SelectItem>
          </Select>
        </div>
      </CardBody>
    </Card>
  );
}
