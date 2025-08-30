use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use chrono::{DateTime, Utc};


use crate::ai::{AIResult, AIServiceError};

/// Permission levels for tool execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PermissionLevel {
    ReadOnly,
    ModifyTasks,
    TimerControl,
    FullAccess,
}

/// Context information available to tools for smart parameter inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolContext {
    /// Current user request/message
    pub user_message: String,
    
    /// Previous conversation context
    pub conversation_history: Vec<String>,
    
    /// Current active task ID if any
    pub active_task_id: Option<String>,
    
    /// Current timer session ID if any
    pub active_timer_session_id: Option<String>,
    
    /// Recently mentioned task IDs
    pub recent_task_ids: Vec<String>,
    
    /// Current date and time
    pub current_time: DateTime<Utc>,
    
    /// User preferences and settings
    pub user_preferences: HashMap<String, serde_json::Value>,
    
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Smart parameter inference result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferredParameters {
    /// Inferred parameter values
    pub parameters: HashMap<String, serde_json::Value>,
    
    /// Confidence score (0.0 to 1.0)
    pub confidence: f64,
    
    /// Parameters that need user confirmation
    pub needs_confirmation: Vec<String>,
    
    /// Suggested alternatives if inference is uncertain
    pub alternatives: Vec<HashMap<String, serde_json::Value>>,
    
    /// Human-readable explanation of inference
    pub explanation: String,
}

/// Tool capability information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCapability {
    /// Tool name
    pub name: String,
    
    /// Human-readable description
    pub description: String,
    
    /// Required parameters
    pub required_parameters: Vec<ParameterDefinition>,
    
    /// Optional parameters
    pub optional_parameters: Vec<ParameterDefinition>,
    
    /// Required permissions
    pub required_permissions: Vec<PermissionLevel>,
    
    /// Whether tool requires user confirmation
    pub requires_confirmation: bool,
    
    /// Tool category for organization
    pub category: String,
    
    /// Examples of how to use this tool
    pub examples: Vec<ToolExample>,
}

/// Parameter definition for tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterDefinition {
    /// Parameter name
    pub name: String,
    
    /// Parameter type (string, number, boolean, array, object)
    pub param_type: String,
    
    /// Human-readable description
    pub description: String,
    
    /// Default value if any
    pub default_value: Option<serde_json::Value>,
    
    /// Validation rules
    pub validation: Option<ParameterValidation>,
    
    /// Context keys that can be used to infer this parameter
    pub inference_sources: Vec<String>,
}

/// Parameter validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterValidation {
    /// Minimum value for numbers
    pub min: Option<f64>,
    
    /// Maximum value for numbers
    pub max: Option<f64>,
    
    /// Minimum length for strings/arrays
    pub min_length: Option<usize>,
    
    /// Maximum length for strings/arrays
    pub max_length: Option<usize>,
    
    /// Regular expression pattern for strings
    pub pattern: Option<String>,
    
    /// Allowed values (enum)
    pub allowed_values: Option<Vec<serde_json::Value>>,
}

/// Example usage of a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExample {
    /// Example user request
    pub user_request: String,
    
    /// Expected parameters
    pub parameters: HashMap<String, serde_json::Value>,
    
    /// Description of what this example demonstrates
    pub description: String,
}

