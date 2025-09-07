import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Trash2,
  Coffee,
  Play,
  TrendingUp,
  Filter,
  Download,
} from 'lucide-react';
import { TimerSession, SessionStatistics } from '../../types';
import { TimeTrackingService } from '../../services/database/repositories/TimeTrackingService';
import { useDatabaseOperation } from '../../hooks/useDatabase';
import {
  Button,
  Select,
  SelectItem,
  Chip,
  Card,
  CardBody,
  Input,
} from '@heroui/react';

interface SessionHistoryViewProps {
  taskId?: string;
  limit?: number;
  showTaskInfo?: boolean;
}

export const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  taskId,
  limit = 50,
  showTaskInfo = true,
}) => {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<
    'today' | 'week' | 'month' | 'all'
  >('all');
  const [statistics, setStatistics] = useState<SessionStatistics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { execute, isLoading, error } = useDatabaseOperation();
  const timeTrackingRepo = new TimeTrackingService();

  // Load sessions and statistics
  useEffect(() => {
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

      // Filter by search query if provided
      if (searchQuery.trim()) {
        sessionsData = sessionsData.filter(session =>
          session.notes.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Limit results
      const limitedSessions = sessionsData.slice(0, limit);
      setSessions(limitedSessions);

      // Load statistics for the same period as sessions
      if (!taskId) {
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

        try {
          const stats = await timeTrackingRepo.getStatistics(
            startDate,
            endDate
          );

          setStatistics(stats);
        } catch (error) {
          console.error('Failed to load statistics:', error);
          // Set default statistics on error
          setStatistics({
            totalSessions: 0,
            totalTime: 0,
            totalWorkTime: 0,
            totalBreakTime: 0,
            averageSessionLength: 0,
            averageProductivity: 0,
            mostProductiveHour: 9,
            sessionsPerDay: {},
          });
        }
      }
    };

    execute(loadData);
  }, [taskId, selectedPeriod, limit, showTaskInfo, searchQuery, execute]);

  const handleDeleteSession = async (sessionId: string) => {
    await execute(async () => {
      await timeTrackingRepo.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    });
  };

  const formatDuration = (milliseconds: number): string => {
    if (!milliseconds || isNaN(milliseconds) || milliseconds < 0) {
      return '0m';
    }

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

    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getSessionDuration = (session: TimerSession): number => {
    if (!session.endTime) {
      return 0;
    }
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
    if (totalDuration === 0) {
      return 0;
    }

    const workTime = totalDuration - session.pausedTime;
    return Math.round((workTime / totalDuration) * 100);
  };

  const exportSessions = () => {
    const csvContent = [
      [
        'Date',
        'Start Time',
        'End Time',
        'Duration',
        'Breaks',
        'Productivity',
        'Notes',
      ].join(','),
      ...sessions.map(session => {
        const startTime =
          typeof session.startTime === 'string'
            ? new Date(session.startTime)
            : session.startTime;
        const endTime = session.endTime
          ? typeof session.endTime === 'string'
            ? new Date(session.endTime)
            : session.endTime
          : null;

        return [
          startTime.toLocaleDateString(),
          formatTime(startTime),
          endTime ? formatTime(endTime) : 'Active',
          formatDuration(getSessionDuration(session)),
          session.breaks.length.toString(),
          `${getProductivityScore(session)}%`,
          `"${session.notes.replace(/"/g, '""')}"`, // Escape quotes in CSV
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='space-y-6'>
      {/* Controls Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2 text-foreground-600'>
            <Clock className='w-5 h-5' />
            <span className='text-sm font-medium'>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <Button
            startContent={<Download className='w-4 h-4' />}
            variant='bordered'
            size='sm'
            onPress={exportSessions}
            isDisabled={sessions.length === 0}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className='flex flex-col sm:flex-row gap-4'>
        {!taskId && (
          <Select
            selectedKeys={[selectedPeriod]}
            onSelectionChange={keys =>
              setSelectedPeriod(
                Array.from(keys)[0] as 'today' | 'week' | 'month' | 'all'
              )
            }
            size='sm'
            className='w-full sm:w-40'
            variant='bordered'
            startContent={<Filter className='w-4 h-4' />}
            label='Time Period'
          >
            <SelectItem key='today'>Today</SelectItem>
            <SelectItem key='week'>This Week</SelectItem>
            <SelectItem key='month'>This Month</SelectItem>
            <SelectItem key='all'>All Time</SelectItem>
          </Select>
        )}

        <Input
          placeholder='Search session notes...'
          value={searchQuery}
          onValueChange={setSearchQuery}
          size='sm'
          className='w-full sm:w-80'
          variant='bordered'
        />
      </div>

      {/* Statistics Cards */}
      {statistics && !taskId && (
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          <Card>
            <CardBody className='text-center p-4'>
              <div className='text-2xl font-bold text-primary mb-1'>
                {statistics.totalSessions}
              </div>
              <div className='text-sm text-default-500'>Sessions</div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className='text-center p-4'>
              <div className='text-2xl font-bold text-success mb-1'>
                {formatDuration(statistics.totalWorkTime)}
              </div>
              <div className='text-sm text-default-500'>Work Time</div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className='text-center p-4'>
              <div className='text-2xl font-bold text-warning mb-1'>
                {isNaN(statistics.averageProductivity)
                  ? '0'
                  : Math.round(statistics.averageProductivity)}
                %
              </div>
              <div className='text-sm text-default-500'>Avg Productivity</div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className='text-center p-4'>
              <div className='text-2xl font-bold text-secondary mb-1'>
                {statistics.mostProductiveHour}:00
              </div>
              <div className='text-sm text-default-500'>Peak Hour</div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Sessions List */}
      <Card>
        <CardBody className='p-0'>
          {isLoading ? (
            <div className='text-center py-12'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
              <p className='text-default-500'>Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className='text-center py-12'>
              <Clock className='w-12 h-12 text-default-300 mx-auto mb-4' />
              <p className='text-default-500 text-lg mb-2'>
                No timer sessions found
              </p>
              <p className='text-sm text-default-400'>
                {searchQuery.trim()
                  ? 'Try adjusting your search or time period filter'
                  : 'Start a timer to track your work sessions'}
              </p>
            </div>
          ) : (
            <div className='divide-y divide-default-200'>
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
                    className='group p-4 hover:bg-default-50 transition-colors'
                  >
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-4 min-w-0 flex-1'>
                        <div className='flex items-center gap-2 text-sm text-default-500'>
                          <Calendar className='w-4 h-4' />
                          <span className='font-medium'>
                            {formatDate(startTime)}
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-sm text-default-600'>
                          <span>{formatTime(startTime)}</span>
                          {endTime && (
                            <>
                              <span>→</span>
                              <span>{formatTime(endTime)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className='flex items-center gap-3'>
                        {productivity > 0 && endTime && (
                          <Chip
                            size='sm'
                            variant='flat'
                            color={
                              productivity >= 80
                                ? 'success'
                                : productivity >= 60
                                  ? 'warning'
                                  : 'danger'
                            }
                            startContent={<TrendingUp className='w-3 h-3' />}
                          >
                            {productivity}%
                          </Chip>
                        )}

                        {session.breaks.length > 0 && (
                          <Chip
                            size='sm'
                            variant='flat'
                            color='default'
                            startContent={<Coffee className='w-3 h-3' />}
                          >
                            {session.breaks.length} break
                            {session.breaks.length !== 1 ? 's' : ''}
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
                          className='opacity-0 group-hover:opacity-100 transition-opacity'
                        >
                          <Trash2 className='w-4 h-4' />
                        </Button>
                      </div>
                    </div>

                    {session.notes && (
                      <div className='text-sm text-default-700 mb-3 pl-6'>
                        {session.notes}
                      </div>
                    )}

                    {session.breaks.length > 0 && (
                      <details className='text-sm text-default-500 pl-6'>
                        <summary className='cursor-pointer hover:text-default-700 select-none mb-2'>
                          View {session.breaks.length} break
                          {session.breaks.length !== 1 ? 's' : ''} (
                          {formatDuration(session.pausedTime)})
                        </summary>
                        <div className='space-y-2 pl-4 border-l-2 border-default-200'>
                          {session.breaks.map((breakItem, index) => {
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
                                key={breakItem.id || index}
                                className='flex items-center justify-between text-xs'
                              >
                                <span className='text-default-600'>
                                  {breakItem.reason || 'Break'}
                                </span>
                                <span className='text-default-500'>
                                  {formatDuration(duration)}
                                </span>
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
            <div className='text-center py-8'>
              <p className='text-danger'>{error}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default SessionHistoryView;
