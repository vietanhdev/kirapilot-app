use std::collections::HashMap;

use async_trait::async_trait;
use chrono::{DateTime, Datelike, Utc};

use crate::ai::tool_registry::{
    InferredParameters, ParameterDefinition, ParameterValidation, PermissionLevel, Tool,
    ToolCapability, ToolContext, ToolExample, ToolExecutionResult,
};
use crate::ai::AIResult;
use crate::database::repositories::{TaskFilters, TaskRepository};

/// Get tasks tool with smart filtering and context awareness
pub struct GetTasksTool {
    task_repo: TaskRepository,
}

impl GetTasksTool {
    pub fn new(task_repo: TaskRepository) -> Self {
        Self { task_repo }
    }

    /// Analyze user message to infer what tasks they want to see
    fn infer_task_filters(&self, message: &str, context: &ToolContext) -> TaskFilters {
        let message_lower = message.to_lowercase();
        let mut filters = TaskFilters::default();

        // Status filtering
        if message_lower.contains("completed")
            || message_lower.contains("done")
            || message_lower.contains("finished")
        {
            filters.status = Some(vec!["completed".to_string()]);
        } else if message_lower.contains("pending")
            || message_lower.contains("todo")
            || message_lower.contains("not started")
        {
            filters.status = Some(vec!["pending".to_string()]);
        } else if message_lower.contains("in progress")
            || message_lower.contains("working on")
            || message_lower.contains("current")
        {
            filters.status = Some(vec!["in_progress".to_string()]);
        } else if message_lower.contains("active") || message_lower.contains("open") {
            filters.status = Some(vec!["pending".to_string(), "in_progress".to_string()]);
        }

        // Priority filtering
        if message_lower.contains("urgent") || message_lower.contains("critical") {
            filters.priority = Some(vec![3]);
        } else if message_lower.contains("high priority") || message_lower.contains("important") {
            filters.priority = Some(vec![2, 3]);
        } else if message_lower.contains("low priority") || message_lower.contains("minor") {
            filters.priority = Some(vec![0]);
        }

        // Time-based filtering
        if message_lower.contains("today") || message_lower.contains("today's") {
            // Filter tasks scheduled for today or due today
            let today = Utc::now().date_naive();
            filters.scheduled_date = Some(today);
        } else if message_lower.contains("this week") || message_lower.contains("weekly") {
            // Filter tasks for this week
            let start_of_week = Utc::now().date_naive()
                - chrono::Duration::days(Utc::now().weekday().num_days_from_monday() as i64);
            filters.scheduled_date_range =
                Some((start_of_week, start_of_week + chrono::Duration::weeks(1)));
        } else if message_lower.contains("overdue") || message_lower.contains("late") {
            filters.overdue_only = Some(true);
        }

        // Search terms
        let search_terms = self.extract_search_terms(&message_lower);
        if !search_terms.is_empty() {
            filters.search = Some(search_terms.join(" "));
        }

        // Tag filtering
        let tags = self.extract_tag_filters(&message_lower);
        if !tags.is_empty() {
            filters.tags = Some(tags);
        }

        // Context-based filtering
        if let Some(active_task_id) = &context.active_task_id {
            // If user asks about "this task" or "current task", filter to active task
            if message_lower.contains("this task") || message_lower.contains("current task") {
                filters.task_ids = Some(vec![active_task_id.clone()]);
            }
        }

        // Recent tasks context
        if message_lower.contains("recent") || message_lower.contains("latest") {
            filters.limit = Some(10);
            filters.sort_by = Some("created_at".to_string());
            filters.sort_order = Some("desc".to_string());
        }

        filters
    }

