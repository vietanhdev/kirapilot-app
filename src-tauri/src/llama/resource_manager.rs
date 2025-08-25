use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Semaphore, RwLock};
use tokio::time::sleep;
use serde::{Deserialize, Serialize};
use log::{info, warn, debug};

use super::error::LlamaError;

/// Resource configuration for the local model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceConfig {
    /// Maximum number of concurrent requests
    pub max_concurrent_requests: usize,
    /// Maximum number of threads to use
    pub max_threads: i32,
    /// Maximum memory usage in MB (0 = unlimited)
    pub max_memory_mb: u64,
    /// CPU usage limit as percentage (0-100, 0 = unlimited)
    pub cpu_limit_percent: u8,
    /// Request timeout in seconds
    pub request_timeout_seconds: u64,
    /// Queue size limit
    pub max_queue_size: usize,
    /// Enable performance monitoring
    pub enable_monitoring: bool,
}

impl Default for ResourceConfig {
    fn default() -> Self {
        Self {
            max_concurrent_requests: 2,
            max_threads: Self::detect_optimal_threads(),
            max_memory_mb: 0, // Unlimited by default
            cpu_limit_percent: 0, // Unlimited by default
            request_timeout_seconds: 30,
            max_queue_size: 10,
            enable_monitoring: true,
        }
    }
}

impl ResourceConfig {
    fn detect_optimal_threads() -> i32 {
        let cpu_count = std::thread::available_parallelism()
            .map(|n| n.get() as i32)
            .unwrap_or(4);
        
        // Use 75% of available cores, minimum 1, maximum 8
        std::cmp::min(std::cmp::max(cpu_count * 3 / 4, 1), 8)
    }
}

/// Resource usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// Current memory usage in MB
    pub memory_usage_mb: u64,
    /// Current CPU usage percentage
    pub cpu_usage_percent: f32,
    /// Number of active requests
    pub active_requests: usize,
    /// Number of queued requests
    pub queued_requests: usize,
    /// Average request processing time in milliseconds
    pub avg_processing_time_ms: u64,
    /// Total requests processed
    pub total_requests: u64,
    /// Failed requests count
    pub failed_requests: u64,
    /// Last updated timestamp
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

impl Default for ResourceUsage {
    fn default() -> Self {
        Self {
            memory_usage_mb: 0,
            cpu_usage_percent: 0.0,
            active_requests: 0,
            queued_requests: 0,
            avg_processing_time_ms: 0,
            total_requests: 0,
            failed_requests: 0,
            last_updated: chrono::Utc::now(),
        }
    }
}

/// Performance metrics for a single request
#[derive(Debug, Clone)]
pub struct RequestMetrics {
    pub start_time: Instant,
    pub end_time: Option<Instant>,
    pub queue_time_ms: u64,
    pub processing_time_ms: u64,
    pub success: bool,
    pub error_message: Option<String>,
}

impl RequestMetrics {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            end_time: None,
            queue_time_ms: 0,
            processing_time_ms: 0,
            success: false,
            error_message: None,
        }
    }

    pub fn mark_processing_start(&mut self) {
        self.queue_time_ms = self.start_time.elapsed().as_millis() as u64;
    }

    pub fn mark_completed(&mut self, success: bool, error: Option<String>) {
        self.end_time = Some(Instant::now());
        self.processing_time_ms = self.start_time.elapsed().as_millis() as u64 - self.queue_time_ms;
        self.success = success;
        self.error_message = error;
    }
}

/// Resource manager for controlling and monitoring local model resource usage
pub struct ResourceManager {
    config: Arc<RwLock<ResourceConfig>>,
    usage_stats: Arc<RwLock<ResourceUsage>>,
    request_semaphore: Arc<Semaphore>,
    request_metrics: Arc<Mutex<Vec<RequestMetrics>>>,
    system_monitor: Arc<Mutex<SystemMonitor>>,
}

