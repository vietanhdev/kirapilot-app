import { renderHook, act } from '@testing-library/react';
import { useClipboard } from '../useClipboard';

// Mock navigator.clipboard
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('useClipboard', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
  });

  it('should initialize with copied as false', () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('should copy text to clipboard and set copied to true', async () => {
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      const success = await result.current.copy('test text');
      expect(success).toBe(true);
    });

    expect(mockWriteText).toHaveBeenCalledWith('test text');
    expect(result.current.copied).toBe(true);
  });

  it('should reset copied state', () => {
    const { result } = renderHook(() => useClipboard());

    act(() => {
      result.current.reset();
    });

    expect(result.current.copied).toBe(false);
  });

  it('should handle clipboard write errors', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard error'));
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      const success = await result.current.copy('test text');
      expect(success).toBe(false);
    });

    expect(result.current.copied).toBe(false);
  });
});