    fn extract_search_terms(&self, message: &str) -> Vec<String> {
        let mut search_terms = Vec::new();

        // Look for quoted search terms
        let mut chars = message.chars().peekable();
        let mut in_quotes = false;
        let mut current_term = String::new();

        while let Some(ch) = chars.next() {
            match ch {
                '"' | '\'' => {
                    if in_quotes {
                        if !current_term.trim().is_empty() {
                            search_terms.push(current_term.trim().to_string());
                        }
                        current_term.clear();
                        in_quotes = false;
                    } else {
                        in_quotes = true;
                    }
                }
                _ if in_quotes => {
                    current_term.push(ch);
                }
                _ => {}
            }
        }

        // If no quoted terms, look for keywords after "containing", "with", "about", etc.
        if search_terms.is_empty() {
            let search_indicators = ["containing", "with", "about", "related to", "for"];
            for indicator in &search_indicators {
                if let Some(pos) = message.find(indicator) {
                    let remaining = &message[pos + indicator.len()..];
                    let terms: Vec<String> = remaining
                        .split_whitespace()
                        .take(3) // Take up to 3 words
                        .filter(|word| word.len() > 2 && !self.is_stop_word(word))
                        .map(|word| word.to_string())
                        .collect();

                    if !terms.is_empty() {
                        search_terms.extend(terms);
                        break;
                    }
                }
            }
        }

        search_terms
    }

