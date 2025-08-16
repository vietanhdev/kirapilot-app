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
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <Activity className='w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin' />
          <p className='text-gray-400'>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 p-6 overflow-auto'>
      {/* Header */}
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white mb-2'>Time Analytics</h1>
          <p className='text-gray-400'>
            Insights into your productivity patterns
          </p>
        </div>

        <div className='flex gap-2'>
          {(['week', 'month', 'quarter'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card className='bg-gray-800 border-gray-700'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-400 text-sm'>Total Time</p>
                  <p className='text-2xl font-bold text-white'>
                    {formatTime(stats.totalHours)}
                  </p>
                </div>
                <Clock className='w-8 h-8 text-blue-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-gray-800 border-gray-700'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-400 text-sm'>Focus Time</p>
                  <p className='text-2xl font-bold text-white'>
                    {formatTime(stats.workingHours)}
                  </p>
                </div>
                <Target className='w-8 h-8 text-green-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-gray-800 border-gray-700'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-400 text-sm'>Sessions</p>
                  <p className='text-2xl font-bold text-white'>
                    {stats.sessionsCount}
                  </p>
                </div>
                <Timer className='w-8 h-8 text-purple-500' />
              </div>
            </CardBody>
          </Card>

          <Card className='bg-gray-800 border-gray-700'>
            <CardBody className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-400 text-sm'>Productivity</p>
                  <p className='text-2xl font-bold text-white'>
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
        <Card className='bg-gray-800 border-gray-700'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <BarChart3 className='w-5 h-5 text-blue-500' />
              <h3 className='text-lg font-semibold text-white'>
                Daily Activity
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
        <Card className='bg-gray-800 border-gray-700'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <TrendingUp className='w-5 h-5 text-green-500' />
              <h3 className='text-lg font-semibold text-white'>
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
                  tickFormatter={hour => `${hour}:00`}
                />
                <YAxis stroke='#9CA3AF' fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                  }}
                  labelFormatter={hour => `${hour}:00`}
                />
                <Line
                  type='monotone'
                  dataKey='sessions'
                  stroke='#10B981'
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Task Time Distribution */}
        <Card className='bg-gray-800 border-gray-700'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <PieChartIcon className='w-5 h-5 text-purple-500' />
              <h3 className='text-lg font-semibold text-white'>Top Tasks</h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={taskTimeData.slice(0, 5)}
                  cx='50%'
                  cy='50%'
                  labelLine={false}
                  label={(props: PieLabelRenderProps) => {
                    const data = props.payload as TaskTimeData;
                    const taskTitle = data?.taskTitle || '';
                    return `${taskTitle.slice(0, 15)}${taskTitle.length > 15 ? '...' : ''}`;
                  }}
                  outerRadius={80}
                  fill='#8884d8'
                  dataKey='totalTime'
                >
                  {taskTimeData.slice(0, 5).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                  }}
                  formatter={(value: number) => [formatTime(value), 'Time']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Productivity Trends */}
        <Card className='bg-gray-800 border-gray-700'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Activity className='w-5 h-5 text-orange-500' />
              <h3 className='text-lg font-semibold text-white'>
                Productivity Trend
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={dailyData}>
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
                  formatter={(value: number) => [`${value}%`, 'Productivity']}
                />
                <Bar
                  dataKey='productivity'
                  fill='#F59E0B'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Task Details Table */}
      {taskTimeData.length > 0 && (
        <Card className='bg-gray-800 border-gray-700 mt-6'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Calendar className='w-5 h-5 text-indigo-500' />
              <h3 className='text-lg font-semibold text-white'>
                Task Breakdown
              </h3>
            </div>
          </CardHeader>
          <CardBody className='pt-0'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-gray-700'>
                    <th className='text-left py-3 px-4 text-gray-300 font-medium'>
                      Task
                    </th>
                    <th className='text-left py-3 px-4 text-gray-300 font-medium'>
                      Time
                    </th>
                    <th className='text-left py-3 px-4 text-gray-300 font-medium'>
                      Sessions
                    </th>
                    <th className='text-left py-3 px-4 text-gray-300 font-medium'>
                      Productivity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taskTimeData.map((task, index) => (
                    <tr key={index} className='border-b border-gray-700/50'>
                      <td className='py-3 px-4 text-white'>{task.taskTitle}</td>
                      <td className='py-3 px-4 text-gray-300'>
                        {formatTime(task.totalTime)}
                      </td>
                      <td className='py-3 px-4 text-gray-300'>
                        {task.sessions}
                      </td>
                      <td className='py-3 px-4'>
                        <div className='flex items-center gap-2'>
                          <div className='w-16 bg-gray-700 rounded-full h-2'>
                            <div
                              className='bg-green-500 h-2 rounded-full'
                              style={{ width: `${task.productivity}%` }}
                            />
                          </div>
                          <span className='text-gray-300 text-xs'>
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
