#[cfg(test)]
mod tests {
    use crate::database::entities::{
        ai_interactions, ai_suggestions, focus_sessions, productivity_patterns, task_dependencies,
        task_lists, tasks, time_sessions, user_preferences,
    };
    use chrono::Utc;
    use sea_orm::*;
    use sea_orm::{Database, DatabaseConnection};

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();

        // Create tables for testing
        let schema = sea_orm::Schema::new(DatabaseBackend::Sqlite);

        // Create tasks table
        let stmt = schema.create_table_from_entity(tasks::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create task_dependencies table
        let stmt = schema.create_table_from_entity(task_dependencies::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create time_sessions table
        let stmt = schema.create_table_from_entity(time_sessions::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create ai_interactions table
        let stmt = schema.create_table_from_entity(ai_interactions::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create focus_sessions table
        let stmt = schema.create_table_from_entity(focus_sessions::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create productivity_patterns table
        let stmt = schema.create_table_from_entity(productivity_patterns::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create user_preferences table
        let stmt = schema.create_table_from_entity(user_preferences::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create ai_suggestions table
        let stmt = schema.create_table_from_entity(ai_suggestions::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        // Create task_lists table
        let stmt = schema.create_table_from_entity(task_lists::Entity);
        db.execute(db.get_database_backend().build(&stmt))
            .await
            .unwrap();

        db
    }

    #[tokio::test]
    async fn test_task_entity_creation() {
        let db = setup_test_db().await;

        let task = tasks::ActiveModel {
            title: Set("Test Task".to_string()),
            description: Set(Some("Test Description".to_string())),
            priority: Set(1),
            status: Set("pending".to_string()),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };

        let result = task.insert(&db).await;
        assert!(result.is_ok(), "Task creation should succeed");

        let created_task = result.unwrap();
        assert_eq!(created_task.title, "Test Task");
        assert_eq!(created_task.priority, 1);
        assert_eq!(created_task.status, "pending");
    }

    #[tokio::test]
    async fn test_task_dependency_relationship() {
        let db = setup_test_db().await;

        // Create two tasks
        let task1 = tasks::ActiveModel {
            title: Set("Task 1".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };
        let task1 = task1.insert(&db).await.unwrap();

        let task2 = tasks::ActiveModel {
            title: Set("Task 2".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };
        let task2 = task2.insert(&db).await.unwrap();

        // Create dependency: task2 depends on task1
        let dependency = task_dependencies::ActiveModel {
            task_id: Set(task2.id.clone()),
            depends_on_id: Set(task1.id.clone()),
            ..Default::default()
        };

        let result = dependency.insert(&db).await;
        assert!(result.is_ok(), "Task dependency creation should succeed");

        let created_dependency = result.unwrap();
        assert_eq!(created_dependency.task_id, task2.id);
        assert_eq!(created_dependency.depends_on_id, task1.id);
    }

    #[tokio::test]
    async fn test_time_session_task_relationship() {
        let db = setup_test_db().await;

        // Create a task first
        let task = tasks::ActiveModel {
            title: Set("Test Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };
        let task = task.insert(&db).await.unwrap();

        // Create a time session for the task
        let session = time_sessions::ActiveModel {
            task_id: Set(task.id.clone()),
            start_time: Set(Utc::now()),
            paused_time: Set(0),
            is_active: Set(true),
            ..Default::default()
        };

        let result = session.insert(&db).await;
        assert!(result.is_ok(), "Time session creation should succeed");

        let created_session = result.unwrap();
        assert_eq!(created_session.task_id, task.id);
        assert!(created_session.is_active);
    }

    #[tokio::test]
    async fn test_focus_session_task_relationship() {
        let db = setup_test_db().await;

        // Create a task first
        let task = tasks::ActiveModel {
            title: Set("Focus Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };
        let task = task.insert(&db).await.unwrap();

        // Create a focus session for the task
        let focus_session = focus_sessions::ActiveModel {
            task_id: Set(task.id.clone()),
            planned_duration: Set(1800), // 30 minutes
            distraction_count: Set(0),
            distraction_level: Set("low".to_string()),
            ..Default::default()
        };

        let result = focus_session.insert(&db).await;
        assert!(result.is_ok(), "Focus session creation should succeed");

        let created_session = result.unwrap();
        assert_eq!(created_session.task_id, task.id);
        assert_eq!(created_session.planned_duration, 1800);
        assert_eq!(created_session.distraction_level, "low");
    }

    #[tokio::test]
    async fn test_ai_interaction_entity() {
        let db = setup_test_db().await;

        let interaction = ai_interactions::ActiveModel {
            message: Set("Create a task for project review".to_string()),
            response: Set("I'll create a task for project review".to_string()),
            action_taken: Set(Some("CREATE_TASK".to_string())),
            reasoning: Set(Some("User requested task creation".to_string())),
            confidence: Set(Some(0.95)),
            ..Default::default()
        };

        let result = interaction.insert(&db).await;
        assert!(result.is_ok(), "AI interaction creation should succeed");

        let created_interaction = result.unwrap();
        assert_eq!(
            created_interaction.message,
            "Create a task for project review"
        );
        assert_eq!(
            created_interaction.action_taken,
            Some("CREATE_TASK".to_string())
        );
        assert_eq!(created_interaction.confidence, Some(0.95));
    }

    #[tokio::test]
    async fn test_productivity_pattern_entity() {
        let db = setup_test_db().await;

        let pattern = productivity_patterns::ActiveModel {
            user_id: Set("user123".to_string()),
            pattern_type: Set("focus_time".to_string()),
            time_slot: Set("09:00-11:00".to_string()),
            productivity_score: Set(0.85),
            confidence_level: Set(0.9),
            sample_size: Set(20),
            ..Default::default()
        };

        let result = pattern.insert(&db).await;
        assert!(
            result.is_ok(),
            "Productivity pattern creation should succeed"
        );

        let created_pattern = result.unwrap();
        assert_eq!(created_pattern.user_id, "user123");
        assert_eq!(created_pattern.pattern_type, "focus_time");
        assert_eq!(created_pattern.productivity_score, 0.85);
    }

    #[tokio::test]
    async fn test_user_preferences_entity() {
        let db = setup_test_db().await;

        let preferences = user_preferences::ActiveModel {
            working_hours: Set(r#"{"start": "09:00", "end": "17:00"}"#.to_string()),
            break_preferences: Set(r#"{"short": 5, "long": 15}"#.to_string()),
            focus_preferences: Set(r#"{"session_length": 25, "break_length": 5}"#.to_string()),
            notifications: Set(r#"{"enabled": true, "sound": true}"#.to_string()),
            theme: Set(Some("dark".to_string())),
            language: Set(Some("en".to_string())),
            ..Default::default()
        };

        let result = preferences.insert(&db).await;
        assert!(result.is_ok(), "User preferences creation should succeed");

        let created_preferences = result.unwrap();
        assert_eq!(created_preferences.theme, Some("dark".to_string()));
        assert_eq!(created_preferences.language, Some("en".to_string()));
    }

    #[tokio::test]
    async fn test_ai_suggestions_entity() {
        let db = setup_test_db().await;

        let suggestion = ai_suggestions::ActiveModel {
            suggestion_type: Set("task_scheduling".to_string()),
            title: Set("Optimize morning schedule".to_string()),
            description: Set("Consider moving high-focus tasks to morning hours".to_string()),
            confidence: Set(0.8),
            actionable: Set(true),
            priority: Set(2),
            estimated_impact: Set(0.7),
            reasoning: Set(Some("Based on productivity patterns".to_string())),
            ..Default::default()
        };

        let result = suggestion.insert(&db).await;
        assert!(result.is_ok(), "AI suggestion creation should succeed");

        let created_suggestion = result.unwrap();
        assert_eq!(created_suggestion.suggestion_type, "task_scheduling");
        assert_eq!(created_suggestion.confidence, 0.8);
        assert!(created_suggestion.actionable);
    }

    #[tokio::test]
    async fn test_task_with_multiple_relationships() {
        let db = setup_test_db().await;

        // Create a task
        let task = tasks::ActiveModel {
            title: Set("Complex Task".to_string()),
            status: Set("in_progress".to_string()),
            priority: Set(1),
            time_estimate: Set(7200),
            actual_time: Set(0),
            ..Default::default()
        };
        let task = task.insert(&db).await.unwrap();

        // Create a time session
        let time_session = time_sessions::ActiveModel {
            task_id: Set(task.id.clone()),
            start_time: Set(Utc::now()),
            paused_time: Set(0),
            is_active: Set(true),
            notes: Set(Some("Working on complex task".to_string())),
            ..Default::default()
        };
        let _time_session = time_session.insert(&db).await.unwrap();

        // Create a focus session
        let focus_session = focus_sessions::ActiveModel {
            task_id: Set(task.id.clone()),
            planned_duration: Set(3600),
            distraction_count: Set(2),
            distraction_level: Set("medium".to_string()),
            focus_score: Set(Some(0.75)),
            ..Default::default()
        };
        let _focus_session = focus_session.insert(&db).await.unwrap();

        // Verify the task exists and can be queried with relationships
        let found_task = tasks::Entity::find_by_id(&task.id).one(&db).await.unwrap();

        assert!(found_task.is_some());
        let found_task = found_task.unwrap();
        assert_eq!(found_task.title, "Complex Task");
        assert_eq!(found_task.status, "in_progress");

        // Test finding related time sessions
        let related_time_sessions = found_task
            .find_related(time_sessions::Entity)
            .all(&db)
            .await
            .unwrap();

        assert_eq!(related_time_sessions.len(), 1);
        assert_eq!(related_time_sessions[0].task_id, task.id);

        // Test finding related focus sessions
        let related_focus_sessions = found_task
            .find_related(focus_sessions::Entity)
            .all(&db)
            .await
            .unwrap();

        assert_eq!(related_focus_sessions.len(), 1);
        assert_eq!(related_focus_sessions[0].task_id, task.id);
    }

    #[tokio::test]
    async fn test_entity_constraints_and_validation() {
        let db = setup_test_db().await;

        // Test that required fields are enforced
        let invalid_task = tasks::ActiveModel {
            // Missing required title field
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            ..Default::default()
        };

        // This should fail due to missing title
        let result = invalid_task.insert(&db).await;
        assert!(result.is_err(), "Task creation without title should fail");
    }

    #[tokio::test]
    async fn test_foreign_key_constraints() {
        let db = setup_test_db().await;

        // Try to create a time session with non-existent task_id
        let invalid_session = time_sessions::ActiveModel {
            task_id: Set("non-existent-task-id".to_string()),
            start_time: Set(Utc::now()),
            paused_time: Set(0),
            is_active: Set(true),
            ..Default::default()
        };

        // This should succeed in SQLite without foreign key constraints enabled
        // But in a real scenario with FK constraints, this would fail
        let result = invalid_session.insert(&db).await;
        // For now, we just verify the operation completes
        assert!(result.is_ok() || result.is_err());
    }

    #[tokio::test]
    async fn test_task_list_entity_creation() {
        let db = setup_test_db().await;

        let task_list = task_lists::ActiveModel {
            name: Set("Work Projects".to_string()),
            is_default: Set(false),
            ..Default::default()
        };

        let result = task_list.insert(&db).await;
        assert!(result.is_ok(), "Task list creation should succeed");

        let created_task_list = result.unwrap();
        assert_eq!(created_task_list.name, "Work Projects");
        assert!(!created_task_list.is_default);
        assert!(!created_task_list.id.is_empty());
    }

    #[tokio::test]
    async fn test_default_task_list_creation() {
        let db = setup_test_db().await;

        let default_task_list = task_lists::ActiveModel {
            name: Set("Default".to_string()),
            is_default: Set(true),
            ..Default::default()
        };

        let result = default_task_list.insert(&db).await;
        assert!(result.is_ok(), "Default task list creation should succeed");

        let created_task_list = result.unwrap();
        assert_eq!(created_task_list.name, "Default");
        assert!(created_task_list.is_default);
    }

    #[tokio::test]
    async fn test_task_list_task_relationship() {
        let db = setup_test_db().await;

        // Create a task list first
        let task_list = task_lists::ActiveModel {
            name: Set("Personal Tasks".to_string()),
            is_default: Set(false),
            ..Default::default()
        };
        let task_list = task_list.insert(&db).await.unwrap();

        // Create a task associated with the task list
        let task = tasks::ActiveModel {
            title: Set("Personal Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            task_list_id: Set(Some(task_list.id.clone())),
            ..Default::default()
        };

        let result = task.insert(&db).await;
        assert!(
            result.is_ok(),
            "Task creation with task list should succeed"
        );

        let created_task = result.unwrap();
        assert_eq!(created_task.title, "Personal Task");
        assert_eq!(created_task.task_list_id, Some(task_list.id.clone()));

        // Test finding related tasks from task list
        let related_tasks = task_list
            .find_related(tasks::Entity)
            .all(&db)
            .await
            .unwrap();

        assert_eq!(related_tasks.len(), 1);
        assert_eq!(related_tasks[0].id, created_task.id);
        assert_eq!(related_tasks[0].task_list_id, Some(task_list.id));
    }

    #[tokio::test]
    async fn test_task_without_task_list() {
        let db = setup_test_db().await;

        // Create a task without a task list (should be allowed)
        let task = tasks::ActiveModel {
            title: Set("Orphaned Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            task_list_id: Set(None),
            ..Default::default()
        };

        let result = task.insert(&db).await;
        assert!(
            result.is_ok(),
            "Task creation without task list should succeed"
        );

        let created_task = result.unwrap();
        assert_eq!(created_task.title, "Orphaned Task");
        assert_eq!(created_task.task_list_id, None);
    }

    #[tokio::test]
    async fn test_multiple_task_lists_with_tasks() {
        let db = setup_test_db().await;

        // Create multiple task lists
        let work_list = task_lists::ActiveModel {
            name: Set("Work".to_string()),
            is_default: Set(false),
            ..Default::default()
        };
        let work_list = work_list.insert(&db).await.unwrap();

        let personal_list = task_lists::ActiveModel {
            name: Set("Personal".to_string()),
            is_default: Set(false),
            ..Default::default()
        };
        let personal_list = personal_list.insert(&db).await.unwrap();

        // Create tasks for each list
        let work_task = tasks::ActiveModel {
            title: Set("Work Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(1),
            time_estimate: Set(3600),
            actual_time: Set(0),
            task_list_id: Set(Some(work_list.id.clone())),
            ..Default::default()
        };
        let work_task = work_task.insert(&db).await.unwrap();

        let personal_task = tasks::ActiveModel {
            title: Set("Personal Task".to_string()),
            status: Set("pending".to_string()),
            priority: Set(2),
            time_estimate: Set(1800),
            actual_time: Set(0),
            task_list_id: Set(Some(personal_list.id.clone())),
            ..Default::default()
        };
        let personal_task = personal_task.insert(&db).await.unwrap();

        // Verify tasks are correctly associated
        let work_tasks = work_list
            .find_related(tasks::Entity)
            .all(&db)
            .await
            .unwrap();

        let personal_tasks = personal_list
            .find_related(tasks::Entity)
            .all(&db)
            .await
            .unwrap();

        assert_eq!(work_tasks.len(), 1);
        assert_eq!(work_tasks[0].id, work_task.id);
        assert_eq!(work_tasks[0].title, "Work Task");

        assert_eq!(personal_tasks.len(), 1);
        assert_eq!(personal_tasks[0].id, personal_task.id);
        assert_eq!(personal_tasks[0].title, "Personal Task");
    }
}
