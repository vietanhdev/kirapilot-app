use std::collections::HashMap;
use async_trait::async_trait;
use kirapilot_app_lib::ai::{
    AIResult, GenerationOptions, LLMProvider, ModelInfo, ProviderStatus,
    ReActEngine, ToolRegistry
};

/// Comprehensive test suite for realistic user interactions with Kira AI
/// These tests simulate real-world scenarios users might encounter

// Mock LLM Provider for user interaction testing
struct KiraUserProvider {
    scenario: String,
    user_context: UserContext,
}

#[derive(Clone)]
struct UserContext {
    current_time: String,
    #[allow(dead_code)]
    active_tasks: Vec<String>,
    completed_today: usize,
    focus_level: String,
    #[allow(dead_code)]
    recent_activity: String,
}

impl KiraUserProvider {
    fn new(scenario: &str) -> Self {
        let user_context = match scenario {
            "busy_morning" => UserContext {
                current_time: "9:15 AM".to_string(),
                active_tasks: vec![
                    "Prepare presentation for 10 AM meeting".to_string(),
                    "Review quarterly reports".to_string(),
                    "Call client about project update".to_string(),
                ],
                completed_today: 1,
                focus_level: "High".to_string(),
                recent_activity: "Just finished morning standup".to_string(),
            },
            "afternoon_slump" => UserContext {
                current_time: "2:30 PM".to_string(),
                active_tasks: vec![
                    "Write documentation".to_string(),
                    "Code review for PR #123".to_string(),
                ],
                completed_today: 3,
                focus_level: "Low".to_string(),
                recent_activity: "Took a lunch break".to_string(),
            },
            "end_of_day" => UserContext {
                current_time: "5:45 PM".to_string(),
                active_tasks: vec!["Wrap up loose ends".to_string()],
                completed_today: 6,
                focus_level: "Medium".to_string(),
                recent_activity: "Finishing up work".to_string(),
            },
            "planning_session" => UserContext {
                current_time: "8:00 AM".to_string(),
                active_tasks: vec![],
                completed_today: 0,
                focus_level: "High".to_string(),
                recent_activity: "Starting the day".to_string(),
            },
            _ => UserContext {
                current_time: "10:00 AM".to_string(),
                active_tasks: vec!["General task".to_string()],
                completed_today: 2,
                focus_level: "Medium".to_string(),
                recent_activity: "Working".to_string(),
            },
        };

        Self {
            scenario: scenario.to_string(),
            user_context,
        }
    }

    fn generate_contextual_response(&self, prompt: &str) -> String {
        let prompt_lower = prompt.to_lowercase();

        // Handle different types of user requests based on context
        if prompt_lower.contains("what should i work on") || prompt_lower.contains("what's next") ||
           prompt_lower.contains("what should i focus on") || prompt_lower.contains("focus on first") {
            self.generate_task_recommendation()
        } else if prompt_lower.contains("feeling overwhelmed") || prompt_lower.contains("overwhelmed") || 
                  prompt_lower.contains("stressed") {
            self.generate_wellness_response()
        } else if prompt_lower.contains("break") || prompt_lower.contains("rest") {
            self.generate_break_suggestion()
        } else if prompt_lower.contains("let's plan") || prompt_lower.contains("plan my day") || 
                  prompt_lower.contains("want to plan") {
            self.generate_day_planning()
        } else if prompt_lower.contains("focus") || prompt_lower.contains("concentrate") ||
                  prompt_lower.contains("low energy") || prompt_lower.contains("feeling low") {
            self.generate_focus_advice()
        } else if (prompt_lower.contains("time") && prompt_lower.contains("left")) ||
                  prompt_lower.contains("getting late") || prompt_lower.contains("finish up") {
            self.generate_time_assessment()
        } else if prompt_lower.contains("how am i doing") || prompt_lower.contains("how did i do") || 
                  prompt_lower.contains("progress") {
            self.generate_progress_update()
        } else {
            self.generate_general_response()
        }
    }

