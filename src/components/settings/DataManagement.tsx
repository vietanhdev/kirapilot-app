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
  Chip,
  Select,
  SelectItem,
} from '@heroui/react';
import {
  Download,
  Upload,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Database,
  Bot,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Shuffle,
  Code,
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { resetDatabase } from '../../utils/resetDatabase';
import { forceClearData } from '../../utils/clearOldData';
import { Task, TaskStatus, Priority, DistractionLevel } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useDatabase } from '../../hooks/useDatabase';

interface DataManagementProps {
  className?: string;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  className = '',
}) => {
  const { conversations, clearConversation } = useAI();
  const { settings: privacySettings, updateSettings: updatePrivacySettings } =
    usePrivacy();
  const { t } = useTranslation();
  const { isInitialized } = useDatabase();

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
  const {
    isOpen: isAILogsOpen,
    onOpen: onAILogsOpen,
    onClose: onAILogsClose,
  } = useDisclosure();
  const {
    isOpen: isMockDataOpen,
    onOpen: onMockDataOpen,
    onClose: onMockDataClose,
  } = useDisclosure();

  // State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [showAILogs, setShowAILogs] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  const [mockDataCount, setMockDataCount] = useState('20');

  // Development Clear Database function
  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      t('common.clearDatabaseConfirm') ||
        'Are you sure you want to clear all database data? This action cannot be undone.\n\n' +
          'This will clear:\n' +
          '- All tasks and projects\n' +
          '- Timer sessions and history\n' +
          '- User preferences\n' +
          '- All other application data\n\n' +
          'The application will restart after clearing.'
    );

    if (confirmed) {
      try {
        // First try to clear the actual SQLite database
        try {
          const { resetDatabase: resetSqliteDatabase } = await import(
            '../../services/database/utils'
          );
          await resetSqliteDatabase();
          console.log('SQLite database cleared successfully');
        } catch (sqliteError) {
          console.warn(
            'SQLite database clear failed, trying mock database:',
            sqliteError
          );

          // Fallback to clearing localStorage (mock database)
          resetDatabase();
          console.log('Mock database cleared successfully');
        }

        // Clear additional data
        forceClearData();
        localStorage.removeItem('kirapilot-preferences');
        localStorage.removeItem('kirapilot-privacy-settings');
        localStorage.removeItem('kira_api_key');

        // Clear AI conversations
        clearConversation();

        // Force application restart to reinitialize everything
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (error) {
        console.error('Failed to clear database:', error);
        alert('Failed to clear database. Check console for details.');
      }
    }
  };

  // Mock data generation function
  const generateMockData = async () => {
    try {
      setIsGeneratingMockData(true);

      const count = parseInt(mockDataCount);
      const now = new Date();
      const mockTasks: Task[] = [];

      // Expanded task templates with more variety
      const taskTemplates = [
        // Work - Development
        {
          title: 'Implement user authentication system',
          description:
            'Build secure login/logout functionality with JWT tokens',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 480,
        },
        {
          title: 'Fix critical bug in payment processing',
          description: 'Debug and resolve payment gateway integration issues',
          category: 'work',
          priority: Priority.URGENT,
          estimate: 240,
        },
        {
          title: 'Refactor legacy codebase',
          description: 'Update old code to modern patterns and best practices',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 720,
        },
        {
          title: 'Write unit tests for user service',
          description: 'Achieve 90% test coverage for user management module',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 180,
        },
        {
          title: 'Deploy application to production',
          description:
            'Set up CI/CD pipeline and deploy to production environment',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 300,
        },
        {
          title: 'Optimize database queries',
          description: 'Improve query performance and add proper indexing',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 150,
        },
        {
          title: 'Design REST API endpoints',
          description:
            'Create comprehensive API documentation and implementation',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 360,
        },
        {
          title: 'Conduct code review session',
          description: 'Review team members pull requests and provide feedback',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 90,
        },

        // Work - Project Management
        {
          title: 'Plan Q4 project roadmap',
          description: 'Define objectives, milestones, and resource allocation',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 240,
        },
        {
          title: 'Client requirements gathering',
          description: 'Meet with stakeholders to understand project needs',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 180,
        },
        {
          title: 'Update project documentation',
          description: 'Ensure all project docs are current and accessible',
          category: 'work',
          priority: Priority.LOW,
          estimate: 120,
        },
        {
          title: 'Prepare sprint retrospective',
          description: 'Gather feedback and plan improvements for next sprint',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 60,
        },
        {
          title: 'Budget review and allocation',
          description: 'Analyze current spend and reallocate resources',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 150,
        },

        // Work - Meetings & Collaboration
        {
          title: 'Weekly team standup',
          description: 'Discuss progress, blockers, and upcoming tasks',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 30,
        },
        {
          title: 'Client presentation preparation',
          description: 'Create slides and demo for client meeting',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 180,
        },
        {
          title: 'Onboard new team member',
          description: 'Guide new hire through setup and introduce to team',
          category: 'work',
          priority: Priority.MEDIUM,
          estimate: 240,
        },
        {
          title: 'Performance review sessions',
          description: 'Conduct quarterly performance evaluations',
          category: 'work',
          priority: Priority.HIGH,
          estimate: 120,
        },

        // Personal - Health & Wellness
        {
          title: 'Morning workout routine',
          description: '45-minute strength training and cardio session',
          category: 'personal',
          priority: Priority.MEDIUM,
          estimate: 45,
        },
        {
          title: 'Meal prep for the week',
          description: 'Prepare healthy meals and snacks for busy weekdays',
          category: 'personal',
          priority: Priority.MEDIUM,
          estimate: 120,
        },
        {
          title: 'Medical checkup appointment',
          description: 'Annual physical examination and blood work',
          category: 'personal',
          priority: Priority.HIGH,
          estimate: 90,
        },
        {
          title: 'Meditation practice',
          description: 'Daily mindfulness meditation for stress reduction',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 20,
        },
        {
          title: 'Plan healthy grocery list',
          description: 'Research recipes and create nutritious shopping list',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 30,
        },

        // Personal - Life Management
        {
          title: 'Pay monthly bills',
          description:
            'Handle rent, utilities, insurance, and other recurring payments',
          category: 'personal',
          priority: Priority.HIGH,
          estimate: 45,
        },
        {
          title: 'Organize digital photos',
          description: 'Sort and backup photos from phone and camera',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 90,
        },
        {
          title: 'Call insurance company',
          description: 'Update policy information and check coverage',
          category: 'personal',
          priority: Priority.MEDIUM,
          estimate: 30,
        },
        {
          title: 'Research vacation destinations',
          description: 'Plan upcoming holiday trip and book accommodations',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 120,
        },
        {
          title: 'Declutter home office',
          description: 'Organize workspace and donate unused items',
          category: 'personal',
          priority: Priority.MEDIUM,
          estimate: 180,
        },

        // Learning - Technical Skills
        {
          title: 'Complete TypeScript course',
          description: 'Finish advanced TypeScript patterns and best practices',
          category: 'learning',
          priority: Priority.MEDIUM,
          estimate: 360,
        },
        {
          title: 'Study cloud architecture',
          description: 'Learn AWS/Azure services and design patterns',
          category: 'learning',
          priority: Priority.MEDIUM,
          estimate: 240,
        },
        {
          title: 'Practice algorithm challenges',
          description: 'Solve data structures and algorithms problems',
          category: 'learning',
          priority: Priority.LOW,
          estimate: 90,
        },
        {
          title: 'Read technical documentation',
          description: 'Study new framework documentation and examples',
          category: 'learning',
          priority: Priority.LOW,
          estimate: 60,
        },
        {
          title: 'Watch conference presentations',
          description: 'View latest tech talks from industry conferences',
          category: 'learning',
          priority: Priority.LOW,
          estimate: 120,
        },

        // Learning - Professional Development
        {
          title: 'Leadership training workshop',
          description: 'Attend management and leadership skills development',
          category: 'learning',
          priority: Priority.MEDIUM,
          estimate: 480,
        },
        {
          title: 'Industry networking event',
          description: 'Connect with professionals and learn about trends',
          category: 'learning',
          priority: Priority.LOW,
          estimate: 180,
        },
        {
          title: 'Complete certification exam',
          description: 'Take AWS Solutions Architect certification test',
          category: 'learning',
          priority: Priority.HIGH,
          estimate: 240,
        },
        {
          title: 'Read business strategy book',
          description: 'Study "Good Strategy Bad Strategy" for insights',
          category: 'learning',
          priority: Priority.LOW,
          estimate: 300,
        },

        // Creative & Hobbies
        {
          title: 'Write blog post',
          description: 'Share insights about recent project learnings',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 120,
        },
        {
          title: 'Photography session',
          description: 'Practice portrait photography techniques in local park',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 180,
        },
        {
          title: 'Learn guitar chord progression',
          description: 'Master new song and practice fingerpicking',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 60,
        },
        {
          title: 'Draw architectural sketches',
          description: 'Practice perspective drawing and shading techniques',
          category: 'personal',
          priority: Priority.LOW,
          estimate: 90,
        },
      ];

      const tags = {
        work: [
          'urgent',
          'meeting',
          'client',
          'deadline',
          'project',
          'team',
          'review',
          'analysis',
          'planning',
          'development',
          'bug-fix',
          'feature',
          'deployment',
          'testing',
          'documentation',
        ],
        personal: [
          'health',
          'family',
          'home',
          'fitness',
          'organization',
          'errands',
          'self-care',
          'finance',
          'travel',
          'medical',
          'maintenance',
          'shopping',
        ],
        learning: [
          'skill-development',
          'certification',
          'tutorial',
          'practice',
          'reading',
          'course',
          'technology',
          'professional-development',
          'conference',
          'networking',
          'research',
        ],
      };

      // Enhanced status distribution for more realistic data
      const getRandomStatus = () => {
        const rand = Math.random();
        if (rand < 0.4) {
          return TaskStatus.COMPLETED;
        } // 40% completed
        if (rand < 0.65) {
          return TaskStatus.PENDING;
        } // 25% pending
        if (rand < 0.9) {
          return TaskStatus.IN_PROGRESS;
        } // 25% in progress
        return TaskStatus.CANCELLED; // 10% cancelled
      };

      // Enhanced priority distribution
      const getRandomPriority = () => {
        const rand = Math.random();
        if (rand < 0.4) {
          return Priority.MEDIUM;
        } // 40% medium
        if (rand < 0.65) {
          return Priority.LOW;
        } // 25% low
        if (rand < 0.85) {
          return Priority.HIGH;
        } // 20% high
        return Priority.URGENT; // 15% urgent
      };

      for (let i = 0; i < count; i++) {
        const template =
          taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
        const status = getRandomStatus();
        const priority = getRandomPriority();

        // Generate realistic dates with wider range
        const createdDaysAgo = Math.floor(Math.random() * 60); // Created 0-60 days ago
        const createdAt = new Date(
          now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000
        );

        // More sophisticated scheduled date logic
        let scheduledDate: Date | undefined;
        const scheduleRandom = Math.random();
        if (scheduleRandom < 0.15) {
          // 15% no scheduled date (backlog)
          scheduledDate = undefined;
        } else if (scheduleRandom < 0.25) {
          // 10% scheduled in past (overdue)
          const pastDays = Math.floor(Math.random() * 14) + 1;
          scheduledDate = new Date(
            now.getTime() - pastDays * 24 * 60 * 60 * 1000
          );
        } else if (scheduleRandom < 0.4) {
          // 15% scheduled for today
          scheduledDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
        } else if (scheduleRandom < 0.55) {
          // 15% scheduled for tomorrow
          scheduledDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (scheduleRandom < 0.8) {
          // 25% scheduled for this week
          const futureDays = Math.floor(Math.random() * 7) + 2;
          scheduledDate = new Date(
            now.getTime() + futureDays * 24 * 60 * 60 * 1000
          );
        } else {
          // 20% scheduled for future weeks
          const futureDays = Math.floor(Math.random() * 21) + 8;
          scheduledDate = new Date(
            now.getTime() + futureDays * 24 * 60 * 60 * 1000
          );
        }

        // More realistic due date logic
        let dueDate: Date | undefined;
        if (Math.random() < 0.75) {
          // 75% have due dates
          const daysFromScheduled = scheduledDate
            ? Math.floor(Math.random() * 14) + 1 // 1-14 days after scheduled
            : Math.floor(Math.random() * 30) + 1; // 1-30 days from now if no scheduled date
          const baseDate = scheduledDate || now;
          dueDate = new Date(
            baseDate.getTime() + daysFromScheduled * 24 * 60 * 60 * 1000
          );
        }

        // Completion date for completed/cancelled tasks
        let completedAt: Date | undefined;
        if (
          status === TaskStatus.COMPLETED ||
          status === TaskStatus.CANCELLED
        ) {
          const maxCompletionDate = Math.min(createdDaysAgo, 30);
          const completedDaysAgo = Math.floor(
            Math.random() * maxCompletionDate
          );
          completedAt = new Date(
            now.getTime() - completedDaysAgo * 24 * 60 * 60 * 1000
          );
        }

        // More realistic actual time calculation
        let actualTime = 0;
        if (status === TaskStatus.IN_PROGRESS) {
          actualTime = Math.floor(
            template.estimate * (0.05 + Math.random() * 0.5)
          ); // 5-55% of estimate
        } else if (status === TaskStatus.COMPLETED) {
          // Vary more based on task complexity and priority
          const variationFactor =
            priority === Priority.URGENT
              ? 1.3
              : priority === Priority.HIGH
                ? 1.1
                : priority === Priority.MEDIUM
                  ? 1.0
                  : 0.9;
          actualTime = Math.floor(
            template.estimate * variationFactor * (0.7 + Math.random() * 0.6)
          ); // 70-130% with priority adjustment
        } else if (status === TaskStatus.CANCELLED) {
          actualTime = Math.floor(
            template.estimate * (0.1 + Math.random() * 0.3)
          ); // 10-40% for cancelled tasks
        }

        // More varied tag selection
        const categoryTags = tags[template.category as keyof typeof tags] || [];
        const numTags = Math.floor(Math.random() * 4) + 1; // 1-4 tags
        const selectedTags = categoryTags
          .sort(() => 0.5 - Math.random())
          .slice(0, numTags);

        // Generate UUID-like ID
        const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;

        const task: Task = {
          id,
          title: template.title,
          description: template.description,
          priority,
          status,
          dependencies: [], // For simplicity, no dependencies in mock data
          timeEstimate: template.estimate,
          actualTime,
          dueDate,
          scheduledDate,
          tags: selectedTags,
          projectId: undefined,
          parentTaskId: undefined,
          subtasks: [],
          completedAt,
          createdAt,
          updatedAt: new Date(
            Math.max(createdAt.getTime(), completedAt?.getTime() || 0)
          ),
        };

        mockTasks.push(task);
      }

      console.log(
        `Generated ${count} diverse mock tasks with enhanced variety`
      );

      // Save to appropriate database
      if (isInitialized) {
        // Save to actual database with improved transaction handling
        console.log('Saving mock data to actual database...');

        try {
          // Get database instance for direct inserts (bypassing repository transactions)
          const { getDatabase } = await import('../../services/database');
          const db = await getDatabase();

          console.log(
            'Database instance obtained, starting mock data creation...'
          );

          // Add delay to avoid transaction conflicts
          await new Promise(resolve => setTimeout(resolve, 100));

          const createdTasks: Task[] = [];
          let successfulTasks = 0;
          let failedTasks = 0;

          // Create tasks directly in database without repository transactions
          for (const [index, task] of mockTasks.entries()) {
            try {
              console.log(
                `Creating task ${index + 1}/${mockTasks.length}: ${task.title}`
              );

              // Insert task directly into database
              await db.execute(
                `INSERT INTO tasks (
                  id, title, description, priority, status, dependencies, 
                  time_estimate, actual_time, due_date, scheduled_date, 
                  tags, completed_at, created_at, updated_at, project_id, parent_task_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  task.id,
                  task.title,
                  task.description || '',
                  task.priority,
                  task.status,
                  JSON.stringify(task.dependencies || []),
                  task.timeEstimate || 0,
                  task.actualTime || 0,
                  task.dueDate?.toISOString() || null,
                  task.scheduledDate?.toISOString() || null,
                  JSON.stringify(task.tags || []),
                  task.completedAt?.toISOString() || null,
                  task.createdAt.toISOString(),
                  task.updatedAt.toISOString(),
                  task.projectId || null,
                  task.parentTaskId || null,
                ]
              );

              createdTasks.push(task);
              successfulTasks++;

              // Small delay between inserts to prevent overwhelming the database
              if (index % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } catch (error) {
              console.error(
                `Failed to create task ${index + 1}: ${task.title}`,
                error
              );
              failedTasks++;
            }
          }

          console.log(
            `Task creation complete: ${successfulTasks} successful, ${failedTasks} failed`
          );

          // Generate comprehensive time tracking data
          let savedTimeSessions = 0;
          let failedTimeSessions = 0;

          try {
            // Verify time_sessions table exists
            const tableExists = await db.select<Array<{ name: string }>>(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='time_sessions'"
            );
            console.log('Time sessions table exists:', tableExists.length > 0);

            if (tableExists.length === 0) {
              console.error('❌ time_sessions table does not exist!');
              throw new Error('time_sessions table not found');
            }

            // Check current session count
            const beforeCount = await db.select<{ count: number }[]>(
              'SELECT COUNT(*) as count FROM time_sessions'
            );
            console.log(
              'Time sessions before generation:',
              beforeCount[0]?.count || 0
            );

            // Generate time sessions for worked tasks
            for (const [taskIndex, task] of createdTasks.entries()) {
              if (
                task.status === TaskStatus.IN_PROGRESS ||
                task.status === TaskStatus.COMPLETED
              ) {
                console.log(
                  `Generating sessions for task ${taskIndex + 1}/${createdTasks.length}: ${task.title} (ID: ${task.id})`
                );

                // Advanced algorithm for time session generation
                const sessionGenerationAlgorithm = {
                  // Calculate number of sessions based on task characteristics
                  calculateSessionCount: (task: Task) => {
                    const baseSessionCount = Math.max(
                      1,
                      Math.floor(task.actualTime / 90)
                    ); // 1 session per 90 minutes
                    const priorityMultiplier = {
                      [Priority.URGENT]: 1.5,
                      [Priority.HIGH]: 1.2,
                      [Priority.MEDIUM]: 1.0,
                      [Priority.LOW]: 0.8,
                    }[task.priority];

                    const adjustedCount = Math.ceil(
                      baseSessionCount * priorityMultiplier
                    );
                    return Math.min(Math.max(1, adjustedCount), 6); // 1-6 sessions max
                  },

                  // Generate realistic session timings
                  generateSessionTiming: (
                    task: Task,
                    sessionIndex: number,
                    totalSessions: number
                  ) => {
                    const taskAge = Date.now() - task.createdAt.getTime();
                    Math.min(taskAge, 30 * 24 * 60 * 60 * 1000); // Max 30 days ago

                    // Distribute sessions across the task's lifetime
                    const sessionSlot = sessionIndex / totalSessions;
                    const timeSlotStart = taskAge * (1 - sessionSlot);
                    const timeSlotEnd = taskAge * (1 - (sessionSlot + 0.1));

                    const sessionTime =
                      timeSlotStart -
                      Math.random() * (timeSlotStart - timeSlotEnd);
                    return new Date(Date.now() - sessionTime);
                  },

                  // Calculate session duration based on task and session characteristics
                  calculateSessionDuration: (
                    task: Task,
                    _sessionIndex: number,
                    totalSessions: number
                  ) => {
                    const baseDuration = task.actualTime / totalSessions; // Distribute actual time
                    const variation = baseDuration * 0.3; // ±30% variation
                    const randomVariation =
                      (Math.random() - 0.5) * 2 * variation;

                    // Priority affects session length (urgent tasks = longer sessions)
                    const priorityMultiplier = {
                      [Priority.URGENT]: 1.3,
                      [Priority.HIGH]: 1.1,
                      [Priority.MEDIUM]: 1.0,
                      [Priority.LOW]: 0.9,
                    }[task.priority];

                    const finalDuration = Math.max(
                      10,
                      (baseDuration + randomVariation) * priorityMultiplier
                    );
                    return Math.floor(finalDuration);
                  },

                  // Generate productivity patterns
                  generateProductivityMetrics: (durationMinutes: number) => {
                    const pausedPercentage = Math.random() * 0.15; // 0-15% paused time
                    const pausedTime = Math.floor(
                      durationMinutes * 60 * 1000 * pausedPercentage
                    );

                    const productivityLevel = Math.random();
                    const distractionLevel =
                      productivityLevel < 0.3
                        ? DistractionLevel.FULL
                        : productivityLevel < 0.6
                          ? DistractionLevel.MODERATE
                          : DistractionLevel.MINIMAL;

                    return { pausedTime, distractionLevel };
                  },

                  // Generate session notes based on productivity and task
                  generateSessionNotes: (
                    task: Task,
                    sessionIndex: number,
                    totalSessions: number,
                    durationMinutes: number,
                    distractionLevel: DistractionLevel
                  ) => {
                    const sessionTypes = [
                      `Deep focus session on ${task.title}`,
                      `Productive work block - ${durationMinutes} minutes`,
                      `Making progress on ${task.title}`,
                      `Steady work session ${sessionIndex + 1}/${totalSessions}`,
                      `Focused development time`,
                      `Problem-solving session for ${task.title}`,
                      `Implementation work - good flow state`,
                      `Challenging but rewarding session`,
                    ];

                    const distractionNotes: Record<DistractionLevel, string[]> =
                      {
                        [DistractionLevel.FULL]: [
                          'Some interruptions but pushed through',
                          'Difficult to maintain focus',
                          'Lots of context switching',
                        ],
                        [DistractionLevel.MODERATE]: [
                          'Few minor distractions',
                          'Generally good focus',
                          'Solid work session',
                        ],
                        [DistractionLevel.MINIMAL]: [
                          'Excellent focus and flow',
                          'Highly productive session',
                          'Deep work achieved',
                        ],
                        [DistractionLevel.NONE]: [
                          'Perfect focus state',
                          'Ultimate productivity session',
                          'Complete immersion in work',
                        ],
                      };

                    const baseNote =
                      sessionTypes[
                        Math.floor(Math.random() * sessionTypes.length)
                      ];
                    const distractionNote =
                      distractionNotes[distractionLevel][
                        Math.floor(
                          Math.random() *
                            distractionNotes[distractionLevel].length
                        )
                      ];

                    return `${baseNote}. ${distractionNote}.`;
                  },

                  // Generate breaks for longer sessions
                  generateBreaks: (
                    startTime: Date,
                    durationMinutes: number
                  ) => {
                    const breaks = [];

                    // Add breaks for sessions longer than 60 minutes
                    if (durationMinutes > 60 && Math.random() < 0.4) {
                      // 40% chance
                      const numBreaks =
                        durationMinutes > 120
                          ? Math.floor(Math.random() * 3) + 1
                          : 1; // 1-3 breaks for long sessions

                      for (let i = 0; i < numBreaks; i++) {
                        const breakPosition = (i + 1) / (numBreaks + 1); // Distribute breaks evenly
                        const breakStart = new Date(
                          startTime.getTime() +
                            breakPosition * durationMinutes * 60 * 1000
                        );
                        const breakDuration =
                          Math.floor(Math.random() * 15) + 5; // 5-20 minutes
                        const breakEnd = new Date(
                          breakStart.getTime() + breakDuration * 60 * 1000
                        );

                        const breakReasons = [
                          'Coffee break - needed to recharge',
                          'Short break to clear mind',
                          'Stretch break for better focus',
                          'Quick break to avoid burnout',
                          'Hydration and movement break',
                          'Brief rest to maintain productivity',
                        ];

                        breaks.push({
                          id: `break-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`,
                          startTime: breakStart.toISOString(),
                          endTime: breakEnd.toISOString(),
                          reason:
                            breakReasons[
                              Math.floor(Math.random() * breakReasons.length)
                            ],
                        });
                      }
                    }

                    return breaks;
                  },
                };

                // Use the algorithm to generate sessions
                const numSessions =
                  sessionGenerationAlgorithm.calculateSessionCount(task);

                for (
                  let sessionIdx = 0;
                  sessionIdx < numSessions;
                  sessionIdx++
                ) {
                  try {
                    const sessionStartTime =
                      sessionGenerationAlgorithm.generateSessionTiming(
                        task,
                        sessionIdx,
                        numSessions
                      );
                    const sessionDurationMinutes =
                      sessionGenerationAlgorithm.calculateSessionDuration(
                        task,
                        sessionIdx,
                        numSessions
                      );
                    const sessionEndTime = new Date(
                      sessionStartTime.getTime() +
                        sessionDurationMinutes * 60 * 1000
                    );

                    const { pausedTime, distractionLevel } =
                      sessionGenerationAlgorithm.generateProductivityMetrics(
                        sessionDurationMinutes
                      );
                    const sessionNotes =
                      sessionGenerationAlgorithm.generateSessionNotes(
                        task,
                        sessionIdx,
                        numSessions,
                        sessionDurationMinutes,
                        distractionLevel
                      );
                    const breaks = sessionGenerationAlgorithm.generateBreaks(
                      sessionStartTime,
                      sessionDurationMinutes
                    );

                    // Determine if this should be an active session (only for in-progress tasks, last session)
                    const isLastSession = sessionIdx === numSessions - 1;
                    const isActive =
                      task.status === TaskStatus.IN_PROGRESS &&
                      isLastSession &&
                      Math.random() < 0.15; // 15% chance

                    const sessionId = `timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sessionIdx}-${taskIndex}`;

                    console.log(
                      `Creating session ${sessionIdx + 1}/${numSessions} for task ${task.title}:`,
                      {
                        sessionId,
                        taskId: task.id,
                        startTime: sessionStartTime.toISOString(),
                        endTime: isActive
                          ? 'ACTIVE'
                          : sessionEndTime.toISOString(),
                        durationMinutes: sessionDurationMinutes,
                        isActive,
                        breaks: breaks.length,
                        distractionLevel,
                        pausedTime,
                      }
                    );

                    // Insert session directly into time_sessions table
                    await db.execute(
                      `INSERT INTO time_sessions (
                        id, task_id, start_time, end_time, paused_time,
                        is_active, notes, breaks, created_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        sessionId,
                        task.id,
                        sessionStartTime.toISOString(),
                        isActive ? null : sessionEndTime.toISOString(),
                        pausedTime,
                        isActive ? 1 : 0,
                        sessionNotes,
                        JSON.stringify(breaks),
                        sessionStartTime.toISOString(),
                      ]
                    );

                    console.log(
                      `✅ Session ${sessionIdx + 1} inserted successfully for task: ${task.title}`
                    );
                    savedTimeSessions++;

                    // Small delay between session inserts
                    await new Promise(resolve => setTimeout(resolve, 5));
                  } catch (error) {
                    console.error(
                      `❌ Failed to create time session ${sessionIdx + 1} for task: ${task.title}`,
                      error
                    );
                    failedTimeSessions++;
                  }
                }

                // Small delay between tasks
                await new Promise(resolve => setTimeout(resolve, 20));
              }
            }

            // Check final session count
            const afterCount = await db.select<{ count: number }[]>(
              'SELECT COUNT(*) as count FROM time_sessions'
            );
            console.log(
              'Time sessions after generation:',
              afterCount[0]?.count || 0
            );
            console.log(
              'Net sessions created:',
              (afterCount[0]?.count || 0) - (beforeCount[0]?.count || 0)
            );
            console.log(
              `Time session creation complete: ${savedTimeSessions} successful, ${failedTimeSessions} failed`
            );

            // Show sample of created sessions for debugging
            if (savedTimeSessions > 0) {
              const sampleSessions = await db.select<
                Array<{
                  id: string;
                  task_id: string;
                  start_time: string;
                  end_time: string | null;
                  is_active: number;
                  notes: string;
                }>
              >(
                'SELECT id, task_id, start_time, end_time, is_active, notes FROM time_sessions ORDER BY created_at DESC LIMIT 5'
              );
              console.log('Sample of created sessions:', sampleSessions);
            }

            console.log(
              `✅ Generated ${successfulTasks} mock tasks and ${savedTimeSessions} time sessions successfully in database`
            );
          } catch (dbError) {
            console.error(
              '❌ Failed to generate time tracking data in database:',
              dbError
            );
            console.log(
              `Generated ${successfulTasks} mock tasks successfully in database (without time tracking data)`
            );
          }
        } catch (dbError) {
          console.error(
            '❌ Failed to access database for mock data generation:',
            dbError
          );
          console.log('Falling back to localStorage...');

          // Fallback to localStorage if database fails
          saveToLocalStorage(mockTasks);
        }
      } else {
        // Save to mock database (localStorage)
        console.log('Saving mock data to localStorage...');
        saveToLocalStorage(mockTasks);
      }

      // Show success and reload
      setTimeout(() => {
        onMockDataClose();
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to generate mock data:', error);
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  // Helper method to save to localStorage
  const saveToLocalStorage = (mockTasks: Task[]) => {
    const currentData = JSON.parse(
      localStorage.getItem('kirapilot-mock-db') ||
        '{"tasks": [], "timeSessions": []}'
    );

    // Generate time tracking sessions for localStorage using the same algorithm
    const mockTimeSessions = [];
    for (const task of mockTasks) {
      if (
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.COMPLETED
      ) {
        const numSessions = Math.max(1, Math.floor(task.actualTime / 90)); // 1 session per 90 minutes

        for (let sessionIdx = 0; sessionIdx < numSessions; sessionIdx++) {
          const taskAgeDays = Math.floor(
            (Date.now() - task.createdAt.getTime()) / (24 * 60 * 60 * 1000)
          );
          const maxSessionAge = Math.min(taskAgeDays, 30);
          const sessionAgeHours = Math.floor(
            Math.random() * maxSessionAge * 24
          );
          const sessionStartTime = new Date(
            Date.now() - sessionAgeHours * 60 * 60 * 1000
          );

          const baseDuration = Math.floor((task.actualTime || 0) / numSessions);
          const variation = Math.floor(Math.random() * 30);
          const sessionDurationMinutes = Math.max(10, baseDuration + variation);
          const sessionEndTime = new Date(
            sessionStartTime.getTime() + sessionDurationMinutes * 60 * 1000
          );

          const isLastSession = sessionIdx === numSessions - 1;
          const isActive =
            task.status === TaskStatus.IN_PROGRESS &&
            isLastSession &&
            Math.random() < 0.15;

          const sessionNotes = [
            `Working on ${task.title}`,
            `Focused session - ${sessionDurationMinutes} minutes`,
            `Session ${sessionIdx + 1} of ${numSessions}`,
            `Good productivity today`,
            `Making steady progress`,
          ][Math.floor(Math.random() * 5)];

          const session = {
            id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sessionIdx}`,
            taskId: task.id,
            startTime: sessionStartTime.toISOString(),
            endTime: isActive ? undefined : sessionEndTime.toISOString(),
            pausedTime: Math.floor(
              Math.random() * sessionDurationMinutes * 60 * 1000 * 0.05
            ), // 0-5% paused
            isActive: isActive,
            notes: sessionNotes,
            breaks: [], // Simplified for localStorage
            createdAt: sessionStartTime.toISOString(),
          };

          mockTimeSessions.push(session);
        }
      }
    }

    const newData = {
      ...currentData,
      tasks: [...(currentData.tasks || []), ...mockTasks],
      timeSessions: [...(currentData.timeSessions || []), ...mockTimeSessions],
      focusSessions: currentData.focusSessions || [],
      patterns: currentData.patterns || [],
      preferences: currentData.preferences || {},
      suggestions: currentData.suggestions || [],
    };

    localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
    console.log(
      `Generated ${mockTasks.length} mock tasks and ${mockTimeSessions.length} time sessions successfully in localStorage`
    );
  };

  const getDataSize = () => {
    try {
      const mockDb = localStorage.getItem('kirapilot-mock-db') || '{}';
      const preferences = localStorage.getItem('kirapilot-preferences') || '{}';
      const privacy =
        localStorage.getItem('kirapilot-privacy-settings') || '{}';

      const totalSize = mockDb.length + preferences.length + privacy.length;
      return (totalSize / 1024).toFixed(2); // KB
    } catch {
      return '0';
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      onExportOpen();

      // Simulate progress for better UX
      const progressSteps = [20, 40, 60, 80, 100];
      for (const progress of progressSteps) {
        setExportProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Create simple backup data
      const mockDb = JSON.parse(
        localStorage.getItem('kirapilot-mock-db') || '{}'
      );
      const preferences = JSON.parse(
        localStorage.getItem('kirapilot-preferences') || '{}'
      );

      const exportData = {
        tasks: mockDb.tasks || [],
        timeSessions: mockDb.timeSessions || [],
        focusSessions: mockDb.focusSessions || [],
        preferences,
        privacySettings,
        // Include AI conversations only if retention is enabled
        aiConversations: privacySettings.conversationRetention
          ? conversations
          : [],
        exportMetadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          appVersion: 'KiraPilot v1.0',
        },
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kirapilot-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        onExportClose();
        setExportProgress(0);
      }, 1000);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    onImportOpen();

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // Basic validation
        if (!importData.exportMetadata || !importData.exportMetadata.version) {
          throw new Error('Invalid backup file format');
        }

        // Simulate progress
        const progressSteps = [20, 40, 60, 80, 100];
        for (const progress of progressSteps) {
          setImportProgress(progress);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Restore data
        if (importData.tasks) {
          const currentData = JSON.parse(
            localStorage.getItem('kirapilot-mock-db') || '{}'
          );
          const newData = {
            ...currentData,
            tasks: importData.tasks,
            timeSessions: importData.timeSessions || [],
            focusSessions: importData.focusSessions || [],
          };
          localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
        }

        if (importData.preferences) {
          localStorage.setItem(
            'kirapilot-preferences',
            JSON.stringify(importData.preferences)
          );
        }

        if (importData.privacySettings) {
          localStorage.setItem(
            'kirapilot-privacy-settings',
            JSON.stringify(importData.privacySettings)
          );
        }

        // Clear AI conversations if not retaining them
        if (!privacySettings.conversationRetention) {
          clearConversation();
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import backup file. Please check the file format.');
      } finally {
        setIsImporting(false);
        setTimeout(() => {
          onImportClose();
          setImportProgress(0);
          // Reload to apply imported data
          window.location.reload();
        }, 1000);
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = () => {
    try {
      // Clear all localStorage data
      forceClearData();
      localStorage.removeItem('kirapilot-preferences');
      localStorage.removeItem('kirapilot-privacy-settings');
      localStorage.removeItem('kira_api_key');

      // Clear AI conversations
      clearConversation();

      // Reset database
      resetDatabase();

      onResetClose();
    } catch (error) {
      console.error('Failed to reset data:', error);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Data Export/Import Section */}
      <Card className='bg-content2 border-divider'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Database className='w-5 h-5 text-blue-400' />
            <h3 className='text-lg font-semibold text-foreground'>
              Data Management
            </h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 bg-content3 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-foreground'>
                  Export All Data
                </h4>
                <p className='text-xs text-foreground-600'>
                  Download a complete backup of your tasks, sessions, and
                  settings
                </p>
                <p className='text-xs text-foreground-500 mt-1'>
                  Current data size: {getDataSize()} KB
                </p>
              </div>
              <Button
                onPress={handleExportData}
                variant='bordered'
                size='sm'
                startContent={<Download className='w-4 h-4' />}
                isDisabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>

            <div className='flex items-center justify-between p-4 bg-content3 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-foreground'>
                  Import Data
                </h4>
                <p className='text-xs text-foreground-600'>
                  Restore from a previous backup file
                </p>
              </div>
              <Button
                as='label'
                variant='bordered'
                size='sm'
                startContent={<Upload className='w-4 h-4' />}
                isDisabled={isImporting}
              >
                {isImporting ? 'Importing...' : 'Import'}
                <input
                  type='file'
                  accept='.json'
                  onChange={handleImportData}
                  className='hidden'
                />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Development Tools Section */}
      <Card className='bg-orange-500/10 border-orange-500/20'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Code className='w-5 h-5 text-orange-400' />
            <h3 className='text-lg font-semibold text-orange-300'>
              Development Tools
            </h3>
            <Chip size='sm' color='warning' variant='flat'>
              DEV ONLY
            </Chip>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-orange-300'>
                  Generate Mock Data
                </h4>
                <p className='text-xs text-orange-400'>
                  Create realistic tasks with proper types for testing the
                  planner interface
                </p>
                <p className='text-xs text-orange-500 mt-1'>
                  Includes tasks scheduled for past, present, and future dates
                </p>
              </div>
              <Button
                onPress={onMockDataOpen}
                color='warning'
                variant='bordered'
                size='sm'
                startContent={<Shuffle className='w-4 h-4' />}
                isDisabled={isGeneratingMockData}
              >
                Generate Mock Data
              </Button>
            </div>

            <div className='flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-orange-300'>
                  Clear Database
                </h4>
                <p className='text-xs text-orange-400'>
                  Permanently delete all tasks, sessions, and settings from the
                  local database.
                </p>
              </div>
              <Button
                onPress={handleClearDatabase}
                color='danger'
                variant='bordered'
                size='sm'
                startContent={<Trash2 className='w-4 h-4' />}
              >
                Clear Database
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Privacy Controls Section */}
      <Card className='bg-content2 border-divider'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Shield className='w-5 h-5 text-green-400' />
            <h3 className='text-lg font-semibold text-foreground'>
              Privacy Controls
            </h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  AI Data Usage
                </label>
                <p className='text-xs text-foreground-600'>
                  Allow AI to learn from your usage patterns
                </p>
              </div>
              <Switch
                isSelected={privacySettings.aiDataUsage}
                onValueChange={checked =>
                  updatePrivacySettings({ aiDataUsage: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Conversation Retention
                </label>
                <p className='text-xs text-foreground-600'>
                  Keep AI conversation history for context
                </p>
              </div>
              <Switch
                isSelected={privacySettings.conversationRetention}
                onValueChange={checked =>
                  updatePrivacySettings({ conversationRetention: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Analytics Collection
                </label>
                <p className='text-xs text-foreground-600'>
                  Anonymous usage analytics to improve the app
                </p>
              </div>
              <Switch
                isSelected={privacySettings.analyticsCollection}
                onValueChange={checked =>
                  updatePrivacySettings({ analyticsCollection: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Crash Reporting
                </label>
                <p className='text-xs text-foreground-600'>
                  Send crash reports to help fix issues
                </p>
              </div>
              <Switch
                isSelected={privacySettings.crashReporting}
                onValueChange={checked =>
                  updatePrivacySettings({ crashReporting: checked })
                }
                size='sm'
              />
            </div>
          </div>

          <Divider className='bg-divider my-4' />

          <div className='space-y-3'>
            <Button
              onPress={onPrivacyOpen}
              variant='bordered'
              size='sm'
              startContent={<Settings className='w-4 h-4' />}
              className='w-full'
            >
              Advanced Privacy Settings
            </Button>

            <Button
              onPress={onAILogsOpen}
              variant='bordered'
              size='sm'
              startContent={<Bot className='w-4 h-4' />}
              className='w-full'
            >
              View AI Operation Logs
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Data Security Section */}
      <Card className='bg-green-500/10 border-green-500/20'>
        <CardBody className='p-6'>
          <div className='flex items-start gap-3'>
            <Shield className='w-5 h-5 text-green-400 mt-0.5' />
            <div>
              <h4 className='text-sm font-medium text-green-300 mb-2'>
                Local Data Storage
              </h4>
              <p className='text-xs text-green-400 mb-3'>
                All your personal data is stored locally on your device.
                KiraPilot never sends your tasks, time tracking data, or
                personal information to external servers.
              </p>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Tasks stored locally</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Time data encrypted</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>No cloud sync required</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Full user control</span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className='bg-red-500/10 border-red-500/20'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <AlertTriangle className='w-5 h-5 text-red-400' />
            <h3 className='text-lg font-semibold text-red-300'>Danger Zone</h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-red-300'>
                  Reset All Data
                </h4>
                <p className='text-xs text-red-400'>
                  Permanently delete all tasks, sessions, settings, and AI
                  conversations
                </p>
              </div>
              <Button
                onPress={onResetOpen}
                color='danger'
                variant='bordered'
                size='sm'
                startContent={<Trash2 className='w-4 h-4' />}
              >
                Reset Everything
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Export Progress Modal */}
      <Modal
        isOpen={isExportOpen}
        onClose={onExportClose}
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>Exporting Data</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <Progress value={exportProgress} className='w-full' />
              <p className='text-sm text-foreground-600 text-center'>
                {exportProgress < 100
                  ? 'Preparing your data...'
                  : 'Export complete!'}
              </p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Import Progress Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={onImportClose}
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>Importing Data</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <Progress value={importProgress} className='w-full' />
              <p className='text-sm text-foreground-600 text-center'>
                {importProgress < 100
                  ? 'Restoring your data...'
                  : 'Import complete!'}
              </p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalContent>
          <ModalHeader className='text-red-400'>Confirm Data Reset</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg'>
                <AlertTriangle className='w-5 h-5 text-red-400 mt-0.5' />
                <div>
                  <p className='text-sm text-red-300 font-medium mb-2'>
                    This action cannot be undone!
                  </p>
                  <p className='text-xs text-red-400'>
                    All your tasks, time sessions, focus sessions, AI
                    conversations, and settings will be permanently deleted.
                  </p>
                </div>
              </div>
              <p className='text-sm text-foreground'>
                Consider exporting your data first as a backup.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onResetClose}>
              Cancel
            </Button>
            <Button color='danger' onPress={handleResetAllData}>
              Reset Everything
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Advanced Privacy Settings Modal */}
      <Modal isOpen={isPrivacyOpen} onClose={onPrivacyClose} size='2xl'>
        <ModalContent>
          <ModalHeader>Advanced Privacy Settings</ModalHeader>
          <ModalBody>
            <div className='space-y-6'>
              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Data Collection
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <label className='text-sm text-foreground'>
                        Performance Metrics
                      </label>
                      <p className='text-xs text-foreground-600'>
                        Collect app performance data
                      </p>
                    </div>
                    <Switch
                      isSelected={privacySettings.performanceMetrics}
                      onValueChange={checked =>
                        updatePrivacySettings({ performanceMetrics: checked })
                      }
                      size='sm'
                    />
                  </div>
                </div>
              </div>

              <Divider className='bg-divider' />

              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  AI Data Handling
                </h4>
                <div className='space-y-3'>
                  <div className='p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg'>
                    <div className='flex items-start gap-2'>
                      <Info className='w-4 h-4 text-blue-400 mt-0.5' />
                      <div>
                        <p className='text-xs text-blue-300 font-medium'>
                          AI Processing
                        </p>
                        <p className='text-xs text-blue-400 mt-1'>
                          When AI features are used, only anonymized,
                          non-personal data is sent to cloud services for
                          processing. Your task content and personal information
                          never leave your device.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Divider className='bg-divider' />

              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Data Retention
                </h4>
                <div className='space-y-3'>
                  <div className='p-3 bg-content3 rounded-lg'>
                    <p className='text-xs text-foreground mb-2'>
                      AI Conversation History
                    </p>
                    <p className='text-xs text-foreground-600'>
                      Conversations: {conversations.length} stored locally
                    </p>
                    <Button
                      size='sm'
                      variant='bordered'
                      onPress={clearConversation}
                      className='mt-2'
                      startContent={<Trash2 className='w-3 h-3' />}
                    >
                      Clear All Conversations
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onPrivacyClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AI Operation Logs Modal */}
      <Modal isOpen={isAILogsOpen} onClose={onAILogsClose} size='3xl'>
        <ModalContent>
          <ModalHeader className='flex items-center gap-2'>
            <Bot className='w-5 h-5' />
            AI Operation Logs
            <Button
              size='sm'
              variant='light'
              onPress={() => setShowAILogs(!showAILogs)}
              startContent={
                showAILogs ? (
                  <EyeOff className='w-3 h-3' />
                ) : (
                  <Eye className='w-3 h-3' />
                )
              }
            >
              {showAILogs ? 'Hide Details' : 'Show Details'}
            </Button>
          </ModalHeader>
          <ModalBody>
            <div className='space-y-4 max-h-96 overflow-y-auto'>
              {conversations.length === 0 ? (
                <div className='text-center py-8'>
                  <Bot className='w-8 h-8 text-foreground-600 mx-auto mb-2' />
                  <p className='text-foreground-600'>No AI conversations yet</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div key={conv.id} className='p-4 bg-content3 rounded-lg'>
                    <div className='flex items-start justify-between mb-2'>
                      <div className='flex items-center gap-2'>
                        <Chip size='sm' variant='flat'>
                          #{index + 1}
                        </Chip>
                        <span className='text-xs text-foreground-600'>
                          {conv.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        {conv.actions.length > 0 && (
                          <Chip size='sm' color='primary' variant='flat'>
                            {conv.actions.length} actions
                          </Chip>
                        )}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div>
                        <p className='text-xs text-foreground-500 mb-1'>
                          User:
                        </p>
                        <p className='text-sm text-foreground bg-content2 p-2 rounded'>
                          {conv.message}
                        </p>
                      </div>

                      {showAILogs && (
                        <>
                          <div>
                            <p className='text-xs text-foreground-500 mb-1'>
                              AI Response:
                            </p>
                            <p className='text-sm text-foreground bg-content2 p-2 rounded'>
                              {conv.response}
                            </p>
                          </div>

                          {conv.reasoning && (
                            <div>
                              <p className='text-xs text-foreground-500 mb-1'>
                                Reasoning:
                              </p>
                              <p className='text-xs text-foreground-600 bg-content2 p-2 rounded'>
                                {conv.reasoning}
                              </p>
                            </div>
                          )}

                          {conv.actions.length > 0 && (
                            <div>
                              <p className='text-xs text-foreground-500 mb-1'>
                                Actions Taken:
                              </p>
                              <div className='space-y-1'>
                                {conv.actions.map((action, actionIndex) => (
                                  <div
                                    key={actionIndex}
                                    className='text-xs text-foreground-600 bg-content2 p-2 rounded'
                                  >
                                    <span className='font-medium'>
                                      {action.type}
                                    </span>
                                    {action.reasoning && (
                                      <p className='mt-1 text-foreground-500'>
                                        {action.reasoning}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onAILogsClose}>
              Close
            </Button>
            {conversations.length > 0 && (
              <Button
                color='danger'
                variant='bordered'
                onPress={() => {
                  clearConversation();
                  onAILogsClose();
                }}
                startContent={<Trash2 className='w-4 h-4' />}
              >
                Clear All Logs
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Mock Data Generation Modal */}
      <Modal isOpen={isMockDataOpen} onClose={onMockDataClose}>
        <ModalContent>
          <ModalHeader className='text-orange-400'>
            Generate Mock Data
          </ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg'>
                <Info className='w-5 h-5 text-orange-400 mt-0.5' />
                <div>
                  <p className='text-sm text-orange-300 font-medium mb-2'>
                    Development Feature
                  </p>
                  <p className='text-xs text-orange-400'>
                    This will generate realistic tasks with proper data types
                    for testing. Tasks will include various statuses,
                    priorities, and dates (past, present, future).
                  </p>
                </div>
              </div>

              <div>
                <label className='text-sm font-medium text-foreground block mb-2'>
                  Number of tasks to generate
                </label>
                <Select
                  selectedKeys={[mockDataCount]}
                  onSelectionChange={keys => {
                    const count = Array.from(keys)[0] as string;
                    setMockDataCount(count);
                  }}
                  className='w-full'
                  size='sm'
                  classNames={{
                    trigger:
                      'bg-content2 border-divider data-[hover=true]:bg-content3',
                  }}
                >
                  <SelectItem key='10'>10 tasks</SelectItem>
                  <SelectItem key='20'>20 tasks</SelectItem>
                  <SelectItem key='50'>50 tasks</SelectItem>
                  <SelectItem key='100'>100 tasks</SelectItem>
                </Select>
              </div>

              <div className='text-xs text-foreground-600'>
                <p className='mb-2'>Generated data will include:</p>
                <ul className='list-disc list-inside space-y-1 ml-2'>
                  <li>
                    <strong>Diverse Tasks:</strong> Work (development, project
                    management), personal (health, life management), learning
                    (technical skills, professional development), and creative
                    tasks
                  </li>
                  <li>
                    <strong>Realistic Status Distribution:</strong> 40%
                    completed, 25% pending, 25% in progress, 10% cancelled
                  </li>
                  <li>
                    <strong>Varied Priorities:</strong> 40% medium, 25% low, 20%
                    high, 15% urgent
                  </li>
                  <li>
                    <strong>Comprehensive Time Tracking:</strong> 1-4 time
                    sessions per task with realistic durations, breaks, and
                    productivity notes
                  </li>
                  <li>
                    <strong>Smart Scheduling:</strong> Tasks distributed across
                    backlog, overdue, today, tomorrow, this week, and future
                    weeks
                  </li>
                  <li>
                    <strong>Due Dates & Completion:</strong> 75% have due dates,
                    realistic completion times based on priority
                  </li>
                  <li>
                    <strong>Rich Metadata:</strong> Extensive tags, time
                    estimates, actual times, and session history
                  </li>
                  <li>
                    <strong>Active Sessions:</strong> Some in-progress tasks
                    will have active timer sessions
                  </li>
                </ul>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onMockDataClose}>
              Cancel
            </Button>
            <Button
              color='warning'
              onPress={generateMockData}
              isLoading={isGeneratingMockData}
            >
              {isGeneratingMockData ? 'Generating...' : 'Generate Mock Data'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
