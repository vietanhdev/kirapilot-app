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
}
