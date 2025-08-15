// Demo component to showcase task management components
import { useState, useEffect } from 'react';
import { Task, CreateTaskRequest, UpdateTaskRequest, Priority, TaskStatus } from '../../types';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { generateId } from '../../utils';
import { getSampleTasks } from '../../services/database/mockDatabase';
import { Plus, List, Grid3X3, LayoutList, Minus } from 'lucide-react';

type ViewMode = 'list' | 'grid' | 'compact';

export function TaskScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [activeTimers, setActiveTimers] = useState<{ [taskId: string]: number }>({});

  // Load sample tasks on mount
  useEffect(() => {
    try {
      const sampleTasks = getSampleTasks();
      setTasks(sampleTasks);
      
      // Simulate some active timers for demo purposes
      if (sampleTasks.length > 0) {
        const activeTask = sampleTasks.find(t => t.status === TaskStatus.IN_PROGRESS);
        if (activeTask) {
          setActiveTimers({ [activeTask.id]: Date.now() });
        }
      }
    } catch (error) {
      console.error('Failed to load sample tasks:', error);
      // Fallback to empty array
      setTasks([]);
    }
  }, []);

  // Timer effect for active timers
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          updated[taskId] = prev[taskId] || Date.now();
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTimer = (startTime: number): string => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCreateTask = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    const newTask: Task = {
      id: generateId(),
      title: data.title || 'Untitled Task',
      description: data.description || '',
      priority: data.priority || Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: data.dependencies || [],
      timeEstimate: data.timeEstimate || 0,
      actualTime: 0,
      dueDate: data.dueDate,
      tags: data.tags || [],
      projectId: (data as CreateTaskRequest).projectId,
      parentTaskId: (data as CreateTaskRequest).parentTaskId,
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks(prev => [newTask, ...prev]);
    setShowForm(false);
  };

  const handleUpdateTask = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    if (!editingTask) return;

    const updatedTask: Task = {
      ...editingTask,
      title: data.title || editingTask.title,
      description: data.description || editingTask.description,
      priority: data.priority || editingTask.priority,
      timeEstimate: data.timeEstimate || editingTask.timeEstimate,
      dueDate: data.dueDate !== undefined ? data.dueDate : editingTask.dueDate,
      tags: data.tags || editingTask.tags,
      dependencies: data.dependencies || editingTask.dependencies,
      updatedAt: new Date(),
    };

    setTasks(prev => prev.map(task => task.id === editingTask.id ? updatedTask : task));
    setEditingTask(undefined);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowForm(false);
  };

  const handleDeleteTask = (task: Task) => {
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      // Remove timer if active
      setActiveTimers(prev => {
        const updated = { ...prev };
        delete updated[task.id];
        return updated;
      });
    }
  };

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    const updatedTask: Task = {
      ...task,
      status,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
      updatedAt: new Date(),
    };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));

    // Remove timer if task is completed
    if (status === TaskStatus.COMPLETED) {
      setActiveTimers(prev => {
        const updated = { ...prev };
        delete updated[task.id];
        return updated;
      });
    }
  };

  const handleStartTimer = (task: Task) => {
    // Start timer for this task
    setActiveTimers(prev => ({
      ...prev,
      [task.id]: Date.now()
    }));

    // Update task status to in progress
    const updatedTask: Task = {
      ...task,
      status: TaskStatus.IN_PROGRESS,
      updatedAt: new Date(),
    };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
  };

  const handleTaskReorder = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
    // In a real implementation, this would persist the new order to the database
    console.log('Tasks reordered:', reorderedTasks.map(t => t.title));
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTask(undefined);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <List className="w-6 h-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Task Management Demo
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Mode Selector */}
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`
                px-3 py-2 transition-colors duration-200
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
                px-3 py-2 transition-colors duration-200
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
                px-3 py-2 transition-colors duration-200
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

          {!showForm && !editingTask && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode Info */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {viewMode === 'compact' ? 'Compact View' : viewMode === 'grid' ? 'Grid View' : 'List View'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {viewMode === 'compact' 
            ? 'Ultra-compact single-row layout perfect for focused work sessions. Shows active timers, priority badges, and essential task information at a glance.'
            : viewMode === 'grid'
            ? 'Grid layout for visual task overview with cards arranged in columns.'
            : 'Detailed list view with full task information, drag-and-drop reordering, and comprehensive metadata.'
          }
        </p>
        {Object.keys(activeTimers).length > 0 && (
          <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            ⏱️ {Object.keys(activeTimers).length} active timer{Object.keys(activeTimers).length !== 1 ? 's' : ''} running
          </div>
        )}
      </div>

      {/* Task Form */}
      {(showForm || editingTask) && (
        <TaskForm
          task={editingTask}
          onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
          onCancel={handleCancel}
          className="mb-6"
        />
      )}

      {/* Enhanced Task List with active timers */}
      <TaskList
        tasks={tasks.map(task => ({
          ...task,
          // Add active timer state and current time for display
          ...(activeTimers[task.id] && {
            isActive: true,
            currentTime: formatTimer(activeTimers[task.id])
          })
        }))}
        onTaskEdit={handleEditTask}
        onTaskDelete={handleDeleteTask}
        onTaskStatusChange={handleStatusChange}
        onTaskStartTimer={handleStartTimer}
        onTaskReorder={handleTaskReorder}
        onCreateTask={() => setShowForm(true)}
        enableDragAndDrop={viewMode === 'list'}
        viewMode={viewMode}
      />
    </div>
  );
}