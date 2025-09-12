import { useCallback } from 'react';
import {
  resetMessageLoadCircuitBreaker,
  resetAllCircuitBreakers,
  isMessageLoadCircuitBreakerOpen,
} from '../utils/circuitBreakerUtils';
import { useToast } from './useToast';

/**
 * Hook for managing circuit breaker resets with user feedback
 */
export function useCircuitBreakerReset() {
  const { showToast } = useToast();

  const resetMessageLoad = useCallback(() => {
    try {
      resetMessageLoadCircuitBreaker();
      showToast({
        title: 'Circuit Breaker Reset',
        message:
          'Message loading circuit breaker has been reset. You can now try loading messages again.',
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Reset Failed',
        message: 'Failed to reset circuit breaker. Please try again.',
        type: 'error',
      });
    }
  }, [showToast]);

  const resetAll = useCallback(() => {
    try {
      resetAllCircuitBreakers();
      showToast({
        title: 'All Circuit Breakers Reset',
        message:
          'All circuit breakers have been reset. You can now retry failed operations.',
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Reset Failed',
        message: 'Failed to reset circuit breakers. Please try again.',
        type: 'error',
      });
    }
  }, [showToast]);

  const checkAndResetIfNeeded = useCallback(async () => {
    const isOpen = isMessageLoadCircuitBreakerOpen();

    if (isOpen) {
      resetMessageLoad();
      return true;
    }

    return false;
  }, [resetMessageLoad]);

  return {
    resetMessageLoad,
    resetAll,
    checkAndResetIfNeeded,
    isCircuitBreakerOpen: isMessageLoadCircuitBreakerOpen,
  };
}
