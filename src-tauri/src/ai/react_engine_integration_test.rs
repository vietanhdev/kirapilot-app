#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::ai::{AIResult, GenerationOptions, LLMProvider, ModelInfo};
    use async_trait::async_trait;
    use std::collections::HashMap;

    // Mock LLM Provider for testing
    struct MockLLMProvider {
        responses: Vec<String>,
        current_response: std::sync::Mutex<usize>,
    }

    impl MockLLMProvider {
        fn new(responses: Vec<String>) -> Self {
            Self {
                responses,
                current_response: std::sync::Mutex::new(0),
            }
        }
    }

    #[async_trait]
    impl LLMProvider for MockLLMProvider {
        async fn generate(&self, _prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
            let mut index = self.current_response.lock().unwrap();
            if *index < self.responses.len() {
                let response = self.responses[*index].clone();
                *index += 1;
                Ok(response)
            } else {
                Ok("No more responses".to_string())
            }
        }

        async fn initialize(&mut self) -> AIResult<()> {
            Ok(())
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

        fn is_available(&self) -> bool {
            true
        }
    }

    // Mock Tool Registry for testing
    struct MockToolRegistry {
        tools: HashMap<String, serde_json::Value>,
    }

    impl MockToolRegistry {
        fn new() -> Self {
            let mut tools = HashMap::new();
            
            // Mock get_tasks response
            let tasks_response = serde_json::json!({
                "tasks": [
                    {"title": "Review code", "status": "pending"},
                    {"title": "Update docs", "status": "completed"},
                    {"title": "Fix bug", "status": "in_progress"}
                ]
            });
            tools.insert("get_tasks".to_string(), tasks_response);
            
            // Mock create_task response
            let create_response = serde_json::json!({
                "title": "New Task",
                "id": "task-123"
            });
            tools.insert("create_task".to_string(), create_response);

            Self { tools }
        }
    }

    #[async_trait]
    impl ToolRegistry for MockToolRegistry {
        async fn execute_tool(
            &self,
            tool_name: &str,
            _args: &HashMap<String, serde_json::Value>,
        ) -> AIResult<serde_json::Value> {
            if let Some(response) = self.tools.get(tool_name) {
                Ok(response.clone())
            } else {
                Err(crate::ai::AIServiceError::internal_error(format!("Tool '{}' not found", tool_name)))
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
    async fn test_list_tasks_simple_response() {
        // Test that "list tasks" gives a simple, direct response
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
        
        // Verify the chain completed
        assert!(chain.completed);
        
        // Verify we got a simple response, not a lengthy analysis
        assert!(chain.final_response.contains("Here are your tasks"));
        assert!(chain.final_response.contains("Review code"));
        assert!(chain.final_response.contains("Update docs"));
        assert!(chain.final_response.contains("Fix bug"));
        
        // Verify it's NOT a lengthy analysis
        assert!(!chain.final_response.contains("project management"));
        assert!(!chain.final_response.contains("recommendations"));
        assert!(!chain.final_response.contains("analysis"));
        assert!(chain.final_response.len() < 500); // Should be concise
    }

    #[tokio::test]
    async fn test_create_task_simple_response() {
        // Test that "create task" gives a simple confirmation
        let engine = ReActEngine::new();
        
        let mock_responses = vec![
            "Thought: I need to create a new task.\nAction: create_task: {\"title\": \"Review PR\"}\nPAUSE".to_string(),
            "Answer: Created task: \"Review PR\"".to_string(),
        ];
        
        let provider = MockLLMProvider::new(mock_responses);
        let tool_registry = MockToolRegistry::new();
        
        let result = engine.process_request(
            "create task: Review PR".to_string(),
            &provider,
            Some(&tool_registry),
            None,
        ).await;
        
        assert!(result.is_ok());
        let chain = result.unwrap();
        
        // Verify simple, direct response
        assert!(chain.completed);
        assert!(chain.final_response.contains("Created task"));
        assert!(chain.final_response.len() < 200); // Should be very concise
    }

    #[tokio::test]
    async fn test_tool_execution_flow() {
        // Test the complete flow: Question -> Action -> Tool -> Observation -> Answer
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
        
        // Verify the flow
        assert_eq!(chain.steps.len(), 4); // Action -> Observation -> Action -> (final)
        
        // First step should be the action
        assert_eq!(chain.steps[0].step_type, ReActStepType::Action);
        assert!(chain.steps[0].content.contains("Action: get_tasks"));
        
        // Second step should be observation with tool result
        assert_eq!(chain.steps[1].step_type, ReActStepType::Observation);
        assert!(chain.steps[1].tool_result.is_some());
        assert!(chain.steps[1].tool_result.as_ref().unwrap().success);
        
        // Final response should be simple
        assert!(chain.final_response.contains("Answer:"));
        assert!(chain.completed);
    }

    #[tokio::test]
    async fn test_no_lengthy_analysis() {
        // Test that we don't get lengthy project management analysis
        let engine = ReActEngine::new();
        
        let mock_responses = vec![
            "Thought: Getting tasks.\nAction: get_tasks: {}\nPAUSE".to_string(),
            "Answer: Your tasks:\n• Review code (pending)\n• Fix bug (in_progress)\n• Update docs (completed)".to_string(),
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
        
        // Verify NO lengthy analysis keywords
        let response = &chain.final_response;
        let analysis_keywords = [
            "project management", "recommendations", "analysis", "insights",
            "prioritization", "backlog", "methodology", "assessment",
            "optimization", "efficiency", "workflow", "bottlenecks"
        ];
        
        for keyword in &analysis_keywords {
            assert!(!response.to_lowercase().contains(keyword), 
                   "Response should not contain analysis keyword: {}", keyword);
        }
        
        // Should be under 300 characters for a simple task list
        assert!(response.len() < 300, "Response too long: {} chars", response.len());
    }

    #[tokio::test]
    async fn test_action_parsing() {
        // Test that action parsing works correctly
        let engine = ReActEngine::new();
        
        let test_cases = vec![
            ("Action: get_tasks: {}", Some(("get_tasks", "{}"))),
            ("Action: create_task: {\"title\": \"Test\"}", Some(("create_task", "{\"title\": \"Test\"}"))),
            ("Thought: I need to think", None),
            ("Answer: Here's the answer", None),
        ];
        
        for (input, expected) in test_cases {
            let result = engine.parse_action_line(input);
            
            match expected {
                Some((expected_tool, expected_args)) => {
                    assert!(result.is_some(), "Should parse action from: {}", input);
                    let tool_call = result.unwrap();
                    assert_eq!(tool_call.name, expected_tool);
                    // Args parsing is more complex, just verify it's not empty
                    assert!(!tool_call.args.is_empty() || expected_args == "{}");
                },
                None => {
                    assert!(result.is_none(), "Should not parse action from: {}", input);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_max_iterations() {
        // Test that we don't get stuck in infinite loops
        let engine = ReActEngine::new();
        
        // Mock responses that don't contain "Answer:" to test max iterations
        let mock_responses = vec![
            "Thought: Thinking...".to_string(),
            "Thought: Still thinking...".to_string(),
            "Thought: More thinking...".to_string(),
            "Thought: Even more thinking...".to_string(),
            "Thought: Final thought...".to_string(),
            "Answer: Finally done".to_string(),
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
        assert!(chain.iterations <= 5); // Our max_turns is 5
    }
}