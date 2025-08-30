# Fix for "list tasks for today" Issue

## Problem Summary

The phrase "list tasks for today" doesn't work because:

1. ✅ **Tool Detection Works**: The `get_tasks` tool is correctly identified
2. ✅ **Parameter Inference Works**: Date filtering is correctly inferred from "today"
3. ❌ **Repository Implementation Gap**: The `TaskRepository.find_all()` method only supports status filtering, ignoring date/priority/search filters

## Root Cause

In `src-tauri/src/ai/tools/get_tasks_tool.rs`, line ~400:

```rust
// Execute the query - convert TaskFilters to individual parameters
let status_filter = filters.status.as_ref().and_then(|statuses| statuses.first()).map(|s| s.as_str());
match self.task_repo.find_all(status_filter, None).await {
    // ❌ Only uses status_filter, ignores date/priority/search/tags!
```

The `TaskRepository.find_all(status_filter, limit)` method signature doesn't support the rich filtering that `GetTasksTool` is trying to use.

## Solution Options

### Option 1: Extend TaskRepository (Recommended)

Add a new method to `TaskRepository` that supports rich filtering:

```rust
// In src-tauri/src/database/repositories/task_repository.rs
impl TaskRepository {
    pub async fn find_with_filters(&self, filters: &TaskFilters) -> Result<Vec<tasks::Model>, DbErr> {
        let mut query = tasks::Entity::find();

        // Apply status filter
        if let Some(statuses) = &filters.status {
            query = query.filter(tasks::Column::Status.is_in(statuses.clone()));
        }

        // Apply priority filter
        if let Some(priorities) = &filters.priority {
            let priority_i32: Vec<i32> = priorities.iter().map(|&p| p as i32).collect();
            query = query.filter(tasks::Column::Priority.is_in(priority_i32));
        }

        // Apply date filters
        if let Some(scheduled_date) = filters.scheduled_date {
            let start_of_day = scheduled_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
            let end_of_day = scheduled_date.and_hms_opt(23, 59, 59).unwrap().and_utc();
            query = query.filter(
                tasks::Column::ScheduledDate.between(start_of_day, end_of_day)
                    .or(tasks::Column::DueDate.between(start_of_day, end_of_day))
            );
        }

        if let Some((start_date, end_date)) = filters.scheduled_date_range {
            let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
            let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap().and_utc();
            query = query.filter(
                tasks::Column::ScheduledDate.between(start_datetime, end_datetime)
                    .or(tasks::Column::DueDate.between(start_datetime, end_datetime))
            );
        }

        // Apply search filter
        if let Some(search_term) = &filters.search {
            query = query.filter(
                tasks::Column::Title.contains(search_term)
                    .or(tasks::Column::Description.contains(search_term))
            );
        }

        // Apply overdue filter
        if filters.overdue_only == Some(true) {
            let now = chrono::Utc::now();
            query = query.filter(
                tasks::Column::DueDate.lt(now)
                    .and(tasks::Column::Status.ne("completed"))
            );
        }

        // Apply limit
        if let Some(limit) = filters.limit {
            query = query.limit(limit as u64);
        }

        // Apply sorting
        match filters.sort_by.as_deref() {
            Some("created_at") => {
                if filters.sort_order.as_deref() == Some("desc") {
                    query = query.order_by_desc(tasks::Column::CreatedAt);
                } else {
                    query = query.order_by_asc(tasks::Column::CreatedAt);
                }
            }
            Some("priority") => {
                query = query.order_by_desc(tasks::Column::Priority);
            }
            Some("due_date") => {
                query = query.order_by_asc(tasks::Column::DueDate);
            }
            _ => {
                // Default sorting by created_at desc
                query = query.order_by_desc(tasks::Column::CreatedAt);
            }
        }

        query.all(&*self.db).await
    }
}
```

### Option 2: Fix GetTasksTool to Use Existing Methods

