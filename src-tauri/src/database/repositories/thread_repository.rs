use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{thread_messages, threads, tasks};

/// Request structure for creating a new thread
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateThreadRequest {
    pub assignment_type: Option<String>, // 'task', 'day', 'general'
    pub assignment_task_id: Option<String>,
    pub assignment_date: Option<String>, // ISO string for day assignments
    pub assignment_context: Option<serde_json::Value>, // JSON for additional context
}

/// Request structure for updating an existing thread
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateThreadRequest {
    pub title: Option<String>,
    pub assignment_type: Option<String>,
    pub assignment_task_id: Option<String>,
    pub assignment_date: Option<String>,
    pub assignment_context: Option<serde_json::Value>,
}

/// Request structure for creating a thread message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateThreadMessageRequest {
    pub thread_id: String,
    pub r#type: String, // 'user' or 'assistant'
    pub content: String,
    pub reasoning: Option<String>,
    pub actions: Option<serde_json::Value>, // JSON serialized AIAction[]
    pub suggestions: Option<serde_json::Value>, // JSON serialized AISuggestion[]
    pub tool_executions: Option<serde_json::Value>, // JSON serialized ToolExecution[]
    pub user_feedback: Option<serde_json::Value>, // JSON serialized UserFeedback
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

/// Thread repository for SeaORM-based database operations
pub struct ThreadRepository {
    db: Arc<DatabaseConnection>,
}

