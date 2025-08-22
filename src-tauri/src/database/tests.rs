#[cfg(test)]
mod tests {
    use crate::database::{check_database_health, get_database, initialize_database, migration};
    use tokio;

    #[tokio::test]
    async fn test_database_initialization() {
        // Test that we can initialize the database
        let result = initialize_database().await;
        assert!(result.is_ok(), "Database initialization should succeed");

        // Test that we can get the database connection
        let db = get_database().await;
        assert!(db.is_ok(), "Should be able to get database connection");
    }

    #[tokio::test]
    async fn test_database_health_check() {
        // Initialize database first
        let _db = initialize_database()
            .await
            .expect("Database should initialize");

        // Test health check
        let health = check_database_health().await;
        assert!(health.is_ok(), "Health check should succeed");

        let health_info = health.unwrap();
        assert!(health_info.is_healthy, "Database should be healthy");
    }

    #[tokio::test]
    async fn test_migration_system() {
        // Test that migrations can be run
        let db = initialize_database()
            .await
            .expect("Database should initialize");

        // Test getting last migration
        let last_migration = migration::get_last_migration(&*db).await;
        assert!(
            last_migration.is_ok(),
            "Should be able to get last migration"
        );
    }
}