    fn extract_tag_filters(&self, message: &str) -> Vec<String> {
        let mut tags = Vec::new();

        // Look for hashtags
        for word in message.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                tags.push(word[1..].to_string());
            }
        }

        // Look for explicit tag mentions
        if message.contains("tagged") || message.contains("tag:") {
            // Extract tags after "tagged" or "tag:"
            let tag_indicators = ["tagged with", "tagged as", "tag:"];
            for indicator in &tag_indicators {
                if let Some(pos) = message.find(indicator) {
                    let remaining = &message[pos + indicator.len()..];
                    let tag_words: Vec<String> = remaining
                        .split(&[' ', ',', ';'][..])
                        .take(5)
                        .filter(|word| !word.trim().is_empty() && word.len() > 1)
                        .map(|word| word.trim().to_string())
                        .collect();

                    tags.extend(tag_words);
                    break;
                }
            }
        }

        // Infer common category tags
        let category_mappings = [
            (
                "work",
                vec!["work", "office", "business", "meeting", "project"],
            ),
            ("personal", vec!["personal", "home", "family", "life"]),
            (
                "development",
                vec!["code", "programming", "development", "bug", "feature"],
            ),
            ("research", vec!["research", "study", "learn", "reading"]),
        ];

        for (tag, keywords) in &category_mappings {
            for keyword in keywords {
                if message.contains(keyword) {
                    tags.push(tag.to_string());
                    break;
                }
            }
        }

        tags.sort();
        tags.dedup();
        tags
    }

    fn is_stop_word(&self, word: &str) -> bool {
        let stop_words = [
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "by", "from", "up", "about", "into", "through", "during", "before", "after", "above",
            "below", "between", "among", "is", "are", "was", "were", "be", "been", "being", "have",
            "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
            "must", "can", "tasks", "task", "show", "list", "get", "find", "search",
        ];

        stop_words.contains(&word.to_lowercase().as_str())
    }

    fn apply_additional_filters(
        &self,
        mut tasks: Vec<crate::database::entities::tasks::Model>,
        filters: &TaskFilters,
    ) -> Vec<crate::database::entities::tasks::Model> {
        // Apply priority filtering
        if let Some(priorities) = &filters.priority {
            tasks.retain(|task| priorities.contains(&(task.priority as u32)));
        }

        // Apply search filtering
        if let Some(search_term) = &filters.search {
            let search_lower = search_term.to_lowercase();
            tasks.retain(|task| {
                task.title.to_lowercase().contains(&search_lower)
                    || task
                        .description
                        .as_ref()
                        .map_or(false, |desc| desc.to_lowercase().contains(&search_lower))
            });
        }

        // Apply tag filtering
        if let Some(filter_tags) = &filters.tags {
            tasks.retain(|task| {
                if let Some(task_tags_str) = &task.tags {
                    if let Ok(task_tags) = serde_json::from_str::<Vec<String>>(task_tags_str) {
                        filter_tags
                            .iter()
                            .any(|filter_tag| task_tags.contains(filter_tag))
                    } else {
                        false
                    }
                } else {
                    false
                }
            });
        }

        // Apply task ID filtering
        if let Some(task_ids) = &filters.task_ids {
            tasks.retain(|task| task_ids.contains(&task.id));
        }

        // Apply overdue filtering
        if let Some(true) = filters.overdue_only {
            let now = chrono::Utc::now();
            tasks.retain(|task| {
                task.due_date.map_or(false, |due_date| due_date < now) && task.status != "completed"
            });
        }

        // Apply limit
        if let Some(limit) = filters.limit {
            tasks.truncate(limit);
        }

        // Apply sorting
        if let Some(sort_by) = &filters.sort_by {
            match sort_by.as_str() {
                "created_at" => {
                    if filters.sort_order.as_deref() == Some("desc") {
                        tasks.sort_by(|a, b| b.created_at.cmp(&a.created_at));
                    } else {
                        tasks.sort_by(|a, b| a.created_at.cmp(&b.created_at));
                    }
                }
                "priority" => {
                    if filters.sort_order.as_deref() == Some("desc") {
                        tasks.sort_by(|a, b| b.priority.cmp(&a.priority));
                    } else {
                        tasks.sort_by(|a, b| a.priority.cmp(&b.priority));
                    }
                }
                "due_date" => {
                    tasks.sort_by(|a, b| match (a.due_date, b.due_date) {
                        (Some(a_due), Some(b_due)) => {
                            if filters.sort_order.as_deref() == Some("desc") {
                                b_due.cmp(&a_due)
                            } else {
                                a_due.cmp(&b_due)
                            }
                        }
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (None, None) => std::cmp::Ordering::Equal,
                    });
                }
                _ => {} // Unknown sort field, keep original order
            }
        }

        tasks
    }

    fn generate_summary(&self, tasks: &[serde_json::Value], filters: &TaskFilters) -> String {
        let total_count = tasks.len();

        if total_count == 0 {
            return "📝 No tasks found matching your criteria.".to_string();
        }

        let mut summary = format!(
            "📝 Found {} task{}",
            total_count,
            if total_count == 1 { "" } else { "s" }
        );

        // Add filter context to summary
        let mut filter_descriptions = Vec::new();

        if let Some(status) = &filters.status {
            if status.len() == 1 {
                filter_descriptions.push(format!("with status '{}'", status[0]));
            } else {
                filter_descriptions.push(format!("with status in [{}]", status.join(", ")));
            }
        }

        if let Some(priority) = &filters.priority {
            let priority_names: Vec<String> = priority
                .iter()
                .map(|p| match p {
                    0 => "Low",
                    1 => "Medium",
                    2 => "High",
                    3 => "Urgent",
                    _ => "Unknown",
                })
                .map(|s| s.to_string())
                .collect();

            if priority_names.len() == 1 {
                filter_descriptions.push(format!("with {} priority", priority_names[0]));
            } else {
                filter_descriptions
                    .push(format!("with priority in [{}]", priority_names.join(", ")));
            }
        }

        if let Some(search) = &filters.search {
            filter_descriptions.push(format!("containing '{}'", search));
        }

        if let Some(tags) = &filters.tags {
            if tags.len() == 1 {
                filter_descriptions.push(format!("tagged with '{}'", tags[0]));
            } else {
                filter_descriptions.push(format!("tagged with [{}]", tags.join(", ")));
            }
        }

        if !filter_descriptions.is_empty() {
            summary.push_str(&format!(" {}", filter_descriptions.join(" and ")));
        }

        summary.push_str(":\n\n");

        // Add task previews (first 5 tasks)
        let preview_count = std::cmp::min(5, total_count);
        for (i, task) in tasks.iter().take(preview_count).enumerate() {
            let title = task
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled");
            let status = task
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let priority = task.get("priority").and_then(|v| v.as_u64()).unwrap_or(1);

            let priority_emoji = match priority {
                0 => "🔵", // Low
                1 => "🟡", // Medium
                2 => "🟠", // High
                3 => "🔴", // Urgent
                _ => "⚪",
            };

            let status_emoji = match status {
                "completed" => "✅",
                "in_progress" => "🔄",
                "pending" => "⏳",
                "cancelled" => "❌",
                _ => "📝",
            };

            summary.push_str(&format!(
                "{}. {} {} **{}**",
                i + 1,
                status_emoji,
                priority_emoji,
                title
            ));

            // Add due date if present
            if let Some(due_date) = task.get("due_date").and_then(|v| v.as_str()) {
                if let Ok(date) = DateTime::parse_from_rfc3339(due_date) {
                    let formatted_date = date.format("%m/%d").to_string();
                    summary.push_str(&format!(" (due {})", formatted_date));
                }
            }

            // Add time estimate if present
            if let Some(time_est) = task.get("time_estimate").and_then(|v| v.as_u64()) {
                if time_est > 0 {
                    let hours = time_est / 60;
                    let minutes = time_est % 60;
                    if hours > 0 {
                        summary.push_str(&format!(" ({}h{}m)", hours, minutes));
                    } else {
                        summary.push_str(&format!(" ({}m)", minutes));
                    }
                }
            }

            summary.push('\n');
        }

        if total_count > preview_count {
            summary.push_str(&format!(
                "\n... and {} more task{}",
                total_count - preview_count,
                if total_count - preview_count == 1 {
                    ""
                } else {
                    "s"
                }
            ));
        }

        summary
    }
}

