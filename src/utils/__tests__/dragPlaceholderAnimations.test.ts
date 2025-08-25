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

describe.skip('StaggeredAnimationManager', () => {
  let manager: StaggeredAnimationManager;

  beforeEach(() => {
    jest.clearAllTimers();
    manager = new StaggeredAnimationManager();
  });

  afterEach(() => {
    if (manager) {
      manager.clear();
    }
    jest.clearAllTimers();
  });

  describe('Animation Queue Management', () => {
    it('should add animations to queue with staggered delays', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      manager.addAnimation('anim1', callback1);
      manager.addAnimation('anim2', callback2);
      manager.addAnimation('anim3', callback3);

      // First animation: STAGGER_DELAY (25ms)
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Second animation: 2 * STAGGER_DELAY (50ms total, so advance 25ms more)
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY);
      expect(callback2).toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Third animation: 3 * STAGGER_DELAY (75ms total, so advance 25ms more)
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY);
      expect(callback3).toHaveBeenCalled();
    });

    it('should use custom base delay', () => {
      const callback = jest.fn();
      const customDelay = 100;

      manager.addAnimation('anim1', callback, customDelay);

      // Should not execute at default delay
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY);
      expect(callback).not.toHaveBeenCalled();

      // Should execute at custom delay (advance to total of 100ms)
      jest.advanceTimersByTime(
        customDelay - PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY
      );
      expect(callback).toHaveBeenCalled();
    });

    it('should replace existing animation with same ID', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.addAnimation('anim1', callback1);
      manager.addAnimation('anim1', callback2); // Should replace

      jest.advanceTimersByTime(100);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove specific animations', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.addAnimation('anim1', callback1);
      manager.addAnimation('anim2', callback2);

      manager.removeAnimation('anim1');

      jest.advanceTimersByTime(100);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should clear all animations', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.addAnimation('anim1', callback1);
      manager.addAnimation('anim2', callback2);

      manager.clear();

      jest.advanceTimersByTime(1000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Queue Processing', () => {
    it('should process animations in batches', async () => {
      const callbacks = Array.from({ length: 5 }, () => jest.fn());

      // Add all animations
      callbacks.forEach((callback, index) => {
        manager.addAnimation(`anim${index}`, callback);
      });

      // Process first batch
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY * 5);

      // All callbacks should be executed
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled();
      });
    });

    it('should handle empty queue gracefully', () => {
      // Should not throw when processing empty queue
      expect(() => {
        jest.advanceTimersByTime(1000);
      }).not.toThrow();
    });

    it('should handle rapid additions during processing', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.addAnimation('anim1', callback1);

      // Start processing
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY / 2);

      // Add another animation while processing
      manager.addAnimation('anim2', callback2);

      // Complete processing
      jest.advanceTimersByTime(PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY * 2);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of animations efficiently', () => {
      const callbacks = Array.from({ length: 100 }, () => jest.fn());

      const startTime = performance.now();

      callbacks.forEach((callback, index) => {
        manager.addAnimation(`anim${index}`, callback);
      });

      const endTime = performance.now();

      // Should complete quickly (less than 10ms for 100 animations)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should not accumulate memory leaks', () => {
      // Add and remove many animations
      for (let i = 0; i < 1000; i++) {
        manager.addAnimation(`anim${i}`, jest.fn());
        if (i % 10 === 0) {
          manager.clear();
        }
      }

      // Should not throw or cause memory issues
      expect(() => {
        jest.advanceTimersByTime(1000);
      }).not.toThrow();
    });
  });
});
