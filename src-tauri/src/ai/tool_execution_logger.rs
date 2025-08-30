use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::ai::AIResult;
use crate::ai::tool_registry::{ToolExecutionResult, ToolContext};
use crate::database::repositories::{
    AiRepository, CreateDetailedToolExecutionLogRequest, CreateToolUsageAnalyticsRequest,
    ToolExecutionLogFilter, SessionToolStats
};



/// Comprehensive tool execution logger with performance metrics and analytics
pub struct ToolExecutionLogger {
    ai_repo: AiRepository,
    session_id: String,
    performance_tracker: PerformanceTracker,
}

/// Performance tracking for tool executions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTracker {
    /// Total number of tool executions in this session
    pub total_executions: u64,
    
    /// Successful executions
    pub successful_executions: u64,
    
    /// Failed executions
    pub failed_executions: u64,
    
    /// Average execution time per tool
    pub avg_execution_times: HashMap<String, f64>,
    
    /// Tool usage frequency
    pub tool_usage_counts: HashMap<String, u64>,
    
    /// Error patterns
    pub error_patterns: HashMap<String, u64>,
    
    /// Session start time
    pub session_start: DateTime<Utc>,
    
    /// Last execution time
    pub last_execution: Option<DateTime<Utc>>,
}

/// Detailed tool execution log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionLog {
    /// Unique log entry ID
    pub id: String,
    
    /// Session ID this execution belongs to
    pub session_id: String,
    
    /// Tool name that was executed
    pub tool_name: String,
    
    /// Parameters passed to the tool
    pub parameters: HashMap<String, serde_json::Value>,
    
    /// Inferred parameters and confidence
    pub inference_info: Option<InferenceInfo>,
    
    /// Execution result
    pub result: ToolExecutionResult,
    
    /// Context at time of execution
    pub context: ToolContext,
    
    /// Execution timestamp
    pub timestamp: DateTime<Utc>,
    
    /// User who triggered the execution
    pub user_id: Option<String>,
    
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Information about parameter inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceInfo {
    /// Confidence score of parameter inference
    pub confidence: f64,
    
    /// Parameters that were inferred vs provided
    pub inferred_parameters: Vec<String>,
    
    /// Parameters that needed confirmation
    pub needed_confirmation: Vec<String>,
    
    /// Explanation of inference process
    pub explanation: String,
    
    /// Alternative parameter sets considered
    pub alternatives_count: usize,
}

/// Analytics data for tool usage patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsageAnalytics {
    /// Time period for this analytics data
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    
    /// Most frequently used tools
    pub most_used_tools: Vec<ToolUsageStats>,
    
    /// Tools with highest success rates
    pub most_reliable_tools: Vec<ToolReliabilityStats>,
    
    /// Average execution times by tool
    pub performance_stats: Vec<ToolPerformanceStats>,
    
    /// Common error patterns
    pub error_analysis: Vec<ErrorPattern>,
    
    /// User behavior patterns
    pub usage_patterns: UsagePatterns,
    
    /// Recommendations for optimization
    pub recommendations: Vec<String>,
}

/// Statistics for individual tool usage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsageStats {
    pub tool_name: String,
    pub usage_count: u64,
    pub percentage_of_total: f64,
    pub avg_executions_per_session: f64,
}

/// Reliability statistics for tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolReliabilityStats {
    pub tool_name: String,
    pub success_rate: f64,
    pub total_executions: u64,
    pub successful_executions: u64,
    pub common_failure_reasons: Vec<String>,
}

/// Performance statistics for tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPerformanceStats {
    pub tool_name: String,
    pub avg_execution_time_ms: f64,
    pub min_execution_time_ms: u64,
    pub max_execution_time_ms: u64,
    pub percentile_95_ms: u64,
}

/// Error pattern analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPattern {
    pub error_type: String,
    pub frequency: u64,
    pub affected_tools: Vec<String>,
    pub common_causes: Vec<String>,
    pub suggested_fixes: Vec<String>,
}

/// User behavior patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsagePatterns {
    /// Peak usage hours
    pub peak_hours: Vec<u32>,
    
    /// Most common tool sequences
    pub common_sequences: Vec<ToolSequence>,
    
    /// Average session length
    pub avg_session_length_minutes: f64,
    
    /// Tools often used together
    pub tool_correlations: Vec<ToolCorrelation>,
}

