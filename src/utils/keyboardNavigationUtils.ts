/**
 * Keyboard Navigation Utilities for Drag and Drop Accessibility
 *
 * Provides keyboard navigation support for drag-and-drop operations,
 * including screen reader announcements and focus management.
 */

import { PlaceholderPosition } from './dragPlaceholderUtils';

export interface KeyboardNavigationState {
  isKeyboardMode: boolean;
  currentFocusedTask: string | null;
  currentDropPosition: PlaceholderPosition | null;
  availablePositions: PlaceholderPosition[];
  currentPositionIndex: number;
}

export interface KeyboardNavigationAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  delay?: number;
}

/**
 * Manages keyboard navigation state for drag-and-drop operations
 */
export class KeyboardNavigationManager {
  private state: KeyboardNavigationState;

  private announcementTimeouts: NodeJS.Timeout[] = [];
  private liveRegionElement: HTMLElement | null = null;

  constructor() {
    this.state = {
      isKeyboardMode: false,
      currentFocusedTask: null,
      currentDropPosition: null,
      availablePositions: [],
      currentPositionIndex: -1,
    };

    this.createLiveRegion();
  }

  /**
   * Creates an ARIA live region for screen reader announcements
   */
  private createLiveRegion(): void {
    if (typeof document === 'undefined') {
      return;
    }

    this.liveRegionElement = document.createElement('div');
    this.liveRegionElement.setAttribute('aria-live', 'assertive');
    this.liveRegionElement.setAttribute('aria-atomic', 'true');
    this.liveRegionElement.setAttribute('role', 'status');
    this.liveRegionElement.className = 'sr-only';
    this.liveRegionElement.id = 'drag-drop-announcements';

    document.body.appendChild(this.liveRegionElement);
  }

  /**
   * Announces a message to screen readers
   */
  public announce(announcement: KeyboardNavigationAnnouncement): void {
    if (!this.liveRegionElement) {
      return;
    }

    // Clear existing timeouts
    this.announcementTimeouts.forEach(timeout => clearTimeout(timeout));
    this.announcementTimeouts = [];

    const delay = announcement.delay || 100;

    const timeout = setTimeout(() => {
      if (this.liveRegionElement) {
        this.liveRegionElement.setAttribute('aria-live', announcement.priority);
        this.liveRegionElement.textContent = announcement.message;
      }
    }, delay);

    this.announcementTimeouts.push(timeout);
  }

  /**
   * Enters keyboard navigation mode for drag operations
   */
  public enterKeyboardMode(
    taskId: string,
    availablePositions: PlaceholderPosition[]
  ): void {
    this.state.isKeyboardMode = true;
    this.state.currentFocusedTask = taskId;
    this.state.availablePositions = availablePositions;
    this.state.currentPositionIndex = 0;
    this.state.currentDropPosition = availablePositions[0] || null;

    this.announce({
      message: `Keyboard drag mode activated for task. ${availablePositions.length} drop positions available. Use arrow keys to navigate, Enter or Space to drop, Escape to cancel.`,
      priority: 'assertive',
    });
  }

  /**
   * Exits keyboard navigation mode
   */
  public exitKeyboardMode(): void {
    this.state.isKeyboardMode = false;
    this.state.currentFocusedTask = null;
    this.state.currentDropPosition = null;
    this.state.availablePositions = [];
    this.state.currentPositionIndex = -1;

    this.announce({
      message: 'Keyboard drag mode deactivated.',
      priority: 'polite',
    });
  }

  /**
   * Navigates to the next drop position
   */
  public navigateNext(): PlaceholderPosition | null {
    if (
      !this.state.isKeyboardMode ||
      this.state.availablePositions.length === 0
    ) {
      return null;
    }

    this.state.currentPositionIndex = Math.min(
      this.state.currentPositionIndex + 1,
      this.state.availablePositions.length - 1
    );

    this.state.currentDropPosition =
      this.state.availablePositions[this.state.currentPositionIndex];
    this.announceCurrentPosition();

    return this.state.currentDropPosition;
  }

  /**
   * Navigates to the previous drop position
   */
  public navigatePrevious(): PlaceholderPosition | null {
    if (
      !this.state.isKeyboardMode ||
      this.state.availablePositions.length === 0
    ) {
      return null;
    }

    this.state.currentPositionIndex = Math.max(
      this.state.currentPositionIndex - 1,
      0
    );
    this.state.currentDropPosition =
      this.state.availablePositions[this.state.currentPositionIndex];
    this.announceCurrentPosition();

    return this.state.currentDropPosition;
  }

  /**
   * Announces the current drop position to screen readers
   */
  private announceCurrentPosition(): void {
    if (!this.state.currentDropPosition) {
      return;
    }

    const position = this.state.currentDropPosition;
    const positionNumber = this.state.currentPositionIndex + 1;
    const totalPositions = this.state.availablePositions.length;
    const positionText = position.position === 'above' ? 'before' : 'after';

    this.announce({
      message: `Position ${positionNumber} of ${totalPositions}: Drop ${positionText} task in ${position.columnId} column.`,
      priority: 'assertive',
      delay: 50,
    });
  }

