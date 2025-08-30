use std::collections::HashMap;
use async_trait::async_trait;
use serde_json::json;

use crate::ai::{
    AIResult, AIServiceError, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus
};

/// Gemma-specific LLM provider that formats messages according to Gemma's instruction format
pub struct GemmaProvider {
    /// Base URL for the Gemma API endpoint
    base_url: String,
    
    /// API key for authentication (if required)
    api_key: Option<String>,
    
    /// Model identifier
    model_id: String,
    
    /// HTTP client for making requests
    client: reqwest::Client,
    
    /// Whether the provider is initialized
    initialized: bool,
}

impl GemmaProvider {
    /// Create a new Gemma provider
    pub fn new(base_url: String, model_id: String, api_key: Option<String>) -> Self {
        Self {
            base_url,
            api_key,
            model_id,
            client: reqwest::Client::new(),
            initialized: false,
        }
    }
    
    /// Format a prompt according to Gemma's instruction format
    /// Available for both unit tests and integration tests
    #[cfg(any(test, feature = "test-utils"))]
    pub fn format_gemma_prompt(&self, prompt: &str) -> String {
        self.format_gemma_prompt_internal(prompt)
    }
    
    fn format_gemma_prompt_internal(&self, prompt: &str) -> String {
        // Check if this is a system instruction + user message combination
        if let Some((system_part, user_part)) = self.extract_system_and_user_internal(prompt) {
            // Combine system instructions with user message in a single user turn
            format!(
                "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n<start_of_turn>model\n",
                system_part.trim(),
                user_part.trim()
            )
        } else {
            // Simple user message
            format!(
                "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n",
                prompt.trim()
            )
        }
    }
    
    /// Extract system instructions and user message from a complex prompt
    /// Available for both unit tests and integration tests
    #[cfg(any(test, feature = "test-utils"))]
    pub fn extract_system_and_user(&self, prompt: &str) -> Option<(String, String)> {
        self.extract_system_and_user_internal(prompt)
    }
    
    fn extract_system_and_user_internal(&self, prompt: &str) -> Option<(String, String)> {
        // Look for common patterns that indicate system instructions
        let prompt_lower = prompt.to_lowercase();
        
        // Pattern 1: "You are..." followed by user content
        if prompt_lower.starts_with("you are") {
            if let Some(question_pos) = prompt.find("Question:") {
                let system_part = prompt[..question_pos].trim();
                let user_part = prompt[question_pos..].trim();
                return Some((system_part.to_string(), user_part.to_string()));
            }
        }
        
        // Pattern 2: Multi-line prompt with clear system/user separation
        let lines: Vec<&str> = prompt.lines().collect();
        if lines.len() > 10 {
            // Look for a line that starts with "Question:" or similar
            for (i, line) in lines.iter().enumerate() {
                if line.trim().starts_with("Question:") || 
                   line.trim().starts_with("User Request:") ||
                   line.trim().starts_with("Request:") {
                    let system_part = lines[..i].join("\n");
                    let user_part = lines[i..].join("\n");
                    return Some((system_part, user_part));
                }
            }
        }
        
        // Pattern 3: ReAct-style prompts
        if prompt_lower.contains("available tools:") && prompt_lower.contains("format:") {
            // Find the actual user question at the end
            if let Some(last_line) = lines.last() {
                if !last_line.trim().is_empty() && 
                   !last_line.contains("Format:") && 
                   !last_line.contains("Example:") {
                    let system_part = lines[..lines.len()-1].join("\n");
                    let user_part = format!("Question: {}", last_line.trim());
                    return Some((system_part, user_part));
                }
            }
        }
        
        None
    }
    
    /// Parse the model's response to extract just the content
    /// Available for both unit tests and integration tests
    #[cfg(any(test, feature = "test-utils"))]
    pub fn parse_gemma_response(&self, response: &str) -> String {
        self.parse_gemma_response_internal(response)
    }
    
    fn parse_gemma_response_internal(&self, response: &str) -> String {
        // Remove any remaining Gemma formatting tokens
        let cleaned = response
            .replace("<start_of_turn>", "")
            .replace("<end_of_turn>", "")
            .replace("model\n", "")
            .replace("user\n", "");
            
        cleaned.trim().to_string()
    }
    
    /// Make a request to the Gemma API
    async fn make_request(&self, formatted_prompt: &str, options: &GenerationOptions) -> AIResult<String> {
        let mut request_body = json!({
            "prompt": formatted_prompt,
            "model": self.model_id,
        });
        
        // Add generation options
        if let Some(max_tokens) = options.max_tokens {
            request_body["max_tokens"] = json!(max_tokens);
        }
        
        if let Some(temperature) = options.temperature {
            request_body["temperature"] = json!(temperature);
        }
        
        if let Some(top_p) = options.top_p {
            request_body["top_p"] = json!(top_p);
        }
        
        if let Some(stop_sequences) = &options.stop_sequences {
            request_body["stop"] = json!(stop_sequences);
        }
        
        // Build the request
        let mut request = self.client
            .post(&format!("{}/v1/completions", self.base_url))
            .json(&request_body);
            
        // Add authentication if available
        if let Some(api_key) = &self.api_key {
            request = request.bearer_auth(api_key);
        }
        
        // Make the request
        let response = request
            .send()
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Request failed: {}", e)))?;
            
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIServiceError::llm_error(format!("API error {}: {}", status, error_text)));
        }
        
        // Parse the response
        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Failed to parse response: {}", e)))?;
            
        // Extract the generated text
        let generated_text = response_json
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("text"))
            .and_then(|text| text.as_str())
            .ok_or_else(|| AIServiceError::llm_error("No generated text in response".to_string()))?;
            
        Ok(self.parse_gemma_response_internal(generated_text))
    }
}