/// Sequence of tools commonly used together
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSequence {
    pub tools: Vec<String>,
    pub frequency: u64,
    pub avg_time_between_ms: u64,
}

/// Correlation between tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCorrelation {
    pub tool_a: String,
    pub tool_b: String,
    pub correlation_strength: f64,
    pub typical_order: String, // "A_then_B", "B_then_A", or "simultaneous"
}

impl ToolExecutionLogger {
    /// Create a new tool execution logger
    pub fn new(ai_repo: AiRepository, session_id: String) -> Self {
        Self {
            ai_repo,
            session_id: session_id.clone(),
            performance_tracker: PerformanceTracker::new(session_id),
        }
    }
    
    /// Log a tool execution with full context and performance metrics
    pub async fn log_execution(
        &mut self,
        tool_name: &str,
        parameters: HashMap<String, serde_json::Value>,
        inference_info: Option<InferenceInfo>,
        result: ToolExecutionResult,
        context: ToolContext,
        user_id: Option<String>,
    ) -> AIResult<String> {
        let log_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();
        
        // Update performance tracker
        self.performance_tracker.record_execution(tool_name, &result, timestamp);
        
        // Generate metadata and recovery suggestions
        let metadata = self.generate_execution_metadata(tool_name, &result);
        let recovery_suggestions = if !result.success {
            Some(self.generate_recovery_suggestions(tool_name, &result, &parameters))
        } else {
            None
        };
        
        // Determine performance class
        let performance_class = self.classify_performance(result.execution_time_ms);
        
        // Determine tool category
        let tool_category = self.classify_tool_category(tool_name);
        
        // Create detailed log entry
        let create_request = CreateDetailedToolExecutionLogRequest {
            session_id: self.session_id.clone(),
            tool_name: tool_name.to_string(),
            parameters: serde_json::to_string(&parameters).unwrap_or_default(),
            inference_info: inference_info.as_ref().map(|info| serde_json::to_string(info).unwrap_or_default()),
            result: serde_json::to_string(&result).unwrap_or_default(),
            context: serde_json::to_string(&context).unwrap_or_default(),
            user_id,
            execution_time_ms: result.execution_time_ms as i64,
            success: result.success,
            error: result.error.clone(),
            performance_class,
            tool_category,
            metadata: Some(serde_json::to_string(&metadata).unwrap_or_default()),
            recovery_suggestions: recovery_suggestions.map(|suggestions| serde_json::to_string(&suggestions).unwrap_or_default()),
        };
        
        match self.ai_repo.create_detailed_tool_execution_log(create_request).await {
            Ok(_) => {
                // Log performance metrics if this is a significant execution
                if result.execution_time_ms > 1000 || !result.success {
                    self.log_performance_alert(tool_name, &result).await?;
                }
                
                // Check if we should generate analytics
                if self.should_generate_analytics() {
                    if let Err(e) = self.generate_and_store_analytics().await {
                        eprintln!("Failed to generate analytics: {}", e);
                    }
                }
                
                Ok(log_id)
            }
            Err(e) => {
                // Don't fail the tool execution if logging fails, but log the error
                eprintln!("Failed to log tool execution: {}", e);
                Ok(log_id)
            }
        }
    }
    
    /// Log a performance alert for slow or failed executions
    async fn log_performance_alert(
        &self,
        tool_name: &str,
        result: &ToolExecutionResult,
    ) -> AIResult<()> {
        let alert_type = if !result.success {
            "execution_failure"
        } else if result.execution_time_ms > 5000 {
            "slow_execution"
        } else {
            "performance_warning"
        };
        
        let alert_data = serde_json::json!({
            "alert_type": alert_type,
            "tool_name": tool_name,
            "execution_time_ms": result.execution_time_ms,
            "success": result.success,
            "error": result.error,
            "timestamp": Utc::now().to_rfc3339(),
            "session_id": self.session_id
        });
        
        // In a real implementation, this might send to a monitoring system
        println!("Performance Alert: {}", alert_data);
        
        Ok(())
    }
    
