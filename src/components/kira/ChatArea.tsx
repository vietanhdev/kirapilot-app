import { Card, CardBody } from '@heroui/react';
import { MessageCircle } from 'lucide-react';
import { Thread, ThreadMessage } from '../../types/thread';
import { UserFeedback } from '../../types/aiLogging';
import { useTranslation } from '../../hooks/useTranslation';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatAreaProps {
  thread: Thread | null;
  messages: ThreadMessage[];
  isLoading: boolean;
  isSending: boolean;
  onSendMessage: (message: string) => void;
  onFeedbackSubmit?: (
    messageId: string,
    feedback: UserFeedback
  ) => Promise<void>;
  onRegenerateResponse?: (messageId: string) => Promise<void>;
  onEscapePress?: () => void;
  className?: string;
  // Additional loading states
  isRegenerating?: boolean;
}

/**
 * Main chat interface component that displays messages and handles input
 * Shows empty state when no thread is selected
 */
export function ChatArea({
  thread,
  messages,
  isLoading,
  isSending,
  onSendMessage,
  onFeedbackSubmit,
  onRegenerateResponse,
  onEscapePress,
  className = '',

  isRegenerating = false,
}: ChatAreaProps) {
  const { t } = useTranslation();

  // Empty state when no thread is selected
  if (!thread) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <Card className='max-w-md'>
          <CardBody className='text-center py-12'>
            <MessageCircle className='w-16 h-16 mx-auto mb-4 text-default-400' />
            <h3 className='text-lg font-semibold mb-2 text-foreground'>
              {t('kira.chat.noThreadSelected')}
            </h3>
            <p className='text-default-500 text-sm'>
              {t('kira.chat.selectThreadToStart')}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${className}`}>
      {/* Chat Header */}
      <div className='border-b border-divider px-6 py-4 flex-shrink-0'>
        <h2 className='text-lg font-semibold text-foreground truncate'>
          {thread.title}
        </h2>
        {thread.assignment && (
          <div className='mt-1'>
            <span className='text-xs text-default-500'>
              {thread.assignment.type === 'task' &&
                t('kira.chat.assignedToTask')}
              {thread.assignment.type === 'day' && t('kira.chat.assignedToDay')}
              {thread.assignment.type === 'general' &&
                t('kira.chat.generalThread')}
            </span>
          </div>
        )}
      </div>

      {/* Message List */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        threadAssignment={thread.assignment}
        onFeedbackSubmit={onFeedbackSubmit}
        onRegenerateResponse={onRegenerateResponse}
        isRegenerating={isRegenerating}
        className='flex-1 min-h-0'
      />

      {/* Message Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        isLoading={isSending}
        disabled={isLoading || isSending}
        onEscapePress={onEscapePress}
        className='border-t border-divider flex-shrink-0'
      />
    </div>
  );
}
