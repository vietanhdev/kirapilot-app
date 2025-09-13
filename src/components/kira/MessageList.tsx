import { useEffect, useState, useCallback } from 'react';
import { Avatar, Button } from '@heroui/react';
import { Bot, User, Check, Info } from 'lucide-react';
import { ThreadMessage, ThreadAssignment } from '../../types/thread';
import { UserFeedback } from '../../types/aiLogging';
import { MarkdownRenderer, MessageSkeleton } from '../common';
import { MessageActions } from '../ai/MessageActions';
import { useTranslation } from '../../hooks/useTranslation';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface MessageListProps {
  messages: ThreadMessage[];
  isLoading: boolean;
  threadAssignment?: ThreadAssignment;
  className?: string;
  // Callback functions for AI integration
  _onFeedbackSubmit?: (
    messageId: string,
    feedback: UserFeedback
  ) => Promise<void>;
  onRegenerateResponse?: (messageId: string) => Promise<void>;
  // Loading states for specific operations
  isRegenerating?: boolean;
}

/**
 * Component that displays a list of thread messages
 * Reuses existing chat UI components for consistency
 */
export function MessageList({
  messages,
  isLoading,
  threadAssignment,
  className = '',
  _onFeedbackSubmit,
  onRegenerateResponse,
  isRegenerating,
}: MessageListProps) {
  const { t } = useTranslation();
  const { scrollRef, scrollToBottom } = useAutoScroll();
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show loading skeleton when loading
  if (isLoading && messages.length === 0) {
    return (
      <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${className}`}>
        <MessageSkeleton />
        <MessageSkeleton />
      </div>
    );
  }

  // Empty state when no messages
  if (messages.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <div className='text-center'>
          <Bot className='w-12 h-12 mx-auto mb-3 text-default-400' />
          <p className='text-default-500 text-sm'>
            {t('kira.chat.noMessages')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto min-h-0 ${className}`}
    >
      <div className='p-6 space-y-4'>
        {messages.map(message => (
          <MessageItem
            key={message.id}
            message={message}
            threadAssignment={threadAssignment}
            onFeedbackSubmit={_onFeedbackSubmit}
            onRegenerateResponse={onRegenerateResponse}
            isRegenerating={isRegenerating}
          />
        ))}

        {/* Loading skeleton for new message */}
        {isLoading && <MessageSkeleton />}
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: ThreadMessage;
  threadAssignment?: ThreadAssignment;
  onFeedbackSubmit?: (
    messageId: string,
    feedback: UserFeedback
  ) => Promise<void>;
  onRegenerateResponse?: (messageId: string) => Promise<void>;
  isRegenerating?: boolean;
}

/**
 * Individual message item component
 * Handles both user and assistant messages with different layouts
 */
function MessageItem({
  message,
  onFeedbackSubmit: _onFeedbackSubmit,
  onRegenerateResponse,
  isRegenerating,
}: MessageItemProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  // Memoize the regenerate handler to prevent unnecessary re-renders
  const handleRegenerate = useCallback(() => {
    if (onRegenerateResponse) {
      onRegenerateResponse(message.id);
    }
  }, [onRegenerateResponse, message.id]);

  // Note: threadAssignment could be used to fetch task details from database
  // and pass to ContextualActionButtons for better context

  if (message.type === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='flex items-start gap-2 max-w-[80%] group'>
          <div className='bg-primary-500 text-white px-3 py-2 rounded-lg text-sm flex-1 relative'>
            <MarkdownRenderer
              content={message.content}
              className='[&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white [&_code]:bg-primary-600 [&_pre]:bg-primary-600'
            />
          </div>
          <Avatar
            icon={<User className='w-4 h-4' />}
            size='sm'
            className='bg-content3 text-foreground flex-shrink-0'
          />
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className='flex justify-start'>
      <div className='flex items-start gap-2 max-w-[80%] group'>
        <Avatar
          icon={<Bot className='w-4 h-4 text-white' />}
          size='sm'
          className='bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0'
        />
        <div className='space-y-2 flex-1 relative'>
          {/* Show reasoning if available */}
          {message.reasoning && (
            <div className='bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-primary-400'>
              <div className='flex items-center gap-1 mb-1'>
                <Bot className='w-3 h-3 text-primary-500' />
                <span className='font-medium text-primary-700 dark:text-primary-300'>
                  {t('ai.status.reasoning')}
                </span>
              </div>
              <MarkdownRenderer
                content={message.reasoning}
                className='text-primary-600 dark:text-primary-200'
              />
            </div>
          )}

          {/* Show actions if available */}
          {message.actions && message.actions.length > 0 && (
            <div className='space-y-1'>
              {message.actions.map((action, index) => (
                <div
                  key={index}
                  className='bg-success-50 dark:bg-success-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-success-400'
                >
                  <div className='flex items-center gap-1 mb-1'>
                    <Check className='w-3 h-3 text-success-500' />
                    <span className='font-medium text-success-700 dark:text-success-300'>
                      Action: {action.type.replace(/_/g, ' ').toLowerCase()}
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
                      className='text-success-600 dark:text-success-200 [&_*]:text-success-600 dark:[&_*]:text-success-200'
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Show tool executions if available */}
          {message.toolExecutions && message.toolExecutions.length > 0 && (
            <div className='space-y-1'>
              {message.toolExecutions.map((execution, index) => (
                <div
                  key={index}
                  className='bg-default-50 dark:bg-default-100/10 px-3 py-2 rounded-lg text-xs border-l-2 border-default-300 dark:border-default-600'
                >
                  <div className='flex items-center gap-1 mb-1'>
                    <Check className='w-3 h-3 text-default-500 dark:text-default-400' />
                    <span className='font-medium text-default-700 dark:text-default-300'>
                      Tool: {execution.toolName}
                    </span>
                    {execution.executionTime && (
                      <span className='text-default-600 dark:text-default-400 ml-auto'>
                        {execution.executionTime}ms
                      </span>
                    )}
                  </div>
                  {execution.reasoning && (
                    <div className='mb-1'>
                      <MarkdownRenderer
                        content={execution.reasoning}
                        className='text-default-600 dark:text-default-300 [&_*]:text-default-600 dark:[&_*]:text-default-300'
                      />
                    </div>
                  )}
                  {execution.result !== null &&
                    execution.result !== undefined && (
                      <div className='bg-default-100 dark:bg-default-200/10 p-2 rounded text-xs border border-default-200 dark:border-default-700'>
                        <MarkdownRenderer
                          content={
                            typeof execution.result === 'string'
                              ? execution.result
                              : JSON.stringify(execution.result, null, 2)
                          }
                          className='text-default-700 dark:text-default-200 [&_*]:text-default-700 dark:[&_*]:text-default-200'
                        />
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Main response content */}
          <div className='relative'>
            <div className='bg-content2 px-3 py-2 rounded-lg text-sm border border-divider group'>
              <MarkdownRenderer content={message.content} />

              {/* Message Actions - Copy and Regenerate */}
              <MessageActions
                content={message.content}
                onRegenerate={
                  onRegenerateResponse ? handleRegenerate : undefined
                }
                isRegenerating={isRegenerating}
                className='absolute top-2 right-2'
              />
            </div>

            {/* Details button - shows message metadata */}
            <div className='absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition-opacity'>
              <Button
                isIconOnly
                size='sm'
                variant='flat'
                color='primary'
                className='h-6 w-6 min-w-6'
                title={t('common.viewDetails')}
                onPress={() => setShowDetails(!showDetails)}
              >
                <Info className='w-3 h-3' />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