    /// Generate metadata for the execution
    fn generate_execution_metadata(
        &self,
        tool_name: &str,
        result: &ToolExecutionResult,
    ) -> HashMap<String, serde_json::Value> {
        let mut metadata = HashMap::new();
        
        // Performance classification
        let performance_class = if result.execution_time_ms < 100 {
            "fast"
        } else if result.execution_time_ms < 1000 {
            "normal"
        } else if result.execution_time_ms < 5000 {
            "slow"
        } else {
            "very_slow"
        };
        
        metadata.insert("performance_class".to_string(), serde_json::Value::String(performance_class.to_string()));
        
        // Success classification
        let success_class = if result.success {
            "success"
        } else if result.error.is_some() {
            "error"
        } else {
            "unknown_failure"
        };
        
        metadata.insert("success_class".to_string(), serde_json::Value::String(success_class.to_string()));
        
        // Tool category (inferred from name)
        let category = match tool_name {
            name if name.contains("task") => "task_management",
            name if name.contains("timer") => "time_tracking",
            name if name.contains("analyze") => "analytics",
            _ => "general",
        };
        
        metadata.insert("tool_category".to_string(), serde_json::Value::String(category.to_string()));
        
        // Execution context
        metadata.insert("execution_id".to_string(), serde_json::Value::String(Uuid::new_v4().to_string()));
        metadata.insert("logged_at".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
        
        metadata
    }
    
    /// Get performance statistics for the current session
    pub fn get_session_performance(&self) -> &PerformanceTracker {
        &self.performance_tracker
    }
    
    /// Generate analytics report for tool usage
    pub async fn generate_analytics_report(
        &self,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AIResult<ToolUsageAnalytics> {
        // Get tool execution logs from database
        let logs: Vec<serde_json::Value> = vec![]; // Placeholder - would implement actual database query
        
        // Analyze usage patterns
        let most_used_tools = self.analyze_tool_usage(&logs);
        let most_reliable_tools = self.analyze_tool_reliability(&logs);
        let performance_stats = self.analyze_tool_performance(&logs);
        let error_analysis = self.analyze_error_patterns(&logs);
        let usage_patterns = self.analyze_usage_patterns(&logs);
        let recommendations = self.generate_recommendations(&logs);
        
        Ok(ToolUsageAnalytics {
            period_start,
            period_end,
            most_used_tools,
            most_reliable_tools,
            performance_stats,
            error_analysis,
            usage_patterns,
            recommendations,
        })
    }
    
    /// Analyze tool usage frequency
    fn analyze_tool_usage(&self, logs: &[serde_json::Value]) -> Vec<ToolUsageStats> {
        let mut usage_counts: HashMap<String, u64> = HashMap::new();
        let total_executions = logs.len() as u64;
        
        for log in logs {
            if let Some(tool_name) = log.get("tool_name").and_then(|v| v.as_str()) {
                *usage_counts.entry(tool_name.to_string()).or_insert(0) += 1;
            }
        }
        
        let mut stats: Vec<ToolUsageStats> = usage_counts
            .into_iter()
            .map(|(tool_name, count)| ToolUsageStats {
                tool_name,
                usage_count: count,
                percentage_of_total: (count as f64 / total_executions as f64) * 100.0,
                avg_executions_per_session: count as f64, // Simplified - would need session data
            })
            .collect();
        
        stats.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));
        stats.truncate(10); // Top 10
        
        stats
    }
    
    /// Analyze tool reliability
    fn analyze_tool_reliability(&self, logs: &[serde_json::Value]) -> Vec<ToolReliabilityStats> {
        let mut tool_stats: HashMap<String, (u64, u64)> = HashMap::new(); // (total, successful)
        
        for log in logs {
            if let (Some(tool_name), Some(success)) = (
                log.get("tool_name").and_then(|v| v.as_str()),
                log.get("success").and_then(|v| v.as_bool()),
            ) {
                let (total, successful) = tool_stats.entry(tool_name.to_string()).or_insert((0, 0));
                *total += 1;
                if success {
                    *successful += 1;
                }
            }
        }
        
        let mut stats: Vec<ToolReliabilityStats> = tool_stats
            .into_iter()
            .map(|(tool_name, (total, successful))| ToolReliabilityStats {
                tool_name,
                success_rate: (successful as f64 / total as f64) * 100.0,
                total_executions: total,
                successful_executions: successful,
                common_failure_reasons: vec![], // Would need error analysis
            })
            .collect();
        
        stats.sort_by(|a, b| b.success_rate.partial_cmp(&a.success_rate).unwrap_or(std::cmp::Ordering::Equal));
        
        stats
    }
    
