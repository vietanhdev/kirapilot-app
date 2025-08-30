// Comprehensive tests for the ReAct engine
// Run with: cargo test --test test_react_engine

use std::collections::HashMap;
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

// Import the ReAct engine and related types
// Note: Using the lib name as defined in Cargo.toml
use kirapilot_app_lib::ai::react_engine::{
    ReActEngine, ReActConfig, ReActChain, ReActStep, ReActStepType, 
    ToolCall, ToolResult, ToolRegistry, ReActPromptTemplates
};
use kirapilot_app_lib::ai::{AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus};
use async_trait::async_trait;

// Mock LLM Provider for testing
struct MockLLMProvider {
    responses: Vec<String>,
    current_response: std::sync::Mutex<usize>,
    should_fail: bool,
}

impl MockLLMProvider {
    fn new(responses: Vec<String>) -> Self {
        Self {
            responses,
            current_response: std::sync::Mutex::new(0),
            should_fail: false,
        }
    }

    fn new_failing() -> Self {
        Self {
            responses: vec![],
            current_response: std::sync::Mutex::new(0),
            should_fail: true,
        }
    }
}

#[async_trait]
impl LLMProvider for MockLLMProvider {
    async fn generate(&self, _prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        if self.should_fail {
            return Err(AIServiceError::llm_error("Mock LLM failure".to_string()));
        }

        let mut index = self.current_response.lock().unwrap();
        if *index < self.responses.len() {
            let response = self.responses[*index].clone();
            *index += 1;
            Ok(response)
        } else {
            Ok("No more responses available".to_string())
        }
    }

    async fn is_ready(&self) -> bool {
        !self.should_fail
    }