    fn generate_task_recommendation(&self) -> String {
        match self.scenario.as_str() {
            "busy_morning" => {
                "Answer: Given it's 9:15 AM and you have a presentation at 10 AM, I recommend focusing on 'Prepare presentation for 10 AM meeting' first. This is your most time-sensitive task. After the meeting, you can tackle the quarterly reports review.".to_string()
            },
            "afternoon_slump" => {
                "Answer: It's 2:30 PM and your focus level seems low. I suggest starting with the code review for PR #123 - it's more interactive and might help re-energize you. Save the documentation writing for when you feel more focused, or break it into smaller chunks.".to_string()
            },
            "end_of_day" => {
                "Answer: At 5:45 PM with 6 tasks completed today, you've had a productive day! For 'Wrap up loose ends', I recommend doing a quick review of what you accomplished and preparing a brief plan for tomorrow. Don't start anything too complex this late.".to_string()
            },
            "planning_session" => {
                "Answer: Perfect timing for planning at 8:00 AM! Let's start by reviewing your goals for today. What are your top 3 priorities? I can help you schedule them based on your energy levels and any meetings you have.".to_string()
            },
            _ => "Answer: Let me help you prioritize your tasks based on urgency and your current energy level.".to_string()
        }
    }

    fn generate_progress_update(&self) -> String {
        format!(
            "Answer: You're doing great! As of {}, you've completed {} tasks today. Your current focus level is {}. {} Keep up the momentum!",
            self.user_context.current_time,
            self.user_context.completed_today,
            self.user_context.focus_level.to_lowercase(),
            if self.user_context.completed_today >= 3 { "That's excellent progress." } else { "You're building good momentum." }
        )
    }

    fn generate_wellness_response(&self) -> String {
        match self.user_context.focus_level.as_str() {
            "Low" => "Answer: I understand you're feeling overwhelmed. Let's take a step back. You've already completed 3 tasks today, which is great! Try the 5-4-3-2-1 grounding technique: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. Then we can break your remaining tasks into smaller, manageable pieces.".to_string(),
            _ => "Answer: Feeling overwhelmed is normal, especially when you're being productive. Take 3 deep breaths. Remember, you don't have to do everything at once. Let's prioritize what's truly urgent and consider what can wait until tomorrow.".to_string()
        }
    }

    fn generate_break_suggestion(&self) -> String {
        match self.user_context.current_time.as_str() {
            time if time.contains("AM") => "Answer: A short 5-10 minute break would be perfect right now. Try stepping away from your screen, doing some light stretching, or getting a glass of water. You're in your morning productive zone, so keep the break short to maintain momentum.".to_string(),
            time if time.contains("2:") || time.contains("3:") => "Answer: Great idea! The afternoon is perfect for a longer break. Consider a 15-20 minute walk outside, some light exercise, or a healthy snack. This will help combat the afternoon energy dip and refresh your focus.".to_string(),
            _ => "Answer: A break sounds like exactly what you need. Listen to your body and mind - they're telling you something important. Even 5 minutes of stepping away can make a big difference.".to_string()
        }
    }

    fn generate_day_planning(&self) -> String {
        if self.scenario == "planning_session" {
            "Answer: Excellent! Let's create a structured plan for your day. I recommend using time-blocking: assign specific time slots to your most important tasks. Start with your highest-energy work in the morning, schedule breaks every 90 minutes, and save routine tasks for lower-energy periods. What are your must-do items for today?".to_string()
        } else {
            "Answer: It's great that you want to plan, even mid-day! Let's look at your remaining tasks and available time. We can create a realistic schedule for the rest of your day and set you up for success tomorrow.".to_string()
        }
    }

