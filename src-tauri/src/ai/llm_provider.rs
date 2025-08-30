use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::ai::error::{AIResult, AIServiceError};

/// Options for LLM generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationOptions {
    /// Maximum number of tokens to generate
    pub max_tokens: Option<u32>,
    
    /// Temperature for randomness (0.0 to 1.0)
    pub temperature: Option<f32>,
    
    /// Top-p sampling parameter
    pub top_p: Option<f32>,
    
    /// Stop sequences
    pub stop_sequences: Option<Vec<String>>,
    
    /// Whether to stream the response
    pub stream: bool,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        Self {
            max_tokens: Some(2048),
            temperature: Some(0.7),
            top_p: Some(0.9),
            stop_sequences: None,
            stream: false,
        }
    }
}

/// Information about an LLM model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Model identifier
    pub id: String,
    
    /// Human-readable model name
    pub name: String,
    
    /// Model provider (e.g., "gemini", "local")
    pub provider: String,
    
    /// Model version
    pub version: Option<String>,
    
    /// Maximum context length in tokens
    pub max_context_length: Option<u32>,
    
    /// Additional model metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Status of an LLM provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderStatus {
    /// Provider is ready and available
    Ready,
    
    /// Provider is initializing
    Initializing,
    
    /// Provider is unavailable with reason
    Unavailable { reason: String },
    
    /// Provider encountered an error
    Error { message: String },
}

/// Unified interface for LLM providers
#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Generate text from a prompt
    async fn generate(&self, prompt: &str, options: &GenerationOptions) -> AIResult<String>;
    
    /// Check if the provider is ready to handle requests
    async fn is_ready(&self) -> bool;
    
    /// Get the current status of the provider
    async fn get_status(&self) -> ProviderStatus;
    
    /// Get information about the model
    fn get_model_info(&self) -> ModelInfo;
    
    /// Initialize the provider
    async fn initialize(&mut self) -> AIResult<()>;
    
    /// Clean up resources
    async fn cleanup(&mut self) -> AIResult<()>;
    
    /// Get provider-specific capabilities
    fn get_capabilities(&self) -> Vec<String> {
        vec!["text_generation".to_string()]
    }
    
    /// Downcast to Any for type-specific operations
    fn as_any(&self) -> &dyn std::any::Any;
    
    /// Downcast to Any for mutable type-specific operations
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any;
    
    /// Validate a prompt before generation
    fn validate_prompt(&self, prompt: &str) -> AIResult<()> {
        if prompt.trim().is_empty() {
            return Err(AIServiceError::invalid_request("Prompt cannot be empty"));
        }
        Ok(())
    }
}