#[cfg(test)]
mod tests {
    use super::super::super::tests::setup_test_db;
    use crate::database::repositories::{
        focus_repository::{
            CreateFocusSessionRequest, FocusMetrics, FocusRepository, UpdateFocusSessionRequest,
        },
        task_repository::{CreateTaskRequest, TaskRepository},
    };
    use chrono::Utc;

    async fn create_test_task(repo: &TaskRepository) -> String {
        let request = CreateTaskRequest {
            title: "Test Task for Focus".to_string(),
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
    async fn test_create_focus_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateFocusSessionRequest {
            task_id: task_id.clone(),
            planned_duration: 1800, // 30 minutes
            distraction_level: "low".to_string(),
            background_audio: Some("nature_sounds".to_string()),
            notes: Some("Deep work session".to_string()),
        };

        let result = repo.create_session(request).await;
        assert!(result.is_ok());

        let session = result.unwrap();
        assert_eq!(session.task_id, task_id);
        assert_eq!(session.planned_duration, 1800);
        assert_eq!(session.distraction_level, "low");
        assert_eq!(session.background_audio, Some("nature_sounds".to_string()));
        assert_eq!(session.notes, Some("Deep work session".to_string()));
        assert_eq!(session.distraction_count, 0);
        assert!(session.completed_at.is_none());
    }

    #[tokio::test]
    async fn test_find_focus_session_by_id() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateFocusSessionRequest {
            task_id,
            planned_duration: 2400, // 40 minutes
            distraction_level: "medium".to_string(),
            background_audio: None,
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create focus session");

        let found_session = repo
            .find_by_id(&created_session.id)
            .await
            .expect("Failed to find focus session");

        assert!(found_session.is_some());
        let found_session = found_session.unwrap();
        assert_eq!(found_session.id, created_session.id);
        assert_eq!(found_session.planned_duration, 2400);
        assert_eq!(found_session.distraction_level, "medium");
    }

    #[tokio::test]
    async fn test_update_focus_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateFocusSessionRequest {
            task_id,
            planned_duration: 1800,
            distraction_level: "low".to_string(),
            background_audio: None,
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create focus session");

        let metrics = FocusMetrics {
            deep_work_percentage: 85.5,
            interruption_count: 2,
            flow_state_duration: 1200,
            productivity_rating: Some(4),
            energy_level_start: Some(8),
            energy_level_end: Some(6),
        };

        let update_request = UpdateFocusSessionRequest {
            actual_duration: Some(1650), // 27.5 minutes
            focus_score: Some(8.5),
            distraction_count: Some(2),
            distraction_level: Some("medium".to_string()),
            background_audio: Some("white_noise".to_string()),
            notes: Some("Good focus session with minor interruptions".to_string()),
            breaks: None,
            metrics: Some(metrics),
            completed_at: Some(Utc::now()),
        };

        let updated_session = repo
            .update_session(&created_session.id, update_request)
            .await
            .expect("Failed to update focus session");

        assert_eq!(updated_session.actual_duration, Some(1650));
        assert_eq!(updated_session.focus_score, Some(8.5));
        assert_eq!(updated_session.distraction_count, 2);
        assert_eq!(updated_session.distraction_level, "medium");
        assert_eq!(
            updated_session.background_audio,
            Some("white_noise".to_string())
        );
        assert_eq!(
            updated_session.notes,
            Some("Good focus session with minor interruptions".to_string())
        );
        assert!(updated_session.completed_at.is_some());
        assert!(updated_session.metrics.is_some());
    }

    #[tokio::test]
    async fn test_complete_focus_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateFocusSessionRequest {
            task_id,
            planned_duration: 1800,
            distraction_level: "low".to_string(),
            background_audio: None,
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create focus session");

        let completed_session = repo
            .complete_session(
                &created_session.id,
                1750, // actual duration
                9.2,  // focus score
                1,    // distraction count
                Some("Excellent focus session".to_string()),
            )
            .await
            .expect("Failed to complete focus session");

        assert_eq!(completed_session.actual_duration, Some(1750));
        assert_eq!(completed_session.focus_score, Some(9.2));
        assert_eq!(completed_session.distraction_count, 1);
        assert_eq!(
            completed_session.notes,
            Some("Excellent focus session".to_string())
        );
        assert!(completed_session.completed_at.is_some());
    }

    #[tokio::test]
    async fn test_find_sessions_for_task() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create multiple focus sessions for the same task
        for i in 0..3 {
            let request = CreateFocusSessionRequest {
                task_id: task_id.clone(),
                planned_duration: 1800 + (i * 300), // Different durations
                distraction_level: "low".to_string(),
                background_audio: None,
                notes: Some(format!("Focus session {}", i + 1)),
            };
            repo.create_session(request)
                .await
                .expect("Failed to create focus session");
        }

        let sessions = repo
            .find_sessions_for_task(&task_id)
            .await
            .expect("Failed to find sessions for task");
        assert_eq!(sessions.len(), 3);
        assert!(sessions.iter().all(|s| s.task_id == task_id));
    }

