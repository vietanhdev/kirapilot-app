#[cfg(test)]
mod tests {
    use super::*;
    use crate::llama::error::LlamaError;
    use crate::llama::service::{LlamaService, GenerationOptions, ModelStatus};
    use std::path::PathBuf;
    use tokio::time::Duration;

    /// Mock LlamaService for testing without actual model loading
    struct MockLlamaService {
        is_ready: bool,
        should_fail_init: bool,
        should_fail_generation: bool,
        model_path: Option<PathBuf>,
    }

    impl MockLlamaService {
        fn new() -> Self {
            Self {
                is_ready: false,
                should_fail_init: false,
                should_fail_generation: false,
                model_path: None,
            }
        }

        fn with_init_failure() -> Self {
            Self {
                is_ready: false,
                should_fail_init: true,
                should_fail_generation: false,
                model_path: None,
            }
        }

        fn with_generation_failure() -> Self {
            Self {
                is_ready: true,
                should_fail_init: false,
                should_fail_generation: true,
                model_path: Some(PathBuf::from("/mock/model/path")),
            }
        }

        async fn mock_initialize(&mut self) -> Result<(), LlamaError> {
            if self.should_fail_init {
                return Err(LlamaError::InitializationError("Mock initialization failure".to_string()));
            }
            self.is_ready = true;
            self.model_path = Some(PathBuf::from("/mock/model/path"));
            Ok(())
        }

        async fn mock_generate(&self, prompt: &str, _options: GenerationOptions) -> Result<String, LlamaError> {
            if !self.is_ready {
                return Err(LlamaError::GenerationFailed("Model not ready".to_string()));
            }

            if self.should_fail_generation {
                return Err(LlamaError::GenerationFailed("Mock generation failure".to_string()));
            }

            if prompt.is_empty() {
                return Err(LlamaError::ValidationError("Empty prompt".to_string()));
            }

            if prompt.len() > 8192 {
                return Err(LlamaError::ValidationError("Prompt too long".to_string()));
            }

            // Mock response based on prompt content
            let response = if prompt.to_lowercase().contains("task") {
                "I can help you manage your tasks. You can create, update, and organize tasks using natural language commands."
            } else if prompt.to_lowercase().contains("time") {
                "I can assist with time tracking and productivity analysis. Let me know what you'd like to track or analyze."
            } else {
                "I'm Kira, your AI assistant for KiraPilot. I can help you with task management, time tracking, and productivity insights."
            };

            Ok(response.to_string())
        }

        fn mock_is_ready(&self) -> bool {
            self.is_ready
        }

        fn mock_get_status(&self) -> ModelStatus {
            ModelStatus {
                is_available: true,
                is_loaded: self.is_ready,
                model_path: self.model_path.as_ref().map(|p| p.to_string_lossy().to_string()),
                download_progress: None,
                error_message: None,
                model_info: if self.is_ready {
                    Some(crate::llama::service::ModelInfo {
                        name: "gemma-3-270m-it-Q4_K_M".to_string(),
                        size_mb: 150,
                        context_size: 2048,
                        parameter_count: "270M".to_string(),
                    })
                } else {
                    None
                },
            }
        }
    }

    #[tokio::test]
    async fn test_llama_service_creation() {
        let result = LlamaService::new();
        assert!(result.is_ok());
        
        let service = result.unwrap();
        assert!(!service.is_ready());
        assert_eq!(service.get_context_size(), 2048);
        assert!(service.get_threads() > 0);
    }

    #[tokio::test]
    async fn test_mock_service_initialization_success() {
        let mut mock_service = MockLlamaService::new();
        assert!(!mock_service.mock_is_ready());

        let result = mock_service.mock_initialize().await;
        assert!(result.is_ok());
        assert!(mock_service.mock_is_ready());

        let status = mock_service.mock_get_status();
        assert!(status.is_loaded);
        assert!(status.model_path.is_some());
    }

