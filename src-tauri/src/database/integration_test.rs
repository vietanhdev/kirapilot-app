#[cfg(test)]
mod integration_tests {
    use crate::database::{initialize_database, get_migration_status, test_migration_compatibility};

    #[tokio::test]
    async fn test_database_initialization_with_migrations() {
        // Test that database initialization runs migrations successfully
        let result = initialize_database().await;
        assert!(result.is_ok(), "Database initialization should succeed: {:?}", result);
        
        // Verify migration status
        let status = get_migration_status().await.expect("Should get migration status");
        assert!(status.is_up_to_date, "Database should be up to date after initialization");
        assert!(status.applied_count > 0, "Should have applied migrations");
        assert_eq!(status.pending_count, 0, "Should have no pending migrations");
    }

    #[tokio::test]
    async fn test_migration_compatibility_integration() {
        // Initialize database first
        initialize_database().await.expect("Database initialization should succeed");
        
        // Test migration compatibility
        let result = test_migration_compatibility().await;
        assert!(result.is_ok(), "Migration compatibility test should pass: {:?}", result);
        
        let test_result = result.unwrap();
        assert!(test_result.forward_compatibility, "Forward compatibility should pass");
        assert!(test_result.backward_compatibility, "Backward compatibility should pass");
    }
}