use async_trait::async_trait;
use serde_json::json;
use std::collections::HashMap;

use crate::ai::{
    AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
};

/// Gemini API provider implementation
pub struct GeminiProvider {
    /// API key for Gemini
    api_key: Option<String>,
    
    /// Model identifier
    model_id: String,
    
    /// HTTP client for API requests
    client: reqwest::Client,
    
    /// Whether the provider is initialized
    initialized: bool,
}

impl GeminiProvider {
    /// Create a new Gemini provider
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            api_key,
            model_id: "gemini-1.5-flash".to_string(),
            client: reqwest::Client::new(),
            initialized: false,
        }
    }
    
    /// Set the model ID
    pub fn with_model(mut self, model_id: String) -> Self {
        self.model_id = model_id;
        self
    }
    
    /// Update the API key
    pub fn set_api_key(&mut self, api_key: Option<String>) {
        self.api_key = api_key;
        // Re-initialize if we now have an API key
        if self.api_key.is_some() {
            self.initialized = true;
        } else {
            self.initialized = false;
        }
    }
}

#[async_trait]
impl LLMProvider for GeminiProvider {
    async fn generate(&self, prompt: &str, options: &GenerationOptions) -> AIResult<String> {
        if !self.initialized {
            return Err(AIServiceError::provider_unavailable("Gemini provider not initialized"));
        }
        
        let api_key = self.api_key.as_ref()
            .ok_or_else(|| AIServiceError::config_error("Gemini API key not configured"))?;
        
        // Construct the API URL
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model_id, api_key
        );
        
        // Prepare the request body
        let mut generation_config = json!({});
        
        if let Some(max_tokens) = options.max_tokens {
            generation_config["maxOutputTokens"] = json!(max_tokens);
        }
        
        if let Some(temperature) = options.temperature {
            generation_config["temperature"] = json!(temperature);
        }
        
        if let Some(top_p) = options.top_p {
            generation_config["topP"] = json!(top_p);
        }
        
        if let Some(stop_sequences) = &options.stop_sequences {
            generation_config["stopSequences"] = json!(stop_sequences);
        }
        
        let request_body = json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": generation_config
        });
        
        // Make the API request
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Request failed: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIServiceError::llm_error_with_code(
                format!("API request failed: {}", error_text),
                status.to_string(),
            ));
        }
        
        // Parse the response
        let response_json: serde_json::Value = response.json().await
            .map_err(|e| AIServiceError::llm_error(format!("Failed to parse response: {}", e)))?;
        
        // Extract the generated text
        let generated_text = response_json
            .get("candidates")
            .and_then(|candidates| candidates.get(0))
            .and_then(|candidate| candidate.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(|parts| parts.get(0))
            .and_then(|part| part.get("text"))
            .and_then(|text| text.as_str())
            .ok_or_else(|| AIServiceError::llm_error("Invalid response format from Gemini API"))?;
        
        Ok(generated_text.to_string())
    }
    
    async fn is_ready(&self) -> bool {
        self.initialized && self.api_key.is_some()
    }
    
    async fn get_status(&self) -> ProviderStatus {
        if !self.initialized {
            return ProviderStatus::Initializing;
        }
        
        if self.api_key.is_none() {
            return ProviderStatus::Unavailable {
                reason: "API key not configured".to_string(),
            };
        }
        
        ProviderStatus::Ready
    }
    
    fn get_model_info(&self) -> ModelInfo {
        let mut metadata = HashMap::new();
        metadata.insert("api_version".to_string(), json!("v1beta"));
        metadata.insert("provider_type".to_string(), json!("cloud"));
        
        ModelInfo {
            id: self.model_id.clone(),
            name: format!("Google {}", self.model_id),
            provider: "gemini".to_string(),
            version: Some("v1beta".to_string()),
            max_context_length: Some(1048576), // 1M tokens for Gemini 1.5
            metadata,
        }
    }
    
    async fn initialize(&mut self) -> AIResult<()> {
        // Don't fail initialization if API key is not provided
        // This allows the AI service to work with other providers
        if self.api_key.is_none() {
            eprintln!("Warning: Gemini API key not provided. Gemini provider will be unavailable.");
            self.initialized = false;
        } else {
            self.initialized = true;
        }
        
        Ok(())
    }
    
    async fn cleanup(&mut self) -> AIResult<()> {
        self.initialized = false;
        Ok(())
    }
    
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
    
    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "text_generation".to_string(),
            "conversation".to_string(),
            "code_generation".to_string(),
            "analysis".to_string(),
        ]
    }
}