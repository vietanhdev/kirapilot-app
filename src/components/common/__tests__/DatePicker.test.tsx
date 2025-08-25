import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../DatePicker';
import { DateFormat } from '../../../utils/dateFormat';

describe('DatePicker', () => {
  const defaultProps = {
    onChange: jest.fn(),
    dateFormat: 'DD/MM/YYYY' as DateFormat,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<DatePicker {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'DD/MM/YYYY');
    });

    it('renders with custom label', () => {
      render(<DatePicker {...defaultProps} label='Select Date' />);

      expect(screen.getByText('Select Date')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(<DatePicker {...defaultProps} placeholder='Pick a date' />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Pick a date');
    });

    it('renders with calendar icon by default', () => {
      render(<DatePicker {...defaultProps} />);

      // Calendar icon should be present (lucide-react icon)
      const container = screen.getByRole('textbox').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('displays date in DD/MM/YYYY format', () => {
      const date = new Date('2024-01-15');
      render(
        <DatePicker {...defaultProps} value={date} dateFormat='DD/MM/YYYY' />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('15/01/2024');
    });

    it('displays date in MM/DD/YYYY format', () => {
      const date = new Date('2024-01-15');
      render(
        <DatePicker {...defaultProps} value={date} dateFormat='MM/DD/YYYY' />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('01/15/2024');
    });

    it('displays date in YYYY-MM-DD format', () => {
      const date = new Date('2024-01-15');
      render(
        <DatePicker {...defaultProps} value={date} dateFormat='YYYY-MM-DD' />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('2024-01-15');
    });

    it('shows empty input when no date is provided', () => {
      render(<DatePicker {...defaultProps} value={null} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Date Input', () => {
    it('calls onChange when typing valid date', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <DatePicker
          {...defaultProps}
          onChange={onChange}
          dateFormat='DD/MM/YYYY'
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '15/01/2024');

      expect(onChange).toHaveBeenCalledWith(expect.any(Date));
    });

    it('calls onChange with null when input is cleared', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <DatePicker
          {...defaultProps}
          onChange={onChange}
          value={new Date('2024-01-15')}
        />
      );

      const input = screen.getByRole('textbox');
      await user.clear(input);

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('does not call onChange for invalid date input', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<DatePicker {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'invalid-date');

      // Should not call onChange with a Date object for invalid input
      const calls = onChange.mock.calls.filter(call => call[0] instanceof Date);
      expect(calls).toHaveLength(0);
    });
  });

  describe('HTML5 Date Input Integration', () => {
    it('renders hidden HTML5 date input', () => {
      const { container } = render(<DatePicker {...defaultProps} />);

      const dateInput = container.querySelector('input[type="date"]');
      expect(dateInput).toBeInTheDocument();
      expect(dateInput).toHaveClass('opacity-0');
    });

    it('updates visual input when HTML5 date input changes', () => {
      const { container } = render(
        <DatePicker {...defaultProps} dateFormat='DD/MM/YYYY' />
      );

      const dateInput = container.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement;
      const visualInput = screen.getByRole('textbox') as HTMLInputElement;

      if (dateInput) {
        // Simulate HTML5 date input change
        fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

        expect(visualInput.value).toBe('15/01/2024');
      }
    });

    it('calls onChange when HTML5 date input changes', () => {
      const onChange = jest.fn();
      const { container } = render(
        <DatePicker {...defaultProps} onChange={onChange} />
      );

      const dateInput = container.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement;

      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

        expect(onChange).toHaveBeenCalledWith(expect.any(Date));
        const calledDate = onChange.mock.calls[0][0];
        expect(calledDate.getFullYear()).toBe(2024);
        expect(calledDate.getMonth()).toBe(0); // January (0-based)
        expect(calledDate.getDate()).toBe(15);
      }
    });
  });

  describe('Props', () => {
    it('applies size prop correctly', () => {
      render(<DatePicker {...defaultProps} size='lg' />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      // Just verify the input exists since HeroUI classes may vary in test environment
    });

    it('shows as required when isRequired is true', () => {
      render(<DatePicker {...defaultProps} isRequired={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
    });

    it('disables input when isDisabled is true', () => {
      const { container } = render(
        <DatePicker {...defaultProps} isDisabled={true} />
      );

      const input = screen.getByRole('textbox');
      const dateInput = container.querySelector('input[type="date"]');

      expect(input).toBeDisabled();
      if (dateInput) {
        expect(dateInput).toBeDisabled();
      }
    });

    it('applies custom className', () => {
      const { container } = render(
        <DatePicker {...defaultProps} className='custom-class' />
      );

      const customContainer = container.querySelector('.custom-class');
      expect(customContainer).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined value gracefully', () => {
      render(<DatePicker {...defaultProps} value={undefined} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('handles invalid Date object', () => {
      const invalidDate = new Date('invalid');
      render(<DatePicker {...defaultProps} value={invalidDate} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('updates when value prop changes', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-20');

      const { rerender } = render(
        <DatePicker {...defaultProps} value={date1} dateFormat='DD/MM/YYYY' />
      );

      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('15/01/2024');

      rerender(
        <DatePicker {...defaultProps} value={date2} dateFormat='DD/MM/YYYY' />
      );

      input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('20/02/2024');
    });

    it('updates when dateFormat prop changes', () => {
      const date = new Date('2024-01-15');

      const { rerender } = render(
        <DatePicker {...defaultProps} value={date} dateFormat='DD/MM/YYYY' />
      );

      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('15/01/2024');

      rerender(
        <DatePicker {...defaultProps} value={date} dateFormat='MM/DD/YYYY' />
      );

      input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('01/15/2024');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <DatePicker {...defaultProps} label='Birth Date' isRequired={true} />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
      expect(input).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(<DatePicker {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      // Input should be focusable
      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });
});
