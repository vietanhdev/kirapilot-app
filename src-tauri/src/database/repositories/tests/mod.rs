pub mod focus_repository_tests;
pub mod integration_test;
pub mod pattern_repository_tests;
pub mod task_list_repository_tests;
pub mod task_repository_tests;
pub mod time_tracking_repository_tests;

use sea_orm::{ConnectionTrait, Database, DatabaseConnection, DbErr, Statement};
use std::sync::Arc;

/// Create an in-memory SQLite database for testing
pub async fn create_test_db() -> Result<Arc<DatabaseConnection>, DbErr> {
    let db = Database::connect("sqlite::memory:").await?;
    Ok(Arc::new(db))
}

/// Setup test database with migrations
pub async fn setup_test_db() -> Result<Arc<DatabaseConnection>, DbErr> {
    let db = create_test_db().await?;

    // Create tables for testing
    create_test_tables(&db).await?;

    Ok(db)
}

/// Create test database tables
async fn create_test_tables(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create tasks table
    let create_tasks_sql = r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            dependencies TEXT,
            time_estimate INTEGER NOT NULL DEFAULT 0,
            actual_time INTEGER NOT NULL DEFAULT 0,
            due_date TEXT,
            scheduled_date TEXT,
            tags TEXT,
            project_id TEXT,
            parent_task_id TEXT,
            task_list_id TEXT,
            subtasks TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            order_num INTEGER NOT NULL DEFAULT 0,
            periodic_template_id TEXT,
            is_periodic_instance BOOLEAN NOT NULL DEFAULT FALSE,
            generation_date TEXT,
            FOREIGN KEY (task_list_id) REFERENCES task_lists(id),
            FOREIGN KEY (periodic_template_id) REFERENCES periodic_task_templates(id)
        )
    "#;

    // Create task_dependencies table
    let create_task_dependencies_sql = r#"
        CREATE TABLE IF NOT EXISTS task_dependencies (
            id TEXT PRIMARY KEY NOT NULL,
            task_id TEXT NOT NULL,
            depends_on_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (depends_on_id) REFERENCES tasks(id)
        )
    "#;

    // Create time_sessions table
    let create_time_sessions_sql = r#"
        CREATE TABLE IF NOT EXISTS time_sessions (
            id TEXT PRIMARY KEY NOT NULL,
            task_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            paused_time INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT,
            breaks TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    "#;

    // Create focus_sessions table
    let create_focus_sessions_sql = r#"
        CREATE TABLE IF NOT EXISTS focus_sessions (
            id TEXT PRIMARY KEY NOT NULL,
            task_id TEXT NOT NULL,
            planned_duration INTEGER NOT NULL,
            actual_duration INTEGER,
            focus_score REAL,
            distraction_count INTEGER NOT NULL DEFAULT 0,
            distraction_level TEXT NOT NULL,
            background_audio TEXT,
            notes TEXT,
            breaks TEXT,
            metrics TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    "#;

    // Create productivity_patterns table
    let create_productivity_patterns_sql = r#"
        CREATE TABLE IF NOT EXISTS productivity_patterns (
            id TEXT PRIMARY KEY NOT NULL,
            user_id TEXT NOT NULL,
            pattern_type TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            productivity_score REAL NOT NULL,
            confidence_level REAL NOT NULL,
            sample_size INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    "#;

    // Create ai_interactions table
    let create_ai_interactions_sql = r#"
        CREATE TABLE IF NOT EXISTS ai_interactions (
            id TEXT PRIMARY KEY NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            action_taken TEXT,
            reasoning TEXT,
            tools_used TEXT,
            confidence REAL,
            created_at TEXT NOT NULL
        )
    "#;

    // Create task_lists table
    let create_task_lists_sql = r#"
        CREATE TABLE IF NOT EXISTS task_lists (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    "#;

    // Create periodic_task_templates table
    let create_periodic_task_templates_sql = r#"
        CREATE TABLE IF NOT EXISTS periodic_task_templates (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority INTEGER NOT NULL DEFAULT 1,
            time_estimate INTEGER NOT NULL DEFAULT 0,
            tags TEXT,
            task_list_id TEXT,
            recurrence_type TEXT NOT NULL,
            recurrence_interval INTEGER NOT NULL DEFAULT 1,
            recurrence_unit TEXT,
            start_date TEXT NOT NULL,
            next_generation_date TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (task_list_id) REFERENCES task_lists(id)
        )
    "#;

    // Execute table creation statements
    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_tasks_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_task_dependencies_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_time_sessions_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_focus_sessions_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_productivity_patterns_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_ai_interactions_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_task_lists_sql.to_string(),
    ))
    .await?;

    db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        create_periodic_task_templates_sql.to_string(),
    ))
    .await?;

    Ok(())
}
