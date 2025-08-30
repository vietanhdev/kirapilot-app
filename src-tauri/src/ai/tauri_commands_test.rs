#[cfg(test)]
mod tests {
    use crate::ai::{AIRequest, AIErrorResponse};
    use serde_json;
    use std::collections::HashMap;

    #[test]
    fn test_ai_request_validation() {
        // Test valid request
        let valid_request = AIRequest {
            message: "Hello, AI!".to_string(),
            session_id: Some("test-session".to_string()),
            model_preference: Some("gemini".to_string()),
            context: HashMap::new(),
        };
        assert!(valid_request.validate().is_ok());

        // Test empty message
        let empty_message_request = AIRequest {
            message: "".to_string(),
            session_id: None,
            model_preference: None,
            context: HashMap::new(),
        };
        assert!(empty_message_request.validate().is_err());

        // Test message too long
        let long_message_request = AIRequest {
            message: "a".repeat(100_001),
            session_id: None,
            model_preference: None,
            context: HashMap::new(),
        };
        assert!(long_message_request.validate().is_err());

        // Test invalid model preference
        let invalid_model_request = AIRequest {
            message: "Hello".to_string(),
            session_id: None,
            model_preference: Some("invalid-model".to_string()),
            context: HashMap::new(),
        };
        assert!(invalid_model_request.validate().is_err());

        // Test empty session ID
        let empty_session_request = AIRequest {
            message: "Hello".to_string(),
            session_id: Some("".to_string()),
            model_preference: None,
            context: HashMap::new(),
        };
        assert!(empty_session_request.validate().is_err());

        // Test session ID too long
        let long_session_request = AIRequest {
            message: "Hello".to_string(),
            session_id: Some("a".repeat(256)),
            model_preference: None,
            context: HashMap::new(),
        };
        assert!(long_session_request.validate().is_err());
    }

    #[test]
    fn test_ai_error_response_serialization() {
        let error = crate::ai::AIServiceError::invalid_request("Test error message");
        let error_response = AIErrorResponse::from(error);
        
        assert_eq!(error_response.error_type, "invalid_request");
        assert_eq!(error_response.message, "Test error message");
        assert_eq!(error_response.code, Some("INVALID_REQUEST".to_string()));

        // Test serialization to JSON
        let json_result = serde_json::to_value(&error_response);
        assert!(json_result.is_ok());
        
        let json = json_result.unwrap();
        assert_eq!(json["error_type"], "invalid_request");
        assert_eq!(json["message"], "Test error message");
        assert_eq!(json["code"], "INVALID_REQUEST");
    }

    #[test]
    fn test_provider_unavailable_error() {
        let error = crate::ai::AIServiceError::provider_unavailable("test-provider");
        let error_response = AIErrorResponse::from(error);
        
        assert_eq!(error_response.error_type, "provider_unavailable");
        assert!(error_response.message.contains("test-provider"));
        assert_eq!(error_response.code, Some("PROVIDER_UNAVAILABLE".to_string()));
        
        // Check details field
        assert!(error_response.details.is_some());
        let details = error_response.details.unwrap();
        assert_eq!(details["provider"], "test-provider");
    }

    #[test]
    fn test_llm_error_with_code() {
        let error = crate::ai::AIServiceError::llm_error_with_code("API error", "API_RATE_LIMIT");
        let error_response = AIErrorResponse::from(error);
        
        assert_eq!(error_response.error_type, "llm_error");
        assert_eq!(error_response.message, "API error");
        assert_eq!(error_response.code, Some("API_RATE_LIMIT".to_string()));
    }

    #[test]
    fn test_config_error() {
        let error = crate::ai::AIServiceError::config_error("Invalid configuration");
        let error_response = AIErrorResponse::from(error);
        
        assert_eq!(error_response.error_type, "config_error");
        assert_eq!(error_response.message, "Invalid configuration");
        assert_eq!(error_response.code, None);
    }
}