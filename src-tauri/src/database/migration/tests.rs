#[cfg(test)]
mod tests {
    use crate::database::config::DatabaseConfig;
    use crate::database::migration::{get_migration_status, run_migrations};
    use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

    async fn create_test_db() -> Result<DatabaseConnection, DbErr> {
        let config = DatabaseConfig::new()
            .with_database_url("sqlite::memory:".to_string())
            .with_max_connections(1)
            .with_sqlx_logging(false);

        config.connect().await
    }

    #[tokio::test]
    async fn test_run_migrations() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Test running migrations on fresh database
        let result = run_migrations(&db).await;
        assert!(result.is_ok(), "Failed to run migrations: {:?}", result);

        // Check that all migrations were applied
        let status = get_migration_status(&db)
            .await
            .expect("Failed to get migration status");
        assert!(
            status.is_up_to_date,
            "Database should be up to date after running migrations"
        );
        assert!(status.applied_count > 0, "Should have applied migrations");
        assert_eq!(status.pending_count, 0, "Should have no pending migrations");
    }

    #[tokio::test]
    async fn test_migration_idempotency() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations twice
        run_migrations(&db)
            .await
            .expect("Failed to run migrations first time");
        let result = run_migrations(&db).await;
        assert!(
            result.is_ok(),
            "Running migrations twice should not fail: {:?}",
            result
        );

        // Status should be the same
        let status = get_migration_status(&db)
            .await
            .expect("Failed to get status");
        assert!(status.is_up_to_date, "Database should still be up to date");
        assert_eq!(status.pending_count, 0, "Should have no pending migrations");
    }

    #[tokio::test]
    async fn test_table_creation() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Test that all expected tables exist by trying to query them

        let tables = vec![
            "tasks",
            "task_dependencies",
            "time_sessions",
            "ai_interactions",
            "focus_sessions",
            "productivity_patterns",
            "user_preferences",
            "ai_suggestions",
            "task_lists",
        ];

        for table in tables {
            let stmt = Statement::from_string(
                sea_orm::DatabaseBackend::Sqlite,
                format!(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='{}';",
                    table
                ),
            );

            let result = db.query_one(stmt).await;
            assert!(
                result.is_ok(),
                "Failed to query table {}: {:?}",
                table,
                result
            );
            assert!(result.unwrap().is_some(), "Table {} should exist", table);
        }
    }

    #[tokio::test]
    async fn test_task_lists_table_structure() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Test task_lists table structure
        let stmt = Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "PRAGMA table_info(task_lists);".to_string(),
        );

        let result = db.query_all(stmt).await;
        assert!(result.is_ok(), "Failed to get task_lists table info");

        let columns = result.unwrap();
        assert!(!columns.is_empty(), "task_lists table should have columns");

        // Check for expected columns
        let column_names: Vec<String> = columns
            .iter()
            .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
            .collect();

        assert!(column_names.contains(&"id".to_string()));
        assert!(column_names.contains(&"name".to_string()));
        assert!(column_names.contains(&"is_default".to_string()));
        assert!(column_names.contains(&"created_at".to_string()));
        assert!(column_names.contains(&"updated_at".to_string()));
    }

    #[tokio::test]
    async fn test_tasks_table_has_task_list_id() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Test that tasks table has task_list_id column
        let stmt = Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "PRAGMA table_info(tasks);".to_string(),
        );

        let result = db.query_all(stmt).await;
        assert!(result.is_ok(), "Failed to get tasks table info");

        let columns = result.unwrap();
        let column_names: Vec<String> = columns
            .iter()
            .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
            .collect();

        assert!(
            column_names.contains(&"task_list_id".to_string()),
            "tasks table should have task_list_id column"
        );
    }

    #[tokio::test]
    async fn test_default_task_list_creation() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Check that default task list was created
        let stmt = Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "SELECT * FROM task_lists WHERE is_default = 1;".to_string(),
        );

        let result = db.query_all(stmt).await;
        assert!(result.is_ok(), "Failed to query default task list");

        let default_lists = result.unwrap();
        assert_eq!(
            default_lists.len(),
            1,
            "Should have exactly one default task list"
        );

        let default_list = &default_lists[0];
        let name = default_list
            .try_get::<String>("", "name")
            .unwrap_or_default();
        assert_eq!(
            name, "Default",
            "Default task list should be named 'Default'"
        );
    }

    #[tokio::test]
    async fn test_task_list_indexes() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        // Check for task_lists unique index on is_default
        let stmt = Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='task_lists';"
                .to_string(),
        );

        let result = db.query_all(stmt).await;
        assert!(result.is_ok(), "Failed to query task_lists indexes");

        let indexes = result.unwrap();
        let index_names: Vec<String> = indexes
            .iter()
            .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
            .collect();

        assert!(
            index_names.iter().any(|name| name.contains("default")),
            "Should have index on is_default column"
        );

        // Check for tasks index on task_list_id
        let stmt = Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks';".to_string(),
        );

        let result = db.query_all(stmt).await;
        assert!(result.is_ok(), "Failed to query tasks indexes");

        let indexes = result.unwrap();
        let index_names: Vec<String> = indexes
            .iter()
            .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
            .collect();

        assert!(
            index_names.iter().any(|name| name.contains("task_list_id")),
            "Should have index on task_list_id column"
        );
    }

    #[tokio::test]
    async fn test_multiple_non_default_task_lists_can_be_created() {
        use crate::database::repositories::TaskListRepository;
        use std::sync::Arc;

        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");

        let repo = TaskListRepository::new(Arc::new(db));

        // Should be able to create multiple non-default task lists
        let list1 = repo.create_task_list("Project A".to_string()).await;
        assert!(list1.is_ok(), "Failed to create first task list: {:?}", list1.err());

        let list2 = repo.create_task_list("Project B".to_string()).await;
        assert!(list2.is_ok(), "Failed to create second task list: {:?}", list2.err());

        let list3 = repo.create_task_list("Project C".to_string()).await;
        assert!(list3.is_ok(), "Failed to create third task list: {:?}", list3.err());

        // Verify all lists were created
        let all_lists = repo.find_all_task_lists().await.expect("Failed to get all task lists");
        
        // Should have 4 lists total: 1 default + 3 custom
        assert_eq!(all_lists.len(), 4, "Expected 4 task lists, got {}", all_lists.len());
        
        // Verify only one is default
        let default_count = all_lists.iter().filter(|list| list.is_default).count();
        assert_eq!(default_count, 1, "Expected exactly 1 default task list, got {}", default_count);
        
        // Verify the custom lists are not default
        let custom_lists: Vec<_> = all_lists.iter().filter(|list| !list.is_default).collect();
        assert_eq!(custom_lists.len(), 3, "Expected 3 custom task lists, got {}", custom_lists.len());
    }

    #[tokio::test]
    async fn test_cannot_create_multiple_default_task_lists() {
        let db = create_test_db()
            .await
            .expect("Failed to create test database");

        // Run migrations
        run_migrations(&db).await.expect("Failed to run migrations");
        
        // Try to manually insert another default task list (this should fail due to the partial unique index)
        let insert_result = db.execute_unprepared(
            "INSERT INTO task_lists (id, name, is_default) VALUES ('test-id', 'Another Default', true)"
        ).await;
        
        assert!(insert_result.is_err(), "Should not be able to create multiple default task lists");
    }
}