Modify `GetTasksTool.execute()` to manually filter results:

```rust
// In src-tauri/src/ai/tools/get_tasks_tool.rs
async fn execute(&self, parameters: HashMap<String, serde_json::Value>, context: &ToolContext) -> AIResult<ToolExecutionResult> {
    // ... existing parameter parsing ...

    // Get all tasks first
    let all_tasks = self.task_repo.find_all(None, None).await?;

    // Apply filters manually
    let filtered_tasks: Vec<_> = all_tasks.into_iter()
        .filter(|task| {
            // Apply status filter
            if let Some(statuses) = &filters.status {
                if !statuses.contains(&task.status) {
                    return false;
                }
            }

            // Apply priority filter
            if let Some(priorities) = &filters.priority {
                if !priorities.contains(&(task.priority as u32)) {
                    return false;
                }
            }

            // Apply date filter
            if let Some(target_date) = filters.scheduled_date {
                let task_matches_date = task.scheduled_date
                    .map(|d| d.date_naive() == target_date)
                    .unwrap_or(false) ||
                    task.due_date
                    .map(|d| d.date_naive() == target_date)
                    .unwrap_or(false);

                if !task_matches_date {
                    return false;
                }
            }

            // Apply search filter
            if let Some(search_term) = &filters.search {
                let search_lower = search_term.to_lowercase();
                let title_matches = task.title.to_lowercase().contains(&search_lower);
                let desc_matches = task.description
                    .as_ref()
                    .map(|d| d.to_lowercase().contains(&search_lower))
                    .unwrap_or(false);

                if !title_matches && !desc_matches {
                    return false;
                }
            }

            true
        })
        .collect();

    // ... rest of the method ...
}
```

## Recommended Implementation

**Use Option 1** - extend the repository with proper database-level filtering for better performance and cleaner code.

## Additional Improvements

### 1. Enhance Tool Relevance Detection

Add more trigger phrases for task listing:

```rust
// In src-tauri/src/ai/tool_registry.rs, analyze_tool_relevance method
"get_tasks" => {
    if user_message.contains("list") || user_message.contains("show") ||
       user_message.contains("tasks") || user_message.contains("what") ||
       user_message.contains("today") || user_message.contains("agenda") ||
       user_message.contains("schedule") || user_message.contains("todo") {
        score += 0.6;
        explanations.push("Task listing keywords detected".to_string());
    }
},
```

### 2. Improve Date Parsing

Add support for more date expressions:

```rust
// In GetTasksTool.infer_task_filters()
if message_lower.contains("today") || message_lower.contains("today's") {
    let today = Utc::now().date_naive();
    filters.scheduled_date = Some(today);
} else if message_lower.contains("tomorrow") {
    let tomorrow = Utc::now().date_naive() + chrono::Duration::days(1);
    filters.scheduled_date = Some(tomorrow);
} else if message_lower.contains("yesterday") {
    let yesterday = Utc::now().date_naive() - chrono::Duration::days(1);
    filters.scheduled_date = Some(yesterday);
} else if message_lower.contains("this week") {
    let start_of_week = Utc::now().date_naive() - chrono::Duration::days(Utc::now().weekday().num_days_from_monday() as i64);
    filters.scheduled_date_range = Some((start_of_week, start_of_week + chrono::Duration::weeks(1)));
}
```

## Testing the Fix

After implementing the fix, these queries should work:

- ✅ "list tasks for today"
- ✅ "show me today's tasks"
- ✅ "what tasks do I have today"
- ✅ "today's agenda"
- ✅ "what's on my schedule today"
- ✅ "show high priority tasks for today"
- ✅ "list completed tasks from yesterday"

## Priority

This is a **HIGH PRIORITY** fix because:

1. It's a core user expectation
2. The AI appears to understand but doesn't deliver results
3. It affects user trust in the AI system
4. The fix is straightforward and well-defined
