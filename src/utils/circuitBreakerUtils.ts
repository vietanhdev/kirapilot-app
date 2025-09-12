import { globalRetryManager } from './kiraErrorHandling';

/**
 * Utility functions for managing circuit breaker state
 */

/**
 * Reset circuit breaker for message loading operations
 */
export function resetMessageLoadCircuitBreaker(): void {
  // Reset the circuit breaker for message_load operations
  globalRetryManager.resetCircuitBreaker('message_load-anonymous');
  globalRetryManager.resetCircuitBreaker('message_load-findMessages');

  console.log('Circuit breaker reset for message_load operations');
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  // Common operation keys that might have circuit breakers
  const operationKeys = [
    'message_load-anonymous',
    'message_load-findMessages',
    'message_send-anonymous',
    'thread_load-anonymous',
    'thread_create-anonymous',
  ];

  operationKeys.forEach(key => {
    globalRetryManager.resetCircuitBreaker(key);
  });

  console.log('All circuit breakers reset');
}

/**
 * Get circuit breaker status information
 */
export interface CircuitBreakerStatus {
  failureCounts: Record<string, number>;
  lastFailureTimes: Record<string, number>;
  circuitBreakerTimeout: number;
}

export function getCircuitBreakerStatus(): CircuitBreakerStatus {
  // Access private properties through reflection (for debugging only)
  const retryManager = globalRetryManager as {
    failureCounts?: Record<string, number>;
    lastFailureTimes?: Record<string, number>;
  };

  const status = {
    failureCounts: {},
    lastFailureTimes: {},
    circuitBreakerTimeout: 30000, // 30 seconds
  };

  // Try to access private maps if possible
  try {
    if (retryManager.failureCounts) {
      status.failureCounts = retryManager.failureCounts;
    }
    if (retryManager.lastFailureTimes) {
      status.lastFailureTimes = retryManager.lastFailureTimes;
    }
  } catch (error) {
    console.warn('Could not access circuit breaker internal state:', error);
  }

  return status;
}

/**
 * Check if circuit breaker is likely open for message loading
 */
export function isMessageLoadCircuitBreakerOpen(): boolean {
  const status = getCircuitBreakerStatus();
  const now = Date.now();

  // Check common message_load operation keys
  const messageLoadKeys = Object.keys(status.failureCounts).filter(key =>
    key.includes('message_load')
  );

  for (const key of messageLoadKeys) {
    const failures = status.failureCounts[key] || 0;
    const lastFailure = status.lastFailureTimes[key] || 0;

    // Circuit is open if >= 5 failures and within timeout window
    if (failures >= 5 && now - lastFailure < status.circuitBreakerTimeout) {
      return true;
    }
  }

  return false;
}

/**
 * Wait for circuit breaker to reset automatically
 */
export async function waitForCircuitBreakerReset(
  maxWaitMs: number = 35000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (!isMessageLoadCircuitBreakerOpen()) {
      return true;
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}