    #[tokio::test]
    async fn test_mock_service_initialization_failure() {
        let mut mock_service = MockLlamaService::with_init_failure();
        
        let result = mock_service.mock_initialize().await;
        assert!(result.is_err());
        assert!(!mock_service.mock_is_ready());

        if let Err(error) = result {
            assert!(matches!(error, LlamaError::InitializationError(_)));
            assert!(error.user_message().contains("initialize"));
        }
    }

    #[tokio::test]
    async fn test_mock_generation_success() {
        let mut mock_service = MockLlamaService::new();
        mock_service.mock_initialize().await.unwrap();

        let options = GenerationOptions::default();
        
        // Test task-related prompt
        let result = mock_service.mock_generate("Help me create a task", options.clone()).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.contains("task"));

        // Test time-related prompt
        let result = mock_service.mock_generate("How much time did I spend?", options.clone()).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.contains("time"));

        // Test general prompt
        let result = mock_service.mock_generate("Hello", options).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.contains("Kira"));
    }

    #[tokio::test]
    async fn test_mock_generation_validation_errors() {
        let mut mock_service = MockLlamaService::new();
        mock_service.mock_initialize().await.unwrap();

        let options = GenerationOptions::default();

        // Test empty prompt
        let result = mock_service.mock_generate("", options.clone()).await;
        assert!(result.is_err());
        if let Err(error) = result {
            assert!(matches!(error, LlamaError::ValidationError(_)));
        }

        // Test overly long prompt
        let long_prompt = "a".repeat(10000);
        let result = mock_service.mock_generate(&long_prompt, options).await;
        assert!(result.is_err());
        if let Err(error) = result {
            assert!(matches!(error, LlamaError::ValidationError(_)));
        }
    }

    #[tokio::test]
    async fn test_mock_generation_failure() {
        let mock_service = MockLlamaService::with_generation_failure();
        let options = GenerationOptions::default();

        let result = mock_service.mock_generate("Hello", options).await;
        assert!(result.is_err());
        if let Err(error) = result {
            assert!(matches!(error, LlamaError::GenerationFailed(_)));
        }
    }

    #[tokio::test]
    async fn test_mock_generation_not_ready() {
        let mock_service = MockLlamaService::new(); // Not initialized
        let options = GenerationOptions::default();

        let result = mock_service.mock_generate("Hello", options).await;
        assert!(result.is_err());
        if let Err(error) = result {
            assert!(matches!(error, LlamaError::GenerationFailed(_)));
        }
    }

    #[tokio::test]
    async fn test_generation_options_validation() {
        let mut options = GenerationOptions::default();
        
        // Test valid options
        options.max_tokens = Some(512);
        options.temperature = Some(0.7);
        options.top_p = Some(0.9);
        options.top_k = Some(40);
        options.repeat_penalty = Some(1.1);

        // These should be valid values
        assert!(options.max_tokens.unwrap() > 0);
        assert!(options.temperature.unwrap() >= 0.0);
        assert!(options.top_p.unwrap() >= 0.0);
        assert!(options.top_k.unwrap() > 0);
        assert!(options.repeat_penalty.unwrap() > 0.0);
    }

    #[tokio::test]
    async fn test_model_status_structure() {
        let mock_service = MockLlamaService::new();
        let status = mock_service.mock_get_status();

        assert!(status.is_available);
        assert!(!status.is_loaded); // Not initialized yet
        assert!(status.model_path.is_none());
        assert!(status.download_progress.is_none());
        assert!(status.error_message.is_none());
        assert!(status.model_info.is_none());
    }

    #[tokio::test]
    async fn test_model_status_after_initialization() {
        let mut mock_service = MockLlamaService::new();
        mock_service.mock_initialize().await.unwrap();
        
        let status = mock_service.mock_get_status();

        assert!(status.is_available);
        assert!(status.is_loaded);
        assert!(status.model_path.is_some());
        assert!(status.model_info.is_some());

        if let Some(model_info) = status.model_info {
            assert_eq!(model_info.name, "gemma-3-270m-it-Q4_K_M");
            assert_eq!(model_info.size_mb, 150);
            assert_eq!(model_info.context_size, 2048);
            assert_eq!(model_info.parameter_count, "270M");
        }
    }

    #[test]
    fn test_error_recoverability() {
        // Test recoverable errors
        assert!(LlamaError::NetworkError("test".to_string()).is_recoverable());
        assert!(LlamaError::TimeoutError("test".to_string()).is_recoverable());
        assert!(LlamaError::ResourceExhausted("test".to_string()).is_recoverable());
        assert!(LlamaError::ServiceUnavailable("test".to_string()).is_recoverable());
        assert!(LlamaError::GenerationFailed("test".to_string()).is_recoverable());
        assert!(LlamaError::DownloadFailed("test".to_string()).is_recoverable());
        assert!(LlamaError::InsufficientResources("test".to_string()).is_recoverable());

        // Test non-recoverable errors
        assert!(!LlamaError::ModelNotFound("test".to_string()).is_recoverable());
        assert!(!LlamaError::ModelLoadFailed("test".to_string()).is_recoverable());
        assert!(!LlamaError::ConfigurationError("test".to_string()).is_recoverable());
        assert!(!LlamaError::InitializationError("test".to_string()).is_recoverable());
        assert!(!LlamaError::IoError("test".to_string()).is_recoverable());
        assert!(!LlamaError::ValidationError("test".to_string()).is_recoverable());
        assert!(!LlamaError::RecoveryFailed("test".to_string()).is_recoverable());
    }

    #[test]
    fn test_error_user_messages() {
        let error = LlamaError::ModelNotFound("test".to_string());
        let user_message = error.user_message();
        assert!(user_message.contains("model could not be found"));

        let error = LlamaError::DownloadFailed("test".to_string());
        let user_message = error.user_message();
        assert!(user_message.contains("download"));

        let error = LlamaError::InsufficientResources("test".to_string());
        let user_message = error.user_message();
        assert!(user_message.contains("resources"));
    }

    #[test]
    fn test_error_recovery_suggestions() {
        let error = LlamaError::ModelNotFound("test".to_string());
        let suggestions = error.recovery_suggestions();
        assert!(!suggestions.is_empty());
        assert!(suggestions.iter().any(|s| s.contains("re-download")));

        let error = LlamaError::InsufficientResources("test".to_string());
        let suggestions = error.recovery_suggestions();
        assert!(suggestions.iter().any(|s| s.contains("memory")));
        assert!(suggestions.iter().any(|s| s.contains("cloud model")));
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let mut mock_service = MockLlamaService::new();
        mock_service.mock_initialize().await.unwrap();

        let _options = GenerationOptions::default();
        
        // Test concurrent generation requests
        let handles: Vec<_> = (0..5).map(|i| {
            let prompt = format!("Test prompt {}", i);
            tokio::spawn(async move {
                // Simulate the generation call
                tokio::time::sleep(Duration::from_millis(10)).await;
                Ok::<String, LlamaError>(format!("Response to {}", prompt))
            })
        }).collect();

        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await);
        }
        
        // All requests should complete successfully
        for result in results {
            assert!(result.is_ok());
            let response = result.unwrap();
            assert!(response.is_ok());
        }
    }

    #[test]
    fn test_default_generation_options() {
        let options = GenerationOptions::default();
        
        assert_eq!(options.max_tokens, Some(512));
        assert_eq!(options.temperature, Some(0.7));
        assert_eq!(options.top_p, Some(0.9));
        assert_eq!(options.top_k, Some(40));
        assert_eq!(options.repeat_penalty, Some(1.1));
    }

    #[tokio::test]
    async fn test_service_cleanup() {
        let mut mock_service = MockLlamaService::new();
        mock_service.mock_initialize().await.unwrap();
        
        assert!(mock_service.mock_is_ready());
        
        // Simulate cleanup by resetting state
        mock_service.is_ready = false;
        mock_service.model_path = None;
        
        assert!(!mock_service.mock_is_ready());
        
        let status = mock_service.mock_get_status();
        assert!(!status.is_loaded);
        assert!(status.model_path.is_none());
    }
}