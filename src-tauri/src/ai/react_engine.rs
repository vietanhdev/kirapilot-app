use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::ai::{AIResult, AIServiceError, GenerationOptions, LLMProvider};

/// Trait for tool registry that can execute tools
#[async_trait::async_trait]
pub trait ToolRegistry: Send + Sync {
    /// Execute a tool with the given name and arguments
    async fn execute_tool(
        &self,
        tool_name: &str,
        args: &std::collections::HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value>;

    /// Get list of available tools
    fn get_available_tools(&self) -> Vec<String>;

    /// Check if a tool exists
    fn has_tool(&self, tool_name: &str) -> bool;
}

/// Maximum number of ReAct iterations to prevent infinite loops
const DEFAULT_MAX_ITERATIONS: u32 = 10;

/// ReAct engine that implements the Reasoning and Acting pattern
pub struct ReActEngine {
    /// Maximum number of iterations before termination
    max_iterations: u32,

    /// Template for generating thought prompts
    thought_prompt_template: String,

    /// Template for generating action prompts
    action_prompt_template: String,

    /// Template for generating observation prompts
    observation_prompt_template: String,

    /// Template for final answer generation
    final_answer_template: String,
}

/// Represents a single step in the ReAct reasoning process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReActStep {
    /// Unique identifier for this step
    pub id: String,

    /// Type of step (Thought, Action, Observation, etc.)
    pub step_type: ReActStepType,

    /// The content/text of this step
    pub content: String,

    /// Tool call information if this is an action step
    pub tool_call: Option<ToolCall>,

    /// Tool result if this step produced a result
    pub tool_result: Option<ToolResult>,

    /// Timestamp when this step was created
    pub timestamp: DateTime<Utc>,

    /// Duration this step took to complete (in milliseconds)
    pub duration_ms: Option<u64>,

    /// Additional metadata for this step
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Types of steps in the ReAct process
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ReActStepType {
    /// Initial analysis and reasoning about the user's request
    Thought,

    /// Decision to take a specific action or use a tool
    Action,

    /// Observation of the results from an action
    Observation,

    /// Final answer to provide to the user
    FinalAnswer,

    /// Error occurred during processing
    Error,
}

/// Represents a tool call within a ReAct step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Name of the tool being called
    pub name: String,

    /// Arguments passed to the tool
    pub args: HashMap<String, serde_json::Value>,

    /// Unique identifier for this tool call
    pub id: String,
}

/// Result from executing a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Whether the tool execution was successful
    pub success: bool,

    /// Data returned by the tool
    pub data: serde_json::Value,

    /// Human-readable message about the result
    pub message: String,

    /// Time taken to execute the tool (in milliseconds)
    pub execution_time_ms: u64,

    /// Error information if the tool failed
    pub error: Option<String>,
}

/// Complete ReAct reasoning chain for a user request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReActChain {
    /// Unique identifier for this reasoning chain
    pub id: String,

    /// The original user request
    pub user_request: String,

    /// All steps in the reasoning process
    pub steps: Vec<ReActStep>,

    /// Final response to the user
    pub final_response: String,

    /// Whether the reasoning completed successfully
    pub completed: bool,

    /// Total number of iterations performed
    pub iterations: u32,

    /// Timestamp when reasoning started
    pub started_at: DateTime<Utc>,

    /// Timestamp when reasoning completed
    pub completed_at: Option<DateTime<Utc>>,

    /// Total time taken for the entire reasoning process
    pub total_duration_ms: Option<u64>,

    /// Additional metadata for the chain
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Configuration for the ReAct engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReActConfig {
    /// Maximum number of iterations
    pub max_iterations: u32,

    /// Whether to include reasoning steps in the final response
    pub include_reasoning_in_response: bool,

    /// Whether to log detailed step information
    pub detailed_logging: bool,

    /// Custom prompt templates
    pub prompt_templates: Option<ReActPromptTemplates>,
}

/// Custom prompt templates for ReAct steps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReActPromptTemplates {
    pub thought_template: Option<String>,
    pub action_template: Option<String>,
    pub observation_template: Option<String>,
    pub final_answer_template: Option<String>,
}

/// Debug information extracted from a ReAct reasoning chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReActDebugInfo {
    /// Chain identifier
    pub chain_id: String,

    /// Total number of iterations performed
    pub total_iterations: u32,

    /// Total number of steps in the chain
    pub total_steps: usize,

    /// Breakdown of steps by type
    pub step_breakdown: HashMap<ReActStepType, u32>,

    /// Total duration of the reasoning process
    pub total_duration_ms: u64,

    /// Total time spent on tool executions
    pub total_tool_time_ms: u64,

    /// Number of successful tool executions
    pub successful_tools: usize,

    /// Number of failed tool executions
    pub failed_tools: usize,

    /// Completion status description
    pub completion_status: String,

    /// Quality score for the reasoning process (0-100)
    pub reasoning_quality_score: f64,
}

impl Default for ReActConfig {
    fn default() -> Self {
        Self {
            max_iterations: DEFAULT_MAX_ITERATIONS,
            include_reasoning_in_response: false,
            detailed_logging: true,
            prompt_templates: None,
        }
    }
}

impl ReActEngine {
    /// Create a new ReAct engine with default configuration
    pub fn new() -> Self {
        Self::with_config(ReActConfig::default())
    }

    /// Create a new ReAct engine with custom configuration
    pub fn with_config(config: ReActConfig) -> Self {
        let templates = config.prompt_templates.as_ref();

        Self {
            max_iterations: config.max_iterations,
            thought_prompt_template: templates
                .and_then(|t| t.thought_template.clone())
                .unwrap_or_else(|| Self::default_thought_template()),
            action_prompt_template: templates
                .and_then(|t| t.action_template.clone())
                .unwrap_or_else(|| Self::default_action_template()),
            observation_prompt_template: templates
                .and_then(|t| t.observation_template.clone())
                .unwrap_or_else(|| Self::default_observation_template()),
            final_answer_template: templates
                .and_then(|t| t.final_answer_template.clone())
                .unwrap_or_else(|| Self::default_final_answer_template()),
        }
    }

    /// Get the maximum number of iterations
    pub fn max_iterations(&self) -> u32 {
        self.max_iterations
    }

    /// Set the maximum number of iterations
    pub fn set_max_iterations(&mut self, max_iterations: u32) {
        self.max_iterations = max_iterations;
    }

