// Utility functions for drag placeholder position calculation

// Type definitions for @dnd-kit collision detection integration
interface DOMRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

// Simple debounce implementation to avoid external dependencies
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  const { leading = false, trailing = true } = options;

  const debounced = ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    const callNow = leading && timeSinceLastCall >= delay;

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (callNow) {
      lastCallTime = now;
      return func(...args);
    }

    if (trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        func(...args);
      }, delay);
    }
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

export interface PlaceholderPosition {
  taskId: string;
  position: 'above' | 'below';
  columnId: string;
}

export interface TaskElementBounds {
  id: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  width: number;
  centerY: number;
}

export interface PointerCoordinates {
  x: number;
  y: number;
}

/**
 * Efficiently gets DOM bounds for a task element
 * Uses caching to avoid repeated DOM measurements
 */
export function getTaskElementBounds(taskElement: Element): TaskElementBounds {
  const rect = taskElement.getBoundingClientRect();
  const taskId =
    taskElement.getAttribute('data-task-id') ||
    taskElement.id ||
    taskElement.querySelector('[data-task-id]')?.getAttribute('data-task-id') ||
    '';

  return {
    id: taskId,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    height: rect.height,
    width: rect.width,
    centerY: rect.top + rect.height / 2,
  };
}

/**
 * Gets bounds for all task elements in a column
 * Filters out the currently dragged task
 */
export function getColumnTaskBounds(
  columnElement: Element,
  draggedTaskId?: string
): TaskElementBounds[] {
  // Find all task card elements within the column
  const taskElements = columnElement.querySelectorAll('[data-task-id]');
  const bounds: TaskElementBounds[] = [];

  for (let i = 0; i < taskElements.length; i++) {
    const element = taskElements[i];
    const taskId = element.getAttribute('data-task-id');

    // Skip the currently dragged task
    if (taskId && taskId !== draggedTaskId) {
      bounds.push(getTaskElementBounds(element));
    }
  }

  // Sort by vertical position (top to bottom)
  return bounds.sort((a, b) => a.top - b.top);
}

/**
 * Calculates the optimal placeholder position based on pointer coordinates
 * Returns null if no valid position is found
 */
export function calculatePlaceholderPosition(
  pointerCoordinates: PointerCoordinates,
  columnTaskBounds: TaskElementBounds[],
  columnId: string,
  draggedTaskId?: string
): PlaceholderPosition | null {
  if (columnTaskBounds.length === 0) {
    return null;
  }

  const { y: pointerY } = pointerCoordinates;
  let closestTask: TaskElementBounds | null = null;
  let minDistance = Infinity;
  let position: 'above' | 'below' = 'below';

  // Find the closest task to the pointer
  for (const taskBounds of columnTaskBounds) {
    // Skip if this is the dragged task
    if (taskBounds.id === draggedTaskId) {
      continue;
    }

    // Calculate distance from pointer to task center
    const distance = Math.abs(pointerY - taskBounds.centerY);

    if (distance < minDistance) {
      minDistance = distance;
      closestTask = taskBounds;

      // Determine if placeholder should be above or below
      position = pointerY < taskBounds.centerY ? 'above' : 'below';
    }
  }

  // Handle edge cases for first and last positions
  if (columnTaskBounds.length > 0) {
    const firstTask = columnTaskBounds[0];
    const lastTask = columnTaskBounds[columnTaskBounds.length - 1];

    // If pointer is above the first task, place placeholder above it
    if (pointerY < firstTask.top) {
      return {
        taskId: firstTask.id,
        position: 'above',
        columnId,
      };
    }

    // If pointer is below the last task, place placeholder below it
    if (pointerY > lastTask.bottom) {
      return {
        taskId: lastTask.id,
        position: 'below',
        columnId,
      };
    }
  }

  if (!closestTask) {
    return null;
  }

  return {
    taskId: closestTask.id,
    position,
    columnId,
  };
}

/**
 * Determines if the pointer is within a column's bounds
 */
