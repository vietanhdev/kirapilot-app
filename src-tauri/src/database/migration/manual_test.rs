#[cfg(test)]
mod manual_test {
    use crate::database::config::DatabaseConfig;
    use crate::database::migration::{run_migrations};
    use crate::database::migration::initialization::{run_post_migration_initialization, validate_database_integrity};
    use crate::database::repositories::{TaskRepository, TaskListRepository};
    use crate::database::repositories::task_repository::CreateTaskRequest;
    use sea_orm::{DatabaseConnection, DbErr};

    async fn create_test_db() -> Result<DatabaseConnection, DbErr> {
        let config = DatabaseConfig::new()
            .with_database_url("sqlite::memory:".to_string())
            .with_max_connections(1)
            .with_sqlx_logging(false);

        config.connect().await
    }

    /// This test simulates the complete migration workflow that would happen
    /// when a user upgrades from a version without task lists to one with task lists
    #[tokio::test]
    async fn test_complete_upgrade_scenario() {
        let db = create_test_db().await.expect("Failed to create test database");

        // Step 1: Run migrations (this creates the task_lists table and adds task_list_id column)
        println!("Step 1: Running migrations...");
        run_migrations(&db).await.expect("Failed to run migrations");

        // Step 2: Create some tasks (simulating existing data before task lists)
        println!("Step 2: Creating existing tasks...");
        let task_repo = TaskRepository::new(db.clone().into());
        
        let task1 = task_repo.create_task(CreateTaskRequest {
            title: "Existing Task 1".to_string(),
            description: Some("This task existed before task lists".to_string()),
            priority: 1,
            status: Some("todo".to_string()),
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // This will be assigned to default
            time_estimate: Some(60),
        }).await.expect("Failed to create task 1");

        let task2 = task_repo.create_task(CreateTaskRequest {
            title: "Existing Task 2".to_string(),
            description: Some("Another existing task".to_string()),
            priority: 2,
            status: Some("in_progress".to_string()),
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // This will be assigned to default
            time_estimate: Some(120),
        }).await.expect("Failed to create task 2");

        println!("Created tasks: {} and {}", task1.id, task2.id);

        // Step 3: Manually set some tasks to orphaned state (simulating pre-migration data)
        use sea_orm::{Set, ActiveModelTrait};
        use crate::database::entities::tasks;
        
        let mut active_task: tasks::ActiveModel = task1.into();
        active_task.task_list_id = Set(None);
        let orphaned_task = active_task.update(&db).await.expect("Failed to create orphaned task");
        println!("Made task {} orphaned", orphaned_task.id);

        // Step 4: Verify orphaned tasks exist
        let orphaned_count = task_repo.count_orphaned_tasks().await.expect("Failed to count orphaned tasks");
        println!("Found {} orphaned tasks", orphaned_count);
        assert_eq!(orphaned_count, 1, "Should have 1 orphaned task");

        // Step 5: Run post-migration initialization
        println!("Step 3: Running post-migration initialization...");
        run_post_migration_initialization(&db).await.expect("Failed to run post-migration initialization");

        // Step 6: Validate database integrity
        println!("Step 4: Validating database integrity...");
        let integrity_report = validate_database_integrity(&db).await.expect("Failed to validate integrity");
        
        println!("Integrity Report:");
        println!("  - Has default task list: {}", integrity_report.has_default_task_list);
        println!("  - Default task list ID: {}", integrity_report.default_task_list_id);
        println!("  - Orphaned tasks: {}", integrity_report.orphaned_tasks_count);
        println!("  - Total tasks: {}", integrity_report.total_tasks);
        println!("  - Total task lists: {}", integrity_report.total_task_lists);
        println!("  - Is healthy: {}", integrity_report.is_healthy);

        // Assertions
        assert!(integrity_report.has_default_task_list, "Should have default task list");
        assert_eq!(integrity_report.orphaned_tasks_count, 0, "Should have no orphaned tasks after migration");
        assert_eq!(integrity_report.total_tasks, 2, "Should have 2 tasks total");
        assert_eq!(integrity_report.total_task_lists, 1, "Should have 1 task list (default)");
        assert!(integrity_report.is_healthy, "Database should be healthy");

        // Step 7: Verify tasks are properly assigned to default task list
        let task_list_repo = TaskListRepository::new(db.clone().into());
        let default_task_list = task_list_repo.get_default_task_list().await.expect("Failed to get default task list");
        let tasks_in_default = task_repo.find_by_task_list(&default_task_list.id).await.expect("Failed to find tasks in default list");
        
        println!("Tasks in default list: {}", tasks_in_default.len());
        assert_eq!(tasks_in_default.len(), 2, "Both tasks should be in default list");

        println!("✅ Complete upgrade scenario test passed!");
    }
}