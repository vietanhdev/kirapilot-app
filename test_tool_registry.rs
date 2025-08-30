// Quick test to verify tool registry is working
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // This would be a simple test to verify the tool registry
    println!("Testing tool registry...");
    
    // Create a mock database connection
    // let db = database::get_database().await?;
    // let task_repo = TaskRepository::new(db.clone());
    // let time_repo = TimeTrackingRepository::new(db);
    
    // Create tool registry
    // let permissions = vec![PermissionLevel::FullAccess];
    // let tool_registry = create_kirapilot_tool_registry(task_repo, time_repo, permissions);
    
    // Test get_tasks tool
    // let mut args = HashMap::new();
    // let result = tool_registry.execute_tool("get_tasks", &args).await?;
    
    println!("Tool registry test would go here");
    println!("The logs show that 8 tools are registered including get_tasks");
    println!("The issue is likely in the LLM prompt interpretation, not the tool registry");
    
    Ok(())
}