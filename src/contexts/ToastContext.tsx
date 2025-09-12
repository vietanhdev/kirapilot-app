import { createContext, useContext, ReactNode } from 'react';
import { useToast, ToastMessage } from '../hooks/useToast';
import { ToastContainer } from '../components/common/ToastContainer';

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (
    title: string,
    message?: string,
    action?: ToastMessage['action']
  ) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

export function ToastProvider({
  children,
  position = 'top-right',
}: ToastProviderProps) {
  const { toasts, showToast, hideToast, clearAllToasts } = useToast();

  // Convenience methods
  const showSuccess = (title: string, message?: string) => {
    showToast({ type: 'success', title, message });
  };

  const showError = (
    title: string,
    message?: string,
    action?: ToastMessage['action']
  ) => {
    showToast({ type: 'error', title, message, action, duration: 8000 });
  };

  const showWarning = (title: string, message?: string) => {
    showToast({ type: 'warning', title, message });
  };

  const showInfo = (title: string, message?: string) => {
    showToast({ type: 'info', title, message });
  };

  const contextValue: ToastContextValue = {
    showToast,
    hideToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts}
        onHideToast={hideToast}
        position={position}
      />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}
