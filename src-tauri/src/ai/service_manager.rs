use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::ai::{
    AIConfig, AIResult, AIServiceError, InteractionLogger, LLMProvider,
    LoggingConfig, ModelInfo, PerformanceMetrics, ProviderStatus,
    ReActEngine, ToolRegistry,
};
use crate::ai::provider_manager::{ProviderManager, ProviderPreferences, SwitchingConfig};


/// Empty tool registry for initialization
struct EmptyToolRegistry;

impl EmptyToolRegistry {
    fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl ToolRegistry for EmptyToolRegistry {
    async fn execute_tool(
        &self,
        _tool_name: &str,
        _args: &HashMap<String, serde_json::Value>,
    ) -> AIResult<serde_json::Value> {
        Err(AIServiceError::service_unavailable("No tools available - database not initialized"))
    }
    
    fn get_available_tools(&self) -> Vec<String> {
        vec![]
    }
    
    fn has_tool(&self, _tool_name: &str) -> bool {
        false
    }
}

/// Request for AI message processing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIRequest {
    /// The user's message
    pub message: String,

    /// Session identifier for conversation tracking
    pub session_id: Option<String>,

    /// Preferred model/provider
    pub model_preference: Option<String>,

    /// Additional context for the request
    pub context: HashMap<String, serde_json::Value>,
}

/// Response from AI message processing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIResponse {
    /// The AI's response message
    pub message: String,

    /// Session identifier
    pub session_id: String,

    /// Model information used for generation
    pub model_info: ModelInfo,

    /// Processing metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Status of the AI service and models
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIServiceStatus {
    /// Current active provider
    pub active_provider: String,

    /// Status of all available providers
    pub providers: HashMap<String, ProviderStatus>,

    /// Service-level status
    pub service_ready: bool,
}

/// Manages AI services and LLM providers
pub struct AIServiceManager {
    /// Provider manager for health monitoring and switching
    provider_manager: Arc<ProviderManager>,

    /// Service configuration
    config: Arc<RwLock<AIConfig>>,

    /// Active conversation sessions
    sessions: Arc<RwLock<HashMap<String, ConversationSession>>>,

    /// Interaction logger
    logger: Arc<RwLock<InteractionLogger>>,

    /// ReAct reasoning engine
    react_engine: Arc<ReActEngine>,

    /// Tool registry for executing actions
    tool_registry: Arc<RwLock<Arc<dyn ToolRegistry>>>,
}

/// Represents an active conversation session
#[derive(Debug, Clone)]
struct ConversationSession {
    /// Session identifier
    #[allow(dead_code)]
    pub id: String,

    /// Messages in this session
    pub messages: Vec<SessionMessage>,

    /// Session metadata
    #[allow(dead_code)]
    pub metadata: HashMap<String, serde_json::Value>,

    /// Creation timestamp
    #[allow(dead_code)]
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Last activity timestamp
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// A message in a conversation session
#[derive(Debug, Clone)]
struct SessionMessage {
    /// Message content
    #[allow(dead_code)]
    pub content: String,

    /// Whether this is a user message (true) or AI response (false)
    #[allow(dead_code)]
    pub is_user: bool,

    /// Timestamp
    #[allow(dead_code)]
    pub timestamp: chrono::DateTime<chrono::Utc>,

