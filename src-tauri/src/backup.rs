use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::sync::Arc;

use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

use crate::database::repositories::{AiRepository, TaskRepository, TimeTrackingRepository};

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub metadata: Option<BackupMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupData {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub tasks: Vec<serde_json::Value>,
    pub time_sessions: Vec<serde_json::Value>,
    pub ai_interactions: Vec<serde_json::Value>,
    pub task_dependencies: Vec<serde_json::Value>,
    pub settings: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub task_count: usize,
    pub session_count: usize,
    pub ai_interaction_count: usize,
    pub dependency_count: usize,
}

pub struct BackupService {
    db: Arc<DatabaseConnection>,
}

impl BackupService {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Export all user data to a ZIP file
    pub async fn export_data(&self, file_path: &str) -> Result<BackupMetadata> {
        let file = File::create(file_path)
            .with_context(|| format!("Failed to create backup file: {}", file_path))?;

        let mut zip = ZipWriter::new(file);
        let options = FileOptions::<()>::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // Collect all data
        let backup_data = self.collect_backup_data().await?;

        // Create metadata
        let metadata = BackupMetadata {
            version: backup_data.version.clone(),
            created_at: backup_data.created_at,
            task_count: backup_data.tasks.len(),
            session_count: backup_data.time_sessions.len(),
            ai_interaction_count: backup_data.ai_interactions.len(),
            dependency_count: backup_data.task_dependencies.len(),
        };

        // Add metadata file
        zip.start_file("metadata.json", options)?;
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        zip.write_all(metadata_json.as_bytes())?;

        // Add main data file
        zip.start_file("data.json", options)?;
        let data_json = serde_json::to_string_pretty(&backup_data)?;
        zip.write_all(data_json.as_bytes())?;

        // Add individual data files for easier inspection
        zip.start_file("tasks.json", options)?;
        let tasks_json = serde_json::to_string_pretty(&backup_data.tasks)?;
        zip.write_all(tasks_json.as_bytes())?;

        zip.start_file("time_sessions.json", options)?;
        let sessions_json = serde_json::to_string_pretty(&backup_data.time_sessions)?;
        zip.write_all(sessions_json.as_bytes())?;

        zip.start_file("ai_interactions.json", options)?;
        let ai_json = serde_json::to_string_pretty(&backup_data.ai_interactions)?;
        zip.write_all(ai_json.as_bytes())?;

        zip.start_file("task_dependencies.json", options)?;
        let deps_json = serde_json::to_string_pretty(&backup_data.task_dependencies)?;
        zip.write_all(deps_json.as_bytes())?;

        zip.start_file("settings.json", options)?;
        let settings_json = serde_json::to_string_pretty(&backup_data.settings)?;
        zip.write_all(settings_json.as_bytes())?;

        zip.finish()?;

        Ok(metadata)
    }

    /// Import data from a ZIP file
    pub async fn import_data(&self, file_path: &str, overwrite: bool) -> Result<BackupMetadata> {
        let file = File::open(file_path)
            .with_context(|| format!("Failed to open backup file: {}", file_path))?;

        let mut archive = ZipArchive::new(file)?;

        // Read and validate metadata
        let metadata = self.read_metadata_from_archive(&mut archive)?;

        // Read backup data
        let backup_data = self.read_data_from_archive(&mut archive)?;

        // Validate data integrity
        self.validate_backup_data(&backup_data)?;

        // Import data
        if overwrite {
            self.clear_existing_data().await?;
        }

        self.import_backup_data(backup_data).await?;

        Ok(metadata)
    }

    /// Validate a backup file without importing
    pub async fn validate_backup(&self, file_path: &str) -> Result<BackupMetadata> {
        let file = File::open(file_path)
            .with_context(|| format!("Failed to open backup file: {}", file_path))?;

        let mut archive = ZipArchive::new(file)?;

        // Read and validate metadata
        let metadata = self.read_metadata_from_archive(&mut archive)?;

        // Read and validate backup data
        let backup_data = self.read_data_from_archive(&mut archive)?;
        self.validate_backup_data(&backup_data)?;

        // Additional integrity checks
        self.validate_data_integrity(&backup_data)?;

        Ok(metadata)
    }

    /// Comprehensive validation of backup data integrity
    pub async fn validate_backup_comprehensive(
        &self,
        file_path: &str,
    ) -> Result<BackupValidationResult> {
        let mut result = BackupValidationResult {
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            metadata: None,
        };

        // Try to open and read the file
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(e) => {
                result.is_valid = false;
                result
                    .errors
                    .push(format!("Cannot open backup file: {}", e));
                return Ok(result);
            }
        };

