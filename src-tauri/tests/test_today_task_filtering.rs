// Test for "today" task filtering functionality
// Run with: cargo test --test test_today_task_filtering

use chrono::Utc;

// Simple test data structure for testing
#[derive(Debug, Clone)]
struct MockTask {
    title: String,
    scheduled_date: Option<chrono::DateTime<chrono::Utc>>,
}

impl MockTask {
    fn new(title: &str, scheduled_date: Option<chrono::DateTime<chrono::Utc>>) -> Self {
        Self {
            title: title.to_string(),
            scheduled_date,
        }
    }
}

// Mock filtering logic similar to what GetTasksTool should do
fn filter_tasks_for_today(tasks: &[MockTask]) -> Vec<MockTask> {
    let today = Utc::now().date_naive();
    let start_of_day = today.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end_of_day = today.and_hms_opt(23, 59, 59).unwrap().and_utc();
    
    tasks.iter()
        .filter(|task| {
            if let Some(scheduled) = task.scheduled_date {
                scheduled >= start_of_day && scheduled <= end_of_day
            } else {
                false
            }
        })
        .cloned()
        .collect()
}

fn create_test_tasks() -> Vec<MockTask> {
    let today = Utc::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);
    let tomorrow = today + chrono::Duration::days(1);
    
    vec![
        // Today's tasks
        MockTask::new("Task for Today 1", Some(today.and_hms_opt(9, 0, 0).unwrap().and_utc())),
        MockTask::new("Task for Today 2", Some(today.and_hms_opt(14, 0, 0).unwrap().and_utc())),
        
        // Yesterday's task
        MockTask::new("Yesterday Task", Some(yesterday.and_hms_opt(10, 0, 0).unwrap().and_utc())),
        
        // Tomorrow's task
        MockTask::new("Tomorrow Task", Some(tomorrow.and_hms_opt(11, 0, 0).unwrap().and_utc())),
        
        // Unscheduled task
        MockTask::new("Unscheduled Task", None),
    ]
}

#[tokio::test]
async fn test_today_task_filtering_detection() {
    println!("\n=== Testing Today Task Filtering Detection ===");
    
    // Test messages that should trigger "today" filtering
    let today_messages = vec![
        "list task today",
        "show me today's tasks",
        "what tasks do I have today",
        "tasks for today",
        "today's todo list",
    ];
    
    for message in today_messages {
        println!("\nTesting message: '{}'", message);
        
        // Test the logic that should detect "today" in user messages
        let message_lower = message.to_lowercase();
        let contains_today = message_lower.contains("today") || message_lower.contains("today's");
        
        println!("  Message contains 'today': {}", contains_today);
        
        // Verify that the message would be detected as a "today" request
        assert!(contains_today, "Message '{}' should contain 'today'", message);
    }
}

#[tokio::test]
async fn test_date_range_calculation() {
    println!("\n=== Testing Date Range Calculation ===");
    
    let today = Utc::now().date_naive();
    let start_of_day = today.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end_of_day = today.and_hms_opt(23, 59, 59).unwrap().and_utc();
    
    println!("Today: {}", today);
    println!("Start of day: {}", start_of_day);
    println!("End of day: {}", end_of_day);
    
    // Verify the date range calculation
    assert_eq!(start_of_day.date_naive(), today);
    assert_eq!(end_of_day.date_naive(), today);
    assert!(start_of_day < end_of_day);
    
    // Test that a task scheduled for today would fall within this range
    let task_time = today.and_hms_opt(14, 30, 0).unwrap().and_utc();
    assert!(task_time >= start_of_day && task_time <= end_of_day,
            "Task scheduled for {} should be within today's range", task_time);
}

#[tokio::test]
async fn test_mock_task_filtering() {
    println!("\n=== Testing Mock Task Filtering ===");
    
    let all_tasks = create_test_tasks();
    println!("Total tasks: {}", all_tasks.len());
    assert_eq!(all_tasks.len(), 5, "Should have 5 total tasks");
    
    // Test filtering for today's tasks
    let today_tasks = filter_tasks_for_today(&all_tasks);
    println!("Today's tasks: {}", today_tasks.len());
    
    // Should find exactly 2 tasks scheduled for today
    assert_eq!(today_tasks.len(), 2, "Should have 2 tasks scheduled for today");
    
    // Verify the task titles
    let titles: Vec<&String> = today_tasks.iter().map(|t| &t.title).collect();
    assert!(titles.contains(&&"Task for Today 1".to_string()));
    assert!(titles.contains(&&"Task for Today 2".to_string()));
    
    // Print the filtered tasks
    for task in &today_tasks {
        println!("  - {} (scheduled: {:?})", task.title, task.scheduled_date);
    }
    
    println!("✅ Mock task filtering works correctly");
}

#[tokio::test]
async fn test_filter_inference_logic() {
    println!("\n=== Testing Filter Inference Logic ===");
    
    // Test the logic that should detect "today" in user messages
    let test_cases = vec![
        ("list task today", true),
        ("show me today's tasks", true),
        ("what do I have today", true),
        ("tasks for today", true),
        ("list all tasks", false),
        ("show completed tasks", false),
        ("what tasks are pending", false),
    ];
    
    for (message, should_detect_today) in test_cases {
        let message_lower = message.to_lowercase();
        let contains_today = message_lower.contains("today") || message_lower.contains("today's");
        
        println!("Message: '{}' -> Contains 'today': {}", message, contains_today);
        assert_eq!(contains_today, should_detect_today, 
                  "Message '{}' should {} contain 'today'", 
                  message, if should_detect_today { "" } else { "not" });
    }
    
    println!("✅ Filter inference logic works correctly");
}