#[cfg(test)]
mod tests {
    // Tests for service manager
    use crate::ai::{AIConfig, AIServiceManager, AIRequest};
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_ai_service_manager_creation() {
        let config = AIConfig::default();
        let service_manager = AIServiceManager::new(config);
        
        // Test that the service manager can be created
        assert!(service_manager.initialize().await.is_ok());
    }

    #[tokio::test]
    async fn test_ai_service_manager_status() {
        let config = AIConfig::default();
        let service_manager = AIServiceManager::new(config);
        
        // Initialize the service
        service_manager.initialize().await.unwrap();
        
        // Get status
        let status = service_manager.get_status().await;
        
        // Should have the default provider
        assert_eq!(status.active_provider, "gemini");
        assert!(status.providers.contains_key("gemini"));
    }

    #[tokio::test]
    async fn test_ai_request_processing_without_providers() {
        let config = AIConfig::default();
        let service_manager = AIServiceManager::new(config);
        
        // Initialize the service
        service_manager.initialize().await.unwrap();
        
        // Create a test request
        let request = AIRequest {
            message: "Hello, AI!".to_string(),
            session_id: None,
            model_preference: None,
            context: HashMap::new(),
        };
        
        // Process the request - should fail because no providers are registered
        let result = service_manager.process_message(request).await;
        assert!(result.is_err());
    }
}