//! Enhanced tool system with smart parameter inference and context awareness

pub mod task_tools;
pub mod get_tasks_tool;
pub mod update_task_tool;
pub mod timer_tools;

pub use task_tools::CreateTaskTool;
pub use get_tasks_tool::GetTasksTool;
pub use update_task_tool::UpdateTaskTool;
pub use timer_tools::{StartTimerTool, StopTimerTool, TimerStatusTool, ProductivityAnalyticsTool, SmartSessionTool};

use crate::ai::tool_registry::{SmartToolRegistry, PermissionLevel};
use crate::database::repositories::{TaskRepository, TimeTrackingRepository};

/// Initialize and register all KiraPilot tools
pub fn create_kirapilot_tool_registry(
    task_repo: TaskRepository,
    time_repo: TimeTrackingRepository,
    user_permissions: Vec<PermissionLevel>,
) -> SmartToolRegistry {
    let mut registry = SmartToolRegistry::new(user_permissions);
    
    // Register task management tools
    registry.register_tool(Box::new(CreateTaskTool::new(task_repo.clone())));
    registry.register_tool(Box::new(GetTasksTool::new(task_repo.clone())));
    registry.register_tool(Box::new(UpdateTaskTool::new(task_repo.clone())));
    
    // Register timer tools
    registry.register_tool(Box::new(StartTimerTool::new(time_repo.clone(), task_repo.clone())));
    registry.register_tool(Box::new(StopTimerTool::new(time_repo.clone(), task_repo.clone())));
    
    // Register enhanced timer and analytics tools
    registry.register_tool(Box::new(TimerStatusTool::new(time_repo.clone(), task_repo.clone())));
    registry.register_tool(Box::new(ProductivityAnalyticsTool::new(time_repo.clone(), task_repo.clone())));
    registry.register_tool(Box::new(SmartSessionTool::new(time_repo, task_repo)));
    
    registry
}

/// Get default user permissions for tool execution
pub fn get_default_permissions() -> Vec<PermissionLevel> {
    vec![
        PermissionLevel::ReadOnly,
        PermissionLevel::ModifyTasks,
        PermissionLevel::TimerControl,
    ]
}

/// Create a tool registry with full permissions (for admin/development)
pub fn create_admin_tool_registry(
    task_repo: TaskRepository,
    time_repo: TimeTrackingRepository,
) -> SmartToolRegistry {
    create_kirapilot_tool_registry(
        task_repo,
        time_repo,
        vec![PermissionLevel::FullAccess],
    )
}

/// Create a tool registry with read-only permissions
pub fn create_readonly_tool_registry(
    task_repo: TaskRepository,
    time_repo: TimeTrackingRepository,
) -> SmartToolRegistry {
    create_kirapilot_tool_registry(
        task_repo,
        time_repo,
        vec![PermissionLevel::ReadOnly],
    )
}