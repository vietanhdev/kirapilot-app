use std::collections::HashMap;
use async_trait::async_trait;
use chrono::{DateTime, Utc, Timelike, Weekday, Duration, Datelike};

use crate::ai::{AIResult, AIServiceError};
use crate::ai::tool_registry::{
    Tool, ToolContext, ToolCapability, ToolExecutionResult, InferredParameters,
    ParameterDefinition, ParameterValidation, ToolExample, PermissionLevel,
};
use crate::database::repositories::{TimeTrackingRepository, TaskRepository};

/// Start timer tool with smart task detection
pub struct StartTimerTool {
    time_repo: TimeTrackingRepository,
    task_repo: TaskRepository,
}

impl StartTimerTool {
    pub fn new(time_repo: TimeTrackingRepository, task_repo: TaskRepository) -> Self {
        Self { time_repo, task_repo }
    }
    
    /// Infer which task to start timer for based on context
    async fn infer_task_id(&self, context: &ToolContext) -> AIResult<Option<String>> {
        let message_lower = context.user_message.to_lowercase();
        
        // Check if user mentioned a specific task
        if let Some(task_id) = self.extract_task_reference(&message_lower, context).await? {
            return Ok(Some(task_id));
        }
        
        // Use active task if available
        if let Some(active_task_id) = &context.active_task_id {
            return Ok(Some(active_task_id.clone()));
        }
        
        // Use most recent task from context
        if let Some(recent_task_id) = context.recent_task_ids.first() {
            return Ok(Some(recent_task_id.clone()));
        }
        
        // Find the most likely task to work on
        self.find_likely_task(context).await
    }
    
    async fn extract_task_reference(&self, message: &str, context: &ToolContext) -> AIResult<Option<String>> {
        // Look for explicit task references
        if message.contains("this task") || message.contains("current task") {
            if let Some(active_task_id) = &context.active_task_id {
                return Ok(Some(active_task_id.clone()));
            }
        }
        
        // Look for task titles mentioned in the message
        if message.contains("for") || message.contains("on") {
            let task_indicators = ["for", "on", "working on", "start timer for"];
            for indicator in &task_indicators {
                if let Some(pos) = message.find(indicator) {
                    let remaining = &message[pos + indicator.len()..].trim();
                    
                    // Try to match this with existing task titles
                    if let Ok(tasks) = self.task_repo.find_all(None, None).await {
                        for task in tasks {
                            let title_lower = task.title.to_lowercase();
                            if remaining.contains(&title_lower) || title_lower.contains(remaining) {
                                return Ok(Some(task.id));
                            }
                        }
                    }
                    break;
                }
            }
        }
        
        Ok(None)
    }
    
    async fn find_likely_task(&self, _context: &ToolContext) -> AIResult<Option<String>> {
        // Find the most recently created or updated task that's not completed
        match self.task_repo.find_all(None, None).await {
            Ok(tasks) => {
                let active_tasks: Vec<_> = tasks.into_iter()
                    .filter(|task| task.status != "completed" && task.status != "cancelled")
                    .collect();
                
                if let Some(task) = active_tasks.first() {
                    Ok(Some(task.id.clone()))
                } else {
                    Ok(None)
                }
            }
            Err(_) => Ok(None),
        }
    }
}

#[async_trait]
impl Tool for StartTimerTool {
    fn name(&self) -> &str {
        "start_timer"
    }
    