    /// Model used for AI responses
    #[allow(dead_code)]
    pub model_info: Option<ModelInfo>,
}

impl AIRequest {
    /// Validate the AI request
    pub fn validate(&self) -> Result<(), crate::ai::AIServiceError> {
        // Check message is not empty
        if self.message.trim().is_empty() {
            return Err(crate::ai::AIServiceError::invalid_request(
                "Message cannot be empty"
            ));
        }
        
        // Check message length (reasonable limit)
        if self.message.len() > 100_000 {
            return Err(crate::ai::AIServiceError::invalid_request(
                "Message too long (max 100,000 characters)"
            ));
        }
        
        // Validate session_id format if provided
        if let Some(session_id) = &self.session_id {
            if session_id.trim().is_empty() {
                return Err(crate::ai::AIServiceError::invalid_request(
                    "Session ID cannot be empty"
                ));
            }
            
            if session_id.len() > 255 {
                return Err(crate::ai::AIServiceError::invalid_request(
                    "Session ID too long (max 255 characters)"
                ));
            }
        }
        
        // Validate model preference if provided
        if let Some(model_pref) = &self.model_preference {
            if model_pref.trim().is_empty() {
                return Err(crate::ai::AIServiceError::invalid_request(
                    "Model preference cannot be empty"
                ));
            }
            
            // Check for valid provider names
            let valid_providers = ["gemini", "local"];
            if !valid_providers.contains(&model_pref.as_str()) {
                return Err(crate::ai::AIServiceError::invalid_request(
                    format!("Invalid model preference '{}'. Valid options: {}", 
                           model_pref, valid_providers.join(", "))
                ));
            }
        }
        
        Ok(())
    }
}

impl AIServiceManager {
    /// Create a new AI service manager
    pub fn new(config: AIConfig) -> Self {
        let switching_config = SwitchingConfig::default();
        let user_preferences = ProviderPreferences {
            primary_provider: config.default_provider.clone(),
            ..Default::default()
        };
        
        let provider_manager = Arc::new(ProviderManager::new(switching_config, user_preferences));
        
        // Create ReAct engine with default configuration
        let react_engine = Arc::new(ReActEngine::new());
        
        // Create a placeholder tool registry (will be updated when database is available)
        let tool_registry: Arc<dyn ToolRegistry> = Arc::new(EmptyToolRegistry::new());
        
        // Create logger with debug configuration for detailed logging
        let mut logging_config = crate::ai::LoggingConfig::default();
        logging_config.log_level = "debug".to_string();
        logging_config.log_sensitive_data = true; // For debugging purposes
        
        Self {
            provider_manager,
            config: Arc::new(RwLock::new(config)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            logger: Arc::new(RwLock::new(InteractionLogger::new(logging_config))),
            react_engine,
            tool_registry: Arc::new(RwLock::new(tool_registry)),
        }
    }

    /// Update the tool registry with database repositories
    pub async fn set_tool_registry(&self, tool_registry: Arc<dyn ToolRegistry>) {
        let mut registry = self.tool_registry.write().await;
        *registry = tool_registry;
    }

    /// Initialize the service manager
    pub async fn initialize(&self) -> AIResult<()> {
        // Validate configuration
        let config = self.config.read().await;

        if config.providers.is_empty() {
            return Err(AIServiceError::config_error("No providers configured"));
        }

        if !config.providers.contains_key(&config.default_provider) {
            return Err(AIServiceError::config_error(format!(
                "Default provider '{}' not found in configuration",
                config.default_provider
            )));
        }

        drop(config);

        // Start health monitoring
        self.provider_manager.start_health_monitoring().await?;

        Ok(())
    }

    /// Register an LLM provider
    pub async fn register_provider(
        &self,
        name: String,
        provider: Box<dyn LLMProvider>,
    ) -> AIResult<()> {
        self.provider_manager.register_provider(name, provider).await
    }

    /// Switch to a different provider
    pub async fn switch_provider(&self, provider_name: &str) -> AIResult<()> {
        self.provider_manager.switch_provider(provider_name).await
    }

    /// Process an AI message request with automatic failover
    pub async fn process_message(&self, request: AIRequest) -> AIResult<AIResponse> {
        let start_time = std::time::Instant::now();

        // Get or create session
        let session_id = request
            .session_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        // Determine which provider to use
        let mut provider_name = if let Some(pref) = &request.model_preference {
            pref.clone()
        } else {
            self.provider_manager.get_active_provider_name().await
        };

        // Try to process with the selected provider, with automatic failover
        let mut last_error = None;
        let mut attempts = 0;
        const MAX_ATTEMPTS: u32 = 3;

        while attempts < MAX_ATTEMPTS {
            attempts += 1;

            match self.try_process_with_provider(&request, &session_id, &provider_name, start_time).await {
                Ok(response) => {
                    // Record success
                    let total_time = start_time.elapsed();
                    self.provider_manager
                        .record_success(&provider_name, total_time.as_millis() as u64)
                        .await;
                    return Ok(response);
                }
                Err(error) => {
                    // Record failure
                    self.provider_manager
                        .record_failure(&provider_name, &error)
                        .await;

                    last_error = Some(error.clone());

                    // Try to failover to another provider
                    match self.provider_manager.attempt_failover().await {
                        Ok(new_provider) => {
                            provider_name = new_provider;
                            continue;
                        }
                        Err(_) => {
                            // No more providers available, break the loop
                            break;
                        }
                    }
                }
            }
        }

        // If we get here, all attempts failed
        let final_error = last_error.unwrap_or_else(|| {
            AIServiceError::provider_unavailable("All providers failed")
        });

        // Log the final error
        let logger = self.logger.read().await;
        let _ = logger
            .log_error(
                session_id,
                request.message,
                &final_error,
                None,
            )
            .await;

        Err(final_error)
    }

    /// Try to process a message with a specific provider
    async fn try_process_with_provider(
        &self,
        request: &AIRequest,
        session_id: &str,
        provider_name: &str,
        start_time: std::time::Instant,
    ) -> AIResult<AIResponse> {
        let llm_start_time = std::time::Instant::now();
        
        // Get generation options from request context
        let generation_options = crate::ai::GenerationOptions {
            max_tokens: request.context.get("max_tokens")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32),
            temperature: request.context.get("temperature")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            top_p: request.context.get("top_p")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            stop_sequences: request.context.get("stop_sequences")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()),
            stream: false,
        };

