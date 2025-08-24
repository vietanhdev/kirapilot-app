mod backup;
mod database;

use backup::{BackupMetadata, BackupService};
use database::migration::{MigrationStatus, MigrationTestResult};
use database::repositories::{
    ai_repository::{AiStats, CreateAiInteractionRequest, UpdateAiInteractionRequest},
    task_repository::{CreateTaskRequest, TaskStats, UpdateTaskRequest},
    time_tracking_repository::{CreateTimeSessionRequest, TimeStats, UpdateTimeSessionRequest},
    task_list_repository::{CreateTaskListRequest, UpdateTaskListRequest, TaskListStats},
    AiRepository, TaskRepository, TimeTrackingRepository, TaskListRepository,
};
use database::{
    check_database_health, get_database, get_migration_status, initialize_database,
    test_migration_compatibility, run_post_migration_init, validate_db_integrity, 
    DatabaseHealth,
};
use database::migration::initialization::DatabaseIntegrityReport;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ============================================================================
// Task Management Commands
// ============================================================================

#[tauri::command]
async fn create_task(request: CreateTaskRequest) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database connection failed: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.create_task(request).await {
        Ok(task) => Ok(serde_json::to_value(task).unwrap_or_default()),
        Err(e) => {
            // Provide more specific error messages based on the error type
            let error_msg = match &e {
                sea_orm::DbErr::RecordNotFound(msg) => {
                    if msg.contains("task_list") || msg.contains("TaskList") {
                        "The selected task list no longer exists. Please select a different task list.".to_string()
                    } else {
                        format!("Record not found: {}", msg)
                    }
                },
                sea_orm::DbErr::Custom(msg) => {
                    format!("Database constraint error: {}", msg)
                },
                sea_orm::DbErr::Conn(msg) => {
                    format!("Database connection error: {}", msg)
                },
                sea_orm::DbErr::Exec(msg) => {
                    let msg_str = msg.to_string();
                    if msg_str.contains("FOREIGN KEY constraint failed") {
                        "The selected task list is invalid. Please select a valid task list.".to_string()
                    } else if msg_str.contains("NOT NULL constraint failed") {
                        "Required field is missing. Please check all required fields.".to_string()
                    } else {
                        format!("Database execution error: {}", msg)
                    }
                },
                _ => format!("Database error: {}", e),
            };
            Err(error_msg)
        }
    }
}

#[tauri::command]
async fn get_task(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.find_by_id(&id).await {
        Ok(task) => Ok(task.map(|t| serde_json::to_value(t).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get task: {}", e)),
    }
}

#[tauri::command]
async fn get_task_with_dependencies(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.find_with_dependencies(&id).await {
        Ok(result) => Ok(result.map(|(task, deps)| {
            serde_json::json!({
                "task": task,
                "dependencies": deps
            })
        })),
        Err(e) => Err(format!("Failed to get task with dependencies: {}", e)),
    }
}

#[tauri::command]
async fn get_all_tasks(
    status: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo
        .find_all(status.as_deref(), project_id.as_deref())
        .await
    {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get tasks: {}", e)),
    }
}

#[tauri::command]
async fn get_scheduled_tasks(
    start_date: String,
    end_date: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    let start = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);
    let end = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.find_scheduled_between(start, end).await {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get scheduled tasks: {}", e)),
    }
}

#[tauri::command]
async fn get_backlog_tasks() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.find_backlog().await {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get backlog tasks: {}", e)),
    }
}

#[tauri::command]
async fn update_task(id: String, request: UpdateTaskRequest) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.update_task(&id, request).await {
        Ok(task) => Ok(serde_json::to_value(task).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update task: {}", e)),
    }
}

#[tauri::command]
async fn delete_task(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.delete_task(&id).await {
        Ok(_) => Ok("Task deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete task: {}", e)),
    }
}

#[tauri::command]
async fn add_task_dependency(
    task_id: String,
    depends_on_id: String,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.add_dependency(&task_id, &depends_on_id).await {
        Ok(dependency) => Ok(serde_json::to_value(dependency).unwrap_or_default()),
        Err(e) => Err(format!("Failed to add dependency: {}", e)),
    }
}

