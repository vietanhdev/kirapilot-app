#[cfg(test)]
mod integration_tests {
    use crate::database::config::DatabaseConfig;
    use crate::database::migration::{run_migrations, get_migration_status};
    use crate::database::migration::initialization::{
        run_post_migration_initialization, validate_database_integrity, initialize_fresh_database
    };
    use crate::database::repositories::{TaskRepository, TaskListRepository};
    use crate::database::repositories::task_repository::CreateTaskRequest;

    use sea_orm::{DatabaseConnection, DbErr, EntityTrait, Set, ActiveModelTrait};

    async fn create_test_db() -> Result<DatabaseConnection, DbErr> {
        let config = DatabaseConfig::new()
            .with_database_url("sqlite::memory:".to_string())
            .with_max_connections(1)
            .with_sqlx_logging(false);

        config.connect().await
    }

    #[tokio::test]
    async fn test_complete_migration_workflow() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Step 1: Run migrations
        let migration_result = run_migrations(&db).await;
        assert!(migration_result.is_ok(), "Migrations should succeed");

        // Step 2: Check migration status
        let status = get_migration_status(&db).await.expect("Failed to get migration status");
        assert!(status.is_up_to_date, "Database should be up to date");
        assert_eq!(status.pending_count, 0, "Should have no pending migrations");

        // Step 3: Run post-migration initialization
        let init_result = run_post_migration_initialization(&db).await;
        assert!(init_result.is_ok(), "Post-migration initialization should succeed");

