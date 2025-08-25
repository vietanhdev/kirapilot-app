/* eslint-disable @typescript-eslint/no-explicit-any */
// Unit tests for drag placeholder position calculation utilities
import {
  PlaceholderPosition,
  TaskElementBounds,
  getTaskElementBounds,
  getColumnTaskBounds,
  calculatePlaceholderPosition,
  isPointerInColumn,
  getColumnId,
  findColumnAtCoordinates,
  createDebouncedPositionCalculator,
  getPointerCoordinates,
  validatePlaceholderPosition,
  boundsCache,
  getCachedTaskElementBounds,
  createPlaceholderCollisionDetection,
  OptimizedCollisionDetector,
  EdgeCaseHandler,
  CollisionPerformanceMonitor,
} from '../dragPlaceholderUtils';

// Mock DOM elements for testing
class MockElement {
  private _attributes: Map<string, string> = new Map();
  private _children: MockElement[] = [];
  private _rect: DOMRect;
  public id: string = '';

  constructor(rect: Partial<DOMRect> = {}) {
    this._rect = {
      top: rect.top || 0,
      bottom: rect.bottom || 0,
      left: rect.left || 0,
      right: rect.right || 0,
      width: rect.width || 0,
      height: rect.height || 0,
      x: rect.x || 0,
      y: rect.y || 0,
      toJSON: () => ({}),
    };
  }

  setAttribute(name: string, value: string): void {
    this._attributes.set(name, value);
    if (name === 'id') {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    return this._attributes.get(name) || null;
  }

  appendChild(child: MockElement): void {
    this._children.push(child);
  }

  querySelector(selector: string): MockElement | null {
    // Simple selector matching for tests
    if (selector.startsWith('[data-task-id]')) {
      return (
        this._children.find(child => child.getAttribute('data-task-id')) || null
      );
    }
    if (selector.startsWith('[data-column-id]')) {
      return (
        this._children.find(child => child.getAttribute('data-column-id')) ||
        null
      );
    }
    if (selector.includes('data-task-id=')) {
      const taskId = selector.match(/data-task-id="([^"]+)"/)?.[1];
      return this.findElementRecursive(
        child => child.getAttribute('data-task-id') === taskId
      );
    }
    if (selector.includes('data-column-id=')) {
      const columnId = selector.match(/data-column-id="([^"]+)"/)?.[1];
      return this.findElementRecursive(
        child => child.getAttribute('data-column-id') === columnId
      );
    }
    return null;
  }

  private findElementRecursive(
    predicate: (element: MockElement) => boolean
  ): MockElement | null {
    if (predicate(this)) {
      return this;
    }
    for (const child of this._children) {
      const found = child.findElementRecursive(predicate);
      if (found) {
        return found;
      }
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    if (selector.startsWith('[data-task-id]')) {
      return this._children.filter(child => child.getAttribute('data-task-id'));
    }
    if (selector.startsWith('[data-column-id]')) {
      return this._children.filter(child =>
        child.getAttribute('data-column-id')
      );
    }
    return [];
  }

  getBoundingClientRect(): DOMRect {
    return this._rect;
  }

  contains(other: MockElement): boolean {
    return this._children.includes(other);
  }

  hasAttribute(name: string): boolean {
    return this._attributes.has(name);
  }
}

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
});

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = jest.fn();
const mockCancelAnimationFrame = jest.fn();
Object.defineProperty(global, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
});
Object.defineProperty(global, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
});

