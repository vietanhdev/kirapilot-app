mod backup;
mod database;

use backup::{BackupMetadata, BackupService};
use database::migration::initialization::DatabaseIntegrityReport;
use database::migration::{MigrationStatus, MigrationTestResult};
use database::repositories::{
    ai_repository::{
        AiLogStorageStats, AiStats, CreateAiInteractionLogRequest, CreateAiInteractionRequest,
        CreateToolExecutionLogRequest, UpdateAiInteractionLogRequest, UpdateAiInteractionRequest,
    },
    periodic_task_repository::{
        CreatePeriodicTaskTemplateRequest, PeriodicTaskStats, UpdatePeriodicTaskTemplateRequest,
    },
    task_list_repository::{CreateTaskListRequest, TaskListStats, UpdateTaskListRequest},
    task_repository::{CreateTaskRequest, TaskStats, UpdateTaskRequest},
    thread_repository::{
        CreateThreadMessageRequest, CreateThreadRequest, ThreadStatistics, UpdateThreadRequest,
    },
    time_tracking_repository::{CreateTimeSessionRequest, TimeStats, UpdateTimeSessionRequest},
    AiRepository, PeriodicTaskRepository, TaskListRepository, TaskRepository, ThreadRepository, TimeTrackingRepository,
};
use database::services::TaskGenerationEngine;
use database::{
    check_database_health, get_database, get_migration_status, initialize_database,
    run_post_migration_init, test_migration_compatibility, validate_db_integrity, DatabaseHealth,
};

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
                }
                sea_orm::DbErr::Custom(msg) => {
                    format!("Database constraint error: {}", msg)
                }
                sea_orm::DbErr::Conn(msg) => {
                    format!("Database connection error: {}", msg)
                }
                sea_orm::DbErr::Exec(msg) => {
                    let msg_str = msg.to_string();
                    if msg_str.contains("FOREIGN KEY constraint failed") {
                        "The selected task list is invalid. Please select a valid task list."
                            .to_string()
                    } else if msg_str.contains("NOT NULL constraint failed") {
                        "Required field is missing. Please check all required fields.".to_string()
                    } else {
                        format!("Database execution error: {}", msg)
                    }
                }
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
// Periodic Task Management Commands
// ============================================================================

#[tauri::command]
async fn create_periodic_task_template(
    request: CreatePeriodicTaskTemplateRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.create_template(request).await {
        Ok(template) => Ok(serde_json::to_value(template).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create periodic task template: {}", e)),
    }
}

#[tauri::command]
async fn get_periodic_task_template(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.find_by_id(&id).await {
        Ok(template) => Ok(template.map(|t| serde_json::to_value(t).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get periodic task template: {}", e)),
    }
}

#[tauri::command]
async fn get_all_periodic_task_templates() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.find_all().await {
        Ok(templates) => Ok(templates
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get periodic task templates: {}", e)),
    }
}

#[tauri::command]
async fn get_active_periodic_task_templates() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.find_active().await {
        Ok(templates) => Ok(templates
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get active periodic task templates: {}", e)),
    }
}

#[tauri::command]
async fn get_templates_needing_generation() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    let current_time = chrono::Utc::now();
    match repo.find_templates_needing_generation(current_time).await {
        Ok(templates) => Ok(templates
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get templates needing generation: {}", e)),
    }
}

#[tauri::command]
async fn update_periodic_task_template(
    id: String,
    request: UpdatePeriodicTaskTemplateRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.update_template(&id, request).await {
        Ok(template) => Ok(serde_json::to_value(template).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update periodic task template: {}", e)),
    }
}

#[tauri::command]
async fn delete_periodic_task_template(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.delete_template(&id).await {
        Ok(_) => Ok("Periodic task template deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete periodic task template: {}", e)),
    }
}

#[tauri::command]
async fn get_template_instances(template_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.get_template_instances(&template_id).await {
        Ok(instances) => Ok(instances
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get template instances: {}", e)),
    }
}

#[tauri::command]
async fn count_template_instances(template_id: String) -> Result<u64, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.count_template_instances(&template_id).await {
        Ok(count) => Ok(count),
        Err(e) => Err(format!("Failed to count template instances: {}", e)),
    }
}

#[tauri::command]
async fn calculate_next_generation_date(
    current_date: String,
    recurrence_type: String,
    interval: i32,
    unit: Option<String>,
) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    let current = chrono::DateTime::parse_from_rfc3339(&current_date)
        .map_err(|e| format!("Invalid current date: {}", e))?
        .with_timezone(&chrono::Utc);

    match repo.calculate_next_generation_date(current, &recurrence_type, interval, unit.as_deref()) {
        Ok(next_date) => Ok(next_date.to_rfc3339()),
        Err(e) => Err(format!("Failed to calculate next generation date: {}", e)),
    }
}

#[tauri::command]
async fn get_periodic_task_stats() -> Result<PeriodicTaskStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = PeriodicTaskRepository::new(db);

    match repo.get_periodic_task_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get periodic task stats: {}", e)),
    }
}