#[tauri::command]
async fn remove_task_dependency(task_id: String, depends_on_id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.remove_dependency(&task_id, &depends_on_id).await {
        Ok(_) => Ok("Dependency removed successfully".to_string()),
        Err(e) => Err(format!("Failed to remove dependency: {}", e)),
    }
}

#[tauri::command]
async fn get_task_dependencies(task_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.get_dependencies(&task_id).await {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get task dependencies: {}", e)),
    }
}

#[tauri::command]
async fn get_task_dependents(task_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.get_dependents(&task_id).await {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get task dependents: {}", e)),
    }
}

#[tauri::command]
async fn get_task_stats() -> Result<TaskStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.get_task_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get task stats: {}", e)),
    }
}

#[tauri::command]
async fn search_tasks(query: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TaskRepository::new(db);

    match repo.search_tasks(&query).await {
        Ok(tasks) => Ok(tasks
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to search tasks: {}", e)),
    }
}

// ============================================================================
// Time Tracking Commands
// ============================================================================

#[tauri::command]
async fn create_time_session(
    request: CreateTimeSessionRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.create_session(request).await {
        Ok(session) => Ok(serde_json::to_value(session).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create time session: {}", e)),
    }
}

#[tauri::command]
async fn get_time_session(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.find_by_id(&id).await {
        Ok(session) => Ok(session.map(|s| serde_json::to_value(s).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get time session: {}", e)),
    }
}

#[tauri::command]
async fn get_active_session(task_id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.find_active_session(&task_id).await {
        Ok(session) => Ok(session.map(|s| serde_json::to_value(s).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get active session: {}", e)),
    }
}

#[tauri::command]
async fn get_any_active_session() -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.find_any_active_session().await {
        Ok(session) => Ok(session.map(|s| serde_json::to_value(s).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get any active session: {}", e)),
    }
}

#[tauri::command]
async fn get_task_sessions(task_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.find_sessions_for_task(&task_id).await {
        Ok(sessions) => Ok(sessions
            .into_iter()
            .map(|s| serde_json::to_value(s).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get task sessions: {}", e)),
    }
}

#[tauri::command]
async fn get_sessions_between(
    start_date: String,
    end_date: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    let start = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);
    let end = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.find_sessions_between(start, end).await {
        Ok(sessions) => Ok(sessions
            .into_iter()
            .map(|s| serde_json::to_value(s).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get sessions between dates: {}", e)),
    }
}

#[tauri::command]
async fn update_time_session(
    id: String,
    request: UpdateTimeSessionRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.update_session(&id, request).await {
        Ok(session) => Ok(serde_json::to_value(session).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update time session: {}", e)),
    }
}

#[tauri::command]
async fn stop_time_session(id: String, notes: Option<String>) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.stop_session(&id, notes).await {
        Ok(session) => Ok(serde_json::to_value(session).unwrap_or_default()),
        Err(e) => Err(format!("Failed to stop time session: {}", e)),
    }
}

#[tauri::command]
async fn pause_time_session(id: String) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.pause_session(&id).await {
        Ok(session) => Ok(serde_json::to_value(session).unwrap_or_default()),
        Err(e) => Err(format!("Failed to pause time session: {}", e)),
    }
}

#[tauri::command]
async fn resume_time_session(id: String) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.resume_session(&id).await {
        Ok(session) => Ok(serde_json::to_value(session).unwrap_or_default()),
        Err(e) => Err(format!("Failed to resume time session: {}", e)),
    }
}

#[tauri::command]
async fn delete_time_session(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.delete_session(&id).await {
        Ok(_) => Ok("Time session deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete time session: {}", e)),
    }
}

#[tauri::command]
async fn get_time_stats(start_date: String, end_date: String) -> Result<TimeStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    let start = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);
    let end = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.get_time_stats(start, end).await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get time stats: {}", e)),
    }
}

#[tauri::command]
async fn get_task_total_time(task_id: String) -> Result<i64, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.get_task_total_time(&task_id).await {
        Ok(total_time) => Ok(total_time),
        Err(e) => Err(format!("Failed to get task total time: {}", e)),
    }
}

#[tauri::command]
async fn get_recent_sessions(limit: u64) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    match repo.get_recent_sessions(limit).await {
        Ok(sessions) => Ok(sessions
            .into_iter()
            .map(|s| serde_json::to_value(s).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get recent sessions: {}", e)),
    }
}

#[tauri::command]
async fn get_sessions_with_tasks(
    start_date: String,
    end_date: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = TimeTrackingRepository::new(db);

    let start = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);
    let end = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.get_sessions_with_tasks(start, end).await {
        Ok(sessions_with_tasks) => Ok(sessions_with_tasks
            .into_iter()
            .map(|(session, task)| {
                serde_json::json!({
                    "session": session,
                    "task": task
                })
            })
            .collect()),
        Err(e) => Err(format!("Failed to get sessions with tasks: {}", e)),
    }
}

// ============================================================================
// AI Interaction Commands
// ============================================================================

#[tauri::command]
async fn create_ai_interaction(
    request: CreateAiInteractionRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.create_interaction(request).await {
        Ok(interaction) => Ok(serde_json::to_value(interaction).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create AI interaction: {}", e)),
    }
}

#[tauri::command]
async fn get_ai_interaction(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.find_by_id(&id).await {
        Ok(interaction) => Ok(interaction.map(|i| serde_json::to_value(i).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get AI interaction: {}", e)),
    }
}

#[tauri::command]
async fn get_all_ai_interactions(
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.find_all(limit, offset).await {
        Ok(interactions) => Ok(interactions
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get AI interactions: {}", e)),
    }
}

#[tauri::command]
async fn get_ai_interactions_between(
    start_date: String,
    end_date: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    let start = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);
    let end = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.find_interactions_between(start, end).await {
        Ok(interactions) => Ok(interactions
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!(
            "Failed to get AI interactions between dates: {}",
            e
        )),
    }
}

#[tauri::command]
async fn search_ai_interactions(query: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.search_interactions(&query).await {
        Ok(interactions) => Ok(interactions
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to search AI interactions: {}", e)),
    }
}

#[tauri::command]
async fn update_ai_interaction(
    id: String,
    request: UpdateAiInteractionRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.update_interaction(&id, request).await {
        Ok(interaction) => Ok(serde_json::to_value(interaction).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update AI interaction: {}", e)),
    }
}

#[tauri::command]
async fn delete_ai_interaction(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.delete_interaction(&id).await {
        Ok(_) => Ok("AI interaction deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete AI interaction: {}", e)),
    }
}

#[tauri::command]
async fn get_ai_stats() -> Result<AiStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_ai_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get AI stats: {}", e)),
    }
}

#[tauri::command]
async fn get_recent_ai_interactions(limit: u64) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_recent_interactions(limit).await {
        Ok(interactions) => Ok(interactions
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get recent AI interactions: {}", e)),
    }
}

#[tauri::command]
async fn clear_old_ai_interactions(older_than_days: u64) -> Result<u64, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(older_than_days as i64);

    match repo.clear_old_interactions(cutoff_date).await {
        Ok(deleted_count) => Ok(deleted_count),
        Err(e) => Err(format!("Failed to clear old AI interactions: {}", e)),
    }
}

#[tauri::command]
async fn get_conversation_history(limit: u64) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_conversation_history(limit).await {
        Ok(interactions) => Ok(interactions
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get conversation history: {}", e)),
    }
}

#[tauri::command]
async fn clear_all_data() -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Clear all tables in the correct order (respecting foreign key constraints)

    // First, clear time sessions (they reference tasks)
    let time_repo = TimeTrackingRepository::new(db.clone());
    let time_sessions_deleted = time_repo
        .delete_all_sessions()
        .await
        .map_err(|e| format!("Failed to clear time sessions: {}", e))?;

    // Clear AI interactions
    let ai_repo = AiRepository::new(db.clone());
    let ai_interactions_deleted = ai_repo
        .delete_all_interactions()
        .await
        .map_err(|e| format!("Failed to clear AI interactions: {}", e))?;

    // Clear task dependencies first
    let task_repo = TaskRepository::new(db.clone());
    let dependencies_deleted = task_repo
        .delete_all_dependencies()
        .await
        .map_err(|e| format!("Failed to clear task dependencies: {}", e))?;

    // Finally, clear tasks
    let tasks_deleted = task_repo
        .delete_all_tasks()
        .await
        .map_err(|e| format!("Failed to clear tasks: {}", e))?;

    Ok(format!(
        "Successfully cleared all data: {} tasks, {} time sessions, {} AI interactions, {} dependencies",
        tasks_deleted, time_sessions_deleted, ai_interactions_deleted, dependencies_deleted
    ))
}

#[tauri::command]
async fn init_database() -> Result<String, String> {
    match initialize_database().await {
        Ok(_) => Ok("Database initialized successfully".to_string()),
        Err(e) => Err(format!("Failed to initialize database: {}", e)),
    }
}

#[tauri::command]
async fn get_database_health() -> Result<DatabaseHealth, String> {
    match check_database_health().await {
        Ok(health) => Ok(health),
        Err(e) => Err(format!("Failed to check database health: {}", e)),
    }
}

#[tauri::command]
async fn get_migration_status_cmd() -> Result<MigrationStatus, String> {
    match get_migration_status().await {
        Ok(status) => Ok(status),
        Err(e) => Err(format!("Failed to get migration status: {}", e)),
    }
}

#[tauri::command]
async fn test_migration_compatibility_cmd() -> Result<MigrationTestResult, String> {
    match test_migration_compatibility().await {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("Failed to test migration compatibility: {}", e)),
    }
}

#[tauri::command]
async fn run_post_migration_initialization() -> Result<String, String> {
    match run_post_migration_init().await {
        Ok(_) => Ok("Post-migration initialization completed successfully".to_string()),
        Err(e) => Err(format!("Failed to run post-migration initialization: {}", e)),
    }
}

#[tauri::command]
async fn validate_database_integrity() -> Result<DatabaseIntegrityReport, String> {
    match validate_db_integrity().await {
        Ok(report) => Ok(report),
        Err(e) => Err(format!("Failed to validate database integrity: {}", e)),
    }
}

// ============================================================================
// Task List Management Commands
// ============================================================================

#[tauri::command]
async fn get_all_task_lists() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.find_all_task_lists().await {
        Ok(task_lists) => {
            let json_task_lists: Vec<serde_json::Value> = task_lists
                .into_iter()
                .map(|task_list| serde_json::to_value(task_list).unwrap())
                .collect();
            Ok(json_task_lists)
        }
        Err(e) => Err(format!("Failed to get task lists: {}", e)),
    }
}

#[tauri::command]
async fn create_task_list(request: CreateTaskListRequest) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.create_task_list(request.name).await {
        Ok(task_list) => Ok(serde_json::to_value(task_list).unwrap()),
        Err(e) => Err(format!("Failed to create task list: {}", e)),
    }
}

