#[cfg(test)]
mod tests {
    use crate::ai::{
        AIResult, AIServiceError, SmartToolRegistry, Tool, ToolCapability, ToolContext,
        ToolExecutionResult, InferredParameters, ParameterDefinition, ParameterValidation, 
        ToolExample, PermissionLevel, ContextAnalyzer
    };
    use crate::ai::react_engine::ToolRegistry;
    use async_trait::async_trait;
    use chrono::Utc;
    use std::collections::HashMap;
    use tokio::time::Duration;

    /// Mock tool for testing
    struct MockTool {
        name: String,
        description: String,
        should_fail: bool,
        execution_time_ms: u64,
        required_permissions: Vec<PermissionLevel>,
    }

    impl MockTool {
        fn new(name: &str, description: &str) -> Self {
            Self {
                name: name.to_string(),
                description: description.to_string(),
                should_fail: false,
                execution_time_ms: 100,
                required_permissions: vec![PermissionLevel::ReadOnly],
            }
        }

        fn with_permissions(mut self, permissions: Vec<PermissionLevel>) -> Self {
            self.required_permissions = permissions;
            self
        }

        fn with_failure(mut self, should_fail: bool) -> Self {
            self.should_fail = should_fail;
            self
        }

        fn with_execution_time(mut self, time_ms: u64) -> Self {
            self.execution_time_ms = time_ms;
            self
        }
    }

    #[async_trait]
    impl Tool for MockTool {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            &self.description
        }

