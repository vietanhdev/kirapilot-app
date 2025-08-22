import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Switch,
  Divider,
  Progress,
} from '@heroui/react';
import {
  Download,
  Upload,
  Trash2,
  Shield,
  Database,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { forceClearData } from '../../utils/clearOldData';
import { TaskService } from '../../services/database/repositories/TaskService';
import { TimeTrackingService } from '../../services/database/repositories/TimeTrackingService';
import { Priority, TaskStatus, CreateTaskRequest } from '../../types';
import { invoke } from '@tauri-apps/api/core';

interface DataManagementProps {
  className?: string;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  className = '',
}) => {
  const { clearConversation } = useAI();

  // Modal controls
  const {
    isOpen: isExportOpen,
    onOpen: onExportOpen,
    onClose: onExportClose,
  } = useDisclosure();
  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onClose: onImportClose,
  } = useDisclosure();
  const {
    isOpen: isResetOpen,
    onOpen: onResetOpen,
    onClose: onResetClose,
  } = useDisclosure();
  const {
    isOpen: isPrivacyOpen,
    onOpen: onPrivacyOpen,
    onClose: onPrivacyClose,
  } = useDisclosure();

  // State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [showAILogs, setShowAILogs] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);

  // Show final confirmation
  const handleShowFinalConfirmation = () => {
    setShowFinalConfirmation(true);
  };

  // Clear Database function
  const handleClearDatabase = async () => {
    console.log('handleClearDatabase called - proceeding with data clearing');
    setIsClearingData(true);
    setShowFinalConfirmation(false);

    try {
      console.log('Calling clear_all_data command...');
      // Use the new clear_all_data Tauri command
      const result = await invoke<string>('clear_all_data');
      console.log('Database cleared:', result);

      // Clear additional local storage data
      forceClearData();
      localStorage.removeItem('kirapilot-preferences');
      localStorage.removeItem('kirapilot-privacy-settings');
      localStorage.removeItem('kira_api_key');

      // Clear AI conversations
      clearConversation();

      // Show success message
      alert(
        `Database cleared successfully!\n\n${result}\n\nThe application will now restart.`
      );

      // Force application restart to reinitialize everything
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to clear database:', error);
      alert(`Failed to clear database: ${error}\n\nCheck console for details.`);
    } finally {
      setIsClearingData(false);
      onResetClose();
    }
  };

  // Cancel final confirmation
  const handleCancelFinalConfirmation = () => {
    setShowFinalConfirmation(false);
  };

  // Mock data generation function
  const generateMockData = async () => {
    try {
      setIsGeneratingMockData(true);

      const taskService = new TaskService();
      const timeService = new TimeTrackingService();

      // Helper functions for realistic data generation
      const getRandomDateInRange = (daysBack: number, daysForward: number) => {
        const now = Date.now();
        const minTime = now - daysBack * 24 * 60 * 60 * 1000;
        const maxTime = now + daysForward * 24 * 60 * 60 * 1000;
        return new Date(minTime + Math.random() * (maxTime - minTime));
      };

      const getWorkingHoursDate = (baseDate: Date, preferredHour?: number) => {
        const date = new Date(baseDate);
        const hour = preferredHour || 8 + Math.floor(Math.random() * 10); // 8 AM - 6 PM
        const minute = Math.floor(Math.random() * 60);
        date.setHours(hour, minute, 0, 0);
        return date;
      };

      const getRandomElement = <T,>(array: T[]): T => {
        return array[Math.floor(Math.random() * array.length)];
      };

      // Task templates organized by category and complexity
      const taskTemplates = {
        development: [
          {
            title: 'Implement OAuth 2.0 Authentication',
            description:
              'Add secure OAuth 2.0 authentication flow with Google and GitHub providers',
            priority: Priority.HIGH,
            timeEstimate: 240,
            tags: ['auth', 'security', 'oauth', 'backend'],
          },
          {
            title: 'Optimize Database Query Performance',
            description:
              'Analyze and optimize slow database queries, add proper indexing',
            priority: Priority.MEDIUM,
            timeEstimate: 180,
            tags: ['database', 'performance', 'optimization', 'sql'],
          },
          {
            title: 'Build Real-time Notification System',
            description:
              'Implement WebSocket-based real-time notifications for user actions',
            priority: Priority.HIGH,
            timeEstimate: 300,
            tags: ['websocket', 'notifications', 'real-time', 'frontend'],
          },
          {
            title: 'Create API Rate Limiting Middleware',
            description:
              'Implement rate limiting to prevent API abuse and ensure fair usage',
            priority: Priority.MEDIUM,
            timeEstimate: 120,
            tags: ['api', 'middleware', 'security', 'rate-limiting'],
          },
          {
            title: 'Refactor Legacy Payment Processing',
            description:
              'Modernize payment processing code and integrate new payment providers',
            priority: Priority.URGENT,
            timeEstimate: 480,
            tags: ['payments', 'refactor', 'legacy', 'integration'],
          },
        ],
        design: [
          {
            title: 'Design Mobile App Wireframes',
            description:
              'Create comprehensive wireframes for iOS and Android mobile applications',
            priority: Priority.HIGH,
            timeEstimate: 200,
            tags: ['design', 'wireframes', 'mobile', 'ux'],
          },
          {
            title: 'Conduct User Experience Audit',
            description:
              'Comprehensive UX audit of current application with improvement recommendations',
            priority: Priority.MEDIUM,
            timeEstimate: 300,
            tags: ['ux', 'audit', 'usability', 'research'],
          },
          {
            title: 'Create Design System Components',
            description:
              'Build reusable design system components and documentation',
            priority: Priority.HIGH,
            timeEstimate: 360,
            tags: ['design-system', 'components', 'documentation', 'ui'],
          },
        ],
        business: [
          {
            title: 'Quarterly Business Review Preparation',
            description:
              'Prepare comprehensive quarterly business review presentation and metrics',
            priority: Priority.HIGH,
            timeEstimate: 240,
            tags: ['business', 'quarterly', 'metrics', 'presentation'],
          },
          {
            title: 'Market Research for New Features',
            description:
              'Research competitor features and market trends for product roadmap',
            priority: Priority.MEDIUM,
            timeEstimate: 180,
            tags: ['research', 'market', 'competition', 'features'],
          },
          {
            title: 'Customer Feedback Analysis',
            description:
              'Analyze customer feedback from surveys and support tickets',
            priority: Priority.MEDIUM,
            timeEstimate: 150,
            tags: ['feedback', 'analysis', 'customer', 'insights'],
          },
        ],
        operations: [
          {
            title: 'Set Up CI/CD Pipeline',
            description:
              'Configure automated testing and deployment pipeline with GitHub Actions',
            priority: Priority.HIGH,
            timeEstimate: 300,
            tags: ['devops', 'ci-cd', 'automation', 'deployment'],
          },
          {
            title: 'Security Vulnerability Assessment',
            description:
              'Conduct comprehensive security assessment and penetration testing',
            priority: Priority.URGENT,
            timeEstimate: 400,
            tags: ['security', 'vulnerability', 'assessment', 'testing'],
          },
          {
            title: 'Infrastructure Cost Optimization',
            description:
              'Analyze and optimize cloud infrastructure costs and resource usage',
            priority: Priority.MEDIUM,
            timeEstimate: 200,
            tags: ['infrastructure', 'cost', 'optimization', 'cloud'],
          },
        ],
        meetings: [
          {
            title: 'Weekly Team Standup',
            description:
              'Regular team synchronization meeting to discuss progress and blockers',
            priority: Priority.MEDIUM,
            timeEstimate: 30,
            tags: ['meeting', 'standup', 'team', 'sync'],
          },
          {
            title: 'Sprint Planning Session',
            description:
              'Plan upcoming sprint goals, tasks, and resource allocation',
            priority: Priority.HIGH,
            timeEstimate: 120,
            tags: ['planning', 'sprint', 'agile', 'team'],
          },
          {
            title: 'Client Requirements Gathering',
            description:
              'Meet with client to gather detailed requirements for new project',
            priority: Priority.HIGH,
            timeEstimate: 90,
            tags: ['client', 'requirements', 'meeting', 'project'],
          },
        ],
      };

      // Generate diverse tasks across different time periods
      const sampleTasks: CreateTaskRequest[] = [];

      // Generate tasks for different time periods with realistic patterns
      const timePeriodsConfig = [
        {
          name: 'past_completed',
          daysBack: 60,
          daysForward: -15,
          count: 8,
          completionRate: 0.85,
        },
        {
          name: 'recent_past',
          daysBack: 15,
          daysForward: -2,
          count: 6,
          completionRate: 0.7,
        },
        {
          name: 'current_week',
          daysBack: 3,
          daysForward: 3,
          count: 5,
          completionRate: 0.4,
        },
        {
          name: 'near_future',
          daysBack: 0,
          daysForward: 14,
          count: 7,
          completionRate: 0.1,
        },
        {
          name: 'future_planning',
          daysBack: 14,
          daysForward: 60,
          count: 6,
          completionRate: 0.05,
        },
        {
          name: 'long_term',
          daysBack: 60,
          daysForward: 180,
          count: 4,
          completionRate: 0.0,
        },
      ];

      // Generate tasks for each time period
      for (const period of timePeriodsConfig) {
        const categories = Object.keys(taskTemplates);

        for (let i = 0; i < period.count; i++) {
          const category = getRandomElement(
            categories
          ) as keyof typeof taskTemplates;
          const template = getRandomElement(taskTemplates[category]);

          // Add some variation to the template
          const variations = [
            {
              suffix: 'v2',
              description:
                'Enhanced version with additional features and improvements',
            },
            {
              suffix: 'Mobile',
              description:
                'Mobile-optimized implementation with responsive design',
            },
            {
              suffix: 'Enterprise',
              description:
                'Enterprise-grade solution with advanced security and scalability',
            },
            {
              suffix: 'Beta',
              description:
                'Beta version for testing and user feedback collection',
            },
            {
              suffix: 'Integration',
              description: 'Integration with third-party services and APIs',
            },
          ];

          const shouldVary = Math.random() > 0.7;
          const variation = shouldVary ? getRandomElement(variations) : null;

          const scheduledDate = getRandomDateInRange(
            period.daysBack,
            period.daysForward
          );
          const dueDate =
            Math.random() > 0.6
              ? getRandomDateInRange(
                  period.daysForward - 7,
                  period.daysForward + 14
                )
              : undefined;

          // Add seasonal context for certain tasks
          const month = scheduledDate.getMonth();
          const seasonalTags: string[] = [];
          if (month >= 11 || month <= 1) {
            seasonalTags.push('q4', 'year-end');
          } else if (month >= 2 && month <= 4) {
            seasonalTags.push('q1', 'planning');
          } else if (month >= 5 && month <= 7) {
            seasonalTags.push('q2', 'growth');
          } else {
            seasonalTags.push('q3', 'optimization');
          }

          sampleTasks.push({
            title: variation
              ? `${template.title} ${variation.suffix}`
              : template.title,
            description: variation
              ? `${template.description}. ${variation.description}`
              : template.description,
            priority: template.priority,
            timeEstimate:
              template.timeEstimate + (Math.floor(Math.random() * 60) - 30), // ±30 min variation
            tags: [...template.tags, ...seasonalTags, period.name],
            scheduledDate,
            dueDate,
          });
        }
      }

      // Add some recurring/maintenance tasks
      const recurringTasks = [
        {
          title: 'Weekly Code Review',
          description:
            'Review team pull requests and provide constructive feedback',
          priority: Priority.MEDIUM,
          timeEstimate: 60,
          tags: ['code-review', 'weekly', 'team', 'recurring'],
          scheduledDate: new Date(), // Today
        },
        {
          title: 'Monthly Security Updates',
          description: 'Apply security patches and update dependencies',
          priority: Priority.HIGH,
          timeEstimate: 90,
          tags: ['security', 'updates', 'maintenance', 'monthly'],
          scheduledDate: getRandomDateInRange(7, 0),
        },
        {
          title: 'Backup Verification',
          description:
            'Verify database backups and disaster recovery procedures',
          priority: Priority.MEDIUM,
          timeEstimate: 45,
          tags: ['backup', 'verification', 'maintenance', 'ops'],
          scheduledDate: getRandomDateInRange(3, 0),
        },
      ];

      sampleTasks.push(...recurringTasks);

      // Enhanced task processing with sophisticated session generation
      const createdTasks = [];
      let completedCount = 0;
      let inProgressCount = 0;
      let sessionsCreated = 0;
      const now = new Date();

      // Work pattern profiles for different types of sessions
      const workPatterns = {
        focused: {
          sessionDuration: [90, 180], // 1.5-3 hours
          breakTime: [0, 10], // 0-10 minutes
          notes: [
            'Deep focus session with minimal distractions',
            'Entered flow state - highly productive session',
            'Concentrated work with excellent progress',
            'Uninterrupted focus time - great momentum',
          ],
        },
        collaborative: {
          sessionDuration: [60, 120], // 1-2 hours
          breakTime: [5, 15], // 5-15 minutes
          notes: [
            'Collaborative session with team members',
            'Pair programming and knowledge sharing',
            'Team discussion and problem solving',
            'Cross-functional collaboration session',
          ],
        },
        research: {
          sessionDuration: [45, 90], // 45-90 minutes
          breakTime: [10, 20], // 10-20 minutes
          notes: [
            'Research and exploration session',
            'Learning new concepts and technologies',
            'Documentation review and analysis',
            'Investigation and discovery work',
          ],
        },
        maintenance: {
          sessionDuration: [30, 60], // 30-60 minutes
          breakTime: [5, 15], // 5-15 minutes
          notes: [
            'Routine maintenance and updates',
            'Bug fixes and minor improvements',
            'Code cleanup and refactoring',
            'System maintenance tasks',
          ],
        },
      };

      // Process each task with enhanced logic
      for (let i = 0; i < sampleTasks.length; i++) {
        try {
          const task = await taskService.create(sampleTasks[i]);
          createdTasks.push(task);

          // Determine completion probability based on time period tags
          let completionRate = 0.5; // Default
          if (task.tags.includes('past_completed')) {
            completionRate = 0.85;
          } else if (task.tags.includes('recent_past')) {
            completionRate = 0.7;
          } else if (task.tags.includes('current_week')) {
            completionRate = 0.4;
          } else if (task.tags.includes('near_future')) {
            completionRate = 0.1;
          } else if (task.tags.includes('future_planning')) {
            completionRate = 0.05;
          } else if (task.tags.includes('long_term')) {
            completionRate = 0.0;
          }

          const shouldComplete = Math.random() < completionRate;
          const scheduledDate = task.scheduledDate;

          if (scheduledDate && scheduledDate < now && shouldComplete) {
            // Complete the task
            await taskService.update(task.id, { status: TaskStatus.COMPLETED });
            completedCount++;

            // Generate realistic work sessions for completed tasks
            const sessionCount = Math.min(
              Math.floor(task.timeEstimate / 60) + 1, // At least 1 session per hour estimated
              Math.floor(Math.random() * 4) + 1 // But cap at 1-4 sessions
            );

            for (let j = 0; j < sessionCount; j++) {
              // Choose work pattern based on task type and tags
              let patternType: keyof typeof workPatterns = 'focused';
              if (task.tags.includes('meeting') || task.tags.includes('team')) {
                patternType = 'collaborative';
              } else if (
                task.tags.includes('research') ||
                task.tags.includes('analysis')
              ) {
                patternType = 'research';
              } else if (
                task.tags.includes('maintenance') ||
                task.tags.includes('bug')
              ) {
                patternType = 'maintenance';
              }

              const pattern = workPatterns[patternType];
              const [minDuration, maxDuration] = pattern.sessionDuration;
              const [minBreak, maxBreak] = pattern.breakTime;

              const sessionDurationMinutes = Math.floor(
                Math.random() * (maxDuration - minDuration) + minDuration
              );
              const breakTimeMinutes = Math.floor(
                Math.random() * (maxBreak - minBreak) + minBreak
              );

              // Create session timing based on task schedule with realistic work patterns
              const dayOffset = Math.floor(Math.random() * 7); // Within a week of scheduled date
              const sessionDate = new Date(
                scheduledDate.getTime() - dayOffset * 24 * 60 * 60 * 1000
              );

              // Different work hour patterns based on task priority
              let workHourRange: [number, number];
              if (task.priority === Priority.URGENT) {
                workHourRange = [7, 19]; // Early start, late finish for urgent tasks
              } else if (task.priority === Priority.HIGH) {
                workHourRange = [8, 18]; // Standard extended hours
              } else {
                workHourRange = [9, 17]; // Regular business hours
              }

              const sessionStart = getWorkingHoursDate(
                sessionDate,
                workHourRange[0] +
                  Math.floor(
                    Math.random() * (workHourRange[1] - workHourRange[0])
                  )
              );
              const sessionEnd = new Date(
                sessionStart.getTime() + sessionDurationMinutes * 60 * 1000
              );

              // Generate contextual notes
              const baseNote = getRandomElement(pattern.notes);
              const progressNote =
                j === sessionCount - 1
                  ? 'Task completed successfully! 🎉'
                  : `Session ${j + 1}/${sessionCount} - making good progress`;

              const contextualNote = `${baseNote}. ${progressNote} Duration: ${sessionDurationMinutes} minutes.`;

              await timeService.createHistoricalSession(
                task.id,
                sessionStart,
                sessionEnd,
                contextualNote,
                breakTimeMinutes * 60
              );

              sessionsCreated++;
            }
          } else if (scheduledDate && scheduledDate < now) {
            // Mark as in-progress for past tasks that aren't completed
            await taskService.update(task.id, {
              status: TaskStatus.IN_PROGRESS,
            });
            inProgressCount++;

            // Create partial sessions for in-progress tasks
            if (Math.random() > 0.4) {
              // 60% chance of having sessions
              const sessionCount = Math.floor(Math.random() * 2) + 1; // 1-2 sessions

              for (let j = 0; j < sessionCount; j++) {
                const sessionDurationMinutes =
                  Math.floor(Math.random() * 90) + 30;
                const breakTimeMinutes = Math.floor(Math.random() * 25) + 5; // Longer breaks for incomplete work

                const sessionDate = new Date(
                  scheduledDate.getTime() -
                    Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000
                );
                const sessionStart = getWorkingHoursDate(sessionDate);
                const sessionEnd = new Date(
                  sessionStart.getTime() + sessionDurationMinutes * 60 * 1000
                );

                const progressNotes = [
                  'Initial work session - exploring the problem space',
                  'Made some progress but hit technical blockers',
                  'Partial implementation completed, needs more work',
                  'Research phase completed, ready for implementation',
                  'Good start but need to revisit approach',
                ];

                const note = `${getRandomElement(progressNotes)}. Still in progress - estimated ${Math.floor(Math.random() * 120) + 30} more minutes needed.`;

                await timeService.createHistoricalSession(
                  task.id,
                  sessionStart,
                  sessionEnd,
                  note,
                  breakTimeMinutes * 60
                );

                sessionsCreated++;
              }
            }
          } else if (
            scheduledDate &&
            scheduledDate.toDateString() === now.toDateString()
          ) {
            // Today's tasks - some might be in progress
            if (Math.random() > 0.6) {
              await taskService.update(task.id, {
                status: TaskStatus.IN_PROGRESS,
              });
              inProgressCount++;
            }
          }
          // Future tasks remain PENDING
        } catch (error) {
          console.warn(`Failed to process task ${i + 1}:`, error);
        }
      }

      // Calculate statistics for the success message
      const totalTasks = createdTasks.length;
      const pendingTasks = totalTasks - completedCount - inProgressCount;
      const avgSessionsPerCompletedTask =
        completedCount > 0
          ? (sessionsCreated / (completedCount + inProgressCount)).toFixed(1)
          : '0';

      // Calculate time range
      const dates = createdTasks
        .map(t => t.scheduledDate)
        .filter(Boolean)
        .sort();
      const earliestDate = dates[0];
      const latestDate = dates[dates.length - 1];
      const timeSpanMonths =
        earliestDate && latestDate
          ? Math.round(
              (latestDate.getTime() - earliestDate.getTime()) /
                (1000 * 60 * 60 * 24 * 30)
            )
          : 6;

      const message = `🎉 Successfully generated comprehensive sample data!

📊 Task Overview:
• ${totalTasks} total tasks across ${timeSpanMonths} months
• ${completedCount} completed tasks (${Math.round((completedCount / totalTasks) * 100)}%)
• ${inProgressCount} in-progress tasks (${Math.round((inProgressCount / totalTasks) * 100)}%)
• ${pendingTasks} pending tasks (${Math.round((pendingTasks / totalTasks) * 100)}%)

⏱️ Time Tracking:
• ${sessionsCreated} realistic work sessions
• ${avgSessionsPerCompletedTask} avg sessions per active task
• Diverse work patterns (focused, collaborative, research, maintenance)
• Realistic break times and productivity patterns

🏷️ Task Categories:
• Development, Design, Business, Operations
• Meeting and collaboration tasks
• Recurring maintenance tasks
• Seasonal and contextual variations

📅 Timeline: ${earliestDate?.toLocaleDateString() || 'N/A'} → ${latestDate?.toLocaleDateString() || 'N/A'}

Perfect for exploring KiraPilot's task management, time tracking, and analytics features!`;

      alert(message);
    } catch (error) {
      console.error('Failed to generate mock data:', error);
      alert('Failed to generate mock data. Check console for details.');
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  // Export data function
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Export functionality is now handled by the SeaORM backend
      console.log('Data export functionality moved to SeaORM backend');

      // Simulate progress for UI
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert('Data export functionality is now handled by the SeaORM backend');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Check console for details.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      onExportClose();
    }
  };

  // Import data function
  const handleImportData = async (_file: File) => {
    try {
      setIsImporting(true);
      setImportProgress(0);

      // Import functionality is now handled by the SeaORM backend
      console.log('Data import functionality moved to SeaORM backend');

      // Simulate progress for UI
      for (let i = 0; i <= 100; i += 10) {
        setImportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert('Data import functionality is now handled by the SeaORM backend');
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import data. Check console for details.');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      onImportClose();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
          Data Management
        </h2>
        <p className='text-gray-600 dark:text-gray-400'>
          Manage your KiraPilot data, including backup, restore, and privacy
          controls.
        </p>
      </div>

      {/* Data Export/Import */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Database className='h-5 w-5 text-blue-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Backup & Restore
            </h3>
          </div>

          <p className='text-gray-600 dark:text-gray-400'>
            Export your data for backup or import data from a previous backup.
          </p>

          <div className='flex gap-3'>
            <Button
              color='primary'
              variant='flat'
              startContent={<Download className='h-4 w-4' />}
              onPress={onExportOpen}
              isDisabled={isExporting}
            >
              Export Data
            </Button>

            <Button
              color='secondary'
              variant='flat'
              startContent={<Upload className='h-4 w-4' />}
              onPress={onImportOpen}
              isDisabled={isImporting}
            >
              Import Data
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Mock Data Generation */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Settings className='h-5 w-5 text-green-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Sample Data
            </h3>
          </div>

          <p className='text-gray-600 dark:text-gray-400'>
            Generate sophisticated sample data with realistic work patterns,
            diverse task categories, intelligent time tracking sessions, and
            seasonal context spanning 6+ months.
          </p>

          <Button
            color='success'
            variant='flat'
            startContent={<Database className='h-4 w-4' />}
            onPress={generateMockData}
            isLoading={isGeneratingMockData}
          >
            {isGeneratingMockData ? 'Generating...' : 'Generate Sample Data'}
          </Button>
        </CardBody>
      </Card>

      {/* Privacy Controls */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Shield className='h-5 w-5 text-purple-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Privacy Controls
            </h3>
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='font-medium text-gray-900 dark:text-white'>
                  Show AI Interaction Logs
                </p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Display detailed logs of AI interactions for transparency
                </p>
              </div>
              <Switch
                isSelected={showAILogs}
                onValueChange={setShowAILogs}
                color='primary'
              />
            </div>

            <Divider />

            <Button
              color='secondary'
              variant='flat'
              startContent={<Shield className='h-4 w-4' />}
              onPress={onPrivacyOpen}
            >
              View Privacy Settings
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className='border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/30'>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400' />
            <h3 className='text-lg font-semibold text-red-900 dark:text-red-200'>
              Danger Zone
            </h3>
          </div>

          <p className='text-red-700 dark:text-red-300'>
            Permanently delete all your data. This action cannot be undone.
          </p>

          <Button
            color='danger'
            variant='flat'
            startContent={<Trash2 className='h-4 w-4' />}
            onPress={onResetOpen}
          >
            Clear All Data
          </Button>
        </CardBody>
      </Card>

      {/* Export Modal */}
      <Modal isOpen={isExportOpen} onClose={onExportClose}>
        <ModalContent>
          <ModalHeader>Export Data</ModalHeader>
          <ModalBody>
            {isExporting ? (
              <div className='space-y-4'>
                <p>Exporting your data...</p>
                <Progress value={exportProgress} className='w-full' />
              </div>
            ) : (
              <p>
                This will export all your tasks, time sessions, and settings to
                a JSON file.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant='light'
              onPress={onExportClose}
              isDisabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              color='primary'
              onPress={handleExportData}
              isLoading={isExporting}
            >
              Export
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportOpen} onClose={onImportClose}>
        <ModalContent>
          <ModalHeader>Import Data</ModalHeader>
          <ModalBody>
            {isImporting ? (
              <div className='space-y-4'>
                <p>Importing your data...</p>
                <Progress value={importProgress} className='w-full' />
              </div>
            ) : (
              <div className='space-y-4'>
                <p>
                  This will replace all your current data with the imported
                  data. Make sure to export your current data first if you want
                  to keep it.
                </p>
                <input
                  type='file'
                  accept='.json'
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImportData(file);
                    }
                  }}
                  className='w-full'
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant='light'
              onPress={onImportClose}
              isDisabled={isImporting}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reset Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalContent>
          <ModalHeader className='text-red-600 dark:text-red-400'>
            Clear All Data
          </ModalHeader>
          <ModalBody>
            {!showFinalConfirmation ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800'>
                  <AlertTriangle className='h-6 w-6 text-red-600 dark:text-red-400' />
                  <div>
                    <p className='font-semibold text-red-900 dark:text-red-200'>
                      Warning: This action cannot be undone!
                    </p>
                    <p className='text-sm text-red-700 dark:text-red-300'>
                      All your tasks, time sessions, settings, and AI
                      conversations will be permanently deleted.
                    </p>
                  </div>
                </div>

                <div className='space-y-3'>
                  <p className='font-medium text-gray-900 dark:text-white'>
                    This will permanently delete:
                  </p>
                  <ul className='list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4'>
                    <li>All tasks and projects</li>
                    <li>Timer sessions and history</li>
                    <li>AI conversation history</li>
                    <li>User preferences and settings</li>
                    <li>All other application data</li>
                  </ul>
                </div>

                <p className='text-gray-600 dark:text-gray-400'>
                  Consider exporting your data first if you want to keep a
                  backup.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='flex items-center gap-3 p-4 bg-red-100 dark:bg-red-950/50 rounded-lg border-2 border-red-300 dark:border-red-700'>
                  <AlertTriangle className='h-8 w-8 text-red-600 dark:text-red-400' />
                  <div>
                    <p className='font-bold text-red-900 dark:text-red-200 text-lg'>
                      FINAL CONFIRMATION
                    </p>
                    <p className='text-sm text-red-700 dark:text-red-300'>
                      This is your last chance to cancel!
                    </p>
                  </div>
                </div>

                <div className='text-center space-y-3'>
                  <p className='font-semibold text-gray-900 dark:text-white'>
                    Are you absolutely sure you want to delete ALL data?
                  </p>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    The application will restart after clearing all data.
                  </p>
                </div>

                {isClearingData && (
                  <div className='text-center'>
                    <Progress
                      size='sm'
                      isIndeterminate
                      color='danger'
                      className='max-w-md mx-auto'
                      label='Clearing all data...'
                      classNames={{
                        base: 'max-w-md',
                        track:
                          'drop-shadow-md border border-red-200 dark:border-red-800',
                        indicator: 'bg-gradient-to-r from-red-500 to-red-600',
                        label:
                          'tracking-wider font-medium text-red-700 dark:text-red-300',
                        value: 'text-red-700 dark:text-red-300',
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {!showFinalConfirmation ? (
              <>
                <Button variant='light' onPress={onResetClose}>
                  Cancel
                </Button>
                <Button color='danger' onPress={handleShowFinalConfirmation}>
                  Continue to Final Confirmation
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant='light'
                  onPress={handleCancelFinalConfirmation}
                  isDisabled={isClearingData}
                >
                  Cancel
                </Button>
                <Button
                  color='danger'
                  onPress={handleClearDatabase}
                  isLoading={isClearingData}
                  isDisabled={isClearingData}
                >
                  {isClearingData ? 'Clearing Data...' : 'YES, DELETE ALL DATA'}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Privacy Settings Modal */}
      <Modal isOpen={isPrivacyOpen} onClose={onPrivacyClose} size='2xl'>
        <ModalContent>
          <ModalHeader>Privacy Settings</ModalHeader>
          <ModalBody>
            <div className='space-y-6'>
              <div className='space-y-4'>
                <h4 className='font-semibold text-gray-900 dark:text-white'>
                  Data Storage
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg'>
                    <CheckCircle className='h-5 w-5 text-green-600' />
                    <div>
                      <p className='font-medium text-green-900 dark:text-green-100'>
                        Local Storage Only
                      </p>
                      <p className='text-sm text-green-700 dark:text-green-300'>
                        All your data is stored locally on your device and never
                        sent to external servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <h4 className='font-semibold text-gray-900 dark:text-white'>
                  AI Interactions
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                    <Info className='h-5 w-5 text-blue-600' />
                    <div>
                      <p className='font-medium text-blue-900 dark:text-blue-100'>
                        AI Data Usage
                      </p>
                      <p className='text-sm text-blue-700 dark:text-blue-300'>
                        AI interactions are processed through external APIs but
                        conversation history is stored locally.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color='primary' onPress={onPrivacyClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
