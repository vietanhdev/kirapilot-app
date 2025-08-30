use std::collections::HashMap;
use async_trait::async_trait;
use kirapilot_app_lib::ai::{
    AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
    SmartToolRegistry, ToolContext, PermissionLevel, ReActEngine, ReActConfig, ReActStepType,
};
use kirapilot_app_lib::ai::providers::LocalProvider;

/// Mock provider for testing AI tool usage with local models
struct MockLocalProvider {
    responses: Vec<String>,
    current_index: std::sync::Mutex<usize>,
}

impl MockLocalProvider {
    fn new() -> Self {
        Self {
            responses: vec![
                "I understand you want to create a task. Let me help you with that.".to_string(),
                "I'll analyze your request and use the appropriate tools to assist you.".to_string(),
                "Based on your message, I should use the create_task tool.".to_string(),
                "I have successfully processed your request and completed the task.".to_string(),
            ],
            current_index: std::sync::Mutex::new(0),
        }
    }
}

#[async_trait]
impl LLMProvider for MockLocalProvider {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        let mut index = self.current_index.lock().unwrap();
        
        // Generate contextual responses based on prompt content
        let response = if prompt.to_lowercase().contains("create") && prompt.to_lowercase().contains("task") {
            "I'll help you create that task. Let me extract the details and use the create_task tool."
        } else if prompt.to_lowercase().contains("timer") || prompt.to_lowercase().contains("start") {
            "I'll start the timer for you. Let me identify the task and begin time tracking."
        } else if prompt.to_lowercase().contains("stop") {
            "I'll stop the current timer and save your work session."
        } else if *index < self.responses.len() {
            let response = &self.responses[*index];
            *index += 1;
            response
        } else {
            "I understand your request and will help you with the appropriate action."
        };
        
        Ok(response.to_string())
    }

    async fn is_ready(&self) -> bool {
        true
    }

    async fn get_status(&self) -> ProviderStatus {
        ProviderStatus::Ready
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: "mock-local-gemma".to_string(),
            name: "Mock Local Gemma Model".to_string(),
            provider: "mock-local".to_string(),
            version: Some("3.0.0".to_string()),
            max_context_length: Some(4096),
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("model_type".to_string(), serde_json::Value::String("local".to_string()));
                meta.insert("quantization".to_string(), serde_json::Value::String("Q4_K_M".to_string()));
                meta
            },
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

fn create_test_context(user_message: &str) -> ToolContext {
    let mut preferences = HashMap::new();
    preferences.insert("default_priority".to_string(), serde_json::Value::Number(serde_json::Number::from(1)));
    
    let mut metadata = HashMap::new();
    metadata.insert("user_id".to_string(), serde_json::Value::String("test-user".to_string()));
    
    ToolContext {
        user_message: user_message.to_string(),
        conversation_history: vec![
            "I'm working on improving productivity".to_string(),
        ],
        active_task_id: None,
        active_timer_session_id: None,
        recent_task_ids: Vec::new(),
        current_time: chrono::Utc::now(),
        user_preferences: preferences,
        metadata,
    }
}

#[tokio::test]
async fn test_local_ai_provider_initialization() {
    // Test creating a local provider
    let provider = LocalProvider::new();
    
    // Test basic properties
    let model_info = provider.get_model_info();
    assert!(!model_info.id.is_empty());
    assert!(!model_info.name.is_empty());
    assert_eq!(model_info.provider, "local");
    
    // Test that it has reasonable context length
    if let Some(context_length) = model_info.max_context_length {
        assert!(context_length >= 2048);
    }
}

#[tokio::test]
async fn test_mock_local_provider_functionality() {
    let provider = MockLocalProvider::new();
    
    // Test basic functionality
    assert!(provider.is_ready().await);
    
    let status = provider.get_status().await;
    assert!(matches!(status, ProviderStatus::Ready));
    
    // Test model info
    let model_info = provider.get_model_info();
    assert_eq!(model_info.provider, "mock-local");
    assert!(model_info.metadata.contains_key("model_type"));
    
    // Test text generation with different prompts
    let options = GenerationOptions::default();
    
    let task_response = provider.generate("Create a task for reviewing code", &options).await;
    assert!(task_response.is_ok());
    let response = task_response.unwrap();
    assert!(response.to_lowercase().contains("task"));
    
    let timer_response = provider.generate("Start a timer for my work", &options).await;
    assert!(timer_response.is_ok());
    let response = timer_response.unwrap();
    assert!(response.to_lowercase().contains("timer"));
}