impl ThreadRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new thread
    pub async fn create_thread(&self, request: CreateThreadRequest) -> Result<threads::Model, DbErr> {
        // Validate task assignment if provided
        if let Some(task_id) = &request.assignment_task_id {
            let task_exists = tasks::Entity::find_by_id(task_id)
                .one(&*self.db)
                .await?
                .is_some();
            
            if !task_exists {
                return Err(DbErr::RecordNotFound(format!("Task '{}' not found", task_id)));
            }
        }

        // Generate a default title (will be updated when first message is added)
        let default_title = "New Thread".to_string();

        let thread = threads::ActiveModel {
            title: Set(default_title),
            assignment_type: Set(request.assignment_type),
            assignment_task_id: Set(request.assignment_task_id),
            assignment_date: Set(request.assignment_date),
            assignment_context: Set(request.assignment_context.map(|ctx| serde_json::to_string(&ctx).unwrap_or_default())),
            message_count: Set(0),
            last_message_at: Set(None),
            ..Default::default()
        };

        thread.insert(&*self.db).await
    }

    /// Find a thread by ID
    pub async fn find_by_id(&self, id: &str) -> Result<Option<threads::Model>, DbErr> {
        threads::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Find all threads ordered by last activity
    pub async fn find_all(&self) -> Result<Vec<threads::Model>, DbErr> {
        threads::Entity::find()
            .order_by_desc(threads::Column::LastMessageAt)
            .order_by_desc(threads::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find threads by assignment type
    pub async fn find_by_assignment_type(&self, assignment_type: &str) -> Result<Vec<threads::Model>, DbErr> {
        threads::Entity::find()
            .filter(threads::Column::AssignmentType.eq(assignment_type))
            .order_by_desc(threads::Column::LastMessageAt)
            .order_by_desc(threads::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find threads assigned to a specific task
    pub async fn find_by_task_id(&self, task_id: &str) -> Result<Vec<threads::Model>, DbErr> {
        threads::Entity::find()
            .filter(threads::Column::AssignmentTaskId.eq(task_id))
            .order_by_desc(threads::Column::LastMessageAt)
            .order_by_desc(threads::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find threads assigned to a specific date
    pub async fn find_by_date(&self, date: &str) -> Result<Vec<threads::Model>, DbErr> {
        threads::Entity::find()
            .filter(threads::Column::AssignmentDate.eq(date))
            .order_by_desc(threads::Column::LastMessageAt)
            .order_by_desc(threads::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Update a thread
    pub async fn update_thread(&self, id: &str, request: UpdateThreadRequest) -> Result<threads::Model, DbErr> {
        let thread = threads::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Thread '{}' not found", id)))?;

        let mut active_thread: threads::ActiveModel = thread.into();

        if let Some(title) = request.title {
            active_thread.title = Set(title);
        }
        if let Some(assignment_type) = request.assignment_type {
            active_thread.assignment_type = Set(Some(assignment_type));
        }
        if let Some(assignment_task_id) = request.assignment_task_id {
            // Validate task exists if provided
            if !assignment_task_id.is_empty() {
                let task_exists = tasks::Entity::find_by_id(&assignment_task_id)
                    .one(&*self.db)
                    .await?
                    .is_some();
                
                if !task_exists {
                    return Err(DbErr::RecordNotFound(format!("Task '{}' not found", assignment_task_id)));
                }
            }
            active_thread.assignment_task_id = Set(Some(assignment_task_id));
        }
        if let Some(assignment_date) = request.assignment_date {
            active_thread.assignment_date = Set(Some(assignment_date));
        }
        if let Some(assignment_context) = request.assignment_context {
            active_thread.assignment_context = Set(Some(serde_json::to_string(&assignment_context).unwrap_or_default()));
        }

        active_thread.update(&*self.db).await
    }

    /// Delete a thread and all its messages
    pub async fn delete_thread(&self, id: &str) -> Result<(), DbErr> {
        let txn = self.db.begin().await?;

        // Delete all messages first (cascade should handle this, but being explicit)
        thread_messages::Entity::delete_many()
            .filter(thread_messages::Column::ThreadId.eq(id))
            .exec(&txn)
            .await?;

        // Delete the thread
        threads::Entity::delete_by_id(id).exec(&txn).await?;

        txn.commit().await
    }

    /// Create a thread message
    pub async fn create_message(&self, request: CreateThreadMessageRequest) -> Result<thread_messages::Model, DbErr> {
        let txn = self.db.begin().await?;

        // Verify thread exists
        let thread = threads::Entity::find_by_id(&request.thread_id)
            .one(&txn)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Thread '{}' not found", request.thread_id)))?;

        // Create the message
        let message = thread_messages::ActiveModel {
            thread_id: Set(request.thread_id.clone()),
            r#type: Set(request.r#type),
            content: Set(request.content.clone()),
            reasoning: Set(request.reasoning),
            actions: Set(request.actions.map(|a| serde_json::to_string(&a).unwrap_or_default())),
            suggestions: Set(request.suggestions.map(|s| serde_json::to_string(&s).unwrap_or_default())),
            tool_executions: Set(request.tool_executions.map(|te| serde_json::to_string(&te).unwrap_or_default())),
            user_feedback: Set(request.user_feedback.map(|uf| serde_json::to_string(&uf).unwrap_or_default())),
            timestamp: Set(request.timestamp.unwrap_or_else(|| chrono::Utc::now())),
            ..Default::default()
        };

        let saved_message = message.insert(&txn).await?;

        // Update thread metadata
        let mut active_thread: threads::ActiveModel = thread.into();
        active_thread.message_count = Set(active_thread.message_count.unwrap() + 1);
        active_thread.last_message_at = Set(Some(saved_message.timestamp));

        // Update thread title if this is the first user message and thread has default title
        if saved_message.r#type == "user" && active_thread.title.as_ref() == "New Thread" {
            let title = self.generate_title_from_content(&request.content);
            active_thread.title = Set(title);
        }

        active_thread.update(&txn).await?;

        txn.commit().await?;
        Ok(saved_message)
    }

    /// Find messages for a thread
    pub async fn find_messages(&self, thread_id: &str) -> Result<Vec<thread_messages::Model>, DbErr> {
        thread_messages::Entity::find()
            .filter(thread_messages::Column::ThreadId.eq(thread_id))
            .order_by_asc(thread_messages::Column::Timestamp)
            .all(&*self.db)
            .await
    }

    /// Find a specific message by ID
    pub async fn find_message_by_id(&self, id: &str) -> Result<Option<thread_messages::Model>, DbErr> {
        thread_messages::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Update a thread message
    pub async fn update_message(&self, id: &str, user_feedback: Option<serde_json::Value>) -> Result<thread_messages::Model, DbErr> {
        let message = thread_messages::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Message '{}' not found", id)))?;

        let mut active_message: thread_messages::ActiveModel = message.into();
        
        if let Some(feedback) = user_feedback {
            active_message.user_feedback = Set(Some(serde_json::to_string(&feedback).unwrap_or_default()));
        }

        active_message.update(&*self.db).await
    }

    /// Delete a thread message
    pub async fn delete_message(&self, id: &str) -> Result<(), DbErr> {
        let txn = self.db.begin().await?;

        // Get the message to find its thread
        let message = thread_messages::Entity::find_by_id(id)
            .one(&txn)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Message '{}' not found", id)))?;

        // Delete the message
        thread_messages::Entity::delete_by_id(id).exec(&txn).await?;

        // Update thread message count
        let thread = threads::Entity::find_by_id(&message.thread_id)
            .one(&txn)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Thread '{}' not found", message.thread_id)))?;

        let mut active_thread: threads::ActiveModel = thread.into();
        active_thread.message_count = Set((active_thread.message_count.unwrap() - 1).max(0));

        // Update last_message_at to the timestamp of the most recent remaining message
        let last_message = thread_messages::Entity::find()
            .filter(thread_messages::Column::ThreadId.eq(&message.thread_id))
            .order_by_desc(thread_messages::Column::Timestamp)
            .one(&txn)
            .await?;

        active_thread.last_message_at = Set(last_message.map(|m| m.timestamp));
        active_thread.update(&txn).await?;

        txn.commit().await
    }

    /// Generate a title from message content
    /// This implements similar logic to the frontend threadTitleUtils.generateThreadTitle
    fn generate_title_from_content(&self, content: &str) -> String {
        if content.trim().is_empty() {
            return "New Thread".to_string();
        }

        let mut clean_content = content.trim().to_string();
        
        // Remove basic markdown formatting
        clean_content = clean_content
            .replace("**", "")  // Bold
            .replace("*", "")   // Italic
            .replace("`", "")   // Code
            .replace("~", "");  // Strikethrough
        
        // Simple markdown link removal [text](url) -> text
        // This is a simplified version without regex
        while let Some(start) = clean_content.find("[") {
            if let Some(middle) = clean_content[start..].find("](") {
                if let Some(end) = clean_content[start + middle..].find(")") {
                    let link_start = start;
                    let link_end = start + middle + end + 1;
                    let text_start = start + 1;
                    let text_end = start + middle;
                    
                    if text_end > text_start {
                        // Extract the link text before modifying the string
                        let link_text = clean_content[text_start..text_end].to_string();
                        clean_content.replace_range(link_start..link_end, &link_text);
                    } else {
                        clean_content.replace_range(link_start..link_end, "");
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        // Split by lines and process each line
        let lines: Vec<String> = clean_content
            .lines()
            .map(|line| {
                let mut line = line.trim().to_string();
                // Remove headers
                while line.starts_with('#') {
                    line = line[1..].trim().to_string();
                }
                // Remove list markers
                if line.starts_with("- ") || line.starts_with("* ") || line.starts_with("+ ") {
                    line = line[2..].trim().to_string();
                }
                // Remove simple numbered list markers (1. 2. etc.)
                if line.len() > 2 && line.chars().nth(0).unwrap_or(' ').is_ascii_digit() && line.chars().nth(1) == Some('.') {
                    line = line[2..].trim().to_string();
                }
                line
            })
            .filter(|line| !line.is_empty())
            .collect();

        // Take the first meaningful line
        clean_content = lines.first().unwrap_or(&clean_content).clone();

        // Check if content is only punctuation or empty after cleaning
        if clean_content.is_empty() || clean_content.chars().all(|c| !c.is_alphanumeric() && !c.is_whitespace()) {
            return "New Thread".to_string();
        }

        // Split into sentences and take the first one
        let sentences: Vec<&str> = clean_content
            .split(|c| c == '.' || c == '!' || c == '?')
            .filter(|s| !s.trim().is_empty())
            .collect();
        
        let mut title = sentences.first().unwrap_or(&clean_content.as_str()).trim().to_string();

        // Truncate if too long
        if title.len() > 50 {
            let words: Vec<&str> = title.split_whitespace().collect();
            let mut truncated = String::new();
            
            for word in words {
                if (truncated.len() + word.len() + 1) > 47 { // Leave room for "..."
                    break;
                }
                if !truncated.is_empty() {
                    truncated.push(' ');
                }
                truncated.push_str(word);
            }
            
            if truncated.len() < title.len() {
                title = format!("{}...", truncated);
            }
        }

        // Ensure the title is not empty after processing
        if title.is_empty() {
            return "New Thread".to_string();
        }

        // Capitalize first letter
        let mut chars: Vec<char> = title.chars().collect();
        if let Some(first_char) = chars.first_mut() {
            *first_char = first_char.to_uppercase().next().unwrap_or(*first_char);
        }
        
        chars.into_iter().collect()
    }

    /// Get thread statistics
    pub async fn get_statistics(&self) -> Result<ThreadStatistics, DbErr> {
        let total_threads = threads::Entity::find().count(&*self.db).await?;
        let total_messages = thread_messages::Entity::find().count(&*self.db).await?;

        // Count by assignment type
        let task_threads = threads::Entity::find()
            .filter(threads::Column::AssignmentType.eq("task"))
            .count(&*self.db)
            .await?;

        let day_threads = threads::Entity::find()
            .filter(threads::Column::AssignmentType.eq("day"))
            .count(&*self.db)
            .await?;

        let general_threads = threads::Entity::find()
            .filter(threads::Column::AssignmentType.eq("general"))
            .count(&*self.db)
            .await?;

        Ok(ThreadStatistics {
            total_threads,
            total_messages,
            task_threads,
            day_threads,
            general_threads,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreadStatistics {
    pub total_threads: u64,
    pub total_messages: u64,
    pub task_threads: u64,
    pub day_threads: u64,
    pub general_threads: u64,
}