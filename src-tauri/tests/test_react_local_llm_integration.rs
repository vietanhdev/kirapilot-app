// Local LLM integration tests for ReAct engine with real task management scenarios
// Run with: cargo test --test test_react_local_llm_integration

use std::collections::HashMap;
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

// Import the ReAct engine and related types
use kirapilot_app_lib::ai::react_engine::{
    ReActEngine, ReActStepType, ToolRegistry
};
use kirapilot_app_lib::ai::{AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus};
use async_trait::async_trait;

// Realistic LLM Provider that simulates local LLM responses
struct RealisticLLMProvider {
    scenario: String,
}

impl RealisticLLMProvider {
    fn new(scenario: &str) -> Self {
        Self {
            scenario: scenario.to_string(),
        }
    }

    fn generate_realistic_response(&self, prompt: &str) -> String {
        // Analyze the prompt to determine what kind of response to generate
        let prompt_lower = prompt.to_lowercase();
        
        // Check if this is a follow-up prompt after tool execution (starts with "Observation:")
        if prompt_lower.trim_start().starts_with("observation:") {
            // This is a follow-up after tool execution
            if prompt_lower.contains("found") && prompt_lower.contains("tasks") {
                match self.scenario.as_str() {
                    "empty_tasks" => "Answer: You don't have any tasks scheduled for today. Your schedule is clear!".to_string(),
                    "multiple_tasks" => "Answer: Here are your tasks for today:\n\n**Pending:**\n• Review code\n• Write documentation\n• Team meeting\n\n**In Progress:**\n• Database optimization\n\nYou have 4 tasks total for today.".to_string(),
                    "count_tasks" => "Answer: You have 3 tasks scheduled for today.".to_string(),
                    _ => "Answer: Here are your tasks for today:\n\n**Pending:**\n• Sample task\n\nYou have 1 task for today.".to_string(),
                }
            } else if prompt_lower.contains("created") || prompt_lower.contains("hello world") {
                "Answer: Successfully created the task 'Hello World' for today. It's been added to your task list.".to_string()
            } else if prompt_lower.contains("productivity") || prompt_lower.contains("performance") {
                "Answer: Here's your performance summary for today:\n\n• **Tasks Completed:** 2 out of 5\n• **Time Focused:** 4.5 hours\n• **Productivity Score:** 75%\n• **Most Productive Time:** 9-11 AM\n\nYou're having a productive day! Keep up the good work.".to_string()
            } else if prompt_lower.contains("timer") || prompt_lower.contains("database optimization") {
                if self.scenario == "active_timer" {
                    "Answer: You're currently working on 'Database optimization'. The timer has been running for 45 minutes. Stay focused!".to_string()
                } else {
                    "Answer: No timer is currently running. You can start a timer for any task to track your work time.".to_string()
                }
            } else {
                "Answer: Task completed successfully.".to_string()
            }
        } else if prompt_lower.contains("create") && prompt_lower.contains("task") {
            if prompt_lower.contains("hello world") {
                "Thought: I need to create a new task called 'Hello World' for today.\nAction: create_task: {\"title\": \"Hello World\", \"scheduled_date\": \"today\"}\nPAUSE".to_string()
            } else if prompt_lower.contains("integration test") {
                "Thought: I need to create a new task called 'Integration Test' for today.\nAction: create_task: {\"title\": \"Integration Test\", \"scheduled_date\": \"today\"}\nPAUSE".to_string()
            } else {
                "Thought: I need to create a new task.\nAction: create_task: {\"title\": \"New Task\", \"scheduled_date\": \"today\"}\nPAUSE".to_string()
            }
        } else if prompt_lower.contains("list tasks") && prompt_lower.contains("today") {
            match self.scenario.as_str() {
                "empty_tasks" => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
                "multiple_tasks" => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
                _ => "Thought: I need to get today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string(),
            }
        } else if prompt_lower.contains("how many tasks") && prompt_lower.contains("today") {
            "Thought: I need to count today's tasks.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string()
        } else if prompt_lower.contains("complete all") && prompt_lower.contains("today") {
            "Thought: I need to mark all today's tasks as completed.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string()
        } else if prompt_lower.contains("performance") && prompt_lower.contains("today") {
            "Thought: I need to get productivity analytics for today.\nAction: productivity_analytics: {\"period\": \"today\"}\nPAUSE".to_string()
        } else if prompt_lower.contains("move all tasks") && prompt_lower.contains("tomorrow") {
            "Thought: I need to move today's tasks to tomorrow.\nAction: get_tasks: {\"filter\": \"today\"}\nPAUSE".to_string()
        } else if prompt_lower.contains("explain") && prompt_lower.contains("current task") {
            "Thought: I need to get the current active task.\nAction: timer_status: {}\nPAUSE".to_string()
        } else {
            // Default response for any other prompt
            "Answer: I'm ready to help you manage your tasks. What would you like to do?".to_string()
        }
    }
}

