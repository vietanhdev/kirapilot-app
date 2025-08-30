#[cfg(test)]
mod tests {
    use crate::ai::{
        AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus
    };
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::Arc;
    use tokio::time::Duration;

    /// Mock LLM Provider for comprehensive testing
    struct MockLLMProvider {
        name: String,
        model_info: ModelInfo,
        ready: Arc<AtomicBool>,
        initialized: Arc<AtomicBool>,
        fail_generation: Arc<AtomicBool>,
        fail_initialization: Arc<AtomicBool>,
        generation_delay_ms: Arc<AtomicU32>,
        call_count: Arc<AtomicU32>,
        responses: Arc<tokio::sync::Mutex<Vec<String>>>,
    }

    impl MockLLMProvider {
        fn new(name: &str) -> Self {
            let model_info = ModelInfo {
                id: format!("mock-{}", name),
                name: format!("Mock {} Model", name),
                provider: name.to_string(),
                version: Some("1.0.0".to_string()),
                max_context_length: Some(4096),
                metadata: {
                    let mut meta = HashMap::new();
                    meta.insert("type".to_string(), serde_json::Value::String("mock".to_string()));
                    meta.insert("test_mode".to_string(), serde_json::Value::Bool(true));
                    meta
                },
            };

            Self {
                name: name.to_string(),
                model_info,
                ready: Arc::new(AtomicBool::new(true)),
                initialized: Arc::new(AtomicBool::new(false)),
                fail_generation: Arc::new(AtomicBool::new(false)),
                fail_initialization: Arc::new(AtomicBool::new(false)),
                generation_delay_ms: Arc::new(AtomicU32::new(100)),
                call_count: Arc::new(AtomicU32::new(0)),
                responses: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            }
        }

        fn with_model_info(mut self, model_info: ModelInfo) -> Self {
            self.model_info = model_info;
            self
        }

        fn set_ready(&self, ready: bool) {
            self.ready.store(ready, Ordering::SeqCst);
        }

        fn set_fail_generation(&self, fail: bool) {
            self.fail_generation.store(fail, Ordering::SeqCst);
        }

        fn set_fail_initialization(&self, fail: bool) {
            self.fail_initialization.store(fail, Ordering::SeqCst);
        }

        fn set_generation_delay(&self, delay_ms: u32) {
            self.generation_delay_ms.store(delay_ms, Ordering::SeqCst);
        }

        async fn add_response(&self, response: String) {
            let mut responses = self.responses.lock().await;
            responses.push(response);
        }

        async fn add_responses(&self, responses: Vec<String>) {
            let mut response_queue = self.responses.lock().await;
            response_queue.extend(responses);
        }

        fn get_call_count(&self) -> u32 {
            self.call_count.load(Ordering::SeqCst)
        }

        fn is_initialized(&self) -> bool {
            self.initialized.load(Ordering::SeqCst)
        }
    }

    #[async_trait]
    impl LLMProvider for MockLLMProvider {
        async fn generate(&self, prompt: &str, options: &GenerationOptions) -> AIResult<String> {
            let call_count = self.call_count.fetch_add(1, Ordering::SeqCst);

            if !self.initialized.load(Ordering::SeqCst) {
                return Err(AIServiceError::provider_unavailable("Provider not initialized"));
            }

            if !self.ready.load(Ordering::SeqCst) {
                return Err(AIServiceError::provider_unavailable("Provider not ready"));
            }

            if self.fail_generation.load(Ordering::SeqCst) {
                return Err(AIServiceError::llm_error(format!(
                    "Mock generation failure for call {}",
                    call_count
                )));
            }

            // Simulate processing delay
            let delay = self.generation_delay_ms.load(Ordering::SeqCst);
            if delay > 0 {
                tokio::time::sleep(Duration::from_millis(delay as u64)).await;
            }

            // Check for pre-configured responses
            let mut responses = self.responses.lock().await;
            if !responses.is_empty() {
                return Ok(responses.remove(0));
            }

            // Generate response based on prompt and options
            let response = if prompt.to_lowercase().contains("error") {
                "I understand you're asking about errors. How can I help you troubleshoot?".to_string()
            } else if prompt.to_lowercase().contains("task") {
                "I can help you with task management. What would you like to do with your tasks?".to_string()
            } else if prompt.to_lowercase().contains("timer") {
                "I can assist with timer functionality. Would you like to start, stop, or check a timer?".to_string()
            } else if options.max_tokens.is_some() && options.max_tokens.unwrap() < 50 {
                "Short response".to_string()
            } else {
                format!(
                    "Mock response from {} (call #{}) to prompt: {}",
                    self.name,
                    call_count + 1,
                    prompt.chars().take(50).collect::<String>()
                )
            };

            Ok(response)
        }

