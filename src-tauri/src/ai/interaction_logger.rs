use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::ai::{AIResult, AIServiceError, ModelInfo};
use crate::database::{get_database, repositories::AiRepository};

/// Configuration for interaction logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Whether logging is enabled
    pub enabled: bool,
    
    /// Maximum number of logs to retain
    pub max_logs: u64,
    
    /// Retention period in days
    pub retention_days: u64,
    
    /// Whether to log sensitive data
    pub log_sensitive_data: bool,
    
    /// Log level (debug, info, warn, error)
    pub log_level: String,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_logs: 10000,
            retention_days: 30,
            log_sensitive_data: false,
            log_level: "info".to_string(),
        }
    }
}

/// Represents a complete AI interaction log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractionLog {
    /// Unique identifier for this interaction
    pub id: String,
    
    /// Session identifier for grouping related interactions
    pub session_id: String,
    
    /// Timestamp when the interaction started
    pub timestamp: DateTime<Utc>,
    
    /// The user's original message
    pub user_message: String,
    
    /// System prompt used (if any)
    pub system_prompt: Option<String>,
    
    /// Context provided with the request
    pub context: HashMap<String, serde_json::Value>,
    
    /// The AI's final response
    pub ai_response: String,
    
    /// Model information used for this interaction
    pub model_info: ModelInfo,
    
    /// Performance metrics for this interaction
    pub performance_metrics: PerformanceMetrics,
    
    /// Any error that occurred during processing
    pub error: Option<String>,
    
    /// Data classification level
    pub data_classification: DataClassification,
}

/// Performance metrics for an AI interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Total processing time in milliseconds
    pub total_time_ms: u64,
    
    /// Time spent on LLM generation
    pub llm_time_ms: u64,
    
    /// Number of tokens in the request
    pub input_tokens: Option<u32>,
    
    /// Number of tokens in the response
    pub output_tokens: Option<u32>,
    
    /// Memory usage during processing
    pub memory_usage_mb: Option<f64>,
}

/// Data classification levels for privacy and security
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataClassification {
    /// Public data that can be freely shared
    Public,
    
    /// Internal data for organizational use
    Internal,
    
    /// Confidential data with restricted access
    Confidential,
    
    /// Sensitive data requiring special handling
    Sensitive,
}

impl Default for DataClassification {
    fn default() -> Self {
        Self::Internal
    }
}

/// Manages logging of AI interactions
pub struct InteractionLogger {
    /// Logging configuration
    config: LoggingConfig,
}

impl InteractionLogger {
    /// Create a new interaction logger
    pub fn new(config: LoggingConfig) -> Self {
        Self { config }
    }
    
    /// Create a new interaction logger with default configuration
    pub fn with_defaults() -> Self {
        Self::new(LoggingConfig::default())
    }
    
    /// Log a complete AI interaction
    pub async fn log_interaction(&self, log: InteractionLog) -> AIResult<()> {
        if !self.config.enabled {
            return Ok(());
        }
        
        // Store in database using existing AI repository
        let db = get_database().await
            .map_err(|e| AIServiceError::internal_error(format!("Database error: {}", e)))?;
        
        let repo = AiRepository::new(db);
        
        // Convert to the existing AI interaction format
        let tools_used = if log.context.is_empty() {
            None
        } else {
            // Convert context keys to a vector of strings
            Some(log.context.keys().cloned().collect())
        };
        
        let request = crate::database::repositories::ai_repository::CreateAiInteractionRequest {
            message: log.user_message,
            response: log.ai_response,
            action_taken: Some(format!("{}:{}", log.model_info.provider, log.session_id)),
            reasoning: log.system_prompt,
            tools_used,
            confidence: None, // Could be derived from performance metrics
        };
        
        repo.create_interaction(request).await
            .map_err(|e| AIServiceError::internal_error(format!("Failed to store interaction: {}", e)))?;
        
        Ok(())
    }
    
    /// Log an interaction with automatic ID and timestamp generation
    pub async fn log_interaction_simple(
        &self,
        session_id: String,
        user_message: String,
        ai_response: String,
        model_info: ModelInfo,
        performance_metrics: PerformanceMetrics,
    ) -> AIResult<()> {
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id,
            timestamp: Utc::now(),
            user_message,
            system_prompt: None,
            context: HashMap::new(),
            ai_response,
            model_info,
            performance_metrics,
            error: None,
            data_classification: DataClassification::default(),
        };
        
