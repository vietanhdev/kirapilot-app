import { Card, CardBody } from '@heroui/react';
import { Focus } from 'lucide-react';
import { Task, TaskStatus, VirtualTask } from '../../types';
import { TodayTasksList } from './TodayTasksList';
import { QuickTaskCreator } from './QuickTaskCreator';

interface FocusViewProps {
  tasks: (Task | VirtualTask)[];
  onTaskStatusChange: (task: Task | VirtualTask, status: TaskStatus) => void;
  onTaskEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task | VirtualTask) => void;
  onViewTimeHistory?: (task: Task) => void;
  getTaskTimerProps?: (task: Task) => Record<string, unknown>;
  className?: string;
}

export function FocusView({
  tasks,
  onTaskStatusChange,
  onTaskEdit,
  onTaskDelete,
  onViewTimeHistory,
  getTaskTimerProps,
  className = '',
}: FocusViewProps) {
  const handleTaskCreated = (task: Task) => {
    console.log('Task created in focus mode:', task.title);
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Focus Mode Header */}
      <Card className='flex-shrink-0 mb-4'>
        <CardBody className='py-3'>
          <div className='flex items-center gap-2'>
            <Focus className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>Focus Mode</h2>
          </div>
        </CardBody>
      </Card>

      {/* Scrollable Content */}
      <div className='flex-1 overflow-y-auto space-y-4'>
        {/* Quick Task Creator */}
        <QuickTaskCreator
          defaultDate={new Date()}
          placeholder='Quick task for today...'
          onTaskCreated={handleTaskCreated}
          compact={true}
        />

        {/* Today's Tasks */}
        <TodayTasksList
          tasks={tasks}
          onTaskStatusChange={onTaskStatusChange}
          onTaskEdit={onTaskEdit}
          onTaskDelete={onTaskDelete}
          onViewTimeHistory={onViewTimeHistory}
          getTaskTimerProps={getTaskTimerProps}
          className='focus-mode-tasks'
        />
      </div>
    </div>
  );
}
