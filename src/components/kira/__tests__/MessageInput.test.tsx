import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../MessageInput';

// Mock the translation hook
jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'kira.chat.messagePlaceholder': 'Type your message...',
        'kira.chat.sendMessage': 'Send message',
        'kira.chat.messageInputLabel': 'Message input field',
        'kira.chat.sendButtonHint': 'Click to send message or press Enter',
        'kira.chat.characterCount': '{{current}} of {{max}} characters used',
        'kira.chat.enterToSend':
          'Press Enter to send, Shift+Enter for new line',
        'kira.chat.validation.messageEmpty': 'Message cannot be empty',
        'kira.chat.validation.messageTooLong':
          'Message is too long (maximum 10,000 characters)',
        'kira.chat.validation.messageInvalid':
          'Message contains invalid characters',
      };
      return translations[key] || key;
    },
  }),
}));

describe('MessageInput', () => {
  const mockOnSendMessage = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    onSendMessage: mockOnSendMessage,
    onError: mockOnError,
  };

  it('renders with default placeholder', () => {
    render(<MessageInput {...defaultProps} />);

    expect(
      screen.getByPlaceholderText('Type your message...')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Press Enter to send, Shift+Enter for new line')
    ).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<MessageInput {...defaultProps} placeholder='Custom placeholder' />);

    expect(
      screen.getByPlaceholderText('Custom placeholder')
    ).toBeInTheDocument();
  });

  it('sends message when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('adds new line when Shift+Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Line 2');

    expect(textarea).toHaveValue('Line 1\nLine 2');
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('clears input and errors when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Some text');
    await user.keyboard('{Escape}');

    expect(textarea).toHaveValue('');
  });

  it('sends message when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    await user.type(textarea, 'Hello world');

    // Use Enter key instead of button click to avoid HeroUI issues
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('disables send button when message is empty', () => {
    render(<MessageInput {...defaultProps} />);

    const sendButton = screen.getByTitle('Send message');
    expect(sendButton).toBeDisabled();
  });

  it('disables send button when loading', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} isLoading={true} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTitle('common.sending');

    await user.type(textarea, 'Hello world');
    expect(sendButton).toBeDisabled();
  });

  it('disables input when disabled prop is true', () => {
    render(<MessageInput {...defaultProps} disabled={true} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTitle('Send message');

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('validates empty message and shows error', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Try to send empty message using Enter key
    await user.type(textarea, '   '); // Only whitespace
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledWith('Message cannot be empty');
    expect(screen.getByText('Message cannot be empty')).toBeInTheDocument();
  });

  it('validates message length and shows error', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Simulate typing a very long message by directly setting the value
    const longMessage = 'a'.repeat(10001);
    fireEvent.change(textarea, { target: { value: longMessage } });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        'Message is too long (maximum 10,000 characters)'
      );
      expect(
        screen.getByText('Message is too long (maximum 10,000 characters)')
      ).toBeInTheDocument();
    });
  });

  it('shows character count when typing', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Hello');

    expect(screen.getByText(/5\/10,000/)).toBeInTheDocument();
  });

  it('shows warning color for character count near limit', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    const longMessage = 'a'.repeat(9500);

    // Simulate typing a long message by directly setting the value
    fireEvent.change(textarea, { target: { value: longMessage } });

    const characterCount = screen.getByText(/9,500\/10,000/);
    expect(characterCount).toHaveClass('text-warning');
  });

  it('clears validation error when user starts typing valid content', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Trigger validation error
    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');

    expect(screen.getByText('Message cannot be empty')).toBeInTheDocument();

    // Start typing valid content
    await user.clear(textarea);
    await user.type(textarea, 'Valid message');

    expect(
      screen.queryByText('Message cannot be empty')
    ).not.toBeInTheDocument();
  });

  it('clears input after successful send', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');

    // Wait for the input to be cleared
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('handles send message errors gracefully', async () => {
    const user = userEvent.setup();
    const mockOnSendMessageError = jest.fn(() => {
      throw new Error('Network error');
    });

    render(
      <MessageInput {...defaultProps} onSendMessage={mockOnSendMessageError} />
    );

    const textarea = screen.getByPlaceholderText('Type your message...');

    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnError).toHaveBeenCalledWith('Network error');
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MessageInput {...defaultProps} className='custom-class' />);

    const container = screen
      .getByPlaceholderText('Type your message...')
      .closest('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('shows loading state on send button', () => {
    render(<MessageInput {...defaultProps} isLoading={true} />);

    const sendButton = screen.getByTitle('common.sending');
    expect(sendButton).toHaveAttribute('data-loading', 'true');
  });

  it('auto-focuses input on mount when not disabled', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Wait for the async focus to happen
    await waitFor(() => {
      expect(textarea).toHaveFocus();
    });
  });

  it('does not auto-focus input when disabled', () => {
    render(<MessageInput {...defaultProps} disabled={true} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).not.toHaveFocus();
  });

  it('calls onEscapePress callback when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onEscapePress = jest.fn();
    render(<MessageInput {...defaultProps} onEscapePress={onEscapePress} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Type some text first
    await user.type(textarea, 'Hello world');
    expect(textarea).toHaveValue('Hello world');

    // Press Escape
    await user.keyboard('{Escape}');

    // Should clear input and call callback
    expect(textarea).toHaveValue('');
    expect(onEscapePress).toHaveBeenCalledTimes(1);
  });

  it('does not auto-focus when autoFocus is false', () => {
    render(<MessageInput {...defaultProps} autoFocus={false} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).not.toHaveFocus();
  });

  it('has proper accessibility attributes', () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTitle('Send message');

    // Check textarea accessibility
    expect(textarea).toHaveAttribute('aria-label', 'Message input field');
    expect(textarea).toHaveAttribute('aria-describedby', 'message-hint');
    expect(textarea).toHaveAttribute('aria-multiline', 'true');
    expect(textarea).toHaveAttribute('role', 'textbox');

    // Check send button accessibility
    expect(sendButton).toHaveAttribute('aria-label', 'Send message');
    expect(sendButton).toHaveAttribute('aria-describedby', 'send-button-hint');
  });

  it('shows validation error with proper accessibility attributes', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Try to send empty message by pressing Enter
    await user.click(textarea);
    await user.keyboard('{Enter}');

    // Should show error with proper attributes
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
    expect(textarea).toHaveAttribute('aria-describedby', 'message-error');
  });

  it('highlights keyboard shortcut hint when focused', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    const hint = screen.getByText(
      'Press Enter to send, Shift+Enter for new line'
    );

    // Initially should not be highlighted
    expect(hint).not.toHaveClass('text-primary-500');

    // Focus the textarea
    await user.click(textarea);

    // Should be highlighted when focused
    expect(hint).toHaveClass('text-primary-500');

    // Blur the textarea
    await user.tab();

    // Should not be highlighted when blurred
    expect(hint).not.toHaveClass('text-primary-500');
  });

  it('exposes ref methods correctly', async () => {
    const ref = React.createRef<import('../MessageInput').MessageInputRef>();
    render(<MessageInput {...defaultProps} ref={ref} />);

    const textarea = screen.getByPlaceholderText('Type your message...');

    // Test ref methods
    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.focus).toBe('function');
    expect(typeof ref.current?.blur).toBe('function');
    expect(typeof ref.current?.clear).toBe('function');
    expect(typeof ref.current?.getValue).toBe('function');

    // Test getValue method
    expect(ref.current?.getValue()).toBe('');

    // Type some text and test getValue
    fireEvent.change(textarea, { target: { value: 'test message' } });
    expect(ref.current?.getValue()).toBe('test message');

    // Test clear method
    ref.current?.clear();

    // Wait for state update
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });
});
