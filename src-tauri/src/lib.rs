pub mod ai;
mod backup;
mod database;
pub mod llama;

use ai::{AIConfig, AIRequest, AIResponse, AIServiceManager, AIServiceStatus};
use backup::{BackupMetadata, BackupService};
use database::migration::initialization::DatabaseIntegrityReport;
use database::migration::{MigrationStatus, MigrationTestResult};
use database::repositories::{
    ai_repository::{
        AiLogStorageStats, AiStats, CreateAiInteractionLogRequest, CreateAiInteractionRequest,
        CreateToolExecutionLogRequest, ToolExecutionLogFilter, UpdateAiInteractionLogRequest,
        UpdateAiInteractionRequest,
    },
    task_list_repository::{CreateTaskListRequest, TaskListStats, UpdateTaskListRequest},
    task_repository::{CreateTaskRequest, TaskStats, UpdateTaskRequest},
    time_tracking_repository::{CreateTimeSessionRequest, TimeStats, UpdateTimeSessionRequest},
    AiRepository, TaskListRepository, TaskRepository, TimeTrackingRepository,
};
use database::{
    check_database_health, get_database, get_migration_status, initialize_database,
    run_post_migration_init, test_migration_compatibility, validate_db_integrity, DatabaseHealth,
};
use llama::error::LlamaError;
use llama::retry::{RetryConfig, RetryMechanism};
use llama::service::{GenerationOptions, ModelStatus};
use llama::{
    LlamaService, ModelManager, ModelMetadata, ResourceConfig, ResourceUsage, StorageInfo,
};
use std::sync::OnceLock;

// Global AI service manager instance
static AI_SERVICE: OnceLock<AIServiceManager> = OnceLock::new();

/// Initialize the AI service manager
async fn get_ai_service() -> Result<&'static AIServiceManager, String> {
    // Use get_or_init to handle race conditions properly
    let service = AI_SERVICE.get_or_init(|| {
        // This closure runs only once, even with multiple threads
        log::info!("🔧 [KIRAPILOT] Starting AI service initialization...");
        eprintln!("🔧 [KIRAPILOT] Starting AI service initialization...");

        // Initialize with default config
        let config = AIConfig::default();
        let service = AIServiceManager::new(config);
        log::info!("✓ [KIRAPILOT] Created AI service manager");
        eprintln!("✓ [KIRAPILOT] Created AI service manager");

        service
    });

    // Check if the service has been properly initialized
    // We need to do async initialization after the sync get_or_init
    static INIT_DONE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

    if !INIT_DONE.load(std::sync::atomic::Ordering::Acquire) {
        // Only one thread should do the async initialization
        static INIT_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
        let _guard = INIT_MUTEX.lock().await;

        // Double-check pattern
        if !INIT_DONE.load(std::sync::atomic::Ordering::Acquire) {
            log::info!("🔧 [KIRAPILOT] Starting async initialization...");
            eprintln!("🔧 [KIRAPILOT] Starting async initialization...");

            initialize_ai_service_async(service).await.map_err(|e| {
                log::error!("❌ [KIRAPILOT] Failed to initialize AI service: {}", e);
                eprintln!("❌ [KIRAPILOT] Failed to initialize AI service: {}", e);
                e
            })?;

            INIT_DONE.store(true, std::sync::atomic::Ordering::Release);
            log::info!("🎉 [KIRAPILOT] AI service initialization completed successfully!");
            eprintln!("🎉 [KIRAPILOT] AI service initialization completed successfully!");
        }
    }

    Ok(service)
}

/// Setup tool registry with database repositories
async fn setup_tool_registry(service: &AIServiceManager) -> Result<(), String> {
    // Get database connection
    let db = database::get_database()
        .await
        .map_err(|e| format!("Failed to get database connection: {}", e))?;

    // Create repositories
    let task_repo = TaskRepository::new(db.clone());
    let time_repo = TimeTrackingRepository::new(db);

    // Create tool registry with default permissions
    let permissions = crate::ai::tools::get_default_permissions();
    let tool_registry =
        crate::ai::tools::create_kirapilot_tool_registry(task_repo, time_repo, permissions);

    // Update the service with the tool registry
    let available_tools = tool_registry.get_available_tools();
    log::info!(
        "🔧 [KIRAPILOT] Tool registry created with {} tools: {:?}",
        available_tools.len(),
        available_tools
    );
    eprintln!(
        "🔧 [KIRAPILOT] Tool registry created with {} tools: {:?}",
        available_tools.len(),
        available_tools
    );

    // Set the tool registry in the service
    service.set_tool_registry(Arc::new(tool_registry)).await;

    Ok(())
}

