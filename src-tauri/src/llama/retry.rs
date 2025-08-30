use super::error::LlamaError;
use log::{debug, error, warn};
use std::time::Duration;
use tokio::time::sleep;

/// Retry configuration for different operations
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

impl RetryConfig {
    /// Create retry config for download operations
    pub fn for_download() -> Self {
        Self {
            max_attempts: 5,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }

    /// Create retry config for generation operations
    pub fn for_generation() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(500),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 1.5,
            jitter: false,
        }
    }

    /// Create retry config for model loading
    pub fn for_model_loading() -> Self {
        Self {
            max_attempts: 2,
            initial_delay: Duration::from_secs(2),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 2.0,
            jitter: false,
        }
    }
}

/// Retry mechanism with exponential backoff
pub struct RetryMechanism {
    config: RetryConfig,
}

impl RetryMechanism {
    pub fn new(config: RetryConfig) -> Self {
        Self { config }
    }

    /// Execute an operation with retry logic
    pub async fn execute<F, Fut, T>(&self, operation: F) -> Result<T, LlamaError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, LlamaError>>,
    {
        let mut last_error = None;

        for attempt in 1..=self.config.max_attempts {
            debug!("Retry attempt {} of {}", attempt, self.config.max_attempts);

            match operation().await {
                Ok(result) => {
                    if attempt > 1 {
                        debug!("Operation succeeded on attempt {}", attempt);
                    }
                    return Ok(result);
                }
                Err(error) => {
                    last_error = Some(error.clone());

                    // Check if error is recoverable
                    if !error.is_recoverable() {
                        error!("Non-recoverable error encountered: {}", error);
                        return Err(error);
                    }

                    // Don't retry on the last attempt
                    if attempt == self.config.max_attempts {
                        error!("All retry attempts exhausted. Last error: {}", error);
                        break;
                    }

                    // Calculate delay for next attempt
                    let delay = self.calculate_delay(attempt);
                    warn!(
                        "Operation failed (attempt {}), retrying in {:?}: {}",
                        attempt, delay, error
                    );

                    sleep(delay).await;
                }
            }
        }

        // Return the last error if all attempts failed
        Err(last_error
            .unwrap_or_else(|| LlamaError::RecoveryFailed("All retry attempts failed".to_string())))
    }

    /// Execute with custom retry condition
    pub async fn execute_with_condition<F, Fut, T, C>(
        &self,
        operation: F,
        should_retry: C,
    ) -> Result<T, LlamaError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, LlamaError>>,
        C: Fn(&LlamaError) -> bool,
    {
        let mut last_error = None;

        for attempt in 1..=self.config.max_attempts {
            debug!("Retry attempt {} of {}", attempt, self.config.max_attempts);

            match operation().await {
                Ok(result) => {
                    if attempt > 1 {
                        debug!("Operation succeeded on attempt {}", attempt);
                    }
                    return Ok(result);
                }
                Err(error) => {
                    last_error = Some(error.clone());

                    // Check custom retry condition
                    if !should_retry(&error) {
                        error!("Custom retry condition failed: {}", error);
                        return Err(error);
                    }

                    // Don't retry on the last attempt
                    if attempt == self.config.max_attempts {
                        error!("All retry attempts exhausted. Last error: {}", error);
                        break;
                    }

                    // Calculate delay for next attempt
                    let delay = self.calculate_delay(attempt);
                    warn!(
                        "Operation failed (attempt {}), retrying in {:?}: {}",
                        attempt, delay, error
                    );

                    sleep(delay).await;
                }
            }
        }

        // Return the last error if all attempts failed
        Err(last_error
            .unwrap_or_else(|| LlamaError::RecoveryFailed("All retry attempts failed".to_string())))
    }

    /// Calculate delay for the given attempt number
    fn calculate_delay(&self, attempt: u32) -> Duration {
        let base_delay = self.config.initial_delay.as_millis() as f64;
        let multiplier = self.config.backoff_multiplier.powi((attempt - 1) as i32);
        let mut delay_ms = base_delay * multiplier;

        // Apply jitter if enabled (simplified without rand dependency)
        if self.config.jitter {
            // Simple jitter using system time
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos();
            let jitter_factor = 0.8 + (nanos % 1000) as f64 / 2500.0; // 0.8 to 1.2
            delay_ms *= jitter_factor;
        }

        // Cap at maximum delay
        let max_delay_ms = self.config.max_delay.as_millis() as f64;
        delay_ms = delay_ms.min(max_delay_ms);

        Duration::from_millis(delay_ms as u64)
    }
}

