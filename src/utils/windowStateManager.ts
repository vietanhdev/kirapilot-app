import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi';

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'kirapilot-window-state';
const MAX_STATE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Add debug methods to global window object for easy testing
if (typeof window !== 'undefined') {
  (window as unknown as { debugWindowState: unknown }).debugWindowState = {
    save: () => WindowStateManager.debugSaveState(),
    test: () => WindowStateManager.testRestoration(),
    current: () => WindowStateManager.getCurrentWindowState(),
    load: () => WindowStateManager.loadWindowState(),
    clear: () => WindowStateManager.clearWindowState(),
    maximize: () => WindowStateManager.maximizeWindow(),
  };
}

export class WindowStateManager {
  /**
   * Save the current window state to localStorage
   */
  static async saveCurrentWindowState(): Promise<WindowState | null> {
    try {
      const appWindow = getCurrentWindow();
      const currentSize = await appWindow.innerSize();
      const currentPosition = await appWindow.outerPosition();
      const isMaximized = await appWindow.isMaximized();

      console.log('Raw window data from Tauri:');
      console.log('- Size:', currentSize);
      console.log('- Position:', currentPosition);
      console.log('- Is Maximized:', isMaximized);

      const windowState: WindowState = {
        width: currentSize.width,
        height: currentSize.height,
        x: currentPosition.x,
        y: currentPosition.y,
        isMaximized: isMaximized,
        timestamp: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(windowState));
      console.log('✅ Window state saved successfully:', windowState);

      return windowState;
    } catch (error) {
      console.error('❌ Error saving window state:', error);
      return null;
    }
  }

  /**
   * Load window state from localStorage
   */
  static loadWindowState(): WindowState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const windowState: WindowState = JSON.parse(stored);

