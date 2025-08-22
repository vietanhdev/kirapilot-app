# SeaORM Entities Documentation

This document provides an overview of all SeaORM entities implemented for the KiraPilot application.

## Entity Overview

All entities are implemented using SeaORM with the following features:

- Type-safe database operations
- Automatic UUID generation for primary keys
- Proper relationships and foreign key constraints
- Automatic timestamp management (created_at, updated_at)
- JSON field support for complex data structures
- Comprehensive test coverage

## Entities

### 1. Tasks Entity (`tasks.rs`)

**Purpose**: Core task management with rich metadata and relationships

**Key Fields**:

- `id`: Primary key (UUID string)
- `title`: Task title (required)
- `description`: Rich text description (optional)
- `priority`: Priority level (integer)
- `status`: Task status (string)
- `due_date`: When task must be completed (optional)
- `scheduled_date`: When task is planned to be worked on (optional)
- `time_estimate`: Estimated time in seconds
- `actual_time`: Actual time spent in seconds
- `tags`: JSON array of tags (optional)
- `dependencies`: JSON array of dependency IDs (optional)

**Relationships**:

- Has many `TaskDependencies` (outgoing dependencies)
- Has many `TimeSessions` (time tracking sessions)
- Has many `FocusSessions` (focus sessions)

### 2. TaskDependencies Entity (`task_dependencies.rs`)

**Purpose**: Manages task dependency relationships

**Key Fields**:

- `id`: Primary key (UUID string)
- `task_id`: ID of the dependent task
- `depends_on_id`: ID of the task this depends on

**Relationships**:

- Belongs to `Task` (via task_id)
- Belongs to `Task` (via depends_on_id)

### 3. TimeSessions Entity (`time_sessions.rs`)

**Purpose**: Tracks time spent on tasks with detailed session information

**Key Fields**:

- `id`: Primary key (UUID string)
- `task_id`: Associated task ID
- `start_time`: Session start timestamp
- `end_time`: Session end timestamp (optional for active sessions)
- `paused_time`: Total paused time in seconds
- `is_active`: Whether session is currently active
- `notes`: Session notes (optional)
- `breaks`: JSON array of break information (optional)

**Relationships**:

- Belongs to `Task` (via task_id)

### 4. AIInteractions Entity (`ai_interactions.rs`)

**Purpose**: Stores conversation history and AI assistant interactions

**Key Fields**:

- `id`: Primary key (UUID string)
- `message`: User message
- `response`: AI response
- `action_taken`: Action performed by AI (optional)
- `reasoning`: AI reasoning process (optional)
- `tools_used`: JSON array of tools used (optional)
- `confidence`: AI confidence score (optional)

**Relationships**: None (standalone entity)

### 5. FocusSessions Entity (`focus_sessions.rs`)

**Purpose**: Tracks focused work sessions with productivity metrics

**Key Fields**:

- `id`: Primary key (UUID string)
- `task_id`: Associated task ID
- `planned_duration`: Planned session length in seconds
- `actual_duration`: Actual session length in seconds (optional)
- `focus_score`: Productivity score (0.0-1.0, optional)
- `distraction_count`: Number of distractions
- `distraction_level`: Distraction level (low/medium/high)
- `background_audio`: Audio settings (optional)
- `notes`: Session notes (optional)
- `breaks`: JSON array of break information (optional)
- `metrics`: JSON object with detailed metrics (optional)

**Relationships**:

- Belongs to `Task` (via task_id)

### 6. ProductivityPatterns Entity (`productivity_patterns.rs`)

**Purpose**: Stores learned productivity patterns and analytics

**Key Fields**:

- `id`: Primary key (UUID string)
- `user_id`: User identifier
- `pattern_type`: Type of pattern (e.g., "focus_time", "break_preference")
- `time_slot`: Time period (e.g., "09:00-11:00")
- `productivity_score`: Productivity score for this pattern
- `confidence_level`: Confidence in the pattern
- `sample_size`: Number of data points used

**Relationships**: None (standalone entity)

### 7. UserPreferences Entity (`user_preferences.rs`)

**Purpose**: Stores user settings and preferences

**Key Fields**:

- `id`: Primary key (defaults to "default")
- `working_hours`: JSON object with working hours
- `break_preferences`: JSON object with break settings
- `focus_preferences`: JSON object with focus settings
- `notifications`: JSON object with notification settings
- `theme`: UI theme preference (optional)
- `language`: Language preference (optional)

**Relationships**: None (singleton entity)

### 8. AISuggestions Entity (`ai_suggestions.rs`)

**Purpose**: Stores AI-generated suggestions and recommendations

**Key Fields**:

- `id`: Primary key (UUID string)
- `suggestion_type`: Type of suggestion
- `title`: Suggestion title
- `description`: Detailed description
- `confidence`: AI confidence in suggestion
- `actionable`: Whether suggestion can be acted upon
- `priority`: Suggestion priority
- `estimated_impact`: Expected impact score
- `reasoning`: AI reasoning for suggestion (optional)
- `actions`: JSON array of suggested actions (optional)
- `dismissed_at`: When suggestion was dismissed (optional)
- `applied_at`: When suggestion was applied (optional)

**Relationships**: None (standalone entity)

## Key Features

### 1. Type Safety

All entities use SeaORM's derive macros for compile-time type checking:

- `DeriveEntityModel` for entity definition
- `DeriveRelation` for relationship definition
- Proper foreign key constraints

### 2. Automatic Field Management

- UUID generation for primary keys
- Automatic timestamp management (created_at, updated_at)
- Default values for common fields

### 3. JSON Field Support

Complex data structures are stored as JSON strings:

- Task tags and dependencies
- Session break information
- User preferences
- AI tool usage and metrics

### 4. Relationship Management

Proper SeaORM relationships with:

- `belongs_to` for foreign key relationships
- `has_many` for one-to-many relationships
- Related entity access through `find_related()`

### 5. Comprehensive Testing

All entities have comprehensive test coverage including:

- Entity creation and validation
- Relationship testing
- Constraint verification
- Complex query scenarios

## Usage Examples

### Creating a Task with Dependencies

```rust
// Create main task
let task = tasks::ActiveModel {
    title: Set("Complete project".to_string()),
    priority: Set(1),
    status: Set("pending".to_string()),
    ..Default::default()
};
let task = task.insert(&db).await?;

// Create dependency
let dependency = task_dependencies::ActiveModel {
    task_id: Set(task.id.clone()),
    depends_on_id: Set(prerequisite_task_id),
    ..Default::default()
};
dependency.insert(&db).await?;
```

### Querying Tasks with Related Data

```rust
// Find task with all time sessions
let task_with_sessions = tasks::Entity::find_by_id(task_id)
    .find_with_related(time_sessions::Entity)
    .all(&db)
    .await?;
```

### Creating AI Interaction

```rust
let interaction = ai_interactions::ActiveModel {
    message: Set("Create a task for project review".to_string()),
    response: Set("I'll create that task for you".to_string()),
    action_taken: Set(Some("CREATE_TASK".to_string())),
    reasoning: Set(Some("User requested task creation".to_string())),
    confidence: Set(Some(0.95)),
    ..Default::default()
};
interaction.insert(&db).await?;
```

## Migration Support

All entities are designed to work with SeaORM's migration system:

- Schema definitions in migration files
- Automatic index creation
- Foreign key constraint management
- Version-controlled schema changes

## Testing

Run entity tests with:

```bash
cargo test entities::tests --lib
```

All tests use in-memory SQLite databases for fast, isolated testing.
