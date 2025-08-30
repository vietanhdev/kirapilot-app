#[cfg(test)]
mod provider_switching_integration_tests {
    use crate::ai::provider_manager::*;
    use crate::ai::{GenerationOptions, LLMProvider, ModelInfo, ProviderStatus, AIServiceError, AIResult};
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    // Simple mock provider for testing
    struct TestProvider {
        name: String,
        ready: Arc<AtomicBool>,
        fail_requests: Arc<AtomicBool>,
    }

    impl TestProvider {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
                ready: Arc::new(AtomicBool::new(true)),
                fail_requests: Arc::new(AtomicBool::new(false)),
            }
        }

        fn set_ready(&self, ready: bool) {
            self.ready.store(ready, Ordering::SeqCst);
        }

        fn set_fail_requests(&self, fail: bool) {
            self.fail_requests.store(fail, Ordering::SeqCst);
        }
    }

    #[async_trait]
    impl LLMProvider for TestProvider {
        async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            if self.fail_requests.load(Ordering::SeqCst) {
                return Err(AIServiceError::llm_error(format!("Test failure from {}", self.name)));
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
                    reason: "Test provider not ready".to_string(),
                }
            }
        }

        fn get_model_info(&self) -> ModelInfo {
            ModelInfo {
                id: format!("test-{}", self.name),
                name: format!("Test {}", self.name),
                provider: self.name.clone(),
                version: Some("1.0.0".to_string()),
                max_context_length: Some(4096),
                metadata: HashMap::new(),
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
    async fn test_basic_provider_switching() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences {
            primary_provider: "gemini".to_string(),
            allow_auto_switch: true,
            fallback_providers: vec!["local".to_string()],
            ..Default::default()
        };

        let manager = ProviderManager::new(switching_config, user_preferences);

        // Register providers
        let gemini_provider = Box::new(TestProvider::new("gemini"));
        let local_provider = Box::new(TestProvider::new("local"));

        manager.register_provider("gemini".to_string(), gemini_provider).await.unwrap();
        manager.register_provider("local".to_string(), local_provider).await.unwrap();

        // Should start with primary provider
        assert_eq!(manager.get_active_provider_name().await, "gemini");

        // Switch to local provider
        let result = manager.switch_provider("local").await;
        assert!(result.is_ok());
        assert_eq!(manager.get_active_provider_name().await, "local");

        // Switch back to gemini
        let result = manager.switch_provider("gemini").await;
        assert!(result.is_ok());
        assert_eq!(manager.get_active_provider_name().await, "gemini");
    }

    #[tokio::test]
    async fn test_health_tracking() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences::default();
        let manager = ProviderManager::new(switching_config, user_preferences);

        let provider = Box::new(TestProvider::new("test"));
        manager.register_provider("test".to_string(), provider).await.unwrap();

        // Record a success
        manager.record_success("test", 1000).await;

        let health = manager.get_provider_health("test").await.unwrap();
        assert_eq!(health.consecutive_failures, 0);
        assert_eq!(health.successful_requests, 1);
        assert_eq!(health.total_requests, 1);
        assert_eq!(health.avg_response_time_ms, Some(1000));

        // Record a failure
        let error = AIServiceError::llm_error("Test error");
        manager.record_failure("test", &error).await;

        let health = manager.get_provider_health("test").await.unwrap();
        assert_eq!(health.consecutive_failures, 1);
        assert_eq!(health.successful_requests, 1);
        assert_eq!(health.total_requests, 2);
    }

    #[tokio::test]
    async fn test_automatic_failover() {
        let switching_config = SwitchingConfig {
            max_consecutive_failures: 2,
            enable_auto_failover: true,
            ..Default::default()
        };
        let user_preferences = ProviderPreferences {
            primary_provider: "unreliable".to_string(),
            allow_auto_switch: true,
            fallback_providers: vec!["reliable".to_string()],
            ..Default::default()
        };

        let manager = ProviderManager::new(switching_config, user_preferences);

        // Register providers
        let unreliable_provider = Box::new(TestProvider::new("unreliable"));
        let reliable_provider = Box::new(TestProvider::new("reliable"));

        manager.register_provider("unreliable".to_string(), unreliable_provider).await.unwrap();
        manager.register_provider("reliable".to_string(), reliable_provider).await.unwrap();

        // Initially using unreliable provider
        assert_eq!(manager.get_active_provider_name().await, "unreliable");

        // Record multiple failures for unreliable provider
        let error = AIServiceError::llm_error("Provider failed");
        manager.record_failure("unreliable", &error).await;
        manager.record_failure("unreliable", &error).await;

        // Attempt failover
        let result = manager.attempt_failover().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "reliable");
        assert_eq!(manager.get_active_provider_name().await, "reliable");
    }

    #[tokio::test]
    async fn test_preferences_management() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences::default();
        let manager = ProviderManager::new(switching_config, user_preferences);

        // Update preferences
        let new_preferences = ProviderPreferences {
            primary_provider: "new_primary".to_string(),
            allow_auto_switch: false,
            fallback_providers: vec!["new_fallback".to_string()],
            prefer_local: true,
            max_response_time_ms: Some(5000),
        };

        let result = manager.update_preferences(new_preferences.clone()).await;
        assert!(result.is_ok());

        let current_preferences = manager.get_preferences().await;
        assert_eq!(current_preferences.primary_provider, "new_primary");
        assert_eq!(current_preferences.allow_auto_switch, false);
        assert_eq!(current_preferences.prefer_local, true);
        assert_eq!(current_preferences.max_response_time_ms, Some(5000));
    }

    #[tokio::test]
    async fn test_find_best_provider_logic() {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences {
            primary_provider: "primary".to_string(),
            fallback_providers: vec!["fallback1".to_string(), "fallback2".to_string()],
            ..Default::default()
        };
        let manager = ProviderManager::new(switching_config, user_preferences);

        // Register providers
        let primary = Box::new(TestProvider::new("primary"));
        let fallback1 = Box::new(TestProvider::new("fallback1"));
        let fallback2 = Box::new(TestProvider::new("fallback2"));

        manager.register_provider("primary".to_string(), primary).await.unwrap();
        manager.register_provider("fallback1".to_string(), fallback1).await.unwrap();
        manager.register_provider("fallback2".to_string(), fallback2).await.unwrap();

        // Should find primary provider first
        let best = manager.find_best_provider().await;
        assert!(best.is_ok());
        assert_eq!(best.unwrap(), "primary");

        // Record failures for primary to make it unhealthy
        let error = AIServiceError::llm_error("Test failure");
        manager.record_failure("primary", &error).await;
        manager.record_failure("primary", &error).await;
        manager.record_failure("primary", &error).await;

        // Should now find fallback1
        let best = manager.find_best_provider().await;
        assert!(best.is_ok());
        assert_eq!(best.unwrap(), "fallback1");
    }
}