    /// Analyze tool performance
    fn analyze_tool_performance(&self, logs: &[serde_json::Value]) -> Vec<ToolPerformanceStats> {
        let mut tool_times: HashMap<String, Vec<u64>> = HashMap::new();
        
        for log in logs {
            if let (Some(tool_name), Some(exec_time)) = (
                log.get("tool_name").and_then(|v| v.as_str()),
                log.get("execution_time_ms").and_then(|v| v.as_u64()),
            ) {
                tool_times.entry(tool_name.to_string()).or_insert_with(Vec::new).push(exec_time);
            }
        }
        
        let mut stats: Vec<ToolPerformanceStats> = tool_times
            .into_iter()
            .map(|(tool_name, times)| {
                let avg = times.iter().sum::<u64>() as f64 / times.len() as f64;
                let min = *times.iter().min().unwrap_or(&0);
                let max = *times.iter().max().unwrap_or(&0);
                
                // Calculate 95th percentile
                let mut sorted_times = times.clone();
                sorted_times.sort();
                let p95_index = (sorted_times.len() as f64 * 0.95) as usize;
                let p95 = sorted_times.get(p95_index).copied().unwrap_or(max);
                
                ToolPerformanceStats {
                    tool_name,
                    avg_execution_time_ms: avg,
                    min_execution_time_ms: min,
                    max_execution_time_ms: max,
                    percentile_95_ms: p95,
                }
            })
            .collect();
        
        stats.sort_by(|a, b| a.avg_execution_time_ms.partial_cmp(&b.avg_execution_time_ms).unwrap_or(std::cmp::Ordering::Equal));
        
        stats
    }
    
    /// Analyze error patterns
    fn analyze_error_patterns(&self, _logs: &[serde_json::Value]) -> Vec<ErrorPattern> {
        // Simplified implementation - would analyze actual error data
        vec![
            ErrorPattern {
                error_type: "validation_error".to_string(),
                frequency: 5,
                affected_tools: vec!["create_task".to_string(), "update_task".to_string()],
                common_causes: vec!["Missing required parameters".to_string()],
                suggested_fixes: vec!["Improve parameter inference".to_string()],
            }
        ]
    }
    
    /// Analyze usage patterns
    fn analyze_usage_patterns(&self, _logs: &[serde_json::Value]) -> UsagePatterns {
        // Simplified implementation - would analyze temporal and sequential patterns
        UsagePatterns {
            peak_hours: vec![9, 10, 14, 15], // 9-10 AM, 2-3 PM
            common_sequences: vec![
                ToolSequence {
                    tools: vec!["create_task".to_string(), "start_timer".to_string()],
                    frequency: 15,
                    avg_time_between_ms: 30000, // 30 seconds
                }
            ],
            avg_session_length_minutes: 45.0,
            tool_correlations: vec![
                ToolCorrelation {
                    tool_a: "get_tasks".to_string(),
                    tool_b: "start_timer".to_string(),
                    correlation_strength: 0.7,
                    typical_order: "A_then_B".to_string(),
                }
            ],
        }
    }
    