/// Circuit breaker pattern for preventing cascading failures
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    failure_threshold: u32,
    recovery_timeout: Duration,
    current_failures: u32,
    last_failure_time: Option<std::time::Instant>,
    state: CircuitBreakerState,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerState {
    Closed,   // Normal operation
    Open,     // Failing fast
    HalfOpen, // Testing recovery
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            failure_threshold,
            recovery_timeout,
            current_failures: 0,
            last_failure_time: None,
            state: CircuitBreakerState::Closed,
        }
    }

    /// Execute operation through circuit breaker
    pub async fn execute<F, Fut, T>(&mut self, operation: F) -> Result<T, LlamaError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, LlamaError>>,
    {
        // Check if circuit breaker should allow the operation
        if !self.should_allow_request() {
            return Err(LlamaError::ServiceUnavailable(
                "Circuit breaker is open - service temporarily unavailable".to_string(),
            ));
        }

        match operation().await {
            Ok(result) => {
                self.on_success();
                Ok(result)
            }
            Err(error) => {
                self.on_failure();
                Err(error)
            }
        }
    }

    fn should_allow_request(&mut self) -> bool {
        match self.state {
            CircuitBreakerState::Closed => true,
            CircuitBreakerState::Open => {
                if let Some(last_failure) = self.last_failure_time {
                    if last_failure.elapsed() >= self.recovery_timeout {
                        debug!("Circuit breaker transitioning to half-open");
                        self.state = CircuitBreakerState::HalfOpen;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitBreakerState::HalfOpen => true,
        }
    }

    fn on_success(&mut self) {
        match self.state {
            CircuitBreakerState::HalfOpen => {
                debug!("Circuit breaker recovering - transitioning to closed");
                self.state = CircuitBreakerState::Closed;
                self.current_failures = 0;
                self.last_failure_time = None;
            }
            CircuitBreakerState::Closed => {
                // Reset failure count on success
                self.current_failures = 0;
            }
            _ => {}
        }
    }

    fn on_failure(&mut self) {
        self.current_failures += 1;
        self.last_failure_time = Some(std::time::Instant::now());

        if self.current_failures >= self.failure_threshold {
            warn!(
                "Circuit breaker opening due to {} failures",
                self.current_failures
            );
            self.state = CircuitBreakerState::Open;
        }
    }

    pub fn get_state(&self) -> CircuitBreakerState {
        self.state.clone()
    }

    pub fn get_failure_count(&self) -> u32 {
        self.current_failures
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::Duration;

    #[tokio::test]
    async fn test_retry_success_on_first_attempt() {
        let retry = RetryMechanism::new(RetryConfig::default());

        let result = retry.execute(|| async { Ok::<i32, LlamaError>(42) }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_retry_success_after_failures() {
        let retry = RetryMechanism::new(RetryConfig {
            max_attempts: 3,
            initial_delay: Duration::from_millis(10),
            ..Default::default()
        });

        let attempt_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let attempt_count_clone = attempt_count.clone();
        let result = retry
            .execute(move || {
                let attempt_count = attempt_count_clone.clone();
                async move {
                    let count = attempt_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    if count < 2 {
                        Err(LlamaError::NetworkError("Temporary failure".to_string()))
                    } else {
                        Ok(42)
                    }
                }
            })
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_retry_non_recoverable_error() {
        let retry = RetryMechanism::new(RetryConfig::default());

        let result = retry
            .execute(|| async {
                Err::<i32, LlamaError>(LlamaError::ModelNotFound("Test".to_string()))
            })
            .await;

        assert!(result.is_err());
        // Should fail immediately without retries
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        let mut circuit_breaker = CircuitBreaker::new(2, Duration::from_millis(100));

        // First failure
        let result1 = circuit_breaker
            .execute(|| async {
                Err::<i32, LlamaError>(LlamaError::GenerationFailed("Test".to_string()))
            })
            .await;
        assert!(result1.is_err());
        assert_eq!(circuit_breaker.get_state(), CircuitBreakerState::Closed);

        // Second failure - should open circuit
        let result2 = circuit_breaker
            .execute(|| async {
                Err::<i32, LlamaError>(LlamaError::GenerationFailed("Test".to_string()))
            })
            .await;
        assert!(result2.is_err());
        assert_eq!(circuit_breaker.get_state(), CircuitBreakerState::Open);

        // Third attempt should be blocked
        let result3 = circuit_breaker
            .execute(|| async { Ok::<i32, LlamaError>(42) })
            .await;
        assert!(result3.is_err());
        assert!(matches!(
            result3.unwrap_err(),
            LlamaError::ServiceUnavailable(_)
        ));
    }
}
