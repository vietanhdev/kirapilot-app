use async_trait::async_trait;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

use crate::ai::{
    AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
};
use crate::llama::LlamaService;

/// Local LLM provider implementation using llama-cpp
pub struct LocalProvider {
    /// Llama service instance wrapped in Arc<Mutex> for thread safety
    llama_service: Option<Arc<tokio::sync::Mutex<LlamaService>>>,

    /// Model path or identifier
    model_path: Option<String>,

    /// Whether the provider is initialized
    initialized: bool,
}

impl LocalProvider {
    /// Create a new local provider
    pub fn new() -> Self {
        Self {
            llama_service: None,
            model_path: None,
            initialized: false,
        }
    }

    /// Set the model path
    pub fn with_model_path(mut self, model_path: String) -> Self {
        self.model_path = Some(model_path);
        self
    }
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl LLMProvider for LocalProvider {
    async fn generate(&self, prompt: &str, options: &GenerationOptions) -> AIResult<String> {
        if !self.initialized {
            return Err(AIServiceError::provider_unavailable(
                "Local provider not initialized",
            ));
        }

        let llama_service = self
            .llama_service
            .as_ref()
            .ok_or_else(|| AIServiceError::provider_unavailable("Llama service not available"))?;

        // Convert our generation options to llama options
        let llama_options = crate::llama::service::GenerationOptions {
            max_tokens: options.max_tokens.map(|t| t as i32),
            temperature: options.temperature,
            top_p: options.top_p,
            top_k: None, // Could be added to our GenerationOptions if needed
            repeat_penalty: None,
            stop_sequences: if options.stop_sequences.is_some() && !options.stop_sequences.as_ref().unwrap().is_empty() {
                options.stop_sequences.clone()
            } else {
                // More conservative stop sequences for Gemma-3 model
                Some(vec![
                    "<end_of_turn>".to_string(),
                    "\n<start_of_turn>user".to_string(),
                ])
            },
        };

        // Format prompt for Gemma-3 model
        let formatted_prompt = format!("<bos><start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n", prompt);

        // Generate response using llama service
        let mut service = llama_service.lock().await;
        match service.generate(&formatted_prompt, llama_options).await {
            Ok(response) => Ok(response),
            Err(e) => Err(AIServiceError::llm_error(format!(
                "Local generation failed: {}",
                e
            ))),
        }
    }

    async fn is_ready(&self) -> bool {
        if !self.initialized || self.llama_service.is_none() {
            return false;
        }

        // Service is ready if initialized, even without a model (mock mode)
        // The underlying service will handle mock responses when no model is loaded
        true
    }

    async fn get_status(&self) -> ProviderStatus {
        if !self.initialized {
            return ProviderStatus::Error {
                message: "LocalProvider initialization failed - check logs for details".to_string(),
            };
        }

        match &self.llama_service {
            Some(service) => {
                // Check if the service is ready
                let service_guard = service.try_lock();
                match service_guard {
                    Ok(service) => {
                        let status = service.get_status();
                        if status.is_loaded {
                            ProviderStatus::Ready
                        } else if status.is_available {
                            // Service is available but no model loaded - this is OK for mock mode
                            ProviderStatus::Ready
                        } else {
                            ProviderStatus::Unavailable {
                                reason: format!(
                                    "Local AI service initialization issue. Available: {}, Error: {:?}. Check system dependencies and ensure llama-cpp is properly installed.",
                                    status.is_available, status.error_message
                                ),
                            }
                        }
                    }
                    Err(_) => ProviderStatus::Unavailable {
                        reason: "Service busy - another operation in progress".to_string(),
                    },
                }
            }
            None => ProviderStatus::Error {
                message: "Llama service failed to initialize - check system dependencies"
                    .to_string(),
            },
        }
    }

    fn get_model_info(&self) -> ModelInfo {
        let mut metadata = HashMap::new();
        metadata.insert("provider_type".to_string(), json!("local"));

        if let Some(path) = &self.model_path {
            metadata.insert("model_path".to_string(), json!(path));
        }

        // Try to get model info from llama service if available
        let (model_id, model_name) = if let Some(_service) = &self.llama_service {
            // We could get this from the service if it provides model metadata
            ("local-model".to_string(), "Local LLM".to_string())
        } else {
            ("unknown".to_string(), "Unknown Local Model".to_string())
        };

        ModelInfo {
            id: model_id,
            name: model_name,
            provider: "local".to_string(),
            version: None,
            max_context_length: Some(4096), // Default context length
            metadata,
        }
    }

    async fn initialize(&mut self) -> AIResult<()> {
        log::info!("Initializing LocalProvider...");

        // Try to initialize the llama service
        match LlamaService::new() {
            Ok(mut service) => {
                log::info!("LlamaService created successfully");

                // Try to automatically download and load a default model
                match self.auto_load_default_model(&mut service).await {
                    Ok(()) => {
                        log::info!("Default model loaded successfully");
                    }
                    Err(e) => {
                        log::warn!("Failed to auto-load default model: {}. Service will work in mock mode.", e);
                        // Don't fail initialization - the service can still work in mock mode
                    }
                }

                self.llama_service = Some(Arc::new(tokio::sync::Mutex::new(service)));
                self.initialized = true;
                log::info!("LocalProvider initialized successfully");
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Local model initialization failed: {}. This is likely due to missing system dependencies or incompatible architecture. Please check that llama-cpp is properly installed and compatible with your system.", e);
                log::error!("{}", error_msg);

                // Mark as failed but still allow the provider to exist for better error reporting
                self.initialized = false;
                self.llama_service = None;

                // Return a more user-friendly error message
                Err(AIServiceError::provider_unavailable(
                    "Local model initialization failed. Please ensure system dependencies are installed or use Gemini instead.".to_string()
                ))
            }
        }
    }

    async fn cleanup(&mut self) -> AIResult<()> {
        if let Some(service) = self.llama_service.take() {
            let mut service_guard = service.lock().await;
            service_guard.cleanup().await;
        }
        self.initialized = false;
        Ok(())
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "text_generation".to_string(),
            "conversation".to_string(),
            "offline_processing".to_string(),
        ]
    }
    
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }

    fn validate_prompt(&self, prompt: &str) -> AIResult<()> {
        if prompt.trim().is_empty() {
            return Err(AIServiceError::invalid_request("Prompt cannot be empty"));
        }

        // Additional validation for local models
        if prompt.len() > 32000 {
            return Err(AIServiceError::invalid_request(
                "Prompt too long for local model (max 32k characters)",
            ));
        }

        Ok(())
    }
}