export function isPointerInColumn(
  pointerCoordinates: PointerCoordinates,
  columnElement: Element
): boolean {
  const rect = columnElement.getBoundingClientRect();
  const { x, y } = pointerCoordinates;

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Gets the column ID from a column element
 */
export function getColumnId(columnElement: Element): string {
  return (
    columnElement.getAttribute('data-column-id') ||
    columnElement.id ||
    columnElement
      .querySelector('[data-column-id]')
      ?.getAttribute('data-column-id') ||
    ''
  );
}

/**
 * Finds the column element that contains the given coordinates
 */
export function findColumnAtCoordinates(
  pointerCoordinates: PointerCoordinates,
  containerElement: Element
): Element | null {
  const columnElements = containerElement.querySelectorAll('[data-column-id]');

  for (let i = 0; i < columnElements.length; i++) {
    const column = columnElements[i];
    if (isPointerInColumn(pointerCoordinates, column)) {
      return column;
    }
  }

  return null;
}

/**
 * Performance-optimized placeholder position calculator
 * Uses requestAnimationFrame to maintain 60fps performance
 */
class PlaceholderPositionCalculator {
  private frameId: number | null = null;
  private lastCalculation: number = 0;
  private readonly targetFPS = 60;
  private readonly frameInterval = 1000 / this.targetFPS;

  calculate(
    pointerCoordinates: PointerCoordinates,
    containerElement: Element,
    draggedTaskId?: string,
    callback?: (position: PlaceholderPosition | null) => void
  ): void {
    const now = performance.now();

    // Throttle calculations to maintain 60fps
    if (now - this.lastCalculation < this.frameInterval) {
      return;
    }

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.frameId = requestAnimationFrame(() => {
      this.lastCalculation = now;

      const column = findColumnAtCoordinates(
        pointerCoordinates,
        containerElement
      );
      if (!column) {
        callback?.(null);
        return;
      }

      const columnId = getColumnId(column);
      const taskBounds = getColumnTaskBounds(column, draggedTaskId);
      const position = calculatePlaceholderPosition(
        pointerCoordinates,
        taskBounds,
        columnId,
        draggedTaskId
      );

      callback?.(position);
    });
  }

  cleanup(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}

/**
 * Creates a debounced version of placeholder position calculation
 * Helps prevent excessive calculations during rapid mouse movements
 */
export function createDebouncedPositionCalculator(
  delay: number = 16 // ~60fps
): (
  pointerCoordinates: PointerCoordinates,
  containerElement: Element,
  draggedTaskId?: string,
  callback?: (position: PlaceholderPosition | null) => void
) => void {
  const calculator = new PlaceholderPositionCalculator();

  const debouncedCalculate = debounce(
    (
      pointerCoordinates: unknown,
      containerElement: unknown,
      draggedTaskId?: unknown,
      callback?: unknown
    ) => {
      calculator.calculate(
        pointerCoordinates as PointerCoordinates,
        containerElement as Element,
        draggedTaskId as string | undefined,
        callback as ((position: PlaceholderPosition | null) => void) | undefined
      );
    },
    delay,
    { leading: true, trailing: true }
  );

  // Return a function that includes cleanup
  const wrappedCalculate = (
    pointerCoordinates: PointerCoordinates,
    containerElement: Element,
    draggedTaskId?: string,
    callback?: (position: PlaceholderPosition | null) => void
  ) => {
    debouncedCalculate(
      pointerCoordinates,
      containerElement,
      draggedTaskId,
      callback
    );
  };

  // Add cleanup method to the returned function
  (
    wrappedCalculate as typeof wrappedCalculate & { cleanup: () => void }
  ).cleanup = () => {
    debouncedCalculate.cancel();
    calculator.cleanup();
  };

  return wrappedCalculate;
}

/**
 * Utility to get pointer coordinates from various event types
 */
export function getPointerCoordinates(
  event: MouseEvent | TouchEvent | PointerEvent
): PointerCoordinates {
  if ('touches' in event && event.touches.length > 0) {
    // Touch event
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  } else if ('clientX' in event) {
    // Mouse or pointer event
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  // Fallback
  return { x: 0, y: 0 };
}

/**
 * Validates that a placeholder position is still valid
 * Useful for checking if DOM has changed since calculation
 */
export function validatePlaceholderPosition(
  position: PlaceholderPosition,
  containerElement: Element
): boolean {
  const taskElement = containerElement.querySelector(
    `[data-task-id="${position.taskId}"]`
  );
  const columnElement = containerElement.querySelector(
    `[data-column-id="${position.columnId}"]`
  );

  return !!(
    taskElement &&
    columnElement &&
    columnElement.contains(taskElement)
  );
}

/**
 * Custom collision detection that extends @dnd-kit's closestCenter
 * Provides enhanced collision detection for placeholder positioning
 */
export interface CollisionDetectionArgs {
  active: {
    id: string;
    rect: {
      current: {
        initial: DOMRect | null;
        translated: DOMRect | null;
      };
    };
  };
  droppableContainers: Map<
    string,
    {
      id: string;
      rect: {
        current: DOMRect | null;
      };
      node: {
        current: Element | null;
      };
    }
  >;
  pointerCoordinates: PointerCoordinates | null;
}

export interface CollisionDetectionResult {
  id: string;
  data?: {
    placeholderPosition?: PlaceholderPosition;
    isWithinSameColumn?: boolean;
  };
}

/**
 * Enhanced collision detection that determines both drop target and placeholder position
 * Extends @dnd-kit's closestCenter with placeholder-specific logic
 */
export function createPlaceholderCollisionDetection(
  fallbackCollisionDetection?: (
    args: CollisionDetectionArgs
  ) => CollisionDetectionResult[]
) {
  return function placeholderCollisionDetection(
    args: CollisionDetectionArgs
  ): CollisionDetectionResult[] {
    const { active, droppableContainers, pointerCoordinates } = args;

    if (!pointerCoordinates) {
      // Fallback to default collision detection if no pointer coordinates
      return fallbackCollisionDetection ? fallbackCollisionDetection(args) : [];
    }

    const draggedTaskId = active.id as string;
    const results: CollisionDetectionResult[] = [];

    // Find all column containers
    const columnContainers = Array.from(droppableContainers.values()).filter(
      container => container.node.current?.hasAttribute('data-column-id')
    );

    let bestMatch: {
      container: (typeof columnContainers)[0];
      distance: number;
      placeholderPosition: PlaceholderPosition | null;
      isWithinSameColumn: boolean;
    } | null = null;

    for (const container of columnContainers) {
      const columnElement = container.node.current;
      if (!columnElement) {
        continue;
      }

      const columnRect = container.rect.current;
      if (!columnRect) {
        continue;
      }

      // Check if pointer is within this column
      const isInColumn = isPointerInColumn(pointerCoordinates, columnElement);

      if (isInColumn) {
        const columnId = getColumnId(columnElement);
        const taskBounds = getColumnTaskBounds(columnElement, draggedTaskId);

        // Calculate placeholder position within this column
        const placeholderPosition = calculatePlaceholderPosition(
          pointerCoordinates,
          taskBounds,
          columnId,
          draggedTaskId
        );

        // Determine if this is within the same column as the dragged task
        const draggedTaskElement = document.querySelector(
          `[data-task-id="${draggedTaskId}"]`
        );
        const isWithinSameColumn = draggedTaskElement
          ? columnElement.contains(draggedTaskElement)
          : false;

        // Calculate distance to column center for tie-breaking
        const columnCenterX = columnRect.left + columnRect.width / 2;
        const columnCenterY = columnRect.top + columnRect.height / 2;
        const distance = Math.sqrt(
          Math.pow(pointerCoordinates.x - columnCenterX, 2) +
            Math.pow(pointerCoordinates.y - columnCenterY, 2)
        );

        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = {
            container,
            distance,
            placeholderPosition,
            isWithinSameColumn,
          };
        }
      }
    }

    // If we found a column match, return it with placeholder data
    if (bestMatch) {
      results.push({
        id: bestMatch.container.id,
        data: {
          placeholderPosition: bestMatch.placeholderPosition || undefined,
          isWithinSameColumn: bestMatch.isWithinSameColumn,
        },
      });
    } else {
      // Fallback to default collision detection for cross-column drops
      const fallbackResults = fallbackCollisionDetection
        ? fallbackCollisionDetection(args)
        : [];
      results.push(...fallbackResults);
    }

    return results;
  };
}

/**
 * Optimized collision detection for high-performance scenarios
 * Uses spatial indexing and caching for columns with many tasks (50+)
 */
export class OptimizedCollisionDetector {
  private spatialIndex = new Map<
    string,
    {
      bounds: TaskElementBounds[];
      lastUpdate: number;
    }
  >();
  private readonly indexTimeout = 100; // Cache spatial index for 100ms

  /**
   * Creates a spatial index for fast collision detection
   */
  private createSpatialIndex(
    columnElement: Element,
    draggedTaskId?: string
  ): TaskElementBounds[] {
    const columnId = getColumnId(columnElement);
    const cached = this.spatialIndex.get(columnId);

    if (cached && performance.now() - cached.lastUpdate < this.indexTimeout) {
      return cached.bounds;
    }

    const bounds = getColumnTaskBounds(columnElement, draggedTaskId);

    // Sort by Y position for binary search optimization
    bounds.sort((a, b) => a.top - b.top);

    this.spatialIndex.set(columnId, {
      bounds,
      lastUpdate: performance.now(),
    });

    return bounds;
  }

  /**
   * Fast collision detection using binary search for large task lists
   */
  detectCollision(
    pointerCoordinates: PointerCoordinates,
    columnElement: Element,
    draggedTaskId?: string
  ): PlaceholderPosition | null {
    const columnId = getColumnId(columnElement);
    const taskBounds = this.createSpatialIndex(columnElement, draggedTaskId);

    if (taskBounds.length === 0) {
      return null;
    }

    const { y: pointerY } = pointerCoordinates;

    // Handle edge cases first (more efficient than searching)
    const firstTask = taskBounds[0];
    const lastTask = taskBounds[taskBounds.length - 1];

    if (pointerY < firstTask.top) {
      return {
        taskId: firstTask.id,
        position: 'above',
        columnId,
      };
    }

    if (pointerY > lastTask.bottom) {
      return {
        taskId: lastTask.id,
        position: 'below',
        columnId,
      };
    }

    // Binary search for optimal performance with large lists
    let left = 0;
    let right = taskBounds.length - 1;
    let closestTask: TaskElementBounds | null = null;
    let minDistance = Infinity;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const task = taskBounds[mid];
      const distance = Math.abs(pointerY - task.centerY);

      if (distance < minDistance) {
        minDistance = distance;
        closestTask = task;
      }

      if (pointerY < task.centerY) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    if (!closestTask) {
      return null;
    }

    return {
      taskId: closestTask.id,
      position: pointerY < closestTask.centerY ? 'above' : 'below',
      columnId,
    };
  }

  /**
   * Clears the spatial index cache
   */
  clearCache(): void {
    this.spatialIndex.clear();
  }

  /**
   * Cleans up expired cache entries
   */
  cleanup(): void {
    const now = performance.now();
    const entries = Array.from(this.spatialIndex.entries());

    for (const [key, value] of entries) {
      if (now - value.lastUpdate > this.indexTimeout) {
        this.spatialIndex.delete(key);
      }
    }
  }
}

/**
 * Handles edge cases in collision detection
 */
export class EdgeCaseHandler {
  /**
   * Handles empty column collision detection
   */
  static handleEmptyColumn(
    pointerCoordinates: PointerCoordinates,
    columnElement: Element
  ): PlaceholderPosition | null {
    if (!isPointerInColumn(pointerCoordinates, columnElement)) {
      return null;
    }

    // For empty columns, we don't show task-level placeholders
    // This should be handled by the column-level drop indicator
    return null;
  }

  /**
   * Handles single task column collision detection
   */
  static handleSingleTaskColumn(
    pointerCoordinates: PointerCoordinates,
    columnElement: Element,
    taskBounds: TaskElementBounds,
    draggedTaskId?: string
  ): PlaceholderPosition | null {
    const columnId = getColumnId(columnElement);

    // Skip if this is the dragged task itself
    if (taskBounds.id === draggedTaskId) {
      return null;
    }

    const { y: pointerY } = pointerCoordinates;

    // Determine position relative to the single task
    if (pointerY < taskBounds.centerY) {
      return {
        taskId: taskBounds.id,
        position: 'above',
        columnId,
      };
    } else {
      return {
        taskId: taskBounds.id,
        position: 'below',
        columnId,
      };
    }
  }

  /**
   * Handles first/last position edge cases
   */
  static handleFirstLastPosition(
    pointerCoordinates: PointerCoordinates,
    taskBounds: TaskElementBounds[],
    columnId: string
  ): PlaceholderPosition | null {
    if (taskBounds.length === 0) {
      return null;
    }

    const { y: pointerY } = pointerCoordinates;
    const firstTask = taskBounds[0];
    const lastTask = taskBounds[taskBounds.length - 1];

    // Check if pointer is significantly above first task
    const aboveThreshold = firstTask.top - 20; // 20px threshold
    if (pointerY < aboveThreshold) {
      return {
        taskId: firstTask.id,
        position: 'above',
        columnId,
      };
    }

    // Check if pointer is significantly below last task
    const belowThreshold = lastTask.bottom + 20; // 20px threshold
    if (pointerY > belowThreshold) {
      return {
        taskId: lastTask.id,
        position: 'below',
        columnId,
      };
    }

    return null;
  }
}

/**
 * Performance monitoring for collision detection
 */
export class CollisionPerformanceMonitor {
  private measurements: number[] = [];
  private readonly maxMeasurements = 100;

  /**
   * Records a performance measurement
   */
  record(duration: number): void {
    this.measurements.push(duration);

    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  /**
   * Gets performance statistics
   */
  getStats(): {
    average: number;
    min: number;
    max: number;
    p95: number;
  } {
    if (this.measurements.length === 0) {
      return { average: 0, min: 0, max: 0, p95: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  /**
   * Checks if performance is within acceptable limits
   */
  isPerformanceAcceptable(): boolean {
    const stats = this.getStats();
    return stats.p95 < 16; // Should complete within 16ms (60fps)
  }

  /**
   * Clears all measurements
   */
  clear(): void {
    this.measurements = [];
  }
}

/**
 * Animation configuration for placeholder transitions
 */
export const PLACEHOLDER_TRANSITION_CONFIG = {
  HOVER_DELAY: 100,
  HIDE_DELAY: 50,
  POSITION_TRANSITION_DURATION: 200,
  STAGGER_DELAY: 25,
  REDUCED_MOTION_DURATION: 50,
} as const;

/**
 * Manages smooth placeholder position transitions
 */
export class PlaceholderTransitionManager {
  private currentPosition: PlaceholderPosition | null = null;
  private transitionTimeouts = new Map<string, NodeJS.Timeout>();
  private isTransitioning = false;
  private onPositionChange?: (position: PlaceholderPosition | null) => void;

  constructor(
    onPositionChange?: (position: PlaceholderPosition | null) => void
  ) {
    this.onPositionChange = onPositionChange;
  }

  /**
   * Updates placeholder position with smooth transitions
   */
  updatePosition(
    newPosition: PlaceholderPosition | null,
    options: {
      immediate?: boolean;
      hoverDelay?: number;
      respectReducedMotion?: boolean;
    } = {}
  ): void {
    const {
      immediate = false,
      hoverDelay = PLACEHOLDER_TRANSITION_CONFIG.HOVER_DELAY,
      respectReducedMotion = true,
    } = options;

    // Check if position actually changed
    if (this.positionsEqual(this.currentPosition, newPosition)) {
      return;
    }

    // Clear any pending transitions
    this.clearPendingTransitions();

    // Handle immediate updates (e.g., for reduced motion)
    if (immediate || (respectReducedMotion && this.shouldReduceMotion())) {
      this.setPosition(newPosition);
      return;
    }

    // Handle showing placeholder with hover delay
    if (newPosition && !this.currentPosition) {
      const timeoutId = setTimeout(() => {
        this.setPosition(newPosition);
        this.transitionTimeouts.delete('show');
      }, hoverDelay);

      this.transitionTimeouts.set('show', timeoutId);
      return;
    }

    // Handle hiding placeholder
    if (!newPosition && this.currentPosition) {
      const timeoutId = setTimeout(() => {
        this.setPosition(null);
        this.transitionTimeouts.delete('hide');
      }, PLACEHOLDER_TRANSITION_CONFIG.HIDE_DELAY);

      this.transitionTimeouts.set('hide', timeoutId);
      return;
    }

    // Handle position changes (moving between tasks)
    if (newPosition && this.currentPosition) {
      this.isTransitioning = true;

      // Smooth transition to new position
      const timeoutId = setTimeout(() => {
        this.setPosition(newPosition);
        this.isTransitioning = false;
        this.transitionTimeouts.delete('move');
      }, PLACEHOLDER_TRANSITION_CONFIG.POSITION_TRANSITION_DURATION / 4);

      this.transitionTimeouts.set('move', timeoutId);
    }
  }

  /**
   * Gets the current placeholder position
   */
  getCurrentPosition(): PlaceholderPosition | null {
    return this.currentPosition;
  }

  /**
   * Checks if currently transitioning
   */
  isCurrentlyTransitioning(): boolean {
    return this.isTransitioning;
  }

  /**
   * Immediately sets position without transitions
   */
  setPositionImmediate(position: PlaceholderPosition | null): void {
    this.clearPendingTransitions();
    this.setPosition(position);
  }

  /**
   * Clears all pending transitions and resets state
   */
  reset(): void {
    this.clearPendingTransitions();
    this.setPosition(null);
    this.isTransitioning = false;
  }

  /**
   * Cleanup method to clear timeouts
   */
  cleanup(): void {
    this.clearPendingTransitions();
  }

  private setPosition(position: PlaceholderPosition | null): void {
    this.currentPosition = position;
    this.onPositionChange?.(position);
  }

  private positionsEqual(
    pos1: PlaceholderPosition | null,
    pos2: PlaceholderPosition | null
  ): boolean {
    if (pos1 === pos2) {
      return true;
    }
    if (!pos1 || !pos2) {
      return false;
    }

    return (
      pos1.taskId === pos2.taskId &&
      pos1.position === pos2.position &&
      pos1.columnId === pos2.columnId
    );
  }

  private clearPendingTransitions(): void {
    for (const [key, timeoutId] of this.transitionTimeouts) {
      clearTimeout(timeoutId);
      this.transitionTimeouts.delete(key);
    }
  }

  private shouldReduceMotion(): boolean {
    // Check for reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }
}

/**
 * Staggered animation manager for multiple placeholders
 */
export class StaggeredAnimationManager {
  private animationQueue: Array<{
    id: string;
    callback: () => void;
    delay: number;
  }> = [];
  private isProcessing = false;

  /**
   * Adds an animation to the stagger queue
   */
  addAnimation(
    id: string,
    callback: () => void,
    baseDelay: number = PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY
  ): void {
    // Remove existing animation with same ID
    this.removeAnimation(id);

    const delay =
      baseDelay +
      this.animationQueue.length * PLACEHOLDER_TRANSITION_CONFIG.STAGGER_DELAY;

    this.animationQueue.push({
      id,
      callback,
      delay,
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Removes an animation from the queue
   */
  removeAnimation(id: string): void {
    this.animationQueue = this.animationQueue.filter(item => item.id !== id);
  }

  /**
   * Clears all animations
   */
  clear(): void {
    this.animationQueue = [];
    this.isProcessing = false;
  }

  private async processQueue(): Promise<void> {
    if (this.animationQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    // Process animations with staggered delays
    const animations = [...this.animationQueue];
    this.animationQueue = [];

    for (const animation of animations) {
      setTimeout(() => {
        animation.callback();
      }, animation.delay);
    }

    // Wait for all animations to complete before processing next batch
    const maxDelay = Math.max(...animations.map(a => a.delay));
    setTimeout(() => {
      this.processQueue();
    }, maxDelay + 100);
  }
}

/**
 * Cache for DOM measurements to improve performance
 */
class BoundsCache {
  private cache = new Map<
    string,
    { bounds: TaskElementBounds; timestamp: number }
  >();
  private readonly cacheTimeout = 100; // Cache for 100ms

  get(taskId: string): TaskElementBounds | null {
    const cached = this.cache.get(taskId);
    if (cached && performance.now() - cached.timestamp < this.cacheTimeout) {
      return cached.bounds;
    }
    return null;
  }

  set(taskId: string, bounds: TaskElementBounds): void {
    this.cache.set(taskId, {
      bounds,
      timestamp: performance.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = performance.now();
    const entries = Array.from(this.cache.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

// Export a singleton cache instance
export const boundsCache = new BoundsCache();

/**
 * Enhanced version of getTaskElementBounds that uses caching
 */
export function getCachedTaskElementBounds(
  taskElement: Element
): TaskElementBounds {
  const taskId =
    taskElement.getAttribute('data-task-id') ||
    taskElement.id ||
    taskElement.querySelector('[data-task-id]')?.getAttribute('data-task-id') ||
    '';

  // Try to get from cache first
  const cached = boundsCache.get(taskId);
  if (cached) {
    return cached;
  }

  // Calculate and cache
  const bounds = getTaskElementBounds(taskElement);
  if (taskId) {
    boundsCache.set(taskId, bounds);
  }

  return bounds;
}
