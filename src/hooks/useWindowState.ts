import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useWindowState() {
  const [isMaximized, setIsMaximized] = useState(false);
  const lastMaximizedState = useRef<boolean | null>(null);

  useEffect(() => {
    let unlistenResize: (() => void) | undefined;
    let debounceTimeout: NodeJS.Timeout | undefined;

    const setupWindowListeners = async () => {
      try {
        const appWindow = getCurrentWindow();

        // Check initial state
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
        lastMaximizedState.current = maximized;

        // Debounced state check function
        const debouncedStateCheck = () => {
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          debounceTimeout = setTimeout(async () => {
            try {
              const currentMaximized = await appWindow.isMaximized();
              // Only update state if it actually changed
              if (currentMaximized !== lastMaximizedState.current) {
                setIsMaximized(currentMaximized);
                lastMaximizedState.current = currentMaximized;
              }
            } catch (error) {
              console.error('Error checking maximized state:', error);
            }
          }, 200); // Increased debounce time to reduce excessive calls
        };

        // Listen for window resize events to detect maximize/unmaximize
        unlistenResize = await appWindow.onResized(debouncedStateCheck);
      } catch (error) {
        console.error('Error setting up window listeners:', error);
      }
    };

    setupWindowListeners();

    return () => {
      if (unlistenResize) {
        unlistenResize();
      }
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, []);

  const toggleMaximize = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();

      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }

      // Force a state check after the operation with a longer delay
      setTimeout(async () => {
        try {
          const newState = await appWindow.isMaximized();
          if (newState !== lastMaximizedState.current) {
            setIsMaximized(newState);
            lastMaximizedState.current = newState;
          }
        } catch (error) {
          console.error('Error checking state after toggle:', error);
        }
      }, 150);
    } catch (error) {
      console.error('Error toggling maximize:', error);
    }
  }, [isMaximized]);

  return { isMaximized, toggleMaximize };
}
