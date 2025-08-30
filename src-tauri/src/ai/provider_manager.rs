use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::sleep;

use crate::ai::{AIResult, AIServiceError, LLMProvider, ProviderStatus};

/// Health status of a provider
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderHealth {
    /// Current status
    pub status: ProviderStatus,

    /// Last successful request timestamp
    pub last_success: Option<DateTime<Utc>>,

    /// Last failed request timestamp
    pub last_failure: Option<DateTime<Utc>>,

    /// Number of consecutive failures
    pub consecutive_failures: u32,

    /// Average response time in milliseconds
    pub avg_response_time_ms: Option<u64>,

    /// Total requests made to this provider
    pub total_requests: u64,

    /// Total successful requests
    pub successful_requests: u64,
}

impl Default for ProviderHealth {
    fn default() -> Self {
        Self {
            status: ProviderStatus::Initializing,
            last_success: None,
            last_failure: None,
            consecutive_failures: 0,
            avg_response_time_ms: None,
            total_requests: 0,
            successful_requests: 0,
        }
    }
}

/// Configuration for provider switching behavior
#[derive(Debug, Clone)]
pub struct SwitchingConfig {
    /// Maximum consecutive failures before switching providers
    pub max_consecutive_failures: u32,

    /// Timeout for health checks in seconds
    pub health_check_timeout_seconds: u64,

    /// Interval between health checks in seconds
    pub health_check_interval_seconds: u64,

    /// Whether to enable automatic failover
    pub enable_auto_failover: bool,

    /// Preferred provider order for fallback
    pub fallback_order: Vec<String>,

    /// Minimum time to wait before retrying a failed provider (seconds)
    pub retry_cooldown_seconds: u64,
}

impl Default for SwitchingConfig {
    fn default() -> Self {
        Self {
            max_consecutive_failures: 3,
            health_check_timeout_seconds: 10,
            health_check_interval_seconds: 30,
            enable_auto_failover: true,
            fallback_order: vec!["local".to_string(), "gemini".to_string()],
            retry_cooldown_seconds: 300, // 5 minutes
        }
    }
}

/// User preferences for provider selection
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderPreferences {
    /// Preferred primary provider
    pub primary_provider: String,

    /// Whether to allow automatic switching
    pub allow_auto_switch: bool,

    /// Preferred fallback providers in order
    pub fallback_providers: Vec<String>,

    /// Whether to prefer local providers for privacy
    pub prefer_local: bool,

    /// Maximum acceptable response time in milliseconds
    pub max_response_time_ms: Option<u64>,
}

impl Default for ProviderPreferences {
    fn default() -> Self {
        Self {
            primary_provider: "local".to_string(),
            allow_auto_switch: true,
            fallback_providers: vec!["gemini".to_string()],
            prefer_local: true,
            max_response_time_ms: Some(30000), // 30 seconds
        }
    }
}

/// Manages provider health monitoring and switching logic
pub struct ProviderManager {
    /// Available providers
    pub providers: Arc<RwLock<HashMap<String, Box<dyn LLMProvider>>>>,

    /// Health status of each provider
    health_status: Arc<RwLock<HashMap<String, ProviderHealth>>>,

    /// Currently active provider
    active_provider: Arc<RwLock<String>>,

    /// Switching configuration
    switching_config: Arc<RwLock<SwitchingConfig>>,

    /// User preferences
    user_preferences: Arc<RwLock<ProviderPreferences>>,

    /// Whether health monitoring is running
    monitoring_active: Arc<RwLock<bool>>,
}

