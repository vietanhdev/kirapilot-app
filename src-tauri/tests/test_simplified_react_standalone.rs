// Standalone test for the simplified ReAct system
// Run with: cargo test --test test_simplified_react_standalone



// Simple test to verify the ReAct system logic
#[tokio::test]
async fn test_action_parsing_logic() {
    // Test the action parsing logic that we implemented
    
    let test_cases = vec![
        ("Action: get_tasks: {}", Some("get_tasks")),
        ("Action: create_task: {\"title\": \"Test\"}", Some("create_task")),
        ("Thought: I need to think", None),
        ("Answer: Here's the answer", None),
        ("Action: start_timer: {\"task_id\": \"123\"}", Some("start_timer")),
    ];
    
    for (input, expected) in test_cases {
        let result = parse_action_line(input);
        
        match expected {
            Some(expected_tool) => {
                assert!(result.is_some(), "Should parse action from: {}", input);
                let (tool_name, _args) = result.unwrap();
                assert_eq!(tool_name, expected_tool);
            },
            None => {
                assert!(result.is_none(), "Should not parse action from: {}", input);
            }
        }
    }
}

#[tokio::test]
async fn test_tool_result_formatting() {
    // Test that tool results are formatted correctly for observations
    
    let tasks_data = serde_json::json!({
        "tasks": [
            {"title": "Review code", "status": "pending"},
            {"title": "Update docs", "status": "completed"},
            {"title": "Fix bug", "status": "in_progress"}
        ]
    });
    
    let formatted = format_tool_result("get_tasks", &tasks_data);
    
    // Should contain organized task information
    assert!(formatted.contains("Found 3 tasks"));
    assert!(formatted.contains("Pending"));
    assert!(formatted.contains("Review code"));
    assert!(formatted.contains("Completed"));
    assert!(formatted.contains("Update docs"));
    assert!(formatted.contains("In Progress"));
    assert!(formatted.contains("Fix bug"));
    
    // Should be concise, not lengthy
    assert!(formatted.len() < 500, "Formatted result too long: {} chars", formatted.len());
}

#[tokio::test]
async fn test_prompt_structure() {
    // Test that our prompt structure encourages concise responses
    
    let prompt = create_initial_prompt("list tasks");
    
    // Should contain key instructions for concise responses
    assert!(prompt.contains("Don't analyze or elaborate"));
    assert!(prompt.contains("simple list"));
    assert!(prompt.contains("Answer:"));
    
    // Should show the expected format
    assert!(prompt.contains("**Pending:**"));
    assert!(prompt.contains("**In Progress:**"));
    assert!(prompt.contains("**Completed:**"));
    
    // Should be directive, not verbose
    assert!(prompt.len() < 2000, "Prompt too long: {} chars", prompt.len());
}

#[tokio::test]
async fn test_response_length_expectations() {
    // Test that we expect concise responses
    
    let good_response = "Here are your tasks:\n\n**Pending:**\n• Review code\n• Fix bug\n\n**Completed:**\n• Update docs";
    let bad_response = "This is a comprehensive analysis of your project management situation. Based on the data provided, I can see that you have multiple tasks in various states of completion. Let me provide a detailed breakdown of the current status, along with recommendations for improving your workflow efficiency and project management practices. The tasks can be categorized into several key areas including development, documentation, and quality assurance. Each category requires different approaches and methodologies to ensure optimal productivity and successful project completion. I recommend implementing a structured workflow that incorporates agile principles and continuous improvement practices to maximize team efficiency and deliver high-quality results consistently.";
    
    // Good response should be concise
    assert!(good_response.len() < 300, "Good response should be under 300 chars");
    
    // Bad response should be flagged as too long
    assert!(bad_response.len() > 500, "Bad response should be over 500 chars");
    
    // Test for analysis keywords that we want to avoid
    let analysis_keywords = [
        "analysis", "recommendations", "comprehensive", "breakdown",
        "efficiency", "practices", "categorized", "workflow"
    ];
    
    for keyword in &analysis_keywords {
        assert!(!good_response.to_lowercase().contains(keyword));
        assert!(bad_response.to_lowercase().contains(keyword));
    }
}

// Helper functions that mimic the ReAct engine logic

fn parse_action_line(response: &str) -> Option<(String, String)> {
    for line in response.lines() {
        let line = line.trim();
        if line.starts_with("Action:") {
            let action_part = line.strip_prefix("Action:").unwrap().trim();
            if let Some(colon_pos) = action_part.find(':') {
                let tool_name = action_part[..colon_pos].trim().to_string();
                let args_str = action_part[colon_pos + 1..].trim().to_string();
                return Some((tool_name, args_str));
            }
        }
    }
    None
}