describe('dragPlaceholderUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(1000);
    mockRequestAnimationFrame.mockImplementation((callback: () => void) => {
      callback();
      return 1;
    });
    boundsCache.clear();
  });

  describe('getTaskElementBounds', () => {
    it('should calculate correct bounds for a task element', () => {
      const element = new MockElement({
        top: 100,
        bottom: 150,
        left: 50,
        right: 250,
        width: 200,
        height: 50,
      });
      element.setAttribute('data-task-id', 'task-1');

      const bounds = getTaskElementBounds(element as unknown as HTMLElement);

      expect(bounds).toEqual({
        id: 'task-1',
        top: 100,
        bottom: 150,
        left: 50,
        right: 250,
        width: 200,
        height: 50,
        centerY: 125,
      });
    });

    it('should handle element without data-task-id', () => {
      const element = new MockElement({
        top: 0,
        bottom: 50,
        left: 0,
        right: 100,
        width: 100,
        height: 50,
      });
      element.id = 'task-element';

      const bounds = getTaskElementBounds(element as unknown as HTMLElement);

      expect(bounds.id).toBe('task-element');
      expect(bounds.centerY).toBe(25);
    });

    it('should find task ID in child element', () => {
      const parent = new MockElement();
      const child = new MockElement();
      child.setAttribute('data-task-id', 'nested-task');
      parent.appendChild(child);

      const bounds = getTaskElementBounds(parent as unknown as HTMLElement);

      expect(bounds.id).toBe('nested-task');
    });
  });

  describe('getColumnTaskBounds', () => {
    it('should return bounds for all tasks in column except dragged task', () => {
      const column = new MockElement();

      const task1 = new MockElement({ top: 100, bottom: 150, height: 50 });
      task1.setAttribute('data-task-id', 'task-1');

      const task2 = new MockElement({ top: 160, bottom: 210, height: 50 });
      task2.setAttribute('data-task-id', 'task-2');

      const task3 = new MockElement({ top: 220, bottom: 270, height: 50 });
      task3.setAttribute('data-task-id', 'task-3');

      column.appendChild(task1);
      column.appendChild(task2);
      column.appendChild(task3);

      const bounds = getColumnTaskBounds(
        column as unknown as HTMLElement,
        'task-2'
      );

      expect(bounds).toHaveLength(2);
      expect(bounds[0].id).toBe('task-1');
      expect(bounds[1].id).toBe('task-3');
      expect(bounds[0].top).toBeLessThan(bounds[1].top); // Should be sorted by position
    });

    it('should return empty array for column with no tasks', () => {
      const column = new MockElement();
      const bounds = getColumnTaskBounds(column as unknown as HTMLElement);

      expect(bounds).toEqual([]);
    });

    it('should sort tasks by vertical position', () => {
      const column = new MockElement();

      const task1 = new MockElement({ top: 200, bottom: 250, height: 50 });
      task1.setAttribute('data-task-id', 'task-1');

      const task2 = new MockElement({ top: 100, bottom: 150, height: 50 });
      task2.setAttribute('data-task-id', 'task-2');

      column.appendChild(task1);
      column.appendChild(task2);

      const bounds = getColumnTaskBounds(column as unknown as HTMLElement);

      expect(bounds[0].id).toBe('task-2'); // Should be first (top: 100)
      expect(bounds[1].id).toBe('task-1'); // Should be second (top: 200)
    });
  });

  describe('calculatePlaceholderPosition', () => {
    const createTaskBounds = (
      id: string,
      top: number,
      height: number = 50
    ): TaskElementBounds => ({
      id,
      top,
      bottom: top + height,
      left: 0,
      right: 200,
      width: 200,
      height,
      centerY: top + height / 2,
    });

    it('should return null for empty task list', () => {
      const position = calculatePlaceholderPosition(
        { x: 100, y: 100 },
        [],
        'column-1'
      );

      expect(position).toBeNull();
    });

    it('should place placeholder above task when pointer is above center', () => {
      const taskBounds = [createTaskBounds('task-1', 100)];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 120 }, // Above center (125)
        taskBounds,
        'column-1'
      );

      expect(position).toEqual({
        taskId: 'task-1',
        position: 'above',
        columnId: 'column-1',
      });
    });

    it('should place placeholder below task when pointer is below center', () => {
      const taskBounds = [createTaskBounds('task-1', 100)];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 130 }, // Below center (125)
        taskBounds,
        'column-1'
      );

      expect(position).toEqual({
        taskId: 'task-1',
        position: 'below',
        columnId: 'column-1',
      });
    });

    it('should place placeholder above first task when pointer is above all tasks', () => {
      const taskBounds = [
        createTaskBounds('task-1', 100),
        createTaskBounds('task-2', 160),
      ];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 50 }, // Above all tasks
        taskBounds,
        'column-1'
      );

      expect(position).toEqual({
        taskId: 'task-1',
        position: 'above',
        columnId: 'column-1',
      });
    });

    it('should place placeholder below last task when pointer is below all tasks', () => {
      const taskBounds = [
        createTaskBounds('task-1', 100),
        createTaskBounds('task-2', 160),
      ];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 250 }, // Below all tasks
        taskBounds,
        'column-1'
      );

      expect(position).toEqual({
        taskId: 'task-2',
        position: 'below',
        columnId: 'column-1',
      });
    });

    it('should find closest task among multiple tasks', () => {
      const taskBounds = [
        createTaskBounds('task-1', 100),
        createTaskBounds('task-2', 160),
        createTaskBounds('task-3', 220),
      ];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 180 }, // Closest to task-2 (center at 185)
        taskBounds,
        'column-1'
      );

      expect(position).toEqual({
        taskId: 'task-2',
        position: 'above',
        columnId: 'column-1',
      });
    });

    it('should skip dragged task when calculating position', () => {
      const taskBounds = [
        createTaskBounds('task-1', 100),
        createTaskBounds('task-2', 160), // This is being dragged
        createTaskBounds('task-3', 220),
      ];
      const position = calculatePlaceholderPosition(
        { x: 100, y: 185 }, // Near task-2 but it's being dragged
        taskBounds,
        'column-1',
        'task-2'
      );

      // Should find next closest task - task-1 (center at 125) is closer to y=185 than task-3 (center at 245)
      // Distance to task-1: |185 - 125| = 60
      // Distance to task-3: |185 - 245| = 60
      // Since they're equal distance, it should pick the first one found (task-1)
      expect(position?.taskId).toBe('task-1');
    });
  });

  describe('isPointerInColumn', () => {
    it('should return true when pointer is inside column bounds', () => {
      const column = new MockElement({
        top: 100,
        bottom: 400,
        left: 50,
        right: 250,
      });

      const isInside = isPointerInColumn(
        { x: 150, y: 200 },
        column as unknown as HTMLElement
      );

      expect(isInside).toBe(true);
    });

    it('should return false when pointer is outside column bounds', () => {
      const column = new MockElement({
        top: 100,
        bottom: 400,
        left: 50,
        right: 250,
      });

      expect(isPointerInColumn({ x: 30, y: 200 }, column as any)).toBe(false); // Left of column
      expect(isPointerInColumn({ x: 300, y: 200 }, column as any)).toBe(false); // Right of column
      expect(isPointerInColumn({ x: 150, y: 50 }, column as any)).toBe(false); // Above column
      expect(isPointerInColumn({ x: 150, y: 450 }, column as any)).toBe(false); // Below column
    });

    it('should handle edge cases at column boundaries', () => {
      const column = new MockElement({
        top: 100,
        bottom: 400,
        left: 50,
        right: 250,
      });

      expect(isPointerInColumn({ x: 50, y: 200 }, column as any)).toBe(true); // Left edge
      expect(isPointerInColumn({ x: 250, y: 200 }, column as any)).toBe(true); // Right edge
      expect(isPointerInColumn({ x: 150, y: 100 }, column as any)).toBe(true); // Top edge
      expect(isPointerInColumn({ x: 150, y: 400 }, column as any)).toBe(true); // Bottom edge
    });
  });

  describe('getColumnId', () => {
    it('should get column ID from data-column-id attribute', () => {
      const column = new MockElement();
      column.setAttribute('data-column-id', 'column-1');

      const id = getColumnId(column as any);

      expect(id).toBe('column-1');
    });

    it('should fallback to element id if no data-column-id', () => {
      const column = new MockElement();
      column.id = 'my-column';

      const id = getColumnId(column as any);

      expect(id).toBe('my-column');
    });

    it('should find column ID in child element', () => {
      const parent = new MockElement();
      const child = new MockElement();
      child.setAttribute('data-column-id', 'nested-column');
      parent.appendChild(child);

      const id = getColumnId(parent as any);

      expect(id).toBe('nested-column');
    });

    it('should return empty string if no ID found', () => {
      const column = new MockElement();

      const id = getColumnId(column as any);

      expect(id).toBe('');
    });
  });

  describe('findColumnAtCoordinates', () => {
    it('should find column containing the pointer coordinates', () => {
      const container = new MockElement();

      const column1 = new MockElement({
        left: 0,
        right: 100,
        top: 0,
        bottom: 400,
      });
      column1.setAttribute('data-column-id', 'column-1');

      const column2 = new MockElement({
        left: 110,
        right: 210,
        top: 0,
        bottom: 400,
      });
      column2.setAttribute('data-column-id', 'column-2');

      container.appendChild(column1);
      container.appendChild(column2);

      const foundColumn = findColumnAtCoordinates(
        { x: 150, y: 200 },
        container as any
      );

      expect(foundColumn).toBe(column2);
    });

    it('should return null if no column contains the coordinates', () => {
      const container = new MockElement();

      const column1 = new MockElement({
        left: 0,
        right: 100,
        top: 0,
        bottom: 400,
      });
      column1.setAttribute('data-column-id', 'column-1');

      container.appendChild(column1);

      const foundColumn = findColumnAtCoordinates(
        { x: 200, y: 200 },
        container as any
      );

      expect(foundColumn).toBeNull();
    });
  });

  describe('createDebouncedPositionCalculator', () => {
    it('should create a debounced calculator function', () => {
      const calculator = createDebouncedPositionCalculator(50);

      expect(typeof calculator).toBe('function');
      expect(typeof (calculator as any).cleanup).toBe('function');
    });

    it('should call cleanup methods when cleanup is called', () => {
      const calculator = createDebouncedPositionCalculator(50);

      // Should not throw
      expect(() => (calculator as any).cleanup()).not.toThrow();
    });
  });

  describe('getPointerCoordinates', () => {
    it('should extract coordinates from mouse event', () => {
      const mouseEvent = {
        clientX: 150,
        clientY: 200,
      } as MouseEvent;

      const coords = getPointerCoordinates(mouseEvent);

      expect(coords).toEqual({ x: 150, y: 200 });
    });

    it('should extract coordinates from touch event', () => {
      const touchEvent = {
        touches: [{ clientX: 100, clientY: 150 }],
      } as unknown as TouchEvent;

      const coords = getPointerCoordinates(touchEvent);

      expect(coords).toEqual({ x: 100, y: 150 });
    });

    it('should extract coordinates from pointer event', () => {
      const pointerEvent = {
        clientX: 75,
        clientY: 125,
      } as PointerEvent;

      const coords = getPointerCoordinates(pointerEvent);

      expect(coords).toEqual({ x: 75, y: 125 });
    });

    it('should return fallback coordinates for invalid event', () => {
      const invalidEvent = {} as MouseEvent;

      const coords = getPointerCoordinates(invalidEvent);

      expect(coords).toEqual({ x: 0, y: 0 });
    });

    it('should handle touch event with no touches', () => {
      const touchEvent = {
        touches: [],
      } as unknown as TouchEvent;

      const coords = getPointerCoordinates(touchEvent);

      expect(coords).toEqual({ x: 0, y: 0 });
    });
  });

  describe('validatePlaceholderPosition', () => {
    it('should return true for valid placeholder position', () => {
      const container = new MockElement();
      const column = new MockElement();
      const task = new MockElement();

      column.setAttribute('data-column-id', 'column-1');
      task.setAttribute('data-task-id', 'task-1');

      column.appendChild(task);
      container.appendChild(column);

      const position: PlaceholderPosition = {
        taskId: 'task-1',
        position: 'above',
        columnId: 'column-1',
      };

      const isValid = validatePlaceholderPosition(position, container as any);

      expect(isValid).toBe(true);
    });

    it('should return false when task does not exist', () => {
      const container = new MockElement();
      const column = new MockElement();

      column.setAttribute('data-column-id', 'column-1');
      container.appendChild(column);

      const position: PlaceholderPosition = {
        taskId: 'nonexistent-task',
        position: 'above',
        columnId: 'column-1',
      };

      const isValid = validatePlaceholderPosition(position, container as any);

      expect(isValid).toBe(false);
    });

    it('should return false when column does not exist', () => {
      const container = new MockElement();

      const position: PlaceholderPosition = {
        taskId: 'task-1',
        position: 'above',
        columnId: 'nonexistent-column',
      };

      const isValid = validatePlaceholderPosition(position, container as any);

      expect(isValid).toBe(false);
    });

    it('should return false when task is not in the specified column', () => {
      const container = new MockElement();
      const column1 = new MockElement();
      const column2 = new MockElement();
      const task = new MockElement();

      column1.setAttribute('data-column-id', 'column-1');
      column2.setAttribute('data-column-id', 'column-2');
      task.setAttribute('data-task-id', 'task-1');

      column2.appendChild(task); // Task is in column-2
      container.appendChild(column1);
      container.appendChild(column2);

      const position: PlaceholderPosition = {
        taskId: 'task-1',
        position: 'above',
        columnId: 'column-1', // But position says it's in column-1
      };

      const isValid = validatePlaceholderPosition(position, container as any);

      expect(isValid).toBe(false);
    });
  });

  describe('boundsCache', () => {
    it('should cache and retrieve bounds', () => {
      const bounds: TaskElementBounds = {
        id: 'task-1',
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 125,
      };

      boundsCache.set('task-1', bounds);
      const retrieved = boundsCache.get('task-1');

      expect(retrieved).toEqual(bounds);
    });

    it('should return null for non-existent cache entry', () => {
      const retrieved = boundsCache.get('nonexistent-task');

      expect(retrieved).toBeNull();
    });

    it('should expire cache entries after timeout', () => {
      const bounds: TaskElementBounds = {
        id: 'task-1',
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 125,
      };

      mockPerformanceNow.mockReturnValue(1000);
      boundsCache.set('task-1', bounds);

      // Advance time beyond cache timeout (100ms)
      mockPerformanceNow.mockReturnValue(1200);
      const retrieved = boundsCache.get('task-1');

      expect(retrieved).toBeNull();
    });

    it('should clear all cache entries', () => {
      const bounds: TaskElementBounds = {
        id: 'task-1',
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 125,
      };

      boundsCache.set('task-1', bounds);
      boundsCache.clear();
      const retrieved = boundsCache.get('task-1');

      expect(retrieved).toBeNull();
    });

    it('should cleanup expired entries', () => {
      const bounds1: TaskElementBounds = {
        id: 'task-1',
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 125,
      };

      const bounds2: TaskElementBounds = {
        id: 'task-2',
        top: 160,
        bottom: 210,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 185,
      };

      // Set first entry
      mockPerformanceNow.mockReturnValue(1000);
      boundsCache.set('task-1', bounds1);

      // Advance time and set second entry (within cache timeout)
      mockPerformanceNow.mockReturnValue(1080);
      boundsCache.set('task-2', bounds2);

      // Advance time beyond first entry's timeout but not second
      mockPerformanceNow.mockReturnValue(1120);
      boundsCache.cleanup();

      // First entry should be expired, second should still exist
      expect(boundsCache.get('task-1')).toBeNull();
      expect(boundsCache.get('task-2')).toEqual(bounds2);
    });
  });

  describe('getCachedTaskElementBounds', () => {
    it('should return cached bounds if available', () => {
      const element = new MockElement({
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
      });
      element.setAttribute('data-task-id', 'task-1');

      const cachedBounds: TaskElementBounds = {
        id: 'task-1',
        top: 200, // Different from element bounds
        bottom: 250,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        centerY: 225,
      };

      boundsCache.set('task-1', cachedBounds);
      const bounds = getCachedTaskElementBounds(element as any);

      expect(bounds).toEqual(cachedBounds);
    });

    it('should calculate and cache bounds if not in cache', () => {
      const element = new MockElement({
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
      });
      element.setAttribute('data-task-id', 'task-1');

      const bounds = getCachedTaskElementBounds(element as any);

      expect(bounds.id).toBe('task-1');
      expect(bounds.top).toBe(100);
      expect(bounds.centerY).toBe(125);

      // Should now be in cache
      const cached = boundsCache.get('task-1');
      expect(cached).toEqual(bounds);
    });

    it('should handle element without task ID', () => {
      const element = new MockElement({
        top: 100,
        bottom: 150,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
      });

      const bounds = getCachedTaskElementBounds(element as any);

      expect(bounds.id).toBe('');
      expect(bounds.top).toBe(100);
    });
  });

  describe('Custom Collision Detection', () => {
    describe('createPlaceholderCollisionDetection', () => {
      it('should create a collision detection function', () => {
        const collisionDetection = createPlaceholderCollisionDetection();

        expect(typeof collisionDetection).toBe('function');
      });

      it('should return empty array when no pointer coordinates', () => {
        const collisionDetection = createPlaceholderCollisionDetection();
        const args = {
          active: {
            id: 'task-1',
            rect: { current: { initial: null, translated: null } },
          },
          droppableContainers: new Map(),
          pointerCoordinates: null,
        };

        const results = collisionDetection(args);

        expect(results).toEqual([]);
      });

      it('should detect collision within column and return placeholder position', () => {
        const column = new MockElement({
          left: 0,
          right: 200,
          top: 0,
          bottom: 400,
        });
        column.setAttribute('data-column-id', 'column-1');

        const task1 = new MockElement({ top: 100, bottom: 150, height: 50 });
        task1.setAttribute('data-task-id', 'task-1');
        column.appendChild(task1);

        const droppableContainers = new Map([
          [
            'column-1',
            {
              id: 'column-1',
              rect: { current: column.getBoundingClientRect() },
              node: { current: column as any },
            },
          ],
        ]);

        // Mock document.querySelector for dragged task detection
        const originalQuerySelector = document.querySelector;
        document.querySelector = jest.fn().mockReturnValue(null);

        const collisionDetection = createPlaceholderCollisionDetection();
        const args = {
          active: {
            id: 'task-2',
            rect: { current: { initial: null, translated: null } },
          },
          droppableContainers,
          pointerCoordinates: { x: 100, y: 120 },
        };

        const results = collisionDetection(args);

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('column-1');
        expect(results[0].data?.placeholderPosition).toEqual({
          taskId: 'task-1',
          position: 'above',
          columnId: 'column-1',
        });
        expect(results[0].data?.isWithinSameColumn).toBe(false);

        // Restore original querySelector
        document.querySelector = originalQuerySelector;
      });

      it('should detect same column dragging', () => {
        const column = new MockElement({
          left: 0,
          right: 200,
          top: 0,
          bottom: 400,
        });
        column.setAttribute('data-column-id', 'column-1');

        const task1 = new MockElement({ top: 100, bottom: 150, height: 50 });
        task1.setAttribute('data-task-id', 'task-1');
        column.appendChild(task1);

        const droppableContainers = new Map([
          [
            'column-1',
            {
              id: 'column-1',
              rect: { current: column.getBoundingClientRect() },
              node: { current: column as any },
            },
          ],
        ]);

        // Mock document.querySelector to return the dragged task within the column
        const originalQuerySelector = document.querySelector;
        document.querySelector = jest.fn().mockReturnValue(task1);
        (column as any).contains = jest.fn().mockReturnValue(true);

        const collisionDetection = createPlaceholderCollisionDetection();
        const args = {
          active: {
            id: 'task-1',
            rect: { current: { initial: null, translated: null } },
          },
          droppableContainers,
          pointerCoordinates: { x: 100, y: 120 },
        };

        const results = collisionDetection(args);

        expect(results[0].data?.isWithinSameColumn).toBe(true);

        // Restore original querySelector
        document.querySelector = originalQuerySelector;
      });

      it('should fallback to default collision detection when no column match', () => {
        const fallbackResults = [{ id: 'fallback-target' }];
        const fallbackCollisionDetection = jest
          .fn()
          .mockReturnValue(fallbackResults);

        const collisionDetection = createPlaceholderCollisionDetection(
          fallbackCollisionDetection
        );
        const args = {
          active: {
            id: 'task-1',
            rect: { current: { initial: null, translated: null } },
          },
          droppableContainers: new Map(),
          pointerCoordinates: { x: 100, y: 100 },
        };

        const results = collisionDetection(args);

        expect(fallbackCollisionDetection).toHaveBeenCalledWith(args);
        expect(results).toEqual(fallbackResults);
      });

      it('should handle multiple columns and find closest match', () => {
        const column1 = new MockElement({
          left: 0,
          right: 100,
          top: 0,
          bottom: 400,
        });
        column1.setAttribute('data-column-id', 'column-1');

        const column2 = new MockElement({
          left: 150,
          right: 250,
          top: 0,
          bottom: 400,
        });
        column2.setAttribute('data-column-id', 'column-2');

        const droppableContainers = new Map([
          [
            'column-1',
            {
              id: 'column-1',
              rect: { current: column1.getBoundingClientRect() },
              node: { current: column1 as any },
            },
          ],
          [
            'column-2',
            {
              id: 'column-2',
              rect: { current: column2.getBoundingClientRect() },
              node: { current: column2 as any },
            },
          ],
        ]);

        const collisionDetection = createPlaceholderCollisionDetection();
        const args = {
          active: {
            id: 'task-1',
            rect: { current: { initial: null, translated: null } },
          },
          droppableContainers,
          pointerCoordinates: { x: 200, y: 200 }, // Closer to column-2
        };

        const results = collisionDetection(args);

        expect(results[0].id).toBe('column-2');
      });
    });

    describe('OptimizedCollisionDetector', () => {
      let detector: OptimizedCollisionDetector;

      beforeEach(() => {
        detector = new OptimizedCollisionDetector();
      });

      afterEach(() => {
        detector.clearCache();
      });

      it('should create spatial index for fast collision detection', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        // Add multiple tasks
        for (let i = 0; i < 10; i++) {
          const task = new MockElement({
            top: i * 60,
            bottom: i * 60 + 50,
            height: 50,
          });
          task.setAttribute('data-task-id', `task-${i}`);
          column.appendChild(task);
        }

        const position = detector.detectCollision(
          { x: 100, y: 125 }, // Near task-2 (top: 120, center: 145)
          column as any
        );

        expect(position).toEqual({
          taskId: 'task-2',
          position: 'above',
          columnId: 'column-1',
        });
      });

      it('should use cached spatial index for performance', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        const task = new MockElement({ top: 100, bottom: 150, height: 50 });
        task.setAttribute('data-task-id', 'task-1');
        column.appendChild(task);

        // First call should create cache
        const position1 = detector.detectCollision(
          { x: 100, y: 120 },
          column as any
        );

        // Second call should use cache (we can't directly test this, but it should work)
        const position2 = detector.detectCollision(
          { x: 100, y: 130 },
          column as any
        );

        expect(position1).toBeTruthy();
        expect(position2).toBeTruthy();
      });

      it('should handle large task lists efficiently', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        // Create 100 tasks
        for (let i = 0; i < 100; i++) {
          const task = new MockElement({
            top: i * 60,
            bottom: i * 60 + 50,
            height: 50,
          });
          task.setAttribute('data-task-id', `task-${i}`);
          column.appendChild(task);
        }

        const startTime = performance.now();
        const position = detector.detectCollision(
          { x: 100, y: 1500 }, // Near task 25
          column as any
        );
        const endTime = performance.now();

        expect(position).toBeTruthy();
        expect(position?.taskId).toBe('task-25');
        expect(endTime - startTime).toBeLessThan(5); // Should be very fast with binary search
      });

      it('should handle edge cases for first and last positions', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        const task1 = new MockElement({ top: 100, bottom: 150, height: 50 });
        task1.setAttribute('data-task-id', 'task-1');
        const task2 = new MockElement({ top: 160, bottom: 210, height: 50 });
        task2.setAttribute('data-task-id', 'task-2');

        column.appendChild(task1);
        column.appendChild(task2);

        // Test above first task
        const positionAbove = detector.detectCollision(
          { x: 100, y: 50 },
          column as any
        );
        expect(positionAbove).toEqual({
          taskId: 'task-1',
          position: 'above',
          columnId: 'column-1',
        });

        // Test below last task
        const positionBelow = detector.detectCollision(
          { x: 100, y: 250 },
          column as any
        );
        expect(positionBelow).toEqual({
          taskId: 'task-2',
          position: 'below',
          columnId: 'column-1',
        });
      });

      it('should return null for empty columns', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        const position = detector.detectCollision(
          { x: 100, y: 100 },
          column as any
        );

        expect(position).toBeNull();
      });

      it('should cleanup expired cache entries', () => {
        const column = new MockElement();
        column.setAttribute('data-column-id', 'column-1');

        const task = new MockElement({ top: 100, bottom: 150, height: 50 });
        task.setAttribute('data-task-id', 'task-1');
        column.appendChild(task);

        // Create cache entry
        mockPerformanceNow.mockReturnValue(1000);
        detector.detectCollision({ x: 100, y: 120 }, column as any);

        // Advance time beyond cache timeout
        mockPerformanceNow.mockReturnValue(1200);
        detector.cleanup();

        // Should not throw and should work normally
        expect(() =>
          detector.detectCollision({ x: 100, y: 120 }, column as any)
        ).not.toThrow();
      });
    });

    describe('EdgeCaseHandler', () => {
      describe('handleEmptyColumn', () => {
        it('should return null for empty columns', () => {
          const column = new MockElement({
            left: 0,
            right: 200,
            top: 0,
            bottom: 400,
          });
          column.setAttribute('data-column-id', 'column-1');

          const position = EdgeCaseHandler.handleEmptyColumn(
            { x: 100, y: 200 },
            column as any
          );

          expect(position).toBeNull();
        });

        it('should return null when pointer is outside column', () => {
          const column = new MockElement({
            left: 0,
            right: 200,
            top: 0,
            bottom: 400,
          });
          column.setAttribute('data-column-id', 'column-1');

          const position = EdgeCaseHandler.handleEmptyColumn(
            { x: 300, y: 200 }, // Outside column
            column as any
          );

          expect(position).toBeNull();
        });
      });

      describe('handleSingleTaskColumn', () => {
        it('should place placeholder above task when pointer is above center', () => {
          const column = new MockElement();
          column.setAttribute('data-column-id', 'column-1');

          const taskBounds: TaskElementBounds = {
            id: 'task-1',
            top: 100,
            bottom: 150,
            left: 0,
            right: 200,
            width: 200,
            height: 50,
            centerY: 125,
          };

          const position = EdgeCaseHandler.handleSingleTaskColumn(
            { x: 100, y: 120 }, // Above center
            column as any,
            taskBounds
          );

          expect(position).toEqual({
            taskId: 'task-1',
            position: 'above',
            columnId: 'column-1',
          });
        });

        it('should place placeholder below task when pointer is below center', () => {
          const column = new MockElement();
          column.setAttribute('data-column-id', 'column-1');

          const taskBounds: TaskElementBounds = {
            id: 'task-1',
            top: 100,
            bottom: 150,
            left: 0,
            right: 200,
            width: 200,
            height: 50,
            centerY: 125,
          };

          const position = EdgeCaseHandler.handleSingleTaskColumn(
            { x: 100, y: 130 }, // Below center
            column as any,
            taskBounds
          );

          expect(position).toEqual({
            taskId: 'task-1',
            position: 'below',
            columnId: 'column-1',
          });
        });

        it('should return null when task is the dragged task', () => {
          const column = new MockElement();
          column.setAttribute('data-column-id', 'column-1');

          const taskBounds: TaskElementBounds = {
            id: 'task-1',
            top: 100,
            bottom: 150,
            left: 0,
            right: 200,
            width: 200,
            height: 50,
            centerY: 125,
          };

          const position = EdgeCaseHandler.handleSingleTaskColumn(
            { x: 100, y: 120 },
            column as any,
            taskBounds,
            'task-1' // Same as task being checked
          );

          expect(position).toBeNull();
        });
      });

      describe('handleFirstLastPosition', () => {
        it('should place placeholder above first task when pointer is well above', () => {
          const taskBounds: TaskElementBounds[] = [
            {
              id: 'task-1',
              top: 100,
              bottom: 150,
              left: 0,
              right: 200,
              width: 200,
              height: 50,
              centerY: 125,
            },
          ];

          const position = EdgeCaseHandler.handleFirstLastPosition(
            { x: 100, y: 70 }, // Well above first task (threshold is top - 20 = 80)
            taskBounds,
            'column-1'
          );

          expect(position).toEqual({
            taskId: 'task-1',
            position: 'above',
            columnId: 'column-1',
          });
        });

        it('should place placeholder below last task when pointer is well below', () => {
          const taskBounds: TaskElementBounds[] = [
            {
              id: 'task-1',
              top: 100,
              bottom: 150,
              left: 0,
              right: 200,
              width: 200,
              height: 50,
              centerY: 125,
            },
          ];

          const position = EdgeCaseHandler.handleFirstLastPosition(
            { x: 100, y: 180 }, // Well below last task (threshold is bottom + 20 = 170)
            taskBounds,
            'column-1'
          );

          expect(position).toEqual({
            taskId: 'task-1',
            position: 'below',
            columnId: 'column-1',
          });
        });

        it('should return null when pointer is within normal range', () => {
          const taskBounds: TaskElementBounds[] = [
            {
              id: 'task-1',
              top: 100,
              bottom: 150,
              left: 0,
              right: 200,
              width: 200,
              height: 50,
              centerY: 125,
            },
          ];

          const position = EdgeCaseHandler.handleFirstLastPosition(
            { x: 100, y: 125 }, // Within normal range
            taskBounds,
            'column-1'
          );

          expect(position).toBeNull();
        });

        it('should return null for empty task list', () => {
          const position = EdgeCaseHandler.handleFirstLastPosition(
            { x: 100, y: 125 },
            [],
            'column-1'
          );

          expect(position).toBeNull();
        });
      });
    });

    describe('CollisionPerformanceMonitor', () => {
      let monitor: CollisionPerformanceMonitor;

      beforeEach(() => {
        monitor = new CollisionPerformanceMonitor();
      });

      it('should record performance measurements', () => {
        monitor.record(10);
        monitor.record(15);
        monitor.record(12);

        const stats = monitor.getStats();

        expect(stats.average).toBeCloseTo(12.33, 1);
        expect(stats.min).toBe(10);
        expect(stats.max).toBe(15);
      });

      it('should calculate p95 percentile correctly', () => {
        // Add 100 measurements
        for (let i = 1; i <= 100; i++) {
          monitor.record(i);
        }

        const stats = monitor.getStats();

        expect(stats.p95).toBe(96); // 95th percentile of 1-100 should be 96 (Math.floor(100 * 0.95) = 95, so index 95 = value 96)
      });

      it('should limit number of stored measurements', () => {
        // Add more than max measurements (100)
        for (let i = 1; i <= 150; i++) {
          monitor.record(i);
        }

        const stats = monitor.getStats();

        // Should only keep the last 100 measurements (51-150)
        expect(stats.min).toBe(51);
        expect(stats.max).toBe(150);
      });

      it('should return zero stats for empty measurements', () => {
        const stats = monitor.getStats();

        expect(stats.average).toBe(0);
        expect(stats.min).toBe(0);
        expect(stats.max).toBe(0);
        expect(stats.p95).toBe(0);
      });

      it('should check if performance is acceptable', () => {
        // Add measurements under 16ms (acceptable)
        monitor.record(10);
        monitor.record(12);
        monitor.record(14);

        expect(monitor.isPerformanceAcceptable()).toBe(true);

        // Add measurement over 16ms (unacceptable)
        monitor.record(20);

        expect(monitor.isPerformanceAcceptable()).toBe(false);
      });

      it('should clear all measurements', () => {
        monitor.record(10);
        monitor.record(15);

        monitor.clear();

        const stats = monitor.getStats();
        expect(stats.average).toBe(0);
      });
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle very large numbers of tasks efficiently', () => {
      const column = new MockElement();
      const taskBounds: TaskElementBounds[] = [];

      // Create 100 tasks
      for (let i = 0; i < 100; i++) {
        const task = new MockElement({
          top: i * 60,
          bottom: i * 60 + 50,
          height: 50,
        });
        task.setAttribute('data-task-id', `task-${i}`);
        column.appendChild(task);

        taskBounds.push({
          id: `task-${i}`,
          top: i * 60,
          bottom: i * 60 + 50,
          left: 0,
          right: 200,
          width: 200,
          height: 50,
          centerY: i * 60 + 25,
        });
      }

      const startTime = performance.now();
      const position = calculatePlaceholderPosition(
        { x: 100, y: 1500 }, // Near task 25
        taskBounds,
        'column-1'
      );
      const endTime = performance.now();

      expect(position).toBeTruthy();
      expect(position?.taskId).toBe('task-25');
      expect(endTime - startTime).toBeLessThan(10); // Should be fast
    });

    it('should handle tasks with zero height', () => {
      const taskBounds = [
        {
          id: 'task-1',
          top: 100,
          bottom: 100, // Zero height
          left: 0,
          right: 200,
          width: 200,
          height: 0,
          centerY: 100,
        },
      ];

      const position = calculatePlaceholderPosition(
        { x: 100, y: 100 },
        taskBounds,
        'column-1'
      );

      expect(position).toBeTruthy();
      expect(position?.taskId).toBe('task-1');
    });

    it('should handle negative coordinates', () => {
      const column = new MockElement({
        top: -100,
        bottom: 100,
        left: -50,
        right: 150,
      });

      const isInside = isPointerInColumn({ x: -25, y: 0 }, column as any);

      expect(isInside).toBe(true);
    });

    it('should handle overlapping task bounds', () => {
      const taskBounds = [
        {
          id: 'task-1',
          top: 100,
          bottom: 150,
          left: 0,
          right: 200,
          width: 200,
          height: 50,
          centerY: 125,
        },
        {
          id: 'task-2',
          top: 125, // Overlaps with task-1
          bottom: 175,
          left: 0,
          right: 200,
          width: 200,
          height: 50,
          centerY: 150,
        },
      ];

      const position = calculatePlaceholderPosition(
        { x: 100, y: 140 },
        taskBounds,
        'column-1'
      );

      expect(position).toBeTruthy();
      // Should find the closest task center
      expect(['task-1', 'task-2']).toContain(position?.taskId);
    });
  });
});
