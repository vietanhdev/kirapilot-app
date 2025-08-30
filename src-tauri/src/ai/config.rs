use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration for AI services
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    /// Default LLM provider to use
    pub default_provider: String,
    
    /// Provider-specific configurations
    pub providers: HashMap<String, ProviderConfig>,
    
    /// General AI service settings
    pub settings: AISettings,
}

/// Configuration for a specific LLM provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// Whether this provider is enabled
    pub enabled: bool,
    
    /// Provider-specific settings
    pub settings: HashMap<String, serde_json::Value>,
}

/// General AI service settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISettings {
    /// Maximum number of retries for failed requests
    pub max_retries: u32,
    
    /// Timeout for AI requests in seconds
    pub request_timeout_seconds: u64,
    
    /// Whether to enable detailed logging
    pub enable_detailed_logging: bool,
    
    /// Maximum conversation history to maintain
    pub max_conversation_history: usize,
}

impl Default for AIConfig {
    fn default() -> Self {
        let mut providers = HashMap::new();
        
        // Default Gemini provider config
        providers.insert("gemini".to_string(), ProviderConfig {
            enabled: true,
            settings: HashMap::new(),
        });
        
        // Default local provider config
        providers.insert("local".to_string(), ProviderConfig {
            enabled: true,
            settings: HashMap::new(),
        });
        
        Self {
            default_provider: "local".to_string(),
            providers,
            settings: AISettings::default(),
        }
    }
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            max_retries: 3,
            request_timeout_seconds: 30,
            enable_detailed_logging: true,
            max_conversation_history: 100,
        }
    }
}