impl ResourceManager {
    pub fn new(config: ResourceConfig) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_requests));
        
        Self {
            request_semaphore: semaphore,
            config: Arc::new(RwLock::new(config)),
            usage_stats: Arc::new(RwLock::new(ResourceUsage::default())),
            request_metrics: Arc::new(Mutex::new(Vec::new())),
            system_monitor: Arc::new(Mutex::new(SystemMonitor::new())),
        }
    }

    /// Update resource configuration
    pub async fn update_config(&self, new_config: ResourceConfig) -> Result<(), LlamaError> {
        info!("Updating resource configuration");
        
        let mut config = self.config.write().await;
        let old_concurrent_limit = config.max_concurrent_requests;
        
        *config = new_config;
        
        // Update semaphore if concurrent limit changed
        if old_concurrent_limit != config.max_concurrent_requests {
            // Note: In a production system, you'd want to handle this more gracefully
            // by gradually adjusting the semaphore permits
            warn!("Concurrent request limit changed from {} to {}", 
                  old_concurrent_limit, config.max_concurrent_requests);
        }
        
        info!("Resource configuration updated successfully");
        Ok(())
    }

    /// Get current resource configuration
    pub async fn get_config(&self) -> ResourceConfig {
        self.config.read().await.clone()
    }

    /// Get current resource usage statistics
    pub async fn get_usage_stats(&self) -> ResourceUsage {
        self.usage_stats.read().await.clone()
    }

    /// Acquire resources for a request with timeout and queuing
    pub async fn acquire_request_slot(&self) -> Result<RequestGuard, LlamaError> {
        let config = self.config.read().await;
        let timeout = Duration::from_secs(config.request_timeout_seconds);
        drop(config);

        debug!("Attempting to acquire request slot");

        // Check if we're under resource pressure
        if let Err(e) = self.check_resource_constraints().await {
            warn!("Resource constraints violated: {}", e);
            return Err(e);
        }

        // Try to acquire semaphore permit with timeout
        let permit = match tokio::time::timeout(timeout, self.request_semaphore.acquire()).await {
            Ok(Ok(permit)) => permit,
            Ok(Err(_)) => {
                return Err(LlamaError::InsufficientResources(
                    "Semaphore closed".to_string()
                ));
            }
            Err(_) => {
                return Err(LlamaError::InsufficientResources(
                    "Request timeout: too many concurrent requests".to_string()
                ));
            }
        };

        debug!("Request slot acquired successfully");

        // Update active request count
        {
            let mut stats = self.usage_stats.write().await;
            stats.active_requests += 1;
            stats.last_updated = chrono::Utc::now();
        }

        // Don't store the permit, just use it for the semaphore behavior
        std::mem::forget(permit); // Prevent automatic drop
        Ok(RequestGuard::new(self.usage_stats.clone()))
    }

    /// Check if current resource usage is within constraints
    async fn check_resource_constraints(&self) -> Result<(), LlamaError> {
        let config = self.config.read().await;
        let stats = self.usage_stats.read().await;

        // Check queue size
        if stats.queued_requests >= config.max_queue_size {
            return Err(LlamaError::InsufficientResources(
                format!("Queue full: {} requests queued (max: {})", 
                       stats.queued_requests, config.max_queue_size)
            ));
        }

        // Check memory usage if limit is set
        if config.max_memory_mb > 0 && stats.memory_usage_mb > config.max_memory_mb {
            return Err(LlamaError::InsufficientResources(
                format!("Memory limit exceeded: {} MB used (max: {} MB)", 
                       stats.memory_usage_mb, config.max_memory_mb)
            ));
        }

        // Check CPU usage if limit is set
        if config.cpu_limit_percent > 0 && stats.cpu_usage_percent > config.cpu_limit_percent as f32 {
            return Err(LlamaError::InsufficientResources(
                format!("CPU limit exceeded: {:.1}% used (max: {}%)", 
                       stats.cpu_usage_percent, config.cpu_limit_percent)
            ));
        }

        Ok(())
    }

    /// Record request metrics
    pub async fn record_request_metrics(&self, metrics: RequestMetrics) {
        let mut metrics_vec = self.request_metrics.lock().await;
        metrics_vec.push(metrics.clone());

        // Keep only last 100 metrics to prevent memory growth
        if metrics_vec.len() > 100 {
            let excess = metrics_vec.len() - 100;
            metrics_vec.drain(0..excess);
        }

        // Update usage statistics
        {
            let mut stats = self.usage_stats.write().await;
            stats.total_requests += 1;
            
            if !metrics.success {
                stats.failed_requests += 1;
            }

            // Calculate average processing time
            let recent_metrics: Vec<_> = metrics_vec.iter()
                .filter(|m| m.success && m.processing_time_ms > 0)
                .take(20) // Last 20 successful requests
                .collect();

            if !recent_metrics.is_empty() {
                let total_time: u64 = recent_metrics.iter()
                    .map(|m| m.processing_time_ms)
                    .sum();
                stats.avg_processing_time_ms = total_time / recent_metrics.len() as u64;
            }

            stats.last_updated = chrono::Utc::now();
        }

        debug!("Request metrics recorded: success={}, processing_time={}ms", 
               metrics.success, metrics.processing_time_ms);
    }

    /// Start background monitoring task
    pub async fn start_monitoring(&self) -> Result<(), LlamaError> {
        let config = self.config.read().await;
        if !config.enable_monitoring {
            debug!("Resource monitoring disabled");
            return Ok(());
        }
        drop(config);

        info!("Starting resource monitoring");

        let usage_stats = self.usage_stats.clone();
        let system_monitor = self.system_monitor.clone();
        let config_ref = self.config.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            
            loop {
                interval.tick().await;

                let config = config_ref.read().await;
                if !config.enable_monitoring {
                    break;
                }
                drop(config);

                // Update system metrics
                let mut monitor = system_monitor.lock().await;
                if let Err(e) = monitor.update_metrics().await {
                    warn!("Failed to update system metrics: {}", e);
                    continue;
                }

                let system_metrics = monitor.get_metrics();
                drop(monitor);

                // Update usage statistics
                {
                    let mut stats = usage_stats.write().await;
                    stats.memory_usage_mb = system_metrics.memory_usage_mb;
                    stats.cpu_usage_percent = system_metrics.cpu_usage_percent;
                    stats.last_updated = chrono::Utc::now();
                }

                debug!("Resource monitoring update: memory={}MB, cpu={:.1}%", 
                       system_metrics.memory_usage_mb, system_metrics.cpu_usage_percent);
            }

            info!("Resource monitoring stopped");
        });

        Ok(())
    }

    /// Perform cleanup operations to free resources
    pub async fn cleanup_resources(&self) -> Result<(), LlamaError> {
        info!("Performing resource cleanup");

        // Clear old metrics
        {
            let mut metrics = self.request_metrics.lock().await;
            if metrics.len() > 50 {
                let excess = metrics.len() - 50;
                metrics.drain(0..excess);
                debug!("Cleaned up old request metrics");
            }
        }

        // Reset usage statistics for non-persistent data
        {
            let mut stats = self.usage_stats.write().await;
            // Keep counters but reset current usage
            stats.memory_usage_mb = 0;
            stats.cpu_usage_percent = 0.0;
            stats.active_requests = 0;
            stats.queued_requests = 0;
            stats.last_updated = chrono::Utc::now();
        }

        info!("Resource cleanup completed");
        Ok(())
    }

    /// Get performance recommendations based on current usage
    pub async fn get_performance_recommendations(&self) -> Vec<String> {
        let stats = self.usage_stats.read().await;
        let config = self.config.read().await;
        let mut recommendations = Vec::new();

        // High failure rate
        if stats.total_requests > 10 && stats.failed_requests as f32 / stats.total_requests as f32 > 0.2 {
            recommendations.push("High failure rate detected. Consider reducing concurrent requests or increasing timeout.".to_string());
        }

        // Slow processing
        if stats.avg_processing_time_ms > 10000 {
            recommendations.push("Slow processing detected. Consider reducing context size or using fewer threads.".to_string());
        }

        // High memory usage
        if config.max_memory_mb > 0 && stats.memory_usage_mb > config.max_memory_mb * 8 / 10 {
            recommendations.push("High memory usage. Consider reducing context size or concurrent requests.".to_string());
        }

        // High CPU usage
        if config.cpu_limit_percent > 0 && stats.cpu_usage_percent > config.cpu_limit_percent as f32 * 0.8 {
            recommendations.push("High CPU usage. Consider reducing thread count or concurrent requests.".to_string());
        }

        // Queue pressure
        if stats.queued_requests > config.max_queue_size / 2 {
            recommendations.push("High queue pressure. Consider increasing concurrent request limit.".to_string());
        }

        recommendations
    }
}

