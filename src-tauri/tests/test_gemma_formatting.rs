// Test Gemma formatting with ReAct engine integration
// Run with: cargo test --test test_gemma_formatting

use std::collections::HashMap;
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

// Import the ReAct engine and Gemma provider
use kirapilot_app_lib::ai::react_engine::{
    ReActEngine, ToolRegistry
};
use kirapilot_app_lib::ai::{
    AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
    GemmaProvider
};
use async_trait::async_trait;

// Mock Gemma provider that simulates local Gemma responses with proper formatting
struct MockGemmaProvider {
    scenario: String,
}

impl MockGemmaProvider {
    fn new(scenario: &str) -> Self {
        Self {
            scenario: scenario.to_string(),
        }
    }

    fn generate_gemma_response(&self, raw_prompt: &str) -> String {
        // Create a temporary GemmaProvider to format the prompt
        let gemma_provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        // Format the prompt using Gemma formatting
        let formatted_prompt = gemma_provider.format_gemma_prompt(raw_prompt);
        
        // Log the formatted prompt to verify Gemma formatting
        println!("\n=== RECEIVED RAW PROMPT ===");
        println!("{}", raw_prompt);
        println!("\n=== GEMMA FORMATTED PROMPT ===");
        println!("{}", formatted_prompt);
        println!("=======================================\n");
        
        // Verify the prompt has proper Gemma formatting
        assert!(formatted_prompt.contains("<start_of_turn>user\n"));
        assert!(formatted_prompt.contains("<end_of_turn>\n<start_of_turn>model\n"));
        
        // Analyze the content to determine response
        let prompt_lower = formatted_prompt.to_lowercase();
        

        
        // Check for observation responses first (they take priority)
        let result = if prompt_lower.starts_with("observation:") || (prompt_lower.contains("observation:") && !prompt_lower.contains("example") && prompt_lower.contains("now provide your answer")) {
            // This is a follow-up after tool execution (but not the example in the prompt)

            
            if prompt_lower.contains("found") && prompt_lower.contains("tasks") {
                match self.scenario.as_str() {
                    "empty_tasks" => "Answer: You don't have any tasks scheduled for today. Your schedule is clear!".to_string(),
                    "multiple_tasks" => "Answer: Here are your tasks for today:\n\n**Pending:**\n• Review code\n• Write documentation\n• Team meeting\n\n**In Progress:**\n• Database optimization\n\nYou have 4 tasks total for today.".to_string(),
                    _ => "Answer: Here are your tasks for today:\n\n**Pending:**\n• Sample task\n\nYou have 1 task for today.".to_string(),
                }
            } else if prompt_lower.contains("created") || prompt_lower.contains("task-") {
                "Answer: Successfully created the task 'Hello World' for today. It's been added to your task list.".to_string()
            } else {
                "Answer: Task completed successfully.".to_string()
            }
        } else if prompt_lower.contains("create") && (prompt_lower.contains("hello world") || prompt_lower.contains("\"hello world\"")) {
            "Thought: I need to create a new task called 'Hello World' for today.\nAction: create_task: {\"title\": \"Hello World\", \"scheduled_date\": \"today\"}\nPAUSE".to_string()
        } else if prompt_lower.contains("list tasks") && prompt_lower.contains("today") {
            match self.scenario.as_str() {
                "empty_tasks" => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
                "multiple_tasks" => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
                _ => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
            }
        } else {
            "Answer: I'm ready to help you manage your tasks. What would you like to do?".to_string()
        };
        
        result
    }
}