#[async_trait]
impl Tool for GetTasksTool {
    fn name(&self) -> &str {
        "get_tasks"
    }

    fn description(&self) -> &str {
        "Retrieve and display tasks with smart filtering based on status, priority, dates, and search terms"
    }

    fn capability(&self) -> ToolCapability {
        ToolCapability {
            name: self.name().to_string(),
            description: self.description().to_string(),
            required_parameters: vec![],
            optional_parameters: vec![
                ParameterDefinition {
                    name: "status".to_string(),
                    param_type: "array".to_string(),
                    description:
                        "Filter by task status (pending, in_progress, completed, cancelled)"
                            .to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        allowed_values: Some(vec![
                            serde_json::Value::String("pending".to_string()),
                            serde_json::Value::String("in_progress".to_string()),
                            serde_json::Value::String("completed".to_string()),
                            serde_json::Value::String("cancelled".to_string()),
                        ]),
                        ..Default::default()
                    }),
                    inference_sources: vec!["status_keywords".to_string()],
                },
                ParameterDefinition {
                    name: "priority".to_string(),
                    param_type: "array".to_string(),
                    description: "Filter by priority levels (0=Low, 1=Medium, 2=High, 3=Urgent)"
                        .to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        allowed_values: Some(vec![
                            serde_json::Value::Number(serde_json::Number::from(0)),
                            serde_json::Value::Number(serde_json::Number::from(1)),
                            serde_json::Value::Number(serde_json::Number::from(2)),
                            serde_json::Value::Number(serde_json::Number::from(3)),
                        ]),
                        ..Default::default()
                    }),
                    inference_sources: vec!["priority_keywords".to_string()],
                },
                ParameterDefinition {
                    name: "search".to_string(),
                    param_type: "string".to_string(),
                    description: "Search in task titles and descriptions".to_string(),
                    default_value: None,
                    validation: Some(ParameterValidation {
                        max_length: Some(100),
                        ..Default::default()
                    }),
                    inference_sources: vec![
                        "quoted_text".to_string(),
                        "search_keywords".to_string(),
                    ],
                },
                ParameterDefinition {
                    name: "tags".to_string(),
                    param_type: "array".to_string(),
                    description: "Filter by specific tags".to_string(),
                    default_value: None,
                    validation: None,
                    inference_sources: vec!["hashtags".to_string(), "tag_keywords".to_string()],
                },
                ParameterDefinition {
                    name: "limit".to_string(),
                    param_type: "number".to_string(),
                    description: "Maximum number of tasks to return".to_string(),
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(50))),
                    validation: Some(ParameterValidation {
                        min: Some(1.0),
                        max: Some(1000.0),
                        ..Default::default()
                    }),
                    inference_sources: vec!["limit_keywords".to_string()],
                },
            ],
            required_permissions: vec![PermissionLevel::ReadOnly],
            requires_confirmation: false,
            category: "Task Management".to_string(),
            examples: vec![
                ToolExample {
                    user_request: "Show me all high priority tasks".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert(
                            "priority".to_string(),
                            serde_json::Value::Array(vec![
                                serde_json::Value::Number(serde_json::Number::from(2)),
                                serde_json::Value::Number(serde_json::Number::from(3)),
                            ]),
                        );
                        params
                    },
                    description: "Filters tasks by high and urgent priority".to_string(),
                },
                ToolExample {
                    user_request: "List completed tasks containing 'report'".to_string(),
                    parameters: {
                        let mut params = HashMap::new();
                        params.insert(
                            "status".to_string(),
                            serde_json::Value::Array(vec![serde_json::Value::String(
                                "completed".to_string(),
                            )]),
                        );
                        params.insert(
                            "search".to_string(),
                            serde_json::Value::String("report".to_string()),
                        );
                        params
                    },
                    description: "Combines status filter with search term".to_string(),
                },
                ToolExample {
                    user_request: "What tasks do I have today?".to_string(),
                    parameters: HashMap::new(), // Inferred from context
                    description: "Uses date context to filter today's tasks".to_string(),
                },
            ],
        }
    }

    async fn infer_parameters(&self, context: &ToolContext) -> AIResult<InferredParameters> {
        let mut parameters = HashMap::new();
        let mut confidence = 0.8; // High confidence for task listing
        let needs_confirmation = Vec::new();
        let alternatives = Vec::new();
        let mut explanations = Vec::new();

        // Infer filters from the user message
        let filters = self.infer_task_filters(&context.user_message, context);

        // Convert filters to parameters
        if let Some(status) = filters.status {
            let status_values: Vec<serde_json::Value> = status
                .into_iter()
                .map(|s| serde_json::Value::String(s))
                .collect();
            parameters.insert(
                "status".to_string(),
                serde_json::Value::Array(status_values),
            );
            explanations.push("Inferred status filter from message".to_string());
        }

        if let Some(priority) = filters.priority {
            let priority_values: Vec<serde_json::Value> = priority
                .into_iter()
                .map(|p| serde_json::Value::Number(serde_json::Number::from(p)))
                .collect();
            parameters.insert(
                "priority".to_string(),
                serde_json::Value::Array(priority_values),
            );
            explanations.push("Inferred priority filter from message".to_string());
        }

        if let Some(search) = filters.search {
            parameters.insert("search".to_string(), serde_json::Value::String(search));
            explanations.push("Extracted search terms from message".to_string());
        }

        if let Some(tags) = filters.tags {
            let tag_values: Vec<serde_json::Value> = tags
                .into_iter()
                .map(|t| serde_json::Value::String(t))
                .collect();
            parameters.insert("tags".to_string(), serde_json::Value::Array(tag_values));
            explanations.push("Inferred tags from message".to_string());
        }

        if let Some(limit) = filters.limit {
            parameters.insert(
                "limit".to_string(),
                serde_json::Value::Number(serde_json::Number::from(limit)),
            );
            explanations.push("Set result limit based on context".to_string());
        }

        // If no specific filters were inferred, provide helpful defaults
        if parameters.is_empty() {
            explanations.push("No specific filters detected, will show all tasks".to_string());
            confidence = 0.6; // Lower confidence when no filters
        }

        Ok(InferredParameters {
            parameters,
            confidence,
            needs_confirmation,
            alternatives,
            explanation: explanations.join("; "),
        })
    }

    fn validate_parameters(
        &self,
        _parameters: &HashMap<String, serde_json::Value>,
    ) -> AIResult<()> {
        // All parameters are optional and have reasonable defaults
        // Basic validation is handled by the parameter definitions
        Ok(())
    }

    async fn execute(
        &self,
        parameters: HashMap<String, serde_json::Value>,
        context: &ToolContext,
    ) -> AIResult<ToolExecutionResult> {
        let start_time = std::time::Instant::now();

        // Build filters from parameters
        let mut filters = TaskFilters::default();

        if let Some(status_array) = parameters.get("status").and_then(|v| v.as_array()) {
            let status_strings: Vec<String> = status_array
                .iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect();
            if !status_strings.is_empty() {
                filters.status = Some(status_strings);
            }
        }

        if let Some(priority_array) = parameters.get("priority").and_then(|v| v.as_array()) {
            let priority_nums: Vec<u32> = priority_array
                .iter()
                .filter_map(|v| v.as_u64())
                .map(|n| n as u32)
                .collect();
            if !priority_nums.is_empty() {
                filters.priority = Some(priority_nums);
            }
        }

        if let Some(search) = parameters.get("search").and_then(|v| v.as_str()) {
            if !search.trim().is_empty() {
                filters.search = Some(search.to_string());
            }
        }

        if let Some(tags_array) = parameters.get("tags").and_then(|v| v.as_array()) {
            let tag_strings: Vec<String> = tags_array
                .iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect();
            if !tag_strings.is_empty() {
                filters.tags = Some(tag_strings);
            }
        }

        if let Some(limit) = parameters.get("limit").and_then(|v| v.as_u64()) {
            filters.limit = Some(limit as usize);
        }

        // If no explicit filters, try to infer from context
        if filters.is_empty() {
            filters = self.infer_task_filters(&context.user_message, context);
        }

        // Execute the query based on filters
        let tasks_result = if let Some(scheduled_date) = filters.scheduled_date {
            // For today's tasks, use date range filtering
            let start_of_day = scheduled_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
            let end_of_day = scheduled_date.and_hms_opt(23, 59, 59).unwrap().and_utc();
            self.task_repo
                .find_scheduled_between(start_of_day, end_of_day)
                .await
        } else if let Some((start_date, end_date)) = filters.scheduled_date_range {
            // For date range filtering
            let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
            let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap().and_utc();
            self.task_repo
                .find_scheduled_between(start_datetime, end_datetime)
                .await
        } else {
            // Default query with status filtering
            let status_filter = filters
                .status
                .as_ref()
                .and_then(|statuses| statuses.first())
                .map(|s| s.as_str());
            self.task_repo.find_all(status_filter, None).await
        };

        match tasks_result {
            Ok(mut tasks) => {
                // Apply additional filtering that the repository doesn't handle
                tasks = self.apply_additional_filters(tasks, &filters);

                let execution_time = start_time.elapsed().as_millis() as u64;

                // Convert tasks to JSON
                let task_data: Vec<serde_json::Value> = tasks
                    .into_iter()
                    .map(|task| serde_json::to_value(task).unwrap_or(serde_json::Value::Null))
                    .collect();

                // Generate human-readable summary
                let summary = self.generate_summary(&task_data, &filters);

                let mut result_data = HashMap::new();
                result_data.insert(
                    "tasks".to_string(),
                    serde_json::Value::Array(task_data.clone()),
                );
                result_data.insert(
                    "count".to_string(),
                    serde_json::Value::Number(serde_json::Number::from(task_data.len())),
                );
                result_data.insert(
                    "filters_applied".to_string(),
                    serde_json::to_value(&filters).unwrap_or(serde_json::Value::Null),
                );

                let suggestions = if task_data.is_empty() {
                    vec![
                        "Try broadening your search criteria".to_string(),
                        "Create a new task if needed".to_string(),
                        "Check if tasks exist with different status".to_string(),
                    ]
                } else {
                    vec![
                        "Start a timer for any of these tasks".to_string(),
                        "Update task status or priority as needed".to_string(),
                        "Add more details to task descriptions".to_string(),
                    ]
                };

                Ok(ToolExecutionResult {
                    success: true,
                    data: serde_json::Value::Object(result_data.into_iter().collect()),
                    message: summary,
                    execution_time_ms: execution_time,
                    error: None,
                    suggestions,
                    metadata: HashMap::new(),
                })
            }
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;

                Ok(ToolExecutionResult {
                    success: false,
                    data: serde_json::Value::Null,
                    message: format!("❌ Failed to retrieve tasks: {}", e),
                    execution_time_ms: execution_time,
                    error: Some(e.to_string()),
                    suggestions: vec![
                        "Try again with different filters".to_string(),
                        "Check your database connection".to_string(),
                    ],
                    metadata: HashMap::new(),
                })
            }
        }
    }
}