    fn generate_focus_advice(&self) -> String {
        match self.user_context.focus_level.as_str() {
            "High" => "Answer: Your focus level is already high - that's fantastic! To maintain it, try the Pomodoro technique: 25 minutes of focused work followed by a 5-minute break. Eliminate distractions by closing unnecessary tabs and putting your phone in another room.".to_string(),
            "Low" => "Answer: When focus is low, start small. Pick the easiest task on your list to build momentum, or break a larger task into 10-minute chunks. Sometimes changing your environment (different room, coffee shop, etc.) can help reset your focus.".to_string(),
            _ => "Answer: To improve focus, try the 'two-minute rule': if something takes less than 2 minutes, do it now. For bigger tasks, use time-boxing - commit to working on something for just 15 minutes. Often, starting is the hardest part.".to_string()
        }
    }

    fn generate_time_assessment(&self) -> String {
        match self.user_context.current_time.as_str() {
            time if time.contains("AM") => "Answer: You have most of your day ahead of you! This is prime time for your most important and challenging work. I recommend tackling 2-3 significant tasks before lunch while your energy is high.".to_string(),
            time if time.contains("2:") || time.contains("3:") => "Answer: You have about 2-3 hours left in a typical workday. This is perfect for 1-2 focused tasks or several smaller ones. Consider what you want to accomplish before wrapping up.".to_string(),
            time if time.contains("5:") => "Answer: You're in the final stretch of the day! Focus on wrapping up current work and preparing for tomorrow. This is a great time for planning, organizing, and handling any quick administrative tasks.".to_string(),
            _ => "Answer: Let me help you assess your remaining time and energy to make the most of it.".to_string()
        }
    }

    fn generate_general_response(&self) -> String {
        format!(
            "Answer: I'm here to help you stay productive and balanced. Currently at {}, you've completed {} tasks today and your focus level is {}. What would you like to work on?",
            self.user_context.current_time,
            self.user_context.completed_today,
            self.user_context.focus_level.to_lowercase()
        )
    }
}

#[async_trait]
impl LLMProvider for KiraUserProvider {
    async fn generate(&self, prompt: &str, _options: &GenerationOptions) -> AIResult<String> {
        Ok(self.generate_contextual_response(prompt))
    }

    async fn is_ready(&self) -> bool {
        true
    }

