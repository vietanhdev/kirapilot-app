import {
  PlaceholderTransitionManager,
  StaggeredAnimationManager,
  PLACEHOLDER_TRANSITION_CONFIG,
} from '../dragPlaceholderUtils';

// Mock window.matchMedia for reduced motion testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('PLACEHOLDER_TRANSITION_CONFIG', () => {
  it('should have correct timing constants', () => {
    expect(PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY).toBe(100);
    expect(PLACEHOLDER_TRANSITION_CONFIG.HIDE_DELAY).toBe(50);
    expect(PLACEHOLDER_TRANSITION_CONFIG.POSITION_TRANSITION_DURATION).toBe(
      200
    );
    expect(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY).toBe(25);
    expect(PLACEHOLDER_TRANSITION_CONFIG.REDUCED_MOTION_DURATION).toBe(50);
  });
});

describe('PlaceholderTransitionManager', () => {
  let manager: PlaceholderTransitionManager;
  let onPositionChange: jest.Mock;

  beforeAll(() => {
    jest.useFakeTimers({
      legacyFakeTimers: true,
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    onPositionChange = jest.fn();
    manager = new PlaceholderTransitionManager(onPositionChange);
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Position Management', () => {
    it('should initialize with null position', () => {
      expect(manager.getCurrentPosition()).toBeNull();
      expect(manager.isCurrentlyTransitioning()).toBe(false);
    });

    it('should set position immediately when requested', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.setPositionImmediate(position);

      expect(manager.getCurrentPosition()).toBe(position);
      expect(onPositionChange).toHaveBeenCalledWith(position);
    });

    it('should handle null position updates', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.setPositionImmediate(position);
      manager.setPositionImmediate(null);

      expect(manager.getCurrentPosition()).toBeNull();
      expect(onPositionChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe('Hover Delay Logic', () => {
    it('should apply hover delay when showing placeholder', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.updatePosition(position);

      // Should not update immediately
      expect(onPositionChange).not.toHaveBeenCalled();
      expect(manager.getCurrentPosition()).toBeNull();

      // Should update after hover delay
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY);

      expect(onPositionChange).toHaveBeenCalledWith(position);
      expect(manager.getCurrentPosition()).toBe(position);
    });

    it('should apply hide delay when hiding placeholder', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      // Set initial position
      manager.setPositionImmediate(position);
      onPositionChange.mockClear();

      // Hide position
      manager.updatePosition(null);

      // Should not hide immediately
      expect(onPositionChange).not.toHaveBeenCalled();
      expect(manager.getCurrentPosition()).toBe(position);

      // Should hide after delay
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HIDE_DELAY);

      expect(onPositionChange).toHaveBeenCalledWith(null);
      expect(manager.getCurrentPosition()).toBeNull();
    });

    it('should use custom hover delay when provided', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };
      const customDelay = 200;

      manager.updatePosition(position, { hoverDelay: customDelay });

      // Should not update at default delay
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY);
      expect(onPositionChange).not.toHaveBeenCalled();

      // Should update at custom delay
      jest.advanceTimersByTime(
        customDelay - PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY
      );
      expect(onPositionChange).toHaveBeenCalledWith(position);
    });
  });

  describe('Position Transitions', () => {
    it('should handle smooth position transitions', () => {
      const position1 = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };
      const position2 = {
        taskId: 'task-2',
        position: 'below' as const,
        columnId: 'col-1',
      };

      // Set initial position
      manager.setPositionImmediate(position1);
      onPositionChange.mockClear();

      // Update to new position
      manager.updatePosition(position2);

      expect(manager.isCurrentlyTransitioning()).toBe(true);

      // Should transition after delay
      jest.advanceTimersByTime(
        PLACEHOLDER_TRANSITION_CONFIG.POSITION_TRANSITION_DURATION / 4
      );

      expect(onPositionChange).toHaveBeenCalledWith(position2);
      expect(manager.getCurrentPosition()).toBe(position2);
      expect(manager.isCurrentlyTransitioning()).toBe(false);
    });

    it('should not update if positions are equal', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.setPositionImmediate(position);
      onPositionChange.mockClear();

      // Update with same position
      manager.updatePosition(position);

      jest.advanceTimersByTime(1000);

      expect(onPositionChange).not.toHaveBeenCalled();
    });

    it('should compare positions correctly', () => {
      const position1 = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };
      const position2 = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };
      const position3 = {
        taskId: 'task-2',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.setPositionImmediate(position1);
      onPositionChange.mockClear();

      // Same position should not trigger update
      manager.updatePosition(position2);
      jest.advanceTimersByTime(1000);
      expect(onPositionChange).not.toHaveBeenCalled();

      // Different position should trigger update
      manager.updatePosition(position3);
      jest.advanceTimersByTime(
        PLACEHOLDER_TRANSITION_CONFIG.POSITION_TRANSITION_DURATION / 4
      );
      expect(onPositionChange).toHaveBeenCalledWith(position3);
    });
  });

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      // Mock reduced motion preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      // Restore original matchMedia mock
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    it('should respect reduced motion preferences', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.updatePosition(position, { respectReducedMotion: true });

      // Should update immediately without delay
      expect(onPositionChange).toHaveBeenCalledWith(position);
      expect(manager.getCurrentPosition()).toBe(position);
    });

    it('should ignore reduced motion when disabled', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      manager.updatePosition(position, { respectReducedMotion: false });

      // Should still apply delay even with reduced motion
      expect(onPositionChange).not.toHaveBeenCalled();

      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY);
      expect(onPositionChange).toHaveBeenCalledWith(position);
    });
  });

  describe('Cleanup and Reset', () => {
    it('should clear pending transitions on cleanup', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      // Verify manager starts with null position
      expect(manager.getCurrentPosition()).toBeNull();

      // This should schedule a callback with HOVER_DELAY (100ms) since current position is null
      manager.updatePosition(position);

      // Verify no immediate call was made
      expect(onPositionChange).not.toHaveBeenCalled();

      // Clear the pending timeout before it executes
      manager.cleanup();

      // Advance past the hover delay
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY + 10);

      // The callback should not have been called because cleanup cleared it
      expect(onPositionChange).not.toHaveBeenCalled();
    });

    it('should reset state completely', () => {
      const position = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };

      // This calls onPositionChange immediately (1 call)
      manager.setPositionImmediate(position);
      expect(onPositionChange).toHaveBeenCalledTimes(1);

      // This should schedule a hide transition with HIDE_DELAY
      manager.updatePosition(null);

      // Verify no additional call was made yet (still 1 call)
      expect(onPositionChange).toHaveBeenCalledTimes(1);

      // Reset should clear the pending transition and reset state (calls setPosition(null) - 2nd call)
      manager.reset();
      expect(onPositionChange).toHaveBeenCalledTimes(2);

      expect(manager.getCurrentPosition()).toBeNull();
      expect(manager.isCurrentlyTransitioning()).toBe(false);

      // Advance past the hide delay - should not trigger additional calls
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.HIDE_DELAY + 10);

      // Should still have 2 calls: initial set + reset to null
      expect(onPositionChange).toHaveBeenCalledTimes(2);
    });

    it('should clear multiple pending timeouts', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      clearTimeoutSpy.mockClear(); // Clear any previous calls

      const position1 = {
        taskId: 'task-1',
        position: 'above' as const,
        columnId: 'col-1',
      };
      const position2 = {
        taskId: 'task-2',
        position: 'below' as const,
        columnId: 'col-1',
      };

      // Set initial position so we can test position transitions
      manager.setPositionImmediate(position1);

      // This should create a 'move' timeout (since current and new are both non-null)
      manager.updatePosition(position2);

      // This should clear 'move' timeout (1st clearTimeout) and create 'hide' timeout
      manager.updatePosition(null);

      // This should clear the 'hide' timeout (2nd clearTimeout)
      manager.cleanup();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // Clear move timeout + clear hide timeout

      clearTimeoutSpy.mockRestore();
    });
  });
});