/// Result from tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    /// Whether execution was successful
    pub success: bool,
    
    /// Result data
    pub data: serde_json::Value,
    
    /// Human-readable message
    pub message: String,
    
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    
    /// Error information if failed
    pub error: Option<String>,
    
    /// Suggestions for follow-up actions
    pub suggestions: Vec<String>,
    
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Trait for individual tools
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get tool name
    fn name(&self) -> &str;
    
    /// Get tool description
    fn description(&self) -> &str;
    
    /// Get tool capability information
    fn capability(&self) -> ToolCapability;
    
    /// Infer parameters from context and user message
    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters>;
    
    /// Validate parameters before execution
    fn validate_parameters(&self, parameters: &HashMap<String, serde_json::Value>) -> AIResult<()>;
    
    /// Execute the tool with given parameters
    async fn execute(&self, parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult>;
    
    /// Check if user has required permissions
    fn check_permissions(&self, user_permissions: &[PermissionLevel]) -> bool {
        let required = &self.capability().required_permissions;
        required.iter().all(|perm| {
            user_permissions.contains(perm) || user_permissions.contains(&PermissionLevel::FullAccess)
        })
    }
    
    /// Get user-friendly error message for permission denial
    fn permission_denied_message(&self) -> String {
        format!(
            "You don't have permission to use the '{}' tool. Required permissions: {:?}",
            self.name(),
            self.capability().required_permissions
        )
    }
}

/// Smart tool registry with automatic parameter inference
pub struct SmartToolRegistry {
    /// Registered tools
    tools: HashMap<String, Box<dyn Tool>>,
    
    /// User permissions
    user_permissions: Vec<PermissionLevel>,
    
    /// Tool usage statistics
    usage_stats: HashMap<String, ToolUsageStats>,
    
    /// Context analyzer for smart inference
    context_analyzer: ContextAnalyzer,
    
    /// Tool execution logger (optional)
    execution_logger: Option<crate::ai::ToolExecutionLogger>,
}

/// Tool usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsageStats {
    /// Total number of executions
    pub total_executions: u64,
    
    /// Successful executions
    pub successful_executions: u64,
    
    /// Average execution time
    pub avg_execution_time_ms: f64,
    
    /// Last used timestamp
    pub last_used: DateTime<Utc>,
    
    /// Common parameter patterns
    pub common_parameters: HashMap<String, serde_json::Value>,
}

/// Context analyzer for smart parameter inference
pub struct ContextAnalyzer {
    /// Natural language patterns for different parameter types
    patterns: HashMap<String, Vec<String>>,
}

impl SmartToolRegistry {
    /// Create a new smart tool registry
    pub fn new(user_permissions: Vec<PermissionLevel>) -> Self {
        Self {
            tools: HashMap::new(),
            user_permissions,
            usage_stats: HashMap::new(),
            context_analyzer: ContextAnalyzer::new(),
            execution_logger: None,
        }
    }
    
    /// Create a new smart tool registry with execution logging
    pub fn with_logger(
        user_permissions: Vec<PermissionLevel>,
        logger: crate::ai::ToolExecutionLogger,
    ) -> Self {
        Self {
            tools: HashMap::new(),
            user_permissions,
            usage_stats: HashMap::new(),
            context_analyzer: ContextAnalyzer::new(),
            execution_logger: Some(logger),
        }
    }
    
    /// Set the execution logger
    pub fn set_logger(&mut self, logger: crate::ai::ToolExecutionLogger) {
        self.execution_logger = Some(logger);
    }
    
    /// Register a tool
    pub fn register_tool(&mut self, tool: Box<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name.clone(), tool);
        
