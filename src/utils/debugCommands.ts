/**
 * Debug commands for development and troubleshooting
 * These functions can be called from the browser console
 */

import {
  resetMessageLoadCircuitBreaker,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
  isMessageLoadCircuitBreakerOpen,
  type CircuitBreakerStatus,
} from './circuitBreakerUtils';

// Make functions available globally for console access
declare global {
  interface Window {
    kirapilot: {
      resetCircuitBreaker: () => void;
      resetAllCircuitBreakers: () => void;
      getCircuitBreakerStatus: () => CircuitBreakerStatus;
      checkCircuitBreaker: () => boolean;
    };
  }
}

/**
 * Initialize debug commands on window object
 */
export function initializeDebugCommands() {
  if (typeof window !== 'undefined') {
    window.kirapilot = {
      resetCircuitBreaker: () => {
        resetMessageLoadCircuitBreaker();
        console.log('✅ Message load circuit breaker reset');
      },

      resetAllCircuitBreakers: () => {
        resetAllCircuitBreakers();
        console.log('✅ All circuit breakers reset');
      },

      getCircuitBreakerStatus: () => {
        const status = getCircuitBreakerStatus();
        console.log('Circuit Breaker Status:', status);
        return status;
      },

      checkCircuitBreaker: () => {
        const isOpen = isMessageLoadCircuitBreakerOpen();
        console.log(`Circuit breaker is ${isOpen ? 'OPEN' : 'CLOSED'}`);
        return isOpen;
      },
    };

    console.log('🔧 KiraPilot debug commands available:');
    console.log('  - kirapilot.resetCircuitBreaker()');
    console.log('  - kirapilot.resetAllCircuitBreakers()');
    console.log('  - kirapilot.getCircuitBreakerStatus()');
    console.log('  - kirapilot.checkCircuitBreaker()');
  }
}

/**
 * Quick fix for circuit breaker issues
 */
export function quickFixCircuitBreaker() {
  resetMessageLoadCircuitBreaker();
  console.log('🚀 Circuit breaker reset - try loading messages again');
}