#[tokio::test]
async fn test_tool_registry_with_local_ai() {
    // Create a tool registry with various permission levels
    let registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
    
    // Test basic functionality
    let available_tools = registry.get_available_tools();
    assert!(available_tools.is_empty()); // No tools registered yet
    
    // Test tool suggestions
    let context = create_test_context("I need to create a high priority task");
    let suggestions = registry.suggest_tools(&context).await;
    assert!(suggestions.is_ok());
    
    let suggestions = suggestions.unwrap();
    assert!(suggestions.is_empty()); // No tools registered
    
    // Test with different permission levels
    let read_only_registry = SmartToolRegistry::new(vec![PermissionLevel::ReadOnly]);
    let modify_registry = SmartToolRegistry::new(vec![PermissionLevel::ModifyTasks]);
    let timer_registry = SmartToolRegistry::new(vec![PermissionLevel::TimerControl]);
    
    // All should be created successfully
    assert!(read_only_registry.get_available_tools().is_empty());
    assert!(modify_registry.get_available_tools().is_empty());
    assert!(timer_registry.get_available_tools().is_empty());
}

#[tokio::test]
async fn test_react_engine_with_local_ai() {
    let provider = MockLocalProvider::new();
    
    // Create ReAct engine with reasonable configuration
    let config = ReActConfig {
        max_iterations: 3,
        include_reasoning_in_response: true,
        detailed_logging: true,
        prompt_templates: None,
    };
    let react_engine = ReActEngine::with_config(config);
    
    // Test processing a user request
    let result = react_engine.process_request(
        "Help me create a task for reviewing the quarterly report".to_string(),
        &provider,
        None, // No tool registry for this test
        None, // No logger
    ).await;
    
    assert!(result.is_ok());
    
    let chain = result.unwrap();
    assert!(chain.completed);
    assert!(!chain.final_response.is_empty());
    assert!(chain.iterations > 0);
    assert!(chain.iterations <= 3);
    assert!(!chain.steps.is_empty());
    
    // Test that we have different types of reasoning steps
    let thought_steps = chain.steps.iter()
        .filter(|s| matches!(s.step_type, ReActStepType::Thought))
        .count();
    let final_answer_steps = chain.steps.iter()
        .filter(|s| matches!(s.step_type, ReActStepType::FinalAnswer))
        .count();
    
    assert!(thought_steps > 0);
    assert!(final_answer_steps > 0);
    
    // Test debug information
    let debug_info = react_engine.extract_debug_info(&chain);
    assert_eq!(debug_info.chain_id, chain.id);
    assert!(debug_info.total_steps > 0);
    // Note: total_duration_ms might be 0 for very fast mock operations
    assert!(debug_info.total_duration_ms > 0, "Duration should be positive");
    assert!(debug_info.reasoning_quality_score >= 0.0);
    assert!(debug_info.reasoning_quality_score <= 100.0);
}

#[tokio::test]
async fn test_context_aware_ai_responses() {
    let provider = MockLocalProvider::new();
    
    // Test different types of contexts
    let contexts = vec![
        ("Create a high priority task", "task creation"),
        ("Start timing my work session", "timer functionality"),
        ("Show me my current progress", "information retrieval"),
        ("Stop the timer and save my work", "timer management"),
    ];
    
    for (message, description) in contexts {
        let context = create_test_context(message);
        let options = GenerationOptions::default();
        
        // Create a prompt that includes context
        let prompt = format!(
            "User context: {}\nUser message: {}\nRespond appropriately:",
            description, context.user_message
        );
        
        let result = provider.generate(&prompt, &options).await;
        assert!(result.is_ok(), "Failed for context: {}", description);
        
        let response = result.unwrap();
        assert!(!response.is_empty());
        assert!(response.len() > 10);
    }
}

#[tokio::test]
async fn test_generation_options_with_local_ai() {
    let provider = MockLocalProvider::new();
    
    // Test with different generation options
    let test_options = vec![
        GenerationOptions {
            max_tokens: Some(50),
            temperature: Some(0.7),
            top_p: Some(0.9),
            stop_sequences: None,
            stream: false,
        },
        GenerationOptions {
            max_tokens: Some(100),
            temperature: Some(0.3),
            top_p: Some(0.8),
            stop_sequences: Some(vec!["END".to_string()]),
            stream: false,
        },
    ];
    
    for (i, options) in test_options.iter().enumerate() {
        let result = provider.generate("Generate a helpful response", options).await;
        assert!(result.is_ok(), "Failed with options {}", i);
        
        let response = result.unwrap();
        assert!(!response.is_empty());
    }
}