    /// Generate optimization recommendations
    fn generate_recommendations(&self, logs: &[serde_json::Value]) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Analyze execution times
        let slow_tools = logs.iter()
            .filter_map(|log| {
                if let (Some(tool_name), Some(exec_time)) = (
                    log.get("tool_name").and_then(|v| v.as_str()),
                    log.get("execution_time_ms").and_then(|v| v.as_u64()),
                ) {
                    if exec_time > 2000 {
                        Some(tool_name)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect::<std::collections::HashSet<_>>();
        
        if !slow_tools.is_empty() {
            recommendations.push(format!(
                "Consider optimizing these slow tools: {}",
                slow_tools.into_iter().collect::<Vec<_>>().join(", ")
            ));
        }
        
        // Analyze error rates
        let failed_executions = logs.iter()
            .filter(|log| log.get("success").and_then(|v| v.as_bool()) == Some(false))
            .count();
        
        let error_rate = (failed_executions as f64 / logs.len() as f64) * 100.0;
        
        if error_rate > 10.0 {
            recommendations.push("High error rate detected. Review parameter inference and validation logic.".to_string());
        }
        
        // Add general recommendations
        recommendations.push("Consider caching frequently accessed data to improve performance.".to_string());
        recommendations.push("Implement retry logic for transient failures.".to_string());
        
        recommendations
    }
    
    /// Classify performance based on execution time
    fn classify_performance(&self, execution_time_ms: u64) -> String {
        match execution_time_ms {
            0..=100 => "fast".to_string(),
            101..=1000 => "normal".to_string(),
            1001..=5000 => "slow".to_string(),
            _ => "very_slow".to_string(),
        }
    }
    
    /// Classify tool category based on tool name
    fn classify_tool_category(&self, tool_name: &str) -> String {
        match tool_name {
            name if name.contains("task") => "task_management".to_string(),
            name if name.contains("timer") => "time_tracking".to_string(),
            name if name.contains("analyze") || name.contains("stats") => "analytics".to_string(),
            name if name.contains("get") || name.contains("list") => "data_retrieval".to_string(),
            name if name.contains("create") || name.contains("update") || name.contains("delete") => "data_modification".to_string(),
            _ => "general".to_string(),
        }
    }
    
    /// Generate recovery suggestions for failed executions
    fn generate_recovery_suggestions(
        &self,
        tool_name: &str,
        result: &ToolExecutionResult,
        parameters: &HashMap<String, serde_json::Value>,
    ) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        if let Some(error) = &result.error {
            // Analyze error type and provide specific suggestions
            if error.contains("not found") || error.contains("missing") {
                suggestions.push("Check if the referenced resource exists".to_string());
                suggestions.push("Verify the ID or name parameter is correct".to_string());
            }
            
            if error.contains("permission") || error.contains("unauthorized") {
                suggestions.push("Check user permissions for this operation".to_string());
                suggestions.push("Ensure the user has the required access level".to_string());
            }
            
            if error.contains("validation") || error.contains("invalid") {
                suggestions.push("Review the parameter values for correctness".to_string());
                suggestions.push("Check parameter types and formats".to_string());
            }
            
            if error.contains("timeout") || error.contains("connection") {
                suggestions.push("Retry the operation after a short delay".to_string());
                suggestions.push("Check system resources and network connectivity".to_string());
            }
            
            if error.contains("database") || error.contains("storage") {
                suggestions.push("Check database connectivity and integrity".to_string());
                suggestions.push("Verify sufficient storage space is available".to_string());
            }
        }
        
        // Tool-specific suggestions
        match tool_name {
            "create_task" => {
                if parameters.get("title").is_none() {
                    suggestions.push("Ensure task title is provided".to_string());
                }
                suggestions.push("Try simplifying the task description".to_string());
            },
            "update_task" => {
                suggestions.push("Verify the task ID exists".to_string());
                suggestions.push("Check if the task is not already completed".to_string());
            },
            "start_timer" => {
                suggestions.push("Ensure no other timer is currently running".to_string());
                suggestions.push("Check if a valid task is selected".to_string());
            },
            "stop_timer" => {
                suggestions.push("Verify a timer is currently running".to_string());
                suggestions.push("Check timer session state".to_string());
            },
            _ => {
                suggestions.push("Review the tool parameters and try again".to_string());
            }
        }
        
        // General suggestions if no specific ones were added
        if suggestions.is_empty() {
            suggestions.push("Retry the operation with the same parameters".to_string());
            suggestions.push("Check system logs for more detailed error information".to_string());
            suggestions.push("Contact support if the issue persists".to_string());
        }
        
        suggestions
    }
    
    /// Check if analytics should be generated (e.g., every 100 executions)
    fn should_generate_analytics(&self) -> bool {
        self.performance_tracker.total_executions % 100 == 0 && self.performance_tracker.total_executions > 0
    }
    
    /// Generate and store analytics based on recent tool executions
    async fn generate_and_store_analytics(&self) -> AIResult<()> {
        let end_time = Utc::now();
        let start_time = end_time - chrono::Duration::hours(24); // Last 24 hours
        
        // Get recent tool execution logs
        let filter = ToolExecutionLogFilter {
            session_id: Some(self.session_id.clone()),
            start_time: Some(start_time),
            end_time: Some(end_time),
            limit: Some(1000),
            ..Default::default()
        };
        
        let logs = self.ai_repo.find_tool_execution_logs(filter).await
            .map_err(|e| crate::ai::AIServiceError::internal_error(format!("Failed to fetch logs: {}", e)))?;
        
        if logs.is_empty() {
            return Ok(());
        }
        
        // Generate analytics
        let analytics = self.generate_analytics_from_logs(&logs).await?;
        
        // Store analytics
        let create_request = CreateToolUsageAnalyticsRequest {
            period_start: start_time,
            period_end: end_time,
            analytics_type: "session".to_string(),
            most_used_tools: serde_json::to_string(&analytics.most_used_tools).unwrap_or_default(),
            most_reliable_tools: serde_json::to_string(&analytics.most_reliable_tools).unwrap_or_default(),
            performance_stats: serde_json::to_string(&analytics.performance_stats).unwrap_or_default(),
            error_analysis: serde_json::to_string(&analytics.error_analysis).unwrap_or_default(),
            usage_patterns: serde_json::to_string(&analytics.usage_patterns).unwrap_or_default(),
            recommendations: serde_json::to_string(&analytics.recommendations).unwrap_or_default(),
            total_executions: logs.len() as i64,
            successful_executions: logs.iter().filter(|log| log.success).count() as i64,
            avg_execution_time_ms: logs.iter().map(|log| log.execution_time_ms as f64).sum::<f64>() / logs.len() as f64,
        };
        
        self.ai_repo.create_tool_usage_analytics(create_request).await
            .map_err(|e| crate::ai::AIServiceError::internal_error(format!("Failed to store analytics: {}", e)))?;
        
        Ok(())
    }
    
    /// Generate analytics from tool execution logs
    async fn generate_analytics_from_logs(
        &self,
        logs: &[crate::database::entities::tool_execution_logs::Model],
    ) -> AIResult<ToolUsageAnalytics> {
        let period_start = logs.iter().map(|log| log.timestamp).min().unwrap_or_else(Utc::now);
        let period_end = logs.iter().map(|log| log.timestamp).max().unwrap_or_else(Utc::now);
        
        // Analyze tool usage
        let mut tool_counts: HashMap<String, u64> = HashMap::new();
        let mut tool_times: HashMap<String, Vec<u64>> = HashMap::new();
        let mut tool_success: HashMap<String, (u64, u64)> = HashMap::new(); // (total, successful)
        let mut error_patterns: HashMap<String, u64> = HashMap::new();
        
        for log in logs {
            // Count usage
            *tool_counts.entry(log.tool_name.clone()).or_insert(0) += 1;
            
            // Track execution times
            tool_times.entry(log.tool_name.clone()).or_insert_with(Vec::new).push(log.execution_time_ms as u64);
            
            // Track success rates
            let (total, successful) = tool_success.entry(log.tool_name.clone()).or_insert((0, 0));
            *total += 1;
            if log.success {
                *successful += 1;
            }
            
            // Track error patterns
            if !log.success {
                if let Some(error) = &log.error {
                    *error_patterns.entry(error.clone()).or_insert(0) += 1;
                }
            }
        }
        
        // Generate most used tools
        let mut most_used_tools: Vec<ToolUsageStats> = tool_counts
            .into_iter()
            .map(|(tool_name, count)| ToolUsageStats {
                tool_name,
                usage_count: count,
                percentage_of_total: (count as f64 / logs.len() as f64) * 100.0,
                avg_executions_per_session: count as f64, // Simplified
            })
            .collect();
        most_used_tools.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));
        most_used_tools.truncate(10);
        
        // Generate reliability stats
        let mut most_reliable_tools: Vec<ToolReliabilityStats> = tool_success
            .into_iter()
            .map(|(tool_name, (total, successful))| ToolReliabilityStats {
                tool_name,
                success_rate: (successful as f64 / total as f64) * 100.0,
                total_executions: total,
                successful_executions: successful,
                common_failure_reasons: vec![], // Would need more detailed error analysis
            })
            .collect();
        most_reliable_tools.sort_by(|a, b| b.success_rate.partial_cmp(&a.success_rate).unwrap_or(std::cmp::Ordering::Equal));
        
        // Generate performance stats
        let mut performance_stats: Vec<ToolPerformanceStats> = tool_times
            .into_iter()
            .map(|(tool_name, times)| {
                let avg = times.iter().sum::<u64>() as f64 / times.len() as f64;
                let min = *times.iter().min().unwrap_or(&0);
                let max = *times.iter().max().unwrap_or(&0);
                
                let mut sorted_times = times.clone();
                sorted_times.sort();
                let p95_index = (sorted_times.len() as f64 * 0.95) as usize;
                let p95 = sorted_times.get(p95_index).copied().unwrap_or(max);
                
                ToolPerformanceStats {
                    tool_name,
                    avg_execution_time_ms: avg,
                    min_execution_time_ms: min,
                    max_execution_time_ms: max,
                    percentile_95_ms: p95,
                }
            })
            .collect();
        performance_stats.sort_by(|a, b| a.avg_execution_time_ms.partial_cmp(&b.avg_execution_time_ms).unwrap_or(std::cmp::Ordering::Equal));
        
        // Generate error analysis
        let error_analysis: Vec<ErrorPattern> = error_patterns
            .into_iter()
            .map(|(error_type, frequency)| ErrorPattern {
                error_type: error_type.clone(),
                frequency,
                affected_tools: vec![], // Would need cross-reference
                common_causes: vec![error_type.clone()],
                suggested_fixes: self.generate_error_fix_suggestions(&error_type),
            })
            .collect();
        
        // Generate usage patterns (simplified)
        let usage_patterns = UsagePatterns {
            peak_hours: vec![9, 10, 14, 15], // Would analyze actual timestamps
            common_sequences: vec![], // Would need sequence analysis
            avg_session_length_minutes: 45.0, // Would calculate from session data
            tool_correlations: vec![], // Would need correlation analysis
        };
        
        // Generate recommendations
        let recommendations = self.generate_optimization_recommendations(&most_used_tools, &most_reliable_tools, &performance_stats);
        
        Ok(ToolUsageAnalytics {
            period_start,
            period_end,
            most_used_tools,
            most_reliable_tools,
            performance_stats,
            error_analysis,
            usage_patterns,
            recommendations,
        })
    }
    