    async fn get_status(&self) -> ProviderStatus {
        ProviderStatus::Ready
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            id: "kira-user-interaction-model".to_string(),
            name: "Kira User Interaction Model".to_string(),
            provider: "test".to_string(),
            version: Some("1.0.0".to_string()),
            max_context_length: Some(4096),
            metadata: HashMap::new(),
        }
    }

    async fn initialize(&mut self) -> AIResult<()> {
        Ok(())
    }

    async fn cleanup(&mut self) -> AIResult<()> {
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

// Mock tool registry for user interaction tests
struct UserInteractionToolRegistry;

impl UserInteractionToolRegistry {
    fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolRegistry for UserInteractionToolRegistry {
    async fn execute_tool(
        &self, 
        tool_name: &str, 
        _args: &std::collections::HashMap<String, serde_json::Value>
    ) -> AIResult<serde_json::Value> {
        let result = match tool_name {
            "get_current_time" => "Current time: 10:30 AM",
            "get_task_status" => "You have 3 active tasks, 2 completed today",
            "start_focus_session" => "Focus session started! 25-minute timer is running.",
            "take_break" => "Break time! Step away from your work for 10 minutes.",
            "get_productivity_tips" => "Tip: Try the 2-minute rule - if it takes less than 2 minutes, do it now!",
            _ => "Tool executed successfully",
        };
        Ok(serde_json::Value::String(result.to_string()))
    }

    fn get_available_tools(&self) -> Vec<String> {
        vec![
            "get_current_time".to_string(),
            "get_task_status".to_string(),
            "start_focus_session".to_string(),
            "take_break".to_string(),
            "get_productivity_tips".to_string(),
        ]
    }

    fn has_tool(&self, tool_name: &str) -> bool {
        matches!(tool_name, 
            "get_current_time" | "get_task_status" | "start_focus_session" | 
            "take_break" | "get_productivity_tips"
        )
    }
}

// Test helper function
async fn run_user_interaction_test(
    scenario: &str,
    user_request: &str,
    expected_keywords: &[&str],
) -> (bool, String) {
    let engine = ReActEngine::new();
    let provider = KiraUserProvider::new(scenario);
    let tool_registry = UserInteractionToolRegistry::new();

    let result = engine.process_request(
        user_request.to_string(),
        &provider,
        Some(&tool_registry),
        None,
    ).await;

    assert!(result.is_ok(), "ReAct execution failed for scenario: {}", scenario);
    let chain = result.unwrap();

    assert!(chain.completed, "Chain should be completed");
    assert!(!chain.final_response.is_empty(), "Should have a final response");

    let response_lower = chain.final_response.to_lowercase();
    let keywords_found = expected_keywords.iter()
        .all(|keyword| response_lower.contains(&keyword.to_lowercase()));

    // Debug output (uncomment for debugging)
    // if !keywords_found {
    //     println!("=== DEBUG INFO ===");
    //     println!("Scenario: {}", scenario);
    //     println!("User request: {}", user_request);
    //     println!("Expected keywords: {:?}", expected_keywords);
    //     println!("Actual response: {}", chain.final_response);
    //     println!("Keywords found: {}", keywords_found);
    //     println!("==================");
    // }

    (keywords_found, chain.final_response)
}

// User Interaction Test Cases

#[tokio::test]
async fn test_busy_morning_prioritization() {
    let (keywords_found, response) = run_user_interaction_test(
        "busy_morning",
        "I have so much to do this morning, what should I work on first?",
        &["presentation", "10 AM", "time-sensitive", "meeting"]
    ).await;

    assert!(keywords_found, "Response should provide clear prioritization guidance");
    assert!(response.contains("9:15 AM") || response.contains("morning"), 
           "Should acknowledge the time context");
    
    println!("✅ Busy morning prioritization test passed");
}

#[tokio::test]
async fn test_afternoon_energy_slump() {
    let (keywords_found, response) = run_user_interaction_test(
        "afternoon_slump",
        "I'm feeling really low energy right now, what should I do?",
        &["focus", "low", "start small", "momentum", "environment"]
    ).await;

    assert!(keywords_found, "Response should address afternoon energy management");
    assert!(response.contains("energize") || response.contains("focus") || response.contains("break"), 
           "Should provide energy management advice");
    
    println!("✅ Afternoon energy slump test passed");
}

#[tokio::test]
async fn test_end_of_day_wrap_up() {
    let (keywords_found, response) = run_user_interaction_test(
        "end_of_day",
        "It's getting late, how should I finish up my day?",
        &["final stretch", "wrapping up", "tomorrow", "administrative", "planning"]
    ).await;

    assert!(keywords_found, "Response should acknowledge end-of-day context");
    assert!(response.contains("final") || response.contains("wrap") || response.contains("tomorrow"), 
           "Should provide end-of-day guidance");
    
    println!("✅ End of day wrap-up test passed");
}

#[tokio::test]
async fn test_morning_planning_session() {
    let (keywords_found, response) = run_user_interaction_test(
        "planning_session",
        "I want to plan my day effectively, can you help?",
        &["excellent", "structured", "time-blocking", "tasks", "morning"]
    ).await;

    assert!(keywords_found, "Response should provide day planning guidance");
    assert!(response.contains("time-blocking") || response.contains("priorities") || response.contains("structure"), 
           "Should offer concrete planning strategies");
    
    println!("✅ Morning planning session test passed");
}

#[tokio::test]
async fn test_overwhelmed_user_support() {
    let (keywords_found, response) = run_user_interaction_test(
        "afternoon_slump",
        "I'm feeling really overwhelmed with everything I need to do",
        &["overwhelmed", "step back", "3 tasks", "grounding", "manageable"]
    ).await;

    assert!(keywords_found, "Response should provide emotional support and practical advice");
    assert!(response.contains("breathe") || response.contains("grounding") || response.contains("smaller"), 
           "Should offer stress management techniques");
    
    println!("✅ Overwhelmed user support test passed");
}

#[tokio::test]
async fn test_break_time_suggestion() {
    let (keywords_found, response) = run_user_interaction_test(
        "afternoon_slump",
        "Should I take a break right now?",
        &["break", "15-20 minute", "walk", "afternoon", "refresh"]
    ).await;

    assert!(keywords_found, "Response should provide appropriate break guidance");
    assert!(response.contains("walk") || response.contains("exercise") || response.contains("refresh"), 
           "Should suggest specific break activities");
    
    println!("✅ Break time suggestion test passed");
}

#[tokio::test]
async fn test_focus_improvement_advice() {
    let (keywords_found, response) = run_user_interaction_test(
        "afternoon_slump",
        "I'm having trouble focusing, any tips?",
        &["focus", "low", "small", "momentum", "environment"]
    ).await;

    assert!(keywords_found, "Response should provide focus improvement strategies");
    assert!(response.contains("start small") || response.contains("momentum") || response.contains("environment"), 
           "Should offer practical focus techniques");
    
    println!("✅ Focus improvement advice test passed");
}

#[tokio::test]
async fn test_time_remaining_assessment() {
    let (keywords_found, response) = run_user_interaction_test(
        "end_of_day",
        "How much time do I have left to work today?",
        &["final stretch", "wrapping up", "tomorrow", "administrative", "planning"]
    ).await;

    assert!(keywords_found, "Response should assess remaining work time");
    assert!(response.contains("final") || response.contains("wrap") || response.contains("tomorrow"), 
           "Should provide time-appropriate guidance");
    
    println!("✅ Time remaining assessment test passed");
}

#[tokio::test]
async fn test_progress_check_in() {
    let (keywords_found, response) = run_user_interaction_test(
        "end_of_day",
        "How am I doing today?",
        &["great", "6 tasks", "completed", "excellent progress", "momentum"]
    ).await;

    assert!(keywords_found, "Response should provide progress feedback");
    assert!(response.contains("great") || response.contains("excellent") || response.contains("productive"), 
           "Should acknowledge achievements positively");
    
    println!("✅ Progress check-in test passed");
}

#[tokio::test]
async fn test_general_assistance_request() {
    let (keywords_found, response) = run_user_interaction_test(
        "busy_morning",
        "Hi Kira, I need some help with my work today",
        &["9:15 AM", "completed", "focus", "momentum", "great"]
    ).await;

    assert!(keywords_found, "Response should offer general assistance");
    assert!(response.contains("great") || response.contains("momentum") || response.contains("focus"), 
           "Should acknowledge current status and provide encouragement");
    
    println!("✅ General assistance request test passed");
}

#[tokio::test]
async fn test_comprehensive_user_journey() {
    // Test a complete user journey through different scenarios
    let scenarios = vec![
        ("planning_session", "Let's plan my day", &["excellent", "structured", "time-blocking"][..]),
        ("busy_morning", "What should I focus on first?", &["presentation", "meeting", "time-sensitive"]),
        ("afternoon_slump", "I need a break", &["break", "walk", "refresh", "afternoon"]),
        ("end_of_day", "How did I do today?", &["great", "completed", "excellent progress"]),
    ];

    let mut all_responses = Vec::new();
    
    for (scenario, request, keywords) in scenarios {
        let (keywords_found, response) = run_user_interaction_test(scenario, request, keywords).await;
        assert!(keywords_found, "Failed for scenario: {} with request: {}", scenario, request);
        all_responses.push(response);
    }

    // Verify we got responses for all scenarios
    assert_eq!(all_responses.len(), 4, "Should have responses for all scenarios");
    
    // Verify responses are contextually different
    let unique_responses: std::collections::HashSet<_> = all_responses.iter().collect();
    assert!(unique_responses.len() >= 3, "Responses should be contextually different");
    
    println!("✅ Comprehensive user journey test passed with {} unique contextual responses", unique_responses.len());
}