        // Initialize usage stats
        self.usage_stats.insert(name, ToolUsageStats {
            total_executions: 0,
            successful_executions: 0,
            avg_execution_time_ms: 0.0,
            last_used: Utc::now(),
            common_parameters: HashMap::new(),
        });
    }
    
    /// Get available tools based on user permissions
    pub fn get_available_tools(&self) -> Vec<String> {
        self.tools
            .values()
            .filter(|tool| tool.check_permissions(&self.user_permissions))
            .map(|tool| tool.name().to_string())
            .collect()
    }
    
    /// Get tool capability information
    pub fn get_tool_capability(&self, tool_name: &str) -> Option<ToolCapability> {
        self.tools.get(tool_name).map(|tool| tool.capability())
    }
    
    /// Smart tool selection based on user message and context
    pub async fn suggest_tools(&self, context: &ToolContext) -> AIResult<Vec<ToolSuggestion>> {
        let mut suggestions = Vec::new();
        
        for tool in self.tools.values() {
            if !tool.check_permissions(&self.user_permissions) {
                continue;
            }
            
            // Analyze if this tool is relevant to the user's request
            let relevance = self.analyze_tool_relevance(tool.as_ref(), context).await?;
            
            if relevance.score > 0.3 {
                // Try to infer parameters
                let inferred_params = tool.infer_parameters(context).await?;
                
                let confidence = relevance.score * inferred_params.confidence;
                suggestions.push(ToolSuggestion {
                    tool_name: tool.name().to_string(),
                    relevance_score: relevance.score,
                    explanation: relevance.explanation,
                    inferred_parameters: inferred_params,
                    confidence,
                });
            }
        }
        
        // Sort by confidence score
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        
        Ok(suggestions)
    }
    
    /// Execute a tool with smart parameter inference
    pub async fn execute_tool_smart(
        &mut self,
        tool_name: &str,
        context: &ToolContext,
        user_provided_params: Option<HashMap<String, serde_json::Value>>,
    ) -> AIResult<ToolExecutionResult> {
        let tool = self.tools.get(tool_name)
            .ok_or_else(|| AIServiceError::internal_error(format!("Tool '{}' not found", tool_name)))?;
        
        // Check permissions
        if !tool.check_permissions(&self.user_permissions) {
            return Err(AIServiceError::permission_denied(tool.permission_denied_message()));
        }
        
        let start_time = std::time::Instant::now();
        
        // Infer parameters if not fully provided
        let had_user_params = user_provided_params.is_some();
        let mut final_params = user_provided_params.unwrap_or_default();
        
        if final_params.is_empty() {
            let inferred = tool.infer_parameters(context).await?;
            final_params = inferred.parameters;
        } else {
            // Merge user params with inferred params for missing values
            let inferred = tool.infer_parameters(context).await?;
            for (key, value) in inferred.parameters {
                final_params.entry(key).or_insert(value);
            }
        }
        
        // Validate parameters
        tool.validate_parameters(&final_params)?;
        
        // Get inference info before execution for logging
        let inference_info = if !had_user_params {
            let inferred = tool.infer_parameters(context).await?;
            Some(crate::ai::InferenceInfo {
                confidence: inferred.confidence,
                inferred_parameters: inferred.parameters.keys().cloned().collect(),
                needed_confirmation: inferred.needs_confirmation,
                explanation: inferred.explanation,
                alternatives_count: inferred.alternatives.len(),
            })
        } else {
            None
        };
        
        // Execute the tool
        let result = tool.execute(final_params.clone(), context).await;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        // Update usage statistics
        self.update_usage_stats(tool_name, execution_time, result.is_ok());
        
        // Log the execution if logger is available
        if let (Some(logger), Ok(ref exec_result)) = (&mut self.execution_logger, &result) {
            if let Err(e) = logger.log_execution(
                tool_name,
                final_params,
                inference_info,
                exec_result.clone(),
                context.clone(),
                context.metadata.get("user_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            ).await {
                eprintln!("Failed to log tool execution: {}", e);
            }
        }
        
        result
    }
    
    /// Analyze tool relevance to user request
    async fn analyze_tool_relevance(&self, tool: &dyn Tool, context: &ToolContext) -> AIResult<ToolRelevance> {
        let user_message = &context.user_message.to_lowercase();
        let tool_name = tool.name();
        let tool_desc = tool.description().to_lowercase();
        
        let mut score: f64 = 0.0;
        let mut explanations = Vec::new();
        
        // Check for direct tool name mentions
        if user_message.contains(tool_name) {
            score += 0.8;
            explanations.push(format!("Tool name '{}' mentioned directly", tool_name));
        }
        
        // Check for keyword matches in description
        let keywords = self.extract_keywords(&tool_desc);
        for keyword in keywords {
            if user_message.contains(&keyword) {
                score += 0.2;
                explanations.push(format!("Keyword '{}' matches", keyword));
            }
        }
        
        // Tool-specific relevance analysis
        match tool_name {
            "create_task" => {
                if user_message.contains("create") || user_message.contains("add") || 
                   user_message.contains("new task") || user_message.contains("todo") {
                    score += 0.6;
                    explanations.push("Task creation keywords detected".to_string());
                }
            },
            "get_tasks" => {
                if user_message.contains("list") || user_message.contains("show") || 
                   user_message.contains("tasks") || user_message.contains("what") {
                    score += 0.6;
                    explanations.push("Task listing keywords detected".to_string());
                }
            },
            "start_timer" => {
                if user_message.contains("start") || user_message.contains("begin") || 
                   user_message.contains("timer") || user_message.contains("track time") {
                    score += 0.6;
                    explanations.push("Timer start keywords detected".to_string());
                }
            },
            "stop_timer" => {
                if user_message.contains("stop") || user_message.contains("end") || 
                   user_message.contains("finish") && user_message.contains("timer") {
                    score += 0.6;
                    explanations.push("Timer stop keywords detected".to_string());
                }
            },
            _ => {}
        }
        
        // Cap the score at 1.0
        score = score.min(1.0);
        
        Ok(ToolRelevance {
            score,
            explanation: explanations.join("; "),
        })
    }
    
    /// Extract keywords from text
    fn extract_keywords(&self, text: &str) -> Vec<String> {
        text.split_whitespace()
            .filter(|word| word.len() > 3)
            .map(|word| word.to_lowercase())
            .collect()
    }
    
    /// Update tool usage statistics
    fn update_usage_stats(&mut self, tool_name: &str, execution_time: u64, success: bool) {
        if let Some(stats) = self.usage_stats.get_mut(tool_name) {
            stats.total_executions += 1;
            if success {
                stats.successful_executions += 1;
            }
            
            // Update average execution time
            let total_time = stats.avg_execution_time_ms * (stats.total_executions - 1) as f64;
            stats.avg_execution_time_ms = (total_time + execution_time as f64) / stats.total_executions as f64;
            
            stats.last_used = Utc::now();
        }
    }
    
    /// Get tool usage statistics
    pub fn get_usage_stats(&self, tool_name: &str) -> Option<&ToolUsageStats> {
        self.usage_stats.get(tool_name)
    }
    
    /// Update user permissions
    pub fn set_permissions(&mut self, permissions: Vec<PermissionLevel>) {
        self.user_permissions = permissions;
    }
}

