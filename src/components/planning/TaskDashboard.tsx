import { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { Calendar, List, RefreshCw } from 'lucide-react';
import { Task, TaskStatus, VirtualTask } from '../../types';
import { QuickTaskCreator } from './QuickTaskCreator';
import { TodayTasksList } from './TodayTasksList';
import { useTaskOperations } from '../../hooks/useTaskOperations';
import { useNavigation } from '../../contexts/NavigationContext';

interface TaskDashboardProps {
  tasks: (Task | VirtualTask)[];
  onTaskStatusChange: (task: Task | VirtualTask, status: TaskStatus) => void;
  onTaskEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task | VirtualTask) => void;
  onViewTimeHistory?: (task: Task) => void;

  getTaskTimerProps?: (task: Task) => Record<string, unknown>;
  className?: string;
}

export function TaskDashboard({
  tasks,
  onTaskStatusChange,
  onTaskEdit,
  onTaskDelete,
  onViewTimeHistory,
  getTaskTimerProps,
  className = '',
}: TaskDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshTasks } = useTaskOperations();
  const { navigateTo } = useNavigation();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshTasks();
      // Add a small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTaskCreated = (task: Task) => {
    console.log('Task created:', task.title);
    // The task list will be automatically refreshed by the parent component
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between w-full'>
            <div className='flex items-center gap-2'>
              <Calendar className='w-6 h-6 text-primary' />
              <h2 className='text-xl font-semibold'>Task Dashboard</h2>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='flat'
                size='sm'
                startContent={<RefreshCw className='w-4 h-4' />}
                onPress={handleRefresh}
                isLoading={isRefreshing}
              >
                Refresh
              </Button>

              <Button
                variant='flat'
                size='sm'
                startContent={<Calendar className='w-4 h-4' />}
                onPress={() => navigateTo('day')}
              >
                Day View
              </Button>

              <Button
                variant='flat'
                size='sm'
                startContent={<List className='w-4 h-4' />}
                onPress={() => navigateTo('week')}
              >
                Week View
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Task Creator */}
      <QuickTaskCreator
        defaultDate={new Date()}
        placeholder='What do you want to accomplish today?'
        onTaskCreated={handleTaskCreated}
      />

      {/* Today's Tasks */}
      <TodayTasksList
        tasks={tasks}
        onTaskStatusChange={onTaskStatusChange}
        onTaskEdit={onTaskEdit}
        onTaskDelete={onTaskDelete}
        onViewTimeHistory={onViewTimeHistory}
        getTaskTimerProps={getTaskTimerProps}
      />

      {/* Quick Stats */}
      <Card>
        <CardBody>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-center'>
            <div>
              <div className='text-2xl font-bold text-primary'>
                {tasks.filter(t => t.status === TaskStatus.PENDING).length}
              </div>
              <div className='text-sm text-foreground-600'>Pending Tasks</div>
            </div>

            <div>
              <div className='text-2xl font-bold text-warning'>
                {tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}
              </div>
              <div className='text-sm text-foreground-600'>In Progress</div>
            </div>

            <div>
              <div className='text-2xl font-bold text-success'>
                {tasks.filter(t => t.status === TaskStatus.COMPLETED).length}
              </div>
              <div className='text-sm text-foreground-600'>Completed</div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
