use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

use super::error::LlamaError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub name: String,
    pub repo: String,
    pub filename: String,
    pub size_bytes: u64,
    pub checksum: Option<String>,
    pub download_date: chrono::DateTime<chrono::Utc>,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub usage_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub percentage: f32,
    pub speed_bytes_per_sec: u64,
    pub eta_seconds: Option<u64>,
    pub status: DownloadStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadStatus {
    Initializing,
    Downloading,
    Verifying,
    Completed,
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub total_space_bytes: u64,
    pub available_space_bytes: u64,
    pub used_by_models_bytes: u64,
    pub models_directory: String,
}

pub struct ModelManager {
    models_dir: PathBuf,
    progress_callback: Option<Arc<Mutex<dyn Fn(DownloadProgress) + Send + Sync>>>,
}

impl ModelManager {
    pub fn new() -> Result<Self, LlamaError> {
        let models_dir = Self::get_models_directory()?;
        std::fs::create_dir_all(&models_dir).map_err(|e| {
            LlamaError::IoError(format!("Failed to create models directory: {}", e))
        })?;

        Ok(Self {
            models_dir,
            progress_callback: None,
        })
    }

    pub fn set_progress_callback<F>(&mut self, callback: F)
    where
        F: Fn(DownloadProgress) + Send + Sync + 'static,
    {
        self.progress_callback = Some(Arc::new(Mutex::new(callback)));
    }

    fn get_models_directory() -> Result<PathBuf, LlamaError> {
        // Use a more permanent location than temp directory
        let app_data_dir = if cfg!(target_os = "macos") {
            dirs::data_local_dir()
                .ok_or_else(|| {
                    LlamaError::ConfigurationError("Cannot find local data directory".to_string())
                })?
                .join("KiraPilot")
        } else if cfg!(target_os = "windows") {
            dirs::data_local_dir()
                .ok_or_else(|| {
                    LlamaError::ConfigurationError("Cannot find local data directory".to_string())
                })?
                .join("KiraPilot")
        } else {
            // Linux and other Unix-like systems
            dirs::data_local_dir()
                .ok_or_else(|| {
                    LlamaError::ConfigurationError("Cannot find local data directory".to_string())
                })?
                .join("kirapilot")
        };

        Ok(app_data_dir.join("models"))
    }

    pub async fn download_model_with_progress(
        &mut self,
        repo: &str,
        filename: &str,
    ) -> Result<PathBuf, LlamaError> {
        info!("Starting model download: {} from {}", filename, repo);

        // Validate inputs
        if repo.is_empty() || filename.is_empty() {
            return Err(LlamaError::ConfigurationError(
                "Repository and filename cannot be empty".to_string(),
            ));
        }

        let target_path = self.models_dir.join(filename);

        // Check if model already exists and is valid
        if let Ok(existing_metadata) = self.get_model_metadata(&target_path).await {
            info!("Model already exists, verifying integrity");

            if self
                .verify_model_integrity(&target_path, &existing_metadata)
                .await?
            {
                info!("Existing model is valid, updating usage");
                self.update_model_usage(&target_path).await?;
                return Ok(target_path);
            } else {
                warn!("Existing model failed integrity check, re-downloading");
                let _ = std::fs::remove_file(&target_path);
                self.remove_model_metadata(&target_path).await?;
            }
        }

        // Check available disk space
        self.check_disk_space(&target_path, 1024 * 1024 * 1024)
            .await?; // Assume 1GB minimum

        // Initialize progress tracking
        if let Some(callback) = &self.progress_callback {
            let progress = DownloadProgress {
                total_bytes: 0,
                downloaded_bytes: 0,
                percentage: 0.0,
                speed_bytes_per_sec: 0,
                eta_seconds: None,
                status: DownloadStatus::Initializing,
            };
            let callback_guard = callback.lock().await;
            callback_guard(progress);
        }

        // Download the model
        let downloaded_path = self.download_from_huggingface(repo, filename).await?;

        // Verify the downloaded file
        let file_size = std::fs::metadata(&downloaded_path)
            .map_err(|e| LlamaError::IoError(format!("Cannot read downloaded file: {}", e)))?
            .len();

        if file_size == 0 {
            return Err(LlamaError::DownloadFailed(
                "Downloaded file is empty".to_string(),
            ));
        }

        // Calculate checksum for integrity verification
        let checksum = self.calculate_file_checksum(&downloaded_path).await?;

        // Move to final location if different
        if downloaded_path != target_path {
            std::fs::copy(&downloaded_path, &target_path).map_err(|e| {
                LlamaError::IoError(format!("Failed to move model to final location: {}", e))
            })?;

            // Clean up temporary file
            let _ = std::fs::remove_file(&downloaded_path);
        }

        // Store metadata
        let metadata = ModelMetadata {
            name: filename.to_string(),
            repo: repo.to_string(),
            filename: filename.to_string(),
            size_bytes: file_size,
            checksum: Some(checksum),
            download_date: chrono::Utc::now(),
            last_used: None,
            usage_count: 0,
        };

        self.save_model_metadata(&target_path, &metadata).await?;

        // Final progress update
        if let Some(callback) = &self.progress_callback {
            let progress = DownloadProgress {
                total_bytes: file_size,
                downloaded_bytes: file_size,
                percentage: 100.0,
                speed_bytes_per_sec: 0,
                eta_seconds: Some(0),
                status: DownloadStatus::Completed,
            };
            let callback_guard = callback.lock().await;
            callback_guard(progress);
        }

        info!("Model download completed successfully: {:?}", target_path);
        Ok(target_path)
    }