#[async_trait]
impl LLMProvider for GemmaProvider {
    async fn generate(&self, prompt: &str, options: &GenerationOptions) -> AIResult<String> {
        if !self.initialized {
            return Err(AIServiceError::provider_unavailable("Gemma provider not initialized"));
        }
        
        // Format the prompt according to Gemma's instruction format
        let formatted_prompt = self.format_gemma_prompt_internal(prompt);
        
        // Log the formatted prompt for debugging
        println!("\n=== GEMMA FORMATTED PROMPT ===");
        println!("{}", formatted_prompt);
        println!("==============================\n");
        
        // Make the API request
        self.make_request(&formatted_prompt, options).await
    }
    
    async fn is_ready(&self) -> bool {
        if !self.initialized {
            return false;
        }
        
        // Test with a simple prompt
        let test_prompt = self.format_gemma_prompt_internal("Hello");
        let options = GenerationOptions::default();
        
        match self.make_request(&test_prompt, &options).await {
            Ok(_) => true,
            Err(_) => false,
        }
    }
    
    async fn get_status(&self) -> ProviderStatus {
        if !self.initialized {
            return ProviderStatus::Initializing;
        }
        
        if self.is_ready().await {
            ProviderStatus::Ready
        } else {
            ProviderStatus::Error { message: "API not responding".to_string() }
        }
    }
    
    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: self.model_id.clone(),
            name: format!("Gemma {}", self.model_id),
            provider: "gemma".to_string(),
            version: Some("1.0".to_string()),
            max_context_length: Some(8192), // Typical Gemma context length
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("base_url".to_string(), serde_json::Value::String(self.base_url.clone()));
                meta.insert("formatting".to_string(), serde_json::Value::String("gemma_instruction_format".to_string()));
                meta
            },
        }
    }
    
    async fn initialize(&mut self) -> AIResult<()> {
        // Validate configuration
        if self.base_url.is_empty() {
            return Err(AIServiceError::config_error("Base URL is required"));
        }
        
        if self.model_id.is_empty() {
            return Err(AIServiceError::config_error("Model ID is required"));
        }
        
        // Test connectivity with a simple request
        let test_prompt = self.format_gemma_prompt_internal("Test");
        let options = GenerationOptions::default();
        
        match self.make_request(&test_prompt, &options).await {
            Ok(_) => {
                self.initialized = true;
                Ok(())
            },
            Err(e) => {
                Err(AIServiceError::initialization_error(format!("Failed to initialize Gemma provider: {}", e)))
            }
        }
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
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_prompt_formatting() {
        let provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        let formatted = provider.format_gemma_prompt("Hello, how are you?");
        assert_eq!(
            formatted,
            "<start_of_turn>user\nHello, how are you?<end_of_turn>\n<start_of_turn>model\n"
        );
    }
    
    #[test]
    fn test_system_user_prompt_formatting() {
        let provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        let complex_prompt = r#"You are a helpful assistant.
        
Question: What is the capital of France?"#;
        
        let formatted = provider.format_gemma_prompt(complex_prompt);
        assert!(formatted.contains("<start_of_turn>user\n"));
        assert!(formatted.contains("You are a helpful assistant."));
        assert!(formatted.contains("Question: What is the capital of France?"));
        assert!(formatted.contains("<end_of_turn>\n<start_of_turn>model\n"));
    }
    
    #[test]
    fn test_react_prompt_formatting() {
        let provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        let react_prompt = r#"You are a task management assistant.

Available tools: get_tasks, create_task

Format:
Thought: [reasoning]
Action: [tool]: [args]

List my tasks"#;
        
        let formatted = provider.format_gemma_prompt(react_prompt);
        assert!(formatted.contains("<start_of_turn>user\n"));
        assert!(formatted.contains("You are a task management assistant."));
        assert!(formatted.contains("Question: List my tasks"));
        assert!(formatted.contains("<end_of_turn>\n<start_of_turn>model\n"));
    }
    
    #[test]
    fn test_response_parsing() {
        let provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        let raw_response = "<start_of_turn>model\nHello! I'm doing well, thank you for asking.<end_of_turn>";
        let parsed = provider.parse_gemma_response(raw_response);
        assert_eq!(parsed, "Hello! I'm doing well, thank you for asking.");
    }
    
    #[test]
    fn test_extract_system_and_user() {
        let provider = GemmaProvider::new(
            "http://localhost:8080".to_string(),
            "gemma-7b".to_string(),
            None
        );
        
        let prompt = "You are a helpful assistant.\n\nQuestion: What is 2+2?";
        let result = provider.extract_system_and_user(prompt);
        
        assert!(result.is_some());
        let (system, user) = result.unwrap();
        assert_eq!(system, "You are a helpful assistant.");
        assert_eq!(user, "Question: What is 2+2?");
    }
}