        // Log to structured logging only
        log::debug!("Processing AI request - provider: {}, session: {}, message length: {}", 
                   provider_name, session_id, request.message.len());

        // Get the provider for ReAct processing
        let providers = self.provider_manager.providers.read().await;
        let provider = providers
            .get(provider_name)
            .ok_or_else(|| AIServiceError::provider_unavailable(provider_name))?;

        // Use ReAct engine to process the request with tools
        let tool_registry = self.tool_registry.read().await;
        let react_chain = self.react_engine.process_request(
            request.message.clone(),
            provider.as_ref(),
            Some(tool_registry.as_ref()),
            Some(&*self.logger.read().await),
        ).await?;
        
        // Log the ReAct reasoning chain
        println!("\n=== REACT REASONING CHAIN ===");
        println!("Provider: {}", provider_name);
        println!("Session ID: {}", session_id);
        println!("User Request: {}", react_chain.user_request);
        println!("Steps Count: {}", react_chain.steps.len());
        println!("Completed: {}", react_chain.completed);
        println!("Iterations: {}", react_chain.iterations);
        for (i, step) in react_chain.steps.iter().enumerate() {
            println!("  Step {}: {:?} - {}", i + 1, step.step_type, step.content);
            if let Some(tool_call) = &step.tool_call {
                println!("    Tool: {} with args: {:?}", tool_call.name, tool_call.args);
            }
            if let Some(tool_result) = &step.tool_result {
                println!("    Result: {} (success: {})", tool_result.message, tool_result.success);
            }
        }
        println!("Final Response: {}", react_chain.final_response);
        println!("==============================\n");

        let response_text = react_chain.final_response;
        drop(providers); // Release the lock

        let llm_time = llm_start_time.elapsed();
        let total_time = start_time.elapsed();

        // Get model info from the provider
        let model_info = self.provider_manager
            .with_provider(provider_name, |provider| provider.get_model_info())
            .await?;

        // Update session
        self.update_session(
            session_id,
            &request.message,
            &response_text,
            &model_info,
        )
        .await;

        // Log the successful interaction
        let performance_metrics = PerformanceMetrics {
            total_time_ms: total_time.as_millis() as u64,
            llm_time_ms: llm_time.as_millis() as u64,
            input_tokens: None, // TODO: Calculate actual token counts
            output_tokens: None,
            memory_usage_mb: None,
        };

        let logger = self.logger.read().await;
        let _ = logger
            .log_interaction_simple(
                session_id.to_string(),
                request.message.clone(),
                response_text.clone(),
                model_info.clone(),
                performance_metrics,
            )
            .await;

        // Create response
        let mut metadata = HashMap::new();
        metadata.insert(
            "provider".to_string(),
            serde_json::Value::String(provider_name.to_string()),
        );
        metadata.insert(
            "timestamp".to_string(),
            serde_json::Value::String(chrono::Utc::now().to_rfc3339()),
        );
        metadata.insert(
            "total_time_ms".to_string(),
            serde_json::Value::Number(serde_json::Number::from(total_time.as_millis() as u64)),
        );
        metadata.insert(
            "llm_time_ms".to_string(),
            serde_json::Value::Number(serde_json::Number::from(llm_time.as_millis() as u64)),
        );

        Ok(AIResponse {
            message: response_text,
            session_id: session_id.to_string(),
            model_info,
            metadata,
        })
    }

    /// Get the current service status
    pub async fn get_status(&self) -> AIServiceStatus {
        let mut active_provider = self.provider_manager.get_active_provider_name().await;
        let health_status = self.provider_manager.get_all_health_status().await;

        let mut provider_statuses = HashMap::new();
        let mut service_ready = false;

        // Check if current active provider is ready
        for (name, health) in health_status.iter() {
            let status = health.status.clone();
            if name == &active_provider && matches!(status, ProviderStatus::Ready) {
                service_ready = true;
            }
            provider_statuses.insert(name.clone(), status.clone());
        }

        // If the active provider is not ready, try to find and switch to any ready provider
        if !service_ready {
            for (name, health) in health_status.iter() {
                if matches!(health.status, ProviderStatus::Ready) {
                    log::info!("🔄 Switching from unavailable provider '{}' to ready provider '{}'", active_provider, name);
                    
                    // Attempt to switch to this provider
                    if let Ok(()) = self.provider_manager.switch_provider(name).await {
                        active_provider = name.clone();
                        service_ready = true;
                        log::info!("✅ Successfully switched to provider '{}'", name);
                        break;
                    } else {
                        log::warn!("⚠️ Failed to switch to provider '{}' despite it being marked as ready", name);
                    }
                }
            }
        }

        AIServiceStatus {
            active_provider,
            providers: provider_statuses,
            service_ready,
        }
    }