    /// Generate error fix suggestions based on error type
    fn generate_error_fix_suggestions(&self, error_type: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        if error_type.contains("validation") {
            suggestions.push("Improve parameter validation logic".to_string());
            suggestions.push("Add better error messages for validation failures".to_string());
        }
        
        if error_type.contains("not found") {
            suggestions.push("Add existence checks before operations".to_string());
            suggestions.push("Improve error handling for missing resources".to_string());
        }
        
        if error_type.contains("timeout") {
            suggestions.push("Increase timeout values for slow operations".to_string());
            suggestions.push("Add retry logic with exponential backoff".to_string());
        }
        
        if suggestions.is_empty() {
            suggestions.push("Review error handling logic".to_string());
            suggestions.push("Add more specific error messages".to_string());
        }
        
        suggestions
    }
    
    /// Generate optimization recommendations based on analytics
    fn generate_optimization_recommendations(
        &self,
        most_used_tools: &[ToolUsageStats],
        most_reliable_tools: &[ToolReliabilityStats],
        performance_stats: &[ToolPerformanceStats],
    ) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Recommend optimizing frequently used slow tools
        for tool_usage in most_used_tools.iter().take(5) {
            if let Some(perf_stat) = performance_stats.iter().find(|p| p.tool_name == tool_usage.tool_name) {
                if perf_stat.avg_execution_time_ms > 1000.0 {
                    recommendations.push(format!(
                        "Optimize '{}' tool - it's frequently used ({} times) but slow ({:.0}ms avg)",
                        tool_usage.tool_name, tool_usage.usage_count, perf_stat.avg_execution_time_ms
                    ));
                }
            }
        }
        
