#[cfg(test)]
mod tests {
    use crate::ai::{
        AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
        ReActEngine, ReActConfig, ReActPromptTemplates, ReActStep, ReActStepType,
        ToolCall, ToolResult, ToolRegistry
    };
    use std::collections::HashMap;
    use async_trait::async_trait;
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::Arc;

    /// Mock LLM Provider for testing ReAct engine
    struct MockLLMProvider {
        name: String,
        responses: Arc<tokio::sync::Mutex<Vec<String>>>,
        fail_after: Arc<AtomicU32>,
        call_count: Arc<AtomicU32>,
    }

    impl MockLLMProvider {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
                responses: Arc::new(tokio::sync::Mutex::new(Vec::new())),
                fail_after: Arc::new(AtomicU32::new(u32::MAX)),
                call_count: Arc::new(AtomicU32::new(0)),
            }
        }

        async fn add_response(&self, response: String) {
            let mut responses = self.responses.lock().await;
            responses.push(response);
        }

        fn set_fail_after(&self, count: u32) {
            self.fail_after.store(count, Ordering::SeqCst);
        }

        fn get_call_count(&self) -> u32 {
            self.call_count.load(Ordering::SeqCst)
        }
    }

    #[async_trait]
    impl LLMProvider for MockLLMProvider {
        async fn generate(&self, _prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            let count = self.call_count.fetch_add(1, Ordering::SeqCst);
            
            if count >= self.fail_after.load(Ordering::SeqCst) {
                return Err(AIServiceError::llm_error("Mock provider failure"));
            }

            let mut responses = self.responses.lock().await;
            if responses.is_empty() {
                return Ok("Default mock response".to_string());
            }
            
            Ok(responses.remove(0))
        }

        async fn is_ready(&self) -> bool {
            true
        }

        async fn get_status(&self) -> ProviderStatus {
            ProviderStatus::Ready
        }

        fn get_model_info(&self) -> ModelInfo {
            ModelInfo {
                id: format!("mock-{}", self.name),
                name: format!("Mock {}", self.name),
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
    }

    /// Mock Tool Registry for testing
    struct MockToolRegistry {
        tools: HashMap<String, String>,
        should_fail: Arc<AtomicBool>,
    }

    impl MockToolRegistry {
        fn new() -> Self {
            let mut tools = HashMap::new();
            tools.insert("create_task".to_string(), "Task created successfully".to_string());
            tools.insert("list_tasks".to_string(), "No tasks found".to_string());
            tools.insert("start_timer".to_string(), "Timer started".to_string());
            tools.insert("stop_timer".to_string(), "Timer stopped".to_string());

            Self {
                tools,
                should_fail: Arc::new(AtomicBool::new(false)),
            }
        }

        fn set_should_fail(&self, fail: bool) {
            self.should_fail.store(fail, Ordering::SeqCst);
        }
    }

    #[async_trait]
    impl ToolRegistry for MockToolRegistry {
        async fn execute_tool(
            &self,
            tool_name: &str,
            _args: &HashMap<String, serde_json::Value>,
        ) -> AIResult<serde_json::Value> {
            if self.should_fail.load(Ordering::SeqCst) {
                return Err(AIServiceError::internal_error("Mock tool failure"));
            }

            if let Some(result) = self.tools.get(tool_name) {
                Ok(serde_json::Value::String(result.clone()))
            } else {
                Err(AIServiceError::internal_error(format!("Tool '{}' not found", tool_name)))
            }
        }

        fn get_available_tools(&self) -> Vec<String> {
            self.tools.keys().cloned().collect()
        }

        fn has_tool(&self, tool_name: &str) -> bool {
            self.tools.contains_key(tool_name)
        }
    }

    #[tokio::test]
    async fn test_react_engine_creation() {
        let engine = ReActEngine::new();
        assert_eq!(engine.max_iterations(), 10); // DEFAULT_MAX_ITERATIONS value
    }

    #[tokio::test]
    async fn test_react_engine_with_config() {
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
    async fn test_create_chain() {
        let engine = ReActEngine::new();
        let user_request = "Create a new task for testing".to_string();
        let chain = engine.create_chain(user_request.clone());

        assert_eq!(chain.user_request, user_request);
        assert!(!chain.completed);
        assert_eq!(chain.iterations, 0);
        assert!(chain.steps.is_empty());
        assert!(chain.final_response.is_empty());
    }

    #[tokio::test]
    async fn test_add_step() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        let step_id = engine.add_step(&mut chain, ReActStepType::Thought, "This is a thought".to_string());

        assert_eq!(chain.steps.len(), 1);
        assert_eq!(chain.steps[0].id, step_id);
        assert_eq!(chain.steps[0].step_type, ReActStepType::Thought);
        assert_eq!(chain.steps[0].content, "This is a thought");
        assert!(chain.steps[0].tool_call.is_none());
        assert!(chain.steps[0].tool_result.is_none());
    }

    #[tokio::test]
    async fn test_add_step_with_tool() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        let tool_call = create_test_tool_call("create_task");
        let tool_result = create_test_tool_result(true, 100);

        let step_id = engine.add_step_with_tool(
            &mut chain,
            ReActStepType::Action,
            "Creating a task".to_string(),
            Some(tool_call.clone()),
            Some(tool_result.clone()),
        );

        assert_eq!(chain.steps.len(), 1);
        assert_eq!(chain.steps[0].id, step_id);
        assert_eq!(chain.steps[0].step_type, ReActStepType::Action);
        assert_eq!(chain.steps[0].content, "Creating a task");
        assert!(chain.steps[0].tool_call.is_some());
        assert!(chain.steps[0].tool_result.is_some());
        assert_eq!(chain.steps[0].tool_call.as_ref().unwrap().name, "create_task");
        assert!(chain.steps[0].tool_result.as_ref().unwrap().success);
    }

    #[tokio::test]
    async fn test_complete_chain() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        let final_response = "Task completed successfully".to_string();
        engine.complete_chain(&mut chain, final_response.clone());

        assert!(chain.completed);
        assert_eq!(chain.final_response, final_response);
        assert!(chain.completed_at.is_some());
        assert!(chain.total_duration_ms.is_some());
    }

    #[tokio::test]
    async fn test_generate_thought_prompt() {
        let engine = ReActEngine::new();
        let user_request = "Create a new task";
        let previous_steps = vec![];

        let prompt = engine.generate_thought_prompt(user_request, &previous_steps);

        assert!(prompt.contains(user_request));
        assert!(prompt.contains("Think"));
    }

    #[tokio::test]
    async fn test_generate_action_prompt() {
        let engine = ReActEngine::new();
        let user_request = "Create a new task";
        let current_thought = "I need to create a task for the user";
        let previous_steps = vec![];

        let prompt = engine.generate_action_prompt(user_request, current_thought, &previous_steps);

        assert!(prompt.contains(user_request));
        assert!(prompt.contains(current_thought));
        assert!(prompt.contains("Action"));
    }

    #[tokio::test]
    async fn test_generate_observation_prompt() {
        let engine = ReActEngine::new();
        let user_request = "Create a new task";
        let action_taken = "Created task using create_task tool";
        let tool_result = create_test_tool_result(true, 100);
        let previous_steps = vec![];

        let prompt = engine.generate_observation_prompt(
            user_request,
            action_taken,
            &tool_result,
            &previous_steps,
        );

        assert!(prompt.contains(user_request));
        assert!(prompt.contains(action_taken));
        assert!(prompt.contains("Success"));
        assert!(prompt.contains("Observation"));
    }

    #[tokio::test]
    async fn test_generate_final_answer_prompt() {
        let engine = ReActEngine::new();
        let user_request = "Create a new task";
        let reasoning_chain = vec![
            ReActStep {
                id: "1".to_string(),
                step_type: ReActStepType::Thought,
                content: "I need to create a task".to_string(),
                tool_call: None,
                tool_result: None,
                timestamp: chrono::Utc::now(),
                duration_ms: Some(100),
                metadata: HashMap::new(),
            },
        ];

        let prompt = engine.generate_final_answer_prompt(user_request, &reasoning_chain);

        assert!(prompt.contains(user_request));
        assert!(prompt.contains("Final Answer"));
    }

    #[tokio::test]
    async fn test_process_request_simple() {
        let engine = ReActEngine::new();
        let provider = MockLLMProvider::new("test");
        
        // Set up responses for the ReAct cycle
        provider.add_response("I need to help the user with their request".to_string()).await;
        provider.add_response("I should provide a helpful response".to_string()).await;
        provider.add_response("The user's request has been processed".to_string()).await;
        provider.add_response("I have successfully helped the user with their request".to_string()).await;

        let result = engine.process_request(
            "Hello, can you help me?".to_string(),
            &provider,
            None,
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        assert!(chain.completed);
        assert!(!chain.final_response.is_empty());
        assert!(chain.iterations > 0);
        assert!(!chain.steps.is_empty());
    }

    #[tokio::test]
    async fn test_process_request_with_tools() {
        let engine = ReActEngine::new();
        let provider = MockLLMProvider::new("test");
        let tool_registry = MockToolRegistry::new();

        // Set up responses that will trigger tool usage
        provider.add_response("I need to create a task for the user".to_string()).await;
        provider.add_response("use tool: create_task with args: {}".to_string()).await;
        provider.add_response("The task has been created successfully".to_string()).await;
        provider.add_response("I have created the task as requested".to_string()).await;

        let result = engine.process_request(
            "Create a new task".to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        assert!(chain.completed);
        assert!(!chain.final_response.is_empty());
        assert!(chain.iterations > 0);
        
        // Check that tools were used
        let has_tool_usage = chain.steps.iter().any(|step| step.tool_call.is_some());
        assert!(has_tool_usage);
    }

    #[tokio::test]
    async fn test_process_request_with_max_iterations() {
        let config = ReActConfig {
            max_iterations: 2,
            ..Default::default()
        };
        let engine = ReActEngine::with_config(config);
        let provider = MockLLMProvider::new("test");

        // Set up responses that won't trigger termination
        provider.add_response("I'm thinking about this".to_string()).await;
        provider.add_response("I need to think more".to_string()).await;
        provider.add_response("Still thinking".to_string()).await;
        provider.add_response("Let me continue thinking".to_string()).await;
        provider.add_response("Final answer".to_string()).await;

        let result = engine.process_request(
            "Complex request".to_string(),
            &provider,
            None,
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        assert!(chain.completed);
        assert_eq!(chain.iterations, 2); // Should stop at max iterations
    }

    #[tokio::test]
    async fn test_process_request_with_provider_failure() {
        let engine = ReActEngine::new();
        let provider = MockLLMProvider::new("test");
        
        // Make provider fail after first call
        provider.set_fail_after(1);
        provider.add_response("Initial response".to_string()).await;

        let result = engine.process_request(
            "Test request".to_string(),
            &provider,
            None,
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        assert!(chain.completed);
        
        // Should have error step
        let has_error_step = chain.steps.iter().any(|step| matches!(step.step_type, ReActStepType::Error));
        assert!(has_error_step);
    }

    #[tokio::test]
    async fn test_process_request_with_tool_failure() {
        let engine = ReActEngine::new();
        let provider = MockLLMProvider::new("test");
        let tool_registry = MockToolRegistry::new();

        // Make tools fail
        tool_registry.set_should_fail(true);

        // Set up responses that will trigger tool usage
        provider.add_response("I need to use a tool".to_string()).await;
        provider.add_response("use tool: create_task with args: {}".to_string()).await;
        provider.add_response("The tool failed, but I can still respond".to_string()).await;
        provider.add_response("I encountered an issue but handled it".to_string()).await;

        let result = engine.process_request(
            "Create a task".to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        assert!(chain.completed);
        
        // Should have tool calls with failures
        let has_failed_tool = chain.steps.iter().any(|step| {
            step.tool_result.as_ref().map(|r| !r.success).unwrap_or(false)
        });
        assert!(has_failed_tool);
    }

    #[tokio::test]
    async fn test_extract_debug_info() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        // Add various types of steps
        engine.add_step(&mut chain, ReActStepType::Thought, "Thinking".to_string());
        engine.add_step(&mut chain, ReActStepType::Action, "Acting".to_string());
        engine.add_step(&mut chain, ReActStepType::Observation, "Observing".to_string());
        
        chain.iterations = 3;
        chain.completed = true;
        chain.total_duration_ms = Some(1000);

        let debug_info = engine.extract_debug_info(&chain);

        assert_eq!(debug_info.chain_id, chain.id);
        assert_eq!(debug_info.total_iterations, 3);
        assert_eq!(debug_info.total_steps, 3);
        assert_eq!(debug_info.total_duration_ms, 1000);
        assert_eq!(debug_info.completion_status, "completed_successfully");
        assert!(debug_info.reasoning_quality_score > 0.0);
        
        // Check step breakdown
        assert_eq!(debug_info.step_breakdown.get(&ReActStepType::Thought), Some(&1));
        assert_eq!(debug_info.step_breakdown.get(&ReActStepType::Action), Some(&1));
        assert_eq!(debug_info.step_breakdown.get(&ReActStepType::Observation), Some(&1));
    }

    // Note: parse_tool_call is a private method, so we test it indirectly through process_request
    #[tokio::test]
    async fn test_tool_parsing_integration() {
        let engine = ReActEngine::new();
        let provider = MockLLMProvider::new("test");
        let tool_registry = MockToolRegistry::new();
        
        // Set up responses that should trigger tool usage
        provider.add_response("I need to create a task for the user".to_string()).await;
        provider.add_response("use tool: create_task with args: {}".to_string()).await;
        provider.add_response("The task has been created successfully".to_string()).await;
        provider.add_response("I have created the task as requested".to_string()).await;

        let result = engine.process_request(
            "Create a new task".to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;

        assert!(result.is_ok());
        let chain = result.unwrap();
        
        // Verify that tool calls were made
        let has_tool_usage = chain.steps.iter().any(|step| step.tool_call.is_some());
        assert!(has_tool_usage);
    }

    #[tokio::test]
    async fn test_tool_call_and_tool_result_creation() {
        let mut args = HashMap::new();
        args.insert("title".to_string(), serde_json::Value::String("Test Task".to_string()));
        
        let tool_call = ToolCall::new("create_task".to_string(), args.clone());
        assert_eq!(tool_call.name, "create_task");
        assert_eq!(tool_call.args, args);
        assert!(!tool_call.id.is_empty());

        let tool_result = ToolResult::success(
            serde_json::Value::String("Task created".to_string()),
            "Success".to_string(),
            150,
        );
        assert!(tool_result.success);
        assert_eq!(tool_result.message, "Success");
        assert_eq!(tool_result.execution_time_ms, 150);
        assert!(tool_result.error.is_none());

        let tool_result = ToolResult::failure("Failed to create task".to_string(), 100);
        assert!(!tool_result.success);
        assert_eq!(tool_result.execution_time_ms, 100);
        assert!(tool_result.error.is_some());
    }

    #[tokio::test]
    async fn test_react_step_types() {
        // Test step type equality
        assert_eq!(ReActStepType::Thought, ReActStepType::Thought);
        assert_ne!(ReActStepType::Thought, ReActStepType::Action);
        
        // Test serialization/deserialization
        let step_type = ReActStepType::Action;
        let serialized = serde_json::to_string(&step_type).unwrap();
        let deserialized: ReActStepType = serde_json::from_str(&serialized).unwrap();
        assert_eq!(step_type, deserialized);
    }

    #[tokio::test]
    async fn test_react_config_default() {
        let config = ReActConfig::default();
        assert_eq!(config.max_iterations, DEFAULT_MAX_ITERATIONS);
        assert!(!config.include_reasoning_in_response);
        assert!(config.detailed_logging);
        assert!(config.prompt_templates.is_none());
    }

    #[tokio::test]
    async fn test_custom_prompt_templates() {
        let custom_templates = ReActPromptTemplates {
            thought_template: Some("Custom thought: {user_request}".to_string()),
            action_template: Some("Custom action: {current_thought}".to_string()),
            observation_template: Some("Custom observation: {tool_result}".to_string()),
            final_answer_template: Some("Custom final: {reasoning_chain}".to_string()),
        };

        let config = ReActConfig {
            max_iterations: 5,
            include_reasoning_in_response: true,
            detailed_logging: true,
            prompt_templates: Some(custom_templates),
        };

        let engine = ReActEngine::with_config(config);
        
        let prompt = engine.generate_thought_prompt("test request", &[]);
        assert!(prompt.contains("Custom thought: test request"));
    }
}

    // Helper functions for creating test objects
    fn create_test_tool_call(name: &str) -> ToolCall {
        ToolCall {
            name: name.to_string(),
            args: HashMap::new(),
            id: uuid::Uuid::new_v4().to_string(),
        }
    }

    fn create_test_tool_result(success: bool, execution_time_ms: u64) -> ToolResult {
        ToolResult {
            success,
            data: serde_json::Value::String("test result".to_string()),
            message: if success { "Success".to_string() } else { "Failed".to_string() },
            execution_time_ms,
            error: if success { None } else { Some("Test error".to_string()) },
        }
    }