impl ProviderManager {
    /// Create a new provider manager
    pub fn new(switching_config: SwitchingConfig, user_preferences: ProviderPreferences) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            health_status: Arc::new(RwLock::new(HashMap::new())),
            active_provider: Arc::new(RwLock::new(user_preferences.primary_provider.clone())),
            switching_config: Arc::new(RwLock::new(switching_config)),
            user_preferences: Arc::new(RwLock::new(user_preferences)),
            monitoring_active: Arc::new(RwLock::new(false)),
        }
    }

    /// Register a provider
    pub async fn register_provider(
        &self,
        name: String,
        provider: Box<dyn LLMProvider>,
    ) -> AIResult<()> {
        // Get the provider's current status before registering
        let current_status = provider.get_status().await;
        let is_ready = provider.is_ready().await;
        
        let mut providers = self.providers.write().await;
        let mut health_status = self.health_status.write().await;

        providers.insert(name.clone(), provider);
        
        // Create health status with the actual provider status
        let mut health = ProviderHealth::default();
        health.status = current_status.clone();
        
        if is_ready {
            health.consecutive_failures = 0;
            health.last_success = Some(chrono::Utc::now());
        } else if matches!(health.status, ProviderStatus::Error { .. }) {
            health.consecutive_failures = 1;
            health.last_failure = Some(chrono::Utc::now());
        }
        
        health_status.insert(name.clone(), health);
        
        log::info!("Registered provider '{}' with status: {:?}", name, current_status);

        Ok(())
    }

    /// Execute a function with the currently active provider
    pub async fn with_active_provider<F, R>(&self, f: F) -> AIResult<R>
    where
        F: FnOnce(&dyn LLMProvider) -> R + Send,
        R: Send,
    {
        let active_name = self.active_provider.read().await.clone();
        let providers = self.providers.read().await;

        let provider = providers
            .get(&active_name)
            .ok_or_else(|| AIServiceError::provider_unavailable(&active_name))?;

        Ok(f(provider.as_ref()))
    }

    /// Execute an async function with the currently active provider
    pub async fn with_active_provider_async<F, Fut, R>(&self, f: F) -> AIResult<R>
    where
        F: FnOnce(&dyn LLMProvider) -> Fut + Send,
        Fut: std::future::Future<Output = R> + Send,
        R: Send,
    {
        let active_name = self.active_provider.read().await.clone();
        let providers = self.providers.read().await;

        let provider = providers
            .get(&active_name)
            .ok_or_else(|| AIServiceError::provider_unavailable(&active_name))?;

        Ok(f(provider.as_ref()).await)
    }

    /// Execute a function with a specific provider
    pub async fn with_provider<F, R>(&self, provider_name: &str, f: F) -> AIResult<R>
    where
        F: FnOnce(&dyn LLMProvider) -> R + Send,
        R: Send,
    {
        let providers = self.providers.read().await;

        let provider = providers
            .get(provider_name)
            .ok_or_else(|| AIServiceError::provider_unavailable(provider_name))?;

        Ok(f(provider.as_ref()))
    }

    /// Execute an async function with a specific provider
    pub async fn with_provider_async<F, Fut, R>(&self, provider_name: &str, f: F) -> AIResult<R>
    where
        F: FnOnce(&dyn LLMProvider) -> Fut + Send,
        Fut: std::future::Future<Output = R> + Send,
        R: Send,
    {
        let providers = self.providers.read().await;

        let provider = providers
            .get(provider_name)
            .ok_or_else(|| AIServiceError::provider_unavailable(provider_name))?;

        Ok(f(provider.as_ref()).await)
    }

    /// Get the name of the currently active provider
    pub async fn get_active_provider_name(&self) -> String {
        self.active_provider.read().await.clone()
    }

    /// Switch to a specific provider
    pub async fn switch_provider(&self, provider_name: &str) -> AIResult<()> {
        let providers = self.providers.read().await;

        if !providers.contains_key(provider_name) {
            let user_friendly_msg = if provider_name == "local" {
                "Local model is not available on this system. This usually means the required dependencies for local AI processing are missing. Consider using Gemini instead by providing an API key in Settings.".to_string()
            } else if provider_name == "gemini" {
                "Gemini model is not available. This might be due to missing configuration. Please check your settings.".to_string()
            } else {
                format!("Provider '{}' is not available", provider_name)
            };
            return Err(AIServiceError::provider_unavailable(user_friendly_msg));
        }

        // Check if the provider is healthy
        let health_status = self.health_status.read().await;
        if let Some(health) = health_status.get(provider_name) {
            match &health.status {
                ProviderStatus::Ready => {
                    // Provider is ready, switch to it
                    let mut active_provider = self.active_provider.write().await;
                    *active_provider = provider_name.to_string();
                    Ok(())
                }
                ProviderStatus::Initializing => {
                    // Try to initialize the provider
                    drop(health_status);
                    drop(providers);
                    self.initialize_provider(provider_name).await?;

                    let mut active_provider = self.active_provider.write().await;
                    *active_provider = provider_name.to_string();
                    Ok(())
                }
                ProviderStatus::Unavailable { reason } => {
                    let user_friendly_msg = if provider_name == "local" {
                        format!("Local model is unavailable: {}. This typically means the system doesn't have the required dependencies for local AI processing. Consider using Gemini instead by providing an API key in Settings.", reason)
                    } else if provider_name == "gemini" {
                        format!("Gemini model is unavailable: {}. Please check your API key in Settings and ensure you have an internet connection.", reason)
                    } else {
                        format!("{}: {}", provider_name, reason)
                    };
                    Err(AIServiceError::provider_unavailable(user_friendly_msg))
                },
                ProviderStatus::Error { message } => {
                    let user_friendly_msg = if provider_name == "local" {
                        format!("Local model error: {}. This is likely due to missing system dependencies or incompatible hardware. Consider using Gemini instead.", message)
                    } else if provider_name == "gemini" {
                        format!("Gemini model error: {}. Please check your API key and internet connection.", message)
                    } else {
                        format!("{}: {}", provider_name, message)
                    };
                    Err(AIServiceError::provider_unavailable(user_friendly_msg))
                },
            }
        } else {
            Err(AIServiceError::provider_unavailable(format!(
                "No health status for provider: {}",
                provider_name
            )))
        }
    }

    /// Find the best available provider based on health and preferences
    pub async fn find_best_provider(&self) -> AIResult<String> {
        let preferences = self.user_preferences.read().await;
        let health_status = self.health_status.read().await;

        // First, try the primary provider if it's healthy
        if let Some(health) = health_status.get(&preferences.primary_provider) {
            if matches!(health.status, ProviderStatus::Ready) && health.consecutive_failures == 0 {
                return Ok(preferences.primary_provider.clone());
            }
        }

        // If primary is not available, try fallback providers
        for fallback in &preferences.fallback_providers {
            if let Some(health) = health_status.get(fallback) {
                if matches!(health.status, ProviderStatus::Ready) {
                    // Check if it's within acceptable failure threshold
                    let switching_config = self.switching_config.read().await;
                    if health.consecutive_failures < switching_config.max_consecutive_failures {
                        return Ok(fallback.clone());
                    }
                }
            }
        }

        // If no preferred providers are available, find any healthy provider
        for (name, health) in health_status.iter() {
            if matches!(health.status, ProviderStatus::Ready) {
                let switching_config = self.switching_config.read().await;
                if health.consecutive_failures < switching_config.max_consecutive_failures {
                    return Ok(name.clone());
                }
            }
        }

        Err(AIServiceError::provider_unavailable(
            "No healthy providers available",
        ))
    }

    /// Attempt automatic failover to the next best provider
    pub async fn attempt_failover(&self) -> AIResult<String> {
        let preferences = self.user_preferences.read().await;

        if !preferences.allow_auto_switch {
            return Err(AIServiceError::provider_unavailable(
                "Automatic switching is disabled",
            ));
        }

        let switching_config = self.switching_config.read().await;
        if !switching_config.enable_auto_failover {
            return Err(AIServiceError::provider_unavailable(
                "Automatic failover is disabled",
            ));
        }

        drop(preferences);
        drop(switching_config);

        let best_provider = self.find_best_provider().await?;
        self.switch_provider(&best_provider).await?;

        Ok(best_provider)
    }

    /// Record a successful request for a provider
    pub async fn record_success(&self, provider_name: &str, response_time_ms: u64) {
        let mut health_status = self.health_status.write().await;

        if let Some(health) = health_status.get_mut(provider_name) {
            health.last_success = Some(Utc::now());
            health.consecutive_failures = 0;
            health.total_requests += 1;
            health.successful_requests += 1;

            // Update average response time
            if let Some(avg) = health.avg_response_time_ms {
                health.avg_response_time_ms = Some((avg + response_time_ms) / 2);
            } else {
                health.avg_response_time_ms = Some(response_time_ms);
            }

            // Update status to ready if it wasn't already
            if !matches!(health.status, ProviderStatus::Ready) {
                health.status = ProviderStatus::Ready;
            }
        }
    }

    /// Record a failed request for a provider
    pub async fn record_failure(&self, provider_name: &str, error: &AIServiceError) {
        let mut health_status = self.health_status.write().await;

        if let Some(health) = health_status.get_mut(provider_name) {
            health.last_failure = Some(Utc::now());
            health.consecutive_failures += 1;
            health.total_requests += 1;

            // Update status based on failure type and count
            let switching_config = self.switching_config.try_read();
            let max_failures = switching_config
                .map(|config| config.max_consecutive_failures)
                .unwrap_or(3);

            if health.consecutive_failures >= max_failures {
                health.status = ProviderStatus::Unavailable {
                    reason: format!("Too many consecutive failures: {}", error),
                };
            } else {
                health.status = ProviderStatus::Error {
                    message: error.to_string(),
                };
            }
        }
    }

    /// Get health status for all providers
    pub async fn get_all_health_status(&self) -> HashMap<String, ProviderHealth> {
        self.health_status.read().await.clone()
    }

    /// Get health status for a specific provider
    pub async fn get_provider_health(&self, provider_name: &str) -> Option<ProviderHealth> {
        let health_status = self.health_status.read().await;
        health_status.get(provider_name).cloned()
    }

    /// Update user preferences
    pub async fn update_preferences(&self, preferences: ProviderPreferences) -> AIResult<()> {
        let mut user_preferences = self.user_preferences.write().await;
        *user_preferences = preferences;
        Ok(())
    }
    
    /// Configure Gemini API key
    pub async fn configure_gemini_api_key(&self, api_key: String) -> AIResult<()> {
        let mut providers = self.providers.write().await;
        
        if let Some(provider) = providers.get_mut("gemini") {
            // Downcast to GeminiProvider and update API key
            if let Some(gemini_provider) = provider.as_any_mut().downcast_mut::<crate::ai::GeminiProvider>() {
                gemini_provider.set_api_key(Some(api_key));
                return Ok(());
            }
        }
        
        Err(AIServiceError::provider_unavailable("Gemini provider not found"))
    }

    /// Get current user preferences
    pub async fn get_preferences(&self) -> ProviderPreferences {
        self.user_preferences.read().await.clone()
    }

    /// Update switching configuration
    pub async fn update_switching_config(&self, config: SwitchingConfig) -> AIResult<()> {
        let mut switching_config = self.switching_config.write().await;
        *switching_config = config;
        Ok(())
    }

    /// Start health monitoring background task
    pub async fn start_health_monitoring(&self) -> AIResult<()> {
        let mut monitoring_active = self.monitoring_active.write().await;
        if *monitoring_active {
            return Ok(()); // Already running
        }
        *monitoring_active = true;
        drop(monitoring_active);

        let providers = self.providers.clone();
        let health_status = self.health_status.clone();
        let switching_config = self.switching_config.clone();
        let monitoring_active = self.monitoring_active.clone();

        tokio::spawn(async move {
            loop {
                // Check if monitoring should continue
                {
                    let active = monitoring_active.read().await;
                    if !*active {
                        break;
                    }
                }

                // Perform health checks
                let config = switching_config.read().await;
                let interval = Duration::from_secs(config.health_check_interval_seconds);
                let timeout = Duration::from_secs(config.health_check_timeout_seconds);
                drop(config);

                let providers_guard = providers.read().await;
                let provider_names: Vec<String> = providers_guard.keys().cloned().collect();
                drop(providers_guard);

                for provider_name in provider_names {
                    // Perform health check with timeout
                    let health_check_result = tokio::time::timeout(
                        timeout,
                        Self::check_provider_health(&providers, &provider_name),
                    )
                    .await;

                    let mut health_status_guard = health_status.write().await;
                    if let Some(health) = health_status_guard.get_mut(&provider_name) {
                        match health_check_result {
                            Ok(Ok(status)) => {
                                health.status = status;
                                // Reset consecutive failures if provider is now ready
                                if matches!(health.status, ProviderStatus::Ready) {
                                    health.consecutive_failures = 0;
                                }
                            }
                            Ok(Err(_)) | Err(_) => {
                                health.status = ProviderStatus::Unavailable {
                                    reason: "Health check failed".to_string(),
                                };
                            }
                        }
                    }
                }

                sleep(interval).await;
            }
        });

        Ok(())
    }

    /// Stop health monitoring
    pub async fn stop_health_monitoring(&self) {
        let mut monitoring_active = self.monitoring_active.write().await;
        *monitoring_active = false;
    }

    /// Initialize a specific provider
    async fn initialize_provider(&self, provider_name: &str) -> AIResult<()> {
        log::info!("Attempting to initialize provider: {}", provider_name);
        
        // Check if the provider exists and get its current status
        let providers = self.providers.read().await;
        if let Some(provider) = providers.get(provider_name) {
            let is_ready = provider.is_ready().await;
            let status = provider.get_status().await;
            
            drop(providers); // Release the read lock
            
            // Update health status based on provider status
            let mut health_status = self.health_status.write().await;
            if let Some(health) = health_status.get_mut(provider_name) {
                health.status = status.clone();
                
                if matches!(status, ProviderStatus::Error { .. }) {
                    health.consecutive_failures += 1;
                    health.last_failure = Some(chrono::Utc::now());
                } else if matches!(status, ProviderStatus::Ready) {
                    health.consecutive_failures = 0;
                    health.last_success = Some(chrono::Utc::now());
                }
            }
            
            if is_ready {
                log::info!("Provider {} is ready", provider_name);
                Ok(())
            } else {
                let error_msg = match &status {
                    ProviderStatus::Unavailable { reason } => {
                        format!("Provider {} is unavailable: {}", provider_name, reason)
                    }
                    ProviderStatus::Error { message } => {
                        format!("Provider {} has error: {}", provider_name, message)
                    }
                    ProviderStatus::Initializing => {
                        // For initializing status, we should wait a bit and check again
                        log::info!("Provider {} is still initializing, will check again", provider_name);
                        format!("Provider {} is still initializing", provider_name)
                    }
                    _ => format!("Provider {} failed to initialize", provider_name),
                };
                
                if matches!(status, ProviderStatus::Initializing) {
                    // Don't treat initializing as an error, just return success
                    // The health monitoring will update the status when ready
                    Ok(())
                } else {
                    log::error!("{}", error_msg);
                    Err(AIServiceError::provider_unavailable(error_msg))
                }
            }
        } else {
            let error_msg = format!("Provider {} not found", provider_name);
            log::error!("{}", error_msg);
            Err(AIServiceError::provider_unavailable(error_msg))
        }
    }

    /// Check the health of a specific provider
    async fn check_provider_health(
        providers: &Arc<RwLock<HashMap<String, Box<dyn LLMProvider>>>>,
        provider_name: &str,
    ) -> AIResult<ProviderStatus> {
        let providers_guard = providers.read().await;

        if let Some(provider) = providers_guard.get(provider_name) {
            Ok(provider.get_status().await)
        } else {
            Err(AIServiceError::provider_unavailable(provider_name))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{GenerationOptions, LLMProvider, ModelInfo, ProviderStatus};
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::Arc;
    use tokio::time::Duration;

    // Mock LLM Provider for testing
    struct MockLLMProvider {
        name: String,
        ready: Arc<AtomicBool>,
        fail_count: Arc<AtomicU32>,
        max_failures: u32,
    }

    impl MockLLMProvider {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
                ready: Arc::new(AtomicBool::new(true)),
                fail_count: Arc::new(AtomicU32::new(0)),
                max_failures: 0,
            }
        }

        fn with_failures(name: &str, max_failures: u32) -> Self {
            Self {
                name: name.to_string(),
                ready: Arc::new(AtomicBool::new(true)),
                fail_count: Arc::new(AtomicU32::new(0)),
                max_failures,
            }
        }
    }

    #[async_trait]
    impl LLMProvider for MockLLMProvider {
        async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            let current_failures = self.fail_count.fetch_add(1, Ordering::SeqCst);

            if current_failures < self.max_failures {
                return Err(AIServiceError::llm_error(format!(
                    "Mock failure {} for {}",
                    current_failures + 1,
                    self.name
                )));
            }

            Ok(format!("Response from {} to: {}", self.name, prompt))
        }

        async fn is_ready(&self) -> bool {
            self.ready.load(Ordering::SeqCst)
        }

        async fn get_status(&self) -> ProviderStatus {
            if self.is_ready().await {
                ProviderStatus::Ready
            } else {
                ProviderStatus::Unavailable {
                    reason: "Mock provider not ready".to_string(),
                }
            }
        }

        fn get_model_info(&self) -> ModelInfo {
            let mut metadata = HashMap::new();
            metadata.insert("provider_type".to_string(), serde_json::json!("mock"));

            ModelInfo {
                id: format!("mock-{}", self.name),
                name: format!("Mock {}", self.name),
                provider: self.name.clone(),
                version: Some("1.0.0".to_string()),
                max_context_length: Some(4096),
                metadata,
            }
        }

        async fn initialize(&mut self) -> AIResult<()> {
            Ok(())
        }

        async fn cleanup(&mut self) -> AIResult<()> {
            Ok(())
        }

        fn as_any(&self) -> &dyn std::any::Any {
            self
        }

        fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
            self
        }
    }

    #[tokio::test]
    async fn test_provider_registration() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences::default();
        let manager = ProviderManager::new(switching_config, user_preferences);

        let provider = Box::new(MockLLMProvider::new("test"));
        let result = manager
            .register_provider("test".to_string(), provider)
            .await;

        assert!(result.is_ok());

        let health = manager.get_provider_health("test").await;
        assert!(health.is_some());
    }

    #[tokio::test]
    async fn test_provider_switching() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences {
            primary_provider: "provider1".to_string(),
            ..Default::default()
        };
        let manager = ProviderManager::new(switching_config, user_preferences);

        // Register two providers
        let provider1 = Box::new(MockLLMProvider::new("provider1"));
        let provider2 = Box::new(MockLLMProvider::new("provider2"));

        manager
            .register_provider("provider1".to_string(), provider1)
            .await
            .unwrap();
        manager
            .register_provider("provider2".to_string(), provider2)
            .await
            .unwrap();

        // Initially should be using provider1
        assert_eq!(manager.get_active_provider_name().await, "provider1");

        // Switch to provider2
        let result = manager.switch_provider("provider2").await;
        assert!(result.is_ok());
        assert_eq!(manager.get_active_provider_name().await, "provider2");
    }

    #[tokio::test]
    async fn test_automatic_failover() {
        let switching_config = SwitchingConfig {
            max_consecutive_failures: 2,
            enable_auto_failover: true,
            fallback_order: vec!["provider1".to_string(), "provider2".to_string()],
            ..Default::default()
        };
        let user_preferences = ProviderPreferences {
            primary_provider: "provider1".to_string(),
            allow_auto_switch: true,
            fallback_providers: vec!["provider2".to_string()],
            ..Default::default()
        };
        let manager = ProviderManager::new(switching_config, user_preferences);

        // Register providers - provider1 will fail, provider2 will succeed
        let provider1 = Box::new(MockLLMProvider::with_failures("provider1", 5));
        let provider2 = Box::new(MockLLMProvider::new("provider2"));

        manager
            .register_provider("provider1".to_string(), provider1)
            .await
            .unwrap();
        manager
            .register_provider("provider2".to_string(), provider2)
            .await
            .unwrap();

        // Record failures for provider1
        let error = AIServiceError::llm_error("Test failure");
        manager.record_failure("provider1", &error).await;
        manager.record_failure("provider1", &error).await;

        // Attempt failover
        let result = manager.attempt_failover().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "provider2");
        assert_eq!(manager.get_active_provider_name().await, "provider2");
    }
}