    fn description(&self) -> &str {
        "Start a timer session for tracking time spent on a task"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![
                ParameterDefinition {
                    name: "task_id".to_string(),
                    param_type: "string".to_string(),
                    description: "ID of the task to start timing (auto-detected if not provided)".to_string(),
                    default_value: None,
                    validation: None,
                    inference_sources: vec![
                        "active_task".to_string(),
                        "recent_tasks".to_string(),
                        "task_references".to_string(),
                        "task_titles".to_string(),
                    ],
                },
                ParameterDefinition {
                    name: "notes".to_string(),
                    param_type: "string".to_string(),
                    description: "Optional notes about what you'll be working on".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        max_length: Some(500),
                        ..Default::default()
                    }),
                    inference_sources: vec!["user_message".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::TimerControl],
            requires_confirmation: false,
            category: "Time Tracking".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Start timer".to_string(),
                    parameters: HashMap::new(), // Will auto-detect task
                    description: "Starts timer for the most likely task".to_string(),
                },
                ToolExample {
                    user_request: "Begin timing work on the quarterly report".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("notes".to_string(), serde_json::Value::String("work on the quarterly report".to_string()));
                        params
                    },
                    description: "Starts timer with inferred notes and task matching".to_string(),
                },
                ToolExample {
                    user_request: "Start timer for this task".to_string(),
                    parameters: HashMap::new(), // Will use active task from context
                    description: "Uses current active task from context".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let mut confidence = 0.7;
        let mut needs_confirmation = Vec::new();
        let mut alternatives = Vec::new();
        let mut explanations = Vec::new();
        
        // Try to infer task ID
        match self.infer_task_id(context).await? {
            Some(task_id) => {
                parameters.insert("task_id".to_string(), serde_json::Value::String(task_id.clone()));
                confidence += 0.2;
                explanations.push(format!("Auto-detected task: {}", task_id));
            }
            None => {
                needs_confirmation.push("task_id".to_string());
                explanations.push("No suitable task found for timer".to_string());
                confidence -= 0.3;
                
                // Suggest creating a new task
                let mut alt_params = HashMap::new();
                alt_params.insert("suggestion".to_string(), serde_json::Value::String("Create a new task first".to_string()));
                alternatives.push(alt_params);
            }
        }
        
        // Extract notes from user message
        let notes = self.extract_timer_notes(&context.user_message);
        if let Some(notes_text) = notes {
            parameters.insert("notes".to_string(), serde_json::Value::String(notes_text.clone()));
            confidence += 0.1;
            explanations.push(format!("Extracted notes: '{}'", notes_text));
        }
        
        Ok(InferredParameters {
            parameters,
            confidence,
            needs_confirmation,
            alternatives,
            explanation: explanations.join("; "),
        })
    }
    
    fn validate_parameters(&self, parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
        // Validate notes length if provided
        if let Some(notes) = parameters.get("notes") {
            if let Some(notes_str) = notes.as_str() {
                if notes_str.len() > 500 {
                    return Err(AIServiceError::validation_error("Notes too long (max 500 characters)"));
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        // Get task ID - either from parameters or infer it
        let task_id = if let Some(id) = parameters.get("task_id").and_then(|v| v.as_str()) {
            id.to_string()
        } else {
            // Try to infer task ID
            match self.infer_task_id(context).await? {
                Some(id) => id,
                None => {
                    return Ok(ToolExecutionResult {
                        success: false,
                        data: serde_json::Value::Null,
                        message: "❌ No task found to start timer for. Please specify a task or create one first.".to_string(),
                        execution_time_ms: start_time.elapsed().as_millis() as u64,
                        error: Some("No task available".to_string()),
                        suggestions: vec![
                            "Create a new task first".to_string(),
                            "Specify which task to time".to_string(),
                            "List your tasks to see available options".to_string(),
                        ],
                        metadata: HashMap::new(),
                    });
                }
            }
        };
        
        // Get notes if provided
        let notes = parameters.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());
        
        // Check if there's already an active timer
        match self.time_repo.find_any_active_session().await {
            Ok(Some(active_session)) => {
                // There's already an active timer
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                return Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("⏱️ Timer is already running for task {}. Stop the current timer first.", active_session.task_id),
                    execution_time_ms: execution_time,
                    error: Some("Timer already active".to_string()),
                    suggestions: vec![
                        "Stop the current timer first".to_string(),
                        "Switch to the running task".to_string(),
                        "Check timer status".to_string(),
                    ],
                    metadata: {
                        let mut meta = HashMap::new();
                        meta.insert("active_session_id".to_string(), serde_json::Value::String(active_session.id));
                        meta.insert("active_task_id".to_string(), serde_json::Value::String(active_session.task_id));
                        meta
                    },
                });
            }
            Ok(None) => {
                // No active timer, proceed to start new one
            }
            Err(e) => {
                return Err(AIServiceError::internal_error(format!("Failed to check active timer: {}", e)));
            }
        }
        
        // Start the timer session
        match self.time_repo.start_session(task_id.clone(), notes).await {
            Ok(session) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                // Get task title for better user message
                let task_title = match self.task_repo.find_by_id(&task_id).await {
                    Ok(Some(task)) => task.title,
                    _ => task_id.clone(),
                };
                
                let mut result_data = HashMap::new();
                result_data.insert("session_id".to_string(), serde_json::Value::String(session.id.clone()));
                result_data.insert("task_id".to_string(), serde_json::Value::String(task_id));
                result_data.insert("task_title".to_string(), serde_json::Value::String(task_title.clone()));
                result_data.insert("started_at".to_string(), serde_json::Value::String(session.start_time.to_rfc3339()));
                
                if let Some(notes_text) = &session.notes {
                    result_data.insert("notes".to_string(), serde_json::Value::String(notes_text.clone()));
                }
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: format!("⏱️ Timer started for: **{}**", task_title),
                    execution_time_ms: execution_time,
                    error: None,
                    suggestions: vec![
                        "Focus on your task now".to_string(),
                        "Stop the timer when you're done".to_string(),
                        "Add notes during your work session".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to start timer: {}", e),
                    execution_time_ms: execution_time,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Try again".to_string(),
                        "Check if the task exists".to_string(),
                        "Verify timer permissions".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}

impl StartTimerTool {
    fn extract_timer_notes(&self, message: &str) -> Option<String> {
        let message_lower = message.to_lowercase();
        
        // Look for note indicators
        let note_patterns = [
            "working on",
            "focusing on", 
            "doing",
            "for",
            "on",
            "notes:",
            "note:",
        ];
        
        for pattern in &note_patterns {
            if let Some(pos) = message_lower.find(pattern) {
                let remaining = message[pos + pattern.len()..].trim();
                if !remaining.is_empty() && remaining.len() > 3 {
                    // Clean up the notes
                    let cleaned = remaining
                        .split(&['.', '!', '?', '\n'][..])
                        .next()
                        .unwrap_or(remaining)
                        .trim();
                    
                    if !cleaned.is_empty() {
                        return Some(cleaned.to_string());
                    }
                }
            }
        }
        
        None
    }
}

/// Stop timer tool with automatic session detection
pub struct StopTimerTool {
    time_repo: TimeTrackingRepository,
    task_repo: TaskRepository,
}

impl StopTimerTool {
    pub fn new(time_repo: TimeTrackingRepository, task_repo: TaskRepository) -> Self {
        Self { time_repo, task_repo }
    }
    
    fn extract_session_notes(&self, message: &str) -> Option<String> {
        let message_lower = message.to_lowercase();
        
        // Look for note patterns when stopping timer
        let note_patterns = [
            "completed",
            "finished",
            "done with",
            "worked on",
            "accomplished",
            "notes:",
            "note:",
            "summary:",
        ];
        
        for pattern in &note_patterns {
            if let Some(pos) = message_lower.find(pattern) {
                let remaining = message[pos + pattern.len()..].trim();
                if !remaining.is_empty() && remaining.len() > 3 {
                    let cleaned = remaining
                        .split(&['.', '!', '?', '\n'][..])
                        .next()
                        .unwrap_or(remaining)
                        .trim();
                    
                    if !cleaned.is_empty() {
                        return Some(cleaned.to_string());
                    }
                }
            }
        }
        
        // If the message is short and doesn't contain timer keywords, use it as notes
        if message.len() < 100 && 
           !message_lower.contains("stop") && 
           !message_lower.contains("timer") &&
           !message_lower.contains("end") {
            return Some(message.trim().to_string());
        }
        
        None
    }
}

#[async_trait]
impl Tool for StopTimerTool {
    fn name(&self) -> &str {
        "stop_timer"
    }
    
    fn description(&self) -> &str {
        "Stop the current timer session and optionally add notes about the work completed"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![
                ParameterDefinition {
                    name: "notes".to_string(),
                    param_type: "string".to_string(),
                    description: "Notes about the work completed during this session".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        max_length: Some(1000),
                        ..Default::default()
                    }),
                    inference_sources: vec!["user_message".to_string(), "completion_notes".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::TimerControl],
            requires_confirmation: false,
            category: "Time Tracking".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Stop timer".to_string(),
                    parameters: HashMap::new(),
                    description: "Stops the current timer without notes".to_string(),
                },
                ToolExample {
                    user_request: "Stop timer - completed the first draft".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("notes".to_string(), serde_json::Value::String("completed the first draft".to_string()));
                        params
                    },
                    description: "Stops timer with inferred completion notes".to_string(),
                },
                ToolExample {
                    user_request: "End session, finished reviewing all documents".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("notes".to_string(), serde_json::Value::String("finished reviewing all documents".to_string()));
                        params
                    },
                    description: "Stops timer with detailed work summary".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let confidence = 0.8; // High confidence for stopping timer
        let needs_confirmation = Vec::new();
        let alternatives = Vec::new();
        let mut explanations = Vec::new();
        
        // Extract notes from user message
        if let Some(notes) = self.extract_session_notes(&context.user_message) {
            parameters.insert("notes".to_string(), serde_json::Value::String(notes.clone()));
            explanations.push(format!("Extracted session notes: '{}'", notes));
        } else {
            explanations.push("No session notes detected".to_string());
        }
        
        Ok(InferredParameters {
            parameters,
            confidence,
            needs_confirmation,
            alternatives,
            explanation: explanations.join("; "),
        })
    }
    
    fn validate_parameters(&self, parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
        // Validate notes length if provided
        if let Some(notes) = parameters.get("notes") {
            if let Some(notes_str) = notes.as_str() {
                if notes_str.len() > 1000 {
                    return Err(AIServiceError::validation_error("Notes too long (max 1000 characters)"));
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, _context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        // Get notes if provided
        let notes = parameters.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());
        
        // Find the active session
        match self.time_repo.find_any_active_session().await {
            Ok(Some(active_session)) => {
                // Stop the active session
                match self.time_repo.stop_session(&active_session.id, notes).await {
                    Ok(stopped_session) => {
                        let execution_time = start_time.elapsed().as_millis() as u64;
                        
                        // Get task title for better user message
                        let task_title = match self.task_repo.find_by_id(&stopped_session.task_id).await {
                            Ok(Some(task)) => task.title,
                            _ => stopped_session.task_id.clone(),
                        };
                        
                        // Calculate session duration
                        let duration_ms = if let Some(end_time) = stopped_session.end_time {
                            (end_time - stopped_session.start_time).num_milliseconds() as u64
                        } else {
                            0
                        };
                        let duration_minutes = duration_ms / (1000 * 60);
                        let hours = duration_minutes / 60;
                        let minutes = duration_minutes % 60;
                        
                        let duration_text = if hours > 0 {
                            format!("{}h {}m", hours, minutes)
                        } else {
                            format!("{}m", minutes)
                        };
                        
                        let mut result_data = HashMap::new();
                        result_data.insert("session_id".to_string(), serde_json::Value::String(stopped_session.id.clone()));
                        result_data.insert("task_id".to_string(), serde_json::Value::String(stopped_session.task_id.clone()));
                        result_data.insert("task_title".to_string(), serde_json::Value::String(task_title.clone()));
                        result_data.insert("duration_ms".to_string(), serde_json::Value::Number(serde_json::Number::from(duration_ms)));
                        result_data.insert("duration_text".to_string(), serde_json::Value::String(duration_text.clone()));
                        
                        if let Some(notes_text) = &stopped_session.notes {
                            result_data.insert("notes".to_string(), serde_json::Value::String(notes_text.clone()));
                        }
                        
                        let message = if let Some(session_notes) = &stopped_session.notes {
                            format!("⏹️ Timer stopped for **{}** ({})\n📝 Notes: {}", task_title, duration_text, session_notes)
                        } else {
                            format!("⏹️ Timer stopped for **{}** ({})", task_title, duration_text)
                        };
                        
                        Ok(ToolExecutionResult {
                            success: true,
                            data: serde_json::Value::Object(result_data.into_iter().collect()),
                            message,
                            execution_time_ms: execution_time,
                            error: None,
                            suggestions: vec![
                                "Great work! Take a break if needed".to_string(),
                                "Update task status if completed".to_string(),
                                "Start timer for your next task".to_string(),
                            ],
                            metadata: HashMap::new(),
                        })
                    }
                    Err(e) => {
                        let execution_time = start_time.elapsed().as_millis() as u64;
                        
                        Ok(ToolExecutionResult {
                            success: false,
                            data: serde_json::Value::Null,
                            message: format!("❌ Failed to stop timer: {}", e),
                            execution_time_ms: execution_time,
                            error: Some(e.to_string()),
                            suggestions: vec![
                                "Try again".to_string(),
                                "Check timer status".to_string(),
                            ],
                            metadata: HashMap::new(),
                        })
                    }
                }
            }
            Ok(None) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: "⏱️ No active timer found to stop.".to_string(),
                    execution_time_ms: execution_time,
                    error: Some("No active timer".to_string()),
                    suggestions: vec![
                        "Start a timer first".to_string(),
                        "Check if timer is already stopped".to_string(),
                        "View recent timer sessions".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to check timer status: {}", e),
                    execution_time_ms: execution_time,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Try again".to_string(),
                        "Check database connection".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}


/// Timer status tool with contextual information
pub struct TimerStatusTool {
    time_repo: TimeTrackingRepository,
    task_repo: TaskRepository,
}

impl TimerStatusTool {
    pub fn new(time_repo: TimeTrackingRepository, task_repo: TaskRepository) -> Self {
        Self { time_repo, task_repo }
    }
    
    async fn get_current_session_info(&self) -> AIResult<Option<SessionInfo>> {
        match self.time_repo.find_any_active_session().await {
            Ok(Some(session)) => {
                let task_title = match self.task_repo.find_by_id(&session.task_id).await {
                    Ok(Some(task)) => task.title,
                    _ => session.task_id.clone(),
                };
                
                let elapsed = (Utc::now() - session.start_time).num_minutes();
                
                Ok(Some(SessionInfo {
                    session_id: session.id,
                    task_id: session.task_id,
                    task_title,
                    started_at: session.start_time,
                    elapsed_minutes: elapsed,
                    notes: session.notes,
                }))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(AIServiceError::internal_error(format!("Failed to get session info: {}", e))),
        }
    }
}

#[derive(Debug, Clone)]
struct SessionInfo {
    session_id: String,
    task_id: String,
    task_title: String,
    started_at: DateTime<Utc>,
    elapsed_minutes: i64,
    notes: Option<String>,
}

#[async_trait]
impl Tool for TimerStatusTool {
    fn name(&self) -> &str {
        "timer_status"
    }
    
    fn description(&self) -> &str {
        "Get current timer status and session information"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![],
            required_permissions: vec![PermissionLevel::ReadOnly],
            requires_confirmation: false,
            category: "Time Tracking".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "What's my timer status?".to_string(),
                    parameters: HashMap::new(),
                    description: "Shows current timer status and elapsed time".to_string(),
                },
                ToolExample {
                    user_request: "How long have I been working?".to_string(),
                    parameters: HashMap::new(),
                    description: "Shows elapsed time for current session".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, _context: &ToolContext) -> AIResult<InferredParameters> {
        Ok(InferredParameters {
            parameters: HashMap::new(),
            confidence: 1.0,
            needs_confirmation: Vec::new(),
            alternatives: Vec::new(),
            explanation: "No parameters needed for timer status".to_string(),
        })
    }
    
    fn validate_parameters(&self, _parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
        Ok(())
    }
    
    async fn execute(&self, _parameters: HashMap<String, serde_json::Value>, _context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        match self.get_current_session_info().await? {
            Some(session) => {
                let hours = session.elapsed_minutes / 60;
                let minutes = session.elapsed_minutes % 60;
                
                let duration_text = if hours > 0 {
                    format!("{}h {}m", hours, minutes)
                } else {
                    format!("{}m", minutes)
                };
                
                let mut result_data = HashMap::new();
                result_data.insert("active".to_string(), serde_json::Value::Bool(true));
                result_data.insert("session_id".to_string(), serde_json::Value::String(session.session_id));
                result_data.insert("task_id".to_string(), serde_json::Value::String(session.task_id));
                result_data.insert("task_title".to_string(), serde_json::Value::String(session.task_title.clone()));
                result_data.insert("elapsed_minutes".to_string(), serde_json::Value::Number(serde_json::Number::from(session.elapsed_minutes)));
                result_data.insert("duration_text".to_string(), serde_json::Value::String(duration_text.clone()));
                result_data.insert("started_at".to_string(), serde_json::Value::String(session.started_at.to_rfc3339()));
                
                if let Some(notes) = &session.notes {
                    result_data.insert("notes".to_string(), serde_json::Value::String(notes.clone()));
                }
                
                let message = if let Some(notes) = &session.notes {
                    format!("⏱️ Timer running for **{}** ({})\n📝 Notes: {}", session.task_title, duration_text, notes)
                } else {
                    format!("⏱️ Timer running for **{}** ({})", session.task_title, duration_text)
                };
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message,
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    error: None,
                    suggestions: vec![
                        "Stop timer when done".to_string(),
                        "Add notes about your progress".to_string(),
                        "Take a break if you've been working long".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
            None => {
                let mut result_data = HashMap::new();
                result_data.insert("active".to_string(), serde_json::Value::Bool(false));
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: "⏱️ No timer currently running".to_string(),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    error: None,
                    suggestions: vec![
                        "Start a timer for your next task".to_string(),
                        "View your recent time tracking".to_string(),
                        "Check your productivity analytics".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}

/// Productivity analytics tool with intelligent insights
pub struct ProductivityAnalyticsTool {
    time_repo: TimeTrackingRepository,
    task_repo: TaskRepository,
}

impl ProductivityAnalyticsTool {
    pub fn new(time_repo: TimeTrackingRepository, task_repo: TaskRepository) -> Self {
        Self { time_repo, task_repo }
    }
    
    async fn analyze_productivity_patterns(&self, days: u32) -> AIResult<ProductivityAnalysis> {
        let end_date = Utc::now();
        let start_date = end_date - Duration::days(days as i64);
        
        let stats = self.time_repo.get_time_stats(start_date, end_date).await
            .map_err(|e| AIServiceError::internal_error(format!("Failed to get time stats: {}", e)))?;
        
        let sessions = self.time_repo.find_sessions_between(start_date, end_date).await
            .map_err(|e| AIServiceError::internal_error(format!("Failed to get sessions: {}", e)))?;
        
        // Analyze patterns
        let mut hourly_productivity = vec![0u64; 24];
        let mut daily_productivity = HashMap::new();
        let mut task_time_distribution = HashMap::new();
        
        for session in &sessions {
            if let Some(end_time) = session.end_time {
                let duration = (end_time - session.start_time).num_minutes();
                if duration > 0 {
                    // Hour analysis
                    let hour = session.start_time.hour() as usize;
                    if hour < 24 {
                        hourly_productivity[hour] += duration as u64;
                    }
                    
                    // Day analysis
                    let weekday = session.start_time.weekday();
                    *daily_productivity.entry(weekday).or_insert(0u64) += duration as u64;
                    
                    // Task analysis
                    *task_time_distribution.entry(session.task_id.clone()).or_insert(0u64) += duration as u64;
                }
            }
        }
        
        // Find peak hours
        let peak_hour = hourly_productivity
            .iter()
            .enumerate()
            .max_by_key(|(_, &time)| time)
            .map(|(hour, _)| hour as u32);
        
        // Find most productive day
        let most_productive_day = daily_productivity
            .iter()
            .max_by_key(|(_, &time)| time)
            .map(|(day, _)| *day);
        
        // Generate insights
        let mut insights = Vec::new();
        
        if let Some(hour) = peak_hour {
            if hourly_productivity[hour as usize] > 0 {
                let time_str = format!("{}:00", hour);
                insights.push(format!("Your most productive hour is around {}", time_str));
            }
        }
        
        if let Some(day) = most_productive_day {
            insights.push(format!("You're most productive on {:?}s", day));
        }
        
        if stats.average_session_minutes > 0.0 {
            if stats.average_session_minutes > 90.0 {
                insights.push("Your sessions are quite long - consider taking more breaks".to_string());
            } else if stats.average_session_minutes < 25.0 {
                insights.push("Your sessions are short - try focusing for longer periods".to_string());
            } else {
                insights.push("Your session length is well-balanced".to_string());
            }
        }
        
        if stats.average_productivity_score > 80.0 {
            insights.push("Great focus! You have minimal break time".to_string());
        } else if stats.average_productivity_score < 60.0 {
            insights.push("Consider reducing break time to improve focus".to_string());
        }
        
        Ok(ProductivityAnalysis {
            stats,
            peak_hour,
            most_productive_day,
            hourly_productivity,
            daily_productivity,
            task_time_distribution,
            insights,
        })
    }
    
    fn generate_suggestions(&self, analysis: &ProductivityAnalysis, context: &ToolContext) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        let current_hour = context.current_time.hour();
        let current_day = context.current_time.weekday();
        
        // Time-based suggestions
        if let Some(peak_hour) = analysis.peak_hour {
            if current_hour == peak_hour {
                suggestions.push("This is your peak productivity hour - great time to tackle important tasks!".to_string());
            } else if (current_hour as i32 - peak_hour as i32).abs() <= 1 {
                suggestions.push("You're approaching your peak productivity time".to_string());
            }
        }
        
        // Day-based suggestions
        if let Some(best_day) = analysis.most_productive_day {
            if current_day == best_day {
                suggestions.push("Today is typically your most productive day - make the most of it!".to_string());
            }
        }
        
        // Session length suggestions
        if analysis.stats.average_session_minutes > 0.0 {
            if analysis.stats.average_session_minutes > 120.0 {
                suggestions.push("Consider breaking long sessions into 90-minute chunks with breaks".to_string());
            } else if analysis.stats.average_session_minutes < 20.0 {
                suggestions.push("Try the Pomodoro technique: 25-minute focused sessions".to_string());
            }
        }
        
        // Activity suggestions
        if context.active_task_id.is_some() && context.active_timer_session_id.is_none() {
            suggestions.push("You have an active task but no timer running - start tracking your time!".to_string());
        }
        
        if suggestions.is_empty() {
            suggestions.push("Keep up the great work with your time tracking!".to_string());
        }
        
        suggestions
    }
}

#[derive(Debug, Clone)]
struct ProductivityAnalysis {
    stats: crate::database::repositories::time_tracking_repository::TimeStats,
    peak_hour: Option<u32>,
    most_productive_day: Option<Weekday>,
    hourly_productivity: Vec<u64>,
    daily_productivity: HashMap<Weekday, u64>,
    task_time_distribution: HashMap<String, u64>,
    insights: Vec<String>,
}

#[async_trait]
impl Tool for ProductivityAnalyticsTool {
    fn name(&self) -> &str {
        "productivity_analytics"
    }
    
    fn description(&self) -> &str {
        "Analyze productivity patterns and provide intelligent insights based on time tracking data"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![
                ParameterDefinition {
                    name: "days".to_string(),
                    param_type: "number".to_string(),
                    description: "Number of days to analyze (default: 7)".to_string(),
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(7))),
                    validation: Some(ParameterValidation {
                        min: Some(1.0),
                        max: Some(365.0),
                        ..Default::default()
                    }),
                    inference_sources: vec!["user_message".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::ReadOnly],
            requires_confirmation: false,
            category: "Analytics".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Show my productivity analytics".to_string(),
                    parameters: HashMap::new(),
                    description: "Shows 7-day productivity analysis".to_string(),
                },
                ToolExample {
                    user_request: "Analyze my productivity for the last 30 days".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("days".to_string(), serde_json::Value::Number(serde_json::Number::from(30)));
                        params
                    },
                    description: "Shows 30-day productivity analysis".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let mut confidence = 0.8;
        let mut explanations = Vec::new();
        
        // Try to extract time period from user message
        let message_lower = context.user_message.to_lowercase();
        
        if message_lower.contains("30 days") || message_lower.contains("month") {
            parameters.insert("days".to_string(), serde_json::Value::Number(serde_json::Number::from(30)));
            confidence += 0.1;
            explanations.push("Detected 30-day analysis request".to_string());
        } else if message_lower.contains("week") || message_lower.contains("7 days") {
            parameters.insert("days".to_string(), serde_json::Value::Number(serde_json::Number::from(7)));
            confidence += 0.1;
            explanations.push("Detected weekly analysis request".to_string());
        } else if message_lower.contains("today") {
            parameters.insert("days".to_string(), serde_json::Value::Number(serde_json::Number::from(1)));
            confidence += 0.1;
            explanations.push("Detected daily analysis request".to_string());
        } else {
            // Default to 7 days
            parameters.insert("days".to_string(), serde_json::Value::Number(serde_json::Number::from(7)));
            explanations.push("Using default 7-day analysis".to_string());
        }
        
        Ok(InferredParameters {
            parameters,
            confidence,
            needs_confirmation: Vec::new(),
            alternatives: Vec::new(),
            explanation: explanations.join("; "),
        })
    }
    
    fn validate_parameters(&self, parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
        if let Some(days) = parameters.get("days") {
            if let Some(days_num) = days.as_f64() {
                if days_num < 1.0 || days_num > 365.0 {
                    return Err(AIServiceError::validation_error("Days must be between 1 and 365"));
                }
            }
        }
        Ok(())
    }
    
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        let days = parameters.get("days")
            .and_then(|v| v.as_f64())
            .unwrap_or(7.0) as u32;
        
        match self.analyze_productivity_patterns(days).await {
            Ok(analysis) => {
                let suggestions = self.generate_suggestions(&analysis, context);
                
                let mut result_data = HashMap::new();
                result_data.insert("days_analyzed".to_string(), serde_json::Value::Number(serde_json::Number::from(days)));
                result_data.insert("total_sessions".to_string(), serde_json::Value::Number(serde_json::Number::from(analysis.stats.total_sessions)));
                result_data.insert("total_hours".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(analysis.stats.total_time_minutes as f64 / 60.0).unwrap_or(serde_json::Number::from(0))));
                result_data.insert("average_session_minutes".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(analysis.stats.average_session_minutes).unwrap_or(serde_json::Number::from(0))));
                result_data.insert("productivity_score".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(analysis.stats.average_productivity_score).unwrap_or(serde_json::Number::from(0))));
                
                if let Some(peak_hour) = analysis.peak_hour {
                    result_data.insert("peak_hour".to_string(), serde_json::Value::Number(serde_json::Number::from(peak_hour)));
                }
                
                if let Some(best_day) = analysis.most_productive_day {
                    result_data.insert("most_productive_day".to_string(), serde_json::Value::String(format!("{:?}", best_day)));
                }
                
                let total_hours = analysis.stats.total_time_minutes as f64 / 60.0;
                let avg_session = analysis.stats.average_session_minutes;
                
                let mut message_parts = vec![
                    format!("📊 **Productivity Analytics** (Last {} days)", days),
                    format!("⏱️ Total time: {:.1}h across {} sessions", total_hours, analysis.stats.total_sessions),
                ];
                
                if avg_session > 0.0 {
                    message_parts.push(format!("📈 Average session: {:.0} minutes", avg_session));
                }
                
                if analysis.stats.average_productivity_score > 0.0 {
                    message_parts.push(format!("🎯 Focus score: {:.0}%", analysis.stats.average_productivity_score));
                }
                
                if let Some(peak_hour) = analysis.peak_hour {
                    message_parts.push(format!("🌟 Peak hour: {}:00", peak_hour));
                }
                
                if !analysis.insights.is_empty() {
                    message_parts.push("💡 **Insights:**".to_string());
                    for insight in &analysis.insights {
                        message_parts.push(format!("• {}", insight));
                    }
                }
                
                result_data.insert("insights".to_string(), serde_json::Value::Array(
                    analysis.insights.into_iter().map(serde_json::Value::String).collect()
                ));
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: message_parts.join("\n"),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    error: None,
                    suggestions,
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to analyze productivity: {}", e),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Try again".to_string(),
                        "Check if you have time tracking data".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}

/// Smart session management tool that automatically detects work patterns
pub struct SmartSessionTool {
    time_repo: TimeTrackingRepository,
    task_repo: TaskRepository,
}

impl SmartSessionTool {
    pub fn new(time_repo: TimeTrackingRepository, task_repo: TaskRepository) -> Self {
        Self { time_repo, task_repo }
    }
    
    async fn detect_break_suggestion(&self, context: &ToolContext) -> AIResult<Option<String>> {
        if let Ok(Some(session)) = self.time_repo.find_any_active_session().await {
            let elapsed = (Utc::now() - session.start_time).num_minutes();
            
            // Suggest breaks based on common productivity techniques
            if elapsed >= 90 {
                return Ok(Some("You've been working for over 90 minutes. Consider taking a 15-20 minute break.".to_string()));
            } else if elapsed >= 50 {
                return Ok(Some("You've been focused for 50+ minutes. A short 5-10 minute break might help.".to_string()));
            } else if elapsed >= 25 {
                // Check if it's close to a Pomodoro break
                let current_hour = context.current_time.hour();
                if current_hour >= 14 && current_hour <= 16 {
                    return Ok(Some("Afternoon focus can be challenging. Consider a quick break to recharge.".to_string()));
                }
            }
        }
        
        Ok(None)
    }
    
    async fn suggest_next_task(&self, _context: &ToolContext) -> AIResult<Option<String>> {
        // Get recent tasks that aren't completed
        match self.task_repo.find_all(None, None).await {
            Ok(tasks) => {
                let active_tasks: Vec<_> = tasks.into_iter()
                    .filter(|task| task.status != "completed" && task.status != "cancelled")
                    .collect();
                
                if active_tasks.is_empty() {
                    return Ok(Some("No active tasks found. Consider creating a new task to work on.".to_string()));
                }
                
                // Suggest based on priority and recent activity
                if let Some(high_priority_task) = active_tasks.iter().find(|task| task.priority >= 2) {
                    return Ok(Some(format!("Consider working on high-priority task: '{}'", high_priority_task.title)));
                }
                
                // Suggest the first active task
                if let Some(task) = active_tasks.first() {
                    return Ok(Some(format!("You could work on: '{}'", task.title)));
                }
            }
            Err(_) => {}
        }
        
        Ok(None)
    }
}

#[async_trait]
impl Tool for SmartSessionTool {
    fn name(&self) -> &str {
        "smart_session_manager"
    }
    
    fn description(&self) -> &str {
        "Intelligent session management with automatic break suggestions and task recommendations"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![],
            required_permissions: vec![PermissionLevel::ReadOnly],
            requires_confirmation: false,
            category: "Session Management".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Should I take a break?".to_string(),
                    parameters: HashMap::new(),
                    description: "Analyzes current session and suggests breaks".to_string(),
                },
                ToolExample {
                    user_request: "What should I work on next?".to_string(),
                    parameters: HashMap::new(),
                    description: "Suggests next task based on priorities and patterns".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, _context: &ToolContext) -> AIResult<InferredParameters> {
        Ok(InferredParameters {
            parameters: HashMap::new(),
            confidence: 1.0,
            needs_confirmation: Vec::new(),
            alternatives: Vec::new(),
            explanation: "No parameters needed for session management".to_string(),
        })
    }
    
    fn validate_parameters(&self, _parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
        Ok(())
    }
    
    async fn execute(&self, _parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        let mut suggestions = Vec::new();
        let mut message_parts = Vec::new();
        let mut result_data = HashMap::new();
        
        // Check for break suggestions
        if let Ok(Some(break_suggestion)) = self.detect_break_suggestion(context).await {
            message_parts.push(format!("🛑 **Break Suggestion:** {}", break_suggestion));
            suggestions.push("Take a break".to_string());
            suggestions.push("Continue working if you're in flow".to_string());
            result_data.insert("break_suggested".to_string(), serde_json::Value::Bool(true));
            result_data.insert("break_reason".to_string(), serde_json::Value::String(break_suggestion));
        } else {
            result_data.insert("break_suggested".to_string(), serde_json::Value::Bool(false));
        }
        
        // Check for task suggestions
        if let Ok(Some(task_suggestion)) = self.suggest_next_task(context).await {
            message_parts.push(format!("📋 **Task Suggestion:** {}", task_suggestion));
            suggestions.push("Start timer for suggested task".to_string());
            suggestions.push("View all active tasks".to_string());
            result_data.insert("task_suggested".to_string(), serde_json::Value::Bool(true));
            result_data.insert("task_suggestion".to_string(), serde_json::Value::String(task_suggestion));
        } else {
            result_data.insert("task_suggested".to_string(), serde_json::Value::Bool(false));
        }
        
        // Add contextual suggestions based on time of day
        let current_hour = context.current_time.hour();
        match current_hour {
            6..=9 => {
                message_parts.push("🌅 **Morning Focus:** Great time for important or creative work".to_string());
                suggestions.push("Tackle your most important task".to_string());
            }
            10..=12 => {
                message_parts.push("☀️ **Peak Hours:** You're likely at peak cognitive performance".to_string());
                suggestions.push("Focus on complex or challenging tasks".to_string());
            }
            13..=14 => {
                message_parts.push("🍽️ **Post-Lunch:** Consider lighter tasks or a short break".to_string());
                suggestions.push("Do routine or administrative tasks".to_string());
            }
            15..=17 => {
                message_parts.push("🌤️ **Afternoon:** Good for collaborative work and meetings".to_string());
                suggestions.push("Handle communications and planning".to_string());
            }
            18..=20 => {
                message_parts.push("🌆 **Evening:** Time to wrap up and plan tomorrow".to_string());
                suggestions.push("Review today's progress".to_string());
                suggestions.push("Plan tomorrow's priorities".to_string());
            }
            _ => {
                message_parts.push("🌙 **Off Hours:** Consider rest and recovery".to_string());
                suggestions.push("Take a break from work".to_string());
            }
        }
        
        result_data.insert("current_hour".to_string(), serde_json::Value::Number(serde_json::Number::from(current_hour)));
        result_data.insert("time_context".to_string(), serde_json::Value::String(
            match current_hour {
                6..=9 => "morning".to_string(),
                10..=12 => "peak_hours".to_string(),
                13..=14 => "post_lunch".to_string(),
                15..=17 => "afternoon".to_string(),
                18..=20 => "evening".to_string(),
                _ => "off_hours".to_string(),
            }
        ));
        
        let message = if message_parts.is_empty() {
            "✨ **Session Management:** Everything looks good! Keep up the great work.".to_string()
        } else {
            message_parts.join("\n\n")
        };
        
        if suggestions.is_empty() {
            suggestions.push("Keep up the great work!".to_string());
        }
        
        Ok(ToolExecutionResult {
            success: true,
            data: serde_json::Value::Object(result_data.into_iter().collect()),
            message,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            error: None,
            suggestions,
            metadata: HashMap::new(),
        })
    }
}