#[tokio::test]
async fn test_error_handling_with_local_ai() {
    // Test error handling with a provider that can fail
    struct FailingProvider {
        should_fail: bool,
    }
    
    #[async_trait]
    impl LLMProvider for FailingProvider {
        async fn generate(&self, _prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            if self.should_fail {
                Err(AIServiceError::llm_error("Simulated local model failure"))
            } else {
                Ok("Success response".to_string())
            }
        }
        
        async fn is_ready(&self) -> bool {
            !self.should_fail
        }
        
        async fn get_status(&self) -> ProviderStatus {
            if self.should_fail {
                ProviderStatus::Error {
                    message: "Local model is in error state".to_string(),
                }
            } else {
                ProviderStatus::Ready
            }
        }
        
        fn get_model_info(&self) -> ModelInfo {
            ModelInfo {
                id: "failing-provider".to_string(),
                name: "Failing Test Provider".to_string(),
                provider: "test".to_string(),
                version: None,
                max_context_length: None,
                metadata: HashMap::new(),
            }
        }
        
        async fn initialize(&mut self) -> AIResult<()> {
            if self.should_fail {
                Err(AIServiceError::provider_unavailable("Cannot initialize failing provider"))
            } else {
                Ok(())
            }
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
    
    // Test successful case
    let working_provider = FailingProvider { should_fail: false };
    assert!(working_provider.is_ready().await);
    
    let options = GenerationOptions::default();
    let result = working_provider.generate("Test", &options).await;
    assert!(result.is_ok());
    
    // Test failure case
    let failing_provider = FailingProvider { should_fail: true };
    assert!(!failing_provider.is_ready().await);
    
    let result = failing_provider.generate("Test", &options).await;
    assert!(result.is_err());
    
    if let Err(error) = result {
        assert!(matches!(error, AIServiceError::LLMError { .. }));
    }
}

#[tokio::test]
async fn test_conversation_flow_with_local_ai() {
    let provider = MockLocalProvider::new();
    
    // Simulate a conversation flow
    let conversation_steps = vec![
        "I need to create a task for code review",
        "Make it high priority please",
        "Now start a timer for this task",
        "Actually, let me check what other tasks I have first",
    ];
    
    let mut conversation_history = Vec::new();
    
    for (i, message) in conversation_steps.iter().enumerate() {
        let mut context = create_test_context(message);
        context.conversation_history = conversation_history.clone();
        
        let options = GenerationOptions::default();
        let prompt = format!(
            "Conversation history: {:?}\nCurrent message: {}\nRespond appropriately:",
            context.conversation_history, message
        );
        
        let result = provider.generate(&prompt, &options).await;
        assert!(result.is_ok(), "Step {} failed", i + 1);
        
        let response = result.unwrap();
        assert!(!response.is_empty());
        
        // Add to conversation history
        conversation_history.push(message.to_string());
        conversation_history.push(response);
        
        // Limit history size
        if conversation_history.len() > 6 {
            conversation_history = conversation_history.split_off(2);
        }
    }
}

#[tokio::test]
async fn test_performance_characteristics() {
    let provider = MockLocalProvider::new();
    
    let start_time = std::time::Instant::now();
    let mut successful_generations = 0;
    
    // Test multiple generations
    for i in 1..=5 {
        let message = format!("Generate response number {}", i);
        let options = GenerationOptions::default();
        
        let generation_start = std::time::Instant::now();
        let result = provider.generate(&message, &options).await;
        let generation_time = generation_start.elapsed();
        
        if result.is_ok() {
            successful_generations += 1;
            
            // Each generation should be reasonably fast for a mock
            assert!(generation_time.as_millis() < 1000, "Generation {} too slow", i);
        }
    }
    
    let total_time = start_time.elapsed();
    
    // Performance assertions
    assert_eq!(successful_generations, 5, "All generations should succeed");
    assert!(total_time.as_secs() < 5, "Total time should be reasonable");
    
    println!("Performance test completed:");
    println!("  Successful generations: {}/5", successful_generations);
    println!("  Total time: {:?}", total_time);
    println!("  Average time per generation: {:?}", total_time / 5);
}