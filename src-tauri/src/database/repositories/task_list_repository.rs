use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{task_lists, tasks};

/// Request structure for creating a new task list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskListRequest {
    pub name: String,
}

/// Request structure for updating an existing task list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskListRequest {
    pub name: String,
}

/// Task list repository for SeaORM-based database operations
pub struct TaskListRepository {
    db: Arc<DatabaseConnection>,
}

impl TaskListRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new task list with comprehensive validation and error handling
    pub async fn create_task_list(&self, name: String) -> Result<task_lists::Model, DbErr> {
        // Validate task list name
        self.validate_task_list_name(&name)?;

        let trimmed_name = name.trim().to_string();

        // Check for duplicate names (case-insensitive)
        let existing = task_lists::Entity::find()
            .filter(task_lists::Column::Name.eq(&trimmed_name))
            .one(&*self.db)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to check for duplicate names: {}", e)))?;

        if existing.is_some() {
            return Err(DbErr::Custom(format!(
                "DUPLICATE_ERROR: A task list with the name '{}' already exists",
                trimmed_name
            )));
        }

        let task_list = task_lists::ActiveModel {
            name: Set(trimmed_name),
            is_default: Set(false),
            ..Default::default()
        };

        task_list.insert(&*self.db).await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to create task list: {}", e)))
    }

    /// Find all task lists ordered by name
    pub async fn find_all_task_lists(&self) -> Result<Vec<task_lists::Model>, DbErr> {
        task_lists::Entity::find()
            .order_by_asc(task_lists::Column::IsDefault)
            .order_by_asc(task_lists::Column::Name)
            .all(&*self.db)
            .await
    }

    /// Find a task list by ID
    #[allow(dead_code)]
    pub async fn find_by_id(&self, id: &str) -> Result<Option<task_lists::Model>, DbErr> {
        task_lists::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Update a task list with comprehensive validation and error handling
    pub async fn update_task_list(
        &self,
        id: &str,
        name: String,
    ) -> Result<task_lists::Model, DbErr> {
        // Validate input
        if id.trim().is_empty() {
            return Err(DbErr::Custom("VALIDATION_ERROR: Task list ID cannot be empty".to_string()));
        }

        // Validate task list name
        self.validate_task_list_name(&name)?;

        let trimmed_name = name.trim().to_string();

        let task_list = task_lists::Entity::find_by_id(id)
            .one(&*self.db)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to find task list: {}", e)))?
            .ok_or_else(|| DbErr::RecordNotFound(format!("RECORD_NOT_FOUND: Task list with ID '{}' not found", id)))?;

        // Prevent updating the default task list name
        if task_list.is_default {
            return Err(DbErr::Custom(
                "BUSINESS_RULE_ERROR: Cannot update the default task list name".to_string(),
            ));
        }

        // Check for duplicate names (case-insensitive), excluding current task list
        let existing = task_lists::Entity::find()
            .filter(task_lists::Column::Name.eq(&trimmed_name))
            .filter(task_lists::Column::Id.ne(id))
            .one(&*self.db)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to check for duplicate names: {}", e)))?;

        if existing.is_some() {
            return Err(DbErr::Custom(format!(
                "DUPLICATE_ERROR: A task list with the name '{}' already exists",
                trimmed_name
            )));
        }

        let mut task_list: task_lists::ActiveModel = task_list.into();
        task_list.name = Set(trimmed_name);
        task_list.updated_at = Set(chrono::Utc::now());

        task_list.update(&*self.db).await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to update task list: {}", e)))
    }

    /// Delete a task list with comprehensive error handling and rollback
    pub async fn delete_task_list(&self, id: &str) -> Result<(), DbErr> {
        // Validate input
        if id.trim().is_empty() {
            return Err(DbErr::Custom("VALIDATION_ERROR: Task list ID cannot be empty".to_string()));
        }

        let task_list = task_lists::Entity::find_by_id(id)
            .one(&*self.db)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to find task list: {}", e)))?
            .ok_or_else(|| DbErr::RecordNotFound(format!("RECORD_NOT_FOUND: Task list with ID '{}' not found", id)))?;

        // Prevent deletion of the default task list
        if task_list.is_default {
            return Err(DbErr::Custom(
                "BUSINESS_RULE_ERROR: Cannot delete the default task list".to_string(),
            ));
        }

        // Start transaction for atomic operation
        let txn = self.db.begin().await
            .map_err(|e| DbErr::Custom(format!("TRANSACTION_ERROR: Failed to start transaction: {}", e)))?;

        // Get the default task list to move tasks to
        let default_task_list = self.get_default_task_list_internal(&txn).await
            .map_err(|e| {
                // Rollback is automatic when txn is dropped
                DbErr::Custom(format!("DEPENDENCY_ERROR: Failed to get default task list: {}", e))
            })?;

        // Count tasks that will be moved
        let task_count = tasks::Entity::find()
            .filter(tasks::Column::TaskListId.eq(Some(id.to_string())))
            .count(&txn)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to count tasks: {}", e)))?;

        // Move all tasks from this task list to the default task list
        let update_result = tasks::Entity::update_many()
            .col_expr(
                tasks::Column::TaskListId,
                sea_orm::sea_query::Expr::value(Some(default_task_list.id.clone())),
            )
            .filter(tasks::Column::TaskListId.eq(Some(id.to_string())))
            .exec(&txn)
            .await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to move tasks to default list: {}", e)))?;

        // Verify that the expected number of tasks were updated
        if update_result.rows_affected != task_count {
            return Err(DbErr::Custom(format!(
                "CONSISTENCY_ERROR: Expected to move {} tasks but only moved {}",
                task_count, update_result.rows_affected
            )));
        }

        // Delete the task list
        let delete_result = task_lists::Entity::delete_by_id(id).exec(&txn).await
            .map_err(|e| DbErr::Custom(format!("DATABASE_ERROR: Failed to delete task list: {}", e)))?;

        // Verify deletion
        if delete_result.rows_affected != 1 {
            return Err(DbErr::Custom(format!(
                "CONSISTENCY_ERROR: Expected to delete 1 task list but deleted {}",
                delete_result.rows_affected
            )));
        }

        // Commit transaction
        txn.commit().await
            .map_err(|e| DbErr::Custom(format!("TRANSACTION_ERROR: Failed to commit transaction: {}", e)))?;

        Ok(())
    }

    /// Get the default task list
    pub async fn get_default_task_list(&self) -> Result<task_lists::Model, DbErr> {
        self.get_default_task_list_internal(&*self.db).await
    }

    /// Ensure a default task list exists, creating one if necessary
    pub async fn ensure_default_task_list(&self) -> Result<task_lists::Model, DbErr> {
        // Try to find existing default task list
        if let Some(default_list) = task_lists::Entity::find()
            .filter(task_lists::Column::IsDefault.eq(true))
            .one(&*self.db)
            .await?
        {
            return Ok(default_list);
        }

        // Create default task list if it doesn't exist
        let default_task_list = task_lists::ActiveModel {
            name: Set("Default".to_string()),
            is_default: Set(true),
            ..Default::default()
        };

        default_task_list.insert(&*self.db).await
    }

    /// Count tasks in a task list
    #[allow(dead_code)]
    pub async fn count_tasks_in_list(&self, task_list_id: &str) -> Result<u64, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::TaskListId.eq(Some(task_list_id.to_string())))
            .count(&*self.db)
            .await
    }

    /// Check if a task list exists
    pub async fn exists(&self, id: &str) -> Result<bool, DbErr> {
        let count = task_lists::Entity::find_by_id(id).count(&*self.db).await?;
        Ok(count > 0)
    }

    /// Get task list statistics
    pub async fn get_task_list_stats(&self) -> Result<TaskListStats, DbErr> {
        let total_lists = task_lists::Entity::find().count(&*self.db).await?;

        let lists_with_tasks = task_lists::Entity::find()
            .find_with_related(tasks::Entity)
            .all(&*self.db)
            .await?
            .into_iter()
            .filter(|(_, tasks)| !tasks.is_empty())
            .count() as u64;

        let empty_lists = total_lists - lists_with_tasks;

        Ok(TaskListStats {
            total_lists,
            lists_with_tasks,
            empty_lists,
        })
    }

    /// Internal helper to get default task list with custom database connection
    async fn get_default_task_list_internal<C>(&self, db: &C) -> Result<task_lists::Model, DbErr>
    where
        C: sea_orm::ConnectionTrait,
    {
        task_lists::Entity::find()
            .filter(task_lists::Column::IsDefault.eq(true))
            .one(db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Default task list not found".to_string()))
    }

    /// Validate task list name with comprehensive error messages
    pub fn validate_task_list_name(&self, name: &str) -> Result<(), DbErr> {
        let trimmed_name = name.trim();

        if trimmed_name.is_empty() {
            return Err(DbErr::Custom("VALIDATION_ERROR: Task list name cannot be empty or only whitespace".to_string()));
        }

        if trimmed_name.len() > 255 {
            return Err(DbErr::Custom(
                format!("VALIDATION_ERROR: Task list name cannot exceed 255 characters (current: {})", trimmed_name.len())
            ));
        }

        // Check for reserved names
        let reserved_names = ["All", "ALL", "all"];
        if reserved_names.contains(&trimmed_name) {
            return Err(DbErr::Custom(
                "VALIDATION_ERROR: Task list name cannot be a reserved name (All)".to_string(),
            ));
        }

        // Check for special characters that might cause issues
        if trimmed_name.contains('\0') {
            return Err(DbErr::Custom(
                "VALIDATION_ERROR: Task list name cannot contain null characters".to_string(),
            ));
        }

        // Check for leading/trailing dots which might cause filesystem issues
        if trimmed_name.starts_with('.') || trimmed_name.ends_with('.') {
            return Err(DbErr::Custom(
                "VALIDATION_ERROR: Task list name cannot start or end with a dot".to_string(),
            ));
        }

        Ok(())
    }

    /// Delete all task lists (for testing purposes)
    #[cfg(test)]
    pub async fn delete_all_task_lists(&self) -> Result<u64, DbErr> {
        let result = task_lists::Entity::delete_many().exec(&*self.db).await?;
        Ok(result.rows_affected)
    }

    /// Import a task list from backup data
    #[allow(dead_code)]
    pub async fn import_task_list(
        &self,
        task_list: task_lists::Model,
    ) -> Result<task_lists::Model, DbErr> {
        let active_task_list = task_lists::ActiveModel {
            id: Set(task_list.id),
            name: Set(task_list.name),
            is_default: Set(task_list.is_default),
            created_at: Set(task_list.created_at),
            updated_at: Set(task_list.updated_at),
        };

        active_task_list.insert(&*self.db).await
    }

    /// Count all task lists
    pub async fn count_all_task_lists(&self) -> Result<u64, DbErr> {
        task_lists::Entity::find().count(&*self.db).await
    }
}

/// Task list statistics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskListStats {
    pub total_lists: u64,
    pub lists_with_tasks: u64,
    pub empty_lists: u64,
}