impl LocalProvider {
    /// Attempt to automatically download and load a default model
    async fn auto_load_default_model(&mut self, service: &mut LlamaService) -> AIResult<()> {
        log::info!("Attempting to auto-load default model...");

        // Get the models directory from the model manager
        let models_dir = self.get_models_directory()?;

        // Look for any existing GGUF models first
        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("gguf") {
                        log::info!("Found existing GGUF model: {:?}", path);
                        match service.load_model(path.clone()).await {
                            Ok(()) => {
                                self.model_path = Some(path.to_string_lossy().to_string());
                                log::info!("Successfully loaded existing model: {:?}", path);
                                return Ok(());
                            }
                            Err(e) => {
                                log::warn!("Failed to load existing model {:?}: {}", path, e);
                                continue;
                            }
                        }
                    }
                }
            }
        }

        // If no existing model found, try to download a small default model
        log::info!("No existing GGUF models found. Attempting to download default model...");

        // Use the 1B Gemma model for better ReAct performance
        let default_repo = "ggml-org/gemma-3-1b-it-GGUF";
        let default_filename = "gemma-3-1b-it-Q4_K_M.gguf";

        match service.download_model(default_repo, default_filename).await {
            Ok(model_path) => {
                log::info!("Successfully downloaded default model to: {:?}", model_path);

                // Now try to load the downloaded model
                match service.load_model(model_path.clone()).await {
                    Ok(()) => {
                        self.model_path = Some(model_path.to_string_lossy().to_string());
                        log::info!("Successfully loaded downloaded model: {:?}", model_path);
                        Ok(())
                    }
                    Err(e) => {
                        log::error!("Failed to load downloaded model: {}", e);
                        Err(AIServiceError::provider_unavailable(format!(
                            "Downloaded model but failed to load it: {}",
                            e
                        )))
                    }
                }
            }
            Err(e) => {
                log::warn!(
                    "Failed to download default model: {}. Service will work in mock mode.",
                    e
                );
                log::info!(
                    "To use a real model, place a GGUF model file in: {:?}",
                    models_dir
                );

                // Return an error to indicate no model was loaded, but don't fail initialization
                Err(AIServiceError::provider_unavailable(
                    format!("No GGUF model available and download failed: {}. Service will work in mock mode.", e)
                ))
            }
        }
    }

    /// Get the models directory path
    fn get_models_directory(&self) -> AIResult<std::path::PathBuf> {
        // Use the same logic as ModelManager to get a consistent models directory
        let app_data_dir = if cfg!(target_os = "macos") {
            dirs::data_local_dir()
                .ok_or_else(|| {
                    AIServiceError::provider_unavailable(
                        "Cannot find local data directory".to_string(),
                    )
                })?
                .join("KiraPilot")
        } else if cfg!(target_os = "windows") {
            dirs::data_local_dir()
                .ok_or_else(|| {
                    AIServiceError::provider_unavailable(
                        "Cannot find local data directory".to_string(),
                    )
                })?
                .join("KiraPilot")
        } else {
            // Linux and other Unix-like systems
            dirs::data_local_dir()
                .ok_or_else(|| {
                    AIServiceError::provider_unavailable(
                        "Cannot find local data directory".to_string(),
                    )
                })?
                .join("kirapilot")
        };

        let models_dir = app_data_dir.join("models");

        // Create the directory if it doesn't exist
        std::fs::create_dir_all(&models_dir).map_err(|e| {
            AIServiceError::provider_unavailable(format!(
                "Failed to create models directory: {}",
                e
            ))
        })?;

        Ok(models_dir)
    }
}
