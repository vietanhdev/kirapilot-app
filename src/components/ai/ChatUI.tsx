import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Input,
  Avatar,
  Chip,
  Spinner,
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
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useTimerContext } from '../../contexts/TimerContext';
import { AppContext, Priority, DistractionLevel } from '../../types';

interface ChatUIProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatUI({ isOpen, onClose, className = '' }: ChatUIProps) {
  const [message, setMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations]);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Card
        className={`fixed bottom-4 right-4 w-96 h-96 z-50 shadow-2xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <CardBody className='p-0 flex flex-col h-full'>
          {/* Header */}
          <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
            <div className='flex items-center gap-3'>
              <Avatar
                icon={<Bot className='w-5 h-5' />}
                className='bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0'
                size='sm'
              />
              <div className='flex-1'>
                <h3 className='font-semibold text-sm'>Kira AI</h3>
                <p className='text-xs text-gray-500'>
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
              >
                <Settings className='w-4 h-4' />
              </Button>
              <Button isIconOnly variant='light' size='sm' onPress={onClose}>
                <X className='w-4 h-4' />
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className='p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center gap-2'>
              <AlertCircle className='w-4 h-4' />
              {error}
            </div>
          )}

          {/* Messages */}
          <div className='flex-1 overflow-y-auto p-4 space-y-4'>
            {!isInitialized && (
              <div className='text-center text-gray-500 text-sm'>
                <Bot className='w-8 h-8 mx-auto mb-2 text-gray-400' />
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
              {conversations.map(conversation => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className='space-y-3'
                >
                  {/* User Message */}
                  <div className='flex justify-end'>
                    <div className='flex items-start gap-2 max-w-[80%]'>
                      <div className='bg-blue-500 text-white px-3 py-2 rounded-lg text-sm flex-1'>
                        {conversation.message}
                      </div>
                      <Avatar
                        icon={<User className='w-4 h-4' />}
                        size='sm'
                        className='bg-gray-400 flex-shrink-0'
                      />
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className='flex justify-start'>
                    <div className='flex items-start gap-2 max-w-[80%]'>
                      <Avatar
                        icon={<Bot className='w-4 h-4' />}
                        size='sm'
                        className='bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0'
                      />
                      <div className='bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm flex-1'>
                        {conversation.response}
                      </div>
                    </div>
                  </div>

                  <div className='text-xs text-gray-400 text-center'>
                    {formatTimestamp(conversation.timestamp)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className='flex justify-start'>
                <div className='flex items-start gap-2'>
                  <Avatar
                    icon={<Bot className='w-4 h-4' />}
                    size='sm'
                    className='bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0'
                  />
                  <div className='bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg'>
                    <Spinner size='sm' />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className='border-t border-gray-200 dark:border-gray-700 p-3'>
              <div className='flex items-center gap-2 mb-2'>
                <Lightbulb className='w-4 h-4 text-yellow-500' />
                <span className='text-xs font-medium text-gray-600 dark:text-gray-400'>
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
          <div className='border-t border-gray-200 dark:border-gray-700 p-4'>
            <div className='flex gap-2'>
              <Input
                ref={inputRef}
                placeholder='Ask Kira anything...'
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                size='sm'
                className='flex-1'
                disabled={!isInitialized || isLoading}
              />
              <Button
                isIconOnly
                size='sm'
                color='primary'
                onPress={handleSendMessage}
                disabled={!message.trim() || !isInitialized || isLoading}
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
            <p className='text-sm text-gray-600 mb-4'>
              To use Kira AI, you need to provide a Google API key for Gemini.
            </p>
            <Input
              label='Google API Key'
              placeholder='Enter your Google API key'
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type='password'
            />
            <p className='text-xs text-gray-500 mt-2'>
              Your API key is stored locally and never shared. You can get a
              free API key from{' '}
              <a
                href='https://makersuite.google.com/app/apikey'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:underline'
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