        // Recommend improving reliability of unreliable tools
        for tool_reliability in most_reliable_tools.iter() {
            if tool_reliability.success_rate < 90.0 && tool_reliability.total_executions > 5 {
                recommendations.push(format!(
                    "Improve reliability of '{}' tool - success rate is {:.1}%",
                    tool_reliability.tool_name, tool_reliability.success_rate
                ));
            }
        }
        
        // General recommendations
        if performance_stats.iter().any(|p| p.avg_execution_time_ms > 2000.0) {
            recommendations.push("Consider implementing caching for slow operations".to_string());
        }
        
        if most_reliable_tools.iter().any(|r| r.success_rate < 95.0) {
            recommendations.push("Review error handling and add more robust validation".to_string());
        }
        
        recommendations.push("Monitor tool usage patterns to identify optimization opportunities".to_string());
        
        recommendations
    }
    
    /// Get comprehensive session statistics
    pub async fn get_session_statistics(&self) -> AIResult<SessionToolStats> {
        self.ai_repo.get_session_tool_stats(&self.session_id).await
            .map_err(|e| crate::ai::AIServiceError::internal_error(format!("Failed to get session stats: {}", e)))
    }
    
    /// Get tool execution logs for analysis
    pub async fn get_execution_logs(
        &self,
        filter: ToolExecutionLogFilter,
    ) -> AIResult<Vec<crate::database::entities::tool_execution_logs::Model>> {
        self.ai_repo.find_tool_execution_logs(filter).await
            .map_err(|e| crate::ai::AIServiceError::internal_error(format!("Failed to get execution logs: {}", e)))
    }
}