#[tauri::command]
async fn generate_pending_instances() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let engine = TaskGenerationEngine::new(db);

    match engine.generate_pending_instances().await {
        Ok(instances) => Ok(instances
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to generate pending instances: {}", e)),
    }
}

#[tauri::command]
async fn generate_instance_from_template(#[allow(non_snake_case)] templateId: String) -> Result<serde_json::Value, String> {
    let template_id = templateId; // Convert to snake_case for Rust convention
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let engine = TaskGenerationEngine::new(db);

    match engine.generate_instance_from_template(&template_id).await {
        Ok(instance) => Ok(serde_json::to_value(instance).unwrap_or_default()),
        Err(e) => Err(format!("Failed to generate instance from template: {}", e)),
    }
}

#[tauri::command]
async fn check_and_generate_instances() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let engine = TaskGenerationEngine::new(db);

    match engine.check_and_generate_instances().await {
        Ok(instances) => Ok(instances
            .into_iter()
            .map(|i| serde_json::to_value(i).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to check and generate instances: {}", e)),
    }
}

// ============================================================================
// Thread Management Commands
// ============================================================================

#[tauri::command]
async fn create_thread(request: CreateThreadRequest) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.create_thread(request).await {
        Ok(thread) => Ok(serde_json::to_value(thread).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create thread: {}", e)),
    }
}

#[tauri::command]
async fn get_thread(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_by_id(&id).await {
        Ok(thread) => Ok(thread.map(|t| serde_json::to_value(t).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get thread: {}", e)),
    }
}

#[tauri::command]
async fn get_all_threads() -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_all().await {
        Ok(threads) => Ok(threads
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get threads: {}", e)),
    }
}

#[tauri::command]
async fn get_threads_by_task(#[allow(non_snake_case)] taskId: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_by_task_id(&taskId).await {
        Ok(threads) => Ok(threads
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get threads by task: {}", e)),
    }
}

#[tauri::command]
async fn get_threads_by_date(date: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_by_date(&date).await {
        Ok(threads) => Ok(threads
            .into_iter()
            .map(|t| serde_json::to_value(t).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get threads by date: {}", e)),
    }
}

#[tauri::command]
async fn update_thread(
    id: String,
    request: UpdateThreadRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.update_thread(&id, request).await {
        Ok(thread) => Ok(serde_json::to_value(thread).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update thread: {}", e)),
    }
}

#[tauri::command]
async fn delete_thread(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.delete_thread(&id).await {
        Ok(_) => Ok("Thread deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete thread: {}", e)),
    }
}

#[tauri::command]
async fn create_thread_message(
    request: CreateThreadMessageRequest,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.create_message(request).await {
        Ok(message) => Ok(serde_json::to_value(message).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create thread message: {}", e)),
    }
}

#[tauri::command]
async fn get_thread_messages(thread_id: String) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_messages(&thread_id).await {
        Ok(messages) => Ok(messages
            .into_iter()
            .map(|m| serde_json::to_value(m).unwrap_or_default())
            .collect()),
        Err(e) => Err(format!("Failed to get thread messages: {}", e)),
    }
}

#[tauri::command]
async fn get_thread_message(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.find_message_by_id(&id).await {
        Ok(message) => Ok(message.map(|m| serde_json::to_value(m).unwrap_or_default())),
        Err(e) => Err(format!("Failed to get thread message: {}", e)),
    }
}

#[tauri::command]
async fn update_thread_message(
    id: String,
    user_feedback: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.update_message(&id, user_feedback).await {
        Ok(message) => Ok(serde_json::to_value(message).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update thread message: {}", e)),
    }
}

#[tauri::command]
async fn delete_thread_message(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.delete_message(&id).await {
        Ok(_) => Ok("Thread message deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete thread message: {}", e)),
    }
}

#[tauri::command]
async fn get_thread_statistics() -> Result<ThreadStatistics, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = ThreadRepository::new(db);

    match repo.get_statistics().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get thread statistics: {}", e)),
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
async fn get_ai_interaction_log_stats() -> Result<AiLogStorageStats, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_log_storage_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => Err(format!("Failed to get AI interaction log stats: {}", e)),
    }
}

#[tauri::command]
async fn create_ai_interaction_log(
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // The frontend sends { request: data }, so we need to get the "request" field
    // But if that fails, the data might be at the top level (Tauri parameter handling)
    let request_data = if let Some(nested_request) = request.get("request") {
        nested_request
    } else {
        // Data is at the top level
        &request
    };

    // Convert to CreateAiInteractionLogRequest
    let log_request = CreateAiInteractionLogRequest {
        session_id: request_data
            .get("session_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        model_type: request_data
            .get("model_type")
            .and_then(|v| v.as_str())
            .unwrap_or("gemini")
            .to_string(),
        model_info: request_data
            .get("model_info")
            .cloned()
            .unwrap_or(serde_json::json!({})),
        user_message: request_data
            .get("user_message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        system_prompt: request_data
            .get("system_prompt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        context: request_data
            .get("context")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string(),
        ai_response: request_data
            .get("ai_response")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        actions: request_data
            .get("actions")
            .and_then(|v| v.as_str())
            .unwrap_or("[]")
            .to_string(),
        suggestions: request_data
            .get("suggestions")
            .and_then(|v| v.as_str())
            .unwrap_or("[]")
            .to_string(),
        reasoning: request_data
            .get("reasoning")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        response_time: request_data
            .get("response_time")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
        token_count: request_data.get("token_count").and_then(|v| v.as_i64()),
        error: request_data
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        error_code: request_data
            .get("error_code")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        contains_sensitive_data: request_data
            .get("contains_sensitive_data")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        data_classification: request_data
            .get("data_classification")
            .and_then(|v| v.as_str())
            .unwrap_or("internal")
            .to_string(),
    };

    match repo.create_interaction_log(log_request).await {
        Ok(interaction) => Ok(serde_json::to_value(interaction).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create AI interaction log: {}", e)),
    }
}

#[tauri::command]
async fn get_ai_interaction_logs(
    _filters: serde_json::Value,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Get all recent interactions and filter for AI logging interactions
    // AI logs have action_taken in format "{model_type}:{session_id}"
    match repo.get_recent_interactions(1000).await {
        Ok(interactions) => {
            println!(
                "🔍 Backend: Found {} total interactions",
                interactions.len()
            );

            // Debug: print all interactions to see what we have
            for (i, interaction) in interactions.iter().enumerate().take(5) {
                println!(
                    "🔍 Backend: Interaction {}: id={}, action_taken={:?}, message={}, response={}",
                    i,
                    interaction.id,
                    interaction.action_taken,
                    interaction.message.chars().take(50).collect::<String>(),
                    interaction.response.chars().take(50).collect::<String>()
                );
            }

            let ai_logs: Vec<serde_json::Value> = interactions
                .into_iter()
                .filter(|interaction| {
                    // Filter for AI logging interactions by checking action_taken pattern
                    let is_ai_log = interaction.action_taken.as_ref().map_or(false, |action| {
                        action.contains(':')
                            && (action.starts_with("local:") || action.starts_with("gemini:"))
                    });

                    if is_ai_log {
                        println!(
                            "🔍 Backend: Found AI log: id={}, action={:?}",
                            interaction.id, interaction.action_taken
                        );
                    }

                    is_ai_log
                })
                .map(|interaction| {
                    // Transform the data to match the expected AI log format
                    let mut log_data = serde_json::Map::new();
                    log_data.insert("id".to_string(), serde_json::Value::String(interaction.id));
                    log_data.insert(
                        "timestamp".to_string(),
                        serde_json::Value::String(interaction.created_at.to_rfc3339()),
                    );
                    log_data.insert(
                        "user_message".to_string(),
                        serde_json::Value::String(interaction.message),
                    );
                    log_data.insert(
                        "ai_response".to_string(),
                        serde_json::Value::String(interaction.response),
                    );

                    // Extract session_id and model_type from action_taken
                    if let Some(action) = &interaction.action_taken {
                        let parts: Vec<&str> = action.split(':').collect();
                        if parts.len() >= 2 {
                            log_data.insert(
                                "model_type".to_string(),
                                serde_json::Value::String(parts[0].to_string()),
                            );
                            log_data.insert(
                                "session_id".to_string(),
                                serde_json::Value::String(parts[1].to_string()),
                            );
                        }
                    }

                    // Add other fields with defaults
                    log_data.insert(
                        "model_info".to_string(),
                        serde_json::Value::String("{}".to_string()),
                    );
                    log_data.insert("system_prompt".to_string(), serde_json::Value::Null);
                    log_data.insert(
                        "context".to_string(),
                        serde_json::Value::String("{}".to_string()),
                    );
                    log_data.insert(
                        "actions".to_string(),
                        serde_json::Value::String(
                            interaction.tools_used.unwrap_or_else(|| "[]".to_string()),
                        ),
                    );
                    log_data.insert(
                        "suggestions".to_string(),
                        serde_json::Value::String("[]".to_string()),
                    );
                    log_data.insert(
                        "reasoning".to_string(),
                        serde_json::Value::String(
                            interaction.reasoning.unwrap_or_else(|| "".to_string()),
                        ),
                    );
                    log_data.insert(
                        "response_time".to_string(),
                        serde_json::Value::Number(serde_json::Number::from(1000)),
                    ); // Default 1000ms
                    log_data.insert("token_count".to_string(), serde_json::Value::Null);
                    log_data.insert("error".to_string(), serde_json::Value::Null);
                    log_data.insert("error_code".to_string(), serde_json::Value::Null);
                    log_data.insert(
                        "contains_sensitive_data".to_string(),
                        serde_json::Value::Bool(false),
                    );
                    log_data.insert(
                        "data_classification".to_string(),
                        serde_json::Value::String("public".to_string()),
                    );
                    log_data.insert(
                        "created_at".to_string(),
                        serde_json::Value::String(interaction.created_at.to_rfc3339()),
                    );
                    log_data.insert(
                        "updated_at".to_string(),
                        serde_json::Value::String(interaction.created_at.to_rfc3339()),
                    );

                    serde_json::Value::Object(log_data)
                })
                .collect();

            println!("🔍 Backend: Filtered to {} AI logs", ai_logs.len());
            Ok(ai_logs)
        }
        Err(e) => Err(format!("Failed to get AI interaction logs: {}", e)),
    }
}

#[tauri::command]
async fn get_ai_interaction_log(id: String) -> Result<Option<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Use the existing get_ai_interaction command logic
    match repo.find_by_id(&id).await {
        Ok(Some(interaction)) => Ok(Some(serde_json::to_value(interaction).unwrap_or_default())),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get AI interaction log: {}", e)),
    }
}

#[tauri::command]
async fn delete_ai_interaction_log(id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.delete_interaction(&id).await {
        Ok(_) => Ok("Log deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete AI interaction log: {}", e)),
    }
}

#[tauri::command]
async fn update_ai_interaction_log(
    id: String,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Extract the request data
    let request_data = request.get("request").ok_or("Missing request data")?;

    // Convert to UpdateAiInteractionLogRequest
    let update_request = UpdateAiInteractionLogRequest {
        ai_response: request_data
            .get("ai_response")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        actions: request_data
            .get("actions")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        suggestions: request_data
            .get("suggestions")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        reasoning: request_data
            .get("reasoning")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        response_time: request_data.get("response_time").and_then(|v| v.as_i64()),
        token_count: request_data.get("token_count").and_then(|v| v.as_i64()),
        error: request_data
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        error_code: request_data
            .get("error_code")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        contains_sensitive_data: request_data
            .get("contains_sensitive_data")
            .and_then(|v| v.as_bool()),
        data_classification: request_data
            .get("data_classification")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    match repo.update_interaction_log(&id, update_request).await {
        Ok(interaction) => Ok(serde_json::to_value(interaction).unwrap_or_default()),
        Err(e) => Err(format!("Failed to update AI interaction log: {}", e)),
    }
}

#[tauri::command]
async fn create_tool_execution_log(
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Extract the request data
    let request_data = request.get("request").ok_or("Missing request data")?;

    // Convert to CreateToolExecutionLogRequest
    let tool_request = CreateToolExecutionLogRequest {
        interaction_log_id: request_data
            .get("interaction_log_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        tool_name: request_data
            .get("tool_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        arguments: request_data
            .get("arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string(),
        result: request_data
            .get("result")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string(),
        execution_time: request_data
            .get("execution_time")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
        success: request_data
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        error: request_data
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    match repo.create_tool_execution_log(tool_request).await {
        Ok(log) => Ok(serde_json::to_value(log).unwrap_or_default()),
        Err(e) => Err(format!("Failed to create tool execution log: {}", e)),
    }
}

#[tauri::command]
async fn get_tool_execution_logs(
    interaction_log_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // For now, return empty array since we're storing tool executions as regular interactions
    // In a production system, you'd have a separate table for tool executions
    match repo.find_all(Some(100), None).await {
        Ok(interactions) => {
            let tool_logs: Vec<serde_json::Value> = interactions
                .into_iter()
                .filter(|i| {
                    i.action_taken.as_ref().map_or(false, |action| {
                        action.starts_with("tool_execution:")
                            && action.contains(&interaction_log_id)
                    })
                })
                .map(|i| serde_json::to_value(i).unwrap_or_default())
                .collect();
            Ok(tool_logs)
        }
        Err(e) => Err(format!("Failed to get tool execution logs: {}", e)),
    }
}

#[tauri::command]
async fn clear_all_ai_interaction_logs() -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.delete_all_interactions().await {
        Ok(deleted_count) => Ok(format!("Cleared {} AI interaction logs", deleted_count)),
        Err(e) => Err(format!("Failed to clear AI interaction logs: {}", e)),
    }
}

#[tauri::command]
async fn cleanup_old_ai_interaction_logs() -> Result<u64, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Clean up logs older than 30 days by default
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(30);

    match repo.clear_old_interactions(cutoff_date).await {
        Ok(deleted_count) => Ok(deleted_count),
        Err(e) => Err(format!("Failed to cleanup old AI interaction logs: {}", e)),
    }
}

#[tauri::command]
async fn export_ai_interaction_logs(
    _filters: serde_json::Value,
    format: String,
) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // For now, just export all recent interactions
    match repo.get_recent_interactions(1000).await {
        Ok(interactions) => {
            if format == "csv" {
                // Simple CSV export
                let mut csv = "id,timestamp,message,response,action_taken,reasoning\n".to_string();
                for interaction in interactions {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        interaction.id,
                        interaction.created_at.to_rfc3339(),
                        interaction.message.replace(',', ";").replace('\n', " "),
                        interaction.response.replace(',', ";").replace('\n', " "),
                        interaction
                            .action_taken
                            .unwrap_or_default()
                            .replace(',', ";"),
                        interaction
                            .reasoning
                            .unwrap_or_default()
                            .replace(',', ";")
                            .replace('\n', " ")
                    ));
                }
                Ok(csv)
            } else {
                // JSON export
                match serde_json::to_string_pretty(&interactions) {
                    Ok(json) => Ok(json),
                    Err(e) => Err(format!("Failed to serialize interactions to JSON: {}", e)),
                }
            }
        }
        Err(e) => Err(format!("Failed to export AI interaction logs: {}", e)),
    }
}

#[tauri::command]
async fn anonymize_ai_interaction_logs(log_ids: Vec<String>) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    let mut anonymized_count = 0;

    for log_id in log_ids {
        // Update the log to remove sensitive information
        let update_request = UpdateAiInteractionLogRequest {
            ai_response: Some("[ANONYMIZED]".to_string()),
            actions: Some("[]".to_string()),
            suggestions: Some("[]".to_string()),
            reasoning: Some("[ANONYMIZED]".to_string()),
            response_time: None,
            token_count: None,
            error: None,
            error_code: None,
            contains_sensitive_data: Some(false),
            data_classification: Some("public".to_string()),
        };

        match repo.update_interaction_log(&log_id, update_request).await {
            Ok(_) => anonymized_count += 1,
            Err(e) => {
                eprintln!("Failed to anonymize log {}: {}", log_id, e);
            }
        }
    }

    Ok(format!("Anonymized {} logs", anonymized_count))
}

#[tauri::command]
async fn redact_sensitive_data(log_id: String) -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Update the log to redact sensitive data
    let update_request = UpdateAiInteractionLogRequest {
        ai_response: None, // Keep response but mark as redacted
        actions: Some("[]".to_string()),
        suggestions: Some("[]".to_string()),
        reasoning: Some("[REDACTED]".to_string()),
        response_time: None,
        token_count: None,
        error: None,
        error_code: None,
        contains_sensitive_data: Some(false),
        data_classification: Some("internal".to_string()),
    };

    match repo.update_interaction_log(&log_id, update_request).await {
        Ok(_) => Ok("Sensitive data redacted successfully".to_string()),
        Err(e) => Err(format!("Failed to redact sensitive data: {}", e)),
    }
}

#[tauri::command]
async fn update_logging_config(config: serde_json::Value) -> Result<serde_json::Value, String> {
    // For now, just return the updated config
    // In a real implementation, this would update a settings table
    let updated_config = serde_json::json!({
        "enabled": config.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
        "log_level": config.get("log_level").and_then(|v| v.as_str()).unwrap_or("standard"),
        "retention_days": config.get("retention_days").and_then(|v| v.as_i64()).unwrap_or(30),
        "max_log_size": config.get("max_log_size").and_then(|v| v.as_i64()).unwrap_or(10485760),
        "max_log_count": config.get("max_log_count").and_then(|v| v.as_i64()).unwrap_or(10000),
        "include_system_prompts": config.get("include_system_prompts").and_then(|v| v.as_bool()).unwrap_or(true),
        "include_tool_executions": config.get("include_tool_executions").and_then(|v| v.as_bool()).unwrap_or(true),
        "include_performance_metrics": config.get("include_performance_metrics").and_then(|v| v.as_bool()).unwrap_or(true),
        "auto_cleanup": config.get("auto_cleanup").and_then(|v| v.as_bool()).unwrap_or(true),
        "export_format": config.get("export_format").and_then(|v| v.as_str()).unwrap_or("json")
    });

    Ok(updated_config)
}

#[tauri::command]
async fn get_logging_config() -> Result<serde_json::Value, String> {
    // For now, return a default configuration
    // In a real implementation, this would come from a settings table
    let default_config = serde_json::json!({
        "enabled": true,
        "log_level": "standard",
        "retention_days": 30,
        "max_log_size": 10485760,
        "max_log_count": 10000,
        "include_system_prompts": true,
        "include_tool_executions": true,
        "include_performance_metrics": true,
        "auto_cleanup": true,
        "export_format": "json"
    });

    Ok(default_config)
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
        Err(e) => Err(format!(
            "Failed to run post-migration initialization: {}",
            e
        )),
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
async fn move_task_to_list(
    task_id: String,
    task_list_id: String,
) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let task_repo = TaskRepository::new(db.clone());
    let task_list_repo = TaskListRepository::new(db);

    // Validate that the task list exists
    match task_list_repo.exists(&task_list_id).await {
        Ok(false) => return Err(format!("Task list with ID '{}' not found", task_list_id)),
        Err(e) => return Err(format!("Failed to validate task list: {}", e)),
        Ok(true) => {}
    }

    // Perform the move operation
    match task_repo.move_task_to_list(&task_id, &task_list_id).await {
        Ok(task) => Ok(serde_json::to_value(task).unwrap()),
        Err(e) => Err(format!(
            "Failed to move task '{}' to list '{}': {}",
            task_id, task_list_id, e
        )),
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
    // Initialize logging
    env_logger::init();

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
                    return;
                }

                // Generate pending periodic task instances on startup
                match get_database().await {
                    Ok(db) => {
                        let engine = TaskGenerationEngine::new(db);
                        match engine.check_and_generate_instances().await {
                            Ok(instances) => {
                                if !instances.is_empty() {
                                    println!("Generated {} periodic task instances on startup", instances.len());
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to generate periodic task instances on startup: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to get database connection for periodic task generation: {}", e);
                    }
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
            // Periodic Task Management Commands
            create_periodic_task_template,
            get_periodic_task_template,
            get_all_periodic_task_templates,
            get_active_periodic_task_templates,
            get_templates_needing_generation,
            update_periodic_task_template,
            delete_periodic_task_template,
            get_template_instances,
            count_template_instances,
            calculate_next_generation_date,
            get_periodic_task_stats,
            generate_pending_instances,
            generate_instance_from_template,
            check_and_generate_instances,
            // Thread Management Commands
            create_thread,
            get_thread,
            get_all_threads,
            get_threads_by_task,
            get_threads_by_date,
            update_thread,
            delete_thread,
            create_thread_message,
            get_thread_messages,
            get_thread_message,
            update_thread_message,
            delete_thread_message,
            get_thread_statistics,
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
            get_ai_interaction_log_stats,
            create_ai_interaction_log,
            update_ai_interaction_log,
            get_ai_interaction_logs,
            get_ai_interaction_log,
            delete_ai_interaction_log,
            create_tool_execution_log,
            get_tool_execution_logs,
            clear_all_ai_interaction_logs,
            cleanup_old_ai_interaction_logs,
            export_ai_interaction_logs,
            anonymize_ai_interaction_logs,
            redact_sensitive_data,
            get_logging_config,
            update_logging_config,
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
