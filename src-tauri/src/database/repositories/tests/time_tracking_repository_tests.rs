#[cfg(test)]
mod tests {
    use super::super::super::tests::setup_test_db;
    use crate::database::repositories::{
        task_repository::{CreateTaskRequest, TaskRepository},
        time_tracking_repository::{
            CreateTimeSessionRequest, TimeTrackingRepository, UpdateTimeSessionRequest,
        },
    };
    use chrono::Utc;

    async fn create_test_task(repo: &TaskRepository) -> String {
        let request = CreateTaskRequest {
            title: "Test Task for Time Tracking".to_string(),
            description: None,
            priority: 1,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let task = repo
            .create_task(request)
            .await
            .expect("Failed to create test task");
        task.id
    }

    #[tokio::test]
    async fn test_create_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateTimeSessionRequest {
            task_id: task_id.clone(),
            start_time: Utc::now(),
            notes: Some("Starting work on this task".to_string()),
        };

        let result = repo.create_session(request).await;
        assert!(result.is_ok());

        let session = result.unwrap();
        assert_eq!(session.task_id, task_id);
        assert!(session.is_active);
        assert_eq!(session.paused_time, 0);
        assert_eq!(
            session.notes,
            Some("Starting work on this task".to_string())
        );
    }

    #[tokio::test]
    async fn test_find_active_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create an active session
        let request = CreateTimeSessionRequest {
            task_id: task_id.clone(),
            start_time: Utc::now(),
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Find active session
        let active_session = repo
            .find_active_session(&task_id)
            .await
            .expect("Failed to find active session");

        assert!(active_session.is_some());
        let active_session = active_session.unwrap();
        assert_eq!(active_session.id, created_session.id);
        assert!(active_session.is_active);
    }

    #[tokio::test]
    async fn test_update_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create a session
        let request = CreateTimeSessionRequest {
            task_id,
            start_time: Utc::now(),
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Update the session
        let update_request = UpdateTimeSessionRequest {
            end_time: Some(Utc::now()),
            paused_time: Some(300), // 5 minutes
            is_active: Some(false),
            notes: Some("Completed the task".to_string()),
            breaks: None,
        };

        let updated_session = repo
            .update_session(&created_session.id, update_request)
            .await
            .expect("Failed to update session");

        assert!(!updated_session.is_active);
        assert_eq!(updated_session.paused_time, 300);
        assert_eq!(
            updated_session.notes,
            Some("Completed the task".to_string())
        );
        assert!(updated_session.end_time.is_some());
    }

    #[tokio::test]
    async fn test_stop_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create a session
        let request = CreateTimeSessionRequest {
            task_id,
            start_time: Utc::now(),
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Stop the session
        let stopped_session = repo
            .stop_session(&created_session.id, Some("Task completed".to_string()))
            .await
            .expect("Failed to stop session");

        assert!(!stopped_session.is_active);
        assert!(stopped_session.end_time.is_some());
        assert_eq!(stopped_session.notes, Some("Task completed".to_string()));
    }

    #[tokio::test]
    async fn test_pause_and_resume_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create a session
        let request = CreateTimeSessionRequest {
            task_id,
            start_time: Utc::now(),
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Pause the session
        let paused_session = repo
            .pause_session(&created_session.id)
            .await
            .expect("Failed to pause session");
        assert!(!paused_session.is_active);

        // Resume the session
        let resumed_session = repo
            .resume_session(&created_session.id)
            .await
            .expect("Failed to resume session");
        assert!(resumed_session.is_active);
    }

    #[tokio::test]
    async fn test_find_sessions_for_task() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create multiple sessions for the same task
        for i in 0..3 {
            let request = CreateTimeSessionRequest {
                task_id: task_id.clone(),
                start_time: Utc::now(),
                notes: Some(format!("Session {}", i + 1)),
            };
            repo.create_session(request)
                .await
                .expect("Failed to create session");
        }

        let sessions = repo
            .find_sessions_for_task(&task_id)
            .await
            .expect("Failed to find sessions for task");
        assert_eq!(sessions.len(), 3);
        assert!(sessions.iter().all(|s| s.task_id == task_id));
    }

    #[tokio::test]
    async fn test_get_task_total_time() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create and complete a session with fixed times
        let start_time = chrono::DateTime::parse_from_rfc3339("2024-01-01T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end_time = chrono::DateTime::parse_from_rfc3339("2024-01-01T11:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let request = CreateTimeSessionRequest {
            task_id: task_id.clone(),
            start_time,
            notes: None,
        };

        let session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Update session with end time
        let update_request = UpdateTimeSessionRequest {
            end_time: Some(end_time),
            paused_time: Some(300), // 5 minutes paused
            is_active: Some(false),
            notes: None,
            breaks: None,
        };

        repo.update_session(&session.id, update_request)
            .await
            .expect("Failed to update session");

        let total_time = repo
            .get_task_total_time(&task_id)
            .await
            .expect("Failed to get task total time");

        // Should be exactly 60 minutes - 5 minutes paused = 55 minutes
        assert_eq!(total_time, 55);
    }

    #[tokio::test]
    async fn test_get_recent_sessions() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create multiple sessions
        for i in 0..5 {
            let request = CreateTimeSessionRequest {
                task_id: task_id.clone(),
                start_time: Utc::now() - chrono::Duration::hours(i),
                notes: Some(format!("Session {}", i + 1)),
            };
            repo.create_session(request)
                .await
                .expect("Failed to create session");
        }

        let recent_sessions = repo
            .get_recent_sessions(3)
            .await
            .expect("Failed to get recent sessions");
        assert_eq!(recent_sessions.len(), 3);

        // Should be ordered by start_time descending (most recent first)
        for i in 1..recent_sessions.len() {
            assert!(recent_sessions[i - 1].start_time >= recent_sessions[i].start_time);
        }
    }

    #[tokio::test]
    async fn test_delete_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = TimeTrackingRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create a session
        let request = CreateTimeSessionRequest {
            task_id,
            start_time: Utc::now(),
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create session");

        // Delete the session
        repo.delete_session(&created_session.id)
            .await
            .expect("Failed to delete session");

        // Verify session is deleted
        let found_session = repo
            .find_by_id(&created_session.id)
            .await
            .expect("Failed to query session");
        assert!(found_session.is_none());
    }
}