#[tauri::command]
async fn update_task_list(
    id: String,
    request: UpdateTaskListRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.update_task_list(&id, request.name).await {
        Ok(task_list) => Ok(serde_json::to_value(task_list).unwrap()),
        Err(e) => Err(format!("Failed to update task list: {}", e)),
    }
}

#[tauri::command]
async fn delete_task_list(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.delete_task_list(&id).await {
        Ok(_) => Ok("Task list deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete task list: {}", e)),
    }
}

#[tauri::command]
async fn get_default_task_list() -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.get_default_task_list().await {
        Ok(task_list) => Ok(serde_json::to_value(task_list).unwrap()),
        Err(e) => Err(format!("Failed to get default task list: {}", e)),
    }
}

#[tauri::command]
async fn move_task_to_list(taskId: String, taskListId: String) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let task_repo = TaskRepository::new(db.clone());
    let task_list_repo = TaskListRepository::new(db);

    // Validate that the task list exists
    match task_list_repo.exists(&taskListId).await {
        Ok(false) => return Err(format!("Task list with ID '{}' not found", taskListId)),
        Err(e) => return Err(format!("Failed to validate task list: {}", e)),
        Ok(true) => {}
    }

    // Perform the move operation
    match task_repo.move_task_to_list(&taskId, &taskListId).await {
        Ok(task) => Ok(serde_json::to_value(task).unwrap()),
        Err(e) => Err(format!("Failed to move task '{}' to list '{}': {}", taskId, taskListId, e)),
    }
}

