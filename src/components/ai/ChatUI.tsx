import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, Button, Input, Avatar, Chip } from '@heroui/react';
import {
  Send,
  Bot,
  User,
  Lightbulb,
  X,
  Check,
  AlertCircle,
  Settings,
  Play,
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useTimerContext } from '../../contexts/TimerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useLoggingStatus } from '../../contexts/LoggingStatusContext';
import { AppContext, Priority } from '../../types';
import { MarkdownRenderer, MessageSkeleton } from '../common';
import {
  CollapsibleConversation,
  LoggingStatusIndicator,
  LoggingNotifications,
} from './';
import { LocalModelDiagnostics } from './LocalModelDiagnostics';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { useTranslation } from '../../hooks/useTranslation';

interface ChatUIProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatUI({ isOpen, onClose, className = '' }: ChatUIProps) {
  const [message, setMessage] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { scrollRef, isAutoScrollPaused, resumeAutoScroll } = useAutoScroll();
  const { t } = useTranslation();

  const {
    isInitialized,
    isLoading,
    error,
    conversations,
    suggestions,
    sendMessage,
    dismissSuggestion,
    applySuggestion,
    switchModel,
    currentModelType,
  } = useAI();

  const { activeTask, activeTaskId, hasActiveTimer } = useTimerContext();
  const { navigateTo } = useNavigation();
  const { preferences } = useSettings();
  const { recordCapture, recordCaptureError, isLoggingEnabled } =
    useLoggingStatus();

  // Auto-scroll is now handled by the useAutoScroll hook