        self.log_interaction(log).await
    }
    
    /// Log an error during AI processing
    pub async fn log_error(
        &self,
        session_id: String,
        user_message: String,
        error: &AIServiceError,
        model_info: Option<ModelInfo>,
    ) -> AIResult<()> {
        if !self.config.enabled {
            return Ok(());
        }
        
        let default_model = ModelInfo {
            id: "unknown".to_string(),
            name: "Unknown Model".to_string(),
            provider: "unknown".to_string(),
            version: None,
            max_context_length: None,
            metadata: HashMap::new(),
        };
        
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id,
            timestamp: Utc::now(),
            user_message,
            system_prompt: None,
            context: HashMap::new(),
            ai_response: String::new(),
            model_info: model_info.unwrap_or(default_model),
            performance_metrics: PerformanceMetrics {
                total_time_ms: 0,
                llm_time_ms: 0,
                input_tokens: None,
                output_tokens: None,
                memory_usage_mb: None,
            },
            error: Some(error.to_string()),
            data_classification: DataClassification::default(),
        };
        
        self.log_interaction(log).await
    }
    
    /// Retrieve recent interaction logs
    pub async fn get_recent_logs(&self, limit: u64) -> AIResult<Vec<InteractionLog>> {
        let db = get_database().await
            .map_err(|e| AIServiceError::internal_error(format!("Database error: {}", e)))?;
        
        let repo = AiRepository::new(db);
        
        let interactions = repo.get_recent_interactions(limit).await
            .map_err(|e| AIServiceError::internal_error(format!("Failed to retrieve logs: {}", e)))?;
        
        // Convert from database format to our log format
        let logs = interactions.into_iter().map(|interaction| {
            // Parse action_taken to extract provider and session_id
            let (provider, session_id) = if let Some(action) = &interaction.action_taken {
                if let Some((p, s)) = action.split_once(':') {
                    (p.to_string(), s.to_string())
                } else {
                    ("unknown".to_string(), "unknown".to_string())
                }
            } else {
                ("unknown".to_string(), "unknown".to_string())
            };
            
            // Parse tools_used as context
            let context: HashMap<String, serde_json::Value> = interaction.tools_used
                .and_then(|tools| serde_json::from_str(&tools).ok())
                .unwrap_or_default();
            
            InteractionLog {
                id: interaction.id,
                session_id,
                timestamp: interaction.created_at,
                user_message: interaction.message,
                system_prompt: interaction.reasoning,
                context,
                ai_response: interaction.response,
                model_info: ModelInfo {
                    id: provider.clone(),
                    name: provider.clone(),
                    provider,
                    version: None,
                    max_context_length: None,
                    metadata: HashMap::new(),
                },
                performance_metrics: PerformanceMetrics {
                    total_time_ms: 0, // Not stored in current schema
                    llm_time_ms: 0,
                    input_tokens: None,
                    output_tokens: None,
                    memory_usage_mb: None,
                },
                error: None,
                data_classification: DataClassification::Internal,
            }
        }).collect();
        
        Ok(logs)
    }
    
    /// Clean up old logs based on retention policy
    pub async fn cleanup_old_logs(&self) -> AIResult<u64> {
        if !self.config.enabled {
            return Ok(0);
        }
        
        let db = get_database().await
            .map_err(|e| AIServiceError::internal_error(format!("Database error: {}", e)))?;
        
        let repo = AiRepository::new(db);
        
        let deleted_count = repo.clear_old_interactions(
            Utc::now() - chrono::Duration::days(self.config.retention_days as i64)
        ).await
        .map_err(|e| AIServiceError::internal_error(format!("Failed to cleanup logs: {}", e)))?;
        
        Ok(deleted_count)
    }
    
    /// Update logging configuration
    pub fn update_config(&mut self, config: LoggingConfig) {
        self.config = config;
    }
    
    /// Get current logging configuration
    pub fn get_config(&self) -> &LoggingConfig {
        &self.config
    }
    
    /// Log raw LLM interaction (prompt and response)
    pub async fn log_raw_llm_interaction(
        &self,
        session_id: String,
        turn: u32,
        prompt: String,
        response: String,
        model_info: ModelInfo,
        duration_ms: u64,
    ) -> AIResult<()> {
        if !self.config.enabled {
            log::debug!("Interaction logging disabled, skipping raw LLM log");
            return Ok(());
        }
        
        log::info!("Logging raw LLM interaction - session: {}, turn: {}, prompt: {} chars, response: {} chars", 
                  session_id, turn, prompt.len(), response.len());
        
        // Create context for this raw interaction
        let mut context = HashMap::new();
        context.insert("interaction_type".to_string(), serde_json::Value::String("raw_llm".to_string()));
        context.insert("turn".to_string(), serde_json::Value::Number(serde_json::Number::from(turn)));
        context.insert("prompt_length".to_string(), serde_json::Value::Number(serde_json::Number::from(prompt.len())));
        context.insert("response_length".to_string(), serde_json::Value::Number(serde_json::Number::from(response.len())));
        
        // Include full prompt and response for debugging (truncate if very long)
        let truncated_prompt = if prompt.len() > 2000 {
            format!("{}...[truncated]", &prompt[..2000])
        } else {
            prompt.clone()
        };
        
        let truncated_response = if response.len() > 1000 {
            format!("{}...[truncated]", &response[..1000])
        } else {
            response.clone()
        };
        
        context.insert("raw_prompt".to_string(), serde_json::Value::String(truncated_prompt));
        context.insert("raw_response".to_string(), serde_json::Value::String(truncated_response));
        
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.clone(),
            timestamp: Utc::now(),
            user_message: format!("LLM Turn {} Request", turn),
            system_prompt: Some(prompt),
            context,
            ai_response: response,
            model_info,
            performance_metrics: PerformanceMetrics {
                total_time_ms: duration_ms,
                llm_time_ms: duration_ms,
                input_tokens: None,
                output_tokens: None,
                memory_usage_mb: None,
            },
            error: None,
            data_classification: DataClassification::Internal,
        };
        
        match self.log_interaction(log).await {
            Ok(()) => {
                log::debug!("Successfully logged raw LLM interaction to database");
                Ok(())
            },
            Err(e) => {
                log::error!("Failed to log raw LLM interaction to database: {}", e);
                Err(e)
            }
        }
    }

    /// Log a complete ReAct reasoning chain
    pub async fn log_react_chain(
        &self,
        chain: &crate::ai::ReActChain,
        model_info: ModelInfo,
    ) -> AIResult<()> {
        if !self.config.enabled {
            return Ok(());
        }
        
        // Create context with ReAct-specific information
        let mut context = HashMap::new();
        context.insert("react_chain_id".to_string(), serde_json::Value::String(chain.id.clone()));
        context.insert("iterations".to_string(), serde_json::Value::Number(serde_json::Number::from(chain.iterations)));
        context.insert("completed".to_string(), serde_json::Value::Bool(chain.completed));
        
        // Add step summary
        let step_summary: Vec<serde_json::Value> = chain.steps.iter().map(|step| {
            serde_json::json!({
                "id": step.id,
                "type": step.step_type,
                "timestamp": step.timestamp,
                "duration_ms": step.duration_ms,
                "has_tool_call": step.tool_call.is_some(),
                "has_tool_result": step.tool_result.is_some(),
                "content_preview": if step.content.len() > 100 { 
                    format!("{}...", &step.content[..100]) 
                } else { 
                    step.content.clone() 
                }
            })
        }).collect();
        context.insert("steps_summary".to_string(), serde_json::Value::Array(step_summary));
        
        // Add detailed steps if configured for debug logging
        if self.config.log_level == "debug" {
            let detailed_steps: Vec<serde_json::Value> = chain.steps.iter().map(|step| {
                serde_json::to_value(step).unwrap_or(serde_json::Value::Null)
            }).collect();
            context.insert("detailed_steps".to_string(), serde_json::Value::Array(detailed_steps));
        }
        
        // Calculate performance metrics
        let performance_metrics = PerformanceMetrics {
            total_time_ms: chain.total_duration_ms.unwrap_or(0),
            llm_time_ms: chain.steps.iter()
                .filter_map(|step| step.duration_ms)
                .sum(),
            input_tokens: None, // Could be calculated if tokenizer is available
            output_tokens: None,
            memory_usage_mb: None,
        };
        
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id: chain.id.clone(),
            timestamp: chain.started_at,
            user_message: chain.user_request.clone(),
            system_prompt: Some("ReAct reasoning chain".to_string()),
            context,
            ai_response: chain.final_response.clone(),
            model_info,
            performance_metrics,
            error: None,
            data_classification: DataClassification::Internal,
        };
        
        self.log_interaction(log).await
    }
    
    /// Log an individual ReAct step for detailed debugging
    pub async fn log_react_step(
        &self,
        chain_id: &str,
        step: &crate::ai::ReActStep,
        model_info: &ModelInfo,
    ) -> AIResult<()> {
        if !self.config.enabled || self.config.log_level != "debug" {
            return Ok(());
        }
        
        // Create context with step-specific information
        let mut context = HashMap::new();
        context.insert("react_chain_id".to_string(), serde_json::Value::String(chain_id.to_string()));
        context.insert("step_id".to_string(), serde_json::Value::String(step.id.clone()));
        context.insert("step_type".to_string(), serde_json::to_value(&step.step_type).unwrap_or(serde_json::Value::Null));
        context.insert("duration_ms".to_string(), step.duration_ms.map(|d| serde_json::Value::Number(serde_json::Number::from(d))).unwrap_or(serde_json::Value::Null));
        
        // Add tool information if present
        if let Some(tool_call) = &step.tool_call {
            context.insert("tool_call".to_string(), serde_json::to_value(tool_call).unwrap_or(serde_json::Value::Null));
        }
        
        if let Some(tool_result) = &step.tool_result {
            context.insert("tool_result".to_string(), serde_json::to_value(tool_result).unwrap_or(serde_json::Value::Null));
        }
        
        // Add metadata
        for (key, value) in &step.metadata {
            context.insert(format!("metadata_{}", key), value.clone());
        }
        
        let performance_metrics = PerformanceMetrics {
            total_time_ms: step.duration_ms.unwrap_or(0),
            llm_time_ms: step.duration_ms.unwrap_or(0),
            input_tokens: None,
            output_tokens: None,
            memory_usage_mb: None,
        };
        
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id: format!("{}_step_{}", chain_id, step.id),
            timestamp: step.timestamp,
            user_message: format!("ReAct Step: {:?}", step.step_type),
            system_prompt: Some(format!("ReAct step logging for chain {}", chain_id)),
            context,
            ai_response: step.content.clone(),
            model_info: model_info.clone(),
            performance_metrics,
            error: None,
            data_classification: DataClassification::Internal,
        };
        
        self.log_interaction(log).await
    }
    
    /// Log ReAct performance metrics for analysis
    pub async fn log_react_performance(
        &self,
        chain: &crate::ai::ReActChain,
        model_info: &ModelInfo,
    ) -> AIResult<()> {
        if !self.config.enabled {
            return Ok(());
        }
        
        // Calculate detailed performance metrics
        let total_steps = chain.steps.len();
        let thought_steps = chain.steps.iter().filter(|s| matches!(s.step_type, crate::ai::ReActStepType::Thought)).count();
        let action_steps = chain.steps.iter().filter(|s| matches!(s.step_type, crate::ai::ReActStepType::Action)).count();
        let observation_steps = chain.steps.iter().filter(|s| matches!(s.step_type, crate::ai::ReActStepType::Observation)).count();
        let tool_executions = chain.steps.iter().filter(|s| s.tool_call.is_some()).count();
        let successful_tools = chain.steps.iter().filter(|s| {
            s.tool_result.as_ref().map(|r| r.success).unwrap_or(false)
        }).count();
        
        let avg_step_duration = if total_steps > 0 {
            chain.steps.iter()
                .filter_map(|s| s.duration_ms)
                .sum::<u64>() / total_steps as u64
        } else {
            0
        };
        
        let mut context = HashMap::new();
        context.insert("react_chain_id".to_string(), serde_json::Value::String(chain.id.clone()));
        context.insert("total_steps".to_string(), serde_json::Value::Number(serde_json::Number::from(total_steps)));
        context.insert("thought_steps".to_string(), serde_json::Value::Number(serde_json::Number::from(thought_steps)));
        context.insert("action_steps".to_string(), serde_json::Value::Number(serde_json::Number::from(action_steps)));
        context.insert("observation_steps".to_string(), serde_json::Value::Number(serde_json::Number::from(observation_steps)));
        context.insert("tool_executions".to_string(), serde_json::Value::Number(serde_json::Number::from(tool_executions)));
        context.insert("successful_tools".to_string(), serde_json::Value::Number(serde_json::Number::from(successful_tools)));
        context.insert("avg_step_duration_ms".to_string(), serde_json::Value::Number(serde_json::Number::from(avg_step_duration)));
        context.insert("iterations".to_string(), serde_json::Value::Number(serde_json::Number::from(chain.iterations)));
        context.insert("completed".to_string(), serde_json::Value::Bool(chain.completed));
        
        let performance_metrics = PerformanceMetrics {
            total_time_ms: chain.total_duration_ms.unwrap_or(0),
            llm_time_ms: chain.steps.iter()
                .filter_map(|step| step.duration_ms)
                .sum(),
            input_tokens: None,
            output_tokens: None,
            memory_usage_mb: None,
        };
        
        let log = InteractionLog {
            id: Uuid::new_v4().to_string(),
            session_id: format!("{}_performance", chain.id),
            timestamp: chain.completed_at.unwrap_or(Utc::now()),
            user_message: "ReAct Performance Analysis".to_string(),
            system_prompt: Some("Performance metrics for ReAct reasoning chain".to_string()),
            context,
            ai_response: format!(
                "ReAct chain completed in {} iterations with {} steps. Total time: {}ms",
                chain.iterations,
                total_steps,
                chain.total_duration_ms.unwrap_or(0)
            ),
            model_info: model_info.clone(),
            performance_metrics,
            error: None,
            data_classification: DataClassification::Internal,
        };
        
        self.log_interaction(log).await
    }
}