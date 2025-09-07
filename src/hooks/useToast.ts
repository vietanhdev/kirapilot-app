import { useState, useCallback, useRef } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UseToastReturn {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

/**
 * Hook for managing toast notifications
 * Provides a simple API for showing success, error, warning, and info toasts
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));

    // Clear timeout if it exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 5000);

      const newToast: ToastMessage = {
        ...toast,
        id,
        duration,
      };

      setToasts(prev => [...prev, newToast]);

      // Auto-hide after duration
      if (duration > 0) {
        const timeout = setTimeout(() => {
          hideToast(id);
        }, duration);

        timeoutRefs.current.set(id, timeout);
      }
    },
    [hideToast]
  );

  const clearAllToasts = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();

    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    hideToast,
    clearAllToasts,
  };
}

// Convenience functions for common toast types
export function useToastHelpers() {
  const { showToast } = useToast();

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'success', title, message });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, action?: ToastMessage['action']) => {
      showToast({ type: 'error', title, message, action, duration: 8000 });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'warning', title, message });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'info', title, message });
    },
    [showToast]
  );

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
