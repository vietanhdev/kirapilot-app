import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationProvider, useNavigation } from '../NavigationContext';

// Test component that uses the navigation context
const TestComponent = () => {
  const { currentView, navigateTo } = useNavigation();

  return (
    <div>
      <div data-testid='current-view'>{currentView}</div>
      <button onClick={() => navigateTo('settings')}>Go to Settings</button>
      <button onClick={() => navigateTo('reports')}>Go to Reports</button>
    </div>
  );
};

describe('NavigationContext', () => {
  it('provides current view and navigation function', () => {
    const mockOnViewChange = jest.fn();

    render(
      <NavigationProvider currentView='week' onViewChange={mockOnViewChange}>
        <TestComponent />
      </NavigationProvider>
    );

    // Should display current view
    expect(screen.getByTestId('current-view')).toHaveTextContent('week');

    // Should call onViewChange when navigating
    fireEvent.click(screen.getByText('Go to Settings'));
    expect(mockOnViewChange).toHaveBeenCalledWith('settings');

    fireEvent.click(screen.getByText('Go to Reports'));
    expect(mockOnViewChange).toHaveBeenCalledWith('reports');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useNavigation must be used within a NavigationProvider');

    consoleSpy.mockRestore();
  });
});