/// Async initialization of the AI service
async fn initialize_ai_service_async(service: &AIServiceManager) -> Result<(), String> {
    log::info!("🔧 [KIRAPILOT] Initializing AI service manager...");
    eprintln!("🔧 [KIRAPILOT] Initializing AI service manager...");

    // Initialize the service
    service.initialize().await.map_err(|e| {
        let error_msg = format!("Failed to initialize AI service manager: {}", e);
        log::error!("❌ [KIRAPILOT] {}", error_msg);
        eprintln!("❌ [KIRAPILOT] {}", error_msg);
        error_msg
    })?;
    log::info!("✓ [KIRAPILOT] Initialized AI service manager");
    eprintln!("✓ [KIRAPILOT] Initialized AI service manager");

    // Register Gemini provider
    log::info!("🔧 [KIRAPILOT] Initializing Gemini provider...");
    eprintln!("🔧 [KIRAPILOT] Initializing Gemini provider...");
    let gemini_provider = ai::GeminiProvider::new(None); // API key will be set later via config
    let mut gemini_provider_boxed: Box<dyn ai::LLMProvider> = Box::new(gemini_provider);

    match gemini_provider_boxed.initialize().await {
        Ok(()) => {
            log::info!(
                "✓ [KIRAPILOT] Gemini provider initialized (may be unavailable without API key)"
            );
            eprintln!(
                "✓ [KIRAPILOT] Gemini provider initialized (may be unavailable without API key)"
            );
            service
                .register_provider("gemini".to_string(), gemini_provider_boxed)
                .await
                .map_err(|e| {
                    let error_msg = format!("Failed to register Gemini provider: {}", e);
                    log::error!("❌ [KIRAPILOT] {}", error_msg);
                    eprintln!("❌ [KIRAPILOT] {}", error_msg);
                    error_msg
                })?;
            log::info!("✓ [KIRAPILOT] Registered Gemini provider");
            eprintln!("✓ [KIRAPILOT] Registered Gemini provider");
        }
        Err(e) => {
            log::warn!("⚠️ [KIRAPILOT] Failed to initialize Gemini provider: {}. Continuing without Gemini support.", e);
            eprintln!("⚠️ [KIRAPILOT] Failed to initialize Gemini provider: {}. Continuing without Gemini support.", e);
            // Continue without registering Gemini provider
        }
    }

    // Try to register local provider, but don't fail completely if it doesn't work
    log::info!("🔧 [KIRAPILOT] Initializing Local provider (optional)...");
    eprintln!("🔧 [KIRAPILOT] Initializing Local provider (optional)...");
    let local_provider = ai::LocalProvider::new();
    let mut local_provider_boxed: Box<dyn ai::LLMProvider> = Box::new(local_provider);

    match local_provider_boxed.initialize().await {
        Ok(()) => {
            log::info!("✓ [KIRAPILOT] Local provider initialized successfully");
            eprintln!("✓ [KIRAPILOT] Local provider initialized successfully");
            match service
                .register_provider("local".to_string(), local_provider_boxed)
                .await
            {
                Ok(()) => {
                    log::info!("✓ [KIRAPILOT] Registered Local provider");
                    eprintln!("✓ [KIRAPILOT] Registered Local provider");
                }
                Err(e) => {
                    log::warn!("⚠️ [KIRAPILOT] Failed to register Local provider: {}. Continuing without local model support.", e);
                    eprintln!("⚠️ [KIRAPILOT] Failed to register Local provider: {}. Continuing without local model support.", e);
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ [KIRAPILOT] Local provider initialization failed: {}. Registering as unavailable provider for better error reporting.", e);
            eprintln!("⚠️ [KIRAPILOT] Local provider initialization failed: {}. Registering as unavailable provider for better error reporting.", e);

            // Still register the provider so it exists in the system, but it will report as unavailable
            // This allows the frontend to show proper error messages when user tries to switch to it
            match service
                .register_provider("local".to_string(), local_provider_boxed)
                .await
            {
                Ok(()) => {
                    log::info!("✓ [KIRAPILOT] Registered Local provider (unavailable)");
                    eprintln!("✓ [KIRAPILOT] Registered Local provider (unavailable)");
                }
                Err(e) => {
                    log::warn!("⚠️ [KIRAPILOT] Failed to register Local provider: {}. Continuing without local model support.", e);
                    eprintln!("⚠️ [KIRAPILOT] Failed to register Local provider: {}. Continuing without local model support.", e);
                }
            }
        }
    }

    // Start the AI service manager after all providers are registered
    log::info!("🔧 [KIRAPILOT] Starting AI service...");
    eprintln!("🔧 [KIRAPILOT] Starting AI service...");

    // Initialize the service (this will start health monitoring internally)
    service
        .initialize()
        .await
        .map_err(|e| {
            log::warn!("⚠️ [KIRAPILOT] Failed to start AI service: {}", e);
            eprintln!("⚠️ [KIRAPILOT] Failed to start AI service: {}", e);
            e.to_string()
        })
        .ok();

    // Give the service a moment to update provider statuses
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Initialize tool registry with database repositories
    log::info!("🔧 [KIRAPILOT] Setting up tool registry...");
    eprintln!("🔧 [KIRAPILOT] Setting up tool registry...");

    match setup_tool_registry(service).await {
        Ok(()) => {
            log::info!("✓ [KIRAPILOT] Tool registry initialized successfully");
            eprintln!("✓ [KIRAPILOT] Tool registry initialized successfully");
        }
        Err(e) => {
            log::warn!(
                "⚠️ [KIRAPILOT] Failed to setup tool registry: {}. AI will work without tools.",
                e
            );
            eprintln!(
                "⚠️ [KIRAPILOT] Failed to setup tool registry: {}. AI will work without tools.",
                e
            );
        }
    }

    // Check final status of providers
    let status = service.get_status().await;
    log::info!(
        "🔍 [KIRAPILOT] Final service status - Active: {}, Service Ready: {}",
        status.active_provider,
        status.service_ready
    );
    eprintln!(
        "🔍 [KIRAPILOT] Final service status - Active: {}, Service Ready: {}",
        status.active_provider, status.service_ready
    );

    for (name, provider_status) in &status.providers {
        log::info!("🔍 [KIRAPILOT] Provider '{}': {:?}", name, provider_status);
        eprintln!("🔍 [KIRAPILOT] Provider '{}': {:?}", name, provider_status);
    }

    Ok(())
}

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
async fn add_sample_tasks() -> Result<String, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let task_repo = TaskRepository::new(db);

    // Sample tasks to create
    let sample_tasks = vec![
        CreateTaskRequest {
            title: "Review code changes".to_string(),
            description: Some(
                "Review the latest pull request for the authentication module".to_string(),
            ),
            priority: 2,
            status: Some("pending".to_string()),
            order_num: None,
            time_estimate: Some(60),
            tags: Some(vec!["code-review".to_string(), "urgent".to_string()]),
            ..Default::default()
        },
        CreateTaskRequest {
            title: "Update documentation".to_string(),
            description: Some("Update the API documentation with new endpoints".to_string()),
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            time_estimate: Some(120),
            tags: Some(vec!["documentation".to_string(), "api".to_string()]),
            ..Default::default()
        },
        CreateTaskRequest {
            title: "Fix login bug".to_string(),
            description: Some(
                "Fix the issue where users can't login with special characters in password"
                    .to_string(),
            ),
            priority: 3,
            status: Some("in_progress".to_string()),
            order_num: None,
            time_estimate: Some(90),
            tags: Some(vec![
                "bug".to_string(),
                "authentication".to_string(),
                "urgent".to_string(),
            ]),
            ..Default::default()
        },
        CreateTaskRequest {
            title: "Plan team meeting".to_string(),
            description: Some("Schedule and plan the weekly team standup meeting".to_string()),
            priority: 1,
            status: Some("completed".to_string()),
            order_num: None,
            time_estimate: Some(30),
            tags: Some(vec!["meeting".to_string(), "planning".to_string()]),
            ..Default::default()
        },
    ];

    let mut created_count = 0;
    for task_request in sample_tasks {
        match task_repo.create_task(task_request).await {
            Ok(_) => created_count += 1,
            Err(e) => eprintln!("Failed to create sample task: {}", e),
        }
    }

    Ok(format!(
        "Successfully created {} sample tasks",
        created_count
    ))
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
async fn get_detailed_tool_execution_logs(
    filter: serde_json::Value,
) -> Result<Vec<serde_json::Value>, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    // Parse filter from JSON
    let filter_data = ToolExecutionLogFilter {
        session_id: filter
            .get("session_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        tool_name: filter
            .get("tool_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        success: filter.get("success").and_then(|v| v.as_bool()),
        performance_class: filter
            .get("performance_class")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        tool_category: filter
            .get("tool_category")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        start_time: filter
            .get("start_time")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        end_time: filter
            .get("end_time")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        limit: filter.get("limit").and_then(|v| v.as_u64()),
    };

    match repo.find_tool_execution_logs(filter_data).await {
        Ok(logs) => {
            let json_logs: Vec<serde_json::Value> = logs
                .into_iter()
                .map(|log| serde_json::to_value(log).unwrap_or_default())
                .collect();
            Ok(json_logs)
        }
        Err(e) => Err(format!("Failed to get detailed tool execution logs: {}", e)),
    }
}

#[tauri::command]
async fn get_session_tool_statistics(session_id: String) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_session_tool_stats(&session_id).await {
        Ok(stats) => Ok(serde_json::to_value(stats).unwrap_or_default()),
        Err(e) => Err(format!("Failed to get session tool statistics: {}", e)),
    }
}

#[tauri::command]
async fn get_tool_usage_analytics(analytics_type: String) -> Result<serde_json::Value, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    match repo.get_latest_tool_analytics(&analytics_type).await {
        Ok(Some(analytics)) => Ok(serde_json::to_value(analytics).unwrap_or_default()),
        Ok(None) => Ok(serde_json::Value::Null),
        Err(e) => Err(format!("Failed to get tool usage analytics: {}", e)),
    }
}

#[tauri::command]
async fn cleanup_old_tool_logs(days_old: u32) -> Result<u64, String> {
    let db = get_database()
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let repo = AiRepository::new(db);

    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days_old as i64);

    match repo.cleanup_old_tool_logs(cutoff_date).await {
        Ok(deleted_count) => Ok(deleted_count),
        Err(e) => Err(format!("Failed to cleanup old tool logs: {}", e)),
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
// AI Service Commands
// ============================================================================

#[tauri::command]
async fn process_ai_message(request: AIRequest) -> Result<AIResponse, serde_json::Value> {
    // Log the incoming request
    log::info!(
        "🤖 AI Request - Session: {}, Message length: {} chars",
        request.session_id.as_deref().unwrap_or("none"),
        request.message.len()
    );
    log::debug!("🤖 AI Request - Full message: {}", request.message);

    // Validate the request first
    if let Err(validation_error) = request.validate() {
        log::warn!("❌ AI Request validation failed: {:?}", validation_error);
        let error_response = ai::AIErrorResponse::from(validation_error);
        return Err(serde_json::to_value(error_response).unwrap_or_default());
    }

    let service = get_ai_service().await.map_err(|e| {
        log::error!("❌ AI Service unavailable: {}", e);
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    // Log the incoming request at Tauri command level
    println!("\n=== TAURI COMMAND: process_ai_message ===");
    println!("Request received at: {:?}", chrono::Utc::now());
    println!("Message length: {} chars", request.message.len());
    println!("Session ID: {:?}", request.session_id);
    println!(
        "Context keys: {:?}",
        request.context.keys().collect::<Vec<_>>()
    );
    println!("==========================================\n");

    let start_time = std::time::Instant::now();
    match service.process_message(request).await {
        Ok(response) => {
            let duration = start_time.elapsed();

            // Log the final response at Tauri command level
            println!("\n=== TAURI COMMAND RESPONSE ===");
            println!("Response completed at: {:?}", chrono::Utc::now());
            println!("Duration: {:?}", duration);
            println!("Response message length: {} chars", response.message.len());
            println!("Response message: {}", response.message);
            println!("Session ID: {}", response.session_id);
            println!("Model info: {:?}", response.model_info);
            println!("Metadata: {:?}", response.metadata);
            println!("===============================\n");

            log::info!(
                "✅ AI Response - Length: {} chars, Duration: {:?}",
                response.message.len(),
                duration
            );
            log::debug!("✅ AI Response - Full message: {}", response.message);
            Ok(response)
        }
        Err(e) => {
            let duration = start_time.elapsed();
            log::error!("❌ AI Processing failed after {:?}: {}", duration, e);
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn get_ai_model_status() -> Result<AIServiceStatus, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    Ok(service.get_status().await)
}

#[tauri::command]
async fn switch_ai_model(provider_name: String) -> Result<String, serde_json::Value> {
    // Validate provider name
    if provider_name.trim().is_empty() {
        let error_response = ai::AIErrorResponse {
            error_type: "invalid_request".to_string(),
            message: "Provider name cannot be empty".to_string(),
            code: Some("INVALID_REQUEST".to_string()),
            details: None,
        };
        return Err(serde_json::to_value(error_response).unwrap_or_default());
    }

    let valid_providers = ["gemini", "local"];
    if !valid_providers.contains(&provider_name.as_str()) {
        let error_response = ai::AIErrorResponse {
            error_type: "invalid_request".to_string(),
            message: format!(
                "Invalid provider '{}'. Valid options: {}",
                provider_name,
                valid_providers.join(", ")
            ),
            code: Some("INVALID_PROVIDER".to_string()),
            details: Some(serde_json::json!({
                "provided": provider_name,
                "valid_options": valid_providers
            })),
        };
        return Err(serde_json::to_value(error_response).unwrap_or_default());
    }

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.switch_provider(&provider_name).await {
        Ok(_) => Ok(format!(
            "Successfully switched to provider: {}",
            provider_name
        )),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn get_ai_model_info() -> Result<serde_json::Value, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.get_model_info().await {
        Ok(model_info) => Ok(serde_json::to_value(model_info).unwrap_or_default()),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn clear_ai_conversation(session_id: Option<String>) -> Result<String, serde_json::Value> {
    // Validate session_id if provided
    if let Some(ref id) = session_id {
        if id.trim().is_empty() {
            let error_response = ai::AIErrorResponse {
                error_type: "invalid_request".to_string(),
                message: "Session ID cannot be empty".to_string(),
                code: Some("INVALID_REQUEST".to_string()),
                details: None,
            };
            return Err(serde_json::to_value(error_response).unwrap_or_default());
        }

        if id.len() > 255 {
            let error_response = ai::AIErrorResponse {
                error_type: "invalid_request".to_string(),
                message: "Session ID too long (max 255 characters)".to_string(),
                code: Some("INVALID_REQUEST".to_string()),
                details: None,
            };
            return Err(serde_json::to_value(error_response).unwrap_or_default());
        }
    }

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match session_id {
        Some(id) => match service.clear_session(&id).await {
            Ok(_) => Ok(format!("Cleared session: {}", id)),
            Err(e) => {
                let error_response = ai::AIErrorResponse::from(e);
                Err(serde_json::to_value(error_response).unwrap_or_default())
            }
        },
        None => match service.clear_all_sessions().await {
            Ok(_) => Ok("Cleared all sessions".to_string()),
            Err(e) => {
                let error_response = ai::AIErrorResponse::from(e);
                Err(serde_json::to_value(error_response).unwrap_or_default())
            }
        },
    }
}

#[tauri::command]
async fn get_ai_interaction_logs_new(
    limit: Option<u64>,
) -> Result<Vec<serde_json::Value>, serde_json::Value> {
    // Validate limit parameter
    if let Some(limit_val) = limit {
        if limit_val == 0 {
            let error_response = ai::AIErrorResponse {
                error_type: "invalid_request".to_string(),
                message: "Limit must be greater than 0".to_string(),
                code: Some("INVALID_REQUEST".to_string()),
                details: None,
            };
            return Err(serde_json::to_value(error_response).unwrap_or_default());
        }

        if limit_val > 10000 {
            let error_response = ai::AIErrorResponse {
                error_type: "invalid_request".to_string(),
                message: "Limit too large (max 10,000)".to_string(),
                code: Some("INVALID_REQUEST".to_string()),
                details: None,
            };
            return Err(serde_json::to_value(error_response).unwrap_or_default());
        }
    }

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.get_interaction_logs(limit.unwrap_or(100)).await {
        Ok(logs) => Ok(logs
            .into_iter()
            .map(|log| serde_json::to_value(log).unwrap_or_default())
            .collect()),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn cleanup_old_ai_logs() -> Result<u64, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.cleanup_old_logs().await {
        Ok(count) => Ok(count),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn update_ai_logging_config(config: serde_json::Value) -> Result<String, serde_json::Value> {
    // Validate and parse the logging config from JSON
    let logging_config: ai::LoggingConfig = serde_json::from_value(config).map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "invalid_request".to_string(),
            message: format!("Invalid logging config: {}", e),
            code: Some("INVALID_CONFIG".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.update_logging_config(logging_config).await {
        Ok(_) => Ok("Logging configuration updated successfully".to_string()),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn get_ai_logging_config() -> Result<serde_json::Value, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    let config = service.get_logging_config().await;

    Ok(serde_json::to_value(config).unwrap_or_default())
}

// ============================================================================
// AI Provider Management Commands
// ============================================================================

#[tauri::command]
async fn configure_gemini_provider(api_key: String) -> Result<String, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.configure_gemini_api_key(api_key).await {
        Ok(_) => Ok("Gemini API key configured successfully".to_string()),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn update_provider_preferences(
    preferences: serde_json::Value,
) -> Result<String, serde_json::Value> {
    // Validate and parse the preferences from JSON
    let provider_preferences: ai::ProviderPreferences = serde_json::from_value(preferences)
        .map_err(|e| {
            let error_response = ai::AIErrorResponse {
                error_type: "invalid_request".to_string(),
                message: format!("Invalid provider preferences: {}", e),
                code: Some("INVALID_PREFERENCES".to_string()),
                details: None,
            };
            serde_json::to_value(error_response).unwrap_or_default()
        })?;

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service
        .update_provider_preferences(provider_preferences)
        .await
    {
        Ok(_) => Ok("Provider preferences updated successfully".to_string()),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn get_provider_preferences() -> Result<serde_json::Value, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    let preferences = service.get_provider_preferences().await;
    Ok(serde_json::to_value(preferences).unwrap_or_default())
}

#[tauri::command]
async fn attempt_provider_failover() -> Result<String, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    match service.attempt_failover().await {
        Ok(new_provider) => Ok(format!(
            "Failover successful - switched to provider: {}",
            new_provider
        )),
        Err(e) => {
            let error_response = ai::AIErrorResponse::from(e);
            Err(serde_json::to_value(error_response).unwrap_or_default())
        }
    }
}

#[tauri::command]
async fn get_provider_health(
    provider_name: String,
) -> Result<Option<serde_json::Value>, serde_json::Value> {
    // Validate provider name
    if provider_name.trim().is_empty() {
        let error_response = ai::AIErrorResponse {
            error_type: "invalid_request".to_string(),
            message: "Provider name cannot be empty".to_string(),
            code: Some("INVALID_REQUEST".to_string()),
            details: None,
        };
        return Err(serde_json::to_value(error_response).unwrap_or_default());
    }

    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    let health = service.get_provider_health(&provider_name).await;
    Ok(health.map(|h| serde_json::to_value(h).unwrap_or_default()))
}

#[tauri::command]
async fn get_all_provider_health() -> Result<serde_json::Value, serde_json::Value> {
    let service = get_ai_service().await.map_err(|e| {
        let error_response = ai::AIErrorResponse {
            error_type: "service_unavailable".to_string(),
            message: format!("AI service unavailable: {}", e),
            code: Some("SERVICE_UNAVAILABLE".to_string()),
            details: None,
        };
        serde_json::to_value(error_response).unwrap_or_default()
    })?;

    let health_status = service.get_all_provider_health().await;
    Ok(serde_json::to_value(health_status).unwrap_or_default())
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

// ============================================================================
// Local AI Model Commands
// ============================================================================

use std::sync::Arc;
use tokio::sync::Mutex;

use crate::llama::service::ModelInfo;

// Global service instances for better resource management
static LLAMA_SERVICE: OnceLock<Arc<Mutex<Option<LlamaService>>>> = OnceLock::new();
static MODEL_MANAGER: OnceLock<Arc<Mutex<Option<ModelManager>>>> = OnceLock::new();

fn get_llama_service() -> &'static Arc<Mutex<Option<LlamaService>>> {
    LLAMA_SERVICE.get_or_init(|| Arc::new(Mutex::new(None)))
}

fn get_model_manager() -> &'static Arc<Mutex<Option<ModelManager>>> {
    MODEL_MANAGER.get_or_init(|| Arc::new(Mutex::new(None)))
}

// Enhanced Model Management Commands

#[tauri::command]
async fn download_model_with_progress(repo: String, filename: String) -> Result<String, String> {
    log::info!(
        "Starting enhanced model download: {} from {}",
        filename,
        repo
    );

    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    // Initialize manager if not already done
    if manager_guard.is_none() {
        let manager = ModelManager::new()
            .map_err(|e| format!("Failed to initialize model manager: {}", e))?;
        *manager_guard = Some(manager);
    }

    let manager = manager_guard.as_mut().unwrap();

    // TODO: Set up progress callback for real-time updates
    // This would require a more sophisticated callback mechanism

    let model_path = manager
        .download_model_with_progress(&repo, &filename)
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;

    log::info!("Model downloaded successfully to: {:?}", model_path);
    Ok(model_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_cached_models() -> Result<Vec<ModelMetadata>, String> {
    log::debug!("Getting list of cached models");

    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    // Initialize manager if not already done
    if manager_guard.is_none() {
        let manager = ModelManager::new()
            .map_err(|e| format!("Failed to initialize model manager: {}", e))?;
        *manager_guard = Some(manager);
    }

    let manager = manager_guard.as_ref().unwrap();

    let models = manager
        .list_cached_models()
        .await
        .map_err(|e| format!("Failed to list cached models: {}", e))?;

    log::debug!("Found {} cached models", models.len());
    Ok(models)
}

#[tauri::command]
async fn get_storage_info() -> Result<StorageInfo, String> {
    log::debug!("Getting storage information");

    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    // Initialize manager if not already done
    if manager_guard.is_none() {
        let manager = ModelManager::new()
            .map_err(|e| format!("Failed to initialize model manager: {}", e))?;
        *manager_guard = Some(manager);
    }

    let manager = manager_guard.as_ref().unwrap();

    let storage_info = manager
        .get_storage_info()
        .await
        .map_err(|e| format!("Failed to get storage info: {}", e))?;

    Ok(storage_info)
}

#[tauri::command]
async fn cleanup_old_models(
    max_age_days: u64,
    max_unused_models: usize,
) -> Result<Vec<String>, String> {
    log::info!(
        "Starting model cleanup: max_age_days={}, max_unused_models={}",
        max_age_days,
        max_unused_models
    );

    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    // Initialize manager if not already done
    if manager_guard.is_none() {
        let manager = ModelManager::new()
            .map_err(|e| format!("Failed to initialize model manager: {}", e))?;
        *manager_guard = Some(manager);
    }

    let manager = manager_guard.as_ref().unwrap();

    let cleaned_models = manager
        .cleanup_old_models(max_age_days, max_unused_models)
        .await
        .map_err(|e| format!("Failed to cleanup models: {}", e))?;

    log::info!(
        "Model cleanup completed, removed {} models",
        cleaned_models.len()
    );
    Ok(cleaned_models)
}

#[tauri::command]
async fn verify_model_integrity(model_path: String) -> Result<bool, String> {
    log::debug!("Verifying model integrity: {}", model_path);

    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    // Initialize manager if not already done
    if manager_guard.is_none() {
        let manager = ModelManager::new()
            .map_err(|e| format!("Failed to initialize model manager: {}", e))?;
        *manager_guard = Some(manager);
    }

    let _manager = manager_guard.as_ref().unwrap();

    let path = std::path::Path::new(&model_path);

    // Get metadata first - need to make this method public
    // For now, we'll do a basic file existence and size check
    if !path.exists() {
        return Ok(false);
    }

    let file_metadata =
        std::fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    // Basic integrity check - file exists and has content
    let is_valid = file_metadata.len() > 0;

    log::debug!("Model integrity check result: {}", is_valid);
    Ok(is_valid)
}

// ============================================================================
// Enhanced Error Handling and Diagnostics Commands
// ============================================================================

#[tauri::command]
async fn get_error_diagnostics() -> Result<serde_json::Value, String> {
    log::debug!("Getting error diagnostics");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    let mut diagnostics = serde_json::json!({
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "service_available": service_guard.is_some(),
        "model_ready": false,
        "recent_errors": [],
        "performance_metrics": {},
        "system_health": "unknown"
    });

    if let Some(service) = service_guard.as_ref() {
        diagnostics["model_ready"] = serde_json::Value::Bool(service.is_ready());

        // Get resource usage if available
        if let Some(usage) = service.get_resource_usage().await {
            diagnostics["performance_metrics"] = serde_json::to_value(usage).unwrap_or_default();
        }

        // Get performance recommendations
        let recommendations = service.get_performance_recommendations().await;
        diagnostics["recommendations"] = serde_json::Value::Array(
            recommendations
                .into_iter()
                .map(serde_json::Value::String)
                .collect(),
        );

        // Determine system health
        let status = service.get_status();
        let health = if status.is_loaded && status.is_available {
            "healthy"
        } else if status.error_message.is_some() {
            "error"
        } else {
            "initializing"
        };
        diagnostics["system_health"] = serde_json::Value::String(health.to_string());
    }

    Ok(diagnostics)
}

#[tauri::command]
async fn get_error_recovery_suggestions(error_message: String) -> Result<Vec<String>, String> {
    log::debug!("Getting recovery suggestions for error: {}", error_message);

    // Analyze error message and provide contextual suggestions
    let error_lower = error_message.to_lowercase();
    let mut suggestions = Vec::new();

    if error_lower.contains("network") || error_lower.contains("download") {
        suggestions.extend(vec![
            "Check your internet connection".to_string(),
            "Try again in a few minutes".to_string(),
            "Use cloud model while troubleshooting".to_string(),
        ]);
    } else if error_lower.contains("memory") || error_lower.contains("resource") {
        suggestions.extend(vec![
            "Close other applications to free memory".to_string(),
            "Switch to cloud model".to_string(),
            "Reduce model context size in settings".to_string(),
        ]);
    } else if error_lower.contains("model") || error_lower.contains("load") {
        suggestions.extend(vec![
            "Re-download the model file".to_string(),
            "Check available disk space".to_string(),
            "Restart the application".to_string(),
            "Switch to cloud model".to_string(),
        ]);
    } else if error_lower.contains("generation") || error_lower.contains("inference") {
        suggestions.extend(vec![
            "Try rephrasing your message".to_string(),
            "Restart the conversation".to_string(),
            "Switch to cloud model".to_string(),
        ]);
    } else {
        suggestions.extend(vec![
            "Restart the application".to_string(),
            "Switch to cloud model".to_string(),
            "Check system resources".to_string(),
        ]);
    }

    Ok(suggestions)
}

#[tauri::command]
async fn test_model_health() -> Result<serde_json::Value, String> {
    log::info!("Running model health test");

    let mut health_report = serde_json::json!({
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "overall_health": "unknown",
        "tests": {}
    });

    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    // Test 1: Service availability
    let service_available = service_guard.is_some();
    health_report["tests"]["service_available"] = serde_json::json!({
        "passed": service_available,
        "message": if service_available { "Service is available" } else { "Service not initialized" }
    });

    if let Some(service) = service_guard.as_mut() {
        // Test 2: Model readiness
        let model_ready = service.is_ready();
        health_report["tests"]["model_ready"] = serde_json::json!({
            "passed": model_ready,
            "message": if model_ready { "Model is loaded and ready" } else { "Model not loaded" }
        });

        // Test 3: Basic generation (if model is ready)
        if model_ready {
            let test_prompt = "Hello";
            let test_options = GenerationOptions {
                max_tokens: Some(10),
                temperature: Some(0.7),
                ..Default::default()
            };

            match service.generate(test_prompt, test_options).await {
                Ok(response) => {
                    health_report["tests"]["generation_test"] = serde_json::json!({
                        "passed": true,
                        "message": "Generation test successful",
                        "response_length": response.len()
                    });
                }
                Err(e) => {
                    health_report["tests"]["generation_test"] = serde_json::json!({
                        "passed": false,
                        "message": format!("Generation test failed: {}", e),
                        "error_type": e.to_string()
                    });
                }
            }
        }

        // Test 4: Resource usage
        if let Some(usage) = service.get_resource_usage().await {
            let memory_ok = usage.memory_usage_mb < 2048; // Less than 2GB
            let cpu_ok = usage.cpu_usage_percent < 90.0;

            health_report["tests"]["resource_usage"] = serde_json::json!({
                "passed": memory_ok && cpu_ok,
                "message": format!("Memory: {}MB, CPU: {}%", usage.memory_usage_mb, usage.cpu_usage_percent),
                "memory_usage_mb": usage.memory_usage_mb,
                "cpu_usage_percent": usage.cpu_usage_percent
            });
        }
    }

    // Determine overall health
    let tests = health_report["tests"].as_object().unwrap();
    let all_passed = tests.values().all(|test| {
        test.get("passed")
            .and_then(|p| p.as_bool())
            .unwrap_or(false)
    });

    health_report["overall_health"] =
        serde_json::Value::String(if all_passed { "healthy" } else { "unhealthy" }.to_string());

    Ok(health_report)
}

#[tauri::command]
async fn force_model_recovery() -> Result<String, String> {
    log::info!("Forcing model recovery");

    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    // Clean up existing service
    if let Some(mut service) = service_guard.take() {
        log::info!("Cleaning up existing service");
        service.cleanup().await;
    }

    // Create new service instance
    let new_service = LlamaService::new()
        .map_err(|e| format!("Failed to create new service during recovery: {}", e))?;

    *service_guard = Some(new_service);

    log::info!("Model recovery completed - new service instance created");
    Ok("Model recovery completed successfully. Please reinitialize the model.".to_string())
}

#[tauri::command]
async fn get_fallback_status() -> Result<serde_json::Value, String> {
    log::debug!("Getting fallback status");

    // This would typically check if Gemini API is available as fallback
    // For now, we'll return a basic status
    Ok(serde_json::json!({
        "fallback_available": true,
        "fallback_type": "gemini_api",
        "auto_fallback_enabled": true,
        "last_fallback_time": null,
        "fallback_success_rate": 95.0
    }))
}

// ============================================================================
// Enhanced Local AI Model Commands
// ============================================================================

#[tauri::command]
async fn initialize_local_model() -> Result<String, String> {
    log::info!("Initializing local model with enhanced error handling");

    // Create retry mechanism for initialization
    let retry_config = RetryConfig::for_model_loading();
    let retry_mechanism = RetryMechanism::new(retry_config);

    retry_mechanism
        .execute(|| async {
            let service_mutex = get_llama_service();
            let mut service_guard = service_mutex.lock().await;

            // Create a new service instance if not already created
            if service_guard.is_none() {
                let service = LlamaService::new().map_err(|e| {
                    log::error!("Failed to create LlamaService: {}", e);
                    match e {
                        LlamaError::InitializationError(_) => e,
                        _ => LlamaError::InitializationError(format!(
                            "Service creation failed: {}",
                            e
                        )),
                    }
                })?;
                *service_guard = Some(service);
            }

            let service = service_guard.as_mut().unwrap();

            // Check if model is already loaded
            if service.is_ready() {
                log::info!("Local model already initialized");
                return Ok("Local model already initialized".to_string());
            }

            // Download the model if not already present with retry
            let model_path = service
                .download_model(
                    "unsloth/gemma-3n-E4B-it-GGUF",
                    "gemma-3-270m-it-Q4_K_M.gguf",
                )
                .await
                .map_err(|e| {
                    log::error!("Model download failed: {}", e);
                    e
                })?;

            // Load the model with validation
            service.load_model(model_path).await.map_err(|e| {
                log::error!("Model loading failed: {}", e);
                e
            })?;

            // Verify model is actually ready
            if !service.is_ready() {
                return Err(LlamaError::InitializationError(
                    "Model loaded but not ready for inference".to_string(),
                ));
            }

            log::info!("Local model initialized successfully");
            Ok("Local model initialized successfully".to_string())
        })
        .await
        .map_err(|e| {
            let user_message = e.user_message();
            let suggestions = e.recovery_suggestions().join("; ");
            format!("{} Suggestions: {}", user_message, suggestions)
        })
}

#[tauri::command]
async fn download_model(repo: String, model: String) -> Result<String, String> {
    log::info!("Downloading model {} from {} (legacy command)", model, repo);

    // Validate input parameters
    if repo.is_empty() || model.is_empty() {
        return Err("Repository and model name cannot be empty".to_string());
    }

    // Try to use the enhanced model manager first
    let manager_mutex = get_model_manager();
    let mut manager_guard = manager_mutex.lock().await;

    if manager_guard.is_none() {
        if let Ok(manager) = ModelManager::new() {
            *manager_guard = Some(manager);
        }
    }

    if let Some(manager) = manager_guard.as_mut() {
        // Use enhanced model manager
        match manager.download_model_with_progress(&repo, &model).await {
            Ok(path) => {
                log::info!(
                    "Model downloaded via enhanced manager to: {}",
                    path.display()
                );
                return Ok(path.to_string_lossy().to_string());
            }
            Err(e) => {
                log::warn!(
                    "Enhanced download failed, falling back to legacy method: {}",
                    e
                );
            }
        }
    }

    // Fallback to legacy method
    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    // Create service if not exists
    if service_guard.is_none() {
        let service =
            LlamaService::new().map_err(|e| format!("Failed to create service: {}", e))?;
        *service_guard = Some(service);
    }

    let service = service_guard.as_mut().unwrap();

    let path = service
        .download_model(&repo, &model)
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;

    log::info!("Model downloaded via legacy method to: {}", path.display());
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn generate_text(
    prompt: String,
    max_tokens: Option<i32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    // Log the generation request
    log::info!(
        "🧠 Local AI Generation - Prompt length: {} chars, max_tokens: {:?}, temperature: {:?}",
        prompt.len(),
        max_tokens,
        temperature
    );
    log::debug!("🧠 Local AI Prompt: {}", prompt);

    // Enhanced input validation
    if prompt.is_empty() {
        log::warn!("❌ Local AI Generation failed: Empty prompt");
        return Err("Prompt cannot be empty".to_string());
    }

    if prompt.len() > 8192 {
        log::warn!(
            "❌ Local AI Generation failed: Prompt too long ({} chars)",
            prompt.len()
        );
        return Err("Prompt too long (maximum 8192 characters)".to_string());
    }

    if let Some(tokens) = max_tokens {
        if tokens <= 0 || tokens > 4096 {
            log::warn!(
                "❌ Local AI Generation failed: Invalid max_tokens ({})",
                tokens
            );
            return Err("max_tokens must be between 1 and 4096".to_string());
        }
    }

    if let Some(temp) = temperature {
        if temp < 0.0 || temp > 2.0 {
            log::warn!(
                "❌ Local AI Generation failed: Invalid temperature ({})",
                temp
            );
            return Err("temperature must be between 0.0 and 2.0".to_string());
        }
    }

    // Direct generation without retry mechanism for better performance
    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    // Ensure service exists and model is loaded
    if service_guard.is_none() {
        log::error!("❌ Local AI Generation failed: Model not initialized");
        return Err("Model not initialized. Please initialize the model first.".to_string());
    }

    let service = service_guard.as_mut().unwrap();

    if !service.is_ready() {
        log::error!("❌ Local AI Generation failed: Model not loaded");
        return Err("Model not loaded. Please initialize the model first.".to_string());
    }

    let options = GenerationOptions {
        max_tokens,
        temperature,
        ..Default::default()
    };

    // Generate with comprehensive logging
    let start_time = std::time::Instant::now();
    match service.generate(&prompt, options).await {
        Ok(response) => {
            let duration = start_time.elapsed();
            log::info!(
                "✅ Local AI Generation successful - Response length: {} chars, Duration: {:?}",
                response.len(),
                duration
            );
            log::debug!("✅ Local AI Response: {}", response);
            Ok(response)
        }
        Err(e) => {
            let duration = start_time.elapsed();
            log::error!("❌ Local AI Generation failed after {:?}: {}", duration, e);
            Err(e.user_message())
        }
    }
}

#[tauri::command]
async fn get_model_status() -> Result<ModelStatus, String> {
    log::debug!("Getting model status");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    match service_guard.as_ref() {
        Some(service) => {
            let mut status = service.get_status();

            // Check if model file exists
            let model_path = std::env::temp_dir()
                .join("models")
                .join("gemma-3-270m-it-Q4_K_M.gguf");
            if model_path.exists() {
                status.model_path = Some(model_path.to_string_lossy().to_string());

                // Get file size
                if let Ok(metadata) = std::fs::metadata(&model_path) {
                    if let Some(ref mut model_info) = status.model_info {
                        model_info.size_mb = metadata.len() / (1024 * 1024);
                    }
                }
            }

            Ok(status)
        }
        None => {
            // Service not created yet, check if model file exists
            let model_path = std::env::temp_dir()
                .join("models")
                .join("gemma-3-270m-it-Q4_K_M.gguf");
            let model_exists = model_path.exists();

            Ok(ModelStatus {
                is_available: true,
                is_loaded: false,
                model_path: if model_exists {
                    Some(model_path.to_string_lossy().to_string())
                } else {
                    None
                },
                download_progress: None,
                error_message: None,
                model_info: if model_exists {
                    let size_mb = std::fs::metadata(&model_path)
                        .map(|m| m.len() / (1024 * 1024))
                        .unwrap_or(0);

                    Some(ModelInfo {
                        name: "gemma-3-270m-it-Q4_K_M".to_string(),
                        size_mb,
                        context_size: 2048,
                        parameter_count: "3B".to_string(),
                    })
                } else {
                    None
                },
            })
        }
    }
}

#[tauri::command]
async fn cleanup_model() -> Result<String, String> {
    log::info!("Cleaning up local model");

    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    // Clean up the service
    if let Some(service) = service_guard.as_mut() {
        service.cleanup().await;
    }

    // Reset the service
    *service_guard = None;

    log::info!("Model cleaned up successfully");
    Ok("Model cleaned up successfully".to_string())
}

#[tauri::command]
async fn update_resource_config(config: ResourceConfig) -> Result<String, String> {
    log::info!("Updating resource configuration");

    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_mut() {
        service
            .update_resource_config(config)
            .await
            .map_err(|e| format!("Failed to update resource config: {}", e))?;

        log::info!("Resource configuration updated successfully");
        Ok("Resource configuration updated successfully".to_string())
    } else {
        Err("Local model service not initialized".to_string())
    }
}

#[tauri::command]
async fn get_resource_usage() -> Result<Option<ResourceUsage>, String> {
    log::debug!("Getting resource usage statistics");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_ref() {
        let usage = service.get_resource_usage().await;
        log::debug!("Resource usage retrieved successfully");
        Ok(usage)
    } else {
        log::warn!("Local model service not initialized for resource usage");
        Ok(None)
    }
}

#[tauri::command]
async fn get_performance_recommendations() -> Result<Vec<String>, String> {
    log::debug!("Getting performance recommendations");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_ref() {
        let recommendations = service.get_performance_recommendations().await;
        log::debug!(
            "Performance recommendations retrieved: {} items",
            recommendations.len()
        );
        Ok(recommendations)
    } else {
        log::warn!("Local model service not initialized for performance recommendations");
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn start_resource_monitoring() -> Result<String, String> {
    log::info!("Starting resource monitoring");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_ref() {
        service
            .start_resource_monitoring()
            .await
            .map_err(|e| format!("Failed to start resource monitoring: {}", e))?;

        log::info!("Resource monitoring started successfully");
        Ok("Resource monitoring started successfully".to_string())
    } else {
        Err("Local model service not initialized".to_string())
    }
}

#[tauri::command]
async fn cleanup_resources() -> Result<String, String> {
    log::info!("Cleaning up resources");

    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_ref() {
        service
            .cleanup_resources()
            .await
            .map_err(|e| format!("Failed to cleanup resources: {}", e))?;

        log::info!("Resources cleaned up successfully");
        Ok("Resources cleaned up successfully".to_string())
    } else {
        Err("Local model service not initialized".to_string())
    }
}

#[tauri::command]
async fn configure_optimal_resources() -> Result<String, String> {
    log::info!("Configuring optimal resources");

    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;

    if let Some(service) = service_guard.as_mut() {
        service
            .configure_optimal_resources()
            .await
            .map_err(|e| format!("Failed to configure optimal resources: {}", e))?;

        log::info!("Optimal resources configured successfully");
        Ok("Optimal resources configured successfully".to_string())
    } else {
        Err("Local model service not initialized".to_string())
    }
}

// ============================================================================
// Model Selection and Management Commands
// ============================================================================

// Available models configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AvailableModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repo: String,
    pub filename: String,
    pub size_mb: u64,
    pub parameter_count: String,
    pub quantization: String,
}

#[tauri::command]
async fn get_available_models() -> Result<Vec<AvailableModel>, String> {
    let models = vec![
        AvailableModel {
            id: "gemma-3-270m-q4".to_string(),
            name: "Gemma 3B 270M (Q4_K_M)".to_string(),
            description: "Higher quality, larger size, slower inference".to_string(),
            repo: "unsloth/gemma-3n-E4B-it-GGUF".to_string(),
            filename: "gemma-3-270m-it-Q4_K_M.gguf".to_string(),
            size_mb: 253,
            parameter_count: "270M".to_string(),
            quantization: "Q4_K_M".to_string(),
        },
        AvailableModel {
            id: "gemma-3-270m-q3".to_string(),
            name: "Gemma 3B 270M (Q3_K_M)".to_string(),
            description: "Faster inference, smaller size, slightly lower quality".to_string(),
            repo: "unsloth/gemma-3n-E4B-it-GGUF".to_string(),
            filename: "gemma-3n-E4B-it-Q3_K_M.gguf".to_string(),
            size_mb: 180,
            parameter_count: "270M".to_string(),
            quantization: "Q3_K_M".to_string(),
        },
        AvailableModel {
            id: "gemma-3n-e2b-q8".to_string(),
            name: "Gemma 3N E2B (Q8_0)".to_string(),
            description: "Highest quality, largest size, best accuracy".to_string(),
            repo: "ggml-org/gemma-3n-E2B-it-GGUF".to_string(),
            filename: "gemma-3n-E2B-it-Q8_0.gguf".to_string(),
            size_mb: 450,
            parameter_count: "3B".to_string(),
            quantization: "Q8_0".to_string(),
        },
        AvailableModel {
            id: "gemma-3-1b-q4".to_string(),
            name: "Gemma 3 1B (Q4_K_M)".to_string(),
            description: "Smallest size, fastest inference, good for low-resource devices".to_string(),
            repo: "ggml-org/gemma-3-1b-it-GGUF".to_string(),
            filename: "gemma-3-1b-it-Q4_K_M.gguf".to_string(),
            size_mb: 700,
            parameter_count: "1B".to_string(),
            quantization: "Q4_K_M".to_string(),
        },
    ];
    Ok(models)
}

#[tauri::command]
async fn switch_local_model(model_id: String) -> Result<String, String> {
    log::info!("Switching to local model: {}", model_id);
    
    let models = get_available_models().await?;
    let selected_model = models.iter().find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model with id '{}' not found", model_id))?;
    
    // Get the llama service
    let service_mutex = get_llama_service();
    let mut service_guard = service_mutex.lock().await;
    
    // Create service if not exists
    if service_guard.is_none() {
        let service = LlamaService::new().map_err(|e| {
            log::error!("Failed to create LlamaService: {}", e);
            format!("Failed to create LlamaService: {}", e)
        })?;
        *service_guard = Some(service);
    }
    
    let service = service_guard.as_mut().unwrap();
    
    // Download the selected model if not already present
    let model_path = service
        .download_model(&selected_model.repo, &selected_model.filename)
        .await
        .map_err(|e| {
            log::error!("Model download failed: {}", e);
            format!("Model download failed: {}", e)
        })?;
    
    // Load the model
    service.load_model(model_path).await.map_err(|e| {
        log::error!("Model loading failed: {}", e);
        format!("Model loading failed: {}", e)
    })?;
    
    log::info!("Successfully switched to model: {}", selected_model.name);
    Ok(format!("Successfully switched to {}", selected_model.name))
}

#[tauri::command]
async fn get_current_model_info() -> Result<Option<AvailableModel>, String> {
    let service_mutex = get_llama_service();
    let service_guard = service_mutex.lock().await;
    
    if let Some(service) = service_guard.as_ref() {
        let status = service.get_status();
        if status.is_loaded {
            // Try to match current model with available models
            let models = get_available_models().await?;
            if let Some(model_path) = status.model_path {
                for model in models {
                    if model_path.contains(&model.filename) {
                        return Ok(Some(model));
                    }
                }
            }
        }
    }
    
    Ok(None)
}

#[tauri::command]
async fn reload_ai_service() -> Result<String, String> {
    log::info!("Reloading AI service to pick up model changes");
    
    // Force restart the AI service to pick up new model
    // This is a simple way to ensure the AI service reloads the current model
    if let Ok(ai_service) = get_ai_service().await {
        // Try to process a simple message to force service refresh
        let test_request = AIRequest {
            message: "test".to_string(),
            session_id: None,
            model_preference: None,
            context: std::collections::HashMap::new(),
        };
        
        // This will initialize providers if needed
        match ai_service.process_message(test_request).await {
            Ok(_) => {
                log::info!("AI service successfully reloaded");
                Ok("AI service reloaded successfully".to_string())
            }
            Err(e) => {
                log::warn!("AI service reload had issues but may still work: {}", e);
                Ok("AI service reload completed with warnings".to_string())
            }
        }
    } else {
        Err("Failed to get AI service".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging with reduced verbosity for llama-cpp
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info) // Default level
        .filter_module("llama_cpp_2", log::LevelFilter::Warn) // Reduce llama-cpp verbosity
        .filter_module("kirapilot_app::llama", log::LevelFilter::Info) // Our llama service
        .filter_module("kirapilot_app::ai", log::LevelFilter::Info) // Our AI modules
        .init();

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
            add_sample_tasks,
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
            get_detailed_tool_execution_logs,
            get_session_tool_statistics,
            get_tool_usage_analytics,
            cleanup_old_tool_logs,
            clear_all_ai_interaction_logs,
            cleanup_old_ai_interaction_logs,
            export_ai_interaction_logs,
            anonymize_ai_interaction_logs,
            redact_sensitive_data,
            get_logging_config,
            update_logging_config,
            clear_all_data,
            // AI Service Commands
            process_ai_message,
            get_ai_model_status,
            switch_ai_model,
            get_ai_model_info,
            clear_ai_conversation,
            get_ai_interaction_logs_new,
            cleanup_old_ai_logs,
            update_ai_logging_config,
            get_ai_logging_config,
            // AI Provider Management Commands
            configure_gemini_provider,
            update_provider_preferences,
            get_provider_preferences,
            attempt_provider_failover,
            get_provider_health,
            get_all_provider_health,
            // Enhanced Error Handling and Diagnostics Commands
            get_error_diagnostics,
            get_error_recovery_suggestions,
            test_model_health,
            force_model_recovery,
            get_fallback_status,
            // Local AI Model Commands
            download_model_with_progress,
            get_cached_models,
            get_storage_info,
            cleanup_old_models,
            verify_model_integrity,
            initialize_local_model,
            download_model,
            generate_text,
            get_model_status,
            cleanup_model,
            // Resource Management Commands
            update_resource_config,
            get_resource_usage,
            get_performance_recommendations,
            start_resource_monitoring,
            cleanup_resources,
            configure_optimal_resources,
            // Model Selection Commands
            get_available_models,
            switch_local_model,
            get_current_model_info,
            reload_ai_service,
            // Backup & Restore Commands
            export_data_to_file,
            import_data_from_file,
            validate_backup_file,
            validate_backup_comprehensive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