    /// Create a new reasoning chain for a user request
    pub fn create_chain(&self, user_request: String) -> ReActChain {
        ReActChain {
            id: Uuid::new_v4().to_string(),
            user_request,
            steps: Vec::new(),
            final_response: String::new(),
            completed: false,
            iterations: 0,
            started_at: Utc::now(),
            completed_at: None,
            total_duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Add a step to the reasoning chain
    pub fn add_step(
        &self,
        chain: &mut ReActChain,
        step_type: ReActStepType,
        content: String,
    ) -> String {
        let step_id = Uuid::new_v4().to_string();
        let step = ReActStep {
            id: step_id.clone(),
            step_type,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        };

        chain.steps.push(step);
        step_id
    }

    /// Add a step with tool call information
    pub fn add_step_with_tool(
        &self,
        chain: &mut ReActChain,
        step_type: ReActStepType,
        content: String,
        tool_call: Option<ToolCall>,
        tool_result: Option<ToolResult>,
    ) -> String {
        let step_id = Uuid::new_v4().to_string();
        let step = ReActStep {
            id: step_id.clone(),
            step_type,
            content,
            tool_call,
            tool_result,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        };

        chain.steps.push(step);
        step_id
    }

    /// Update the duration of the last step in the chain
    pub fn update_last_step_duration(&self, chain: &mut ReActChain, duration_ms: u64) {
        if let Some(last_step) = chain.steps.last_mut() {
            last_step.duration_ms = Some(duration_ms);
        }
    }

    /// Mark the reasoning chain as completed
    pub fn complete_chain(&self, chain: &mut ReActChain, final_response: String) {
        chain.final_response = final_response;
        chain.completed = true;
        chain.completed_at = Some(Utc::now());

        if let Some(completed_at) = chain.completed_at {
            chain.total_duration_ms =
                Some((completed_at - chain.started_at).num_milliseconds() as u64);
        }
    }

    /// Generate a thought prompt for the current context
    pub fn generate_thought_prompt(
        &self,
        user_request: &str,
        previous_steps: &[ReActStep],
    ) -> String {
        let context = self.build_context_string(previous_steps);

        self.thought_prompt_template
            .replace("{user_request}", user_request)
            .replace("{context}", &context)
    }

    /// Generate an action prompt for the current context
    pub fn generate_action_prompt(
        &self,
        user_request: &str,
        current_thought: &str,
        previous_steps: &[ReActStep],
    ) -> String {
        let context = self.build_context_string(previous_steps);

        self.action_prompt_template
            .replace("{user_request}", user_request)
            .replace("{current_thought}", current_thought)
            .replace("{context}", &context)
    }

    /// Generate an action prompt with tool information
    pub fn generate_action_prompt_with_tools(
        &self,
        user_request: &str,
        current_thought: &str,
        previous_steps: &[ReActStep],
        available_tools: &[String],
    ) -> String {
        let context = self.build_context_string(previous_steps);
        let tools_list = if available_tools.is_empty() {
            "No tools available".to_string()
        } else {
            available_tools.join(", ")
        };

        let enhanced_template = format!(
            r#"Based on your analysis, decide what action to take to help the user.

User Request: {user_request}
Current Thought: {current_thought}

Previous Context:
{context}

Available Tools: {tools_list}

CRITICAL: To use a tool, you MUST respond with the EXACT format:
Tool: tool_name with args: {{"key": "value"}}

Tool Descriptions and Usage:
- create_task: Create a new task with title and optional description/priority
  Usage: Tool: create_task with args: {{"title": "Task title", "description": "Optional", "priority": 1}}
- get_tasks: List all existing tasks
  Usage: Tool: get_tasks with args: {{}}
- update_task: Modify an existing task (requires task ID)
  Usage: Tool: update_task with args: {{"id": "task_id", "title": "New title", "status": "completed"}}
- start_timer: Begin time tracking for a task
  Usage: Tool: start_timer with args: {{"task_id": "optional_task_id"}}
- stop_timer: Stop the currently active timer
  Usage: Tool: stop_timer with args: {{}}
- timer_status: Check if any timer is currently running
  Usage: Tool: timer_status with args: {{}}
- productivity_analytics: Get productivity statistics and insights
  Usage: Tool: productivity_analytics with args: {{}}

IMPORTANT RULES:
1. If the user wants to create, list, update tasks or manage timers, you MUST use the appropriate tool
2. Use the EXACT format shown above - any deviation will cause the tool to not execute
3. For JSON args, use proper JSON format with double quotes
4. If no tool is needed for the request, provide a direct response

Analyze the user's request and decide: Do you need to use a tool? If yes, which one and with what arguments?

Your response:"#
        );

        enhanced_template
            .replace("{user_request}", user_request)
            .replace("{current_thought}", current_thought)
            .replace("{context}", &context)
            .replace("{tools_list}", &tools_list)
    }

    /// Generate an observation prompt for the current context
    pub fn generate_observation_prompt(
        &self,
        user_request: &str,
        action_taken: &str,
        tool_result: &ToolResult,
        previous_steps: &[ReActStep],
    ) -> String {
        let context = self.build_context_string(previous_steps);
        let result_summary = if tool_result.success {
            format!("Success: {}", tool_result.message)
        } else {
            format!(
                "Error: {}",
                tool_result.error.as_deref().unwrap_or("Unknown error")
            )
        };

        self.observation_prompt_template
            .replace("{user_request}", user_request)
            .replace("{action_taken}", action_taken)
            .replace("{tool_result}", &result_summary)
            .replace("{context}", &context)
    }

    /// Generate a final answer prompt
    pub fn generate_final_answer_prompt(
        &self,
        user_request: &str,
        reasoning_chain: &[ReActStep],
    ) -> String {
        let context = self.build_context_string(reasoning_chain);

        self.final_answer_template
            .replace("{user_request}", user_request)
            .replace("{reasoning_chain}", &context)
    }

    /// Process a user request using the ReAct pattern
    pub async fn process_request(
        &self,
        user_request: String,
        provider: &dyn LLMProvider,
        tool_registry: Option<&dyn ToolRegistry>,
        logger: Option<&crate::ai::InteractionLogger>,
    ) -> AIResult<ReActChain> {
        let mut chain = self.create_chain(user_request.clone());
        let start_time = std::time::Instant::now();

        // Simple ReAct loop: Question -> Thought/Action -> Observation -> Answer
        let mut next_prompt = self.create_initial_prompt(&user_request);
        let max_turns = 5; // Allow sufficient reasoning steps

        // Log to database only - no console spam
        log::info!("React chain initialized - User: '{}', Chain: {}, Max turns: {}", 
                   user_request, chain.id, max_turns);

        for turn in 1..=max_turns {
            chain.iterations = turn;

            // Log to structured logging only
            log::debug!("LLM request turn {} - prompt length: {} chars", turn, next_prompt.len());

            // Get LLM response
            let options = GenerationOptions::default();
            let llm_start_time = std::time::Instant::now();
            let llm_response = provider.generate(&next_prompt, &options).await?;
            let llm_duration = llm_start_time.elapsed().as_millis() as u64;

            // Log to structured logging only
            log::debug!("LLM response turn {} - length: {} chars, duration: {}ms", 
                       turn, llm_response.len(), llm_duration);

            // Log raw LLM interaction to database if logger is available
            if let Some(logger) = logger {
                let model_info = provider.get_model_info();
                let session_id = format!("react-{}", chain.id);
                if let Err(e) = logger.log_raw_llm_interaction(
                    session_id,
                    turn,
                    next_prompt.clone(),
                    llm_response.clone(),
                    model_info,
                    llm_duration,
                ).await {
                    eprintln!("Failed to log raw LLM interaction: {}", e);
                }
            }

            // Add LLM response as a step
            let step = ReActStep {
                id: uuid::Uuid::new_v4().to_string(),
                step_type: ReActStepType::Action,
                content: llm_response.clone(),
                tool_call: None,
                tool_result: None,
                timestamp: Utc::now(),
                duration_ms: Some(0),
                metadata: std::collections::HashMap::new(),
            };
            chain.steps.push(step);

            // Check if this is a tool action (Action: tool_name: args)
            log::debug!("Parsing action for turn {}", turn);
            let tool_call_result = self.parse_action_line(&llm_response);
            if let Some(ref call) = tool_call_result {
                log::info!("Tool call detected - tool: {}, args: {:?}", call.name, call.args);
            }

            if let Some(tool_call) = tool_call_result {
                // Execute the tool
                if let Some(registry) = tool_registry {
                    let tool_result = registry
                        .execute_tool(&tool_call.name, &tool_call.args)
                        .await;

                    let (observation, tool_result_struct) = match tool_result {
                        Ok(data) => {
                            let formatted = self.format_tool_result(&tool_call.name, &data);
                            let obs = format!("Observation: {}", formatted);
                            let result = ToolResult {
                                success: true,
                                message: "Success".to_string(),
                                data: data,
                                execution_time_ms: 0,
                                error: None,
                            };
                            (obs, result)
                        }
                        Err(e) => {
                            let obs =
                                format!("Observation: Error executing {}: {}", tool_call.name, e);
                            let result = ToolResult {
                                success: false,
                                message: format!("{}", e),
                                data: serde_json::Value::Null,
                                execution_time_ms: 0,
                                error: Some(format!("{}", e)),
                            };
                            (obs, result)
                        }
                    };

                    // Add observation step
                    let obs_step = ReActStep {
                        id: uuid::Uuid::new_v4().to_string(),
                        step_type: ReActStepType::Observation,
                        content: observation.clone(),
                        tool_call: Some(tool_call),
                        tool_result: Some(tool_result_struct.clone()),
                        timestamp: Utc::now(),
                        duration_ms: Some(0),
                        metadata: std::collections::HashMap::new(),
                    };
                    chain.steps.push(obs_step);

                    // For simple list requests, provide guidance for final answer
                    if tool_result_struct.success && 
                       (user_request.to_lowercase().contains("list") || 
                        user_request.to_lowercase().contains("show") ||
                        user_request.to_lowercase().contains("get")) &&
                       chain.steps.last().and_then(|s| s.tool_call.as_ref()).map(|tc| &tc.name) == Some(&"get_tasks".to_string()) {
                        next_prompt = format!("You successfully retrieved the task data. Now provide a helpful, organized response to the user's request: '{}'\n\nTask data:\n{}\n\nProvide your Answer:", 
                            user_request, observation);
                    } else {
                        // Continue with observation and request answer
                        next_prompt = format!("{}\n\nNow provide your Answer:", observation);
                    }
                } else {
                    next_prompt = "Observation: No tools available".to_string();
                }
            } else if llm_response.contains("Answer:") {
                // Found final answer
                log::info!("Completion detected - found 'Answer:' in response");
                chain.final_response = llm_response;
                chain.completed = true;
                break;
            } else if turn > 2 && !llm_response.contains("Action:") {
                // If we've done a few turns and no more actions, treat as final answer
                log::info!("Completion detected - turn {} > 2 and no 'Action:' found", turn);
                chain.final_response = llm_response;
                chain.completed = true;
                break;
            } else if turn >= max_turns {
                // Force completion if we've reached max turns
                log::info!("Completion detected - reached max turns ({})", max_turns);
                chain.final_response = if llm_response.trim().is_empty() {
                    "I apologize, but I couldn't complete your request. Please try again.".to_string()
                } else {
                    llm_response
                };
                chain.completed = true;
                break;
            } else {
                // Continue conversation
                log::debug!("Continuing conversation - turn {}", turn);
                next_prompt = llm_response;
            }
        }

        // If no answer was found, use the last response or generate one from tool results
        if !chain.completed {
            // Try to find the last successful tool result and generate a response from it
            let last_tool_result = chain.steps.iter().rev().find_map(|step| {
                step.tool_result.as_ref().filter(|result| result.success)
            });
            
            chain.final_response = if let Some(tool_result) = last_tool_result {
                // Generate a response based on the tool result
                if tool_result.message.contains("Found") && tool_result.message.contains("tasks") {
                    format!("Here are your tasks:\n\n{}", tool_result.message)
                } else {
                    tool_result.message.clone()
                }
            } else {
                chain
                    .steps
                    .last()
                    .map(|s| s.content.clone())
                    .filter(|content| !content.trim().is_empty())
                    .unwrap_or_else(|| "I couldn't complete the task.".to_string())
            };
            chain.completed = true;
        }
        
        // Ensure final response is not empty
        if chain.final_response.trim().is_empty() {
            chain.final_response = "I apologize, but I couldn't process your request properly. Please try again.".to_string();
        }

        // Complete the chain
        let total_duration = start_time.elapsed();
        chain.total_duration_ms = Some(total_duration.as_millis() as u64);
        chain.completed_at = Some(Utc::now());

        // Log the interaction
        if let Some(logger) = logger {
            let model_info = provider.get_model_info();
            let _ = logger.log_react_chain(&chain, model_info).await;
        }

        Ok(chain)
    }

    /// Create the initial prompt for the ReAct loop
    fn create_initial_prompt(&self, user_request: &str) -> String {
        let current_time = chrono::Utc::now();
        let current_date = current_time.format("%Y-%m-%d").to_string();
        let current_day = current_time.format("%A").to_string();
        
        let prompt = format!(
            r#"You are a helpful task management assistant. The user has asked: "{}"

Current Context:
- Date: {} ({})
- Time: {}

Your job is to help with this specific request. Follow this pattern:

1. Think about what the user needs
2. If you need to use a tool, use the format: Action: tool_name: args
3. If you have information to answer, use: Answer: your response

Available tools:
- get_tasks: List/show tasks (use empty args {{}})
- create_task: Create a new task (args: {{"title": "task name"}})
- update_task: Update an existing task (args: {{"id": "task_id", "title": "new title"}})
- start_timer: Start time tracking (use empty args {{}})
- stop_timer: Stop time tracking (use empty args {{}})
- timer_status: Check timer status (use empty args {{}})

IMPORTANT: 
- If they want to see/list/show tasks: Use get_tasks tool
- If they want to create/add a task: Use create_task tool
- Be direct and helpful
- Don't give generic responses like "I'm ready to help"

For the request: "{}", what should you do?"#,
            user_request,
            current_date,
            current_day,
            current_time.format("%H:%M UTC"),
            user_request
        );
        
        // Log to structured logging only
        log::debug!("Prompt generated for '{}' - length: {} chars, date: {}", 
                   user_request, prompt.len(), current_date);
        
        prompt
    }

    /// Parse an action line from LLM response (Action: tool_name: args)
    /// Only parses explicit "Action:" lines - no rule-based inference
    pub fn parse_action_line(&self, response: &str) -> Option<ToolCall> {
        // Only look for explicit "Action:" lines - let the LLM decide when to use tools
        for line in response.lines() {
            let line = line.trim();
            
            if line.starts_with("Action:") {
                let action_part = line.strip_prefix("Action:").unwrap().trim();
                
                // Handle different formats: "tool_name: args" or "tool_name with args: args"
                let (tool_name, args_str) = if let Some(colon_pos) = action_part.find(':') {
                    let tool_name = action_part[..colon_pos].trim();
                    let args_str = action_part[colon_pos + 1..].trim();
                    (tool_name, args_str)
                } else if action_part.contains(" with args:") {
                    // Handle "Tool: tool_name with args: {args}" format
                    if let Some(with_pos) = action_part.find(" with args:") {
                        let tool_name = action_part[..with_pos].trim();
                        let args_str = action_part[with_pos + 11..].trim(); // " with args:" is 11 chars
                        (tool_name, args_str)
                    } else {
                        (action_part, "")
                    }
                } else {
                    // Just tool name, no args
                    (action_part, "")
                };

                // Parse JSON args or create empty args
                let args = if args_str.is_empty() || args_str == "{}" {
                    std::collections::HashMap::new()
                } else {
                    match serde_json::from_str::<
                        std::collections::HashMap<String, serde_json::Value>,
                    >(args_str)
                    {
                        Ok(parsed) => parsed,
                        Err(_e) => {
                            // If JSON parsing fails, treat as simple string argument
                            let mut map = std::collections::HashMap::new();
                            map.insert(
                                "input".to_string(),
                                serde_json::Value::String(args_str.to_string()),
                            );
                            map
                        }
                    }
                };

                return Some(ToolCall::new(tool_name.to_string(), args));
            }
        }
        
        // No explicit Action: found - let the LLM decide, don't infer
        None
    }

    /// Format tool result for observation
    fn format_tool_result(&self, tool_name: &str, data: &serde_json::Value) -> String {
        match tool_name {
            "get_tasks" => {
                if let Some(tasks_array) = data.get("tasks").and_then(|t| t.as_array()) {
                    if tasks_array.is_empty() {
                        "No tasks found".to_string()
                    } else {
                        // Group tasks by status for better organization
                        let mut pending = Vec::new();
                        let mut in_progress = Vec::new();
                        let mut completed = Vec::new();

                        for task in tasks_array.iter().take(20) {
                            // Limit to first 20 tasks
                            if let Some(title) = task.get("title").and_then(|t| t.as_str()) {
                                let status = task
                                    .get("status")
                                    .and_then(|s| s.as_str())
                                    .unwrap_or("unknown");
                                let task_entry = format!("\"{}\"", title);

                                match status {
                                    "pending" => pending.push(task_entry),
                                    "in_progress" => in_progress.push(task_entry),
                                    "completed" => completed.push(task_entry),
                                    _ => pending.push(task_entry),
                                }
                            }
                        }

                        let mut result = format!("Found {} tasks", tasks_array.len());
                        if tasks_array.len() > 20 {
                            result.push_str(" (showing first 20)");
                        }
                        result.push_str(":\n\n");

                        if !pending.is_empty() {
                            result.push_str("**Pending:**\n");
                            for task in &pending {
                                result.push_str(&format!("• {}\n", task.trim_matches('"')));
                            }
                            result.push('\n');
                        }
                        if !in_progress.is_empty() {
                            result.push_str("**In Progress:**\n");
                            for task in &in_progress {
                                result.push_str(&format!("• {}\n", task.trim_matches('"')));
                            }
                            result.push('\n');
                        }
                        if !completed.is_empty() {
                            result.push_str("**Completed:**\n");
                            for task in &completed {
                                result.push_str(&format!("• {}\n", task.trim_matches('"')));
                            }
                        }

                        result
                    }
                } else {
                    format!("Tool result: {}", data)
                }
            }
            "create_task" => {
                if let Some(title) = data.get("title").and_then(|t| t.as_str()) {
                    format!("Created task: \"{}\"", title)
                } else {
                    "Task created successfully".to_string()
                }
            }
            "timer_status" => {
                if let Some(active) = data.get("active").and_then(|a| a.as_bool()) {
                    if active {
                        let task_title = data
                            .get("task_title")
                            .and_then(|t| t.as_str())
                            .unwrap_or("Unknown task");
                        format!("Timer is running for: \"{}\"", task_title)
                    } else {
                        "No timer is currently running".to_string()
                    }
                } else {
                    format!("Timer status: {}", data)
                }
            }
            _ => format!("Tool executed successfully: {}", data),
        }
    }

    /// Get tool description for a tool name
    fn get_tool_description(&self, tool_name: &str) -> &str {
        match tool_name {
            "get_tasks" => "List all tasks with optional filtering",
            "create_task" => "Create a new task with title and description",
            "update_task" => "Update an existing task",
            "start_timer" => "Start time tracking for a task",
            "stop_timer" => "Stop the currently running timer",
            "timer_status" => "Check if any timer is currently running",
            "productivity_analytics" => "Get productivity statistics and insights",
            _ => "Execute a tool action",
        }
    }

    /// Process a thought step in the ReAct loop
    async fn process_thought_step(
        &self,
        chain: &mut ReActChain,
        provider: &dyn LLMProvider,
        logger: Option<&crate::ai::InteractionLogger>,
    ) -> AIResult<()> {
        let step_start = std::time::Instant::now();

        // Generate thought prompt
        let prompt = self.generate_thought_prompt(&chain.user_request, &chain.steps);

        // Get LLM response
        let options = GenerationOptions::default();
        let thought_content = provider
            .generate(&prompt, &options)
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Failed to generate thought: {}", e)))?;

        // Add thought step to chain
        let _step_id = self.add_step(chain, ReActStepType::Thought, thought_content);

        // Update duration
        let duration = step_start.elapsed();
        self.update_last_step_duration(chain, duration.as_millis() as u64);

        // Log the step if logger is available
        if let Some(logger) = logger {
            if let Some(last_step) = chain.steps.last() {
                let model_info = provider.get_model_info();
                if let Err(e) = logger
                    .log_react_step(&chain.id, last_step, &model_info)
                    .await
                {
                    eprintln!("Failed to log ReAct step: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Process an action step in the ReAct loop
    async fn process_action_step(
        &self,
        chain: &mut ReActChain,
        provider: &dyn LLMProvider,
        tool_registry: Option<&dyn ToolRegistry>,
        logger: Option<&crate::ai::InteractionLogger>,
    ) -> AIResult<()> {
        let step_start = std::time::Instant::now();

        // Get the current thought
        let current_thought = chain
            .steps
            .iter()
            .rev()
            .find(|step| matches!(step.step_type, ReActStepType::Thought))
            .map(|step| step.content.as_str())
            .unwrap_or("No current thought available");

        // Generate action prompt with tool information
        let available_tools = if let Some(registry) = tool_registry {
            registry.get_available_tools()
        } else {
            vec![]
        };

        let prompt = self.generate_action_prompt_with_tools(
            &chain.user_request,
            current_thought,
            &chain.steps,
            &available_tools,
        );

        // Get LLM response for action decision
        let options = GenerationOptions::default();
        let action_content = provider
            .generate(&prompt, &options)
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Failed to generate action: {}", e)))?;

        // Log the LLM's action decision
        println!("\n=== LLM ACTION DECISION ===");
        println!("User Request: {}", chain.user_request);
        println!("LLM Response: {}", action_content);
        println!("===========================\n");

        // Parse action and potentially execute tool
        let (tool_call, tool_result) = if let Some(registry) = tool_registry {
            let result = self
                .parse_and_execute_tool(&action_content, registry, &chain.user_request)
                .await?;

            // Log tool parsing and execution results
            if let (Some(ref call), Some(ref result)) = result {
                println!("\n=== TOOL EXECUTION ===");
                println!("Tool Selected: {}", call.name);
                println!("Tool Args: {:?}", call.args);
                println!("Execution Success: {}", result.success);
                println!("Execution Time: {}ms", result.execution_time_ms);
                println!("Result Message: {}", result.message);
                if let Some(ref error) = result.error {
                    println!("Error: {}", error);
                }
                println!("======================\n");
            } else if result.0.is_none() {
                println!("\n=== NO TOOL DETECTED ===");
                println!("LLM Response did not contain a valid tool call");
                println!("Response: {}", action_content);
                println!("========================\n");
            }

            result
        } else {
            (None, None)
        };

        // Add action step to chain
        let _step_id = self.add_step_with_tool(
            chain,
            ReActStepType::Action,
            action_content,
            tool_call,
            tool_result,
        );

        // Update duration
        let duration = step_start.elapsed();
        self.update_last_step_duration(chain, duration.as_millis() as u64);

        // Log the step if logger is available
        if let Some(logger) = logger {
            if let Some(last_step) = chain.steps.last() {
                let model_info = provider.get_model_info();
                if let Err(e) = logger
                    .log_react_step(&chain.id, last_step, &model_info)
                    .await
                {
                    eprintln!("Failed to log ReAct step: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Process an observation step in the ReAct loop
    async fn process_observation_step(
        &self,
        chain: &mut ReActChain,
        provider: &dyn LLMProvider,
        logger: Option<&crate::ai::InteractionLogger>,
    ) -> AIResult<()> {
        let step_start = std::time::Instant::now();

        // Get the last action step
        let last_action = chain
            .steps
            .iter()
            .rev()
            .find(|step| matches!(step.step_type, ReActStepType::Action))
            .ok_or_else(|| {
                AIServiceError::internal_error("No action step found for observation")
            })?;

        // Generate observation prompt
        let prompt = if let Some(tool_result) = &last_action.tool_result {
            self.generate_observation_prompt(
                &chain.user_request,
                &last_action.content,
                tool_result,
                &chain.steps,
            )
        } else {
            // If no tool was executed, create a simple observation
            format!(
                "Observe the action taken: {}\n\nAnalyze whether this helps answer the user's request: {}",
                last_action.content,
                chain.user_request
            )
        };

        // Get LLM response
        let options = GenerationOptions::default();
        let observation_content = provider.generate(&prompt, &options).await.map_err(|e| {
            AIServiceError::llm_error(format!("Failed to generate observation: {}", e))
        })?;

        // Add observation step to chain
        let _step_id = self.add_step(chain, ReActStepType::Observation, observation_content);

        // Update duration
        let duration = step_start.elapsed();
        self.update_last_step_duration(chain, duration.as_millis() as u64);

        // Log the step if logger is available
        if let Some(logger) = logger {
            if let Some(last_step) = chain.steps.last() {
                let model_info = provider.get_model_info();
                if let Err(e) = logger
                    .log_react_step(&chain.id, last_step, &model_info)
                    .await
                {
                    eprintln!("Failed to log ReAct step: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Generate the final answer for the user
    async fn generate_final_answer(
        &self,
        chain: &mut ReActChain,
        provider: &dyn LLMProvider,
        logger: Option<&crate::ai::InteractionLogger>,
    ) -> AIResult<()> {
        let step_start = std::time::Instant::now();

        // Generate final answer prompt
        let prompt = self.generate_final_answer_prompt(&chain.user_request, &chain.steps);

        // Get LLM response
        let options = GenerationOptions::default();
        let final_content = provider.generate(&prompt, &options).await.map_err(|e| {
            AIServiceError::llm_error(format!("Failed to generate final answer: {}", e))
        })?;

        // Add final answer step to chain
        let _step_id = self.add_step(chain, ReActStepType::FinalAnswer, final_content.clone());

        // Update duration
        let duration = step_start.elapsed();
        self.update_last_step_duration(chain, duration.as_millis() as u64);

        // Log the step if logger is available
        if let Some(logger) = logger {
            if let Some(last_step) = chain.steps.last() {
                let model_info = provider.get_model_info();
                if let Err(e) = logger
                    .log_react_step(&chain.id, last_step, &model_info)
                    .await
                {
                    eprintln!("Failed to log ReAct step: {}", e);
                }
            }
        }

        // Set the final response
        chain.final_response = final_content;
        chain.completed = true;

        Ok(())
    }

    /// Parse action content and execute tool if needed
    async fn parse_and_execute_tool(
        &self,
        action_content: &str,
        tool_registry: &dyn ToolRegistry,
        user_request: &str,
    ) -> AIResult<(Option<ToolCall>, Option<ToolResult>)> {
        // Simple tool parsing - look for tool call patterns
        // This is a basic implementation that can be enhanced

        // Look for patterns like "use tool: tool_name with args: {...}"
        if let Some(mut tool_call) = self.parse_tool_call(action_content) {
            let execution_start = std::time::Instant::now();

            // Add user context to tool arguments for smart filtering
            if tool_call.name == "get_tasks" {
                tool_call.args.insert(
                    "user_message".to_string(),
                    serde_json::Value::String(user_request.to_string()),
                );
                tool_call.args.insert(
                    "current_time".to_string(),
                    serde_json::Value::String(chrono::Utc::now().to_rfc3339()),
                );
            }

            // Execute the tool
            match tool_registry
                .execute_tool(&tool_call.name, &tool_call.args)
                .await
            {
                Ok(result_data) => {
                    let execution_time = execution_start.elapsed().as_millis() as u64;
                    let tool_result = ToolResult::success(
                        result_data,
                        "Tool executed successfully".to_string(),
                        execution_time,
                    );
                    Ok((Some(tool_call), Some(tool_result)))
                }
                Err(e) => {
                    let execution_time = execution_start.elapsed().as_millis() as u64;
                    let tool_result = ToolResult::failure(
                        format!("Tool execution failed: {}", e),
                        execution_time,
                    );
                    Ok((Some(tool_call), Some(tool_result)))
                }
            }
        } else {
            // No tool call detected
            Ok((None, None))
        }
    }

    /// Parse tool call from action content
    fn parse_tool_call(&self, content: &str) -> Option<ToolCall> {
        // Enhanced parsing with better pattern matching
        let content_lower = content.to_lowercase();

        // Look for explicit tool call format: "Tool: tool_name with args: {...}"
        if let Some(explicit_call) = self.parse_explicit_tool_call(content) {
            return Some(explicit_call);
        }

        // Fallback to pattern matching for common requests
        if content_lower.contains("create task")
            || content_lower.contains("add task")
            || content_lower.contains("new task")
        {
            let mut args = std::collections::HashMap::new();
            // Try to extract task details from the content
            if let Some(title) = self.extract_task_title(content) {
                args.insert("title".to_string(), serde_json::Value::String(title));
            }
            return Some(ToolCall::new("create_task".to_string(), args));
        }

        if content_lower.contains("list tasks")
            || content_lower.contains("show tasks")
            || content_lower.contains("get tasks")
            || content_lower.contains("view tasks")
            || content_lower.contains("display tasks")
        {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("get_tasks".to_string(), args));
        }

        if content_lower.contains("update task")
            || content_lower.contains("modify task")
            || content_lower.contains("edit task")
            || content_lower.contains("change task")
        {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("update_task".to_string(), args));
        }

        if content_lower.contains("start timer")
            || content_lower.contains("begin timer")
            || content_lower.contains("start tracking")
        {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("start_timer".to_string(), args));
        }

        if content_lower.contains("stop timer")
            || content_lower.contains("end timer")
            || content_lower.contains("stop tracking")
        {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("stop_timer".to_string(), args));
        }

        if content_lower.contains("timer status") || content_lower.contains("check timer") {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("timer_status".to_string(), args));
        }

        if content_lower.contains("productivity")
            || content_lower.contains("analytics")
            || content_lower.contains("stats")
            || content_lower.contains("metrics")
        {
            let args = std::collections::HashMap::new();
            return Some(ToolCall::new("productivity_analytics".to_string(), args));
        }

        None
    }

    /// Parse explicit tool call format: "Tool: tool_name with args: {...}"
    fn parse_explicit_tool_call(&self, content: &str) -> Option<ToolCall> {
        // Look for patterns like "Tool: get_tasks with args: {}"
        // Also handle variations like "tool:", "Tool :", etc.
        let content_lower = content.to_lowercase();

        // Find tool declaration with various formats
        let tool_patterns = ["tool:", "tool :", "use tool:", "execute tool:"];
        let mut tool_start_pos = None;
        let mut pattern_len = 0;

        for pattern in &tool_patterns {
            if let Some(pos) = content_lower.find(pattern) {
                tool_start_pos = Some(pos);
                pattern_len = pattern.len();
                break;
            }
        }

        if let Some(start_pos) = tool_start_pos {
            let after_tool = content[start_pos + pattern_len..].trim();

            // Look for "with args:" or just extract tool name and args
            if let Some(with_pos) = after_tool.to_lowercase().find("with args:") {
                let tool_name = after_tool[..with_pos].trim().to_string();
                let args_str = after_tool[with_pos + 10..].trim();

                // Try to parse JSON args with better error handling
                let args = self.parse_tool_args(args_str);

                return Some(ToolCall::new(tool_name, args));
            } else {
                // Try to extract tool name and look for JSON args in the rest
                let parts: Vec<&str> = after_tool.split_whitespace().collect();
                if !parts.is_empty() {
                    let tool_name = parts[0].to_string();

                    // Look for JSON in the remaining content
                    let remaining = after_tool[tool_name.len()..].trim();
                    let args = self.parse_tool_args(remaining);

                    return Some(ToolCall::new(tool_name, args));
                }
            }
        }
        None
    }

    /// Parse tool arguments from string, handling various JSON formats
    fn parse_tool_args(
        &self,
        args_str: &str,
    ) -> std::collections::HashMap<String, serde_json::Value> {
        if args_str.is_empty() {
            return std::collections::HashMap::new();
        }

        // Find JSON object in the string
        if let Some(start) = args_str.find('{') {
            if let Some(end) = args_str.rfind('}') {
                let json_str = &args_str[start..=end];

                // Try to parse as JSON
                if let Ok(parsed) = serde_json::from_str::<
                    std::collections::HashMap<String, serde_json::Value>,
                >(json_str)
                {
                    return parsed;
                }

                // If JSON parsing fails, try to fix common issues
                let fixed_json = self.fix_json_format(json_str);
                if let Ok(parsed) = serde_json::from_str::<
                    std::collections::HashMap<String, serde_json::Value>,
                >(&fixed_json)
                {
                    return parsed;
                }
            }
        }

        std::collections::HashMap::new()
    }

    /// Fix common JSON formatting issues
    fn fix_json_format(&self, json_str: &str) -> String {
        json_str
            .replace("'", "\"") // Replace single quotes with double quotes
            .replace("True", "true") // Fix boolean values
            .replace("False", "false")
            .replace("None", "null")
    }

    /// Extract task title from content
    fn extract_task_title(&self, content: &str) -> Option<String> {
        let content_lower = content.to_lowercase();

        // Look for patterns like "create task: title" or "add task 'title'"
        if let Some(colon_pos) = content_lower.find("task:") {
            let after_colon = content[colon_pos + 5..].trim();
            if !after_colon.is_empty() {
                return Some(after_colon.to_string());
            }
        }

        // Look for quoted titles
        if let Some(start_quote) = content.find('"') {
            if let Some(end_quote) = content[start_quote + 1..].find('"') {
                let title = &content[start_quote + 1..start_quote + 1 + end_quote];
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }

        None
    }

    /// Handle processing errors by adding error step to chain
    fn handle_processing_error(&self, chain: &mut ReActChain, error: AIServiceError) {
        let error_content = format!("Error occurred during processing: {}", error);
        self.add_step(chain, ReActStepType::Error, error_content);
        chain.completed = true;
        chain.final_response = format!(
            "I encountered an error while processing your request: {}",
            error
        );
    }

    /// Extract debugging information from a ReAct chain
    pub fn extract_debug_info(&self, chain: &ReActChain) -> ReActDebugInfo {
        let step_breakdown =
            chain
                .steps
                .iter()
                .fold(std::collections::HashMap::new(), |mut acc, step| {
                    let count = acc.entry(step.step_type.clone()).or_insert(0);
                    *count += 1;
                    acc
                });

        let total_tool_time = chain
            .steps
            .iter()
            .filter_map(|step| step.tool_result.as_ref())
            .map(|result| result.execution_time_ms)
            .sum();

        let successful_tools = chain
            .steps
            .iter()
            .filter(|step| {
                step.tool_result
                    .as_ref()
                    .map(|r| r.success)
                    .unwrap_or(false)
            })
            .count();

        let failed_tools = chain
            .steps
            .iter()
            .filter(|step| {
                step.tool_result
                    .as_ref()
                    .map(|r| !r.success)
                    .unwrap_or(false)
            })
            .count();

        ReActDebugInfo {
            chain_id: chain.id.clone(),
            total_iterations: chain.iterations,
            total_steps: chain.steps.len(),
            step_breakdown,
            total_duration_ms: chain.total_duration_ms.unwrap_or(0),
            total_tool_time_ms: total_tool_time,
            successful_tools,
            failed_tools,
            completion_status: if chain.completed {
                if chain
                    .steps
                    .iter()
                    .any(|s| matches!(s.step_type, ReActStepType::Error))
                {
                    "completed_with_errors".to_string()
                } else {
                    "completed_successfully".to_string()
                }
            } else {
                "incomplete".to_string()
            },
            reasoning_quality_score: self.calculate_reasoning_quality_score(chain),
        }
    }

    /// Calculate a quality score for the reasoning process
    fn calculate_reasoning_quality_score(&self, chain: &ReActChain) -> f64 {
        if chain.steps.is_empty() {
            return 0.0;
        }

        let mut score = 0.0;
        let max_score = 100.0;

        // Base score for completion
        if chain.completed {
            score += 30.0;
        }

        // Score for balanced step types
        let thought_steps = chain
            .steps
            .iter()
            .filter(|s| matches!(s.step_type, ReActStepType::Thought))
            .count();
        let action_steps = chain
            .steps
            .iter()
            .filter(|s| matches!(s.step_type, ReActStepType::Action))
            .count();
        let observation_steps = chain
            .steps
            .iter()
            .filter(|s| matches!(s.step_type, ReActStepType::Observation))
            .count();

        if thought_steps > 0 && action_steps > 0 && observation_steps > 0 {
            score += 20.0;
        }

        // Score for tool usage
        let tool_executions = chain.steps.iter().filter(|s| s.tool_call.is_some()).count();
        if tool_executions > 0 {
            score += 15.0;
        }

        // Score for successful tool executions
        let successful_tools = chain
            .steps
            .iter()
            .filter(|s| s.tool_result.as_ref().map(|r| r.success).unwrap_or(false))
            .count();

        if tool_executions > 0 {
            let success_rate = successful_tools as f64 / tool_executions as f64;
            score += success_rate * 15.0;
        }

        // Penalty for too many iterations (might indicate inefficiency)
        if chain.iterations > self.max_iterations / 2 {
            score -= 10.0;
        }

        // Score for reasonable response length
        if !chain.final_response.is_empty() && chain.final_response.len() > 10 {
            score += 10.0;
        }

        // Penalty for errors
        let error_steps = chain
            .steps
            .iter()
            .filter(|s| matches!(s.step_type, ReActStepType::Error))
            .count();
        score -= error_steps as f64 * 5.0;

        // Normalize to 0-100 range
        score.max(0.0).min(max_score)
    }

    /// Check if the reasoning should terminate based on the current state
    pub fn should_terminate(&self, chain: &ReActChain, last_step: &ReActStep) -> bool {
        // Terminate if we've reached max iterations
        if chain.iterations >= self.max_iterations {
            return true;
        }

        // Terminate if the last step is a final answer
        if matches!(last_step.step_type, ReActStepType::FinalAnswer) {
            return true;
        }

        // Terminate if there's an error
        if matches!(last_step.step_type, ReActStepType::Error) {
            return true;
        }

        // Check for completion indicators in the content
        let content_lower = last_step.content.to_lowercase();
        if content_lower.contains("task completed")
            || content_lower.contains("final answer")
            || content_lower.contains("done")
            || content_lower.contains("finished")
        {
            return true;
        }

        false
    }

    /// Build a context string from previous steps
    fn build_context_string(&self, steps: &[ReActStep]) -> String {
        if steps.is_empty() {
            return "No previous steps.".to_string();
        }

        let mut context = String::new();
        for (i, step) in steps.iter().enumerate() {
            context.push_str(&format!(
                "Step {}: {} - {}\n",
                i + 1,
                match step.step_type {
                    ReActStepType::Thought => "Thought",
                    ReActStepType::Action => "Action",
                    ReActStepType::Observation => "Observation",
                    ReActStepType::FinalAnswer => "Final Answer",
                    ReActStepType::Error => "Error",
                },
                step.content
            ));

            if let Some(tool_result) = &step.tool_result {
                context.push_str(&format!("  Result: {}\n", tool_result.message));
            }
        }

        context
    }

    /// Default thought prompt template
    fn default_thought_template() -> String {
        let current_time = chrono::Utc::now();
        let current_date = current_time.format("%Y-%m-%d").to_string();
        let current_day = current_time.format("%A").to_string();
        
        format!(r#"Think about what the user needs and decide on an action.

User Request: {{user_request}}
Current Date: {} ({})
Current Time: {}
Context: {{context}}

Available tools: get_tasks, create_task, update_task, start_timer, stop_timer, timer_status, productivity_analytics

IMPORTANT: Analyze the user's specific request:
- If asking about tasks (list, show, get, view, etc.): Use get_tasks tool
- If mentioning "today", "this week", etc.: The get_tasks tool will filter appropriately  
- If wanting to create/add tasks: Use create_task tool
- If about timers: Use appropriate timer tool

Format your response as:
Thought: [your reasoning]
Action: [tool_name]: [JSON arguments]
PAUSE

Or if you can answer directly:
Answer: [your response]"#,
            current_date,
            current_day,
            current_time.format("%H:%M UTC")
        )
    }

    /// Default action prompt template
    fn default_action_template() -> String {
        let current_time = chrono::Utc::now();
        let current_date = current_time.format("%Y-%m-%d").to_string();
        let current_day = current_time.format("%A").to_string();
        
        format!(r#"Continue helping the user with their request.

Previous thought: {{current_thought}}
Current date: {} ({})
Current time: {}
Context: {{context}}

Available tools: get_tasks, create_task, update_task, start_timer, stop_timer, timer_status

Guidelines:
- For task listing requests: Use get_tasks tool
- For task creation: Use create_task tool
- For timer requests: Use appropriate timer tool
- Be direct and helpful in your responses

Respond with either:
Action: [tool_name]: [JSON args]

Or:
Answer: [your response to the user]"#,
            current_date,
            current_day,
            current_time.format("%H:%M UTC")
        )
    }

    /// Default observation prompt template
    fn default_observation_template() -> String {
        r#"Observe and analyze the result of the action you just took.

User Request: {user_request}
Action Taken: {action_taken}
Tool Result: {tool_result}

Previous Context:
{context}

Analyze:
1. Did the action succeed?
2. What information did you learn?
3. Does this help answer the user's request?
4. Do you need to take additional actions?
5. Are you ready to provide a final answer?

Provide your observation and next steps:"#
            .to_string()
    }

    /// Default final answer template
    fn default_final_answer_template() -> String {
        let current_time = chrono::Utc::now();
        let current_date = current_time.format("%Y-%m-%d").to_string();
        let current_day = current_time.format("%A").to_string();
        
        format!(r#"Based on your analysis and actions, provide a helpful final answer to the user.

User Request: {{user_request}}
Current Date: {} ({})
Current Time: {}

Actions taken:
{{reasoning_chain}}

Guidelines:
- Give a direct, helpful response to the user's specific request
- If you retrieved tasks, present them in a clear, organized format
- Focus on what the user asked for
- Be concise but complete

Your response to the user:"#,
            current_date,
            current_day,
            current_time.format("%H:%M UTC")
        )
    }
}

impl Default for ReActEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl ReActStep {
    /// Create a new thought step
    pub fn thought(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Thought,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a new action step
    pub fn action(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Action,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a new observation step
    pub fn observation(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Observation,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a new final answer step
    pub fn final_answer(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::FinalAnswer,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a new error step
    pub fn error(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            step_type: ReActStepType::Error,
            content,
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }
}

impl ToolCall {
    /// Create a new tool call
    pub fn new(name: String, args: HashMap<String, serde_json::Value>) -> Self {
        Self {
            name,
            args,
            id: Uuid::new_v4().to_string(),
        }
    }
}

impl ToolResult {
    /// Create a successful tool result
    pub fn success(data: serde_json::Value, message: String, execution_time_ms: u64) -> Self {
        Self {
            success: true,
            data,
            message,
            execution_time_ms,
            error: None,
        }
    }

    /// Create a failed tool result
    pub fn failure(error: String, execution_time_ms: u64) -> Self {
        Self {
            success: false,
            data: serde_json::Value::Null,
            message: "Tool execution failed".to_string(),
            execution_time_ms,
            error: Some(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_react_engine_creation() {
        let engine = ReActEngine::new();
        assert_eq!(engine.max_iterations(), DEFAULT_MAX_ITERATIONS);
    }

    #[test]
    fn test_react_engine_with_config() {
        let config = ReActConfig {
            max_iterations: 5,
            ..Default::default()
        };
        let engine = ReActEngine::with_config(config);
        assert_eq!(engine.max_iterations(), 5);
    }

    #[test]
    fn test_create_chain() {
        let engine = ReActEngine::new();
        let chain = engine.create_chain("Test request".to_string());

        assert_eq!(chain.user_request, "Test request");
        assert_eq!(chain.steps.len(), 0);
        assert!(!chain.completed);
        assert_eq!(chain.iterations, 0);
    }

    #[test]
    fn test_add_step() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        let step_id = engine.add_step(
            &mut chain,
            ReActStepType::Thought,
            "Test thought".to_string(),
        );

        assert_eq!(chain.steps.len(), 1);
        assert_eq!(chain.steps[0].id, step_id);
        assert_eq!(chain.steps[0].step_type, ReActStepType::Thought);
        assert_eq!(chain.steps[0].content, "Test thought");
    }

    #[test]
    fn test_should_terminate() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        // Should not terminate with regular steps
        let step = ReActStep::thought("Regular thought".to_string());
        assert!(!engine.should_terminate(&chain, &step));

        // Should terminate with final answer
        let final_step = ReActStep::final_answer("Final answer".to_string());
        assert!(engine.should_terminate(&chain, &final_step));

        // Should terminate with error
        let error_step = ReActStep::error("Error occurred".to_string());
        assert!(engine.should_terminate(&chain, &error_step));

        // Should terminate when max iterations reached
        chain.iterations = DEFAULT_MAX_ITERATIONS;
        let regular_step = ReActStep::thought("Regular thought".to_string());
        assert!(engine.should_terminate(&chain, &regular_step));
    }

    #[test]
    fn test_complete_chain() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        engine.complete_chain(&mut chain, "Final response".to_string());

        assert!(chain.completed);
        assert_eq!(chain.final_response, "Final response");
        assert!(chain.completed_at.is_some());
        assert!(chain.total_duration_ms.is_some());
    }

    #[test]
    fn test_tool_result_creation() {
        let success_result = ToolResult::success(
            serde_json::json!({"key": "value"}),
            "Success message".to_string(),
            100,
        );

        assert!(success_result.success);
        assert_eq!(success_result.message, "Success message");
        assert_eq!(success_result.execution_time_ms, 100);
        assert!(success_result.error.is_none());

        let failure_result = ToolResult::failure("Error message".to_string(), 50);

        assert!(!failure_result.success);
        assert_eq!(failure_result.error, Some("Error message".to_string()));
        assert_eq!(failure_result.execution_time_ms, 50);
    }

    #[test]
    fn test_parse_tool_call() {
        let engine = ReActEngine::new();

        // Test task creation parsing
        let create_task_content = "I need to create a task for reviewing the code";
        let tool_call = engine.parse_tool_call(create_task_content);
        assert!(tool_call.is_some());
        let call = tool_call.unwrap();
        assert_eq!(call.name, "create_task");

        // Test task listing parsing
        let list_tasks_content = "Let me list all the current tasks";
        let tool_call = engine.parse_tool_call(list_tasks_content);
        assert!(tool_call.is_some());
        let call = tool_call.unwrap();
        assert_eq!(call.name, "list_tasks");

        // Test timer start parsing
        let start_timer_content = "I should start the timer now";
        let tool_call = engine.parse_tool_call(start_timer_content);
        assert!(tool_call.is_some());
        let call = tool_call.unwrap();
        assert_eq!(call.name, "start_timer");

        // Test no tool call
        let no_tool_content = "This is just a regular response";
        let tool_call = engine.parse_tool_call(no_tool_content);
        assert!(tool_call.is_none());
    }

    #[test]
    fn test_prompt_generation() {
        let engine = ReActEngine::new();
        let user_request = "Help me organize my tasks";
        let steps = vec![ReActStep::thought(
            "I need to understand what tasks the user has".to_string(),
        )];

        // Test thought prompt generation
        let thought_prompt = engine.generate_thought_prompt(user_request, &steps);
        assert!(thought_prompt.contains(user_request));
        assert!(thought_prompt.contains("Step 1: Thought"));

        // Test action prompt generation
        let action_prompt =
            engine.generate_action_prompt(user_request, "Current thought content", &steps);
        assert!(action_prompt.contains(user_request));
        assert!(action_prompt.contains("Current thought content"));

        // Test final answer prompt generation
        let final_prompt = engine.generate_final_answer_prompt(user_request, &steps);
        assert!(final_prompt.contains(user_request));
        assert!(final_prompt.contains("Step 1: Thought"));
    }

    #[test]
    fn test_termination_conditions() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        // Test completion keywords
        let completion_step = ReActStep::observation("The task completed successfully".to_string());
        assert!(engine.should_terminate(&chain, &completion_step));

        let final_answer_step = ReActStep::observation("Here is my final answer".to_string());
        assert!(engine.should_terminate(&chain, &final_answer_step));

        let done_step = ReActStep::observation("I'm done with this task".to_string());
        assert!(engine.should_terminate(&chain, &done_step));

        // Test max iterations
        chain.iterations = DEFAULT_MAX_ITERATIONS;
        let regular_step = ReActStep::thought("Regular thought".to_string());
        assert!(engine.should_terminate(&chain, &regular_step));
    }

    #[test]
    fn test_debug_info_extraction() {
        let engine = ReActEngine::new();
        let mut chain = engine.create_chain("Test request".to_string());

        // Add some steps to the chain
        engine.add_step(
            &mut chain,
            ReActStepType::Thought,
            "Initial thought".to_string(),
        );
        engine.add_step(&mut chain, ReActStepType::Action, "Take action".to_string());
        engine.add_step(
            &mut chain,
            ReActStepType::Observation,
            "Observe result".to_string(),
        );

        // Add a tool execution
        let tool_call = ToolCall::new("test_tool".to_string(), HashMap::new());
        let tool_result = ToolResult::success(
            serde_json::json!({"result": "success"}),
            "Tool executed successfully".to_string(),
            100,
        );
        engine.add_step_with_tool(
            &mut chain,
            ReActStepType::Action,
            "Execute tool".to_string(),
            Some(tool_call),
            Some(tool_result),
        );

        chain.iterations = 2;
        chain.completed = true;
        chain.total_duration_ms = Some(500);

        let debug_info = engine.extract_debug_info(&chain);

        assert_eq!(debug_info.chain_id, chain.id);
        assert_eq!(debug_info.total_iterations, 2);
        assert_eq!(debug_info.total_steps, 4);
        assert_eq!(debug_info.total_duration_ms, 500);
        assert_eq!(debug_info.successful_tools, 1);
        assert_eq!(debug_info.failed_tools, 0);
        assert_eq!(debug_info.completion_status, "completed_successfully");
        assert!(debug_info.reasoning_quality_score > 0.0);

        // Check step breakdown
        assert_eq!(
            debug_info.step_breakdown.get(&ReActStepType::Thought),
            Some(&1)
        );
        assert_eq!(
            debug_info.step_breakdown.get(&ReActStepType::Action),
            Some(&2)
        );
        assert_eq!(
            debug_info.step_breakdown.get(&ReActStepType::Observation),
            Some(&1)
        );
    }

    #[test]
    fn test_reasoning_quality_score() {
        let engine = ReActEngine::new();

        // Test empty chain
        let empty_chain = engine.create_chain("Test".to_string());
        let score = engine.calculate_reasoning_quality_score(&empty_chain);
        assert_eq!(score, 0.0);

        // Test completed chain with balanced steps
        let mut good_chain = engine.create_chain("Test".to_string());
        engine.add_step(
            &mut good_chain,
            ReActStepType::Thought,
            "Good thought".to_string(),
        );
        engine.add_step(
            &mut good_chain,
            ReActStepType::Action,
            "Good action".to_string(),
        );
        engine.add_step(
            &mut good_chain,
            ReActStepType::Observation,
            "Good observation".to_string(),
        );
        good_chain.completed = true;
        good_chain.final_response = "Good final response".to_string();
        good_chain.iterations = 1;

        let good_score = engine.calculate_reasoning_quality_score(&good_chain);
        assert!(good_score > 50.0);

        // Test chain with errors
        let mut error_chain = engine.create_chain("Test".to_string());
        engine.add_step(
            &mut error_chain,
            ReActStepType::Error,
            "Error occurred".to_string(),
        );
        error_chain.completed = true;

        let error_score = engine.calculate_reasoning_quality_score(&error_chain);
        assert!(error_score < good_score);
    }

    #[test]
    fn test_step_type_hash() {
        use std::collections::HashSet;

        let mut set = HashSet::new();
        set.insert(ReActStepType::Thought);
        set.insert(ReActStepType::Action);
        set.insert(ReActStepType::Observation);
        set.insert(ReActStepType::FinalAnswer);
        set.insert(ReActStepType::Error);

        assert_eq!(set.len(), 5);
        assert!(set.contains(&ReActStepType::Thought));
        assert!(set.contains(&ReActStepType::Action));
    }

    // Integration tests for the simplified ReAct system
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
            async fn generate(
                &self,
                _prompt: &str,
                _options: &GenerationOptions,
            ) -> AIResult<String> {
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

            async fn is_ready(&self) -> bool {
                true
            }

            async fn get_status(&self) -> crate::ai::ProviderStatus {
                crate::ai::ProviderStatus::Ready
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
                    Err(crate::ai::AIServiceError::internal_error(format!(
                        "Tool '{}' not found",
                        tool_name
                    )))
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

            let result = engine
                .process_request(
                    "list tasks".to_string(),
                    &provider,
                    Some(&tool_registry),
                    None,
                )
                .await;

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
        async fn test_no_lengthy_analysis() {
            // Test that we don't get lengthy project management analysis
            let engine = ReActEngine::new();

            let mock_responses = vec![
                "Thought: Getting tasks.\nAction: get_tasks: {}\nPAUSE".to_string(),
                "Answer: Your tasks:\n• Review code (pending)\n• Fix bug (in_progress)\n• Update docs (completed)".to_string(),
            ];

            let provider = MockLLMProvider::new(mock_responses);
            let tool_registry = MockToolRegistry::new();

            let result = engine
                .process_request(
                    "list tasks".to_string(),
                    &provider,
                    Some(&tool_registry),
                    None,
                )
                .await;

            assert!(result.is_ok());
            let chain = result.unwrap();

            // Verify NO lengthy analysis keywords
            let response = &chain.final_response;
            let analysis_keywords = [
                "project management",
                "recommendations",
                "analysis",
                "insights",
                "prioritization",
                "backlog",
                "methodology",
                "assessment",
                "optimization",
                "efficiency",
                "workflow",
                "bottlenecks",
            ];

            for keyword in &analysis_keywords {
                assert!(
                    !response.to_lowercase().contains(keyword),
                    "Response should not contain analysis keyword: {}",
                    keyword
                );
            }

            // Should be under 300 characters for a simple task list
            assert!(
                response.len() < 300,
                "Response too long: {} chars",
                response.len()
            );
        }

        #[tokio::test]
        async fn test_action_parsing() {
            // Test that action parsing works correctly
            let engine = ReActEngine::new();

            let test_cases = vec![
                ("Action: get_tasks: {}", Some("get_tasks")),
                (
                    "Action: create_task: {\"title\": \"Test\"}",
                    Some("create_task"),
                ),
                ("Thought: I need to think", None),
                ("Answer: Here's the answer", None),
            ];

            for (input, expected) in test_cases {
                let result = engine.parse_action_line(input);

                match expected {
                    Some(expected_tool) => {
                        assert!(result.is_some(), "Should parse action from: {}", input);
                        let tool_call = result.unwrap();
                        assert_eq!(tool_call.name, expected_tool);
                    }
                    None => {
                        assert!(result.is_none(), "Should not parse action from: {}", input);
                    }
                }
            }
        }
    }
}