/// Tool suggestion with relevance and inferred parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSuggestion {
    /// Tool name
    pub tool_name: String,
    
    /// Relevance score (0.0 to 1.0)
    pub relevance_score: f64,
    
    /// Explanation of why this tool is relevant
    pub explanation: String,
    
    /// Inferred parameters
    pub inferred_parameters: InferredParameters,
    
    /// Overall confidence score
    pub confidence: f64,
}

/// Tool relevance analysis result
#[derive(Debug, Clone)]
struct ToolRelevance {
    /// Relevance score (0.0 to 1.0)
    score: f64,
    
    /// Explanation of relevance
    explanation: String,
}

impl ContextAnalyzer {
    /// Create a new context analyzer
    pub fn new() -> Self {
        let mut patterns = HashMap::new();
        
        // Task-related patterns
        patterns.insert("task_title".to_string(), vec![
            "create".to_string(),
            "add".to_string(),
            "new task".to_string(),
            "todo".to_string(),
        ]);
        
        patterns.insert("task_priority".to_string(), vec![
            "urgent".to_string(),
            "high priority".to_string(),
            "important".to_string(),
            "low priority".to_string(),
        ]);
        
        // Timer patterns
        patterns.insert("timer_action".to_string(), vec![
            "start timer".to_string(),
            "begin timing".to_string(),
            "stop timer".to_string(),
            "end session".to_string(),
        ]);
        
        Self { patterns }
    }
    