    /// Get information about the current model
    pub async fn get_model_info(&self) -> AIResult<ModelInfo> {
        self.provider_manager
            .with_active_provider(|provider| provider.get_model_info())
            .await
    }

    /// Clear conversation history for a session
    pub async fn clear_session(&self, session_id: &str) -> AIResult<()> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id);
        Ok(())
    }

    /// Clear all conversation history
    pub async fn clear_all_sessions(&self) -> AIResult<()> {
        let mut sessions = self.sessions.write().await;
        sessions.clear();
        Ok(())
    }

    /// Get recent interaction logs
    pub async fn get_interaction_logs(
        &self,
        limit: u64,
    ) -> AIResult<Vec<crate::ai::InteractionLog>> {
        let logger = self.logger.read().await;
        logger.get_recent_logs(limit).await
    }

    /// Clean up old interaction logs
    pub async fn cleanup_old_logs(&self) -> AIResult<u64> {
        let logger = self.logger.read().await;
        logger.cleanup_old_logs().await
    }

    /// Update logging configuration
    pub async fn update_logging_config(&self, config: LoggingConfig) -> AIResult<()> {
        let mut logger = self.logger.write().await;
        logger.update_config(config);
        Ok(())
    }

    /// Get current logging configuration
    pub async fn get_logging_config(&self) -> LoggingConfig {
        let logger = self.logger.read().await;
        logger.get_config().clone()
    }

    /// Update provider preferences
    pub async fn update_provider_preferences(&self, preferences: ProviderPreferences) -> AIResult<()> {
        self.provider_manager.update_preferences(preferences).await
    }
    
    /// Configure Gemini API key
    pub async fn configure_gemini_api_key(&self, api_key: String) -> AIResult<()> {
        self.provider_manager.configure_gemini_api_key(api_key).await
    }

    /// Get current provider preferences
    pub async fn get_provider_preferences(&self) -> ProviderPreferences {
        self.provider_manager.get_preferences().await
    }

    /// Update switching configuration
    pub async fn update_switching_config(&self, config: SwitchingConfig) -> AIResult<()> {
        self.provider_manager.update_switching_config(config).await
    }

    /// Get provider health status
    pub async fn get_provider_health(&self, provider_name: &str) -> Option<crate::ai::provider_manager::ProviderHealth> {
        self.provider_manager.get_provider_health(provider_name).await
    }

    /// Get all provider health statuses
    pub async fn get_all_provider_health(&self) -> HashMap<String, crate::ai::provider_manager::ProviderHealth> {
        self.provider_manager.get_all_health_status().await
    }

    /// Attempt manual failover to the best available provider
    pub async fn attempt_failover(&self) -> AIResult<String> {
        self.provider_manager.attempt_failover().await
    }

    /// Stop health monitoring (useful for cleanup)
    pub async fn stop_health_monitoring(&self) {
        self.provider_manager.stop_health_monitoring().await;
    }

    /// Update conversation session with new messages
    async fn update_session(
        &self,
        session_id: &str,
        user_message: &str,
        ai_response: &str,
        model_info: &ModelInfo,
    ) {
        let mut sessions = self.sessions.write().await;
        let now = chrono::Utc::now();

        let session =
            sessions
                .entry(session_id.to_string())
                .or_insert_with(|| ConversationSession {
                    id: session_id.to_string(),
                    messages: Vec::new(),
                    metadata: HashMap::new(),
                    created_at: now,
                    last_activity: now,
                });

        // Add user message
        session.messages.push(SessionMessage {
            content: user_message.to_string(),
            is_user: true,
            timestamp: now,
            model_info: None,
        });

        // Add AI response
        session.messages.push(SessionMessage {
            content: ai_response.to_string(),
            is_user: false,
            timestamp: now,
            model_info: Some(model_info.clone()),
        });

        session.last_activity = now;

        // Limit session history
        let config = self.config.try_read();
        if let Ok(config) = config {
            let max_messages = config.settings.max_conversation_history * 2; // User + AI pairs
            if session.messages.len() > max_messages {
                session
                    .messages
                    .drain(0..session.messages.len() - max_messages);
            }
        }
    }
}
