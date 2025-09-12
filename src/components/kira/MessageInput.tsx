import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Textarea, Button } from '@heroui/react';
import { Send } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { validateMessageContent } from '../../types/validation';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onError?: (error: string) => void;
  onEscapePress?: () => void;
  autoFocus?: boolean;
}

export interface MessageInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  getValue: () => string;
}

/**
 * Enhanced message input component with multi-line support and keyboard shortcuts
 * Features auto-resize, keyboard shortcuts, validation, error handling, and accessibility
 *
 * Keyboard shortcuts:
 * - Enter: Send message
 * - Shift+Enter: Add new line
 * - Escape: Clear input and call onEscapePress callback
 * - Ctrl/Cmd+A: Select all text
 */
export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  (
    {
      onSendMessage,
      isLoading = false,
      disabled = false,
      placeholder,
      className = '',
      onError,
      onEscapePress,
      autoFocus = true,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const defaultPlaceholder = placeholder || t('kira.chat.messagePlaceholder');

    // Expose methods through ref for parent components
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (textareaRef.current && !disabled) {
            textareaRef.current.focus();
          }
        },
        blur: () => {
          if (textareaRef.current) {
            textareaRef.current.blur();
          }
        },
        clear: () => {
          setMessage('');
          setValidationError(null);
        },
        getValue: () => message,
      }),
      [message, disabled]
    );

    // Validate message content
    const validateMessage = useCallback(
      (content: string) => {
        const validation = validateMessageContent(content);
        if (!validation.success) {
          const errorMessage =
            validation.error.issues[0]?.message || 'Invalid message';
          setValidationError(errorMessage);
          if (onError) {
            onError(errorMessage);
          }
          return false;
        }
        setValidationError(null);
        return true;
      },
      [onError]
    );

    // Handle sending message
    const handleSendMessage = useCallback(() => {
      if (isLoading || disabled) {
        return;
      }

      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        const errorMessage = t('kira.chat.validation.messageEmpty');
        setValidationError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
        return;
      }

      // Validate message content
      if (!validateMessage(trimmedMessage)) {
        return;
      }

      try {
        onSendMessage(trimmedMessage);
        setMessage('');
        setValidationError(null);

        // Re-focus input after sending for better UX
        setTimeout(() => {
          if (
            textareaRef.current &&
            !disabled &&
            !textareaRef.current.disabled
          ) {
            textareaRef.current.focus();
          }
        }, 100);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message';
        setValidationError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    }, [
      message,
      onSendMessage,
      isLoading,
      disabled,
      validateMessage,
      onError,
      t,
    ]);

    // Handle message change with validation
    const handleMessageChange = useCallback(
      (value: string) => {
        setMessage(value);

        // Clear validation error when user starts typing
        if (validationError && value.trim().length > 0) {
          setValidationError(null);
        }

        // Real-time validation for length
        if (value.length > 10000) {
          const errorMessage = t('kira.chat.validation.messageTooLong');
          setValidationError(errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        }
      },
      [validationError, onError, t]
    );

    // Handle keyboard shortcuts with enhanced accessibility
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          if (e.shiftKey) {
            // Shift+Enter: Add new line (default behavior)
            // Let the textarea handle this naturally
            return;
          } else {
            // Enter: Send message
            e.preventDefault();
            handleSendMessage();
          }
        } else if (e.key === 'Escape') {
          // Escape: Clear input, validation errors, and call parent callback
          setMessage('');
          setValidationError(null);

          // Call parent escape handler (e.g., to close modals)
          if (onEscapePress) {
            onEscapePress();
          }

          // Blur the input to remove focus
          if (textareaRef.current) {
            textareaRef.current.blur();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          // Ctrl/Cmd+A: Select all text (enhanced for accessibility)
          // Let default behavior handle this, but ensure proper focus
          if (textareaRef.current) {
            setTimeout(() => {
              textareaRef.current?.select();
            }, 0);
          }
        }
      },
      [handleSendMessage, onEscapePress]
    );

    // Handle focus and blur events for accessibility
    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    // Auto-focus on mount if enabled
    useEffect(() => {
      if (autoFocus && textareaRef.current && !disabled) {
        // Small delay to ensure component is fully mounted
        const timer = setTimeout(() => {
          if (textareaRef.current && !disabled) {
            textareaRef.current.focus();
          }
        }, 100);

        return () => clearTimeout(timer);
      }
    }, [autoFocus, disabled]);

    // Handle disabled state changes
    useEffect(() => {
      if (
        disabled &&
        textareaRef.current &&
        document.activeElement === textareaRef.current
      ) {
        textareaRef.current.blur();
      }
    }, [disabled]);

    // Calculate if send button should be enabled
    const canSend =
      message.trim().length > 0 && !isLoading && !disabled && !validationError;

    return (
      <div className={`p-4 bg-content2 ${className}`}>
        <div className='flex gap-3 items-end'>
          <Textarea
            ref={textareaRef}
            placeholder={defaultPlaceholder}
            value={message}
            onChange={e => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            minRows={1}
            maxRows={6}
            size='sm'
            className='flex-1'
            classNames={{
              input: 'bg-content1 text-foreground resize-none',
              inputWrapper: `bg-content1 border-divider data-[hover=true]:bg-content1 data-[focus=true]:bg-content1 ${
                validationError
                  ? 'data-[focus=true]:border-danger border-danger'
                  : 'data-[focus=true]:border-primary-500'
              }`,
            }}
            disabled={disabled}
            autoComplete='off'
            autoCorrect='off'
            autoCapitalize='sentences'
            spellCheck='true'
            isInvalid={!!validationError}
            aria-label={t('kira.chat.messageInputLabel')}
            aria-describedby={
              validationError ? 'message-error' : 'message-hint'
            }
            role='textbox'
            aria-multiline='true'
          />

          <Button
            isIconOnly
            size='lg'
            color='primary'
            onPress={handleSendMessage}
            disabled={!canSend}
            isLoading={isLoading}
            className={`min-w-10 h-10 ${
              !canSend
                ? 'opacity-50 bg-content3 text-foreground-500'
                : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md'
            }`}
            title={isLoading ? t('common.sending') : t('kira.chat.sendMessage')}
            aria-label={
              isLoading ? t('common.sending') : t('kira.chat.sendMessage')
            }
            aria-describedby='send-button-hint'
          >
            {!isLoading && <Send className='w-4 h-4' />}
          </Button>
        </div>

        {/* Message info and keyboard shortcut hint */}
        <div className='mt-2 flex justify-between items-center text-xs text-default-400'>
          <div className='flex items-center gap-2'>
            <span
              id='message-hint'
              className={isFocused ? 'text-primary-500' : ''}
            >
              {t('kira.chat.enterToSend')}
            </span>
            <span id='send-button-hint' className='sr-only'>
              {t('kira.chat.sendButtonHint')}
            </span>
            {message.length > 0 && (
              <span
                className={message.length > 9000 ? 'text-warning' : ''}
                aria-label={t('kira.chat.characterCount', {
                  current: message.length,
                  max: 10000,
                })}
              >
                {message.length.toLocaleString()}/10,000
              </span>
            )}
          </div>
          {validationError && (
            <span
              id='message-error'
              className='text-danger text-xs'
              role='alert'
              aria-live='polite'
            >
              {validationError}
            </span>
          )}
        </div>
      </div>
    );
  }
);

// Set display name for debugging
MessageInput.displayName = 'MessageInput';

// Default export for backward compatibility
export default MessageInput;
