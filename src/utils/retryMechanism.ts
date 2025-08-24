/**
 * Retry mechanism utility for database operations and other recoverable errors
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTime: number;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;
  public readonly allErrors: Error[];

  constructor(attempts: number, lastError: Error, allErrors: Error[]) {
    super(`Operation failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
    this.allErrors = allErrors;
  }
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error) => isRetryableError(error),
};

/**
 * Execute an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const errors: Error[] = [];
  const startTime = Date.now();

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      const totalTime = Date.now() - startTime;

      return {
        result,
        attempts: attempt,
        totalTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      // If this is the last attempt or error is not retryable, throw
      if (
        attempt === finalConfig.maxAttempts ||
        !finalConfig.retryCondition!(err)
      ) {
        throw new RetryError(attempt, err, errors);
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay *
          Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      await sleep(jitteredDelay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new RetryError(
    finalConfig.maxAttempts,
    errors[errors.length - 1],
    errors
  );
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network-related errors are retryable
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('fetch')
  ) {
    return true;
  }

  // Database connection errors are retryable
  if (
    message.includes('database connection') ||
    message.includes('connection failed') ||
    message.includes('transaction failed')
  ) {
    return true;
  }

  // Temporary service unavailable errors are retryable
  if (
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable') ||
    message.includes('rate limit')
  ) {
    return true;
  }

  // Check for specific error types if available
  const errorWithType = error as Error & { type?: string; retryable?: boolean };
  if (errorWithType.retryable !== undefined) {
    return errorWithType.retryable;
  }

  // Validation and business logic errors are not retryable
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('duplicate') ||
    message.includes('not found') ||
    message.includes('permission denied')
  ) {
    return false;
  }

  // Default to not retryable for safety
  return false;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry configuration presets for different operation types
 */
export const RETRY_PRESETS = {
  DATABASE: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  NETWORK: {
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 8000,
    backoffMultiplier: 1.5,
  },
  QUICK: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  },
  AGGRESSIVE: {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2.5,
  },
} as const;

/**
 * Enhanced database operation wrapper with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  try {
    const result = await withRetry(operation, {
      ...RETRY_PRESETS.DATABASE,
      ...config,
    });

    // Log successful operation if it required retries
    if (result.attempts > 1) {
      console.log(
        `${operationName} succeeded after ${result.attempts} attempts (${result.totalTime}ms)`
      );
    }

    return result.result;
  } catch (error) {
    if (error instanceof RetryError) {
      console.error(
        `${operationName} failed after ${error.attempts} attempts:`,
        error.lastError
      );

      // Throw the original error for better error handling
      throw error.lastError;
    }

    throw error;
  }
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return executeWithRetry(
      () => fn(...args),
      fn.name || 'anonymous function',
      config
    );
  };
}

/**
 * Batch retry operations with individual retry logic
 */
export async function batchWithRetry<T>(
  operations: Array<() => Promise<T>>,
  config: Partial<RetryConfig> = {}
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results = await Promise.allSettled(
    operations.map(op => withRetry(op, config))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { success: true, result: result.value.result };
    } else {
      const error =
        result.reason instanceof RetryError
          ? result.reason.lastError
          : result.reason;
      return { success: false, error };
    }
  });
}
