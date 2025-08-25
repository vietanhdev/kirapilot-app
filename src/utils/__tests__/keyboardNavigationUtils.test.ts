/**
 * Unit tests for keyboard navigation utilities
 */

import {
  KeyboardNavigationManager,
  generateAvailableDropPositions,
  calculateDropIndex,
  FocusManager,
} from '../keyboardNavigationUtils';
import { PlaceholderPosition } from '../dragPlaceholderUtils';

// Mock DOM methods
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockSetAttribute = jest.fn();
const mockSetTextContent = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockContains = jest.fn();
const mockFocus = jest.fn();

// Mock document and window
Object.defineProperty(global, 'document', {
  value: {
    createElement: mockCreateElement,
    body: {
      appendChild: mockAppendChild,
    },
    activeElement: null,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    querySelector: mockQuerySelector,
    querySelectorAll: mockQuerySelectorAll,
    contains: mockContains,
  },
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    matchMedia: jest.fn(() => ({
      matches: false,
    })),
  },
  writable: true,
});

describe('KeyboardNavigationManager', () => {
  let manager: KeyboardNavigationManager;
  let mockElement: Partial<HTMLElement>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock element for live region
    mockElement = {
      setAttribute: mockSetAttribute,
      set textContent(value: string) {
        mockSetTextContent(value);
      },
      className: '',
      id: '',
      parentNode: {
        removeChild: mockRemoveChild,
      } as unknown as ParentNode,
    };

    mockCreateElement.mockReturnValue(mockElement);
    manager = new KeyboardNavigationManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('initialization', () => {
    it('should create a live region element', () => {
      expect(mockCreateElement).toHaveBeenCalledWith('div');
      expect(mockSetAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
      expect(mockSetAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockSetAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAppendChild).toHaveBeenCalledWith(mockElement);
    });

    it('should initialize with correct default state', () => {
      const state = manager.getState();
      expect(state.isKeyboardMode).toBe(false);
      expect(state.currentFocusedTask).toBeNull();
      expect(state.currentDropPosition).toBeNull();
      expect(state.availablePositions).toEqual([]);
      expect(state.currentPositionIndex).toBe(-1);
    });
  });

  describe('enterKeyboardMode', () => {
    const mockPositions: PlaceholderPosition[] = [
      { taskId: 'task1', position: 'above', columnId: 'column1' },
      { taskId: 'task2', position: 'below', columnId: 'column1' },
    ];

    it('should enter keyboard mode with correct state', () => {
      manager.enterKeyboardMode('task1', mockPositions);

      const state = manager.getState();
      expect(state.isKeyboardMode).toBe(true);
      expect(state.currentFocusedTask).toBe('task1');
      expect(state.availablePositions).toEqual(mockPositions);
      expect(state.currentPositionIndex).toBe(0);
      expect(state.currentDropPosition).toEqual(mockPositions[0]);
    });

    it('should announce keyboard mode activation', () => {
      manager.enterKeyboardMode('task1', mockPositions);

      // Should set up announcement timeout
      expect(mockSetAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });
  });

  describe('exitKeyboardMode', () => {
    it('should exit keyboard mode and reset state', () => {
      const mockPositions: PlaceholderPosition[] = [
        { taskId: 'task1', position: 'above', columnId: 'column1' },
      ];

      manager.enterKeyboardMode('task1', mockPositions);
      manager.exitKeyboardMode();

      const state = manager.getState();
      expect(state.isKeyboardMode).toBe(false);
      expect(state.currentFocusedTask).toBeNull();
      expect(state.currentDropPosition).toBeNull();
      expect(state.availablePositions).toEqual([]);
      expect(state.currentPositionIndex).toBe(-1);
    });
  });

  describe('navigation', () => {
    const mockPositions: PlaceholderPosition[] = [
      { taskId: 'task1', position: 'above', columnId: 'column1' },
      { taskId: 'task1', position: 'below', columnId: 'column1' },
      { taskId: 'task2', position: 'above', columnId: 'column1' },
    ];

    beforeEach(() => {
      manager.enterKeyboardMode('task1', mockPositions);
    });

    describe('navigateNext', () => {
      it('should navigate to next position', () => {
        const result = manager.navigateNext();

        expect(result).toEqual(mockPositions[1]);
        expect(manager.getState().currentPositionIndex).toBe(1);
      });

      it('should not go beyond last position', () => {
        manager.navigateNext(); // index 1
        manager.navigateNext(); // index 2
        const result = manager.navigateNext(); // should stay at 2

        expect(result).toEqual(mockPositions[2]);
        expect(manager.getState().currentPositionIndex).toBe(2);
      });

      it('should return null when not in keyboard mode', () => {
        manager.exitKeyboardMode();
        const result = manager.navigateNext();

        expect(result).toBeNull();
      });
    });

    describe('navigatePrevious', () => {
      it('should navigate to previous position', () => {
        manager.navigateNext(); // Go to index 1 first
        const result = manager.navigatePrevious();

        expect(result).toEqual(mockPositions[0]);
        expect(manager.getState().currentPositionIndex).toBe(0);
      });

      it('should not go below first position', () => {
        const result = manager.navigatePrevious(); // should stay at 0

        expect(result).toEqual(mockPositions[0]);
        expect(manager.getState().currentPositionIndex).toBe(0);
      });
    });
  });

  describe('handleKeyboardEvent', () => {
    const mockPositions: PlaceholderPosition[] = [
      { taskId: 'task1', position: 'above', columnId: 'column1' },
      { taskId: 'task2', position: 'above', columnId: 'column1' },
    ];

    beforeEach(() => {
      manager.enterKeyboardMode('task1', mockPositions);
    });

    it('should handle ArrowDown key', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect(result.action).toBe('navigate-next');
      expect(result.position).toEqual(mockPositions[1]);
    });

    it('should handle ArrowUp key', () => {
      manager.navigateNext(); // Go to index 1 first
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect(result.action).toBe('navigate-previous');
      expect(result.position).toEqual(mockPositions[0]);
    });

    it('should handle Enter key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect(result.action).toBe('drop');
      expect(result.position).toEqual(mockPositions[0]);
    });

    it('should handle Space key', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect(result.action).toBe('drop');
    });

    it('should handle Escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect(result.action).toBe('cancel');
      expect(result.position).toBeNull();
    });

    it('should not handle unrecognized keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      const preventDefault = jest.spyOn(event, 'preventDefault');

      const result = manager.handleKeyboardEvent(event);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(result.handled).toBe(false);
    });

    it('should not handle keys when not in keyboard mode', () => {
      manager.exitKeyboardMode();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      const result = manager.handleKeyboardEvent(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('announceDragResult', () => {
    it('should announce successful move', async () => {
      manager.announceDragResult(true, 'column1', 'column2', 1);

      // Wait for the timeout to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should set up announcement with success message
      expect(mockSetAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });

    it('should announce cancelled move', async () => {
      manager.announceDragResult(false, 'column1', 'column2');

      // Wait for the timeout to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should set up announcement with cancellation message
      // The live region is created with assertive initially, then changed based on announcement priority
      expect(mockSetAttribute).toHaveBeenCalledWith('aria-live', 'polite');
    });
  });

  describe('cleanup', () => {
    it('should remove live region element', () => {
      manager.cleanup();

      expect(mockRemoveChild).toHaveBeenCalledWith(mockElement);
    });

    it('should clear timeouts', () => {
      // This is tested implicitly - no errors should occur during cleanup
      expect(() => manager.cleanup()).not.toThrow();
    });
  });
});

describe('generateAvailableDropPositions', () => {
  it('should generate positions for tasks', () => {
    const taskIds = ['task1', 'task2', 'task3'];
    const positions = generateAvailableDropPositions('column1', taskIds);

    expect(positions).toEqual([
      { taskId: 'task1', position: 'above', columnId: 'column1' },
      { taskId: 'task2', position: 'above', columnId: 'column1' },
      { taskId: 'task3', position: 'above', columnId: 'column1' },
      { taskId: 'task3', position: 'below', columnId: 'column1' },
    ]);
  });

  it('should exclude dragged task', () => {
    const taskIds = ['task1', 'task2', 'task3'];
    const positions = generateAvailableDropPositions(
      'column1',
      taskIds,
      'task2'
    );

    expect(positions).toEqual([
      { taskId: 'task1', position: 'above', columnId: 'column1' },
      { taskId: 'task3', position: 'above', columnId: 'column1' },
      { taskId: 'task3', position: 'below', columnId: 'column1' },
    ]);
  });

  it('should handle empty column', () => {
    const positions = generateAvailableDropPositions('column1', []);

    expect(positions).toEqual([
      { taskId: 'empty-column', position: 'above', columnId: 'column1' },
    ]);
  });

  it('should handle column with only dragged task', () => {
    const positions = generateAvailableDropPositions(
      'column1',
      ['task1'],
      'task1'
    );

    expect(positions).toEqual([
      { taskId: 'empty-column', position: 'above', columnId: 'column1' },
    ]);
  });
});

describe('calculateDropIndex', () => {
  const taskIds = ['task1', 'task2', 'task3'];

  it('should calculate index for above position', () => {
    const position: PlaceholderPosition = {
      taskId: 'task2',
      position: 'above',
      columnId: 'column1',
    };

    const index = calculateDropIndex(position, taskIds);
    expect(index).toBe(1);
  });

  it('should calculate index for below position', () => {
    const position: PlaceholderPosition = {
      taskId: 'task2',
      position: 'below',
      columnId: 'column1',
    };

    const index = calculateDropIndex(position, taskIds);
    expect(index).toBe(2);
  });

  it('should handle empty column position', () => {
    const position: PlaceholderPosition = {
      taskId: 'empty-column',
      position: 'above',
      columnId: 'column1',
    };

    const index = calculateDropIndex(position, taskIds);
    expect(index).toBe(0);
  });

  it('should handle non-existent task', () => {
    const position: PlaceholderPosition = {
      taskId: 'non-existent',
      position: 'above',
      columnId: 'column1',
    };

    const index = calculateDropIndex(position, taskIds);
    expect(index).toBe(taskIds.length);
  });

  it('should exclude dragged task from calculation', () => {
    const position: PlaceholderPosition = {
      taskId: 'task3',
      position: 'above',
      columnId: 'column1',
    };

    const index = calculateDropIndex(position, taskIds, 'task1');
    expect(index).toBe(1); // task3 is now at index 1 after excluding task1
  });
});

describe('FocusManager', () => {
  let focusManager: FocusManager;
  let mockActiveElement: Partial<HTMLElement>;
  let mockTargetElement: Partial<HTMLElement>;

  beforeEach(() => {
    mockActiveElement = {
      focus: mockFocus,
    };

    mockTargetElement = {
      focus: mockFocus,
    };

    Object.defineProperty(document, 'activeElement', {
      value: mockActiveElement,
      writable: true,
    });

    mockContains.mockReturnValue(true);

    focusManager = new FocusManager();
  });

  describe('setFocus', () => {
    it('should save current focus and set new focus', () => {
      focusManager.setFocus(mockTargetElement as HTMLElement);

      expect(mockTargetElement.focus).toHaveBeenCalled();
    });
  });

  describe('restoreFocus', () => {
    it('should restore previous focus', () => {
      focusManager.setFocus(mockTargetElement as HTMLElement);
      focusManager.restoreFocus();

      expect(mockActiveElement.focus).toHaveBeenCalled();
    });

    it('should not restore focus if element is not in document', () => {
      // Set up the active element first
      Object.defineProperty(document, 'activeElement', {
        value: mockActiveElement,
        configurable: true,
      });

      // Save the focus
      focusManager.setFocus(mockTargetElement as HTMLElement);

      // Clear the focus call from setFocus
      jest.clearAllMocks();

      // Mock document.contains to return false (element not in document)
      mockContains.mockReturnValue(false);

      focusManager.restoreFocus();

      expect(mockActiveElement.focus).not.toHaveBeenCalled();
    });
  });

  describe('findNextFocusable', () => {
    beforeEach(() => {
      const mockElements = [
        { focus: jest.fn() },
        { focus: jest.fn() },
        { focus: jest.fn() },
      ];

      mockQuerySelectorAll.mockReturnValue(mockElements);
    });

    it('should find next focusable element', () => {
      const mockElements = mockQuerySelectorAll();
      const currentElement = mockElements[0];

      const nextElement = focusManager.findNextFocusable(
        currentElement,
        'next'
      );

      expect(nextElement).toBe(mockElements[1]);
    });

    it('should find previous focusable element', () => {
      const mockElements = mockQuerySelectorAll();
      const currentElement = mockElements[1];

      const prevElement = focusManager.findNextFocusable(
        currentElement,
        'previous'
      );

      expect(prevElement).toBe(mockElements[0]);
    });

    it('should wrap around for next navigation', () => {
      const mockElements = mockQuerySelectorAll();
      const currentElement = mockElements[2]; // last element

      const nextElement = focusManager.findNextFocusable(
        currentElement,
        'next'
      );

      expect(nextElement).toBe(mockElements[0]); // should wrap to first
    });

    it('should wrap around for previous navigation', () => {
      const mockElements = mockQuerySelectorAll();
      const currentElement = mockElements[0]; // first element

      const prevElement = focusManager.findNextFocusable(
        currentElement,
        'previous'
      );

      expect(prevElement).toBe(mockElements[2]); // should wrap to last
    });

    it('should return null if element not found', () => {
      mockQuerySelectorAll();
      const unknownElement = { focus: jest.fn() };

      const nextElement = focusManager.findNextFocusable(
        unknownElement as unknown as HTMLElement,
        'next'
      );

      expect(nextElement).toBeNull();
    });
  });
});