    async fn download_from_huggingface(
        &self,
        repo: &str,
        filename: &str,
    ) -> Result<PathBuf, LlamaError> {
        use hf_hub::api::sync::Api;

        let api = Api::new().map_err(|e| {
            LlamaError::DownloadFailed(format!("Failed to create HF API client: {}", e))
        })?;

        let repo_handle = api.model(repo.to_string());

        info!(
            "Downloading {} from Hugging Face repository {}",
            filename, repo
        );

        // Download with progress tracking
        let downloaded_path = repo_handle.get(filename).map_err(|e| {
            error!("Download failed: {}", e);
            LlamaError::DownloadFailed(format!("Failed to download from {}: {}", repo, e))
        })?;

        Ok(downloaded_path)
    }

    async fn calculate_file_checksum(&self, path: &Path) -> Result<String, LlamaError> {
        debug!("Calculating checksum for: {:?}", path);

        let file = File::open(path)
            .map_err(|e| LlamaError::IoError(format!("Cannot open file for checksum: {}", e)))?;

        let mut reader = BufReader::new(file);
        let mut hasher = Sha256::new();
        let mut buffer = [0; 8192];

        loop {
            let bytes_read = reader.read(&mut buffer).map_err(|e| {
                LlamaError::IoError(format!("Error reading file for checksum: {}", e))
            })?;

            if bytes_read == 0 {
                break;
            }

            hasher.update(&buffer[..bytes_read]);
        }

        let result = format!("{:x}", hasher.finalize());
        debug!("Checksum calculated: {}", result);
        Ok(result)
    }

    pub async fn verify_model_integrity(
        &self,
        path: &Path,
        metadata: &ModelMetadata,
    ) -> Result<bool, LlamaError> {
        debug!("Verifying model integrity: {:?}", path);

        // Check file exists and size matches
        let file_metadata = std::fs::metadata(path)
            .map_err(|e| LlamaError::IoError(format!("Cannot read file metadata: {}", e)))?;

        if file_metadata.len() != metadata.size_bytes {
            warn!(
                "File size mismatch: expected {}, got {}",
                metadata.size_bytes,
                file_metadata.len()
            );
            return Ok(false);
        }

        // Verify checksum if available
        if let Some(expected_checksum) = &metadata.checksum {
            let actual_checksum = self.calculate_file_checksum(path).await?;
            if actual_checksum != *expected_checksum {
                warn!(
                    "Checksum mismatch: expected {}, got {}",
                    expected_checksum, actual_checksum
                );
                return Ok(false);
            }
        }

        debug!("Model integrity verification passed");
        Ok(true)
    }

