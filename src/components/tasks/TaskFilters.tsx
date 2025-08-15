// Task filtering component
import { useState } from 'react';
import { TaskFilters, TaskSortOptions, Priority, TaskStatus } from '../../types';
// import { PrioritySelector } from '../common/PrioritySelector';
import { TagInput } from '../common/TagInput';
import { DatePicker } from '../common/DatePicker';
import { 
  Filter, 
  X, 
  Search, 
  SortAsc, 
  SortDesc, 
  Calendar,
  Flag,
  Hash,
  FileText,
  ChevronDown
} from 'lucide-react';

interface TaskFiltersProps {
  filters: TaskFilters;
  sortOptions: TaskSortOptions;
  onFiltersChange: (filters: TaskFilters) => void;
  onSortChange: (sort: TaskSortOptions) => void;
  onClearFilters: () => void;
  className?: string;
}

const statusOptions = [
  { value: TaskStatus.PENDING, label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  { value: TaskStatus.IN_PROGRESS, label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: TaskStatus.COMPLETED, label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: TaskStatus.CANCELLED, label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

const sortFields = [
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
] as const;

export function TaskFiltersComponent({ 
  filters, 
  sortOptions, 
  onFiltersChange, 
  onSortChange, 
  onClearFilters,
  className = '' 
}: TaskFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    updateFilter('search', value || undefined);
  };

  const toggleStatus = (status: TaskStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    updateFilter('status', newStatuses.length > 0 ? newStatuses : undefined);
  };

  const togglePriority = (priority: Priority) => {
    const currentPriorities = filters.priority || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter(p => p !== priority)
      : [...currentPriorities, priority];
    
    updateFilter('priority', newPriorities.length > 0 ? newPriorities : undefined);
  };

  const hasActiveFilters = () => {
    return !!(filters.status?.length || 
             filters.priority?.length || 
             filters.tags?.length || 
             filters.dueDate?.from || 
             filters.dueDate?.to || 
             filters.search || 
             filters.projectId);
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="font-medium text-slate-900 dark:text-slate-100">Filters & Search</h3>
          {hasActiveFilters() && (
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasActiveFilters() && (
            <button
              onClick={onClearFilters}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
            >
              Clear All
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Search Bar - Always Visible */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Status Filter */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <FileText className="w-4 h-4 mr-2" />
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const isSelected = filters.status?.includes(option.value) || false;
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleStatus(option.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200
                      ${isSelected
                        ? `${option.color} border-current`
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Flag className="w-4 h-4 mr-2" />
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(Priority).map(([key, priority]) => {
                if (typeof priority === 'number') {
                  const isSelected = filters.priority?.includes(priority) || false;
                  const priorityLabels = {
                    [Priority.LOW]: 'Low',
                    [Priority.MEDIUM]: 'Medium',
                    [Priority.HIGH]: 'High',
                    [Priority.URGENT]: 'Urgent',
                  };
                  
                  return (
                    <button
                      key={key}
                      onClick={() => togglePriority(priority)}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200
                        ${isSelected
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }
                      `}
                    >
                      {priorityLabels[priority]}
                    </button>
                  );
                }
                return null;
              })}
            </div>
          </div>

          {/* Due Date Filter */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Calendar className="w-4 h-4 mr-2" />
              Due Date Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
                <DatePicker
                  value={filters.dueDate?.from}
                  onChange={(date) => updateFilter('dueDate', {
                    ...filters.dueDate,
                    from: date
                  })}
                  placeholder="Start date"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
                <DatePicker
                  value={filters.dueDate?.to}
                  onChange={(date) => updateFilter('dueDate', {
                    ...filters.dueDate,
                    to: date
                  })}
                  placeholder="End date"
                  minDate={filters.dueDate?.from}
                />
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Hash className="w-4 h-4 mr-2" />
              Tags
            </label>
            <TagInput
              tags={filters.tags || []}
              onChange={(tags) => updateFilter('tags', tags.length > 0 ? tags : undefined)}
              placeholder="Filter by tags..."
              maxTags={5}
            />
          </div>

          {/* Sort Options */}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <SortAsc className="w-4 h-4 mr-2" />
              Sort By
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <select
                  value={sortOptions.field}
                  onChange={(e) => onSortChange({
                    ...sortOptions,
                    field: e.target.value as TaskSortOptions['field']
                  })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                >
                  {sortFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
                  <button
                    onClick={() => onSortChange({ ...sortOptions, direction: 'asc' })}
                    className={`
                      flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors duration-200
                      ${sortOptions.direction === 'asc'
                        ? 'bg-primary-500 text-white'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    <SortAsc className="w-4 h-4 mr-1" />
                    Asc
                  </button>
                  <button
                    onClick={() => onSortChange({ ...sortOptions, direction: 'desc' })}
                    className={`
                      flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors duration-200
                      ${sortOptions.direction === 'desc'
                        ? 'bg-primary-500 text-white'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    <SortDesc className="w-4 h-4 mr-1" />
                    Desc
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}