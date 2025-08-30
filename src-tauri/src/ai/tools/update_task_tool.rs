use std::collections::HashMap;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::ai::{AIResult, AIServiceError};
use crate::ai::tool_registry::{
    Tool, ToolContext, ToolCapability, ToolExecutionResult, InferredParameters,
    ParameterDefinition, ParameterValidation, ToolExample, PermissionLevel,
};
use crate::database::repositories::{TaskRepository, UpdateTaskRequest};

/// Update task tool with smart task matching and parameter inference
pub struct UpdateTaskTool {
    task_repo: TaskRepository,
}

impl UpdateTaskTool {
    pub fn new(task_repo: TaskRepository) -> Self {
        Self { task_repo }
    }
    
    /// Find task to update based on user message and context
    async fn find_target_task(&self, message: &str, context: &ToolContext) -> AIResult<Option<String>> {
        let message_lower = message.to_lowercase();
        
        // Check for explicit task references
        if message_lower.contains("this task") || message_lower.contains("current task") {
            if let Some(active_task_id) = &context.active_task_id {
                return Ok(Some(active_task_id.clone()));
            }
        }
        
        // Look for task title mentions
        if let Ok(tasks) = self.task_repo.find_all(None, None).await {
            // Try to match task titles in the message
            for task in &tasks {
                let title_lower = task.title.to_lowercase();
                
                // Direct title match
                if message_lower.contains(&title_lower) {
                    return Ok(Some(task.id.clone()));
                }
                
                // Partial title match (at least 3 characters)
                let title_words: Vec<&str> = title_lower.split_whitespace().collect();
                for word in &title_words {
                    if word.len() >= 3 && message_lower.contains(word) {
                        return Ok(Some(task.id.clone()));
                    }
                }
            }
            
            // If no title match, use the most recent task from context
            if let Some(recent_task_id) = context.recent_task_ids.first() {
                return Ok(Some(recent_task_id.clone()));
            }
            
            // Fall back to the first active task
            for task in tasks {
                if task.status != "completed" && task.status != "cancelled" {
                    return Ok(Some(task.id));
                }
            }
        }
        
        Ok(None)
    }
    
