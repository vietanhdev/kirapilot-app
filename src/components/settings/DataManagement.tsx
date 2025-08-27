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
import { useTranslation } from '../../hooks/useTranslation';
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
  const { t } = useTranslation();

  // Utility function for showing messages with fallback to alert
  const showMessage = async (
    text: string,
    options: { title: string; kind: 'info' | 'error' | 'warning' }
  ) => {
    try {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(text, options);
    } catch {
      alert(text);
    }
  };

  // Modal controls

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
    setIsClearingData(true);
    setShowFinalConfirmation(false);

    // Close the modal immediately to prevent conflicts
    onResetClose();

    try {
      // Use the new clear_all_data Tauri command
      const result = await invoke<string>('clear_all_data');

      // Clear additional local storage data
      forceClearData();
      localStorage.removeItem('kirapilot-preferences');
      localStorage.removeItem('kirapilot-privacy-settings');
      localStorage.removeItem('kira_api_key');

      // Clear AI conversations
      clearConversation();

      // Show success message using Tauri dialog
      await showMessage(
        `Database cleared successfully!\n\n${result}\n\nThe application will now restart.`,
        { title: 'Database Cleared', kind: 'info' }
      );

      // Add a small delay before reloading to ensure dialog is closed
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 500);
    } catch (error) {
      console.error('Failed to clear database:', error);

      await showMessage(
        `Failed to clear database: ${error}\n\nCheck console for details.`,
        { title: 'Clear Database Failed', kind: 'error' }
      );
    } finally {
      setIsClearingData(false);
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

      try {
        const { message: showMessage } = await import(
          '@tauri-apps/plugin-dialog'
        );
        await showMessage(message, {
          title: 'Mock Data Generated',
          kind: 'info',
        });
      } catch {
        alert(message);
      }
    } catch (error) {
      console.error('Failed to generate mock data:', error);

      try {
        const { message: showMessage } = await import(
          '@tauri-apps/plugin-dialog'
        );
        await showMessage(
          'Failed to generate mock data. Check console for details.',
          {
            title: 'Mock Data Generation Failed',
            kind: 'error',
          }
        );
      } catch {
        alert('Failed to generate mock data. Check console for details.');
      }
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  // Export data function
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Show file save dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [
          {
            name: 'KiraPilot Backup',
            extensions: ['kpbackup'],
          },
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
        defaultPath: `kirapilot-backup-${new Date().toISOString().split('T')[0]}.kpbackup`,
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      // Update progress
      setExportProgress(20);

      // Call Tauri command to export data
      const metadata = await invoke<{
        version: string;
        created_at: string;
        task_count: number;
        session_count: number;
        ai_interaction_count: number;
        dependency_count: number;
      }>('export_data_to_file', { filePath });

      setExportProgress(100);

      // Use Tauri's message dialog instead of alert
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(
        `✅ Data exported successfully!\n\n📊 Export Summary:\n• ${metadata.task_count} tasks\n• ${metadata.session_count} time sessions\n• ${metadata.ai_interaction_count} AI conversations\n• ${metadata.dependency_count} task dependencies\n\n📁 Saved to: ${filePath}\n🗓️ Created: ${new Date(metadata.created_at).toLocaleString()}\n📦 Version: ${metadata.version}`,
        { title: 'Export Successful', kind: 'info' }
      );
    } catch (error) {
      console.error('Export failed:', error);

      // Use Tauri's message dialog for errors too
      try {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`Failed to export data: ${error}`, {
          title: 'Export Failed',
          kind: 'error',
        });
      } catch {
        // Fallback to alert if dialog fails
        alert(`Failed to export data: ${error}`);
      }
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Import data function
  const handleImportData = async () => {
    try {
      setIsImporting(true);
      setImportProgress(0);

      // Show file open dialog
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        filters: [
          {
            name: 'KiraPilot Backup',
            extensions: ['kpbackup'],
          },
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
        multiple: false,
      });

      if (!filePath) {
        setIsImporting(false);
        return;
      }

      setImportProgress(10);

      // First validate the backup file comprehensively
      try {
        const validationResult = await invoke<{
          is_valid: boolean;
          errors: string[];
          warnings: string[];
          metadata?: {
            version: string;
            created_at: string;
            task_count: number;
            session_count: number;
            ai_interaction_count: number;
            dependency_count: number;
          };
        }>('validate_backup_comprehensive', { filePath });

        if (!validationResult.is_valid) {
          const errorMessage = `❌ Backup validation failed!\n\nErrors:\n${validationResult.errors.join('\n')}`;

          try {
            const { message } = await import('@tauri-apps/plugin-dialog');
            await message(errorMessage, {
              title: 'Invalid Backup',
              kind: 'error',
            });
          } catch {
            alert(errorMessage);
          }
          return;
        }

        if (!validationResult.metadata) {
          throw new Error('No metadata found in validation result');
        }

        const metadata = validationResult.metadata;
        setImportProgress(30);

        // Show warnings if any
        if (validationResult.warnings.length > 0) {
          const warningMessage = `⚠️ Backup validation warnings:\n\n${validationResult.warnings.join('\n')}\n\nDo you want to continue?`;

          const { confirm } = await import('@tauri-apps/plugin-dialog');
          const shouldContinue = await confirm(warningMessage, {
            title: 'Validation Warnings',
            kind: 'warning',
          });

          if (!shouldContinue) {
            return;
          }
        }

        // Show confirmation dialog using Tauri's confirm dialog
        const { confirm } = await import('@tauri-apps/plugin-dialog');
        const shouldProceed = await confirm(
          `📦 Backup File Validation Successful!\n\n📊 Backup Contents:\n• ${metadata.task_count} tasks\n• ${metadata.session_count} time sessions\n• ${metadata.ai_interaction_count} AI conversations\n• ${metadata.dependency_count} task dependencies\n\n🗓️ Created: ${new Date(metadata.created_at).toLocaleString()}\n📦 Version: ${metadata.version}\n\n⚠️ WARNING: This will replace all your current data!\n\nDo you want to proceed with the import?`,
          { title: 'Confirm Data Import', kind: 'warning' }
        );

        if (!shouldProceed) {
          setIsImporting(false);
          return;
        }

        setImportProgress(50);

        // Perform the import with overwrite
        const importResult = await invoke<{
          version: string;
          created_at: string;
          task_count: number;
          session_count: number;
          ai_interaction_count: number;
          dependency_count: number;
        }>('import_data_from_file', { filePath, overwrite: true });

        setImportProgress(100);

        // Show success message
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(
          `✅ Data imported successfully!\n\n📊 Import Summary:\n• ${importResult.task_count} tasks restored\n• ${importResult.session_count} time sessions restored\n• ${importResult.ai_interaction_count} AI conversations restored\n• ${importResult.dependency_count} task dependencies restored\n\nThe application will now refresh to load the imported data.`,
          { title: 'Import Successful', kind: 'info' }
        );

        // Refresh the application to load new data
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (validationError) {
        console.error('Backup validation failed:', validationError);

        try {
          const { message } = await import('@tauri-apps/plugin-dialog');
          await message(`Invalid backup file: ${validationError}`, {
            title: 'Validation Failed',
            kind: 'error',
          });
        } catch {
          alert(`Invalid backup file: ${validationError}`);
        }
      }
    } catch (error) {
      console.error('Import failed:', error);

      try {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`Failed to import data: ${error}`, {
          title: 'Import Failed',
          kind: 'error',
        });
      } catch {
        alert(`Failed to import data: ${error}`);
      }
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Test backup function for development
  const handleTestBackup = async () => {
    try {
      // Create a quick backup to desktop for testing
      const { desktopDir } = await import('@tauri-apps/api/path');
      const desktop = await desktopDir();
      const testFilePath = `${desktop}/kirapilot-test-backup-${Date.now()}.kpbackup`;

      const metadata = await invoke<{
        version: string;
        created_at: string;
        task_count: number;
        session_count: number;
        ai_interaction_count: number;
        dependency_count: number;
      }>('export_data_to_file', { filePath: testFilePath });

      // Validate the backup immediately
      const validationResult = await invoke<{
        is_valid: boolean;
        errors: string[];
        warnings: string[];
        metadata?: {
          version: string;
          created_at: string;
          task_count: number;
          session_count: number;
          ai_interaction_count: number;
          dependency_count: number;
        };
      }>('validate_backup_comprehensive', { filePath: testFilePath });

      const { message } = await import('@tauri-apps/plugin-dialog');

      if (validationResult.is_valid) {
        await message(
          `✅ Test backup created and validated successfully!\n\n📊 Backup Contents:\n• ${metadata.task_count} tasks\n• ${metadata.session_count} time sessions\n• ${metadata.ai_interaction_count} AI conversations\n• ${metadata.dependency_count} task dependencies\n\n📁 Saved to: ${testFilePath}\n\n✅ Validation: PASSED${validationResult.warnings.length > 0 ? `\n\n⚠️ Warnings:\n${validationResult.warnings.join('\n')}` : ''}`,
          { title: 'Test Backup Successful', kind: 'info' }
        );
      } else {
        await message(
          `❌ Test backup validation failed!\n\nErrors:\n${validationResult.errors.join('\n')}`,
          { title: 'Test Backup Failed', kind: 'error' }
        );
      }
    } catch (error) {
      console.error('Test backup failed:', error);

      try {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`Test backup failed: ${error}`, {
          title: 'Test Failed',
          kind: 'error',
        });
      } catch {
        alert(`Test backup failed: ${error}`);
      }
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
          {t('dataManagement.title')}
        </h2>
        <p className='text-gray-600 dark:text-gray-400'>
          {t('dataManagement.subtitle')}
        </p>
      </div>

      {/* Data Export/Import */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Database className='h-5 w-5 text-blue-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              {t('dataManagement.backupRestore')}
            </h3>
          </div>

          <p className='text-gray-600 dark:text-gray-400'>
            {t('dataManagement.backupRestoreDescription')}
          </p>

          <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800'>
            <div className='flex items-start gap-2'>
              <Info className='h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0' />
              <div className='text-sm'>
                <p className='font-medium text-blue-900 dark:text-blue-100 mb-1'>
                  Backup & Restore Information
                </p>
                <ul className='text-blue-700 dark:text-blue-300 space-y-1'>
                  <li>
                    • Backups include all tasks, time sessions, AI
                    conversations, and dependencies
                  </li>
                  <li>
                    • Files are saved as compressed ZIP archives with .kpbackup
                    extension
                  </li>
                  <li>
                    • Import will replace all current data - create a backup
                    first!
                  </li>
                  <li>
                    • Data integrity is validated before import to ensure
                    compatibility
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className='space-y-4'>
            <div className='flex gap-3'>
              <Button
                color='primary'
                variant='flat'
                startContent={<Download className='h-4 w-4' />}
                onPress={handleExportData}
                isDisabled={isExporting || isImporting}
                isLoading={isExporting}
              >
                {isExporting ? 'Exporting...' : t('dataManagement.exportData')}
              </Button>

              <Button
                color='secondary'
                variant='flat'
                startContent={<Upload className='h-4 w-4' />}
                onPress={handleImportData}
                isDisabled={isImporting || isExporting}
                isLoading={isImporting}
              >
                {isImporting ? 'Importing...' : t('dataManagement.importData')}
              </Button>
            </div>

            {/* Export Progress */}
            {isExporting && exportProgress > 0 && (
              <div className='space-y-2'>
                <div className='flex justify-between text-sm'>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Exporting data...
                  </span>
                  <span className='text-gray-600 dark:text-gray-400'>
                    {exportProgress}%
                  </span>
                </div>
                <Progress
                  value={exportProgress}
                  color='primary'
                  size='sm'
                  className='w-full'
                />
              </div>
            )}

            {/* Import Progress */}
            {isImporting && importProgress > 0 && (
              <div className='space-y-2'>
                <div className='flex justify-between text-sm'>
                  <span className='text-gray-600 dark:text-gray-400'>
                    {importProgress < 30
                      ? 'Validating backup...'
                      : importProgress < 50
                        ? 'Preparing import...'
                        : 'Importing data...'}
                  </span>
                  <span className='text-gray-600 dark:text-gray-400'>
                    {importProgress}%
                  </span>
                </div>
                <Progress
                  value={importProgress}
                  color='secondary'
                  size='sm'
                  className='w-full'
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Mock Data Generation */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Settings className='h-5 w-5 text-green-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              {t('dataManagement.sampleData')}
            </h3>
          </div>

          <p className='text-gray-600 dark:text-gray-400'>
            {t('dataManagement.sampleDataDescription')}
          </p>

          <div className='flex gap-3'>
            <Button
              color='success'
              variant='flat'
              startContent={<Database className='h-4 w-4' />}
              onPress={generateMockData}
              isLoading={isGeneratingMockData}
            >
              {isGeneratingMockData
                ? t('dataManagement.generating')
                : t('dataManagement.generateSampleData')}
            </Button>

            <Button
              color='primary'
              variant='flat'
              startContent={<Download className='h-4 w-4' />}
              onPress={handleTestBackup}
              isDisabled={isExporting || isImporting}
            >
              Test Backup
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Privacy Controls */}
      <Card>
        <CardBody className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Shield className='h-5 w-5 text-purple-600' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              {t('dataManagement.privacyControls')}
            </h3>
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='font-medium text-gray-900 dark:text-white'>
                  {t('dataManagement.showAILogs')}
                </p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  {t('dataManagement.showAILogsDescription')}
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
              {t('dataManagement.viewPrivacySettings')}
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
              {t('dataManagement.dangerZone')}
            </h3>
          </div>

          <p className='text-red-700 dark:text-red-300'>
            {t('dataManagement.dangerZoneDescription')}
          </p>

          <Button
            color='danger'
            variant='flat'
            startContent={<Trash2 className='h-4 w-4' />}
            onPress={onResetOpen}
          >
            {t('dataManagement.clearAllData')}
          </Button>
        </CardBody>
      </Card>

      {/* Reset Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalContent>
          <ModalHeader className='text-red-600 dark:text-red-400'>
            {t('reset.title')}
          </ModalHeader>
          <ModalBody>
            {!showFinalConfirmation ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800'>
                  <AlertTriangle className='h-6 w-6 text-red-600 dark:text-red-400' />
                  <div>
                    <p className='font-semibold text-red-900 dark:text-red-200'>
                      {t('reset.warning')}
                    </p>
                    <p className='text-sm text-red-700 dark:text-red-300'>
                      {t('reset.warningDescription')}
                    </p>
                  </div>
                </div>

                <div className='space-y-3'>
                  <p className='font-medium text-gray-900 dark:text-white'>
                    {t('reset.willDelete')}
                  </p>
                  <ul className='list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4'>
                    <li>{t('reset.allTasks')}</li>
                    <li>{t('reset.timerSessions')}</li>
                    <li>{t('reset.aiHistory')}</li>
                    <li>{t('reset.userPreferences')}</li>
                    <li>{t('reset.allData')}</li>
                  </ul>
                </div>

                <p className='text-gray-600 dark:text-gray-400'>
                  {t('reset.considerBackup')}
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='flex items-center gap-3 p-4 bg-red-100 dark:bg-red-950/50 rounded-lg border-2 border-red-300 dark:border-red-700'>
                  <AlertTriangle className='h-8 w-8 text-red-600 dark:text-red-400' />
                  <div>
                    <p className='font-bold text-red-900 dark:text-red-200 text-lg'>
                      {t('reset.finalConfirmation')}
                    </p>
                    <p className='text-sm text-red-700 dark:text-red-300'>
                      {t('reset.lastChance')}
                    </p>
                  </div>
                </div>

                <div className='text-center space-y-3'>
                  <p className='font-semibold text-gray-900 dark:text-white'>
                    {t('reset.absolutelySure')}
                  </p>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {t('reset.appWillRestart')}
                  </p>
                </div>

                {isClearingData && (
                  <div className='text-center'>
                    <Progress
                      size='sm'
                      isIndeterminate
                      color='danger'
                      className='max-w-md mx-auto'
                      label={t('reset.clearingData')}
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
                  {t('common.cancel')}
                </Button>
                <Button color='danger' onPress={handleShowFinalConfirmation}>
                  {t('reset.continueToFinal')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant='light'
                  onPress={handleCancelFinalConfirmation}
                  isDisabled={isClearingData}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  color='danger'
                  onPress={handleClearDatabase}
                  isLoading={isClearingData}
                  isDisabled={isClearingData}
                >
                  {isClearingData
                    ? t('reset.clearingDataProgress')
                    : t('reset.yesDeleteAll')}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Privacy Settings Modal */}
      <Modal isOpen={isPrivacyOpen} onClose={onPrivacyClose} size='2xl'>
        <ModalContent>
          <ModalHeader>{t('privacy.title')}</ModalHeader>
          <ModalBody>
            <div className='space-y-6'>
              <div className='space-y-4'>
                <h4 className='font-semibold text-gray-900 dark:text-white'>
                  {t('privacy.dataStorage')}
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg'>
                    <CheckCircle className='h-5 w-5 text-green-600' />
                    <div>
                      <p className='font-medium text-green-900 dark:text-green-100'>
                        {t('privacy.localStorageOnly')}
                      </p>
                      <p className='text-sm text-green-700 dark:text-green-300'>
                        {t('privacy.localStorageDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <h4 className='font-semibold text-gray-900 dark:text-white'>
                  {t('privacy.aiInteractions')}
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                    <Info className='h-5 w-5 text-blue-600' />
                    <div>
                      <p className='font-medium text-blue-900 dark:text-blue-100'>
                        {t('privacy.aiDataUsage')}
                      </p>
                      <p className='text-sm text-blue-700 dark:text-blue-300'>
                        {t('privacy.aiDataUsageDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color='primary' onPress={onPrivacyClose}>
              {t('privacy.close')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
