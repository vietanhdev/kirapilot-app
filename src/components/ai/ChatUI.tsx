import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Input,
  Avatar,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
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
import { AppContext, Priority, DistractionLevel } from '../../types';
import { MarkdownRenderer, MessageSkeleton } from '../common';
import { MessageActions, CollapsibleConversation } from './';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface ChatUIProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatUI({ isOpen, onClose, className = '' }: ChatUIProps) {
  const [message, setMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { scrollRef, isAutoScrollPaused, resumeAutoScroll } = useAutoScroll();

  const {
    isInitialized,
    isLoading,
    error,
    conversations,
    suggestions,
    sendMessage,
    dismissSuggestion,
    applySuggestion,
    initializeWithApiKey,
  } = useAI();

  const { activeTask, activeTaskId, hasActiveTimer } = useTimerContext();

  const {
    isOpen: isApiModalOpen,
    onOpen: onApiModalOpen,
    onClose: onApiModalClose,
  } = useDisclosure();

  // Auto-scroll is now handled by the useAutoScroll hook

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
      },
    };
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) {
      return;
    }

    if (!isInitialized) {
      onApiModalOpen();
      return;
    }

    const context = buildAppContext();
    await sendMessage(message, context);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSetupApiKey = () => {
    if (apiKey.trim()) {
      initializeWithApiKey(apiKey.trim());
      setApiKey('');
      onApiModalClose();
    }
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

  const handleRegenerateResponse = async (conversationId: string) => {
    // Find the conversation and resend the original message
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      const context = buildAppContext();
      await sendMessage(conversation.message, context);
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
                  Kira AI
                </h3>
                <p className='text-xs text-foreground-600'>
                  {isInitialized ? 'Ready to help' : 'Setup required'}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                isIconOnly
                variant='light'
                size='sm'
                onPress={onApiModalOpen}
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
            <div className='p-3 bg-danger/10 border-b border-danger/20 text-danger text-sm flex items-center gap-2'>
              <AlertCircle className='w-4 h-4' />
              {error}
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
                  Resume auto-scroll
                </Button>
              </div>
            )}

            {!isInitialized && (
              <div className='text-center text-foreground-600 text-sm'>
                <Bot className='w-8 h-8 mx-auto mb-2 text-foreground-500' />
                <p>Welcome to Kira AI!</p>
                <p className='mt-1'>Setup your API key to get started.</p>
                <Button
                  size='sm'
                  color='primary'
                  className='mt-2'
                  onPress={onApiModalOpen}
                >
                  Setup API Key
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
                          <MessageActions
                            content={conversation.message}
                            className='mt-1 mr-1'
                          />
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
                                    Reasoning
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
                                          Action:{' '}
                                          {action.type
                                            .replace('_', ' ')
                                            .toLowerCase()}
                                        </span>
                                        {action.confidence && (
                                          <span className='text-success-600 dark:text-success-200 ml-auto'>
                                            {action.confidence}% confidence
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

                            <MessageActions
                              content={conversation.response}
                              onRegenerate={() =>
                                handleRegenerateResponse(conversation.id)
                              }
                              className='absolute -top-2 -right-2'
                            />
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
                        title={`Conversation ${groupIndex + 1} (${group.length} messages)`}
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
                                  <MessageActions
                                    content={conversation.message}
                                    className='mt-1 mr-1'
                                  />
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
                                    <MessageActions
                                      content={conversation.response}
                                      onRegenerate={() =>
                                        handleRegenerateResponse(
                                          conversation.id
                                        )
                                      }
                                      className='absolute -top-2 -right-2'
                                    />
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
                            <MessageActions
                              content={conversation.message}
                              className='mt-1 mr-1'
                            />
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
                                      Reasoning
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
                                              Action:{' '}
                                              {action.type
                                                .replace('_', ' ')
                                                .toLowerCase()}
                                            </span>
                                            {action.confidence && (
                                              <span className='text-success-600 dark:text-success-200 ml-auto'>
                                                {action.confidence}% confidence
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

                              <MessageActions
                                content={conversation.response}
                                onRegenerate={() =>
                                  handleRegenerateResponse(conversation.id)
                                }
                                className='absolute -top-2 -right-2'
                              />
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
                  Suggestions
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
                placeholder='Ask Kira anything...'
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                size='sm'
                className='flex-1'
                classNames={{
                  input: 'bg-content1 text-foreground',
                  inputWrapper:
                    'bg-content1 border-divider data-[hover=true]:bg-content1 data-[focus=true]:bg-content1 data-[focus=true]:border-primary-500',
                }}
                disabled={!isInitialized || isLoading}
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

      {/* API Key Setup Modal */}
      <Modal
        isOpen={isApiModalOpen}
        onClose={onApiModalClose}
        placement='center'
      >
        <ModalContent>
          <ModalHeader>Setup Kira AI</ModalHeader>
          <ModalBody>
            <p className='text-sm text-foreground-600 mb-4'>
              To use Kira AI, you need to provide a Google API key for Gemini.
            </p>
            <Input
              label='Google API Key'
              placeholder='Enter your Google API key'
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type='password'
            />
            <p className='text-xs text-foreground-500 mt-2'>
              Your API key is stored locally and never shared. You can get a
              free API key from{' '}
              <a
                href='https://makersuite.google.com/app/apikey'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary-500 hover:underline'
              >
                Google AI Studio
              </a>
              .
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onApiModalClose}>
              Cancel
            </Button>
            <Button
              color='primary'
              onPress={handleSetupApiKey}
              disabled={!apiKey.trim()}
            >
              Save & Connect
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