/// RAII guard for request resources
pub struct RequestGuard {
    usage_stats: Arc<RwLock<ResourceUsage>>,
}

impl RequestGuard {
    fn new(usage_stats: Arc<RwLock<ResourceUsage>>) -> Self {
        Self {
            usage_stats,
        }
    }
}

impl Drop for RequestGuard {
    fn drop(&mut self) {
        // Update active request count when guard is dropped
        let usage_stats = self.usage_stats.clone();
        tokio::spawn(async move {
            let mut stats = usage_stats.write().await;
            if stats.active_requests > 0 {
                stats.active_requests -= 1;
            }
            stats.last_updated = chrono::Utc::now();
        });
    }
}

/// System metrics monitor
struct SystemMonitor {
    #[allow(dead_code)]
    last_cpu_time: Option<u64>,
    last_measurement: Option<Instant>,
}

#[derive(Debug, Clone)]
struct SystemMetrics {
    memory_usage_mb: u64,
    cpu_usage_percent: f32,
}

impl SystemMonitor {
    fn new() -> Self {
        Self {
            last_cpu_time: None,
            last_measurement: None,
        }
    }

    async fn update_metrics(&mut self) -> Result<(), LlamaError> {
        // This is a simplified implementation
        // In production, you'd use platform-specific APIs for accurate metrics
        
        // Simulate some delay for async operation
        sleep(Duration::from_millis(10)).await;
        
        self.last_measurement = Some(Instant::now());
        Ok(())
    }

    fn get_metrics(&self) -> SystemMetrics {
        // Simplified metrics - in production use proper system APIs
        SystemMetrics {
            memory_usage_mb: self.get_process_memory_usage(),
            cpu_usage_percent: self.get_process_cpu_usage(),
        }
    }

    fn get_process_memory_usage(&self) -> u64 {
        // Simplified memory usage calculation
        // In production, use platform-specific APIs like:
        // - macOS: task_info with TASK_BASIC_INFO
        // - Linux: /proc/self/status
        // - Windows: GetProcessMemoryInfo
        
        #[cfg(target_os = "macos")]
        {
            // Placeholder for macOS memory usage
            150 // Assume ~150MB for the model
        }
        #[cfg(not(target_os = "macos"))]
        {
            // Placeholder for other platforms
            150
        }
    }

    fn get_process_cpu_usage(&self) -> f32 {
        // Simplified CPU usage calculation
        // In production, calculate based on process CPU time differences
        
        // Return a reasonable estimate based on system load
        let load = std::thread::available_parallelism()
            .map(|n| n.get() as f32)
            .unwrap_or(4.0);
        
        // Simulate variable CPU usage between 5-25%
        5.0 + (load * 2.5)
    }
}