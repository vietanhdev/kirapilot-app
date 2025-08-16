// Weekly kanban view with day columns
import { useState, useMemo, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Task, TaskStatus } from '../../types';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import {
    ChevronLeft,
    ChevronRight,
    Archive,
    Clock,
    TrendingUp
} from 'lucide-react';

interface WeekViewProps {
  tasks: Task[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTaskMove: (taskId: string, fromColumn: string, toColumn: string, date?: Date) => void;
  onTaskEdit: (task: Task) => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
  onTaskCreate: (task: Task) => void;
  onInlineEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task) => void;
  onViewTimeHistory?: (task: Task) => void;
  getTaskTimerProps?: (task: Task) => any;
}

export function WeekView({
    tasks,
    currentWeek,
    onWeekChange,
    onTaskMove,
    onTaskEdit,
    onTaskStatusChange,
    onTaskCreate,
    onInlineEdit,
    onTaskDelete,
    onViewTimeHistory,
    getTaskTimerProps
}: WeekViewProps) {
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskModalColumn, setTaskModalColumn] = useState<string>('');
    const [taskModalDate, setTaskModalDate] = useState<Date | undefined>();
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    // Auto-scroll to today's column
    useEffect(() => {
        const scrollToToday = () => {
            const container = document.getElementById('week-columns-container');
            const todayColumn = document.querySelector('.today-column');
            
            if (container && todayColumn) {
                const containerRect = container.getBoundingClientRect();
                const columnRect = todayColumn.getBoundingClientRect();
                const scrollLeft = columnRect.left - containerRect.left + container.scrollLeft - (containerRect.width / 2) + (columnRect.width / 2);
                
                container.scrollTo({
                    left: Math.max(0, scrollLeft),
                    behavior: 'smooth'
                });
            }
        };

        // Small delay to ensure DOM is rendered
        const timeoutId = setTimeout(scrollToToday, 100);
        return () => clearTimeout(timeoutId);
    }, [currentWeek]); // Re-run when week changes

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Calculate week boundaries
    const weekStart = useMemo(() => {
        const date = new Date(currentWeek);
        const day = date.getDay();
        const diff = date.getDate() - day; // Sunday = 0
        return new Date(date.setDate(diff));
    }, [currentWeek]);

    const weekEnd = useMemo(() => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + 6);
        date.setHours(23, 59, 59, 999);
        return date;
    }, [weekStart]);

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            days.push({
                date,
                name: date.toLocaleDateString('en-US', { weekday: 'long' }),
                shortName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: date.getDate(),
                isToday: isToday(date)
            });
        }
        return days;
    }, [weekStart]);

    // Get tasks for specific day (that day + overdue scheduled tasks if it's today)
    const getTasksForDay = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks.filter(task => {
            if (!task.scheduledDate) return false;
            const scheduledDate = new Date(task.scheduledDate);
            scheduledDate.setHours(0, 0, 0, 0);
            
            // Tasks scheduled exactly on this day
            if (scheduledDate.getTime() === dayStart.getTime()) {
                return true;
            }
            
            return false;
        });
    };

    // Get backlog tasks (tasks without scheduled date)
    const backlogTasks = useMemo(() => {
        return tasks.filter(task => {
            // Only tasks with no scheduled date go to backlog
            return !task.scheduledDate;
        });
    }, [tasks]);

    // Get upcoming tasks (STRICTLY after this week)
    const upcomingTasks = useMemo(() => {
        return tasks.filter(task => {
            if (!task.scheduledDate) return false;
            const scheduledDate = new Date(task.scheduledDate);
            return scheduledDate > weekEnd;
        });
    }, [tasks, weekEnd]);

    const formatWeekRange = () => {
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric'
        };
        const start = weekStart.toLocaleDateString('en-US', options);
        const end = new Date(weekEnd).toLocaleDateString('en-US', options);
        return `${start} - ${end}, ${weekStart.getFullYear()}`;
    };

    const handleAddTask = (column: string, date?: Date) => {
        console.log('Add task clicked for column:', column, 'date:', date);
        setTaskModalColumn(column);
        
        // Set appropriate default date based on column
        let defaultDate = date;
        if (!defaultDate && column.toLowerCase() === 'upcoming') {
            // For upcoming column, default to next week
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            defaultDate = nextWeek;
        }
        
        setTaskModalDate(defaultDate);
        setShowTaskModal(true);
    };

    const handleTaskCreate = (task: Task) => {
        console.log('Creating task:', {
            title: task.title,
            scheduledDate: task.scheduledDate,
            column: taskModalColumn,
            willAppearIn: !task.scheduledDate ? 'Backlog' : 
                         task.scheduledDate.toDateString() === new Date().toDateString() ? 'Today' :
                         'Date-specific column'
        });
        onTaskCreate(task);
        setShowTaskModal(false);
    };

    // Handle drag end event
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (!over || !draggedTask) {
            setDraggedTask(null);
            return;
        }

        const taskId = active.id as string;
        const droppedColumnData = over.data.current;
        
        if (droppedColumnData?.type === 'column') {
            const toColumn = droppedColumnData.title;
            
            // Determine the new scheduled date based on the column
            let newDate: Date | undefined;
            
            if (toColumn === 'backlog') {
                // Moving to backlog - remove scheduled date
                newDate = undefined;
            } else if (toColumn === 'upcoming') {
                // Moving to upcoming - set to next week
                newDate = new Date();
                newDate.setDate(newDate.getDate() + 7);
            } else {
                // Moving to a specific day column
                const dayColumn = weekDays.find(day => day.shortName.toLowerCase() === toColumn);
                if (dayColumn) {
                    newDate = new Date(dayColumn.date);
                }
            }
            
            console.log('Drag end:', {
                taskId,
                toColumn,
                newDate,
                taskTitle: draggedTask.title
            });
            
            // Call the move handler with the new date
            onTaskMove(taskId, 'drag', toColumn, newDate);
        }
        
        setDraggedTask(null);
    };

    // Calculate week statistics
    const weekStats = useMemo(() => {
        const allWeekTasks = [...backlogTasks, ...upcomingTasks];
        weekDays.forEach(day => {
            allWeekTasks.push(...getTasksForDay(day.date));
        });
        
        const total = allWeekTasks.length;
        const completed = allWeekTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        const inProgress = allWeekTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
        
        return { total, completed, inProgress };
    }, [backlogTasks, upcomingTasks, weekDays, tasks]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => {
                const task = tasks.find(t => t.id === event.active.id);
                setDraggedTask(task || null);
            }}
            onDragEnd={handleDragEnd}
        >
            <div className={`bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg`}>
                {/* Header */}
                <div className="p-2 bg-gray-200 dark:bg-gray-700/50 backdrop-blur-sm rounded-t-lg border-b border-gray-300 dark:border-gray-700/30">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatWeekRange()}
                            </span>
                        </div>

                        <div className="flex items-center space-x-3">
                            {/* Week Navigation */}
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => {
                                        const newDate = new Date(currentWeek);
                                        newDate.setDate(newDate.getDate() - 7);
                                        onWeekChange(newDate);
                                    }}
                                    className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200"
                                    title="Previous week"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </button>
                                
                                <button
                                    onClick={() => onWeekChange(new Date())}
                                    className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors duration-200"
                                    title="Go to current week"
                                >
                                    This Week
                                </button>
                                
                                <button
                                    onClick={() => {
                                        const newDate = new Date(currentWeek);
                                        newDate.setDate(newDate.getDate() + 7);
                                        onWeekChange(newDate);
                                    }}
                                    className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700/50 rounded transition-colors duration-200"
                                    title="Next week"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Week Statistics */}
                    <div className="flex items-center space-x-4 text-xs">
                        <div className="flex items-center space-x-1">
                            <TrendingUp className="w-3 h-3 text-blue-500" />
                            <span className="text-gray-600 dark:text-gray-400">
                                {weekStats.total} total
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400">
                                {weekStats.completed} done
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400">
                                {weekStats.inProgress} active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Kanban Columns - Single Row with Auto-Scroll */}
                <div className="p-2">
                    <div 
                        id="week-columns-container"
                        className="flex gap-2 overflow-x-auto pb-4 scroll-smooth week-scroller"
                    >
                        {/* Backlog Column */}
                        <TaskColumn
                            title="Backlog"
                            icon={Archive}
                            count={backlogTasks.length}
                            color="blue"
                            onAddTask={() => handleAddTask('Backlog')}
                        >
                            {backlogTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                                    onStatusChange={(status) => onTaskStatusChange(task, status)}
                                    onDelete={onTaskDelete}
                                    onViewTimeHistory={onViewTimeHistory}
                                    {...(getTaskTimerProps?.(task) || {})}
                                />
                            ))}
                        </TaskColumn>

                        {/* Daily Columns */}
                        {weekDays.map((day) => {
                            const dayTasks = getTasksForDay(day.date);
                            return (
                                <TaskColumn
                                    key={day.date.toISOString()}
                                    title={day.shortName}
                                    subtitle={`${day.dayNumber}`}
                                    count={dayTasks.length}
                                    color={day.isToday ? "blue" : "gray"}
                                    isToday={day.isToday}
                                    onAddTask={() => handleAddTask(day.shortName, day.date)}
                                    className={day.isToday ? 'today-column' : ''}
                                >
                                    {dayTasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                                            onStatusChange={(status) => onTaskStatusChange(task, status)}
                                            onDelete={onTaskDelete}
                                            onViewTimeHistory={onViewTimeHistory}
                                            {...(getTaskTimerProps?.(task) || {})}
                                        />
                                    ))}
                                </TaskColumn>
                            );
                        })}

                        {/* Upcoming Tasks Column */}
                        <TaskColumn
                            title="Upcoming"
                            icon={Clock}
                            count={upcomingTasks.length}
                            color="purple"
                            onAddTask={() => handleAddTask('Upcoming')}
                        >
                            {upcomingTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={(updates) => onInlineEdit?.(task.id, updates)}
                                    onStatusChange={(status) => onTaskStatusChange(task, status)}
                                    onDelete={onTaskDelete}
                                    onViewTimeHistory={onViewTimeHistory}
                                    {...(getTaskTimerProps?.(task) || {})}
                                />
                            ))}
                        </TaskColumn>
                    </div>
                </div>

                {/* Task Creation Modal */}
                <TaskModal
                    isOpen={showTaskModal}
                    onClose={() => {
                        console.log('Closing task modal');
                        setShowTaskModal(false);
                    }}
                    onCreateTask={handleTaskCreate}
                    defaultDate={taskModalDate}
                />

                {/* Drag Overlay */}
                <DragOverlay>
                    {draggedTask ? (
                        <div className="opacity-75">
                            <TaskCard
                                task={draggedTask}
                                className="shadow-lg border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}