        let mut archive = match ZipArchive::new(file) {
            Ok(a) => a,
            Err(e) => {
                result.is_valid = false;
                result.errors.push(format!("Invalid ZIP archive: {}", e));
                return Ok(result);
            }
        };

        // Validate metadata
        match self.read_metadata_from_archive(&mut archive) {
            Ok(metadata) => {
                result.metadata = Some(metadata);
            }
            Err(e) => {
                result.is_valid = false;
                result.errors.push(format!("Invalid metadata: {}", e));
                return Ok(result);
            }
        }

        // Validate backup data
        match self.read_data_from_archive(&mut archive) {
            Ok(backup_data) => {
                // Basic validation
                if let Err(e) = self.validate_backup_data(&backup_data) {
                    result.is_valid = false;
                    result.errors.push(format!("Data validation failed: {}", e));
                }

                // Integrity validation
                if let Err(e) = self.validate_data_integrity(&backup_data) {
                    result
                        .warnings
                        .push(format!("Data integrity warning: {}", e));
                }

                // Check for potential issues
                if backup_data.tasks.is_empty() && backup_data.time_sessions.is_empty() {
                    result
                        .warnings
                        .push("Backup contains no tasks or time sessions".to_string());
                }

                if backup_data.tasks.len() > 10000 {
                    result.warnings.push(format!(
                        "Large number of tasks ({}), import may take time",
                        backup_data.tasks.len()
                    ));
                }
            }
            Err(e) => {
                result.is_valid = false;
                result
                    .errors
                    .push(format!("Cannot read backup data: {}", e));
            }
        }