        async fn is_ready(&self) -> bool {
            self.ready.load(Ordering::SeqCst) && self.initialized.load(Ordering::SeqCst)
        }

        async fn get_status(&self) -> ProviderStatus {
            if !self.initialized.load(Ordering::SeqCst) {
                return ProviderStatus::Unavailable {
                    reason: "Not initialized".to_string(),
                };
            }

            if !self.ready.load(Ordering::SeqCst) {
                return ProviderStatus::Unavailable {
                    reason: "Not ready".to_string(),
                };
            }

            ProviderStatus::Ready
        }

        fn get_model_info(&self) -> ModelInfo {
            self.model_info.clone()
        }

        async fn initialize(&mut self) -> AIResult<()> {
            if self.fail_initialization.load(Ordering::SeqCst) {
                return Err(AIServiceError::config_error("Mock initialization failure"));
            }

            // Simulate initialization delay
            tokio::time::sleep(Duration::from_millis(50)).await;

            self.initialized.store(true, Ordering::SeqCst);
            Ok(())
        }

        async fn cleanup(&mut self) -> AIResult<()> {
            self.initialized.store(false, Ordering::SeqCst);
            self.ready.store(false, Ordering::SeqCst);
            
            // Clear responses
            let mut responses = self.responses.lock().await;
            responses.clear();
            
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_mock_provider_creation() {
        let provider = MockLLMProvider::new("test");
        
        assert_eq!(provider.name, "test");
        assert!(provider.ready.load(Ordering::SeqCst));
        assert!(!provider.initialized.load(Ordering::SeqCst));
        assert!(!provider.fail_generation.load(Ordering::SeqCst));
        
        let model_info = provider.get_model_info();
        assert_eq!(model_info.provider, "test");
        assert_eq!(model_info.name, "Mock test Model");
        assert!(model_info.metadata.contains_key("type"));
    }

    #[tokio::test]
    async fn test_provider_initialization() {
        let mut provider = MockLLMProvider::new("test");
        
        // Initially not initialized
        assert!(!provider.is_initialized());
        assert!(!provider.is_ready().await);
        
        // Initialize
        let result = provider.initialize().await;
        assert!(result.is_ok());
        assert!(provider.is_initialized());
        assert!(provider.is_ready().await);
        
        // Check status
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Ready));
    }

