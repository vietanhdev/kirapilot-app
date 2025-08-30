pub mod error;
pub mod service_manager;
pub mod llm_provider;
pub mod config;
pub mod interaction_logger;
pub mod providers;
pub mod react_engine;
pub mod provider_manager;
pub mod tool_registry;
pub mod tool_execution_logger;
pub mod tools;
pub mod llm_judge;
pub mod gemma_provider;

#[cfg(test)]
mod provider_switching_test;

#[cfg(test)]
mod service_manager_test;

#[cfg(test)]
mod tauri_commands_test;

#[cfg(test)]
mod simple_tests;





pub use error::*;
pub use service_manager::*;
pub use llm_provider::*;
pub use config::*;
pub use interaction_logger::*;
pub use providers::*;
pub use react_engine::*;
pub use provider_manager::*;
pub use tool_registry::*;
pub use tool_execution_logger::{
    ToolExecutionLogger, PerformanceTracker, ToolExecutionLog, InferenceInfo,
    ToolUsageAnalytics as ToolExecutionAnalytics, ToolReliabilityStats, ToolPerformanceStats,
    ErrorPattern, UsagePatterns, ToolSequence, ToolCorrelation
};
pub use tools::*;
pub use llm_judge::*;
pub use gemma_provider::*;