    /// Extract task title from user message
    pub fn extract_task_title(&self, message: &str) -> Option<String> {
        let message_lower = message.to_lowercase();
        
        // Look for patterns like "create task: title" or "add task called title"
        if let Some(pos) = message_lower.find("create task") {
            if let Some(colon_pos) = message[pos..].find(':') {
                let title = message[pos + colon_pos + 1..].trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        
        if let Some(pos) = message_lower.find("add task") {
            if let Some(called_pos) = message[pos..].find("called") {
                let title = message[pos + called_pos + 6..].trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        
        // Extract quoted strings as potential titles
        if let Some(start) = message.find('"') {
            if let Some(end) = message[start + 1..].find('"') {
                let title = &message[start + 1..start + 1 + end];
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        
        None
    }
    
    /// Extract priority from user message
    pub fn extract_priority(&self, message: &str) -> Option<u32> {
        let message_lower = message.to_lowercase();
        
        if message_lower.contains("urgent") || message_lower.contains("critical") {
            return Some(3); // Urgent
        }
        
        if message_lower.contains("high priority") || message_lower.contains("important") {
            return Some(2); // High
        }
        
        if message_lower.contains("low priority") || message_lower.contains("minor") {
            return Some(0); // Low
        }
        
        Some(1) // Default to Medium
    }
    
    /// Extract time estimate from user message
    pub fn extract_time_estimate(&self, message: &str) -> Option<u32> {
        let message_lower = message.to_lowercase();
        
        // Look for patterns like "30 minutes", "1 hour", "2 hrs"
        if let Some(captures) = regex::Regex::new(r"(\d+)\s*(minute|min|hour|hr)s?")
            .ok()?
            .captures(&message_lower) 
        {
            if let (Some(num_match), Some(unit_match)) = (captures.get(1), captures.get(2)) {
                if let Ok(num) = num_match.as_str().parse::<u32>() {
                    let unit = unit_match.as_str();
                    return match unit {
                        "hour" | "hr" => Some(num * 60),
                        "minute" | "min" => Some(num),
                        _ => Some(num),
                    };
                }
            }
        }
        
        None
    }
}

/// Implementation of the ToolRegistry trait for ReAct engine compatibility
#[async_trait]
impl crate::ai::react_engine::ToolRegistry for SmartToolRegistry {
    async fn execute_tool(
        &self,
        tool_name: &str,
        args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        let tool = self.tools.get(tool_name)
            .ok_or_else(|| AIServiceError::internal_error(format!("Tool '{}' not found", tool_name)))?;
        
        // Check permissions
        if !tool.check_permissions(&self.user_permissions) {
            return Err(AIServiceError::permission_denied(tool.permission_denied_message()));
        }
        
        // Extract context information from args if available
        let user_message = args.get("user_message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
            
        let current_time = if let Some(time_str) = args.get("current_time").and_then(|v| v.as_str()) {
            DateTime::parse_from_rfc3339(time_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now())
        } else {
            Utc::now()
        };
        
        // Create context for execution with actual user message
        let context = ToolContext {
            user_message,
            conversation_history: Vec::new(),
            active_task_id: None,
            active_timer_session_id: None,
            recent_task_ids: Vec::new(),
            current_time,
            user_preferences: HashMap::new(),
            metadata: HashMap::new(),
        };
        
        // Filter out context parameters from tool arguments
        let mut tool_args = args.clone();
        tool_args.remove("user_message");
        tool_args.remove("current_time");
        
        // Execute the tool
        let result = tool.execute(tool_args, &context).await?;
        
        // Return the data as JSON
        Ok(result.data)
    }
    
    fn get_available_tools(&self) -> Vec<String> {
        self.get_available_tools()
    }
    
    fn has_tool(&self, tool_name: &str) -> bool {
        self.tools.contains_key(tool_name)
    }
}

impl Default for ContextAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for ParameterValidation {
    fn default() -> Self {
        Self {
            min: None,
            max: None,
            min_length: None,
            max_length: None,
            pattern: None,
            allowed_values: None,
        }
    }
}