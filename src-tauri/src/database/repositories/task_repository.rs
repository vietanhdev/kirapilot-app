use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{task_dependencies, task_lists, tasks};

/// Request structure for creating a new task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: i32,
    pub status: Option<String>,
    pub order_num: Option<i32>,
    pub dependencies: Option<Vec<String>>,
    pub time_estimate: Option<i32>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub scheduled_date: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Option<Vec<String>>,
    pub project_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub task_list_id: Option<String>,
    pub periodic_template_id: Option<String>,
    pub is_periodic_instance: Option<bool>,
    pub generation_date: Option<chrono::DateTime<chrono::Utc>>,
}

/// Request structure for updating an existing task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub status: Option<String>,
    pub order_num: Option<i32>,
    pub dependencies: Option<Vec<String>>,
    pub time_estimate: Option<i32>,
    pub actual_time: Option<i32>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub scheduled_date: Option<chrono::DateTime<chrono::Utc>>,
    pub clear_scheduled_date: Option<bool>, // New field to explicitly clear scheduled_date
    pub tags: Option<Vec<String>>,
    pub project_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub task_list_id: Option<String>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Task repository for SeaORM-based database operations
pub struct TaskRepository {
    db: Arc<DatabaseConnection>,
}

impl TaskRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new task
    pub async fn create_task(&self, request: CreateTaskRequest) -> Result<tasks::Model, DbErr> {
        // Determine the task list ID to use
        let task_list_id = if let Some(task_list_id) = request.task_list_id {
            // If a task list ID is provided, validate it exists
            if !task_list_id.trim().is_empty() {
                let task_list_exists = task_lists::Entity::find_by_id(&task_list_id)
                    .one(&*self.db)
                    .await?
                    .is_some();
                
                if !task_list_exists {
                    return Err(DbErr::RecordNotFound(format!("Task list '{}' not found", task_list_id)));
                }
                
                Some(task_list_id)
            } else {
                // Empty string provided, use default
                None
            }
        } else {
            None
        };

        // If no valid task_list_id, get the default task list
        let final_task_list_id = if task_list_id.is_some() {
            task_list_id
        } else {
            let default_task_list = task_lists::Entity::find()
                .filter(task_lists::Column::IsDefault.eq(true))
                .one(&*self.db)
                .await?;
            
            match default_task_list {
                Some(tl) => Some(tl.id),
                None => return Err(DbErr::RecordNotFound("No default task list found. Please create a task list first.".to_string())),
            }
        };

        let task = tasks::ActiveModel {
            title: Set(request.title),
            description: Set(request.description),
            priority: Set(request.priority),
            status: Set(request.status.unwrap_or_else(|| "pending".to_string())),
            order_num: Set(request.order_num.unwrap_or(0)),
            dependencies: Set(request
                .dependencies
                .map(|deps| serde_json::to_string(&deps).unwrap_or_default())),
            time_estimate: Set(request.time_estimate.unwrap_or(0)),
            actual_time: Set(0),
            due_date: Set(request.due_date),
            scheduled_date: Set(request.scheduled_date),
            tags: Set(request
                .tags
                .map(|tags| serde_json::to_string(&tags).unwrap_or_default())),
            project_id: Set(request.project_id),
            parent_task_id: Set(request.parent_task_id),
            task_list_id: Set(final_task_list_id),
            subtasks: Set(None),
            periodic_template_id: Set(request.periodic_template_id),
            is_periodic_instance: Set(request.is_periodic_instance.unwrap_or(false)),
            generation_date: Set(request.generation_date),
            completed_at: Set(None),
            ..Default::default()
        };

        task.insert(&*self.db).await
    }

    /// Find a task by ID
    pub async fn find_by_id(&self, id: &str) -> Result<Option<tasks::Model>, DbErr> {
        tasks::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Find a task by ID with its dependencies
    pub async fn find_with_dependencies(
        &self,
        id: &str,
    ) -> Result<Option<(tasks::Model, Vec<tasks::Model>)>, DbErr> {
        let task = match self.find_by_id(id).await? {
            Some(task) => task,
            None => return Ok(None),
        };

        let dependencies = task_dependencies::Entity::find()
            .filter(task_dependencies::Column::TaskId.eq(id))
            .find_also_related(tasks::Entity)
            .all(&*self.db)
            .await?
            .into_iter()
            .filter_map(|(_, dep_task)| dep_task)
            .collect();

        Ok(Some((task, dependencies)))
    }

    /// Find all tasks with optional filtering
    pub async fn find_all(
        &self,
        status: Option<&str>,
        project_id: Option<&str>,
    ) -> Result<Vec<tasks::Model>, DbErr> {
        let mut query = tasks::Entity::find();

        if let Some(status) = status {
            query = query.filter(tasks::Column::Status.eq(status));
        }

        if let Some(project_id) = project_id {
            query = query.filter(tasks::Column::ProjectId.eq(project_id));
        }

        query
            .order_by_desc(tasks::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find tasks scheduled for a specific date range
    pub async fn find_scheduled_between(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<tasks::Model>, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::ScheduledDate.between(start_date, end_date))
            .order_by_asc(tasks::Column::ScheduledDate)
            .all(&*self.db)
            .await
    }

    /// Find tasks in backlog (no scheduled date)
    pub async fn find_backlog(&self) -> Result<Vec<tasks::Model>, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::ScheduledDate.is_null())
            .filter(tasks::Column::Status.ne("completed"))
            .order_by_desc(tasks::Column::Priority)
            .order_by_desc(tasks::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find tasks by task list ID
    pub async fn find_by_task_list(&self, task_list_id: &str) -> Result<Vec<tasks::Model>, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::TaskListId.eq(Some(task_list_id.to_string())))
            .order_by_desc(tasks::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Move a task to a different task list
    pub async fn move_task_to_list(
        &self,
        task_id: &str,
        task_list_id: &str,
    ) -> Result<tasks::Model, DbErr> {
        // Verify the task exists
        let task = tasks::Entity::find_by_id(task_id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Task not found".to_string()))?;

        // Verify the target task list exists
        let task_list_exists = task_lists::Entity::find_by_id(task_list_id)
            .one(&*self.db)
            .await?
            .is_some();

        if !task_list_exists {
            return Err(DbErr::RecordNotFound("Task list not found".to_string()));
        }

        // Update the task's task_list_id
        let mut task: tasks::ActiveModel = task.into();
        task.task_list_id = Set(Some(task_list_id.to_string()));
        task.updated_at = Set(chrono::Utc::now());

        task.update(&*self.db).await
    }

    /// Migrate orphaned tasks (tasks without a task_list_id) to the default task list
    pub async fn migrate_orphaned_tasks_to_default(&self) -> Result<u64, DbErr> {
        // Get the default task list
        let default_task_list = task_lists::Entity::find()
            .filter(task_lists::Column::IsDefault.eq(true))
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Default task list not found".to_string()))?;

        // Update all tasks with null task_list_id to use the default task list
        let result = tasks::Entity::update_many()
            .col_expr(
                tasks::Column::TaskListId,
                sea_orm::sea_query::Expr::value(Some(default_task_list.id)),
            )
            .col_expr(
                tasks::Column::UpdatedAt,
                sea_orm::sea_query::Expr::value(chrono::Utc::now()),
            )
            .filter(tasks::Column::TaskListId.is_null())
            .exec(&*self.db)
            .await?;

        Ok(result.rows_affected)
    }

    /// Update a task
    pub async fn update_task(
        &self,
        id: &str,
        request: UpdateTaskRequest,
    ) -> Result<tasks::Model, DbErr> {
        let task = tasks::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Task not found".to_string()))?;

        let mut task: tasks::ActiveModel = task.into();

        if let Some(title) = request.title {
            task.title = Set(title);
        }
        if let Some(description) = request.description {
            task.description = Set(Some(description));
        }
        if let Some(priority) = request.priority {
            task.priority = Set(priority);
        }
        if let Some(status) = request.status {
            task.status = Set(status.clone());
            // Automatically set completed_at when task is marked as completed
            if status == "completed" {
                task.completed_at = Set(Some(chrono::Utc::now()));
            } else if status != "completed" {
                // Clear completed_at if status is changed from completed to something else
                task.completed_at = Set(None);
            }
        }
        if let Some(order_num) = request.order_num {
            task.order_num = Set(order_num);
        }
        if let Some(dependencies) = request.dependencies {
            task.dependencies = Set(Some(
                serde_json::to_string(&dependencies).unwrap_or_default(),
            ));
        }
        if let Some(time_estimate) = request.time_estimate {
            task.time_estimate = Set(time_estimate);
        }
        if let Some(actual_time) = request.actual_time {
            task.actual_time = Set(actual_time);
        }
        if let Some(due_date) = request.due_date {
            task.due_date = Set(Some(due_date));
        }
        // Handle scheduled_date updates - either set to a new value or clear it
        if let Some(clear_scheduled_date) = request.clear_scheduled_date {
            if clear_scheduled_date {
                task.scheduled_date = Set(None);
            }
        } else if let Some(scheduled_date) = request.scheduled_date {
            task.scheduled_date = Set(Some(scheduled_date));
        }
        if let Some(tags) = request.tags {
            task.tags = Set(Some(serde_json::to_string(&tags).unwrap_or_default()));
        }
        if let Some(project_id) = request.project_id {
            task.project_id = Set(Some(project_id));
        }
        if let Some(parent_task_id) = request.parent_task_id {
            task.parent_task_id = Set(Some(parent_task_id));
        }
        if let Some(task_list_id) = request.task_list_id {
            if task_list_id.is_empty() {
                task.task_list_id = Set(None);
            } else {
                task.task_list_id = Set(Some(task_list_id));
            }
        }
        if let Some(completed_at) = request.completed_at {
            task.completed_at = Set(Some(completed_at));
        }

        task.updated_at = Set(chrono::Utc::now());

        task.update(&*self.db).await
    }

    /// Delete a task and its dependencies
    pub async fn delete_task(&self, id: &str) -> Result<(), DbErr> {
        let txn = self.db.begin().await?;

        // Delete task dependencies
        task_dependencies::Entity::delete_many()
            .filter(task_dependencies::Column::TaskId.eq(id))
            .exec(&txn)
            .await?;

        // Delete dependencies on this task
        task_dependencies::Entity::delete_many()
            .filter(task_dependencies::Column::DependsOnId.eq(id))
            .exec(&txn)
            .await?;

        // Delete the task
        tasks::Entity::delete_by_id(id).exec(&txn).await?;

        txn.commit().await
    }

    /// Add a dependency between tasks
    pub async fn add_dependency(
        &self,
        task_id: &str,
        depends_on_id: &str,
    ) -> Result<task_dependencies::Model, DbErr> {
        // Check if both tasks exist
        let task_exists = tasks::Entity::find_by_id(task_id)
            .one(&*self.db)
            .await?
            .is_some();
        let depends_on_exists = tasks::Entity::find_by_id(depends_on_id)
            .one(&*self.db)
            .await?
            .is_some();

        if !task_exists || !depends_on_exists {
            return Err(DbErr::RecordNotFound(
                "One or both tasks not found".to_string(),
            ));
        }

        // Check if dependency already exists
        let existing = task_dependencies::Entity::find()
            .filter(task_dependencies::Column::TaskId.eq(task_id))
            .filter(task_dependencies::Column::DependsOnId.eq(depends_on_id))
            .one(&*self.db)
            .await?;

        if existing.is_some() {
            return Err(DbErr::Custom("Dependency already exists".to_string()));
        }

        let dependency = task_dependencies::ActiveModel {
            task_id: Set(task_id.to_string()),
            depends_on_id: Set(depends_on_id.to_string()),
            ..Default::default()
        };

        dependency.insert(&*self.db).await
    }

    /// Remove a dependency between tasks
    pub async fn remove_dependency(&self, task_id: &str, depends_on_id: &str) -> Result<(), DbErr> {
        task_dependencies::Entity::delete_many()
            .filter(task_dependencies::Column::TaskId.eq(task_id))
            .filter(task_dependencies::Column::DependsOnId.eq(depends_on_id))
            .exec(&*self.db)
            .await?;

        Ok(())
    }

    /// Get task dependencies
    pub async fn get_dependencies(&self, task_id: &str) -> Result<Vec<tasks::Model>, DbErr> {
        let results = task_dependencies::Entity::find()
            .filter(task_dependencies::Column::TaskId.eq(task_id))
            .find_also_related(tasks::Entity)
            .all(&*self.db)
            .await?;

        Ok(results.into_iter().filter_map(|(_, task)| task).collect())
    }

    /// Get tasks that depend on this task
    pub async fn get_dependents(&self, task_id: &str) -> Result<Vec<tasks::Model>, DbErr> {
        let results = task_dependencies::Entity::find()
            .filter(task_dependencies::Column::DependsOnId.eq(task_id))
            .find_also_related(tasks::Entity)
            .all(&*self.db)
            .await?;

        Ok(results.into_iter().filter_map(|(_, task)| task).collect())
    }

    /// Get task statistics
    pub async fn get_task_stats(&self) -> Result<TaskStats, DbErr> {
        let total = tasks::Entity::find().count(&*self.db).await?;
        let completed = tasks::Entity::find()
            .filter(tasks::Column::Status.eq("completed"))
            .count(&*self.db)
            .await?;
        let in_progress = tasks::Entity::find()
            .filter(tasks::Column::Status.eq("in_progress"))
            .count(&*self.db)
            .await?;
        let pending = tasks::Entity::find()
            .filter(tasks::Column::Status.eq("pending"))
            .count(&*self.db)
            .await?;

        Ok(TaskStats {
            total,
            completed,
            in_progress,
            pending,
        })
    }

    /// Search tasks by title or description
    pub async fn search_tasks(&self, query: &str) -> Result<Vec<tasks::Model>, DbErr> {
        let search_pattern = format!("%{}%", query);

        tasks::Entity::find()
            .filter(
                tasks::Column::Title
                    .like(&search_pattern)
                    .or(tasks::Column::Description.like(&search_pattern)),
            )
            .order_by_desc(tasks::Column::UpdatedAt)
            .all(&*self.db)
            .await
    }

    /// Delete all task dependencies
    pub async fn delete_all_dependencies(&self) -> Result<u64, DbErr> {
        let result = task_dependencies::Entity::delete_many()
            .exec(&*self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// Delete all tasks
    pub async fn delete_all_tasks(&self) -> Result<u64, DbErr> {
        let result = tasks::Entity::delete_many().exec(&*self.db).await?;
        Ok(result.rows_affected)
    }

    /// Get all task dependencies for backup
    pub async fn get_all_dependencies(&self) -> Result<Vec<task_dependencies::Model>, DbErr> {
        task_dependencies::Entity::find().all(&*self.db).await
    }

    /// Import a task from backup data
    pub async fn import_task(&self, task: tasks::Model) -> Result<tasks::Model, DbErr> {
        let active_task = tasks::ActiveModel {
            id: Set(task.id),
            title: Set(task.title),
            description: Set(task.description),
            priority: Set(task.priority),
            status: Set(task.status),
            order_num: Set(task.order_num),
            dependencies: Set(task.dependencies),
            time_estimate: Set(task.time_estimate),
            actual_time: Set(task.actual_time),
            due_date: Set(task.due_date),
            scheduled_date: Set(task.scheduled_date),
            tags: Set(task.tags),
            project_id: Set(task.project_id),
            parent_task_id: Set(task.parent_task_id),
            task_list_id: Set(task.task_list_id),
            subtasks: Set(task.subtasks),
            periodic_template_id: Set(task.periodic_template_id),
            is_periodic_instance: Set(task.is_periodic_instance),
            generation_date: Set(task.generation_date),
            completed_at: Set(task.completed_at),
            created_at: Set(task.created_at),
            updated_at: Set(task.updated_at),
        };

        active_task.insert(&*self.db).await
    }

    /// Import a task dependency from backup data
    pub async fn import_dependency(
        &self,
        dependency: task_dependencies::Model,
    ) -> Result<task_dependencies::Model, DbErr> {
        let active_dependency = task_dependencies::ActiveModel {
            id: Set(dependency.id),
            task_id: Set(dependency.task_id),
            depends_on_id: Set(dependency.depends_on_id),
            created_at: Set(dependency.created_at),
        };

        active_dependency.insert(&*self.db).await
    }

    /// Count orphaned tasks (tasks without a task_list_id)
    pub async fn count_orphaned_tasks(&self) -> Result<u64, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::TaskListId.is_null())
            .count(&*self.db)
            .await
    }

    /// Count all tasks
    pub async fn count_all_tasks(&self) -> Result<u64, DbErr> {
        tasks::Entity::find().count(&*self.db).await
    }
}

/// Task statistics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStats {
    pub total: u64,
    pub completed: u64,
    pub in_progress: u64,
    pub pending: u64,
}