#[async_trait]
impl LLMProvider for MockGemmaProvider {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        // This should receive a Gemma-formatted prompt
        let response = self.generate_gemma_response(prompt);
        Ok(response)
    }

    async fn is_ready(&self) -> bool {
        true
    }

    async fn get_status(&self) -> ProviderStatus {
        ProviderStatus::Ready
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: "gemma-7b".to_string(),
            name: "Gemma 7B".to_string(),
            provider: "gemma".to_string(),
            version: Some("1.0".to_string()),
            max_context_length: Some(8192),
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

// Simple tool registry for testing
struct SimpleToolRegistry {
    scenario: String,
}

impl SimpleToolRegistry {
    fn new(scenario: &str) -> Self {
        Self {
            scenario: scenario.to_string(),
        }
    }
}

#[async_trait]
impl ToolRegistry for SimpleToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        match tool_name {
            "get_tasks" => {
                match self.scenario.as_str() {
                    "empty_tasks" => Ok(json!({
                        "tasks": [],
                        "total": 0
                    })),
                    "multiple_tasks" => Ok(json!({
                        "tasks": [
                            {
                                "id": "task-1",
                                "title": "Review code",
                                "status": "pending",
                                "scheduled_date": "2024-01-15",
                                "priority": 2
                            },
                            {
                                "id": "task-2", 
                                "title": "Write documentation",
                                "status": "pending",
                                "scheduled_date": "2024-01-15",
                                "priority": 1
                            },
                            {
                                "id": "task-3",
                                "title": "Team meeting", 
                                "status": "pending",
                                "scheduled_date": "2024-01-15",
                                "priority": 3
                            },
                            {
                                "id": "task-4",
                                "title": "Database optimization",
                                "status": "in_progress", 
                                "scheduled_date": "2024-01-15",
                                "priority": 2
                            }
                        ],
                        "total": 4
                    })),
                    _ => Ok(json!({
                        "tasks": [
                            {
                                "id": "task-1",
                                "title": "Sample task",
                                "status": "pending", 
                                "scheduled_date": "2024-01-15",
                                "priority": 1
                            }
                        ],
                        "total": 1
                    }))
                }
            },
            "create_task" => {
                let title = args.get("title").and_then(|t| t.as_str()).unwrap_or("New Task");
                Ok(json!({
                    "id": format!("task-{}", Uuid::new_v4()),
                    "title": title,
                    "status": "pending",
                    "scheduled_date": "2024-01-15",
                    "priority": 1,
                    "created_at": Utc::now().to_rfc3339()
                }))
            },
            _ => Err(AIServiceError::internal_error(format!("Unknown tool: {}", tool_name)))
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
async fn test_gemma_formatting_simple_prompt() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test simple prompt formatting
    let simple_prompt = "Hello, how are you?";
    let formatted = provider.format_gemma_prompt(simple_prompt);
    
    println!("=== SIMPLE PROMPT TEST ===");
    println!("Original: {}", simple_prompt);
    println!("Formatted: {}", formatted);
    println!("==========================");
    
    assert_eq!(
        formatted,
        "<start_of_turn>user\nHello, how are you?<end_of_turn>\n<start_of_turn>model\n"
    );
}

#[tokio::test]
async fn test_gemma_formatting_with_system_instructions() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test system + user prompt formatting
    let complex_prompt = r#"You are a helpful task management assistant.

Question: List my tasks for today"#;
    
    let formatted = provider.format_gemma_prompt(complex_prompt);
    
    println!("=== SYSTEM + USER PROMPT TEST ===");
    println!("Original: {}", complex_prompt);
    println!("Formatted: {}", formatted);
    println!("==================================");
    
    assert!(formatted.contains("<start_of_turn>user\n"));
    assert!(formatted.contains("You are a helpful task management assistant."));
    assert!(formatted.contains("Question: List my tasks for today"));
    assert!(formatted.contains("<end_of_turn>\n<start_of_turn>model\n"));
}

#[tokio::test]
async fn test_gemma_formatting_with_react_engine() {
    let engine = ReActEngine::new();
    let provider = MockGemmaProvider::new("multiple_tasks");
    let tool_registry = SimpleToolRegistry::new("multiple_tasks");
    
    let result = engine.process_request(
        "List tasks for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    println!("=== REACT + GEMMA INTEGRATION TEST ===");
    println!("User Request: {}", chain.user_request);
    println!("Steps Count: {}", chain.steps.len());
    println!("Completed: {}", chain.completed);
    println!("Final Response: {}", chain.final_response);
    
    for (i, step) in chain.steps.iter().enumerate() {
        println!("Step {}: {:?} - {}", i + 1, step.step_type, step.content);
    }
    println!("======================================");
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("tasks for today"));
    assert!(chain.final_response.contains("Review code"));
    assert!(chain.final_response.contains("Write documentation"));
    
    // Verify tool was called
    let has_get_tasks_call = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "get_tasks")
            .unwrap_or(false)
    });
    assert!(has_get_tasks_call);
}

