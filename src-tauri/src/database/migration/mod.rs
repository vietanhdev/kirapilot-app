use sea_orm::{DatabaseConnection, DbErr};
use sea_orm_migration::prelude::*;

pub mod m20240101_000001_create_tasks_table;
pub mod m20240101_000002_create_task_dependencies_table;
pub mod m20240101_000003_create_time_sessions_table;
pub mod m20240101_000004_create_ai_interactions_table;
pub mod m20240101_000005_create_focus_sessions_table;
pub mod m20240101_000006_create_productivity_patterns_table;
pub mod m20240101_000007_create_user_preferences_table;
pub mod m20240101_000008_create_ai_suggestions_table;
pub mod m20240101_000009_create_indexes;

#[cfg(test)]
mod tests;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20240101_000001_create_tasks_table::Migration),
            Box::new(m20240101_000002_create_task_dependencies_table::Migration),
            Box::new(m20240101_000003_create_time_sessions_table::Migration),
            Box::new(m20240101_000004_create_ai_interactions_table::Migration),
            Box::new(m20240101_000005_create_focus_sessions_table::Migration),
            Box::new(m20240101_000006_create_productivity_patterns_table::Migration),
            Box::new(m20240101_000007_create_user_preferences_table::Migration),
            Box::new(m20240101_000008_create_ai_suggestions_table::Migration),
            Box::new(m20240101_000009_create_indexes::Migration),
        ]
    }
}

/// Run all pending migrations
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    println!("Running database migrations...");

    // Get current migration status
    let applied_migrations = Migrator::get_applied_migrations(db).await?;
    let pending_migrations = Migrator::get_pending_migrations(db).await?;

    println!("Applied migrations: {}", applied_migrations.len());
    println!("Pending migrations: {}", pending_migrations.len());

    if !pending_migrations.is_empty() {
        println!(
            "Applying {} pending migrations...",
            pending_migrations.len()
        );
        Migrator::up(db, None).await?;
        println!("All migrations applied successfully!");
    } else {
        println!("Database is up to date!");
    }

    Ok(())
}

/// Get the last applied migration
pub async fn get_last_migration(db: &DatabaseConnection) -> Result<String, DbErr> {
    let applied_migrations = Migrator::get_applied_migrations(db).await?;

    if let Some(_last_migration) = applied_migrations.last() {
        Ok("latest".to_string())
    } else {
        Ok("none".to_string())
    }
}

/// Get migration status information
pub async fn get_migration_status(db: &DatabaseConnection) -> Result<MigrationStatus, DbErr> {
    let applied_migrations = Migrator::get_applied_migrations(db).await?;
    let pending_migrations = Migrator::get_pending_migrations(db).await?;

    Ok(MigrationStatus {
        applied_count: applied_migrations.len(),
        pending_count: pending_migrations.len(),
        last_applied: applied_migrations.last().map(|_m| "latest".to_string()),
        is_up_to_date: pending_migrations.is_empty(),
    })
}

/// Rollback the last migration (for development/testing)
pub async fn rollback_last_migration(db: &DatabaseConnection) -> Result<(), DbErr> {
    println!("Rolling back last migration...");

    let applied_migrations = Migrator::get_applied_migrations(db).await?;
    if applied_migrations.is_empty() {
        println!("No migrations to rollback");
        return Ok(());
    }

    let _last_migration = applied_migrations.last().unwrap();
    println!("Rolling back last migration...");

    Migrator::down(db, Some(1)).await?;
    println!("Migration rollback completed successfully!");

    Ok(())
}

/// Rollback multiple migrations (for development/testing)
pub async fn rollback_migrations(db: &DatabaseConnection, steps: u32) -> Result<(), DbErr> {
    println!("Rolling back {} migrations...", steps);

    let applied_migrations = Migrator::get_applied_migrations(db).await?;
    if applied_migrations.is_empty() {
        println!("No migrations to rollback");
        return Ok(());
    }

    let available_steps = applied_migrations.len() as u32;
    let actual_steps = steps.min(available_steps);

    println!(
        "Rolling back {} migrations (requested: {}, available: {})",
        actual_steps, steps, available_steps
    );

    Migrator::down(db, Some(actual_steps)).await?;
    println!("Migration rollback completed successfully!");

    Ok(())
}

/// Reset all migrations (for development/testing)
pub async fn reset_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    println!("Resetting all migrations...");

    let applied_migrations = Migrator::get_applied_migrations(db).await?;
    if applied_migrations.is_empty() {
        println!("No migrations to reset");
        return Ok(());
    }

    println!("Resetting {} applied migrations", applied_migrations.len());

    Migrator::reset(db).await?;
    println!("All migrations reset successfully!");

    Ok(())
}

/// Test migration forward and backward compatibility
pub async fn test_migration_compatibility(
    db: &DatabaseConnection,
) -> Result<MigrationTestResult, DbErr> {
    println!("Testing migration compatibility...");

    // Get initial state
    let initial_status = get_migration_status(db).await?;
    println!(
        "Initial state: {} applied, {} pending",
        initial_status.applied_count, initial_status.pending_count
    );

    // If there are pending migrations, apply them first
    if initial_status.pending_count > 0 {
        println!("Applying pending migrations for test...");
        Migrator::up(db, None).await?;
    }

    // Get state after applying all migrations
    let after_up_status = get_migration_status(db).await?;

    // Test rollback of last migration if any exist
    let rollback_success = if after_up_status.applied_count > 0 {
        println!("Testing rollback of last migration...");
        match rollback_last_migration(db).await {
            Ok(_) => {
                println!("Rollback test successful");

                // Re-apply the migration to restore state
                println!("Re-applying migration to restore state...");
                match Migrator::up(db, None).await {
                    Ok(_) => {
                        println!("Re-application successful");
                        true
                    }
                    Err(e) => {
                        println!("Re-application failed: {}", e);
                        false
                    }
                }
            }
            Err(e) => {
                println!("Rollback test failed: {}", e);
                false
            }
        }
    } else {
        println!("No migrations to test rollback");
        true
    };

    // Get final state
    let final_status = get_migration_status(db).await?;

    let test_result = MigrationTestResult {
        initial_applied: initial_status.applied_count,
        initial_pending: initial_status.pending_count,
        final_applied: final_status.applied_count,
        final_pending: final_status.pending_count,
        rollback_test_passed: rollback_success,
        forward_compatibility: final_status.is_up_to_date,
        backward_compatibility: rollback_success,
    };

    println!("Migration compatibility test completed!");
    println!(
        "Forward compatibility: {}",
        test_result.forward_compatibility
    );
    println!(
        "Backward compatibility: {}",
        test_result.backward_compatibility
    );

    Ok(test_result)
}

#[derive(Debug, serde::Serialize)]
pub struct MigrationStatus {
    pub applied_count: usize,
    pub pending_count: usize,
    pub last_applied: Option<String>,
    pub is_up_to_date: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct MigrationTestResult {
    pub initial_applied: usize,
    pub initial_pending: usize,
    pub final_applied: usize,
    pub final_pending: usize,
    pub rollback_test_passed: bool,
    pub forward_compatibility: bool,
    pub backward_compatibility: bool,
}