        Ok(result)
    }

    async fn collect_backup_data(&self) -> Result<BackupData> {
        let task_repo = TaskRepository::new(self.db.clone());
        let time_repo = TimeTrackingRepository::new(self.db.clone());
        let ai_repo = AiRepository::new(self.db.clone());

        // Collect all tasks
        let tasks = task_repo
            .find_all(None, None)
            .await
            .context("Failed to fetch tasks")?
            .into_iter()
            .map(|task| serde_json::to_value(task).unwrap_or_default())
            .collect();

        // Collect all time sessions
        let time_sessions = time_repo
            .get_all_sessions()
            .await
            .context("Failed to fetch time sessions")?
            .into_iter()
            .map(|session| serde_json::to_value(session).unwrap_or_default())
            .collect();

        // Collect all AI interactions
        let ai_interactions = ai_repo
            .find_all(None, None)
            .await
            .context("Failed to fetch AI interactions")?
            .into_iter()
            .map(|interaction| serde_json::to_value(interaction).unwrap_or_default())
            .collect();

        // Collect all task dependencies
        let task_dependencies = task_repo
            .get_all_dependencies()
            .await
            .context("Failed to fetch task dependencies")?
            .into_iter()
            .map(|dep| serde_json::to_value(dep).unwrap_or_default())
            .collect();

        // Collect settings (placeholder - would need to implement settings storage)
        let settings = HashMap::new();

        Ok(BackupData {
            version: "1.0.0".to_string(),
            created_at: Utc::now(),
            tasks,
            time_sessions,
            ai_interactions,
            task_dependencies,
            settings,
        })
    }

    fn read_metadata_from_archive(&self, archive: &mut ZipArchive<File>) -> Result<BackupMetadata> {
        let mut metadata_file = archive
            .by_name("metadata.json")
            .context("Backup file is missing metadata.json")?;

        let mut metadata_content = String::new();
        metadata_file.read_to_string(&mut metadata_content)?;

        let metadata: BackupMetadata =
            serde_json::from_str(&metadata_content).context("Failed to parse metadata.json")?;

        Ok(metadata)
    }

    fn read_data_from_archive(&self, archive: &mut ZipArchive<File>) -> Result<BackupData> {
        let mut data_file = archive
            .by_name("data.json")
            .context("Backup file is missing data.json")?;

        let mut data_content = String::new();
        data_file.read_to_string(&mut data_content)?;

        let backup_data: BackupData =
            serde_json::from_str(&data_content).context("Failed to parse data.json")?;

        Ok(backup_data)
    }

    fn validate_backup_data(&self, backup_data: &BackupData) -> Result<()> {
        // Check version compatibility
        if backup_data.version != "1.0.0" {
            return Err(anyhow::anyhow!(
                "Unsupported backup version: {}. Expected: 1.0.0",
                backup_data.version
            ));
        }

        // Validate data structure
        for (i, task) in backup_data.tasks.iter().enumerate() {
            if !task.is_object() {
                return Err(anyhow::anyhow!("Invalid task data at index {}", i));
            }

            // Check required fields
            let task_obj = task.as_object().unwrap();
            if !task_obj.contains_key("id") || !task_obj.contains_key("title") {
                return Err(anyhow::anyhow!(
                    "Task at index {} is missing required fields",
                    i
                ));
            }
        }

        for (i, session) in backup_data.time_sessions.iter().enumerate() {
            if !session.is_object() {
                return Err(anyhow::anyhow!("Invalid time session data at index {}", i));
            }

            let session_obj = session.as_object().unwrap();
            if !session_obj.contains_key("id") || !session_obj.contains_key("task_id") {
                return Err(anyhow::anyhow!(
                    "Time session at index {} is missing required fields",
                    i
                ));
            }
        }

        Ok(())
    }

    fn validate_data_integrity(&self, backup_data: &BackupData) -> Result<()> {
        use std::collections::HashSet;

        // Collect all task IDs
        let mut task_ids = HashSet::new();
        for task in &backup_data.tasks {
            if let Some(task_obj) = task.as_object() {
                if let Some(id) = task_obj.get("id").and_then(|v| v.as_str()) {
                    if !task_ids.insert(id.to_string()) {
                        return Err(anyhow::anyhow!("Duplicate task ID found: {}", id));
                    }
                }
            }
        }

        // Validate time sessions reference valid tasks
        for session in &backup_data.time_sessions {
            if let Some(session_obj) = session.as_object() {
                if let Some(task_id) = session_obj.get("task_id").and_then(|v| v.as_str()) {
                    if !task_ids.contains(task_id) {
                        return Err(anyhow::anyhow!(
                            "Time session references non-existent task: {}",
                            task_id
                        ));
                    }
                }
            }
        }

        // Validate task dependencies reference valid tasks
        for dependency in &backup_data.task_dependencies {
            if let Some(dep_obj) = dependency.as_object() {
                if let Some(task_id) = dep_obj.get("task_id").and_then(|v| v.as_str()) {
                    if !task_ids.contains(task_id) {
                        return Err(anyhow::anyhow!(
                            "Task dependency references non-existent task: {}",
                            task_id
                        ));
                    }
                }
                if let Some(depends_on_id) = dep_obj.get("depends_on_id").and_then(|v| v.as_str()) {
                    if !task_ids.contains(depends_on_id) {
                        return Err(anyhow::anyhow!(
                            "Task dependency references non-existent dependency: {}",
                            depends_on_id
                        ));
                    }
                }
            }
        }

        Ok(())
    }

    async fn clear_existing_data(&self) -> Result<()> {
        let task_repo = TaskRepository::new(self.db.clone());
        let time_repo = TimeTrackingRepository::new(self.db.clone());
        let ai_repo = AiRepository::new(self.db.clone());

        // Clear in correct order to respect foreign key constraints
        time_repo
            .delete_all_sessions()
            .await
            .context("Failed to clear existing time sessions")?;

        ai_repo
            .delete_all_interactions()
            .await
            .context("Failed to clear existing AI interactions")?;

        task_repo
            .delete_all_dependencies()
            .await
            .context("Failed to clear existing task dependencies")?;

        task_repo
            .delete_all_tasks()
            .await
            .context("Failed to clear existing tasks")?;

        Ok(())
    }

    async fn import_backup_data(&self, backup_data: BackupData) -> Result<()> {
        let task_repo = TaskRepository::new(self.db.clone());
        let time_repo = TimeTrackingRepository::new(self.db.clone());
        let ai_repo = AiRepository::new(self.db.clone());

        // Import tasks first
        for task_value in backup_data.tasks {
            if let Ok(task) = serde_json::from_value(task_value) {
                task_repo
                    .import_task(task)
                    .await
                    .context("Failed to import task")?;
            }
        }

        // Import task dependencies
        for dep_value in backup_data.task_dependencies {
            if let Ok(dependency) = serde_json::from_value(dep_value) {
                task_repo
                    .import_dependency(dependency)
                    .await
                    .context("Failed to import task dependency")?;
            }
        }

        // Import time sessions
        for session_value in backup_data.time_sessions {
            if let Ok(session) = serde_json::from_value(session_value) {
                time_repo
                    .import_session(session)
                    .await
                    .context("Failed to import time session")?;
            }
        }

        // Import AI interactions
        for ai_value in backup_data.ai_interactions {
            if let Ok(interaction) = serde_json::from_value(ai_value) {
                ai_repo
                    .import_interaction(interaction)
                    .await
                    .context("Failed to import AI interaction")?;
            }
        }

        Ok(())
    }
}