    /// Extract what updates to make from the user message
    fn extract_updates(&self, message: &str) -> HashMap<String, serde_json::Value> {
        let mut updates = HashMap::new();
        let message_lower = message.to_lowercase();
        
        // Status updates
        if message_lower.contains("complete") || message_lower.contains("done") || message_lower.contains("finished") {
            updates.insert("status".to_string(), serde_json::Value::String("completed".to_string()));
        } else if message_lower.contains("start") || message_lower.contains("begin") || message_lower.contains("working on") {
            updates.insert("status".to_string(), serde_json::Value::String("in_progress".to_string()));
        } else if message_lower.contains("cancel") || message_lower.contains("cancelled") {
            updates.insert("status".to_string(), serde_json::Value::String("cancelled".to_string()));
        } else if message_lower.contains("pending") || message_lower.contains("todo") {
            updates.insert("status".to_string(), serde_json::Value::String("pending".to_string()));
        }
        
        // Priority updates
        if message_lower.contains("urgent") || message_lower.contains("critical") {
            updates.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(3)));
        } else if message_lower.contains("high priority") || message_lower.contains("important") {
            updates.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(2)));
        } else if message_lower.contains("low priority") || message_lower.contains("minor") {
            updates.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(0)));
        } else if message_lower.contains("medium priority") || message_lower.contains("normal") {
            updates.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(1)));
        }
        
        // Title updates
        if let Some(new_title) = self.extract_new_title(message) {
            updates.insert("title".to_string(), serde_json::Value::String(new_title));
        }
        
        // Description updates
        if let Some(new_description) = self.extract_new_description(message) {
            updates.insert("description".to_string(), serde_json::Value::String(new_description));
        }
        
        // Due date updates
        if let Some(due_date) = self.extract_due_date(message) {
            updates.insert("due_date".to_string(), serde_json::Value::String(due_date.to_rfc3339()));
        }
        
        // Time estimate updates
        if let Some(time_estimate) = self.extract_time_estimate(message) {
            updates.insert("time_estimate".to_string(), serde_json::Value::Number(serde_json::Number::from(time_estimate)));
        }
        
        updates
    }
    
    fn extract_new_title(&self, message: &str) -> Option<String> {
        let patterns = [
            "rename to",
            "change title to",
            "update title to",
            "call it",
            "title:",
        ];
        
        for pattern in &patterns {
            if let Some(pos) = message.to_lowercase().find(pattern) {
                let remaining = message[pos + pattern.len()..].trim();
                
                // Look for quoted text
                if let Some(start) = remaining.find('"') {
                    if let Some(end) = remaining[start + 1..].find('"') {
                        let title = &remaining[start + 1..start + 1 + end];
                        if !title.is_empty() {
                            return Some(title.to_string());
                        }
                    }
                }
                
                // Take text until punctuation
                let title = remaining
                    .split(&['.', '!', '?', '\n'][..])
                    .next()
                    .unwrap_or(remaining)
                    .trim();
                
                if !title.is_empty() && title.len() > 2 {
                    return Some(title.to_string());
                }
            }
        }
        
        None
    }
    
    fn extract_new_description(&self, message: &str) -> Option<String> {
        let patterns = [
            "description:",
            "details:",
            "add description",
            "update description",
            "notes:",
        ];
        
        for pattern in &patterns {
            if let Some(pos) = message.to_lowercase().find(pattern) {
                let remaining = message[pos + pattern.len()..].trim();
                
                if !remaining.is_empty() && remaining.len() > 5 {
                    return Some(remaining.to_string());
                }
            }
        }
        
        None
    }
    
    fn extract_due_date(&self, message: &str) -> Option<DateTime<Utc>> {
        let message_lower = message.to_lowercase();
        
        // Relative dates
        if message_lower.contains("due today") {
            return Some(Utc::now());
        }
        
        if message_lower.contains("due tomorrow") {
            return Some(Utc::now() + chrono::Duration::days(1));
        }
        
        if message_lower.contains("due next week") {
            return Some(Utc::now() + chrono::Duration::weeks(1));
        }
        
        // Look for "due on" or "deadline" patterns
        let date_patterns = [
            "due on",
            "due by",
            "deadline",
            "due date",
        ];
        
        for pattern in &date_patterns {
            if let Some(pos) = message_lower.find(pattern) {
                let remaining = &message[pos + pattern.len()..].trim();
                
                // Try to parse common date formats (simplified)
                if remaining.contains("today") {
                    return Some(Utc::now());
                }
                if remaining.contains("tomorrow") {
                    return Some(Utc::now() + chrono::Duration::days(1));
                }
            }
        }
        
        None
    }
    
    fn extract_time_estimate(&self, message: &str) -> Option<u32> {
        // Look for time patterns
        let time_patterns = [
            (r"(\d+)\s*hours?", 60),
            (r"(\d+)\s*hrs?", 60),
            (r"(\d+)\s*minutes?", 1),
            (r"(\d+)\s*mins?", 1),
            (r"(\d+)h", 60),
            (r"(\d+)m", 1),
        ];
        
        for (pattern, multiplier) in &time_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(captures) = regex.captures(message) {
                    if let Some(num_match) = captures.get(1) {
                        if let Ok(num) = num_match.as_str().parse::<u32>() {
                            return Some(num * multiplier);
                        }
                    }
                }
            }
        }
        
        None
    }
}

#[async_trait]
impl Tool for UpdateTaskTool {
    fn name(&self) -> &str {
        "update_task"
    }
    
