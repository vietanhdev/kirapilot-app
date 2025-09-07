import { useEffect, useState } from 'react';
import { Avatar, Button } from '@heroui/react';
import { Bot, User, Check, Info, Clock } from 'lucide-react';
import { ThreadMessage, ThreadAssignment } from '../../types/thread';
import { Task } from '../../types';
import { UserFeedback } from '../../types/aiLogging';
import { MarkdownRenderer, MessageSkeleton } from '../common';
import { ContextualActionButtons } from '../ai/ContextualActionButtons';
import { MessageActions } from '../ai/MessageActions';
import { FeedbackRatingButtons } from '../ai/FeedbackRatingButtons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { TaskService } from '../../services/database/repositories/TaskService';

interface MessageListProps {
  messages: ThreadMessage[];
  isLoading: boolean;
  threadAssignment?: ThreadAssignment;
  className?: string;
  // Callback functions for AI integration
  onFeedbackSubmit?: (
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
  onFeedbackSubmit,
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
    <div ref={scrollRef} className={`flex-1 overflow-y-auto ${className}`}>
      <div className='p-6 space-y-4'>
        {messages.map(message => (
          <MessageItem
            key={message.id}
            message={message}
            threadAssignment={threadAssignment}
            onFeedbackSubmit={onFeedbackSubmit}
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
  threadAssignment,
  onFeedbackSubmit,
  onRegenerateResponse,
  isRegenerating,
}: MessageItemProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  // Note: threadAssignment could be used to fetch task details from database
  // and pass to ContextualActionButtons for better context
  const hasAssignment = threadAssignment && threadAssignment.type !== 'general';

  if (message.type === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='flex items-start gap-2 max-w-[80%] group'>
          <div className='bg-primary-500 text-white px-3 py-2 rounded-lg text-sm flex-1 relative'>
            <MarkdownRenderer
              content={message.content}
              className='[&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_p]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white [&_code]:bg-primary-600 [&_pre]:bg-primary-600'
            />

            {/* Message timestamp for user messages */}
            <div className='flex items-center justify-end gap-1 text-xs text-primary-100 mt-1 opacity-70'>
              <Clock className='w-3 h-3' />
              <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
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
                  className='bg-secondary-50 dark:bg-secondary-900/20 px-3 py-2 rounded-lg text-xs border-l-2 border-secondary-400'
                >
                  <div className='flex items-center gap-1 mb-1'>
                    <Check className='w-3 h-3 text-secondary-500' />
                    <span className='font-medium text-secondary-700 dark:text-secondary-300'>
                      Tool: {execution.toolName}
                    </span>
                    {execution.executionTime && (
                      <span className='text-secondary-600 dark:text-secondary-200 ml-auto'>
                        {execution.executionTime}ms
                      </span>
                    )}
                  </div>
                  {execution.reasoning && (
                    <div className='mb-1'>
                      <MarkdownRenderer
                        content={execution.reasoning}
                        className='text-secondary-600 dark:text-secondary-200 [&_*]:text-secondary-600 dark:[&_*]:text-secondary-200'
                      />
                    </div>
                  )}
                  {execution.result !== null &&
                    execution.result !== undefined && (
                      <div className='bg-secondary-100 dark:bg-secondary-800/30 p-2 rounded text-xs'>
                        <MarkdownRenderer
                          content={
                            typeof execution.result === 'string'
                              ? execution.result
                              : JSON.stringify(execution.result, null, 2)
                          }
                          className='text-secondary-700 dark:text-secondary-200 [&_*]:text-secondary-700 dark:[&_*]:text-secondary-200'
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
                  onRegenerateResponse
                    ? () => onRegenerateResponse(message.id)
                    : undefined
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

          {/* Contextual Action Buttons - only show for assistant messages */}
          {message.type === 'assistant' && (
            <ThreadContextualActions
              message={message}
              threadAssignment={threadAssignment}
              onActionPerformed={(action, data) => {
                console.log('Action performed in thread:', action, data);
                // Handle action performed - could emit events or call callbacks
              }}
            />
          )}

          {/* Feedback Rating Buttons - only show for assistant messages */}
          {message.type === 'assistant' &&
            onFeedbackSubmit &&
            !message.userFeedback && (
              <div className='mt-2'>
                <FeedbackRatingButtons
                  conversationId={message.id}
                  onFeedbackSubmit={async (messageId, rating, feedback) => {
                    const userFeedback: UserFeedback = {
                      rating,
                      comment: feedback,
                      timestamp: new Date(),
                      categories: [
                        {
                          category: 'helpfulness',
                          rating,
                        },
                      ],
                    };
                    if (onFeedbackSubmit) {
                      await onFeedbackSubmit(messageId, userFeedback);
                    }
                  }}
                  compact={true}
                />
              </div>
            )}

          {/* Show submitted feedback */}
          {message.type === 'assistant' && message.userFeedback && (
            <div className='mt-2 text-xs text-success-600 flex items-center gap-1'>
              <Check className='w-3 h-3' />
              <span>
                {t('ai.feedback.submitted')} ({message.userFeedback.rating}/5)
                {message.userFeedback.comment &&
                  ` - ${message.userFeedback.comment}`}
              </span>
            </div>
          )}

          {/* Message timestamp and details */}
          <div className='flex items-center gap-2 text-xs text-default-400 mt-1'>
            <Clock className='w-3 h-3' />
            <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            {showDetails && (
              <div className='flex items-center gap-2 text-xs text-default-500'>
                <span>•</span>
                <span>ID: {message.id.slice(0, 8)}</span>
                {hasAssignment && (
                  <>
                    <span>•</span>
                    <span>Assigned to {threadAssignment?.type}</span>
                  </>
                )}
                {message.reasoning && (
                  <>
                    <span>•</span>
                    <span>Has reasoning</span>
                  </>
                )}
                {message.actions && message.actions.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{message.actions.length} actions</span>
                  </>
                )}
                {message.toolExecutions &&
                  message.toolExecutions.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{message.toolExecutions.length} tools</span>
                    </>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThreadContextualActionsProps {
  message: ThreadMessage;
  threadAssignment?: ThreadAssignment;
  onActionPerformed?: (action: string, data?: unknown) => void;
}

/**
 * Component that provides contextual actions for thread messages
 * Fetches task context when thread is assigned to a task
 */
function ThreadContextualActions({
  message,
  threadAssignment,
  onActionPerformed,
}: ThreadContextualActionsProps) {
  const [currentTask, setCurrentTask] = useState<Task | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const taskService = new TaskService();

  // Load task context when thread is assigned to a task
  useEffect(() => {
    if (threadAssignment?.type === 'task' && threadAssignment.taskId) {
      setIsLoading(true);
      taskService
        .findById(threadAssignment.taskId)
        .then(task => {
          setCurrentTask(task || undefined);
        })
        .catch(error => {
          console.warn('Failed to load task for contextual actions:', error);
          setCurrentTask(undefined);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setCurrentTask(undefined);
    }
  }, [threadAssignment, taskService]);

  // Don't show actions while loading task context
  if (isLoading) {
    return null;
  }

  return (
    <ContextualActionButtons
      context={{
        currentTask,
        mentionedTasks: [], // Could be extracted from message content in future
        suggestedActions: message.actions?.map(a => a.type) || [],
      }}
      compact={true}
      className='mt-2'
      onActionPerformed={onActionPerformed}
    />
  );
}