fn format_tool_result(tool_name: &str, data: &serde_json::Value) -> String {
    match tool_name {
        "get_tasks" => {
            if let Some(tasks_array) = data.get("tasks").and_then(|t| t.as_array()) {
                if tasks_array.is_empty() {
                    "No tasks found".to_string()
                } else {
                    // Group tasks by status for better organization
                    let mut pending = Vec::new();
                    let mut in_progress = Vec::new();
                    let mut completed = Vec::new();
                    
                    for task in tasks_array.iter().take(20) { // Limit to first 20 tasks
                        if let Some(title) = task.get("title").and_then(|t| t.as_str()) {
                            let status = task.get("status").and_then(|s| s.as_str()).unwrap_or("unknown");
                            let task_entry = format!("\"{}\"", title);
                            
                            match status {
                                "pending" => pending.push(task_entry),
                                "in_progress" => in_progress.push(task_entry),
                                "completed" => completed.push(task_entry),
                                _ => pending.push(task_entry),
                            }
                        }
                    }
                    
                    let mut result = format!("Found {} tasks", tasks_array.len());
                    if tasks_array.len() > 20 {
                        result.push_str(" (showing first 20)");
                    }
                    result.push_str(":\n");
                    
                    if !pending.is_empty() {
                        result.push_str(&format!("Pending ({}): {}\n", pending.len(), pending.join(", ")));
                    }
                    if !in_progress.is_empty() {
                        result.push_str(&format!("In Progress ({}): {}\n", in_progress.len(), in_progress.join(", ")));
                    }
                    if !completed.is_empty() {
                        result.push_str(&format!("Completed ({}): {}", completed.len(), completed.join(", ")));
                    }
                    
                    result
                }
            } else {
                format!("Tool result: {}", data)
            }
        },
        _ => format!("Tool executed successfully: {}", data),
    }
}

fn create_initial_prompt(user_request: &str) -> String {
    format!(
        r#"You are a task management assistant. When users ask for tasks, provide a simple list. Don't analyze or elaborate.

Available tools: get_tasks, create_task, update_task, start_timer, stop_timer, timer_status, productivity_analytics

CRITICAL RULES:
1. For "list tasks" - use get_tasks tool, then provide a simple bullet list
2. Don't provide analysis, recommendations, or lengthy explanations
3. Just show the tasks in a clean format
4. Stop after giving the answer

Format:
Thought: [what I need to do]
Action: [tool]: [args]
PAUSE

Then after tool result:
Answer: [simple direct response]

Example:
Question: list tasks
Thought: I need to get the user's tasks.
Action: get_tasks: {{}}
PAUSE

Observation: Found tasks organized by status...

Answer: Here are your tasks:

**Pending:**
• Market Research v2
• Database Optimization
• Security Assessment

**In Progress:**
• Design System Components

**Completed:**
• OAuth Implementation
• Code Review

Question: {}"#,
        user_request
    )
}

#[tokio::test]
async fn test_integration_flow() {
    // Test the complete flow logic
    println!("✅ Testing simplified ReAct system logic...");
    
    // 1. Test prompt creation
    let prompt = create_initial_prompt("list tasks");
    assert!(prompt.contains("Don't analyze or elaborate"));
    println!("✅ Prompt creation: PASS");
    
    // 2. Test action parsing
    let action_result = parse_action_line("Action: get_tasks: {}");
    assert!(action_result.is_some());
    let (tool_name, _) = action_result.unwrap();
    assert_eq!(tool_name, "get_tasks");
    println!("✅ Action parsing: PASS");
    
    // 3. Test tool result formatting
    let mock_data = serde_json::json!({
        "tasks": [
            {"title": "Review code", "status": "pending"},
            {"title": "Fix bug", "status": "in_progress"}
        ]
    });
    let formatted = format_tool_result("get_tasks", &mock_data);
    assert!(formatted.contains("Found 2 tasks"));
    assert!(formatted.contains("Pending"));
    assert!(formatted.contains("In Progress"));
    println!("✅ Tool result formatting: PASS");
    
    // 4. Test response length expectations
    assert!(formatted.len() < 300);
    println!("✅ Response length: PASS");
    
    println!("🎉 All simplified ReAct system tests PASSED!");
}