#[async_trait]
impl LLMProvider for RealisticLLMProvider {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        let response = self.generate_realistic_response(prompt);
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
            id: "local-llm".to_string(),
            name: "Local LLM".to_string(),
            provider: "local".to_string(),
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

// Realistic Tool Registry that simulates actual task management operations
struct RealisticToolRegistry {
    tasks: std::sync::Mutex<Vec<serde_json::Value>>,
    scenario: String,
}

impl RealisticToolRegistry {
    fn new(scenario: &str) -> Self {
        let mut tasks = Vec::new();
        
        // Initialize with different task sets based on scenario
        match scenario {
            "empty_tasks" => {
                // No tasks
            },
            "multiple_tasks" => {
                tasks.push(json!({
                    "id": "task-1",
                    "title": "Review code",
                    "status": "pending",
                    "scheduled_date": "2024-01-15",
                    "priority": 2
                }));
                tasks.push(json!({
                    "id": "task-2", 
                    "title": "Write documentation",
                    "status": "pending",
                    "scheduled_date": "2024-01-15",
                    "priority": 1
                }));
                tasks.push(json!({
                    "id": "task-3",
                    "title": "Team meeting", 
                    "status": "pending",
                    "scheduled_date": "2024-01-15",
                    "priority": 3
                }));
                tasks.push(json!({
                    "id": "task-4",
                    "title": "Database optimization",
                    "status": "in_progress", 
                    "scheduled_date": "2024-01-15",
                    "priority": 2
                }));
            },
            "count_tasks" => {
                for i in 1..=3 {
                    tasks.push(json!({
                        "id": format!("task-{}", i),
                        "title": format!("Task {}", i),
                        "status": "pending",
                        "scheduled_date": "2024-01-15",
                        "priority": 1
                    }));
                }
            },
            _ => {
                tasks.push(json!({
                    "id": "task-1",
                    "title": "Sample task",
                    "status": "pending", 
                    "scheduled_date": "2024-01-15",
                    "priority": 1
                }));
            }
        }
        
        Self {
            tasks: std::sync::Mutex::new(tasks),
            scenario: scenario.to_string(),
        }
    }
}

#[async_trait]
impl ToolRegistry for RealisticToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        match tool_name {
            "get_tasks" => {
                let tasks = self.tasks.lock().unwrap();
                let filter = args.get("filter").and_then(|f| f.as_str()).unwrap_or("all");
                
                let filtered_tasks: Vec<_> = if filter == "today" {
                    tasks.iter().filter(|task| {
                        task.get("scheduled_date")
                            .and_then(|d| d.as_str())
                            .map(|d| d == "2024-01-15") // Simulate "today"
                            .unwrap_or(false)
                    }).cloned().collect()
                } else {
                    tasks.clone()
                };
                
                Ok(json!({
                    "tasks": filtered_tasks,
                    "total": filtered_tasks.len()
                }))
            },
            "create_task" => {
                let mut tasks = self.tasks.lock().unwrap();
                let title = args.get("title").and_then(|t| t.as_str()).unwrap_or("New Task");
                let scheduled_date = args.get("scheduled_date").and_then(|d| d.as_str()).unwrap_or("2024-01-15");
                
                let new_task = json!({
                    "id": format!("task-{}", Uuid::new_v4()),
                    "title": title,
                    "status": "pending",
                    "scheduled_date": scheduled_date,
                    "priority": 1,
                    "created_at": Utc::now().to_rfc3339()
                });
                
                tasks.push(new_task.clone());
                Ok(new_task)
            },
            "update_task" => {
                let mut tasks = self.tasks.lock().unwrap();
                let task_id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                let new_status = args.get("status").and_then(|s| s.as_str());
                
                if let Some(task) = tasks.iter_mut().find(|t| t.get("id").and_then(|i| i.as_str()) == Some(task_id)) {
                    if let Some(status) = new_status {
                        task["status"] = json!(status);
                    }
                    Ok(task.clone())
                } else {
                    Err(AIServiceError::internal_error("Task not found".to_string()))
                }
            },
            "timer_status" => {
                match self.scenario.as_str() {
                    "active_timer" => Ok(json!({
                        "active": true,
                        "task_id": "task-4",
                        "task_title": "Database optimization",
                        "elapsed_minutes": 45
                    })),
                    _ => Ok(json!({
                        "active": false,
                        "task_id": null,
                        "task_title": null,
                        "elapsed_minutes": 0
                    }))
                }
            },
            "start_timer" => {
                let task_id = args.get("task_id").and_then(|i| i.as_str());
                Ok(json!({
                    "started": true,
                    "task_id": task_id,
                    "started_at": Utc::now().to_rfc3339()
                }))
            },
            "stop_timer" => {
                Ok(json!({
                    "stopped": true,
                    "elapsed_minutes": 30,
                    "stopped_at": Utc::now().to_rfc3339()
                }))
            },
            "productivity_analytics" => {
                let period = args.get("period").and_then(|p| p.as_str()).unwrap_or("today");
                Ok(json!({
                    "period": period,
                    "tasks_completed": 2,
                    "tasks_total": 5,
                    "time_focused_hours": 4.5,
                    "productivity_score": 75,
                    "most_productive_time": "9-11 AM",
                    "completion_rate": 40.0
                }))
            },
            _ => Err(AIServiceError::internal_error(format!("Unknown tool: {}", tool_name)))
        }
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec![
            "get_tasks".to_string(),
            "create_task".to_string(), 
            "update_task".to_string(),
            "timer_status".to_string(),
            "start_timer".to_string(),
            "stop_timer".to_string(),
            "productivity_analytics".to_string(),
        ]
    }

    fn has_tool(&self, tool_name: &str) -> bool {
        self.get_available_tools().contains(&tool_name.to_string())
    }
}