    #[tokio::test]
    async fn test_provider_initialization_failure() {
        let mut provider = MockLLMProvider::new("test");
        provider.set_fail_initialization(true);
        
        let result = provider.initialize().await;
        assert!(result.is_err());
        assert!(!provider.is_initialized());
        
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Unavailable { .. }));
    }

    #[tokio::test]
    async fn test_provider_cleanup() {
        let mut provider = MockLLMProvider::new("test");
        
        // Initialize first
        provider.initialize().await.unwrap();
        assert!(provider.is_initialized());
        
        // Add some responses
        provider.add_response("Test response".to_string()).await;
        
        // Cleanup
        let result = provider.cleanup().await;
        assert!(result.is_ok());
        assert!(!provider.is_initialized());
        assert!(!provider.is_ready().await);
        
        // Responses should be cleared
        let responses = provider.responses.lock().await;
        assert!(responses.is_empty());
    }

    #[tokio::test]
    async fn test_generation_success() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        
        let options = GenerationOptions::default();
        let result = provider.generate("Hello, AI!", &options).await;
        
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(!response.is_empty());
        assert!(response.contains("Mock response from test"));
        assert_eq!(provider.get_call_count(), 1);
    }

    #[tokio::test]
    async fn test_generation_with_predefined_responses() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        
        // Add predefined responses
        provider.add_responses(vec![
            "First response".to_string(),
            "Second response".to_string(),
            "Third response".to_string(),
        ]).await;
        
        let options = GenerationOptions::default();
        
        // First call
        let result1 = provider.generate("Test 1", &options).await.unwrap();
        assert_eq!(result1, "First response");
        
        // Second call
        let result2 = provider.generate("Test 2", &options).await.unwrap();
        assert_eq!(result2, "Second response");
        
        // Third call
        let result3 = provider.generate("Test 3", &options).await.unwrap();
        assert_eq!(result3, "Third response");
        
        // Fourth call should use default generation
        let result4 = provider.generate("Test 4", &options).await.unwrap();
        assert!(result4.contains("Mock response from test"));
        
        assert_eq!(provider.get_call_count(), 4);
    }

    #[tokio::test]
    async fn test_generation_context_aware_responses() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        
        let options = GenerationOptions::default();
        
        // Test task-related prompt
        let task_response = provider.generate("Help me create a task", &options).await.unwrap();
        assert!(task_response.contains("task management"));
        
        // Test timer-related prompt
        let timer_response = provider.generate("Start a timer for 25 minutes", &options).await.unwrap();
        assert!(timer_response.contains("timer functionality"));
        
        // Test error-related prompt
        let error_response = provider.generate("I'm getting an error", &options).await.unwrap();
        assert!(error_response.contains("errors"));
    }

    #[tokio::test]
    async fn test_generation_with_options() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        
        // Test with max_tokens limit
        let options = GenerationOptions {
            max_tokens: Some(30),
            temperature: Some(0.7),
            ..Default::default()
        };
        
        let result = provider.generate("Generate a long response", &options).await.unwrap();
        assert_eq!(result, "Short response");
        
        // Test with normal options
        let normal_options = GenerationOptions::default();
        let normal_result = provider.generate("Normal prompt", &normal_options).await.unwrap();
        assert!(normal_result.len() > "Short response".len());
    }

    #[tokio::test]
    async fn test_generation_failure_not_initialized() {
        let provider = MockLLMProvider::new("test");
        // Don't initialize
        
        let options = GenerationOptions::default();
        let result = provider.generate("Test", &options).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::ProviderUnavailable { .. }));
    }

    #[tokio::test]
    async fn test_generation_failure_not_ready() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        provider.set_ready(false);
        
        let options = GenerationOptions::default();
        let result = provider.generate("Test", &options).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::ProviderUnavailable { .. }));
    }

    #[tokio::test]
    async fn test_generation_failure_forced() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        provider.set_fail_generation(true);
        
        let options = GenerationOptions::default();
        let result = provider.generate("Test", &options).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::LLMError { .. }));
    }

    #[tokio::test]
    async fn test_generation_with_delay() {
        let mut provider = MockLLMProvider::new("test");
        provider.initialize().await.unwrap();
        provider.set_generation_delay(200);
        
        let start_time = std::time::Instant::now();
        let options = GenerationOptions::default();
        let result = provider.generate("Test with delay", &options).await;
        let elapsed = start_time.elapsed();
        
        assert!(result.is_ok());
        assert!(elapsed >= Duration::from_millis(200));
    }

    #[tokio::test]
    async fn test_provider_status_transitions() {
        let mut provider = MockLLMProvider::new("test");
        
        // Initial state: not initialized
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Unavailable { .. }));
        
        // After initialization: ready
        provider.initialize().await.unwrap();
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Ready));
        
        // Set not ready
        provider.set_ready(false);
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Unavailable { .. }));
        
        // Set ready again
        provider.set_ready(true);
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Ready));
        
        // After cleanup: not available
        provider.cleanup().await.unwrap();
        let status = provider.get_status().await;
        assert!(matches!(status, ProviderStatus::Unavailable { .. }));
    }

    #[tokio::test]
    async fn test_model_info_customization() {
        let custom_model_info = ModelInfo {
            id: "custom-model-123".to_string(),
            name: "Custom Test Model".to_string(),
            provider: "custom-provider".to_string(),
            version: Some("2.1.0".to_string()),
            max_context_length: Some(8192),
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("custom_field".to_string(), serde_json::Value::String("custom_value".to_string()));
                meta.insert("supports_streaming".to_string(), serde_json::Value::Bool(true));
                meta
            },
        };
        
        let provider = MockLLMProvider::new("test").with_model_info(custom_model_info.clone());
        let retrieved_info = provider.get_model_info();
        
        assert_eq!(retrieved_info.id, custom_model_info.id);
        assert_eq!(retrieved_info.name, custom_model_info.name);
        assert_eq!(retrieved_info.provider, custom_model_info.provider);
        assert_eq!(retrieved_info.version, custom_model_info.version);
        assert_eq!(retrieved_info.max_context_length, custom_model_info.max_context_length);
        assert_eq!(retrieved_info.metadata, custom_model_info.metadata);
    }

    #[tokio::test]
    async fn test_concurrent_generation_calls() {
        let provider = Arc::new(tokio::sync::Mutex::new(MockLLMProvider::new("concurrent")));
        
        // Initialize the provider
        {
            let mut p = provider.lock().await;
            p.initialize().await.unwrap();
        }
        
        let mut handles = Vec::new();
        
        // Spawn multiple concurrent generation tasks
        for i in 0..10 {
            let provider_clone = provider.clone();
            let handle = tokio::spawn(async move {
                let p = provider_clone.lock().await;
                let options = GenerationOptions::default();
                p.generate(&format!("Concurrent request {}", i), &options).await
            });
            handles.push(handle);
        }
        
        // Wait for all tasks to complete
        let mut results = Vec::new();
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
            results.push(result.unwrap());
        }
        
        // All results should be unique (contain different call numbers)
        assert_eq!(results.len(), 10);
        for (i, result) in results.iter().enumerate() {
            assert!(result.contains(&format!("call #{}", i + 1)));
        }
    }

    #[tokio::test]
    async fn test_generation_options_default() {
        let options = GenerationOptions::default();
        
        assert_eq!(options.max_tokens, Some(2048));
        assert_eq!(options.temperature, Some(0.7));
        assert_eq!(options.top_p, Some(0.9));
        assert!(options.stop_sequences.is_none());
        assert!(!options.stream);
    }

    #[tokio::test]
    async fn test_generation_options_custom() {
        let options = GenerationOptions {
            max_tokens: Some(100),
            temperature: Some(0.8),
            top_p: Some(0.9),
            stop_sequences: Some(vec!["STOP".to_string(), "END".to_string()]),
            stream: true,
        };
        
        assert_eq!(options.max_tokens, Some(100));
        assert_eq!(options.temperature, Some(0.8));
        assert_eq!(options.top_p, Some(0.9));
        assert_eq!(options.stop_sequences.as_ref().unwrap().len(), 2);
        assert!(options.stream);
    }

    #[tokio::test]
    async fn test_provider_status_serialization() {
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
        
        if let ProviderStatus::Unavailable { reason } = unavailable_deserialized {
            assert_eq!(reason, "Test reason");
        }
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
        
        // Test deserialization
        let deserialized: ModelInfo = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.id, model_info.id);
        assert_eq!(deserialized.name, model_info.name);
        assert_eq!(deserialized.provider, model_info.provider);
        assert_eq!(deserialized.version, model_info.version);
        assert_eq!(deserialized.max_context_length, model_info.max_context_length);
        assert_eq!(deserialized.metadata, model_info.metadata);
    }

    #[tokio::test]
    async fn test_error_handling_patterns() {
        let mut provider = MockLLMProvider::new("error_test");
        
        // Test different error scenarios
        let scenarios = vec![
            ("not_initialized", false, false, false),
            ("not_ready", true, false, true),
            ("generation_failure", true, true, false),
        ];
        
        for (scenario_name, should_init, should_fail_gen, should_set_not_ready) in scenarios {
            // Reset provider state
            provider.cleanup().await.unwrap();
            
            if should_init {
                provider.initialize().await.unwrap();
            }
            
            if should_set_not_ready {
                provider.set_ready(false);
            }
            
            if should_fail_gen {
                provider.set_fail_generation(true);
            }
            
            let options = GenerationOptions::default();
            let result = provider.generate(&format!("Test {}", scenario_name), &options).await;
            
            assert!(result.is_err(), "Scenario {} should fail", scenario_name);
            
            // Reset failure flags
            provider.set_fail_generation(false);
            provider.set_ready(true);
        }
    }

    #[tokio::test]
    async fn test_provider_lifecycle() {
        let mut provider = MockLLMProvider::new("lifecycle");
        
        // 1. Initial state
        assert!(!provider.is_initialized());
        assert!(!provider.is_ready().await);
        
        // 2. Initialize
        provider.initialize().await.unwrap();
        assert!(provider.is_initialized());
        assert!(provider.is_ready().await);
        
        // 3. Use provider
        let options = GenerationOptions::default();
        let result = provider.generate("Test message", &options).await;
        assert!(result.is_ok());
        
        // 4. Cleanup
        provider.cleanup().await.unwrap();
        assert!(!provider.is_initialized());
        assert!(!provider.is_ready().await);
        
        // 5. Try to use after cleanup (should fail)
        let result = provider.generate("Test after cleanup", &options).await;
        assert!(result.is_err());
    }
}