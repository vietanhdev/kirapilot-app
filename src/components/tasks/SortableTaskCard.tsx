// Sortable wrapper for TaskCard component
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';

interface SortableTaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  onStartTimer?: (task: Task) => void;
  className?: string;
  showActions?: boolean;
  viewMode?: 'list' | 'grid' | 'compact';
  allTasks?: Task[];
  isActive?: boolean;
  currentTime?: string;
}

export function SortableTaskCard(props: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        ${isDragging ? 'z-50' : ''}
        ${props.className || ''}
      `}
    >
      <TaskCard
        {...props}
        className={`
          ${isDragging ? 'shadow-lg ring-2 ring-primary-500/50' : ''}
          cursor-grab active:cursor-grabbing
        `}
      />
    </div>
  );
}