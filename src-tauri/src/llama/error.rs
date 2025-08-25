use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum LlamaError {
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("Model loading failed: {0}")]
    ModelLoadFailed(String),

    #[error("Generation failed: {0}")]
    GenerationFailed(String),

    #[error("Insufficient resources: {0}")]
    InsufficientResources(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Initialization error: {0}")]
    InitializationError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Recovery failed: {0}")]
    RecoveryFailed(String),
}

impl LlamaError {
    /// Check if this error is recoverable (can be retried)
    pub fn is_recoverable(&self) -> bool {
        match self {
            LlamaError::NetworkError(_) => true,
            LlamaError::TimeoutError(_) => true,
            LlamaError::ResourceExhausted(_) => true,
            LlamaError::ServiceUnavailable(_) => true,
            LlamaError::GenerationFailed(_) => true,
            LlamaError::DownloadFailed(_) => true,
            LlamaError::ModelLoadFailed(_) => false, // Usually indicates corrupted model
            LlamaError::ModelNotFound(_) => false,
            LlamaError::ConfigurationError(_) => false,
            LlamaError::InitializationError(_) => false,
            LlamaError::IoError(_) => false,
            LlamaError::ValidationError(_) => false,
            LlamaError::RecoveryFailed(_) => false,
            LlamaError::InsufficientResources(_) => true,
        }
    }

    /// Get error severity level
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            LlamaError::ModelNotFound(_) => ErrorSeverity::Critical,
            LlamaError::ModelLoadFailed(_) => ErrorSeverity::Critical,
            LlamaError::InitializationError(_) => ErrorSeverity::Critical,
            LlamaError::ConfigurationError(_) => ErrorSeverity::High,
            LlamaError::IoError(_) => ErrorSeverity::High,
            LlamaError::DownloadFailed(_) => ErrorSeverity::Medium,
            LlamaError::GenerationFailed(_) => ErrorSeverity::Medium,
            LlamaError::InsufficientResources(_) => ErrorSeverity::Medium,
            LlamaError::NetworkError(_) => ErrorSeverity::Low,
            LlamaError::TimeoutError(_) => ErrorSeverity::Low,
            LlamaError::ResourceExhausted(_) => ErrorSeverity::Medium,
            LlamaError::ServiceUnavailable(_) => ErrorSeverity::Medium,
            LlamaError::ValidationError(_) => ErrorSeverity::Low,
            LlamaError::RecoveryFailed(_) => ErrorSeverity::High,
        }
    }

    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            LlamaError::ModelNotFound(_) => "The AI model could not be found. Please try downloading it again.".to_string(),
            LlamaError::DownloadFailed(_) => "Failed to download the AI model. Please check your internet connection and try again.".to_string(),
            LlamaError::ModelLoadFailed(_) => "Failed to load the AI model. The model file may be corrupted. Please try re-downloading.".to_string(),
            LlamaError::GenerationFailed(_) => "Failed to generate a response. Please try again with a different message.".to_string(),
            LlamaError::InsufficientResources(_) => "Your system doesn't have enough resources to run the local AI model. Consider using the cloud model instead.".to_string(),
            LlamaError::ConfigurationError(_) => "There's a configuration issue with the AI model. Please check your settings.".to_string(),
            LlamaError::IoError(_) => "A file system error occurred. Please check your disk space and permissions.".to_string(),
            LlamaError::InitializationError(_) => "Failed to initialize the AI model. Please restart the application and try again.".to_string(),
            LlamaError::NetworkError(_) => "Network connection failed. Please check your internet connection.".to_string(),
            LlamaError::TimeoutError(_) => "The operation timed out. Please try again.".to_string(),
            LlamaError::ResourceExhausted(_) => "System resources are currently exhausted. Please wait a moment and try again.".to_string(),
            LlamaError::ServiceUnavailable(_) => "The AI service is temporarily unavailable. Please try again later.".to_string(),
            LlamaError::ValidationError(_) => "Invalid input provided. Please check your request and try again.".to_string(),
            LlamaError::RecoveryFailed(_) => "Failed to recover from a previous error. Please restart the application.".to_string(),
        }
    }

    /// Get suggested recovery actions
    pub fn recovery_suggestions(&self) -> Vec<String> {
        match self {
            LlamaError::ModelNotFound(_) => vec![
                "Try re-downloading the model".to_string(),
                "Check your internet connection".to_string(),
                "Switch to cloud model temporarily".to_string(),
            ],
            LlamaError::DownloadFailed(_) => vec![
                "Check your internet connection".to_string(),
                "Try again in a few minutes".to_string(),
                "Use cloud model while troubleshooting".to_string(),
            ],
            LlamaError::ModelLoadFailed(_) => vec![
                "Re-download the model file".to_string(),
                "Check available disk space".to_string(),
                "Restart the application".to_string(),
                "Switch to cloud model".to_string(),
            ],
            LlamaError::GenerationFailed(_) => vec![
                "Try rephrasing your message".to_string(),
                "Restart the conversation".to_string(),
                "Switch to cloud model".to_string(),
            ],
            LlamaError::InsufficientResources(_) => vec![
                "Close other applications to free memory".to_string(),
                "Switch to cloud model".to_string(),
                "Reduce model context size in settings".to_string(),
            ],
            LlamaError::NetworkError(_) => vec![
                "Check your internet connection".to_string(),
                "Try again in a few moments".to_string(),
            ],
            LlamaError::TimeoutError(_) => vec![
                "Try again with a shorter message".to_string(),
                "Check system performance".to_string(),
            ],
            _ => vec![
                "Restart the application".to_string(),
                "Switch to cloud model".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl From<std::io::Error> for LlamaError {
    fn from(error: std::io::Error) -> Self {
        LlamaError::IoError(error.to_string())
    }
}

impl From<hf_hub::api::sync::ApiError> for LlamaError {
    fn from(error: hf_hub::api::sync::ApiError) -> Self {
        LlamaError::DownloadFailed(error.to_string())
    }
}
