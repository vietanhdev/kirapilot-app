// Test for local model integration with ReAct engine
// This simulates how a local Gemma model might respond
// Run with: cargo test --test test_local_model_integration

use std::collections::HashMap;
use async_trait::async_trait;
use kirapilot_app_lib::ai::{
    AIResult, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
    ReActEngine, ToolRegistry
};

// Mock local model that simulates realistic Gemma responses
struct MockLocalModel;

#[async_trait]
impl LLMProvider for MockLocalModel {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        println!("\n=== LOCAL MODEL RECEIVED PROMPT ===");
        println!("{}", prompt);
        println!("===================================\n");

        let prompt_lower = prompt.to_lowercase();
        
        // Simulate how a well-trained model should respond with proper Action: format
        let response = if prompt_lower.contains("list tasks") || prompt_lower.contains("tasks for today") {
            // Proper model should use Action: format when tools are needed
            "Action: get_tasks: {}"
        } else if prompt_lower.contains("observation:") && prompt_lower.contains("found") {
            // After tool execution, provide a natural response
            "Answer: Based on the tasks I found, here's what you have for today:\n\n• Task 1: Complete project\n• Task 2: Review code\n• Task 3: Team meeting\n\nYou have 3 tasks scheduled."
        } else if prompt_lower.contains("create") && prompt_lower.contains("task") {
            // For task creation
            "Action: create_task: {\"title\": \"New Task\"}"
        } else {
            // Default response - no tools needed
            "Answer: I'm here to help you manage your tasks. What would you like to do?"
        };

        println!("=== LOCAL MODEL RESPONSE ===");
        println!("{}", response);
        println!("=============================\n");

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
            id: "local-model".to_string(),
            name: "Local LLM".to_string(),
            provider: "local".to_string(),
            version: None,
            max_context_length: Some(4096),
            metadata: {
                let mut map = HashMap::new();
                map.insert("provider_type".to_string(), serde_json::Value::String("local".to_string()));
                map.insert("model_path".to_string(), serde_json::Value::String("/path/to/model.gguf".to_string()));
                map
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

// Mock tool registry that simulates actual task operations
struct MockTaskRegistry;

#[async_trait]
impl ToolRegistry for MockTaskRegistry {
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
                // Simulate returning today's tasks
                let tasks = serde_json::json!({
                    "tasks": [
                        {
                            "id": "1",
                            "title": "Complete project",
                            "status": "pending",
                            "priority": 2,
                            "scheduled_date": "2024-01-15T09:00:00Z"
                        },
                        {
                            "id": "2", 
                            "title": "Review code",
                            "status": "in_progress",
                            "priority": 1,
                            "scheduled_date": "2024-01-15T14:00:00Z"
                        },
                        {
                            "id": "3",
                            "title": "Team meeting", 
                            "status": "pending",
                            "priority": 3,
                            "scheduled_date": "2024-01-15T15:00:00Z"
                        }
                    ],
                    "count": 3,
                    "message": "Found 3 tasks scheduled for today"
                });
                Ok(tasks)
            },
            "create_task" => {
                let title = args.get("title").and_then(|t| t.as_str()).unwrap_or("New Task");
                Ok(serde_json::json!({
                    "id": "new-task-123",
                    "title": title,
                    "status": "pending",
                    "priority": 1,
                    "message": format!("Created task: {}", title)
                }))
            },
            _ => {
                Ok(serde_json::Value::String(format!("Tool {} executed successfully", tool_name)))
            }
        }
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec!["get_tasks".to_string(), "create_task".to_string()]
    }

    fn has_tool(&self, tool_name: &str) -> bool {
        self.get_available_tools().contains(&tool_name.to_string())
    }
}

#[tokio::test]
async fn test_local_model_list_tasks_today() {
    println!("\n=== Testing Local Model with 'list tasks for today' ===");
    
    let engine = ReActEngine::new();
    let provider = MockLocalModel;
    let tool_registry = MockTaskRegistry;

    let result = engine.process_request(
        "list tasks for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;

    assert!(result.is_ok(), "ReAct execution should succeed");
    let chain = result.unwrap();

    println!("=== CHAIN RESULTS ===");
    println!("User request: {}", chain.user_request);
    println!("Completed: {}", chain.completed);
    println!("Iterations: {}", chain.iterations);
    println!("Steps count: {}", chain.steps.len());
    
    for (i, step) in chain.steps.iter().enumerate() {
        println!("Step {}: {:?}", i + 1, step.step_type);
        println!("  Content: {}", step.content);
        if let Some(tool_call) = &step.tool_call {
            println!("  Tool called: {} with args: {:?}", tool_call.name, tool_call.args);
        }
        if let Some(tool_result) = &step.tool_result {
            println!("  Tool result: success={}, message={}", tool_result.success, tool_result.message);
        }
    }
    
    println!("Final response: {}", chain.final_response);
    println!("=====================\n");

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
           "Final response should contain task information: {}", chain.final_response);

    println!("✅ Local model successfully processed task list request");
}