        fn capability(&self) -> ToolCapability {
            ToolCapability {
                name: self.name.clone(),
                description: self.description.clone(),
                required_parameters: vec![
                    ParameterDefinition {
                        name: "title".to_string(),
                        param_type: "string".to_string(),
                        description: "Task title".to_string(),
                        default_value: None,
                        validation: None,
                        inference_sources: vec!["user_message".to_string()],
                    }
                ],
                optional_parameters: vec![
                    ParameterDefinition {
                        name: "priority".to_string(),
                        param_type: "number".to_string(),
                        description: "Task priority".to_string(),
                        default_value: Some(serde_json::Value::Number(serde_json::Number::from(1))),
                        validation: Some(ParameterValidation {
                            min: Some(0.0),
                            max: Some(3.0),
                            ..Default::default()
                        }),
                        inference_sources: vec!["user_message".to_string()],
                    }
                ],
                required_permissions: self.required_permissions.clone(),
                requires_confirmation: false,
                category: "task_management".to_string(),
                examples: vec![
                    ToolExample {
                        user_request: "Create a task called 'Review code'".to_string(),
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("title".to_string(), serde_json::Value::String("Review code".to_string()));
                            params
                        },
                        description: "Creating a task with a specific title".to_string(),
                    }
                ],
            }
        }

        async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
            let mut parameters = HashMap::new();
            let mut confidence = 0.8;
            let mut needs_confirmation = Vec::new();
            let mut alternatives = Vec::new();

            // Try to extract title from user message
            if let Some(title) = extract_quoted_text(&context.user_message) {
                parameters.insert("title".to_string(), serde_json::Value::String(title));
            } else if context.user_message.to_lowercase().contains("task") {
                // Extract task description from message
                let title = context.user_message
                    .replace("create", "")
                    .replace("task", "")
                    .replace("add", "")
                    .trim()
                    .to_string();
                if !title.is_empty() {
                    parameters.insert("title".to_string(), serde_json::Value::String(title));
                } else {
                    confidence = 0.3;
                    needs_confirmation.push("title".to_string());
                }
            }

            // Try to extract priority
            let priority = if context.user_message.to_lowercase().contains("urgent") {
                3
            } else if context.user_message.to_lowercase().contains("high") {
                2
            } else if context.user_message.to_lowercase().contains("low") {
                0
            } else {
                1
            };
            parameters.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(priority)));

            // Create alternative with different priority
            let mut alt_params = parameters.clone();
            alt_params.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(1)));
            alternatives.push(alt_params);

            Ok(InferredParameters {
                parameters,
                confidence,
                needs_confirmation,
                alternatives,
                explanation: format!("Inferred parameters from user message: '{}'", context.user_message),
            })
        }

        fn validate_parameters(&self, parameters: &HashMap<String, serde_json::Value>) -> AIResult<()> {
            // Check required parameters
            if !parameters.contains_key("title") {
                return Err(AIServiceError::invalid_request("Missing required parameter: title"));
            }

            // Validate title
            if let Some(title_value) = parameters.get("title") {
                if let Some(title) = title_value.as_str() {
                    if title.trim().is_empty() {
                        return Err(AIServiceError::invalid_request("Title cannot be empty"));
                    }
                    if title.len() > 200 {
                        return Err(AIServiceError::invalid_request("Title too long (max 200 characters)"));
                    }
                } else {
                    return Err(AIServiceError::invalid_request("Title must be a string"));
                }
            }

            // Validate priority if present
            if let Some(priority_value) = parameters.get("priority") {
                if let Some(priority) = priority_value.as_u64() {
                    if priority > 3 {
                        return Err(AIServiceError::invalid_request("Priority must be between 0 and 3"));
                    }
                } else {
                    return Err(AIServiceError::invalid_request("Priority must be a number"));
                }
            }

            Ok(())
        }

        async fn execute(&self, parameters: HashMap<String, serde_json::Value>, _context: &ToolContext) -> AIResult<ToolExecutionResult> {
            let start_time = std::time::Instant::now();
            
            // Simulate execution time
            tokio::time::sleep(Duration::from_millis(self.execution_time_ms)).await;

            if self.should_fail {
                return Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: "Mock tool execution failed".to_string(),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    error: Some("Simulated failure".to_string()),
                    suggestions: vec!["Try again later".to_string()],
                    metadata: HashMap::new(),
                });
            }

            let title = parameters.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled");
            let priority = parameters.get("priority")
                .and_then(|v| v.as_u64())
                .unwrap_or(1);

            let mut result_data = HashMap::new();
            result_data.insert("id".to_string(), serde_json::Value::String("mock-task-123".to_string()));
            result_data.insert("title".to_string(), serde_json::Value::String(title.to_string()));
            result_data.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(priority)));
            result_data.insert("created_at".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));

            Ok(ToolExecutionResult {
                success: true,
                data: serde_json::to_value(result_data).unwrap(),
                message: format!("Successfully created task: {}", title),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                error: None,
                suggestions: vec![
                    "You can now start working on this task".to_string(),
                    "Set a timer to track your progress".to_string(),
                ],
                metadata: HashMap::new(),
            })
        }
    }

    fn extract_quoted_text(text: &str) -> Option<String> {
        if let Some(start) = text.find('"') {
            if let Some(end) = text[start + 1..].find('"') {
                return Some(text[start + 1..start + 1 + end].to_string());
            }
        }
        None
    }

    fn create_test_context(user_message: &str) -> ToolContext {
        ToolContext {
            user_message: user_message.to_string(),
            conversation_history: Vec::new(),
            active_task_id: None,
            active_timer_session_id: None,
            recent_task_ids: Vec::new(),
            current_time: Utc::now(),
            user_preferences: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[tokio::test]
    async fn test_smart_tool_registry_creation() {
        let permissions = vec![PermissionLevel::ReadOnly, PermissionLevel::ModifyTasks];
        let registry = SmartToolRegistry::new(permissions.clone());
        
        // Test that registry was created successfully
        let available_tools = registry.get_available_tools();
        assert!(available_tools.is_empty()); // No tools registered yet
    }

    #[tokio::test]
    async fn test_tool_registration() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        
        registry.register_tool(tool);
        
        let available_tools = registry.get_available_tools();
        assert_eq!(available_tools.len(), 1);
        assert!(available_tools.contains(&"create_task".to_string()));
        
        let stats = registry.get_usage_stats("create_task");
        assert!(stats.is_some());
        let stats = stats.unwrap();
        assert_eq!(stats.total_executions, 0);
        assert_eq!(stats.successful_executions, 0);
    }

    #[tokio::test]
    async fn test_get_available_tools_with_permissions() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::ReadOnly]);
        
        // Register tools with different permission requirements
        let read_only_tool = Box::new(MockTool::new("list_tasks", "Lists tasks")
            .with_permissions(vec![PermissionLevel::ReadOnly]));
        let modify_tool = Box::new(MockTool::new("create_task", "Creates tasks")
            .with_permissions(vec![PermissionLevel::ModifyTasks]));
        let full_access_tool = Box::new(MockTool::new("delete_all", "Deletes everything")
            .with_permissions(vec![PermissionLevel::FullAccess]));
        
        registry.register_tool(read_only_tool);
        registry.register_tool(modify_tool);
        registry.register_tool(full_access_tool);
        
        let available_tools = registry.get_available_tools();
        
        // Should only have read-only tool
        assert_eq!(available_tools.len(), 1);
        assert!(available_tools.contains(&"list_tasks".to_string()));
        assert!(!available_tools.contains(&"create_task".to_string()));
        assert!(!available_tools.contains(&"delete_all".to_string()));
    }

    #[tokio::test]
    async fn test_get_available_tools_with_full_access() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        
        let read_only_tool = Box::new(MockTool::new("list_tasks", "Lists tasks")
            .with_permissions(vec![PermissionLevel::ReadOnly]));
        let modify_tool = Box::new(MockTool::new("create_task", "Creates tasks")
            .with_permissions(vec![PermissionLevel::ModifyTasks]));
        
        registry.register_tool(read_only_tool);
        registry.register_tool(modify_tool);
        
        let available_tools = registry.get_available_tools();
        
        // Should have all tools with FullAccess
        assert_eq!(available_tools.len(), 2);
        assert!(available_tools.contains(&"list_tasks".to_string()));
        assert!(available_tools.contains(&"create_task".to_string()));
    }

    #[tokio::test]
    async fn test_tool_capability_retrieval() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        
        registry.register_tool(tool);
        
        let capability = registry.get_tool_capability("create_task");
        assert!(capability.is_some());
        
        let cap = capability.unwrap();
        assert_eq!(cap.name, "create_task");
        assert_eq!(cap.description, "Creates a new task");
        assert_eq!(cap.category, "task_management");
        assert!(!cap.required_parameters.is_empty());
        assert!(!cap.examples.is_empty());
        
        // Test non-existent tool
        let no_capability = registry.get_tool_capability("non_existent");
        assert!(no_capability.is_none());
    }

    #[tokio::test]
    async fn test_suggest_tools() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        
        let create_tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        let list_tool = Box::new(MockTool::new("list_tasks", "Lists all tasks"));
        let timer_tool = Box::new(MockTool::new("start_timer", "Starts a timer"));
        
        registry.register_tool(create_tool);
        registry.register_tool(list_tool);
        registry.register_tool(timer_tool);
        
        // Test task creation suggestion
        let context = create_test_context("I need to create a new task for reviewing code");
        let suggestions = registry.suggest_tools(&context).await.unwrap();
        
        assert!(!suggestions.is_empty());
        
        // Should suggest create_task with high relevance
        let create_suggestion = suggestions.iter()
            .find(|s| s.tool_name == "create_task")
            .expect("Should suggest create_task");
        assert!(create_suggestion.relevance_score > 0.5);
        assert!(create_suggestion.confidence > 0.0);
        
        // Test task listing suggestion
        let context = create_test_context("Show me all my tasks");
        let suggestions = registry.suggest_tools(&context).await.unwrap();
        
        let list_suggestion = suggestions.iter()
            .find(|s| s.tool_name == "list_tasks")
            .expect("Should suggest list_tasks");
        assert!(list_suggestion.relevance_score > 0.5);
    }

    #[tokio::test]
    async fn test_execute_tool_smart_success() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        
        registry.register_tool(tool);
        
        let context = create_test_context("Create a task called 'Review PR #123'");
        let result = registry.execute_tool_smart("create_task", &context, None).await;
        
        assert!(result.is_ok());
        let exec_result = result.unwrap();
        assert!(exec_result.success);
        assert!(exec_result.message.contains("Review PR #123"));
        assert!(!exec_result.suggestions.is_empty());
        
        // Check usage stats were updated
        let stats = registry.get_usage_stats("create_task").unwrap();
        assert_eq!(stats.total_executions, 1);
        assert_eq!(stats.successful_executions, 1);
        assert!(stats.avg_execution_time_ms > 0.0);
    }

    #[tokio::test]
    async fn test_execute_tool_smart_with_user_params() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        
        registry.register_tool(tool);
        
        let mut user_params = HashMap::new();
        user_params.insert("title".to_string(), serde_json::Value::String("Custom Task".to_string()));
        user_params.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(3)));
        
        let context = create_test_context("Create a task");
        let result = registry.execute_tool_smart("create_task", &context, Some(user_params)).await;
        
        assert!(result.is_ok());
        let exec_result = result.unwrap();
        assert!(exec_result.success);
        assert!(exec_result.message.contains("Custom Task"));
    }

    #[tokio::test]
    async fn test_execute_tool_smart_permission_denied() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::ReadOnly]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task")
            .with_permissions(vec![PermissionLevel::ModifyTasks]));
        
        registry.register_tool(tool);
        
        let context = create_test_context("Create a task");
        let result = registry.execute_tool_smart("create_task", &context, None).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::PermissionDenied { .. }));
    }

    #[tokio::test]
    async fn test_execute_tool_smart_tool_not_found() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        
        let context = create_test_context("Do something");
        let result = registry.execute_tool_smart("non_existent_tool", &context, None).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::InternalError { .. }));
    }

    #[tokio::test]
    async fn test_execute_tool_smart_validation_failure() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task"));
        
        registry.register_tool(tool);
        
        let mut invalid_params = HashMap::new();
        invalid_params.insert("title".to_string(), serde_json::Value::String("".to_string())); // Empty title
        
        let context = create_test_context("Create a task");
        let result = registry.execute_tool_smart("create_task", &context, Some(invalid_params)).await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, AIServiceError::InvalidRequest { .. }));
    }

    #[tokio::test]
    async fn test_execute_tool_smart_execution_failure() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task")
            .with_failure(true));
        
        registry.register_tool(tool);
        
        let context = create_test_context("Create a task called 'Test'");
        let result = registry.execute_tool_smart("create_task", &context, None).await;
        
        assert!(result.is_ok());
        let exec_result = result.unwrap();
        assert!(!exec_result.success);
        assert!(exec_result.error.is_some());
        
        // Check usage stats reflect the failure
        let stats = registry.get_usage_stats("create_task").unwrap();
        assert_eq!(stats.total_executions, 1);
        assert_eq!(stats.successful_executions, 0);
    }

    #[tokio::test]
    async fn test_usage_stats_tracking() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("create_task", "Creates a new task")
            .with_execution_time(150));
        
        registry.register_tool(tool);
        
        let context = create_test_context("Create task 1");
        
        // Execute multiple times
        for i in 1..=3 {
            let _context = create_test_context(&format!("Create task {}", i));
            let _ = registry.execute_tool_smart("create_task", &_context, None).await;
        }
        
        let stats = registry.get_usage_stats("create_task").unwrap();
        assert_eq!(stats.total_executions, 3);
        assert_eq!(stats.successful_executions, 3);
        assert!(stats.avg_execution_time_ms >= 150.0);
        assert!(stats.last_used <= Utc::now());
    }

    #[tokio::test]
    async fn test_context_analyzer_extract_task_title() {
        let analyzer = ContextAnalyzer::new();
        
        // Test colon pattern
        let title = analyzer.extract_task_title("Create task: Review the new feature");
        assert_eq!(title, Some("Review the new feature".to_string()));
        
        // Test quoted pattern
        let title = analyzer.extract_task_title("Add a task called \"Fix the bug\"");
        assert_eq!(title, Some("Fix the bug".to_string()));
        
        // Test quoted pattern with create task
        let title = analyzer.extract_task_title("Create task \"Update documentation\"");
        assert_eq!(title, Some("Update documentation".to_string()));
        
        // Test no match
        let title = analyzer.extract_task_title("Just some random text");
        assert!(title.is_none());
    }

    #[tokio::test]
    async fn test_context_analyzer_extract_priority() {
        let analyzer = ContextAnalyzer::new();
        
        // Test urgent
        let priority = analyzer.extract_priority("This is urgent task");
        assert_eq!(priority, Some(3));
        
        // Test high priority
        let priority = analyzer.extract_priority("High priority item");
        assert_eq!(priority, Some(2));
        
        // Test low priority
        let priority = analyzer.extract_priority("Low priority task");
        assert_eq!(priority, Some(0));
        
        // Test default
        let priority = analyzer.extract_priority("Regular task");
        assert_eq!(priority, Some(1));
    }

    #[tokio::test]
    async fn test_context_analyzer_extract_time_estimate() {
        let analyzer = ContextAnalyzer::new();
        
        // Test minutes
        let time = analyzer.extract_time_estimate("This will take 30 minutes");
        assert_eq!(time, Some(30));
        
        // Test hours
        let time = analyzer.extract_time_estimate("About 2 hours of work");
        assert_eq!(time, Some(120));
        
        // Test abbreviated forms
        let time = analyzer.extract_time_estimate("Should be done in 45 mins");
        assert_eq!(time, Some(45));
        
        let time = analyzer.extract_time_estimate("Roughly 1 hr");
        assert_eq!(time, Some(60));
        
        // Test no match
        let time = analyzer.extract_time_estimate("No time mentioned");
        assert!(time.is_none());
    }

    #[tokio::test]
    async fn test_parameter_validation() {
        let validation = ParameterValidation {
            min: Some(0.0),
            max: Some(10.0),
            min_length: Some(1),
            max_length: Some(100),
            pattern: Some(r"^[a-zA-Z0-9\s]+$".to_string()),
            allowed_values: Some(vec![
                serde_json::Value::String("low".to_string()),
                serde_json::Value::String("medium".to_string()),
                serde_json::Value::String("high".to_string()),
            ]),
        };
        
        // Test all fields are set correctly
        assert_eq!(validation.min, Some(0.0));
        assert_eq!(validation.max, Some(10.0));
        assert_eq!(validation.min_length, Some(1));
        assert_eq!(validation.max_length, Some(100));
        assert!(validation.pattern.is_some());
        assert!(validation.allowed_values.is_some());
    }

    #[tokio::test]
    async fn test_tool_example() {
        let mut params = HashMap::new();
        params.insert("title".to_string(), serde_json::Value::String("Test Task".to_string()));
        
        let example = ToolExample {
            user_request: "Create a task called 'Test Task'".to_string(),
            parameters: params.clone(),
            description: "Example of creating a task".to_string(),
        };
        
        assert_eq!(example.user_request, "Create a task called 'Test Task'");
        assert_eq!(example.parameters, params);
        assert_eq!(example.description, "Example of creating a task");
    }

    #[tokio::test]
    async fn test_permission_levels() {
        // Test permission hierarchy
        assert_ne!(PermissionLevel::ReadOnly, PermissionLevel::ModifyTasks);
        assert_ne!(PermissionLevel::ModifyTasks, PermissionLevel::FullAccess);
        
        // Test serialization
        let permission = PermissionLevel::FullAccess;
        let serialized = serde_json::to_string(&permission).unwrap();
        let deserialized: PermissionLevel = serde_json::from_str(&serialized).unwrap();
        assert_eq!(permission, deserialized);
    }

    #[tokio::test]
    async fn test_set_permissions() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::ReadOnly]);
        
        // Register a tool that requires FullAccess
        let tool = Box::new(MockTool::new("admin_tool", "Admin tool")
            .with_permissions(vec![PermissionLevel::FullAccess]));
        registry.register_tool(tool);
        
        // Initially should not have access to admin tool
        let available_tools = registry.get_available_tools();
        assert!(!available_tools.contains(&"admin_tool".to_string()));
        
        // Update permissions to FullAccess
        registry.set_permissions(vec![PermissionLevel::FullAccess]);
        
        // Now should have access to admin tool
        let available_tools = registry.get_available_tools();
        assert!(available_tools.contains(&"admin_tool".to_string()));
    }

    #[tokio::test]
    async fn test_tool_registry_trait_implementation() {
        let mut registry = SmartToolRegistry::new(vec![PermissionLevel::FullAccess]);
        let tool = Box::new(MockTool::new("test_tool", "Test tool"));
        
        registry.register_tool(tool);
        
        // Test ToolRegistry trait methods
        assert!(registry.has_tool("test_tool"));
        assert!(!registry.has_tool("non_existent"));
        
        let available_tools = registry.get_available_tools();
        assert!(available_tools.contains(&"test_tool".to_string()));
        
        // Test tool execution through trait
        let mut args = HashMap::new();
        args.insert("title".to_string(), serde_json::Value::String("Test".to_string()));
        
        let result = registry.execute_tool("test_tool", &args).await;
        assert!(result.is_ok());
    }
}