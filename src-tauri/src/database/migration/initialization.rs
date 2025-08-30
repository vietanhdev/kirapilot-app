use sea_orm::{DatabaseConnection, DbErr};
use crate::database::repositories::{TaskRepository, TaskListRepository};

/// Post-migration initialization logic
/// This ensures data consistency after migrations are applied
pub async fn run_post_migration_initialization(db: &DatabaseConnection) -> Result<(), DbErr> {
    println!("Running post-migration initialization...");

    // Ensure default task list exists
    let task_list_repo = TaskListRepository::new(db.clone().into());
    let _default_task_list = task_list_repo.ensure_default_task_list().await?;
    println!("Default task list verified");

    // Migrate any orphaned tasks to the default task list
    let task_repo = TaskRepository::new(db.clone().into());
    let migrated_count = task_repo.migrate_orphaned_tasks_to_default().await?;
    
    if migrated_count > 0 {
        println!("Migrated {} orphaned tasks to default task list", migrated_count);
    } else {
        println!("No orphaned tasks found");
    }

    println!("Post-migration initialization completed successfully");
    Ok(())
}

/// Initialize data for a fresh database
/// This is called when the database is created for the first time
#[allow(dead_code)]
pub async fn initialize_fresh_database(db: &DatabaseConnection) -> Result<(), DbErr> {
    println!("Initializing fresh database...");

    // Ensure default task list exists
    let task_list_repo = TaskListRepository::new(db.clone().into());
    let _default_task_list = task_list_repo.ensure_default_task_list().await?;
    println!("Default task list created");

    println!("Fresh database initialization completed successfully");
    Ok(())
}

/// Validate database integrity after migrations
pub async fn validate_database_integrity(db: &DatabaseConnection) -> Result<DatabaseIntegrityReport, DbErr> {
    println!("Validating database integrity...");

    let task_list_repo = TaskListRepository::new(db.clone().into());
    let task_repo = TaskRepository::new(db.clone().into());

    // Check that default task list exists
    let default_task_list = task_list_repo.get_default_task_list().await?;
    
    // Count orphaned tasks
    let orphaned_tasks_count = task_repo.count_orphaned_tasks().await?;
    
    // Count total tasks
    let total_tasks = task_repo.count_all_tasks().await?;
    
    // Count total task lists
    let total_task_lists = task_list_repo.count_all_task_lists().await?;

    let report = DatabaseIntegrityReport {
        has_default_task_list: true,
        default_task_list_id: default_task_list.id,
        orphaned_tasks_count,
        total_tasks,
        total_task_lists,
        is_healthy: orphaned_tasks_count == 0,
    };

    if report.is_healthy {
        println!("Database integrity validation passed");
    } else {
        println!("Database integrity issues found: {} orphaned tasks", orphaned_tasks_count);
    }

    Ok(report)
}

#[derive(Debug, serde::Serialize)]
pub struct DatabaseIntegrityReport {
    pub has_default_task_list: bool,
    pub default_task_list_id: String,
    pub orphaned_tasks_count: u64,
    pub total_tasks: u64,
    pub total_task_lists: u64,
    pub is_healthy: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::config::DatabaseConfig;
    use crate::database::migration::run_migrations;
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

    #[tokio::test]
    async fn test_post_migration_initialization() {
        let db = create_test_db().await.expect("Failed to create test database");
        
        // Run migrations first
        run_migrations(&db).await.expect("Failed to run migrations");
        
        // Run post-migration initialization
        let result = run_post_migration_initialization(&db).await;
        assert!(result.is_ok(), "Post-migration initialization should succeed");
        
        // Verify default task list exists
        let task_list_repo = TaskListRepository::new(db.clone().into());
        let default_task_list = task_list_repo.get_default_task_list().await;
        assert!(default_task_list.is_ok(), "Default task list should exist");
    }

    #[tokio::test]
    async fn test_orphaned_task_migration() {
        let db = create_test_db().await.expect("Failed to create test database");
        
        // Run migrations first
        run_migrations(&db).await.expect("Failed to run migrations");
        
        // Create some tasks without task_list_id (simulate orphaned tasks)
        let task_repo = TaskRepository::new(db.clone().into());
        
        // Create a task and then manually set task_list_id to null to simulate orphaned state
        let task1 = task_repo.create_task(CreateTaskRequest {
            title: "Orphaned Task 1".to_string(),
            description: Some("Test orphaned task".to_string()),
            priority: 1,
            status: Some("todo".to_string()),
            order_num: None,
            dependencies: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // This will be set to default during creation
            time_estimate: Some(0),
        }).await.expect("Failed to create task");

        // Manually set task_list_id to null to simulate orphaned state
        use sea_orm::{Set, ActiveModelTrait};
        use crate::database::entities::tasks;
        
        let mut active_task: tasks::ActiveModel = task1.into();
        active_task.task_list_id = Set(None);
        active_task.update(&db).await.expect("Failed to update task to orphaned state");
        
        // Run post-migration initialization
        let result = run_post_migration_initialization(&db).await;
        assert!(result.is_ok(), "Post-migration initialization should succeed");
        
        // Verify no orphaned tasks remain
        let orphaned_count = task_repo.count_orphaned_tasks().await.expect("Failed to count orphaned tasks");
        assert_eq!(orphaned_count, 0, "Should have no orphaned tasks after migration");
    }

    #[tokio::test]
    async fn test_database_integrity_validation() {
        let db = create_test_db().await.expect("Failed to create test database");
        
        // Run migrations first
        run_migrations(&db).await.expect("Failed to run migrations");
        
        // Run post-migration initialization
        run_post_migration_initialization(&db).await.expect("Failed to run post-migration initialization");
        
        // Validate database integrity
        let report = validate_database_integrity(&db).await.expect("Failed to validate database integrity");
        
        assert!(report.has_default_task_list, "Should have default task list");
        assert!(report.is_healthy, "Database should be healthy");
        assert_eq!(report.orphaned_tasks_count, 0, "Should have no orphaned tasks");
    }

    #[tokio::test]
    async fn test_fresh_database_initialization() {
        let db = create_test_db().await.expect("Failed to create test database");
        
        // Run migrations first
        run_migrations(&db).await.expect("Failed to run migrations");
        
        // Run fresh database initialization
        let result = initialize_fresh_database(&db).await;
        assert!(result.is_ok(), "Fresh database initialization should succeed");
        
        // Verify default task list exists
        let task_list_repo = TaskListRepository::new(db.clone().into());
        let default_task_list = task_list_repo.get_default_task_list().await;
        assert!(default_task_list.is_ok(), "Default task list should exist after fresh initialization");
    }
}