#[tokio::test]
async fn test_local_model_natural_language_responses() {
    println!("\n=== Testing Local Model with Natural Language ===");
    
    let engine = ReActEngine::new();
    let provider = MockLocalModel;
    let tool_registry = MockTaskRegistry;

    // Test various natural ways users might ask for tasks
    let test_cases = vec![
        "show me what I need to do today",
        "what's on my schedule for today",
        "what tasks do I have",
        "list my tasks",
    ];
    
    for request in test_cases {
        println!("\nTesting request: '{}'", request);
        
        let result = engine.process_request(
            request.to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;

        assert!(result.is_ok(), "Should succeed for: {}", request);
        let chain = result.unwrap();

        assert!(chain.completed, "Should complete for: {}", request);
        
        // Check if tool was called (either explicitly or inferred)
        let tool_was_called = chain.steps.iter().any(|step| {
            step.tool_call.as_ref().map_or(false, |call| call.name == "get_tasks")
        });
        
        // For task-related requests, we expect the tool to be called
        if request.contains("task") || request.contains("schedule") || request.contains("do today") {
            assert!(tool_was_called, "Tool should be called for task request: {}", request);
        }
        
        println!("✓ Processed: {} (tool called: {})", request, tool_was_called);
    }
    
    println!("✅ All natural language requests processed correctly");
}

#[tokio::test]
async fn test_local_model_explicit_action_format_only() {
    println!("\n=== Testing Explicit Action Format Only (No Rule-Based Inference) ===");
    
    let engine = ReActEngine::new();
    
    // Test that only explicit "Action:" format is parsed - no rule-based inference
    let test_responses = vec![
        ("I need to get your tasks for today", None), // Natural language - no inference
        ("Let me check what tasks you have", None), // Natural language - no inference
        ("I'll show you your task list", None), // Natural language - no inference
        ("Let me create a new task for you", None), // Natural language - no inference
        ("I'll start the timer", None), // Natural language - no inference
        ("Action: get_tasks: {}", Some("get_tasks")), // Explicit format - should work
        ("Action: create_task: {\"title\": \"Test\"}", Some("create_task")), // Explicit format - should work
        ("Just a regular response", None), // Regular text - no inference
    ];
    
    for (response, expected_tool) in test_responses {
        let parsed = engine.parse_action_line(response);
        
        match (parsed, expected_tool) {
            (Some(tool_call), Some(expected)) => {
                assert_eq!(tool_call.name, expected, "Should parse '{}' from explicit format: {}", expected, response);
                println!("✓ Parsed '{}' from explicit format: {}", tool_call.name, response);
            },
            (None, None) => {
                println!("✓ Correctly ignored (no explicit Action:): {}", response);
            },
            (Some(tool_call), None) => {
                panic!("Should not parse tool from: {}, but got: {}", response, tool_call.name);
            },
            (None, Some(expected)) => {
                panic!("Should parse '{}' from explicit format: {}", expected, response);
            }
        }
    }
    
    println!("✅ Only explicit Action: format is parsed - no rule-based inference");
}

#[tokio::test]
async fn test_local_model_error_recovery() {
    println!("\n=== Testing Error Recovery ===");
    
    let engine = ReActEngine::new();
    let provider = MockLocalModel;
    let tool_registry = MockTaskRegistry;

    // Test with a request that might confuse the model
    let result = engine.process_request(
        "xyz random nonsense request".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;

    assert!(result.is_ok(), "Should handle confusing requests gracefully");
    let chain = result.unwrap();

    assert!(chain.completed, "Should complete even with confusing input");
    assert!(!chain.final_response.is_empty(), "Should have some response");
    
    println!("Final response for confusing input: {}", chain.final_response);
    println!("✅ Error recovery works correctly");
}