  /**
   * Handles keyboard events for drag-and-drop navigation
   */
  public handleKeyboardEvent(event: KeyboardEvent): {
    handled: boolean;
    action?: 'navigate-next' | 'navigate-previous' | 'drop' | 'cancel';
    position?: PlaceholderPosition | null;
  } {
    if (!this.state.isKeyboardMode) {
      return { handled: false };
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        return {
          handled: true,
          action: 'navigate-next',
          position: this.navigateNext(),
        };

      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        return {
          handled: true,
          action: 'navigate-previous',
          position: this.navigatePrevious(),
        };

      case 'Enter':
      case ' ':
        event.preventDefault();
        return {
          handled: true,
          action: 'drop',
          position: this.state.currentDropPosition,
        };

      case 'Escape':
        event.preventDefault();
        return {
          handled: true,
          action: 'cancel',
          position: null,
        };

      default:
        return { handled: false };
    }
  }

  /**
   * Gets the current keyboard navigation state
   */
  public getState(): Readonly<KeyboardNavigationState> {
    return { ...this.state };
  }

  /**
   * Updates available drop positions during drag operations
   */
  public updateAvailablePositions(positions: PlaceholderPosition[]): void {
    this.state.availablePositions = positions;

    // Adjust current index if it's out of bounds
    if (this.state.currentPositionIndex >= positions.length) {
      this.state.currentPositionIndex = Math.max(0, positions.length - 1);
    }

    this.state.currentDropPosition =
      positions[this.state.currentPositionIndex] || null;
  }

  /**
   * Announces drag operation results
   */
  public announceDragResult(
    success: boolean,
    fromColumn: string,
    toColumn: string,
    position?: number
  ): void {
    if (success) {
      const positionText = position ? ` at position ${position}` : '';
      this.announce({
        message: `Task moved successfully from ${fromColumn} to ${toColumn}${positionText}.`,
        priority: 'assertive',
        delay: 200,
      });
    } else {
      this.announce({
        message: 'Task move cancelled. Task returned to original position.',
        priority: 'polite',
        delay: 100,
      });
    }
  }

  /**
   * Cleanup method to remove live region and clear timeouts
   */
  public cleanup(): void {
    this.announcementTimeouts.forEach(timeout => clearTimeout(timeout));
    this.announcementTimeouts = [];

    if (this.liveRegionElement && this.liveRegionElement.parentNode) {
      this.liveRegionElement.parentNode.removeChild(this.liveRegionElement);
      this.liveRegionElement = null;
    }
  }
}

/**
 * Generates available drop positions for a given column and task list
 */
export function generateAvailableDropPositions(
  columnId: string,
  taskIds: string[],
  excludeTaskId?: string
): PlaceholderPosition[] {
  const positions: PlaceholderPosition[] = [];

  // Filter out the dragged task if specified
  const filteredTaskIds = excludeTaskId
    ? taskIds.filter(id => id !== excludeTaskId)
    : taskIds;

  // Add positions above and below each task
  filteredTaskIds.forEach((taskId, index) => {
    // Position above this task
    positions.push({
      taskId,
      position: 'above',
      columnId,
    });

    // Position below this task (only for the last task)
    if (index === filteredTaskIds.length - 1) {
      positions.push({
        taskId,
        position: 'below',
        columnId,
      });
    }
  });

  // If column is empty or only has the dragged task, add a single position
  if (positions.length === 0) {
    positions.push({
      taskId: 'empty-column',
      position: 'above',
      columnId,
    });
  }

  return positions;
}

/**
 * Calculates the target index for a drop position
 */
export function calculateDropIndex(
  position: PlaceholderPosition,
  taskIds: string[],
  excludeTaskId?: string
): number {
  const filteredTaskIds = excludeTaskId
    ? taskIds.filter(id => id !== excludeTaskId)
    : taskIds;

  if (position.taskId === 'empty-column') {
    return 0;
  }

  const targetIndex = filteredTaskIds.indexOf(position.taskId);

  if (targetIndex === -1) {
    return filteredTaskIds.length;
  }

  return position.position === 'above' ? targetIndex : targetIndex + 1;
}

/**
 * Focus management utilities for keyboard navigation
 */
export class FocusManager {
  private previousFocus: HTMLElement | null = null;

  /**
   * Saves the current focus and sets focus to the specified element
   */
  public setFocus(element: HTMLElement): void {
    this.previousFocus = document.activeElement as HTMLElement;
    element.focus();
  }

  /**
   * Restores focus to the previously focused element
   */
  public restoreFocus(): void {
    if (this.previousFocus && document.contains(this.previousFocus)) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }

  /**
   * Finds the next focusable element in the specified direction
   */
  public findNextFocusable(
    currentElement: HTMLElement,
    direction: 'next' | 'previous'
  ): HTMLElement | null {
    const focusableSelector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusableElements = Array.from(
      document.querySelectorAll(focusableSelector)
    ) as HTMLElement[];

    const currentIndex = focusableElements.indexOf(currentElement);

    if (currentIndex === -1) {
      return null;
    }

    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % focusableElements.length
        : (currentIndex - 1 + focusableElements.length) %
          focusableElements.length;

    return focusableElements[nextIndex] || null;
  }
}
