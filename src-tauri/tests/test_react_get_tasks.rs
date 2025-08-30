// Test for ReAct engine with get_tasks tool
// Run with: cargo test --test test_react_get_tasks

use std::collections::HashMap;
use async_trait::async_trait;
use kirapilot_app_lib::ai::{
    AIResult, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
    ReActEngine, ToolRegistry
};

// Mock LLM Provider that follows ReAct pattern
struct MockReActProvider;

#[async_trait]
impl LLMProvider for MockReActProvider {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        println!("\n=== MOCK LLM RECEIVED PROMPT ===");
        println!("{}", prompt);
        println!("================================\n");

        // Check if this is the initial prompt asking for tasks
        if prompt.contains("list tasks for today") || prompt.contains("tasks for today") {
            Ok("Thought: The user wants to see their tasks for today. I need to use the get_tasks tool.\nAction: get_tasks: {}".to_string())
        } else if prompt.contains("Found 3 tasks") {
            // This is after tool execution, provide final answer
            Ok("Answer: Here are your tasks for today:\n\n• Task 1: Complete project proposal\n• Task 2: Review code changes\n• Task 3: Team meeting at 2 PM".to_string())
        } else {
            // Default response
            Ok("Thought: I need to help the user.\nAction: get_tasks: {}".to_string())
        }
    }

    async fn is_ready(&self) -> bool {
        true
    }

    async fn get_status(&self) -> ProviderStatus {
        ProviderStatus::Ready
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: "mock-react-model".to_string(),
            name: "Mock ReAct Model".to_string(),
            provider: "test".to_string(),
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

// Mock tool registry that simulates get_tasks
struct MockGetTasksRegistry;

#[async_trait]
impl ToolRegistry for MockGetTasksRegistry {
    async fn execute_tool(
        &self, 
        tool_name: &str, 
        args: &std::collections::HashMap<String, serde_json::Value>
    ) -> AIResult<serde_json::Value> {
        println!("\n=== TOOL EXECUTION ===");
        println!("Tool: {}", tool_name);
        println!("Args: {:?}", args);
        println!("======================\n");

        match tool_name {
            "get_tasks" => {
                // Simulate returning tasks for today
                let tasks = serde_json::json!({
                    "tasks": [
                        {
                            "id": "1",
                            "title": "Complete project proposal",
                            "status": "pending",
                            "priority": 2,
                            "scheduled_date": "2024-01-15T09:00:00Z"
                        },
                        {
                            "id": "2", 
                            "title": "Review code changes",
                            "status": "in_progress",
                            "priority": 1,
                            "scheduled_date": "2024-01-15T14:00:00Z"
                        },
                        {
                            "id": "3",
                            "title": "Team meeting at 2 PM", 
                            "status": "pending",
                            "priority": 1,
                            "scheduled_date": "2024-01-15T14:00:00Z"
                        }
                    ],
                    "count": 3
                });
                Ok(tasks)
            },
            _ => {
                Ok(serde_json::Value::String(format!("Tool {} executed", tool_name)))
            }
        }
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec!["get_tasks".to_string()]
    }

    fn has_tool(&self, tool_name: &str) -> bool {
        tool_name == "get_tasks"
    }
}

#[tokio::test]
async fn test_react_engine_calls_get_tasks_tool() {
    println!("\n=== Testing ReAct Engine with get_tasks Tool ===");
    
    let engine = ReActEngine::new();
    let provider = MockReActProvider;
    let tool_registry = MockGetTasksRegistry;

    // Test the user request that should trigger get_tasks
    let user_request = "list tasks for today";
    
    let result = engine.process_request(
        user_request.to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;

    assert!(result.is_ok(), "ReAct execution should succeed");
    let chain = result.unwrap();

    println!("=== REACT CHAIN RESULTS ===");
    println!("User request: {}", chain.user_request);
    println!("Completed: {}", chain.completed);
    println!("Iterations: {}", chain.iterations);
    println!("Steps count: {}", chain.steps.len());
    
    for (i, step) in chain.steps.iter().enumerate() {
        println!("Step {}: {:?} - {}", i + 1, step.step_type, step.content);
        if let Some(tool_call) = &step.tool_call {
            println!("  Tool called: {} with args: {:?}", tool_call.name, tool_call.args);
        }
        if let Some(tool_result) = &step.tool_result {
            println!("  Tool result: success={}, message={}", tool_result.success, tool_result.message);
        }
    }
    
    println!("Final response: {}", chain.final_response);
    println!("===========================\n");

    // Verify the chain completed successfully
    assert!(chain.completed, "Chain should be completed");
    assert!(!chain.final_response.is_empty(), "Should have a final response");
    
    // Verify that get_tasks tool was called
    let tool_was_called = chain.steps.iter().any(|step| {
        step.tool_call.as_ref().map_or(false, |call| call.name == "get_tasks")
    });
    
    assert!(tool_was_called, "get_tasks tool should have been called");
    
    // Verify the final response contains task information
    let response_lower = chain.final_response.to_lowercase();
    assert!(response_lower.contains("task") || response_lower.contains("complete") || response_lower.contains("review"), 
           "Final response should contain task information");

    println!("✅ ReAct engine successfully called get_tasks tool");
}

#[tokio::test]
async fn test_react_engine_with_different_requests() {
    println!("\n=== Testing Different User Requests ===");
    
    let engine = ReActEngine::new();
    let provider = MockReActProvider;
    let tool_registry = MockGetTasksRegistry;

    let test_requests = vec![
        "list tasks for today",
        "show me my tasks",
        "what tasks do I have today",
        "tasks for today",
    ];
    
    for request in test_requests {
        println!("\nTesting request: '{}'", request);
        
        let result = engine.process_request(
            request.to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;

        assert!(result.is_ok(), "ReAct execution should succeed for: {}", request);
        let chain = result.unwrap();

        assert!(chain.completed, "Chain should be completed for: {}", request);
        assert!(!chain.final_response.is_empty(), "Should have a final response for: {}", request);
        
        // Verify that get_tasks tool was called
        let tool_was_called = chain.steps.iter().any(|step| {
            step.tool_call.as_ref().map_or(false, |call| call.name == "get_tasks")
        });
        
        assert!(tool_was_called, "get_tasks tool should have been called for: {}", request);
        println!("✓ Successfully processed: {}", request);
    }
    
    println!("✅ All request variations work correctly");
}