#[tokio::test]
async fn test_gemma_formatting_create_task() {
    let engine = ReActEngine::new();
    let provider = MockGemmaProvider::new("create_task");
    let tool_registry = SimpleToolRegistry::new("create_task");
    
    let result = engine.process_request(
        "Create a new task: \"Hello World\" for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    println!("=== CREATE TASK + GEMMA TEST ===");
    println!("User Request: {}", chain.user_request);
    println!("Final Response: {}", chain.final_response);
    println!("=================================");
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("created"));
    assert!(chain.final_response.contains("Hello World"));
    
    // Verify create_task tool was called
    let has_create_task_call = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "create_task" && 
                tc.args.get("title").and_then(|t| t.as_str()) == Some("Hello World"))
            .unwrap_or(false)
    });
    assert!(has_create_task_call);
}

#[tokio::test]
async fn test_gemma_response_parsing() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test response parsing
    let raw_response = "<start_of_turn>model\nHello! I'm doing well, thank you for asking.<end_of_turn>";
    let parsed = provider.parse_gemma_response(raw_response);
    
    println!("=== RESPONSE PARSING TEST ===");
    println!("Raw: {}", raw_response);
    println!("Parsed: {}", parsed);
    println!("==============================");
    
    assert_eq!(parsed, "Hello! I'm doing well, thank you for asking.");
}

#[tokio::test]
async fn test_gemma_extract_system_and_user() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test system/user extraction
    let prompt = "You are a helpful assistant.\n\nQuestion: What is 2+2?";
    let result = provider.extract_system_and_user(prompt);
    
    println!("=== SYSTEM/USER EXTRACTION TEST ===");
    println!("Original: {}", prompt);
    if let Some((system, user)) = &result {
        println!("System: {}", system);
        println!("User: {}", user);
    }
    println!("====================================");
    
    assert!(result.is_some());
    let (system, user) = result.unwrap();
    assert_eq!(system, "You are a helpful assistant.");
    assert_eq!(user, "Question: What is 2+2?");
}

#[tokio::test]
async fn test_gemma_react_prompt_extraction() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test ReAct-style prompt extraction
    let react_prompt = r#"You are a task management assistant. When users ask for tasks, provide a simple list.

Available tools: get_tasks, create_task, update_task

CRITICAL RULES:
1. For "list tasks" - use get_tasks tool, then provide a simple bullet list
2. Don't provide analysis, recommendations, or lengthy explanations

Format:
Thought: [what I need to do]
Action: [tool]: [args]

List my tasks"#;
    
    let formatted = provider.format_gemma_prompt(react_prompt);
    
    println!("=== REACT PROMPT EXTRACTION TEST ===");
    println!("Original length: {}", react_prompt.len());
    println!("Formatted: {}", formatted);
    println!("=====================================");
    
    assert!(formatted.contains("<start_of_turn>user\n"));
    assert!(formatted.contains("You are a task management assistant"));
    assert!(formatted.contains("Question: List my tasks"));
    assert!(formatted.contains("<end_of_turn>\n<start_of_turn>model\n"));
}

#[tokio::test]
async fn test_gemma_formatting_edge_cases() {
    let provider = GemmaProvider::new(
        "http://localhost:8080".to_string(),
        "gemma-7b".to_string(),
        None
    );
    
    // Test empty prompt
    let empty_formatted = provider.format_gemma_prompt("");
    assert_eq!(
        empty_formatted,
        "<start_of_turn>user\n<end_of_turn>\n<start_of_turn>model\n"
    );
    
    // Test whitespace-only prompt
    let whitespace_formatted = provider.format_gemma_prompt("   \n  \t  ");
    assert_eq!(
        whitespace_formatted,
        "<start_of_turn>user\n<end_of_turn>\n<start_of_turn>model\n"
    );
    
    // Test single word
    let single_word = provider.format_gemma_prompt("Hello");
    assert_eq!(
        single_word,
        "<start_of_turn>user\nHello<end_of_turn>\n<start_of_turn>model\n"
    );
    
    println!("=== EDGE CASES TEST ===");
    println!("Empty: {}", empty_formatted);
    println!("Whitespace: {}", whitespace_formatted);
    println!("Single word: {}", single_word);
    println!("=======================");
}