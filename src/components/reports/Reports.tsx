import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieLabelRenderProps,
} from 'recharts';
import {
  Clock,
  TrendingUp,
  Target,
  Calendar,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Timer,
  Zap,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@heroui/react';
import { useDatabase } from '../../hooks/useDatabase';
import { useTranslation } from '../../hooks/useTranslation';
import { TimerSession, Task } from '../../types';
import { TimeTrackingRepository } from '../../services/database/repositories/TimeTrackingRepository';
import { TaskRepository } from '../../services/database/repositories/TaskRepository';

interface TimeStats {
  totalHours: number;
  workingHours: number;
  breakHours: number;
  sessionsCount: number;
  tasksWorkedOn: number;
  averageFocusTime: number;
  productivityScore: number;
}

interface DailyData {
  date: string;
  hours: number;
  sessions: number;
  productivity: number;
  tasks: number;
}

interface HourlyData {
  hour: number;
  sessions: number;
  productivity: number;
  totalTime: number;
}

interface TaskTimeData {
  taskTitle: string;
  totalTime: number;
  sessions: number;
  productivity: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export function Reports() {
  const { database } = useDatabase();
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>(
    'week'
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [taskTimeData, setTaskTimeData] = useState<TaskTimeData[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, database]);

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
    }

    return { startDate, endDate };
  };

  const loadAnalyticsData = async () => {
    if (!database) {
      return;
    }

    const timeTrackingRepository = new TimeTrackingRepository();
    const taskRepository = new TaskRepository();

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Load time summary
      const timeSummary = await timeTrackingRepository.getTimeSummary(
        startDate,
        endDate
      );
      setStats(timeSummary);

      // Load sessions for detailed analysis
      const sessions = await timeTrackingRepository.getByDateRange(
        startDate,
        endDate
      );
      const completedSessions = sessions.filter((s: TimerSession) => s.endTime);

      // Load tasks for session analysis
      const taskIds = [
        ...new Set(completedSessions.map((s: TimerSession) => s.taskId)),
      ];
      const tasks = await Promise.all(
        taskIds.map(id => taskRepository.findById(id))
      );
      const taskMap = new Map(
        tasks
          .filter((task): task is Task => task !== null)
          .map((task: Task) => [task.id, task])
      );

      // Process daily data
      const dailyMap = new Map<
        string,
        {
          hours: number;
          sessions: number;
          productivity: number;
          tasks: Set<string>;
        }
      >();

      completedSessions.forEach((session: TimerSession) => {
        if (!session.endTime) {
          return;
        }

        const date = session.startTime.toISOString().split('T')[0];
        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        const workTime = duration - session.pausedTime;
        const productivity = duration > 0 ? (workTime / duration) * 100 : 0;

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            hours: 0,
            sessions: 0,
            productivity: 0,
            tasks: new Set(),
          });
        }

        const dayData = dailyMap.get(date)!;
        dayData.hours += duration / (1000 * 60 * 60);
        dayData.sessions += 1;
        dayData.productivity =
          (dayData.productivity * (dayData.sessions - 1) + productivity) /
          dayData.sessions;
        dayData.tasks.add(session.taskId);
      });

      const dailyDataArray: DailyData[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          hours: Math.round(data.hours * 10) / 10,
          sessions: data.sessions,
          productivity: Math.round(data.productivity),
          tasks: data.tasks.size,
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      setDailyData(dailyDataArray);

      // Process hourly data
      const hourlyMap = new Map<
        number,
        {
          sessions: number;
          totalTime: number;
          productivity: number;
        }
      >();

      completedSessions.forEach((session: TimerSession) => {
        if (!session.endTime) {
          return;
        }

        const hour = session.startTime.getHours();
        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        const workTime = duration - session.pausedTime;
        const productivity = duration > 0 ? (workTime / duration) * 100 : 0;

        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, {
            sessions: 0,
            totalTime: 0,
            productivity: 0,
          });
        }

        const hourData = hourlyMap.get(hour)!;
        hourData.sessions += 1;
        hourData.totalTime += duration / (1000 * 60 * 60);
        hourData.productivity =
          (hourData.productivity * (hourData.sessions - 1) + productivity) /
          hourData.sessions;
      });

      const hourlyDataArray: HourlyData[] = Array.from(
        { length: 24 },
        (_, i) => {
          const data = hourlyMap.get(i) || {
            sessions: 0,
            totalTime: 0,
            productivity: 0,
          };
          return {
            hour: i,
            sessions: data.sessions,
            productivity: Math.round(data.productivity),
            totalTime: Math.round(data.totalTime * 10) / 10,
          };
        }
      );

      setHourlyData(hourlyDataArray);

      // Process task time data
      const taskTimeMap = new Map<
        string,
        {
          totalTime: number;
          sessions: number;
          productivity: number;
        }
      >();

      completedSessions.forEach((session: TimerSession) => {
        if (!session.endTime) {
          return;
        }

        const duration =
          session.endTime.getTime() - session.startTime.getTime();
        const workTime = duration - session.pausedTime;
        const productivity = duration > 0 ? (workTime / duration) * 100 : 0;

        if (!taskTimeMap.has(session.taskId)) {
          taskTimeMap.set(session.taskId, {
            totalTime: 0,
            sessions: 0,
            productivity: 0,
          });
        }

        const taskData = taskTimeMap.get(session.taskId)!;
        taskData.totalTime += duration / (1000 * 60 * 60);
        taskData.sessions += 1;
        taskData.productivity =
          (taskData.productivity * (taskData.sessions - 1) + productivity) /
          taskData.sessions;
      });

      const taskTimeArray: TaskTimeData[] = Array.from(taskTimeMap.entries())
        .map(([taskId, data]) => ({
          taskTitle: taskMap.get(taskId)?.title || `Task ${taskId.slice(0, 8)}`,
          totalTime: Math.round(data.totalTime * 10) / 10,
          sessions: data.sessions,
          productivity: Math.round(data.productivity),
        }))
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10); // Top 10 tasks

      setTaskTimeData(taskTimeArray);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-full'>
        <div className='text-center'>
          <Activity className='w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin' />
          <p className='text-foreground-600'>{t('reports.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 min-h-full'>
      {/* Header */}
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-foreground mb-2'>
            {t('reports.title')}
          </h1>
          <p className='text-foreground-600'>{t('reports.subtitle')}</p>
        </div>

        <div className='flex gap-2'>
          {(['week', 'month', 'quarter'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                timeRange === range
                  ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/25'
                  : 'bg-content2 text-foreground-600 hover:bg-content3 hover:text-foreground border-divider hover:border-primary-500/30'
              }`}
            >
              {t(`reports.${range}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card className='bg-content1 border-divider'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground-600 text-sm'>
                    {t('reports.totalTime')}
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {formatTime(stats.totalHours)}
                  </p>
                </div>
                <Clock className='w-8 h-8 text-blue-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-content1 border-divider'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground-600 text-sm'>
                    {t('reports.focusTime')}
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {formatTime(stats.workingHours)}
                  </p>
                </div>
                <Target className='w-8 h-8 text-green-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-content1 border-divider'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground-600 text-sm'>
                    {t('reports.sessions')}
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {stats.sessionsCount}
                  </p>
                </div>
                <Timer className='w-8 h-8 text-purple-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-content1 border-divider'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground-600 text-sm'>
                    {t('reports.productivity')}
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {Math.round(stats.productivityScore)}%
                  </p>
                </div>
                <Zap className='w-8 h-8 text-yellow-500' />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Daily Time Tracking */}
        <Card className='bg-content1 border-divider'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <BarChart3 className='w-5 h-5 text-blue-500' />
              <h3 className='text-lg font-semibold text-foreground'>
                {t('reports.dailyActivity')}
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <ResponsiveContainer width='100%' height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                <XAxis dataKey='date' stroke='#9CA3AF' fontSize={12} />
                <YAxis stroke='#9CA3AF' fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                  }}
                />
                <Area
                  type='monotone'
                  dataKey='hours'
                  stroke='#3B82F6'
                  fill='#3B82F6'
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Hourly Productivity */}
        <Card className='bg-content1 border-divider'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <TrendingUp className='w-5 h-5 text-green-500' />
              <h3 className='text-lg font-semibold text-foreground'>
                Hourly Patterns
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <ResponsiveContainer width='100%' height={300}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                <XAxis
                  dataKey='hour'
                  stroke='#9CA3AF'
                  fontSize={12}
                  tickFormatter={value => `${value}:00`}
                />
                <YAxis stroke='#9CA3AF' fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                  }}
                  labelFormatter={value => `${value}:00`}
                  formatter={(value: number) => [`${value}%`, 'Productivity']}
                />
                <Line
                  type='monotone'
                  dataKey='productivity'
                  stroke='#10B981'
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Task Performance Dashboard - Replaced pie chart */}
        <Card className='bg-content1 border-divider'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Target className='w-5 h-5 text-purple-500' />
              <h3 className='text-lg font-semibold text-foreground'>
                Task Performance
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            {taskTimeData.length === 0 ? (
              <div className='text-center py-12'>
                <Activity className='w-12 h-12 text-foreground-400 mx-auto mb-3' />
                <p className='text-foreground-600 mb-2'>
                  No task data available
                </p>
                <p className='text-sm text-foreground-500'>
                  Start working on tasks to see performance insights
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {/* Performance Summary */}
                <div className='grid grid-cols-3 gap-4 p-4 bg-content2 rounded-lg'>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-purple-500'>
                      {taskTimeData.length}
                    </div>
                    <div className='text-xs text-foreground-600'>
                      Active Tasks
                    </div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-green-500'>
                      {Math.round(
                        taskTimeData.reduce(
                          (sum, task) => sum + task.productivity,
                          0
                        ) / taskTimeData.length
                      )}
                      %
                    </div>
                    <div className='text-xs text-foreground-600'>Avg Focus</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-blue-500'>
                      {formatTime(
                        taskTimeData.reduce(
                          (sum, task) => sum + task.totalTime,
                          0
                        )
                      )}
                    </div>
                    <div className='text-xs text-foreground-600'>
                      Total Time
                    </div>
                  </div>
                </div>

                {/* Top Performing Tasks List */}
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium text-foreground mb-3'>
                    Top Performing Tasks
                  </h4>
                  {taskTimeData.slice(0, 5).map((task, index) => {
                    const maxTime = Math.max(
                      ...taskTimeData.map(t => t.totalTime)
                    );
                    const timePercentage =
                      maxTime > 0 ? (task.totalTime / maxTime) * 100 : 0;

                    return (
                      <div key={task.taskTitle} className='group'>
                        <div className='flex items-center justify-between mb-1'>
                          <div className='flex items-center gap-2 flex-1 min-w-0'>
                            <div
                              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                index === 0
                                  ? 'bg-yellow-500'
                                  : index === 1
                                    ? 'bg-gray-400'
                                    : index === 2
                                      ? 'bg-orange-600'
                                      : 'bg-purple-400'
                              }`}
                            />
                            <span className='text-sm text-foreground truncate font-medium'>
                              {task.taskTitle}
                            </span>
                          </div>
                          <div className='flex items-center gap-3 flex-shrink-0'>
                            <span className='text-xs text-foreground-600'>
                              {formatTime(task.totalTime)}
                            </span>
                            <div
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.productivity >= 80
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : task.productivity >= 60
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {task.productivity}%
                            </div>
                          </div>
                        </div>

                        {/* Progress bar for time */}
                        <div className='w-full bg-content3 rounded-full h-2 mb-1'>
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              index === 0
                                ? 'bg-yellow-500'
                                : index === 1
                                  ? 'bg-gray-400'
                                  : index === 2
                                    ? 'bg-orange-600'
                                    : 'bg-purple-400'
                            }`}
                            style={{ width: `${Math.max(timePercentage, 5)}%` }}
                          />
                        </div>

                        {/* Session count */}
                        <div className='text-xs text-foreground-500'>
                          {task.sessions} session
                          {task.sessions !== 1 ? 's' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show more tasks if available */}
                {taskTimeData.length > 5 && (
                  <div className='text-center pt-2'>
                    <button className='text-sm text-purple-500 hover:text-purple-600 font-medium'>
                      View all {taskTimeData.length} tasks →
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Enhanced Productivity Trends */}
        <Card className='bg-content1 border-divider'>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Activity className='w-5 h-5 text-orange-500' />
                <h3 className='text-lg font-semibold text-foreground'>
                  Productivity Trends
                </h3>
              </div>
              {dailyData.length > 0 && (
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-1'>
                    <div className='w-2 h-2 bg-orange-500 rounded-full'></div>
                    <span className='text-xs text-foreground-600'>
                      Daily Focus
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            {dailyData.length === 0 ? (
              <div className='text-center py-12'>
                <TrendingUp className='w-12 h-12 text-foreground-400 mx-auto mb-3' />
                <p className='text-foreground-600 mb-2'>No productivity data</p>
                <p className='text-sm text-foreground-500'>
                  Complete some work sessions to see trends
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {/* Productivity Summary */}
                <div className='grid grid-cols-3 gap-4 p-3 bg-content2 rounded-lg'>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-orange-500'>
                      {Math.max(...dailyData.map(d => d.productivity))}%
                    </div>
                    <div className='text-xs text-foreground-600'>Best Day</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-green-500'>
                      {Math.round(
                        dailyData.reduce((sum, d) => sum + d.productivity, 0) /
                          dailyData.length
                      )}
                      %
                    </div>
                    <div className='text-xs text-foreground-600'>Average</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-blue-500'>
                      {dailyData.filter(d => d.productivity >= 80).length}
                    </div>
                    <div className='text-xs text-foreground-600'>High Days</div>
                  </div>
                </div>

                {/* Mini Chart */}
                <ResponsiveContainer width='100%' height={180}>
                  <BarChart
                    data={dailyData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray='3 3'
                      stroke='#374151'
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey='date'
                      stroke='#9CA3AF'
                      fontSize={11}
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-45}
                      textAnchor='end'
                      height={60}
                    />
                    <YAxis
                      stroke='#9CA3AF'
                      fontSize={11}
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                        fontSize: '12px',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value}%`,
                        name === 'productivity' ? 'Focus Score' : name,
                      ]}
                      labelFormatter={label => `Date: ${label}`}
                    />
                    <Bar
                      dataKey='productivity'
                      fill='#F59E0B'
                      radius={[2, 2, 0, 0]}
                      name='productivity'
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Trend Insights */}
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium text-foreground'>
                    Recent Performance
                  </h4>
                  {dailyData
                    .slice(-3)
                    .reverse()
                    .map((day, index) => (
                      <div
                        key={day.date}
                        className='flex items-center justify-between p-2 bg-content2 rounded-lg'
                      >
                        <div className='flex items-center gap-2'>
                          <div
                            className={`w-2 h-2 rounded-full ${
                              day.productivity >= 80
                                ? 'bg-green-500'
                                : day.productivity >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          <span className='text-sm text-foreground'>
                            {day.date}
                          </span>
                        </div>
                        <div className='flex items-center gap-3'>
                          <span className='text-xs text-foreground-600'>
                            {formatTime(day.hours)}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              day.productivity >= 80
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : day.productivity >= 60
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {day.productivity}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Task Details Table */}
      {taskTimeData.length > 0 && (
        <Card className='bg-content1 border-divider mt-6'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Calendar className='w-5 h-5 text-indigo-500' />
              <h3 className='text-lg font-semibold text-foreground'>
                Task Breakdown
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-divider'>
                    <th className='text-left py-3 px-4 text-foreground-600 font-medium'>
                      Task
                    </th>
                    <th className='text-left py-3 px-4 text-foreground-600 font-medium'>
                      Time
                    </th>
                    <th className='text-left py-3 px-4 text-foreground-600 font-medium'>
                      Sessions
                    </th>
                    <th className='text-left py-3 px-4 text-foreground-600 font-medium'>
                      Productivity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taskTimeData.map((task, index) => (
                    <tr key={index} className='border-b border-divider/50'>
                      <td className='py-3 px-4 text-foreground'>
                        {task.taskTitle}
                      </td>
                      <td className='py-3 px-4 text-foreground-600'>
                        {formatTime(task.totalTime)}
                      </td>
                      <td className='py-3 px-4 text-foreground-600'>
                        {task.sessions}
                      </td>
                      <td className='py-3 px-4'>
                        <div className='flex items-center gap-2'>
                          <div className='w-16 bg-content3 rounded-full h-2'>
                            <div
                              className='bg-success h-2 rounded-full'
                              style={{ width: `${task.productivity}%` }}
                            />
                          </div>
                          <span className='text-foreground-600 text-xs'>
                            {task.productivity}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
