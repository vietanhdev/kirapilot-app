// Task list component with filtering, sorting, and drag-and-drop
import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Task, TaskFilters, TaskSortOptions, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';
import { TaskFiltersComponent } from './TaskFilters';
import { SortableTaskCard } from './SortableTaskCard';
import { 
  List, 
  Grid3X3, 
  LayoutList, 
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Move,
  Minus
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onTaskStatusChange?: (task: Task, status: TaskStatus) => void;
  onTaskStartTimer?: (task: Task) => void;
  onTaskReorder?: (tasks: Task[]) => void;
  onCreateTask?: () => void;
  isLoading?: boolean;
  className?: string;
  enableDragAndDrop?: boolean;
  viewMode?: ViewMode;
}

type ViewMode = 'list' | 'grid' | 'compact';

export function TaskList({ 
  tasks, 
  onTaskEdit, 
  onTaskDelete, 
  onTaskStatusChange, 
  onTaskStartTimer,
  onTaskReorder,
  onCreateTask,
  isLoading = false,
  className = '',
  enableDragAndDrop = true,
  viewMode: propViewMode = 'list'
}: TaskListProps) {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [sortOptions, setSortOptions] = useState<TaskSortOptions>({
    field: 'createdAt',
    direction: 'desc'
  });
  const [viewMode, setViewMode] = useState<ViewMode>(propViewMode);
  const [showFilters, setShowFilters] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local tasks when props change
  useMemo(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Update view mode when prop changes
  useMemo(() => {
    setViewMode(propViewMode);
  }, [propViewMode]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localTasks.findIndex((task) => task.id === active.id);
      const newIndex = localTasks.findIndex((task) => task.id === over.id);

      const reorderedTasks = arrayMove(localTasks, oldIndex, newIndex);
      setLocalTasks(reorderedTasks);
      
      if (onTaskReorder) {
        onTaskReorder(reorderedTasks);
      }
    }
  };

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...localTasks];

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status!.includes(task.status));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(task => filters.priority!.includes(task.priority));
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task => 
        filters.tags!.some(tag => task.tags.includes(tag))
      );
    }

    if (filters.dueDate) {
      if (filters.dueDate.from) {
        filtered = filtered.filter(task => 
          task.dueDate && new Date(task.dueDate) >= filters.dueDate!.from!
        );
      }
      if (filters.dueDate.to) {
        filtered = filtered.filter(task => 
          task.dueDate && new Date(task.dueDate) <= filters.dueDate!.to!
        );
      }
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.projectId) {
      filtered = filtered.filter(task => task.projectId === filters.projectId);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortOptions.field) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority':
          aValue = a.priority;
          bValue = b.priority;
          break;
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
      }

      if (sortOptions.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [localTasks, filters, sortOptions]);

  // Task statistics
  const taskStats = useMemo(() => {
    const total = filteredAndSortedTasks.length;
    const completed = filteredAndSortedTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgress = filteredAndSortedTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const overdue = filteredAndSortedTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.COMPLETED
    ).length;

    return { total, completed, inProgress, overdue };
  }, [filteredAndSortedTasks]);

  const clearFilters = () => {
    setFilters({});
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

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-400">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <List className="w-6 h-6 text-primary-500" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Tasks
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {taskStats.total} tasks • {taskStats.completed} completed • {taskStats.inProgress} in progress
              {taskStats.overdue > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-1">
                  • {taskStats.overdue} overdue
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`
                p-2 transition-colors duration-200
                ${viewMode === 'list'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
              `}
              title="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`
                p-2 transition-colors duration-200
                ${viewMode === 'compact'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
              `}
              title="Compact view"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`
                p-2 transition-colors duration-200
                ${viewMode === 'grid'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
              `}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          {/* Drag and Drop Toggle */}
          {enableDragAndDrop && viewMode === 'list' && (
            <button
              className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200"
              title="Drag and drop enabled"
            >
              <Move className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Reorder</span>
            </button>
          )}

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors duration-200
              ${showFilters || hasActiveFilters()
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }
            `}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters() && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>

          {/* Create Task Button */}
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center space-x-2">
            <List className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Total</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {taskStats.total}
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Completed</span>
          </div>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400 mt-1">
            {taskStats.completed}
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">In Progress</span>
          </div>
          <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mt-1">
            {taskStats.inProgress}
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Overdue</span>
          </div>
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400 mt-1">
            {taskStats.overdue}
          </p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <TaskFiltersComponent
          filters={filters}
          sortOptions={sortOptions}
          onFiltersChange={setFilters}
          onSortChange={setSortOptions}
          onClearFilters={clearFilters}
        />
      )}

      {/* Task List */}
      <div className="space-y-4">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-12">
            {hasActiveFilters() ? (
              <div>
                <Search className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No tasks match your filters
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Try adjusting your search criteria or clearing some filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div>
                <List className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No tasks yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Get started by creating your first task.
                </p>
                {onCreateTask && (
                  <button
                    onClick={onCreateTask}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
                  >
                    Create Task
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={`
            ${viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
              : viewMode === 'compact'
              ? 'space-y-2'
              : 'space-y-3'
            }
          `}>
            {enableDragAndDrop && viewMode === 'list' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredAndSortedTasks.map(task => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredAndSortedTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onEdit={onTaskEdit}
                      onDelete={onTaskDelete}
                      onStatusChange={onTaskStatusChange}
                      onStartTimer={onTaskStartTimer}
                      viewMode={viewMode}
                      allTasks={localTasks}
                      isActive={(task as any).isActive}
                      currentTime={(task as any).currentTime}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              filteredAndSortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onTaskEdit}
                  onDelete={onTaskDelete}
                  onStatusChange={onTaskStatusChange}
                  onStartTimer={onTaskStartTimer}
                  viewMode={viewMode}
                  allTasks={localTasks}
                  isActive={(task as any).isActive}
                  currentTime={(task as any).currentTime}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}