#[tauri::command]
async fn get_tasks_by_task_list(task_list_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_repo = TaskRepository::new(db);

    match task_repo.find_by_task_list(&task_list_id).await {
        Ok(tasks) => {
            let json_tasks: Vec<serde_json::Value> = tasks
                .into_iter()
                .map(|task| serde_json::to_value(task).unwrap())
                .collect();
            Ok(json_tasks)
        }
        Err(e) => Err(format!("Failed to get tasks by task list: {}", e)),
    }
}

#[tauri::command]
async fn get_task_list_stats() -> Result<TaskListStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_list_repo = TaskListRepository::new(db);

    match task_list_repo.get_task_list_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get task list stats: {}", e)),
    }
}

// ============================================================================
// Backup & Restore Commands
// ============================================================================

#[tauri::command]
async fn export_data_to_file(file_path: String) -> Result<BackupMetadata, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let backup_service = BackupService::new(db);

    match backup_service.export_data(&file_path).await {
        Ok(metadata) => Ok(metadata),
        Err(e) => Err(format!("Failed to export data: {}", e)),
    }
}

#[tauri::command]
async fn import_data_from_file(
    file_path: String,
    overwrite: bool,
) -> Result<BackupMetadata, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let backup_service = BackupService::new(db);

    match backup_service.import_data(&file_path, overwrite).await {
        Ok(metadata) => Ok(metadata),
        Err(e) => Err(format!("Failed to import data: {}", e)),
    }
}