impl PerformanceTracker {
    /// Create a new performance tracker
    pub fn new(_session_id: String) -> Self {
        Self {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            avg_execution_times: HashMap::new(),
            tool_usage_counts: HashMap::new(),
            error_patterns: HashMap::new(),
            session_start: Utc::now(),
            last_execution: None,
        }
    }
    
    /// Record a tool execution
    pub fn record_execution(
        &mut self,
        tool_name: &str,
        result: &ToolExecutionResult,
        timestamp: DateTime<Utc>,
    ) {
        self.total_executions += 1;
        self.last_execution = Some(timestamp);
        
        if result.success {
            self.successful_executions += 1;
        } else {
            self.failed_executions += 1;
            
            // Track error patterns
            if let Some(error) = &result.error {
                *self.error_patterns.entry(error.clone()).or_insert(0) += 1;
            }
        }
        
        // Update usage count
        *self.tool_usage_counts.entry(tool_name.to_string()).or_insert(0) += 1;
        
        // Update average execution time
        let current_avg = self.avg_execution_times.get(tool_name).copied().unwrap_or(0.0);
        let usage_count = self.tool_usage_counts.get(tool_name).copied().unwrap_or(1);
        
        let new_avg = ((current_avg * (usage_count - 1) as f64) + result.execution_time_ms as f64) / usage_count as f64;
        self.avg_execution_times.insert(tool_name.to_string(), new_avg);
    }
    
    /// Get success rate as percentage
    pub fn success_rate(&self) -> f64 {
        if self.total_executions == 0 {
            0.0
        } else {
            (self.successful_executions as f64 / self.total_executions as f64) * 100.0
        }
    }
    
    /// Get session duration in minutes
    pub fn session_duration_minutes(&self) -> f64 {
        let end_time = self.last_execution.unwrap_or_else(Utc::now);
        (end_time - self.session_start).num_minutes() as f64
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use chrono::Utc;

    #[test]
    fn test_classify_performance() {
        let logger = ToolExecutionLogger::new(
            AiRepository::new(std::sync::Arc::new(sea_orm::DatabaseConnection::Disconnected)),
            "test".to_string()
        );
        
        assert_eq!(logger.classify_performance(50), "fast");
        assert_eq!(logger.classify_performance(500), "normal");
        assert_eq!(logger.classify_performance(2000), "slow");
        assert_eq!(logger.classify_performance(10000), "very_slow");
    }

    #[test]
    fn test_classify_tool_category() {
        let logger = ToolExecutionLogger::new(
            AiRepository::new(std::sync::Arc::new(sea_orm::DatabaseConnection::Disconnected)),
            "test".to_string()
        );
        
        assert_eq!(logger.classify_tool_category("create_task"), "task_management");
        assert_eq!(logger.classify_tool_category("start_timer"), "time_tracking");
        assert_eq!(logger.classify_tool_category("analyze_productivity"), "analytics");
        assert_eq!(logger.classify_tool_category("get_tasks"), "data_retrieval");
        assert_eq!(logger.classify_tool_category("update_task"), "data_modification");
        assert_eq!(logger.classify_tool_category("unknown_tool"), "general");
    }

    #[test]
    fn test_performance_tracker() {
        let mut tracker = PerformanceTracker::new("test_session".to_string());
        
        let result1 = ToolExecutionResult {
            success: true,
            data: serde_json::Value::Null,
            message: "Success".to_string(),
            execution_time_ms: 100,
            error: None,
            suggestions: vec![],
            metadata: HashMap::new(),
        };
        
        let result2 = ToolExecutionResult {
            success: false,
            data: serde_json::Value::Null,
            message: "Failed".to_string(),
            execution_time_ms: 200,
            error: Some("Test error".to_string()),
            suggestions: vec![],
            metadata: HashMap::new(),
        };
        
        tracker.record_execution("test_tool", &result1, Utc::now());
        tracker.record_execution("test_tool", &result2, Utc::now());
        
        assert_eq!(tracker.total_executions, 2);
        assert_eq!(tracker.successful_executions, 1);
        assert_eq!(tracker.failed_executions, 1);
        assert_eq!(tracker.success_rate(), 50.0);
        
        // Check average execution time
        let avg_time = tracker.avg_execution_times.get("test_tool").unwrap();
        assert_eq!(*avg_time, 150.0); // (100 + 200) / 2
        
        // Check error pattern tracking
        assert_eq!(tracker.error_patterns.get("Test error"), Some(&1));
    }
}