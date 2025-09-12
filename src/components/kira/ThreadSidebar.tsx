import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import {
  Plus,
  MessageSquare,
  Calendar,
  CheckSquare,
  MoreVertical,
  Trash2,
  Edit3,
  Clock,
  Hash,
} from 'lucide-react';
import { Thread, ThreadAssignment } from '../../types/thread';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDistanceToNow } from 'date-fns';
import { ThreadAssignmentModal } from './ThreadAssignmentModal';
import { truncateThreadTitle } from '../../utils/threadTitleUtils';

interface ThreadSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  threads: Thread[];
  activeThreadId: string | null;
  isLoading: boolean;
  onThreadSelect: (threadId: string) => void;
  onThreadCreate: () => void;
  onThreadDelete: (threadId: string) => void;
  onThreadAssign?: (threadId: string, assignment: ThreadAssignment) => void;
  className?: string;
}

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAssign?: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = ({
  thread,
  isActive,
  onSelect,
  onDelete,
  onAssign,
}) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getAssignmentIcon = (assignment?: ThreadAssignment) => {
    if (!assignment) {
      return <Hash className='w-3 h-3' />;
    }

    switch (assignment.type) {
      case 'task':
        return <CheckSquare className='w-3 h-3' />;
      case 'day':
        return <Calendar className='w-3 h-3' />;
      default:
        return <Hash className='w-3 h-3' />;
    }
  };

  const getAssignmentLabel = (assignment?: ThreadAssignment): string => {
    if (!assignment || assignment.type === 'general') {
      return t('kira.thread.general');
    }

    if (assignment.type === 'task') {
      return String(
        assignment.context?.taskTitle || `Task ${assignment.taskId}`
      );
    }

    if (assignment.type === 'day' && assignment.date) {
      return new Date(assignment.date).toLocaleDateString();
    }

    return t('kira.thread.assigned');
  };

  const getAssignmentColor = (assignment?: ThreadAssignment) => {
    if (!assignment || assignment.type === 'general') {
      return 'default';
    }
    if (assignment.type === 'task') {
      return 'primary';
    }
    if (assignment.type === 'day') {
      return 'secondary';
    }
    return 'default';
  };

  const formatLastActivity = (date?: Date) => {
    if (!date) {
      return '';
    }

    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const formatCreationDate = (date: Date) => {
    try {
      const createdDate = new Date(date);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return createdDate.toLocaleDateString();
      }
    } catch {
      return '';
    }
  };

  const formatUpdateDate = (date: Date) => {
    try {
      const updatedDate = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - updatedDate.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return updatedDate.toLocaleDateString();
      }
    } catch {
      return '';
    }
  };

  const getComprehensiveThreadTooltip = (thread: Thread): string => {
    const createdAt = new Date(thread.createdAt).toLocaleString();
    const updatedAt = new Date(thread.updatedAt).toLocaleString();
    const lastActivity = thread.lastMessageAt
      ? new Date(thread.lastMessageAt).toLocaleString()
      : 'No messages yet';

    let tooltip = `Thread: ${thread.title}\n`;
    tooltip += `Created: ${createdAt}\n`;
    tooltip += `Updated: ${updatedAt}\n`;
    tooltip += `Last activity: ${lastActivity}\n`;
    tooltip += `Messages: ${thread.messageCount}\n`;

    if (thread.assignment) {
      tooltip += `\nAssignment:\n${getDetailedAssignmentInfo(thread.assignment)}`;
    } else {
      tooltip += '\nType: General conversation';
    }

    return tooltip;
  };

  const getAssignmentDetails = (assignment: ThreadAssignment): string => {
    if (assignment.type === 'task') {
      return assignment.context?.taskTitle
        ? truncateThreadTitle(String(assignment.context.taskTitle), 15)
        : `Task ${assignment.taskId?.slice(-6) || ''}`;
    }

    if (assignment.type === 'day' && assignment.date) {
      const date = new Date(assignment.date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
    }

    return '';
  };

  const getDetailedAssignmentInfo = (assignment: ThreadAssignment): string => {
    if (assignment.type === 'task') {
      const taskTitle =
        assignment.context?.taskTitle || `Task ${assignment.taskId}`;
      const taskStatus = assignment.context?.taskStatus || 'Unknown status';
      const taskPriority = assignment.context?.taskPriority || 'No priority';
      const taskDescription = assignment.context?.taskDescription;

      let info = `Task: ${taskTitle}\nStatus: ${taskStatus}\nPriority: ${taskPriority}`;
      if (taskDescription && String(taskDescription).length > 0) {
        const truncatedDesc =
          String(taskDescription).length > 100
            ? String(taskDescription).substring(0, 100) + '...'
            : String(taskDescription);
        info += `\nDescription: ${truncatedDesc}`;
      }
      return info;
    }

    if (assignment.type === 'day' && assignment.date) {
      const date = new Date(assignment.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const fullDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const taskCount = Number(assignment.context?.taskCount) || 0;

      let info = `Day Planning: ${dayName}\n${fullDate}`;
      if (taskCount > 0) {
        info += `\nTasks scheduled: ${taskCount}`;
      }
      return info;
    }

    return 'General conversation thread';
  };

  return (
    <Card
      isPressable
      isHoverable
      className={`mb-2 transition-all duration-200 cursor-pointer group ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 shadow-md'
          : 'bg-content1 hover:bg-content2 border-divider'
      }`}
      onPress={onSelect}
    >
      <CardBody className='p-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 min-w-0'>
            {/* Thread title */}
            <div className='flex items-center gap-2 mb-1'>
              <MessageSquare
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-primary-600' : 'text-foreground-500'
                }`}
              />
              <h3
                className={`text-sm font-medium ${
                  isActive
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-foreground'
                }`}
                title={getComprehensiveThreadTooltip(thread)} // Show comprehensive metadata on hover
              >
                {truncateThreadTitle(
                  thread.title || t('kira.thread.untitled'),
                  35
                )}
              </h3>
            </div>

            {/* Assignment chip */}
            <div className='flex items-center gap-2 mb-2'>
              <Chip
                size='sm'
                variant='flat'
                color={getAssignmentColor(thread.assignment)}
                startContent={getAssignmentIcon(thread.assignment)}
                className='text-xs'
                title={
                  thread.assignment
                    ? getDetailedAssignmentInfo(thread.assignment)
                    : getAssignmentLabel(thread.assignment)
                } // Enhanced tooltip with detailed info
              >
                <span className='truncate max-w-[120px]'>
                  {getAssignmentLabel(thread.assignment)}
                </span>
              </Chip>
            </div>

            {/* Metadata */}
            <div className='flex flex-col gap-1 text-xs text-foreground-500'>
              {/* First row: Message count and last activity */}
              <div className='flex items-center justify-between'>
                <span
                  className='flex items-center gap-1'
                  title={t('kira.thread.messageCount', {
                    count: thread.messageCount,
                  })}
                >
                  <MessageSquare className='w-3 h-3' />
                  {thread.messageCount}
                </span>
                {thread.lastMessageAt && (
                  <span
                    className='flex items-center gap-1'
                    title={`Last activity: ${new Date(thread.lastMessageAt).toLocaleString()}`}
                  >
                    <Clock className='w-3 h-3' />
                    {formatLastActivity(thread.lastMessageAt)}
                  </span>
                )}
              </div>

              {/* Second row: Creation date and update info */}
              <div className='flex items-center justify-between'>
                <span
                  className='flex items-center gap-1 text-foreground-400'
                  title={`Created: ${new Date(thread.createdAt).toLocaleString()}`}
                >
                  <Calendar className='w-3 h-3' />
                  {formatCreationDate(thread.createdAt)}
                </span>

                {/* Show updated time if different from creation time */}
                {thread.updatedAt &&
                  new Date(thread.updatedAt).getTime() !==
                    new Date(thread.createdAt).getTime() && (
                    <span
                      className='flex items-center gap-1 text-foreground-400'
                      title={`Last updated: ${new Date(thread.updatedAt).toLocaleString()}`}
                    >
                      <Clock className='w-3 h-3' />
                      {formatUpdateDate(thread.updatedAt)}
                    </span>
                  )}
              </div>

              {/* Third row: Assignment details */}
              {thread.assignment && (
                <div className='flex items-center justify-between'>
                  <span
                    className='text-foreground-400 truncate max-w-[150px]'
                    title={getDetailedAssignmentInfo(thread.assignment)}
                  >
                    {getAssignmentDetails(thread.assignment)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions menu */}
          <Dropdown
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            placement='bottom-end'
          >
            <DropdownTrigger>
              <Button
                isIconOnly
                size='sm'
                variant='light'
                className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                  isMenuOpen ? 'opacity-100' : ''
                }`}
                aria-label={t('kira.thread.actions')}
                onPress={() => {
                  // Button press handled by dropdown trigger
                }}
              >
                <MoreVertical className='w-4 h-4' />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={t('kira.thread.actions')}
              onAction={key => {
                setIsMenuOpen(false);
                // Add small delay to allow dropdown to close smoothly
                setTimeout(() => {
                  if (key === 'assign' && onAssign) {
                    onAssign();
                  } else if (key === 'delete') {
                    onDelete();
                  }
                }, 100);
              }}
            >
              {onAssign ? (
                <DropdownItem
                  key='assign'
                  startContent={<Edit3 className='w-4 h-4' />}
                >
                  {t('kira.thread.assign')}
                </DropdownItem>
              ) : null}
              <DropdownItem
                key='delete'
                className='text-danger'
                color='danger'
                startContent={<Trash2 className='w-4 h-4' />}
              >
                {t('kira.thread.delete')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </CardBody>
    </Card>
  );
};

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  threads,
  activeThreadId,
  isLoading,
  onThreadSelect,
  onThreadCreate,
  onThreadDelete,
  onThreadAssign,
  className = '',
  ...htmlProps
}) => {
  const { t } = useTranslation();
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();
  const {
    isOpen: isAssignModalOpen,
    onOpen: onAssignModalOpen,
    onClose: onAssignModalClose,
  } = useDisclosure();
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null);
  const [threadToAssign, setThreadToAssign] = useState<Thread | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sidebarRef.current?.contains(document.activeElement)) {
        return;
      }

      const currentIndex = threads.findIndex(t => t.id === activeThreadId);

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            onThreadSelect(threads[currentIndex - 1].id);
          } else if (threads.length > 1) {
            // Wrap to last thread
            onThreadSelect(threads[threads.length - 1].id);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < threads.length - 1) {
            onThreadSelect(threads[currentIndex + 1].id);
          } else if (threads.length > 1) {
            // Wrap to first thread
            onThreadSelect(threads[0].id);
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (activeThreadId) {
            const activeThread = threads.find(t => t.id === activeThreadId);
            if (activeThread) {
              handleDeleteClick(activeThread);
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (activeThreadId && onThreadAssign) {
            const activeThread = threads.find(t => t.id === activeThreadId);
            if (activeThread) {
              handleAssignClick(activeThread);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [threads, activeThreadId, onThreadSelect, onThreadAssign]);

  const handleDeleteClick = (thread: Thread) => {
    setThreadToDelete(thread);
    onDeleteModalOpen();
  };

  const handleDeleteConfirm = () => {
    if (threadToDelete) {
      onThreadDelete(threadToDelete.id);
      setThreadToDelete(null);
      onDeleteModalClose();
    }
  };

  const handleDeleteCancel = () => {
    setThreadToDelete(null);
    onDeleteModalClose();
  };

  const handleAssignClick = (thread: Thread) => {
    setThreadToAssign(thread);
    onAssignModalOpen();
  };

  const handleAssignConfirm = async (assignment: ThreadAssignment) => {
    if (threadToAssign && onThreadAssign) {
      try {
        await onThreadAssign(threadToAssign.id, assignment);
        setThreadToAssign(null);
        onAssignModalClose();
      } catch (error) {
        console.error('Failed to assign thread:', error);
        // Keep modal open on error so user can retry
      }
    }
  };

  const handleAssignCancel = () => {
    setThreadToAssign(null);
    onAssignModalClose();
  };

  return (
    <>
      <div
        ref={sidebarRef}
        className={`flex flex-col h-full bg-content1 border-r border-divider ${className}`}
        tabIndex={0}
        aria-label={t('kira.sidebar.title')}
        title={t('kira.shortcuts.sidebar')}
        {...htmlProps}
      >
        {/* Header */}
        <div className='p-4 border-b border-divider bg-content2'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='text-lg font-semibold text-foreground'>
              {t('kira.sidebar.title')}
            </h2>
            <Button
              size='sm'
              color='primary'
              startContent={
                !isLoading ? <Plus className='w-4 h-4' /> : undefined
              }
              onPress={onThreadCreate}
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? t('common.creating') : t('kira.sidebar.newThread')}
            </Button>
          </div>

          {/* Thread count */}
          <div className='text-sm text-foreground-600'>
            {threads.length === 0
              ? t('kira.sidebar.noThreads')
              : t('kira.sidebar.threadCount', { count: threads.length })}
          </div>
        </div>

        {/* Thread list */}
        <div className='flex-1 overflow-y-auto min-h-0 p-4'>
          {isLoading && threads.length === 0 ? (
            <div className='space-y-2'>
              {[...Array(3)].map((_, i) => (
                <Card key={i} className='animate-pulse'>
                  <CardBody className='p-3'>
                    <div className='h-4 bg-content3 rounded mb-2'></div>
                    <div className='h-3 bg-content3 rounded w-2/3 mb-2'></div>
                    <div className='h-3 bg-content3 rounded w-1/2'></div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className='text-center py-8'>
              <MessageSquare className='w-12 h-12 mx-auto mb-4 text-foreground-400' />
              <h3 className='text-lg font-medium text-foreground mb-2'>
                {t('kira.sidebar.empty.title')}
              </h3>
              <p className='text-foreground-600 mb-4 max-w-sm mx-auto'>
                {t('kira.sidebar.empty.description')}
              </p>
              <Button
                color='primary'
                startContent={<Plus className='w-4 h-4' />}
                onPress={onThreadCreate}
              >
                {t('kira.sidebar.empty.createFirst')}
              </Button>
            </div>
          ) : (
            <AnimatePresence>
              <div className='space-y-1'>
                {threads.map(thread => (
                  <motion.div
                    key={thread.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ThreadItem
                      thread={thread}
                      isActive={thread.id === activeThreadId}
                      onSelect={() => onThreadSelect(thread.id)}
                      onDelete={() => handleDeleteClick(thread)}
                      onAssign={
                        onThreadAssign
                          ? () => handleAssignClick(thread)
                          : undefined
                      }
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={handleDeleteCancel} size='sm'>
        <ModalContent>
          <ModalHeader className='flex flex-col gap-1'>
            {t('kira.thread.deleteModal.title')}
          </ModalHeader>
          <ModalBody>
            <p className='text-foreground-600'>
              {t('kira.thread.deleteModal.message', {
                title: threadToDelete?.title || t('kira.thread.untitled'),
              })}
            </p>
            <p className='text-sm text-foreground-500'>
              {t('kira.thread.deleteModal.warning')}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={handleDeleteCancel}>
              {t('common.cancel')}
            </Button>
            <Button color='danger' onPress={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Thread assignment modal */}
      <ThreadAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={handleAssignCancel}
        onAssign={handleAssignConfirm}
        currentAssignment={threadToAssign?.assignment}
        threadTitle={threadToAssign?.title}
      />
    </>
  );
};
