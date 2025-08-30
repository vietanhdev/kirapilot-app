use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Comprehensive error types for AI service operations
#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum AIServiceError {
    #[error("LLM provider error: {message}")]
    LLMError { message: String, code: Option<String> },
    
    #[error("Configuration error: {message}")]
    ConfigError { message: String },
    
    #[error("Initialization error: {message}")]
    InitializationError { message: String },
    
    #[error("Provider not available: {provider}")]
    ProviderUnavailable { provider: String },
    
    #[error("Invalid request: {message}")]
    InvalidRequest { message: String },
    
    #[error("Service unavailable: {message}")]
    ServiceUnavailable { message: String },
    
    #[error("Internal error: {message}")]
    InternalError { message: String },
    
    #[error("Permission denied: {message}")]
    PermissionDenied { message: String },
    
    #[error("Validation error: {message}")]
    ValidationError { message: String },
}

impl AIServiceError {
    pub fn llm_error(message: impl Into<String>) -> Self {
        Self::LLMError {
            message: message.into(),
            code: None,
        }
    }
    
    pub fn llm_error_with_code(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self::LLMError {
            message: message.into(),
            code: Some(code.into()),
        }
    }
    
    pub fn config_error(message: impl Into<String>) -> Self {
        Self::ConfigError {
            message: message.into(),
        }
    }
    
    pub fn initialization_error(message: impl Into<String>) -> Self {
        Self::InitializationError {
            message: message.into(),
        }
    }
    
    pub fn provider_unavailable(provider: impl Into<String>) -> Self {
        Self::ProviderUnavailable {
            provider: provider.into(),
        }
    }
    
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::InvalidRequest {
            message: message.into(),
        }
    }
    
    pub fn service_unavailable(message: impl Into<String>) -> Self {
        Self::ServiceUnavailable {
            message: message.into(),
        }
    }
    
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self::InternalError {
            message: message.into(),
        }
    }
    
    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::PermissionDenied {
            message: message.into(),
        }
    }
    
    pub fn validation_error(message: impl Into<String>) -> Self {
        Self::ValidationError {
            message: message.into(),
        }
    }
}

/// Result type for AI service operations
pub type AIResult<T> = Result<T, AIServiceError>;

/// Serializable error response for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIErrorResponse {
    /// Error type identifier
    pub error_type: String,
    
    /// Human-readable error message
    pub message: String,
    
    /// Optional error code for programmatic handling
    pub code: Option<String>,
    
    /// Additional error details
    pub details: Option<serde_json::Value>,
}

impl From<AIServiceError> for AIErrorResponse {
    fn from(error: AIServiceError) -> Self {
        match error {
            AIServiceError::LLMError { message, code } => Self {
                error_type: "llm_error".to_string(),
                message,
                code,
                details: None,
            },
            AIServiceError::ConfigError { message } => Self {
                error_type: "config_error".to_string(),
                message,
                code: None,
                details: None,
            },
            AIServiceError::InitializationError { message } => Self {
                error_type: "initialization_error".to_string(),
                message,
                code: None,
                details: None,
            },
            AIServiceError::ProviderUnavailable { provider } => Self {
                error_type: "provider_unavailable".to_string(),
                message: format!("Provider '{}' is not available", provider),
                code: Some("PROVIDER_UNAVAILABLE".to_string()),
                details: Some(serde_json::json!({ "provider": provider })),
            },
            AIServiceError::InvalidRequest { message } => Self {
                error_type: "invalid_request".to_string(),
                message,
                code: Some("INVALID_REQUEST".to_string()),
                details: None,
            },
            AIServiceError::ServiceUnavailable { message } => Self {
                error_type: "service_unavailable".to_string(),
                message,
                code: Some("SERVICE_UNAVAILABLE".to_string()),
                details: None,
            },
            AIServiceError::InternalError { message } => Self {
                error_type: "internal_error".to_string(),
                message,
                code: Some("INTERNAL_ERROR".to_string()),
                details: None,
            },
            AIServiceError::PermissionDenied { message } => Self {
                error_type: "permission_denied".to_string(),
                message,
                code: Some("PERMISSION_DENIED".to_string()),
                details: None,
            },
            AIServiceError::ValidationError { message } => Self {
                error_type: "validation_error".to_string(),
                message,
                code: Some("VALIDATION_ERROR".to_string()),
                details: None,
            },
        }
    }
}