      // Check if the state is too old
      if (Date.now() - windowState.timestamp > MAX_STATE_AGE) {
        console.log('Window state is too old, discarding');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // Validate the state
      if (!this.isValidWindowState(windowState)) {
        console.log('Invalid window state, discarding');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      console.log('Window state loaded:', windowState);
      return windowState;
    } catch (error) {
      console.error('Error loading window state:', error);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  /**
   * Restore window to the saved state
   */
  static async restoreWindowState(windowState: WindowState): Promise<boolean> {
    try {
      const appWindow = getCurrentWindow();

      console.log('🔄 Starting window restoration...');
      console.log('Original saved state:', windowState);

      // Get current state for comparison
      const currentSize = await appWindow.innerSize();
      const currentPosition = await appWindow.outerPosition();
      const currentMaximized = await appWindow.isMaximized();
      console.log('Current window state:', {
        width: currentSize.width,
        height: currentSize.height,
        x: currentPosition.x,
        y: currentPosition.y,
        isMaximized: currentMaximized,
      });

      // If the saved state was maximized, just maximize the window
      if (windowState.isMaximized) {
        console.log('🔄 Restoring to maximized state...');
        await appWindow.maximize();
        console.log('✅ Window maximized successfully');
        return true;
      }

      // Otherwise, restore to specific size and position
      // First ensure window is not maximized
      if (currentMaximized) {
        await appWindow.unmaximize();
        // Small delay to ensure unmaximize completes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Validate and sanitize the window state
      const validatedState = this.validateAndSanitizeState(windowState);

      console.log('🎯 Applying window state:', validatedState);

      // Restore window size and position
      await appWindow.setSize(
        new LogicalSize(validatedState.width, validatedState.height)
      );

      // Small delay to ensure size is set before position
      await new Promise(resolve => setTimeout(resolve, 50));

      await appWindow.setPosition(
        new LogicalPosition(validatedState.x, validatedState.y)
      );

      // Verify the restoration
      const newSize = await appWindow.innerSize();
      const newPosition = await appWindow.outerPosition();
      const newMaximized = await appWindow.isMaximized();
      console.log('✅ Window state after restoration:', {
        width: newSize.width,
        height: newSize.height,
        x: newPosition.x,
        y: newPosition.y,
        isMaximized: newMaximized,
      });

      return true;
    } catch (error) {
      console.error('❌ Error restoring window state:', error);
      return false;
    }
  }

  /**
   * Clear saved window state
   */
  static clearWindowState(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Window state cleared');
  }

  /**
   * Set window to focus mode dimensions
   */
  static async setFocusMode(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();

      // First unmaximize if currently maximized
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        await appWindow.unmaximize();
        // Small delay to ensure unmaximize completes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const sidebarWidth = 400;
      const sidebarHeight = 800;

      await appWindow.setSize(new LogicalSize(sidebarWidth, sidebarHeight));
      await appWindow.setPosition(new LogicalPosition(20, 100));

      console.log('Focus mode dimensions set');
    } catch (error) {
      console.error('Error setting focus mode:', error);
      throw error;
    }
  }

  /**
   * Maximize the window
   */
  static async maximizeWindow(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.maximize();
      console.log('✅ Window maximized');
    } catch (error) {
      console.error('❌ Error maximizing window:', error);
      throw error;
    }
  }

  /**
   * Set window to default dimensions or maximize for ease
   */
  static async setDefaultDimensions(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();

      // For ease of use, maximize the window by default
      console.log('🔄 Setting window to maximized state for ease of use...');
      await appWindow.maximize();
      console.log('✅ Window maximized successfully');
    } catch (error) {
      console.error('Error maximizing window:', error);

      // Fallback to specific dimensions if maximize fails
      try {
        const appWindow = getCurrentWindow();
        const defaultWidth = 1000;
        const defaultHeight = 700;

        await appWindow.setSize(new LogicalSize(defaultWidth, defaultHeight));
        await appWindow.setPosition(new LogicalPosition(100, 100));

        console.log(
          `Fallback dimensions set: ${defaultWidth}x${defaultHeight}`
        );
      } catch (fallbackError) {
        console.error('Error setting fallback dimensions:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Get current window state for debugging
   */
  static async getCurrentWindowState(): Promise<WindowState | null> {
    try {
      const appWindow = getCurrentWindow();
      const currentSize = await appWindow.innerSize();
      const currentPosition = await appWindow.outerPosition();
      const isMaximized = await appWindow.isMaximized();

      return {
        width: currentSize.width,
        height: currentSize.height,
        x: currentPosition.x,
        y: currentPosition.y,
        isMaximized: isMaximized,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error getting current window state:', error);
      return null;
    }
  }

  /**
   * Debug method to test window restoration without clearing state
   */
  static async testRestoration(): Promise<void> {
    const savedState = this.loadWindowState();
    if (savedState) {
      console.log('🧪 Testing window restoration...');
      console.log('Saved state:', savedState);

      const currentState = await this.getCurrentWindowState();
      console.log('Current state:', currentState);

      await this.restoreWindowState(savedState);

      // Don't clear state for testing
      console.log(
        '🧪 Test restoration complete (state preserved for further testing)'
      );
    } else {
      console.log('❌ No saved state to test with');
    }
  }

  /**
   * Debug method to manually save current state
   */
  static async debugSaveState(): Promise<void> {
    const state = await this.saveCurrentWindowState();
    console.log('🐛 Debug save complete:', state);
  }

  /**
   * Validate if window state has required properties
   */
  private static isValidWindowState(state: unknown): state is WindowState {
    return (
      typeof state === 'object' &&
      state !== null &&
      'width' in state &&
      'height' in state &&
      'x' in state &&
      'y' in state &&
      'timestamp' in state &&
      typeof (state as WindowState).width === 'number' &&
      typeof (state as WindowState).height === 'number' &&
      typeof (state as WindowState).x === 'number' &&
      typeof (state as WindowState).y === 'number' &&
      typeof (state as WindowState).timestamp === 'number' &&
      (state as WindowState).width > 0 &&
      (state as WindowState).height > 0 &&
      // isMaximized is optional for backward compatibility
      ('isMaximized' in state
        ? typeof (state as WindowState).isMaximized === 'boolean'
        : true)
    );
  }

  /**
   * Validate and sanitize window state values
   */
  private static validateAndSanitizeState(state: WindowState): WindowState {
    // More conservative bounds to prevent oversized windows
    const maxWidth = Math.min(state.width, 1920); // Don't exceed 1920px width
    const maxHeight = Math.min(state.height, 1080); // Don't exceed 1080px height

    const sanitized = {
      width: Math.max(400, maxWidth), // Min 400px, reasonable max
      height: Math.max(300, maxHeight), // Min 300px, reasonable max
      x: Math.max(0, Math.min(state.x, 1920)), // Keep within reasonable screen bounds
      y: Math.max(0, Math.min(state.y, 1080)), // Keep within reasonable screen bounds
      isMaximized: state.isMaximized || false, // Default to false if not set
      timestamp: state.timestamp,
    };

    console.log('Original state:', {
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      isMaximized: state.isMaximized,
    });
    console.log('Sanitized state:', {
      width: sanitized.width,
      height: sanitized.height,
      x: sanitized.x,
      y: sanitized.y,
      isMaximized: sanitized.isMaximized,
    });

    return sanitized;
  }
}