    async fn get_status(&self) -> ProviderStatus {
        if self.should_fail {
            ProviderStatus::Error { message: "Mock failure".to_string() }
        } else {
            ProviderStatus::Ready
        }
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: "mock-model".to_string(),
            name: "Mock Model".to_string(),
            provider: "mock".to_string(),
            version: Some("1.0".to_string()),
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

// Mock Tool Registry for testing
struct MockToolRegistry {
    tools: HashMap<String, serde_json::Value>,
    should_fail_tools: Vec<String>,
}

impl MockToolRegistry {
    fn new() -> Self {
        let mut tools = HashMap::new();
        
        // Mock get_tasks response
        let tasks_response = json!({
            "tasks": [
                {"title": "Review code", "status": "pending", "id": "task-1"},
                {"title": "Update docs", "status": "completed", "id": "task-2"},
                {"title": "Fix bug", "status": "in_progress", "id": "task-3"}
            ]
        });
        tools.insert("get_tasks".to_string(), tasks_response);
        
        // Mock create_task response
        let create_response = json!({
            "title": "New Task",
            "id": "task-123",
            "status": "pending"
        });
        tools.insert("create_task".to_string(), create_response);

        // Mock timer_status response
        let timer_response = json!({
            "active": false,
            "task_title": null
        });
        tools.insert("timer_status".to_string(), timer_response);

        Self { 
            tools,
            should_fail_tools: vec![],
        }
    }

    fn with_failing_tools(failing_tools: Vec<String>) -> Self {
        let mut registry = Self::new();
        registry.should_fail_tools = failing_tools;
        registry
    }
}

#[async_trait]
impl ToolRegistry for MockToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        _args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        if self.should_fail_tools.contains(&tool_name.to_string()) {
            return Err(AIServiceError::internal_error(format!("Mock failure for tool '{}'", tool_name)));
        }

        if let Some(response) = self.tools.get(tool_name) {
            Ok(response.clone())
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
    // Test creating ReAct engine with default config
    let engine = ReActEngine::new();
    assert_eq!(engine.max_iterations(), 10);

    // Test creating with custom config
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
async fn test_react_chain_creation() {
    let engine = ReActEngine::new();
    let chain = engine.create_chain("Test request".to_string());
    
    assert_eq!(chain.user_request, "Test request");
    assert!(chain.steps.is_empty());
    assert_eq!(chain.final_response, "");
    assert!(!chain.completed);
    assert_eq!(chain.iterations, 0);
    assert!(chain.total_duration_ms.is_none());
}

#[tokio::test]
async fn test_add_steps_to_chain() {
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test request".to_string());
    
    // Add a thought step
    let step_id = engine.add_step(&mut chain, ReActStepType::Thought, "I need to think".to_string());
    assert_eq!(chain.steps.len(), 1);
    assert_eq!(chain.steps[0].step_type, ReActStepType::Thought);
    assert_eq!(chain.steps[0].content, "I need to think");
    assert_eq!(chain.steps[0].id, step_id);

    // Add an action step with tool call
    let tool_call = create_test_tool_call("get_tasks".to_string(), HashMap::new());
    let tool_result = ToolResult {
        success: true,
        data: json!({"tasks": []}),
        message: "Success".to_string(),
        execution_time_ms: 100,
        error: None,
    };

    let _action_id = engine.add_step_with_tool(
        &mut chain,
        ReActStepType::Action,
        "Taking action".to_string(),
        Some(tool_call.clone()),
        Some(tool_result.clone()),
    );

    assert_eq!(chain.steps.len(), 2);
    assert_eq!(chain.steps[1].step_type, ReActStepType::Action);
    assert!(chain.steps[1].tool_call.is_some());
    assert!(chain.steps[1].tool_result.is_some());
    assert_eq!(chain.steps[1].tool_call.as_ref().unwrap().name, "get_tasks");
}

#[tokio::test]
async fn test_complete_chain() {
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test request".to_string());
    
    engine.complete_chain(&mut chain, "Final answer".to_string());
    
    assert_eq!(chain.final_response, "Final answer");
    assert!(chain.completed);
    assert!(chain.completed_at.is_some());
    assert!(chain.total_duration_ms.is_some());
}

#[tokio::test]
async fn test_prompt_generation() {
    let engine = ReActEngine::new();
    let previous_steps = vec![
        ReActStep {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Thought,
            content: "Previous thought".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(100),
            metadata: HashMap::new(),
        }
    ];

    // Test thought prompt generation
    let thought_prompt = engine.generate_thought_prompt("Test request", &previous_steps);
    assert!(!thought_prompt.is_empty());

    // Test action prompt generation
    let action_prompt = engine.generate_action_prompt(
        "Test request",
        "Current thought",
        &previous_steps,
    );
    assert!(!action_prompt.is_empty());

    // Test action prompt with tools - this is the main one we use
    let tools = vec!["get_tasks".to_string(), "create_task".to_string()];
    let action_with_tools = engine.generate_action_prompt_with_tools(
        "Test request",
        "Current thought", 
        &previous_steps,
        &tools,
    );
    assert!(action_with_tools.contains("get_tasks"));
    assert!(action_with_tools.contains("create_task"));
    assert!(action_with_tools.contains("Tool:"));
    assert!(action_with_tools.contains("Test request"));
    assert!(action_with_tools.contains("Current thought"));
}

// Note: Removed tests for private methods parse_action_line and format_tool_result
// These are tested indirectly through the public process_request method

#[tokio::test]
async fn test_successful_request_processing() {
    let engine = ReActEngine::new();
    
    let mock_responses = vec![
        "Thought: I need to get the user's tasks.\nAction: get_tasks: {}\nPAUSE".to_string(),
        "Answer: Here are your tasks:\n\n**Pending:**\n• Review code\n\n**In Progress:**\n• Fix bug\n\n**Completed:**\n• Update docs".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    let tool_registry = MockToolRegistry::new();
    
    let result = engine.process_request(
        "list tasks".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.iterations > 0);
    assert!(!chain.final_response.is_empty());
    assert!(chain.total_duration_ms.is_some());
    assert!(chain.completed_at.is_some());
}

#[tokio::test]
async fn test_request_processing_with_tool_execution() {
    let engine = ReActEngine::new();
    
    let mock_responses = vec![
        "Thought: I'll get the tasks.\nAction: get_tasks: {}\nPAUSE".to_string(),
        "Answer: You have 3 tasks: Review code (pending), Fix bug (in_progress), Update docs (completed)".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    let tool_registry = MockToolRegistry::new();
    
    let result = engine.process_request(
        "list tasks".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    // Should have action and observation steps
    assert!(chain.steps.len() >= 2);
    
    // Find the action step
    let action_step = chain.steps.iter().find(|s| s.step_type == ReActStepType::Action);
    assert!(action_step.is_some());
    
    // Find the observation step
    let obs_step = chain.steps.iter().find(|s| s.step_type == ReActStepType::Observation);
    assert!(obs_step.is_some());
    
    let obs = obs_step.unwrap();
    assert!(obs.tool_result.is_some());
    assert!(obs.tool_result.as_ref().unwrap().success);
}

#[tokio::test]
async fn test_request_processing_without_tools() {
    let engine = ReActEngine::new();
    
    let mock_responses = vec![
        "Answer: I can help you with task management, but no tools are available right now.".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    
    let result = engine.process_request(
        "help me".to_string(),
        &provider,
        None, // No tool registry
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("help you"));
}

#[tokio::test]
async fn test_tool_execution_failure() {
    let engine = ReActEngine::new();
    
    let mock_responses = vec![
        "Thought: I'll try to get tasks.\nAction: get_tasks: {}\nPAUSE".to_string(),
        "Answer: Sorry, I couldn't retrieve your tasks due to an error.".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    let tool_registry = MockToolRegistry::with_failing_tools(vec!["get_tasks".to_string()]);
    
    let result = engine.process_request(
        "list tasks".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    // Should still complete even with tool failure
    assert!(chain.completed);
    
    // Should have an observation step with failed tool result
    let obs_step = chain.steps.iter().find(|s| s.step_type == ReActStepType::Observation);
    assert!(obs_step.is_some());
    
    let obs = obs_step.unwrap();
    assert!(obs.tool_result.is_some());
    assert!(!obs.tool_result.as_ref().unwrap().success);
}

#[tokio::test]
async fn test_llm_provider_failure() {
    let engine = ReActEngine::new();
    let provider = MockLLMProvider::new_failing();
    let tool_registry = MockToolRegistry::new();
    
    let result = engine.process_request(
        "test request".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.to_string().contains("Mock LLM failure"));
}

#[tokio::test]
async fn test_max_iterations_limit() {
    let mut engine = ReActEngine::new();
    engine.set_max_iterations(2); // Set very low limit
    
    // Mock responses that don't contain "Answer:" to test max iterations
    let mock_responses = vec![
        "Thought: Thinking...".to_string(),
        "Thought: Still thinking...".to_string(),
        "Thought: More thinking...".to_string(),
        "Thought: Even more thinking...".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    let tool_registry = MockToolRegistry::new();
    
    let result = engine.process_request(
        "test request".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    // Should complete within max iterations
    assert!(chain.completed);
    assert!(chain.iterations <= 5); // Our internal max_turns is 5
}

#[tokio::test]
async fn test_custom_prompt_templates() {
    let custom_templates = ReActPromptTemplates {
        thought_template: Some("Custom thought: {user_request}".to_string()),
        action_template: Some("Custom action: {current_thought}".to_string()),
        observation_template: Some("Custom observation: {tool_result}".to_string()),
        final_answer_template: Some("Custom answer: {reasoning_chain}".to_string()),
    };
    
    let config = ReActConfig {
        max_iterations: 10,
        include_reasoning_in_response: false,
        detailed_logging: true,
        prompt_templates: Some(custom_templates),
    };
    
    let engine = ReActEngine::with_config(config);
    
    // Test that custom templates are used
    let thought_prompt = engine.generate_thought_prompt("test", &[]);
    assert!(thought_prompt.contains("Custom thought"));
    
    let action_prompt = engine.generate_action_prompt("test", "thought", &[]);
    assert!(action_prompt.contains("Custom action"));
}

#[tokio::test]
async fn test_step_types_and_metadata() {
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test".to_string());
    
    // Test all step types
    let step_types = vec![
        ReActStepType::Thought,
        ReActStepType::Action,
        ReActStepType::Observation,
        ReActStepType::FinalAnswer,
        ReActStepType::Error,
    ];
    
    for step_type in step_types {
        let _id = engine.add_step(&mut chain, step_type.clone(), format!("Content for {:?}", step_type));
    }
    
    assert_eq!(chain.steps.len(), 5);
    
    // Verify each step has correct type
    assert_eq!(chain.steps[0].step_type, ReActStepType::Thought);
    assert_eq!(chain.steps[1].step_type, ReActStepType::Action);
    assert_eq!(chain.steps[2].step_type, ReActStepType::Observation);
    assert_eq!(chain.steps[3].step_type, ReActStepType::FinalAnswer);
    assert_eq!(chain.steps[4].step_type, ReActStepType::Error);
    
    // Test duration update
    engine.update_last_step_duration(&mut chain, 500);
    assert_eq!(chain.steps.last().unwrap().duration_ms, Some(500));
}

// Note: Removed test_tool_call_creation as ToolCall::new is not a public method

#[tokio::test]
async fn test_serialization() {
    // Test that all structs can be serialized/deserialized
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test serialization".to_string());
    
    // Add some steps
    let _id = engine.add_step(&mut chain, ReActStepType::Thought, "Test thought".to_string());
    
    let tool_call = create_test_tool_call("test_tool".to_string(), HashMap::new());
    let tool_result = ToolResult {
        success: true,
        data: json!({"result": "success"}),
        message: "Tool executed".to_string(),
        execution_time_ms: 100,
        error: None,
    };
    
    let _id = engine.add_step_with_tool(
        &mut chain,
        ReActStepType::Action,
        "Test action".to_string(),
        Some(tool_call),
        Some(tool_result),
    );
    
    engine.complete_chain(&mut chain, "Test complete".to_string());
    
    // Test serialization
    let serialized = serde_json::to_string(&chain).expect("Should serialize");
    assert!(!serialized.is_empty());
    
    // Test deserialization
    let deserialized: ReActChain = serde_json::from_str(&serialized).expect("Should deserialize");
    assert_eq!(deserialized.user_request, chain.user_request);
    assert_eq!(deserialized.final_response, chain.final_response);
    assert_eq!(deserialized.steps.len(), chain.steps.len());
}

// Helper function to create ToolCall for testing
fn create_test_tool_call(name: String, args: HashMap<String, serde_json::Value>) -> ToolCall {
    ToolCall {
        name,
        args,
        id: Uuid::new_v4().to_string(),
    }
}

// Additional focused tests for ReAct engine edge cases and specific functionality

#[tokio::test]
async fn test_empty_tool_registry() {
    let engine = ReActEngine::new();
    
    let mock_responses = vec![
        "Answer: I don't have access to any tools right now, but I can still help with general questions.".to_string(),
    ];
    
    let provider = MockLLMProvider::new(mock_responses);
    let empty_registry = EmptyToolRegistry::new();
    
    let result = engine.process_request(
        "help me".to_string(),
        &provider,
        Some(&empty_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    assert!(chain.completed);
    assert!(chain.final_response.contains("Answer:"));
}

#[tokio::test]
async fn test_chain_metadata_and_timing() {
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test timing".to_string());
    
    // Verify initial state
    assert!(chain.started_at <= Utc::now());
    assert!(chain.completed_at.is_none());
    assert!(chain.total_duration_ms.is_none());
    
    // Add some steps
    let _id = engine.add_step(&mut chain, ReActStepType::Thought, "Thinking...".to_string());
    
    // Complete the chain
    engine.complete_chain(&mut chain, "Done".to_string());
    
    // Verify completion state
    assert!(chain.completed);
    assert!(chain.completed_at.is_some());
    assert!(chain.total_duration_ms.is_some());
    assert!(chain.completed_at.unwrap() >= chain.started_at);
}

#[tokio::test]
async fn test_react_config_variations() {
    // Test minimal config
    let minimal_config = ReActConfig {
        max_iterations: 1,
        include_reasoning_in_response: false,
        detailed_logging: false,
        prompt_templates: None,
    };
    let engine = ReActEngine::with_config(minimal_config);
    assert_eq!(engine.max_iterations(), 1);
    
    // Test config with custom templates
    let custom_templates = ReActPromptTemplates {
        thought_template: Some("Think: {user_request}".to_string()),
        action_template: Some("Act: {current_thought}".to_string()),
        observation_template: Some("Observe: {tool_result}".to_string()),
        final_answer_template: Some("Final: {reasoning_chain}".to_string()),
    };
    
    let custom_config = ReActConfig {
        max_iterations: 15,
        include_reasoning_in_response: true,
        detailed_logging: true,
        prompt_templates: Some(custom_templates),
    };
    
    let engine = ReActEngine::with_config(custom_config);
    assert_eq!(engine.max_iterations(), 15);
    
    // Test that custom templates are used
    let thought_prompt = engine.generate_thought_prompt("test", &[]);
    assert!(thought_prompt.contains("Think:"));
}

#[tokio::test]
async fn test_step_duration_tracking() {
    let engine = ReActEngine::new();
    let mut chain = engine.create_chain("Test duration".to_string());
    
    // Add a step
    let _id = engine.add_step(&mut chain, ReActStepType::Thought, "Test".to_string());
    assert_eq!(chain.steps.len(), 1);
    assert!(chain.steps[0].duration_ms.is_none());
    
    // Update duration
    engine.update_last_step_duration(&mut chain, 250);
    assert_eq!(chain.steps[0].duration_ms, Some(250));
    
    // Add another step and update its duration
    let _id = engine.add_step(&mut chain, ReActStepType::Action, "Action".to_string());
    engine.update_last_step_duration(&mut chain, 500);
    
    assert_eq!(chain.steps.len(), 2);
    assert_eq!(chain.steps[0].duration_ms, Some(250)); // First step unchanged
    assert_eq!(chain.steps[1].duration_ms, Some(500)); // Second step updated
}

#[tokio::test]
async fn test_tool_result_success_and_failure() {
    // Test successful tool result
    let success_result = ToolResult {
        success: true,
        data: json!({"message": "Success"}),
        message: "Tool executed successfully".to_string(),
        execution_time_ms: 150,
        error: None,
    };
    
    assert!(success_result.success);
    assert!(success_result.error.is_none());
    assert_eq!(success_result.execution_time_ms, 150);
    
    // Test failed tool result
    let failure_result = ToolResult {
        success: false,
        data: serde_json::Value::Null,
        message: "Tool execution failed".to_string(),
        execution_time_ms: 50,
        error: Some("Network timeout".to_string()),
    };
    
    assert!(!failure_result.success);
    assert!(failure_result.error.is_some());
    assert_eq!(failure_result.error.unwrap(), "Network timeout");
}

#[tokio::test]
async fn test_react_step_types_equality() {
    // Test that step types can be compared
    assert_eq!(ReActStepType::Thought, ReActStepType::Thought);
    assert_eq!(ReActStepType::Action, ReActStepType::Action);
    assert_eq!(ReActStepType::Observation, ReActStepType::Observation);
    assert_eq!(ReActStepType::FinalAnswer, ReActStepType::FinalAnswer);
    assert_eq!(ReActStepType::Error, ReActStepType::Error);
    
    assert_ne!(ReActStepType::Thought, ReActStepType::Action);
    assert_ne!(ReActStepType::Action, ReActStepType::Observation);
}

#[tokio::test]
async fn test_observation_prompt_generation() {
    let engine = ReActEngine::new();
    let previous_steps = vec![];
    
    let tool_result = ToolResult {
        success: true,
        data: json!({"result": "success"}),
        message: "Tool executed".to_string(),
        execution_time_ms: 100,
        error: None,
    };
    
    let obs_prompt = engine.generate_observation_prompt(
        "Test request",
        "get_tasks",
        &tool_result,
        &previous_steps,
    );
    
    assert!(!obs_prompt.is_empty());
    assert!(obs_prompt.contains("Test request"));
    assert!(obs_prompt.contains("get_tasks"));
    assert!(obs_prompt.contains("Success"));
}

#[tokio::test]
async fn test_final_answer_prompt_generation() {
    let engine = ReActEngine::new();
    let reasoning_steps = vec![
        ReActStep {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Thought,
            content: "I need to help the user".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(100),
            metadata: HashMap::new(),
        },
        ReActStep {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Action,
            content: "Action: get_tasks: {}".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(200),
            metadata: HashMap::new(),
        },
    ];
    
    let final_prompt = engine.generate_final_answer_prompt("Test request", &reasoning_steps);
    
    assert!(!final_prompt.is_empty());
    assert!(final_prompt.contains("Test request"));
}

// Empty tool registry for testing scenarios with no tools
struct EmptyToolRegistry;

impl EmptyToolRegistry {
    fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolRegistry for EmptyToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        _args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        Err(AIServiceError::internal_error(format!("No tools available: {}", tool_name)))
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec![]
    }

    fn has_tool(&self, _tool_name: &str) -> bool {
        false
    }
}