// Test scenarios for real-world task management

#[tokio::test]
async fn test_list_tasks_for_today_empty() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("empty_tasks");
    let tool_registry = RealisticToolRegistry::new("empty_tasks");
    
    let result = engine.process_request(
        "List tasks for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("don't have any tasks"));
    assert!(chain.final_response.contains("today"));
    
    // Verify tool was called
    let has_get_tasks_call = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "get_tasks")
            .unwrap_or(false)
    });
    assert!(has_get_tasks_call);
}

#[tokio::test]
async fn test_list_tasks_for_today_multiple() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("multiple_tasks");
    let tool_registry = RealisticToolRegistry::new("multiple_tasks");
    
    let result = engine.process_request(
        "List tasks for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("tasks for today"));
    assert!(chain.final_response.contains("Review code"));
    assert!(chain.final_response.contains("Write documentation"));
    assert!(chain.final_response.contains("Team meeting"));
    assert!(chain.final_response.contains("Database optimization"));
    assert!(chain.final_response.contains("4 tasks"));
}

#[tokio::test]
async fn test_how_many_tasks_today() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("count_tasks");
    let tool_registry = RealisticToolRegistry::new("count_tasks");
    
    let result = engine.process_request(
        "How many tasks do I have today?".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("3 tasks"));
    assert!(chain.final_response.contains("today"));
}

#[tokio::test]
async fn test_create_new_task_hello_world() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("create_task");
    let tool_registry = RealisticToolRegistry::new("create_task");
    
    let result = engine.process_request(
        "Create a new task: \"Hello World\" for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("created"));
    assert!(chain.final_response.contains("Hello World"));
    assert!(chain.final_response.contains("today"));
    
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
async fn test_complete_all_today_tasks() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("complete_tasks");
    let tool_registry = RealisticToolRegistry::new("multiple_tasks");
    
    let result = engine.process_request(
        "Complete all today's tasks".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    // Should first get tasks, then update them
    let has_get_tasks = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "get_tasks")
            .unwrap_or(false)
    });
    assert!(has_get_tasks);
}

#[tokio::test]
async fn test_performance_report_today() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("performance");
    let tool_registry = RealisticToolRegistry::new("performance");
    
    let result = engine.process_request(
        "How is my performance today (brief performance report)".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("performance"));
    assert!(chain.final_response.contains("Tasks Completed"));
    assert!(chain.final_response.contains("Time Focused"));
    assert!(chain.final_response.contains("Productivity Score"));
    assert!(chain.final_response.contains("75%"));
    
    // Verify productivity_analytics tool was called
    let has_analytics_call = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "productivity_analytics")
            .unwrap_or(false)
    });
    assert!(has_analytics_call);
}