  // Enhanced focus management
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Multiple attempts to ensure focus works reliably
      const focusInput = () => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus();
        }
      };

      // Immediate attempt
      focusInput();

      // Backup attempts with increasing delays
      const timeouts = [
        setTimeout(focusInput, 50),
        setTimeout(focusInput, 150),
        setTimeout(focusInput, 300),
      ];

      return () => {
        timeouts.forEach(clearTimeout);
      };
    }
  }, [isOpen]);

  // Re-focus input when loading state changes
  useEffect(() => {
    if (
      !isLoading &&
      isOpen &&
      inputRef.current &&
      !inputRef.current.disabled
    ) {
      setTimeout(() => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isLoading, isOpen]);

  const buildAppContext = (): AppContext => {
    const now = new Date();
    return {
      currentTask: activeTask,
      activeSession: hasActiveTimer
        ? {
            id: activeTaskId || '',
            taskId: activeTaskId || '',
            startTime: now, // This would need to be tracked properly
            pausedTime: 0,
            isActive: hasActiveTimer,
            notes: '',
            breaks: [],
            createdAt: now,
          }
        : undefined,
      activeFocusSession: undefined,
      focusMode: false,
      timeOfDay: now.toTimeString().slice(0, 5),
      dayOfWeek: now.getDay(),
      currentEnergy: 75, // Default energy level
      recentActivity: [],
      preferences,
    };
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) {
      return;
    }

    if (!isInitialized) {
      handleOpenSettings();
      return;
    }

    const context = buildAppContext();

    try {
      const response = await sendMessage(message, context);

      // Record successful capture if logging is enabled
      if (isLoggingEnabled && response) {
        recordCapture();
      }

      setMessage('');

      // Re-focus input after sending message
      setTimeout(() => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus();
        }
      }, 100);
    } catch (error) {
      // Record capture error if logging is enabled
      if (isLoggingEnabled) {
        recordCaptureError(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenSettings = () => {
    navigateTo('settings', { tab: 'ai' });
    onClose(); // Close the chat UI when navigating to settings
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'danger';
      case Priority.HIGH:
        return 'warning';
      case Priority.MEDIUM:
        return 'primary';
      case Priority.LOW:
        return 'default';
      default:
        return 'default';
    }
  };

  // Group conversations for collapsible sections (every 5 conversations)
  const groupedConversations = conversations.reduce(
    (groups, conversation, index) => {
      const groupIndex = Math.floor(index / 5);
      if (!groups[groupIndex]) {
        groups[groupIndex] = [];
      }
      groups[groupIndex].push(conversation);
      return groups;
    },
    [] as (typeof conversations)[]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Card
        className={`fixed bottom-4 right-4 w-96 h-96 z-50 shadow-2xl bg-content1 border border-divider backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      >
        <CardBody className='p-0 flex flex-col h-full'>
          {/* Header */}
          <div className='flex items-center justify-between p-4 border-b border-divider bg-content2 shadow-sm'>
            <div className='flex items-center gap-3'>
              <Avatar
                icon={<Bot className='w-5 h-5 text-white' />}
                className='bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0'
                size='sm'
              />
              <div className='flex-1'>
                <h3 className='font-semibold text-sm text-foreground'>
                  {t('ai.title')}
                </h3>
                <p className='text-xs text-foreground-600'>
                  {isInitialized
                    ? t('ai.status.ready')
                    : t('ai.status.setupRequired')}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <LoggingStatusIndicator
                size='sm'
                variant='detailed'
                showOperations={true}
                className='mr-1'
              />
              <Button
                isIconOnly
                variant='light'
                size='sm'
                onPress={handleOpenSettings}
                className='text-foreground-600 hover:text-foreground hover:bg-content3'
              >
                <Settings className='w-4 h-4' />
              </Button>
              <Button
                isIconOnly
                variant='light'
                size='sm'
                onPress={onClose}
                className='text-foreground-600 hover:text-foreground hover:bg-content3'
              >
                <X className='w-4 h-4' />
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className='p-3 bg-danger/10 border-b border-danger/20 text-danger text-sm'>
              <div className='flex items-center gap-2 mb-2'>
                <AlertCircle className='w-4 h-4' />
                <span>{error}</span>
              </div>

              {/* Show diagnostics button for local model errors */}
              {error.toLowerCase().includes('local') &&
                currentModelType === 'local' && (
                  <div className='flex gap-2 mt-2'>
                    <Button
                      size='sm'
                      variant='flat'
                      color='primary'
                      onPress={() => setShowDiagnostics(!showDiagnostics)}
                    >
                      {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
                    </Button>
                    <Button
                      size='sm'
                      variant='flat'
                      color='secondary'
                      onPress={() => switchModel('local')}
                    >
                      Retry Local Model
                    </Button>
                  </div>
                )}

              {/* Diagnostics Panel */}
              {showDiagnostics && error.toLowerCase().includes('local') && (
                <div className='mt-3'>
                  <LocalModelDiagnostics
                    onRetry={() => switchModel('local')}
                    isVisible={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className='flex-1 overflow-y-auto p-4 space-y-6 relative bg-content1'
          >
            {/* Auto-scroll control */}
            {isAutoScrollPaused && (
              <div className='sticky top-0 z-10 flex justify-center mb-2'>
                <Button
                  size='sm'
                  variant='flat'
                  color='primary'
                  startContent={<Play className='w-3 h-3' />}
                  onPress={resumeAutoScroll}
                >
                  {t('ai.button.resumeAutoScroll')}
                </Button>
              </div>
            )}

            {!isInitialized && (
              <div className='text-center text-foreground-600 text-sm'>
                <Bot className='w-8 h-8 mx-auto mb-2 text-foreground-500' />
                <p>{t('ai.welcome.title')}</p>
                <p className='mt-1'>{t('ai.welcome.description')}</p>
                <Button
                  size='sm'
                  color='primary'
                  className='mt-2'
                  onPress={handleOpenSettings}
                >
                  {t('ai.button.openSettings')}
                </Button>
              </div>
            )}

            <AnimatePresence>
              {/* Show recent conversations directly */}
              {conversations.length > 0 && conversations.length <= 10 && (
                <>
                  {conversations.map(conversation => (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className='space-y-6 group'
                    >
                      {/* User Message */}
                      <div className='flex justify-end'>
                        <div className='flex items-start gap-2 max-w-[80%] group'>
                          <div className='bg-primary-500 text-white px-3 py-2 rounded-lg text-sm flex-1'>
                            <MarkdownRenderer
                              content={conversation.message}
                              className='[&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white'
                            />
                          </div>
                          <Avatar
                            icon={<User className='w-4 h-4' />}
                            size='sm'
                            className='bg-content3 text-foreground flex-shrink-0'
                          />
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className='flex justify-start'>
                        <div className='flex items-start gap-2 max-w-[80%] group'>
                          <Avatar
                            icon={<Bot className='w-4 h-4 text-white' />}
                            size='sm'
                            className='bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0'
                          />
                          <div className='space-y-2 flex-1 relative'>
                            {/* Show reasoning if available */}
                            {conversation.reasoning && (
                              <div className='bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-primary-400'>
                                <div className='flex items-center gap-1 mb-1'>
                                  <Bot className='w-3 h-3 text-primary-500' />
                                  <span className='font-medium text-primary-700 dark:text-primary-300'>
                                    {t('ai.status.reasoning')}
                                  </span>
                                </div>
                                <MarkdownRenderer
                                  content={conversation.reasoning}
                                  className='text-primary-600 dark:text-primary-200'
                                />
                              </div>
                            )}

                            {/* Show tool executions if available */}
                            {conversation.actions &&
                              conversation.actions.length > 0 && (
                                <div className='space-y-1'>
                                  {conversation.actions.map((action, index) => (
                                    <div
                                      key={index}
                                      className='bg-success-50 dark:bg-success-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-success-400'
                                    >
                                      <div className='flex items-center gap-1 mb-1'>
                                        <Check className='w-3 h-3 text-success-500' />
                                        <span className='font-medium text-success-700 dark:text-success-300'>
                                          {t('ai.status.action')}:{' '}
                                          {action.type
                                            .replace('_', ' ')
                                            .toLowerCase()}
                                        </span>
                                        {action.confidence && (
                                          <span className='text-success-600 dark:text-success-200 ml-auto'>
                                            {action.confidence}%{' '}
                                            {t('ai.status.confidence')}
                                          </span>
                                        )}
                                      </div>
                                      {action.reasoning && (
                                        <MarkdownRenderer
                                          content={action.reasoning}
                                          className='text-success-600 dark:text-success-200'
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                            {/* Main response with markdown */}
                            <div className='bg-content2 px-3 py-2 rounded-lg text-sm border border-divider'>
                              <MarkdownRenderer
                                content={conversation.response}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='text-xs text-foreground-500 text-center'>
                        {formatTimestamp(conversation.timestamp)}
                      </div>
                    </motion.div>
                  ))}
                </>
              )}

              {/* Show collapsible sections for longer conversations */}
              {conversations.length > 10 && (
                <>
                  {/* Show older conversations in collapsible sections */}
                  {groupedConversations
                    .slice(0, -2)
                    .map((group, groupIndex) => (
                      <CollapsibleConversation
                        key={`group-${groupIndex}`}
                        title={t('ai.conversation.title', {
                          number: groupIndex + 1,
                          count: group.length,
                        })}
                        defaultExpanded={false}
                        className='mb-4'
                      >
                        <div className='space-y-4'>
                          {group.map(conversation => (
                            <div
                              key={conversation.id}
                              className='space-y-4 group'
                            >
                              {/* User Message */}
                              <div className='flex justify-end'>
                                <div className='flex items-start gap-2 max-w-[80%] group'>
                                  <div className='bg-primary-500 text-white px-3 py-2 rounded-lg text-sm flex-1'>
                                    <MarkdownRenderer
                                      content={conversation.message}
                                      className='[&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white'
                                    />
                                  </div>
                                  <Avatar
                                    icon={<User className='w-4 h-4' />}
                                    size='sm'
                                    className='bg-content3 text-foreground flex-shrink-0'
                                  />
                                </div>
                              </div>

                              {/* AI Response */}
                              <div className='flex justify-start'>
                                <div className='flex items-start gap-2 max-w-[80%]'>
                                  <Avatar
                                    icon={
                                      <Bot className='w-4 h-4 text-white' />
                                    }
                                    size='sm'
                                    className='bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0'
                                  />
                                  <div className='space-y-2 flex-1 relative'>
                                    <div className='bg-content2 px-3 py-2 rounded-lg text-sm border border-divider'>
                                      <MarkdownRenderer
                                        content={conversation.response}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleConversation>
                    ))}

                  {/* Show recent conversations directly */}
                  {groupedConversations
                    .slice(-2)
                    .flat()
                    .map(conversation => (
                      <motion.div
                        key={conversation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className='space-y-6 group'
                      >
                        {/* User Message */}
                        <div className='flex justify-end'>
                          <div className='flex items-start gap-2 max-w-[80%] group'>
                            <div className='bg-primary-500 text-white px-3 py-2 rounded-lg text-sm flex-1'>
                              <MarkdownRenderer
                                content={conversation.message}
                                className='[&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white'
                              />
                            </div>
                            <Avatar
                              icon={<User className='w-4 h-4' />}
                              size='sm'
                              className='bg-content3 text-foreground flex-shrink-0'
                            />
                          </div>
                        </div>

                        {/* AI Response */}
                        <div className='flex justify-start'>
                          <div className='flex items-start gap-2 max-w-[80%]'>
                            <Avatar
                              icon={<Bot className='w-4 h-4 text-white' />}
                              size='sm'
                              className='bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0'
                            />
                            <div className='space-y-2 flex-1 relative'>
                              {/* Show reasoning if available */}
                              {conversation.reasoning && (
                                <div className='bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-primary-400'>
                                  <div className='flex items-center gap-1 mb-1'>
                                    <Bot className='w-3 h-3 text-primary-500' />
                                    <span className='font-medium text-primary-700 dark:text-primary-300'>
                                      {t('ai.status.reasoning')}
                                    </span>
                                  </div>
                                  <MarkdownRenderer
                                    content={conversation.reasoning}
                                    className='text-primary-600 dark:text-primary-200'
                                  />
                                </div>
                              )}

                              {/* Show tool executions if available */}
                              {conversation.actions &&
                                conversation.actions.length > 0 && (
                                  <div className='space-y-1'>
                                    {conversation.actions.map(
                                      (action, index) => (
                                        <div
                                          key={index}
                                          className='bg-success-50 dark:bg-success-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-success-400'
                                        >
                                          <div className='flex items-center gap-1 mb-1'>
                                            <Check className='w-3 h-3 text-success-500' />
                                            <span className='font-medium text-success-700 dark:text-success-300'>
                                              {t('ai.status.action')}:{' '}
                                              {action.type
                                                .replace('_', ' ')
                                                .toLowerCase()}
                                            </span>
                                            {action.confidence && (
                                              <span className='text-success-600 dark:text-success-200 ml-auto'>
                                                {action.confidence}%{' '}
                                                {t('ai.status.confidence')}
                                              </span>
                                            )}
                                          </div>
                                          {action.reasoning && (
                                            <MarkdownRenderer
                                              content={action.reasoning}
                                              className='text-success-600 dark:text-success-200'
                                            />
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                              {/* Main response with markdown */}
                              <div className='bg-content2 px-3 py-2 rounded-lg text-sm border border-divider'>
                                <MarkdownRenderer
                                  content={conversation.response}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className='text-xs text-foreground-500 text-center'>
                          {formatTimestamp(conversation.timestamp)}
                        </div>
                      </motion.div>
                    ))}
                </>
              )}
            </AnimatePresence>

            {isLoading && <MessageSkeleton />}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className='border-t border-divider p-3 bg-content2 shadow-sm'>
              <div className='flex items-center gap-2 mb-2'>
                <Lightbulb className='w-4 h-4 text-yellow-500' />
                <span className='text-xs font-medium text-foreground-600'>
                  {t('ai.suggestions.title')}
                </span>
              </div>
              <div className='space-y-2 max-h-24 overflow-y-auto'>
                {suggestions.slice(0, 3).map(suggestion => (
                  <div
                    key={suggestion.id}
                    className='flex items-center justify-between text-xs'
                  >
                    <div className='flex-1 mr-2'>
                      <Chip
                        size='sm'
                        color={getPriorityColor(suggestion.priority)}
                        variant='flat'
                        className='text-xs'
                      >
                        {suggestion.title}
                      </Chip>
                    </div>
                    <div className='flex gap-1'>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={() => applySuggestion(suggestion.id)}
                      >
                        <Check className='w-3 h-3' />
                      </Button>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={() => dismissSuggestion(suggestion.id)}
                      >
                        <X className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className='border-t border-divider p-4 bg-content2 shadow-sm'>
            <div className='flex gap-2'>
              <Input
                ref={inputRef}
                placeholder={t('ai.placeholder')}
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Ensure input stays focused when possible
                  if (inputRef.current && !inputRef.current.disabled) {
                    inputRef.current.focus();
                  }
                }}
                size='sm'
                className='flex-1'
                classNames={{
                  input: 'bg-content1 text-foreground',
                  inputWrapper:
                    'bg-content1 border-divider data-[hover=true]:bg-content1 data-[focus=true]:bg-content1 data-[focus=true]:border-primary-500',
                }}
                disabled={!isInitialized || isLoading}
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck='false'
              />
              <Button
                isIconOnly
                size='sm'
                color='primary'
                onPress={handleSendMessage}
                disabled={!message.trim() || !isInitialized || isLoading}
                className={`min-w-8 h-8 ${
                  !message.trim() || !isInitialized || isLoading
                    ? 'opacity-50 bg-content3 text-foreground-500'
                    : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md'
                }`}
              >
                <Send className='w-4 h-4' />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Logging notifications */}
      <LoggingNotifications position='bottom-right' />
    </>
  );
}
