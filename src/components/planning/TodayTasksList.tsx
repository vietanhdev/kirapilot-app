import { useMemo } from 'react';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';
import { Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Task, TaskStatus, VirtualTask } from '../../types';
import { TaskCard } from './TaskCard';
import { useTaskList } from '../../contexts/TaskListContext';

interface TodayTasksListProps {
  tasks: (Task | VirtualTask)[];
  onTaskStatusChange: (task: Task | VirtualTask, status: TaskStatus) => void;
  onTaskEdit?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task | VirtualTask) => void;
  onViewTimeHistory?: (task: Task) => void;
  getTaskTimerProps?: (task: Task) => Record<string, unknown>;
  className?: string;
}

export function TodayTasksList({
  tasks,
  onTaskStatusChange,
  onTaskEdit,
  onTaskDelete,
  onViewTimeHistory,
  getTaskTimerProps,
  className = '',
}: TodayTasksListProps) {
  const { isAllSelected, taskLists } = useTaskList();

  // Filter tasks for today
  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter(task => {
      if (!task.scheduledDate) {
        return false;
      }

      const taskDate = new Date(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);

      return taskDate.getTime() === today.getTime();
    });
  }, [tasks]);

  // Group tasks by status
  const taskGroups = useMemo(() => {
    const groups = {
      pending: todayTasks.filter(t => t.status === TaskStatus.PENDING),
      inProgress: todayTasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      completed: todayTasks.filter(t => t.status === TaskStatus.COMPLETED),
    };

    return groups;
  }, [todayTasks]);

  const totalTasks = todayTasks.length;
  const completedTasks = taskGroups.completed.length;
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (totalTasks === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className='pb-2'>
          <div className='flex items-center gap-2'>
            <Calendar className='w-5 h-5 text-primary' />
            <h3 className='text-lg font-semibold'>Today's Tasks</h3>
          </div>
        </CardHeader>
        <CardBody className='pt-0'>
          <div className='text-center py-8 text-foreground-500'>
            <Calendar className='w-12 h-12 mx-auto mb-3 opacity-50' />
            <p>No tasks scheduled for today</p>
            <p className='text-sm mt-1'>Create a task to get started!</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            <Calendar className='w-5 h-5 text-primary' />
            <h3 className='text-lg font-semibold'>Today's Tasks</h3>
          </div>

          <div className='flex items-center gap-2'>
            <Chip
              size='sm'
              variant='flat'
              color={progressPercentage === 100 ? 'success' : 'primary'}
              startContent={
                progressPercentage === 100 ? (
                  <CheckCircle2 className='w-3 h-3' />
                ) : (
                  <Clock className='w-3 h-3' />
                )
              }
            >
              {completedTasks}/{totalTasks} done ({progressPercentage}%)
            </Chip>
          </div>
        </div>
      </CardHeader>

      <CardBody className='pt-0 space-y-3'>
        {/* In Progress Tasks */}
        {taskGroups.inProgress.length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <AlertTriangle className='w-4 h-4 text-warning' />
              <span className='text-sm font-medium text-warning'>
                In Progress ({taskGroups.inProgress.length})
              </span>
            </div>
            <div className='space-y-2'>
              {taskGroups.inProgress.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onTaskEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  onStartKiraThread={() => {}} // Kira thread functionality
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
                  {...(getTaskTimerProps?.(task as Task) || {})}
                  className='border-l-4 border-l-warning'
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Tasks */}
        {taskGroups.pending.length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <Clock className='w-4 h-4 text-primary' />
              <span className='text-sm font-medium text-primary'>
                To Do ({taskGroups.pending.length})
              </span>
            </div>
            <div className='space-y-2'>
              {taskGroups.pending.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onTaskEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  onStartKiraThread={() => {}} // Kira thread functionality
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
                  {...(getTaskTimerProps?.(task as Task) || {})}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {taskGroups.completed.length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <CheckCircle2 className='w-4 h-4 text-success' />
              <span className='text-sm font-medium text-success'>
                Completed ({taskGroups.completed.length})
              </span>
            </div>
            <div className='space-y-2'>
              {taskGroups.completed.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={updates => onTaskEdit?.(task.id, updates)}
                  onStatusChange={status => onTaskStatusChange(task, status)}
                  onDelete={onTaskDelete}
                  onViewTimeHistory={onViewTimeHistory}
                  onStartKiraThread={() => {}} // Kira thread functionality
                  showTaskListIndicator={isAllSelected()}
                  taskListName={
                    taskLists.find(list => list.id === task.taskListId)?.name
                  }
                  {...(getTaskTimerProps?.(task as Task) || {})}
                  className='opacity-75'
                />
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
