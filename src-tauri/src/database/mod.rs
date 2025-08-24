use sea_orm::{DatabaseConnection, DbErr};
use std::sync::Arc;
use tokio::sync::OnceCell;

pub mod config;
pub mod entities;
pub mod error;
pub mod migration;
pub mod repositories;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod integration_test;

use config::{create_connection_with_config, DatabaseConfig};
use migration::{MigrationStatus, MigrationTestResult};
use migration::initialization::{DatabaseIntegrityReport, validate_database_integrity, run_post_migration_initialization};

// Global database connection instance
static DB_CONNECTION: OnceCell<Arc<DatabaseConnection>> = OnceCell::const_new();

/// Initialize the database connection with SeaORM
pub async fn initialize_database() -> Result<Arc<DatabaseConnection>, DbErr> {
    DB_CONNECTION
        .get_or_try_init(|| async {
            // Create database connection with configuration
            let config = DatabaseConfig::new()
                .with_max_connections(5) // Limit connections for SQLite
                .with_min_connections(1)
                .with_sqlx_logging(cfg!(debug_assertions));

            let db = create_connection_with_config(config).await?;

            // Run migrations
            migration::run_migrations(&db).await?;

            // Run post-migration initialization
            migration::initialization::run_post_migration_initialization(&db).await?;

            Ok(Arc::new(db))
        })
        .await
        .map(|db| db.clone())
}

/// Get the database connection
pub async fn get_database() -> Result<Arc<DatabaseConnection>, DbErr> {
    if let Some(db) = DB_CONNECTION.get() {
        Ok(db.clone())
    } else {
        initialize_database().await
    }
}

/// Close the database connection (for cleanup)
#[allow(dead_code)]
pub async fn close_database() -> Result<(), DbErr> {
    // Note: SeaORM connections are automatically closed when dropped
    // This is a placeholder for future cleanup logic if needed
    Ok(())
}

/// Check database health
pub async fn check_database_health() -> Result<DatabaseHealth, DbErr> {
    let db = get_database().await?;

    // Test basic connectivity
    let result = db.ping().await;

    match result {
        Ok(_) => Ok(DatabaseHealth {
            is_healthy: true,
            connection_pool_size: 1, // SeaORM manages this internally
            last_migration: migration::get_last_migration(&*db).await.ok(),
        }),
        Err(_e) => Ok(DatabaseHealth {
            is_healthy: false,
            connection_pool_size: 0,
            last_migration: None,
        }),
    }
}

/// Get migration status
pub async fn get_migration_status() -> Result<MigrationStatus, DbErr> {
    let db = get_database().await?;
    migration::get_migration_status(&*db).await
}

/// Test migration compatibility
pub async fn test_migration_compatibility() -> Result<MigrationTestResult, DbErr> {
    let db = get_database().await?;
    migration::test_migration_compatibility(&*db).await
}

/// Rollback last migration (for development/testing)
#[allow(dead_code)]
pub async fn rollback_last_migration() -> Result<(), DbErr> {
    let db = get_database().await?;
    migration::rollback_last_migration(&*db).await
}

/// Reset all migrations (for development/testing)
#[allow(dead_code)]
pub async fn reset_migrations() -> Result<(), DbErr> {
    let db = get_database().await?;
    migration::reset_migrations(&*db).await
}

/// Run post-migration initialization
pub async fn run_post_migration_init() -> Result<(), DbErr> {
    let db = get_database().await?;
    run_post_migration_initialization(&*db).await
}

/// Validate database integrity
pub async fn validate_db_integrity() -> Result<DatabaseIntegrityReport, DbErr> {
    let db = get_database().await?;
    validate_database_integrity(&*db).await
}

#[derive(Debug, serde::Serialize)]
pub struct DatabaseHealth {
    pub is_healthy: bool,
    pub connection_pool_size: u32,
    pub last_migration: Option<String>,
}
