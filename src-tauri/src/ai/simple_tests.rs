#[cfg(test)]
mod tests {
    use crate::ai::{
        AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
        ReActEngine, ReActConfig, InteractionLogger, LoggingConfig, SmartToolRegistry,
        PermissionLevel
    };
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    /// Simple mock LLM provider for testing
    struct SimpleMockProvider {
        ready: Arc<AtomicBool>,
    }

    impl SimpleMockProvider {
        fn new() -> Self {
            Self {
                ready: Arc::new(AtomicBool::new(true)),
            }
        }
    }

    #[async_trait]
    impl LLMProvider for SimpleMockProvider {
        async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            if !self.ready.load(Ordering::SeqCst) {
                return Err(AIServiceError::provider_unavailable("Mock provider not ready"));
            }
            Ok(format!("Mock response to: {}", prompt.chars().take(20).collect::<String>()))
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
            ModelInfo {
                id: "mock-model".to_string(),
                name: "Mock Model".to_string(),
                provider: "mock".to_string(),
                version: Some("1.0.0".to_string()),
                max_context_length: Some(4096),
                metadata: HashMap::new(),
            }
        }

        async fn initialize(&mut self) -> AIResult<()> {
            self.ready.store(true, Ordering::SeqCst);
            Ok(())
        }

        async fn cleanup(&mut self) -> AIResult<()> {
            self.ready.store(false, Ordering::SeqCst);
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
    async fn test_react_engine_basic_creation() {
        let engine = ReActEngine::new();
        assert_eq!(engine.max_iterations(), 10);
    }

    #[tokio::test]
    async fn test_react_engine_with_custom_config() {
        let config = ReActConfig {
            max_iterations: 5,
            include_reasoning_in_response: true,
            detailed_logging: false,
            prompt_templates: None,
        };

        let engine = ReActEngine::with_config(config);
        assert_eq!(engine.max_iterations(), 5);
    }

    #[tokio::test]
    async fn test_mock_provider_basic_functionality() {
        let mut provider = SimpleMockProvider::new();
        
        // Test initialization
        assert!(provider.initialize().await.is_ok());
        assert!(provider.is_ready().await);
        
        // Test generation
        let options = GenerationOptions::default();
        let result = provider.generate("Test prompt", &options).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("Mock response"));
        
        // Test cleanup
        assert!(provider.cleanup().await.is_ok());
        assert!(!provider.is_ready().await);
    }

    #[tokio::test]
    async fn test_interaction_logger_basic() {
        let config = LoggingConfig::default();
        let logger = InteractionLogger::new(config);
        
        // Test configuration
        assert!(logger.get_config().enabled);
        assert_eq!(logger.get_config().max_logs, 10000);
        assert_eq!(logger.get_config().retention_days, 30);
    }

    #[tokio::test]
    async fn test_smart_tool_registry_basic() {
        let permissions = vec![PermissionLevel::ReadOnly, PermissionLevel::ModifyTasks];
        let registry = SmartToolRegistry::new(permissions);
        
        // Test initial state
        let available_tools = registry.get_available_tools();
        assert!(available_tools.is_empty());
    }

    #[tokio::test]
    async fn test_generation_options() {
        let default_options = GenerationOptions::default();
        assert_eq!(default_options.max_tokens, Some(2048));
        assert_eq!(default_options.temperature, Some(0.7));
        assert_eq!(default_options.top_p, Some(0.9));
        assert!(default_options.stop_sequences.is_none());
        assert!(!default_options.stream);

        let custom_options = GenerationOptions {
            max_tokens: Some(100),
            temperature: Some(0.5),
            top_p: Some(0.8),
            stop_sequences: Some(vec!["STOP".to_string()]),
            stream: true,
        };
        assert_eq!(custom_options.max_tokens, Some(100));
        assert_eq!(custom_options.temperature, Some(0.5));
        assert!(custom_options.stream);
    }

    #[tokio::test]
    async fn test_model_info_serialization() {
        let model_info = ModelInfo {
            id: "test-model".to_string(),
            name: "Test Model".to_string(),
            provider: "test-provider".to_string(),
            version: Some("1.0.0".to_string()),
            max_context_length: Some(4096),
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("test_key".to_string(), serde_json::Value::String("test_value".to_string()));
                meta
            },
        };

        // Test serialization
        let json = serde_json::to_string(&model_info).unwrap();
        assert!(json.contains("test-model"));
        assert!(json.contains("Test Model"));

        // Test deserialization
        let deserialized: ModelInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, model_info.id);
        assert_eq!(deserialized.name, model_info.name);
    }

    #[tokio::test]
    async fn test_ai_service_error_types() {
        let llm_error = AIServiceError::llm_error("Test LLM error");
        assert!(matches!(llm_error, AIServiceError::LLMError { .. }));

        let config_error = AIServiceError::config_error("Test config error");
        assert!(matches!(config_error, AIServiceError::ConfigError { .. }));

        let provider_error = AIServiceError::provider_unavailable("test-provider");
        assert!(matches!(provider_error, AIServiceError::ProviderUnavailable { .. }));

        let invalid_request = AIServiceError::invalid_request("Invalid request");
        assert!(matches!(invalid_request, AIServiceError::InvalidRequest { .. }));
    }

    #[tokio::test]
    async fn test_permission_levels() {
        let read_only = PermissionLevel::ReadOnly;
        let modify_tasks = PermissionLevel::ModifyTasks;
        let timer_control = PermissionLevel::TimerControl;
        let full_access = PermissionLevel::FullAccess;

        // Test that they are different
        assert_ne!(read_only, modify_tasks);
        assert_ne!(modify_tasks, timer_control);
        assert_ne!(timer_control, full_access);

        // Test serialization
        let serialized = serde_json::to_string(&full_access).unwrap();
        let deserialized: PermissionLevel = serde_json::from_str(&serialized).unwrap();
        assert_eq!(full_access, deserialized);
    }

    #[tokio::test]
    async fn test_provider_status() {
        let ready_status = ProviderStatus::Ready;
        let unavailable_status = ProviderStatus::Unavailable {
            reason: "Test reason".to_string(),
        };

        // Test serialization
        let ready_json = serde_json::to_string(&ready_status).unwrap();
        let unavailable_json = serde_json::to_string(&unavailable_status).unwrap();

        // Test deserialization
        let ready_deserialized: ProviderStatus = serde_json::from_str(&ready_json).unwrap();
        let unavailable_deserialized: ProviderStatus = serde_json::from_str(&unavailable_json).unwrap();

        assert!(matches!(ready_deserialized, ProviderStatus::Ready));
        assert!(matches!(unavailable_deserialized, ProviderStatus::Unavailable { .. }));
    }
}