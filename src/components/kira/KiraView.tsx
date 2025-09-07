import { useState, useEffect, useCallback, useRef } from 'react';
import { Thread } from '../../types/thread';
import { useThreads } from '../../hooks/useThreads';
import { useThreadMessages } from '../../hooks/useThreadMessages';
import { useToastContext } from '../../contexts/ToastContext';
import { ThreadSidebar } from './ThreadSidebar';
import { ChatArea } from './ChatArea';
import { ThreadAssignmentModal } from './ThreadAssignmentModal';
import { ErrorDisplay } from '../common/ErrorDisplay';
import {
  createRetryAction,
  globalDatabaseHealthChecker,
  globalAIServiceHealthChecker,
} from '../../utils/kiraErrorHandling';

/**
 * Main Kira chat view component with responsive design and keyboard shortcuts
 * Provides full-screen chat interface with thread management capabilities
 *
 * Keyboard shortcuts:
 * - Ctrl/Cmd + N: Create new thread
 * - Arrow Up/Down: Navigate between threads (when sidebar focused)
 * - Delete: Delete selected thread (when sidebar focused)
 * - Escape: Close modals or collapse mobile sidebar
 */
export function KiraView() {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentThreadId, setAssignmentThreadId] = useState<string | null>(
    null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [serviceHealth, setServiceHealth] = useState({
    database: true,
    ai: true,
    lastCheck: Date.now(),
  });

  const {
    threads,
    createThread,
    deleteThread,
    assignThread,
    isLoading: threadsLoading,
    isCreating,
    isDeleting,
    isUpdating,
    error: threadsError,
    clearError: clearThreadsError,
    retryLastOperation: retryThreadsOperation,
  } = useThreads();

  // Circuit breaker reset functionality available via console: kirapilot.resetCircuitBreaker()

  const {
    messages,
    sendMessage,
    isLoading: messagesLoading,
    isSending,

    isRegenerating,
    error: messagesError,
    clearError: clearMessagesError,
    retryLastOperation: retryMessagesOperation,
    submitFeedback,
    regenerateResponse,
  } = useThreadMessages(selectedThread?.id);

  const { showSuccess, showError, showWarning } = useToastContext();

  // Refs to avoid useEffect dependency issues
  const threadsRef = useRef(threads);
  const selectedThreadRef = useRef(selectedThread);
  const showAssignmentModalRef = useRef(showAssignmentModal);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);

  // Update refs when state changes
  threadsRef.current = threads;
  selectedThreadRef.current = selectedThread;
  showAssignmentModalRef.current = showAssignmentModal;
  sidebarCollapsedRef.current = sidebarCollapsed;

  // Keyboard shortcut handling
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when user is typing in an input field
    const target = event.target as HTMLElement;
    const isInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true';

    // Ctrl/Cmd + N for new thread (works globally in Kira view)
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === 'n' &&
      !isInputField
    ) {
      event.preventDefault();
      handleNewThread();
    }

    // Escape to close modals or collapse mobile sidebar
    if (event.key === 'Escape') {
      if (showAssignmentModalRef.current) {
        handleAssignmentCancel();
      } else if (!sidebarCollapsedRef.current && window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    }

    // Arrow keys for thread navigation (when sidebar is focused or no input is focused)
    if (!isInputField && threadsRef.current.length > 0) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // Only handle if we're in the sidebar area or no specific focus
        const inSidebar =
          target instanceof Element
            ? target.closest('[data-testid="thread-sidebar"]')
            : null;
        const noSpecificFocus =
          target instanceof Element
            ? !target.closest('button, input, textarea, [contenteditable]')
            : true;

        if (inSidebar || noSpecificFocus) {
          event.preventDefault();
          const currentIndex = threadsRef.current.findIndex(
            t => t.id === selectedThreadRef.current?.id
          );
          let newIndex;

          if (event.key === 'ArrowUp') {
            newIndex =
              currentIndex > 0
                ? currentIndex - 1
                : threadsRef.current.length - 1;
          } else {
            newIndex =
              currentIndex < threadsRef.current.length - 1
                ? currentIndex + 1
                : 0;
          }

          if (threadsRef.current[newIndex]) {
            handleThreadSelect(threadsRef.current[newIndex].id);
          }
        }
      }
    }

    // Delete key for thread deletion (when thread is selected and not in input field)
    if (event.key === 'Delete' && selectedThreadRef.current && !isInputField) {
      const inSidebar =
        target instanceof Element
          ? target.closest('[data-testid="thread-sidebar"]')
          : null;
      if (inSidebar) {
        event.preventDefault();
        handleThreadDelete(selectedThreadRef.current.id);
      }
    }
  }, []); // Empty dependency array since we use refs

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array since handleKeyDown uses refs

  // Periodic health check
  useEffect(() => {
    const checkServiceHealth = async () => {
      try {
        const [dbHealth, aiHealth] = await Promise.all([
          globalDatabaseHealthChecker.getCurrentHealth(),
          globalAIServiceHealthChecker.getCurrentHealth(),
        ]);

        setServiceHealth({
          database: dbHealth,
          ai: aiHealth,
          lastCheck: Date.now(),
        });
      } catch (error) {
        console.warn('Health check failed:', error);
      }
    };

    // Initial check
    checkServiceHealth();

    // Check every 30 seconds
    const interval = setInterval(checkServiceHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle responsive sidebar collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        // md breakpoint
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleThreadSelect = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    setSelectedThread(thread || null);

    // Auto-collapse sidebar on mobile after selection for better UX
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  const handleNewThread = async () => {
    // Check database health before attempting to create thread
    const isDbHealthy = await globalDatabaseHealthChecker.checkHealth();
    if (!isDbHealthy) {
      showError(
        'Database Unavailable',
        'Cannot create thread - database connection is currently unavailable. Please check your connection and try again.',
        createRetryAction(
          async () => {
            await globalDatabaseHealthChecker.forceHealthCheck();
            await handleNewThread();
          },
          'database_health_check',
          () =>
            showSuccess(
              'Connection restored',
              'Database connection has been restored.'
            ),
          () =>
            showError(
              'Connection failed',
              'Still unable to connect to database. Please try again later.'
            )
        )
      );
      return;
    }

    const newThread = await createThread();
    if (newThread) {
      setSelectedThread(newThread);
      showSuccess(
        'Thread created',
        'New conversation thread has been created successfully.'
      );
    } else if (threadsError) {
      showError(
        'Failed to create thread',
        threadsError.userMessage,
        threadsError.recoverable
          ? createRetryAction(
              () => handleNewThread(),
              'thread_create',
              () =>
                showSuccess(
                  'Thread created',
                  'Thread created successfully after retry.'
                ),
              error => showError('Retry failed', error.userMessage)
            )
          : undefined
      );
    }
  };

  const handleThreadDelete = async (threadId: string) => {
    const success = await deleteThread(threadId);
    if (success) {
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
      showSuccess('Thread deleted', 'Thread has been deleted successfully.');
    } else if (threadsError) {
      showError(
        'Failed to delete thread',
        threadsError.userMessage,
        threadsError.recoverable
          ? createRetryAction(
              () => handleThreadDelete(threadId),
              'thread_delete',
              () =>
                showSuccess(
                  'Thread deleted',
                  'Thread deleted successfully after retry.'
                ),
              error => showError('Retry failed', error.userMessage)
            )
          : undefined
      );
    }
  };

  const handleThreadAssign = (threadId: string) => {
    setAssignmentThreadId(threadId);
    setShowAssignmentModal(true);
  };

  const handleAssignmentSave = async (
    assignment: import('../../types/thread').ThreadAssignment
  ) => {
    if (assignmentThreadId) {
      const updatedThread = await assignThread(assignmentThreadId, assignment);
      if (updatedThread) {
        setShowAssignmentModal(false);
        setAssignmentThreadId(null);

        // Update selected thread if it's the one being assigned
        if (selectedThread?.id === assignmentThreadId) {
          setSelectedThread(updatedThread);
        }

        showSuccess(
          'Thread assigned',
          'Thread assignment has been updated successfully.'
        );
      } else if (threadsError) {
        showError(
          'Failed to assign thread',
          threadsError.userMessage,
          threadsError.recoverable
            ? createRetryAction(
                () => handleAssignmentSave(assignment),
                'thread_assign',
                () =>
                  showSuccess(
                    'Thread assigned',
                    'Thread assigned successfully after retry.'
                  ),
                error => showError('Retry failed', error.userMessage)
              )
            : undefined
        );
      }
    }
  };

  const handleAssignmentCancel = () => {
    setShowAssignmentModal(false);
    setAssignmentThreadId(null);
  };

  /**
   * Handle sending message with proper thread assignment context
   * This is the key integration point where assignment context is passed to AI
   */
  const handleSendMessage = async (message: string) => {
    if (!selectedThread) {
      showWarning(
        'No thread selected',
        'Please select or create a thread before sending a message.'
      );
      return;
    }

    // Check service health before sending message
    const [isDbHealthy, isAiHealthy] = await Promise.all([
      globalDatabaseHealthChecker.checkHealth(),
      globalAIServiceHealthChecker.checkHealth(),
    ]);

    if (!isDbHealthy) {
      showError(
        'Database Unavailable',
        'Cannot send message - database connection is currently unavailable.',
        createRetryAction(
          async () => {
            await globalDatabaseHealthChecker.forceHealthCheck();
            await handleSendMessage(message);
          },
          'database_health_check',
          () =>
            showSuccess(
              'Connection restored',
              'Database connection has been restored.'
            ),
          () =>
            showError(
              'Connection failed',
              'Still unable to connect to database.'
            )
        )
      );
      return;
    }

    if (!isAiHealthy) {
      showWarning(
        'AI Service Issues',
        'AI service is experiencing issues. Your message will be saved, but the response may be delayed.'
      );
    }

    // Pass the thread assignment to sendMessage so AI gets proper context
    const result = await sendMessage(message, selectedThread.assignment);

    if (!result && messagesError) {
      // Provide specific error handling based on error type
      let errorTitle = 'Failed to send message';
      let retryAction = undefined;

      if (
        messagesError.message.toLowerCase().includes('ai') ||
        messagesError.message.toLowerCase().includes('model')
      ) {
        errorTitle = 'AI Service Error';
        retryAction = createRetryAction(
          () => handleSendMessage(message),
          'message_send',
          () =>
            showSuccess(
              'Message sent',
              'Message sent successfully after AI service recovered.'
            ),
          () =>
            showError(
              'AI service still unavailable',
              'Please try again later when the AI service is restored.'
            )
        );
      } else if (
        messagesError.message.toLowerCase().includes('database') ||
        messagesError.message.toLowerCase().includes('connection')
      ) {
        errorTitle = 'Database Error';
        retryAction = createRetryAction(
          async () => {
            await globalDatabaseHealthChecker.forceHealthCheck();
            await handleSendMessage(message);
          },
          'message_send',
          () =>
            showSuccess(
              'Message sent',
              'Message sent successfully after database connection restored.'
            ),
          () =>
            showError(
              'Database still unavailable',
              'Please check your connection and try again.'
            )
        );
      } else if (messagesError.recoverable) {
        retryAction = createRetryAction(
          () => handleSendMessage(message),
          'message_send',
          () =>
            showSuccess(
              'Message sent',
              'Message sent successfully after retry.'
            ),
          error => showError('Retry failed', error.userMessage)
        );
      }

      showError(errorTitle, messagesError.userMessage, retryAction);
    }
  };

  /**
   * Handle feedback submission for messages
   */
  const handleFeedbackSubmit = async (
    messageId: string,
    feedback: import('../../types/aiLogging').UserFeedback
  ) => {
    await submitFeedback(messageId, feedback);

    if (messagesError) {
      showError(
        'Failed to submit feedback',
        messagesError.userMessage,
        messagesError.recoverable
          ? createRetryAction(
              () => handleFeedbackSubmit(messageId, feedback),
              'message_feedback',
              () =>
                showSuccess(
                  'Feedback submitted',
                  'Feedback submitted successfully after retry.'
                ),
              error => showError('Retry failed', error.userMessage)
            )
          : undefined
      );
    } else {
      showSuccess('Feedback submitted', 'Thank you for your feedback!');
    }
  };

  /**
   * Handle regenerating AI responses
   */
  const handleRegenerateResponse = async (messageId: string) => {
    if (!selectedThread) {
      showWarning(
        'No thread selected',
        'Please select a thread before regenerating responses.'
      );
      return;
    }

    const result = await regenerateResponse(
      messageId,
      selectedThread.assignment
    );

    if (result) {
      showSuccess(
        'Response regenerated',
        'AI response has been regenerated successfully.'
      );
    } else if (messagesError) {
      showError(
        'Failed to regenerate response',
        messagesError.userMessage,
        messagesError.recoverable
          ? createRetryAction(
              () => handleRegenerateResponse(messageId),
              'message_regenerate',
              () =>
                showSuccess(
                  'Response regenerated',
                  'Response regenerated successfully after retry.'
                ),
              error => showError('Retry failed', error.userMessage)
            )
          : undefined
      );
    }
  };

  return (
    <div
      className='flex h-full relative overflow-hidden'
      data-testid='kira-view'
    >
      {/* Error Display for Thread Operations */}
      {threadsError && (
        <div className='absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md'>
          <ErrorDisplay
            error={threadsError.userMessage}
            type={threadsError.type}
            recoverable={threadsError.recoverable}
            onRetry={
              threadsError.recoverable ? retryThreadsOperation : undefined
            }
            onDismiss={clearThreadsError}
            variant='toast'
            size='sm'
          />
        </div>
      )}

      {/* Error Display for Message Operations */}
      {messagesError && (
        <div className='absolute top-16 left-1/2 transform -translate-x-1/2 z-50 max-w-md'>
          <ErrorDisplay
            error={messagesError.userMessage}
            type={messagesError.type}
            recoverable={messagesError.recoverable}
            onRetry={
              messagesError.recoverable ? retryMessagesOperation : undefined
            }
            onDismiss={clearMessagesError}
            variant='toast'
            size='sm'
          />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <div
          className='md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm'
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden='true'
        />
      )}

      {/* Thread Sidebar */}
      <div
        className={`
        ${sidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        fixed md:relative z-50 md:z-auto
        w-80 sm:w-80 md:w-80 lg:w-96 xl:w-80
        h-full
        transition-transform duration-300 ease-in-out
        border-r border-divider
        bg-content1
        shadow-lg md:shadow-none
      `}
      >
        <ThreadSidebar
          threads={threads}
          activeThreadId={selectedThread?.id || null}
          onThreadSelect={handleThreadSelect}
          onThreadCreate={handleNewThread}
          onThreadDelete={handleThreadDelete}
          onThreadAssign={handleThreadAssign}
          isLoading={threadsLoading || isCreating || isDeleting || isUpdating}
          className='h-full'
          data-testid='thread-sidebar'
          aria-label='Thread sidebar with keyboard navigation support'
        />
      </div>

      {/* Chat Area */}
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Mobile Header with Sidebar Toggle */}
        <div className='md:hidden flex items-center justify-between p-3 sm:p-4 border-b border-divider bg-content1'>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className='p-2 rounded-lg hover:bg-content2 active:bg-content3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary'
            aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 6h16M4 12h16M4 18h16'
              />
            </svg>
          </button>
          <h1 className='text-lg font-semibold truncate mx-2 flex-1 text-center'>
            {selectedThread?.title || 'Kira Chat'}
          </h1>

          {/* Service Health Indicator */}
          <div className='flex items-center gap-1'>
            <div
              className={`w-2 h-2 rounded-full ${serviceHealth.database ? 'bg-success' : 'bg-danger'}`}
              title={`Database: ${serviceHealth.database ? 'Connected' : 'Disconnected'}`}
            />
            <div
              className={`w-2 h-2 rounded-full ${serviceHealth.ai ? 'bg-success' : 'bg-warning'}`}
              title={`AI Service: ${serviceHealth.ai ? 'Available' : 'Issues detected'}`}
            />
          </div>
        </div>

        {/* Desktop Service Health Indicator */}
        <div className='hidden md:flex absolute top-4 right-4 z-30 items-center gap-2 bg-content1 rounded-lg px-3 py-2 shadow-sm border border-divider'>
          <div className='flex items-center gap-1 text-xs text-foreground-600'>
            <div
              className={`w-2 h-2 rounded-full ${serviceHealth.database ? 'bg-success' : 'bg-danger'}`}
              title={`Database: ${serviceHealth.database ? 'Connected' : 'Disconnected'}`}
            />
            <span>DB</span>
          </div>
          <div className='flex items-center gap-1 text-xs text-foreground-600'>
            <div
              className={`w-2 h-2 rounded-full ${serviceHealth.ai ? 'bg-success' : 'bg-warning'}`}
              title={`AI Service: ${serviceHealth.ai ? 'Available' : 'Issues detected'}`}
            />
            <span>AI</span>
          </div>
        </div>

        <ChatArea
          thread={selectedThread}
          messages={messages}
          isLoading={messagesLoading}
          isSending={isSending}
          isRegenerating={isRegenerating}
          onSendMessage={handleSendMessage}
          onFeedbackSubmit={handleFeedbackSubmit}
          onRegenerateResponse={handleRegenerateResponse}
          onEscapePress={() => {
            // Handle escape in message input - close modals or blur focus
            if (showAssignmentModal) {
              handleAssignmentCancel();
            }
          }}
          className='flex-1'
        />
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <ThreadAssignmentModal
          isOpen={showAssignmentModal}
          onClose={handleAssignmentCancel}
          onAssign={handleAssignmentSave}
          currentAssignment={
            assignmentThreadId
              ? threads.find(t => t.id === assignmentThreadId)?.assignment
              : undefined
          }
          threadTitle={
            assignmentThreadId
              ? threads.find(t => t.id === assignmentThreadId)?.title
              : undefined
          }
        />
      )}
    </div>
  );
}
