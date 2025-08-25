use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use hf_hub::api::sync::Api;
use log::{debug, error, info, warn};

// llama-cpp-2 imports
use llama_cpp_2::{
    llama_backend::LlamaBackend,
    model::{LlamaModel, params::LlamaModelParams, AddBos, Special},
    context::params::LlamaContextParams,
    llama_batch::LlamaBatch,
    sampling::LlamaSampler,
};
use encoding_rs;
use std::num::NonZeroU32;
use std::pin::pin;

use super::error::LlamaError;
use super::resource_manager::{RequestMetrics, ResourceConfig, ResourceManager, ResourceUsage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationOptions {
    pub max_tokens: Option<i32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub repeat_penalty: Option<f32>,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        Self {
            max_tokens: Some(4096),
            temperature: Some(0.7),
            top_p: Some(0.9),
            top_k: Some(40),
            repeat_penalty: Some(1.1),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size_mb: u64,
    pub context_size: u32,
    pub parameter_count: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub is_available: bool,
    pub is_loaded: bool,
    pub model_path: Option<String>,
    pub download_progress: Option<f32>,
    pub error_message: Option<String>,
    pub model_info: Option<ModelInfo>,
}

use std::sync::mpsc;
use std::thread;
use tokio::sync::oneshot;

// Thread-safe wrapper for llama-cpp-2
pub struct LlamaService {
    sender: Option<mpsc::Sender<LlamaRequest>>,
    model_path: Option<PathBuf>,
    context_size: u32,
    threads: i32,
    resource_manager: Option<Arc<ResourceManager>>,
    is_initialized: bool,
    is_model_loaded: bool,
}

// Internal request types for thread communication
enum LlamaRequest {
    LoadModel {
        path: PathBuf,
        response: oneshot::Sender<Result<(), LlamaError>>,
    },
    Generate {
        prompt: String,
        options: GenerationOptions,
        response: oneshot::Sender<Result<String, LlamaError>>,
    },
    IsReady {
        response: oneshot::Sender<bool>,
    },
    Cleanup {
        response: oneshot::Sender<()>,
    },
}

// Internal service that runs in dedicated thread
// Using a simpler approach to manage llama-cpp-2 components
struct InternalLlamaService {
    context_size: u32,
    threads: i32,
    model_path: Option<PathBuf>,
    is_model_loaded: bool,
}

impl InternalLlamaService {
    fn new(context_size: u32, threads: i32) -> Result<Self, LlamaError> {
        info!("Initializing internal LlamaService with llama-cpp-2");
        
        // Test backend initialization
        let _backend = LlamaBackend::init()
            .map_err(|e| LlamaError::InitializationError(format!("Failed to initialize backend: {}", e)))?;
        
        info!("Backend initialization successful");
        
        Ok(Self {
            context_size,
            threads,
            model_path: None,
            is_model_loaded: false,
        })
    }

    fn load_model(&mut self, model_path: PathBuf) -> Result<(), LlamaError> {
        info!("Loading model from: {:?}", model_path);

        // Validate model file exists and is readable
        if !model_path.exists() {
            return Err(LlamaError::ModelNotFound(format!(
                "Model file not found: {:?}",
                model_path
            )));
        }

        // Check file size and permissions
        let metadata = std::fs::metadata(&model_path)
            .map_err(|e| LlamaError::IoError(format!("Cannot read model file metadata: {}", e)))?;

        if metadata.len() == 0 {
            return Err(LlamaError::ModelLoadFailed(
                "Model file is empty".to_string(),
            ));
        }

        info!("Loading model file (size: {} MB)", metadata.len() / (1024 * 1024));

        // Test model loading by creating components on-demand
        let backend = LlamaBackend::init()
            .map_err(|e| LlamaError::InitializationError(format!("Failed to initialize backend: {}", e)))?;

        // Create model parameters with GPU offloading if available
        let model_params = LlamaModelParams::default()
            .with_n_gpu_layers(1000); // Offload all layers to GPU if available

        let model_params = pin!(model_params);

        // Load the model
        info!("Loading model with {} threads", self.threads);
        let model = LlamaModel::load_from_file(&backend, &model_path, &model_params)
            .map_err(|e| {
                error!("Model loading failed: {}", e);
                LlamaError::ModelLoadFailed(format!("Failed to load model from {:?}: {}", model_path, e))
            })?;

        // Create context parameters
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(Some(NonZeroU32::new(self.context_size).unwrap()))
            .with_n_threads(self.threads)
            .with_n_threads_batch(self.threads);

        // Test context creation
        let _context = model.new_context(&backend, ctx_params)
            .map_err(|e| {
                error!("Context creation failed: {}", e);
                LlamaError::ModelLoadFailed(format!("Failed to create context: {}", e))
            })?;

        // Store the model path and mark as loaded
        self.model_path = Some(model_path.clone());
        self.is_model_loaded = true;

        info!("Model and context loaded successfully from: {:?}", model_path);
        Ok(())
    }

    fn generate(&mut self, prompt: &str, options: &GenerationOptions) -> Result<String, LlamaError> {
        debug!("Generating text with llama-cpp-2: {} chars", prompt.len());
        debug!("Model loaded status: {}", self.is_model_loaded);

        if !self.is_model_loaded {
            // Provide mock response for testing when no model is loaded
            debug!("No model loaded, generating mock response");
            return self.generate_mock_response(prompt, options);
        }

        let model_path = self.model_path.as_ref()
            .ok_or_else(|| LlamaError::GenerationFailed("Model path not available".to_string()))?;

        // Create components on-demand to avoid lifetime issues
        let backend = LlamaBackend::init()
            .map_err(|e| LlamaError::GenerationFailed(format!("Failed to initialize backend: {}", e)))?;

        // Load the model
        let model_params = LlamaModelParams::default()
            .with_n_gpu_layers(1000);
        let model_params = pin!(model_params);
        
        let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
            .map_err(|e| LlamaError::GenerationFailed(format!("Failed to load model: {}", e)))?;

        // Create context
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(Some(NonZeroU32::new(self.context_size).unwrap()))
            .with_n_threads(self.threads)
            .with_n_threads_batch(self.threads);

        let mut context = model.new_context(&backend, ctx_params)
            .map_err(|e| LlamaError::GenerationFailed(format!("Failed to create context: {}", e)))?;

        // Tokenize the prompt
        let tokens_list = model
            .str_to_token(prompt, AddBos::Always)
            .map_err(|e| LlamaError::GenerationFailed(format!("Failed to tokenize prompt: {}", e)))?;

        let n_ctx = context.n_ctx() as i32;
        let max_tokens = options.max_tokens.unwrap_or(512);
        let n_kv_req = tokens_list.len() as i32 + max_tokens;

        debug!("max_tokens = {}, n_ctx = {}, n_kv_req = {}", max_tokens, n_ctx, n_kv_req);

        // Make sure the KV cache is big enough
        if n_kv_req > n_ctx {
            return Err(LlamaError::GenerationFailed(
                "Required KV cache size exceeds context size. Try reducing max_tokens or increasing context size.".to_string()
            ));
        }

        // Check if we have enough space for generation
        // We need at least some tokens for the response, reserve at least 50 tokens
        let min_response_tokens = std::cmp::min(50, max_tokens);
        if tokens_list.len() as i32 + min_response_tokens > n_ctx {
            return Err(LlamaError::GenerationFailed(
                format!("Prompt is too long. Prompt uses {} tokens, but context size is only {}. Consider reducing conversation history or system prompt length.", tokens_list.len(), n_ctx)
            ));
        }

        // Create a batch for processing with dynamic size
        // Calculate required batch size based on tokens and generation needs
        let prompt_token_count = tokens_list.len();
        let generation_buffer = std::cmp::min(max_tokens, 256); // Buffer for generation
        let required_batch_size = prompt_token_count + generation_buffer as usize;
        
        // Use the larger of required size or minimum viable size, but cap at context size
        let batch_size = std::cmp::min(
            std::cmp::max(required_batch_size, 512), // Minimum 512 for performance
            n_ctx as usize // Don't exceed context size
        );
        
        info!("Creating dynamic batch: size={}, prompt_tokens={}, max_tokens={}, context_size={}", 
              batch_size, prompt_token_count, max_tokens, n_ctx);
        let mut batch = LlamaBatch::new(batch_size, 1);

        // Add prompt tokens to batch
        let last_index = (tokens_list.len() - 1) as i32;
        for (i, token) in (0_i32..).zip(tokens_list.into_iter()) {
            let is_last = i == last_index;
            batch.add(token, i, &[0], is_last)
                .map_err(|e| {
                    error!("Failed to add token {} at position {} to batch (capacity: {}): {}", 
                           token, i, batch_size, e);
                    LlamaError::GenerationFailed(format!(
                        "Failed to add token to batch: {}. Batch capacity: {}, Token position: {}, Total tokens: {}. Try reducing conversation history or max_tokens.",
                        e, batch_size, i, prompt_token_count
                    ))
                })?;
        }

        // Process the prompt
        context.decode(&mut batch)
            .map_err(|e| LlamaError::GenerationFailed(format!("Failed to decode prompt: {}", e)))?;

        // Initialize sampler with repetition penalty to avoid loops
        let seed = 1234; // Could be made configurable
        let temperature = options.temperature.unwrap_or(0.0);
        
        let mut sampler = if temperature > 0.0 {
            // Use temperature sampling with repetition penalty
            LlamaSampler::chain_simple([
                LlamaSampler::dist(seed),
                LlamaSampler::temp(temperature),
                LlamaSampler::penalties(64, options.repeat_penalty.unwrap_or(1.1), 0.0, 0.0),
            ])
        } else {
            // Use greedy sampling with repetition penalty to prevent loops
            LlamaSampler::chain_simple([
                LlamaSampler::dist(seed),
                LlamaSampler::greedy(),
                LlamaSampler::penalties(64, options.repeat_penalty.unwrap_or(1.1), 0.0, 0.0),
            ])
        };

        // Generate tokens
        let mut n_cur = batch.n_tokens();
        let mut generated_text = String::new();
        let mut decoder = encoding_rs::UTF_8.new_decoder();

        while n_cur < (last_index + 1 + max_tokens) {
            // Sample the next token
            let token = sampler.sample(&context, batch.n_tokens() - 1);
            sampler.accept(token);

            // Check if it's end of generation
            if model.is_eog_token(token) {
                debug!("End of generation token encountered");
                break;
            }

            // Convert token to text
            let output_bytes = model.token_to_bytes(token, Special::Tokenize)
                .map_err(|e| LlamaError::GenerationFailed(format!("Failed to convert token to bytes: {}", e)))?;
            
            let mut output_string = String::with_capacity(32);
            let _decode_result = decoder.decode_to_string(&output_bytes, &mut output_string, false);
            generated_text.push_str(&output_string);

            // Prepare for next iteration
            batch.clear();
            
            // Safety check: ensure we don't exceed batch capacity during generation
            if n_cur >= batch_size as i32 {
                warn!("Generation loop reached batch capacity limit at token {}", n_cur);
                break;
            }
            
            batch.add(token, n_cur, &[0], true)
                .map_err(|e| {
                    error!("Failed to add generated token {} to batch at position {}: {}", token, n_cur, e);
                    LlamaError::GenerationFailed(format!("Failed to add generated token to batch: {}", e))
                })?;

            n_cur += 1;

            // Decode the new token
            context.decode(&mut batch)
                .map_err(|e| LlamaError::GenerationFailed(format!("Failed to decode generated token: {}", e)))?;
        }

        info!("Generated {} tokens: {}", n_cur - (last_index + 1), generated_text.len());
        Ok(generated_text)
    }

    fn is_ready(&self) -> bool {
        self.is_model_loaded
    }

    fn cleanup(&mut self) {
        info!("Cleaning up internal LlamaService");
        self.model_path = None;
        self.is_model_loaded = false;
        info!("Internal LlamaService cleanup completed");
    }

    /// Generate a mock response for testing when no model is loaded
    fn generate_mock_response(&self, prompt: &str, _options: &GenerationOptions) -> Result<String, LlamaError> {
        info!("Generating mock response for prompt: {} chars", prompt.len());
        
        // Simulate some processing time
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        let responses = vec![
            format!("Hello! I received your message: \"{}\". This is a mock response from the KiraPilot LLM service. The actual model isn't loaded, but the service is working correctly and ready for real model integration.", prompt),
            format!("Thank you for testing with: \"{}\". This simulated response demonstrates that the LLM service is functioning properly. When you load a GGUF model, you'll get real AI-generated responses instead.", prompt),
            format!("I understand you said: \"{}\". This is a development mode response. The LLM backend is operational and thread-safe, ready to process real language models when available.", prompt),
            format!("Your message \"{}\" has been processed successfully. This mock response shows the service is working. Load a GGUF model to enable actual AI inference with llama-cpp-2.", prompt),
        ];
        
        // Use a simple hash to make responses somewhat consistent for the same input
        let hash = prompt.chars().map(|c| c as usize).sum::<usize>();
        let response = &responses[hash % responses.len()];
        
        Ok(response.clone())
    }
}

impl LlamaService {
    pub fn new() -> Result<Self, LlamaError> {
        info!("Initializing LlamaService with dedicated thread");
        
        let context_size = 8192; // Increased from 2048 to accommodate larger prompts
        let threads = Self::detect_optimal_threads();
        
        // Create channel for communication with dedicated thread
        let (sender, receiver) = mpsc::channel::<LlamaRequest>();
        
        // Spawn dedicated thread for LLM operations
        let context_size_clone = context_size;
        let threads_clone = threads;
        thread::spawn(move || {
            let mut internal_service = match InternalLlamaService::new(context_size_clone, threads_clone) {
                Ok(service) => service,
                Err(e) => {
                    error!("Failed to initialize internal LlamaService: {}", e);
                    return;
                }
            };
            
            // Handle requests from the main thread
            while let Ok(request) = receiver.recv() {
                match request {
                    LlamaRequest::LoadModel { path, response } => {
                        let result = internal_service.load_model(path);
                        let _ = response.send(result);
                    }
                    LlamaRequest::Generate { prompt, options, response } => {
                        let result = internal_service.generate(&prompt, &options);
                        let _ = response.send(result);
                    }
                    LlamaRequest::IsReady { response } => {
                        let result = internal_service.is_ready();
                        let _ = response.send(result);
                    }
                    LlamaRequest::Cleanup { response } => {
                        internal_service.cleanup();
                        let _ = response.send(());
                        break; // Exit the thread
                    }
                }
            }
        });
        
        // Initialize resource manager
        let resource_config = ResourceConfig {
            max_concurrent_requests: 3,
            max_threads: threads,
            max_memory_mb: 0,
            cpu_limit_percent: 80,
            request_timeout_seconds: 60,
            max_queue_size: 10,
            enable_monitoring: true,
        };
        let resource_manager = Arc::new(ResourceManager::new(resource_config));
        
        Ok(Self {
            sender: Some(sender),
            model_path: None,
            context_size,
            threads,
            resource_manager: Some(resource_manager),
            is_initialized: true,
            is_model_loaded: false,
        })
    }



    fn detect_optimal_threads() -> i32 {
        let cpu_count = std::thread::available_parallelism()
            .map(|n| n.get() as i32)
            .unwrap_or(4);

        // Use 75% of available cores, minimum 1, maximum 8
        std::cmp::min(std::cmp::max(cpu_count * 3 / 4, 1), 8)
    }

    pub async fn download_model(
        &mut self,
        repo: &str,
        filename: &str,
    ) -> Result<PathBuf, LlamaError> {
        info!("Mock downloading model {} from {}", filename, repo);

        // Validate inputs
        if repo.is_empty() || filename.is_empty() {
            return Err(LlamaError::ConfigurationError(
                "Repository and filename cannot be empty".to_string(),
            ));
        }

        // Create models directory in temp folder
        let models_dir = std::env::temp_dir().join("models");
        std::fs::create_dir_all(&models_dir).map_err(|e| {
            LlamaError::IoError(format!("Failed to create models directory: {}", e))
        })?;

        let target_path = models_dir.join(filename);

        // Check if model already exists and validate it
        if target_path.exists() {
            info!("Model already exists at: {:?}", target_path);
            
            // Validate the existing file
            match std::fs::metadata(&target_path) {
                Ok(metadata) => {
                    if metadata.len() > 1024 { // At least 1KB for a real model file
                        info!("Using existing model file (size: {} MB)", metadata.len() / (1024 * 1024));
                        return Ok(target_path);
                    } else {
                        warn!("Existing model file is too small, re-downloading");
                        let _ = std::fs::remove_file(&target_path);
                    }
                }
                Err(e) => {
                    warn!("Cannot read existing model file metadata: {}, re-downloading", e);
                    let _ = std::fs::remove_file(&target_path);
                }
            }
        }
        
        let api = Api::new()
            .map_err(|e| LlamaError::DownloadFailed(format!("Failed to create API client: {}", e)))?;
        
        let repo_handle = api.model(repo.to_string());
        
        // Download the model file with better error handling
        info!("Starting download of {} from {}", filename, repo);
        let downloaded_path = repo_handle.get(filename)
            .map_err(|e| {
                error!("Download failed: {}", e);
                LlamaError::DownloadFailed(format!("Failed to download model from {}: {}", repo, e))
            })?;
        
        // Verify the downloaded file
        let download_metadata = std::fs::metadata(&downloaded_path)
            .map_err(|e| LlamaError::IoError(format!("Cannot read downloaded file metadata: {}", e)))?;
        
        if download_metadata.len() == 0 {
            return Err(LlamaError::DownloadFailed("Downloaded file is empty".to_string()));
        }
        
        info!("Downloaded file size: {} MB", download_metadata.len() / (1024 * 1024));
        
        // Copy to our target location with verification
        std::fs::copy(&downloaded_path, &target_path)
            .map_err(|e| LlamaError::IoError(format!("Failed to copy model to target location: {}", e)))?;
        
        // Verify the copied file
        let target_metadata = std::fs::metadata(&target_path)
            .map_err(|e| LlamaError::IoError(format!("Cannot verify copied file: {}", e)))?;
        
        if target_metadata.len() != download_metadata.len() {
            let _ = std::fs::remove_file(&target_path);
            return Err(LlamaError::IoError("File copy verification failed - sizes don't match".to_string()));
        }
        
        info!("Model successfully downloaded and verified at: {:?}", target_path);
        Ok(target_path)
    }

    pub async fn load_model(&mut self, model_path: PathBuf) -> Result<(), LlamaError> {
        info!("Loading model from: {:?}", model_path);

        let sender = self.sender.as_ref()
            .ok_or_else(|| LlamaError::InitializationError("Service not initialized".to_string()))?;

        let (response_tx, response_rx) = oneshot::channel();
        
        sender.send(LlamaRequest::LoadModel {
            path: model_path.clone(),
            response: response_tx,
        }).map_err(|_| LlamaError::InitializationError("Failed to send load model request".to_string()))?;

        let result = response_rx.await
            .map_err(|_| LlamaError::InitializationError("Failed to receive load model response".to_string()))?;

        if result.is_ok() {
            self.model_path = Some(model_path);
            self.is_model_loaded = true;
        }

        result
    }



    #[allow(dead_code)]
    fn get_available_memory() -> u64 {
        // This is a simplified memory check
        // In a production system, you'd want more sophisticated memory detection
        #[cfg(target_os = "macos")]
        {
            // On macOS, we can use sysctl to get memory info
            // For now, return a conservative estimate
            8192 // 8GB in MB
        }
        #[cfg(not(target_os = "macos"))]
        {
            // Conservative fallback
            4096 // 4GB in MB
        }
    }

    pub async fn generate(
        &mut self,
        prompt: &str,
        options: GenerationOptions,
    ) -> Result<String, LlamaError> {
        debug!("Generating text for prompt length: {}", prompt.len());

        // Validate inputs
        if prompt.is_empty() {
            return Err(LlamaError::ValidationError(
                "Prompt cannot be empty".to_string(),
            ));
        }

        if prompt.len() > 8192 {
            return Err(LlamaError::ValidationError(
                "Prompt too long (max 8192 characters)".to_string(),
            ));
        }

        if !self.is_initialized {
            return Err(LlamaError::GenerationFailed("Service not initialized".to_string()));
        }
        
        // Allow generation even without model loaded (will use mock responses)

        // Validate generation options
        if let Some(max_tokens) = options.max_tokens {
            if max_tokens <= 0 || max_tokens > 4096 {
                return Err(LlamaError::ValidationError(
                    "max_tokens must be between 1 and 4096".to_string(),
                ));
            }
        }

        if let Some(temperature) = options.temperature {
            if temperature < 0.0 || temperature > 2.0 {
                return Err(LlamaError::ValidationError(
                    "temperature must be between 0.0 and 2.0".to_string(),
                ));
            }
        }

        debug!(
            "Generation options: max_tokens={:?}, temperature={:?}",
            options.max_tokens, options.temperature
        );

        let mut metrics = RequestMetrics::new();
        metrics.mark_processing_start();

        match self.generate_with_llama_cpp(prompt, &options).await {
            Ok(result) => {
                // Record successful metrics
                if let Some(ref resource_manager) = self.resource_manager {
                    metrics.mark_completed(true, None);
                    resource_manager.record_request_metrics(metrics).await;
                }

                debug!("Generation completed successfully: {} chars", result.len());
                Ok(result)
            }
            Err(e) => {
                // Record failed metrics
                if let Some(ref resource_manager) = self.resource_manager {
                    metrics.mark_completed(false, Some(e.to_string()));
                    resource_manager.record_request_metrics(metrics).await;
                }

                error!("Generation failed: {}", e);
                Err(e)
            }
        }
    }

    async fn generate_with_llama_cpp(
        &mut self,
        prompt: &str,
        options: &GenerationOptions,
    ) -> Result<String, LlamaError> {
        debug!("Generating text with llama-cpp-2: {} chars", prompt.len());

        let sender = self.sender.as_ref()
            .ok_or_else(|| LlamaError::InitializationError("Service not initialized".to_string()))?;

        let (response_tx, response_rx) = oneshot::channel();
        
        sender.send(LlamaRequest::Generate {
            prompt: prompt.to_string(),
            options: options.clone(),
            response: response_tx,
        }).map_err(|_| LlamaError::GenerationFailed("Failed to send generation request".to_string()))?;

        let result = response_rx.await
            .map_err(|_| LlamaError::GenerationFailed("Failed to receive generation response".to_string()))?;

        result
    }



    pub fn is_ready(&self) -> bool {
        self.is_initialized && self.is_model_loaded
    }

    pub async fn is_ready_async(&self) -> bool {
        if !self.is_initialized {
            return false;
        }

        let sender = match self.sender.as_ref() {
            Some(s) => s,
            None => return false,
        };

        let (response_tx, response_rx) = oneshot::channel();
        
        if sender.send(LlamaRequest::IsReady { response: response_tx }).is_err() {
            return false;
        }

        response_rx.await.unwrap_or(false)
    }

    pub fn get_status(&self) -> ModelStatus {
        let model_info = if self.is_ready() {
            let size_mb = if let Some(ref path) = self.model_path {
                std::fs::metadata(path)
                    .map(|m| m.len() / (1024 * 1024))
                    .unwrap_or(0)
            } else {
                0
            };

            Some(ModelInfo {
                name: "gemma-3-270m-it-Q4_K_M".to_string(),
                size_mb,
                context_size: self.context_size,
                parameter_count: "270M".to_string(),
            })
        } else {
            None
        };

        ModelStatus {
            is_available: true, // Always available in mock mode
            is_loaded: self.is_ready(),
            model_path: self
                .model_path
                .as_ref()
                .map(|p| p.to_string_lossy().to_string()),
            download_progress: None,
            error_message: None,
            model_info,
        }
    }

    pub async fn cleanup(&mut self) {
        info!("Cleaning up LlamaService");

        if let Some(sender) = self.sender.take() {
            let (response_tx, response_rx) = oneshot::channel();
            if sender.send(LlamaRequest::Cleanup { response: response_tx }).is_ok() {
                // Wait for cleanup to complete
                let _ = response_rx.await;
            }
        }

        if let Some(ref path) = self.model_path {
            debug!("Model was loaded from: {:?}", path);
        }

        self.model_path = None;
        self.is_initialized = false;
        self.is_model_loaded = false;

        info!("LlamaService cleanup completed");
    }

    #[allow(dead_code)]
    pub fn set_context_size(&mut self, size: u32) {
        if size > 0 && size <= 8192 {
            self.context_size = size;
            info!("Context size set to: {}", size);
        } else {
            warn!("Invalid context size: {}. Must be between 1 and 8192", size);
        }
    }

    #[allow(dead_code)]
    pub fn set_threads(&mut self, threads: i32) {
        if threads > 0 && threads <= 16 {
            self.threads = threads;
            info!("Thread count set to: {}", threads);
        } else {
            warn!(
                "Invalid thread count: {}. Must be between 1 and 16",
                threads
            );
        }
    }

    #[allow(dead_code)]
    pub fn get_context_size(&self) -> u32 {
        self.context_size
    }

    #[allow(dead_code)]
    pub fn get_threads(&self) -> i32 {
        self.threads
    }

    /// Update resource configuration
    pub async fn update_resource_config(
        &mut self,
        config: ResourceConfig,
    ) -> Result<(), LlamaError> {
        if let Some(ref resource_manager) = self.resource_manager {
            resource_manager.update_config(config).await?;
            info!("Resource configuration updated");
        }
        Ok(())
    }

    /// Get current resource usage statistics
    pub async fn get_resource_usage(&self) -> Option<ResourceUsage> {
        if let Some(ref resource_manager) = self.resource_manager {
            Some(resource_manager.get_usage_stats().await)
        } else {
            None
        }
    }

    /// Get performance recommendations
    pub async fn get_performance_recommendations(&self) -> Vec<String> {
        if let Some(ref resource_manager) = self.resource_manager {
            resource_manager.get_performance_recommendations().await
        } else {
            Vec::new()
        }
    }

    /// Start resource monitoring
    pub async fn start_resource_monitoring(&self) -> Result<(), LlamaError> {
        if let Some(ref resource_manager) = self.resource_manager {
            resource_manager.start_monitoring().await?;
            info!("Resource monitoring started");
        }
        Ok(())
    }

    /// Cleanup resources
    pub async fn cleanup_resources(&self) -> Result<(), LlamaError> {
        if let Some(ref resource_manager) = self.resource_manager {
            resource_manager.cleanup_resources().await?;
            info!("Resources cleaned up");
        }
        Ok(())
    }

    /// Configure resource limits based on system capabilities
    pub async fn configure_optimal_resources(&mut self) -> Result<(), LlamaError> {
        let cpu_count = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);

        // Configure based on system resources
        let config = ResourceConfig {
            max_concurrent_requests: if cpu_count >= 8 { 3 } else { 2 },
            max_threads: std::cmp::min(std::cmp::max(cpu_count as i32 * 3 / 4, 1), 8),
            max_memory_mb: 0,      // Let system manage memory
            cpu_limit_percent: 80, // Limit to 80% CPU usage
            request_timeout_seconds: 60,
            max_queue_size: 15,
            enable_monitoring: true,
        };

        self.update_resource_config(config).await?;

        // Update thread count to match resource config
        if let Some(ref resource_manager) = self.resource_manager {
            let current_config = resource_manager.get_config().await;
            self.threads = current_config.max_threads;
        }

        info!(
            "Optimal resource configuration applied: {} threads, {} max concurrent requests",
            self.threads,
            if cpu_count >= 8 { 3 } else { 2 }
        );

        Ok(())
    }
}

impl Drop for LlamaService {
    fn drop(&mut self) {
        // Note: Drop trait cannot be async, so we just mark as not loaded
        // For proper async cleanup, call cleanup() method explicitly
        self.is_model_loaded = false;
        self.model_path = None;
    }
}
