#[cfg(test)]
mod integration_tests {
    use crate::database::repositories::tests::setup_test_db;
    use crate::database::repositories::{
        ai_repository::CreateAiInteractionRequest, task_repository::CreateTaskRequest,
        time_tracking_repository::CreateTimeSessionRequest, AiRepository, TaskRepository,
        TimeTrackingRepository,
    };
    use chrono::Utc;

    #[tokio::test]
    async fn test_task_repository_integration() {
        // Initialize test database
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create a test task
        let request = CreateTaskRequest {
            title: "Test Task".to_string(),
            description: Some("Test Description".to_string()),
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: Some(60),
            due_date: None,
            scheduled_date: None,
            tags: Some(vec!["test".to_string()]),
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");
        assert_eq!(task.title, "Test Task");
        assert_eq!(task.priority, 1);

        // Find the task
        let found_task = repo
            .find_by_id(&task.id)
            .await
            .expect("Failed to find task");
        assert!(found_task.is_some());
        assert_eq!(found_task.unwrap().title, "Test Task");

        // Clean up
        repo.delete_task(&task.id)
            .await
            .expect("Failed to delete task");
    }

    #[tokio::test]
    async fn test_time_tracking_repository_integration() {
        // Initialize test database
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let time_repo = TimeTrackingRepository::new(db);

        // Create a test task first
        let task_request = CreateTaskRequest {
            title: "Time Test Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: Some(60),
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let task = task_repo
            .create_task(task_request)
            .await
            .expect("Failed to create task");

        // Create a time session
        let session_request = CreateTimeSessionRequest {
            task_id: task.id.clone(),
            start_time: Utc::now(),
            notes: Some("Test session".to_string()),
        };

        let session = time_repo
            .create_session(session_request)
            .await
            .expect("Failed to create session");
        assert_eq!(session.task_id, task.id);
        assert!(session.is_active);

        // Stop the session
        let stopped_session = time_repo
            .stop_session(&session.id, Some("Completed".to_string()))
            .await
            .expect("Failed to stop session");
        assert!(!stopped_session.is_active);
        assert!(stopped_session.end_time.is_some());

        // Clean up
        time_repo
            .delete_session(&session.id)
            .await
            .expect("Failed to delete session");
        task_repo
            .delete_task(&task.id)
            .await
            .expect("Failed to delete task");
    }

    #[tokio::test]
    async fn test_ai_repository_integration() {
        // Initialize test database
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = AiRepository::new(db);

        // Create an AI interaction
        let request = CreateAiInteractionRequest {
            message: "Test message".to_string(),
            response: "Test response".to_string(),
            action_taken: Some("create_task".to_string()),
            reasoning: Some("User requested task creation".to_string()),
            tools_used: Some(vec!["task_manager".to_string()]),
            confidence: Some(0.95),
        };

        let interaction = repo
            .create_interaction(request)
            .await
            .expect("Failed to create interaction");
        assert_eq!(interaction.message, "Test message");
        assert_eq!(interaction.response, "Test response");
        assert_eq!(interaction.confidence, Some(0.95));

        // Find the interaction
        let found_interaction = repo
            .find_by_id(&interaction.id)
            .await
            .expect("Failed to find interaction");
        assert!(found_interaction.is_some());
        assert_eq!(found_interaction.unwrap().message, "Test message");

        // Get stats
        let stats = repo.get_ai_stats().await.expect("Failed to get stats");
        assert!(stats.total_interactions > 0);

        // Clean up
        repo.delete_interaction(&interaction.id)
            .await
            .expect("Failed to delete interaction");
    }
}