    #[tokio::test]
    async fn test_find_active_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create an active session (not completed)
        let request = CreateFocusSessionRequest {
            task_id,
            planned_duration: 1800,
            distraction_level: "low".to_string(),
            background_audio: None,
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create focus session");

        let active_session = repo
            .find_active_session()
            .await
            .expect("Failed to find active session");

        assert!(active_session.is_some());
        let active_session = active_session.unwrap();
        assert_eq!(active_session.id, created_session.id);
        assert!(active_session.completed_at.is_none());
    }

    #[tokio::test]
    async fn test_find_by_distraction_level() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create sessions with different distraction levels
        let levels = vec!["low", "medium", "high"];
        for level in &levels {
            let request = CreateFocusSessionRequest {
                task_id: task_id.clone(),
                planned_duration: 1800,
                distraction_level: level.to_string(),
                background_audio: None,
                notes: None,
            };
            repo.create_session(request)
                .await
                .expect("Failed to create focus session");
        }

        let low_distraction_sessions = repo
            .find_by_distraction_level("low")
            .await
            .expect("Failed to find sessions by distraction level");
        assert!(!low_distraction_sessions.is_empty());
        assert!(low_distraction_sessions
            .iter()
            .all(|s| s.distraction_level == "low"));
    }

    #[tokio::test]
    async fn test_get_task_average_focus_score() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create sessions with focus scores
        let scores = vec![8.0, 9.0, 7.5];
        for score in &scores {
            let request = CreateFocusSessionRequest {
                task_id: task_id.clone(),
                planned_duration: 1800,
                distraction_level: "low".to_string(),
                background_audio: None,
                notes: None,
            };

            let session = repo
                .create_session(request)
                .await
                .expect("Failed to create focus session");

            // Complete the session with a focus score
            repo.complete_session(&session.id, 1800, *score, 0, None)
                .await
                .expect("Failed to complete session");
        }

        let average_score = repo
            .get_task_average_focus_score(&task_id)
            .await
            .expect("Failed to get average focus score");

        assert!(average_score.is_some());
        let average = average_score.unwrap();
        let expected_average = scores.iter().sum::<f64>() / scores.len() as f64;
        assert!((average - expected_average).abs() < 0.01); // Allow small floating point differences
    }

    #[tokio::test]
    async fn test_get_recent_sessions() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        // Create multiple sessions
        for i in 0..5 {
            let request = CreateFocusSessionRequest {
                task_id: task_id.clone(),
                planned_duration: 1800,
                distraction_level: "low".to_string(),
                background_audio: None,
                notes: Some(format!("Session {}", i + 1)),
            };
            repo.create_session(request)
                .await
                .expect("Failed to create focus session");

            // Small delay to ensure different creation times
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }

        let recent_sessions = repo
            .get_recent_sessions(3)
            .await
            .expect("Failed to get recent sessions");
        assert_eq!(recent_sessions.len(), 3);

        // Should be ordered by created_at descending (most recent first)
        for i in 1..recent_sessions.len() {
            assert!(recent_sessions[i - 1].created_at >= recent_sessions[i].created_at);
        }
    }

    #[tokio::test]
    async fn test_delete_focus_session() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let task_repo = TaskRepository::new(db.clone());
        let repo = FocusRepository::new(db);

        let task_id = create_test_task(&task_repo).await;

        let request = CreateFocusSessionRequest {
            task_id,
            planned_duration: 1800,
            distraction_level: "low".to_string(),
            background_audio: None,
            notes: None,
        };

        let created_session = repo
            .create_session(request)
            .await
            .expect("Failed to create focus session");

        // Delete the session
        repo.delete_session(&created_session.id)
            .await
            .expect("Failed to delete focus session");

        // Verify session is deleted
        let found_session = repo
            .find_by_id(&created_session.id)
            .await
            .expect("Failed to query focus session");
        assert!(found_session.is_none());
    }
}
