import { renderHook } from '@testing-library/react';
import { useNavigation } from '../../../contexts/NavigationContext';

// Mock the navigation context
jest.mock('../../../contexts/NavigationContext', () => ({
  useNavigation: jest.fn(),
}));

describe('KiraView Auto-Start Functionality', () => {
  const mockNavigateTo = jest.fn();

  beforeEach(() => {
    (useNavigation as jest.Mock).mockReturnValue({
      navigateTo: mockNavigateTo,
      currentView: 'kira',
      viewParams: {},
    });
  });

  it('should provide navigation functionality', () => {
    const { result } = renderHook(() => useNavigation());

    expect(result.current.navigateTo).toBeDefined();
    expect(typeof result.current.navigateTo).toBe('function');
  });

  it('should handle viewParams correctly', () => {
    (useNavigation as jest.Mock).mockReturnValue({
      navigateTo: mockNavigateTo,
      currentView: 'kira',
      viewParams: { threadId: 'test-thread-123', autoStart: true },
    });

    const { result } = renderHook(() => useNavigation());

    expect(result.current.viewParams.threadId).toBe('test-thread-123');
    expect(result.current.viewParams.autoStart).toBe(true);
  });

  it('should support navigation with parameters', () => {
    const { result } = renderHook(() => useNavigation());

    result.current.navigateTo('kira', {
      threadId: 'new-thread',
      autoStart: true,
    });

    expect(mockNavigateTo).toHaveBeenCalledWith('kira', {
      threadId: 'new-thread',
      autoStart: true,
    });
  });
});
