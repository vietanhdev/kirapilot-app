import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Textarea,
  Divider,
} from '@heroui/react';
import { useAI } from '../../contexts/AIContext';
import { LogStorageService } from '../../services/database/repositories/LogStorageService';
import { LoggingConfigService } from '../../services/database/repositories/LoggingConfigService';
import { AppContext, Priority, DistractionLevel } from '../../types';
import { LoggingConfig } from '../../types/aiLogging';

export function AILoggingTest() {
  const { sendMessage, isInitialized } = useAI();
  const [testMessage, setTestMessage] = useState('Create a test task');
  const [response, setResponse] = useState<string>('');
  const [logs, setLogs] = useState<unknown[]>([]);
  const [config, setConfig] = useState<
    LoggingConfig | { error: string } | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  const mockContext: AppContext = {
    currentTask: undefined,
    activeSession: undefined,
    activeFocusSession: undefined,
    focusMode: false,
    timeOfDay: new Date().toTimeString().slice(0, 5),
    dayOfWeek: new Date().getDay(),
    currentEnergy: 75,
    recentActivity: [],
    preferences: {
      workingHours: { start: '09:00', end: '17:00' },
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        breakInterval: 25,
      },
      focusPreferences: {
        defaultDuration: 25,
        distractionLevel: DistractionLevel.MINIMAL,
        backgroundAudio: { type: 'white_noise', volume: 50 },
      },
      notifications: {
        breakReminders: true,
        taskDeadlines: true,
        dailySummary: true,
        weeklyReview: true,
      },
      aiSettings: {
        conversationHistory: true,
        autoSuggestions: true,
        toolPermissions: true,
        responseStyle: 'balanced',
        suggestionFrequency: 'moderate',
      },
      taskSettings: {
        defaultPriority: Priority.MEDIUM,
        autoScheduling: false,
        smartDependencies: true,
        weekStartDay: 1,
        showCompletedTasks: true,
        compactView: false,
      },
      theme: 'auto',
      language: 'en',
      dateFormat: 'DD/MM/YYYY' as const,
    },
  };

  const handleSendMessage = async () => {
    if (!isInitialized) {
      setResponse('AI not initialized');
      return;
    }

    setIsLoading(true);
    try {
      const result = await sendMessage(testMessage, mockContext);
      setResponse(result ? JSON.stringify(result, null, 2) : 'No response');

      // Automatically check logs after sending message
      setTimeout(() => {
        handleCheckLogs();
      }, 1000);
    } catch (error) {
      console.error('🔍 Debug: Error sending message:', error);
      setResponse(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckLogs = async () => {
    setIsLoading(true);
    try {
      const logService = new LogStorageService();
      const recentLogs = await logService.getInteractionLogs({
        limit: 10,
        offset: 0,
      });
      setLogs(recentLogs);
    } catch (error) {
      console.error('🔍 Debug: Failed to get logs:', error);
      setLogs([
        { error: error instanceof Error ? error.message : 'Unknown error' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckConfig = async () => {
    setIsLoading(true);
    try {
      const configService = new LoggingConfigService();
      const currentConfig = await configService.getConfig();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to get config:', error);
      setConfig({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableLogging = async () => {
    setIsLoading(true);
    try {
      const configService = new LoggingConfigService();
      await configService.updateConfig({ enabled: true });
      setConfig(await configService.getConfig());
    } catch (error) {
      console.error('Failed to enable logging:', error);
      setConfig({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestDirectLog = async () => {
    setIsLoading(true);
    try {
      const logService = new LogStorageService();

      const testLogRequest = {
        sessionId: `test_session_${Date.now()}`,
        modelType: 'gemini' as const,
        modelInfo: {
          name: 'Test Model',
          provider: 'test',
        },
        userMessage: 'Test message from debug component',
        context: JSON.stringify(mockContext),
        aiResponse: 'Test response from debug component',
        actions: '[]',
        suggestions: '[]',
        responseTime: 1000,
        containsSensitiveData: false,
        dataClassification: 'public' as const,
      };

      const result = await logService.logInteraction(testLogRequest);
      setResponse(
        `Direct log created successfully: ${JSON.stringify(result, null, 2)}`
      );

      // Check logs after creating
      setTimeout(() => {
        handleCheckLogs();
      }, 500);
    } catch (error) {
      console.error('🔍 Debug: Failed to create direct log:', error);
      setResponse(
        `Direct log creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWithTools = async () => {
    setIsLoading(true);
    try {
      const logService = new LogStorageService();

      const testLogRequest = {
        sessionId: `test_session_${Date.now()}`,
        modelType: 'gemini' as const,
        modelInfo: {
          name: 'Test Model',
          provider: 'test',
        },
        userMessage:
          'Create a task, set a timer, and search for related documents',
        context: JSON.stringify(mockContext),
        aiResponse:
          "I'll create a task, set a timer, and search for related documents for you.",
        actions: JSON.stringify([
          {
            type: 'createTask',
            parameters: {
              title: 'Research Project',
              description:
                'A comprehensive research task with multiple components',
              priority: 'high',
              tags: ['research', 'important'],
              deadline: '2025-09-01',
            },
          },
          {
            type: 'startTimer',
            parameters: {
              duration: 2500,
              taskId: 'research-task-456',
              sessionType: 'focus',
              breakInterval: 300,
            },
          },
          {
            type: 'searchDocuments',
            parameters: {
              query: 'research methodology best practices',
              fileTypes: ['pdf', 'docx', 'md'],
              maxResults: 10,
              sortBy: 'relevance',
            },
          },
          {
            type: 'updateSettings',
            parameters: {
              notifications: {
                taskReminders: true,
                breakAlerts: true,
              },
              theme: 'dark',
              autoSave: true,
            },
          },
          {
            type: 'scheduleEvent',
            parameters: {
              title: 'Research Review Meeting',
              date: '2025-08-30',
              time: '14:00',
              duration: 60,
              attendees: ['team@example.com'],
            },
          },
        ]),
        suggestions: JSON.stringify([
          {
            type: 'suggestion',
            text: 'Consider breaking this large task into smaller subtasks',
          },
          {
            type: 'suggestion',
            text: 'Set up recurring reminders for progress check-ins',
          },
        ]),
        responseTime: 2200,
        containsSensitiveData: false,
        dataClassification: 'public' as const,
      };

      const result = await logService.logInteraction(testLogRequest);
      setResponse(
        `Log with multiple tools created successfully: ${JSON.stringify(result, null, 2)}`
      );

      // Check logs after creating
      setTimeout(() => {
        handleCheckLogs();
      }, 500);
    } catch (error) {
      console.error('🔍 Debug: Failed to create log with tools:', error);
      setResponse(
        `Log with tools creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSingleTool = async () => {
    setIsLoading(true);
    try {
      const logService = new LogStorageService();

      const testLogRequest = {
        sessionId: `test_session_${Date.now()}`,
        modelType: 'local' as const,
        modelInfo: {
          name: 'Local Test Model',
          provider: 'local',
        },
        userMessage: 'Delete the completed task',
        context: JSON.stringify(mockContext),
        aiResponse: "I'll delete the completed task for you.",
        actions: JSON.stringify([
          {
            type: 'deleteTask',
            parameters: {
              taskId: 'completed-task-789',
              reason: 'Task marked as completed',
              confirmDelete: true,
              archiveFirst: false,
            },
          },
        ]),
        suggestions: JSON.stringify([]),
        responseTime: 800,
        containsSensitiveData: false,
        dataClassification: 'internal' as const,
      };

      const result = await logService.logInteraction(testLogRequest);
      setResponse(
        `Log with single tool created successfully: ${JSON.stringify(result, null, 2)}`
      );

      // Check logs after creating
      setTimeout(() => {
        handleCheckLogs();
      }, 500);
    } catch (error) {
      console.error('🔍 Debug: Failed to create log with single tool:', error);
      setResponse(
        `Log with single tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLongMessage = async () => {
    const longMessage =
      `This is a very long test message that should be truncated in the logs view. `.repeat(
        10
      ) +
      `It contains multiple sentences and should demonstrate how the TruncatedMessage component works with long content. ` +
      `The message should be cut off at around 80 characters and show a "Show" button to view the full content in a modal dialog. ` +
      `This helps keep the logs table readable while still allowing users to access the full content when needed.`;

    setTestMessage(longMessage);
    await handleSendMessage();
  };

  return (
    <div className='space-y-4 p-4'>
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>AI Logging Debug Test</h3>
        </CardHeader>
        <CardBody className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>
              Test Message:
            </label>
            <Textarea
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              placeholder='Enter a test message for the AI'
              minRows={2}
            />
          </div>

          <div className='flex gap-2 flex-wrap'>
            <Button
              color='primary'
              onPress={handleSendMessage}
              isLoading={isLoading}
              isDisabled={!isInitialized}
            >
              Send Message
            </Button>
            <Button
              color='secondary'
              onPress={handleCheckLogs}
              isLoading={isLoading}
            >
              Check Logs
            </Button>
            <Button
              color='secondary'
              onPress={handleCheckConfig}
              isLoading={isLoading}
            >
              Check Config
            </Button>
            <Button
              color='success'
              onPress={handleEnableLogging}
              isLoading={isLoading}
            >
              Enable Logging
            </Button>
            <Button
              color='warning'
              onPress={handleTestDirectLog}
              isLoading={isLoading}
            >
              Test Direct Log
            </Button>
            <Button
              color='danger'
              onPress={handleTestWithTools}
              isLoading={isLoading}
            >
              Test Multiple Tools
            </Button>
            <Button
              color='secondary'
              onPress={handleTestSingleTool}
              isLoading={isLoading}
            >
              Test Single Tool
            </Button>
            <Button
              color='secondary'
              onPress={handleTestLongMessage}
              isLoading={isLoading}
            >
              Test Long Message
            </Button>
          </div>

          {response && (
            <>
              <Divider />
              <div>
                <h4 className='font-medium mb-2'>AI Response:</h4>
                <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto max-h-40'>
                  {response}
                </pre>
              </div>
            </>
          )}

          {config && (
            <>
              <Divider />
              <div>
                <h4 className='font-medium mb-2'>Logging Config:</h4>
                <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto max-h-40'>
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            </>
          )}

          {logs.length > 0 && (
            <>
              <Divider />
              <div>
                <h4 className='font-medium mb-2'>
                  Recent Logs ({logs.length}):
                </h4>
                <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto max-h-60'>
                  {JSON.stringify(logs, null, 2)}
                </pre>
              </div>
            </>
          )}

          <div className='text-sm text-gray-600 dark:text-gray-400'>
            <p>
              <strong>AI Status:</strong>{' '}
              {isInitialized ? 'Initialized' : 'Not Initialized'}
            </p>
            <p>
              <strong>Instructions:</strong>
            </p>
            <ol className='list-decimal list-inside space-y-1 mt-2'>
              <li>
                First, click "Enable Logging" to ensure logging is enabled
              </li>
              <li>
                Click "Test Direct Log" to test if the backend logging works
              </li>
              <li>
                Click "Test Single Tool" to create a log with one tool (shows as
                clickable chip)
              </li>
              <li>
                Click "Test Multiple Tools" to create a log with multiple tools
                (shows count with modal)
              </li>
              <li>
                Click "Test Long Message" to test truncated message display
              </li>
              <li>
                Then click "Send Message" to send a test message to the AI
              </li>
              <li>
                Finally, click "Check Logs" to see if interactions were logged
              </li>
              <li>
                Go to main Logs view to see detailed tool information with icons
                and colors
              </li>
            </ol>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
