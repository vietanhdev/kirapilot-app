use std::collections::HashMap;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::ai::{AIResult, AIServiceError};
use crate::ai::tool_registry::{
    Tool, ToolContext, ToolCapability, ToolExecutionResult, InferredParameters,
    ParameterDefinition, ParameterValidation, ToolExample, PermissionLevel,
};
use crate::database::repositories::{TaskRepository, CreateTaskRequest};

/// Create task tool with smart parameter inference
pub struct CreateTaskTool {
    task_repo: TaskRepository,
}

impl CreateTaskTool {
    pub fn new(task_repo: TaskRepository) -> Self {
        Self { task_repo }
    }
    
    /// Extract task details from natural language
    fn parse_task_from_message(&self, message: &str) -> (Option<String>, Option<u32>, Option<String>) {
        let message_lower = message.to_lowercase();
        
        // Extract title
        let title = self.extract_task_title(message);
        
        // Extract priority
        let priority = self.extract_priority(&message_lower);
        
        // Extract description (everything after title extraction)
        let description = if title.is_some() {
            Some(message.to_string())
        } else {
            None
        };
        
        (title, priority, description)
    }
    
    fn extract_task_title(&self, message: &str) -> Option<String> {
        let message_lower = message.to_lowercase();
        
        // Pattern 1: "create task: title"
        if let Some(pos) = message_lower.find("create task:") {
            let title = message[pos + 12..].trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
        
        // Pattern 2: "add task called title"
        if let Some(pos) = message_lower.find("add task called") {
            let title = message[pos + 15..].trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
        
        // Pattern 3: "create 'title'"
        if let Some(start) = message.find('\'') {
            if let Some(end) = message[start + 1..].find('\'') {
                let title = &message[start + 1..start + 1 + end];
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        
        // Pattern 4: "create \"title\""
        if let Some(start) = message.find('"') {
            if let Some(end) = message[start + 1..].find('"') {
                let title = &message[start + 1..start + 1 + end];
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        
        // Pattern 5: Extract after common task creation phrases
        let patterns = [
            "create task ",
            "add task ",
            "new task ",
            "make task ",
            "todo: ",
            "task: ",
        ];
        
        for pattern in &patterns {
            if let Some(pos) = message_lower.find(pattern) {
                let remaining = message[pos + pattern.len()..].trim();
                // Take everything until punctuation or end
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
    
    fn extract_priority(&self, message: &str) -> Option<u32> {
        if message.contains("urgent") || message.contains("critical") || message.contains("asap") {
            return Some(3); // Urgent
        }
        
        if message.contains("high priority") || message.contains("important") || message.contains("high") {
            return Some(2); // High
        }
        
        if message.contains("low priority") || message.contains("minor") || message.contains("low") {
            return Some(0); // Low
        }
        
        Some(1) // Default to Medium
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
    
    fn extract_due_date(&self, message: &str) -> Option<DateTime<Utc>> {
        let message_lower = message.to_lowercase();
        
        // Look for relative dates
        if message_lower.contains("today") {
            return Some(Utc::now());
        }
        
        if message_lower.contains("tomorrow") {
            return Some(Utc::now() + chrono::Duration::days(1));
        }
        
        if message_lower.contains("next week") {
            return Some(Utc::now() + chrono::Duration::weeks(1));
        }
        
        // Look for specific date patterns (YYYY-MM-DD, MM/DD/YYYY, etc.)
        let date_patterns = [
            r"(\d{4})-(\d{1,2})-(\d{1,2})",
            r"(\d{1,2})/(\d{1,2})/(\d{4})",
            r"(\d{1,2})-(\d{1,2})-(\d{4})",
        ];
        
        for pattern in &date_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(captures) = regex.captures(message) {
                    // Try to parse the date (this is simplified, real implementation would be more robust)
                    if captures.len() >= 4 {
                        // This is a simplified date parsing - in production you'd want proper date parsing
                        continue;
                    }
                }
            }
        }
        
        None
    }
}

#[async_trait]
impl Tool for CreateTaskTool {
    fn name(&self) -> &str {
        "create_task"
    }
    
    fn description(&self) -> &str {
        "Create a new task with title, description, priority, and other details"
    }
    
    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![
                ParameterDefinition {
                    name: "title".to_string(),
                    param_type: "string".to_string(),
                    description: "Task title or name".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        min_length: Some(1),
                        max_length: Some(200),
                        ..Default::default()
                    }),
                    inference_sources: vec![
                        "user_message".to_string(),
                        "quoted_text".to_string(),
                        "task_creation_patterns".to_string(),
                    ],
                },
            ],
            optional_parameters: vec![
                ParameterDefinition {
                    name: "description".to_string(),
                    param_type: "string".to_string(),
                    description: "Detailed task description".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        max_length: Some(1000),
                        ..Default::default()
                    }),
                    inference_sources: vec!["user_message".to_string()],
                },
                ParameterDefinition {
                    name: "priority".to_string(),
                    param_type: "number".to_string(),
                    description: "Task priority (0=Low, 1=Medium, 2=High, 3=Urgent)".to_string(),
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(1))),
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
                    name: "time_estimate".to_string(),
                    param_type: "number".to_string(),
                    description: "Estimated time to complete in minutes".to_string(),
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(60))),
                    validation: Some(ParameterValidation {
                        min: Some(1.0),
                        max: Some(10080.0), // 1 week in minutes
                        ..Default::default()
                    }),
                    inference_sources: vec!["time_patterns".to_string()],
                },
                ParameterDefinition {
                    name: "due_date".to_string(),
                    param_type: "string".to_string(),
                    description: "Due date in ISO format".to_string(),
                    default_value: None,
                    validation: None,
                    inference_sources: vec!["date_patterns".to_string(), "relative_dates".to_string()],
                },
                ParameterDefinition {
                    name: "tags".to_string(),
                    param_type: "array".to_string(),
                    description: "Array of tags for categorization".to_string(),
                    default_value: Some(serde_json::Value::Array(vec![])),
                    validation: None,
                    inference_sources: vec!["hashtags".to_string(), "categories".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::ModifyTasks],
            requires_confirmation: true,
            category: "Task Management".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Create a high priority task to review the quarterly report".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("title".to_string(), serde_json::Value::String("Review quarterly report".to_string()));
                        params.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(2)));
                        params
                    },
                    description: "Creates a high priority task with inferred title".to_string(),
                },
                ToolExample {
                    user_request: "Add task: 'Prepare presentation for Monday meeting' - should take about 2 hours".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert("title".to_string(), serde_json::Value::String("Prepare presentation for Monday meeting".to_string()));
                        params.insert("time_estimate".to_string(), serde_json::Value::Number(serde_json::Number::from(120)));
                        params
                    },
                    description: "Creates task with explicit title and inferred time estimate".to_string(),
                },
            ],
        }
    }
    
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let mut confidence = 0.0;
        let mut needs_confirmation = Vec::new();
        let mut alternatives = Vec::new();
        let mut explanations = Vec::new();
        
        // Extract task details from user message
        let (title, priority, description) = self.parse_task_from_message(&context.user_message);
        
        // Title inference
        if let Some(title) = title {
            parameters.insert("title".to_string(), serde_json::Value::String(title.clone()));
            confidence += 0.4;
            explanations.push(format!("Extracted title: '{}'", title));
        } else {
            needs_confirmation.push("title".to_string());
            explanations.push("Could not extract task title from message".to_string());
            
            // Suggest the entire message as title if it's short enough
            if context.user_message.len() < 100 {
                let mut alt_params = HashMap::new();
                alt_params.insert("title".to_string(), serde_json::Value::String(context.user_message.clone()));
                alternatives.push(alt_params);
            }
        }
        
        // Priority inference
        if let Some(priority) = priority {
            parameters.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(priority)));
            confidence += 0.2;
            explanations.push(format!("Inferred priority: {}", priority));
        } else {
            // Default to medium priority
            parameters.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(1)));
            explanations.push("Using default medium priority".to_string());
        }
        
        // Description inference
        if let Some(desc) = description {
            parameters.insert("description".to_string(), serde_json::Value::String(desc));
            confidence += 0.1;
            explanations.push("Using message as description".to_string());
        }
        
        // Time estimate inference
        if let Some(time_est) = self.extract_time_estimate(&context.user_message) {
            parameters.insert("time_estimate".to_string(), serde_json::Value::Number(serde_json::Number::from(time_est)));
            confidence += 0.2;
            explanations.push(format!("Extracted time estimate: {} minutes", time_est));
        } else {
            // Use default
            parameters.insert("time_estimate".to_string(), serde_json::Value::Number(serde_json::Number::from(60)));
            explanations.push("Using default 60-minute estimate".to_string());
        }
        
        // Due date inference
        if let Some(due_date) = self.extract_due_date(&context.user_message) {
            parameters.insert("due_date".to_string(), serde_json::Value::String(due_date.to_rfc3339()));
            confidence += 0.1;
            explanations.push("Extracted due date from message".to_string());
        }
        
        // Tags inference (look for hashtags or categories)
        let tags = self.extract_tags(&context.user_message);
        if !tags.is_empty() {
            let tag_values: Vec<serde_json::Value> = tags.into_iter()
                .map(|tag| serde_json::Value::String(tag))
                .collect();
            parameters.insert("tags".to_string(), serde_json::Value::Array(tag_values));
            confidence += 0.1;
            explanations.push("Extracted tags from message".to_string());
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
        // Check required parameters
        if !parameters.contains_key("title") {
            return Err(AIServiceError::validation_error("Task title is required"));
        }
        
        // Validate title
        if let Some(title) = parameters.get("title") {
            if let Some(title_str) = title.as_str() {
                if title_str.trim().is_empty() {
                    return Err(AIServiceError::validation_error("Task title cannot be empty"));
                }
                if title_str.len() > 200 {
                    return Err(AIServiceError::validation_error("Task title too long (max 200 characters)"));
                }
            } else {
                return Err(AIServiceError::validation_error("Task title must be a string"));
            }
        }
        
        // Validate priority
        if let Some(priority) = parameters.get("priority") {
            if let Some(priority_num) = priority.as_u64() {
                if priority_num > 3 {
                    return Err(AIServiceError::validation_error("Priority must be between 0 and 3"));
                }
            }
        }
        
        // Validate time estimate
        if let Some(time_est) = parameters.get("time_estimate") {
            if let Some(time_num) = time_est.as_u64() {
                if time_num == 0 || time_num > 10080 {
                    return Err(AIServiceError::validation_error("Time estimate must be between 1 and 10080 minutes"));
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, _context: &ToolContext) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();
        
        // Extract parameters
        let title = parameters.get("title")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AIServiceError::validation_error("Title is required"))?
            .to_string();
        
        let description = parameters.get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let priority = parameters.get("priority")
            .and_then(|v| v.as_u64())
            .unwrap_or(1) as u32;
        
        let time_estimate = parameters.get("time_estimate")
            .and_then(|v| v.as_u64())
            .unwrap_or(60) as u32;
        
        let due_date = parameters.get("due_date")
            .and_then(|v| v.as_str())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        
        let tags = parameters.get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        
        // Create the task
        let create_request = CreateTaskRequest {
            title: title.clone(),
            description,
            priority: priority as i32,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: Some(time_estimate as i32),
            due_date,
            scheduled_date: None, // Could be inferred separately
            tags: Some(tags),
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };
        
        match self.task_repo.create_task(create_request).await {
            Ok(task) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                let mut result_data = HashMap::new();
                result_data.insert("task_id".to_string(), serde_json::Value::String(task.id.clone()));
                result_data.insert("title".to_string(), serde_json::Value::String(task.title.clone()));
                result_data.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(task.priority)));
                
                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: format!("✅ Created task: '{}'", title),
                    execution_time_ms: execution_time,
                    error: None,
                    suggestions: vec![
                        "You can start a timer for this task".to_string(),
                        "Set a due date if needed".to_string(),
                        "Add more details to the description".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to create task: {}", e),
                    execution_time_ms: execution_time,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Try with a different title".to_string(),
                        "Check if the task already exists".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}

impl CreateTaskTool {
    fn extract_tags(&self, message: &str) -> Vec<String> {
        let mut tags = Vec::new();
        
        // Look for hashtags
        for word in message.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                tags.push(word[1..].to_string());
            }
        }
        
        // Look for category keywords
        let category_keywords = [
            ("work", vec!["work", "office", "business", "meeting"]),
            ("personal", vec!["personal", "home", "family"]),
            ("urgent", vec!["urgent", "asap", "critical"]),
            ("research", vec!["research", "study", "learn"]),
            ("development", vec!["code", "programming", "development", "bug"]),
        ];
        
        let message_lower = message.to_lowercase();
        for (category, keywords) in &category_keywords {
            for keyword in keywords {
                if message_lower.contains(keyword) {
                    tags.push(category.to_string());
                    break;
                }
            }
        }
        
        tags.sort();
        tags.dedup();
        tags
    }
}