        // Step 4: Validate database integrity
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.is_healthy, "Database should be healthy");
        assert!(integrity_report.has_default_task_list, "Should have default task list");
        assert_eq!(integrity_report.orphaned_tasks_count, 0, "Should have no orphaned tasks");
    }

    #[tokio::test]
    async fn test_migration_with_existing_data() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations first
        run_migrations(&db).await.expect("Failed to run migrations");

        // Create some test data
        let task_list_repo = TaskListRepository::new(db.clone().into());
        let task_repo = TaskRepository::new(db.clone().into());

        // Create a custom task list
        let custom_list = task_list_repo.create_task_list("Custom Project".to_string()).await.expect("Failed to create custom task list");

        // Create tasks in different lists
        let task1 = task_repo.create_task(CreateTaskRequest {
            title: "Task in custom list".to_string(),
            description: Some("Test task".to_string()),
            priority: 1,
            status: Some("todo".to_string()),
            order_num: None,
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(custom_list.id.clone()),
            time_estimate: Some(0),
        }).await.expect("Failed to create task");

        let _task2 = task_repo.create_task(CreateTaskRequest {
            title: "Task in default list".to_string(),
            description: Some("Test task".to_string()),
            priority: 1,
            status: Some("todo".to_string()),
            order_num: None,
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // Will be assigned to default
            time_estimate: Some(0),
        }).await.expect("Failed to create task");

        // Manually create an orphaned task by setting task_list_id to null
        use crate::database::entities::tasks;
        let mut active_task: tasks::ActiveModel = task1.into();
        active_task.task_list_id = Set(None);
        active_task.update(&db).await.expect("Failed to create orphaned task");

        // Run post-migration initialization
        let init_result = run_post_migration_initialization(&db).await;
        assert!(init_result.is_ok(), "Post-migration initialization should succeed");

        // Validate that orphaned task was migrated
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.is_healthy, "Database should be healthy after migration");
        assert_eq!(integrity_report.orphaned_tasks_count, 0, "Should have no orphaned tasks");
        assert_eq!(integrity_report.total_tasks, 2, "Should have 2 tasks total");
        assert_eq!(integrity_report.total_task_lists, 2, "Should have 2 task lists (default + custom)");
    }

    #[tokio::test]
    async fn test_fresh_database_initialization() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Run fresh database initialization
        let init_result = initialize_fresh_database(&db).await;
        assert!(init_result.is_ok(), "Fresh database initialization should succeed");

        // Validate the fresh database
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.is_healthy, "Fresh database should be healthy");
        assert!(integrity_report.has_default_task_list, "Should have default task list");
        assert_eq!(integrity_report.total_tasks, 0, "Fresh database should have no tasks");
        assert_eq!(integrity_report.total_task_lists, 1, "Fresh database should have only default task list");
    }

    #[tokio::test]
    async fn test_multiple_orphaned_tasks_migration() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        let task_repo = TaskRepository::new(db.clone().into());

        // Create multiple tasks
        let tasks = vec![
            task_repo.create_task(CreateTaskRequest {
                title: "Task 1".to_string(),
                description: Some("Test task 1".to_string()),
                priority: 1,
                status: Some("todo".to_string()),
            order_num: None,
                dependencies: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
                time_estimate: Some(0),
            }).await.expect("Failed to create task 1"),
            task_repo.create_task(CreateTaskRequest {
                title: "Task 2".to_string(),
                description: Some("Test task 2".to_string()),
                priority: 2,
                status: Some("in_progress".to_string()),
            order_num: None,
                dependencies: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
                time_estimate: Some(0),
            }).await.expect("Failed to create task 2"),
            task_repo.create_task(CreateTaskRequest {
                title: "Task 3".to_string(),
                description: Some("Test task 3".to_string()),
                priority: 3,
                status: Some("completed".to_string()),
            order_num: None,
                dependencies: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
                time_estimate: Some(0),
            }).await.expect("Failed to create task 3"),
        ];

        // Manually set all tasks to orphaned state
        use crate::database::entities::tasks;
        for task in tasks {
            let mut active_task: tasks::ActiveModel = task.into();
            active_task.task_list_id = Set(None);
            active_task.update(&db).await.expect("Failed to create orphaned task");
        }

        // Verify orphaned tasks exist
        let orphaned_count_before = task_repo.count_orphaned_tasks().await.expect("Failed to count orphaned tasks");
        assert_eq!(orphaned_count_before, 3, "Should have 3 orphaned tasks");

        // Run post-migration initialization
        let init_result = run_post_migration_initialization(&db).await;
        assert!(init_result.is_ok(), "Post-migration initialization should succeed");

        // Verify all orphaned tasks were migrated
        let orphaned_count_after = task_repo.count_orphaned_tasks().await.expect("Failed to count orphaned tasks");
        assert_eq!(orphaned_count_after, 0, "Should have no orphaned tasks after migration");

        // Validate database integrity
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.is_healthy, "Database should be healthy");
        assert_eq!(integrity_report.total_tasks, 3, "Should have 3 tasks total");
    }

    #[tokio::test]
    async fn test_migration_idempotency() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Run post-migration initialization multiple times
        for i in 1..=3 {
            let init_result = run_post_migration_initialization(&db).await;
            assert!(init_result.is_ok(), "Post-migration initialization attempt {} should succeed", i);

            // Validate database integrity after each run
            let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
            assert!(integrity_report.is_healthy, "Database should be healthy after attempt {}", i);
            assert_eq!(integrity_report.total_task_lists, 1, "Should still have only 1 task list after attempt {}", i);
        }
    }

    #[tokio::test]
    async fn test_migration_with_task_dependencies() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        let task_repo = TaskRepository::new(db.clone().into());

        // Create tasks with dependencies
        let task1 = task_repo.create_task(CreateTaskRequest {
            title: "Parent Task".to_string(),
            description: Some("Parent task".to_string()),
            priority: 1,
            status: Some("todo".to_string()),
            order_num: None,
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
            time_estimate: Some(0),
        }).await.expect("Failed to create parent task");

        let task2 = task_repo.create_task(CreateTaskRequest {
            title: "Child Task".to_string(),
            description: Some("Child task".to_string()),
            priority: 2,
            status: Some("todo".to_string()),
            order_num: None,
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: Some(task1.id.clone()),
            task_list_id: None,
            time_estimate: Some(0),
        }).await.expect("Failed to create child task");

        // Add dependency
        task_repo.add_dependency(&task2.id, &task1.id).await.expect("Failed to add dependency");

        // Make tasks orphaned
        use crate::database::entities::tasks;
        for task in [task1, task2] {
            let mut active_task: tasks::ActiveModel = task.into();
            active_task.task_list_id = Set(None);
            active_task.update(&db).await.expect("Failed to create orphaned task");
        }

        // Run post-migration initialization
        let init_result = run_post_migration_initialization(&db).await;
        assert!(init_result.is_ok(), "Post-migration initialization should succeed");

        // Validate that tasks and dependencies are preserved
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.is_healthy, "Database should be healthy");
        assert_eq!(integrity_report.total_tasks, 2, "Should have 2 tasks");
        assert_eq!(integrity_report.orphaned_tasks_count, 0, "Should have no orphaned tasks");

        // Verify dependencies still exist
        let task_list_repo = TaskListRepository::new(db.clone().into());
        let default_list = task_list_repo.get_default_task_list().await.expect("Failed to get default task list");
        let tasks_in_default = task_repo.find_by_task_list(&default_list.id).await.expect("Failed to find tasks");
        assert_eq!(tasks_in_default.len(), 2, "Both tasks should be in default list");
    }

    #[tokio::test]
    async fn test_error_handling_during_migration() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Manually delete the default task list to simulate an error condition
        use crate::database::entities::task_lists;
        task_lists::Entity::delete_many().exec(&db).await.expect("Failed to delete task lists");

        // Try to run post-migration initialization - it should recreate the default task list
        let init_result = run_post_migration_initialization(&db).await;
        assert!(init_result.is_ok(), "Post-migration initialization should handle missing default task list");

        // Validate that default task list was recreated
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        assert!(integrity_report.has_default_task_list, "Default task list should be recreated");
        assert!(integrity_report.is_healthy, "Database should be healthy after recovery");
    }
}