#[tokio::test]
async fn test_move_all_tasks_to_tomorrow() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("move_tasks");
    let tool_registry = RealisticToolRegistry::new("multiple_tasks");
    
    let result = engine.process_request(
        "Move all tasks (today) to tomorrow".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    
    // Should first get today's tasks
    let has_get_tasks = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "get_tasks")
            .unwrap_or(false)
    });
    assert!(has_get_tasks);
}

#[tokio::test]
async fn test_explain_current_task_with_active_timer() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("active_timer");
    let tool_registry = RealisticToolRegistry::new("active_timer");
    
    let result = engine.process_request(
        "Explain the current task".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("Database optimization"));
    assert!(chain.final_response.contains("45 minutes"));
    assert!(chain.final_response.contains("running"));
    
    // Verify timer_status tool was called
    let has_timer_call = chain.steps.iter().any(|step| {
        step.tool_call.as_ref()
            .map(|tc| tc.name == "timer_status")
            .unwrap_or(false)
    });
    assert!(has_timer_call);
}

#[tokio::test]
async fn test_explain_current_task_no_active_timer() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("no_timer");
    let tool_registry = RealisticToolRegistry::new("no_timer");
    
    let result = engine.process_request(
        "Explain the current task".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    assert!(chain.completed);
    assert!(chain.final_response.contains("No timer"));
    assert!(chain.final_response.contains("not currently running"));
}

#[tokio::test]
async fn test_complex_workflow_sequence() {
    // Test a complex sequence: list tasks -> create task -> check performance
    let engine = ReActEngine::new();
    
    // Step 1: List tasks
    let provider1 = RealisticLLMProvider::new("multiple_tasks");
    let tool_registry1 = RealisticToolRegistry::new("multiple_tasks");
    
    let result1 = engine.process_request(
        "List tasks for today".to_string(),
        &provider1,
        Some(&tool_registry1),
        None,
    ).await;
    
    assert!(result1.is_ok());
    let chain1 = result1.unwrap();
    assert!(chain1.completed);
    assert!(chain1.final_response.contains("4 tasks"));
    
    // Step 2: Create new task
    let provider2 = RealisticLLMProvider::new("create_task");
    let tool_registry2 = RealisticToolRegistry::new("create_task");
    
    let result2 = engine.process_request(
        "Create a new task: \"Integration Test\" for today".to_string(),
        &provider2,
        Some(&tool_registry2),
        None,
    ).await;
    
    assert!(result2.is_ok());
    let chain2 = result2.unwrap();
    assert!(chain2.completed);
    assert!(chain2.final_response.contains("created"));
    
    // Step 3: Check performance
    let provider3 = RealisticLLMProvider::new("performance");
    let tool_registry3 = RealisticToolRegistry::new("performance");
    
    let result3 = engine.process_request(
        "How is my performance today?".to_string(),
        &provider3,
        Some(&tool_registry3),
        None,
    ).await;
    
    assert!(result3.is_ok());
    let chain3 = result3.unwrap();
    assert!(chain3.completed);
    assert!(chain3.final_response.contains("75%"));
}

#[tokio::test]
async fn test_error_handling_with_realistic_scenarios() {
    let engine = ReActEngine::new();
    let provider = RealisticLLMProvider::new("error_scenario");
    
    // Create a tool registry that will fail for certain operations
    let tool_registry = FailingToolRegistry::new();
    
    let result = engine.process_request(
        "List tasks for today".to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;
    
    assert!(result.is_ok());
    let chain = result.unwrap();
    
    // Should complete even with tool failures
    assert!(chain.completed);
    
    // Should have an observation step with error
    let has_error_observation = chain.steps.iter().any(|step| {
        step.step_type == ReActStepType::Observation &&
        step.tool_result.as_ref()
            .map(|tr| !tr.success)
            .unwrap_or(false)
    });
    assert!(has_error_observation);
}

// Tool registry that simulates failures
struct FailingToolRegistry;

impl FailingToolRegistry {
    fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolRegistry for FailingToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        _args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        Err(AIServiceError::internal_error(format!("Simulated failure for {}", tool_name)))
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec!["get_tasks".to_string(), "create_task".to_string()]
    }

    fn has_tool(&self, tool_name: &str) -> bool {
        self.get_available_tools().contains(&tool_name.to_string())
    }
}