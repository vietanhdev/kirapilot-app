# SeaORM Database Setup

This directory contains the SeaORM-based database implementation for KiraPilot.

## Structure

```
database/
├── config.rs           # Database connection configuration
├── entities/           # SeaORM entity definitions
│   ├── tasks.rs
│   ├── task_dependencies.rs
│   ├── time_sessions.rs
│   ├── ai_interactions.rs
│   ├── focus_sessions.rs
│   ├── productivity_patterns.rs
│   ├── user_preferences.rs
│   └── ai_suggestions.rs
├── error.rs            # Custom error types
├── migration/          # Database migrations
│   ├── m20240101_000001_create_tasks_table.rs
│   ├── m20240101_000002_create_task_dependencies_table.rs
│   ├── m20240101_000003_create_time_sessions_table.rs
│   ├── m20240101_000004_create_ai_interactions_table.rs
│   ├── m20240101_000005_create_focus_sessions_table.rs
│   ├── m20240101_000006_create_productivity_patterns_table.rs
│   ├── m20240101_000007_create_user_preferences_table.rs
│   ├── m20240101_000008_create_ai_suggestions_table.rs
│   └── m20240101_000009_create_indexes.rs
├── repositories/       # Repository pattern implementations (TODO: Task 8.3)
│   ├── task_repository.rs
│   ├── time_tracking_repository.rs
│   ├── focus_repository.rs
│   ├── pattern_repository.rs
│   └── ai_repository.rs
└── tests.rs           # Database tests
```

## Features

- **Type-safe database operations** using SeaORM entities
- **Automatic migrations** with version control
- **Connection pooling** for optimal performance
- **Async operations** for non-blocking database access
- **Comprehensive error handling** with custom error types
- **Repository pattern** for clean separation of concerns

## Configuration

The database is configured to use SQLite with the following settings:

- Database file: `kirapilot.db`
- Max connections: 5 (optimized for SQLite)
- Min connections: 1
- Connection timeout: 30 seconds
- Idle timeout: 10 minutes

## Usage

### Initialize Database

```rust
use crate::database::initialize_database;

let db = initialize_database().await?;
```

### Get Database Connection

```rust
use crate::database::get_database;

let db = get_database().await?;
```

### Check Database Health

```rust
use crate::database::check_database_health;

let health = check_database_health().await?;
println!("Database healthy: {}", health.is_healthy);
```

## Migration System

Migrations are automatically run on database initialization. The migration system:

- Tracks applied migrations in a `seaql_migrations` table
- Applies migrations in order based on filename
- Supports rollback for development/testing
- Provides forward compatibility

## Next Steps

The following tasks are planned for completion:

1. **Task 8.2**: Create complete SeaORM entities with relationships
2. **Task 8.3**: Implement repository layer with CRUD operations
3. **Task 8.4**: Complete migration system with proper indexes
4. **Task 8.5**: Update Tauri commands to use SeaORM repositories
5. **Task 8.6**: Remove legacy database code and finalize migration

## Dependencies

- `sea-orm`: Main ORM framework
- `sea-orm-migration`: Migration system
- `chrono`: Date/time handling
- `uuid`: Unique identifier generation
- `tokio`: Async runtime
- `anyhow`: Error handling