    fn description(&self) -> &str {
        "Update an existing task's properties like status, priority, title, or description"
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
                    description: "ID of the task to update (auto-detected if not provided)".to_string(),
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
                    name: "status".to_string(),
                    param_type: "string".to_string(),
                    description: "New task status (pending, in_progress, completed, cancelled)".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        allowed_values: Some(vec![
                            serde_json::Value::String("pending".to_string()),
                            serde_json::Value::String("in_progress".to_string()),
                            serde_json::Value::String("completed".to_string()),
                            serde_json::Value::String("cancelled".to_string()),
                        ]),
                        ..Default::default()
                    }),
                    inference_sources: vec!["status_keywords".to_string()],
                },
                ParameterDefinition {
                    name: "priority".to_string(),
                    param_type: "number".to_string(),
                    description: "New task priority (0=Low, 1=Medium, 2=High, 3=Urgent)".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        min: Some(0.0),
                        max: Some(3.0),
                        allowed_values: Some(vec![
                            serde_json::Value::Number(serde_json::Number::from(0)),
                            serde_json::Value::Number(serde_json::Number::from(1)),
                            serde_json::Value::Number(serde_json::Number::from(2)),
                            serde_json::Value::Number(serde_json::Number::from(3)),
                        ]),
                        ..Default::default()
                    }),
                    inference_sources: vec!["priority_keywords".to_string()],
                },
                ParameterDefinition {
                    name: "title".to_string(),
                    param_type: "string".to_string(),
                    description: "New task title".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        min_length: Some(1),
                        max_length: Some(200),
                        ..Default::default()
                    }),
                    inference_sources: vec!["title_patterns".to_string(), "quoted_text".to_string()],
                },
                ParameterDefinition {
                    name: "description".to_string(),
                    param_type: "string".to_string(),
                    description: "New task description".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        max_length: Some(1000),
                        ..Default::default()
                    }),
                    inference_sources: vec!["description_patterns".to_string()],
                },
                ParameterDefinition {
                    name: "due_date".to_string(),
                    param_type: "string".to_string(),
                    description: "New due date in ISO format".to_string(),
                    default_value: None,
                    validation: None,
                    inference_sources: vec!["date_patterns".to_string(), "relative_dates".to_string()],
                },
                ParameterDefinition {
                    name: "time_estimate".to_string(),
                    param_type: "number".to_string(),
                    description: "New time estimate in minutes".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        min: Some(1.0),
                        max: Some(10080.0), // 1 week in minutes
                        ..Default::default()
                    }),
                    inference_sources: vec!["time_patterns".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::ModifyTasks],
            requires_confirmation: true,
            category: "Task Management".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Mark this task as completed".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("status".to_string(), serde_json::Value::String("completed".to_string()));
                        params
                    },
                    description: "Updates the current task status to completed".to_string(),
                },
                ToolExample {
                    user_request: "Change the quarterly report task to high priority".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(2)));
                        params
                    },
                    description: "Finds task by title and updates priority".to_string(),
                },
                ToolExample {
                    user_request: "Rename this task to 'Complete project documentation'".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("title".to_string(), serde_json::Value::String("Complete project documentation".to_string()));
                        params
                    },
                    description: "Updates the current task title".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let mut confidence = 0.6;
        let mut needs_confirmation = Vec::new();
        let mut alternatives = Vec::new();
        let mut explanations = Vec::new();
        
        // Try to find the target task
        match self.find_target_task(&context.user_message, context).await? {
            Some(task_id) => {
                parameters.insert("task_id".to_string(), serde_json::Value::String(task_id.clone()));
                confidence += 0.2;
                explanations.push(format!("Found target task: {}", task_id));
            }
            None => {
                needs_confirmation.push("task_id".to_string());
                explanations.push("Could not identify which task to update".to_string());
                confidence -= 0.3;
                
                // Suggest listing tasks first
                let mut alt_params = HashMap::new();
                alt_params.insert("suggestion".to_string(), serde_json::Value::String("List tasks first to identify which one to update".to_string()));
                alternatives.push(alt_params);
            }
        }
        
        // Extract updates from the message
        let updates = self.extract_updates(&context.user_message);
        
        if updates.is_empty() {
            needs_confirmation.push("updates".to_string());
            explanations.push("No specific updates detected in message".to_string());
            confidence -= 0.2;
        } else {
            for (key, value) in updates {
                parameters.insert(key.clone(), value);
                confidence += 0.1;
                explanations.push(format!("Detected update for {}", key));
            }
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
        // Check that we have either a task_id or can infer one
        if !parameters.contains_key("task_id") {
            return Err(AIServiceError::validation_error("Task ID is required to update a task"));
        }
        
        // Validate that at least one update field is provided
        let update_fields = ["status", "priority", "title", "description", "due_date", "time_estimate"];
        let has_updates = update_fields.iter().any(|field| parameters.contains_key(*field));
        
        if !has_updates {
            return Err(AIServiceError::validation_error("At least one field must be updated"));
        }
        
        // Validate individual fields
        if let Some(title) = parameters.get("title") {
            if let Some(title_str) = title.as_str() {
                if title_str.trim().is_empty() {
                    return Err(AIServiceError::validation_error("Task title cannot be empty"));
                }
                if title_str.len() > 200 {
                    return Err(AIServiceError::validation_error("Task title too long (max 200 characters)"));
                }
            }
        }
        
        if let Some(priority) = parameters.get("priority") {
            if let Some(priority_num) = priority.as_u64() {
                if priority_num > 3 {
                    return Err(AIServiceError::validation_error("Priority must be between 0 and 3"));
                }
            }
        }
        
        if let Some(time_est) = parameters.get("time_estimate") {
            if let Some(time_num) = time_est.as_u64() {
                if time_num == 0 || time_num > 10080 {
                    return Err(AIServiceError::validation_error("Time estimate must be between 1 and 10080 minutes"));
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        // Get task ID
        let task_id = if let Some(id) = parameters.get("task_id").and_then(|v| v.as_str()) {
            id.to_string()
        } else {
            // Try to infer task ID
            match self.find_target_task(&context.user_message, context).await? {
                Some(id) => id,
                None => {
                    return Ok(ToolExecutionResult {
                        success: false,
                        data: serde_json::Value::Null,
                        message: "❌ Could not identify which task to update. Please specify the task.".to_string(),
                        execution_time_ms: start_time.elapsed().as_millis() as u64,
                        error: Some("Task not found".to_string()),
                        suggestions: vec![
                            "List your tasks first".to_string(),
                            "Specify the task title or ID".to_string(),
                            "Use 'this task' if referring to the current task".to_string(),
                        ],
                        metadata: HashMap::new(),
                    });
                }
            }
        };
        
        // Build update request
        let mut update_request = UpdateTaskRequest::default();
        let mut updated_fields = Vec::new();
        
        if let Some(status) = parameters.get("status").and_then(|v| v.as_str()) {
            update_request.status = Some(status.to_string());
            updated_fields.push(format!("status to '{}'", status));
        }
        
        if let Some(priority) = parameters.get("priority").and_then(|v| v.as_u64()) {
            update_request.priority = Some(priority as i32);
            let priority_name = match priority {
                0 => "Low",
                1 => "Medium",
                2 => "High", 
                3 => "Urgent",
                _ => "Unknown",
            };
            updated_fields.push(format!("priority to {}", priority_name));
        }
        
        if let Some(title) = parameters.get("title").and_then(|v| v.as_str()) {
            update_request.title = Some(title.to_string());
            updated_fields.push(format!("title to '{}'", title));
        }
        
        if let Some(description) = parameters.get("description").and_then(|v| v.as_str()) {
            update_request.description = Some(description.to_string());
            updated_fields.push("description".to_string());
        }
        
        if let Some(due_date_str) = parameters.get("due_date").and_then(|v| v.as_str()) {
            if let Ok(due_date) = DateTime::parse_from_rfc3339(due_date_str) {
                update_request.due_date = Some(due_date.with_timezone(&Utc));
                updated_fields.push("due date".to_string());
            }
        }
        
        if let Some(time_est) = parameters.get("time_estimate").and_then(|v| v.as_u64()) {
            update_request.time_estimate = Some(time_est as i32);
            updated_fields.push(format!("time estimate to {} minutes", time_est));
        }
        
        // Execute the update
        match self.task_repo.update_task(&task_id, update_request).await {
            Ok(updated_task) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                let mut result_data = HashMap::new();
                result_data.insert("task_id".to_string(), serde_json::Value::String(updated_task.id.clone()));
                result_data.insert("title".to_string(), serde_json::Value::String(updated_task.title.clone()));
                result_data.insert("status".to_string(), serde_json::Value::String(updated_task.status.clone()));
                result_data.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(updated_task.priority)));
                result_data.insert("updated_fields".to_string(), serde_json::Value::Array(
                    updated_fields.iter().map(|f| serde_json::Value::String(f.clone())).collect()
                ));
                
                let updates_text = if updated_fields.len() == 1 {
                    updated_fields[0].clone()
                } else if updated_fields.len() == 2 {
                    format!("{} and {}", updated_fields[0], updated_fields[1])
                } else {
                    format!("{}, and {}", updated_fields[..updated_fields.len()-1].join(", "), updated_fields.last().unwrap())
                };
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: format!("✅ Updated **{}**: {}", updated_task.title, updates_text),
                    execution_time_ms: execution_time,
                    error: None,
                    suggestions: vec![
                        "Start a timer if you're ready to work on this task".to_string(),
                        "Add more details if needed".to_string(),
                        "Check your task list to see the changes".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to update task: {}", e),
                    execution_time_ms: execution_time,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Check if the task exists".to_string(),
                        "Verify the update values are valid".to_string(),
                        "Try again with different parameters".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}