#[tauri::command]
async fn validate_backup_file(file_path: String) -> Result<BackupMetadata, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let backup_service = BackupService::new(db);

    match backup_service.validate_backup(&file_path).await {
        Ok(metadata) => Ok(metadata),
        Err(e) => Err(format!("Failed to validate backup: {}", e)),
    }
}

#[tauri::command]
async fn validate_backup_comprehensive(
    file_path: String,
) -> Result<backup::BackupValidationResult, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let backup_service = BackupService::new(db);

    match backup_service
        .validate_backup_comprehensive(&file_path)
        .await
    {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("Failed to validate backup: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            // Initialize database on app startup
            tauri::async_runtime::spawn(async move {
                if let Err(e) = initialize_database().await {
                    eprintln!("Failed to initialize database on startup: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            init_database,
            get_database_health,
            get_migration_status_cmd,
            test_migration_compatibility_cmd,
            run_post_migration_initialization,
            validate_database_integrity,
            // Task Management Commands
            create_task,
            get_task,
            get_task_with_dependencies,
            get_all_tasks,
            get_scheduled_tasks,
            get_backlog_tasks,
            update_task,
            delete_task,
            add_task_dependency,
            remove_task_dependency,
            get_task_dependencies,
            get_task_dependents,
            get_task_stats,
            search_tasks,
            // Task List Management Commands
            get_all_task_lists,
            create_task_list,
            update_task_list,
            delete_task_list,
            get_default_task_list,
            move_task_to_list,
            get_tasks_by_task_list,
            get_task_list_stats,
            // Time Tracking Commands
            create_time_session,
            get_time_session,
            get_active_session,
            get_any_active_session,
            get_task_sessions,
            get_sessions_between,
            update_time_session,
            stop_time_session,
            pause_time_session,
            resume_time_session,
            delete_time_session,
            get_time_stats,
            get_task_total_time,
            get_recent_sessions,
            get_sessions_with_tasks,
            // AI Interaction Commands
            create_ai_interaction,
            get_ai_interaction,
            get_all_ai_interactions,
            get_ai_interactions_between,
            search_ai_interactions,
            update_ai_interaction,
            delete_ai_interaction,
            get_ai_stats,
            get_recent_ai_interactions,
            clear_old_ai_interactions,
            get_conversation_history,
            clear_all_data,
            // Backup & Restore Commands
            export_data_to_file,
            import_data_from_file,
            validate_backup_file,
            validate_backup_comprehensive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
