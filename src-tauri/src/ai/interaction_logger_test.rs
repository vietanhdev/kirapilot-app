#[cfg(test)]
mod tests {
    use crate::ai::{
        ModelInfo, PerformanceMetrics, InteractionLogger, LoggingConfig, InteractionLog,
        DataClassification, AIServiceError
    };
    use chrono::Utc;
    use std::collections::HashMap;
    use tempfile::TempDir;
    use sea_orm_migration::MigratorTrait;

    /// Create a test database in a temporary directory
    async fn create_test_database() -> (TempDir, sea_orm::DatabaseConnection) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");
        
        let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
        let db = sea_orm::Database::connect(&db_url).await
            .expect("Failed to connect to test database");
        
        // Run migrations
        crate::database::migration::Migrator::up(&db, None).await
            .expect("Failed to run migrations");
        
        (temp_dir, db)
    }

    fn create_test_model_info() -> ModelInfo {
        ModelInfo {
            id: "test-model".to_string(),
            name: "Test Model".to_string(),
            provider: "test-provider".to_string(),
            version: Some("1.0.0".to_string()),
            max_context_length: Some(4096),
            metadata: HashMap::new(),
        }
    }

    fn create_test_performance_metrics() -> PerformanceMetrics {
        PerformanceMetrics {
            total_time_ms: 1500,
            llm_time_ms: 1200,
            input_tokens: Some(100),
            output_tokens: Some(50),
            memory_usage_mb: Some(256.5),
        }
    }

    #[tokio::test]
    async fn test_logging_config_default() {
        let config = LoggingConfig::default();
        
        assert!(config.enabled);
        assert_eq!(config.max_logs, 10000);
        assert_eq!(config.retention_days, 30);
        assert!(!config.log_sensitive_data);
        assert_eq!(config.log_level, "info");
    }

    #[tokio::test]
    async fn test_interaction_logger_creation() {
        let config = LoggingConfig::default();
        let logger = InteractionLogger::new(config.clone());
        
        assert_eq!(logger.get_config().enabled, config.enabled);
        assert_eq!(logger.get_config().max_logs, config.max_logs);
    }

    #[tokio::test]
    async fn test_interaction_logger_with_defaults() {
        let logger = InteractionLogger::with_defaults();
        let config = logger.get_config();
        
        assert!(config.enabled);
        assert_eq!(config.max_logs, 10000);
        assert_eq!(config.retention_days, 30);
    }

    #[tokio::test]
    async fn test_update_config() {
        let mut logger = InteractionLogger::with_defaults();
        
        let new_config = LoggingConfig {
            enabled: false,
            max_logs: 5000,
            retention_days: 15,
            log_sensitive_data: true,
            log_level: "debug".to_string(),
        };
        
        logger.update_config(new_config.clone());
        
        let updated_config = logger.get_config();
        assert_eq!(updated_config.enabled, new_config.enabled);
        assert_eq!(updated_config.max_logs, new_config.max_logs);
        assert_eq!(updated_config.retention_days, new_config.retention_days);
        assert_eq!(updated_config.log_sensitive_data, new_config.log_sensitive_data);
        assert_eq!(updated_config.log_level, new_config.log_level);
    }

    #[tokio::test]
    async fn test_log_interaction_simple() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        let model_info = create_test_model_info();
        let performance_metrics = create_test_performance_metrics();
        
        let result = logger.log_interaction_simple(
            "test-session-123".to_string(),
            "Hello, AI!".to_string(),
            "Hello! How can I help you?".to_string(),
            model_info,
            performance_metrics,
        ).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_interaction_disabled() {
        let config = LoggingConfig {
            enabled: false,
            ..Default::default()
        };
        let logger = InteractionLogger::new(config);
        
        let result = logger.log_interaction_simple(
            "test-session".to_string(),
            "Test message".to_string(),
            "Test response".to_string(),
            create_test_model_info(),
            create_test_performance_metrics(),
        ).await;
        
        // Should succeed even when disabled
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_error() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        let error = AIServiceError::llm_error("Test error message");
        let model_info = create_test_model_info();
        
        let result = logger.log_error(
            "error-session-123".to_string(),
            "This will cause an error".to_string(),
            &error,
            Some(model_info),
        ).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_error_without_model_info() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        let error = AIServiceError::config_error("Configuration error");
        
        let result = logger.log_error(
            "error-session-456".to_string(),
            "Configuration test".to_string(),
            &error,
            None,
        ).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_complete_interaction() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        
        let mut context = HashMap::new();
        context.insert("user_id".to_string(), serde_json::Value::String("user123".to_string()));
        context.insert("session_type".to_string(), serde_json::Value::String("chat".to_string()));
        
        let log = InteractionLog {
            id: "test-interaction-123".to_string(),
            session_id: "session-456".to_string(),
            timestamp: Utc::now(),
            user_message: "Create a task for me".to_string(),
            system_prompt: Some("You are a helpful assistant".to_string()),
            context,
            ai_response: "I'll create a task for you".to_string(),
            model_info: create_test_model_info(),
            performance_metrics: create_test_performance_metrics(),
            error: None,
            data_classification: DataClassification::Internal,
        };
        
        let result = logger.log_interaction(log).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_recent_logs() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        
        // Log several interactions
        for i in 1..=5 {
            let _ = logger.log_interaction_simple(
                format!("session-{}", i),
                format!("Message {}", i),
                format!("Response {}", i),
                create_test_model_info(),
                create_test_performance_metrics(),
            ).await;
        }
        
        // Retrieve recent logs
        let result = logger.get_recent_logs(3).await;
        assert!(result.is_ok());
        
        let logs = result.unwrap();
        assert!(logs.len() <= 3); // Should respect the limit
        
        // Logs should be in reverse chronological order (most recent first)
        if logs.len() > 1 {
            assert!(logs[0].timestamp >= logs[1].timestamp);
        }
    }

    #[tokio::test]
    async fn test_cleanup_old_logs() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        
        // Log some interactions
        for i in 1..=3 {
            let _ = logger.log_interaction_simple(
                format!("session-{}", i),
                format!("Message {}", i),
                format!("Response {}", i),
                create_test_model_info(),
                create_test_performance_metrics(),
            ).await;
        }
        
        // Cleanup (with default retention, should not delete recent logs)
        let result = logger.cleanup_old_logs().await;
        assert!(result.is_ok());
        
        let deleted_count = result.unwrap();
        // Should be 0 since logs are recent
        assert_eq!(deleted_count, 0);
    }

    #[tokio::test]
    async fn test_cleanup_old_logs_disabled() {
        let config = LoggingConfig {
            enabled: false,
            ..Default::default()
        };
        let logger = InteractionLogger::new(config);
        
        let result = logger.cleanup_old_logs().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_log_react_chain() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        let model_info = create_test_model_info();
        
        // Create a mock ReAct chain
        let mut chain = crate::ai::ReActChain {
            id: "react-chain-123".to_string(),
            user_request: "Create a task and start a timer".to_string(),
            steps: vec![
                crate::ai::ReActStep {
                    id: "step-1".to_string(),
                    step_type: crate::ai::ReActStepType::Thought,
                    content: "I need to create a task first".to_string(),
                    tool_call: None,
                    tool_result: None,
                    timestamp: Utc::now(),
                    duration_ms: Some(150),
                    metadata: HashMap::new(),
                },
                crate::ai::ReActStep {
                    id: "step-2".to_string(),
                    step_type: crate::ai::ReActStepType::Action,
                    content: "Creating task using create_task tool".to_string(),
                    tool_call: Some(crate::ai::ToolCall {
                        name: "create_task".to_string(),
                        args: {
                            let mut args = HashMap::new();
                            args.insert("title".to_string(), serde_json::Value::String("Test Task".to_string()));
                            args
                        },
                        id: "tool-call-1".to_string(),
                    }),
                    tool_result: Some(crate::ai::ToolResult {
                        success: true,
                        data: serde_json::Value::String("task-123".to_string()),
                        message: "Task created successfully".to_string(),
                        execution_time_ms: 200,
                        error: None,
                    }),
                    timestamp: Utc::now(),
                    duration_ms: Some(250),
                    metadata: HashMap::new(),
                },
            ],
            final_response: "I've created the task for you".to_string(),
            completed: true,
            iterations: 2,
            started_at: Utc::now() - chrono::Duration::seconds(5),
            completed_at: Some(Utc::now()),
            total_duration_ms: Some(2500),
            metadata: HashMap::new(),
        };
        
        let result = logger.log_react_chain(&chain, model_info).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_react_step() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let config = LoggingConfig {
            log_level: "debug".to_string(),
            ..Default::default()
        };
        let logger = InteractionLogger::new(config);
        let model_info = create_test_model_info();
        
        let step = crate::ai::ReActStep {
            id: "debug-step-1".to_string(),
            step_type: crate::ai::ReActStepType::Thought,
            content: "Analyzing the user's request".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(100),
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("confidence".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(0.85).unwrap()));
                meta
            },
        };
        
        let result = logger.log_react_step("chain-123", &step, &model_info).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_react_step_non_debug_level() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let config = LoggingConfig {
            log_level: "info".to_string(), // Not debug level
            ..Default::default()
        };
        let logger = InteractionLogger::new(config);
        let model_info = create_test_model_info();
        
        let step = crate::ai::ReActStep {
            id: "step-1".to_string(),
            step_type: crate::ai::ReActStepType::Action,
            content: "Taking action".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(200),
            metadata: HashMap::new(),
        };
        
        let result = logger.log_react_step("chain-456", &step, &model_info).await;
        // Should succeed but not actually log since log level is not debug
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_log_react_performance() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        let model_info = create_test_model_info();
        
        let chain = crate::ai::ReActChain {
            id: "perf-chain-123".to_string(),
            user_request: "Complex multi-step request".to_string(),
            steps: vec![
                crate::ai::ReActStep {
                    id: "step-1".to_string(),
                    step_type: crate::ai::ReActStepType::Thought,
                    content: "Thinking".to_string(),
                    tool_call: None,
                    tool_result: None,
                    timestamp: Utc::now(),
                    duration_ms: Some(100),
                    metadata: HashMap::new(),
                },
                crate::ai::ReActStep {
                    id: "step-2".to_string(),
                    step_type: crate::ai::ReActStepType::Action,
                    content: "Acting".to_string(),
                    tool_call: Some(crate::ai::ToolCall {
                        name: "test_tool".to_string(),
                        args: HashMap::new(),
                        id: "tool-1".to_string(),
                    }),
                    tool_result: Some(crate::ai::ToolResult {
                        success: true,
                        data: serde_json::Value::Null,
                        message: "Success".to_string(),
                        execution_time_ms: 150,
                        error: None,
                    }),
                    timestamp: Utc::now(),
                    duration_ms: Some(200),
                    metadata: HashMap::new(),
                },
            ],
            final_response: "Task completed".to_string(),
            completed: true,
            iterations: 3,
            started_at: Utc::now() - chrono::Duration::seconds(10),
            completed_at: Some(Utc::now()),
            total_duration_ms: Some(5000),
            metadata: HashMap::new(),
        };
        
        let result = logger.log_react_performance(&chain, &model_info).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_data_classification_default() {
        let classification = DataClassification::default();
        assert!(matches!(classification, DataClassification::Internal));
    }

    #[tokio::test]
    async fn test_data_classification_serialization() {
        let classifications = vec![
            DataClassification::Public,
            DataClassification::Internal,
            DataClassification::Confidential,
            DataClassification::Sensitive,
        ];
        
        for classification in classifications {
            let serialized = serde_json::to_string(&classification).unwrap();
            let deserialized: DataClassification = serde_json::from_str(&serialized).unwrap();
            assert_eq!(
                std::mem::discriminant(&classification),
                std::mem::discriminant(&deserialized)
            );
        }
    }

    #[tokio::test]
    async fn test_performance_metrics_creation() {
        let metrics = PerformanceMetrics {
            total_time_ms: 2000,
            llm_time_ms: 1500,
            input_tokens: Some(200),
            output_tokens: Some(100),
            memory_usage_mb: Some(512.0),
        };
        
        assert_eq!(metrics.total_time_ms, 2000);
        assert_eq!(metrics.llm_time_ms, 1500);
        assert_eq!(metrics.input_tokens, Some(200));
        assert_eq!(metrics.output_tokens, Some(100));
        assert_eq!(metrics.memory_usage_mb, Some(512.0));
    }

    #[tokio::test]
    async fn test_interaction_log_creation() {
        let mut context = HashMap::new();
        context.insert("test_key".to_string(), serde_json::Value::String("test_value".to_string()));
        
        let log = InteractionLog {
            id: "log-123".to_string(),
            session_id: "session-456".to_string(),
            timestamp: Utc::now(),
            user_message: "Test message".to_string(),
            system_prompt: Some("System prompt".to_string()),
            context: context.clone(),
            ai_response: "AI response".to_string(),
            model_info: create_test_model_info(),
            performance_metrics: create_test_performance_metrics(),
            error: None,
            data_classification: DataClassification::Confidential,
        };
        
        assert_eq!(log.id, "log-123");
        assert_eq!(log.session_id, "session-456");
        assert_eq!(log.user_message, "Test message");
        assert_eq!(log.system_prompt, Some("System prompt".to_string()));
        assert_eq!(log.context, context);
        assert_eq!(log.ai_response, "AI response");
        assert!(log.error.is_none());
        assert!(matches!(log.data_classification, DataClassification::Confidential));
    }

    #[tokio::test]
    async fn test_interaction_log_with_error() {
        let log = InteractionLog {
            id: "error-log-123".to_string(),
            session_id: "error-session-456".to_string(),
            timestamp: Utc::now(),
            user_message: "This will fail".to_string(),
            system_prompt: None,
            context: HashMap::new(),
            ai_response: String::new(),
            model_info: create_test_model_info(),
            performance_metrics: PerformanceMetrics {
                total_time_ms: 100,
                llm_time_ms: 0,
                input_tokens: None,
                output_tokens: None,
                memory_usage_mb: None,
            },
            error: Some("Test error occurred".to_string()),
            data_classification: DataClassification::Internal,
        };
        
        assert!(log.error.is_some());
        assert_eq!(log.error.unwrap(), "Test error occurred");
        assert!(log.ai_response.is_empty());
    }

    #[tokio::test]
    async fn test_concurrent_logging() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = std::sync::Arc::new(InteractionLogger::with_defaults());
        let mut handles = Vec::new();
        
        // Spawn multiple concurrent logging tasks
        for i in 0..10 {
            let logger_clone = logger.clone();
            let handle = tokio::spawn(async move {
                logger_clone.log_interaction_simple(
                    format!("concurrent-session-{}", i),
                    format!("Concurrent message {}", i),
                    format!("Concurrent response {}", i),
                    create_test_model_info(),
                    create_test_performance_metrics(),
                ).await
            });
            handles.push(handle);
        }
        
        // Wait for all tasks to complete
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_logging_with_large_data() {
        let (_temp_dir, _db) = create_test_database().await;
        
        let logger = InteractionLogger::with_defaults();
        
        // Create large message and response
        let large_message = "x".repeat(10000);
        let large_response = "y".repeat(15000);
        
        let result = logger.log_interaction_simple(
            "large-data-session".to_string(),
            large_message,
            large_response,
            create_test_model_info(),
            create_test_performance_metrics(),
        ).await;
        
        assert!(result.is_ok());
    }
}