import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Trash2,
  Coffee,
  Play,
  TrendingUp,
} from 'lucide-react';
import { TimerSession } from '../../types';
import { TimeTrackingRepository } from '../../services/database/repositories/TimeTrackingRepository';
import { useDatabaseOperation } from '../../hooks/useDatabase';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Select,
  SelectItem,
  Chip,
  Divider,
} from '@heroui/react';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  limit?: number;
  showTaskInfo?: boolean;
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  isOpen,
  onClose,
  taskId,
  limit = 20,
  showTaskInfo = true,
}) => {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  // const [_tasks, _setTasks] = useState<Record<string, Task>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<
    'today' | 'week' | 'month' | 'all'
  >('all');
  const [statistics, setStatistics] = useState<any>(null);

  const { execute, isLoading, error } = useDatabaseOperation();
  const timeTrackingRepo = new TimeTrackingRepository();

  // Load sessions and statistics
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      let sessionsData: TimerSession[] = [];

      if (taskId) {
        sessionsData = await timeTrackingRepo.getByTask(taskId);
      } else {
        const endDate = new Date();
        let startDate = new Date();

        switch (selectedPeriod) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'all':
            startDate = new Date(0); // Beginning of time
            break;
        }

        sessionsData = await timeTrackingRepo.getByDateRange(
          startDate,
          endDate
        );
      }

      // Limit results
      const limitedSessions = sessionsData.slice(0, limit);
      setSessions(limitedSessions);

      // Load statistics
      if (!taskId) {
        const stats = await timeTrackingRepo.getStatistics();
        setStatistics(stats);
      }

      // Load task information if needed
      if (showTaskInfo && limitedSessions.length > 0) {
        // This would need to be implemented with TaskRepository
        // For now, we'll skip loading task details
      }
    };

    execute(loadData);
  }, [isOpen, taskId, selectedPeriod, limit, showTaskInfo, execute]);

  const handleDeleteSession = async (sessionId: string) => {
    await execute(async () => {
      await timeTrackingRepo.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    });
  };

  const formatDuration = (milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getSessionDuration = (session: TimerSession): number => {
    if (!session.endTime) return 0;
    const startTime =
      typeof session.startTime === 'string'
        ? new Date(session.startTime)
        : session.startTime;
    const endTime =
      typeof session.endTime === 'string'
        ? new Date(session.endTime)
        : session.endTime;
    return endTime.getTime() - startTime.getTime() - session.pausedTime;
  };

  const getProductivityScore = (session: TimerSession): number => {
    const startTime =
      typeof session.startTime === 'string'
        ? new Date(session.startTime)
        : session.startTime;
    const endTime = session.endTime
      ? typeof session.endTime === 'string'
        ? new Date(session.endTime)
        : session.endTime
      : null;
    const totalDuration = endTime ? endTime.getTime() - startTime.getTime() : 0;
    if (totalDuration === 0) return 0;

    const workTime = totalDuration - session.pausedTime;
    return Math.round((workTime / totalDuration) * 100);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='xl'
      scrollBehavior='inside'
      backdrop='blur'
    >
      <ModalContent>
        <ModalHeader className='pb-2'>
          <div className='flex items-center justify-between w-full'>
            <div className='flex items-center gap-2'>
              <Clock className='w-4 h-4 text-primary' />
              <span className='font-semibold'>
                {taskId ? 'Task Sessions' : 'Session History'}
              </span>
            </div>

            {!taskId && (
              <Select
                selectedKeys={[selectedPeriod]}
                onSelectionChange={keys =>
                  setSelectedPeriod(Array.from(keys)[0] as any)
                }
                size='sm'
                className='w-24'
                variant='bordered'
              >
                <SelectItem key='today'>Today</SelectItem>
                <SelectItem key='week'>Week</SelectItem>
                <SelectItem key='month'>Month</SelectItem>
                <SelectItem key='all'>All</SelectItem>
              </Select>
            )}
          </div>
        </ModalHeader>

        <ModalBody className='gap-4 py-0 pb-6'>
          {/* Compact Statistics */}
          {statistics && !taskId && (
            <>
              <div className='flex items-center justify-between px-1'>
                <div className='flex items-center gap-6'>
                  <div className='text-center'>
                    <div className='text-lg font-bold text-primary'>
                      {statistics.totalSessions}
                    </div>
                    <div className='text-xs text-default-400'>Sessions</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-lg font-bold text-success'>
                      {formatDuration(statistics.totalWorkTime)}
                    </div>
                    <div className='text-xs text-default-400'>Work Time</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-lg font-bold text-warning'>
                      {Math.round(statistics.averageProductivity)}%
                    </div>
                    <div className='text-xs text-default-400'>Productivity</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-lg font-bold text-secondary'>
                      {statistics.mostProductiveHour}:00
                    </div>
                    <div className='text-xs text-default-400'>Peak Hour</div>
                  </div>
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* Sessions List */}
          {isLoading ? (
            <div className='text-center py-8'>
              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto'></div>
              <p className='text-default-400 mt-2 text-sm'>
                Loading sessions...
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className='text-center py-8'>
              <Clock className='w-8 h-8 text-default-300 mx-auto mb-2' />
              <p className='text-default-400 text-sm'>
                No timer sessions found
              </p>
              <p className='text-xs text-default-300 mt-1'>
                Start a timer to track your work sessions
              </p>
            </div>
          ) : (
            <div className='space-y-1'>
              {sessions.map(session => {
                const startTime =
                  typeof session.startTime === 'string'
                    ? new Date(session.startTime)
                    : session.startTime;
                const endTime = session.endTime
                  ? typeof session.endTime === 'string'
                    ? new Date(session.endTime)
                    : session.endTime
                  : null;
                const productivity = getProductivityScore(session);

                return (
                  <div
                    key={session.id}
                    className='group p-3 rounded-lg hover:bg-default-50 border border-transparent hover:border-default-200 transition-all'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3 min-w-0 flex-1'>
                        <div className='flex items-center gap-2 text-xs text-default-400'>
                          <Calendar className='w-3 h-3' />
                          <span>{formatDate(startTime)}</span>
                        </div>

                        <div className='flex items-center gap-1 text-xs text-default-500'>
                          <span>{formatTime(startTime)}</span>
                          {endTime && (
                            <>
                              <span>→</span>
                              <span>{formatTime(endTime)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className='flex items-center gap-2'>
                        {productivity > 0 && endTime && (
                          <Chip
                            size='sm'
                            variant='flat'
                            startContent={<TrendingUp className='w-3 h-3' />}
                            className='text-xs'
                          >
                            {productivity}%
                          </Chip>
                        )}

                        {session.breaks.length > 0 && (
                          <Chip
                            size='sm'
                            variant='flat'
                            startContent={<Coffee className='w-3 h-3' />}
                            className='text-xs'
                          >
                            {session.breaks.length}
                          </Chip>
                        )}

                        {endTime ? (
                          <Chip
                            size='sm'
                            color='success'
                            variant='flat'
                            className='font-medium'
                          >
                            {formatDuration(getSessionDuration(session))}
                          </Chip>
                        ) : (
                          <Chip
                            size='sm'
                            color='warning'
                            variant='flat'
                            startContent={<Play className='w-3 h-3' />}
                          >
                            Active
                          </Chip>
                        )}

                        <Button
                          isIconOnly
                          size='sm'
                          variant='light'
                          color='danger'
                          onPress={() => handleDeleteSession(session.id)}
                          className='opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 min-w-6'
                        >
                          <Trash2 className='w-3 h-3' />
                        </Button>
                      </div>
                    </div>

                    {session.notes && (
                      <div className='mt-2 text-xs text-default-600 pl-5'>
                        {session.notes}
                      </div>
                    )}

                    {session.breaks.length > 0 && (
                      <details className='mt-2 text-xs text-default-400 pl-5'>
                        <summary className='cursor-pointer hover:text-default-600 select-none'>
                          View {session.breaks.length} break
                          {session.breaks.length !== 1 ? 's' : ''} (
                          {formatDuration(session.pausedTime)})
                        </summary>
                        <div className='mt-1 space-y-1 pl-3 border-l border-default-200'>
                          {session.breaks.map((breakItem, _index) => {
                            const breakStart =
                              typeof breakItem.startTime === 'string'
                                ? new Date(breakItem.startTime)
                                : breakItem.startTime;
                            const breakEnd =
                              typeof breakItem.endTime === 'string'
                                ? new Date(breakItem.endTime)
                                : breakItem.endTime;
                            const duration =
                              breakEnd && breakStart
                                ? breakEnd.getTime() - breakStart.getTime()
                                : 0;

                            return (
                              <div
                                key={breakItem.id}
                                className='text-xs text-default-500'
                              >
                                {breakItem.reason} - {formatDuration(duration)}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className='text-center py-4'>
              <p className='text-danger text-sm'>{error}</p>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// Keep the original SessionHistory component for backward compatibility
interface SessionHistoryProps {
  taskId?: string;
  limit?: number;
  showTaskInfo?: boolean;
  className?: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = _props => {
  // This is now just a wrapper that maintains the old interface
  // but you should migrate to using SessionHistoryModal directly
  return <div>Use SessionHistoryModal instead</div>;
};

export default SessionHistoryModal;