    async fn check_disk_space(
        &self,
        target_path: &Path,
        _required_bytes: u64,
    ) -> Result<(), LlamaError> {
        // Get the parent directory to check available space
        let parent_dir = target_path
            .parent()
            .ok_or_else(|| LlamaError::IoError("Cannot determine parent directory".to_string()))?;

        // This is a simplified space check - in production you'd want more sophisticated checking
        if let Ok(metadata) = std::fs::metadata(parent_dir) {
            debug!("Directory exists, assuming sufficient space available");
            // In a real implementation, you'd use platform-specific APIs to check available space
            // For now, we'll just ensure the directory is writable
            if metadata.permissions().readonly() {
                return Err(LlamaError::IoError(
                    "Models directory is read-only".to_string(),
                ));
            }
        }

        Ok(())
    }

    pub async fn get_storage_info(&self) -> Result<StorageInfo, LlamaError> {
        let mut total_model_size = 0u64;

        if self.models_dir.exists() {
            let entries = std::fs::read_dir(&self.models_dir)
                .map_err(|e| LlamaError::IoError(format!("Cannot read models directory: {}", e)))?;

            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            total_model_size += metadata.len();
                        }
                    }
                }
            }
        }

        // Simplified space calculation - in production use platform-specific APIs
        Ok(StorageInfo {
            total_space_bytes: 1024 * 1024 * 1024 * 100, // Assume 100GB total
            available_space_bytes: 1024 * 1024 * 1024 * 50, // Assume 50GB available
            used_by_models_bytes: total_model_size,
            models_directory: self.models_dir.to_string_lossy().to_string(),
        })
    }

    pub async fn cleanup_old_models(
        &self,
        max_age_days: u64,
        max_unused_models: usize,
    ) -> Result<Vec<String>, LlamaError> {
        info!(
            "Starting model cleanup: max_age_days={}, max_unused_models={}",
            max_age_days, max_unused_models
        );

        let mut cleaned_models = Vec::new();
        let cutoff_date = chrono::Utc::now() - chrono::Duration::days(max_age_days as i64);

        if !self.models_dir.exists() {
            return Ok(cleaned_models);
        }

        let entries = std::fs::read_dir(&self.models_dir)
            .map_err(|e| LlamaError::IoError(format!("Cannot read models directory: {}", e)))?;

        let mut model_files = Vec::new();

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "gguf") {
                    model_files.push(path);
                }
            }
        }

        // Sort by last used date (oldest first)
        let mut models_with_metadata = Vec::new();
        for path in model_files {
            if let Ok(metadata) = self.get_model_metadata(&path).await {
                models_with_metadata.push((path, metadata));
            }
        }

        models_with_metadata.sort_by(|a, b| {
            let a_date = a.1.last_used.unwrap_or(a.1.download_date);
            let b_date = b.1.last_used.unwrap_or(b.1.download_date);
            a_date.cmp(&b_date)
        });

        // Remove models older than cutoff date
        for (path, metadata) in &models_with_metadata {
            let last_activity = metadata.last_used.unwrap_or(metadata.download_date);
            if last_activity < cutoff_date {
                if let Err(e) = self.remove_model(path).await {
                    warn!("Failed to remove old model {:?}: {}", path, e);
                } else {
                    cleaned_models.push(path.to_string_lossy().to_string());
                    info!("Removed old model: {:?}", path);
                }
            }
        }

        // Remove excess unused models
        let remaining_models: Vec<_> = models_with_metadata
            .into_iter()
            .filter(|(path, _)| path.exists())
            .collect();

        if remaining_models.len() > max_unused_models {
            let to_remove = remaining_models.len() - max_unused_models;
            for (path, _) in remaining_models.iter().take(to_remove) {
                if let Err(e) = self.remove_model(path).await {
                    warn!("Failed to remove excess model {:?}: {}", path, e);
                } else {
                    cleaned_models.push(path.to_string_lossy().to_string());
                    info!("Removed excess model: {:?}", path);
                }
            }
        }

        info!(
            "Model cleanup completed, removed {} models",
            cleaned_models.len()
        );
        Ok(cleaned_models)
    }

    async fn remove_model(&self, path: &Path) -> Result<(), LlamaError> {
        // Remove metadata first
        self.remove_model_metadata(path).await?;

        // Remove model file
        std::fs::remove_file(path)
            .map_err(|e| LlamaError::IoError(format!("Failed to remove model file: {}", e)))?;

        Ok(())
    }

    pub async fn list_cached_models(&self) -> Result<Vec<ModelMetadata>, LlamaError> {
        let mut models = Vec::new();

        if !self.models_dir.exists() {
            return Ok(models);
        }

        let entries = std::fs::read_dir(&self.models_dir)
            .map_err(|e| LlamaError::IoError(format!("Cannot read models directory: {}", e)))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "gguf") {
                    if let Ok(metadata) = self.get_model_metadata(&path).await {
                        models.push(metadata);
                    }
                }
            }
        }

        // Sort by last used date (most recent first)
        models.sort_by(|a, b| {
            let a_date = a.last_used.unwrap_or(a.download_date);
            let b_date = b.last_used.unwrap_or(b.download_date);
            b_date.cmp(&a_date)
        });

        Ok(models)
    }

    pub async fn get_model_metadata(&self, model_path: &Path) -> Result<ModelMetadata, LlamaError> {
        let metadata_path = self.get_metadata_path(model_path);

        if !metadata_path.exists() {
            // Create metadata from file if it doesn't exist
            let file_metadata = std::fs::metadata(model_path)
                .map_err(|e| LlamaError::IoError(format!("Cannot read model file: {}", e)))?;

            let metadata = ModelMetadata {
                name: model_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                repo: "unknown".to_string(),
                filename: model_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                size_bytes: file_metadata.len(),
                checksum: None,
                download_date: chrono::Utc::now(),
                last_used: None,
                usage_count: 0,
            };

            self.save_model_metadata(model_path, &metadata).await?;
            return Ok(metadata);
        }

        let content = std::fs::read_to_string(&metadata_path)
            .map_err(|e| LlamaError::IoError(format!("Cannot read metadata file: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| LlamaError::IoError(format!("Invalid metadata format: {}", e)))
    }

    async fn save_model_metadata(
        &self,
        model_path: &Path,
        metadata: &ModelMetadata,
    ) -> Result<(), LlamaError> {
        let metadata_path = self.get_metadata_path(model_path);

        let content = serde_json::to_string_pretty(metadata)
            .map_err(|e| LlamaError::IoError(format!("Cannot serialize metadata: {}", e)))?;

        std::fs::write(&metadata_path, content)
            .map_err(|e| LlamaError::IoError(format!("Cannot write metadata file: {}", e)))?;

        Ok(())
    }

    async fn remove_model_metadata(&self, model_path: &Path) -> Result<(), LlamaError> {
        let metadata_path = self.get_metadata_path(model_path);

        if metadata_path.exists() {
            std::fs::remove_file(&metadata_path)
                .map_err(|e| LlamaError::IoError(format!("Cannot remove metadata file: {}", e)))?;
        }

        Ok(())
    }

    async fn update_model_usage(&self, model_path: &Path) -> Result<(), LlamaError> {
        let mut metadata = self.get_model_metadata(model_path).await?;
        metadata.last_used = Some(chrono::Utc::now());
        metadata.usage_count += 1;
        self.save_model_metadata(model_path, &metadata).await?;
        Ok(())
    }

    fn get_metadata_path(&self, model_path: &Path) -> PathBuf {
        let mut metadata_path = model_path.to_path_buf();
        metadata_path.set_extension("json");
        metadata_path
    }

    pub fn get_models_directory_path(&self) -> &Path {
        &self.models_dir
    }
}
